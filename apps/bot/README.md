# Bot boundary

Discordを主入口、Slack Socket Modeを第2入口とするBot境界。チャンネルに送られたURLと任意メモだけをCapture APIへ送る。DM、履歴の一括取得、会話解析、ユーザーIDの生値保存は行わない。
