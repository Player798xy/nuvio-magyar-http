const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const pkg = require('./package.json');
const { createBoundedCache } = require('./src/cache');
const {
  getManifest,
  handleStreamRequest,
  parseConfig: parseAddonConfig,
  getSubtitles,
  ALL_SCRAPERS,
  getRuntimeNoticeMeta,
  getCdnPublicBaseUrl,
  rewriteStaticAssetUrl,
  rewriteMetaMediaUrls
} = require('./src/addon');
const { getOnlineStreamMeta } = require('./src/scrapers/onlinestream');
const { generateTvPosterSvg, generateTvBackgroundSvg, generateTvLogoSvg } = require('./src/tv_graphics');
const { searchCatalog, getMeta, HUNGARIAN_CLASSIC_SERIES_IDS } = require('./src/catalog');
const { getWeeklyRotationSeed } = require('./src/catalogs');
const { getMediaMeta, getSeriesEpisodes } = require('./src/utils/meta');
const { getLiveHlsStream, getRewrittenMasterPlaylist } = require('./src/scrapers/mediaklikk');
const { buildM3u, buildAutoMirrorM3u, buildXspf } = require('./src/playlists');
const { buildChannelPayload } = require('./src/tv_channels');
const { checkCatalog, checkChannelMirrors, probeMirror, resolveBestMirror } = require('./src/tv_health');
const { getRelayedPlaylist, isPublicHttpUrl, UPSTREAM_HEADERS } = require('./src/tv_relay');
const { handlePlayerApi } = require('./src/xtream');
const { getChannelEpgPayload, getCategoryEpg, getScheduleGrid, getXmltvDocument, getXmltvStatus } = require('./src/tv_epg');
const { startAutoSync, syncNow, maybeSyncIfStale, getSyncStatus } = require('./src/tv_catalog_sync');
const { trafficMiddleware, getTrafficSnapshot } = require('./src/traffic');
const { parseCategories } = require('./src/tv_profiles');
const {
  recordRequestMetric,
  isAuthorizedStatsRequest,
  getStatsSnapshot,
  exportStatsBackup,
  importStatsBackup,
  renderStatsHtml
} = require('./src/stats');

const app = express();
const PORT = process.env.PORT || 7000;

// Prevent unexpected upstream disconnects or pipe errors from crashing the server
process.on('uncaughtException', (err) => {
  console.warn('[Server Warning] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning] Unhandled rejection:', reason);
});

// Enable CORS for Stremio & Nuvio Web/Mobile clients (full wildcard header support)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: '*'
}));
app.options('*', cors());

const LEGACY_PUBLIC_HOSTS = new Set([
  'nuvio-magyar-http.onrender.com',
  'nuvio-magyar-http.vercel.app'
]);

const GITHUB_REPO_URL = 'https://github.com/Player798xy/nuvio-magyar-http';
const VERCEL_CLONE_URL = 'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPlayer798xy%2Fnuvio-magyar-http';

function getNormalizedRequestHost(req) {
  return String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function isLegacyAuthorPublicHost(req) {
  if (process.env.PUBLIC_SHUTDOWN === '1') return true;
  if (process.env.ALLOW_LEGACY_PUBLIC_HOST === '1') return false;
  if (process.env.RENDER_SERVICE_ID === 'srv-dbtghautlv9c73fajam0') return true;
  if (String(process.env.RENDER_EXTERNAL_URL || '').toLowerCase().includes('nuvio-magyar-http.onrender.com')) return true;
  if (String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').toLowerCase() === 'nuvio-magyar-http.vercel.app') return true;
  const host = getNormalizedRequestHost(req);
  if (LEGACY_PUBLIC_HOSTS.has(host)) return true;
  return host.startsWith('nuvio-magyar-http-') && host.endsWith('.vercel.app');
}

function buildPublicShutdownHtml() {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Nyilvános szerver leállítva — Magyar Streaming Pro</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #070707; color: #ececec; display: grid; place-items: center; min-height: 100vh; padding: 20px; }
    .card { max-width: 620px; background: #121212; border: 1px solid #2b2b2b; border-radius: 12px; padding: 28px; line-height: 1.55; }
    h1 { font-size: 22px; margin: 0 0 12px; color: #ff6b6b; }
    p { margin: 0 0 14px; color: #c8c8c8; font-size: 15px; }
    strong { color: #ffffff; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    a.btn { display: inline-block; padding: 10px 16px; border-radius: 7px; font-weight: 700; font-size: 14px; text-decoration: none; }
    .btn-vercel { background: #ffffff; color: #050505; }
    .btn-gh { background: #10b981; color: #032016; }
  </style>
</head>
<body>
  <main class="card">
    <h1>⛔ Nyilvános szerver véglegesen leállítva</h1>
    <p>
      A fejlesztő a továbbiakban <strong>nem hosztol nyilvános szervert</strong> (a publikus Render és Vercel linkek megszűntek).
    </p>
    <p>
      A kód nyílt forráskódú (MIT): <strong>bárki szabadon nyithat magának saját ingyenes Vercelt</strong>, vagy futtathatja otthon saját gépen / Dockerrel a GitHub repóból.
    </p>
    <p style="font-size:13.5px;color:#9a9a9a">
      <strong>English:</strong> Public hosting has been permanently discontinued. Anyone is free to deploy their own private Vercel instance or self-host via Docker/Node.js from GitHub.
    </p>
    <div class="actions">
      <a class="btn btn-vercel" href="${VERCEL_CLONE_URL}" target="_blank" rel="noopener">▲ Saját Vercel indítása (1 kattintás)</a>
      <a class="btn btn-gh" href="${GITHUB_REPO_URL}" target="_blank" rel="noopener">GitHub &amp; Docker Útmutató →</a>
    </div>
  </main>
</body>
</html>`;
}

// Count real response bytes for the /traffic dashboard (works for relay streaming too)
app.use(trafficMiddleware);

function requestCategoryFilter(req) {
  const raw = req.profileCategories !== undefined ? req.profileCategories : req.query.cats;
  return parseCategories(raw);
}


function isVercelRequest(req) {
  if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID) return false;
  const host = getNormalizedRequestHost(req);
  return Boolean(process.env.VERCEL || process.env.VERCEL_URL || host.includes('.vercel.app'));
}

// Block author's retired public hosts while allowing private user-hosted / own Vercel forks
app.use((req, res, next) => {
  if (isLegacyAuthorPublicHost(req)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.path === '/api/health') {
      return res.json({
        status: 'discontinued',
        publicHosting: false,
        version: pkg.version || '2.7.0',
        github: GITHUB_REPO_URL,
        timestamp: new Date().toISOString()
      });
    }

    if (req.path === '/manifest.json' || req.path.endsWith('/manifest.json')) {
      return res.json({
        id: 'hu.nuvio.magyar.streams',
        version: pkg.version || '2.7.0',
        name: 'Magyar Streaming Pro [Nyilvános szerver leállítva]',
        description: `A publikus hosztolás megszűnt. Nyiss saját ingyenes Vercel vagy Docker példányt: ${GITHUB_REPO_URL}`,
        logo: `${GITHUB_REPO_URL}/raw/main/public/logo.png`,
        resources: ['stream'],
        types: ['movie', 'series', 'tv'],
        catalogs: [],
        behaviorHints: { configurable: false, configurationRequired: false }
      });
    }

    if (req.path.includes('/stream/')) {
      return res.json({
        streams: [{
          name: '⛔ Nyilvános szerver leállítva',
          title: [
            'A fejlesztő többé nem hosztol nyilvános szervert.',
            'Szabadon nyithatsz saját ingyenes Vercelt vagy Docker szervert:',
            GITHUB_REPO_URL
          ].join('\n'),
          externalUrl: GITHUB_REPO_URL,
          behaviorHints: { notWebReady: true }
        }]
      });
    }

    if (
      req.path.endsWith('.json') ||
      req.path.startsWith('/catalog/') ||
      req.path.includes('/catalog/') ||
      req.path.startsWith('/meta/') ||
      req.path.includes('/meta/') ||
      req.path.startsWith('/subtitles/') ||
      req.path.includes('/subtitles/') ||
      req.path.startsWith('/api/')
    ) {
      return res.status(410).json({
        error: 'Public hosting discontinued. Deploy your own Vercel or self-host instance.',
        github: GITHUB_REPO_URL,
        deployVercel: VERCEL_CLONE_URL
      });
    }

    if (req.path === '/robots.txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send('User-agent: *\nDisallow: /\n');
    }

    return res.status(410).type('html').send(buildPublicShutdownHtml());
  }

  const accessKey = String(process.env.ACCESS_KEY || '').trim();
  if (accessKey) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.path !== '/api/health') {
      const expectedPrefix = `/p/${accessKey}`;
      const hasExactPrefix = req.path === expectedPrefix || req.path.startsWith(`${expectedPrefix}/`);
      if (!hasExactPrefix) {
        return res.status(404).type('text/plain').send('Not Found');
      }
      req._privatePrefix = expectedPrefix;
      const remainder = req.url.slice(expectedPrefix.length);
      req.url = remainder.startsWith('/') ? remainder : (remainder.startsWith('?') ? `/${remainder}` : `/${remainder}`);
    }
  }

  if (req.path === '/uj-link' || req.path === '/uj-link.html' || req.path === '/tamogatas' || req.path === '/tamogatas.html') {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
  } else if (isVercelRequest(req) && (req.path === '/' || req.path === '/configure' || req.path.endsWith('/configure'))) {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
  }

  // Offload heavy static PNG TV artwork & icons on cloud runtimes to jsDelivr CDN
  const cdnBase = getCdnPublicBaseUrl();
  if (cdnBase && req.method === 'GET') {
    const assetMatch = req.path.match(/^\/((?:tv-posters|tv-backgrounds|tv-logos|channels)\/[a-zA-Z0-9._-]+\.png|logo\.png|icon\.png)$/i);
    if (assetMatch && fs.existsSync(path.join(__dirname, 'public', assetMatch[1]))) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.redirect(302, `${cdnBase}/${assetMatch[1]}`);
    }
  }

  res.on('finish', () => {
    recordRequestMetric({ req, res, clientIp: getClientIp(req) });
  });
  next();
});

// Stateless profiles: /pf/<category ids>/<endpoint> works like the endpoint with ?cats=...
// Runs after the optional ACCESS_KEY prefix rewriter, so /p/<key>/pf/<cats>/... also works.
app.use((req, res, next) => {
  const match = String(req.path || '').match(/^\/pf\/([^/]+)(\/.*)?$/);
  if (!match) return next();
  try { req.profileCategories = decodeURIComponent(match[1]); } catch (e) { req.profileCategories = match[1]; }
  const rest = match[2] || '/';
  const queryIndex = req.url.indexOf('?');
  req.url = rest + (queryIndex >= 0 ? req.url.slice(queryIndex) : '');
  next();
});

// Prefix-aware support/QR pages (must be registered before express.static)
app.get(['/uj-link', '/uj-link.html'], (req, res) => sendAppHtml(req, res, 'uj-link.html'));
app.get(['/tamogatas', '/tamogatas.html'], (req, res) => sendAppHtml(req, res, 'tamogatas.html'));

// Serve static landing & configuration page + logos + channel icons (index: false lets private prefix rewriter handle /)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  etag: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
    }
  }
}));

// Explicit static routes for Vercel Serverless compatibility
app.get('/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

app.get('/icon.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  res.sendFile(path.join(__dirname, 'public', 'icon.png'));
});

app.get('/logo.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  res.sendFile(path.join(__dirname, 'public', 'logo.svg'));
});

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

app.get('/channels/:file', (req, res) => {
  const safeFile = path.basename(req.params.file || '');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  res.sendFile(path.join(__dirname, 'public', 'channels', safeFile));
});

/**
 * Helper to parse optional configuration from URL segment or query string
 */
function parseConfig(configParam, query = {}) {
  return parseAddonConfig(configParam, query);
}

/**
 * Helper to resolve public Host URL from request
 */
function getHostUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || `127.0.0.1:${PORT}`).split(',')[0].trim();
  return `${proto}://${host}${req._privatePrefix || ''}`;
}

/**
 * Extracts real client IP from Vercel / Reverse Proxy headers
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ip = String(xff).split(',')[0].trim().replace(/^::ffff:/, '');
    if (ip && ip !== '127.0.0.1' && ip !== '::1') return ip;
  }
  const realIp = (req.headers['x-real-ip'] || '').replace(/^::ffff:/, '').trim();
  if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') return realIp;
  return null;
}

// 1. Default Manifest Route
app.get('/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=21600, s-maxage=43200, stale-while-revalidate=86400');
  const config = parseConfig(null, req.query);
  config.hostUrl = getHostUrl(req);
  res.json(getManifest(config));
});

// 2. Configured Manifest Route (/:config/manifest.json)
app.get('/:config/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=21600, s-maxage=43200, stale-while-revalidate=86400');
  const config = parseConfig(req.params.config, req.query);
  config.hostUrl = getHostUrl(req);
  res.json(getManifest(config));
});

/**
 * Ensures strict Stremio stremio-core MetaPreview schema compliance
 * Never allows null posters, numeric releaseInfo, or missing id/type/name
 */
function sanitizeMetaPreview(item, defaultType = 'movie') {
  if (!item || !item.id || !item.name) return null;
  const id = String(item.id).trim();
  const name = String(item.name).trim();
  const type = String(item.type || defaultType).trim();
  if (!id || !name || !type) return null;

  const yearVal = item.releaseInfo || item.year;
  const releaseInfo = yearVal ? String(yearVal).trim() : undefined;

  let poster = item.poster ? String(item.poster).trim() : null;
  if (poster && (!poster.startsWith('http://') && !poster.startsWith('https://'))) {
    poster = null;
  }
  if (!poster && id.startsWith('tt')) {
    poster = `https://images.metahub.space/poster/medium/${id}/img`;
  }

  let background = item.background ? String(item.background).trim() : null;
  if (background && (!background.startsWith('http://') && !background.startsWith('https://'))) {
    background = null;
  }
  if (!background && poster) {
    background = poster;
  }

  const meta = {
    id,
    type,
    name
  };

  if (poster) meta.poster = poster;
  if (background) meta.background = background;
  if (item.logo) meta.logo = String(item.logo);
  if (item.description) meta.description = String(item.description);
  if (releaseInfo) {
    meta.releaseInfo = releaseInfo;
    meta.year = releaseInfo;
  }
  if (item.imdbRating) meta.imdbRating = String(item.imdbRating);
  if (item.posterShape) meta.posterShape = item.posterShape;
  if (item.genres && Array.isArray(item.genres)) meta.genres = item.genres.map(String);
  if (item.behaviorHints && typeof item.behaviorHints === 'object') meta.behaviorHints = item.behaviorHints;

  return meta;
}

// Pre-serialized HTTP catalog response cache (24h browse / weekly rotation key + 304 ETag hits)
const CATALOG_BROWSE_CACHE_MS = 24 * 60 * 60 * 1000;
const CATALOG_SEARCH_CACHE_MS = 30 * 60 * 1000;
const CATALOG_EMPTY_CACHE_MS = 2 * 60 * 1000;
const CATALOG_RESPONSE_CACHE = createBoundedCache({ maxEntries: 80, ttlMs: CATALOG_BROWSE_CACHE_MS });

// 3. Catalog Routes (Enables searching and browsing Hungarian movies/series in Nuvio & Stremio)
async function handleCatalog(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const { type, id } = req.params;
  const cleanId = (id || '').replace(/\.json$/, '');
  const extraStr = (req.params.extra || '').replace(/\.json$/, '');

  let searchQuery = req.query.search || '';
  let skip = parseInt(req.query.skip || '0', 10) || 0;

  if (extraStr) {
    const params = new URLSearchParams(extraStr);
    if (params.has('search')) {
      searchQuery = params.get('search');
    } else if (extraStr.startsWith('search=')) {
      searchQuery = decodeURIComponent(extraStr.slice('search='.length).split('&')[0]);
    }
    if (params.has('skip')) {
      skip = parseInt(params.get('skip'), 10) || 0;
    } else if (extraStr.includes('skip=')) {
      const m = extraStr.match(/skip=(\d+)/);
      if (m) skip = parseInt(m[1], 10) || 0;
    }
  }

  const cdnBase = getCdnPublicBaseUrl();
  const hostUrl = getHostUrl(req);
  const normSearch = String(searchQuery || '').trim().toLowerCase();
  const cacheHostKey = cdnBase ? `cdn:${cdnBase}` : `host:${hostUrl}`;
  const weekSeed = getWeeklyRotationSeed();
  const respCacheKey = `${type}:${cleanId}:${skip}:${normSearch}:w${weekSeed}:${cacheHostKey}`;

  try {
    const entry = await CATALOG_RESPONSE_CACHE.getOrLoad(
      respCacheKey,
      async () => {
        const rawMetas = await searchCatalog(type, searchQuery, cleanId, { skip, search: searchQuery, hostUrl });
        const metas = (rawMetas || [])
          .map(m => sanitizeMetaPreview(m, type))
          .filter(Boolean)
          .map(m => rewriteMetaMediaUrls(m, cdnBase));
        const json = JSON.stringify({ metas });
        const etag = `W/"${crypto.createHash('sha1').update(json).digest('hex').slice(0, 16)}"`;
        const cacheControl = metas.length === 0
          ? 'public, max-age=120, s-maxage=300'
          : (normSearch
              ? 'public, max-age=1800, s-maxage=7200, stale-while-revalidate=86400'
              : 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
        return { json, etag, cacheControl, count: metas.length };
      },
      {
        ttlMs: (val) => (val?.count > 0 ? (normSearch ? CATALOG_SEARCH_CACHE_MS : CATALOG_BROWSE_CACHE_MS) : CATALOG_EMPTY_CACHE_MS),
        shouldCache: (val) => Boolean(val && typeof val.json === 'string')
      }
    );

    res.setHeader('Cache-Control', entry.cacheControl);
    res.setHeader('ETag', entry.etag);
    const ifNoneMatch = String(req.headers['if-none-match'] || '').trim();
    if (ifNoneMatch && (ifNoneMatch === entry.etag || ifNoneMatch.replace(/^W\//, '') === entry.etag.replace(/^W\//, ''))) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(entry.json);
  } catch (err) {
    console.error('[Server] Catalog error:', err);
    res.json({ metas: [] });
  }
}

app.get(['/catalog/:type/:id.json', '/catalog/:type/:id'], handleCatalog);
app.get(['/catalog/:type/:id/:extra.json', '/catalog/:type/:id/:extra'], handleCatalog);
app.get(['/:config/catalog/:type/:id.json', '/:config/catalog/:type/:id'], handleCatalog);
app.get(['/:config/catalog/:type/:id/:extra.json', '/:config/catalog/:type/:id/:extra'], handleCatalog);

// 4. Meta Route (Provides episode lists and details for Hungarian series/movies)
async function handleMeta(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const { type, prefix } = req.params;
  const combinedId = prefix ? `${prefix}/${req.params.id || ''}` : (req.params.id || '');
  let rawId = combinedId.replace(/\.json$/, '');
  try {
    rawId = decodeURIComponent(rawId);
  } catch (e) {}

  // Offload standard IMDb tt... metadata directly to Cinemeta (0 bytes JSON + 0 outbound scraper traffic)
  const imdbBaseMatch = rawId.match(/^(tt\d+)(?::\d+:\d+)?$/i);
  if (imdbBaseMatch && !HUNGARIAN_CLASSIC_SERIES_IDS.has(imdbBaseMatch[1])) {
    const cinemetaType = type === 'series' ? 'series' : 'movie';
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
    return res.redirect(302, `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${imdbBaseMatch[1]}.json`);
  }

  try {
    const metaObj = await getMeta(type, rawId, getHostUrl(req));
    if (metaObj) {
      const m = metaObj.meta ? { ...metaObj.meta } : { ...metaObj };
      if (!m.id) m.id = rawId;
      if (!m.type) m.type = type;
      if (m.releaseInfo !== undefined && m.releaseInfo !== null) {
        m.releaseInfo = String(m.releaseInfo);
      }
      if (m.poster && !String(m.poster).startsWith('http')) delete m.poster;
      if (m.background && !String(m.background).startsWith('http')) delete m.background;
      if (Array.isArray(m.videos)) {
        m.videos = m.videos.map(v => {
          const cleanV = { ...v };
          cleanV.title = String(cleanV.title || cleanV.name || 'Epizód');
          // Stremio Rust engine (stremio-core) defines `#[serde(alias = "name")] pub title: String` on Video.
          // Having both `title` and `name` causes serde to fail with `duplicate field 'title'`!
          delete cleanV.name;
          delete cleanV.number;
          if (cleanV.season !== undefined) cleanV.season = Math.max(1, Number(cleanV.season) || 1);
          if (cleanV.episode !== undefined) cleanV.episode = Math.max(1, Number(cleanV.episode) || 1);
          if (!cleanV.released) {
            const sNum = cleanV.season || 1;
            const epNum = cleanV.episode || 1;
            cleanV.released = new Date(Date.UTC(2020, (sNum - 1) % 12, Math.min(28, epNum), 12, 0, 0)).toISOString();
          }
          return cleanV;
        });
      }
      const isLiveChannelMeta = type === 'tv' || type === 'channel' || rawId.startsWith('onlinestream-live-') || rawId.startsWith('mediaklikk-live-');
      res.setHeader(
        'Cache-Control',
        isLiveChannelMeta
          ? 'public, max-age=60, s-maxage=180, stale-while-revalidate=300'
          : 'public, max-age=7200, s-maxage=86400, stale-while-revalidate=604800'
      );
      return res.json({ meta: rewriteMetaMediaUrls(m, getCdnPublicBaseUrl()) });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.json({ meta: null });
  } catch (err) {
    console.error('[Server] Meta error:', err);
    res.json({ meta: null });
  }
}

app.get(['/meta/:type/:id.json', '/meta/:type/:id'], handleMeta);
app.get(['/meta/:type/:prefix/:id.json', '/meta/:type/:prefix/:id'], handleMeta);
app.get(['/:config/meta/:type/:id.json', '/:config/meta/:type/:id'], handleMeta);
app.get(['/:config/meta/:type/:prefix/:id.json', '/:config/meta/:type/:prefix/:id'], handleMeta);

// 4b. Subtitles Routes (Hungarian OpenSubtitles v3 + TMDB->IMDb Bridge)
async function handleSubtitles(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  const configParam = req.params.config || req.query.config || null;
  const config = parseConfig(configParam, req.query);
  if (config.subtitles === false) {
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.json({ subtitles: [] });
  }

  const { type, id } = req.params;
  let cleanId = String(id || '').replace(/\.json$/i, '');
  try {
    cleanId = decodeURIComponent(cleanId);
  } catch {}

  try {
    const subtitles = await getSubtitles(type, cleanId);
    res.setHeader(
      'Cache-Control',
      subtitles.length > 0
        ? 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400'
        : 'public, max-age=300, s-maxage=900'
    );
    res.json({ subtitles });
  } catch (err) {
    console.error('[Server] Subtitles error:', err);
    res.json({ subtitles: [] });
  }
}

const subtitleRoutes = [
  '/subtitles/:type/:id.json',
  '/subtitles/:type/:id',
  '/subtitles/:type/:id/:extra.json',
  '/subtitles/:type/:id/:extra'
];
const configuredSubtitleRoutes = [
  '/:config/subtitles/:type/:id.json',
  '/:config/subtitles/:type/:id',
  '/:config/subtitles/:type/:id/:extra.json',
  '/:config/subtitles/:type/:id/:extra'
];
app.get(subtitleRoutes, handleSubtitles);
app.get(configuredSubtitleRoutes, handleSubtitles);

// 5. Default and Configured Stream Routes (/stream/:type/:id.json)
async function handleStream(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    const { config: configParam, type, prefix } = req.params;
    let rawId = prefix ? `${prefix}/${req.params.id || ''}` : (req.params.id || '');
    let cleanId = rawId.replace(/\.json$/, '');
    try {
      cleanId = decodeURIComponent(cleanId);
    } catch (e) {}

    const config = parseConfig(configParam, req.query);
    config.hostUrl = getHostUrl(req);
    config.clientIp = getClientIp(req);
    const result = await handleStreamRequest(type, cleanId, config);
    const cleanStreams = (result.streams || []).map(s => {
      const copy = { ...s };
      // Stremio Rust engine (stremio-core) defines `#[serde(alias = "title")] pub description: Option<String>` on Stream.
      // Having both `title` and `description` causes serde to fail with `duplicate field 'description'`!
      if (copy.title && copy.description) {
        delete copy.description;
      }
      return copy;
    });

    const isLive = type === 'tv' || type === 'channel' || cleanId.startsWith('onlinestream-live-') || cleanId.startsWith('mediaklikk-live-');
    res.locals.statStreamType = isLive ? 'stream_live' : 'stream_vod';
    if (isLive) {
      const tvMeta = getOnlineStreamMeta(cleanId, config.hostUrl);
      const chName = tvMeta?.meta?.name;
      if (chName) res.locals.statLabel = `${chName} [Élő TV]`;
    } else if (result.metaInfo && (result.metaInfo.hungarianTitle || result.metaInfo.englishTitle)) {
      const mTitle = result.metaInfo.hungarianTitle || result.metaInfo.englishTitle;
      const mYear = result.metaInfo.year ? ` (${result.metaInfo.year})` : '';
      res.locals.statLabel = `${mTitle}${mYear}`;
    }

    if (config.previewMigration) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (cleanStreams.length === 0) {
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');
    } else if (cleanId.startsWith('mediaklikk-live-')) {
      res.setHeader('Cache-Control', 'private, max-age=60');
    } else if (isLive) {
      res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=300, stale-while-revalidate=600');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600');
    }

    res.json({ streams: cleanStreams });
  } catch (err) {
    console.error('[Server] Stream error:', err);
    res.json({ streams: [] });
  }
}

const streamRoutes = [
  '/stream/:type/:id.json',
  '/stream/:type/:id',
  '/stream/:type/:prefix/:id.json',
  '/stream/:type/:prefix/:id'
];
const configuredStreamRoutes = [
  '/:config/stream/:type/:id.json',
  '/:config/stream/:type/:id',
  '/:config/stream/:type/:prefix/:id.json',
  '/:config/stream/:type/:prefix/:id'
];
app.get(streamRoutes, handleStream);
app.get(configuredStreamRoutes, handleStream);

// 7. Live TV HLS Master Playlist Rewriter (Orders 1080p Full HD first so Nuvio starts in 1080p)

// 7b. Zero-Proxy Redirect Endpoint (legacy /proxy/hls URLs redirect directly with 0 server transfer)
app.all(['/proxy/hls.m3u8', '/proxy/hls'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  const targetUrl = String(req.query.url || '').trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).send('#EXTM3U\n#EXT-X-ERROR: Missing or invalid url param\n');
  }

  return res.redirect(302, targetUrl);
});

// 7b2. XSPF Playlist Endpoint for VLC Media Player and Kodi
// ?mirrors=1 -> minden tükör URL külön track-ként (alapból 1 stream / csatorna)
function isMirrorsRequest(req) {
  const value = String(req.query.mirrors ?? req.query.all ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'all';
}

function isFalseQuery(value) {
  const clean = String(value ?? '').trim().toLowerCase();
  return clean === '0' || clean === 'false' || clean === 'no' || clean === 'off';
}

function isTruthyQuery(value) {
  const clean = String(value ?? '').trim().toLowerCase();
  return clean === '1' || clean === 'true' || clean === 'yes' || clean === 'all' || clean === 'fresh';
}

app.get(['/playlist.xspf', '/tv.xspf'], async (req, res) => {
  const hostUrl = getHostUrl(req);
  const allMirrors = isMirrorsRequest(req);
  const cdnBase = getCdnPublicBaseUrl();
  const xml = buildXspf({
    allMirrors,
    categoryFilter: requestCategoryFilter(req),
    logoUrlFor: (channelId) => rewriteStaticAssetUrl(`${hostUrl}/tv-logos/${channelId}.png`, cdnBase)
  }, { hostUrl });

  res.setHeader('Content-Type', 'application/xspf+xml; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="nuvio-magyar-tv${allMirrors ? '-all-mirrors' : ''}.xspf"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.send(xml);
});

// 7b3. M3U / M3U8 Playlist Endpoints for IPTV Players
// ?mirrors=1 (vagy /playlist-all.m3u) -> minden tükör URL, alapból 1 stream / csatorna
app.get(['/playlist.m3u', '/playlist.m3u8', '/playlist-all.m3u', '/playlist-all.m3u8', '/tv-all.m3u', '/tv-all.m3u8'], async (req, res) => {
  const hostUrl = getHostUrl(req);
  const allMirrors = isMirrorsRequest(req) || /-all\.m3u8?$/i.test(req.path);
  const cdnBase = getCdnPublicBaseUrl();
  const body = buildM3u({
    allMirrors,
    categoryFilter: requestCategoryFilter(req),
    allGroup: !isFalseQuery(req.query.allgroup),
    logoUrlFor: (channelId) => rewriteStaticAssetUrl(`${hostUrl}/tv-logos/${channelId}.png`, cdnBase)
  });

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="nuvio-magyar-tv${allMirrors ? '-all-mirrors' : ''}.m3u"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.send(body);
});

// 7b4. Live TV viewer & stream health API
app.get('/traffic', (req, res) => {
  return sendAppHtml(req, res, 'traffic.html');
});

app.get('/profile', (req, res) => {
  return sendAppHtml(req, res, 'profile.html');
});

app.get('/api/profile/options', (req, res) => {
  const payload = buildChannelPayload({ hostUrl: getHostUrl(req) });
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.json({
    categories: payload.categories.map(category => ({ id: category.id, name: category.name, count: category.count })),
    sources: ALL_SCRAPERS
      .filter(scraper => !scraper.id.startsWith('onlinestream'))
      .map(scraper => ({ id: scraper.id, name: scraper.name })),
    totalChannels: payload.count
  });
});

app.get('/api/tv/traffic', (req, res) => {
  if (!isAuthorizedStatsRequest(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(getTrafficSnapshot());
});
app.get(['/tv', '/tv/'], (req, res) => {
  maybeSyncIfStale();
  return sendAppHtml(req, res, 'tv.html');
});

app.get('/api/tv/channels', (req, res) => {
  maybeSyncIfStale();
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
  res.json({ ...buildChannelPayload({ hostUrl: getHostUrl(req), categoryFilter: requestCategoryFilter(req) }), sync: getSyncStatus() });
});

// Git catalog sync status + manual trigger (?force=1)
app.get('/api/tv/sync', async (req, res) => {
  if (isTruthyQuery(req.query.force)) {
    await syncNow({ force: true });
  } else {
    maybeSyncIfStale();
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(getSyncStatus());
});

app.get('/api/tv/health/:channelId', async (req, res) => {
  try {
    const payload = await checkChannelMirrors(req.params.channelId, { fresh: isTruthyQuery(req.query.fresh) });
    if (!payload) return res.status(404).json({ error: 'unknown channel' });
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=45, stale-while-revalidate=120');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// On-demand diagnostic for any pasted HLS URL (URL checker tab).
app.get('/api/tv/check', async (req, res) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!isPublicHttpUrl(targetUrl)) return res.status(400).json({ error: 'missing or non-public url' });
  try {
    const result = await probeMirror(targetUrl, { includeSegment: true, fresh: true });
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Opt-in relay for CORS-locked / http-only mirrors on the https deployment.
app.get('/api/tv/relay.m3u8', async (req, res) => {
  try {
    const body = await getRelayedPlaylist(String(req.query.url || '').trim());
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.send(body);
  } catch (err) {
    res.status(err.statusCode || 502).send(`#EXTM3U\n#EXT-X-ERROR:${String(err.message || 'relay failed').replace(/\s+/g, ' ')}\n`);
  }
});

app.get('/api/tv/relay/segment', async (req, res) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!isPublicHttpUrl(targetUrl)) return res.status(400).send('invalid url');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  res.on('close', () => controller.abort());

  try {
    const headers = { ...UPSTREAM_HEADERS };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(targetUrl, { headers, redirect: 'follow', signal: controller.signal });

    res.status(upstream.status);
    for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=10');
    clearTimeout(timer);

    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    clearTimeout(timer);
    if (!res.headersSent) res.status(502).send(`relay error: ${err.message}`);
    else res.end();
  }
});


// 7b5. Auto-mirror IPTV playlist: one stable URL per channel, resolved to the
// best live mirror on every request, so a dead host never breaks the entry.
app.get(['/tv.m3u', '/tv.m3u8', '/get.php'], async (req, res) => {
  const hostUrl = getHostUrl(req);
  const cdnBase = getCdnPublicBaseUrl();
  const body = buildAutoMirrorM3u({
    hostUrl,
    categoryFilter: requestCategoryFilter(req),
    allGroup: !isFalseQuery(req.query.allgroup),
    logoUrlFor: (channelId) => rewriteStaticAssetUrl(`${hostUrl}/tv-logos/${channelId}.png`, cdnBase)
  });

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="nuvio-magyar-tv.m3u"');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.send(body);
});

// 7b6. Mirror resolver used by the auto-mirror playlist and Xtream clients.
app.get('/api/tv/live/:channelId', async (req, res) => {
  const channelId = String(req.params.channelId || '').replace(/\.(m3u8?|ts)$/i, '');
  try {
    const resolved = await resolveBestMirror(channelId);
    if (!resolved) {
      return res.status(404).send('#EXTM3U\n#EXT-X-ERROR: unknown channel\n');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Stream-Host', resolved.host || '');
    res.setHeader('X-Stream-Online', resolved.online ? '1' : '0');
    return res.redirect(302, resolved.url);
  } catch (err) {
    return res.status(502).send(`#EXTM3U\n#EXT-X-ERROR:${String(err.message || 'resolver failed').replace(/\s+/g, ' ')}\n`);
  }
});


// 7b8. EPG API for the /tv viewer (port.hu, cached per channel/category).
app.get('/api/tv/epg/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getXmltvStatus());
});

app.get('/api/tv/epg/grid', async (req, res) => {
  try {
    const payload = await getScheduleGrid(
      String(req.query.category || '').trim(),
      { hours: Number(req.query.hours) || 12, fresh: isTruthyQuery(req.query.fresh) }
    );
    if (!payload) return res.status(404).json({ error: 'unknown category' });
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tv/epg/:channelId', async (req, res) => {
  try {
    const payload = await getChannelEpgPayload(req.params.channelId, { fresh: isTruthyQuery(req.query.fresh) });
    if (!payload) return res.status(404).json({ error: 'unknown channel' });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7b9. Category-wide "now playing" list for the programme guide tab.
app.get('/api/tv/epg', async (req, res) => {
  try {
    const payload = await getCategoryEpg(String(req.query.category || '').trim(), { fresh: isTruthyQuery(req.query.fresh) });
    if (!payload) return res.status(404).json({ error: 'unknown category' });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=180, stale-while-revalidate=600');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7b7. Minimal Xtream Codes API (TiviMate: add as Xtream account, any user/pass).
app.get('/player_api.php', (req, res) => {
  const hostUrl = getHostUrl(req);
  const action = String(req.query.action || '');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', action ? 'public, max-age=30, s-maxage=60' : 'no-store');
  res.json(handlePlayerApi(action, req.query, hostUrl, requestCategoryFilter(req)));
});

app.get('/xmltv.php', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600, stale-while-revalidate=21600');
  res.send(getXmltvDocument(requestCategoryFilter(req)));
});

// Xtream live stream path: /live/<user>/<pass>/<streamId>(.m3u8|.ts)
app.get('/live/:username/:password/:streamId', async (req, res) => {
  const channelId = String(req.params.streamId || '').replace(/\.(m3u8?|ts)$/i, '');
  try {
    const resolved = await resolveBestMirror(channelId);
    if (!resolved) {
      return res.status(404).send('#EXTM3U\n#EXT-X-ERROR: unknown channel\n');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, resolved.url);
  } catch (err) {
    return res.status(502).send(`#EXTM3U\n#EXT-X-ERROR:${String(err.message || 'resolver failed').replace(/\s+/g, ' ')}\n`);
  }
});

// 7c. High-Resolution Dynamic TV Artwork (600x900 PNG Poster, 1280x720 PNG Backdrop, 500x500 PNG Logo)
app.get(['/tv-poster/:id', '/tv-poster/:id.png', '/tv-poster/:id.svg'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  const rawId = (req.params.id || '').replace(/\.(svg|png)$/i, '');
  const pngPath = path.join(__dirname, 'public', 'tv-posters', `${rawId}.png`);
  if (fs.existsSync(pngPath)) {
    const cdnBase = getCdnPublicBaseUrl();
    if (cdnBase) return res.redirect(302, `${cdnBase}/tv-posters/${rawId}.png`);
    res.setHeader('Content-Type', 'image/png');
    return res.sendFile(pngPath);
  }
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  const meta = getOnlineStreamMeta(rawId, getHostUrl(req));
  const chData = meta?.meta || { name: 'Élő TV', category: 'hu-live-orszagos' };
  res.send(generateTvPosterSvg(chData));
});

app.get(['/tv-background/:id', '/tv-background/:id.png', '/tv-background/:id.svg'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  const rawId = (req.params.id || '').replace(/\.(svg|png)$/i, '');
  const pngPath = path.join(__dirname, 'public', 'tv-backgrounds', `${rawId}.png`);
  if (fs.existsSync(pngPath)) {
    const cdnBase = getCdnPublicBaseUrl();
    if (cdnBase) return res.redirect(302, `${cdnBase}/tv-backgrounds/${rawId}.png`);
    res.setHeader('Content-Type', 'image/png');
    return res.sendFile(pngPath);
  }
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  const meta = getOnlineStreamMeta(rawId, getHostUrl(req));
  const chData = meta?.meta || { name: 'Élő TV', category: 'hu-live-orszagos' };
  res.send(generateTvBackgroundSvg(chData));
});

app.get(['/tv-logo/:id', '/tv-logo/:id.png', '/tv-logo/:id.svg'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
  const rawId = (req.params.id || '').replace(/\.(svg|png)$/i, '');
  const pngPath = path.join(__dirname, 'public', 'tv-logos', `${rawId}.png`);
  if (fs.existsSync(pngPath)) {
    const cdnBase = getCdnPublicBaseUrl();
    if (cdnBase) return res.redirect(302, `${cdnBase}/tv-logos/${rawId}.png`);
    res.setHeader('Content-Type', 'image/png');
    return res.sendFile(pngPath);
  }
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  const meta = getOnlineStreamMeta(rawId, getHostUrl(req));
  const chData = meta?.meta || { name: 'Élő TV', category: 'hu-live-orszagos' };
  res.send(generateTvLogoSvg(chData));
});

app.get(['/api/live/:streamId', '/hls/live/:streamId'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const rawStreamId = (req.params.streamId || 'mtv4live').replace(/\.m3u8$/i, '');
  const quality = req.query.q || '1080p';
  const clientIp = getClientIp(req);

  try {
    const playlist = await getRewrittenMasterPlaylist(rawStreamId, quality, clientIp);
    if (playlist) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      return res.send(playlist);
    }

    const originalUrl = await getLiveHlsStream(rawStreamId, clientIp);
    if (originalUrl) {
      return res.redirect(originalUrl);
    }

    res.status(404).send('#EXTM3U\n#EXT-X-ERROR: Stream not found\n');
  } catch (err) {
    console.error(`[Server] Live stream error for ${rawStreamId}:`, err);
    res.status(500).send('#EXTM3U\n#EXT-X-ERROR: Failed to load stream\n');
  }
});

// 8. Episodes API for Season/Episode selector
app.get('/api/episodes', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = (req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing id param' });
  try {
    let targetId = id;
    if (!id.startsWith('tt') && !id.startsWith('tmdb:') && !id.startsWith('mediaklikk:') && !id.startsWith('netmozi:') && !id.startsWith('tvdb:')) {
      const seriesResults = await searchCatalog('series', id);
      const cleanQ = id.toLowerCase().trim();
      const best = (seriesResults || []).find(s => s.name.toLowerCase().includes(cleanQ)) || seriesResults?.[0];
      if (best && best.id) {
        targetId = best.id;
      }
    }
    const data = await getSeriesEpisodes(targetId);
    if (data) {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
      return res.json(data);
    }
    res.json({ meta: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function scoreSearchRelevance(itemTitle, query, itemId = '') {
  if (!itemTitle || !query) return 0;
  const normTitle = (itemTitle || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let baseScore = 0;
  if (normTitle === normQuery) baseScore = 1000;
  else if (normTitle.startsWith(normQuery)) baseScore = 500;
  else if (normTitle.includes(normQuery)) baseScore = 300;
  else {
    const cleanT = normTitle.replace(/[^a-z0-9]/g, '');
    const cleanQ = normQuery.replace(/[^a-z0-9]/g, '');
    if (cleanT === cleanQ) baseScore = 1000;
    else if (cleanT.includes(cleanQ)) baseScore = 850;
    else if (cleanQ.includes(cleanT)) baseScore = 750;
    else {
      let fusedBonus = 0;
      if (cleanQ.includes('hoho') && cleanT.includes('hoho')) fusedBonus += 300;
      if (cleanQ.includes('horgasz') && cleanT.includes('horgasz')) fusedBonus += 500;
      if (fusedBonus > 0) return fusedBonus;

      const queryWords = normQuery.split(/\s+/).filter(w => w.length > 1);
      if (queryWords.length === 0) return 0;

      let matchedWords = 0;
      for (const w of queryWords) {
        if (normTitle.includes(w)) matchedWords++;
      }

      if (matchedWords === queryWords.length) {
        baseScore = 200 + (matchedWords * 25);
      } else {
        baseScore = matchedWords * 10;
      }
    }
  }

  if (itemId && itemId.startsWith('tt')) {
    baseScore += 50;
  }

  return baseScore;
}

// 9. Search API for web landing page
app.get('/api/search', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=7200, stale-while-revalidate=86400');
  const query = req.query.q || '';
  const filterType = req.query.type;
  const sendCdnResults = (items) => {
    const cdnBase = getCdnPublicBaseUrl();
    return res.json({ results: cdnBase ? (items || []).map(m => rewriteMetaMediaUrls(m, cdnBase)) : items });
  };
  try {
    if (filterType === 'tv') {
      const results = await searchCatalog('tv', query);
      return sendCdnResults(results);
    }
    if (filterType === 'movie') {
      const results = await searchCatalog('movie', query);
      return sendCdnResults(results);
    }
    if (filterType === 'classics') {
      const results = await searchCatalog('series', query, 'hu-mediaklikk-classics');
      return sendCdnResults(results);
    }
    if (filterType === 'series') {
      const results = await searchCatalog('series', query);
      return sendCdnResults(results);
    }

    const [tvResults, movieResults, seriesResults] = await Promise.all([
      searchCatalog('tv', query),
      searchCatalog('movie', query),
      searchCatalog('series', query)
    ]);

    if (!query) {
      const topPicks = [
        tvResults.find(x => x.id === 'mediaklikk-live-m4'),
        seriesResults.find(x => x.id === 'tt0154077'),
        seriesResults.find(x => x.id === 'tt0861751'),
        movieResults.find(x => x.id === 'tt0179955'),
        movieResults.find(x => x.id === 'tt0121403'),
        seriesResults.find(x => x.id === 'tt0129719'),
        seriesResults.find(x => x.id === 'tt0056789'),
        tvResults.find(x => x.id === 'mediaklikk-live-m1'),
        movieResults.find(x => x.id === 'tt0131636'),
        seriesResults.find(x => x.id === 'tt8111088'),
        movieResults.find(x => x.id === 'tt0257290'),
        seriesResults.find(x => x.id === 'tt0136650'),
        tvResults.find(x => x.id === 'mediaklikk-live-duna'),
        tvResults.find(x => x.id === 'mediaklikk-live-m2'),
      ].filter(Boolean);

      const seen = new Set(topPicks.map(x => x.id));
      const combined = [...topPicks];
      for (const item of [...tvResults, ...seriesResults, ...movieResults]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
      }
      return sendCdnResults(combined);
    }

    const seen = new Set();
    const combined = [];
    for (const item of [...tvResults, ...seriesResults, ...movieResults]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }
    if (query) {
      combined.sort((a, b) => scoreSearchRelevance(b.name, query, b.id) - scoreSearchRelevance(a.name, query, a.id));
    }
    sendCdnResults(combined);
  } catch (err) {
    res.status(500).json({ error: err.message, results: [] });
  }
});

// 10. Diagnostic & Live Test API for the web landing page
app.get('/api/test', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let id = (req.query.id || 'tt0179955').trim();
  const typeParam = req.query.type;
  const reqSeason = req.query.season ? parseInt(req.query.season, 10) : null;
  const reqEpisode = req.query.episode ? parseInt(req.query.episode, 10) : null;
  const config = parseConfig(null, req.query);
  config.hostUrl = getHostUrl(req);
  config.clientIp = getClientIp(req);

  const startMs = Date.now();

  if (id.startsWith('mediaklikk-live-') || id.startsWith('onlinestream-live-')) {
    try {
      const liveResult = await handleStreamRequest('movie', id, config);
      return res.json({
        streams: liveResult.streams || [],
        queryId: id,
        durationMs: Date.now() - startMs
      });
    } catch (e) {
      return res.status(500).json({ error: e.message, streams: [] });
    }
  }

  let matchedItem = null;
  if (!id.startsWith('tt') && !id.startsWith('tmdb:') && !id.startsWith('mediaklikk:') && !id.startsWith('netmozi:') && !id.startsWith('tvdb:') && !id.startsWith('onlinestream-live-')) {
    try {
      const [movies, series] = await Promise.all([
        typeParam === 'series' ? Promise.resolve([]) : searchCatalog('movie', id),
        typeParam === 'movie' ? Promise.resolve([]) : searchCatalog('series', id)
      ]);
      const cleanId = id.toLowerCase().trim();
      const exactMovie = (movies || []).find(m => m.name.toLowerCase().includes(cleanId));
      const exactSeries = (series || []).find(s => s.name.toLowerCase().includes(cleanId));

      matchedItem = typeParam === 'series'
        ? (exactSeries || series?.[0])
        : typeParam === 'movie'
        ? (exactMovie || movies?.[0])
        : (exactMovie || exactSeries || movies?.[0] || series?.[0]);

      if (matchedItem) {
        id = matchedItem.id;
      }
    } catch (e) {}
  }

  if (id.startsWith('mediaklikk-live-') || id.startsWith('onlinestream-live-')) {
    try {
      const liveResult = await handleStreamRequest('movie', id, config);
      return res.json({
        streams: liveResult.streams || [],
        matchedItem,
        queryId: id,
        durationMs: Date.now() - startMs
      });
    } catch (e) {
      return res.status(500).json({ error: e.message, streams: [] });
    }
  }

  const isSeries = typeParam === 'series' ||
    (matchedItem && matchedItem.type === 'series') ||
    (id.includes(':') && !id.startsWith('mediaklikk:program:')) ||
    id.startsWith('mediaklikk:program:') ||
    id.startsWith('netmozi:series:');

  let seriesBaseId = null;
  let targetSeason = reqSeason || 1;
  let targetEpisode = reqEpisode || 1;

  if (isSeries) {
    if (id.startsWith('mediaklikk:program:')) {
      const parts = id.split(':');
      if (parts.length >= 5) {
        seriesBaseId = parts.slice(0, parts.length - 2).join(':');
        targetSeason = reqSeason || parseInt(parts[parts.length - 2], 10) || 1;
        targetEpisode = reqEpisode || parseInt(parts[parts.length - 1], 10) || 1;
      } else {
        seriesBaseId = id;
      }
      id = `${seriesBaseId}:${targetSeason}:${targetEpisode}`;
    } else if (id.startsWith('netmozi:series:')) {
      const parts = id.split(':');
      seriesBaseId = `netmozi:series:${parts[2]}`;
      if (parts.length >= 5 && /^\d+$/.test(parts[3]) && /^\d+$/.test(parts[4])) {
        targetSeason = reqSeason || parseInt(parts[3], 10) || 1;
        targetEpisode = reqEpisode || parseInt(parts[4], 10) || 1;
      }
      id = `${seriesBaseId}:${targetSeason}:${targetEpisode}`;
    } else if (id.startsWith('tt') || id.startsWith('tmdb:') || id.startsWith('tvdb:')) {
      const parts = id.split(':');
      seriesBaseId = parts[0];
      if (id.startsWith('tmdb:')) seriesBaseId = `tmdb:${parts[1]}`;
      if (id.startsWith('tvdb:')) seriesBaseId = `tvdb:${parts[1]}`;
      if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 2]) && /^\d+$/.test(parts[parts.length - 1])) {
        targetSeason = reqSeason || parseInt(parts[parts.length - 2], 10) || 1;
        targetEpisode = reqEpisode || parseInt(parts[parts.length - 1], 10) || 1;
      }
      id = `${seriesBaseId}:${targetSeason}:${targetEpisode}`;
    } else {
      seriesBaseId = id.split(':')[0];
      id = `${seriesBaseId}:${targetSeason}:${targetEpisode}`;
    }
  }

  const type = isSeries ? 'series' : (typeParam || 'movie');
  try {
    const [result, seriesMeta] = await Promise.all([
      handleStreamRequest(type, id, config),
      isSeries && seriesBaseId ? getSeriesEpisodes(seriesBaseId) : Promise.resolve(null)
    ]);
    const durationMs = Date.now() - startMs;
    const seriesEpisodes = seriesMeta ? {
      id: seriesBaseId,
      name: seriesMeta.name,
      seasons: seriesMeta.seasons,
      currentSeason: targetSeason,
      currentEpisode: targetEpisode
    } : null;

    res.json({
      ...result,
      queryId: id,
      matchedItem,
      seriesEpisodes,
      durationMs
    });
  } catch (err) {
    res.status(500).json({ error: err.message, streams: [] });
  }
});

// 11. Provider Diagnostic / Tester Endpoint
app.get('/api/provider-test', async (req, res) => {
  const providerId = (req.query.provider || '').toLowerCase().trim();
  const rawTitle = (req.query.title || 'Macskafogó').trim();
  const type = req.query.type || 'movie';
  const season = req.query.season ? parseInt(req.query.season, 10) : null;
  const episode = req.query.episode ? parseInt(req.query.episode, 10) : null;
  const clientIp = getClientIp(req);

  const scraper = ALL_SCRAPERS.find(s => s.id === providerId);
  if (!scraper) {
    return res.status(400).json({
      ok: false,
      error: `Ismeretlen szolgáltató: ${providerId}`,
      available: ALL_SCRAPERS.map(s => s.id)
    });
  }

  const t0 = Date.now();
  try {
    const meta = {
      hungarianTitle: rawTitle,
      englishTitle: rawTitle,
      searchTitles: [rawTitle],
      type,
      season,
      episode,
      hostUrl: getHostUrl(req),
      clientIp
    };

    const streams = await Promise.race([
      scraper.fn(meta),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Időtúllépés (15s)')), 15000))
    ]);

    const durationMs = Date.now() - t0;
    res.json({
      ok: true,
      provider: scraper.id,
      name: scraper.name,
      title: rawTitle,
      count: (streams || []).length,
      durationMs,
      streams: streams || []
    });
  } catch (err) {
    const durationMs = Date.now() - t0;
    res.json({
      ok: false,
      provider: scraper.id,
      name: scraper.name,
      title: rawTitle,
      count: 0,
      durationMs,
      error: err.message,
      streams: []
    });
  }
});

// Runtime & Migration Metadata API (used by configurator & /uj-link migration page)
app.get('/api/runtime-info', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const cfg = parseConfig(null, req.query);
  cfg.hostUrl = getHostUrl(req);
  if (cfg.previewMigration) {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  }
  res.json(getRuntimeNoticeMeta(cfg));
});

// Static Migration & Ko-fi TV QR Pages
app.get(['/uj-link', '/uj-link.html'], (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  res.sendFile(path.join(__dirname, 'public', 'uj-link.html'));
});

app.get(['/tamogatas', '/tamogatas.html'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  res.sendFile(path.join(__dirname, 'public', 'tamogatas.html'));
});

// SEO: robots.txt & sitemap.xml for private / custom self-hosted deployments
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  if (isVercelRequest(req)) {
    return res.send('User-agent: *\nDisallow: /\n');
  }
  const hostUrl = getHostUrl(req);
  res.send(`User-agent: *\nAllow: /\n\nSitemap: ${hostUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  if (isVercelRequest(req)) {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
  }
  const hostUrl = getHostUrl(req);
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${hostUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${hostUrl}/configure</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`);
});

// Private Usage Statistics Dashboard & JSON API (/api/stats)
app.get('/api/stats', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (!isAuthorizedStatsRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized (invalid or missing STATS_KEY)' });
  }

  try {
    const snapshot = await getStatsSnapshot();
    const wantsHtml = req.query.format === 'html' || (req.query.format !== 'json' && String(req.headers.accept || '').includes('text/html'));
    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderStatsHtml(snapshot, String(req.query.key || '')));
    }
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download full anonymous stats backup JSON
app.get('/api/stats/backup', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (!isAuthorizedStatsRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized (invalid or missing STATS_KEY)' });
  }

  const backup = exportStatsBackup();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="nuvio-stats-backup-${backup.dayKey}.json"`);
  res.send(JSON.stringify(backup, null, 2));
});

// Restore previously saved stats backup JSON (strictly requires configured STATS_KEY)
app.post('/api/stats/import', express.json({ limit: '512kb' }), (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const configuredKey = String(process.env.STATS_KEY || '').trim();
  if (!configuredKey) {
    return res.status(403).json({ error: 'Set STATS_KEY environment variable before importing stats backups' });
  }
  if (!isAuthorizedStatsRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized (invalid STATS_KEY)' });
  }

  try {
    const restored = importStatsBackup(req.body);
    res.json(restored);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: pkg.version || '2.7.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

const appHtmlCache = new Map();

/**
 * Serves one of the new app pages. Under the optional ACCESS_KEY prefix the
 * absolute asset URLs must be rewritten and the client JS needs to know the
 * prefix so its API calls hit /p/<key>/api/....
 */
function sendAppHtml(req, res, fileName) {
  let html = appHtmlCache.get(fileName);
  if (!html) {
    html = fs.readFileSync(path.join(__dirname, 'public', fileName), 'utf8');
    appHtmlCache.set(fileName, html);
  }

  const prefix = req._privatePrefix || '';
  if (prefix) {
    html = applyPrivatePrefix(html, prefix);
    res.setHeader('Cache-Control', 'private, no-store');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  }

  html = html.replace('<head>', `<head>\n  <script>window.__BASE_PREFIX=${JSON.stringify(prefix)};</script>`);
  return res.type('html').send(html);
}

/**
 * Rewrites every root-relative href/src (and CSS url(/...)) to the optional
 * ACCESS_KEY prefix, so all internal links keep working behind /p/<key>/.
 */
function applyPrivatePrefix(html, prefix) {
  if (!prefix) return html;
  let out = String(html).replace(/(href|src|action)="\/(?!\/)/g, `$1="${prefix}/`);
  out = out.replace(/url\((['"]?)\//g, `url($1${prefix}/`);
  return out;
}

let cachedIndexHtml = null;
function sendConfiguratorHtml(req, res) {
  if (!cachedIndexHtml) {
    cachedIndexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  }
  const prefix = req._privatePrefix || '';
  if (!prefix) {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    return res.type('html').send(cachedIndexHtml);
  }
  res.setHeader('Cache-Control', 'private, no-store');
  const rewritten = applyPrivatePrefix(cachedIndexHtml, prefix)
    .replace('<head>', `<head>\n  <script>window.__BASE_PREFIX=${JSON.stringify(prefix)};</script>`);
  return res.type('html').send(rewritten);
}

// Configure & Index Routes
app.get(['/configure', '/:config/configure'], (req, res) => {
  return sendConfiguratorHtml(req, res);
});

// Catch-all route to serve index.html for root
app.get('/', (req, res) => {
  return sendConfiguratorHtml(req, res);
});

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Nuvio & Stremio Hungarian Addon is running!`);
    console.log(`📡 Local Port: http://localhost:${PORT}`);
    console.log(`📋 Manifest URL: http://localhost:${PORT}/manifest.json`);
    console.log(`⚙️ Configurator: http://localhost:${PORT}/configure`);
    console.log(`======================================================\n`);
  });

  startAutoSync();

  const shutdown = (signal) => {
    console.log(`\n[Server] ${signal} received, closing HTTP server...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
