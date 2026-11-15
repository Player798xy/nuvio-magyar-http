(function () {
  const origin = window.location.origin;

  const ALL_VOD_SOURCE_IDS = [
    'mediaklikk', 'videa', 'indavideo', 'hdmozi', 'filmvilag2', 'jobbmintatv',
    'netmozi', 'filmezek', 'onlinefilmek', 'dmdamedia', 'mesefilm', 'videakid', 'sorozatoknet'
  ];
  const ALL_LIVE_SOURCE_IDS = ['mediaklikk', 'onlinestream', 'onlinestream_local'];
  const ALL_SOURCE_IDS = [...ALL_VOD_SOURCE_IDS, 'onlinestream', 'onlinestream_local'];
  const ALL_RES_IDS = ['1080p', '720p', '480p', '360p'];

  const ALL_VOD_CATALOG_IDS = [
    'hu-mediaklikk-classics', 'hu-trending-movies',
    'hu-trending-series', 'hu-cinema-movies', 'hu-hungarian-movies', 'hu-hungarian-series',
    'hu-stream-netflix', 'hu-stream-max', 'hu-stream-disney', 'hu-stream-skyshowtime', 'hu-stream-prime'
  ];
  const CORE_VOD_CATALOG_IDS = [
    'hu-mediaklikk-classics', 'hu-trending-movies',
    'hu-trending-series', 'hu-cinema-movies', 'hu-hungarian-movies', 'hu-hungarian-series'
  ];

  const ALL_LIVE_CATALOG_IDS = [
    'hu-live-orszagos', 'hu-live-film', 'hu-live-doksi', 'hu-live-sport', 'hu-live-gyerek', 'hu-live-helyi'
  ];
  const CORE_LIVE_CATALOG_IDS = [
    'hu-live-orszagos', 'hu-live-film', 'hu-live-doksi', 'hu-live-sport', 'hu-live-gyerek'
  ];

  const DEFAULT_CATALOG_IDS = [...ALL_LIVE_CATALOG_IDS, ...ALL_VOD_CATALOG_IDS];

  let lastFetchedStreams = [];
  let activeResTab = 'all';
  let currentSeriesData = null;
  let currentSelectedSeason = 1;
  let currentSelectedEpisode = 1;
  let lastTestedSeriesQuery = '';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* -------------------------------------------------------------
   * Theme (Dark / Light mode toggle, Dark default)
   * ----------------------------------------------------------- */
  function getStoredTheme() {
    try {
      const saved = localStorage.getItem('msp-theme-mode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return 'dark';
  }

  function applyTheme(mode) {
    const resolved = mode === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        resolved === 'light'
          ? (metaTheme.dataset.light || '#F5F7FA')
          : (metaTheme.dataset.dark || '#090B10')
      );
    }

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', resolved === 'light' ? 'true' : 'false');
      const iconEl = btn.querySelector('.theme-ico');
      const labelEl = btn.querySelector('.theme-label');
      if (iconEl) iconEl.textContent = resolved === 'dark' ? '☀️' : '🌙';
      if (labelEl) labelEl.textContent = resolved === 'dark' ? 'Világos' : 'Sötét';
      btn.title = resolved === 'dark' ? 'Váltás világos módra' : 'Váltás sötét módra';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('msp-theme-mode', next);
    } catch (_) {}
    applyTheme(next);
  }

  /* -------------------------------------------------------------
   * Toast & Clipboard Helpers
   * ----------------------------------------------------------- */
  function showToast(html, duration = 3200) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = html;
    toast.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  async function copyTextToClipboard(text) {
    if (!text || text === 'Betöltés...') return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch (_) {
      return false;
    }
  }

  async function copyManifest() {
    const urlEl = document.getElementById('manifestUrl');
    const copyBtn = document.getElementById('copyBtn');
    const url = urlEl ? urlEl.textContent.trim() : `${origin}/manifest.json`;
    const ok = await copyTextToClipboard(url);
    if (copyBtn) {
      if (!copyBtn.dataset.origHtml) copyBtn.dataset.origHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = ok
        ? '<span class="btn-ico">✓</span> Kimásolva!'
        : '<span class="btn-ico">📋</span> Kijelölve';
      clearTimeout(window._copyBtnTimer);
      window._copyBtnTimer = setTimeout(() => {
        copyBtn.innerHTML = copyBtn.dataset.origHtml;
      }, 2000);
    }
    showToast(
      ok
        ? '✅ <strong>Manifest link kimásolva!</strong><br>Illeszd be Nuvio vagy Stremio Addonok közé.'
        : '⚠️ Automatikus másolás sikertelen — jelöld ki és másold ki a linket!',
      3800
    );
  }

  async function installNuvio() {
    const urlEl = document.getElementById('manifestUrl');
    const url = urlEl ? urlEl.textContent.trim() : `${origin}/manifest.json`;
    const ok = await copyTextToClipboard(url);
    showToast(
      ok
        ? '⚡ <strong>Manifest link másolva Nuvio-hoz!</strong><br>Nuvio app → <b>Addons</b> → <b>+ Add Addon</b> → Illeszd be a linket.'
        : '⚡ <strong>Nuvio telepítés:</strong><br>Másold ki a fenti Manifest linket, majd Nuvio → Addons → Illeszd be!',
      4800
    );
  }

  /* -------------------------------------------------------------
   * Configuration State & URL Assembly
   * ----------------------------------------------------------- */
  function getSubtitlesEnabled() {
    const cb = document.getElementById('subtitlesToggle');
    return cb ? Boolean(cb.checked) : true;
  }

  function updateSubtitleToggleUi(enabled) {
    const card = document.getElementById('subtitleToggleCard');
    const badge = document.getElementById('subtitlesStateBadge');
    if (card) card.classList.toggle('is-off', !enabled);
    if (badge) badge.textContent = enabled ? 'BEKAPCSOLVA' : 'KIKAPCSOLVA';
  }

  function getSelectedVodSources() {
    return [...document.querySelectorAll('#sourcesGrid input[type="checkbox"]:checked')].map(cb => cb.value);
  }

  function getSelectedLiveSources() {
    return [...document.querySelectorAll('#liveSourcesGrid input[type="checkbox"]:checked')].map(cb => cb.value);
  }

  function getSelectedSources() {
    return [...new Set([...getSelectedVodSources(), ...getSelectedLiveSources()])];
  }

  function getSelectedResolutions() {
    return [...document.querySelectorAll('#resolutionsGrid input[type="checkbox"]:checked')].map(cb => cb.value);
  }

  function getSelectedVodCatalogs() {
    return [...document.querySelectorAll('#vodCatalogsGrid input[type="checkbox"]:checked')].map(cb => cb.value);
  }

  function getSelectedLiveCatalogs() {
    return [...document.querySelectorAll('#liveCatalogsGrid input[type="checkbox"]:checked')].map(cb => cb.value);
  }

  function getSelectedCatalogs() {
    return [...getSelectedLiveCatalogs(), ...getSelectedVodCatalogs()];
  }

  function onConfigChange() {
    updateManifestUrl();
    if (lastFetchedStreams.length > 0) {
      renderStreams();
    }
  }

  function updateManifestUrl() {
    const selectedVodSources = getSelectedVodSources();
    const selectedLiveSources = getSelectedLiveSources();
    const selectedSources = getSelectedSources();
    const selectedRes = getSelectedResolutions();
    const selectedVodCats = getSelectedVodCatalogs();
    const selectedLiveCats = getSelectedLiveCatalogs();
    const selectedCats = getSelectedCatalogs();
    const subtitlesEnabled = getSubtitlesEnabled();
    updateSubtitleToggleUi(subtitlesEnabled);

    const summaryEl = document.getElementById('activeSummaryBadge');
    if (summaryEl) {
      summaryEl.textContent = `${selectedSources.length} forrás · ${selectedCats.length} katalógus · ${selectedRes.length} felbontás · HU felirat ${subtitlesEnabled ? 'BE' : 'KI'}`;
    }

    const sourcesCountEl = document.getElementById('sourcesDropdownCount');
    const sourcesPreviewEl = document.getElementById('sourcesDropdownPreview');
    if (sourcesCountEl) {
      sourcesCountEl.textContent = `${selectedVodSources.length} / ${ALL_VOD_SOURCE_IDS.length} aktív`;
    }
    if (sourcesPreviewEl) {
      if (selectedVodSources.length === ALL_VOD_SOURCE_IDS.length) {
        sourcesPreviewEl.textContent = 'Minden VOD forrás aktív (13/13)';
      } else if (selectedVodSources.length === 0) {
        sourcesPreviewEl.textContent = 'Nincs VOD forrás kiválasztva';
      } else {
        const nameMap = {
          'mediaklikk': 'MédiaKlikk', 'jobbmintatv': 'JobbMintATv', 'filmezek': 'Filmezek',
          'videa': 'Videa', 'indavideo': 'Indavideo', 'filmvilag2': 'Filmvilág2',
          'mesefilm': 'MeseKincstár', 'videakid': 'Videakid', 'netmozi': 'NetMozi',
          'onlinefilmek': 'OnlineFilmek', 'sorozatoknet': 'Sorozatok.net', 'hdmozi': 'HDMozi',
          'dmdamedia': 'DMDamedia'
        };
        const names = selectedVodSources.map(s => nameMap[s] || s);
        sourcesPreviewEl.textContent = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
      }
    }

    const liveSourcesCountEl = document.getElementById('liveSourcesDropdownCount');
    const liveSourcesPreviewEl = document.getElementById('liveSourcesDropdownPreview');
    if (liveSourcesCountEl) {
      liveSourcesCountEl.textContent = `${selectedLiveSources.length} / ${ALL_LIVE_SOURCE_IDS.length} csomag aktív`;
    }
    if (liveSourcesPreviewEl) {
      if (selectedLiveSources.length === ALL_LIVE_SOURCE_IDS.length) {
        liveSourcesPreviewEl.textContent = 'Minden IPTV forrás aktív (MTVA + OnlineStream)';
      } else if (selectedLiveSources.length === 0) {
        liveSourcesPreviewEl.textContent = 'Nincs élő TV forrás kiválasztva';
      } else if (!selectedLiveSources.includes('onlinestream_local')) {
        liveSourcesPreviewEl.textContent = 'MTVA + OnlineStream Országos (helyi nélkül)';
      } else {
        liveSourcesPreviewEl.textContent = `${selectedLiveSources.length} IPTV forrás aktív`;
      }
    }

    const vodCatsCountEl = document.getElementById('vodCatalogsDropdownCount');
    const vodCatsPreviewEl = document.getElementById('vodCatalogsDropdownPreview');
    if (vodCatsCountEl) {
      vodCatsCountEl.textContent = `${selectedVodCats.length} / ${ALL_VOD_CATALOG_IDS.length} aktív`;
    }
    if (vodCatsPreviewEl) {
      if (selectedVodCats.length === ALL_VOD_CATALOG_IDS.length) {
        vodCatsPreviewEl.textContent = 'Mind a 11 VOD katalógus aktív';
      } else if (selectedVodCats.length === 0) {
        vodCatsPreviewEl.textContent = 'Nincs VOD katalógus kiválasztva';
      } else {
        const catNameMap = {
          'hu-mediaklikk-classics': 'MédiaKlikk', 'hu-trending-movies': 'Heti Filmek',
          'hu-trending-series': 'Heti Sorozatok', 'hu-cinema-movies': 'Friss Mozifilmek',
          'hu-hungarian-movies': 'Magyar Filmek', 'hu-hungarian-series': 'Magyar Sorozatok',
          'hu-stream-netflix': 'Netflix', 'hu-stream-max': 'Max', 'hu-stream-disney': 'Disney+',
          'hu-stream-skyshowtime': 'SkyShowtime', 'hu-stream-prime': 'Prime'
        };
        const names = selectedVodCats.map(c => catNameMap[c] || c);
        vodCatsPreviewEl.textContent = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
      }
    }

    const liveCatsCountEl = document.getElementById('liveCatalogsDropdownCount');
    const liveCatsPreviewEl = document.getElementById('liveCatalogsDropdownPreview');
    if (liveCatsCountEl) {
      liveCatsCountEl.textContent = `${selectedLiveCats.length} / ${ALL_LIVE_CATALOG_IDS.length} aktív`;
    }
    if (liveCatsPreviewEl) {
      if (selectedLiveCats.length === ALL_LIVE_CATALOG_IDS.length) {
        liveCatsPreviewEl.textContent = 'Mind a 6 kategória aktív (162 élő adó)';
      } else if (selectedLiveCats.length === 0) {
        liveCatsPreviewEl.textContent = 'Nincs élő TV kategória kiválasztva';
      } else if (!selectedLiveCats.includes('hu-live-helyi') && selectedLiveCats.length === 5) {
        liveCatsPreviewEl.textContent = 'Országos, Film, Doksi, Sport, Gyerek (helyi nélkül)';
      } else {
        const liveNameMap = {
          'hu-live-orszagos': 'Országos', 'hu-live-film': 'Film & Sorozat',
          'hu-live-doksi': 'Doksi', 'hu-live-sport': 'Sport & Zene',
          'hu-live-gyerek': 'Gyerek', 'hu-live-helyi': 'Helyi TV-k'
        };
        const names = selectedLiveCats.map(c => liveNameMap[c] || c);
        liveCatsPreviewEl.textContent = names.join(', ');
      }
    }

    let manifestUrl = `${origin}/manifest.json`;
    const cfgObj = {};
    if (selectedSources.length > 0 && selectedSources.length < ALL_SOURCE_IDS.length) {
      cfgObj.sources = selectedSources;
    }
    if (selectedRes.length > 0 && selectedRes.length < ALL_RES_IDS.length) {
      cfgObj.qualities = selectedRes;
    }
    const isDefaultCats = selectedCats.length === DEFAULT_CATALOG_IDS.length && DEFAULT_CATALOG_IDS.every(c => selectedCats.includes(c));
    if (!isDefaultCats && selectedCats.length > 0) {
      cfgObj.catalogs = selectedCats;
    }
    if (!subtitlesEnabled) {
      cfgObj.subtitles = false;
    }

    if (Object.keys(cfgObj).length > 0) {
      const b64 = btoa(JSON.stringify(cfgObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      manifestUrl = `${origin}/${b64}/manifest.json`;
    }

    const urlEl = document.getElementById('manifestUrl');
    if (urlEl) {
      const prevUrl = urlEl.textContent;
      urlEl.textContent = manifestUrl;
      if (prevUrl && prevUrl !== 'Betöltés...' && prevUrl !== manifestUrl) {
        urlEl.classList.remove('url-flash');
        void urlEl.offsetWidth;
        urlEl.classList.add('url-flash');
      }
    }
    const stremioBtn = document.getElementById('stremioInstallBtn');
    if (stremioBtn) {
      stremioBtn.href = manifestUrl.replace(/^https?:\/\//, 'stremio://');
    }
  }

  function setResolutions(resList) {
    const set = new Set(resList);
    document.querySelectorAll('#resolutionsGrid input[type="checkbox"]').forEach(cb => {
      cb.checked = set.has(cb.value);
    });
    onConfigChange();
  }

  function toggleAllVodSources(state) {
    document.querySelectorAll('#sourcesGrid input[type="checkbox"]').forEach(cb => {
      cb.checked = state;
    });
    onConfigChange();
  }

  function toggleAllLiveSources(mode) {
    document.querySelectorAll('#liveSourcesGrid input[type="checkbox"]').forEach(cb => {
      if (mode === 'all') cb.checked = true;
      else if (mode === 'none') cb.checked = false;
      else if (mode === 'no_local') cb.checked = cb.value !== 'onlinestream_local';
    });
    onConfigChange();
  }

  function setVodCatalogPreset(mode) {
    const set = new Set(mode === 'core' ? CORE_VOD_CATALOG_IDS : ALL_VOD_CATALOG_IDS);
    document.querySelectorAll('#vodCatalogsGrid input[type="checkbox"]').forEach(cb => {
      cb.checked = mode === 'all' ? true : (mode === 'none' ? false : set.has(cb.value));
    });
    onConfigChange();
  }

  function setLiveCatalogPreset(mode) {
    const set = new Set(mode === 'no_local' ? CORE_LIVE_CATALOG_IDS : ALL_LIVE_CATALOG_IDS);
    document.querySelectorAll('#liveCatalogsGrid input[type="checkbox"]').forEach(cb => {
      cb.checked = mode === 'all' ? true : (mode === 'none' ? false : set.has(cb.value));
    });
    onConfigChange();
  }

  const DROPDOWN_MAP = {
    'sources': { wrap: 'sourcesDropdownWrap', trigger: 'sourcesDropdownTrigger' },
    'liveSources': { wrap: 'liveSourcesDropdownWrap', trigger: 'liveSourcesDropdownTrigger' },
    'vodCatalogs': { wrap: 'vodCatalogsDropdownWrap', trigger: 'vodCatalogsDropdownTrigger' },
    'liveCatalogs': { wrap: 'liveCatalogsDropdownWrap', trigger: 'liveCatalogsDropdownTrigger' },
    'tvTools': { wrap: 'tvToolsDropdownWrap', trigger: 'tvToolsDropdownTrigger' }
  };

  function toggleDropdown(type) {
    const item = DROPDOWN_MAP[type];
    if (!item) return;
    const wrap = document.getElementById(item.wrap);
    const trigger = document.getElementById(item.trigger);
    if (!wrap) return;
    const isOpen = wrap.classList.toggle('is-open');
    if (trigger) {
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }

  function openDropdown(type) {
    const item = DROPDOWN_MAP[type];
    if (!item) return;
    const wrap = document.getElementById(item.wrap);
    const trigger = document.getElementById(item.trigger);
    if (!wrap) return;
    wrap.classList.add('is-open');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }
  }

  /* -------------------------------------------------------------
   * CH 04: Stream & Series Tester
   * ----------------------------------------------------------- */
  function getStreamBucket(s) {
    const h = s.height || 0;
    const q = String(s.quality || '').toLowerCase();
    const name = String(s.name || '');
    if (h >= 1080 || q === '1080p' || name.includes('1080')) return '1080p';
    if (h >= 720 || q === '720p' || name.includes('720')) return '720p';
    if (h >= 480 || q === '480p' || name.includes('480')) return '480p';
    return '360p';
  }

  function setActiveResTab(res) {
    activeResTab = res;
    document.querySelectorAll('#liveResTabs button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-res') === res);
    });
    renderStreams();
  }

  function updateTabCounts(streams) {
    const counts = { all: streams.length, '1080p': 0, '720p': 0, '480p': 0, '360p': 0 };
    streams.forEach(s => {
      const b = getStreamBucket(s);
      counts[b] = (counts[b] || 0) + 1;
    });
    const labels = {
      all: `Összes (${counts.all})`,
      '1080p': `1080p FHD (${counts['1080p']})`,
      '720p': `720p HD (${counts['720p']})`,
      '480p': `480p SD (${counts['480p']})`,
      '360p': `360p (${counts['360p']})`
    };
    document.querySelectorAll('#liveResTabs button').forEach(btn => {
      const r = btn.getAttribute('data-res');
      if (labels[r]) btn.textContent = labels[r];
    });
  }

  function renderStreams() {
    const out = document.getElementById('testOutput');
    if (!out) return;
    const selectedResSet = new Set(getSelectedResolutions());

    const allowedByCheckbox = lastFetchedStreams.filter(s => selectedResSet.has(getStreamBucket(s)));
    updateTabCounts(allowedByCheckbox);

    const filtered = activeResTab === 'all'
      ? allowedByCheckbox
      : allowedByCheckbox.filter(s => getStreamBucket(s) === activeResTab);

    if (filtered.length === 0) {
      out.innerHTML = '<div class="results-empty">Nincs találat a kiválasztott felbontás-szűrővel.</div>';
      return;
    }

    out.innerHTML = filtered.map((s, idx) => {
      const bucket = getStreamBucket(s);
      const badgeClass = bucket === '1080p' ? 'q1080' : bucket === '720p' ? 'q720' : bucket === '480p' ? 'q480' : 'q360';
      const num = String(idx + 1).padStart(2, '0');
      const delayMs = Math.min(idx * 35, 350);
      const href = s.playerUrl || s.externalUrl || s.url || '#';
      const nameStr = escapeHtml((s.name || '').replace(/\n/g, ' — '));
      const subStr = escapeHtml((s.title || '').replace(/\n/g, ' · '));
      const qualStr = escapeHtml(s.quality || (s.height ? s.height + 'p' : bucket));
      return `
        <div class="stream-row" style="animation-delay: ${delayMs}ms">
          <div class="stream-main">
            <div class="stream-title-line">
              <span class="stream-idx">${num}</span>
              <span>${nameStr}</span>
              <span class="q-tag ${badgeClass}">${qualStr}</span>
            </div>
            <div class="stream-sub-line">${subStr}</div>
          </div>
          <a class="btn-chip" style="text-decoration:none" href="${escapeHtml(href)}" target="_blank" rel="noopener">Megnyitás →</a>
        </div>
      `;
    }).join('');
  }

  function onMediaTypeChange() {
    const typeEl = document.getElementById('mediaType');
    const bar = document.getElementById('seriesSelectorBar');
    if (!typeEl) return;
    if (typeEl.value === 'series') {
      if (bar) bar.style.display = 'flex';
      const query = document.getElementById('searchInput')?.value.trim() || '';
      if (query && !currentSeriesData) {
        testStreams();
      }
    } else {
      if (bar) bar.style.display = 'none';
    }
  }

  function populateSeriesSelector(seriesMeta, seasonToSelect = null, episodeToSelect = null) {
    if (!seriesMeta || !seriesMeta.seasons || Object.keys(seriesMeta.seasons).length === 0) return;
    currentSeriesData = seriesMeta;
    const bar = document.getElementById('seriesSelectorBar');
    if (bar) bar.style.display = 'flex';

    const seasonKeys = Object.keys(seriesMeta.seasons).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    let totalEpisodes = 0;
    seasonKeys.forEach(k => { totalEpisodes += (seriesMeta.seasons[k] || []).length; });

    const badgeTitle = document.getElementById('seriesTitleLabel');
    if (badgeTitle) {
      badgeTitle.textContent = `${seriesMeta.name || 'Sorozat'} · ${seasonKeys.length} évad · ${totalEpisodes} epizód`;
    }

    const sSelect = document.getElementById('seasonSelect');
    const activeS = seasonToSelect != null ? String(seasonToSelect) : (sSelect.value || seasonKeys[0] || '1');
    sSelect.innerHTML = seasonKeys.map(sNum => {
      const epCount = (seriesMeta.seasons[sNum] || []).length;
      return `<option value="${escapeHtml(sNum)}">${escapeHtml(sNum)}. évad (${epCount} rész)</option>`;
    }).join('');

    sSelect.value = seasonKeys.includes(String(activeS)) ? String(activeS) : seasonKeys[0];
    currentSelectedSeason = parseInt(sSelect.value, 10) || 1;
    populateEpisodeDropdown(episodeToSelect);
  }

  function populateEpisodeDropdown(episodeToSelect = null) {
    if (!currentSeriesData || !currentSeriesData.seasons) return;
    const sNum = String(currentSelectedSeason);
    const episodes = currentSeriesData.seasons[sNum] || [];
    const epSelect = document.getElementById('episodeSelect');
    if (!epSelect) return;

    if (episodes.length === 0) {
      epSelect.innerHTML = '<option value="1">1. rész</option>';
      currentSelectedEpisode = 1;
      updateStepButtons();
      return;
    }

    const activeEp = episodeToSelect != null ? parseInt(episodeToSelect, 10) : (parseInt(epSelect.value, 10) || episodes[0].episode || 1);
    epSelect.innerHTML = episodes.map(ep => {
      const epName = ep.name ? ` — ${escapeHtml(ep.name)}` : '';
      return `<option value="${ep.episode}">${ep.episode}. rész${epName}</option>`;
    }).join('');

    const epExists = episodes.some(e => e.episode === activeEp);
    if (epExists) {
      epSelect.value = String(activeEp);
      currentSelectedEpisode = activeEp;
    } else {
      epSelect.value = String(episodes[0].episode);
      currentSelectedEpisode = episodes[0].episode;
    }
    updateStepButtons();
  }

  function updateStepButtons() {
    if (!currentSeriesData || !currentSeriesData.seasons) return;
    const sNum = String(currentSelectedSeason);
    const eps = currentSeriesData.seasons[sNum] || [];
    const currentIdx = eps.findIndex(e => e.episode === currentSelectedEpisode);
    const prevBtn = document.getElementById('prevEpBtn');
    const nextBtn = document.getElementById('nextEpBtn');
    const seasonKeys = Object.keys(currentSeriesData.seasons).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const sIdx = seasonKeys.indexOf(sNum);
    if (prevBtn) prevBtn.disabled = !(currentIdx > 0 || sIdx > 0);
    if (nextBtn) nextBtn.disabled = !((currentIdx >= 0 && currentIdx < eps.length - 1) || sIdx < seasonKeys.length - 1);
  }

  function onSeasonChanged() {
    const sSelect = document.getElementById('seasonSelect');
    currentSelectedSeason = parseInt(sSelect.value, 10) || 1;
    populateEpisodeDropdown(1);
    testStreams(true);
  }

  function onEpisodeChanged() {
    const epSelect = document.getElementById('episodeSelect');
    currentSelectedEpisode = parseInt(epSelect.value, 10) || 1;
    updateStepButtons();
    testStreams(true);
  }

  function stepEpisode(delta) {
    if (!currentSeriesData || !currentSeriesData.seasons) return;
    const seasonKeys = Object.keys(currentSeriesData.seasons).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const sNum = String(currentSelectedSeason);
    const eps = currentSeriesData.seasons[sNum] || [];
    const epIdx = eps.findIndex(e => e.episode === currentSelectedEpisode);
    const sIdx = seasonKeys.indexOf(sNum);
    let newEp = null;
    let newSeason = null;

    if (delta > 0) {
      if (epIdx >= 0 && epIdx < eps.length - 1) {
        newSeason = currentSelectedSeason;
        newEp = eps[epIdx + 1].episode;
      } else if (sIdx < seasonKeys.length - 1) {
        newSeason = parseInt(seasonKeys[sIdx + 1], 10);
        newEp = (currentSeriesData.seasons[String(newSeason)] || [])[0]?.episode || 1;
      }
    } else if (delta < 0) {
      if (epIdx > 0) {
        newSeason = currentSelectedSeason;
        newEp = eps[epIdx - 1].episode;
      } else if (sIdx > 0) {
        newSeason = parseInt(seasonKeys[sIdx - 1], 10);
        const prevEps = currentSeriesData.seasons[String(newSeason)] || [];
        newEp = prevEps[prevEps.length - 1]?.episode || 1;
      }
    }

    if (newSeason != null && newEp != null) {
      currentSelectedSeason = newSeason;
      currentSelectedEpisode = newEp;
      const sSelect = document.getElementById('seasonSelect');
      if (sSelect) sSelect.value = String(newSeason);
      populateEpisodeDropdown(newEp);
      testStreams(true);
    }
  }

  function runPreset(type, query) {
    document.getElementById('mediaType').value = type;
    document.getElementById('searchInput').value = query;
    onMediaTypeChange();
    testStreams();
  }

  async function testStreams(isEpisodeChange = false) {
    const type = document.getElementById('mediaType').value;
    const query = document.getElementById('searchInput').value.trim();
    const out = document.getElementById('testOutput');
    const banner = document.getElementById('matchedBanner');
    const sources = getSelectedSources().join(',');

    if (type === 'movie') {
      const bar = document.getElementById('seriesSelectorBar');
      if (bar) bar.style.display = 'none';
    }

    if (!isEpisodeChange && query !== lastTestedSeriesQuery) {
      lastTestedSeriesQuery = query;
      currentSeriesData = null;
      currentSelectedSeason = 1;
      currentSelectedEpisode = 1;
    }

    banner.style.display = 'none';
    out.innerHTML = '<div class="results-empty">Keresés folyamatban...</div>';

    try {
      let url = `${origin}/api/test?type=${encodeURIComponent(type)}&id=${encodeURIComponent(query)}&sources=${encodeURIComponent(sources)}`;
      if (type === 'series' || currentSeriesData) {
        url += `&season=${encodeURIComponent(currentSelectedSeason)}&episode=${encodeURIComponent(currentSelectedEpisode)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      lastFetchedStreams = data.streams || [];

      if (data.seriesEpisodes && data.seriesEpisodes.seasons) {
        populateSeriesSelector(
          data.seriesEpisodes,
          data.seriesEpisodes.currentSeason || currentSelectedSeason,
          data.seriesEpisodes.currentEpisode || currentSelectedEpisode
        );
      }

      if (data.metaInfo && (data.metaInfo.hungarianTitle || data.metaInfo.englishTitle)) {
        const epLabel = (type === 'series' || data.seriesEpisodes) ? ` · ${currentSelectedSeason}. évad ${currentSelectedEpisode}. rész` : '';
        const huTitle = escapeHtml(data.metaInfo.hungarianTitle || data.metaInfo.englishTitle);
        const enExtra = data.metaInfo.englishTitle && data.metaInfo.englishTitle !== data.metaInfo.hungarianTitle
          ? `(${escapeHtml(data.metaInfo.englishTitle)})`
          : '';
        const yrExtra = data.metaInfo.year ? `[${escapeHtml(data.metaInfo.year)}]` : '';
        banner.style.display = 'block';
        banner.innerHTML = `[OK] Feloldott cím: <strong>${huTitle}</strong>${escapeHtml(epLabel)} ${enExtra} ${yrExtra} · ${lastFetchedStreams.length} találat`;
      } else if (data.matchedItem) {
        const epLabel = (type === 'series' || data.seriesEpisodes) ? ` · ${currentSelectedSeason}. évad ${currentSelectedEpisode}. rész` : '';
        const yrExtra = data.matchedItem.year ? `[${escapeHtml(data.matchedItem.year)}]` : '';
        banner.style.display = 'block';
        banner.innerHTML = `[OK] Katalógus találat: <strong>${escapeHtml(data.matchedItem.name)}</strong>${escapeHtml(epLabel)} ${yrExtra} · ${lastFetchedStreams.length} találat`;
      }

      if (lastFetchedStreams.length === 0) {
        updateTabCounts([]);
        out.innerHTML = '<div class="results-empty">Nem található közvetlen magyar stream ehhez a címhez és epizódhoz.</div>';
        return;
      }
      renderStreams();
    } catch (e) {
      out.innerHTML = `<div class="results-empty">Hiba: ${escapeHtml(e.message)}</div>`;
    }
  }

  /* -------------------------------------------------------------
   * URL Hydration & Initialization
   * ----------------------------------------------------------- */
  function hydrateConfigFromUrl() {
    try {
      let cfg = null;
      const pathMatch = window.location.pathname.match(/^\/([^/]+)\/(?:configure|v[123])\/?$/);
      if (pathMatch && pathMatch[1]) {
        const rawB64 = decodeURIComponent(pathMatch[1]).replace(/-/g, '+').replace(/_/g, '/');
        const padded = rawB64 + '='.repeat((4 - (rawB64.length % 4)) % 4);
        const decoded = atob(padded);
        if (decoded.startsWith('{') && decoded.endsWith('}')) {
          cfg = JSON.parse(decoded);
        }
      }
      const params = new URLSearchParams(window.location.search);
      if (params.has('subtitles') || params.has('subs') || params.has('noSubs')) {
        cfg = cfg || {};
        if (params.has('subtitles')) cfg.subtitles = !['0', 'false', 'off', 'no'].includes(String(params.get('subtitles')).toLowerCase());
        else if (params.has('subs')) cfg.subtitles = !['0', 'false', 'off', 'no'].includes(String(params.get('subs')).toLowerCase());
        else cfg.subtitles = ['0', 'false', 'off', 'no'].includes(String(params.get('noSubs')).toLowerCase());
      }
      if (!cfg) return;

      if (Array.isArray(cfg.sources) && cfg.sources.length > 0) {
        const set = new Set(cfg.sources.map(s => String(s).toLowerCase()));
        document.querySelectorAll('#sourcesGrid input[type="checkbox"], #liveSourcesGrid input[type="checkbox"]').forEach(cb => {
          cb.checked = set.has(cb.value);
        });
      }
      const quals = cfg.qualities || cfg.resolutions;
      if (Array.isArray(quals) && quals.length > 0) {
        const set = new Set(quals.map(q => String(q).toLowerCase()));
        document.querySelectorAll('#resolutionsGrid input[type="checkbox"]').forEach(cb => {
          cb.checked = set.has(cb.value);
        });
      }
      if (Array.isArray(cfg.catalogs) && cfg.catalogs.length > 0) {
        const set = new Set(cfg.catalogs);
        document.querySelectorAll('#vodCatalogsGrid input[type="checkbox"], #liveCatalogsGrid input[type="checkbox"]').forEach(cb => {
          cb.checked = set.has(cb.value);
        });
      }
      if (typeof cfg.subtitles === 'boolean') {
        const subCb = document.getElementById('subtitlesToggle');
        if (subCb) subCb.checked = cfg.subtitles;
      } else if (typeof cfg.subs === 'boolean') {
        const subCb = document.getElementById('subtitlesToggle');
        if (subCb) subCb.checked = cfg.subs;
      }
    } catch (_) {}
  }

  function init() {
    applyTheme(getStoredTheme());

    document.querySelectorAll('a[href="#ch02"]').forEach(a => {
      a.addEventListener('click', () => {
        openDropdown('sources');
        openDropdown('liveSources');
      });
    });
    document.querySelectorAll('a[href="#ch03"]').forEach(a => {
      a.addEventListener('click', () => {
        openDropdown('vodCatalogs');
        openDropdown('liveCatalogs');
      });
    });
    document.querySelectorAll('a[href="#tvToolsSec"]').forEach(a => {
      a.addEventListener('click', () => {
        openDropdown('tvTools');
      });
    });

    hydrateConfigFromUrl();
    updateManifestUrl();
  }

  Object.assign(window, {
    toggleTheme,
    onConfigChange,
    setResolutions,
    toggleAllVodSources,
    toggleAllLiveSources,
    setVodCatalogPreset,
    setLiveCatalogPreset,
    toggleDropdown,
    openDropdown,
    setActiveResTab,
    onMediaTypeChange,
    onSeasonChanged,
    onEpisodeChanged,
    stepEpisode,
    runPreset,
    testStreams,
    copyManifest,
    installNuvio
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
