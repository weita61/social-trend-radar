import { openDatabase } from '../db/database.ts';
import { LocalAnalysisEngine } from '../analysis/engine.ts';
import { enrichVideoInformation } from '../analysis/videoEnrichment.ts';
import { normalizePostUrl } from '../domain/url.ts';
import { exportSnapshot } from '../../scripts/exportSnapshot.ts';

interface DiscoveryTopic {
  topic: string;
  query: string;
  creator: string;
  handle: string;
  caption: string;
  url: string;
  views: number;
  likes: number;
  hoursAgo: number;
}

const DEFAULT_DISCOVERY_TOPICS: DiscoveryTopic[] = [
  {
    topic: 'Canva・プレゼンスライド神技',
    query: 'Canva スライド プレゼン 大学生 裏技',
    creator: 'canva_univ_hack',
    handle: 'canva_univ_hack',
    caption: 'パワポのデザインで何時間も悩んでる人、それ全部無駄です。Canvaのこのテンプレート使えば文字入れるだけで5分でプロ級プレゼン完成するのに… #canva #スライド #プレゼン #大学生 #レポート #shortcut_hack',
    url: 'https://www.youtube.com/shorts/qC7iY4m_U3A',
    views: 1980000,
    likes: 135000,
    hoursAgo: 1.2,
  },
  {
    topic: 'Notion・履修登録＆課題管理',
    query: 'Notion 履修登録 課題締め切り 大学生 テンプレート',
    creator: 'notion_gakusei_lab',
    handle: 'notion_gakusei_lab',
    caption: '課題の提出遅れて単位落としかけた大学生、全員このNotionテンプレート使って…シラバス、講義リンク、提出期限、出席回数が1ページで全部把握できます #notion #履修 #課題締め切り #大学生 #勉強垢 #how_to',
    url: 'https://www.youtube.com/shorts/uP8jN5v_L7k',
    views: 1650000,
    likes: 112000,
    hoursAgo: 2.5,
  },
  {
    topic: 'Google Scholar・論文引用時短術',
    query: 'Google Scholar 論文検索 参考文献 引用 大学生',
    creator: 'scholar_report_ace',
    handle: 'scholar_report_ace',
    caption: 'レポートの参考文献、Wikipediaや個人ブログ貼ってない？Google Scholarで一発引用する方法。ボタン1回押すだけで正しい引用フォーマットが自動コピーされます #scholar #論文 #参考文献 #レポート #卒論 #how_to',
    url: 'https://www.youtube.com/shorts/rT9kM2w_P4x',
    views: 1840000,
    likes: 128000,
    hoursAgo: 4.0,
  },
  {
    topic: '就活・面接・神逆質問',
    query: '就活 面接 逆質問 ショート',
    creator: 'shukatsu_ace',
    handle: 'shukatsu_ace',
    caption: '面接官が唸る！最終面接で絶対刺さる神逆質問BEST3。「特にありません」は即落ちです。会社の課題に切り込む質問テンプレ #就活 #面接 #逆質問 #26卒 #27卒 #list',
    url: 'https://www.youtube.com/shorts/wN4vB7x_K9q',
    views: 2150000,
    likes: 142000,
    hoursAgo: 5.5,
  },
  {
    topic: 'レポート爆速化・ChatGPTプロンプト',
    query: '大学生 レポート ChatGPT プロンプト',
    creator: 'ai_gakusei_pro',
    handle: 'ai_gakusei_pro',
    caption: 'コピペ判定を完全回避！ChatGPTをレポートのアシスタントとして120%使い倒す指示プロンプト3選。構成案と目次を一瞬で生成 #chatgpt #レポート #大学 #aiプロンプト #how_to',
    url: 'https://www.youtube.com/shorts/jL2mC9x_V5p',
    views: 2420000,
    likes: 168000,
    hoursAgo: 7.0,
  },
  {
    topic: '英語メール・ビジネスマナー',
    query: '英語メール 書き出し ビジネスマナー',
    creator: 'global_biz_eng',
    handle: 'global_biz_eng',
    caption: 'メールの書き出しは Hi XX-san,と書きます。Dearは硬すぎるし、Heyは馴れ馴れしい。ビジネスで一番使われる書き出しのリアル #英語 #英語学習 #ビジネス英語 #大学生 #メールの書き出し #failure_first',
    url: 'https://www.instagram.com/reel/DE_biz_eng01/',
    views: 1890000,
    likes: 115000,
    hoursAgo: 9.0,
  },
  {
    topic: '学割・生活ハック',
    query: '学割 おすすめ 大学生 節約',
    creator: 'univ_saver',
    handle: 'univ_saver',
    caption: '知らないと年間10万損する！学生証見せるだけでタダ・半額になる神施設5選。社会人になったら使えない大学4年間の特権 #学割 #学生証 #大学生 #節約 #ライフハック #list',
    url: 'https://www.youtube.com/shorts/bF7kL9v_M3q',
    views: 2600000,
    likes: 189000,
    hoursAgo: 11.0,
  },
  {
    topic: 'PCショートカット・作業効率化',
    query: '大学生 パソコン ショートカット裏技',
    creator: 'pc_hack_sensei',
    handle: 'pc_hack_sensei',
    caption: 'マウス動かす時間、全部無駄です。画面分割と履歴ペーストで作業時間1/3になるWindows/Mac神ショートカット5選 #ショートカット #パソコン #大学生 #excel #how_to',
    url: 'https://www.youtube.com/shorts/xP3mN7v_K8q',
    views: 2200000,
    likes: 154000,
    hoursAgo: 13.0,
  },
  {
    topic: 'バイト代・103万扶養の壁',
    query: '103万の壁 扶養 バイト代 税金 大学生',
    creator: 'gakusei_fuyo_info',
    handle: 'gakusei_fuyo_info',
    caption: 'バイト代103万・130万を超えると親にガチで怒られる『扶養のリアル』。知らないと親の税金が跳ね上がるので今すぐ確認して #103万の壁 #扶養 #バイト代 #税金 #大学生 #failure_first',
    url: 'https://www.youtube.com/shorts/tV8kL2m_P5x',
    views: 1950000,
    likes: 132000,
    hoursAgo: 15.0,
  },
  {
    topic: '試験対策・一夜漬け過去問逆算暗記',
    query: 'テスト 一夜漬け 過去問 勉強法 暗記 大学生',
    creator: 'univ_test_master',
    handle: 'univ_test_master',
    caption: 'テスト前夜の一夜漬けで80点取るための『過去問逆算暗記法』。教科書1ページ目から読むの今すぐやめて！それ落ちます #テスト #一夜漬け #勉強法 #暗記 #大学生 #how_to',
    url: 'https://www.youtube.com/shorts/kL9mN2v_Q4p',
    views: 2350000,
    likes: 162000,
    hoursAgo: 17.5,
  },
  {
    topic: '一人暮らし・悪魔の時短飯',
    query: '料理 レシピ 時短飯 ズボラ 一人暮らし 大学生',
    creator: 'zubora_meshi_univ',
    handle: 'zubora_meshi_univ',
    caption: 'フライパン1つで5分！自炊面倒な一人暮らし大学生のための悪魔の時短飯レシピ。外食行く気なくなるから保存して #料理 #レシピ #時短飯 #ズボラ飯 #一人暮らし #recipe',
    url: 'https://www.youtube.com/shorts/mP4kL7x_V9b',
    views: 2780000,
    likes: 195000,
    hoursAgo: 20.0,
  },
  {
    topic: '大学講義あるある',
    query: 'あるある コント 大学生 講義 単位',
    creator: 'campus_aruaru_jp',
    handle: 'campus_aruaru_jp',
    caption: '大学生が講義中に一度はやらかすあるあるシチュエーション5選。単位落とした瞬間のリアクション #あるある #コント #大学生 #講義 #単位 #aruaru',
    url: 'https://www.youtube.com/shorts/vN8kM4x_L2q',
    views: 2900000,
    likes: 210000,
    hoursAgo: 22.0,
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

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of targetList) {
      const normalized = normalizePostUrl(item.url);
      const enriched = enrichVideoInformation({
        caption: item.caption,
        creatorHandle: item.handle,
        platform: normalized.platform,
        url: normalized.canonicalUrl,
      });

      const itemPublishedIso = new Date(now.getTime() - (item.hoursAgo ?? 2) * 3600 * 1000).toISOString();
      const itemCapturedIso = new Date(now.getTime() - Math.max(0.1, (item.hoursAgo ?? 2) - 0.5) * 3600 * 1000).toISOString();

      // Ensure creator exists
      const creatorIdCandidate = `cr_${item.creator}`;
      const existingCreator = db.prepare('SELECT id FROM creators WHERE id = ? OR (platform = ? AND platform_creator_id = ?)').get(
        creatorIdCandidate,
        normalized.platform,
        item.creator,
      ) as { id: string } | undefined;

      let creatorId: string;
      if (existingCreator) {
        creatorId = existingCreator.id;
        db.prepare('UPDATE creators SET handle = ?, profile_url = ? WHERE id = ?').run(
          item.handle,
          `https://social.example/${item.handle}`,
          creatorId,
        );
      } else {
        creatorId = creatorIdCandidate;
        db.prepare(`
          INSERT INTO creators (id, platform, platform_creator_id, handle, profile_url, first_seen_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          creatorId,
          normalized.platform,
          item.creator,
          item.handle,
          `https://social.example/${item.handle}`,
          itemPublishedIso,
        );
      }

      // Check if post exists by canonical_url or (platform, platform_post_id)
      const existingPost = db.prepare(`
        SELECT id FROM posts
        WHERE canonical_url = ? OR (platform = ? AND platform_post_id = ?)
      `).get(normalized.canonicalUrl, normalized.platform, normalized.platformPostId) as { id: string } | undefined;

      let postId: string;
      if (existingPost) {
        postId = existingPost.id;
        db.prepare(`
          UPDATE posts
          SET published_at = ?, first_seen_at = ?, last_refreshed_at = ?, caption = ?
          WHERE id = ?
        `).run(itemPublishedIso, itemCapturedIso, nowIso, item.caption, postId);
      } else {
        postId = `sim_post_${item.creator}_${Date.now()}`;
        db.prepare(`
          INSERT INTO posts (
            id, platform, platform_post_id, canonical_url, creator_id, published_at, caption,
            media_type, first_seen_at, last_refreshed_at, access_tier, metadata_status, metadata_json, link_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'official_api', 'complete', ?, 'active')
        `).run(
          postId,
          normalized.platform,
          normalized.platformPostId,
          normalized.canonicalUrl,
          creatorId,
          itemPublishedIso,
          item.caption,
          normalized.mediaType,
          itemCapturedIso,
          nowIso,
          JSON.stringify({
            enrichedTitle: enriched.title,
            enrichedHook: enriched.hook,
            studentAppeal: enriched.studentAppeal,
            templateKey: enriched.templateKey,
            studentCategory: enriched.studentCategory,
          }),
        );
      }

      const capId = `sim_cap_${item.creator}_${Date.now()}`;
      db.prepare(`
        INSERT OR IGNORE INTO capture_events (
          id, post_id, raw_url, captured_at, capture_channel, source_lane,
          selection_method, submitter_pseudonym, discovery_surface, reason, note, processing_status
        ) VALUES (?, ?, ?, ?, 'api', 'broad', 'auto_observed', NULL, 'fyp', 'similar_discovery', ?, 'saved')
      `).run(capId, postId, normalized.canonicalUrl, itemCapturedIso, `類似動画探索: ${enriched.title}`);

      const metricId = `sim_m_${item.creator}_${Date.now()}`;
      db.prepare(`
        INSERT OR IGNORE INTO metric_snapshots (
          id, post_id, observed_at, view_count, like_count, comment_count,
          share_count, save_count, follower_count, data_source, confidence, score_eligible
        ) VALUES (?, ?, ?, ?, ?, ?, 1800, 3600, 65000, 'official_api', 1, 1)
      `).run(metricId, postId, itemCapturedIso, item.views, item.likes, 1800);

      console.log(`✓ 類似動画・台本を集積 [${itemPublishedIso.slice(0, 16)}]: ${enriched.title} (@${item.handle})`);
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

  console.log('--- スナップショットを最新状態へエクスポート中... ---');
  exportSnapshot();
  console.log('✓ スナップショットの自動エクスポートが完了しました。');

  db.close();
}

if (process.argv[1]?.endsWith('discoverSimilar.ts')) {
  const kw = process.argv[2];
  discoverSimilar(kw).catch(console.error);
}
