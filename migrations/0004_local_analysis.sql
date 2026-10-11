CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  post_count INTEGER NOT NULL DEFAULT 0 CHECK (post_count >= 0),
  cluster_count INTEGER NOT NULL DEFAULT 0 CHECK (cluster_count >= 0),
  error_code TEXT
);

CREATE TABLE IF NOT EXISTS post_metric_analysis (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  metric_snapshot_id TEXT REFERENCES metric_snapshots(id) ON DELETE SET NULL,
  baseline_scope TEXT NOT NULL CHECK (baseline_scope IN ('creator', 'platform', 'none')),
  baseline_value REAL,
  usual_value_ratio REAL,
  robust_lift_score REAL NOT NULL DEFAULT 0,
  velocity_per_hour REAL,
  engagement_rate REAL,
  computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trend_assessments (
  cluster_id TEXT PRIMARY KEY REFERENCES clusters(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('market_trend', 'provisional', 'team_interest', 'insufficient_evidence')),
  gate_passed INTEGER NOT NULL CHECK (gate_passed IN (0, 1)),
  independent_creator_count INTEGER NOT NULL DEFAULT 0 CHECK (independent_creator_count >= 0),
  non_user_lane_count INTEGER NOT NULL DEFAULT 0 CHECK (non_user_lane_count >= 0),
  independently_confirmed_post_count INTEGER NOT NULL DEFAULT 0 CHECK (independently_confirmed_post_count >= 0),
  growing_post_count INTEGER NOT NULL DEFAULT 0 CHECK (growing_post_count >= 0),
  excluded_team_share_count INTEGER NOT NULL DEFAULT 0 CHECK (excluded_team_share_count >= 0),
  explanation_json TEXT NOT NULL,
  computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trend_evidence_posts (
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('earliest', 'fastest_rising', 'cross_platform', 'counterexample', 'representative')),
  why_included TEXT NOT NULL,
  rank_order INTEGER NOT NULL CHECK (rank_order >= 0),
  PRIMARY KEY (cluster_id, post_id, role)
);

CREATE INDEX IF NOT EXISTS idx_trend_evidence_cluster_rank
  ON trend_evidence_posts(cluster_id, rank_order ASC);

CREATE TABLE IF NOT EXISTS analysis_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_owned_clusters (
  cluster_id TEXT PRIMARY KEY REFERENCES clusters(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO analysis_settings (key, value_json, updated_at) VALUES
  ('bias_weights', '{"userSubmittedShare":0.35,"submitterHhi":0.25,"independentConfirmationGap":0.25,"nonUserLaneGap":0.15}', '2026-10-10T00:00:00.000Z'),
  ('clustering', '{"surfaceDistance":0.58,"formatDistance":0.48,"desireDistance":0.42,"embeddingDimensions":64}', '2026-10-10T00:00:00.000Z'),
  ('trend_gate', '{"independentCreators":3,"nonUserLanes":2,"independentConfirmations":1,"growingPosts":1}', '2026-10-10T00:00:00.000Z');

INSERT OR IGNORE INTO fit_profiles (id, name, config_json, created_at) VALUES
  ('fit_local_default', '標準ローカル評価', '{"platforms":["youtube","instagram","tiktok"],"preferredFormatTags":[],"preferredDesireTags":[],"brandSafetyExcludedTags":[]}', '2026-10-10T00:00:00.000Z');
