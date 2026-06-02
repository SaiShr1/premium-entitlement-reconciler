# Local Testing Guide

Step-by-step commands to run and verify every feature of the Premium Entitlement Reconciler.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+
- npm

## 1. Start the Service

```bash
cp .env.example .env
docker compose up --build
```

Wait for `Server running on http://localhost:3000` in the logs.

## 2. Health Check

```bash
curl -s http://localhost:3000/health | jq
```

Expected:

```json
{ "status": "ok" }
```

## 3. Store Webhook — INITIAL_PURCHASE

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_001",
    "userId": "u_new_user",
    "type": "INITIAL_PURCHASE",
    "eventTimeMs": 1000,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "applied"`, `"active": true`, `"source": "STORE"`

## 4. Store Webhook — Duplicate Detection

Send the exact same request again:

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_001",
    "userId": "u_new_user",
    "type": "INITIAL_PURCHASE",
    "eventTimeMs": 1000,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "duplicate"`

## 5. Store Webhook — Source Conflict (First-Write-Wins)

Try to purchase on a carrier-owned seeded user:

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_002",
    "userId": "u_carrier_1",
    "type": "INITIAL_PURCHASE",
    "eventTimeMs": 2000,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "source_conflict"`

## 6. Store Webhook — Out-of-Order Guard

Send an event with a lower timestamp than the last processed:

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_003",
    "userId": "u_new_user",
    "type": "RENEWAL",
    "eventTimeMs": 500,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "out_of_order"`

## 7. Store Webhook — RENEWAL

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_004",
    "userId": "u_new_user",
    "type": "RENEWAL",
    "eventTimeMs": 2000,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "applied"`, `"reason": "RENEWAL"`, `expires_at` extended by 30 days

## 8. Store Webhook — CANCELLATION

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_005",
    "userId": "u_new_user",
    "type": "CANCELLATION",
    "eventTimeMs": 3000,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "applied"`, `"active": true` (stays active until expiry), `"reason": "CANCELLATION"`

## 9. Store Webhook — UN_CANCELLATION

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_006",
    "userId": "u_new_user",
    "type": "UN_CANCELLATION",
    "eventTimeMs": 4000,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "applied"`, `"reason": "UN_CANCELLATION"`

## 10. Store Webhook — BILLING_ISSUE

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_007",
    "userId": "u_new_user",
    "type": "BILLING_ISSUE",
    "eventTimeMs": 5000,
    "productId": "premium_monthly"
  }' | jq
```

Expected: `"status": "applied"`, `"active": false`, `"source": "NONE"`, `"reason": "BILLING_ISSUE"`

## 11. Store Webhook — EXPIRATION

First create a fresh user, then expire:

```bash
curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_008",
    "userId": "u_expire_test",
    "type": "INITIAL_PURCHASE",
    "eventTimeMs": 1000,
    "productId": "premium_monthly"
  }' | jq

curl -s -X POST 'http://localhost:3000/webhooks/store' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "evt_009",
    "userId": "u_expire_test",
    "type": "EXPIRATION",
    "eventTimeMs": 2000,
    "productId": "premium_monthly"
  }' | jq
```

Expected (second call): `"active": false`, `"source": "NONE"`, `"reason": "EXPIRATION"`

## 12. Read Entitlement

**Existing user:**

```bash
curl -s 'http://localhost:3000/users/u_store_1/entitlement' | jq
```

Expected: Returns entitlement object with `active`, `source`, `expiresAt`, etc.

**Non-existent user (404):**

```bash
curl -s 'http://localhost:3000/users/u_doesnt_exist/entitlement' | jq
```

Expected: `"statusCode": 404`

## 13. Carrier — Mock Endpoint

```bash
curl -s 'http://localhost:3000/mock/carrier/plan?userId=u_carrier_1' | jq
```

Run multiple times. Expected: random responses — `"active"` (~85%), `"inactive"` (~10%), `"api_error"` (~5%).

## 14. Carrier — Poll Worker

The carrier poller runs automatically every 5 minutes. Watch the Docker logs:

```bash
docker compose logs -f app
```

You'll see lines like:

```bash
Carrier poll started
User u_carrier_1: carrier status=active
Carrier poll complete
```

To verify a carrier user got deactivated:

```bash
curl -s 'http://localhost:3000/users/u_carrier_1/entitlement' | jq
```

If the poller got an `inactive` response, you'll see `"active": false`, `"reason": "CARRIER_INACTIVE"`.

## 15. Marketplace — Bulk Revoke

**Revoke a marketplace user:**

```bash
curl -s -X POST 'http://localhost:3000/webhooks/marketplace/revoke' \
  -H 'Content-Type: application/json' \
  -d '{"userIds": ["u_market_1"]}' | jq
```

Expected: `"revokedCount": 1`

**Verify the revoke:**

```bash
curl -s 'http://localhost:3000/users/u_market_1/entitlement' | jq
```

Expected: `"active": false`, `"source": "NONE"`, `"reason": "MARKETPLACE_REVOKE"`

**Source guard — try to revoke a STORE user:**

```bash
curl -s -X POST 'http://localhost:3000/webhooks/marketplace/revoke' \
  -H 'Content-Type: application/json' \
  -d '{"userIds": ["u_store_1"]}' | jq
```

Expected: `"revokedCount": 0` (source guard protects non-MARKETPLACE users)

**Revoke already-revoked user (idempotent):**

```bash
curl -s -X POST 'http://localhost:3000/webhooks/marketplace/revoke' \
  -H 'Content-Type: application/json' \
  -d '{"userIds": ["u_market_1"]}' | jq
```

Expected: `"revokedCount": 0` (source is now NONE, not MARKETPLACE)

## 16. Notifications — Schedule and Process

Insert a notification due now directly into the DB:

```bash
docker compose exec postgres psql -U postgres -d reconciler -c \
  "INSERT INTO notifications (user_id, type, scheduled_for)
   VALUES ('u_test_notify', 'PREMIUM_EXPIRES_SOON', NOW())
   ON CONFLICT DO NOTHING;"
```

The notification worker runs every minute. Watch Docker logs for:

```bash
Sending PREMIUM_EXPIRES_SOON notification to user u_test_notify
Processed 1 notifications
```

Verify `sent_at` was set:

```bash
docker compose exec postgres psql -U postgres -d reconciler -c \
  "SELECT user_id, type, scheduled_for, sent_at FROM notifications WHERE user_id = 'u_test_notify';"
```

Expected: `sent_at` column should be populated.

## 17. Audit Log

After any state change (steps 3–11, 15), check the audit trail:

```bash
docker compose exec postgres psql -U postgres -d reconciler -c \
  "SELECT id, user_id, triggering_event_id, prev_active, prev_source, next_active, next_source, reason, changed_at
   FROM entitlement_audit_log ORDER BY changed_at DESC LIMIT 10;"
```

Expected: One row per state change, showing previous and next state.

## 18. Timeline Endpoint

```bash
curl -s 'http://localhost:3000/users/u_new_user/timeline' | jq
```

Expected: Array of state transitions in chronological order, each with `prevState`, `nextState`, `reason`, and `changedAt`.

**Non-existent user (404):**

```bash
curl -s 'http://localhost:3000/users/u_doesnt_exist/timeline' | jq
```

Expected: `"statusCode": 404`

## 19. Run E2E Tests

Keep Docker running (Postgres must be available at localhost:5432), then in a separate terminal:

```bash
DB_HOST=localhost npm run test:e2e -- --verbose
```

All tests should pass.

## 20. Reset Database

To start fresh (clears all data and re-runs migrations + seed):

```bash
docker compose down -v
docker compose up --build
```

## Seed Users Reference

These users are pre-populated on startup:

| user_id | source | active | expires |
| --- | --- | --- | --- |
| u_store_1 | STORE | true | +30 days |
| u_store_2 | STORE | true | +7 days |
| u_carrier_1 | CARRIER | true | +30 days |
| u_carrier_2 | CARRIER | true | +14 days |
| u_market_1 | MARKETPLACE | true | none |
| u_inactive_1 | NONE | false | none |
