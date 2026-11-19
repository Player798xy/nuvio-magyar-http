/**
 * Live HLS health checker for the /tv viewer.
 *
 * Probes a stream URL the same way a browser would (master playlist -> best
 * variant -> media playlist -> first segment) and reports status, latency,
 * buffer depth, resolution, CORS and throughput. Results are cached in bounded
 * caches so a dashboard refresh never re-hammers the upstream hosts.
 *
 * Nothing is proxied here: probes only read a few KB, playback stays direct.
 */

const { createBoundedCache } = require('./cache');
const { ALL_CHANNELS } = require('./scrapers/onlinestream');
const { getStreamTargets } = require('./playlists');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const PLAYLIST_TIMEOUT_MS = 3500;
const SEGMENT_TIMEOUT_MS = 4000;
const SEGMENT_PROBE_BYTES = 262144;
const MIRROR_CACHE_TTL_MS = 60 * 1000;
const PLAYER_CONCURRENCY = 16;

const mirrorCache = createBoundedCache({ maxEntries: 900, ttlMs: MIRROR_CACHE_TTL_MS });
const inflight = new Map();

function dedupe(key, factory) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = Promise.resolve()
    .then(factory)
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

function parseAttributes(raw) {
  const attrs = {};
  String(raw || '').replace(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g, (_, key, value) => {
    attrs[key] = String(value).replace(/^"|"$/g, '');
    return '';
  });
  return attrs;
}

/**
 * Parses a master or media playlist without allocating anything heavy.
 */
function parsePlaylist(text, baseUrl) {
  const lines = String(text || '').split(/\r?\n/);
  const variants = [];
  const segments = [];
  let pendingVariant = null;
  let pendingDuration = null;
  let encrypted = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-STREAM-INF:'.length));
      const resolution = /^(\d+)x(\d+)$/.exec(attrs.RESOLUTION || '');
      pendingVariant = {
        bandwidth: Number(attrs.BANDWIDTH) || 0,
        width: resolution ? Number(resolution[1]) : 0,
        height: resolution ? Number(resolution[2]) : 0,
        resolution: attrs.RESOLUTION || '',
        frameRate: attrs['FRAME-RATE'] || '',
        codecs: attrs.CODECS || ''
      };
      continue;
    }

    if (line.startsWith('#EXT-X-KEY:') && /METHOD=(?!NONE)/i.test(line)) {
      encrypted = true;
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([0-9.]+)/);
      pendingDuration = match ? Number(match[1]) : 0;
      continue;
    }

    if (line.startsWith('#')) continue;

    let absoluteUrl;
    try { absoluteUrl = new URL(line, baseUrl).toString(); } catch (e) { continue; }

    if (pendingVariant) {
      variants.push({ ...pendingVariant, url: absoluteUrl });
      pendingVariant = null;
    } else if (pendingDuration !== null) {
      segments.push({ duration: pendingDuration, url: absoluteUrl });
      pendingDuration = null;
    }
  }

  const bufferSec = Math.round(segments.reduce((sum, seg) => sum + seg.duration, 0) * 10) / 10;
  return {
    isMaster: variants.length > 0,
    variants,
    segments,
    segmentCount: segments.length,
    bufferSec,
    encrypted,
    firstSegmentUrl: segments.length ? segments[0].url : null
  };
}

function pickVariant(variants) {
  if (!variants.length) return null;
  const scored = [...variants].sort((a, b) => (b.bandwidth - a.bandwidth) || (b.height - a.height));
  return scored[0];
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        'Accept-Language': 'hu-HU,hu;q=0.9,en;q=0.7'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || url,
      contentType: response.headers.get('content-type') || '',
      accessControl: response.headers.get('access-control-allow-origin') || '',
      ttfbMs: Date.now() - startedAt,
      text
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      contentType: '',
      accessControl: '',
      ttfbMs: Date.now() - startedAt,
      text: '',
      error: err.name === 'AbortError' ? 'timeout' : (err.message || 'network error')
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads only the first chunk of a segment to estimate throughput.
 */
async function probeSegment(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Range: `bytes=0-${SEGMENT_PROBE_BYTES - 1}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, status: response.status, ms: Date.now() - startedAt, bytes: 0 };
    }

    let bytes = 0;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      while (bytes < SEGMENT_PROBE_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value ? value.byteLength : 0;
      }
      try { await reader.cancel(); } catch (e) {}
    } else {
      const buffer = await response.arrayBuffer();
      bytes = buffer.byteLength;
    }

    const ms = Math.max(1, Date.now() - startedAt);
    return {
      ok: bytes > 0,
      status: response.status,
      ms,
      bytes,
      mbps: Math.round((bytes * 8) / ms) / 1000
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Math.max(1, Date.now() - startedAt),
      bytes: 0,
      error: err.name === 'AbortError' ? 'timeout' : (err.message || 'network error')
    };
  } finally {
    clearTimeout(timer);
  }
}

function corsVerdict(header) {
  if (!header) return 'missing';
  const value = String(header).toLowerCase();
  if (value.includes('*')) return 'allow';
  return 'restricted';
}

function scoreMirror(result) {
  if (!result.online) return 0;
  let score = 1000;
  if (result.cors === 'allow') score += 300;
  if (result.secure) score += 80;
  score += Math.min(result.bufferSec || 0, 120) * 2;
  score += Math.min(result.segment?.mbps || 0, 120);
  score -= Math.min(result.ttfbMs || 0, 6000) / 25;
  return Math.round(score);
}

/**
 * Probes one mirror URL end to end.
 */
async function probeMirror(rawUrl, { includeSegment = true, fresh = false } = {}) {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return { url, online: false, status: 0, error: 'invalid url', checkedAt: Date.now() };
  }

  const cacheKey = `${includeSegment ? 'deep' : 'fast'}:${url}`;
  if (!fresh) {
    const cached = mirrorCache.get(cacheKey);
    if (cached) return cached;
  }

  let host = '';
  try { host = new URL(url).hostname; } catch (e) {}

  const base = {
    url,
    host,
    secure: url.startsWith('https://'),
    checkedAt: Date.now()
  };

  const playlist = await fetchText(url, PLAYLIST_TIMEOUT_MS);
  if (!playlist.ok || !playlist.text.includes('#EXTM3U')) {
    const result = {
      ...base,
      online: false,
      status: playlist.status,
      error: playlist.error || (playlist.ok ? 'not an HLS playlist' : `HTTP ${playlist.status}`),
      ttfbMs: playlist.ttfbMs,
      cors: corsVerdict(playlist.accessControl),
      variantCount: 0,
      bufferSec: 0
    };
    mirrorCache.set(cacheKey, result);
    return result;
  }

  let parsed = parsePlaylist(playlist.text, playlist.finalUrl);
  let mediaUrl = playlist.finalUrl;
  let variant = null;
  let masterVariantCount = 0;

  if (parsed.isMaster) {
    masterVariantCount = parsed.variants.length;
    const selected = pickVariant(parsed.variants);
    variant = selected;

    // Fast mode stops after the master playlist: enough to know the mirror is
    // alive with one request. Deep mode resolves the media playlist + segment.
    if (selected && includeSegment) {
      const variantPlaylist = await fetchText(selected.url, PLAYLIST_TIMEOUT_MS);
      if (variantPlaylist.ok) {
        parsed = parsePlaylist(variantPlaylist.text, variantPlaylist.finalUrl);
        mediaUrl = variantPlaylist.finalUrl;
      }
    }
  }

  const segment = includeSegment && parsed.firstSegmentUrl
    ? await probeSegment(parsed.firstSegmentUrl)
    : { ok: true, status: 0, ms: 0, bytes: 0, mbps: null, skipped: true };

  const result = {
    ...base,
    online: true,
    status: playlist.status,
    ttfbMs: playlist.ttfbMs,
    cors: corsVerdict(playlist.accessControl),
    variantCount: masterVariantCount,
    variants: parsed.isMaster ? parsed.variants.length : 0,
    resolution: variant ? variant.resolution : '',
    height: variant ? variant.height : 0,
    bandwidth: variant ? variant.bandwidth : 0,
    bufferSec: parsed.bufferSec,
    segmentCount: parsed.segmentCount,
    encrypted: parsed.encrypted,
    mediaUrl,
    segment
  };
  result.score = scoreMirror(result);
  mirrorCache.set(cacheKey, result);
  return result;
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function findChannel(channelId) {
  return ALL_CHANNELS.find(ch => ch.id === channelId || ch.channelId === channelId) || null;
}

/**
 * Full mirror audit of a single channel.
 */
async function checkChannelMirrors(channelId, { fresh = false } = {}) {
  const channel = findChannel(channelId);
  if (!channel) return null;

  return dedupe(`channel:${channel.channelId}:${fresh ? 'fresh' : 'cached'}`, async () => {
    const urls = getStreamTargets(channel);
    const mirrors = await mapPool(urls, Math.min(PLAYER_CONCURRENCY, urls.length || 1),
      url => probeMirror(url, { includeSegment: true, fresh }));

    const ranked = [...mirrors].sort((a, b) => (b.score || 0) - (a.score || 0));
    return {
      id: channel.id,
      channelId: channel.channelId,
      name: channel.name,
      category: channel.category,
      mirrorCount: mirrors.length,
      onlineCount: mirrors.filter(m => m.online).length,
      bestUrl: ranked.find(m => m.online)?.url || null,
      mirrors: ranked,
      checkedAt: Date.now()
    };
  });
}


/**
 * Picks the best playable mirror for a channel and returns the URL a player
 * should be redirected to. Server-side probes may be blocked by geo/IP rules
 * (some local TV feeds only work from Hungarian residential IPs), so when every
 * mirror looks offline we still fall back to the first known URL instead of
 * returning 503 — the player can decide.
 */
async function resolveBestMirror(channelId, { fresh = false } = {}) {
  const channel = findChannel(channelId);
  if (!channel) return null;

  const urls = getStreamTargets(channel);
  if (!urls.length) return null;

  const probes = await mapPool(urls, Math.min(4, urls.length),
    url => probeMirror(url, { includeSegment: false, fresh }));

  const ranked = [...probes].sort((a, b) => (b.score || 0) - (a.score || 0));
  const best = ranked.find(probe => probe.online) || null;

  return {
    channelId: channel.channelId,
    name: channel.name,
    url: best ? (best.mediaUrl || best.url) : urls[0],
    host: best ? best.host : (() => { try { return new URL(urls[0]).hostname; } catch (e) { return ''; } })(),
    online: Boolean(best),
    candidates: ranked.length,
    checkedAt: Date.now()
  };
}

function invalidateCaches() {
  mirrorCache.clear();
}

module.exports = {
  probeMirror,
  checkChannelMirrors,
  parsePlaylist,
  findChannel,
  resolveBestMirror,
  invalidateCaches
};
