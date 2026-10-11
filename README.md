# Social Trend Radar

短尺動画のトレンドを、再生数ランキングではなく「複数クリエイターへの伝播」として検出する独立型リサーチツール。既存アプリへ統合せず、Web画面・Bot・収集・分析まで本プロジェクト内で完結させる。

Gemini CLI / Gemini Sparkで継続開発する場合は、プロジェクト直下から起動する。`GEMINI.md`がルールと現在地を自動読み込みする。実行用の引き継ぎは[Gemini Spark開発引き継ぎ](./02_運用/03_Gemini_Spark引き継ぎ.md)を参照。

## 基本原則

1. Personalized / Fixed Panel / Broad Discovery / External Baseline の4レーンから収集する。
2. モバイルはBot、PCはChrome拡張から1タップ保存する。
3. 投稿を表層記号・表現構造・根底欲求の3層でクラスタ化する。
4. 広域トレンドスコアと活用適合スコアを分離する。
5. 自社投稿の結果を活用適合スコアへ戻す。
6. サービス請求0円を維持し、無料枠超過時は有料移行せず停止する。

## 開発状態

Phase 0 / Phase 1のCapture BackboneとPhase 2のBot / YouTube connectorを実装済み。Node.js 22以上とpnpmを使う。SQLiteはMac側の正本で、DBファイル自体はGitで管理しない。

```bash
pnpm install
cp .env.example .env
pnpm migration
pnpm check
pnpm start
# 別プロセスで起動
pnpm bot
```

ローカルAPIの初期値は`http://127.0.0.1:8787`。

### MacBook Air常駐運用

MacBook Airへの初回導入とlaunchd常駐化は[MacBook Air環境構築・引き継ぎ](./02_運用/01_MacBookAir環境構築.md)を参照する。Air上のエージェントには「環境構築開始」と伝えれば、`CLAUDE.md`のトリガーに従って検査・構築・常駐起動まで進める。

```bash
pnpm setup:macbook-air
pnpm service:install
pnpm service:status
```

旧MacとAirでSlack Socket Mode Botを同時起動しない。

### Instagram / TikTok閲覧専用巡回

Phase 4の巡回基盤は実装済みだが、既定では無効。専用調査アカウントへの手動ログインと本人確認後に有効化する。クリックや入力を行わず、表示中の公開投稿URL・表示値だけを保存する。

- [Instagram / TikTok閲覧専用巡回手順](./02_運用/02_Instagram_TikTok巡回.md)
- 緊急停止、ログイン切れ、CAPTCHA時は巡回だけを停止し、Slack BotとCapture APIは継続する。

### Capture API

```bash
curl -X POST http://127.0.0.1:8787/api/captures \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "captureChannel": "manual",
    "sourceLane": "personalized",
    "discoverySurface": "shared",
    "note": "任意メモ"
  }'
```

- `POST /api/captures`: URL正規化、投稿重複排除、`capture_events`追記。
- `GET /api/posts/:id`: 投稿、収集経路、時系列指標、分類、クラスタを取得。
- 対応外の有効URLも失敗理由とともに手動確認待ちで保存する。
- ユーザー手入力指標は保存するが、`scoreEligible=false`として広域スコアから除外する。

### リポジトリ境界

- `src/`: Mac workerのCapture API、SQLite正本、共通ドメイン。
- `migrations/`: Mac正本のSQLite migration。
- `apps/worker-api/`: Cloudflare Worker / D1受信キュー境界。Phase 1ではローカル検証まで。
- `apps/web/`, `apps/bot/`, `apps/extension/`: 後続Phase用の境界のみ。
- `tests/`: URL正規化、重複排除、API、D1互換キューのunit test。

Phase 2の外部登録と最小権限は[Bot / YouTube API setup](./apps/bot/SETUP.md)を参照。Discord / SlackはユーザーIDの生値を保存せず、HMAC匿名IDだけをCapture APIへ送る。

## 設計

- [基本設計 v1](./01_設計/01_基本設計_v1.md)
- [承認済み構成図](../../outputs/2026/10/social-trend-radar-architecture.drawio)
- [完全無料構成・費用試算 v1](./01_設計/02_完全無料構成・費用試算_v1.md)
- [フロントエンド・同期仕様 v1](./01_設計/03_フロントエンド・同期仕様_v1.md)
- [スプレッドシート連携・公開仕様 v1](./01_設計/04_スプレッドシート連携・公開仕様_v1.md)
- [事務担当へのシート変更依頼文 v1](./01_設計/05_事務担当へのシート変更依頼文_v1.md)
- [Bot投稿バイアス監査・証拠リンク仕様 v1](./01_設計/06_Bot投稿バイアス監査・証拠リンク仕様_v1.md)
- [開発引き継ぎ・最終要件 v1](./01_設計/07_開発引き継ぎ・最終要件_v1.md)
- [完全無料構成図](../../outputs/2026/10/social-trend-radar-zero-cost.drawio)
- [操作できるダッシュボード試作](../../outputs/2026/10/social-trend-radar-dashboard-prototype.html)
