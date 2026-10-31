const tls = require('node:tls');
const crypto = require('node:crypto');
const { normalizeTitle } = require('../utils/meta');
const { unpackNetMoziPayload, resolveNetMoziContent } = require('../utils/crypto_decoders');
const { resolveAnyEmbed } = require('../utils/hosters');

function decodeChunkedBuffer(buf) {
  let pos = 0;
  const chunks = [];
  while (pos < buf.length) {
    let crlf = -1;
    for (let i = pos; i < buf.length - 1; i++) {
      if (buf[i] === 0x0d && buf[i + 1] === 0x0a) {
        crlf = i;
        break;
      }
    }
    if (crlf === -1) break;
    const sizeStr = buf.subarray(pos, crlf).toString('ascii').trim().split(';')[0];
    const chunkSize = parseInt(sizeStr, 16);
    if (isNaN(chunkSize) || chunkSize === 0) break;
    const start = crlf + 2;
    const end = start + chunkSize;
    if (end > buf.length) {
      chunks.push(buf.subarray(start));
      break;
    }
    chunks.push(buf.subarray(start, end));
    pos = end + 2;
  }
  return Buffer.concat(chunks).toString('utf8');
}

function netmoziTlsRequest(targetUrl, options = {}, cookieJar = new Map()) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(targetUrl); } catch { return resolve({ statusCode: 0, headers: {}, body: '' }); }
    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : 443;
    const method = options.method || 'GET';
    const postBody = options.body ? Buffer.from(options.body) : null;

    const socket = tls.connect({
      host,
      port,
      servername: host,
      secureOptions: crypto.constants.SSL_OP_NO_TICKET,
      rejectUnauthorized: false
    }, () => {
      let pathAndQuery = parsed.pathname || '/';
      if (parsed.search) pathAndQuery += parsed.search;

      let reqHeaders = `${method} ${pathAndQuery} HTTP/1.1\r\n` +
        `Host: ${host}\r\n` +
        `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n` +
        `Accept: ${options.headers?.Accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}\r\n` +
        `Accept-Language: hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7\r\n` +
        `Connection: close\r\n`;

      if (options.referer) reqHeaders += `Referer: ${options.referer}\r\n`;
      if (options.headers) {
        for (const [hk, hv] of Object.entries(options.headers)) {
          const lhk = hk.toLowerCase();
          if (!['host', 'user-agent', 'accept', 'connection', 'referer', 'cookie', 'content-type', 'content-length'].includes(lhk)) {
            reqHeaders += `${hk}: ${hv}\r\n`;
          }
        }
      }

      const huIp = '185.112.156.1';
      reqHeaders += `X-Forwarded-For: ${huIp}\r\nClient-IP: ${huIp}\r\nX-Real-IP: ${huIp}\r\n`;

      if (cookieJar && cookieJar.size > 0) {
        const cookieStr = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        reqHeaders += `Cookie: ${cookieStr}\r\n`;
      }

      if (postBody) {
        reqHeaders += `Content-Type: ${options.headers?.['Content-Type'] || 'application/x-www-form-urlencoded'}\r\n`;
        reqHeaders += `Content-Length: ${postBody.length}\r\n`;
      }

      reqHeaders += '\r\n';
      socket.write(reqHeaders);
      if (postBody) socket.write(postBody);
    });

    const chunks = [];
    socket.on('data', (d) => chunks.push(d));
    socket.on('end', () => {
      const fullBuf = Buffer.concat(chunks);
      const headerEnd = fullBuf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return resolve({ statusCode: 0, headers: {}, body: '' });

      const headerText = fullBuf.subarray(0, headerEnd).toString('latin1');
      const rawBody = fullBuf.subarray(headerEnd + 4);
      const headerLines = headerText.split('\r\n');
      const statusCode = parseInt((headerLines[0] || '').split(' ')[1] || '0', 10);

      const headers = {};
      for (let i = 1; i < headerLines.length; i++) {
        const colon = headerLines[i].indexOf(':');
        if (colon > 0) {
          const key = headerLines[i].slice(0, colon).trim().toLowerCase();
          const val = headerLines[i].slice(colon + 1).trim();
          headers[key] = val;
          if (key === 'set-cookie' && cookieJar) {
            const parts = val.split(';')[0].split('=');
            if (parts.length >= 2) cookieJar.set(parts[0].trim(), parts.slice(1).join('=').trim());
          }
        }
      }

      const bodyStr = (headers['transfer-encoding'] || '').toLowerCase().includes('chunked')
        ? decodeChunkedBuffer(rawBody)
        : rawBody.toString('utf8');

      resolve({ statusCode, headers, body: bodyStr });
    });

    socket.on('error', () => resolve({ statusCode: 0, headers: {}, body: '' }));
    socket.setTimeout(6500, () => {
      try { socket.destroy(); } catch {}
      resolve({ statusCode: 0, headers: {}, body: '' });
    });
  });
}

async function netmoziFetchWithRedirects(targetUrl, options = {}, cookieJar = new Map(), maxRedirects = 3) {
  let currentUrl = targetUrl;
  let currentOptions = { ...options };
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await netmoziTlsRequest(currentUrl, currentOptions, cookieJar);
    if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
      let loc = res.headers.location;
      if (!loc.startsWith('http')) {
        const base = new URL(currentUrl);
        loc = `${base.protocol}//${base.host}${loc.startsWith('/') ? '' : '/'}${loc}`;
      }
      currentOptions.referer = currentUrl;
      currentOptions.method = 'GET';
      delete currentOptions.body;
      currentUrl = loc;
      continue;
    }
    return res;
  }
  return { statusCode: 0, headers: {}, body: '' };
}

function parseCandidatesFromHtml(html, isSeries, normTarget, targetYear) {
  const candidates = [];
  const articleMatches = [...html.matchAll(/<article[^>]*class=["'][^"']*movie-card[^"']*["'][\s\S]*?<\/article>/gi)];
  for (const match of articleMatches) {
    const cardStr = match[0];
    const linkMatch = cardStr.match(/href=["'](\/(?:adatlap|sorozatok|filmek|film)\/[^"']+)["']/i);
    const titleMatch = cardStr.match(/<h3[^>]*class=["']movie-title["'][^>]*>([\s\S]*?)<\/h3>/i);
    const yearMatch = cardStr.match(/Év:[\s\S]*?([0-9]{4})/i);
    const itemIsSeries = cardStr.includes('(sorozat)') || cardStr.includes('/sorozatok/') || cardStr.includes('évad');

    if (linkMatch && titleMatch) {
      const itemTitle = titleMatch[1].replace(/<[^>]+>/g, '').replace('(sorozat)', '').trim();
      const itemYear = yearMatch ? yearMatch[1] : '';
      const normItem = normalizeTitle(itemTitle);
      const isWordMatch = normTarget.length <= 3
        ? new RegExp(`\\b${normTarget}\\b`, 'i').test(normItem)
        : (normItem.includes(normTarget) || normTarget.includes(normItem));
      const matchScore = normItem === normTarget ? 100 : (isWordMatch ? 75 : 0);
      const yearScore = (targetYear && itemYear && String(targetYear) === String(itemYear)) ? 20 : 0;
      const typeScore = isSeries ? (itemIsSeries ? 30 : -20) : (!itemIsSeries ? 20 : -10);

      if (matchScore > 0) {
        candidates.push({
          title: itemTitle,
          year: itemYear,
          link: linkMatch[1],
          isSeries: itemIsSeries,
          score: matchScore + yearScore + typeScore
        });
      }
    }
  }
  return candidates;
}

async function searchNetMozi(meta) {
  const { titles, year, type, season, episode } = meta;
  const isSeries = type === 'series';
  const allStreams = [];

  for (const title of titles.slice(0, 2)) {
    const cookieJar = new Map();
    const normTarget = normalizeTitle(title);
    const searchUrl = `https://netmozi.com/?search=${encodeURIComponent(title)}`;
    const searchRes = await netmoziTlsRequest(searchUrl, {}, cookieJar);
    if (!searchRes.body) continue;

    let candidates = parseCandidatesFromHtml(searchRes.body, isSeries, normTarget, year);
    if (candidates.length === 0) {
      const m = searchRes.body.match(/data-results-url="([^"]+)"\s+data-results-token="([^"]+)"/);
      if (m) {
        const resultsRes = await netmoziTlsRequest(`https://netmozi.com${m[1]}`, {
          method: 'POST',
          body: 'token=' + encodeURIComponent(m[2]),
          referer: searchUrl,
          headers: {
            Accept: 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }, cookieJar);
        try {
          const data = JSON.parse(resultsRes.body);
          if (data?.success && data.html?.classic) {
            const resolvedHtml = resolveNetMoziContent(data.html.classic);
            candidates = parseCandidatesFromHtml(resolvedHtml, isSeries, normTarget, year);
          }
        } catch {}
      }
    }

    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    let targetPageUrl = best.link.startsWith('http') ? best.link : `https://netmozi.com${best.link}`;
    if (best.isSeries) {
      targetPageUrl += `/s${season || 1}/e${episode || 1}`;
    }

    const detailPageRes = await netmoziFetchWithRedirects(targetPageUrl, { referer: 'https://netmozi.com/' }, cookieJar);
    if (!detailPageRes.body) continue;

    const attrs = {};
    for (const mMatch of detailPageRes.body.matchAll(/(data-movie-id|data-token|data-csrf)="([^"]+)"/g)) {
      attrs[mMatch[1]] = mMatch[2];
    }
    if (!attrs['data-movie-id'] || !attrs['data-token'] || !attrs['data-csrf']) continue;

    const loadLinksUrl = `https://netmozi.com/details/loadLinks/${attrs['data-movie-id']}${attrs['data-csrf']}`;
    const loadLinksRes = await netmoziTlsRequest(loadLinksUrl, {
      method: 'POST',
      body: 'token=' + encodeURIComponent(attrs['data-token']),
      referer: targetPageUrl,
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      }
    }, cookieJar);

    let linksData;
    try { linksData = JSON.parse(loadLinksRes.body); } catch { continue; }
    if (!linksData?.success || !linksData.linkPayload) continue;

    const redirectPages = unpackNetMoziPayload(linksData.linkPayload.value, attrs['data-token']);
    if (!Array.isArray(redirectPages) || !redirectPages.length) continue;

    const mindjartUrl = redirectPages[0];
    const mindjartRes = await netmoziFetchWithRedirects(mindjartUrl, { referer: 'https://netmozi.com/' }, cookieJar);
    const mPayload = mindjartRes.body.match(/<script[^>]*data-link-payload[^>]*data-link-context="([^"]+)"[^>]*>(.*?)<\/script>/s);
    if (!mPayload) continue;

    let routes = [];
    try { routes = unpackNetMoziPayload(JSON.parse(mPayload[2]).value, mPayload[1]); } catch { continue; }
    const streamingRoutes = routes.filter((r) => !r.startsWith('////diablo') && !r.startsWith('////torrent')).slice(0, 8);

    const seenLocs = new Set();
    await Promise.allSettled(
      streamingRoutes.map(async (route) => {
        const fullRouteUrl = route.startsWith('http') ? route : `https://mindjart.megnezed.com${route}`;
        const routeRes = await netmoziTlsRequest(fullRouteUrl, { referer: mindjartUrl }, cookieJar);
        const loc = routeRes.headers.location;
        if (!loc || seenLocs.has(loc)) return;
        seenLocs.add(loc);

        const extracted = await resolveAnyEmbed(loc, 'NetMozi', best.title);
        allStreams.push(...extracted);
      })
    );

    if (allStreams.length > 0) break;
  }

  return allStreams;
}

module.exports = { searchNetMozi };
