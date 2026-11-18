const { getMediaMeta } = require('./utils/meta');
const { searchCatalog, getMeta, HUNGARIAN_CLASSIC_SERIES_IDS } = require('./catalog');
const { CATALOG_DEFINITIONS, getEnabledManifestCatalogs } = require('./catalogs');
const { scrapeVidea } = require('./scrapers/videa');
const { scrapeIndavideo } = require('./scrapers/indavideo');
const { scrapeJobbMintATV } = require('./scrapers/jobbmintatv');
const { scrapeFilmvilag } = require('./scrapers/filmvilag');
const { scrapeDMDAMedia } = require('./scrapers/dmdamedia');
const { scrapeMeseFilm } = require('./scrapers/mesefilm');
const { scrapeFilmezek } = require('./scrapers/filmezek');
const { scrapeOnlineFilmek } = require('./scrapers/onlinefilmek');
const { scrapeHDMozi } = require('./scrapers/hdmozi');
const { scrapeMediaKlikk, getLiveChannelStreams, LIVE_CHANNELS } = require('./scrapers/mediaklikk');
const { getOnlineStreamStreams, getOnlineStreamMeta } = require('./scrapers/onlinestream');
const { getSubtitles } = require('./subtitles');
const { getChannelEpg, formatEpgStreamBanner } = require('./epg');
const { scrapeNetMozi } = require('./scrapers/netmozi');
const { scrapeVideakid } = require('./scrapers/videakid');
const { scrapeSorozatokNet } = require('./scrapers/sorozatok_net');

const FAST_SCRAPER_IDS = new Set([
  'videa',
  'indavideo',
  'jobbmintatv',
  'filmvilag2',
  'mediaklikk',
  'netmozi',
  'hdmozi',
  'filmezek',
  'onlinefilmek',
  'mesefilm',
  'videakid',
  'sorozatoknet',
  'onlinestream'
]);

const ALL_SCRAPERS = [
  { id: 'videa', name: 'Videa', fn: scrapeVidea, fast: true },
  { id: 'indavideo', name: 'Indavideo', fn: scrapeIndavideo, fast: true },
  { id: 'jobbmintatv', name: 'JobbMintATV', fn: scrapeJobbMintATV, fast: true },
  { id: 'hdmozi', name: 'HDMozi', fn: scrapeHDMozi, fast: true },
  { id: 'filmvilag2', name: 'Filmvilág2', fn: scrapeFilmvilag, fast: true },
  { id: 'mediaklikk', name: 'MédiaKlikk', fn: scrapeMediaKlikk, fast: true },
  { id: 'netmozi', name: 'NetMozi', fn: scrapeNetMozi, fast: true },
  { id: 'filmezek', name: 'Filmezek', fn: scrapeFilmezek, fast: true },
  { id: 'onlinefilmek', name: 'OnlineFilmek', fn: scrapeOnlineFilmek, fast: true },
  { id: 'dmdamedia', name: 'DMDAMedia', fn: scrapeDMDAMedia, fast: false },
  { id: 'mesefilm', name: 'MeseFilm', fn: scrapeMeseFilm, fast: true },
  { id: 'videakid', name: 'Videakid', fn: scrapeVideakid, fast: true },
  { id: 'sorozatoknet', name: 'Sorozatok.net', fn: scrapeSorozatokNet, fast: true },
  { id: 'onlinestream', name: 'OnlineStream IPTV', fn: async () => [], fast: true },

  { id: 'onlinestream_local', name: 'OnlineStream Helyi TV-k', fn: async () => [], fast: true }
];

const DEFAULT_CONFIG = {
  sources: ALL_SCRAPERS.map(s => s.id),
  catalogs: CATALOG_DEFINITIONS.filter(c => c.defaultEnabled).map(c => c.id),
  qualities: ['1080p', '720p', '480p', '360p'],
  subtitles: true,
  maxResults: 25
};

const DEFAULT_RENDER_MIGRATION_URL = '';
const DEFAULT_CDN_PUBLIC_BASE = 'https://cdn.jsdelivr.net/gh/Player798xy/nuvio-magyar-http@main/public';
const VOD_STREAM_CACHE = new Map();
const INFLIGHT_VOD_SCRAPES = new Map();
const VOD_CACHE_TTL_MS = 60 * 60 * 1000;
const VOD_EMPTY_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_VOD_CACHE = 100;

function isRenderRuntime() {
  return Boolean(
    process.env.RENDER ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_SERVICE_ID
  );
}

function isVercelRuntime() {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_ENV
  );
}

function isRemoteCloudRuntime() {
  return Boolean(
    isVercelRuntime() ||
    isRenderRuntime() ||
    process.env.NETMOZI_REMOTE === '1'
  );
}

function getCdnPublicBaseUrl() {
  const custom = String(process.env.ASSET_CDN_URL || '').trim().replace(/\/+$/, '');
  if (custom === 'off' || custom === '0' || custom === 'false') return '';
  if (custom) return custom;
  return isRenderRuntime() ? DEFAULT_CDN_PUBLIC_BASE : '';
}

function rewriteStaticAssetUrl(rawUrl, cdnBase = getCdnPublicBaseUrl()) {
  if (!rawUrl || !cdnBase) return rawUrl;
  const s = String(rawUrl).trim();
  const match = s.match(/^https?:\/\/[^/]+(?:\/p\/[^/]+)?\/((?:tv-posters|tv-backgrounds|tv-logos|channels)\/[^?#\s]+\.png|logo\.png|icon\.png)(?:\?[^#\s]*)?$/i);
  if (!match) return s;
  return `${cdnBase}/${match[1]}`;
}

function rewriteMetaMediaUrls(item, cdnBase = getCdnPublicBaseUrl()) {
  if (!item || !cdnBase || typeof item !== 'object') return item;
  const copy = { ...item };
  if (copy.poster) copy.poster = rewriteStaticAssetUrl(copy.poster, cdnBase);
  if (copy.background) copy.background = rewriteStaticAssetUrl(copy.background, cdnBase);
  if (copy.logo) copy.logo = rewriteStaticAssetUrl(copy.logo, cdnBase);
  return copy;
}

function normalizeMigrationUrl(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getMigrationTargetUrl(config = {}) {
  const explicit = normalizeMigrationUrl(config.migrationTargetUrl || process.env.MIGRATION_NOTICE_URL || '');
  if (explicit) return explicit;
  return '';
}

function shouldShowVercelMigrationNotice(config = {}) {
  if (isRenderRuntime()) return false;
  const hostUrl = String(config.hostUrl || '').toLowerCase();
  if (hostUrl.includes('.onrender.com')) return false;
  const targetUrl = getMigrationTargetUrl(config);
  if (!targetUrl) return false;
  if (config.previewMigration) return true;
  return Boolean(isVercelRuntime() || hostUrl.includes('.vercel.app'));
}

function getRuntimeNoticeMeta(config = {}) {
  const hostUrl = String(config.hostUrl || '');
  const showMigrationBanner = shouldShowVercelMigrationNotice(config);
  const migrationTargetUrl = showMigrationBanner
    ? getMigrationTargetUrl(config)
    : normalizeMigrationUrl(process.env.MIGRATION_NOTICE_URL);
  const platform = isRenderRuntime() || hostUrl.toLowerCase().includes('.onrender.com')
    ? 'render'
    : ((isVercelRuntime() || hostUrl.toLowerCase().includes('.vercel.app')) ? 'vercel' : 'local');

  return {
    platform,
    showMigrationBanner,
    migrationTargetUrl,
    defaultRenderUrl: ''
  };
}

function buildVercelMigrationNoticeStream(config = {}) {
  const targetOrigin = getMigrationTargetUrl(config);
  const targetHost = targetOrigin.replace(/^https?:\/\//i, '');
  const vercelOrigin = String(config.hostUrl || 'http://127.0.0.1:7000').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (targetOrigin) {
    params.set('target', targetOrigin);
  }
  if (config.configSlug) {
    params.set('c', config.configSlug);
  }
  const qs = params.toString();
  const qrPageUrl = `${vercelOrigin}/uj-link.html${qs ? `?${qs}` : ''}`;
  const shortQrPath = `${vercelOrigin.replace(/^https?:\/\//i, '')}/uj-link.html`;

  return {
    name: '🟨 ÚJ SZERVER! (VÁLTS)',
    title: [
      '🟨 FIGYELEM: Ez a Vercel szerver hamarosan eléri a havi ingyenes keretet!',
      `👉 Új (korlátlan) Render cím: ${targetHost}/configure`,
      `📱 Telefonos QR-kód és 1-kattintásos telepítés: ${shortQrPath}`,
      '👇 A lejátszáshoz válassz a lenti források közül (ez csak tájékoztató).'
    ].join('\n'),
    externalUrl: qrPageUrl,
    behaviorHints: {
      notWebReady: true
    }
  };
}

function prependVercelNoticeIfNeeded(streams, config = {}) {
  if (!Array.isArray(streams) || streams.length === 0) return [];
  const cloned = streams.map(s => ({ ...s }));
  if (shouldShowVercelMigrationNotice(config)) {
    return [buildVercelMigrationNoticeStream(config), ...cloned];
  }
  return cloned;
}

function getVodCacheKey(type, id, activeScrapers, config) {
  const srcKey = activeScrapers.map(s => s.id).sort().join(',');
  const qualList = config.qualities || config.resolutions || [];
  const qualKey = Array.isArray(qualList) && qualList.length > 0
    ? [...qualList].map(q => String(q).toLowerCase()).sort().join(',')
    : 'all';
  const stageKey = config.stage || 'all';
  const hostScope = isRemoteCloudRuntime() ? 'remote' : (config.clientIp || 'local');
  return `${type}|${id}|${srcKey}|${qualKey}|${stageKey}|${hostScope}`;
}

function setVodCacheEntry(key, value) {
  if (VOD_STREAM_CACHE.size >= MAX_VOD_CACHE) {
    const oldestKey = VOD_STREAM_CACHE.keys().next().value;
    if (oldestKey !== undefined) VOD_STREAM_CACHE.delete(oldestKey);
  }
  VOD_STREAM_CACHE.set(key, {
    ts: Date.now(),
    data: value
  });
}

function parseBoolFlag(val, fallback = true) {
  if (typeof val === 'boolean') return val;
  if (val === 0 || val === '0') return false;
  if (val === 1 || val === '1') return true;
  const s = String(val || '').trim().toLowerCase();
  if (['false', 'off', 'no', 'ki', 'disabled'].includes(s)) return false;
  if (['true', 'on', 'yes', 'be', 'enabled'].includes(s)) return true;
  return fallback;
}

function parseConfig(configStr, query = {}) {
  const config = {
    sources: [...DEFAULT_CONFIG.sources],
    catalogs: [...DEFAULT_CONFIG.catalogs],
    qualities: [...DEFAULT_CONFIG.qualities],
    subtitles: DEFAULT_CONFIG.subtitles,
    timeoutMs: 6500,
    maxResults: 25
  };

  if (query.sources) {
    config.sources = String(query.sources).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  if (query.resolutions || query.qualities) {
    config.qualities = String(query.resolutions || query.qualities).split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
  }
  if (query.catalogs) {
    config.catalogs = String(query.catalogs).split(',').map(c => c.trim()).filter(Boolean);
  }
  if (query.subtitles !== undefined) {
    config.subtitles = parseBoolFlag(query.subtitles, true);
  } else if (query.subs !== undefined) {
    config.subtitles = parseBoolFlag(query.subs, true);
  } else if (query.noSubs !== undefined) {
    config.subtitles = !parseBoolFlag(query.noSubs, false);
  }
  if (query.stage) {
    config.stage = String(query.stage).trim().toLowerCase();
  }
  if (query.previewMigration !== undefined) {
    config.previewMigration = parseBoolFlag(query.previewMigration, false);
  }
  if (query.timeout) {
    const t = parseInt(query.timeout, 10);
    if (!isNaN(t)) config.timeoutMs = t <= 60 ? t * 1000 : t;
  }

  if (!configStr) return config;
  config.configSlug = String(configStr);

  // 1. Base64 / Base64url JSON
  try {
    const decoded = Buffer.from(configStr, 'base64url').toString('utf-8');
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      const parsed = JSON.parse(decoded);
      const qualities = parsed.qualities || parsed.resolutions;
      if (Array.isArray(parsed.sources) && parsed.sources.length) config.sources = parsed.sources;
      if (Array.isArray(parsed.catalogs) && parsed.catalogs.length) config.catalogs = parsed.catalogs;
      if (Array.isArray(qualities) && qualities.length) config.qualities = qualities;
      if (parsed.subtitles !== undefined) {
        config.subtitles = parseBoolFlag(parsed.subtitles, config.subtitles);
      } else if (parsed.subs !== undefined) {
        config.subtitles = parseBoolFlag(parsed.subs, config.subtitles);
      } else if (parsed.noSubs !== undefined) {
        config.subtitles = !parseBoolFlag(parsed.noSubs, false);
      }
      if (parsed.timeout) {
        const t = parseInt(parsed.timeout, 10);
        if (!isNaN(t)) config.timeoutMs = t <= 60 ? t * 1000 : t;
      }
      return config;
    }
  } catch (e) {}

  // 2. Pipe/ampersand delimited key=value (e.g. sources=videa,mediaklikk|res=1080p,720p|timeout=20|cat=...)
  const parts = decodeURIComponent(configStr).split(/[|&;]/);
  for (const part of parts) {
    const [rawKey, rawVal] = part.split(/[=:]/);
    if (!rawKey || !rawVal) continue;
    const key = rawKey.trim().toLowerCase();
    const val = rawVal.trim();
    if (key === 'sources') {
      config.sources = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    } else if (key === 'catalogs' || key === 'cat') {
      config.catalogs = val.split(',').map(c => c.trim()).filter(Boolean);
    } else if (key === 'resolutions' || key === 'res' || key === 'qualities') {
      config.qualities = val.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
    } else if (key === 'subtitles' || key === 'subs') {
      config.subtitles = parseBoolFlag(val, true);
    } else if (key === 'nosubs') {
      config.subtitles = !parseBoolFlag(val, false);
    } else if (key === 'timeout') {
      const t = parseInt(val, 10);
      if (!isNaN(t)) config.timeoutMs = t <= 60 ? t * 1000 : t;
    }
  }

  return config;
}

function getManifest(config = {}) {
  let name = 'Magyar Streaming Pro (HU)';
  let desc = 'Magyar szinkronos filmek, sorozatok, mesék és élő TV csatornák 1080p & 720p minőségben (MédiaKlikk 490+ műsor + Élő TV, Videa, Indavideo, HDMozi, Filmvilág2, JobbMintATV, NetMozi, Filmezek, OnlineFilmek, DMDAMedia, MeseFilm, Videakid, Sorozatok.net).';

  const badges = [];
  if (config.sources && Array.isArray(config.sources) && config.sources.length > 0 && config.sources.length < ALL_SCRAPERS.length) {
    badges.push(`${config.sources.length} forrás`);
  }
  if (config.qualities && Array.isArray(config.qualities) && config.qualities.length > 0 && config.qualities.length < 4) {
    badges.push(config.qualities.join('/'));
  }
  if (config.subtitles === false) {
    badges.push('felirat KI');
  }
  if (badges.length > 0) {
    name = `Magyar Streaming Pro [${badges.join(' • ')}]`;
  }

  const hostUrl = config.hostUrl || process.env.HOST_URL || 'http://127.0.0.1:7000';

  const supportedIdPrefixes = [
    'tt',
    'tmdb:',
    'tvdb:',
    'kitsu:',
    'mal:',
    'anilist:',
    'anidb:',
    'tvmaze:',
    'onlinestream-live-',
    'mediaklikk-live-',
    'mediaklikk:',
    'netmozi:',
    'title:'
  ];

  const resources = [
    {
      name: 'stream',
      types: ['movie', 'series', 'tv', 'channel'],
      idPrefixes: supportedIdPrefixes
    },
    {
      name: 'meta',
      types: ['movie', 'series', 'tv', 'channel'],
      idPrefixes: ['onlinestream-live-', 'mediaklikk-live-', 'mediaklikk:', 'netmozi:', 'tmdb:', ...HUNGARIAN_CLASSIC_SERIES_IDS]
    }
  ];

  if (config.subtitles !== false) {
    resources.push({
      name: 'subtitles',
      types: ['movie', 'series'],
      idPrefixes: ['tt', 'tmdb:']
    });
  }

  resources.push({
    name: 'catalog',
    types: ['movie', 'series', 'tv']
  });

  const cdnBase = getCdnPublicBaseUrl();
  const logoUrl = rewriteStaticAssetUrl(`${hostUrl}/logo.png?v=2.7.0`, cdnBase);

  return {
    id: 'org.nuvio.magyar.http',
    version: '2.7.0',
    name,
    description: desc,
    logo: logoUrl,
    icon: logoUrl,
    background: logoUrl,
    resources,
    types: ['movie', 'series', 'tv', 'channel'],
    idPrefixes: supportedIdPrefixes,
    catalogs: getEnabledManifestCatalogs(config.catalogs),
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    }
  };
}

async function getStreams(type, rawId, config = {}) {
  let id = rawId || '';
  try {
    id = decodeURIComponent(id);
  } catch (e) {}
  id = id.replace(/\.json$/, '');

  // 1. Handle Live TV channels (OnlineStream + MTVA MédiaKlikk) with live EPG banner in parallel
  if (type === 'tv' || type === 'channel' || (id && (id.startsWith('onlinestream-live-') || id.startsWith('mediaklikk-live-')))) {
    const osMeta = getOnlineStreamMeta(id, config.hostUrl);
    const liveCh = LIVE_CHANNELS.find(c => c.id === id || c.channelKey === id);
    const channelName = osMeta?.meta?.name || liveCh?.name || '';

    const [liveStreams, epg] = await Promise.all([
      getOnlineStreamStreams(id, config.clientIp, config.hostUrl, config),
      channelName ? getChannelEpg(channelName, id).catch(() => null) : Promise.resolve(null)
    ]);

    const streams = (liveStreams && liveStreams.length > 0)
      ? liveStreams
      : await getLiveChannelStreams(id, config.clientIp, config.hostUrl);

    const epgBanner = formatEpgStreamBanner(epg);
    const enrichedLiveStreams = (epgBanner && Array.isArray(streams) && streams.length > 0)
      ? streams.map(s => ({
          ...s,
          title: s.title ? `${epgBanner}\n${s.title}` : epgBanner
        }))
      : streams;

    return {
      streams: prependVercelNoticeIfNeeded(enrichedLiveStreams, config)
    };
  }

  if (!id) {
    return { streams: [] };
  }

  // 2. Handle direct MédiaKlikk video tokens & program episode IDs immediately
  if (id.startsWith('mediaklikk:video:') || id.startsWith('mediaklikk:program:')) {
    const streams = await scrapeMediaKlikk({ id, clientIp: config.clientIp });
    if (streams && streams.length > 0) {
      return {
        streams: prependVercelNoticeIfNeeded(streams, config)
      };
    }
  }

  let candidateScrapers = ALL_SCRAPERS;
  let timeoutMs = config.timeoutMs || 6500;

  // On remote cloud servers (Vercel, Render), skip strictly IP-bound Self-Host-only scrapers
  if (isRemoteCloudRuntime()) {
    candidateScrapers = candidateScrapers.filter(s => s.id !== 'hdmozi' && s.id !== 'dmdamedia');
    timeoutMs = Math.min(timeoutMs, isVercelRuntime() ? 5200 : 6500);
  }

  if (config.stage === 'fast') {
    candidateScrapers = candidateScrapers.filter(s => FAST_SCRAPER_IDS.has(s.id));
    timeoutMs = Math.min(timeoutMs, 4500);
  }

  const activeScrapers = candidateScrapers.filter(s => {
    if (!config.sources || config.sources.length === 0) return true;
    return config.sources.includes(s.id);
  });

  if (activeScrapers.length === 0) {
    return { streams: [] };
  }

  const vodCacheKey = getVodCacheKey(type, id, activeScrapers, config);
  const cachedEntry = VOD_STREAM_CACHE.get(vodCacheKey);
  if (cachedEntry) {
    const ttl = (cachedEntry.data?.streams?.length || 0) > 0 ? VOD_CACHE_TTL_MS : VOD_EMPTY_CACHE_TTL_MS;
    if (Date.now() - cachedEntry.ts < ttl) {
      return {
        streams: prependVercelNoticeIfNeeded(cachedEntry.data.streams, config),
        metaInfo: cachedEntry.data.metaInfo
      };
    }
    VOD_STREAM_CACHE.delete(vodCacheKey);
  }

  if (INFLIGHT_VOD_SCRAPES.has(vodCacheKey)) {
    const sharedResult = await INFLIGHT_VOD_SCRAPES.get(vodCacheKey);
    if (!sharedResult) return { streams: [] };
    return {
      streams: prependVercelNoticeIfNeeded(sharedResult.streams, config),
      metaInfo: sharedResult.metaInfo
    };
  }

  const scrapePromise = (async () => {
    // 3. Resolve Hungarian & English metadata from IMDb/TMDB
    const meta = await getMediaMeta(type, id);
    if (!meta) {
      return null;
    }
    meta.clientIp = config.clientIp || null;
    meta.hostUrl = config.hostUrl || null;

    const fastScrapers = activeScrapers.filter(s => s.fast);
    const otherScrapers = activeScrapers.filter(s => !s.fast);
    const allStreams = [];
    const fastTimeoutMs = Math.min(timeoutMs, isVercelRuntime() ? 5200 : 6000);

    const fastPromises = fastScrapers.map(scraper =>
      Promise.race([
        scraper.fn(meta),
        new Promise(resolve => setTimeout(() => resolve([]), fastTimeoutMs))
      ]).catch(() => [])
    );

    const fastResults = await Promise.allSettled(fastPromises);
    fastResults.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allStreams.push(...res.value);
      }
    });

    const hasGoodStreams =
      allStreams.some(s => s.height >= 720 && s.yearVerified !== false) ||
      allStreams.filter(s => s.yearVerified !== false).length >= 3;
    if (!hasGoodStreams && otherScrapers.length > 0 && config.stage !== 'fast') {
      const otherPromises = otherScrapers.map(scraper =>
        Promise.race([
          scraper.fn(meta),
          new Promise(resolve => setTimeout(() => resolve([]), timeoutMs))
        ]).catch(() => [])
      );
      const otherResults = await Promise.allSettled(otherPromises);
      otherResults.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          allStreams.push(...res.value);
        }
      });
    }

    // Deduplicate by stream URL, reject non-direct HTML embed hosters, and apply resolution filter
    const seenUrls = new Set();
    const uniqueStreams = [];
    const activeQualities = config.qualities || config.resolutions;
    const hasQualityFilter = Array.isArray(activeQualities) && activeQualities.length > 0 && activeQualities.length < 4;
    const qualSet = hasQualityFilter ? new Set(activeQualities.map(q => String(q).toLowerCase())) : null;

    const ALWAYS_REJECT_PATTERNS = [
      'frdl.io', 'fredl.ru', 'katfile.', 'uploady.', 'rapidgator.', 'turbobit.',
      'embed.indavideo.hu/player', 'videa.hu/player'
    ];

    const HTML_EMBED_PATTERNS = [
      'filemoon.', 'voe.sx', 'voe.to', 'vidmoly.', 'streamwish.', 'streamruby.', 'rubystream.',
      'dood.', 'd000d.', 'mixdrop.', 'mxdrop.', 'byse', 'vinovo.', 'vidara.', 'luluvdo.', 'luluvid.',
      'vidoza.', 'speedfiles.', 'supervideo.'
    ];

    for (const s of allStreams) {
      if (!s || !s.url || seenUrls.has(s.url)) continue;
      const urlLower = String(s.url).toLowerCase();
      let parsedHost = '';
      let parsedPath = '';
      try {
        const parsed = new URL(s.url);
        parsedHost = parsed.hostname.toLowerCase();
        parsedPath = parsed.pathname.toLowerCase();
      } catch {}

      const isInternalProxy = parsedPath.startsWith('/proxy/hls');
      const isDirectMediaFile = parsedPath.endsWith('.m3u8') || parsedPath.endsWith('.mp4');

      // Reject webpage iframe embed URLs & download landing pages that cause infinite buffering in Nuvio
      if (
        ALWAYS_REJECT_PATTERNS.some(pat => urlLower.includes(pat)) ||
        (!isInternalProxy && !isDirectMediaFile && (
          HTML_EMBED_PATTERNS.some(pat => parsedHost.includes(pat)) ||
          (!urlLower.includes('.mp4') && !urlLower.includes('.m3u8') && !urlLower.includes('videa.hu/static/video/') && !urlLower.includes('videakid.hu/static/video/') && !urlLower.includes('indavideo.hu/') && !urlLower.includes('okcdn.ru') && !urlLower.includes('vkuser') && (parsedPath.includes('/e/') || parsedPath.includes('/embed-')))
        ))
      ) {
        continue;
      }
      seenUrls.add(s.url);

      if (qualSet) {
        const h = s.height || 0;
        const qStr = String(s.quality || '').toLowerCase();
        const nameStr = String(s.name || '');
        let matches = false;
        if (qualSet.has('1080p') && (h >= 1080 || qStr === '1080p' || nameStr.includes('1080'))) matches = true;
        if (qualSet.has('720p') && ((h >= 720 && h < 1080) || qStr === '720p' || nameStr.includes('720'))) matches = true;
        if (qualSet.has('480p') && ((h >= 480 && h < 720) || qStr === '480p' || nameStr.includes('480'))) matches = true;
        if (qualSet.has('360p') && ((h > 0 && h < 480) || qStr === '360p' || nameStr.includes('360') || nameStr.includes('240'))) matches = true;
        if (!matches) continue;
      }

      // Add clear Nuvio stream warning when a video is unverified or from a community upload source
      const USER_UPLOAD_SOURCES = new Set(['videa', 'indavideo', 'videakid', 'onlinefilmek', 'filmvilag2', 'dmdamedia']);
      const cleanName = String(s.name || '').replace(/\s*\[⚠️\s*Év\?\]/g, '').trim();
      const cleanTitle = String(s.title || '').replace(/\s*•\s*⚠️\s*Évszám nincs a címben/g, '').trim();

      if (s.yearVerified === false) {
        s.name = `${cleanName} ⚠️ [Lehet nem jó a videó!]`;
        s.title = `${cleanTitle}\n⚠️ FIGYELEM: Lehet, hogy nem a jó videó (nem ellenőrzött évszám/feltöltés)!`;
      } else if (USER_UPLOAD_SOURCES.has(s.source)) {
        s.name = cleanName;
        if (!cleanTitle.includes('FIGYELEM') && !cleanTitle.includes('lehet, hogy nem a jó videó')) {
          s.title = `${cleanTitle}\n⚠️ Közösségi feltöltés – lehet, hogy nem a jó videó`;
        }
      }
      // Never include both `title` and `description` on a Stream object:
      // Stremio's Rust engine (stremio-core) defines `#[serde(alias = "title")] pub description: Option<String>`,
      // so sending both `title` and `description` throws `duplicate field 'description'` in serde!
      delete s.description;
      s.url = String(s.url).trim().replace(/\s+/g, '%20');
      const bingeGroup = `hu-stream-${String(s.source || 'vod').toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${s.height || 0}`;
      s.behaviorHints = { notWebReady: false, bingeGroup, ...(s.behaviorHints || {}) };

      uniqueStreams.push(s);
    }

    // Priority sorting: 1. Matched source (e.g. NetMozi if id is netmozi:), 2. Year-verified streams first, 3. Resolution height (1080p -> 720p -> 480p), 4. Direct MP4/MédiaKlikk
    uniqueStreams.sort((a, b) => {
      const isPreferredA = (id.startsWith('netmozi:') && (a.source === 'netmozi' || (a.name && a.name.includes('NetMozi')))) ||
                           (id.startsWith('mediaklikk:') && a.source === 'mediaklikk');
      const isPreferredB = (id.startsWith('netmozi:') && (b.source === 'netmozi' || (b.name && b.name.includes('NetMozi')))) ||
                           (id.startsWith('mediaklikk:') && b.source === 'mediaklikk');
      if (isPreferredA && !isPreferredB) return -1;
      if (isPreferredB && !isPreferredA) return 1;

      const verA = a.yearVerified !== false ? 1 : 0;
      const verB = b.yearVerified !== false ? 1 : 0;
      if (verB !== verA) return verB - verA;
      const heightA = a.height || 0;
      const heightB = b.height || 0;
      if (heightB !== heightA) return heightB - heightA;
      const isDirectA = a.source === 'mediaklikk' || (a.url && (a.url.includes('videa.hu/static/') || a.url.includes('videakid.hu/static/') || a.url.includes('indavideo.hu/') || (a.url.includes('.mp4') && !a.url.includes('okcdn.ru'))));
      const isDirectB = b.source === 'mediaklikk' || (b.url && (b.url.includes('videa.hu/static/') || b.url.includes('videakid.hu/static/') || b.url.includes('indavideo.hu/') || (b.url.includes('.mp4') && !b.url.includes('okcdn.ru'))));
      if (isDirectA && !isDirectB) return -1;
      if (isDirectB && !isDirectA) return 1;
      return 0;
    });

    const cleanResult = {
      streams: uniqueStreams,
      metaInfo: {
        hungarianTitle: meta.hungarianTitle,
        englishTitle: meta.englishTitle,
        year: meta.year
      }
    };
    setVodCacheEntry(vodCacheKey, cleanResult);
    return cleanResult;
  })();

  INFLIGHT_VOD_SCRAPES.set(vodCacheKey, scrapePromise);
  try {
    const freshResult = await scrapePromise;
    if (!freshResult) return { streams: [] };
    return {
      streams: prependVercelNoticeIfNeeded(freshResult.streams, config),
      metaInfo: freshResult.metaInfo
    };
  } finally {
    INFLIGHT_VOD_SCRAPES.delete(vodCacheKey);
  }
}

module.exports = {
  DEFAULT_CONFIG,
  parseConfig,
  getManifest,
  getStreams,
  handleStreamRequest: getStreams,
  searchCatalog,
  getMeta,
  getSubtitles,
  ALL_SCRAPERS,
  getRuntimeNoticeMeta,
  isRemoteCloudRuntime,
  getCdnPublicBaseUrl,
  rewriteStaticAssetUrl,
  rewriteMetaMediaUrls
};
