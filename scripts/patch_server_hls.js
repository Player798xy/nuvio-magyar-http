const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

// 1. Add imports if not present
if (!serverCode.includes("require('./src/tv_graphics')")) {
  const importTarget = "const { getManifest, handleStreamRequest, parseConfig: parseAddonConfig, ALL_SCRAPERS } = require('./src/addon');";
  const importRepl = `const { getManifest, handleStreamRequest, parseConfig: parseAddonConfig, ALL_SCRAPERS } = require('./src/addon');
const { getOnlineStreamMeta } = require('./src/scrapers/onlinestream');
const { generateTvPosterSvg, generateTvBackgroundSvg, generateTvLogoSvg } = require('./src/tv_graphics');`;
  serverCode = serverCode.replace(importTarget, importRepl);
  console.log('Added tv_graphics & onlinestream imports to server.js');
}

// 2. Add HLS Proxy and SVG Artwork endpoints
if (!serverCode.includes("app.get(['/proxy/hls.m3u8', '/proxy/hls']")) {
  const proxyCode = `
// 7b. Universal HLS Proxy for Nuvio / Stremio ExoPlayer (Solves CORS, Mixed-Content, and Referer issues)
app.get(['/proxy/hls.m3u8', '/proxy/hls'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const targetUrl = (req.query.url || '').trim();
  if (!targetUrl) {
    return res.status(400).send('#EXTM3U\\n#EXT-X-ERROR: Missing url param\\n');
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://onlinestream.live/'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(\`#EXTM3U\\n#EXT-X-ERROR: Upstream returned \${upstreamRes.status}\\n\`);
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const hostUrl = getHostUrl(req);

    if (contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL') || targetUrl.includes('.m3u8')) {
      const text = await upstreamRes.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');

      const lines = text.split(/\\r?\\n/);
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith('#')) {
          return trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
            try {
              const absUri = new URL(uri, targetUrl).toString();
              return \`URI="\${hostUrl}/proxy/hls?url=\${encodeURIComponent(absUri)}"\`;
            } catch (e) {
              return match;
            }
          });
        }
        try {
          const absUrl = new URL(trimmed, targetUrl).toString();
          return \`\${hostUrl}/proxy/hls?url=\${encodeURIComponent(absUrl)}\`;
        } catch (e) {
          return line;
        }
      });

      return res.send(rewritten.join('\\n'));
    }

    res.setHeader('Content-Type', contentType || 'video/mp2t');
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    return res.send(buffer);
  } catch (err) {
    console.error('[HLS Proxy] Error for', targetUrl, err.message);
    res.status(502).send(\`#EXTM3U\\n#EXT-X-ERROR: Proxy error: \${err.message}\\n\`);
  }
});

// 7c. High-Resolution Dynamic TV Artwork (600x900 Poster, 1280x720 Backdrop, 500x500 Logo)
app.get(['/tv-poster/:id', '/tv-poster/:id.svg', '/tv-poster/:id.png'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  const rawId = (req.params.id || '').replace(/\\.(svg|png)$/i, '');
  const meta = getOnlineStreamMeta(rawId, getHostUrl(req));
  const chData = meta?.meta || { name: 'Élő TV', category: 'hu-live-orszagos' };
  res.send(generateTvPosterSvg(chData));
});

app.get(['/tv-background/:id', '/tv-background/:id.svg', '/tv-background/:id.png'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  const rawId = (req.params.id || '').replace(/\\.(svg|png)$/i, '');
  const meta = getOnlineStreamMeta(rawId, getHostUrl(req));
  const chData = meta?.meta || { name: 'Élő TV', category: 'hu-live-orszagos' };
  res.send(generateTvBackgroundSvg(chData));
});

app.get(['/tv-logo/:id', '/tv-logo/:id.svg', '/tv-logo/:id.png'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  const rawId = (req.params.id || '').replace(/\\.(svg|png)$/i, '');
  const meta = getOnlineStreamMeta(rawId, getHostUrl(req));
  const chData = meta?.meta || { name: 'Élő TV', category: 'hu-live-orszagos' };
  res.send(generateTvLogoSvg(chData));
});
`;
  const routeTarget = "app.get(['/api/live/:streamId', '/hls/live/:streamId'], async (req, res) => {";
  serverCode = serverCode.replace(routeTarget, proxyCode + '\n' + routeTarget);
  console.log('Added HLS proxy and TV artwork endpoints to server.js');
}

// 3. Update handleCatalog and handleMeta to pass hostUrl
serverCode = serverCode.replace(
  'const rawMetas = await searchCatalog(type, searchQuery, cleanId, { skip, search: searchQuery });',
  'const rawMetas = await searchCatalog(type, searchQuery, cleanId, { skip, search: searchQuery, hostUrl: getHostUrl(req) });'
);

serverCode = serverCode.replace(
  'const metaObj = await getMeta(type, rawId);',
  'const metaObj = await getMeta(type, rawId, getHostUrl(req));'
);

fs.writeFileSync('server.js', serverCode, 'utf8');
console.log('server.js successfully patched');
