const express = require('express');
const cors = require('cors');
const path = require('path');
const pkg = require('./package.json');
const { getManifest, handleStreamRequest, parseConfig: parseAddonConfig, ALL_SCRAPERS } = require('./src/addon');
const { searchCatalog, getMeta } = require('./src/catalog');
const { getMediaMeta, getSeriesEpisodes } = require('./src/utils/meta');
const { getLiveHlsStream, getRewrittenMasterPlaylist } = require('./src/scrapers/mediaklikk');

const app = express();
const PORT = process.env.PORT || 7000;

// Enable CORS for Stremio & Nuvio Web/Mobile clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

// Serve static landing & configuration page + logos + channel icons
app.use(express.static(path.join(__dirname, 'public')));

// Explicit static routes for Vercel Serverless compatibility
app.get('/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

app.get('/icon.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'icon.png'));
});

app.get('/logo.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'logo.svg'));
});

app.get('/channels/:file', (req, res) => {
  const safeFile = path.basename(req.params.file || '');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
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
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'nuvio-magyar-http.vercel.app';
  return `${proto}://${host}`;
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
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const config = parseConfig(null, req.query);
  config.hostUrl = getHostUrl(req);
  res.json(getManifest(config));
});

// 2. Configured Manifest Route (/:config/manifest.json)
app.get('/:config/manifest.json', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const config = parseConfig(req.params.config, req.query);
  config.hostUrl = getHostUrl(req);
  res.json(getManifest(config));
});

// 3. Catalog Routes (Enables searching and browsing Hungarian movies/series in Nuvio & Stremio)
async function handleCatalog(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  try {
    const metas = await searchCatalog(type, searchQuery, cleanId, skip);
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1200');
    res.json({ metas });
  } catch (err) {
    console.error('[Server] Catalog error:', err);
    res.json({ metas: [] });
  }
}

app.get('/catalog/:type/:id.json', handleCatalog);
app.get('/catalog/:type/:id/:extra.json', handleCatalog);
app.get('/:config/catalog/:type/:id.json', handleCatalog);
app.get('/:config/catalog/:type/:id/:extra.json', handleCatalog);

// 4. Meta Route (Provides episode lists and details for Hungarian series/movies)
async function handleMeta(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { type } = req.params;
  const rawId = decodeURIComponent(req.params.id || '').replace(/\.json$/, '');

  try {
    const metaObj = await getMeta(type, rawId);
    if (metaObj) {
      return res.json(metaObj.meta ? metaObj : { meta: metaObj });
    }
    res.json({ meta: null });
  } catch (err) {
    console.error('[Server] Meta error:', err);
    res.json({ meta: null });
  }
}

app.get('/meta/:type/:id.json', handleMeta);
app.get('/:config/meta/:type/:id.json', handleMeta);

// 5. Default Stream Route (/stream/:type/:id.json)
app.get('/stream/:type/:id.json', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { type, id } = req.params;
    const config = parseConfig(null, req.query);
    config.hostUrl = getHostUrl(req);
    config.clientIp = getClientIp(req);
    const result = await handleStreamRequest(type, id, config);
    res.json({ streams: result.streams });
  } catch (err) {
    console.error('[Server] Stream error:', err);
    res.json({ streams: [] });
  }
});

// 6. Configured Stream Route (/:config/stream/:type/:id.json)
app.get('/:config/stream/:type/:id.json', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { config: configParam, type, id } = req.params;
    const config = parseConfig(configParam, req.query);
    config.hostUrl = getHostUrl(req);
    config.clientIp = getClientIp(req);
    const result = await handleStreamRequest(type, id, config);
    res.json({ streams: result.streams });
  } catch (err) {
    console.error('[Server] Configured stream error:', err);
    res.json({ streams: [] });
  }
});

// 7. Live TV HLS Master Playlist Rewriter (Orders 1080p Full HD first so Nuvio starts in 1080p)
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
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id param' });
  try {
    const data = await getSeriesEpisodes(id);
    if (data) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
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
  const query = req.query.q || '';
  const filterType = req.query.type;
  try {
    if (filterType === 'tv') {
      const results = await searchCatalog('tv', query);
      return res.json({ results });
    }
    if (filterType === 'movie') {
      const results = await searchCatalog('movie', query);
      return res.json({ results });
    }
    if (filterType === 'classics') {
      const results = await searchCatalog('series', query, 'hu-mediaklikk-classics');
      return res.json({ results });
    }
    if (filterType === 'series') {
      const results = await searchCatalog('series', query);
      return res.json({ results });
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
      return res.json({ results: combined });
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
    res.json({ results: combined });
  } catch (err) {
    res.status(500).json({ error: err.message, results: [] });
  }
});

// 10. Diagnostic & Live Test API for the web landing page
app.get('/api/test', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let id = (req.query.id || 'tt0179955').trim();
  const typeParam = req.query.type;
  const config = parseConfig(null, req.query);
  config.hostUrl = getHostUrl(req);
  config.clientIp = getClientIp(req);

  const startMs = Date.now();

  if (id.startsWith('mediaklikk-live-')) {
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
  if (!id.startsWith('tt') && !id.startsWith('tmdb:') && !id.startsWith('mediaklikk:') && !id.startsWith('netmozi:')) {
    try {
      const [movies, series] = await Promise.all([
        searchCatalog('movie', id),
        searchCatalog('series', id)
      ]);
      const cleanId = id.toLowerCase().trim();
      const exactMovie = movies.find(m => m.name.toLowerCase().includes(cleanId));
      const exactSeries = series.find(s => s.name.toLowerCase().includes(cleanId));

      matchedItem = exactMovie || exactSeries || movies[0] || series[0];
      if (matchedItem) {
        if (matchedItem.type === 'series') {
          id = matchedItem.id.match(/:\d+:\d+$/) ? matchedItem.id : `${matchedItem.id}:1:1`;
        } else {
          id = matchedItem.id;
        }
      }
    } catch (e) {}
  }

  const type = typeParam || (id.includes(':') && !id.startsWith('mediaklikk:program:') ? 'series' : 'movie');
  try {
    const result = await handleStreamRequest(type, id, config);
    const durationMs = Date.now() - startMs;
    res.json({ ...result, queryId: id, matchedItem, durationMs });
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: pkg.version || '2.5.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Configure Route & Index Page
app.get(['/configure', '/:config/configure'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route to serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Nuvio & Stremio Hungarian Addon is running!`);
    console.log(`📡 Local Port: http://localhost:${PORT}`);
    console.log(`📋 Manifest URL: http://localhost:${PORT}/manifest.json`);
    console.log(`⚙️ Configurator: http://localhost:${PORT}/configure`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
