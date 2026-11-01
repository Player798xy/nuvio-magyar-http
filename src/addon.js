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
  qualities: ['1080p', '720p', '480p'],
  maxResults: 25
};

function parseConfig(configStr) {
  if (!configStr) return { ...DEFAULT_CONFIG };
  try {
    const decoded = Buffer.from(configStr, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return {
      sources: Array.isArray(parsed.sources) && parsed.sources.length ? parsed.sources : DEFAULT_CONFIG.sources,
      catalogs: Array.isArray(parsed.catalogs) && parsed.catalogs.length ? parsed.catalogs : DEFAULT_CONFIG.catalogs,
      qualities: Array.isArray(parsed.qualities) && parsed.qualities.length ? parsed.qualities : DEFAULT_CONFIG.qualities,
      maxResults: Number(parsed.maxResults) || DEFAULT_CONFIG.maxResults
    };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function getManifest(config = {}) {
  let name = 'Magyar Streaming Pro (HU)';
  let desc = 'Magyar szinkronos filmek, sorozatok, mesék és élő TV csatornák 1080p & 720p minőségben (MédiaKlikk 490+ műsor + Élő TV, Videa, Indavideo, HDMozi, Filmvilág2, JobbMintATV, NetMozi, Filmezek, OnlineFilmek, DMDAMedia, MeseFilm, Videakid, Sorozatok.net).';

  if (config.sources && Array.isArray(config.sources) && config.sources.length > 0 && config.sources.length < ALL_SCRAPERS.length) {
    name = `Magyar Streaming Pro [${config.sources.length} forrás]`;
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

  const hasGoodStreams = allStreams.some(s => s.height >= 720) || allStreams.length >= 3;
  if (!hasGoodStreams && otherScrapers.length > 0 && config.stage !== 'fast') {
    const otherResults = await Promise.allSettled(otherPromises);
    otherResults.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allStreams.push(...res.value);
      }
    });
  }

  // Deduplicate by stream URL
  const seenUrls = new Set();
  const uniqueStreams = [];
  for (const s of allStreams) {
    if (!s || !s.url || seenUrls.has(s.url)) continue;
    seenUrls.add(s.url);
    uniqueStreams.push(s);
  }

  // Priority sorting: 1. Resolution height (1080p -> 720p -> 480p), 2. Direct MP4/MédiaKlikk
  uniqueStreams.sort((a, b) => {
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
