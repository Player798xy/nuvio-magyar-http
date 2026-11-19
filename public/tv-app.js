/* Magyar TV — Live IPTV viewer
   Vanilla JS, no build step. Loads the channel list from Git (raw/jsDelivr) with
   a server fallback, probes stream health through the addon API, and plays HLS
   with automatic mirror failover. */

(() => {
  'use strict';

  const GIT_SOURCES = [
    { id: 'github', name: 'GitHub', url: 'https://raw.githubusercontent.com/Player798xy/nuvio-magyar-http/main/public/tv-channels.json' },
    { id: 'jsdelivr', name: 'jsDelivr', url: 'https://cdn.jsdelivr.net/gh/Player798xy/nuvio-magyar-http@main/public/tv-channels.json' },
    { id: 'local', name: 'Szerver', url: '/api/tv/channels' }
  ];

  const STALL_TIMEOUT_MS = 12000;
  const EPG_PX_PER_MIN = 2.2;

  const $ = (id) => document.getElementById(id);

  const el = {
    sourceBox: $('sourceBox'), sourceDot: $('sourceDot'), sourceName: $('sourceName'), sourceStamp: $('sourceStamp'),
    reloadBtn: $('reloadBtn'), search: $('search'), catList: $('catList'),
    video: $('video'), videoEmpty: $('videoEmpty'), liveBadge: $('liveBadge'), mirrorBadge: $('mirrorBadge'),
    playerClock: $('playerClock'), nowName: $('nowName'), nowCat: $('nowCat'), nowResolution: $('nowResolution'),
    nowMirrors: $('nowMirrors'), qualitySelect: $('qualitySelect'), nextMirrorBtn: $('nextMirrorBtn'),
    relayBtn: $('relayBtn'), fullscreenBtn: $('fullscreenBtn'), mirrorStrip: $('mirrorStrip'),
    playerStatus: $('playerStatus'), playerStatusText: $('playerStatusText'),
    grid: $('grid'), gridEmpty: $('gridEmpty'), gridCount: $('gridCount'), tabHint: $('tabHint'),
    epgBar: $('epgBar'), epgNowTitle: $('epgNowTitle'), epgNowTime: $('epgNowTime'), epgProgress: $('epgProgress'),
    epgNextTitle: $('epgNextTitle'), epgNextTime: $('epgNextTime'), epgNone: $('epgNone'),
    epgList: $('epgList'), epgGrid: $('epgGrid'), epgGridWrap: $('epgGridWrap'), epgWindow: $('epgWindow'),
    epgViewToggle: $('epgViewToggle'), epgStamp: $('epgStamp'), epgRefresh: $('epgRefresh'), epgProgressBar: $('epgProgressBar'),
    epgFullscreen: $('epgFullscreen'), epgCats: $('epgCats'), openLiveBtn: $('openLiveBtn'), openGuideBtn: $('openGuideBtn'), copyEpgUrl: $('copyEpgUrl'), epgUrlText: $('epgUrlText'), theaterBtn: $('theaterBtn'), toastWrap: $('toastWrap')
  };

  const state = {
    channels: [],
    byId: new Map(),
    categories: [],
    category: 'all',
    query: '',
    sourceId: '',
    current: null,
    mirrorOrder: [],
    mirrorIndex: -1,
    hls: null,
    mirrorHealth: new Map(),
    deepHealth: new Map(),
    epgView: localStorage.getItem('tv.epgView') === 'list' ? 'list' : 'grid',
    epgGridData: null,
    epgGridCategory: null,
    epg: new Map(),
    epgTimer: null,
    epgTickTimer: null,
    epgCategory: null,
    tab: 'grid',
    relay: localStorage.getItem('tv.relay') === '1',
    theater: localStorage.getItem('tv.theater') === '1',
    stallTimer: null,
    lastTime: 0,
    lastAdvanceAt: 0,
    clockTimer: null
  };

  const isHttpsPage = location.protocol === 'https:';

  /* ---------------- helpers ---------------- */

  function fetchJson(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .finally(() => clearTimeout(timer));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function fmtMs(value) {
    if (value == null || Number.isNaN(value)) return '–';
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)} ms`;
  }

  function fmtTime(ts) {
    if (!ts) return '–';
    return new Date(ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function toast(message, kind = 'ok') {
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.innerHTML = `<span class="led"></span><span>${message}</span>`;
    el.toastWrap.appendChild(node);
    setTimeout(() => { node.style.opacity = '0'; node.style.transition = 'opacity .25s'; }, 3600);
    setTimeout(() => node.remove(), 4000);
  }

  function setTheater(enabled) {
    state.theater = Boolean(enabled);
    localStorage.setItem('tv.theater', state.theater ? '1' : '0');
    document.body.classList.toggle('theater', state.theater);
    if (state.theater) {
      switchTab('grid');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function setStatus(text, kind = '') {
    el.playerStatus.className = `player-status ${kind}`;
    el.playerStatusText.textContent = text;
  }

  function hostOf(url) {
    try { return new URL(url).hostname; } catch (e) { return '?'; }
  }

  function relayUrl(url) {
    return `/api/tv/relay.m3u8?url=${encodeURIComponent(url)}`;
  }

  /* ---------------- channel list ---------------- */

  async function loadChannels({ announce = false } = {}) {
    el.sourceDot.className = 'dot';
    el.sourceName.textContent = 'Git lista betöltése…';
    el.sourceStamp.textContent = '';

    let lastError = null;
    for (const source of GIT_SOURCES) {
      try {
        const suffix = source.id === 'local' ? '' : `?v=${Date.now()}`;
        const data = await fetchJson(source.url + suffix, 10000);
        if (!data || !Array.isArray(data.channels) || !data.channels.length) {
          throw new Error('üres lista');
        }
        applyChannels(data, source);
        if (announce) toast(`Csatornalista frissítve: <strong>${source.name}</strong>`, 'ok');
        return;
      } catch (error) {
        lastError = error;
      }
    }

    el.sourceDot.className = 'dot err';
    el.sourceName.textContent = 'Lista nem érhető el';
    toast(`Nem sikerült betölteni a csatornalistát (${escapeHtml(lastError?.message || 'hálózat')}).`, 'err');
  }

  function applyChannels(data, source) {
    // Artwork always comes from the serving origin, never from a hardcoded host:
    // the /tv-logo|/tv-poster|/tv-background routes fall back to generated SVG,
    // so no channel can end up with a broken image. Custom logos (local channels)
    // are kept as-is.
    const ownArtwork = (url) => {
      const value = String(url || '');
      if (!value) return '';
      return /\/(tv-logo|tv-logos|tv-poster|tv-posters|tv-background|tv-backgrounds)\//i.test(value) ? '' : value;
    };
    state.channels = data.channels.map(channel => ({
      ...channel,
      logo: ownArtwork(channel.logo) || `/tv-logo/${channel.channelId}.png`,
      poster: ownArtwork(channel.poster) || `/tv-poster/${channel.channelId}.png`,
      background: ownArtwork(channel.background) || `/tv-background/${channel.channelId}.png`
    }));
    state.categories = data.categories || [];
    state.byId = new Map(data.channels.map(channel => [channel.id, channel]));
    state.sourceId = source.id;

    el.sourceDot.className = 'dot ok';
    el.sourceName.textContent = source.name;
    el.sourceStamp.textContent = data.generatedAt ? `· ${fmtTime(data.generatedAt)}` : '';
    el.sourceBox.title = `${source.name} · ${data.count} csatorna · ${data.mirrorCount} tükör`;
    renderSyncStatus(data.sync);

    el.gridCount.textContent = String(data.count);

    renderCategories();
    renderGrid();
    renderMirrorStrip();

    const lastId = localStorage.getItem('tv.lastChannel');
    if (lastId && state.byId.has(lastId)) {
      selectChannel(lastId, { autoplay: false, quiet: true });
    }

  }

  const CATEGORY_ICONS = {
    all: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    'hu-live-orszagos': '<path d="M4 9a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 17a4 4 0 0 1 4 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>',
    'hu-live-film': '<path d="M3 6h18v12H3zM3 10h18M7 6v4M12 6v4M17 6v4"/>',
    'hu-live-doksi': '<circle cx="12" cy="12" r="8"/><path d="M3 12h18M12 4c2.5 2.2 3.8 5 3.8 8s-1.3 5.8-3.8 8c-2.5-2.2-3.8-5-3.8-8S9.5 6.2 12 4z"/>',
    'hu-live-sport': '<circle cx="12" cy="12" r="8"/><path d="M12 8l3 2.2-1.1 3.4h-3.8L9 10.2z"/><path d="M12 4v4M4.8 9.5l4.2.7M19.2 9.5l-4.2.7M7.5 18l2.6-4.4M16.5 18l-2.6-4.4"/>',
    'hu-live-gyerek': '<path d="M12 4l2.2 4.7 5.1.7-3.7 3.6.9 5.1-4.5-2.4-4.5 2.4.9-5.1L4.7 9.4l5.1-.7z"/>',
    'hu-live-helyi': '<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/>'
  };

  function categoryIcon(id) {
    const path = CATEGORY_ICONS[id] || CATEGORY_ICONS['hu-live-orszagos'];
    return `<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
  }

  function renderSyncStatus(sync) {
    const node = $('catalogSync');
    if (!node) return;
    if (!sync) { node.textContent = 'Git szinkron: –'; return; }

    const when = sync.lastSyncAt
      ? new Date(sync.lastSyncAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
      : '–';
    const hours = Math.round((sync.intervalMs || 0) / 3600000);
    node.textContent = `Git szinkron: ${sync.ok ? 'aktív' : 'kód lista'} · ${when} · ${sync.count} csatorna${hours ? ' / ' + hours + 'h' : ''}`;
    node.title = sync.error ? `Hiba: ${sync.error}` : (sync.sourceUrl || 'Helyi kód lista');
    node.style.color = sync.ok ? 'var(--mint)' : 'var(--mute)';
  }

  function renderEpgCats() {
    if (!el.epgCats) return;

    const total = state.channels.length;
    const chips = [`<button class="${state.category === 'all' ? 'on' : ''}" data-cat="all">Összes · ${total}</button>`];
    for (const category of state.categories) {
      const label = category.name.replace(/^\p{Extended_Pictographic}+\s*/u, '');
      chips.push(`<button class="${state.category === category.id ? 'on' : ''}" data-cat="${escapeHtml(category.id)}">${escapeHtml(label)} · ${category.count}</button>`);
    }
    el.epgCats.innerHTML = chips.join('');
  }

  function renderCategories() {
    const total = state.channels.length;
    const rows = [
      `<button class="cat ${state.category === 'all' ? 'on' : ''}" data-cat="all">
        ${categoryIcon('all')}<span class="label">Összes csatorna</span><span class="count">${total}</span>
      </button>`
    ];

    for (const category of state.categories) {
      const label = category.name.replace(/^\p{Extended_Pictographic}+\s*/u, '');
      rows.push(`<button class="cat ${state.category === category.id ? 'on' : ''}" data-cat="${escapeHtml(category.id)}">
        ${categoryIcon(category.id)}<span class="label">${escapeHtml(label)}</span><span class="count">${category.count}</span>
      </button>`);
    }

    el.catList.innerHTML = rows.join('');
    renderEpgCats();
  }

  function visibleChannels() {
    const query = state.query.trim().toLowerCase();
    return state.channels.filter(channel => {
      if (state.category !== 'all' && channel.category !== state.category) return false;
      if (!query) return true;
      return channel.name.toLowerCase().includes(query)
        || (channel.description || '').toLowerCase().includes(query)
        || channel.channelId.includes(query);
    });
  }

  function renderGrid() {
    const channels = visibleChannels();
    el.gridEmpty.hidden = channels.length > 0;

    const fragment = document.createDocumentFragment();
    for (const channel of channels) {
      const button = document.createElement('button');
      button.className = `ch ${state.current?.id === channel.id ? 'on' : ''}`;
      button.dataset.id = channel.id;
      button.type = 'button';
      button.title = `${channel.name} — ${channel.mirrors.length} tükör`;

      button.innerHTML = `
        <img class="ch-logo" src="${escapeHtml(channel.logo)}" alt="" loading="lazy" />
        <span class="ch-body">
          <span class="ch-name">${escapeHtml(channel.name)}</span>
          <span class="ch-meta">
            <span>${channel.mirrors.length} tükör</span>
            ${state.current?.id === channel.id ? '<span class="ch-live">LIVE</span>' : ''}
          </span>
        </span>`;
      button.querySelector('img').addEventListener('error', (event) => { event.target.style.opacity = '0.15'; });
      fragment.appendChild(button);
    }

    el.grid.replaceChildren(fragment);
    el.gridCount.textContent = String(channels.length);
  }

  /* ---------------- playback ---------------- */

  function mirrorHealthFor(url) {
    return state.mirrorHealth.get(url) || null;
  }

  function computeMirrorOrder(channel) {
    const scored = channel.mirrors.map((mirror, index) => {
      const health = mirrorHealthFor(mirror.url);
      let score = 0;
      if (health) score += health.online ? 1000 : -1500;
      if (health && health.online) {
        score += 200 - Math.min(200, (health.ttfbMs || 0) / 25);
        score += Math.min(60, (health.bufferSec || 0) / 2);
        if (health.cors === 'allow') score += 90;
        if (health.segment && health.segment.mbps) score += Math.min(40, health.segment.mbps / 4);
      }
      if (isHttpsPage) score += mirror.secure ? 150 : -150;
      return { mirror, score: score - index * 0.01, index };
    });

    return scored.sort((a, b) => b.score - a.score).map(item => item.mirror.url);
  }

  function selectChannel(channelId, { autoplay = true, quiet = false } = {}) {
    const channel = state.byId.get(channelId);
    if (!channel) return;

    state.current = channel;
    state.mirrorOrder = computeMirrorOrder(channel);
    state.mirrorIndex = -1;
    localStorage.setItem('tv.lastChannel', channelId);

    el.nowName.textContent = channel.name;
    el.nowCat.textContent = categoryLabel(channel.category);
    el.nowResolution.textContent = channel.releaseInfo || '–';
    el.nowMirrors.textContent = `${channel.mirrors.length} tükör`;
    el.qualitySelect.disabled = true;
    el.qualitySelect.innerHTML = '<option value="-1">Auto</option>';
    el.nextMirrorBtn.disabled = channel.mirrors.length < 2;
    el.liveBadge.classList.add('idle');

    renderGrid();
    renderMirrorStrip();

    if (autoplay) {
      playMirror(0);
    } else {
      el.video.controls = false;
      el.videoEmpty.classList.remove('hide');
      el.videoEmpty.querySelector('h2').textContent = channel.name;
      el.videoEmpty.querySelector('p').textContent = 'Kattints a lejátszáshoz — a legjobb elérhető tükör indul.';
      setStatus(`${channel.name} kiválasztva — nyomd meg a lejátszást.`);
    }

    el.epgBar.hidden = true;
    el.epgNone.hidden = true;
    loadEpgForChannel(channel);
    markEpgActive();
    runChannelHealth(channel, { silent: quiet });
  }

  function categoryLabel(categoryId) {
    const match = state.categories.find(category => category.id === categoryId);
    return match ? match.name.replace(/^\p{Extended_Pictographic}+\s*/u, '') : 'Élő TV';
  }

  function destroyHls() {
    if (state.hls) {
      try { state.hls.destroy(); } catch (e) {}
      state.hls = null;
    }
    clearInterval(state.stallTimer);
    state.stallTimer = null;
    state.lastTime = 0;
    state.lastAdvanceAt = 0;
  }

  /**
   * Fully stops playback (network + audio) while keeping the channel selected.
   * Used when leaving the player view, so nothing keeps streaming in the
   * background and the video element is clean when the user comes back.
   */
  function stopPlayback(reason = 'Lejátszás leállítva.') {
    if (!state.current) return;
    destroyHls();

    try { el.video.pause(); } catch (e) {}
    el.video.removeAttribute('src');
    try { el.video.load(); } catch (e) {}

    state.mirrorIndex = -1;
    el.video.controls = false;
    el.liveBadge.classList.add('idle');
    el.mirrorBadge.textContent = 'Tükör –';

    el.videoEmpty.classList.remove('hide');
    el.videoEmpty.querySelector('h2').textContent = state.current.name;
    el.videoEmpty.querySelector('p').textContent = 'A lejátszás leállítva — kattints az indításhoz.';

    setStatus(reason);
    renderMirrorStrip();
  }

  function playMirror(index) {
    if (!state.current) return;
    const order = state.mirrorOrder;
    if (index < 0 || index >= order.length) return;

    const url = order[index];
    const mirror = state.current.mirrors.find(item => item.url === url) || { url, secure: url.startsWith('https:') };

    if (isHttpsPage && !mirror.secure && !state.relay) {
      markMirror(url, { online: false, error: 'http – HTTPS oldalon blokkolva' });
      if (index + 1 < order.length) {
        setStatus(`${index + 1}. tükör csak HTTP — HTTPS oldalon nem játszható, váltás…`, 'warn');
        playMirror(index + 1);
        return;
      }
      setStatus('Csak HTTP tükrök érhetők el — kapcsold be a Relay módot.', 'err');
      toast('A stream csak HTTP-n érhető el. Kapcsold be a <strong>Relay</strong> módot.', 'warn');
      return;
    }

    destroyHls();
    state.mirrorIndex = index;
    const source = state.relay ? relayUrl(url) : url;

    el.liveBadge.classList.add('idle');
    el.video.controls = true;
    el.mirrorBadge.textContent = `Tükör ${index + 1}/${order.length}${state.relay ? ' · Relay' : ''}`;
    setStatus(`${hostOf(url)} kapcsolódás… ${state.relay ? '(relay)' : ''}`);
    renderMirrorStrip();

    const Hls = window.Hls;
    el.videoEmpty.classList.add('hide');

    if (Hls && Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 24,
        manifestLoadingTimeOut: 9000,
        levelLoadingTimeOut: 9000,
        fragLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 2
      });
      state.hls = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        populateQuality(data.levels || []);
        el.video.play().catch(() => setStatus('Indítsd el a lejátszást a ▶ gombbal.'));
        setStatus(`Élő adás: ${hostOf(url)} · ${data.levels?.length || 1} minőség`, 'ok');
        startStallWatchdog();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hls.levels[data.level];
        if (level && level.height) {
          el.nowResolution.textContent = `${level.height}p${level.width ? ` · ${level.width}×${level.height}` : ''}`;
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        markMirror(url, { online: false, error: data.details || data.type });
        tryNextMirror(`Hiba (${data.details || data.type})`);
      });

      hls.loadSource(source);
      hls.attachMedia(el.video);
    } else if (el.video.canPlayType('application/vnd.apple.mpegurl')) {
      el.video.src = source;
      el.video.play().catch(() => {});
      setStatus(`Élő adás: ${hostOf(url)} (natív HLS)`, 'ok');
      startStallWatchdog();
    } else {
      setStatus('A böngésző nem támogatja a HLS lejátszást.', 'err');
    }
  }

  function populateQuality(levels) {
    const select = el.qualitySelect;
    select.innerHTML = '<option value="-1">Auto</option>';
    const unique = new Map();
    levels.forEach((level, index) => {
      if (!level.height) return;
      if (unique.has(level.height)) return;
      unique.set(level.height, index);
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${level.height}p${level.width ? ` · ${level.width}×${level.height}` : ''}`;
      select.appendChild(option);
    });
    select.disabled = unique.size === 0;
  }

  function tryNextMirror(reason) {
    if (!state.current) return;
    const next = state.mirrorIndex + 1;
    if (next < state.mirrorOrder.length) {
      setStatus(`${reason} — automatikus váltás a ${next + 1}. tükörre…`, 'warn');
      toast(`Tükör hiba: ${escapeHtml(reason)} → <strong>${next + 1}. tükör</strong>`, 'warn');
      setTimeout(() => playMirror(next), 350);
    } else {
      destroyHls();
      setStatus('Minden tükör hibás. Próbáld a Relay módot vagy később újra.', 'err');
      toast('Minden tükör hibás ezen a csatornán.', 'err');
      el.videoEmpty.classList.remove('hide');
    }
    renderMirrorStrip();
  }

  function startStallWatchdog() {
    clearInterval(state.stallTimer);
    state.lastTime = el.video.currentTime;
    state.lastAdvanceAt = Date.now();

    state.stallTimer = setInterval(() => {
      if (el.video.paused || el.video.ended) {
        state.lastAdvanceAt = Date.now();
        state.lastTime = el.video.currentTime;
        return;
      }
      if (el.video.currentTime > state.lastTime + 0.05) {
        state.lastTime = el.video.currentTime;
        state.lastAdvanceAt = Date.now();
        return;
      }
      if (Date.now() - state.lastAdvanceAt > STALL_TIMEOUT_MS) {
        tryNextMirror('Megakadt a lejátszás');
      }
    }, 2000);
  }

  function markMirror(url, patch) {
    const existing = state.mirrorHealth.get(url) || { url, host: hostOf(url), checkedAt: Date.now() };
    state.mirrorHealth.set(url, { ...existing, ...patch, checkedAt: Date.now() });
    renderMirrorStrip();
  }

  function renderMirrorStrip() {
    if (!state.current) {
      el.mirrorStrip.innerHTML = '';
      return;
    }

    const order = state.mirrorOrder.length ? state.mirrorOrder : state.current.mirrors.map(item => item.url);
    const rows = order.map((url, index) => {
      const health = mirrorHealthFor(url);
      const active = index === state.mirrorIndex;
      const dead = health && health.online === false;
      const checking = !health;
      const classes = ['mirror'];
      if (active) classes.push('on');
      if (dead && !active) classes.push('dead');
      if (health?.online) classes.push('ok');
      if (checking) classes.push('checking');
      const meta = health?.online
        ? `${health.cors === 'allow' ? 'CORS ✓' : 'CORS –'} · ${health.bufferSec ? health.bufferSec + 's' : '–'}${health.segment?.mbps ? ' · ' + health.segment.mbps + ' Mbps' : ''}`
        : (health?.error ? escapeHtml(String(health.error).slice(0, 28)) : 'ellenőrzés…');
      return `<button class="${classes.join(' ')}" data-mirror-index="${index}" title="${escapeHtml(url)}">
        <span class="m-dot"></span>
        <span>${index + 1}. ${escapeHtml(health?.host || hostOf(url))}</span>
        <span class="m-meta">${meta}</span>
      </button>`;
    });

    el.mirrorStrip.innerHTML = rows.join('');
  }

  /* ---------------- per-channel health (on demand only) ---------------- */

  async function runChannelHealth(channel, { silent = true } = {}) {
    try {
      const data = await fetchJson(`/api/tv/health/${encodeURIComponent(channel.channelId)}?fresh=1`, 45000);
      state.deepHealth.set(channel.id, data);

      for (const mirror of data.mirrors || []) {
        state.mirrorHealth.set(mirror.url, mirror);
      }

      if (state.current && state.current.id === channel.id) {
        const previousIndex = state.mirrorIndex;
        state.mirrorOrder = computeMirrorOrder(channel);
        renderMirrorStrip();

        if (!silent && data.onlineCount > 0) {
          toast(`<strong>${escapeHtml(channel.name)}</strong>: ${data.onlineCount}/${data.mirrorCount} tükör online`, 'ok');
        }

        // If the currently playing mirror died, fail over early.
        if (previousIndex >= 0) {
          const playingUrl = state.mirrorOrder[previousIndex];
          const playingHealth = playingUrl ? mirrorHealthFor(playingUrl) : null;
          if (playingHealth && playingHealth.online === false) tryNextMirror('Tükör offline');
        }
      }
    } catch (error) {
      if (!silent) toast(`Tükör ellenőrzés hiba: ${escapeHtml(error.message)}`, 'err');
    }
  }

  /* ---------------- EPG ---------------- */

  function fmtRange(program) {
    if (!program) return '';
    if (program.startHm && program.endHm) return `${program.startHm}–${program.endHm}`;
    return '';
  }

  function updateEpgProgress(program) {
    if (!program || !program.startMs || !program.endMs || program.endMs <= program.startMs) {
      el.epgProgress.style.width = '0%';
      return;
    }
    const ratio = (Date.now() - program.startMs) / (program.endMs - program.startMs);
    el.epgProgress.style.width = `${Math.min(100, Math.max(0, ratio * 100)).toFixed(1)}%`;
  }

  function renderEpgBar(payload) {
    if (!payload || (!payload.current && !(payload.upcoming && payload.upcoming.length))) {
      el.epgBar.hidden = true;
      el.epgNone.hidden = false;
      return;
    }

    const now = payload.current;
    const next = payload.upcoming && payload.upcoming[0] ? payload.upcoming[0] : null;

    el.epgBar.hidden = false;
    el.epgNone.hidden = true;
    el.epgNowTitle.textContent = now
      ? `${now.title}${now.episodeTitle ? ' – ' + now.episodeTitle : ''}`
      : 'Nincs aktuális műsor';
    el.epgNowTime.textContent = fmtRange(now);
    el.epgNextTitle.textContent = next ? next.title : '–';
    el.epgNextTime.textContent = next ? fmtRange(next) : '';
    updateEpgProgress(now);
  }

  async function loadEpgForChannel(channel, { force = false } = {}) {
    if (!channel) return;
    const cached = state.epg.get(channel.channelId);
    if (!force && cached && Date.now() - cached.updatedAt < 5 * 60 * 1000) {
      renderEpgBar(cached);
      return;
    }

    try {
      const payload = await fetchJson(`/api/tv/epg/${encodeURIComponent(channel.channelId)}${force ? '?fresh=1' : ''}`, 15000);
      state.epg.set(channel.channelId, payload);
      if (state.current && state.current.channelId === channel.channelId) renderEpgBar(payload);
    } catch (error) {
      if (state.current && state.current.channelId === channel.channelId) {
        el.epgBar.hidden = true;
        el.epgNone.hidden = false;
      }
    }
  }

  function startEpgWatcher() {
    clearInterval(state.epgTimer);
    state.epgTimer = setInterval(() => {
      if (state.current) loadEpgForChannel(state.current, { force: true });
    }, 5 * 60 * 1000);

    clearInterval(state.epgTickTimer);
    state.epgTickTimer = setInterval(() => {
      const payload = state.current ? state.epg.get(state.current.channelId) : null;
      updateEpgProgress(payload && payload.current);
    }, 30 * 1000);
  }

  function epgRowSkeleton() {
    return `<div class="epg-row skeleton">
      <span></span><span class="sk w1"></span><span class="sk w2"></span><span class="sk w1"></span><span></span>
    </div>`;
  }

  async function renderEpgTab({ force = false } = {}) {
    const category = state.category === 'all' ? '' : state.category;

    el.epgList.innerHTML = Array.from({ length: 10 }, epgRowSkeleton).join('');
    el.epgProgressBar.classList.add('on');

    try {
      const data = await fetchJson(`/api/tv/epg?category=${encodeURIComponent(category)}${force ? '&fresh=1' : ''}`, 45000);
      state.epgCategory = category;
      el.epgStamp.textContent = `${data.withEpg}/${data.total} csatorna műsorral · ${fmtTime(data.generatedAt)}`;

      el.epgList.innerHTML = data.channels.map(channel => {
        const now = channel.current;
        const next = channel.next;
        const active = state.current && state.current.channelId === channel.channelId;
        return `<button class="epg-row ${active ? 'on' : ''}" data-epg-id="${escapeHtml(channel.channelId)}">
          <img src="${escapeHtml(channel.logo)}" alt="" loading="lazy" />
          <span class="epg-chname">${escapeHtml(channel.name)}</span>
          <span class="epg-cell now">
            <span class="t">${now ? escapeHtml(now.title) : '<span class="none">nincs műsorinfó</span>'}</span>
            <span class="s">${now ? fmtRange(now) : ''}</span>
          </span>
          <span class="epg-cell next">
            <span class="t">${next ? escapeHtml(next.title) : '–'}</span>
            <span class="s">${next ? fmtRange(next) : ''}</span>
          </span>
          <span class="epg-play" aria-hidden="true">▶</span>
        </button>`;
      }).join('');
    } catch (error) {
      el.epgList.innerHTML = `<div class="empty-state">Műsorújság betöltése nem sikerült: ${escapeHtml(error.message)}</div>`;
    } finally {
      el.epgProgressBar.classList.remove('on');
    }
  }

  function fmtClock(ms) {
    return new Date(ms).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  }

  function markEpgActive() {
    if (!el.epgGrid) return;
    el.epgGrid.querySelectorAll('.eg-block').forEach(block => {
      block.classList.toggle('on', Boolean(state.current && block.dataset.epgId === state.current.channelId));
    });
  }

  function renderEpgGrid(data) {
    state.epgGridData = data;
    state.epgGridCategory = data.category || '';

    const fromMs = data.fromMs;
    const toMs = data.toMs;
    const trackWidth = Math.round(((toMs - fromMs) / 60000) * EPG_PX_PER_MIN);
    const nowOffset = Math.max(0, Math.round(((Date.now() - fromMs) / 60000) * EPG_PX_PER_MIN));

    const hourCells = [];
    for (let hour = 0; hour <= data.hours; hour += 1) {
      const stamp = fromMs + hour * 3600000;
      hourCells.push(`<div class="eg-hour" style="left:${hour * 60 * EPG_PX_PER_MIN}px">${fmtClock(stamp)}</div>`);
    }

    const rows = data.channels.map(channel => {
      const blocks = channel.programmes.map(program => {
        const left = ((program.startMs - fromMs) / 60000) * EPG_PX_PER_MIN;
        const width = Math.max(16, ((program.endMs - program.startMs) / 60000) * EPG_PX_PER_MIN - 2);
        const active = state.current && state.current.channelId === channel.channelId;
        return `<button class="eg-block ${active ? 'on' : ''}" data-epg-id="${escapeHtml(channel.channelId)}" style="left:${left.toFixed(1)}px;width:${width.toFixed(1)}px" title="${escapeHtml(program.title)} · ${program.startHm}–${program.endHm}">
          <span class="t">${escapeHtml(program.title)}</span><span class="s">${program.startHm}–${program.endHm}</span>
        </button>`;
      }).join('');

      return `<div class="eg-row">
        <div class="eg-ch"><img src="${escapeHtml(channel.logo)}" alt="" loading="lazy" /><span>${escapeHtml(channel.name)}</span></div>
        <div class="eg-track" style="width:${trackWidth}px">${blocks || '<span class="eg-none">nincs műsorinfó</span>'}</div>
      </div>`;
    }).join('');

    el.epgGrid.innerHTML = `<div class="eg-head"><div class="eg-corner">Csatorna</div><div class="eg-hours" style="width:${trackWidth}px">${hourCells.join('')}</div></div>
      <div class="eg-body"><div class="eg-now" style="left:calc(168px + ${nowOffset}px)"></div>${rows}</div>`;

    el.epgWindow.textContent = `${fmtClock(fromMs)} → ${fmtClock(toMs)}`;
  }

  async function loadEpgGrid({ force = false } = {}) {
    const category = state.category === 'all' ? '' : state.category;
    el.epgGridWrap.hidden = false;
    el.epgList.hidden = true;

    if (!state.epgGridData || state.epgGridCategory !== category || force) {
      el.epgGrid.innerHTML = '<div class="eg-loading"><span class="spinner" style="display:inline-block"></span><div class="muted" style="margin-top:10px;font-size:12px">Műsorújság betöltése…</div></div>';
      el.epgProgressBar.classList.add('on');

      try {
        const data = await fetchJson(`/api/tv/epg/grid?category=${encodeURIComponent(category)}&hours=12${force ? '&fresh=1' : ''}`, 60000);
        renderEpgGrid(data);
        el.epgStamp.textContent = `${data.withData}/${data.total} csatorna · ${fmtTime(data.generatedAt)}`;
        requestAnimationFrame(() => {
          const offset = Math.round(((Date.now() - data.fromMs) / 60000) * EPG_PX_PER_MIN);
          el.epgGridWrap.scrollLeft = Math.max(0, offset - 180);
        });
      } catch (error) {
        el.epgGrid.innerHTML = `<div class="empty-state">Műsorújság betöltése nem sikerült: ${escapeHtml(error.message)}</div>`;
      } finally {
        el.epgProgressBar.classList.remove('on');
      }
    } else {
      renderEpgGrid(state.epgGridData);
    }
  }

  function setEpgView(view, { force = false } = {}) {
    state.epgView = view;
    localStorage.setItem('tv.epgView', view);
    [...el.epgViewToggle.children].forEach(button => button.classList.toggle('on', button.dataset.view === view));

    if (view === 'grid') {
      loadEpgGrid({ force });
    } else {
      el.epgGridWrap.hidden = true;
      el.epgList.hidden = false;
      renderEpgTab({ force });
    }
  }

  /* ---------------- tabs & events ---------------- */

  function switchTab(name) {
    state.tab = name;
    document.querySelectorAll('.tab').forEach(tab => {
      const active = tab.dataset.pane === name;
      tab.classList.toggle('on', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.pane').forEach(pane => pane.classList.toggle('on', pane.id === `pane-${name}`));
    document.querySelector('.stage').classList.toggle('epg-mode', name === 'epg');
    document.querySelector('.shell').classList.toggle('epg-full', name === 'epg');
    if (name === 'epg' && state.theater) setTheater(false);

    // Never keep a stream running (or audio playing) while the player is hidden.
    if (name !== 'grid' && (state.hls || state.mirrorIndex >= 0 || !el.video.paused)) {
      stopPlayback('Lejátszás leállítva — másik nézet megnyitva.');
    }

    el.openLiveBtn.classList.toggle('on', name === 'grid');
    el.openGuideBtn.classList.toggle('on', name === 'epg');

    if (name === 'epg') {
      el.tabHint.textContent = 'port.hu · időszak / most';
      renderEpgCats();
      if (state.epgView === 'grid') loadEpgGrid();
      else renderEpgTab();
    } else {
      el.tabHint.textContent = '';
    }
  }

  function findChannelIdByChannelId(channelId) {
    const match = state.channels.find(channel => channel.channelId === channelId);
    return match ? match.id : channelId;
  }

  function moveChannel(direction) {
    const channels = visibleChannels();
    if (!channels.length) return;
    const currentIndex = state.current ? channels.findIndex(channel => channel.id === state.current.id) : -1;
    const nextIndex = (currentIndex + direction + channels.length) % channels.length;
    const target = channels[nextIndex === -1 ? 0 : nextIndex];
    selectChannel(target.id);
  }

  function bindEvents() {
    el.reloadBtn.addEventListener('click', () => loadChannels({ announce: true }));

    el.openGuideBtn.addEventListener('click', () => {
      switchTab('epg');
      document.getElementById('pane-epg').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    el.openLiveBtn.addEventListener('click', () => {
      switchTab('grid');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    el.epgUrlText.textContent = `${location.origin}/xmltv.php`;
    el.copyEpgUrl.addEventListener('click', async () => {
      const url = `${location.origin}/xmltv.php`;
      try {
        await navigator.clipboard.writeText(url);
      } catch (error) {
        const helper = document.createElement('textarea');
        helper.value = url;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        try { document.execCommand('copy'); } catch (e) {}
        helper.remove();
      }
      toast('EPG URL a vágólapon: <span class="mono">' + escapeHtml(url) + '</span>', 'ok');
    });

    el.search.addEventListener('input', () => {
      state.query = el.search.value;
      renderGrid();
    });

    el.catList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cat]');
      if (!button) return;
      state.category = button.dataset.cat;
      renderCategories();
      renderGrid();
      if (state.tab === 'epg') {
        if (state.epgView === 'grid') loadEpgGrid();
        else renderEpgTab();
      }
    });

    el.grid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-id]');
      if (!card) return;
      // A second click on the already selected channel (re)starts playback.
      selectChannel(card.dataset.id, { autoplay: true });
    });

    el.mirrorStrip.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mirror-index]');
      if (!button) return;
      playMirror(Number(button.dataset.mirrorIndex));
    });

    document.querySelector('.tabs').addEventListener('click', (event) => {
      const tab = event.target.closest('.tab');
      if (tab) switchTab(tab.dataset.pane);
    });

    el.nextMirrorBtn.addEventListener('click', () => {
      if (!state.current) return;
      const next = (state.mirrorIndex + 1) % state.mirrorOrder.length;
      playMirror(next);
    });

    el.qualitySelect.addEventListener('change', () => {
      if (!state.hls) return;
      const value = Number(el.qualitySelect.value);
      state.hls.currentLevel = value;
    });

    el.relayBtn.classList.toggle('on', state.relay);
    el.relayBtn.addEventListener('click', () => {
      state.relay = !state.relay;
      localStorage.setItem('tv.relay', state.relay ? '1' : '0');
      el.relayBtn.classList.toggle('on', state.relay);
      toast(state.relay
        ? 'Relay mód bekapcsolva — a videó a szerveren keresztül megy.'
        : 'Relay mód kikapcsolva — közvetlen lejátszás.', 'warn');
      if (state.current && state.mirrorIndex >= 0) playMirror(state.mirrorIndex);
    });

    el.theaterBtn.addEventListener('click', () => setTheater(!state.theater));

    el.fullscreenBtn.addEventListener('click', () => {
      const target = el.video;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (target.requestFullscreen) target.requestFullscreen();
    });

    el.epgList.addEventListener('click', (event) => {
      const row = event.target.closest('[data-epg-id]');
      if (!row) return;
      selectChannel(findChannelIdByChannelId(row.dataset.epgId), { autoplay: true });
      switchTab('grid');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    el.epgCats.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cat]');
      if (!button) return;
      state.category = button.dataset.cat;
      renderCategories();
      renderGrid();
      renderEpgCats();
      if (state.epgView === 'grid') loadEpgGrid({ force: true });
      else renderEpgTab({ force: true });
    });

    el.epgRefresh.addEventListener('click', () => {
      if (state.current) loadEpgForChannel(state.current, { force: true });
      if (state.epgView === 'grid') loadEpgGrid({ force: true });
      else renderEpgTab({ force: true });
    });

    el.epgFullscreen.addEventListener('click', () => {
      const pane = document.getElementById('pane-epg');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (pane.requestFullscreen) pane.requestFullscreen().catch(() => {});
    });

    el.epgViewToggle.addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (button) setEpgView(button.dataset.view);
    });

    el.epgGrid.addEventListener('click', (event) => {
      const block = event.target.closest('[data-epg-id]');
      if (!block) return;
      selectChannel(findChannelIdByChannelId(block.dataset.epgId), { autoplay: true });
      switchTab('grid');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelector('.video-wrap').addEventListener('click', (event) => {
      if (event.target.closest('video') && state.hls) return; // native controls handle their own clicks
      if (!state.current || state.mirrorIndex < 0) {
        if (state.current) playMirror(0);
        return;
      }
      if (el.video.paused) el.video.play().catch(() => {});
      else el.video.pause();
    });

    el.video.addEventListener('playing', () => {
      el.liveBadge.classList.remove('idle');
      setStatus(`Lejátszás: ${state.current?.name || ''}`, 'ok');
    });

    el.video.addEventListener('pause', () => {
      el.liveBadge.classList.add('idle');
    });

    el.video.addEventListener('waiting', () => {
      setStatus('Pufferelés…', 'warn');
    });

    el.video.addEventListener('error', () => {
      if (state.hls) return; // hls.js reports through its own event
      if (state.current && state.mirrorIndex >= 0) tryNextMirror('Lejátszó hiba');
    });

    document.addEventListener('keydown', (event) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (event.key === 'Escape') document.activeElement.blur();
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        el.search.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveChannel(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveChannel(-1);
      } else if (event.key.toLowerCase() === 'm') {
        el.video.muted = !el.video.muted;
      } else if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen();
        else el.video.requestFullscreen?.();
      } else if (event.key.toLowerCase() === 't') {
        setTheater(!state.theater);
      } else if (event.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (state.theater) setTheater(false);
      }
    });
  }

  function startClock() {
    const tick = () => {
      el.playerClock.textContent = new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    };
    tick();
    state.clockTimer = setInterval(tick, 15000);
  }

  /* ---------------- boot ---------------- */

  bindEvents();
  startClock();
  startEpgWatcher();
  document.body.classList.toggle('theater', state.theater);

  const openGuideFromHash = () => {
    if (location.hash !== '#epg') return;
    switchTab('epg');
    setTimeout(() => document.getElementById('pane-epg').scrollIntoView({ block: 'start' }), 400);
  };
  openGuideFromHash();
  window.addEventListener('hashchange', openGuideFromHash);
  [...el.epgViewToggle.children].forEach(button => button.classList.toggle('on', button.dataset.view === state.epgView));
  el.epgList.hidden = state.epgView === 'grid';
  loadChannels();

  // Refresh the Git list + health on tab focus (throttled to once a minute).
  let lastFocusRefresh = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastFocusRefresh < 60000) return;
    lastFocusRefresh = Date.now();
    loadChannels({ announce: false });
  });
})();
