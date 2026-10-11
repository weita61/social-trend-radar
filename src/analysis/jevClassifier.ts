export type BrandProfile = {
  id?: string;
  name: string;
  targetAudience: string;
  missionGoal: string;
  valueProposition: string;
  toneAndManner: string;
};

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  id: 'fit_student_org',
  name: '学生団体（新歓・イベント動員）',
  targetAudience: '大学1〜2年生（新しい挑戦、サークル・団体、仲間を探している学生）',
  missionGoal: '新歓・メンバー応募の獲得、イベント参加者の動員、団体の認知向上',
  valueProposition: '実践的な活動経験・ビジネススキル、刺激し合える同世代の仲間コミュニティ',
  toneAndManner: '親しみやすい先輩目線、説教くさくなくリアルな学生目線で共感を誘う',
};

export type JevAnalysisResult = {
  theme: string;
  hookIdea: string;
  scriptOutline: string;
  viewerPsychology: string;
  recommendedDuration: string;
  hitReason: string;
  source: 'ai' | 'template';
  adaptationTheme: string;
  filmingTips: string;
};

export class JevClassifier {
  private readonly apiKey: string | null;
  private monthlyTokensUsed = 0;
  private readonly monthlyTokenLimit: number;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ?? process.env.JEV_API_KEY ?? process.env.AI_API_KEY ?? null;
    this.monthlyTokenLimit = Number.parseInt(process.env.JEV_MONTHLY_TOKEN_LIMIT ?? '1000000', 10);
  }

  isAvailable(): boolean {
    return this.apiKey !== null && this.monthlyTokensUsed < this.monthlyTokenLimit;
  }

  async generateMarketingBlueprint(input: {
    caption: string;
    creator: string;
    platform: string;
    genre: string;
    brandProfile?: BrandProfile;
  }): Promise<JevAnalysisResult> {
    const profile = input.brandProfile ?? DEFAULT_BRAND_PROFILE;
    if (this.isAvailable() && this.apiKey) {
      try {
        const prompt = `あなたはSNSショート動画（TikTok/YouTube Shorts/Instagram Reels）のトップマーケターです。
以下のバズ動画を分析し、【発信アカウント情報】の組織が「自分たちのアカウントで明日そのまま撮影・投稿できる具体的な台本・撮影レシピ」を作成してください。

【発信アカウント情報（コンセプト・目的）】
・組織・アカウント名: ${profile.name}
・メインターゲット: ${profile.targetAudience}
・発信目的・ゴール (KPI): ${profile.missionGoal}
・提供価値・強み: ${profile.valueProposition}
・トーン＆マナー: ${profile.toneAndManner}

【対象動画】
投稿者: ${input.creator || '人気クリエイター'}
媒体: ${input.platform}
ジャンル: ${input.genre}
キャプション: ${input.caption}

【出力形式】
以下のJSONキーのみを出力してください（Markdown装飾なしの純粋なJSON）。
{
  "theme": "動画の企画テーマ（例: 🎭 あるある日常共感型）",
  "adaptationTheme": "【${profile.name}での応用コンセプト】ターゲット（${profile.targetAudience}）に刺さる具体的な切り口・テーマ",
  "hookIdea": "冒頭1〜2秒でターゲットを惹きつける具体的なキラーワード・テロップ案",
  "scriptOutline": "秒数付きの起承転結台本構成（自社の提供価値・ゴール「${profile.missionGoal}」に結びつけるセリフ案）",
  "filmingTips": "撮影・演出のポイント（画角・テロップ・トーン: ${profile.toneAndManner}）",
  "viewerPsychology": "なぜターゲットがスクロールを止めて最後まで見ちゃうのかの心理動機",
  "recommendedDuration": "推奨される動画尺（例: 20〜25秒）",
  "hitReason": "なぜこの動画が伸びているかのマーケティング的ヒット要因"
}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        });

        if (res.ok) {
          const data = await res.json() as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            usageMetadata?: { totalTokenCount?: number };
          };
          if (data.usageMetadata?.totalTokenCount) {
            this.monthlyTokensUsed += data.usageMetadata.totalTokenCount;
          }
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text) as JevAnalysisResult;
            return {
              ...parsed,
              source: 'ai',
            };
          }
        }
      } catch (err) {
        console.warn('Jev AI API call failed, falling back to local blueprint:', err);
      }
    }

    return this.fallbackBlueprint(input);
  }

  generateMarketingBlueprintSync(input: {
    caption: string;
    genre: string;
    label?: string;
    brandProfile?: BrandProfile;
  }): JevAnalysisResult {
    return this.fallbackBlueprint(input);
  }

  private fallbackBlueprint(input: { caption: string; genre: string; label?: string }): JevAnalysisResult {
    const rawLabel = (input.label ?? '').replace(/^(format|surface|desire):/, '').toLowerCase();
    const text = (input.caption + ' ' + rawLabel).toLowerCase();

    // 0. 日常あるある型
    if (rawLabel === 'aruaru' || (!rawLabel && (text.includes('あるある') || text.includes('コント')))) {
      return {
        theme: '🎭 【日常あるある型】共感とシェアで伸ばす学生あるある構成',
        adaptationTheme: '💡 自社応用: 「大学生や若手が講義中やバイト、人間関係でついやっちゃう癖や理不尽」をコミカルに再現',
        hookIdea: '「大学生、絶対に1回はやったことある説」「〇〇な人しか共感できないあるある」',
        scriptOutline: '【0〜3秒】誰もが「わかる！」となる強烈なあるあるシーン（講義中の寝落ち、単位計算など）から一言でスタート\n→ 【3〜12秒】徐々にエスカレートし、焦るリアクションや共感を加速\n→ 【13〜19秒】秀逸なオチや、友人の冷静なツッコミが入る\n→ 【20〜25秒】「みんなはどれ当てはまった？コメントで教えて！」とコメント欄へ誘導',
        filmingTips: '🎥 演出: カメラ目線での早口・テンポ重視。BGMは軽快な日常系音源。テロップは太字ゴシックで画面中央下部に大きく配置。',
        viewerPsychology: '共感と笑い。「友達に送りたい」「あるある！とコメントで言いたい」という共有・参加欲求。',
        recommendedDuration: '18〜24秒（テンポと表情重視）',
        hitReason: '共感性の高いシチュエーション設定と、コメント欄へ意見を書きたくなる余白が拡散を生んでいます。',
        source: 'template',
      };
    }

    // 1. 失敗先出し・損失回避型（usutaku・ビジネス英語・バイト敬語・扶養の壁など）
    if (rawLabel === 'failure_first' || text.includes('failure_first') || text.includes('失敗') || text.includes('ミス') || text.includes('メールの書き出し') || text.includes('敬語') || text.includes('103万') || text.includes('扶養')) {
      return {
        theme: '⚠️ 【失敗先出し型】「9割が損してる」損失回避フック構成',
        adaptationTheme: '💡 自社応用: 「学生や若手が知らず知らずのうちに損している盲点・やってはいけないNGマナー」を切り口に自社ノウハウを提示',
        hookIdea: '「英語メール、まだDearで送ってない？実は…」「バイトでこれ言ってたら即注意されるNG敬語」「実はこれ、9割の大学生が損してます」',
        scriptOutline: '【0〜2秒】衝撃的な損失・やってはいけないNGパターンの提示（警告音・赤テロップ）\n→ 【3〜8秒】なぜダメなのか？理由を簡潔に1文で論理解説\n→ 【9〜18秒】今すぐ使える正しい正解フレーズ・解決策を実演（Hi XX-sanなど）\n→ 【19〜25秒】「あとで見返せるよう保存しておいてね」と保存推奨',
        filmingTips: '🎥 演出: 冒頭の「NG」「大損」テロップは太字・高コントラスト。不要な前置きを排除し、0秒から本題の結論に入る。',
        viewerPsychology: '損失回避。「恥をかきたくない・自分だけ損したくない」という強い焦燥感。',
        recommendedDuration: '22〜28秒（文字テロップを太く短く）',
        hitReason: 'ネガティブフック（損失回避）で冒頭の離脱率を極限まで下げ、実践ハードルを下げて保存させています。',
        source: 'template',
      };
    }

    // 2. 裏技・神時短型（ChatGPT・PCショートカット・iPhoneスキャン・Gammaなど）
    if (rawLabel === 'shortcut_hack' || text.includes('shortcut') || text.includes('ショートカット') || text.includes('プロンプト') || text.includes('chatgpt') || text.includes('スキャン') || text.includes('裏技')) {
      return {
        theme: '⚡ 【裏技・神時短型】作業効率を劇的改善するツール・操作構成',
        adaptationTheme: '💡 自社応用: 「自社ツールや身近なアプリを使って、日々の課題・レポート・作業時間が劇的に短縮される裏技」として実演',
        hookIdea: '「レポートまだ一から自力で書いてる？このプロンプト知れば一瞬で終わるのに…」「マウス動かす時間、全部無駄です」',
        scriptOutline: '【0〜2秒】日常の非効率な作業シーン提示（「まだこれ手作業でやってる？」）\n→ 【3〜8秒】神機能・神プロンプトの画面操作を一瞬で実演\n→ 【9〜18秒】出力された劇的な成果物（目次完成、PDF化など）を見せて驚きを与える\n→ 【19〜25秒】詳しいプロンプトやコマンドをコメント欄または保存誘導',
        filmingTips: '🎥 演出: 画面録画と操作手元のアップ。1.2倍速の小気味よいテンポと効果音で「爽快感」を演出。',
        viewerPsychology: '時短と効率化。「楽して高い成果を出したい」「知って得したい」。',
        recommendedDuration: '18〜25秒（爽快なスピード感）',
        hitReason: '一目でわかる時間短縮のインパクトと、後で見返して設定するための保存欲求を直撃。',
        source: 'template',
      };
    }

    // 3. まとめ・BEST型（学割5選・面接逆質問3選・無印文具3選・サブスクなど）
    if (rawLabel === 'list' || text.includes('list') || text.includes('選') || text.includes('まとめ') || text.includes('ランキング') || text.includes('学割') || text.includes('逆質問')) {
      return {
        theme: '🏆 【まとめ・BEST型】保存・見返しを促すリスト構成',
        adaptationTheme: '💡 自社応用: 「学生やターゲットが知っておくべき必須アイテム・特典・質問」を厳選リストとして提示',
        hookIdea: '「知らないと年間10万損する！学生証見せるだけでタダになる神施設5選」「面接の逆質問でこれ聞けば一発で好印象残せる3選」',
        scriptOutline: '【0〜2秒】全体のインパクトあるまとめテーマを宣言（「これ知らないとガチで大損」）\n→ 【3〜8秒】第1位〜第2位をテンポよく紹介\n→ 【9〜16秒】意外性の高い第3位・第4位を紹介\n→ 【17〜24秒】「1番ヤバい最後の1つは…」と最後まで惹きつけ、保存を促す',
        filmingTips: '🎥 演出: 各項目ごとに数字カウントダウン（①〜⑤）。画面上部に進捗ゲージを表示して途中離脱を防ぐ。',
        viewerPsychology: '網羅性とストック欲求。「全部知っておきたい」「後で選ぶときに見返したい」。',
        recommendedDuration: '25〜35秒（テンポよく情報量を詰め込む）',
        hitReason: '圧倒的な情報密度による「お得感」と、見返さざるを得ないリスト形式による保存率の最大化。',
        source: 'template',
      };
    }

    // 4. 手順解説型（テスト一夜漬け過去問逆算・単語帳暗記・ES自己PRなど）
    if (rawLabel === 'how_to' || text.includes('how_to') || text.includes('手順') || text.includes('方法') || text.includes('テスト') || text.includes('暗記')) {
      return {
        theme: '📚 【手順解説型】保存率特化のHow-to構成',
        adaptationTheme: '💡 自社応用: 「誰でも真似できる明確な3ステップ・攻略手順」としてノウハウを体系化',
        hookIdea: '「テスト前夜に教科書1ページ目から読んでる人、それ落ちます。正しい一夜漬けはこれ」',
        scriptOutline: '【0〜2秒】やりがちな間違ったやり方を否定（「これやってたら逆効果」）\n→ 【3〜9秒】ステップ①：まずやるべき初動アクション\n→ 【10〜17秒】ステップ②＆③：結果を出すための核心テクニック\n→ 【18〜24秒】まとめテロップと復習のための保存誘導',
        filmingTips: '🎥 演出: ステップ番号（Step 1, Step 2）を大きく表示。抽象論を語らず、具体的な手元の動きや文字を見せる。',
        viewerPsychology: '自己向上と確実性。「失敗せずに結果を出したい」「再現性のある方法を知りたい」。',
        recommendedDuration: '20〜28秒（論理的でわかりやすい構成）',
        hitReason: '明確なステップ化によって「自分にもできそう」と思わせ、学習用としての保存を促進。',
        source: 'template',
      };
    }

    // 5. 料理・悪魔の時短飯型
    if (rawLabel === 'gourmet_recipe' || input.genre.includes('料理') || text.includes('レシピ') || text.includes('飯') || text.includes('gourmet')) {
      return {
        theme: '🍳 【悪魔の時短飯型】シズル感先行・手軽さで保存させる構成',
        adaptationTheme: '💡 自社応用: 「少ない調味料・材料・手間で、見た目と音が圧倒的においしそうなレシピ」として展開',
        hookIdea: '「フライパン1つで5分！もう外食行けなくなる悪魔の〇〇」「これ知ったらもう普通に戻れない」',
        scriptOutline: '【0〜2秒】完成品の湯気・シズル感ドアップ（食欲を直撃）\n→ 【3〜9秒】包丁音やジュウジュウ調理音とともに意外な隠し味・時短技を投入\n→ 【10〜18秒】失敗しないワンポイント実演・盛り付け\n→ 【19〜25秒】一口食べて感動のリアクション・材料一覧テロップと保存誘導',
        filmingTips: '🎥 演出: 調理音（ASMR）をマイクでしっかり拾う。照明は暖色系で料理のツヤを強調。手元の動きは1.2倍速のテンポ感で編集。',
        viewerPsychology: '即時満足と食欲。「今すぐ作れる手軽さ」「自分にもできそう」という安心感と保存欲求。',
        recommendedDuration: '20〜25秒（包丁やジュウジュウという音を強調）',
        hitReason: '完成形を先に見せることでスクロールを止め、手軽さと意外性で完全視聴を維持しています。',
        source: 'template',
      };
    }

    // 6. ガジェット・神アイテム型
    if (rawLabel === 'gadget_review' || input.genre.includes('ガジェット') || text.includes('便利グッズ') || text.includes('無印') || text.includes('ダイソー') || text.includes('文房具')) {
      return {
        theme: '📦 【生活激変ガジェット型】日常プチストレス解消構成',
        adaptationTheme: '💡 自社応用: 「日々のちょっとした面倒くささ・不満を劇的にゼロにするアイテム・機能」として提案',
        hookIdea: '「もっと早く買えばよかった…生活のストレスがゼロになった神アイテム」「無印のこれ、大学生全員持っておいた方がいい」',
        scriptOutline: '【0〜2秒】日常のイラッとする瞬間の再現（散らかり、手間の多さなど）\n→ 【3〜10秒】アイテム登場と、一瞬で解決する爽快シーンの実演\n→ 【11〜18秒】実際に使ってわかったメリット・コスパ・隠れた良さ\n→ 【19〜24秒】どこで買えるか案内・保存誘導',
        filmingTips: '🎥 演出: 解決の瞬間の気持ちいい音を強調。ビフォーとアフターの快適さの落差をはっきり見せる。',
        viewerPsychology: 'QOL向上。「日々のプチストレスを簡単に解消したい」「暮らしをちょっと良くしたい」。',
        recommendedDuration: '20〜25秒（実演テンポ重視）',
        hitReason: '視聴者の潜在的な日常の悩みを可視化し、安価な解決策を提示することで物欲を刺激しています。',
        source: 'template',
      };
    }

    // 7. 美容・劇的変身型
    if (rawLabel === 'before_after' || input.genre.includes('美容') || text.includes('コスメ') || text.includes('メイク') || text.includes('垢抜け')) {
      return {
        theme: '💄 【劇的変身型】ビフォーアフター実演構成',
        adaptationTheme: '💡 自社応用: 「顧客が普段やってしまっているNGメイク・ケアと、劇的な改善法」を比較提示',
        hookIdea: '「これに変えたら肌褒められまくった…ドラッグストアで買える名品」「9割がやってるNG塗り方、今すぐやめて」',
        scriptOutline: '【0〜2秒】よくある悩み・NG塗り方の実演（「これやってない？」と問いかけ）\n→ 【3〜10秒】正しい塗り方のテクニック解説（ブラシの使い方・適量）\n→ 【11〜18秒】塗った後の劇的ビフォーアフター比較（自然光でのツヤ感）\n→ 【19〜24秒】品番・価格・購入場所のまとめテロップ',
        filmingTips: '🎥 演出: 顔のアップは自然光で肌のキメや質感をリアルに見せる。テロップはシンプルかつ洗練されたフォントで高級感を演出。',
        viewerPsychology: '変身願望とコスパ。「安く手軽に可愛くなりたい」「失敗を避けたい」心理に直結。',
        recommendedDuration: '20〜28秒（自然光・アップの質感重視）',
        hitReason: '悩みの共感から入り、プチプラという低ハードルで保存率・シェア率を最大化しています。',
        source: 'template',
      };
    }

    // 8. ルーティン・Vlog型
    if (rawLabel === 'routine' || input.genre.includes('暮らし') || text.includes('ルーティン') || text.includes('vlog') || text.includes('密着')) {
      return {
        theme: '🌿 【ルーティン型】世界観と日常感で引き込むVlog構成',
        adaptationTheme: '💡 自社応用: 「リアルな作業風景・学生の一日・こだわりルーティン」を通じて親近感とブランド世界観を醸成',
        hookIdea: '「テスト前日の大学生って実際どんなスケジュールで過ごしてる？リアル見せます」',
        scriptOutline: '【0〜3秒】心地よい生活音とともに、リアルな日常シーンからスタート\n→ 【4〜12秒】勉強や作業、息抜きのズボラ飯などテンポよいカット割り\n→ 【13〜20秒】集中を保つ工夫や愛用の便利アイテムを紹介\n→ 【21〜26秒】「今日も一日お疲れ様でした」と穏やかなエンディング',
        filmingTips: '🎥 演出: 落ち着いたBGM（Lo-Fi Hip Hopなど）と生活音（環境音）。定点カメラで自然な動きを切り取る。',
        viewerPsychology: '追体験と癒やし。「憧れの暮らしを覗き見したい」「自分もモチベーションを高めたい」。',
        recommendedDuration: '20〜30秒（カット割りテンポ重視）',
        hitReason: '洗練された映像美と共感性の高い生活感のバランスが、リピート視聴とフォローを促進します。',
        source: 'template',
      };
    }

    // 9. 日常あるある型（学生・学校）
    return {
      theme: '🎭 【日常あるある型】共感とシェアで伸ばす学生あるある構成',
      adaptationTheme: '💡 自社応用: 「大学生や若手が講義中やバイト、人間関係でついやっちゃう癖や理不尽」をコミカルに再現',
      hookIdea: '「大学生、絶対に1回はやったことある説」「〇〇な人しか共感できないあるある」',
      scriptOutline: '【0〜3秒】誰もが「わかる！」となる強烈なあるあるシーン（講義中の寝落ち、単位計算など）から一言でスタート\n→ 【3〜12秒】徐々にエスカレートし、焦るリアクションや共感を加速\n→ 【13〜19秒】秀逸なオチや、友人の冷静なツッコミが入る\n→ 【20〜25秒】「みんなはどれ当てはまった？コメントで教えて！」とコメント欄へ誘導',
      filmingTips: '🎥 演出: カメラ目線での早口・テンポ重視。BGMは軽快な日常系音源。テロップは太字ゴシックで画面中央下部に大きく配置。',
      viewerPsychology: '共感と笑い。「友達に送りたい」「あるある！とコメントで言いたい」という共有・参加欲求。',
      recommendedDuration: '18〜24秒（テンポと表情重視）',
      hitReason: '共感性の高いシチュエーション設定と、コメント欄へ意見を書きたくなる余白が拡散を生んでいます。',
      source: 'template',
    };
  }
}
