const { resolveMeta } = require('./utils/meta');
const { CATALOG_DEFINITIONS, getCatalogMetas, getCustomMeta } = require('./catalog');
const { buildProxyUrl, buildHlsProxyUrl } = require('./utils/proxy');

const { searchVidea } = require('./scrapers/videa');
const { searchVideakid } = require('./scrapers/videakid');
const { searchIndavideo } = require('./scrapers/indavideo');
const { searchNetMozi } = require('./scrapers/netmozi');
const { searchHdMozi } = require('./scrapers/hdmozi');
const { searchFilmezek } = require('./scrapers/filmezek');
const { searchOnlineFilmek } = require('./scrapers/onlinefilmek');
const { searchSorozatokNet } = require('./scrapers/sorozatok_net');
const { searchJobbMintATV } = require('./scrapers/jobbmintatv');
const { searchDMDAMedia } = require('./scrapers/dmdamedia');
const { searchMeseFilm } = require('./scrapers/mesefilm');
const { searchMediaKlikk } = require('./scrapers/mediaklikk');

const PROVIDERS = [
  { id: 'videa', name: 'Videa.hu (Direct MP4)', fn: searchVidea, defaultEnabled: true },
  { id: 'netmozi', name: 'NetMozi.com (Multi-Hoster)', fn: searchNetMozi, defaultEnabled: true },
  { id: 'hdmozi', name: 'HDMozi.hu (1080p RPM HLS)', fn: searchHdMozi, defaultEnabled: true },
  { id: 'filmezek', name: 'Filmezek.com (Videa / OK.ru / VOE)', fn: searchFilmezek, defaultEnabled: true },
  { id: 'onlinefilmek', name: 'OnlineFilmekIngyen (DooPlay)', fn: searchOnlineFilmek, defaultEnabled: true },
  { id: 'sorozatoknet', name: 'Sorozatok.net (Sorozat adatbázis)', fn: searchSorozatokNet, defaultEnabled: true },
  { id: 'mediaklikk', name: 'MédiaKlikk / MTVA (Élő TV & Archívum)', fn: searchMediaKlikk, defaultEnabled: true },
  { id: 'indavideo', name: 'Indavideo.hu (Direct MP4)', fn: searchIndavideo, defaultEnabled: true },
  { id: 'videakid', name: 'Videakid.hu (Mese & Családi)', fn: searchVideakid, defaultEnabled: true },
  { id: 'jobbmintatv', name: 'JobbMintATV (Filmek & Sorozatok)', fn: searchJobbMintATV, defaultEnabled: true },
  { id: 'dmdamedia', name: 'DMDAMedia.hu (Szinkronos tárhely)', fn: searchDMDAMedia, defaultEnabled: true },
  { id: 'mesefilm', name: 'MeseKincstár & MeseFilmek.hu', fn: searchMeseFilm, defaultEnabled: true }
];

function parseUserConfig(configStr) {
  const defaults = {
    providers: PROVIDERS.map((p) => p.id),
    proxyMode: 'auto', // 'off' | 'auto' | 'always'
    minQuality: 0 // 0 | 720 | 1080
  };
  if (!configStr) return defaults;

  try {
    const clean = decodeURIComponent(configStr);
    if (clean.startsWith('{')) {
      return { ...defaults, ...JSON.parse(clean) };
    }
    const b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return {
      providers: Array.isArray(json.p) ? json.p : (Array.isArray(json.providers) ? json.providers : defaults.providers),
      proxyMode: json.px || json.proxyMode || defaults.proxyMode,
      minQuality: Number(json.q || json.minQuality || 0)
    };
  } catch {
    return defaults;
  }
}

function getManifest(configStr = null) {
  const cfg = parseUserConfig(configStr);
  const enabledNames = PROVIDERS.filter((p) => cfg.providers.includes(p.id)).map((p) => p.name.split(' ')[0]);

  return {
    id: 'org.nuvio.magyar.http.vercel',
    version: '2.0.0',
    name: '🇭🇺 Nuvio Magyar HTTP Streaming',
    description: `Magyar szinkronos és feliratos közvetlen HTTP streaming kiegészítő Nuvio és Stremio kliensekhez Vercel HTTP/HLS Proxy támogatással. Aktív források (${enabledNames.length}): ${enabledNames.join(', ')}.`,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Flag_of_Hungary.svg/512px-Flag_of_Hungary.svg.png',
    background: 'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=1600&q=80',
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'mediaklikk'],
    resources: [
      'catalog',
      'stream',
      { name: 'meta', types: ['movie', 'series'], idPrefixes: ['mediaklikk'] }
    ],
    catalogs: CATALOG_DEFINITIONS,
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    }
  };
}

function formatStreamForNuvio(stream, baseUrl, proxyMode = 'auto') {
  const headers = stream.headers || {};
  const hasHeaders = Object.keys(headers).length > 0;
  const isHls = Boolean(stream.isHls || /\.m3u8(\?|$)/i.test(stream.url));

  let finalUrl = stream.url;
  const isIpBoundCdn = stream.url.includes('connectmedia.hu');
  const shouldProxy = proxyMode === 'always' && !isIpBoundCdn;

  if (shouldProxy && baseUrl) {
    if (isHls) {
      finalUrl = buildHlsProxyUrl(baseUrl, stream.url, headers, false);
    } else {
      finalUrl = buildProxyUrl(baseUrl, stream.url, headers);
    }
  }

  const behaviorHints = {
    notWebReady: false,
    bingeGroup: `nuvio-hu-${stream.quality || 720}`
  };

  if (hasHeaders) {
    behaviorHints.proxyHeaders = {
      request: headers
    };
  }

  return {
    name: stream.name || `🇭🇺 Magyar\n${stream.quality || 720}p`,
    title: stream.title || '🇭🇺 Magyar HTTP Stream',
    url: finalUrl,
    headers: hasHeaders ? headers : undefined,
    behaviorHints
  };
}

async function getStreams(type, id, configStr = null, baseUrl = '') {
  const cfg = parseUserConfig(configStr);
  const meta = await resolveMeta(type, id);

  // Fast-path for live TV channels
  if (id.startsWith('mediaklikk-live-') || id.startsWith('mediaklikk:video:')) {
    const liveStreams = await searchMediaKlikk(meta);
    return liveStreams.map((s) => formatStreamForNuvio(s, baseUrl, cfg.proxyMode));
  }

  const activeProviders = PROVIDERS.filter((p) => cfg.providers.includes(p.id));

  const results = await Promise.allSettled(
    activeProviders.map((prov) =>
      Promise.race([
        prov.fn(meta),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${prov.id} timeout`)), 9500))
      ])
    )
  );

  const rawStreams = [];
  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      rawStreams.push(...res.value);
    }
  }

  // Deduplicate by URL and apply minimum quality filter
  const seenUrls = new Set();
  const filtered = [];
  for (const s of rawStreams) {
    if (!s || !s.url || !s.url.startsWith('http')) continue;
    if (seenUrls.has(s.url)) continue;
    if (cfg.minQuality && (s.quality || 0) < cfg.minQuality) continue;
    seenUrls.add(s.url);
    filtered.push(s);
  }

  filtered.sort((a, b) => (b.quality || 0) - (a.quality || 0));

  return filtered.map((s) => formatStreamForNuvio(s, baseUrl, cfg.proxyMode));
}

module.exports = {
  PROVIDERS,
  parseUserConfig,
  getManifest,
  getCatalogMetas,
  getCustomMeta,
  getStreams
};
