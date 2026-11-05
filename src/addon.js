const { getMediaMeta } = require('./utils/meta');
const { searchCatalog, getMeta } = require('./catalog');
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
  'sorozatoknet'
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
  { id: 'sorozatoknet', name: 'Sorozatok.net', fn: scrapeSorozatokNet, fast: true }
];

const DEFAULT_CONFIG = {
  sources: ALL_SCRAPERS.map(s => s.id),
  catalogs: CATALOG_DEFINITIONS.filter(c => c.defaultEnabled).map(c => c.id),
  qualities: ['1080p', '720p', '480p', '360p'],
  maxResults: 25
};

function parseConfig(configStr, query = {}) {
  const config = {
    sources: [...DEFAULT_CONFIG.sources],
    catalogs: [...DEFAULT_CONFIG.catalogs],
    qualities: [...DEFAULT_CONFIG.qualities],
    timeoutMs: 20000,
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
  if (query.stage) {
    config.stage = String(query.stage).trim().toLowerCase();
  }
  if (query.timeout) {
    const t = parseInt(query.timeout, 10);
    if (!isNaN(t)) config.timeoutMs = t <= 60 ? t * 1000 : t;
  }

  if (!configStr) return config;

  // 1. Base64 / Base64url JSON
  try {
    const decoded = Buffer.from(configStr, 'base64url').toString('utf-8');
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      const parsed = JSON.parse(decoded);
      const qualities = parsed.qualities || parsed.resolutions;
      if (Array.isArray(parsed.sources) && parsed.sources.length) config.sources = parsed.sources;
      if (Array.isArray(parsed.catalogs) && parsed.catalogs.length) config.catalogs = parsed.catalogs;
      if (Array.isArray(qualities) && qualities.length) config.qualities = qualities;
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
  if (badges.length > 0) {
    name = `Magyar Streaming Pro [${badges.join(' • ')}]`;
  }

  const hostUrl = config.hostUrl || process.env.HOST_URL || 'https://nuvio-magyar-http.vercel.app';

  const supportedIdPrefixes = [
    'tt',
    'tmdb:',
    'tvdb:',
    'kitsu:',
    'mal:',
    'anilist:',
    'anidb:',
    'tvmaze:',
    'mediaklikk-live-',
    'mediaklikk:',
    'netmozi:',
    'title:'
  ];

  return {
    id: 'org.nuvio.magyar.http',
    version: '2.5.0',
    name,
    description: desc,
    logo: `${hostUrl}/logo.png`,
    icon: `${hostUrl}/logo.png`,
    background: `${hostUrl}/logo.png`,
    resources: [
      {
        name: 'stream',
        types: ['movie', 'series', 'tv', 'channel'],
        idPrefixes: supportedIdPrefixes
      },
      {
        name: 'meta',
        types: ['movie', 'series', 'tv', 'channel'],
        idPrefixes: ['tt', 'tmdb:', 'mediaklikk-live-', 'mediaklikk:', 'netmozi:']
      },
      {
        name: 'catalog',
        types: ['movie', 'series', 'tv']
      }
    ],
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
  const id = decodeURIComponent(rawId || '').replace(/\.json$/, '');

  // 1. Handle Live TV channels (M4 Sport, M1, M2, Duna, M5, etc.)
  if (type === 'tv' || type === 'channel' || (id && id.startsWith('mediaklikk-live-'))) {
    const liveStreams = await getLiveChannelStreams(id, config.clientIp, config.hostUrl);
    return { streams: liveStreams };
  }

  if (!id) {
    return { streams: [] };
  }

  // 2. Handle direct MédiaKlikk video tokens & program episode IDs immediately
  if (id.startsWith('mediaklikk:video:') || id.startsWith('mediaklikk:program:')) {
    const streams = await scrapeMediaKlikk({ id, clientIp: config.clientIp });
    if (streams && streams.length > 0) {
      return { streams };
    }
  }

  // 3. Resolve Hungarian & English metadata from IMDb/TMDB
  const meta = await getMediaMeta(type, id);
  if (!meta) {
    return { streams: [] };
  }
  meta.clientIp = config.clientIp || null;
  meta.hostUrl = config.hostUrl || null;

  let candidateScrapers = ALL_SCRAPERS;
  let timeoutMs = config.timeoutMs || 15000;

  if (config.stage === 'fast') {
    candidateScrapers = ALL_SCRAPERS.filter(s => FAST_SCRAPER_IDS.has(s.id));
    timeoutMs = Math.min(timeoutMs, 4500);
  }

  const activeScrapers = candidateScrapers.filter(s => {
    if (!config.sources || config.sources.length === 0) return true;
    return config.sources.includes(s.id);
  });

  const fastScrapers = activeScrapers.filter(s => s.fast);
  const otherScrapers = activeScrapers.filter(s => !s.fast);
  const allStreams = [];

  const fastPromises = fastScrapers.map(scraper =>
    Promise.race([
      scraper.fn(meta),
      new Promise(resolve => setTimeout(() => resolve([]), Math.max(9500, timeoutMs)))
    ]).catch(() => [])
  );

  const otherPromises = otherScrapers.map(scraper =>
    Promise.race([
      scraper.fn(meta),
      new Promise(resolve => setTimeout(() => resolve([]), timeoutMs))
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

  const HTML_EMBED_PATTERNS = [
    'filemoon.', 'voe.sx', 'voe.to', 'vidmoly.', 'streamwish.', 'streamruby.', 'rubystream.',
    'dood.', 'd000d.', 'mixdrop.', 'byse', 'vinovo.', 'vidara.', 'luluvdo.', 'vidoza.',
    'speedfiles.', 'supervideo.', 'embed.indavideo.hu/player', 'videa.hu/player'
  ];

  for (const s of allStreams) {
    if (!s || !s.url || seenUrls.has(s.url)) continue;
    const urlLower = String(s.url).toLowerCase();
    // Reject webpage iframe embed URLs that cause infinite buffering in Nuvio's native video player
    if (
      HTML_EMBED_PATTERNS.some(pat => urlLower.includes(pat)) ||
      (!urlLower.includes('.mp4') && !urlLower.includes('.m3u8') && !urlLower.includes('videa.hu/static/video/') && !urlLower.includes('videakid.hu/static/video/') && !urlLower.includes('indavideo.hu/') && !urlLower.includes('okcdn.ru') && !urlLower.includes('vkuser') && (urlLower.includes('/e/') || urlLower.includes('/embed-')))
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
    s.description = s.title;

    uniqueStreams.push(s);
  }

  // Priority sorting: 1. Year-verified streams first, 2. Resolution height (1080p -> 720p -> 480p), 3. Direct MP4/MédiaKlikk
  uniqueStreams.sort((a, b) => {
    const verA = a.yearVerified !== false ? 1 : 0;
    const verB = b.yearVerified !== false ? 1 : 0;
    if (verB !== verA) return verB - verA;
    const heightA = a.height || 0;
    const heightB = b.height || 0;
    if (heightB !== heightA) return heightB - heightA;
    const isDirectA = a.source === 'mediaklikk' || a.source === 'videa' || a.source === 'indavideo' || (a.url && a.url.includes('.mp4'));
    const isDirectB = b.source === 'mediaklikk' || b.source === 'videa' || b.source === 'indavideo' || (b.url && b.url.includes('.mp4'));
    if (isDirectA && !isDirectB) return -1;
    if (isDirectB && !isDirectA) return 1;
    return 0;
  });

  return {
    streams: uniqueStreams,
    metaInfo: {
      hungarianTitle: meta.hungarianTitle,
      englishTitle: meta.englishTitle,
      year: meta.year
    }
  };
}

module.exports = {
  DEFAULT_CONFIG,
  parseConfig,
  getManifest,
  getStreams,
  handleStreamRequest: getStreams,
  searchCatalog,
  getMeta,
  ALL_SCRAPERS
};
