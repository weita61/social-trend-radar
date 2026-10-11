import { openDatabase } from '../db/database.ts';
import { LocalAnalysisEngine } from '../analysis/engine.ts';

const SEED_CREATORS = [
  { id: 'cr_usutaku', platform: 'instagram', platformCreatorId: 'usutaku_copilot', handle: 'usutaku_copilot', profileUrl: 'https://instagram.com/usutaku_copilot' },
  { id: 'cr_monoshiru', platform: 'youtube', platformCreatorId: 'UCmonoshiru001', handle: 'monoshiru_sensei', profileUrl: 'https://youtube.com/@monoshiru_sensei' },
  { id: 'cr_techhack', platform: 'tiktok', platformCreatorId: 'tech_hack_jp', handle: 'tech_hack_jp', profileUrl: 'https://tiktok.com/@tech_hack_jp' },
  { id: 'cr_bizskills', platform: 'instagram', platformCreatorId: 'biz_skills', handle: 'biz_skills', profileUrl: 'https://instagram.com/biz_skills' },
  { id: 'cr_studyai', platform: 'tiktok', platformCreatorId: 'study_ai_lab', handle: 'study_ai_lab', profileUrl: 'https://tiktok.com/@study_ai_lab' },
  { id: 'cr_gakuseihack', platform: 'youtube', platformCreatorId: 'UCgakuseihack', handle: 'gakusei_lifehack', profileUrl: 'https://youtube.com/@gakusei_lifehack' },
  { id: 'cr_moneyuniv', platform: 'instagram', platformCreatorId: 'univ_money_tips', handle: 'univ_money_tips', profileUrl: 'https://instagram.com/univ_money_tips' },
  { id: 'cr_shukatsu', platform: 'tiktok', platformCreatorId: 'shukatsu_god', handle: 'shukatsu_god', profileUrl: 'https://tiktok.com/@shukatsu_god' },
  { id: 'cr_ryuji', platform: 'youtube', platformCreatorId: 'UCryuji_food01', handle: 'ryuji_foodlab', profileUrl: 'https://youtube.com/@ryuji_foodlab' },
  { id: 'cr_zubora', platform: 'tiktok', platformCreatorId: 'zubora_meshi', handle: 'zubora_meshi', profileUrl: 'https://tiktok.com/@zubora_meshi' },
  { id: 'cr_biyou', platform: 'instagram', platformCreatorId: 'biyou_ch', handle: 'biyou_ch', profileUrl: 'https://instagram.com/biyou_ch' },
  { id: 'cr_gadget', platform: 'youtube', platformCreatorId: 'gadget_mono', handle: 'gadget_mono', profileUrl: 'https://youtube.com/@gadget_mono' },
  { id: 'cr_morning', platform: 'instagram', platformCreatorId: 'morning_vlog', handle: 'morning_vlog', profileUrl: 'https://instagram.com/morning_vlog' },
  { id: 'cr_weekend', platform: 'youtube', platformCreatorId: 'weekend_chill', handle: 'weekend_chill', profileUrl: 'https://youtube.com/@weekend_chill' },
  { id: 'cr_iphonewaza', platform: 'tiktok', platformCreatorId: 'iphone_waza', handle: 'iphone_waza', profileUrl: 'https://tiktok.com/@iphone_waza' },
  { id: 'cr_comedyjp', platform: 'tiktok', platformCreatorId: 'comedy_japan', handle: 'comedy_japan', profileUrl: 'https://tiktok.com/@comedy_japan' },
  { id: 'cr_hikakin', platform: 'youtube', platformCreatorId: 'UCZf__vdCuKYeGagP9j02d-g', handle: 'hikakin', profileUrl: 'https://youtube.com/@hikakin' },
];

const SEED_TEMPLATES = [
  // 1. 英語メール・ビジネスマナー（実例：usutaku_copilot）
  {
    creatorId: 'cr_usutaku',
    platform: 'instagram',
    videoId: 'Ddiufd9zvmx',
    url: 'https://www.instagram.com/reel/Ddiufd9zvmx/',
    caption: 'メールの書き出しは Hi Usui-san,と書きます。Dearは硬すぎるし、Heyは馴れ馴れしい。ビジネスで一番使われる書き出しのリアル #英語 #仕事術 #ビジネスマナー #就活 #大学生 #usutaku #how_to #失敗',
    viewsA: 280000, viewsB: 1840000, likes: 18000, comments: 53, lane: 'broad',
  },
  {
    creatorId: 'cr_bizskills',
    platform: 'instagram',
    videoId: 'DeJu29itbmn',
    url: 'https://www.instagram.com/reel/DeJu29itbmn/',
    caption: 'メール送信でやってはいけない重大なNGミスと失敗回避の手順。宛先と敬称の落とし穴 #失敗 #how_to #ビジネスマナー #就活',
    viewsA: 160000, viewsB: 880000, likes: 45000, comments: 1900, lane: 'fixed_panel',
  },
  {
    creatorId: 'cr_shukatsu',
    platform: 'instagram',
    videoId: 'DGUec4wS4tP',
    url: 'https://www.instagram.com/reel/DGUec4wS4tP/',
    caption: 'バイトで使ってはいけない『バイト敬語』NG集。「よろしかったでしょうか」「〜のほう」の正しい言い換え #バイト敬語 #ビジネスマナー #就活 #大学生 #失敗',
    viewsA: 190000, viewsB: 920000, likes: 52000, comments: 1400, lane: 'external',
  },

  // 2. AI・ChatGPT・レポート作成裏技
  {
    creatorId: 'cr_studyai',
    platform: 'youtube',
    videoId: '-g7JeoYTCzM',
    url: 'https://www.youtube.com/shorts/-g7JeoYTCzM',
    caption: '大学生必見！ChatGPTでレポートの文献検索・目次作成を5倍速にする神プロンプト。教授に怒られない構成の作り方 #chatgpt #レポート #大学 #aiプロンプト #仕事術 #how_to',
    viewsA: 210000, viewsB: 1450000, likes: 98000, comments: 2400, lane: 'broad',
  },
  {
    creatorId: 'cr_techhack',
    platform: 'youtube',
    videoId: 'nx4k57maunY',
    url: 'https://www.youtube.com/shorts/nx4k57maunY',
    caption: 'パワポ作成はもう古い！箇条書き入れるだけでプレゼンスライドが一瞬で完成する神AIツールGamma解説 #gamma #aiツール #パワポ #大学生 #プレゼン #how_to',
    viewsA: 240000, viewsB: 1320000, likes: 78000, comments: 1800, lane: 'external',
  },
  {
    creatorId: 'cr_monoshiru',
    platform: 'youtube',
    videoId: 'szNO6oVeVC0',
    url: 'https://www.youtube.com/shorts/szNO6oVeVC0',
    caption: '卒論・レポートが一瞬で終わる！Googleドキュメントの神音声入力＆リアルタイム要約術 #レポート #卒論 #大学生 #作業効率化 #時短 #how_to',
    viewsA: 170000, viewsB: 960000, likes: 61000, comments: 1500, lane: 'fixed_panel',
  },

  // 3. 学割・お金・学生制度の裏技
  {
    creatorId: 'cr_moneyuniv',
    platform: 'youtube',
    videoId: 'fGJM-ry8AXk',
    url: 'https://www.youtube.com/shorts/fGJM-ry8AXk',
    caption: '知らないと年間10万損する！学生証見せるだけでタダ・半額になる神施設5選。映画館や美術館だけじゃない #学割 #学生証 #大学生 #節約 #ライフハック #list',
    viewsA: 320000, viewsB: 1980000, likes: 125000, comments: 3400, lane: 'broad',
  },
  {
    creatorId: 'cr_moneyuniv',
    platform: 'instagram',
    videoId: 'Dd_Hygjz0VI',
    url: 'https://www.instagram.com/reel/Dd_Hygjz0VI/',
    caption: '大学生限定で無料or月額半額になる神サブスクまとめ。Prime Student、Apple Music学割、Notion Pro #学割 #大学生 #サブスク #節約 #お得情報 #list',
    viewsA: 280000, viewsB: 1650000, likes: 110000, comments: 2800, lane: 'fixed_panel',
  },
  {
    creatorId: 'cr_gakuseihack',
    platform: 'youtube',
    videoId: 'ZWKvHLlTLdM',
    url: 'https://www.youtube.com/shorts/ZWKvHLlTLdM',
    caption: 'バイト代103万・130万を超えると親にガチで怒られる『扶養のリアル』。知らないと親の税金が跳ね上がる #103万の壁 #扶養 #バイト代 #税金 #大学生 #失敗',
    viewsA: 250000, viewsB: 1720000, likes: 94000, comments: 3100, lane: 'broad',
  },

  // 4. PC・スマホ神技・ショートカット
  {
    creatorId: 'cr_monoshiru',
    platform: 'youtube',
    videoId: 'Lz8SO3iEQYA',
    url: 'https://www.youtube.com/shorts/Lz8SO3iEQYA',
    caption: '大学生が全員覚えるべきWindows/Macショートカット神5選。画面分割と履歴ペーストで作業時間1/3 #ショートカット #パソコン #レポート #大学生 #仕事術 #list',
    viewsA: 290000, viewsB: 1850000, likes: 115000, comments: 2200, lane: 'broad',
  },
  {
    creatorId: 'cr_iphonewaza',
    platform: 'youtube',
    videoId: 'c7Vh0gUviXY',
    url: 'https://www.youtube.com/shorts/c7Vh0gUviXY',
    caption: '大学のプリント、コンビニでスキャンしてない？iPhoneのメモ機能で一瞬で歪みなしPDF化する裏技 #iphone #スマホ裏技 #スキャン #pdf #大学生 #how_to',
    viewsA: 340000, viewsB: 2100000, likes: 138000, comments: 3200, lane: 'external',
  },

  // 5. 就活・面接・逆質問
  {
    creatorId: 'cr_shukatsu',
    platform: 'youtube',
    videoId: '1SKz70-KhuY',
    url: 'https://www.youtube.com/shorts/1SKz70-KhuY',
    caption: '面接の最後に『質問はありますか？』と言われたときの神逆質問3選。特にありませんは即落ち #就活 #面接 #逆質問 #インターン #ビジネスマナー #list',
    viewsA: 260000, viewsB: 1540000, likes: 88000, comments: 2100, lane: 'broad',
  },
  {
    creatorId: 'cr_bizskills',
    platform: 'youtube',
    videoId: 'iPwqPuR8Uuw',
    url: 'https://www.youtube.com/shorts/iPwqPuR8Uuw',
    caption: 'ESの自己PRで「バイトリーダー」と書かずに内定を勝ち取る構成法。結果ではなくプロセスを書く #就活 #自己PR #ES #エントリーシート #面接 #how_to',
    viewsA: 180000, viewsB: 1120000, likes: 67000, comments: 1600, lane: 'fixed_panel',
  },

  // 6. 勉強・試験・暗記法
  {
    creatorId: 'cr_gakuseihack',
    platform: 'youtube',
    videoId: '-ayVQgntccA',
    url: 'https://www.youtube.com/shorts/-ayVQgntccA',
    caption: 'テスト前夜の一夜漬けで80点取るための『過去問逆算暗記法』。教科書1ページ目から読むの今すぐやめて #テスト #一夜漬け #勉強法 #暗記 #大学生 #how_to',
    viewsA: 310000, viewsB: 1950000, likes: 128000, comments: 2900, lane: 'broad',
  },
  {
    creatorId: 'cr_studyai',
    platform: 'youtube',
    videoId: 'Dx54Rvyaahc',
    url: 'https://www.youtube.com/shorts/Dx54Rvyaahc',
    caption: '単語帳を何周しても覚えられない人がやってしまっているNG暗記法。見るだけは脳が覚えない #英語 #暗記法 #勉強法 #英単語 #資格勉強 #失敗',
    viewsA: 230000, viewsB: 1420000, likes: 89000, comments: 1900, lane: 'external',
  },
  {
    creatorId: 'cr_monoshiru',
    platform: 'youtube',
    videoId: '0AGn67Vnpik',
    url: 'https://www.youtube.com/shorts/0AGn67Vnpik',
    caption: 'ついついスマホ触っちゃう大学生必見！ポモドーロタイマー×タイムラプス勉強法で集中力5倍 #勉強法 #ポモドーロ #タイムラプス #集中力 #大学生 #routine',
    viewsA: 190000, viewsB: 1220000, likes: 74000, comments: 1300, lane: 'fixed_panel',
  },

  // 7. 神グッズ・文房具・一人暮らし
  {
    creatorId: 'cr_gadget',
    platform: 'youtube',
    videoId: 'Ebv4CymGNuM',
    url: 'https://www.youtube.com/shorts/Ebv4CymGNuM',
    caption: '無印良品で大学生がガチで買ってよかった勉強効率化文具3選。裏写りしないノートと疲れないペン #無印良品 #文房具 #勉強垢 #大学生 #買ってよかった #gadget_review',
    viewsA: 270000, viewsB: 1650000, likes: 98000, comments: 1700, lane: 'broad',
  },
  {
    creatorId: 'cr_techhack',
    platform: 'youtube',
    videoId: 'kof1Tg52Qbk',
    url: 'https://www.youtube.com/shorts/kof1Tg52Qbk',
    caption: 'ダイソーで買える！一人暮らし大学生が自炊を圧倒的にサボれる神キッチングッズBEST3 #ダイソー #100均 #一人暮らし #自炊 #便利グッズ #gadget_review',
    viewsA: 250000, viewsB: 1580000, likes: 92000, comments: 2100, lane: 'external',
  },

  // 8. 悪魔の時短飯（自炊学生向け）
  {
    creatorId: 'cr_ryuji',
    platform: 'youtube',
    videoId: '8VpIQ74iekk',
    url: 'https://www.youtube.com/shorts/8VpIQ74iekk',
    caption: 'フライパン1つで5分！自炊面倒な一人暮らし大学生のための悪魔の時短飯レシピ。外食行く気なくなる #料理 #レシピ #時短飯 #ズボラ飯 #一人暮らし #gourmet_recipe',
    viewsA: 420000, viewsB: 2350000, likes: 135000, comments: 2400, lane: 'broad',
  },
  {
    creatorId: 'cr_zubora',
    platform: 'youtube',
    videoId: '8Aov9Q5r8lU',
    url: 'https://www.youtube.com/shorts/8Aov9Q5r8lU',
    caption: 'レンジで3分！深夜のテスト勉強中に食べる背徳の夜食レシピ。包丁も火も使わない #料理 #レシピ #夜食 #ズボラ飯 #gourmet_recipe',
    viewsA: 260000, viewsB: 1480000, likes: 85000, comments: 1500, lane: 'external',
  },

  // 9. ルーティン・Vlog（大学生密着）
  {
    creatorId: 'cr_morning',
    platform: 'youtube',
    videoId: 'MVyT-8hvjbc',
    url: 'https://www.youtube.com/shorts/MVyT-8hvjbc',
    caption: 'テスト前日のリアルな1日・勉強と自炊の密着Vlog。大学生の一人暮らし日常 #ルーティン #vlog #大学生 #一人暮らし #日常 #routine',
    viewsA: 210000, viewsB: 1250000, likes: 76000, comments: 1400, lane: 'fixed_panel',
  },
  {
    creatorId: 'cr_weekend',
    platform: 'youtube',
    videoId: 'iI7L9wr9_B0',
    url: 'https://www.youtube.com/shorts/iI7L9wr9_B0',
    caption: '休日にレポート終わらせて自分を甘やかす大学生のVlog。部屋作りとカフェ時間 #routine #vlog #大学生 #休日 #日常',
    viewsA: 180000, viewsB: 1080000, likes: 69000, comments: 1100, lane: 'broad',
  },

  // 10. 日常あるある共感型（大学生・学校）
  {
    creatorId: 'cr_comedyjp',
    platform: 'youtube',
    videoId: 'Aw3IRM98JnY',
    url: 'https://www.youtube.com/shorts/Aw3IRM98JnY',
    caption: '大学生が講義中に一度はやらかすあるあるシチュエーション5選 #あるある #コント #大学生 #学校 #日常',
    viewsA: 380000, viewsB: 2150000, likes: 112000, comments: 4500, lane: 'external',
  },
  {
    creatorId: 'cr_hikakin',
    platform: 'youtube',
    videoId: 'tkyrJSIN51E',
    url: 'https://www.youtube.com/shorts/tkyrJSIN51E',
    caption: '単位を落とした瞬間の大学生のリアルなリアクションあるある #あるある #コント #大学生 #shorts #日常',
    viewsA: 340000, viewsB: 1920000, likes: 98000, comments: 3800, lane: 'broad',
  },

  // 11. 美容・垢抜け・プチプラ
  {
    creatorId: 'cr_biyou',
    platform: 'youtube',
    videoId: '3FlggtbFMck',
    url: 'https://www.youtube.com/shorts/3FlggtbFMck',
    caption: 'これに変えたら肌褒められまくった！ドラッグストアで買える学生向けプチプラ名品コスメで垢抜け #美容 #コスメ #垢抜け #ビフォーアフター #before_after',
    viewsA: 260000, viewsB: 1450000, likes: 91000, comments: 1800, lane: 'broad',
  },
];

export function seedTemplates(): void {
  const db = openDatabase();
  const now = new Date('2026-10-10T12:00:00Z');
  const nowIso = now.toISOString();
  const prevDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prevIso = prevDate.toISOString();

  console.log('--- 学生向け実用ショート動画テンプレ集積シード開始 ---');

  db.exec('BEGIN IMMEDIATE');
  try {
    // 1. 既存シードデータのクリーンアップ
    db.prepare(`
      DELETE FROM trend_evidence_posts
      WHERE post_id LIKE 'seed_%'
    `).run();
    db.prepare(`
      DELETE FROM cluster_members
      WHERE post_id LIKE 'seed_%'
    `).run();
    db.prepare(`
      DELETE FROM content_features
      WHERE post_id LIKE 'seed_%'
    `).run();
    db.prepare(`
      DELETE FROM post_metric_analysis
      WHERE post_id LIKE 'seed_%'
    `).run();
    db.prepare(`
      DELETE FROM metric_snapshots
      WHERE post_id LIKE 'seed_%'
    `).run();
    db.prepare(`
      DELETE FROM capture_events
      WHERE post_id LIKE 'seed_%'
    `).run();
    db.prepare(`
      DELETE FROM posts
      WHERE id LIKE 'seed_%'
    `).run();

    // 2. クリエイター登録
    const insertCreator = db.prepare(`
      INSERT INTO creators (id, platform, platform_creator_id, handle, profile_url, first_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        handle = excluded.handle,
        profile_url = excluded.profile_url
    `);
    for (const c of SEED_CREATORS) {
      insertCreator.run(c.id, c.platform, c.platformCreatorId, c.handle, c.profileUrl, prevIso);
    }

    // 3. 投稿・キャプチャイベント・指標スナップショット登録
    const insertPost = db.prepare(`
      INSERT INTO posts (
        id, platform, platform_post_id, canonical_url, creator_id, published_at, caption,
        media_type, first_seen_at, last_refreshed_at, access_tier, metadata_status, metadata_json, link_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'short', ?, ?, 'official_api', 'complete', ?, 'active')
    `);

    const insertEvent = db.prepare(`
      INSERT INTO capture_events (
        id, post_id, raw_url, captured_at, capture_channel, source_lane,
        selection_method, submitter_pseudonym, discovery_surface, reason, note, processing_status
      ) VALUES (?, ?, ?, ?, 'api', ?, 'auto_observed', NULL, 'fyp', 'format', ?, 'saved')
    `);

    const insertMetric = db.prepare(`
      INSERT INTO metric_snapshots (
        id, post_id, observed_at, view_count, like_count, comment_count,
        share_count, save_count, follower_count, data_source, confidence, score_eligible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'official_api', 1, 1)
    `);

    for (let index = 0; index < SEED_TEMPLATES.length; index += 1) {
      const item = SEED_TEMPLATES[index];
      const postId = `seed_post_${index + 1}`;
      const capId = `seed_cap_${index + 1}`;
      const metricId1 = `seed_m1_${index + 1}`;
      const metricId2 = `seed_m2_${index + 1}`;

      insertPost.run(
        postId, item.platform, item.videoId, item.url, item.creatorId,
        prevIso, item.caption, prevIso, nowIso, JSON.stringify({ seeded: true }),
      );

      insertEvent.run(
        capId, postId, item.url, nowIso, item.lane,
        '日本の学生に刺さる実用ショート動画テンプレ',
      );

      // Baseline snapshot (24h ago)
      insertMetric.run(
        metricId1, postId, prevIso, item.viewsA, Math.round(item.likes * 0.3),
        Math.round(item.comments * 0.3), 100, 200, 50000,
      );

      // Current snapshot (now) - showing rapid lift
      insertMetric.run(
        metricId2, postId, nowIso, item.viewsB, item.likes,
        item.comments, 1200, 2400, 52000,
      );
    }

    db.exec('COMMIT');
    console.log(`✓ ${SEED_TEMPLATES.length} 本の実用ショート動画を登録完了`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('シード中にエラー発生:', err);
    throw err;
  }

  console.log('--- ローカル分析エンジンを実行中... ---');
  const engine = new LocalAnalysisEngine(db);
  const result = engine.run(now);
  console.log('✓ 分析完了:', JSON.stringify(result, null, 2));

  db.close();
}

if (process.argv[1]?.endsWith('seedTemplates.ts')) {
  seedTemplates();
}
