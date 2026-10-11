export interface EnrichedVideoInfo {
  title: string;
  hook: string;
  conceptSummary: string;
  studentAppeal: string;
  templateKey: string;
  templateLabel: string;
  studentCategory: string;
  studentCategoryLabel: string;
  actionableArrangement: string;
  timelineOutline: string;
  selfHook: string;
  selfScriptOutline: string;
  filmingTips: string;
  hitReason: string;
}

const TEMPLATE_MAP = {
  failure_first: '⚠️ 【失敗先出し型】',
  shortcut_hack: '⚡ 【裏技・神時短型】',
  how_to: '📚 【手順解説型】',
  best_list: '🏆 【まとめ・BEST型】',
  qa_solve: '❓ 【疑問・Q&A型】',
  routine: '🌿 【ルーティン型】',
  aruaru: '🎭 【日常あるある型】',
  recipe: '🍳 【悪魔の時短飯型】',
  before_after: '💄 【劇的変身型】',
  gadget: '📦 【生活激変ガジェット型】',
} as const;

const CATEGORY_MAP = {
  ai_pc_hack: '💻 AI・PC・スマホ裏技',
  study_report: '🎓 勉強・レポート術',
  career_manner: '👔 就活・マナー・英語',
  student_life: '💰 学割・生活ハック',
  gadget_tool: '📱 神アイテム・便利ツール',
  entertainment: '🎭 エンタメ・日常あるある',
} as const;

export function enrichVideoInformation(input: {
  caption?: string | null;
  creatorHandle?: string | null;
  platform?: string | null;
  url?: string | null;
  rawLabel?: string | null;
}): EnrichedVideoInfo {
  const cap = (input.caption ?? '').trim();
  const text = `${cap} ${input.creatorHandle ?? ''} ${input.rawLabel ?? ''}`.toLowerCase();

  // 1. usutaku / 英語メール / ビジネス
  if (text.includes('usutaku') || text.includes('メールの書き出し') || text.includes('hi usui') || (text.includes('メール') && text.includes('英語'))) {
    return {
      title: '📧 【英語メール】書き出しは『Hi XX-san』が正解！恥をかかないリアル英語マナー',
      hook: '「英語のメール、まだ『Dear XX』で送ってない？実はネイティブの間では…」',
      conceptSummary: 'ネイティブやグローバル企業で最も自然に使われる書き出しと、日本の学生が勘違いしがちな硬すぎる表現を比較解説。',
      studentAppeal: 'インターン、就活、留学、研究室の教授・留学生とのやり取りで今すぐ使えて恥をかかない実益性。',
      templateKey: 'failure_first',
      templateLabel: TEMPLATE_MAP.failure_first,
      studentCategory: 'career_manner',
      studentCategoryLabel: CATEGORY_MAP.career_manner,
      actionableArrangement: '自社の業界・サービスにおける「顧客や上司が実は気にしているリアルな作法・マナー」を先出しして解説。',
      timelineOutline: '【0〜2秒】「メールの書き出し、まだDearって書いてる？」と問いかけ\n→ 【3〜8秒】「Dearは教科書英語で硬すぎ、Heyは馴れ馴れしい」と理由解説\n→ 【9〜18秒】「Hi XX-san,」がビジネスで一番自然に使われていると実演\n→ 【19〜25秒】「あとで見返せるよう保存しておいてね」と保存誘導',
      selfHook: '「〇〇の連絡、まだ△△って送ってませんか？実は相手に失礼と思われてます…」',
      selfScriptOutline: '【0〜2秒】自社業界で初心者がやりがちなNG連絡マナーの提示\n→ 【3〜8秒】なぜそれがNGなのか相手目線で論理解説\n→ 【9〜18秒】自社推奨のスマートな正解テンプレートを画面で実演\n→ 【19〜25秒】「テンプレはプロフのリンクから無料配布中」と誘導',
      filmingTips: 'カメラ目線で早口・テンポ重視。PC画面に実際のメール作成画面を映しながら赤枠でハイライト。',
      hitReason: '「恥をかきたくない」という強い損失回避心理と、今すぐ真似できる手軽さが保存・シェアを直撃。',
    };
  }

  // 2. ChatGPT / レポート / 卒論
  if (text.includes('chatgpt') || text.includes('レポート') || text.includes('卒論') || text.includes('aiプロンプト')) {
    return {
      title: '📑 【レポート爆速化】ChatGPTで文献検索・目次構成を5倍速にする神プロンプト',
      hook: '「レポートまだ一から自力で書いてる？このプロンプト知れば一瞬で骨組み完成するのに…」',
      conceptSummary: '丸投げして教授に怒られないための「構成案・参考文献の抽出」に特化した賢い指示文の具体例。',
      studentAppeal: '締め切り前夜の課題地獄から脱出できる、全大学生必須の即効ライフハック。',
      templateKey: 'shortcut_hack',
      templateLabel: TEMPLATE_MAP.shortcut_hack,
      studentCategory: 'ai_pc_hack',
      studentCategoryLabel: CATEGORY_MAP.ai_pc_hack,
      actionableArrangement: '自社ツールやサービスの導入で作業時間が劇的に短縮される具体的な指示プロンプトや手順を実演。',
      timelineOutline: '【0〜2秒】「レポートまだ自力で書いてる？」と非効率な作業を否定\n→ 【3〜8秒】ChatGPTにコピペするだけの厳選プロンプト画面を提示\n→ 【9〜18秒】論文構成と参考文献候補が10秒で出力される劇的実演\n→ 【19〜25秒】「プロンプトの全文はコメント欄に固定したよ」とコメント誘導',
      selfHook: '「まだこの作業を手作業でやってる人、今すぐこのAIプロンプト使って！」',
      selfScriptOutline: '【0〜2秒】自社ターゲットが日々苦労している重い作業の提示\n→ 【3〜8秒】自社おすすめのAIプロンプト・自動化コマンドの入力\n→ 【9〜18秒】一瞬で成果物が出来上がる画面録画の実演\n→ 【19〜25秒】「試したい人はコメントで教えて！」とアクション喚起',
      filmingTips: '画面録画をメインにし、重要なコマンド部分は画面中央に大きく太字ゴシックでテロップ表示。1.2倍速のテンポ感。',
      hitReason: '明確な時間短縮のインパクトと、後で手元で試すための「保存欲求」が極めて高い。',
    };
  }

  // 3. 学割 / 学生証 / 無料
  if (text.includes('学割') || text.includes('学生証') || text.includes('タダ') || text.includes('10万損')) {
    return {
      title: '💰 【学割の裏技】知らないと年間10万損する！学生証見せるだけでタダ・半額になる神施設5選',
      hook: '「これ知らずに普通料金払ってる大学生、ガチで大損してます…」',
      conceptSummary: '映画館や美術館だけじゃない！学生証提示で無料・格安になる隠れた神施設・制度・サブスクまとめ。',
      studentAppeal: '知っているだけで大学4年間の出費が圧倒的に浮く、お金のない学生に刺さる生活ハック。',
      templateKey: 'best_list',
      templateLabel: TEMPLATE_MAP.best_list,
      studentCategory: 'student_life',
      studentCategoryLabel: CATEGORY_MAP.student_life,
      actionableArrangement: '自社商品・サービスの学割プランや若手優待、特典を「知らなきゃ損するリスト」形式で紹介。',
      timelineOutline: '【0〜2秒】「これ知らずに正規料金払ってる大学生、大損です」と宣言\n→ 【3〜8秒】第1位〜第2位：知られざる美術館・映画・交通の学生優待\n→ 【9〜16秒】第3位〜第4位：AdobeやApple、Notionなどの神学割制度\n→ 【17〜24秒】「1番ヤバい最後の1つは…」と最後まで見せ、保存を推奨',
      selfHook: '「知らないと損する！〇〇の特典・優待BEST5」',
      selfScriptOutline: '【0〜2秒】知らなきゃ損するお得情報の総数・損失額を冒頭で提示\n→ 【3〜10秒】前半2つをテンポよくポンポンと紹介\n→ 【11〜18秒】意外性の高い後半の特典を紹介\n→ 【19〜25秒】「友達にも教えてあげてね」とシェア・保存誘導',
      filmingTips: '画面右上に「①/⑤」の進捗カウンターを表示して途中離脱を防止。各項目の金額差（通常料金 vs 学生料金）を赤字で強調。',
      hitReason: '「無料・半額」という直接的な金銭的メリットと、見返すための保存率の高さ。',
    };
  }

  // 4. PC・ショートカット
  if (text.includes('ショートカット') || text.includes('windows') || text.includes('mac') || text.includes('パソコン')) {
    return {
      title: '💻 【PC作業神技】大学生が全員覚えるべきWindows/Macショートカット神5選',
      hook: '「マウス動かす時間、全部無駄です。これ覚えたらPC作業が3倍速くなります」',
      conceptSummary: '画面分割、クリップボード履歴、タブ一発復元など授業・レポートで毎日使う神コマンド。',
      studentAppeal: 'パソコン操作が劇的に早くなり、授業のメモ取りや課題作成のプチストレスが消滅。',
      templateKey: 'shortcut_hack',
      templateLabel: TEMPLATE_MAP.shortcut_hack,
      studentCategory: 'ai_pc_hack',
      studentCategoryLabel: CATEGORY_MAP.ai_pc_hack,
      actionableArrangement: '自社プロダクトの裏技コマンドや操作時短テクを画面録画でテンポよく実演。',
      timelineOutline: '【0〜2秒】「マウス動かす時間、全部無駄です」と挑戦的フック\n→ 【3〜8秒】Win+V（クリップボード履歴）で何度もコピペできる神機能\n→ 【9〜16秒】Win+矢印（画面分割）で講義動画とメモを並べる実演\n→ 【17〜24秒】「この5つ覚えるだけで授業が劇的に楽になるよ」と保存誘導',
      selfHook: '「まだマウスでカチカチやってる？このショートカットで作業効率3倍になります」',
      selfScriptOutline: '【0〜2秒】マウス操作の遅さをコミカルに指摘\n→ 【3〜10秒】キーボード操作だけで瞬時に画面が切り替わる爽快実演\n→ 【11〜18秒】日常のよくあるユースケースでの活用例\n→ 【19〜24秒】「後で見返せるように保存してね」と保存推奨',
      filmingTips: 'キーボードを叩く手元と、画面が一瞬で切り替わるPC画面をピクチャーインピクチャーで同時表示。',
      hitReason: '操作の「爽快感」と、一度覚えたら一生役立つ実益性の高さ。',
    };
  }

  // 5. 就活面接 / 逆質問 / 敬語
  if (text.includes('面接') || text.includes('逆質問') || text.includes('就活') || text.includes('バイト敬語')) {
    return {
      title: '👔 【就活面接】『最後に質問はありますか？』と言われたときの神逆質問3選',
      hook: '「面接の逆質問で『特にありません』は即不合格。これ聞けば一発で意欲が伝わります」',
      conceptSummary: '意欲と事前リサーチ力をアピールできる具体的な逆質問テンプレートと、避けるべきNG質問。',
      studentAppeal: 'インターン選考や本選考の面接で面接官の記憶に残る実践的なトーク術。',
      templateKey: 'best_list',
      templateLabel: TEMPLATE_MAP.best_list,
      studentCategory: 'career_manner',
      studentCategoryLabel: CATEGORY_MAP.career_manner,
      actionableArrangement: '業界や採用で実際に評価されるポイントを「面接官の本音」として解説。',
      timelineOutline: '【0〜2秒】「面接の逆質問で『特にありません』は即落ちです」と警告\n→ 【3〜8秒】質問①：入社後を想定した業務の解像度を上げる逆質問\n→ 【9〜16秒】質問②＆③：面接官自身のキャリアや成功体験を聞く質問\n→ 【17〜24秒】「面接直前に見返せるよう保存しておいて！」と保存誘導',
      selfHook: '「面接官が『おっ、この子デキるな』と思う質問、実はこの3つです」',
      selfScriptOutline: '【0〜2秒】面接官のリアルな心理・合否の分かれ目を提示\n→ 【3〜9秒】具体的な質問フレーズをテロップで明示\n→ 【10〜17秒】なぜこの質問が刺さるのか評価ポイントを解説\n→ 【18〜24秒】「本番前に復習できるよう保存推奨」とコールトゥアクション',
      filmingTips: 'スーツまたはオフィスカジュアルで面接官役と学生役の1人2役コント形式。テロップにそのまま使えるセリフを完全表示。',
      hitReason: '面接直前の学生の強烈な不安を解消し、そのまま使えるセリフ集としての保存率が異常に高い。',
    };
  }

  // 6. 扶養 / 103万 / バイト代
  if (text.includes('103万') || text.includes('扶養') || text.includes('バイト代') || text.includes('税金')) {
    return {
      title: '💸 【バイトの壁】103万・130万を超えると親にガチで怒られる『扶養のリアル』',
      hook: '「バイト代稼ぎすぎて親に怒られた大学生、全員これ知らなかったらしい…」',
      conceptSummary: '税金・社会保険の仕組みと、親の税負担が増えてしまう金額のボーダーラインを分かりやすく図解。',
      studentAppeal: 'バイトに熱中する大学生が知っておくべき、後で後悔しないためのお金の基礎知識。',
      templateKey: 'failure_first',
      templateLabel: TEMPLATE_MAP.failure_first,
      studentCategory: 'student_life',
      studentCategoryLabel: CATEGORY_MAP.student_life,
      actionableArrangement: 'ユーザーが陥りがちな制度や仕組みの盲点を「失敗回避」の文脈で提示。',
      timelineOutline: '【0〜2秒】「バイト代稼ぎすぎて親に怒られた大学生の末路…」と衝撃フック\n→ 【3〜8秒】103万超えると本人の税金＋親の税金が数万円増える仕組みを図解\n→ 【9〜16秒】130万超えると社会保険自分で払うことになり手取り激減\n→ 【17〜24秒】「年末に焦らないよう今すぐ月収計算して保存してね」と誘導',
      selfHook: '「これ知らずに契約すると後で大損します。〇〇の落とし穴」',
      selfScriptOutline: '【0〜2秒】知らずに損しているお金・制度の壁を提示\n→ 【3〜9秒】具体的にいくら損するのか金額を明示\n→ 【10〜17秒】回避するための正しい対処ステップ\n→ 【18〜24秒】「計算ツールはプロフリンクから」と誘導',
      filmingTips: 'ホワイトボードやiPadの手書き図解で「103万」「130万」の数字を大きく書く。お金が減る演出でアラート感を出す。',
      hitReason: '親とのトラブルや税金負担というリアルな痛みを突くことで、完全視聴とシェアを促す。',
    };
  }

  // 7. テスト勉強 / 一夜漬け / 暗記法
  if (text.includes('テスト') || text.includes('一夜漬け') || text.includes('暗記') || text.includes('勉強法')) {
    return {
      title: '📚 【試験対策】テスト前夜の一夜漬けで80点取るための『過去問逆算暗記法』',
      hook: '「テスト前日に教科書1ページ目から読んでる人、今すぐやめて！それ落ちます」',
      conceptSummary: '出題頻度の高い過去問とレジュメの太字から逆算して最短で合格ラインに達する暗記ステップ。',
      studentAppeal: '単位を落とせない絶体絶命のテスト期間を乗り切る現実的な勉強テクニック。',
      templateKey: 'how_to',
      templateLabel: TEMPLATE_MAP.how_to,
      studentCategory: 'study_report',
      studentCategoryLabel: CATEGORY_MAP.study_report,
      actionableArrangement: '最短で結果を出すステップを「NG行動の指摘 → 正しい順序の実演」で構成。',
      timelineOutline: '【0〜2秒】「テスト前日に教科書読んでる人、落ちます」とNG行動を否定\n→ 【3〜8秒】ステップ①：まず過去問を解かずに答えを赤ペンで書き込む\n→ 【9〜16秒】ステップ②＆③：出題されている用語だけを逆算して暗記する\n→ 【17〜24秒】「これで単位拾えるから今夜すぐ試して保存して！」と誘導',
      selfHook: '「まだ普通に勉強してるの？最短で結果を出す逆算ステップがこれ」',
      selfScriptOutline: '【0〜2秒】非効率な従来の方法を否定\n→ 【3〜9秒】最短最速のステップ①を具体的に実演\n→ 【10〜17秒】結果を出すための重要ポイントの解説\n→ 【18〜24秒】「テスト期間中に見返せるよう保存推奨」',
      filmingTips: '机の上に過去問やテキストを広げた主観視点（POV）カメラ。赤ペンの動きや付箋をテンポよく映す。',
      hitReason: '「単位を落としたくない」という学生の緊急性の高いニーズに即答し、ブックマーク（保存）が爆発。',
    };
  }

  // 8. iPhone / スキャン / PDF / スマホ裏技
  if (text.includes('iphone') || text.includes('スキャン') || text.includes('スマホ') || text.includes('裏技')) {
    return {
      title: '📱 【スマホ裏技】iPhoneのメモ機能でプリントを一瞬で歪みなしPDF化する神技',
      hook: '「大学のプリント、わざわざコンビニでスキャンしてない？iPhoneで1秒でできるよ」',
      conceptSummary: '標準メモアプリの書類スキャン機能を使った歪み補正・文字検索可能PDFの作成手順。',
      studentAppeal: 'プリント紛失を防ぎ、iPadやPCとの共有も一瞬で完結する必須スマホテク。',
      templateKey: 'shortcut_hack',
      templateLabel: TEMPLATE_MAP.shortcut_hack,
      studentCategory: 'ai_pc_hack',
      studentCategoryLabel: CATEGORY_MAP.ai_pc_hack,
      actionableArrangement: '日常の身近なツールの隠れた神機能を「意外性フック」で紹介。',
      timelineOutline: '【0〜2秒】「大学のプリント、わざわざコンビニ行ってない？」と問いかけ\n→ 【3〜8秒】メモアプリ起動 → カメラアイコン → 「書類をスキャン」をタップ\n→ 【9〜16秒】斜めから撮っても自動でまっすぐ補正される神実演\n→ 【17〜24秒】「AirDropでiPadやPCに送ればレポート完成！保存して試してね」',
      selfHook: '「実はiPhoneのこの機能、9割の人が使ってない神機能です」',
      selfScriptOutline: '【0〜2秒】身近な標準アプリの隠れた便利技を宣言\n→ 【3〜9秒】画面操作のタップ箇所をわかりやすく拡大実演\n→ 【10〜17秒】一瞬で悩み（歪み・PDF化）が解決するシーン\n→ 【18〜24秒】「忘れないうちに保存しておいてね」',
      filmingTips: 'iPhoneの画面操作を画面録画で高画質に収録。タップする指の動きやフォーカスを効果音とともに見せる。',
      hitReason: '専用アプリを入れずに標準アプリだけで解決できる手軽さと、圧倒的な便利さ。',
    };
  }

  // 9. 無印良品 / ダイソー / ガジェット / 文具
  if (text.includes('無印') || text.includes('ダイソー') || text.includes('ガジェット') || text.includes('文房具')) {
    return {
      title: '🖊️ 【神アイテム】無印良品で大学生がガチで買ってよかった勉強効率化文具3選',
      hook: '「無印のこの3つ、大学生全員カバンに入れておいた方がいいレベルで勉強捗る…」',
      conceptSummary: '裏写りしないノート、疲れにくいペン、暗記シート対応チェックペン等の実力派文具紹介。',
      studentAppeal: '数百円で買えて日々の勉強のプチストレスが消えるコスパ最強アイテム。',
      templateKey: 'best_list',
      templateLabel: TEMPLATE_MAP.best_list,
      studentCategory: 'gadget_tool',
      studentCategoryLabel: CATEGORY_MAP.gadget_tool,
      actionableArrangement: '自社おすすめアイテムを「ランキング・BEST3」形式でメリット比較。',
      timelineOutline: '【0〜2秒】「無印のこれ、大学生全員カバンに入れるべき」と宣言\n→ 【3〜8秒】第1位：裏写りしないノート（蛍光ペンでも透けない実演）\n→ 【9〜16秒】第2位＆第3位：長時間書いても手が痛くならないペン＆ペンケース\n→ 【17〜24秒】「全部500円以下で買えるから保存して無印行って！」と誘導',
      selfHook: '「〇〇で買える、生活が激変した神アイテムBEST3」',
      selfScriptOutline: '【0〜2秒】店舗名と買ってよかったアイテムの総数を提示\n→ 【3〜9秒】第1位の特徴と使い勝手をアップで実演\n→ 【10〜17秒】第2位・第3位のコスパの良さを比較\n→ 【18〜24秒】「買い物の前に見返せるよう保存推奨」',
      filmingTips: '自然光でのアイテム接写。文房具の書き味やノートの質感を音（ASMR）とともに伝える。',
      hitReason: '低価格で気軽に買える店舗（無印・100均）のリアルなおすすめ情報による購買意欲の刺激。',
    };
  }

  // 10. 時短飯 / レシピ
  if (text.includes('レシピ') || text.includes('時短飯') || text.includes('料理') || text.includes('ズボラ')) {
    return {
      title: '🍳 【悪魔の時短飯】フライパン1つで5分！一人暮らし大学生のズボラ自炊飯',
      hook: '「自炊面倒な大学生、これだけ作れるようにしといて。外食行く気なくなるから」',
      conceptSummary: '包丁を使わず、安い調味料と肉だけで爆速でできる高コスパ満腹飯。',
      studentAppeal: '食費を抑えたい一人暮らし学生の胃袋を掴む手軽さとシズル感。',
      templateKey: 'recipe',
      templateLabel: TEMPLATE_MAP.recipe,
      studentCategory: 'student_life',
      studentCategoryLabel: CATEGORY_MAP.student_life,
      actionableArrangement: '完成形のシズル感から入り、極小のステップで完成する手軽さを強調。',
      timelineOutline: '【0〜2秒】完成した湯気立つズボラ飯のドアップで食欲直撃\n→ 【3〜8秒】フライパンに具材とタレを放り込んで強火で炒める音（ASMR）\n→ 【9〜16秒】卵黄をとろりと乗せて完成する至福の瞬間\n→ 【17〜24秒】「材料と分量はコメント欄に書いたよ！保存して作ってね」',
      selfHook: '「自炊サボりたい日の最強ズボラ飯がこれです」',
      selfScriptOutline: '【0〜2秒】完成品のシズル感で食欲を刺激\n→ 【3〜9秒】極限まで工程を省いた調理プロセスをテンポよく見せる\n→ 【10〜17秒】美味しそうに食べるリアクション\n→ 【18〜24秒】「レシピ保存しておいてね」',
      filmingTips: '照明は暖色系。ジュージューという調理音をマイクでしっかり拾い、完成品はスローモーションで魅せる。',
      hitReason: '「安くて早くて美味い」という一人暮らしの普遍的欲求と、食欲を刺激する映像力。',
    };
  }

  // 11. 美容 / コスメ / ビフォーアフター
  if (text.includes('コスメ') || text.includes('メイク') || text.includes('美容') || text.includes('垢抜け')) {
    return {
      title: '💄 【垢抜けメイク】ドラッグストアで買える！学生向けプチプラ劇的変身術',
      hook: '「高いデパコス買う前にこれ試して。1000円以下で顔の印象ガラッと変わる」',
      conceptSummary: 'ドラッグストアで手に入るプチプラコスメだけで、肌馴染みと目元の印象を激変させるテクニック。',
      studentAppeal: 'バイト代を節約しながら自然に垢抜けて印象を良くしたい学生に直撃。',
      templateKey: 'before_after',
      templateLabel: TEMPLATE_MAP.before_after,
      studentCategory: 'student_life',
      studentCategoryLabel: CATEGORY_MAP.student_life,
      actionableArrangement: 'ビフォーアフターの対比を冒頭で見せて、プチプラ手軽さで保存を促す。',
      timelineOutline: '【0〜2秒】すっぴん・NGメイクと劇的垢抜け後の半顔比較を冒頭で提示\n→ 【3〜8秒】ドラッグストアで買える1000円以下の神名品を紹介\n→ 【9〜16秒】ブラシの動かし方・塗り方のコツをわかりやすく実演\n→ 【17〜24秒】「品番と色番は画面に載せたよ！ドラッグストアで見返すために保存して」',
      selfHook: '「デパコス不要！1000円以下で劇的ビフォーアフターする神名品」',
      selfScriptOutline: '【0〜2秒】ビフォーとアフターの劇的な差を並べて提示\n→ 【3〜9秒】使っているプチプラアイテムの紹介\n→ 【10〜17秒】プロが教える塗り方のワンポイントテクニック\n→ 【18〜24秒】「買い物リスト用に保存推奨」',
      filmingTips: '自然光での肌の質感撮影。ビフォーとアフターの明るさや画角を統一して信頼性を高める。',
      hitReason: '変身願望と、手軽に真似できるプチプラ価格設定による高い共感と保存率。',
    };
  }

  // 12. ルーティン / Vlog
  if (text.includes('ルーティン') || text.includes('vlog') || text.includes('一人暮らし')) {
    return {
      title: '🌿 【大学生ルーティン】テスト前日のリアルな1日・勉強と自炊の密着Vlog',
      hook: '「テスト前日の大学生って実際どんなスケジュールで過ごしてる？リアル見せます」',
      conceptSummary: '朝起きてから深夜までの勉強時間、息抜きのズボラ飯、集中を保つ工夫の時系列ドキュメント。',
      studentAppeal: '同じ境遇の学生としての親近感・共感と、モチベーション向上。',
      templateKey: 'routine',
      templateLabel: TEMPLATE_MAP.routine,
      studentCategory: 'study_report',
      studentCategoryLabel: CATEGORY_MAP.study_report,
      actionableArrangement: '日々のリアルな作業風景に、さりげなく自社アイテムやサービスを溶け込ませる。',
      timelineOutline: '【0〜3秒】心地よい朝の生活音とともに、リアルなモーニングルーティンからスタート\n→ 【4〜12秒】講義の受講、図書館での勉強風景、息抜きのズボラ飯\n→ 【13〜20秒】集中を保つ便利グッズやタイムラプス勉強の実演\n→ 【21〜26秒】「今日も一日お疲れ様でした！みんなも勉強頑張ろうね」',
      selfHook: '「リアルな作業風景をお届け。大学生の一日ルーティン」',
      selfScriptOutline: '【0〜3秒】落ち着いた環境音と導入シーン\n→ 【4〜12秒】時間経過とともに作業が進む様子をテンポよくカット割り\n→ 【13〜20秒】愛用アイテムやツールの自然な紹介\n→ 【21〜26秒】穏やかなエンディングと共感のメッセージ',
      filmingTips: 'Lo-Fi Hip Hopなどの心地よいBGMと、生活音（タイピング、ペンの音）の強調。定点カメラでの自然な撮影。',
      hitReason: '「憧れの生活感」と「リアルな共感」のバランスが良く、作業用・リピート視聴を促す。',
    };
  }

  // 13. 日常あるある（学生・学校）
  if (text.includes('あるある') || text.includes('コント') || text.includes('講義') || text.includes('単位')) {
    return {
      title: '🎭 【大学生あるある】講義中に一度はやらかすリアルシチュエーション5選',
      hook: '「大学生、絶対に1回はやったことある説！当てはまったらコメントして」',
      conceptSummary: '講義中の寝落ち、出席代返の緊張感、単位計算の焦りなどリアルな学生生活の共感コント。',
      studentAppeal: '友達同士でシェアしたくなる圧倒的な共感性と笑い。',
      templateKey: 'aruaru',
      templateLabel: TEMPLATE_MAP.aruaru,
      studentCategory: 'entertainment',
      studentCategoryLabel: CATEGORY_MAP.entertainment,
      actionableArrangement: 'ターゲット層の日常の「あるある」をコミカルに再現して親近感を醸成。',
      timelineOutline: '【0〜3秒】誰もが「わかる！」となる講義中の寝落ちシーンから無言でスタート\n→ 【3〜12秒】教授の足音にビクッとするリアクションで共感を加速\n→ 【13〜19秒】友達の冷静なツッコミとオチ\n→ 【20〜25秒】「みんなはどれ当てはまった？コメントで教えて！」とコメント誘導',
      selfHook: '「〇〇な人、絶対にこれやってる説！共感したらいいねして」',
      selfScriptOutline: '【0〜3秒】共感度の高いあるあるシチュエーションの提示\n→ 【3〜12秒】徐々にエスカレートするコミカルな実演\n→ 【13〜19秒】予想外のオチ・ツッコミ\n→ 【20〜25秒】「みんなの経験もコメントで教えて！」',
      filmingTips: 'カメラ目線での早口・テンポ重視。BGMは軽快な日常系音源。テロップは太字ゴシックで画面下部に大きく配置。',
      hitReason: '共感性の高いシチュエーション設定と、コメント欄へ意見を書きたくなる余白が拡散を生む。',
    };
  }

  // Default fallback
  const cleanLine = cap.replace(/#[^\s]+/g, '').replace(/@[^\s]+/g, '').trim().split('\n')[0];
  const shortTitle = cleanLine && cleanLine.length > 5 ? cleanLine.slice(0, 45) : '日常で思わず共感するショート動画';

  return {
    title: `🎬 ${shortTitle}`,
    hook: `「これ知らないと損する！今すぐ試してみて」`,
    conceptSummary: cap ? cap.slice(0, 100) : '実践的な知識・ノウハウを簡潔に伝達するショート構成。',
    studentAppeal: '日々の生活や課題、就活ですぐに役立つ高い実益性。',
    templateKey: 'failure_first',
    templateLabel: TEMPLATE_MAP.failure_first,
    studentCategory: 'student_life',
    studentCategoryLabel: CATEGORY_MAP.student_life,
    actionableArrangement: '日常の課題を先出しし、自社ノウハウで解決する構成。',
    timelineOutline: '【0〜2秒】日常の課題・疑問の提示\n→ 【3〜8秒】なぜそれが問題なのか理由解説\n→ 【9〜18秒】具体的な解決策・ノウハウの実演\n→ 【19〜25秒】まとめと保存誘導',
    selfHook: '「実はこれ知ってた？今すぐ確認して！」',
    selfScriptOutline: '【0〜2秒】課題の提示\n→ 【3〜9秒】具体的な解決策の実演\n→ 【10〜17秒】成果の提示\n→ 【18〜24秒】保存推奨',
    filmingTips: '簡潔でテンポの良いカット割りと見やすい太字テロップ。',
    hitReason: '明確なテーマ設定と無駄のないテンポ感が完全視聴を維持。',
  };
}
