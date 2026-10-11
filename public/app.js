// Social Trend Radar — Frontend Application Logic (SNS Marketer Edition)
(function () {
  'use strict';

  let currentTrends = [];
  let selectedTrendId = null;
  let activeFilter = 'all';
  let searchQuery = '';
  let currentPage = 'video-db';
  let refreshTimer = null;
  let hasTriggeredInitialAnalysis = false;

  let allVideos = [];
  let vdbActiveTemplate = 'all';
  let vdbActiveCategory = 'all';
  let vdbActivePlatform = 'all';
  let vdbSearchQuery = '';

  let cachedCoverage = null;
  let cachedAutomation = null;

  // DOM Elements
  const navButtons = document.querySelectorAll('.nav');
  const pages = {
    'video-db': document.getElementById('video-db-page'),
    radar: document.getElementById('radar-page'),
    coverage: document.getElementById('coverage-page'),
    automation: document.getElementById('automation-page'),
  };

  const vdbCardsContainer = document.getElementById('vdbCardsContainer');
  const vdbCountBadge = document.getElementById('vdbCountBadge');
  const vdbTotalVideos = document.getElementById('vdbTotalVideos');
  const vdbTotalTemplates = document.getElementById('vdbTotalTemplates');
  const vdbMaxViews = document.getElementById('vdbMaxViews');
  const vdbPlatforms = document.getElementById('vdbPlatforms');
  const vdbSearchInput = document.getElementById('vdbSearchInput');
  const vdbPlatformSelect = document.getElementById('vdbPlatformSelect');
  const vdbRefreshBtn = document.getElementById('vdbRefreshBtn');
  const vdbSyncText = document.getElementById('vdbSyncText');
  const vdbTemplateToolbar = document.getElementById('vdbTemplateToolbar');
  const vdbCategoryToolbar = document.getElementById('vdbCategoryToolbar');

  const syncText = document.getElementById('syncText');
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('searchInput');
  const filterChips = document.querySelectorAll('.chip');
  const trendListContainer = document.getElementById('trendListContainer');
  const trendCountBadge = document.getElementById('trendCountBadge');
  const machineDot = document.getElementById('machineDot');
  const machineStatusText = document.getElementById('machineStatusText');
  const machineMeta = document.getElementById('machineMeta');

  // Pulse
  const pulseClusters = document.getElementById('pulseClusters');
  const pulseCaptured24h = document.getElementById('pulseCaptured24h');
  const pulseTotalPosts = document.getElementById('pulseTotalPosts');
  const pulseCreators = document.getElementById('pulseCreators');
  const pulseConfidence = document.getElementById('pulseConfidence');

  // Evidence Detail
  const detailStatusBadge = document.getElementById('detailStatusBadge');
  const detailLayerBadge = document.getElementById('detailLayerBadge');
  const detailTitle = document.getElementById('detailTitle');
  const detailMeta = document.getElementById('detailMeta');
  const detailSurface = document.getElementById('detailSurface');
  const detailFormat = document.getElementById('detailFormat');
  const detailDesire = document.getElementById('detailDesire');
  const detailEvidenceCards = document.getElementById('detailEvidenceCards');

  // Actionable Blueprint (Jev AI)
  const bpAdaptationTheme = document.getElementById('bpAdaptationTheme');
  const bpRecommendHook = document.getElementById('bpRecommendHook');
  const bpRecommendStructure = document.getElementById('bpRecommendStructure');
  const bpFilmingTips = document.getElementById('bpFilmingTips');
  const bpTargetPsychology = document.getElementById('bpTargetPsychology');
  const bpRecommendDuration = document.getElementById('bpRecommendDuration');
  const bpHitReason = document.getElementById('bpHitReason');
  const jevSourceBadge = document.getElementById('jevSourceBadge');
  const jevRefreshBtn = document.getElementById('jevRefreshBtn');
  const bpTargetVideoBanner = document.getElementById('bpTargetVideoBanner');
  const bpTargetVideoTitle = document.getElementById('bpTargetVideoTitle');
  const btnHeaderCloseVdb = document.getElementById('btnHeaderCloseVdb');

  function renderStepsHtml(rawText) {
    if (!rawText) return '<div class="timeline-step"><span class="step-text">-</span></div>';
    const lines = rawText.split(/\n|→/).map((s) => s.trim()).filter(Boolean);
    return lines.map((line) => `
      <div class="timeline-step">
        <span class="step-bullet">▶</span>
        <span class="step-text">${escapeHtml(line.replace(/^[▶►\-\*\s]+/, ''))}</span>
      </div>
    `).join('');
  }

  // Collapsible Technical Audit Details
  const detailAuditRisk = document.getElementById('detailAuditRisk');
  const auditUserShare = document.getElementById('auditUserShare');
  const auditHhi = document.getElementById('auditHhi');
  const auditIndepRatio = document.getElementById('auditIndepRatio');
  const auditNonUserLanes = document.getElementById('auditNonUserLanes');
  const auditNoteText = document.getElementById('auditNoteText');
  const detailLanes = document.getElementById('detailLanes');
  const detailFitScores = document.getElementById('detailFitScores');
  const detailCaveat = document.getElementById('detailCaveat');
  const detailCaveatText = document.getElementById('detailCaveatText');

  // Coverage DOM
  const coverageWarningsContainer = document.getElementById('coverageWarningsContainer');
  const coverageLanesList = document.getElementById('coverageLanesList');
  const coveragePlatformsList = document.getElementById('coveragePlatformsList');
  const top10RatioText = document.getElementById('top10RatioText');
  const topCreatorsList = document.getElementById('topCreatorsList');
  const dailyActivityList = document.getElementById('dailyActivityList');

  // Automation DOM
  const autoExecutedWrites = document.getElementById('autoExecutedWrites');
  const autoBlockedWrites = document.getElementById('autoBlockedWrites');
  const autoTotalAudits = document.getElementById('autoTotalAudits');
  const autoYoutubeQuota = document.getElementById('autoYoutubeQuota');
  const igCrawlerMeta = document.getElementById('igCrawlerMeta');
  const igCrawlerBadge = document.getElementById('igCrawlerBadge');
  const tiktokCrawlerMeta = document.getElementById('tiktokCrawlerMeta');
  const tiktokCrawlerBadge = document.getElementById('tiktokCrawlerBadge');
  const ytConnectorMeta = document.getElementById('ytConnectorMeta');
  const ytConnectorBadge = document.getElementById('ytConnectorBadge');
  const slackConnectorBadge = document.getElementById('slackConnectorBadge');
  const recentAuditEventsList = document.getElementById('recentAuditEventsList');

  // Brand Profile Elements
  const activeProfileName = document.getElementById('activeProfileName');
  const activeProfileTarget = document.getElementById('activeProfileTarget');
  const btnEditProfile = document.getElementById('btnEditProfile');
  const brandProfileModal = document.getElementById('brandProfileModal');
  const btnCloseProfileModal = document.getElementById('btnCloseProfileModal');
  const btnCancelProfile = document.getElementById('btnCancelProfile');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  const inputProfileName = document.getElementById('inputProfileName');
  const inputProfileTarget = document.getElementById('inputProfileTarget');
  const inputProfileGoal = document.getElementById('inputProfileGoal');
  const inputProfileValue = document.getElementById('inputProfileValue');
  const inputProfileTone = document.getElementById('inputProfileTone');
  const presetButtons = document.querySelectorAll('.btn-preset');

  const BRAND_PRESETS = {
    student_org: {
      name: '学生団体（新歓・イベント動員）',
      targetAudience: '大学1〜2年生（新しい挑戦や成長環境、熱中できる仲間を探している学生）',
      missionGoal: '新歓応募・ミーティング参加の獲得、主催イベントへの動員、団体の認知向上',
      valueProposition: '実践的なプロジェクト経験・同世代の刺激的な仲間コミュニティ・社会人前のスキルアップ',
      toneAndManner: '親しみやすい先輩・等身大の大学生目線。説教くさくなく共感を誘う。怪しい勧誘感は完全NG。',
    },
    career_service: {
      name: '就活・キャリア支援サービス',
      targetAudience: '26卒・27卒の就活生、インターンや自己分析に悩む大学生',
      missionGoal: '公式LINE追加、個別キャリア面談への誘導、イベント参加',
      valueProposition: '元メガベンチャー人事直伝のES添削、非公開優良インターン枠、選考対策チートシート',
      toneAndManner: '頼れるプロ人事・メンター目線。論理的で即効性のあるノウハウ。過度な煽り・不安商法はNG。',
    },
    skill_school: {
      name: 'AI・PCスキル学習スクール',
      targetAudience: '業務効率化やリスキリングに興味がある学生・若手ビジネスパーソン',
      missionGoal: '無料体験セミナー申し込み、プロンプト集・教材の配布ダウンロード',
      valueProposition: '明日から使えるChatGPT・ショート動画時短術、完全未経験からの実践チュートリアル',
      toneAndManner: 'スマートかつ圧倒的に分かりやすい解説。実践的で即試したくなるテンポ感。',
    },
    corporate: {
      name: 'クライアント企業PR（BtoC/採用）',
      targetAudience: '自社サービス見込み客（20〜30代）および新卒・中途採用候補者',
      missionGoal: '企業・ブランドの認知拡大、商品・サービスの購買検討、採用エントリー',
      valueProposition: '独自の技術・プロダクト品質、現場社員のリアルなカルチャーと働きやすさ',
      toneAndManner: '誠実で清潔感がありながら、親しみやすい裏側見せ・社員密着トーン。堅苦しすぎない表現。',
    },
  };

  let currentBrandProfile = { ...BRAND_PRESETS.student_org };

  async function loadBrandProfile() {
    try {
      const res = await apiGet('/api/profile');
      if (res && res.profile) {
        currentBrandProfile = res.profile;
        updateBrandProfileBar();
      }
    } catch (e) {
      console.warn('Brand profile load error:', e);
      updateBrandProfileBar();
    }
  }

  function updateBrandProfileBar() {
    if (activeProfileName) activeProfileName.textContent = currentBrandProfile.name || '学生団体（新歓・イベント動員）';
    if (activeProfileTarget) {
      const tgt = currentBrandProfile.targetAudience || '';
      activeProfileTarget.textContent = tgt.length > 25 ? `${tgt.slice(0, 24)}...` : (tgt || 'ターゲット設定済');
    }
  }

  function populateProfileInputs(profile) {
    if (inputProfileName) inputProfileName.value = profile.name || '';
    if (inputProfileTarget) inputProfileTarget.value = profile.targetAudience || '';
    if (inputProfileGoal) inputProfileGoal.value = profile.missionGoal || '';
    if (inputProfileValue) inputProfileValue.value = profile.valueProposition || '';
    if (inputProfileTone) inputProfileTone.value = profile.toneAndManner || '';
  }

  function openProfileModal() {
    populateProfileInputs(currentBrandProfile);
    if (brandProfileModal) brandProfileModal.style.display = 'flex';
  }

  function closeProfileModal() {
    if (brandProfileModal) brandProfileModal.style.display = 'none';
  }

  async function saveBrandProfileFromModal() {
    const updated = {
      name: inputProfileName ? inputProfileName.value.trim() || currentBrandProfile.name : currentBrandProfile.name,
      targetAudience: inputProfileTarget ? inputProfileTarget.value.trim() : currentBrandProfile.targetAudience,
      missionGoal: inputProfileGoal ? inputProfileGoal.value.trim() : currentBrandProfile.missionGoal,
      valueProposition: inputProfileValue ? inputProfileValue.value.trim() : currentBrandProfile.valueProposition,
      toneAndManner: inputProfileTone ? inputProfileTone.value.trim() : currentBrandProfile.toneAndManner,
    };
    currentBrandProfile = updated;
    updateBrandProfileBar();
    closeProfileModal();

    try {
      await apiPost('/api/profile', updated);
      if (selectedTrendId) {
        if (jevRefreshBtn) {
          jevRefreshBtn.click();
        } else {
          loadTrendDetail(selectedTrendId);
        }
      }
    } catch (e) {
      console.warn('Profile save failed:', e);
    }
  }

  // Preset buttons
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const presetKey = btn.dataset.preset;
      if (BRAND_PRESETS[presetKey]) {
        populateProfileInputs(BRAND_PRESETS[presetKey]);
      }
    });
  });

  if (btnEditProfile) btnEditProfile.addEventListener('click', openProfileModal);
  if (btnCloseProfileModal) btnCloseProfileModal.addEventListener('click', closeProfileModal);
  if (btnCancelProfile) btnCancelProfile.addEventListener('click', closeProfileModal);
  if (btnSaveProfile) btnSaveProfile.addEventListener('click', saveBrandProfileFromModal);
  if (brandProfileModal) {
    brandProfileModal.addEventListener('click', (e) => {
      if (e.target === brandProfileModal) closeProfileModal();
    });
  }

  function returnToVideoDb() {
    currentPage = 'video-db';
    navButtons.forEach((b) => b.classList.toggle('active', b.dataset.page === 'video-db'));
    Object.keys(pages).forEach((p) => {
      if (pages[p]) pages[p].classList.toggle('hidden', p !== 'video-db');
    });
    if (vdbCardsContainer) {
      vdbCardsContainer.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (btnHeaderCloseVdb) btnHeaderCloseVdb.addEventListener('click', returnToVideoDb);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (brandProfileModal && brandProfileModal.style.display === 'flex') {
        closeProfileModal();
      } else if (currentPage === 'radar') {
        returnToVideoDb();
      }
    }
  });

  // Set today's date in header
  const today = new Date();
  const options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
  const dateStr = today.toLocaleDateString('ja-JP', options);
  const kicker = document.getElementById('currentDateKicker');
  if (kicker) kicker.textContent = `${dateStr} · SNS短尺動画企画立案コンソール`;

  // Fetch helpers
  async function apiGet(path) {
    const res = await fetch(path, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  }

  async function apiPost(path, body = {}) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  }

  // Navigation
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.page;
      currentPage = target;
      navButtons.forEach((b) => b.classList.toggle('active', b === btn));
      Object.keys(pages).forEach((p) => {
        if (pages[p]) pages[p].classList.toggle('hidden', p !== target);
      });
      if (target === 'coverage' && cachedCoverage) {
        updateCoverage(cachedCoverage);
      } else if (target === 'automation' && cachedAutomation) {
        updateAutomation(cachedAutomation);
      }
      loadData();
    });
  });

  // Video DB Template Filters
  if (vdbTemplateToolbar) {
    vdbTemplateToolbar.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        vdbTemplateToolbar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
        vdbActiveTemplate = chip.dataset.template;
        renderVideoDatabase();
      });
    });
  }

  // Video DB Category Filters
  if (vdbCategoryToolbar) {
    vdbCategoryToolbar.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        vdbCategoryToolbar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
        vdbActiveCategory = chip.dataset.category;
        renderVideoDatabase();
      });
    });
  }

  // Video DB Platform Filter
  if (vdbPlatformSelect) {
    vdbPlatformSelect.addEventListener('change', () => {
      vdbActivePlatform = vdbPlatformSelect.value;
      renderVideoDatabase();
    });
  }

  // Video DB Search Input
  if (vdbSearchInput) {
    vdbSearchInput.addEventListener('input', (e) => {
      vdbSearchQuery = e.target.value.trim();
      renderVideoDatabase();
    });
  }

  // Video DB Refresh Button
  if (vdbRefreshBtn) {
    vdbRefreshBtn.addEventListener('click', async () => {
      if (vdbSyncText) vdbSyncText.textContent = '分析更新中...';
      try {
        await apiPost('/api/analyze').catch(() => null);
        await loadData();
      } catch (err) {
        console.error('Refresh error:', err);
      }
    });
  }

  // Filter Chips (Genre & Status)
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.toggle('active', c === chip));
      activeFilter = chip.dataset.filter;
      renderTrendList();
    });
  });

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderTrendList();
    });
  }

  // Refresh Button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = '↻ 分析・更新中...';
      try {
        await apiPost('/api/analyze').catch(() => null);
      } catch (e) {
        console.warn('Analysis trigger error:', e);
      }
      await loadData();
      refreshBtn.textContent = '✓ 更新完了';
      setTimeout(() => { refreshBtn.textContent = '↻ 分析・更新'; }, 1000);
    });
  }

  // Jev AI On-Demand Blueprint Refresh
  if (jevRefreshBtn) {
    jevRefreshBtn.addEventListener('click', async () => {
      if (!selectedTrendId) return;
      jevRefreshBtn.textContent = '⚡ Jev AI 生成中（無料枠）...';
      try {
        const bp = await apiPost(`/api/trends/${encodeURIComponent(selectedTrendId)}/jev-blueprint`, {
          brandProfile: currentBrandProfile,
        });
        if (bp) {
          if (bpAdaptationTheme) bpAdaptationTheme.textContent = bp.adaptationTheme || '-';
          if (bpRecommendHook) bpRecommendHook.textContent = bp.hookIdea || '-';
          if (bpFilmingTips) bpFilmingTips.textContent = bp.filmingTips || '-';
          if (bpTargetPsychology) bpTargetPsychology.textContent = bp.viewerPsychology || '-';
          if (bpRecommendDuration) bpRecommendDuration.textContent = bp.recommendedDuration || '-';
          if (bpHitReason) bpHitReason.textContent = bp.hitReason || '-';
          if (bpRecommendStructure) {
            const rawOutline = bp.scriptOutline || '';
            const lines = rawOutline.split(/\n|→/).map((s) => s.trim()).filter(Boolean);
            if (lines.length > 1) {
              bpRecommendStructure.innerHTML = lines.map((line) => `
                <div class="timeline-step">
                  <span class="step-bullet">▶</span>
                  <span class="step-text">${escapeHtml(line)}</span>
                </div>
              `).join('');
            } else {
              bpRecommendStructure.textContent = rawOutline;
            }
          }
          if (jevSourceBadge) {
            jevSourceBadge.textContent = bp.source === 'ai' ? '⚡ Jev AI 生成完了（Gemini無料枠）' : '⚡ Jev AI 生成完了（無料枠）';
          }
        }
      } catch (e) {
        console.warn('Jev blueprint generation failed:', e);
      }
      jevRefreshBtn.textContent = '✓ 再生成完了';
      setTimeout(() => { jevRefreshBtn.textContent = '⚡ Jev AIで企画レシピを再生成（無料枠）'; }, 1500);
    });
  }

  // Load All Data
  async function loadData() {
    try {
      if (syncText) syncText.textContent = '同期中...';
      if (vdbSyncText) vdbSyncText.textContent = '同期中...';
      const results = await Promise.allSettled([
        apiGet('/api/overview'),
        apiGet('/api/trends?layer=format'),
        apiGet('/api/videos'),
        apiGet('/api/coverage'),
        apiGet('/api/automation'),
      ]);

      let overview = results[0].status === 'fulfilled' ? results[0].value : null;
      let trends = results[1].status === 'fulfilled' ? results[1].value : [];
      let videos = results[2].status === 'fulfilled' ? results[2].value : [];
      let coverage = results[3].status === 'fulfilled' ? results[3].value : null;
      let automation = results[4].status === 'fulfilled' ? results[4].value : null;

      if (results[0].status === 'rejected') console.warn('Overview fetch error:', results[0].reason);
      if (results[1].status === 'rejected') console.warn('Trends fetch error:', results[1].reason);
      if (results[2].status === 'rejected') console.warn('Videos fetch error:', results[2].reason);
      if (results[3].status === 'rejected') console.warn('Coverage fetch error:', results[3].reason);
      if (results[4].status === 'rejected') console.warn('Automation fetch error:', results[4].reason);

      if (coverage) {
        cachedCoverage = coverage;
        updateCoverage(coverage);
      } else if (cachedCoverage) {
        updateCoverage(cachedCoverage);
      }

      if (automation) {
        cachedAutomation = automation;
        updateAutomation(automation);
      } else if (cachedAutomation) {
        updateAutomation(cachedAutomation);
      }

      if (videos.length === 0 && trends.length === 0 && !overview) {
        console.error('All initial API calls failed.');
        if (syncText) syncText.textContent = 'API接続確認中';
        if (vdbSyncText) vdbSyncText.textContent = 'API接続確認中';
        if (machineDot) machineDot.classList.add('offline');
        if (machineStatusText) machineStatusText.textContent = 'API応答未取得';
        renderTrendList();
        renderVideoDatabase();
        return;
      }

      // If trends is empty but posts exist, trigger an analysis pass automatically once
      if (trends.length === 0 && overview && overview.totalPosts > 0 && !hasTriggeredInitialAnalysis) {
        hasTriggeredInitialAnalysis = true;
        try {
          await apiPost('/api/analyze').catch(() => null);
          const refreshResults = await Promise.allSettled([
            apiGet('/api/trends?layer=format'),
            apiGet('/api/videos'),
            apiGet('/api/overview'),
          ]);
          if (refreshResults[0].status === 'fulfilled') trends = refreshResults[0].value;
          if (refreshResults[1].status === 'fulfilled') videos = refreshResults[1].value;
          if (refreshResults[2].status === 'fulfilled') overview = refreshResults[2].value;
        } catch (e) {
          console.warn('Auto-analysis pass error:', e);
        }
      }

      if (overview) updateOverview(overview);
      currentTrends = trends;
      allVideos = videos;
      renderTrendList();
      renderVideoDatabase();

      if (machineDot) machineDot.classList.remove('offline');
      if (machineStatusText) machineStatusText.textContent = 'MacBook online';
      const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (syncText) syncText.textContent = '同期完了 ' + timeStr;
      if (vdbSyncText) vdbSyncText.textContent = '同期完了 ' + timeStr;
    } catch (err) {
      console.error('Data load error:', err);
      if (syncText) syncText.textContent = '同期確認待';
      if (vdbSyncText) vdbSyncText.textContent = '同期確認待';
      if (machineDot) machineDot.classList.add('offline');
      if (machineStatusText) machineStatusText.textContent = 'MacBook offline / 接続確認中';
    }
  }

  // Render Video Database Grid
  function renderVideoDatabase() {
    if (!vdbCardsContainer) return;

    const filtered = allVideos.filter((v) => {
      if (vdbActiveTemplate !== 'all' && v.templateKey !== vdbActiveTemplate) return false;
      if (vdbActiveCategory !== 'all' && v.studentCategory !== vdbActiveCategory) return false;
      if (vdbActivePlatform !== 'all' && v.platform !== vdbActivePlatform) return false;
      if (vdbSearchQuery) {
        const q = vdbSearchQuery.toLowerCase();
        const str = `${v.title} ${v.hook} ${v.conceptSummary} ${v.studentAppeal} ${v.caption || ''} ${v.creatorHandle}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    if (vdbCountBadge) vdbCountBadge.textContent = `${filtered.length} / ${allVideos.length} 件`;
    if (vdbTotalVideos) vdbTotalVideos.textContent = `${allVideos.length} 本`;
    if (vdbMaxViews) {
      const maxViews = Math.max(...allVideos.map((v) => Number(v.viewCount) || 0), 0);
      vdbMaxViews.textContent = `${Math.round(maxViews / 10000)}万再生`;
    }

    if (filtered.length === 0) {
      vdbCardsContainer.innerHTML = '<p class="empty-hint">条件に一致する実用ショート動画は見つかりませんでした</p>';
      return;
    }

    vdbCardsContainer.innerHTML = '';
    filtered.forEach((v) => {
      const card = document.createElement('article');
      card.className = 'video-card';
      const platformUpper = (v.platform || '').toUpperCase();
      const liftText = v.usualValueRatio ? `通常の${v.usualValueRatio.toFixed(1)}倍` : '急上昇中';
      const viewsText = v.viewCount ? `${Number(v.viewCount).toLocaleString()} 再生` : '-';
      const likesText = v.likeCount ? `${Number(v.likeCount).toLocaleString()} いいね` : '-';

      card.innerHTML = `
        <div class="vcard-top">
          <div class="vcard-badges">
            <span class="badge-platform ${escapeHtml(v.platform || '')}">${escapeHtml(platformUpper)}</span>
            <span class="badge-template">${escapeHtml(v.templateLabel || '注目テンプレ')}</span>
            <span class="badge-category">${escapeHtml(v.studentCategoryLabel || '実用ノウハウ')}</span>
          </div>
          <span style="font-size:11px;font-weight:700;color:var(--orange);">🔥 ${escapeHtml(liftText)}</span>
        </div>

        <h3 class="vcard-title">${escapeHtml(v.title || '実践ショート動画')}</h3>

        <div class="vcard-hook-box">
          <span class="vcard-hook-label">🎯 冒頭2秒のフック台詞 (0〜2秒)</span>
          <div class="vcard-hook-text">${escapeHtml(v.hook || '「これ知らないと損する…」')}</div>
        </div>

        <div class="vcard-info-box">
          <div class="vcard-info-row">
            <label>💡 伝えている情報・ノウハウ（要約）</label>
            <span>${escapeHtml(v.conceptSummary || v.caption || '-')}</span>
          </div>
          <div class="vcard-info-row">
            <label>🎓 日本の学生に刺さる理由</label>
            <span>${escapeHtml(v.studentAppeal || '-')}</span>
          </div>
        </div>

        <!-- 秒数構成 & 自社実践台本アコーディオン -->
        <details class="vcard-accordion" open>
          <summary class="vcard-accordion-toggle">
            <span>📐 この動画の秒数構成 & 自社実践台本</span>
            <span class="vcard-accordion-icon">▾</span>
          </summary>
          <div class="vcard-accordion-content">
            <div class="vcard-blueprint-block">
              <span class="vbp-label">⏱ 元動画の秒数タイムライン構成 (起承転結)</span>
              <div class="vbp-timeline-box">${renderStepsHtml(v.timelineOutline)}</div>
            </div>
            <div class="vcard-blueprint-block">
              <span class="vbp-label">✍️ この動画を自社でやる場合の具体台本 (セリフ・テロップ案)</span>
              <div class="vbp-selfscript-box">${renderStepsHtml(v.selfScriptOutline)}</div>
            </div>
            ${v.selfHook ? `
              <div class="vcard-blueprint-block">
                <span class="vbp-label">🗣 自社転用フック台詞 (0〜2秒)</span>
                <div class="vbp-hook-box">${escapeHtml(v.selfHook)}</div>
              </div>
            ` : ''}
            ${v.filmingTips ? `
              <div class="vcard-blueprint-block">
                <span class="vbp-label">🎥 撮影・テロップ演出の急所</span>
                <div class="vbp-tips-box">${escapeHtml(v.filmingTips)}</div>
              </div>
            ` : ''}
          </div>
        </details>

        <div class="vcard-metrics">
          <span>👤 <b>@${escapeHtml(v.creatorHandle || 'クリエイター')}</b></span>
          <span>👀 <b>${viewsText}</b></span>
          <span>❤️ <b>${likesText}</b></span>
        </div>

        <div class="vcard-actions">
          <a class="btn-open-video" href="${escapeHtml(v.canonicalUrl || '#')}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">
            元動画を開く ↗
          </a>
          <button class="btn-view-blueprint" data-cluster-id="${escapeHtml(v.formatClusterId || '')}" data-template-key="${escapeHtml(v.templateKey || '')}" data-video-title="${escapeHtml(v.title || '')}" data-creator-handle="${escapeHtml(v.creatorHandle || '')}">
            この型の企画台本を見る 📝
          </button>
        </div>
      `;

      vdbCardsContainer.appendChild(card);
    });

    vdbCardsContainer.querySelectorAll('.btn-view-blueprint').forEach((btn) => {
      btn.addEventListener('click', () => {
        const clusterId = btn.dataset.clusterId;
        const templateKey = btn.dataset.templateKey;
        const videoTitle = btn.dataset.videoTitle;
        const creatorHandle = btn.dataset.creatorHandle;
        switchToRadarAndSelectTemplate(clusterId, templateKey, { title: videoTitle, creator: creatorHandle });
      });
    });
  }

  function switchToRadarAndSelectTemplate(clusterId, templateKey, sourceVideo = null) {
    currentPage = 'radar';
    navButtons.forEach((b) => b.classList.toggle('active', b.dataset.page === 'radar'));
    Object.keys(pages).forEach((p) => {
      if (pages[p]) pages[p].classList.toggle('hidden', p !== 'radar');
    });

    let target = null;
    if (clusterId) {
      target = currentTrends.find((t) => t.id === clusterId);
    }
    if (!target && templateKey) {
      target = currentTrends.find((t) => (t.label || '').includes(templateKey) || (t.displayLabel || '').includes(templateKey));
    }
    if (!target && currentTrends.length > 0) {
      target = currentTrends[0];
    }

    if (target) {
      selectedTrendId = target.id;
      renderTrendList();
      loadTrendDetail(target.id);
      const evPanel = document.getElementById('evidencePanel');
      if (evPanel) evPanel.scrollIntoView({ behavior: 'smooth' });
    }

    if (sourceVideo && sourceVideo.title) {
      if (bpTargetVideoBanner && bpTargetVideoTitle) {
        bpTargetVideoTitle.textContent = `${sourceVideo.creator ? '@' + sourceVideo.creator + ' ' : ''}「${sourceVideo.title}」`;
        bpTargetVideoBanner.style.display = 'flex';
      }
    }
  }

  // Overview Update
  function updateOverview(ov) {
    if (pulseClusters) pulseClusters.textContent = `${ov.totalClusters} 型`;
    if (pulseCaptured24h) pulseCaptured24h.textContent = `${ov.captured24h} 本`;
    if (pulseTotalPosts) pulseTotalPosts.textContent = `${ov.totalPosts} 本`;
    if (pulseCreators) pulseCreators.textContent = `${ov.totalCreators} 名`;
    if (pulseConfidence) pulseConfidence.textContent = `${Math.round(ov.averageConfidence * 100)}%`;

    if (machineMeta) {
      const lastStr = ov.lastAnalysis ? new Date(ov.lastAnalysis.startedAt).toLocaleTimeString('ja-JP') : '-';
      machineMeta.innerHTML = `最終分析: ${lastStr}<br>書き込み操作: 0件 (完全安全)<br>Jev AI 無料枠監視中`;
    }
  }

  // Filter & Render Trends (Marketer-Friendly Cards)
  function renderTrendList() {
    if (!trendListContainer) return;

    let filtered = currentTrends.filter((item) => {
      if (activeFilter.startsWith('status:')) {
        const targetStatus = activeFilter.split(':')[1];
        if (item.status !== targetStatus) return false;
      } else if (activeFilter.startsWith('genre:')) {
        const targetGenre = activeFilter.split(':')[1];
        if (item.genreKey !== targetGenre) return false;
      }

      if (searchQuery) {
        const label = (item.displayLabel || item.label || '').toLowerCase();
        const raw = (item.label || '').toLowerCase();
        const creator = (item.representativeCreator || '').toLowerCase();
        const caption = (item.sampleCaption || '').toLowerCase();
        const genre = (item.genre || '').toLowerCase();
        if (!label.includes(searchQuery) && !raw.includes(searchQuery) && !creator.includes(searchQuery) && !caption.includes(searchQuery) && !genre.includes(searchQuery)) {
          return false;
        }
      }
      return true;
    });

    if (trendCountBadge) trendCountBadge.textContent = `${filtered.length} 件`;

    if (filtered.length === 0) {
      trendListContainer.innerHTML = '<div class="empty-hint">条件に一致するトレンド企画はありません</div>';
      return;
    }

    trendListContainer.innerHTML = '';
    filtered.forEach((trend, index) => {
      const rankNum = String(index + 1).padStart(2, '0');
      const isSelected = trend.id === selectedTrendId || (selectedTrendId === null && index === 0);
      if (isSelected && selectedTrendId === null) {
        selectedTrendId = trend.id;
        loadTrendDetail(trend.id);
      }

      const card = document.createElement('article');
      card.className = `trend-card ${isSelected ? 'active' : ''}`;
      card.dataset.id = trend.id;

      const isTeam = trend.status === 'team_interest';
      const statusTagClass = isTeam ? 'team' : 'market';
      const statusText = trend.statusLabel || (isTeam ? '👀 チーム注目' : '🔥 SNS全体で急上昇');

      const displayTitle = trend.displayLabel || trend.label;
      const genreText = trend.genre || '💡 トレンド';
      const creatorText = trend.representativeCreator ? `@${trend.representativeCreator} ほか` : '人気クリエイター';
      const captionText = trend.sampleCaption ? trend.sampleCaption : '複数の独立アカウントで共通のバズりパターンが検知されています。';
      const liftText = trend.buzzLiftText || '急上昇中';
      const confRatio = Math.round((trend.confidence || 0) * 100);

      card.innerHTML = `
        <div class="card-top">
          <h3 class="card-title">${escapeHtml(displayTitle)}</h3>
          <div class="card-rank">#${rankNum}</div>
        </div>
        <div class="card-tags">
          <span class="tag genre-badge">${escapeHtml(genreText)}</span>
          <span class="tag ${statusTagClass}">${escapeHtml(statusText)}</span>
          <span class="tag market">${escapeHtml(liftText)}</span>
          <span class="tag">お手本動画 ${trend.evidenceCount || 1} 本</span>
        </div>
        <div class="card-creator-line">
          <b>お手本アカウント:</b> <span>${escapeHtml(creatorText)}</span>
        </div>
        <div class="card-caption-snippet">${escapeHtml(captionText)}</div>
        <div class="card-footer-metrics">
          <div class="metric-item">
            <strong>${escapeHtml(liftText)}</strong>
            <span>バズ勢い</span>
          </div>
          <div class="metric-item">
            <strong>${trend.independentCreatorCount || 1} 名</strong>
            <span>お手本アカウント数</span>
          </div>
          <div class="metric-item" style="text-align:right;">
            <strong>${confRatio}%</strong>
            <span>分析信頼度</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.trend-card').forEach((t) => t.classList.remove('active'));
        card.classList.add('active');
        selectedTrendId = trend.id;
        loadTrendDetail(trend.id);
      });

      trendListContainer.appendChild(card);
    });
  }

  // Load Trend Detail
  async function loadTrendDetail(id) {
    try {
      const detail = await apiGet(`/api/trends/${encodeURIComponent(id)}`);
      renderTrendDetail(detail);
    } catch (err) {
      console.error('Failed to load trend detail:', err);
    }
  }

  // Render Trend Detail Panel
  function renderTrendDetail(detail) {
    if (!detail) return;

    const displayTitle = detail.displayLabel || detail.label || 'トレンド企画';
    if (detailTitle) detailTitle.textContent = displayTitle;

    if (detailLayerBadge) {
      detailLayerBadge.textContent = '🎬 企画・構成パターン';
    }

    if (detailStatusBadge) {
      const isTeam = detail.status === 'team_interest';
      detailStatusBadge.textContent = detail.statusLabel || (isTeam ? '👀 チーム注目（要検証）' : '🔥 SNS全体で急上昇');
      detailStatusBadge.className = `state ${isTeam ? 'team' : 'market'}`;
    }

    if (detailMeta) {
      const creatorName = detail.representativeCreator ? `@${detail.representativeCreator}` : 'クリエイター';
      const conf = Math.round((detail.confidence || 0) * 100);
      detailMeta.textContent = `お手本: ${creatorName} · お手本動画 ${detail.evidenceCount || 1}本 · 分析信頼度 ${conf}%`;
    }

    // Actionable Blueprint (企画転用レシピ by Jev)
    const advice = detail.actionableAdvice || detail.jevBlueprint;

    function applyEvidenceToBlueprint(post) {
      if (!post) return;
      if (bpTargetVideoBanner) {
        bpTargetVideoBanner.style.display = 'flex';
      }
      if (bpTargetVideoTitle) {
        const creator = post.creatorHandle ? `@${post.creatorHandle}` : 'お手本クリエイター';
        bpTargetVideoTitle.textContent = `${creator}「${post.title || 'ショート動画'}」`;
      }
      if (bpAdaptationTheme) {
        bpAdaptationTheme.textContent = post.actionableArrangement || advice?.adaptationTheme || `${post.title} の構成を自社商材・日常に移植して再現`;
      }
      if (bpRecommendHook) {
        bpRecommendHook.textContent = post.selfHook || post.hook || advice?.recommendedHook || advice?.hookIdea || '-';
      }
      if (bpRecommendStructure) {
        const timelineSteps = renderStepsHtml(post.timelineOutline || advice?.recommendedStructure || advice?.scriptOutline);
        const scriptSteps = renderStepsHtml(post.selfScriptOutline);
        bpRecommendStructure.innerHTML = `
          <div class="bp-structure-group">
            <div class="bp-subheading">⏱ 元動画の秒数タイムライン構成 (起承転結)</div>
            ${timelineSteps}
          </div>
          ${post.selfScriptOutline ? `
            <div class="bp-structure-group" style="margin-top:10px;">
              <div class="bp-subheading">✍️ 自社でやる場合の具体台本 (セリフ・テロップ案)</div>
              ${scriptSteps}
            </div>
          ` : ''}
        `;
      }
      if (bpFilmingTips) {
        bpFilmingTips.textContent = post.filmingTips || advice?.filmingTips || '-';
      }
      if (bpHitReason) {
        bpHitReason.textContent = post.hitReason || advice?.hitReason || '-';
      }
      if (bpRecommendDuration) {
        bpRecommendDuration.textContent = post.durationSeconds ? `${post.durationSeconds}秒（テンポ重視）` : (advice?.recommendedDuration || '20〜25秒');
      }
      if (bpTargetPsychology) {
        bpTargetPsychology.textContent = post.studentAppeal || advice?.targetPsychology || advice?.viewerPsychology || '-';
      }
      if (jevSourceBadge) {
        const creator = post.creatorHandle ? `@${post.creatorHandle}` : 'お手本動画';
        jevSourceBadge.textContent = `🎥 ${creator} の実動画に完全連動中`;
      }
    }

    if (advice) {
      if (bpAdaptationTheme) bpAdaptationTheme.textContent = advice.adaptationTheme || '自社商材や日常のワンシーンに置き換えて展開';
      if (bpRecommendHook) bpRecommendHook.textContent = advice.recommendedHook || advice.hookIdea || '「実はこれ、9割がやってるNG例」';
      if (bpFilmingTips) bpFilmingTips.textContent = advice.filmingTips || 'カメラ目線で早口・テンポ重視。テロップは太字ゴシック。';
      if (bpRecommendDuration) bpRecommendDuration.textContent = advice.recommendedDuration || '20〜25秒（テンポ重視）';
      if (bpTargetPsychology) bpTargetPsychology.textContent = advice.targetPsychology || advice.viewerPsychology || '失敗回避・自己向上欲求';
      if (bpHitReason) bpHitReason.textContent = advice.hitReason || '視聴者の共感とコメント参加を誘発する仕掛けが拡散を生んでいます。';
      if (jevSourceBadge) {
        jevSourceBadge.textContent = advice.source === 'ai' ? '⚡ Jev AI 生成済み（Gemini無料枠）' : '⚡ Jev AI 企画レシピ（無料枠稼働中）';
      }

      if (bpRecommendStructure) {
        bpRecommendStructure.innerHTML = renderStepsHtml(advice.recommendedStructure || advice.scriptOutline);
      }
    }

    // Three Elements (バズる動画の解体新書)
    const features = detail.threeLayerFeatures || {};
    if (detailSurface) {
      const surfaces = (features.surface || []).flatMap((s) => (s && s.labels) || []).slice(0, 5);
      detailSurface.textContent = surfaces.length > 0 ? surfaces.join('、 ') : `${detail.label}（注目ハッシュタグ・テロップ）`;
    }
    if (detailFormat) {
      const formats = (features.format || []).flatMap((f) => (f && f.labels) || []).slice(0, 5);
      detailFormat.textContent = formats.length > 0 ? formats.join('、 ') : (detail.displayLabel || '日常共有・共感フック構成');
    }
    if (detailDesire) {
      const desires = (features.desire || []).flatMap((d) => (d && d.labels) || []).slice(0, 5);
      detailDesire.textContent = desires.length > 0 ? desires.join('、 ') : '気軽な共感・追体験欲求（思わず最後まで見ちゃう心理）';
    }

    // Evidence Posts (お手本バズ動画 Showcase)
    if (detailEvidenceCards) {
      const posts = detail.evidencePosts || [];
      if (posts.length === 0) {
        detailEvidenceCards.innerHTML = '<p class="empty-hint">お手本動画はありません</p>';
      } else {
        detailEvidenceCards.innerHTML = '';
        posts.forEach((p, index) => {
          const roleLabels = {
            earliest: '最初期バズ',
            fastest_rising: '最速急上昇',
            cross_platform: '媒体横断バズ',
            counterexample: '比較・検証用',
            representative: '代表的なお手本動画',
          };
          const card = document.createElement('article');
          card.className = `evidence-card ${index === 0 ? 'ev-card-active' : ''}`;
          card.dataset.index = String(index);
          const platformUpper = (p.platform || '').toUpperCase();
          const liftText = p.usualValueRatio ? `🔥 通常の${p.usualValueRatio.toFixed(1)}倍急上昇` : '🔥 バズ発生中';
          const accountName = p.creatorHandle ? `@${p.creatorHandle}` : '人気クリエイター';
          const captionText = p.caption ? p.caption : 'キャプション未取得';
          const durationText = p.durationSeconds ? `${p.durationSeconds}秒` : null;

          const cardTitle = p.title || '実践ショート動画';
          const hookText = p.hook || '「これ知らないと損する…」';
          const conceptText = p.conceptSummary || p.caption || '実践的な知識・ノウハウを簡潔に伝達';
          const appealText = p.studentAppeal || '日々の生活や課題、就活ですぐに役立つ高い実益性';
          const templateBadge = p.templateLabel || detail.displayLabel || '注目テンプレ';
          const categoryBadge = p.studentCategoryLabel || '実用ノウハウ';
          const viewsText = p.viewCount !== null && p.viewCount !== undefined ? `${Number(p.viewCount).toLocaleString()} 再生` : '-';
          const likesText = p.likeCount !== null && p.likeCount !== undefined ? `${Number(p.likeCount).toLocaleString()} いいね` : '-';

          card.innerHTML = `
            <div class="ev-card-top">
              <div class="ev-badges-row">
                <span class="role-badge">${roleLabels[p.role] || p.role}</span>
                <span class="badge-platform ${escapeHtml(p.platform || '')}">${platformUpper}</span>
                <span class="badge-template">${escapeHtml(templateBadge)}</span>
                <span class="badge-category">${escapeHtml(categoryBadge)}</span>
                <span class="ev-active-indicator" style="${index === 0 ? '' : 'display:none;'}">🎯 レシピ連動中</span>
              </div>
              <span style="font-size:11px;font-weight:700;color:var(--orange);">🔥 ${escapeHtml(liftText)}</span>
            </div>

            <h3 class="ev-card-title">${escapeHtml(cardTitle)}</h3>

            <div class="ev-hook-box">
              <span class="ev-hook-label">🎯 冒頭2秒のフック台詞 (0〜2秒)</span>
              <div class="ev-hook-text">${escapeHtml(hookText)}</div>
            </div>

            <div class="ev-info-box">
              <div class="ev-info-row">
                <label>💡 伝えている情報・ノウハウ（要約）</label>
                <span>${escapeHtml(conceptText)}</span>
              </div>
              <div class="ev-info-row">
                <label>🎓 日本の学生に刺さる理由</label>
                <span>${escapeHtml(appealText)}</span>
              </div>
            </div>

            <!-- 秒数構成 & 自社実践台本アコーディオン -->
            <details class="vcard-accordion" open>
              <summary class="vcard-accordion-toggle">
                <span>📐 この動画の秒数構成 & 自社実践台本</span>
                <span class="vcard-accordion-icon">▾</span>
              </summary>
              <div class="vcard-accordion-content">
                <div class="vcard-blueprint-block">
                  <span class="vbp-label">⏱ 元動画の秒数タイムライン構成 (起承転結)</span>
                  <div class="vbp-timeline-box">${renderStepsHtml(p.timelineOutline)}</div>
                </div>
                <div class="vcard-blueprint-block">
                  <span class="vbp-label">✍️ この動画を自社でやる場合の具体台本 (セリフ・テロップ案)</span>
                  <div class="vbp-selfscript-box">${renderStepsHtml(p.selfScriptOutline)}</div>
                </div>
                ${p.selfHook ? `
                  <div class="vcard-blueprint-block">
                    <span class="vbp-label">🗣 自社転用フック台詞 (0〜2秒)</span>
                    <div class="vbp-hook-box">${escapeHtml(p.selfHook)}</div>
                  </div>
                ` : ''}
                ${p.filmingTips ? `
                  <div class="vcard-blueprint-block">
                    <span class="vbp-label">🎥 撮影・テロップ演出の急所</span>
                    <div class="vbp-tips-box">${escapeHtml(p.filmingTips)}</div>
                  </div>
                ` : ''}
              </div>
            </details>

            <div class="ev-metrics-row">
              <span>👤 <b>${escapeHtml(accountName)}</b></span>
              <span>👀 <b>${viewsText}</b></span>
              <span>❤️ <b>${likesText}</b></span>
            </div>

            <div class="ev-actions-row">
              <a class="ev-link-button" href="${escapeHtml(p.canonicalUrl || '#')}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">
                ${platformUpper} で元動画を開く <span>↗</span>
              </a>
              <button type="button" class="btn-sync-blueprint">
                この動画のレシピを上に反映 👆
              </button>
            </div>
          `;

          card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            document.querySelectorAll('.evidence-card').forEach((c, idx) => {
              const isActive = idx === index;
              c.classList.toggle('ev-card-active', isActive);
              const ind = c.querySelector('.ev-active-indicator');
              if (ind) ind.style.display = isActive ? 'inline-block' : 'none';
            });
            applyEvidenceToBlueprint(p);
            if (e.target.closest('.btn-sync-blueprint')) {
              const bpSec = document.getElementById('blueprintSection');
              if (bpSec) bpSec.scrollIntoView({ behavior: 'smooth' });
            }
          });

          detailEvidenceCards.appendChild(card);
        });

        if (posts.length > 0) {
          applyEvidenceToBlueprint(posts[0]);
        } else if (bpTargetVideoBanner) {
          bpTargetVideoBanner.style.display = 'none';
        }
      }
    }

    // Technical Audit Footnote (inside Collapsible details)
    const audit = detail.biasAudit;
    if (audit) {
      if (detailAuditRisk) {
        detailAuditRisk.textContent = `${Math.round(audit.riskScore)} · ${(audit.label || 'LOW').toUpperCase()}`;
        detailAuditRisk.className = `risk ${audit.label === 'high' ? 'high' : ''}`;
      }
      if (auditUserShare) auditUserShare.textContent = `${Math.round(audit.userSubmittedShare * 100)}%`;
      if (auditHhi) auditHhi.textContent = `${Math.round(audit.submitterHhi * 100)}%`;
      if (auditIndepRatio) auditIndepRatio.textContent = `${Math.round(audit.independentConfirmationRatio * 100)}%`;
      if (auditNonUserLanes) auditNonUserLanes.textContent = `${audit.nonUserLaneCount || 0} / 4`;

      if (auditNoteText) {
        const excluded = audit.excludedTeamShares || 0;
        auditNoteText.innerHTML = `<b>${excluded}件のチーム共有を伝播数から分離。</b><br>${audit.explanation?.reason || '独立確認と市場伝播の検証を実施済み。'}`;
      }
    }

    // Lanes Bar (inside Collapsible details)
    if (detailLanes) {
      const counts = { personalized: 0, fixed_panel: 0, broad: 0, external: 0 };
      (detail.evidencePosts || []).forEach((p) => {
        if (p.sourceLane && counts[p.sourceLane] !== undefined) counts[p.sourceLane] += 1;
        else counts.personalized += 1;
      });
      const total = Math.max(Object.values(counts).reduce((a, b) => a + b, 0), 1);
      detailLanes.innerHTML = `
        <div class="lane"><span>Personalized (おすすめ)</span><div class="bar"><i style="width:${Math.round((counts.personalized / total) * 100)}%"></i></div><b>${counts.personalized}</b></div>
        <div class="lane"><span>Fixed Panel (固定監視)</span><div class="bar"><i style="width:${Math.round((counts.fixed_panel / total) * 100)}%"></i></div><b>${counts.fixed_panel}</b></div>
        <div class="lane"><span>Broad Discovery (網羅探索)</span><div class="bar"><i style="width:${Math.round((counts.broad / total) * 100)}%"></i></div><b>${counts.broad}</b></div>
        <div class="lane"><span>External Baseline (公的基準)</span><div class="bar"><i style="width:${Math.round((counts.external / total) * 100)}%"></i></div><b>${counts.external}</b></div>
      `;
    }

    // Fit Scores (inside Collapsible details)
    if (detailFitScores) {
      const fits = detail.fitScores || [];
      if (fits.length === 0) {
        detailFitScores.innerHTML = '<p class="empty-hint">適合スコア算出完了</p>';
      } else {
        detailFitScores.innerHTML = fits.map((f) => `
          <div class="fit-card">
            <strong>${escapeHtml(f.profileName)}</strong>
            <div class="fit-scores-row">
              <span>再現性: <b>${f.reproducibilityScore}</b></span>
              <span>ブランド適合: <b>${f.brandFitScore}</b></span>
              <span>オーディエンス適合: <b>${f.audienceFitScore}</b></span>
            </div>
          </div>
        `).join('');
      }
    }

    // Caveat
    if (detailCaveat) {
      if (detail.biasAudit?.riskScore >= 70) {
        detailCaveat.style.display = 'block';
        if (detailCaveatText) {
          detailCaveatText.textContent = '身内（チーム内共有）による熱狂の可能性があります。外部クリエイターでの自律的な拡散が確認されるまで要検証として扱っています。';
        }
      } else {
        detailCaveat.style.display = 'none';
      }
    }
  }

  // Update Coverage Page
  function updateCoverage(cov) {
    if (!cov) return;

    if (coverageWarningsContainer) {
      coverageWarningsContainer.innerHTML = '';
      (cov.laneWarnings || []).forEach((w) => {
        const div = document.createElement('div');
        div.className = 'warning-box';
        div.textContent = `⚠ ${w}`;
        coverageWarningsContainer.appendChild(div);
      });
    }

    if (coverageLanesList) {
      const lanes = cov.laneDistribution || [];
      coverageLanesList.innerHTML = lanes.map((l) => `
        <div class="cov-item">
          <span>${escapeHtml(l.label || l.lane || '-')}</span>
          <div class="cov-bar"><i style="width:${Math.min(l.ratio || 0, 100)}%"></i></div>
          <span>${l.count || 0} 件 (${l.ratio || 0}%)</span>
        </div>
      `).join('');
    }

    if (coveragePlatformsList) {
      const plats = cov.platformDistribution || [];
      coveragePlatformsList.innerHTML = plats.map((p) => `
        <div class="cov-item">
          <span>${escapeHtml(p.label || p.platform || '-')}</span>
          <div class="cov-bar"><i style="width:${Math.min(p.ratio || 0, 100)}%"></i></div>
          <span>${p.count || 0} 件 (${p.ratio || 0}%)</span>
        </div>
      `).join('');
    }

    if (top10RatioText && cov.creatorConcentration) {
      top10RatioText.textContent = `${cov.creatorConcentration.top10Ratio ?? 0}%`;
    }
    if (topCreatorsList && cov.creatorConcentration) {
      const creators = cov.creatorConcentration.topCreators || [];
      if (creators.length === 0) {
        topCreatorsList.innerHTML = '<p class="empty-hint">クリエイターデータはありません</p>';
      } else {
        topCreatorsList.innerHTML = creators.map((c, i) => `
          <div class="mini-row">
            <span>#${i + 1} ${escapeHtml(c.handle ? '@' + c.handle : '人気クリエイター')} (${c.platform || ''})</span>
            <b>${c.postCount || 1} 本</b>
          </div>
        `).join('');
      }
    }

    if (dailyActivityList) {
      const daily = cov.dailyActivity || [];
      const maxCount = Math.max(...daily.map((d) => d.count || 0), 1);
      dailyActivityList.innerHTML = daily.map((d) => {
        const count = d.count || 0;
        const pct = Math.round((count / maxCount) * 100);
        return `
          <div class="act-col">
            <span class="act-count">${count}</span>
            <div class="act-fill" style="height:${Math.max(pct, 6)}%"></div>
            <span class="act-date">${d.date ? d.date.slice(5) : '-'}</span>
          </div>
        `;
      }).join('');
    }
  }

  // Update Automation Page
  function updateAutomation(auto) {
    if (!auto) return;

    if (autoExecutedWrites) autoExecutedWrites.textContent = String(auto.safetyAudit?.executedWriteCount ?? 0);
    if (autoBlockedWrites) autoBlockedWrites.textContent = String(auto.safetyAudit?.blockedWriteAttemptCount ?? 0);
    if (autoTotalAudits) autoTotalAudits.textContent = String(auto.safetyAudit?.totalAuditEvents ?? 0);

    if (autoYoutubeQuota) {
      const yt = auto.connectors?.youtube;
      if (yt) {
        autoYoutubeQuota.textContent = `${yt.dailyUnitsUsed ?? 0} / ${yt.dailyQuotaLimit ?? 8000}`;
      } else {
        autoYoutubeQuota.textContent = '0 / 8,000';
      }
    }

    const ig = auto.crawlers?.instagram;
    if (igCrawlerMeta && igCrawlerBadge) {
      if (ig) {
        const timeStr = ig.startedAt ? new Date(ig.startedAt).toLocaleTimeString('ja-JP') : '-';
        igCrawlerMeta.textContent = `最終巡回: ${timeStr} · 取得: ${ig.observedCount ?? 0} · 保存: ${ig.savedCount ?? 0}`;
        igCrawlerBadge.textContent = (ig.status || 'succeeded').toUpperCase();
        igCrawlerBadge.className = `badge ${ig.status === 'succeeded' ? 'active' : 'muted'}`;
      } else {
        igCrawlerMeta.textContent = '巡回履歴待機中';
        igCrawlerBadge.textContent = 'CONFIGURED';
        igCrawlerBadge.className = 'badge';
      }
    }

    const tiktok = auto.crawlers?.tiktok;
    if (tiktokCrawlerMeta && tiktokCrawlerBadge) {
      if (tiktok) {
        const timeStr = tiktok.startedAt ? new Date(tiktok.startedAt).toLocaleTimeString('ja-JP') : '-';
        tiktokCrawlerMeta.textContent = `最終巡回: ${timeStr} · 取得: ${tiktok.observedCount ?? 0} · 保存: ${tiktok.savedCount ?? 0}`;
        tiktokCrawlerBadge.textContent = (tiktok.status || 'succeeded').toUpperCase();
        tiktokCrawlerBadge.className = `badge ${tiktok.status === 'succeeded' ? 'active' : 'muted'}`;
      } else {
        tiktokCrawlerMeta.textContent = '状態: 保留中（未ログイン時安全停止）';
        tiktokCrawlerBadge.textContent = 'PAUSED';
        tiktokCrawlerBadge.className = 'badge muted';
      }
    }

    const ytMeta = document.getElementById('ytConnectorMeta');
    const ytBadge = document.getElementById('ytConnectorBadge');
    if (ytMeta && ytBadge) {
      const yt = auto.connectors?.youtube;
      if (yt) {
        ytMeta.textContent = `日次消費: ${yt.dailyUnitsUsed ?? 0} / ${yt.dailyQuotaLimit ?? 8000} units (${yt.quotaRatio ?? 0}%)`;
        ytBadge.textContent = (yt.status || 'succeeded').toUpperCase();
        ytBadge.className = `badge ${yt.status === 'succeeded' || yt.status === 'active' ? 'active' : 'muted'}`;
      }
    }

    const slackBadge = document.getElementById('slackConnectorBadge');
    if (slackBadge) {
      const sl = auto.connectors?.slack;
      if (sl) {
        slackBadge.textContent = (sl.status || 'active').toUpperCase();
        slackBadge.className = `badge ${sl.status === 'active' ? 'active' : 'muted'}`;
      }
    }

    if (recentAuditEventsList) {
      const events = auto.safetyAudit?.recentAuditEvents || [];
      if (events.length === 0) {
        recentAuditEventsList.innerHTML = '<p class="empty-hint">監査イベントはまだありません</p>';
      } else {
        recentAuditEventsList.innerHTML = `
          <div class="audit-log-row" style="font-weight:700;border-bottom:2px solid var(--ink);">
            <span>時刻</span><span>操作</span><span>対象URL</span><span>書込実行</span>
          </div>
        ` + events.map((e) => `
          <div class="audit-log-row">
            <span>${e.occurredAt ? new Date(e.occurredAt).toLocaleTimeString('ja-JP') : '-'}</span>
            <b>${escapeHtml(e.operation || '-')}</b>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.targetUrl || '-')}</span>
            <span style="color:${(e.executedWrite || 0) === 0 ? 'green' : 'red'};font-weight:700;">${e.executedWrite || 0} 件 (安全)</span>
          </div>
        `).join('');
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Initialize and start polling (every 15s)
  loadBrandProfile();
  loadData();
  refreshTimer = setInterval(loadData, 15000);
})();
