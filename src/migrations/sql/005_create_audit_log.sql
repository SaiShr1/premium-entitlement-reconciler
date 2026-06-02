CREATE TABLE IF NOT EXISTS entitlement_audit_log (
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