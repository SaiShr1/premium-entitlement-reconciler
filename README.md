# Premium Entitlement Reconciler

A backend service that ingests premium subscription signals from three sales channels and maintains canonical entitlement state per user.

## Channels

| Channel | Mechanism | Behaviour |
| --- | --- | --- |
| In-app Store | Webhooks pushed to us | At-least-once, no ordering guarantee, may arrive days late |
| Mobile Carrier | We poll their API every 5 min | Statuses: `active` / `inactive` / `api_error` |
| Third-party Marketplace | Monthly bulk revoke request | Only revokes, never grants |

## How to Run

```bash
cp .env.example .env
# Optionally set DD_API_KEY for Datadog
docker compose up --build

```

The app starts on `http://localhost:3000`. Migrations and seed data run automatically on startup.

## API Reference

**Health check:**

```bash
curl http://localhost:3000/health

```

**Store webhook (create/renew/cancel subscription):**

```bash
curl -X POST http://localhost:3000/webhooks/store \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"evt_001","userId":"u_new","type":"INITIAL_PURCHASE","eventTimeMs":1000,"productId":"premium_monthly"}'

```

**Marketplace bulk revoke:**

```bash
curl -X POST http://localhost:3000/webhooks/marketplace/revoke \
  -H 'Content-Type: application/json' \
  -d '{"userIds":["u_market_1"]}'

```

**Read entitlement:**

```bash
curl http://localhost:3000/users/u_store_1/entitlement

```

**Mock carrier (used internally by poller):**

```bash
curl 'http://localhost:3000/mock/carrier/plan?userId=u_carrier_1'

```

## Design Decisions

* **First-write-wins ownership.** The first channel to grant a user premium owns the entitlement. Subsequent channels are rejected until the owner revokes. Enforced via `SELECT FOR UPDATE` inside a transaction.
* **`SKIP LOCKED` for worker safety.** Both the carrier poller and notification worker use `FOR UPDATE SKIP LOCKED` so multiple instances can run concurrently without double-processing.
* **No ORM — raw SQL via `pg`.** Easier to reason about transactions, locking, and the exact queries under review pressure. No hidden N+1s or magic.
* **Idempotent webhooks.** Store events are deduplicated via `processed_events` table. Duplicate `eventId` returns `201` with no state change.
* **Out-of-order guard.** Store events carry `eventTimeMs`. Stale events (lower timestamp than last processed) are silently dropped.
* **Fail-safe carrier polling.** `api_error` from the carrier triggers no state change — we never revoke on uncertainty.

## Tradeoffs Considered

| Choice | Alternative | Why |
| --- | --- | --- |
| **PostgreSQL** | SQLite | Need `SELECT FOR UPDATE SKIP LOCKED` for concurrent workers |
| **NestJS** | Fastify / Express | DI, modules, decorators, `@nestjs/schedule` — all interview-explainable |
| **First-write-wins** | Last-write-wins | Prevents channel-hopping; simpler conflict model |
| **Raw SQL** | TypeORM / Prisma | Full control over transactions and locking behaviour |

## What I'd Change With Another Week

* Connection pooling tuning (min/max pool size, idle timeout)
* Outbox pattern for notifications instead of direct DB insert
* Retry with exponential backoff on carrier API errors
* Multi-region Datadog configuration
* Rate limiting on webhook endpoints
* Proper secrets management (Vault / AWS SSM)

## Running Tests

```bash
# Start Postgres (keep docker compose up in another terminal)
DB_HOST=localhost npm run test:e2e -- --verbose

```
