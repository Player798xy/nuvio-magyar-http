const express = require('express');
const cors = require('cors');
const path = require('node:path');

const {
  PROVIDERS,
  getManifest,
  getCatalogMetas,
  getCustomMeta,
  getStreams
} = require('./src/addon');
const {
  getBaseUrl,
  handleProxyRequest,
  handleHlsRequest
} = require('./src/utils/proxy');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function parseExtra(extraRaw) {
  if (!extraRaw) return {};
  const extra = {};
  const clean = String(extraRaw).replace(/\.json$/i, '');
  for (const part of clean.split('&')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      extra[decodeURIComponent(part.slice(0, idx))] = decodeURIComponent(part.slice(idx + 1));
    }
  }
  return extra;
}

// 1. Configurator UI routes
app.get(['/', '/configure', '/:config/configure'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Providers & Health API
app.get('/api/providers', (req, res) => {
  res.json({
    version: '2.0.0',
    providers: PROVIDERS.map(({ id, name, defaultEnabled }) => ({ id, name, defaultEnabled }))
  });
});

// 3. Built-in HTTP Stream & HLS Proxy Endpoints
app.all('/api/proxy', handleProxyRequest);
app.get(['/api/hls', '/api/hls/:filename'], handleHlsRequest);

// 4. Stremio / Nuvio Manifest Endpoints
app.get('/manifest.json', (req, res) => {
  res.json(getManifest(null));
});

app.get('/:config/manifest.json', (req, res) => {
  res.json(getManifest(req.params.config));
});

// 5. Catalog Endpoints
app.get('/catalog/:type/:id.json', async (req, res) => {
  const metas = await getCatalogMetas(req.params.type, req.params.id, req.query || {});
  res.json({ metas });
});

app.get('/catalog/:type/:id/:extra.json', async (req, res) => {
  const extra = { ...(req.query || {}), ...parseExtra(req.params.extra) };
  const metas = await getCatalogMetas(req.params.type, req.params.id, extra);
  res.json({ metas });
});

app.get('/:config/catalog/:type/:id.json', async (req, res) => {
  const metas = await getCatalogMetas(req.params.type, req.params.id, req.query || {});
  res.json({ metas });
});

app.get('/:config/catalog/:type/:id/:extra.json', async (req, res) => {
  const extra = { ...(req.query || {}), ...parseExtra(req.params.extra) };
  const metas = await getCatalogMetas(req.params.type, req.params.id, extra);
  res.json({ metas });
});

// 6. Meta Endpoints (for MTVA Live TV & custom items)
app.get(['/meta/:type/:id.json', '/:config/meta/:type/:id.json'], async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const meta = await getCustomMeta(req.params.type, id);
  res.json({ meta });
});

// 7. Stream Endpoints
app.get('/stream/:type/:id.json', async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const baseUrl = getBaseUrl(req);
    const streams = await getStreams(req.params.type, id, null, baseUrl);
    res.json({ streams });
  } catch (err) {
    res.json({ streams: [], error: err.message });
  }
});

app.get('/:config/stream/:type/:id.json', async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const baseUrl = getBaseUrl(req);
    const streams = await getStreams(req.params.type, id, req.params.config, baseUrl);
    res.json({ streams });
  } catch (err) {
    res.json({ streams: [], error: err.message });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🇭🇺 Nuvio Magyar HTTP Streaming Addon running at http://localhost:${PORT}/manifest.json`);
  });
}

module.exports = app;
