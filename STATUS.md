# STATUS — Social Trend Radar

**最終更新**: 2026-10-12 / by Gemini Spark

## 状態

- フェーズ: Phase 0・1・2・4完了／Phase 5分析エンジン実装・実DB検証完了／Radar・Trend Detail・Coverage・Automationローカル閲覧UI実装完了／Vercelデプロイ設定作成済み／リモートpush完了（origin/main）／MacBook Air常駐サービス反映待ち
- 承認状態: 基本構成図・統合最終要件・Phase 0・1は本人承認済み／外部API登録も本人許可済み
- 実装: Capture Backbone、Discord Bot、Slack Socket Mode、YouTube Data API、Instagram・TikTok閲覧専用巡回エンジン、許可操作監査、緊急停止、送信者HMAC匿名化、ローカル3層分析エンジン、Bias Audit、ローカルWebコンソール（Radar / Trend Detail / Coverage / Automation）を実装済み
- 外部API: Slackアプリ登録・`#ネタ蓄積`実投稿保存まで確認済み、Google Cloudプロジェクト作成・YouTube Data API v3有効化・制限付きキー接続済み、Discordは後回し／デプロイは未実施
- 稼働状態: 旧MacBook ProのCapture APIとSlack Botは停止済み。MacBook Airのlaunchdサービス`jp.watanabeeita.social-trend-radar`でCapture APIとSlack Botが稼働中（新リリースの反映待ち）

## 確定したこと

- 収集時の広域性と出力時の活用適合性を分離する。
- 観測レーンは Personalized / Fixed Panel / Broad Discovery / External Baseline の4系統。
- モバイルはBot、PCはChrome拡張を収集入口にする。
- 表層記号・表現構造・根底欲求の3層で分析する。
- 広域トレンドスコアと活用適合スコアを別々に算出する。
- 外部動画本体は保存しない。
- 既存アプリへ統合せず、独立ツールとして完結させる。
- サービス請求0円を維持し、無料枠超過時は課金せず停止する。
- Botの主入口はDiscord、Slackは社内第2入口とする。
- 自宅MacをBot・収集・ローカル分析ワーカーとして使う。
- Instagram / TikTok自動巡回を許可する。閲覧・スクロール・表示情報記録に限定し、反応・投稿・リポスト等は行わない。
- Mac上のSQLite / DuckDBをデータ正本、Cloudflare D1をリアルタイム閲覧用のread modelとする。Gitはコード・スキーマ・マイグレーション専用。
- 既存の制作管理スプレッドシートは制作オペレーションの正本として残し、GASでTrend Radarと連携する。CSVは障害時・持ち出し用。
- 管理画面はGit連携でVercelへ静的デプロイし、APIはCloudflare Workerへrewriteする。Vercel Hobbyは非商用期間に限定する。
- Bot・拡張から人が選んで送った投稿は「チーム内候補」とし、自動巡回・公式ソースで独立確認できるまで広域トレンドの伝播数へ加算しない。
- 市場の広がりを示す広域スコアと、チーム内の関心を示す`team_interest_score`を分離する。
- 各トレンド群に最初期・最速上昇・媒体横断・反例の具体動画リンクを置き、正規URLから元投稿を開けるようにする。

## 判断待ち

- 最初の観測対象地域・言語
- 最初の固定クリエイターパネル
- 開発完了後、説明用スライドを作るかの最終確認
- 開発完了後、初回チュートリアルを導入するかの最終確認

## 次アクション

1. MacBook Air側で新リリース（Phase 5分析エンジン・新マイグレーション・ローカルWeb）を常駐サービスへ反映（`pnpm migration && pnpm analyze && pnpm service:install`）
2. VercelのデプロイURL・本番反映確認（GitHub連携による自動デプロイ確認）
3. TikTokはログイン状態が確定するまで巡回対象外を維持
4. 固定クリエイターパネルを本人が選定後、Fixed Panel巡回を追加
5. Discord設定は本人の希望どおり後回し

## 作業ログ

- 2026-10-12: Vercelがsrc/server.tsをルート関数として誤検出し全トラフィックを奪っていた問題を根本解消。src/server.tsをsrc/localServer.tsへ完全リネーム・移動し、package.jsonのdev/startスクリプトを更新。コミット（c6c63cb）してリモートへpush完了。これによりVercelはpublic/の静的ファイルを直接CDN配信する。
- 2026-10-12: 本番Vercelで発生した500 FUNCTION_INVOCATION_FAILEDを解消。原因は(1) .gitignoreのdata/記述によりsrc/data/seedSnapshot.jsonがGit除外されていたこと、(2) buildスクリプト不在によりsrc/server.tsが誤ってルート関数扱いされていたこと、(3) api/index.tsでGETリクエスト時のストリーム消費起因。public/への静的アセット配置、seedSnapshot.tsのTSバンドル化、toRequestの安全なURL/Method判定を実装しコミット（6a9ff86）してpush完了。
- 2026-10-11: Vercelビルド時のTypeScript型検査エラー（exactOptionalPropertyTypesおよびnoUncheckedIndexedAccess制約）を解消。readRepository.ts、videoEnrichment.ts、handler.tsの型定義・プロパティ参照を修正し、コミット（d41aaf5）してリモートへpush完了。テスト36件合格。
- 2026-10-11: 本人承認に基づきGit pushを実行。リモート（`origin/main` / `git@github.com:weita61/social-trend-radar.git`）へのSSH経由pushを確認（コミット `c1990c6` にて最新状態であることを確認）。
- 2026-10-10: Gemini Sparkによりローカル閲覧UI（Radar / Trend Detail / Coverage / Automation）および実データRead Model API（`/api/overview`, `/api/coverage`, `/api/automation`）を実装。プロトタイプに基づくEditorial Intelligence Console（新聞紙面調の白黒・洗練デザイン、3層分析、Bias Audit、具体証拠動画リンク、4レーン比率、書き込み操作0件監査）を構築し、静的配信とVercel用設定（`vercel.json`）を配備。全35件のユニットテストが通過。
- 2026-10-10: Phase 5のローカル分析エンジン（3層特徴抽出、クラスタリング、Bias Audit、通常値比MADロバスト上振れ、スコアリング）を実データ（`./data/social-trend-radar.sqlite`）に対して実行・検証。`0004_local_analysis.sql`の適用およびバックアップ（`social-trend-radar-20261010-171254.sqlite`）を完了。
- 2026-10-10: 本人がAirの`service:verify-crawler`受け入れ結果を確認。Instagram自動巡回、Capture API、自動保存、TikTok巡回0件、実行書き込み0件を稼働確定とし、Phase 4のInstagram閲覧専用巡回を完了扱いにした。TikTokは引き続き保留。次工程はPhase 5ローカル分析と閲覧フロント。
- 2026-10-10: Airの初回`service:verify-crawler`がCapture API応答なしと誤判定。原因はAPIで未定義の`/`が正常に404を返す一方、検証スクリプトが`curl --fail`でそれを障害扱いしていたこと。検証と常駐起動のヘルスチェックを`GET /health`のHTTP 200判定へ統一し、APIヘルステストを追加。同時にAirログ上でInstagram巡回が2回成功し、各`observed=42 saved=2`、2回目は`duplicates=1`であることを確認。
- 2026-10-10: MacBook AirでInstagram巡回を含む新リリース`20261010-165245-4090`を原子的にステージング・切替。launchd bootstrapは切替直後にI/O errorが5回出たが、既存の自動再試行で6回目に成功。`jp.watanabeeita.social-trend-radar`は`state = running`、PID 4209、最終終了履歴なしを本人のAir出力で確認。実収集と監査DBの受け入れは未確定。秘密値を出さずにservice、API、Instagram巡回、TikTok 0件、書き込み0件を確認する`pnpm service:verify-crawler`を追加。
- 2026-10-10: Gemini CLI / Gemini Sparkで以降の開発を継続できるよう、公式の階層context形式に合わせた`GEMINI.md`を追加。共通・個人開発・プロジェクトルール、`STATUS.md`、Gemini専用引き継ぎを自動importする。`.geminiignore`で秘密値、DB、backup、Chrome profile、依存物を探索対象から除外。引き継ぎにAir反映待ちの直近作業、分析→ローカルフロント→同期・公開の実装順、モデル選定、絶対制約を記録。
- 2026-10-10: 本人がInstagram専用調査アカウントの手動ログイン完了を報告。TikTokはログイン未確定のため保留し、対象URLを空にして巡回対象から除外。Instagramは本人指示により、1分間隔・20スクロール・各画面1秒待ちの最速実用設定とし、Airの常駐リリース反映待ち。
- 2026-10-10: MacBook Airで依存復元、migration、lint、型検査、unit test 26件の成功を確認。Instagram手動ログインCLIも起動した。案内どおり`Ctrl-C`で終了するとpnpmが終了コード130を失敗表示するため、ログイン完了後は`Enter`でセッションを保存し正常終了する方式へ修正。AirでのInstagram・TikTokセッション確定は待ち。
- 2026-10-10: MacBook Airで`crawler:login`実行時、同期外の依存配置に`playwright-core`が未反映で`ERR_MODULE_NOT_FOUND`となる事象を確認。構築スクリプトを修正し、外部`node_modules`の実体が消えた場合の再作成と、明示した配置先へのlockfile固定復元を行うようにした。Airでの再実行は待ち。
- 2026-10-10: Phase 4のInstagram / TikTok閲覧専用巡回基盤を実装。Playwright Core + Air上のChrome専用profileを使い、移動・表示読取り・縦スクロール・待機・保存・停止だけを許可。クリック・入力・反応・投稿系APIを巡回インターフェースから排除した。CAPTCHA、ログイン切れ、緊急停止時は巡回だけを安全停止し、Slack/APIを継続する。公開URL抽出、表示件数の`K/M/B/万/億`変換、正規化、run/audit記録、実行書込み0件DB制約、既定無効を追加。lint・型検査・unit test 26件が成功。実アカウントログインとAirへの有効化は未実施。
- 2026-10-09: MacBook Air実機（M1）で環境構築を完了。Node.js v22.22.2、Corepack/pnpm 11.8.0、SQLite、curl、`.env`必須4キーとGit除外を確認し、lockfile固定依存導入、migration、lint、型検査、unit test 18件をすべて通過。旧Mac停止記録を確認後、launchdサービス`jp.watanabeeita.social-trend-radar`を導入した。初回はmacOSのDesktop保護で再起動ループになったため、常駐用コードとSQLite正本を`~/Library/Application Support/SocialTrendRadar/`へ置く方式へ修正。修正後はservice `running`、Capture API listen、Slack Bot接続、ローカルHTTP応答を確認し、認証エラー・port競合なし。修正前ログは`~/Library/Logs/SocialTrendRadar/*.pre-runtime-fix-20261009.log`へ保存。
- 2026-10-09: MacBook Air側で最初の「環境構築開始」が活動ルートからタスクOSへ誤ルーティングされ、タスクOSのローカル構築のみ完了。Social Trend Radarは未構築のため、活動ルートの`CLAUDE.md`へ対象固定ルールを追加。Google OAuth・Google Tasks同期・Vercel公開は不要。
- 2026-10-09: Air移行時のSQLite正本分裂を防ぐため、旧MacBook ProのCapture APIとSlack Botを正常停止。MacBook Air側の常駐起動準備が整うまでSlack自動収集は一時停止。
- 2026-10-09: Slack `#ネタ蓄積`への公開Shorts実投稿をE2E確認。正規URL、Bot経由イベント、送信者64文字HMAC匿名IDをSQLiteへ保存し、YouTube Data API使用量が1 unit増加（当日累計2 units）したことを確認。
- 2026-10-09: MacBook Air移行用に秘密値非表示の事前検査、lockfile固定依存導入、migration・全検査、API + Slack Bot一括起動、launchd常駐管理スクリプトと一言トリガーの引き継ぎを追加。Air実機への導入・常駐起動は未実施。
- 2026-10-09: Slackアプリ`Social Trend Radar`（App ID `A0C7UDBQH9B`）を`58th マーケユニット(SNSチーム)`へ登録・インストール。`channels:history`、`groups:history`、`chat:write`、Socket Mode用`connections:write`に限定し、ローカルBotの接続成功を確認。`#インスタ運用`へのアプリ追加と実投稿試験は本人確認待ち。
- 2026-10-09: Google Cloudプロジェクト`Social Trend Radar`（Project ID `social-trend-radar-511107`）を作成。YouTube Data API v3だけに制限したAPIキーをGit除外の`.env`へ保存。無料トライアル・課金は開始せず、公開Shorts 1件で公式メタデータ取得とクォータ1 unit記録を確認。
- 2026-10-09: 起動スクリプトへ`.env`自動読込を追加し、`SUBMITTER_HASH_SECRET`をSlack tokenとは別の64文字ランダム値へ修正。`pnpm check`はlint・型検査・unit test 18件すべて成功。
- 2026-10-09: Google CloudのCodex内ブラウザではプロジェクト一覧とAPI画面が読み込みエラーになったため、ログイン済みChromeへ切り替えて完了。YouTube実接続試験では列挙値を3回修正してから成功。DiscordはCodex内ブラウザとChromeの双方で未ログインのため登録未完了。
- 2026-10-09: 本人がPhase 0・1を承認。Phase 2着手とDiscord / Slack / YouTubeの外部API登録を許可。
- 2026-10-09: Phase 2のローカル実装を完了。DiscordとSlackの新着チャンネルメッセージ収集、DM除外、HMAC匿名化、YouTube `videos.list`、日次8,000 units停止、connector audit logを追加。ESLint・型検査・unit test 18件が成功。外部登録は各3サービスのログイン待ち。
- 2026-10-09: Phase 0を実装。TypeScript + pnpm、ESLint、strict type check、Git初期化、秘密情報・DB除外、Mac worker / Worker API / Web / Bot / extensionの境界を作成。
- 2026-10-09: Phase 1を実装。SQLite schema/migration、YouTube / Instagram / TikTokのURL媒体判定・正規化・重複排除、`POST /api/captures`、`GET /api/posts/:id`、`capture_events`、D1互換受信キューを追加。
- 2026-10-09: `pnpm check`でESLint、strict type check、unit test 11件を完走。ローカルHTTPのPOST→GETも検証。Node.js 22標準SQLiteがExperimental扱いであることと、TikTok短縮URLは外部リダイレクト解決を行わず手動確認待ちにすることを確認。
- 2026-10-09: 構成図を本人承認。DB・Bot・Chrome拡張の基本仕様を `01_設計/01_基本設計_v1.md` に作成。
- 2026-10-09: 完全無料・独立ツール・自宅Mac常駐を前提に再設計。Bot比較、全ツール費用、Jev試算、自動操作の採用境界を `01_設計/02_完全無料構成・費用試算_v1.md` に作成。
- 2026-10-09: Instagram / TikTokの閲覧専用自動巡回を本人許可。Mac正本 + D1 read model、リアルタイム同期、フロントエンド仕様を `01_設計/03_フロントエンド・同期仕様_v1.md` に作成。
- 2026-10-09: 既存のリール制作管理シートを編集せず参照調査。CSVではなくGAS、`Radar取込`バッファ、成果逆連携、Git→Vercel公開を `01_設計/04_スプレッドシート連携・公開仕様_v1.md` に設計。
- 2026-10-09: Bot投稿を市場証拠から一旦分離するBias Auditと、各トレンドから具体動画へ辿る証拠リンク仕様を `01_設計/06_Bot投稿バイアス監査・証拠リンク仕様_v1.md` に追加。基本設計・画面仕様も更新。
- 2026-10-09: 全設計を最終監査し、Vercel / Cloudflare Pagesと自動調査レーンの表記揺れを解消。別エージェント向けの実装順・受け入れ条件・禁止事項を `01_設計/07_開発引き継ぎ・最終要件_v1.md` に統合。開発後の説明スライドとチュートリアル判断をタスクOSへ追加。
