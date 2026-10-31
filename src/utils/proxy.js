const { UA } = require('./meta');

/**
 * Built-in Vercel HTTP Stream & HLS Playlist Proxy / Rewriter
 * - `/api/proxy`: Proxies direct MP4/MKV/TS segments with Range header support, custom Referer/Origin/User-Agent,
 *   and Hungarian X-Forwarded-For headers.
 * - `/api/hls`: Proxies and rewrites `.m3u8` master/media playlists, sorts variant streams highest-resolution first (1080p+),
 *   and optionally wraps child playlists/segments through `/api/proxy` or `/api/hls`.
 */

const HU_IP = '84.2.44.12'; // Magyar Telekom residential range for Hungarian geo-unlock

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function buildProxyUrl(baseUrl, targetUrl, headers = {}, filename = 'video.mp4') {
  if (!baseUrl || !targetUrl) return targetUrl;
  const params = new URLSearchParams();
  params.set('url', targetUrl);
  if (headers.Referer || headers.referer) params.set('referer', headers.Referer || headers.referer);
  if (headers.Origin || headers.origin) params.set('origin', headers.Origin || headers.origin);
  if (headers['User-Agent'] || headers['user-agent']) params.set('ua', headers['User-Agent'] || headers['user-agent']);
  if (headers.Cookie || headers.cookie) params.set('cookie', headers.Cookie || headers.cookie);
  return `${baseUrl}/api/proxy?${params.toString()}`;
}

function buildHlsProxyUrl(baseUrl, targetUrl, headers = {}, proxySegments = false) {
  if (!baseUrl || !targetUrl) return targetUrl;
  const params = new URLSearchParams();
  params.set('url', targetUrl);
  if (headers.Referer || headers.referer) params.set('referer', headers.Referer || headers.referer);
  if (headers.Origin || headers.origin) params.set('origin', headers.Origin || headers.origin);
  if (proxySegments) params.set('seg', '1');
  return `${baseUrl}/api/hls/master.m3u8?${params.toString()}`;
}

/**
 * Reorders `#EXT-X-STREAM-INF` blocks inside an HLS master playlist so that the highest
 * resolution / bandwidth variant appears first (ensuring Nuvio & ExoPlayer pick 1080p immediately).
 */
function sortMasterM3u8Variants(content, basePlaylistUrl, wrapUrlFn = null) {
  const lines = String(content || '').split(/\r?\n/);
  const headerLines = [];
  const variants = [];
  const otherLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const nextLine = (lines[i + 1] || '').trim();
      if (nextLine && !nextLine.startsWith('#')) {
        const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        const height = resMatch ? parseInt(resMatch[1], 10) : 0;
        const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        let resolvedUri = nextLine;
        try {
          resolvedUri = new URL(nextLine, basePlaylistUrl).href;
        } catch {}
        if (wrapUrlFn) resolvedUri = wrapUrlFn(resolvedUri, true);
        variants.push({
          info: line,
          uri: resolvedUri,
          height,
          bandwidth
        });
        i++;
        continue;
      }
    }

    if (line.startsWith('#EXTM3U') || line.startsWith('#EXT-X-VERSION') || line.startsWith('#EXT-X-INDEPENDENT-SEGMENTS')) {
      headerLines.push(line);
    } else if (line.startsWith('#EXT-X-MEDIA:')) {
      const rewrittenMedia = line.replace(/URI="([^"]+)"/i, (m, uri) => {
        try {
          const abs = new URL(uri, basePlaylistUrl).href;
          return `URI="${wrapUrlFn ? wrapUrlFn(abs, true) : abs}"`;
        } catch {
          return m;
        }
      });
      otherLines.push(rewrittenMedia);
    } else {
      otherLines.push(line);
    }
  }

  if (variants.length === 0) return null;

  variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));

  const out = [
    ...(headerLines.length ? headerLines : ['#EXTM3U']),
    ...otherLines,
    ...variants.flatMap((v) => [v.info, v.uri])
  ];
  return out.join('\n') + '\n';
}

function rewriteMediaM3u8(content, basePlaylistUrl, wrapSegmentFn = null) {
  const lines = String(content || '').split(/\r?\n/);
  const out = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const rewrittenTag = line.replace(/URI="([^"]+)"/i, (m, uri) => {
        try {
          const abs = new URL(uri, basePlaylistUrl).href;
          return `URI="${wrapSegmentFn ? wrapSegmentFn(abs, false) : abs}"`;
        } catch {
          return m;
        }
      });
      out.push(rewrittenTag);
    } else {
      let abs = line;
      try {
        abs = new URL(line, basePlaylistUrl).href;
      } catch {}
      out.push(wrapSegmentFn ? wrapSegmentFn(abs, line.includes('.m3u8')) : abs);
    }
  }
  return out.join('\n') + '\n';
}

async function handleProxyRequest(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: 'Missing or invalid ?url= parameter' });
  }

  const referer = req.query.referer || '';
  const origin = req.query.origin || (referer ? new URL(referer).origin : '');
  const ua = req.query.ua || UA;
  const cookie = req.query.cookie || '';

  const upstreamHeaders = {
    'User-Agent': ua,
    Accept: '*/*',
    'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7',
    'X-Forwarded-For': HU_IP,
    'Client-IP': HU_IP
  };

  if (referer) upstreamHeaders.Referer = referer;
  if (origin) upstreamHeaders.Origin = origin;
  if (cookie) upstreamHeaders.Cookie = cookie;
  if (req.headers.range) upstreamHeaders.Range = req.headers.range;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000)
    });

    res.status(upstream.status);

    const passHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'last-modified',
      'etag'
    ];
    for (const h of passHeaders) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }
    if (!upstream.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'HEAD' || !upstream.body) {
      return res.end();
    }

    const reader = upstream.body.getReader();
    req.on('close', () => {
      try { reader.cancel(); } catch {}
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.writableEnded) {
        const ok = res.write(Buffer.from(value));
        if (!ok) {
          await new Promise((r) => res.once('drain', r));
        }
      }
    }
    if (!res.writableEnded) res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Proxy upstream error', details: err.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

async function handleHlsRequest(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).send('#EXTM3U\n#EXT-X-ERROR:Missing url parameter\n');
  }

  const referer = req.query.referer || '';
  const origin = req.query.origin || (referer ? new URL(referer).origin : '');
  const proxySegments = req.query.seg === '1';
  const baseUrl = getBaseUrl(req);

  const upstreamHeaders = {
    'User-Agent': UA,
    Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*',
    'X-Forwarded-For': HU_IP
  };
  if (referer) upstreamHeaders.Referer = referer;
  if (origin) upstreamHeaders.Origin = origin;

  try {
    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send(`#EXTM3U\n#EXT-X-ERROR:Upstream ${upstream.status}\n`);
    }

    const finalUrl = upstream.url || targetUrl;
    const text = await upstream.text();

    const wrapFn = (absUrl, isPlaylist) => {
      if (isPlaylist) {
        return buildHlsProxyUrl(baseUrl, absUrl, { Referer: referer, Origin: origin }, proxySegments);
      }
      if (proxySegments) {
        return buildProxyUrl(baseUrl, absUrl, { Referer: referer, Origin: origin });
      }
      return absUrl;
    };

    const sortedMaster = sortMasterM3u8Variants(text, finalUrl, wrapFn);
    const output = sortedMaster || rewriteMediaM3u8(text, finalUrl, wrapFn);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(output);
  } catch (err) {
    return res.status(502).send(`#EXTM3U\n#EXT-X-ERROR:${err.message}\n`);
  }
}

module.exports = {
  HU_IP,
  getBaseUrl,
  buildProxyUrl,
  buildHlsProxyUrl,
  sortMasterM3u8Variants,
  handleProxyRequest,
  handleHlsRequest
};
