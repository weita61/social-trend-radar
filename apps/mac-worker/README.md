# Mac worker boundary

SQLite正本、Capture API、後続の収集・分析ジョブを担う境界。Phase 1の実装はルートの`src/`に置き、`migrations/`のSQLite migrationを適用する。Macへの外部直接接続は作らない。

