INSERT INTO entitlements (user_id, active, source, expires_at, last_changed_at, reason)
VALUES
  ('u_store_1',    true,  'STORE',       NOW() + INTERVAL '30 days', NOW(), 'INITIAL_PURCHASE'),
  ('u_store_2',    true,  'STORE',       NOW() + INTERVAL '7 days',  NOW(), 'INITIAL_PURCHASE'),
  ('u_carrier_1',  true,  'CARRIER',     NOW() + INTERVAL '30 days', NOW(), 'CARRIER_ACTIVE'),
  ('u_carrier_2',  true,  'CARRIER',     NOW() + INTERVAL '14 days', NOW(), 'CARRIER_ACTIVE'),
  ('u_market_1',   true,  'MARKETPLACE', NULL,                       NOW(), 'MARKETPLACE_GRANT'),
  ('u_inactive_1', false, 'NONE',        NULL,                       NOW(), NULL)
ON CONFLICT (user_id) DO NOTHING;