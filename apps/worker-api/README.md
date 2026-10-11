# Worker API boundary

Cloudflare Worker / D1側の境界。Phase 1では`migrations/0001_capture_queue.sql`と`src/index.ts`の受信キューを実装した。`POST /api/captures`は`Idempotency-Key`を必須とし、Mac停止中もpayloadをpendingで保持できる。外部デプロイとD1作成は行わない。
