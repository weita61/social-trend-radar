PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'unknown')),
  platform_creator_id TEXT,
  handle TEXT,
  profile_url TEXT,
  first_seen_at TEXT NOT NULL,
  UNIQUE (platform, platform_creator_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'unknown')),
  platform_post_id TEXT,
  canonical_url TEXT NOT NULL UNIQUE,
  creator_id TEXT REFERENCES creators(id),
  published_at TEXT,
  caption TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  audio_key TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('short', 'reel', 'video', 'unknown')),
  first_seen_at TEXT NOT NULL,
  last_refreshed_at TEXT,
  access_tier TEXT NOT NULL CHECK (access_tier IN ('official_api', 'oembed', 'user_visible', 'manual')),
  metadata_status TEXT NOT NULL CHECK (metadata_status IN ('pending', 'partial', 'complete', 'failed')),
  metadata_json TEXT,
  link_status TEXT NOT NULL DEFAULT 'active' CHECK (link_status IN ('active', 'login_required', 'deleted', 'unavailable')),
  last_link_verified_at TEXT,
  UNIQUE (platform, platform_post_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_platform_seen
  ON posts(platform, first_seen_at DESC);

CREATE TABLE IF NOT EXISTS capture_events (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE RESTRICT,
  raw_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  capture_channel TEXT NOT NULL CHECK (capture_channel IN ('bot', 'extension', 'api', 'manual')),
  source_lane TEXT NOT NULL CHECK (source_lane IN ('personalized', 'fixed_panel', 'broad', 'external')),
  selection_method TEXT NOT NULL CHECK (selection_method IN ('user_shared', 'auto_observed', 'official_feed', 'manual_research')),
  submitter_pseudonym TEXT,
  discovery_surface TEXT NOT NULL CHECK (discovery_surface IN ('fyp', 'search', 'profile', 'hashtag', 'chart', 'shared', 'other')),
  reason TEXT CHECK (reason IS NULL OR reason IN ('hook', 'format', 'audio', 'edit', 'topic', 'comments', 'other')),
  note TEXT,
  collector_context TEXT,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('saved', 'manual_review', 'metadata_failed')),
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_capture_events_post_time
  ON capture_events(post_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_capture_events_lane_time
  ON capture_events(source_lane, captured_at DESC);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  view_count INTEGER CHECK (view_count IS NULL OR view_count >= 0),
  like_count INTEGER CHECK (like_count IS NULL OR like_count >= 0),
  comment_count INTEGER CHECK (comment_count IS NULL OR comment_count >= 0),
  share_count INTEGER CHECK (share_count IS NULL OR share_count >= 0),
  save_count INTEGER CHECK (save_count IS NULL OR save_count >= 0),
  follower_count INTEGER CHECK (follower_count IS NULL OR follower_count >= 0),
  data_source TEXT NOT NULL CHECK (data_source IN ('official_api', 'visible', 'manual')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  score_eligible INTEGER NOT NULL DEFAULT 0 CHECK (score_eligible IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_post_time
  ON metric_snapshots(post_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS content_features (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  surface_features_json TEXT NOT NULL,
  format_features_json TEXT NOT NULL,
  desire_features_json TEXT NOT NULL,
  embedding_ref TEXT,
  classifier TEXT NOT NULL CHECK (classifier IN ('heuristic', 'jev', 'human')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL CHECK (layer IN ('surface', 'format', 'desire')),
  parent_cluster_id TEXT REFERENCES clusters(id),
  label TEXT NOT NULL,
  novelty_candidate INTEGER NOT NULL DEFAULT 0 CHECK (novelty_candidate IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cluster_members (
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  distance REAL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (cluster_id, post_id)
);

CREATE TABLE IF NOT EXISTS trend_score_snapshots (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  velocity_score REAL,
  surprise_score REAL,
  diffusion_score REAL,
  cross_lane_score REAL,
  cross_platform_score REAL,
  engagement_score REAL,
  freshness_score REAL,
  universal_score REAL,
  team_interest_score REAL,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE TABLE IF NOT EXISTS fit_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fit_scores (
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  fit_profile_id TEXT NOT NULL REFERENCES fit_profiles(id) ON DELETE CASCADE,
  reproducibility_score REAL,
  brand_fit_score REAL,
  audience_fit_score REAL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (cluster_id, fit_profile_id)
);

CREATE TABLE IF NOT EXISTS owned_outcomes (
  id TEXT PRIMARY KEY,
  cluster_id TEXT REFERENCES clusters(id),
  external_idempotency_key TEXT UNIQUE,
  post_url TEXT,
  outcome_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bias_audit_snapshots (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  user_submitted_share REAL NOT NULL,
  submitter_hhi REAL NOT NULL,
  independent_confirmation_ratio REAL NOT NULL,
  non_user_lane_count INTEGER NOT NULL,
  independent_creator_count INTEGER NOT NULL,
  bias_risk_score REAL NOT NULL,
  bias_label TEXT NOT NULL CHECK (bias_label IN ('low', 'medium', 'high')),
  score_cap REAL,
  explanation_json TEXT NOT NULL
);

