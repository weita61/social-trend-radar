-- Cloudflare D1 receiving queue. This migration is intentionally not applied
-- to the Mac source-of-truth database.
CREATE TABLE IF NOT EXISTS capture_inbox (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'completed', 'failed')),
  lease_expires_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_capture_inbox_pending
  ON capture_inbox(status, received_at);

