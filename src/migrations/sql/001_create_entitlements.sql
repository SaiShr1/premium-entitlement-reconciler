CREATE TABLE IF NOT EXISTS entitlements (
  user_id             TEXT        PRIMARY KEY,
  active              BOOLEAN     NOT NULL DEFAULT false,
  source              TEXT        NOT NULL DEFAULT 'NONE',
  expires_at          TIMESTAMPTZ,
  last_changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason              TEXT,
  last_event_time_ms  BIGINT
);