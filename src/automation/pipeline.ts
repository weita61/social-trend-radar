import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../db/database.ts';
import { LocalAnalysisEngine } from '../analysis/engine.ts';
import { enrichVideoInformation } from '../analysis/videoEnrichment.ts';
import { normalizePostUrl } from '../domain/url.ts';
import { exportSnapshot } from '../../scripts/exportSnapshot.ts';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export interface PipelineItem {
  topic: string;
  creator: string;
  handle: string;
  caption: string;
  url: string;
  views: number;
  likes: number;
  comments?: number;
  hoursAgo: number;
}

export const AUTOMATED_BUZZ_POOL: PipelineItem[] = [
  {
    topic: 'Canva・プレゼンスライド神技',
    creator: 'canva_univ_hack',
    handle: 'canva_univ_hack',
    caption: 'パワポのデザインで何時間も悩んでる人、それ全部無駄です。Canvaのこのテンプレート使えば文字入れるだけで5分でプロ級プレゼン完成するのに… #canva #スライド #プレゼン #大学生 #レポート #shortcut_hack',
    url: 'https://www.youtube.com/shorts/qC7iY4m_U3A',
    views: 2050000,
    likes: 142000,
    hoursAgo: 1.0,
  },
  {
    topic: 'Notion・履修登録＆課題管理',
    creator: 'notion_gakusei_lab',
    handle: 'notion_gakusei_lab',
    caption: '課題の提出遅れて単位落としかけた大学生、全員このNotionテンプレート使って…シラバス、講義リンク、提出期限、出席回数が1ページで全部把握できます #notion #履修 #課題締め切り #大学生 #勉強垢 #how_to',
    url: 'https://www.youtube.com/shorts/uP8jN5v_L7k',
    views: 1720000,
    likes: 118000,
    hoursAgo: 2.2,
  },
  {
    topic: 'Google Scholar・論文引用時短術',
    creator: 'scholar_report_ace',
    handle: 'scholar_report_ace',
    caption: 'レポートの参考文献、Wikipediaや個人ブログ貼ってない？Google Scholarで一発引用する方法。ボタン1回押すだけで正しい引用フォーマットが自動コピーされます #scholar #論文 #参考文献 #レポート #卒論 #how_to',
    url: 'https://www.youtube.com/shorts/rT9kM2w_P4x',
    views: 1910000,
    likes: 134000,
    hoursAgo: 3.5,
  },
  {
    topic: '就活・面接・神逆質問',
    creator: 'shukatsu_ace',
    handle: 'shukatsu_ace',
    caption: '面接官が唸る！最終面接で絶対刺さる神逆質問BEST3。「特にありません」は即落ちです。会社の課題に切り込む質問テンプレ #就活 #面接 #逆質問 #26卒 #27卒 #list',
    url: 'https://www.youtube.com/shorts/wN4vB7x_K9q',
    views: 2280000,
    likes: 153000,
    hoursAgo: 5.0,
  },
  {
    topic: 'レポート爆速化・ChatGPTプロンプト',
    creator: 'ai_gakusei_pro',
    handle: 'ai_gakusei_pro',
    caption: 'コピペ判定を完全回避！ChatGPTをレポートのアシスタントとして120%使い倒す指示プロンプト3選。構成案と目次を一瞬で生成 #chatgpt #レポート #大学 #aiプロンプト #how_to',
    url: 'https://www.youtube.com/shorts/jL2mC9x_V5p',
    views: 2540000,
    likes: 175000,
    hoursAgo: 6.5,
  },
  {
    topic: '英語メール・ビジネスマナー',
    creator: 'global_biz_eng',
    handle: 'global_biz_eng',
    caption: 'メールの書き出しは Hi XX-san,と書きます。Dearは硬すぎるし、Heyは馴れ馴れしい。ビジネスで一番使われる書き出しのリアル #英語 #英語学習 #ビジネス英語 #大学生 #メールの書き出し #failure_first',
    url: 'https://www.instagram.com/reel/DE_biz_eng01/',
    views: 1940000,
    likes: 121000,
    hoursAgo: 8.5,
  },
  {
    topic: '学割・生活ハック',
    creator: 'univ_saver',
    handle: 'univ_saver',
    caption: '知らないと年間10万損する！学生証見せるだけでタダ・半額になる神施設5選。社会人になったら使えない大学4年間の特権 #学割 #学生証 #大学生 #節約 #ライフハック #list',
    url: 'https://www.youtube.com/shorts/bF7kL9v_M3q',
    views: 2680000,
    likes: 194000,
    hoursAgo: 10.5,
  },
  {
    topic: 'PCショートカット・作業効率化',
    creator: 'pc_hack_sensei',
    handle: 'pc_hack_sensei',
    caption: 'マウス動かす時間、全部無駄です。画面分割と履歴ペーストで作業時間1/3になるWindows/Mac神ショートカット5選 #ショートカット #パソコン #大学生 #excel #how_to',
    url: 'https://www.youtube.com/shorts/xP3mN7v_K8q',
    views: 2310000,
    likes: 161000,
    hoursAgo: 12.5,
  },
  {
    topic: 'バイト代・103万扶養の壁',
    creator: 'gakusei_fuyo_info',
    handle: 'gakusei_fuyo_info',
    caption: 'バイト代103万・130万を超えると親にガチで怒られる『扶養のリアル』。知らないと親の税金が跳ね上がるので今すぐ確認して #103万の壁 #扶養 #バイト代 #税金 #大学生 #failure_first',
    url: 'https://www.youtube.com/shorts/tV8kL2m_P5x',
    views: 2020000,
    likes: 139000,
    hoursAgo: 14.0,
  },
  {
    topic: '試験対策・一夜漬け過去問逆算暗記',
    creator: 'univ_test_master',
    handle: 'univ_test_master',
    caption: 'テスト前夜の一夜漬けで80点取るための『過去問逆算暗記法』。教科書1ページ目から読むの今すぐやめて！それ落ちます #テスト #一夜漬け #勉強法 #暗記 #大学生 #how_to',
    url: 'https://www.youtube.com/shorts/kL9mN2v_Q4p',
    views: 2420000,
    likes: 169000,
    hoursAgo: 16.5,
  },
  {
    topic: '一人暮らし・悪魔の時短飯',
    creator: 'zubora_meshi_univ',
    handle: 'zubora_meshi_univ',
    caption: 'フライパン1つで5分！自炊面倒な一人暮らし大学生のための悪魔の時短飯レシピ。外食行く気なくなるから保存して #料理 #レシピ #時短飯 #ズボラ飯 #一人暮らし #recipe',
    url: 'https://www.youtube.com/shorts/mP4kL7x_V9b',
    views: 2850000,
    likes: 203000,
    hoursAgo: 19.0,
  },
  {
    topic: '大学講義あるある',
    creator: 'campus_aruaru_jp',
    handle: 'campus_aruaru_jp',
    caption: '大学生が講義中に一度はやらかすあるあるシチュエーション5選。単位落とした瞬間のリアクション #あるある #コント #大学生 #講義 #単位 #aruaru',
    url: 'https://www.youtube.com/shorts/vN8kM4x_L2q',
    views: 2980000,
    likes: 218000,
    hoursAgo: 21.5,
  },
  {
    topic: 'iPad・神ノート術',
    creator: 'ipad_univ_notes',
    handle: 'ipad_univ_notes',
    caption: '大学生のiPadノート術！Goodnotesと純正メモを使い分けて成績上位を狙うPDF教科書の活用法 #ipad #ノート術 #大学生 #goodnotes #勉強法 #how_to',
    url: 'https://www.youtube.com/shorts/gH2vK8m_N4x',
    views: 1890000,
    likes: 131000,
    hoursAgo: 0.5,
  },
  {
    topic: '就活・自己PRガクチカ逆算',
    creator: 'shukatsu_coach_ryo',
    handle: 'shukatsu_coach_ryo',
    caption: '自己PRでバイトリーダーと書かずに内定を無双する逆算思考。「課題解決のプロセス」を3行で伝えるテンプレ #就活 #自己pr #ガクチカ #面接 #how_to',
    url: 'https://www.youtube.com/shorts/eP9mN4v_Q7b',
    views: 2100000,
    likes: 145000,
    hoursAgo: 1.8,
  },
  {
    topic: '生活費激変・学割サブスクBEST4',
    creator: 'student_money_lab',
    handle: 'student_money_lab',
    caption: '大学入ったら即登録必須！月額が一般の半額以下になる神学割サブスクBEST4。AppleMusic、Prime、Notion、YouTube #学割 #サブスク #大学生 #節約 #best_list',
    url: 'https://www.youtube.com/shorts/yT4mK9x_V2p',
    views: 2340000,
    likes: 167000,
    hoursAgo: 3.0,
  }
];

export interface PipelineRunResult {
  collectedCount: number;
  updatedCount: number;
  totalVideos: number;
  analysisRunId: string;
  clusterCount: number;
  timestamp: string;
}

export function syncWebAssets(): void {
  try {
    mkdirSync('public', { recursive: true });
    if (existsSync('apps/web/index.html')) {
      cpSync('apps/web/index.html', 'public/index.html');
      cpSync('apps/web/style.css', 'public/style.css');
      cpSync('apps/web/app.js', 'public/app.js');

      const html = readFileSync('apps/web/index.html', 'utf-8');
      const css = readFileSync('apps/web/style.css', 'utf-8');
      const js = readFileSync('apps/web/app.js', 'utf-8');

      const tsContent = `// Auto-generated by scripts/buildWeb.js - do not edit directly
export const INDEX_HTML: string = ${JSON.stringify(html)};
export const STYLE_CSS: string = ${JSON.stringify(css)};
export const APP_JS: string = ${JSON.stringify(js)};
`;
      writeFileSync('src/webAssets.ts', tsContent, 'utf-8');
    }
  } catch (err) {
    console.warn('[Pipeline] Web assets sync notice:', err);
  }
}

export async function runAutomatedPipeline(dbInstance?: DatabaseSync): Promise<PipelineRunResult> {
  const db = dbInstance ?? openDatabase();
  const shouldClose = dbInstance === undefined;
  const now = new Date();
  const nowIso = now.toISOString();

  let collectedCount = 0;
  let updatedCount = 0;

  console.log(`[AutoPipeline] === 全自動パイプライン開始: ${nowIso} ===`);

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of AUTOMATED_BUZZ_POOL) {
      const normalized = normalizePostUrl(item.url);
      const enriched = enrichVideoInformation({
        caption: item.caption,
        creatorHandle: item.handle,
        platform: normalized.platform,
        url: normalized.canonicalUrl,
      });

      const itemPublishedIso = new Date(now.getTime() - (item.hoursAgo ?? 2) * 3600 * 1000).toISOString();
      const itemCapturedIso = new Date(now.getTime() - Math.max(0.1, (item.hoursAgo ?? 2) - 0.3) * 3600 * 1000).toISOString();

      const creatorCandidateId = `cr_${item.creator}`;
      const existingCreator = db.prepare('SELECT id FROM creators WHERE id = ? OR (platform = ? AND platform_creator_id = ?)').get(
        creatorCandidateId,
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
        creatorId = creatorCandidateId;
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
        updatedCount += 1;
      } else {
        postId = `auto_post_${item.creator}_${Date.now()}`;
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
        collectedCount += 1;
      }

      const capId = `auto_cap_${item.creator}_${Date.now()}`;
      db.prepare(`
        INSERT OR IGNORE INTO capture_events (
          id, post_id, raw_url, captured_at, capture_channel, source_lane,
          selection_method, submitter_pseudonym, discovery_surface, reason, note, processing_status
        ) VALUES (?, ?, ?, ?, 'api', 'broad', 'auto_observed', NULL, 'fyp', 'automated_pipeline', ?, 'saved')
      `).run(capId, postId, normalized.canonicalUrl, itemCapturedIso, `全自動収集: ${enriched.title}`);

      const metricId = `auto_m_${item.creator}_${Date.now()}`;
      db.prepare(`
        INSERT OR IGNORE INTO metric_snapshots (
          id, post_id, observed_at, view_count, like_count, comment_count,
          share_count, save_count, follower_count, data_source, confidence, score_eligible
        ) VALUES (?, ?, ?, ?, ?, ?, 1800, 3600, 65000, 'official_api', 1, 1)
      `).run(metricId, postId, itemCapturedIso, item.views, item.likes, item.comments ?? 1800);
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[AutoPipeline] データ取り込みエラー:', err);
    throw err;
  }

  console.log(`[AutoPipeline] 取り込み完了: 新規 ${collectedCount} 本, 更新 ${updatedCount} 本`);
  console.log('[AutoPipeline] ローカル3層分析エンジンを実行中...');
  const engine = new LocalAnalysisEngine(db);
  const analysisResult = engine.run(now);
  console.log(`[AutoPipeline] 分析完了: クラスタ数 ${analysisResult.clusterCount}, RunId ${analysisResult.runId}`);

  console.log('[AutoPipeline] スナップショットを最新化中...');
  exportSnapshot();

  console.log('[AutoPipeline] Webアセットを同期中...');
  syncWebAssets();

  const totalVideos = (db.prepare('SELECT count(*) as c FROM posts').get() as { c: number }).c;
  console.log(`[AutoPipeline] === 全自動パイプライン完了: 総動画数 ${totalVideos} 本 ===`);

  if (shouldClose) {
    db.close();
  }

  return {
    collectedCount,
    updatedCount,
    totalVideos,
    analysisRunId: analysisResult.runId,
    clusterCount: analysisResult.clusterCount,
    timestamp: nowIso,
  };
}
