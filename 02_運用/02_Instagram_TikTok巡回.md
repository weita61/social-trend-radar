# Instagram / TikTok閲覧専用巡回

## 現在の状態

巡回エンジン、Playwright Core接続、公開URL抽出、表示指標の取得、Capture API保存、監査ログ、緊急停止を実装済み。既定値は`CRAWLER_ENABLED=false`であり、専用調査アカウントへ本人が手動ログインするまで外部巡回を開始しない。

## 安全境界

実装が持つブラウザ操作は次の6種類だけ。

- 指定URLへの移動
- 表示中リンクと文字列の読取り
- 縦スクロール
- 待機
- Capture APIへの保存
- 停止

クリック、文字入力、いいね、フォロー、コメント、投稿、リポスト、DM、購入、設定変更を行うメソッドは巡回インターフェースに存在しない。CAPTCHA、本人確認、ログイン画面、緊急停止ファイルを検知した場合は巡回だけを安全停止し、Capture APIとSlack Botは継続する。

保存するのは正規URL、観測時刻、画面に表示された件数、観測レーン、実行監査だけ。動画、HTML、スクリーンショット、DM、ログイン情報は保存しない。認証セッションはChromeの専用profileがローカルで管理し、アプリはCookieを読み出し・複製・DB保存しない。profileは`~/Library/Application Support/SocialTrendRadar/browser-profiles/`に置き、Git・iCloudバックアップ・D1の対象外とする。

## 初回ログイン

MacBook AirでSocial Trend Radarのソースディレクトリを開き、サービスを止めずに次を順番に実行する。

```bash
pnpm crawler:login instagram
pnpm crawler:login tiktok
```

各コマンドで専用Chrome profileが開く。本人が専用調査アカウントへ手動ログインし、ログイン完了後にターミナルで`Enter`を押す。日常利用アカウントのChrome profileは使わない。

## 初回有効化

ログイン後、Air側の`.env`へ以下を設定する。初回は負荷を抑える。

```dotenv
CRAWLER_ENABLED=true
CRAWLER_HEADLESS=false
CRAWLER_INTERVAL_MINUTES=60
CRAWLER_SCROLLS_PER_RUN=2
CRAWLER_WAIT_MS=5000
INSTAGRAM_CRAWL_URLS=https://www.instagram.com/reels/
TIKTOK_CRAWL_URLS=https://www.tiktok.com/foryou
```

その後、Air側で次を実行する。

```bash
pnpm check
pnpm service:install
pnpm service:status
pnpm service:verify-crawler
```

`service:install`は原子的リリース切替を行うため、現在のSlack収集データとSQLite正本を上書きしない。

### Instagramだけを最速実用設定で動かす場合

```dotenv
CRAWLER_ENABLED=true
CRAWLER_HEADLESS=true
CRAWLER_INTERVAL_MINUTES=1
CRAWLER_SCROLLS_PER_RUN=20
CRAWLER_WAIT_MS=1000
INSTAGRAM_CRAWL_URLS=https://www.instagram.com/reels/
TIKTOK_CRAWL_URLS=
```

巡回1回あたり20スクロール、巡回後の間隔1分、画面更新待ち1秒。これを現在のブラウザー実装で取得精度を落とさない最速実用設定とする。TikTokはURLを空にすることで対象を生成しない。ログイン切れ、本人確認、CAPTCHAを検知した場合は速度設定に関係なく自動停止する。

## 受け入れ確認

初回1時間以内に次を確認する。

- serviceが`running`
- APIとSlack Botが継続稼働
- `automation_runs`にInstagram / TikTokの実行が記録される
- `automation_audit_events.executed_write`の合計が常に0
- `capture_events.selection_method='auto_observed'`
- 動画URLが正規化・重複排除されている
- CAPTCHA、認証エラー、再起動ループがない

`pnpm service:verify-crawler`は最大45秒待機し、service、Capture API、Instagram最新巡回、自動収集数、TikTok巡回0件、実行書き込み0件を秘密値非表示で確認する。

表示値はサイトUI変更で取得できない場合がある。その場合もURLは保存し、表示値を捏造しない。

## 緊急停止

巡回だけを停止する場合は、Airで次の空ファイルを作る。

```bash
touch "$HOME/Library/Application Support/SocialTrendRadar/crawler.stop"
```

巡回は次の安全確認地点で停止し、Slack BotとCapture APIは継続する。再開は原因確認後に停止ファイルを削除し、serviceを再起動する。CAPTCHAや本人確認の回避処理は実装しない。

## 初期観測の扱い

- 対象地域・言語は暫定で`ja-JP`
- おすすめ面は`source_lane=broad`、`discovery_surface=fyp`
- 固定クリエイターは本人選定前なのでhardcodeしない
- 同じURLの再観測は投稿を重複生成せず、発見経路と表示値snapshotを追加
- 単一調査アカウントの出現回数だけで広域トレンドへ昇格させない
