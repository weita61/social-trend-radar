# Bot / YouTube API setup

## Discord

1. Discord Developer Portalで`Social Trend Radar`アプリを作成する。
2. Botを追加し、Privileged Gateway Intentsの`Message Content Intent`だけを有効にする。
3. OAuth2 URL Generatorで`bot`を選び、`View Channels`と`Send Messages`だけを付与する。
4. Bot tokenをGit対象外の`.env`の`DISCORD_BOT_TOKEN`へ入れる。

BotはDMを無視し、チャンネル履歴を一括取得しない。新しく送信されたURL付きメッセージだけを処理する。

## Slack

1. Slack APIのCreate New Appで`From an app manifest`を選ぶ。
2. `config/slack-app-manifest.yml`を読み込ませ、対象workspaceへinstallする。
3. App-Level Tokenを`connections:write`スコープで作成する。
4. Bot User OAuth Tokenを`SLACK_BOT_TOKEN`、App-Level Tokenを`SLACK_APP_TOKEN`へ入れる。
5. 保存対象の公開または非公開チャンネルにBotを招待する。

DMとgroup DMは処理しない。参加済みチャンネルの新着メッセージだけを処理する。

## YouTube Data API

1. Google Cloudで専用projectを作成する。
2. YouTube Data API v3を有効にする。
3. API keyを作成し、API restrictionを`YouTube Data API v3`だけに限定する。
4. keyを`.env`の`YOUTUBE_API_KEY`へ入れる。

`videos.list`は1回1 unitとしてSQLiteに記録する。日次内部上限は初期値8,000 unitsで、超過前にリクエストを停止する。

