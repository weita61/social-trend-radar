# Gemini Spark開発引き継ぎ

**状態**: レビュー待ち  
**更新日**: 2026-10-10  
**用途**: Gemini CLI / Gemini Sparkから開発を再開する際の実行用引き継ぎ

## 1. 開始時に行うこと

1. `GEMINI.md`と、そこからimportされるルール・`STATUS.md`を読む。
2. `git status --short`で本人と他エージェントの変更を確認し、上書きしない。このリポジリは初回commit前で全体が未追跡の可能性がある。
3. `system_profiler SPHardwareDataType`で実行マシンを確認する。MacBook Air以外にlaunchd常駐サービスを導入しない。
4. `.env`の値を表示しない。必要な場合はキー名と設定有無だけを確認する。
5. 修正後は`pnpm check`、シェル変更時は`bash -n scripts/*.sh`を実行する。

Gemini CLIでは`/memory show`を使い、本ファイルと各ルールが読み込まれたことを確認できる。

## 2. 現在の稼働状態

- MacBook Airの`jp.watanabeeita.social-trend-radar` launchdサービスでCapture APIとSlack Botが稼働中。
- Slack `#ネタ蓄積`の実投稿保存とYouTube Data API接続は確認済み。
- Instagram専用調査アカウンの手動ログインは本人が完了済み。
- TikTokはログイン未確定のため保留。`TIKTOK_CRAWL_URLS=`とし、巡回対象を生成しない。
- Instagramは1分間隔、20スクロール、1秒待ちの最速実用設定。設定ファイルは変更済みだが、MacBook Airの常駐リリースへの反映と実サイトE2E確認は未完了。
- lint・型検査・unit test 27件は成功済み。
- 分析エンジンと分析結果を見るWebフロントは未実装。設計のみ完了している。

## 3. 直近で完了させる作業

MacBook Air上で、同期済みのソースディレクトリから次を実行する。

```bash
pnpm service:install
pnpm service:status
pnpm service:verify-crawler
```

`service:install`は原子的リリース切替と失敗時rollbackを行う。完了後、最低限次を確認する。

- Capture APIとSlack Botが引き続き稼働している。
- Crawlerプロセスが稼働し、Instagramのみが対象である。
- `automation_runs`にInstagram実行が追記される。
- `automation_audit_events.executed_write`の合計が0。
- `capture_events.selection_method='auto_observed'`が追記される。
- TikTok実行が0件。
- CAPTCHA、ログインリダイレクト、再起動ループがない。

## 4. その後の開発順

1. Instagram巡回の実稼働と監査を完了させる。
2. Phase 5のローカル分析を実装する。統計・重複排除・ローカルクラスタリングで候補を絞り、AI判定はその後に限定する。
3. SQLiteの実データを直接読むローカルRadar・Trend Detail・Coverage・Automation画面を実装する。
4. ローカル表示と証拠導線の受け入れ後に、D1同期・Cloudflare Worker・Vercel公開を行う。外部公開は本人承認後。
5. TikTok、Discord、Google Sheets / GAS連携は本人の再開指示があるまで保留する。

## 5. モデル選定

本人の指示により、開発難易度に応じてGeminiのモデルを選ぶ。

- アーキテクチャ、DB migration、セキュリティ、スコアリング、外部公開判定: 高推論モデル。
- 小規模な定型修正、文書、単純なテスト追加: 高速・低コストモデル。
- モデル変更で正しさや安全制約を弱めない。

## 6. 絶対に維持する制約

- Instagram / TikTok操作は移動、表示読取り、縦スクロール、待機、保存、停止だけ。
- like、follow、comment、投稿、repost、DM、購入、設定変更、CAPTCHA回避を実装しない。
- 動画本体、HTML、スクリーンショット、Cookie、token、DMを保存しない。
- 有料化、課金、公開デプロイ、外部サービスの追加は本人承認前に行わない。
- SQLiteとDuckDBはMacの正本。DB、秘密値、Chrome profileをGitへ入れない。
- 人が送ったBot投稿を、独立確認なしに広域トレンドの伝播数へ加算しない。
- 新規・大幅変更はレビュー待ちとし、本人確認前に次工程を確定扱いしない。

## 7. 参照順

1. `STATUS.md`
2. `02_運用/02_Instagram_TikTok巡回.md`
3. `01_設計/03_フロントエンド・同期仕様_v1.md`
4. `01_設計/06_Bot投稿バイアス監査・証拠リンク仕様_v1.md`
5. `01_設計/07_開発引き継ぎ・最終要件_v1.md`

