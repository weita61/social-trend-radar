# MacBook Air環境構築・引き継ぎ

## 目的

MacBook AirをSocial Trend Radarのローカル正本・Slack収集常駐機にする。本人がAir上のエージェントへ「環境構築開始」と伝えれば、この文書を起点に実行できる状態を正典とする。

このトリガーは`00_秘書室/03_タスクOS`の環境構築を意味しない。作業ディレクトリは必ず`個人開発/12_social-trend-radar`とする。

## 実行範囲

- Node.js 22.13.0以上、pnpm 11系、SQLite、curlの確認
- `.env`の存在・Git除外・必須キーの形式確認（値は出力しない）
- lockfile固定の依存導入、SQLite migration、lint、型検査、unit test
- Capture APIとSlack Socket Mode Botのlaunchd常駐化
- サービス状態とログの検証

ソースはiCloud同期対象の`Desktop/活動`に置くが、launchdはmacOSのプライバシー保護によりDesktop配下を直接読めない。そのため`service:install`時に常駐用コピーを`~/Library/Application Support/SocialTrendRadar/app/`へ配置し、SQLite正本は同階層の`data/social-trend-radar.sqlite`へ置く。plistへ秘密値は入れず、常駐用コピーの`.env`だけから読む。

Discord登録、クラウドデプロイ、有料サービス、トークン再発行は対象外。

## Air側エージェントの実行手順

1. このファイルとプロジェクト直下の`CLAUDE.md`、`STATUS.md`を読む。
2. `system_profiler SPHardwareDataType`で実機がMacBook Airであることを確認する。
3. プロジェクト直下へ移動する。パスを決め打ちせず、この文書のあるディレクトリから解決する。
4. `node --version`と`pnpm --version`を確認する。
   - Node.jsがない、または22.13.0未満: HomebrewがあればNode.js 22系を導入する。
   - pnpmがない: Corepackでpnpm 11.8.0を有効化する。npmでプロジェクト依存を入れない。
5. `bash scripts/bootstrap-macbook-air.sh`を実行する。
6. 下の「切替条件」を確認する。
7. `bash scripts/macbook-air-service.sh install`を実行する。常駐用コードと初回DBは`~/Library/Application Support/SocialTrendRadar/`へ配置される。
8. 5秒以上待ってから`bash scripts/macbook-air-service.sh status`を実行する。
9. `~/Library/Logs/SocialTrendRadar/service.out.log`と`service.err.log`の直近だけを確認する。秘密値を表示しない。
10. `STATUS.md`へ実行日時・端末・テスト結果・service状態を追記し、本人へ報告する。

## 切替条件

同じSlack App-Level Tokenを使うBotを旧MacとAirで同時稼働させると、Socket Modeイベントがどちらか一方へ配分され、SQLite正本が分裂する。Airでserviceを起動する前に、旧Mac側のCapture APIとBotが停止済みであることを`STATUS.md`の最新作業ログで確認する。記録がない、または再起動された可能性がある場合だけ本人へ確認する。

旧Mac側を止めたことが確認できない場合は、`bootstrap-macbook-air.sh`まで実行してよいが、`macbook-air-service.sh install`は実行しない。

## 受け入れ条件

- `bootstrap-macbook-air.sh`が最後まで成功する。
- `pnpm check`でlint・型検査・全unit testが成功する。
- `launchctl print gui/$(id -u)/jp.watanabeeita.social-trend-radar`が成功する。
- serviceログにCapture APIのlisten開始とSlack Boltの起動が出る。
- serviceエラーログに再起動ループ、認証エラー、port競合がない。
- Slack送信者の生ID、Bot token、App token、YouTube API keyをログ・報告・Gitへ出していない。

## 運用コマンド

```bash
pnpm service:status
pnpm service:validate
pnpm service:restart
pnpm service:stop
pnpm service:start
```

ログは`~/Library/Logs/SocialTrendRadar/`、launchd定義は`~/Library/LaunchAgents/jp.watanabeeita.social-trend-radar.plist`に置く。秘密情報は同期済みの`.env`だけから読み、plistへは埋め込まない。

ソースや依存関係を更新した場合は、プロジェクト側で`pnpm check`を通した後に`pnpm service:install`を再実行し、常駐用コピーを同期してから`pnpm service:status`と直近ログを確認する。

## 障害時

- `.env`がない: 自動生成せず同期を確認する。
- 必須キーがない: キー名だけを報告し、値をチャットへ貼らない。
- port 8787が使用中: 既存プロセスを特定し、Social Trend Radarの二重起動であると確認できるまでkillしない。
- Slack認証エラー: serviceを停止し、既存トークンを再発行せず本人へ報告する。
- YouTube日次上限: 課金せず、既定どおり取得を停止する。
