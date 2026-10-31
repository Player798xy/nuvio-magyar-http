const tls = require('node:tls');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { UA } = require('./meta');

/**
 * Custom TLS 1.2/1.3 client with SSL_OP_NO_TICKET and modern browser cipher suite order.
 * Bypasses Cloudflare standard JS/TLS fingerprint blocks on Vercel serverless functions
 * without requiring headless browsers.
 */
function cfRequest(urlStr, options = {}, redirectCount = 4) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 8500
  } = options;

  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      return resolve(null);
    }

    if (parsed.protocol === 'http:') {
      fetch(urlStr, {
        method,
        headers: { 'User-Agent': UA, ...headers },
        body,
        redirect: redirectCount > 0 ? 'follow' : 'manual',
        signal: AbortSignal.timeout(timeoutMs)
      })
        .then(async (r) => {
          const text = await r.text();
          resolve({
            status: r.status,
            text,
            finalUrl: r.url || urlStr,
            headers: Object.fromEntries(r.headers.entries())
          });
        })
        .catch(() => resolve(null));
      return;
    }

    let settled = false;
    const done = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const timer = setTimeout(() => {
      try { socket.destroy(); } catch {}
      done(null);
    }, timeoutMs);

    const socket = tls.connect(
      {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 443,
        servername: parsed.hostname,
        ALPNProtocols: ['http/1.1'],
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        ciphers: [
          'TLS_AES_128_GCM_SHA256',
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'ECDHE-ECDSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-ECDSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES256-GCM-SHA384'
        ].join(':'),
        ecdhCurve: 'X25519:P-256:P-384',
        secureOptions: crypto.constants.SSL_OP_NO_TICKET
      },
      () => {
        const reqPath = (parsed.pathname || '/') + (parsed.search || '');
        const bodyBuf = body ? Buffer.from(body) : null;
        const defaultHeaders = {
          Host: parsed.hostname,
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'close',
          ...headers
        };
        if (bodyBuf) {
          defaultHeaders['Content-Length'] = String(bodyBuf.length);
        }

        const reqLines = [
          `${method} ${reqPath} HTTP/1.1`,
          ...Object.entries(defaultHeaders).map(([k, v]) => `${k}: ${v}`)
        ];
        socket.write(reqLines.join('\r\n') + '\r\n\r\n');
        if (bodyBuf) socket.write(bodyBuf);
      }
    );

    const chunks = [];
    socket.on('data', (c) => chunks.push(c));
    socket.on('end', async () => {
      clearTimeout(timer);
      const raw = Buffer.concat(chunks);
      const sep = raw.indexOf('\r\n\r\n');
      if (sep === -1) return done(null);

      const headerPart = raw.subarray(0, sep).toString('utf8');
      const statusMatch = headerPart.match(/^HTTP\/1\.[01]\s+(\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

      const respHeaders = {};
      const lines = headerPart.split('\r\n').slice(1);
      for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          const k = line.slice(0, idx).trim().toLowerCase();
          const v = line.slice(idx + 1).trim();
          if (k === 'set-cookie') {
            respHeaders[k] = respHeaders[k] ? `${respHeaders[k]}; ${v.split(';')[0]}` : v.split(';')[0];
          } else {
            respHeaders[k] = v;
          }
        }
      }

      if ([301, 302, 303, 307, 308].includes(status) && redirectCount > 0 && respHeaders.location) {
        let nextUrl;
        try {
          nextUrl = new URL(respHeaders.location, urlStr).href;
        } catch {
          return done(null);
        }
        return done(await cfRequest(nextUrl, options, redirectCount - 1));
      }

      let bodyBuf = raw.subarray(sep + 4);
      if (/transfer-encoding:\s*chunked/i.test(headerPart)) {
        const unchunked = [];
        let pos = 0;
        while (pos < bodyBuf.length) {
          const lineEnd = bodyBuf.indexOf('\r\n', pos);
          if (lineEnd === -1) break;
          const sizeHex = bodyBuf.subarray(pos, lineEnd).toString('ascii').trim().split(';')[0];
          const size = parseInt(sizeHex, 16);
          if (isNaN(size) || size === 0) break;
          unchunked.push(bodyBuf.subarray(lineEnd + 2, lineEnd + 2 + size));
          pos = lineEnd + 2 + size + 2;
        }
        bodyBuf = Buffer.concat(unchunked);
      }

      try {
        if (/content-encoding:\s*gzip/i.test(headerPart)) {
          bodyBuf = zlib.gunzipSync(bodyBuf);
        } else if (/content-encoding:\s*deflate/i.test(headerPart)) {
          bodyBuf = zlib.inflateSync(bodyBuf);
        }
      } catch {}

      done({
        status,
        text: bodyBuf.toString('utf8'),
        finalUrl: urlStr,
        headers: respHeaders
      });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      done(null);
    });
  });
}

module.exports = { cfRequest };
