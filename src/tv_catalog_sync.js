/**
 * Git auto-sync for the Live TV catalog.
 *
 * The running server periodically pulls public/tv-channels.json from GitHub
 * (raw, then jsDelivr) and hot-swaps the in-memory channel list, so a channel
 * added to the repo goes live without a redeploy. The code catalog stays the
 * fallback: any fetch/validation failure keeps the previous list untouched.
 */

const {
  ALL_CHANNELS,
  ONLINESTREAM_CATEGORIES,
  applyRuntimeCatalog
} = require('./scrapers/onlinestream');
const { ensureLoaded, mergeWithLocals, getLocalSummary, getLocalChannels, getLocalSignature } = require('./local_channels');

const DEFAULT_SOURCES = [
  'https://raw.githubusercontent.com/Player798xy/nuvio-magyar-http/main/public/tv-channels.json',
  'https://cdn.jsdelivr.net/gh/Player798xy/nuvio-magyar-http@main/public/tv-channels.json'
];

const FETCH_TIMEOUT_MS = 12000;
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const MIN_CHANNELS = 10;
const USER_AGENT = 'NuvioMagyarTV/1.0 (+https://nuvio-magyar-http.onrender.com)';

function parseInterval(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(parsed, 5 * 60 * 1000), 7 * 24 * 60 * 60 * 1000);
}

const SYNC_INTERVAL_MS = parseInterval(process.env.TV_CATALOG_SYNC_MS, 12 * 60 * 60 * 1000);

// Deep-ish copy of the compiled catalog, used when a bad snapshot must be rolled back.
const CODE_CATALOG = {
  channels: ALL_CHANNELS.map(channel => ({ ...channel, streams: (channel.streams || []).map(stream => ({ ...stream })) })),
  categories: ONLINESTREAM_CATEGORIES.map(category => ({ ...category }))
};

const state = {
  baseChannels: CODE_CATALOG.channels.map(channel => ({ ...channel, streams: (channel.streams || []).map(stream => ({ ...stream })) })),
  baseCategories: CODE_CATALOG.categories.map(category => ({ ...category })),
  localCount: 0,
  appliedLocalSignature: null,
  lastSyncAt: 0,
  lastAttemptAt: 0,
  source: 'code',
  sourceUrl: '',
  ok: false,
  error: null,
  count: CODE_CATALOG.channels.length,
  mirrorCount: CODE_CATALOG.channels.reduce((sum, channel) => sum + (channel.streams || []).length, 0),
  skipped: 0,
  intervalMs: SYNC_INTERVAL_MS,
  inFlight: null
};

function getSources() {
  const override = String(process.env.TV_CATALOG_URL || '').trim();
  if (override) return override.split(',').map(url => url.trim()).filter(Boolean);
  return DEFAULT_SOURCES;
}

async function fetchSnapshot(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Cache-Control': 'no-cache'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_SNAPSHOT_BYTES) throw new Error(`snapshot too large (${declaredSize} bytes)`);

    const text = await response.text();
    if (text.length > MAX_SNAPSHOT_BYTES) throw new Error('snapshot too large');
    return JSON.parse(text);
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'timeout' : (error.message || 'fetch failed'));
  } finally {
    clearTimeout(timer);
  }
}

function normalizeStreams(rawMirrors, releaseInfo) {
  if (!Array.isArray(rawMirrors)) return [];
  const features = String(releaseInfo || '').replace(/^ÉLŐ\s*•\s*/i, '').trim() || 'SD';
  const streams = [];
  const seen = new Set();

  for (const mirror of rawMirrors) {
    const url = String((typeof mirror === 'string' ? mirror : mirror && mirror.url) || '').trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);

    let host = String(mirror && mirror.host || '').trim();
    if (!host) {
      try { host = new URL(url).hostname; } catch (e) { host = ''; }
    }

    streams.push({
      sub_idx: streams.length + 1,
      url,
      host,
      features,
      playerUrl: '',
      onlineUrl: url
    });

    if (streams.length >= 12) break;
  }

  return streams;
}

/**
 * Converts the Git snapshot shape back into the internal ALL_CHANNELS shape.
 * Returns null for rows that cannot be played or identified safely.
 */
function normalizeChannel(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const channelId = String(raw.channelId || '').trim();
  const name = String(raw.name || '').trim();
  if (!channelId || !name) return null;
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(channelId)) return null;

  const streams = normalizeStreams(raw.mirrors, raw.releaseInfo);
  if (!streams.length) return null;

  const id = /^[A-Za-z0-9._:-]{1,80}$/.test(String(raw.id || ''))
    ? String(raw.id)
    : `onlinestream-live-${channelId}`;

  return {
    id,
    channelId,
    name,
    category: String(raw.category || '').trim(),
    type: 'movie',
    year: raw.releaseInfo || 'ÉLŐ',
    releaseInfo: raw.releaseInfo || 'ÉLŐ',
    description: String(raw.description || ''),
    mtvaKey: null,
    streams,
    behaviorHints: {
      defaultVideoId: id,
      isLive: true
    }
  };
}

function normalizeCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) return [];
  const seen = new Set();

  return rawCategories
    .map(category => {
      const id = String(category && category.id || '').trim();
      const name = String(category && category.name || '').trim();
      if (!id || !name || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name,
        type: 'movie',
        category: 'tv',
        description: String(category.description || ''),
        defaultEnabled: true,
        count: Number(category.count) || 0
      };
    })
    .filter(Boolean);
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.channels)) {
    throw new Error('snapshot has no channels array');
  }

  const categories = normalizeCategories(snapshot.categories);
  if (!categories.length) throw new Error('snapshot has no valid categories');

  const channels = [];
  const seen = new Set();
  let skipped = 0;

  for (const raw of snapshot.channels) {
    const channel = normalizeChannel(raw);
    if (!channel || seen.has(channel.channelId)) {
      skipped += 1;
      continue;
    }
    seen.add(channel.channelId);
    channels.push(channel);
  }

  if (channels.length < MIN_CHANNELS) {
    throw new Error(`snapshot rejected: only ${channels.length} valid channels`);
  }
  if (channels.length < snapshot.channels.length * 0.5) {
    throw new Error(`snapshot rejected: ${skipped} invalid rows`);
  }

  const knownCategories = new Set(categories.map(category => category.id));
  for (const channel of channels) {
    if (!knownCategories.has(channel.category)) channel.category = categories[0].id;
  }

  return { channels, categories, skipped };
}

function invalidateCaches() {
  try {
    require('./tv_health').invalidateCaches();
  } catch (e) {}
  try {
    require('./xtream').invalidatePayloadCache();
  } catch (e) {}
  try {
    require('./tv_epg').invalidateEpgCaches();
  } catch (e) {}
}

function refreshLocalOverlay({ force = false } = {}) {
  const changed = ensureLoaded({ force });
  const signature = getLocalSignature();
  // Re-merging invalidates the health caches, so only do it when something actually changed.
  if (!force && !changed && signature === state.appliedLocalSignature) return false;

  const local = getLocalChannels();
  const merged = mergeWithLocals(state.baseChannels, state.baseCategories, local);
  applyRuntimeCatalog(merged.channels, merged.categories);
  state.appliedLocalSignature = signature;
  state.localCount = local.channels.length;
  state.count = merged.channels.length;
  state.mirrorCount = merged.channels.reduce((sum, channel) => sum + (channel.streams || []).length, 0);
  invalidateCaches();
  return true;
}

function applyBaseCatalog(channels, categories) {
  state.baseChannels = (channels || []).map(channel => ({ ...channel, streams: (channel.streams || []).map(stream => ({ ...stream })) }));
  state.baseCategories = (categories || []).map(category => ({ ...category }));
  refreshLocalOverlay({ force: true });
}

function applySnapshot(snapshot) {
  applyBaseCatalog(snapshot.channels, snapshot.categories);
}

/**
 * Pulls the Git snapshot and swaps the catalog. Safe to call concurrently:
 * parallel callers share the same promise.
 */
function syncNow({ force = false } = {}) {
  if (state.inFlight) return state.inFlight;
  // Global throttle: no more than one fetch per 15s even when force=1 is spammed.
  if (state.lastAttemptAt && Date.now() - state.lastAttemptAt < 15 * 1000) {
    return Promise.resolve({ ...state, skippedRun: true });
  }
  if (!force && state.lastAttemptAt && Date.now() - state.lastAttemptAt < 60 * 1000) {
    return Promise.resolve({ ...state, skippedRun: true });
  }

  state.lastAttemptAt = Date.now();

  state.inFlight = (async () => {
    const errors = [];

    for (const url of getSources()) {
      try {
        const raw = await fetchSnapshot(url);
        const snapshot = normalizeSnapshot(raw);
        applySnapshot(snapshot);

        state.ok = true;
        state.error = null;
        state.source = 'git';
        state.sourceUrl = url;
        state.lastSyncAt = Date.now();
        state.skipped = snapshot.skipped;

        console.log(`[catalog-sync] ${state.count} csatorna / ${state.mirrorCount} tükör frissítve (${url.split('/')[2]})`);
        return { ...state, inFlight: null };
      } catch (error) {
        errors.push(`${url.split('/')[2]}: ${error.message}`);
      }
    }

    state.ok = false;
    state.error = errors.join(' | ');
    console.warn(`[catalog-sync] sikertelen frissítés, korábbi lista marad: ${state.error}`);
    return { ...state, inFlight: null };
  })().finally(() => {
    state.inFlight = null;
    state.nextSyncAt = Date.now() + SYNC_INTERVAL_MS;
  });

  return state.inFlight;
}

function resetToCodeCatalog() {
  applyBaseCatalog(CODE_CATALOG.channels, CODE_CATALOG.categories);
  state.ok = false;
  state.source = 'code';
  state.lastSyncAt = Date.now();
  state.count = CODE_CATALOG.channels.length;
  state.mirrorCount = CODE_CATALOG.channels.reduce((sum, channel) => sum + channel.streams.length, 0);
}

/**
 * Called on incoming requests: if the last successful sync is older than the
 * interval (free hosts sleep, so timers can miss), refresh in the background.
 */
function maybeSyncIfStale() {
  // Local channel files are checked first: one stat call per file.
  try { refreshLocalOverlay(); } catch (e) {}
  if (state.inFlight) return;
  if (!state.lastSyncAt || Date.now() - state.lastSyncAt > SYNC_INTERVAL_MS) {
    syncNow().catch(() => {});
  }
}

function startAutoSync() {
  try { refreshLocalOverlay({ force: true }); } catch (e) {}
  syncNow().catch(() => {});
  const timer = setInterval(() => syncNow().catch(() => {}), SYNC_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

function getSyncStatus() {
  return {
    enabled: true,
    source: state.source,
    sourceUrl: state.sourceUrl,
    ok: state.ok,
    error: state.error,
    lastSyncAt: state.lastSyncAt,
    lastAttemptAt: state.lastAttemptAt,
    nextSyncAt: state.nextSyncAt || (state.lastSyncAt ? state.lastSyncAt + SYNC_INTERVAL_MS : 0),
    intervalMs: SYNC_INTERVAL_MS,
    count: state.count,
    mirrorCount: state.mirrorCount,
    skipped: state.skipped,
    local: getLocalSummary(),
    inFlight: Boolean(state.inFlight)
  };
}

module.exports = {
  startAutoSync,
  syncNow,
  maybeSyncIfStale,
  getSyncStatus,
  resetToCodeCatalog,
  normalizeSnapshot,
  SYNC_INTERVAL_MS
};
