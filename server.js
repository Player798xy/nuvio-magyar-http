const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const pkg = require('./package.json');
const { getManifest, handleStreamRequest, parseConfig: parseAddonConfig, ALL_SCRAPERS } = require('./src/addon');
const { getOnlineStreamMeta } = require('./src/scrapers/onlinestream');
const { generateTvPosterSvg, generateTvBackgroundSvg, generateTvLogoSvg } = require('./src/tv_graphics');
const { searchCatalog, getMeta } = require('./src/catalog');
const { getMediaMeta, getSeriesEpisodes } = require('./src/utils/meta');
const { getLiveHlsStream, getRewrittenMasterPlaylist } = require('./src/scrapers/mediaklikk');

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

// Serve static landing & configuration page + logos + channel icons
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
  }
}));

// Explicit static routes for Vercel Serverless compatibility
app.get('/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

app.get('/icon.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'icon.png'));
});

app.get('/logo.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'logo.svg'));
});

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const config = parseConfig(null, req.query);
  config.hostUrl = getHostUrl(req);
  res.json(getManifest(config));
});

// 2. Configured Manifest Route (/:config/manifest.json)
app.get('/:config/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
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

  try {
    const rawMetas = await searchCatalog(type, searchQuery, cleanId, { skip, search: searchQuery, hostUrl: getHostUrl(req) });
    const metas = (rawMetas || []).map(m => sanitizeMetaPreview(m, type)).filter(Boolean);
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1200');
    res.json({ metas });
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

  try {
    const metaObj = await getMeta(type, rawId, getHostUrl(req));
    if (metaObj) {
      const m = metaObj.meta ? { ...metaObj.meta } : { ...metaObj };
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
      return res.json({ meta: m });
    }
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

// 5. Default and Configured Stream Routes (/stream/:type/:id.json)
async function handleStream(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
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

// 7b. Universal High-Performance HLS Streaming Proxy
app.get(['/proxy/hls.m3u8', '/proxy/hls'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = (req.query.url || '').trim();
  if (!targetUrl) {
    return res.status(400).send('#EXTM3U\n#EXT-X-ERROR: Missing url param\n');
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    return res.status(400).send('#EXTM3U\n#EXT-X-ERROR: Invalid target URL\n');
  }

  const host = parsed.hostname.toLowerCase();
  const upstreamHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': '*/*'
  };

  if (host.includes('onlinestream') || host.includes('gradetv') || host.includes('antik') || host.includes('141.94.193.53') || host.includes('lexanetwork')) {
    upstreamHeaders['Referer'] = 'https://onlinestream.live/';
    upstreamHeaders['Origin'] = 'https://onlinestream.live';
  } else if (host.includes('mediaklikk') || host.includes('connectmedia')) {
    upstreamHeaders['Referer'] = 'https://mediaklikk.hu/';
    upstreamHeaders['Origin'] = 'https://mediaklikk.hu';
  } else if (host.includes('videa')) {
    upstreamHeaders['Referer'] = 'https://videa.hu/';
    upstreamHeaders['Origin'] = 'https://videa.hu';
  } else {
    upstreamHeaders['Referer'] = `${parsed.protocol}//${parsed.host}/`;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    if (req.headers['range']) {
      upstreamHeaders['Range'] = req.headers['range'];
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
      signal: controller.signal
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`#EXTM3U\n#EXT-X-ERROR: Upstream returned ${upstreamRes.status}\n`);
    }

    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    const hostUrl = getHostUrl(req);
    const isPlaylist = targetUrl.includes('.m3u8') ||
                       targetUrl.includes('api/s/') ||
                       contentType.includes('mpegurl') ||
                       contentType.includes('application/x-mpegurl');

    if (isPlaylist) {
      const text = await upstreamRes.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

      const isMediaPlaylist = text.includes('#EXTINF:');

      if (isMediaPlaylist) {
        // Live Media Playlist: Szigorú valós idejű szinkronizáció
        // Pontosan megőrizzük az upstream #EXT-X-MEDIA-SEQUENCE, #EXTINF és #EXT-X-DISCONTINUITY tageket,
        // így elkerüljük az ismétlődő részeket, visszaugrásokat és puffer-hurkokat!
        const lines = text.split(/\r?\n/);
        const outLines = [];

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim();
          if (!l) continue;

          if (l.startsWith('#')) {
            // URI="..." attribútumok átírása (pl. feliratok, hangok, kulcsok)
            const rewritten = l.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
              try {
                const absUri = new URL(uri, targetUrl).toString();
                const isSubPl = absUri.includes('.m3u8') || absUri.includes('api/s/') || absUri.includes('faixa=');
                const ep = isSubPl ? '/proxy/hls.m3u8' : '/proxy/hls';
                return `URI="${hostUrl}${ep}?url=${encodeURIComponent(absUri)}"`;
              } catch (e) {
                return match;
              }
            });
            outLines.push(rewritten);
          } else {
            // Szegmens URL átírása proxy végpontra
            try {
              const absUrl = new URL(l, targetUrl).toString();
              outLines.push(`${hostUrl}/proxy/hls?url=${encodeURIComponent(absUrl)}`);
            } catch (e) {
              outLines.push(l);
            }
          }
        }

        return res.send(outLines.join('\n'));
      }

      // Master Playlist: Rewrite sub-variant URLs
      const lines = text.split(/\r?\n/);
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
          return trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
            try {
              const absUri = new URL(uri, targetUrl).toString();
              const isSubPl = absUri.includes('.m3u8') || absUri.includes('api/s/') || absUri.includes('faixa=');
              const ep = isSubPl ? '/proxy/hls.m3u8' : '/proxy/hls';
              return `URI="${hostUrl}${ep}?url=${encodeURIComponent(absUri)}"`;
            } catch (e) {
              return match;
            }
          });
        }

        try {
          const absUrl = new URL(trimmed, targetUrl).toString();
          const isSubPlaylist = absUrl.includes('.m3u8') || absUrl.includes('faixa=') || absUrl.includes('api/s/');
          const proxyEndpoint = isSubPlaylist ? '/proxy/hls.m3u8' : '/proxy/hls';
          return `${hostUrl}${proxyEndpoint}?url=${encodeURIComponent(absUrl)}`;
        } catch (e) {
          return line;
        }
      });

      return res.send(rewritten.join('\n'));
    }

    // Binary media segment (.ts, .m4s, .aac, .mp4)
    if (upstreamRes.status === 206) {
      res.status(206);
      const contentRange = upstreamRes.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
    } else {
      res.status(200);
    }

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Accept-Ranges', 'bytes');

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      nodeStream.on('error', () => {
        if (!res.headersSent) {
          try { res.status(502).end(); } catch (e) {}
        }
      });
      req.on('close', () => {
        try { nodeStream.destroy(); } catch (e) {}
      });
      res.on('close', () => {
        try { nodeStream.destroy(); } catch (e) {}
      });
      return nodeStream.pipe(res);
    } else {
      return res.end();
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    if (!res.headersSent) {
      res.status(502).send(`#EXTM3U\n#EXT-X-ERROR: Proxy error: ${err.message}\n`);
    }
  }
});

// 7b2. XSPF Playlist Endpoint for VLC Media Player and Kodi
app.get(['/playlist.xspf', '/tv.xspf'], async (req, res) => {
  res.setHeader('Content-Type', 'application/xspf+xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="nuvio-magyar-tv.xspf"');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const hostUrl = getHostUrl(req);
  const { ALL_CHANNELS, ONLINESTREAM_CATEGORIES } = require('./src/scrapers/onlinestream');
  const catMap = new Map(ONLINESTREAM_CATEGORIES.map(c => [c.id, c.name]));

  const escapeXml = (unsafe) => (unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });

  const tracks = [];
  for (const ch of ALL_CHANNELS) {
    const catName = catMap.get(ch.category) || 'Magyar TV';
    let targetStream = '';

    if (ch.channelId === '4740') {
      targetStream = 'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8';
    } else if (ch.streams && ch.streams.length > 0) {
      targetStream = ch.streams[0].url || ch.streams[0].playerUrl;
    }

    if (!targetStream && ch.mtvaKey) {
      targetStream = `https://nuvio-magyar-http.vercel.app/api/live/mtv1live.m3u8`;
    }

    if (targetStream) {
      const proxyUrl = `${hostUrl}/proxy/hls.m3u8?url=${encodeURIComponent(targetStream)}`;
      const logoUrl = `${hostUrl}/tv-logos/${ch.channelId}.png`;
      tracks.push(`    <track>
      <title>${escapeXml(ch.name)}</title>
      <creator>${escapeXml(catName)}</creator>
      <album>Nuvio Magyar TV</album>
      <location>${escapeXml(proxyUrl)}</location>
      <image>${escapeXml(logoUrl)}</image>
      <annotation>${escapeXml(ch.description)}</annotation>
    </track>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<playlist version="1" xmlns="http://xspf.org/ns/0/">
  <title>Nuvio Magyar TV - Élő TV Csatornák (112 Adó)</title>
  <creator>Nuvio Magyar Streaming Pro</creator>
  <info>${hostUrl}</info>
  <trackList>
${tracks.join('\n')}
  </trackList>
</playlist>`;

  res.send(xml);
});

// 7b3. M3U / M3U8 Playlist Endpoint for IPTV Players
app.get(['/playlist.m3u', '/playlist.m3u8', '/tv.m3u', '/tv.m3u8'], async (req, res) => {
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="nuvio-magyar-tv.m3u"');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const hostUrl = getHostUrl(req);
  const { ALL_CHANNELS, ONLINESTREAM_CATEGORIES } = require('./src/scrapers/onlinestream');
  const catMap = new Map(ONLINESTREAM_CATEGORIES.map(c => [c.id, c.name]));

  const lines = ['#EXTM3U name="Nuvio Magyar TV"'];

  for (const ch of ALL_CHANNELS) {
    const catName = catMap.get(ch.category) || 'Magyar TV';
    let targetStream = '';

    if (ch.channelId === '4740') {
      targetStream = 'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8';
    } else if (ch.streams && ch.streams.length > 0) {
      targetStream = ch.streams[0].url || ch.streams[0].playerUrl;
    }

    if (targetStream) {
      const proxyUrl = `${hostUrl}/proxy/hls.m3u8?url=${encodeURIComponent(targetStream)}`;
      const logoUrl = `${hostUrl}/tv-logos/${ch.channelId}.png`;
      lines.push(`#EXTINF:-1 tvg-id="${ch.channelId}" tvg-name="${ch.name}" tvg-logo="${logoUrl}" group-title="${catName}",${ch.name}`);
      lines.push(proxyUrl);
    }
  }

  res.send(lines.join('\n'));
});

// 7c. High-Resolution Dynamic TV Artwork (600x900 PNG Poster, 1280x720 PNG Backdrop, 500x500 PNG Logo)
app.get(['/tv-poster/:id', '/tv-poster/:id.png', '/tv-poster/:id.svg'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  const rawId = (req.params.id || '').replace(/\.(svg|png)$/i, '');
  const pngPath = path.join(__dirname, 'public', 'tv-posters', `${rawId}.png`);
  if (fs.existsSync(pngPath)) {
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
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  const rawId = (req.params.id || '').replace(/\.(svg|png)$/i, '');
  const pngPath = path.join(__dirname, 'public', 'tv-backgrounds', `${rawId}.png`);
  if (fs.existsSync(pngPath)) {
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
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  const rawId = (req.params.id || '').replace(/\.(svg|png)$/i, '');
  const pngPath = path.join(__dirname, 'public', 'tv-logos', `${rawId}.png`);
  if (fs.existsSync(pngPath)) {
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: pkg.version || '2.5.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Configure Route & Index Page (supports ?old=1 or /old for legacy UI)
app.get('/old', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.old.html'));
});

app.get(['/configure', '/:config/configure'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const file = req.query.old === '1' ? 'index.old.html' : 'index.html';
  res.sendFile(path.join(__dirname, 'public', file));
});

// Catch-all route to serve index.html for root
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const file = req.query.old === '1' ? 'index.old.html' : 'index.html';
  res.sendFile(path.join(__dirname, 'public', file));
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
