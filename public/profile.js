/* Profil készítő: category/source selection -> stateless playlist + EPG URLs. */

(() => {
  'use strict';

  const BASE_PREFIX = window.__BASE_PREFIX || '';
  const $ = (id) => document.getElementById(id);

  const state = {
    categories: [],
    sources: [],
    selectedCats: new Set(),
    selectedSources: new Set(),
    totalChannels: 0
  };

  const el = {
    catList: $('catList'), srcList: $('srcList'),
    preview: $('preview'), urlList: $('urlList'),
    profileName: $('profileName'), saveProfile: $('saveProfile'), savedList: $('savedList'),
    shareBtn: $('shareBtn'), resetBtn: $('resetBtn'), toastWrap: $('toastWrap')
  };

  const base = location.origin + BASE_PREFIX;
  const SAVED_KEY = 'tv.profiles';

  /* ---------------- helpers ---------------- */

  function toast(message, kind = 'ok') {
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.innerHTML = `<span class="led"></span><span>${escapeHtml(message)}</span>`;
    el.toastWrap.appendChild(node);
    setTimeout(() => { node.style.opacity = '0'; node.style.transition = 'opacity .25s'; }, 3200);
    setTimeout(() => node.remove(), 3600);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      try { document.execCommand('copy'); } catch (e) {}
      helper.remove();
    }
    toast(message);
  }

  function catsParam() {
    if (state.selectedCats.size === state.categories.length) return '';
    return state.categories
      .filter(category => state.selectedCats.has(category.id))
      .map(category => category.id)
      .join(',');
  }

  function sourcesParam() {
    if (state.selectedSources.size === state.sources.length) return '';
    return state.sources
      .filter(source => state.selectedSources.has(source.id))
      .map(source => source.id)
      .join(',');
  }

  function selectedChannelCount() {
    return state.categories
      .filter(category => state.selectedCats.has(category.id))
      .reduce((sum, category) => sum + category.count, 0);
  }

  /* ---------------- option rendering ---------------- */

  function renderOptions(container, items, selected, kind) {
    container.innerHTML = items.map(item => `
      <label class="opt ${selected.has(item.id) ? 'on' : ''}">
        <input type="checkbox" data-kind="${kind}" value="${escapeHtml(item.id)}" ${selected.has(item.id) ? 'checked' : ''} />
        <span class="box" aria-hidden="true"></span>
        <span class="name">${escapeHtml(stripEmoji(item.name))}</span>
        <span class="count">${item.count != null ? item.count : ''}</span>
      </label>`).join('');

    container.querySelectorAll('input[data-kind]').forEach(input => {
      input.addEventListener('change', () => {
        const set = input.dataset.kind === 'cats' ? state.selectedCats : state.selectedSources;
        if (input.checked) set.add(input.value); else set.delete(input.value);
        input.closest('.opt').classList.toggle('on', input.checked);
        update();
      });
    });
  }

  function stripEmoji(value) {
    return String(value || '').replace(/^\p{Extended_Pictographic}+\s*/u, '');
  }

  function setAll(kind, checked) {
    const set = kind === 'cats' ? state.selectedCats : state.selectedSources;
    const items = kind === 'cats' ? state.categories : state.sources;
    set.clear();
    if (checked) items.forEach(item => set.add(item.id));
    renderOptions(kind === 'cats' ? el.catList : el.srcList, items, set, kind);
    update();
  }

  /* ---------------- URL building ---------------- */

  function buildRows() {
    const cats = catsParam();
    const sources = sourcesParam();
    const q = cats ? `?cats=${encodeURIComponent(cats)}` : '';
    const qs = sources ? `?sources=${encodeURIComponent(sources)}` : '';
    const xtreamHost = cats ? `${base}/pf/${encodeURIComponent(cats)}` : base;

    return [
      { key: 'auto', label: 'M3U · auto tükör', desc: 'TiviMate / Kodi — minden csatorna a legjobb élő tükörre mutat', value: `${base}/tv.m3u${q}` },
      { key: 'all', label: 'M3U · minden tükör', desc: 'az összes tartalék URL külön bejegyzésként', value: `${base}/playlist-all.m3u${q}` },
      { key: 'xspf', label: 'XSPF · VLC / Kodi', desc: 'lejátszási lista VLC-hez', value: `${base}/playlist.xspf${q}` },
      { key: 'epg', label: 'EPG · XMLTV', desc: 'műsorújság a kijelölt csatornákhoz', value: `${base}/xmltv.php${q}` },
      { key: 'xtream', label: 'Xtream Codes host', desc: 'TiviMate Xtream account — user/pass: bármi', value: xtreamHost },
      { key: 'addon', label: 'Nuvio / Stremio manifest', desc: 'csak a kijelölt VOD forrásokkal', value: `${base}/manifest.json${qs}` }
    ];
  }

  function renderUrls() {
    const valid = state.selectedCats.size > 0;
    const rows = buildRows();

    el.urlList.innerHTML = rows.map(row => `
      <div class="url-row" data-key="${row.key}">
        <div class="lbl"><b>${escapeHtml(row.label)}</b><span>· ${escapeHtml(row.desc)}</span></div>
        <div class="val">
          <input type="text" readonly value="${escapeHtml(row.value)}" aria-label="${escapeHtml(row.label)}" />
          <button type="button" data-copy="${escapeHtml(row.value)}" title="Másolás" ${valid ? '' : 'disabled'}>📋</button>
          <a class="open" href="${escapeHtml(row.value)}" target="_blank" rel="noopener" title="Megnyitás" ${valid ? '' : 'style="opacity:.4;pointer-events:none"'}>↗</a>
        </div>
      </div>`).join('');

    el.urlList.querySelectorAll('[data-copy]').forEach(button => {
      button.addEventListener('click', () => copyText(button.dataset.copy, 'URL a vágólapon'));
    });

    const count = selectedChannelCount();
    el.preview.textContent = valid
      ? `${count} csatorna · ${state.selectedSources.size} VOD forrás`
      : 'Válassz legalább egy élő TV kategóriát!';
    el.preview.classList.toggle('warn', !valid);
  }

  function update() {
    renderUrls();
    updateUrlHash();
  }

  function updateUrlHash() {
    const params = new URLSearchParams();
    const cats = catsParam();
    const sources = sourcesParam();
    if (cats) params.set('cats', cats);
    if (sources) params.set('sources', sources);
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? '?' + query : ''}`);
  }

  /* ---------------- saved profiles ---------------- */

  function loadSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function storeSaved(list) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function renderSaved() {
    const list = loadSaved();
    if (!list.length) {
      el.savedList.innerHTML = '<span class="saved-empty">Még nincs mentett profil.</span>';
      return;
    }

    el.savedList.innerHTML = list.map((profile, index) => `
      <div class="saved-item">
        <span class="nm">${escapeHtml(profile.name)}</span>
        <span class="meta">${(profile.cats || []).length} kat. · ${(profile.sources || []).length} forrás</span>
        <button type="button" data-load="${index}">Betöltés</button>
        <button type="button" data-del="${index}" title="Törlés">✕</button>
      </div>`).join('');

    el.savedList.querySelectorAll('[data-load]').forEach(button => {
      button.addEventListener('click', () => {
        const profile = loadSaved()[Number(button.dataset.load)];
        if (!profile) return;
        state.selectedCats = new Set(profile.cats || []);
        state.selectedSources = new Set(profile.sources || []);
        renderOptions(el.catList, state.categories, state.selectedCats, 'cats');
        renderOptions(el.srcList, state.sources, state.selectedSources, 'src');
        update();
        toast(`Profil betöltve: ${profile.name}`);
      });
    });

    el.savedList.querySelectorAll('[data-del]').forEach(button => {
      button.addEventListener('click', () => {
        const list = loadSaved();
        const [removed] = list.splice(Number(button.dataset.del), 1);
        storeSaved(list);
        renderSaved();
        if (removed) toast(`Törölve: ${removed.name}`, 'ok');
      });
    });
  }

  function saveProfile() {
    const name = el.profileName.value.trim();
    if (!name) {
      el.profileName.focus();
      toast('Adj nevet a profilnak.', 'err');
      return;
    }
    if (state.selectedCats.size === 0) {
      toast('Legalább egy kategória kell.', 'err');
      return;
    }

    const list = loadSaved().filter(profile => profile.name !== name);
    list.unshift({
      name,
      cats: [...state.selectedCats],
      sources: [...state.selectedSources],
      savedAt: Date.now()
    });
    storeSaved(list.slice(0, 30));
    el.profileName.value = '';
    renderSaved();
    toast(`Profil mentve: ${name}`);
  }

  /* ---------------- init ---------------- */

  async function init() {
    try {
      const response = await fetch(BASE_PREFIX + '/api/profile/options', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      state.categories = data.categories || [];
      state.sources = data.sources || [];
      state.totalChannels = data.totalChannels || 0;

      const params = new URLSearchParams(location.search);
      const catsRaw = params.get('cats');
      const sourcesRaw = params.get('sources');

      const validCatIds = new Set(state.categories.map(category => category.id));
      const validSourceIds = new Set(state.sources.map(source => source.id));

      const catsFromUrl = catsRaw
        ? catsRaw.split(',').map(value => value.trim()).filter(value => validCatIds.has(value))
        : [];
      const sourcesFromUrl = sourcesRaw
        ? sourcesRaw.split(',').map(value => value.trim()).filter(value => validSourceIds.has(value))
        : [];

      state.selectedCats = new Set(catsFromUrl.length ? catsFromUrl : state.categories.map(category => category.id));
      state.selectedSources = new Set(sourcesFromUrl.length ? sourcesFromUrl : state.sources.map(source => source.id));

      renderOptions(el.catList, state.categories, state.selectedCats, 'cats');
      renderOptions(el.srcList, state.sources, state.selectedSources, 'src');
      renderSaved();
      update();
    } catch (error) {
      el.urlList.innerHTML = `<div class="saved-empty">Betöltési hiba: ${escapeHtml(error.message)}</div>`;
    }
  }

  el.saveProfile.addEventListener('click', saveProfile);
  el.profileName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveProfile();
  });

  el.shareBtn.addEventListener('click', () => {
    copyText(location.href, 'Profil link a vágólapon');
  });

  el.resetBtn.addEventListener('click', () => {
    state.selectedCats = new Set(state.categories.map(category => category.id));
    state.selectedSources = new Set(state.sources.map(source => source.id));
    renderOptions(el.catList, state.categories, state.selectedCats, 'cats');
    renderOptions(el.srcList, state.sources, state.selectedSources, 'src');
    update();
    toast('Alaphelyzet visszaállítva');
  });

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (!action) return;
    if (action === 'all-cats') setAll('cats', true);
    if (action === 'none-cats') setAll('cats', false);
    if (action === 'all-src') setAll('src', true);
    if (action === 'none-src') setAll('src', false);
  });

  init();
})();
