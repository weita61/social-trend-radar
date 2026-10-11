CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  target_url TEXT NOT NULL,
  source_lane TEXT NOT NULL CHECK (source_lane IN ('fixed_panel', 'broad', 'external')),
  discovery_surface TEXT NOT NULL CHECK (discovery_surface IN ('fyp', 'search', 'profile', 'hashtag', 'chart', 'other')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'stopped', 'failed')),
  observed_count INTEGER NOT NULL DEFAULT 0 CHECK (observed_count >= 0),
  saved_count INTEGER NOT NULL DEFAULT 0 CHECK (saved_count >= 0),
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  blocked_write_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (blocked_write_attempt_count >= 0),
  executed_write_count INTEGER NOT NULL DEFAULT 0 CHECK (executed_write_count = 0),
  error_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_platform_time
  ON automation_runs(platform, started_at DESC);

CREATE TABLE IF NOT EXISTS automation_audit_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (
    operation IN ('navigate', 'read_visible', 'scroll', 'wait', 'capture', 'stop', 'blocked_write')
  ),
  target_url TEXT,
  attempted_write INTEGER NOT NULL DEFAULT 0 CHECK (attempted_write IN (0, 1)),
  executed_write INTEGER NOT NULL DEFAULT 0 CHECK (executed_write = 0),
  details_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_audit_run_time
  ON automation_audit_events(run_id, occurred_at ASC);
