CREATE TABLE IF NOT EXISTS notifications (
  id            SERIAL      PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  CONSTRAINT uq_notifications_once UNIQUE (user_id, type, scheduled_for)
);