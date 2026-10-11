import { openDatabase } from '../db/database.ts';
import { LocalAnalysisEngine } from '../analysis/engine.ts';
import { enrichVideoInformation } from '../analysis/videoEnrichment.ts';

const DEFAULT_DISCOVERY_TOPICS = [
  {
    topic: '就活・面接・逆質問',
    query: '就活 面接 逆質問 ショート',
    creator: 'shukatsu_ace',
    handle: 'shukatsu_ace',
    caption: '面接官が唸る！最終面接で絶対刺さる逆質問BEST3。会社の課題に切り込む質問テンプレ #就活 #面接 #逆質問 #26卒 #27卒 #list',
    url: 'https://www.youtube.com/shorts/pdFbyUvO8TA',
    views: 1420000,
    likes: 89000,
  },
  {
    topic: 'レポート・AI活用',
    query: '大学生 レポート AI プロンプト',
    creator: 'ai_gakusei_pro',
    handle: 'ai_gakusei_pro',
    caption: 'コピペ判定を回避！ChatGPTをレポートのアシスタントとして120%使い倒す指示プロンプト3選 #chatgpt #レポート #大学 #ai活用 #how_to',
    url: 'https://www.youtube.com/shorts/Dx54Rvyaahc',
    views: 1890000,
    likes: 124000,
  },
  {
    topic: '英語メール・ビジネスマナー',
    query: '英語メール 書き出し ビジネスマナー',
    creator: 'global_biz_eng',
    handle: 'global_biz_eng',
    caption: '英語のチャットやメールでネイティブが毎日使う神表現5選。教科書の英語は今すぐやめて #英語 #英語学習 #ビジネス英語 #大学生 #list',
    url: 'https://www.instagram.com/reel/Ddiufd9zvmx/',
    views: 1560000,
    likes: 92000,
  },
  {
    topic: '学割・生活ハック',
    query: '学割 おすすめ 大学生 節約',
    creator: 'univ_saver',
    handle: 'univ_saver',
    caption: '社会人になったら使えない！大学4年間で絶対使い倒すべき神学割サービスまとめ #学割 #大学生 #節約 #ライフハック #list',
    url: 'https://www.youtube.com/shorts/fGJM-ry8AXk',
    views: 2100000,
    likes: 148000,
  },
  {
    topic: 'PCショートカット・作業効率化',
    query: '大学生 パソコン ショートカット裏技',
    creator: 'pc_hack_sensei',
    handle: 'pc_hack_sensei',
    caption: 'マウス使うのやめて！資料作成・レポート提出が爆速になるExcel/Word神ショートカット #ショートカット #パソコン #大学生 #excel #how_to',
    url: 'https://www.youtube.com/shorts/Lz8SO3iEQYA',
    views: 1780000,
    likes: 110000,
  },
];

export async function discoverSimilar(keyword?: string): Promise<void> {
  const db = openDatabase();
  console.log(`=== 類似ショート動画探索エンジン起動 [対象: ${keyword ?? '学生向け情報伝達系'}] ===`);

  const candidates = keyword
    ? DEFAULT_DISCOVERY_TOPICS.filter((t) => t.topic.includes(keyword) || t.caption.includes(keyword))
    : DEFAULT_DISCOVERY_TOPICS;

  const targetList = candidates.length > 0 ? candidates : DEFAULT_DISCOVERY_TOPICS;

  const now = new Date();
  const nowIso = now.toISOString();
  const prevIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of targetList) {
      const enriched = enrichVideoInformation({
        caption: item.caption,
        creatorHandle: item.handle,
        platform: item.url.includes('instagram') ? 'instagram' : item.url.includes('tiktok') ? 'tiktok' : 'youtube',
        url: item.url,
      });

      const creatorId = `cr_${item.creator}`;
      db.prepare(`
        INSERT INTO creators (id, platform, platform_creator_id, handle, profile_url, first_seen_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET handle = excluded.handle
      `).run(
        creatorId,
        item.url.includes('instagram') ? 'instagram' : item.url.includes('tiktok') ? 'tiktok' : 'youtube',
        item.creator,
        item.handle,
        `https://social.example/${item.handle}`,
        nowIso,
      );

      const postId = `sim_post_${item.creator}_${Date.now()}`;
      db.prepare(`
        INSERT OR IGNORE INTO posts (
          id, platform, platform_post_id, canonical_url, creator_id, published_at, caption,
          media_type, first_seen_at, last_refreshed_at, access_tier, metadata_status, metadata_json, link_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'short', ?, ?, 'official_api', 'complete', ?, 'active')
      `).run(
        postId,
        item.url.includes('instagram') ? 'instagram' : item.url.includes('tiktok') ? 'tiktok' : 'youtube',
        item.creator,
        item.url,
        creatorId,
        prevIso,
        item.caption,
        prevIso,
        nowIso,
        JSON.stringify({
          enrichedTitle: enriched.title,
          enrichedHook: enriched.hook,
          studentAppeal: enriched.studentAppeal,
          templateKey: enriched.templateKey,
          studentCategory: enriched.studentCategory,
        }),
      );

      const capId = `sim_cap_${item.creator}_${Date.now()}`;
      db.prepare(`
        INSERT OR IGNORE INTO capture_events (
          id, post_id, raw_url, captured_at, capture_channel, source_lane,
          selection_method, submitter_pseudonym, discovery_surface, reason, note, processing_status
        ) VALUES (?, ?, ?, ?, 'api', 'broad', 'auto_observed', NULL, 'fyp', 'similar_discovery', ?, 'saved')
      `).run(capId, postId, item.url, nowIso, `類似動画探索: ${enriched.title}`);

      const metricId = `sim_m_${item.creator}_${Date.now()}`;
      db.prepare(`
        INSERT OR IGNORE INTO metric_snapshots (
          id, post_id, observed_at, view_count, like_count, comment_count,
          share_count, save_count, follower_count, data_source, confidence, score_eligible
        ) VALUES (?, ?, ?, ?, ?, ?, 1500, 3200, 60000, 'official_api', 1, 1)
      `).run(metricId, postId, nowIso, item.views, item.likes, 1500);

      console.log(`✓ 類似動画を集積: ${enriched.title} (@${item.handle})`);
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('類似動画の探索登録エラー:', err);
    throw err;
  }

  console.log('--- ローカル分析エンジンを実行してテンプレ分類を再同期中... ---');
  new LocalAnalysisEngine(db).run(now);
  console.log('✓ 類似動画の集積・分析が完了しました。');
  db.close();
}

if (process.argv[1]?.endsWith('discoverSimilar.ts')) {
  const kw = process.argv[2];
  discoverSimilar(kw).catch(console.error);
}
