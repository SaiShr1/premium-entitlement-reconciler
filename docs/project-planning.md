# Project Context — Premium Entitlement Reconciler

Use this file to onboard a new chat window to the full context of this project.

---

## Collaboration Rules

- We are building this together as a team — senior engineer + candidate
- Never implement unrelated features
- Keep responses scoped to the current phase only
- Prefer simplicity over cleverness
- Do not stop to tell the user to do external things — build continuously
- Point out likely interviewer follow-up questions when relevant

---

## The Assignment (Summary)

A single backend service that ingests premium subscription signals from three sales channels and maintains the canonical entitlement state per user.

### Three channels

| Channel | Mechanism | Behaviour |
| --- | --- | --- |
| In-app Store | Webhooks pushed to us | At-least-once, no ordering guarantee, may arrive days late |
| Mobile Carrier | We poll their API every 5 min | Statuses: active / inactive / api_error |
| Third-party Marketplace | Monthly bulk revoke request | Only revokes, never grants |

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /webhooks/store | Ingest store subscription events |
| POST | /webhooks/marketplace/revoke | Bulk revoke marketplace-granted access |
| GET | /users/:id/entitlement | Read canonical entitlement state |
| GET | /mock/carrier/plan | Mock carrier API stub (lives in repo) |
| GET | /health | Liveness probe |

### Background workers

- Carrier poller — `@Cron('*/5 * * * *')`, multiple instances safe via SKIP LOCKED
- Notification worker — `@Cron('* * * * *')`, multiple instances safe via SKIP LOCKED

### Stretch (commit core first, then add on top)

- Audit log of every entitlement state transition
- `GET /users/:id/timeline` — history reconstructed from audit log

---

## Locked Decisions

| Concern | Decision | Rationale |
| --- | --- | --- |
| Language | TypeScript + Node.js | Faster to scaffold, readable in review |
| Framework | NestJS | DI, modules, class-validator, @nestjs/schedule — all interview-explainable |
| Database | PostgreSQL | SELECT FOR UPDATE SKIP LOCKED rules out SQLite |
| ORM | None — raw SQL via `pg` | Easier to reason about under pressure |
| Source ownership | **First write wins** | First channel to grant access owns the entitlement. Enforced at DB layer via SELECT FOR UPDATE. |
| BILLING_ISSUE | Immediate revoke | active=false, source=NONE — same as EXPIRATION |
| Run command | `docker compose up` | Boots app + postgres + datadog-agent |
| Datadog | Fully integrated | dd-trace APM + hot-shots StatsD metrics + winston logs |

---

## First-Write-Wins Ownership (Core Pattern)

Every write to `entitlements` goes through this transaction:

```sql
BEGIN;
  SELECT * FROM entitlements WHERE user_id = $1 FOR UPDATE;
  -- if active=true AND source != incoming_source → no-op, COMMIT, return current state
  -- if active=false OR source = incoming_source  → apply update, COMMIT
COMMIT;
```

The `FOR UPDATE` lock prevents concurrent writers from racing past this check.

**When a slot opens:** BILLING_ISSUE, EXPIRATION, carrier `inactive`, or marketplace revoke sets `active=false, source=NONE`. The next event from any channel can then claim the user.

---

## Schema

```sql
CREATE TABLE entitlements (
  user_id             TEXT        PRIMARY KEY,
  active              BOOLEAN     NOT NULL DEFAULT false,
  source              TEXT        NOT NULL DEFAULT 'NONE',
  expires_at          TIMESTAMPTZ,
  last_changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason              TEXT,
  last_event_time_ms  BIGINT
);

CREATE TABLE processed_events (
  event_id     TEXT        PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id            SERIAL      PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  CONSTRAINT uq_notifications_once UNIQUE (user_id, type, scheduled_for)
);

-- STRETCH only
CREATE TABLE entitlement_audit_log (
  id                  SERIAL      PRIMARY KEY,
  user_id             TEXT        NOT NULL,
  triggering_event_id TEXT,
  prev_active         BOOLEAN,
  prev_source         TEXT,
  prev_expires_at     TIMESTAMPTZ,
  next_active         BOOLEAN,
  next_source         TEXT,
  next_expires_at     TIMESTAMPTZ,
  reason              TEXT,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Store Event State Machine

| Event | Ownership required | Effect |
| --- | --- | --- |
| INITIAL_PURCHASE | active=false OR source=STORE | active=true, source=STORE, set expires_at |
| RENEWAL | source=STORE | active=true, extend expires_at |
| CANCELLATION | source=STORE | active stays true until expires_at; reason=CANCELLATION |
| UN_CANCELLATION | source=STORE | clear cancellation reason, restore renewal |
| BILLING_ISSUE | source=STORE | active=false, expires_at=null, source=NONE |
| EXPIRATION | source=STORE | active=false, expires_at=null, source=NONE |

**Out-of-order guard:** Only apply if `eventTimeMs > last_event_time_ms`. Otherwise 200, drop silently.
**Idempotency:** INSERT into `processed_events` first. On conflict → 200, skip.

---

## NestJS Module Map

```md
AppModule
├── DatabaseModule (Global)
├── WebhooksModule
│   ├── StoreWebhookController    POST /webhooks/store
│   ├── StoreWebhookService
│   ├── MarketplaceController     POST /webhooks/marketplace/revoke
│   └── MarketplaceService
├── EntitlementsModule
│   ├── EntitlementsController    GET /users/:id/entitlement
│   └── EntitlementsService
├── CarrierModule
│   ├── CarrierPollService        @Cron every 5 min
│   └── MockCarrierController     GET /mock/carrier/plan
├── NotificationsModule
│   ├── NotificationScheduler     (called by other services)
│   └── NotificationWorker        @Cron every minute
└── ObservabilityModule           (Phase 6.5)
    ├── MetricsService
    └── LoggerService
```

---

## Seed Users

```md
u_store_1    → STORE,       active, expires +30d
u_store_2    → STORE,       active, expires +7d
u_carrier_1  → CARRIER,     active, expires +30d
u_carrier_2  → CARRIER,     active, expires +14d
u_market_1   → MARKETPLACE, active, no expiry
u_inactive_1 → NONE,        inactive
```

---

## Datadog (Phase 6.5)

`dd-trace` import is commented out in `main.ts` — uncomment in Phase 6.5.

| Layer | Tool | Coverage |
| --- | --- | --- |
| APM | dd-trace | Auto-instruments HTTP + pg |
| Metrics | hot-shots (StatsD → agent) | Custom counters per event |
| Logs | winston + DD JSON format | Correlated with traces via trace_id |

Custom metrics: `entitlement.webhook.processed` (tag: event_type), `entitlement.webhook.duplicate`, `entitlement.webhook.out_of_order`, `entitlement.webhook.source_conflict`, `entitlement.carrier.poll_result` (tag: status), `entitlement.notification.scheduled`, `entitlement.state_change` (tags: source, reason).

---

## Phase Build Details

### ✅ Phase 0 — Project Skeleton (DONE)

Files created:

```md
package.json, tsconfig.json, tsconfig.build.json, nest-cli.json
Dockerfile, docker-compose.yml, .env.example, .gitignore
src/main.ts
src/app.module.ts
src/health/health.controller.ts
src/database/database.module.ts
src/database/database.service.ts
src/migrations/runner.ts
src/migrations/sql/001_create_entitlements.sql
src/migrations/sql/002_create_processed_events.sql
src/migrations/sql/003_create_notifications.sql
src/migrations/sql/004_seed_users.sql
```

`docker compose up` boots app + postgres + datadog-agent. Migration runner applies SQL files in order on startup. `GET /health` returns `{ status: 'ok' }`.

---

### 🔲 Phase 1 — Store Webhook Ingestion (NEXT)

**Files to create:**

```md
src/webhooks/dto/store-webhook.dto.ts
src/webhooks/store-webhook.service.ts
src/webhooks/store-webhook.controller.ts
src/webhooks/webhooks.module.ts
```

**Update:** Register `WebhooksModule` in `src/app.module.ts`.

**`store-webhook.dto.ts`** — use `class-validator`:

```typescript
export class StoreWebhookDto {
  @IsString() eventId: string;
  @IsString() userId: string;
  @IsEnum(['INITIAL_PURCHASE','RENEWAL','CANCELLATION','BILLING_ISSUE','EXPIRATION','UN_CANCELLATION']) type: string;
  @IsNumber() eventTimeMs: number;
  @IsString() productId: string;
}
```

**`store-webhook.service.ts`** — processing order:

1. INSERT into `processed_events` (ON CONFLICT DO NOTHING). If 0 rows inserted → duplicate, return early.
2. `getClient()` → BEGIN
3. `SELECT * FROM entitlements WHERE user_id = $1 FOR UPDATE`
4. If `active=true AND source !== 'STORE'` → source conflict, COMMIT, return current row
5. If `eventTimeMs <= last_event_time_ms` → out-of-order, COMMIT, return current row
6. Apply state machine → build update payload
7. UPDATE entitlements, COMMIT
8. If new `expires_at` is within 24h → call `NotificationScheduler.schedule()`
9. Emit metrics

**State machine switch** — returns `Partial<Entitlement>`:

- INITIAL_PURCHASE → `{ active: true, source: 'STORE', expires_at: computed, reason: 'INITIAL_PURCHASE' }`
- RENEWAL → `{ active: true, expires_at: extended, reason: 'RENEWAL' }`
- CANCELLATION → `{ reason: 'CANCELLATION' }` (no active change)
- UN_CANCELLATION → `{ reason: 'UN_CANCELLATION' }`
- BILLING_ISSUE → `{ active: false, expires_at: null, source: 'NONE', reason: 'BILLING_ISSUE' }`
- EXPIRATION → `{ active: false, expires_at: null, source: 'NONE', reason: 'EXPIRATION' }`

**`expires_at` computation for INITIAL_PURCHASE / RENEWAL:** derive from `productId`. `premium_monthly` → +30 days, `premium_annual` → +365 days. Default +30 days for unknown products.

**Controller:** `POST /webhooks/store` → always returns `201` on success (even for duplicates/no-ops — idempotent acknowledgement).

---

### 🔲 Phase 2 — Entitlement Read Endpoint

**Files to create:**

```md
src/entitlements/entitlements.service.ts
src/entitlements/entitlements.controller.ts
src/entitlements/entitlements.module.ts
```

**Update:** Register `EntitlementsModule` in `src/app.module.ts`.

**Query:** `SELECT * FROM entitlements WHERE user_id = $1`

**Response shape:**

```json
{
  "active": true,
  "source": "STORE",
  "expiresAt": "2026-06-10T00:00:00Z",
  "lastChangedAt": "2026-05-20T11:23:00Z",
  "reason": "RENEWAL"
}
```

Return `404` if user not found. Map snake_case DB columns to camelCase in the service, not the controller.

---

### 🔲 Phase 3 — Carrier Polling

**Files to create:**

```md
src/carrier/carrier.module.ts
src/carrier/carrier-poll.service.ts
src/carrier/mock-carrier.controller.ts
```

**Update:** Register `CarrierModule` in `src/app.module.ts`.

**Mock carrier (`GET /mock/carrier/plan?userId=`):**
Randomised response — 85% `active`, 10% `inactive`, 5% `api_error`. Return `{ status: 'active' | 'inactive' | 'api_error' }`.

**Carrier poll service — `@Cron('*/5 * * * *')`:**

```md
1. getClient() → BEGIN
2. SELECT user_id, expires_at FROM entitlements
   WHERE source = 'CARRIER' AND active = true
   LIMIT 10
   FOR UPDATE SKIP LOCKED
3. For each user:
   a. Call GET /mock/carrier/plan?userId=
   b. status=active   → UPDATE last_changed_at = NOW() (keep alive, no state change)
   c. status=inactive → UPDATE active=false, source=NONE, reason=CARRIER_INACTIVE
   d. status=api_error → NO-OP (fail safe — never revoke on uncertainty)
4. COMMIT
```

The `SKIP LOCKED` ensures multiple running instances don't double-process the same user.

---

### 🔲 Phase 4 — Marketplace Bulk Revoke

**Files to create:**

```md
src/webhooks/dto/marketplace-revoke.dto.ts
src/webhooks/marketplace.service.ts
src/webhooks/marketplace.controller.ts
```

(Lives inside `WebhooksModule` — no new module needed.)

**DTO:**

```typescript
export class MarketplaceRevokeDto {
  @IsArray() @IsString({ each: true }) userIds: string[];
}
```

**Service query:**

```sql
UPDATE entitlements
SET active = false,
    source = 'NONE',
    reason = 'MARKETPLACE_REVOKE',
    last_changed_at = NOW()
WHERE user_id = ANY($1)
  AND source = 'MARKETPLACE'
RETURNING user_id
```

**Response:** `{ revokedCount: N }` — rows actually affected (not just IDs received).

**Controller:** `POST /webhooks/marketplace/revoke` → 200 with revokedCount.

---

### 🔲 Phase 5 — Expiry Notifications

**Files to create:**

```md
src/notifications/notifications.module.ts
src/notifications/notification-scheduler.service.ts
src/notifications/notification-worker.service.ts
```

**Update:** Register `NotificationsModule` in `src/app.module.ts`. Inject `NotificationScheduler` into `StoreWebhookService`.

**`NotificationScheduler.schedule(userId, expiresAt)`:**

```sql
INSERT INTO notifications (user_id, type, scheduled_for)
VALUES ($1, 'PREMIUM_EXPIRES_SOON', $2 - INTERVAL '24 hours')
ON CONFLICT ON CONSTRAINT uq_notifications_once DO NOTHING
```

Called from `StoreWebhookService` after any write that sets `expires_at` within 24h of now.

**`NotificationWorker` — `@Cron('* * * * *')`:**

```md
1. getClient() → BEGIN
2. SELECT id, user_id FROM notifications
   WHERE scheduled_for <= NOW() AND sent_at IS NULL
   LIMIT 10
   FOR UPDATE SKIP LOCKED
3. For each row:
   UPDATE notifications SET sent_at = NOW() WHERE id = $1
4. COMMIT
```

"Sending" a notification = setting `sent_at`. No external push infra needed for this assignment.

---

### 🔲 Phase 5.5 — Datadog Observability

**Files to create:**

```md
src/observability/tracer.ts
src/observability/metrics.service.ts
src/observability/observability.module.ts
```

**Update:** Uncomment `import './observability/tracer'` at top of `src/main.ts`. Register `ObservabilityModule` in `src/app.module.ts`. Inject `MetricsService` into all service classes.

**`tracer.ts`:**

```typescript
import tracer from 'dd-trace';
tracer.init({
  service: 'premium-entitlement-reconciler',
  env: process.env.NODE_ENV ?? 'development',
  logInjection: true, // injects trace_id into winston logs
});
export default tracer;
```

**`metrics.service.ts`:** Wraps `hot-shots` StatsD client. Methods: `increment(metric, tags)`. Points to `DD_AGENT_HOST:8125`. No-ops gracefully if agent not reachable.

**`docker-compose.yml` datadog-agent service** is already present — just needs `DD_API_KEY` in `.env`.

---

### 🔲 Phase 6 — Tests

**Files to create:**

```md
src/webhooks/store-webhook.service.spec.ts   (unit — state machine)
test/store-webhook.e2e-spec.ts               (integration)
test/marketplace.e2e-spec.ts
test/carrier-poll.e2e-spec.ts
test/notifications.e2e-spec.ts
test/jest-e2e.json
```

**Test cases — every one maps to an assignment requirement:**

| Test | File | What it proves |
| --- | --- | --- |
| Duplicate eventId | e2e/store-webhook | Idempotency — second call is no-op |
| RENEWAL before INITIAL_PURCHASE | e2e/store-webhook | Out-of-order guard |
| Stale CANCELLATION after UN_CANCELLATION | e2e/store-webhook | Late-arrival guard |
| INITIAL_PURCHASE on CARRIER-owned user | e2e/store-webhook | First-write-wins rejects |
| BILLING_ISSUE | unit/state-machine | active=false, source=NONE |
| Marketplace revoke on STORE user | e2e/marketplace | Source guard protects user |
| Marketplace revoke on MARKETPLACE user | e2e/marketplace | Revoke succeeds, revokedCount=1 |
| Carrier inactive response | e2e/carrier | Sets active=false |
| Carrier api_error response | e2e/carrier | No state change |
| Two concurrent poll workers, same user | e2e/carrier | SKIP LOCKED — only one processes |
| expiresAt within 24h → notification row | e2e/notifications | Row created |
| Same expiry scheduled twice | e2e/notifications | Only one row (unique constraint) |
| Notification worker runs twice | e2e/notifications | Only one sent_at set |

**Test setup:** Use a separate `entitlement_test` database. Wrap each test in a transaction that rolls back on teardown — no test pollution.

---

### 🔲 Phase 7 — README + Polish

**File:** `README.md` at project root.

**Sections:**

1. How to run — `cp .env.example .env`, set `DD_API_KEY`, `docker compose up`
2. API reference — `curl` examples for every endpoint
3. Design decisions — first-write-wins, SKIP LOCKED, no ORM, Datadog
4. Tradeoffs considered — SQLite vs Postgres, NestJS vs Fastify, last-write vs first-write, ORM vs raw SQL
5. What I'd change with another week — connection pooling tuning, outbox pattern for notifications, proper retry/backoff on carrier API errors, multi-region Datadog config

**Commit at this point before starting stretch.**

---

### 🔲 Stretch A — Audit Log

**Files to create:**

```bash
src/migrations/sql/005_create_audit_log.sql
src/audit/audit.service.ts
src/audit/audit.module.ts
```

**Update:** Inject `AuditService` into `StoreWebhookService`, `CarrierPollService`, `MarketplaceService`. Call `audit.record()` inside every transaction that changes entitlement state.

**`audit.record()` signature:**

```typescript
record(client: PoolClient, params: {
  userId: string;
  triggeringEventId?: string;
  prev: Partial<Entitlement>;
  next: Partial<Entitlement>;
  reason: string;
}): Promise<void>
```

Runs the INSERT inside the same client/transaction as the entitlement update — atomicity guaranteed.

---

### 🔲 Stretch B — Timeline Endpoint

**Files to create:**

```md
src/audit/audit.controller.ts
```

(Reuses `AuditModule`.)

**Endpoint:** `GET /users/:id/timeline`

**Query:** `SELECT * FROM entitlement_audit_log WHERE user_id = $1 ORDER BY changed_at ASC`

**Response:**

```json
[
  {
    "changedAt": "2026-05-01T10:00:00Z",
    "triggeringEventId": "evt_abc123",
    "prevState": { "active": false, "source": "NONE", "expiresAt": null },
    "nextState": { "active": true, "source": "STORE", "expiresAt": "2026-06-01T00:00:00Z" },
    "reason": "INITIAL_PURCHASE"
  }
]
```

---

## Complete Target File Tree

```bash
premium-entitlement-reconciler/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── project-context.md
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── health/
    │   └── health.controller.ts
    ├── database/
    │   ├── database.module.ts
    │   └── database.service.ts
    ├── migrations/
    │   ├── runner.ts
    │   └── sql/
    │       ├── 001_create_entitlements.sql
    │       ├── 002_create_processed_events.sql
    │       ├── 003_create_notifications.sql
    │       ├── 004_seed_users.sql
    │       └── 005_create_audit_log.sql
    ├── webhooks/
    │   ├── webhooks.module.ts
    │   ├── dto/
    │   │   ├── store-webhook.dto.ts
    │   │   └── marketplace-revoke.dto.ts
    │   ├── store-webhook.service.ts
    │   ├── store-webhook.controller.ts
    │   ├── marketplace.service.ts
    │   └── marketplace.controller.ts
    ├── entitlements/
    │   ├── entitlements.module.ts
    │   ├── entitlements.service.ts
    │   └── entitlements.controller.ts
    ├── carrier/
    │   ├── carrier.module.ts
    │   ├── carrier-poll.service.ts
    │   └── mock-carrier.controller.ts
    ├── notifications/
    │   ├── notifications.module.ts
    │   ├── notification-scheduler.service.ts
    │   └── notification-worker.service.ts
    ├── observability/
    │   ├── tracer.ts
    │   ├── metrics.service.ts
    │   └── observability.module.ts
    └── audit/
        ├── audit.module.ts
        ├── audit.service.ts
        └── audit.controller.ts

test/
├── jest-e2e.json
├── store-webhook.e2e-spec.ts
├── marketplace.e2e-spec.ts
├── carrier-poll.e2e-spec.ts
└── notifications.e2e-spec.ts
```
