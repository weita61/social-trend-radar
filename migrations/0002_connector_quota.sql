CREATE TABLE IF NOT EXISTS api_quota_daily (
  connector TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  units_used INTEGER NOT NULL DEFAULT 0 CHECK (units_used >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (connector, usage_date)
);

CREATE TABLE IF NOT EXISTS connector_runs (
  id TEXT PRIMARY KEY,
  connector TEXT NOT NULL,
  operation TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'quota_stopped')),
  quota_units INTEGER NOT NULL DEFAULT 0,
  error_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_connector_runs_connector_time
  ON connector_runs(connector, started_at DESC);

