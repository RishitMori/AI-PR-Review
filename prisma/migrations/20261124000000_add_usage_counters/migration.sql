CREATE TABLE usage_counters (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
