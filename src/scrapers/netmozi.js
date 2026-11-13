const { extractVoeDirectStreams } = require('../utils/crypto_decoders');
/**
 * NetMozi Scraper (Kodi NetMozi Addon Port for Nuvio & Stremio)
 * Scrapes netmozi.com with full Cloudflare TLS bypass (OP_NO_TICKET) and linkpayload unpacking.
 * Extracts direct MP4 streams for Videa, Indavideo, OK.ru, frdl.io, and supported hosters.
 */

const tls = require('tls');
const crypto = require('crypto');
const { URL } = require('url');
const { unpack, resolveContent } = require('../utils/linkpayload');
const { isDownloadOnlyHost, isUrlIpLocked } = require('../utils/netmozi_hosters');
const { extractVideaStreams } = require('./videa');
const { extractIndavideoStreams } = require('./indavideo');
const { extractOkRuStreams } = require('./filmezek');

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLocalHostUrl(hostUrl) {
  if (!hostUrl || typeof hostUrl !== 'string') return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(hostUrl);
}

/**
 * Zero-proxy mode: this server NEVER proxies video segments/playlists.
 * External proxying is disabled unless process.env.EXTERNAL_PROXY_URL is explicitly configured.
 */
function hasExternalProxy() {
  return Boolean(process.env.EXTERNAL_PROXY_URL && /^https?:\/\//i.test(process.env.EXTERNAL_PROXY_URL));
}

function shouldProxyNetMoziUrl(mediaUrl, _hostUrl) {
  if (!mediaUrl || !isUrlIpLocked(mediaUrl)) return false;
  return hasExternalProxy();
}

function isRemoteHostContext(hostUrl) {
  if (process.env.VERCEL || process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.NETMOZI_REMOTE === '1') return true;
  return Boolean(hostUrl && !isLocalHostUrl(hostUrl));
}

const netmoziTitleCache = new Map();
const netmoziSlugCache = new Map();

function getNetMoziTitle(mid) {
  return netmoziTitleCache.get(String(mid)) || '';
}

function getNetMoziSlug(mid) {
  return netmoziSlugCache.get(String(mid)) || '';
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeChunkedBuffer(buf) {
  let pos = 0;
  const chunks = [];
  while (pos < buf.length) {
    let crlf = -1;
    for (let i = pos; i < buf.length - 1; i++) {
      if (buf[i] === 0x0D && buf[i + 1] === 0x0A) {
        crlf = i;
        break;
      }
    }
    if (crlf === -1) break;

    const sizeStr = buf.slice(pos, crlf).toString('ascii').trim().split(';')[0];
    const chunkSize = parseInt(sizeStr, 16);
    if (isNaN(chunkSize) || chunkSize === 0) break;

    const start = crlf + 2;
    const end = start + chunkSize;
    if (end > buf.length) {
      chunks.push(buf.slice(start));
      break;
    }

    chunks.push(buf.slice(start, end));
    pos = end + 2;
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Cloudflare TLS bypass request using SSL_OP_NO_TICKET and no ALPN
 */
function netmoziTlsRequest(targetUrl, options = {}, cookieJar = new Map()) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : 443;
    const method = options.method || 'GET';
    const postBody = options.body ? Buffer.from(options.body) : null;

    const socket = tls.connect({
      host: host,
      port: port,
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

      if (options.referer) {
        reqHeaders += `Referer: ${options.referer}\r\n`;
      }
      if (options.headers) {
        for (const [hk, hv] of Object.entries(options.headers)) {
          const lhk = hk.toLowerCase();
          if (!['host', 'user-agent', 'accept', 'connection', 'referer', 'cookie', 'content-type', 'content-length'].includes(lhk)) {
            reqHeaders += `${hk}: ${hv}\r\n`;
          }
        }
      }

      const hasXff = options.headers && Object.keys(options.headers).some(k => k.toLowerCase() === 'x-forwarded-for');
      if (!hasXff) {
        const huIp = options.clientIp || '185.112.156.1';
        reqHeaders += `X-Forwarded-For: ${huIp}\r\n`;
        reqHeaders += `Client-IP: ${huIp}\r\n`;
        reqHeaders += `X-Real-IP: ${huIp}\r\n`;
      }

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
      if (postBody) {
        socket.write(postBody);
      }
    });

    const chunks = [];
    socket.on('data', d => chunks.push(d));

    socket.on('end', () => {
      const fullBuf = Buffer.concat(chunks);
      let headerEnd = -1;
      for (let i = 0; i < fullBuf.length - 3; i++) {
        if (fullBuf[i] === 0x0D && fullBuf[i + 1] === 0x0A && fullBuf[i + 2] === 0x0D && fullBuf[i + 3] === 0x0A) {
          headerEnd = i;
          break;
        }
      }

      if (headerEnd === -1) {
        return resolve({ statusCode: 0, headers: {}, body: '' });
      }

      const headerText = fullBuf.slice(0, headerEnd).toString('latin1');
      const rawBody = fullBuf.slice(headerEnd + 4);

      const headerLines = headerText.split('\r\n');
      const statusLine = headerLines[0] || '';
      const statusCode = parseInt(statusLine.split(' ')[1] || '0', 10);

      const headers = {};
      for (let i = 1; i < headerLines.length; i++) {
        const colon = headerLines[i].indexOf(':');
        if (colon > 0) {
          const key = headerLines[i].slice(0, colon).trim().toLowerCase();
          const val = headerLines[i].slice(colon + 1).trim();
          headers[key] = val;

          if (key === 'set-cookie' && cookieJar) {
            const parts = val.split(';')[0].split('=');
            if (parts.length >= 2) {
              cookieJar.set(parts[0].trim(), parts.slice(1).join('=').trim());
            }
          }
        }
      }

      let bodyStr = '';
      if ((headers['transfer-encoding'] || '').toLowerCase().includes('chunked')) {
        bodyStr = decodeChunkedBuffer(rawBody);
      } else {
        bodyStr = rawBody.toString('utf8');
      }

      if (options.debug) {
        // debug log removed
      }

      resolve({ statusCode, headers, body: bodyStr });
    });

    socket.on('error', reject);
    socket.setTimeout(6500, () => {
      socket.destroy();
      reject(new Error('NetMozi TLS timeout'));
    });
  });
}

/**
 * Follows HTTP 301/302 redirects automatically (used for details & episode pages)
 */
async function netmoziFetchWithRedirects(targetUrl, options = {}, cookieJar = new Map(), maxRedirects = 3) {
  let currentUrl = targetUrl;
  let currentOptions = { ...options };

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await netmoziTlsRequest(currentUrl, currentOptions, cookieJar);
    if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers['location']) {
      let loc = res.headers['location'];
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

/**
 * Parses search candidates from either Modern SSR HTML (<article class="movie-card">)
 * or Classic AJAX HTML (<div class="col-12">).
 */
function parseCandidatesFromHtml(html, isSeries, normTarget, targetYear) {
  const candidates = [];

  // Check 1: Modern SSR Cards (<article class="movie-card" ...>)
  const articleMatches = [...html.matchAll(/<article[^>]*class=["'][^"']*movie-card[^"']*["'][\s\S]*?<\/article>/gi)];
  for (const match of articleMatches) {
    const cardStr = match[0];
    const linkMatch = cardStr.match(/href=["'](\/(?:adatlap|sorozatok|filmek|film)\/[^"']+)["']/i);
    const titleMatch = cardStr.match(/<h3[^>]*class=["']movie-title["'][^>]*>([\s\S]*?)<\/h3>/i);
    const yearMatch = cardStr.match(/Év:[\s\S]*?([0-9]{4})/i);
    const posterMatch = cardStr.match(/src=["']([^"']+)["']/i);
    const descMatch = cardStr.match(/<p[^>]*class=["']movie-description["'][^>]*>([\s\S]*?)<\/p>/i);
    const itemIsSeries = cardStr.includes('(sorozat)') || cardStr.includes('/sorozatok/') || cardStr.includes('évad');

    if (linkMatch && titleMatch) {
      const itemTitle = titleMatch[1].replace(/<[^>]+>/g, '').replace('(sorozat)', '').trim();
      const itemYear = yearMatch ? yearMatch[1] : '';
      const itemLink = linkMatch[1];
      const midMatch = itemLink.match(/\/(?:sorozatok|adatlap|filmek|film)\/(\d+)/i);
      const itemMid = midMatch ? midMatch[1] : '';

      let itemPoster = '';
      if (posterMatch) {
        itemPoster = posterMatch[1].startsWith('//') ? 'https:' + posterMatch[1] : (posterMatch[1].startsWith('http') ? posterMatch[1] : 'https://netmozi.com' + posterMatch[1]);
      }
      const itemDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      const normItem = normalize(itemTitle);
      const safeTarget = escapeRegex(normTarget);
      const safeItem = escapeRegex(normItem);
      const isWordMatch = normTarget.length <= 3
        ? new RegExp(`(?:^|\\s)${safeTarget}(?:\\s|$)`, 'i').test(normItem)
        : (new RegExp(`(?:^|\\s)${safeTarget}(?:\\s|$)`, 'i').test(normItem) || (normItem.length > 3 && new RegExp(`(?:^|\\s)${safeItem}(?:\\s|$)`, 'i').test(normTarget)));
      const matchScore = normItem === normTarget ? 100 : (isWordMatch ? 75 : 0);
      if (isSeries === false && targetYear && itemYear && Math.abs(parseInt(targetYear, 10) - parseInt(itemYear, 10)) > 1) {
        continue;
      }
      const yearScore = (targetYear && itemYear && Math.abs(parseInt(targetYear, 10) - parseInt(itemYear, 10)) <= 1) ? 40 : 0;
      let typeScore = 0;
      if (isSeries === true) {
        typeScore = itemIsSeries ? 30 : -20;
      } else if (isSeries === false) {
        typeScore = !itemIsSeries ? 20 : -10;
      }

      if (matchScore > 0) {
        candidates.push({
          title: itemTitle,
          year: itemYear,
          link: itemLink,
          poster: itemPoster,
          description: itemDesc,
          isSeries: itemIsSeries,
          mid: itemMid,
          score: matchScore + yearScore + typeScore
        });
      }
    }
  }

  if (candidates.length > 0) return candidates;

  // Check 2: Classic Cards (<div class="col-12" ...)
  const cardBlocks = [...html.matchAll(/<div[^>]*class=["']col-12[\s\S]*?(?=<div[^>]*class=["']col-12|$)/gi)];
  for (const c of cardBlocks) {
    const cardStr = c[0];
    const titleMatch = cardStr.match(/class=["']col_name["'][^>]*>([\s\S]*?)<\/div>/i);
    const linkMatch = cardStr.match(/href=["']([^"']+)["'][^>]*class=["']col_a["']/i);
    const yearMatch = cardStr.match(/Év:[\s\S]*?([0-9]{4})/i);
    const posterMatch = cardStr.match(/src=["']([^"']+)["']/i);
    const descMatch = cardStr.match(/title=["']([^"']{15,})["']/i);
    const itemIsSeries = cardStr.includes('(sorozat)') || (linkMatch && linkMatch[1].includes('/sorozatok/'));

    if (titleMatch && linkMatch) {
      const itemTitle = titleMatch[1].replace(/<[^>]+>/g, '').replace('(sorozat)', '').trim();
      const itemYear = yearMatch ? yearMatch[1] : '';
      const itemLink = linkMatch[1];
      const midMatch = itemLink.match(/\/(?:sorozatok|adatlap|filmek|film)\/(\d+)/i);
      const itemMid = midMatch ? midMatch[1] : '';

      let itemPoster = '';
      if (posterMatch) {
        itemPoster = posterMatch[1].startsWith('//') ? 'https:' + posterMatch[1] : (posterMatch[1].startsWith('http') ? posterMatch[1] : 'https://netmozi.com' + posterMatch[1]);
      }
      const itemDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      const normItem = normalize(itemTitle);
      const safeTarget = escapeRegex(normTarget);
      const safeItem = escapeRegex(normItem);
      const isWordMatch = normTarget.length <= 3
        ? new RegExp(`(?:^|\\s)${safeTarget}(?:\\s|$)`, 'i').test(normItem)
        : (new RegExp(`(?:^|\\s)${safeTarget}(?:\\s|$)`, 'i').test(normItem) || (normItem.length > 3 && new RegExp(`(?:^|\\s)${safeItem}(?:\\s|$)`, 'i').test(normTarget)));
      const matchScore = normItem === normTarget ? 100 : (isWordMatch ? 75 : 0);
      if (isSeries === false && targetYear && itemYear && Math.abs(parseInt(targetYear, 10) - parseInt(itemYear, 10)) > 1) {
        continue;
      }
      const yearScore = (targetYear && itemYear && Math.abs(parseInt(targetYear, 10) - parseInt(itemYear, 10)) <= 1) ? 40 : 0;
      let typeScore = 0;
      if (isSeries === true) {
        typeScore = itemIsSeries ? 30 : -20;
      } else if (isSeries === false) {
        typeScore = !itemIsSeries ? 20 : -10;
      }

      if (matchScore > 0) {
        candidates.push({
          title: itemTitle,
          year: itemYear,
          link: itemLink,
          poster: itemPoster,
          description: itemDesc,
          isSeries: itemIsSeries,
          mid: itemMid,
          score: matchScore + yearScore + typeScore
        });
      }
    }
  }

  return candidates;
}

function formatNetMoziStream(loc, cleanTitle) {
  if (!loc) return null;
  const locLower = loc.toLowerCase();

  // Skip search fallbacks and file download hosts
  if (
    locLower.includes('videa.hu/kereses/') ||
    locLower.includes('katfile') ||
    locLower.includes('rapidgator') ||
    locLower.includes('nitroflare') ||
    locLower.includes('turbobit') ||
    locLower.includes('1fichier') ||
    locLower.includes('filefactory') ||
    locLower.includes('limewire.com')
  ) {
    return null;
  }

  let hosterName = 'Hoster';
  let height = 720;
  let finalUrl = loc;

  // 1. Filemoon
  const fMatch = loc.match(/filemoon\.(?:to|sx|org|me)\/(?:d\/|e\/)?([a-zA-Z0-9]+)/i);
  if (fMatch) {
    hosterName = 'Filemoon';
    height = 720;
    finalUrl = `https://filemoon.to/e/${fMatch[1]}`;
  }
  // 2. VOE
  else if (locLower.includes('voe.sx') || locLower.includes('voe.')) {
    const voeMatch = loc.match(/voe\.(?:sx|net|to|org)\/(?:e\/)?([a-zA-Z0-9]+)/i);
    hosterName = 'VOE';
    height = 1080;
    if (voeMatch) finalUrl = `https://voe.sx/e/${voeMatch[1]}`;
  }
  // 3. Vidmoly
  else if (locLower.includes('vidmoly')) {
    const vMatch = loc.match(/vidmoly\.(?:me|to|net|biz|org)\/(?:embed-|w\/|v\/|dl\/)?([0-9a-zA-Z]+)/i);
    hosterName = 'Vidmoly';
    height = 720;
    if (vMatch) finalUrl = `https://vidmoly.me/embed-${vMatch[1]}.html`;
  }
  // 4. StreamRuby / RubyStream
  else if (locLower.includes('streamruby') || locLower.includes('rubystream') || locLower.includes('rubyvidhub')) {
    const sMatch = loc.match(/(?:streamruby|sruby|rubystream|rubyvidhub)\.(?:com|xyz|buzz)\/(?:embed-|e\/|d\/)?([a-zA-Z0-9]+)/i);
    hosterName = 'StreamRuby';
    height = 720;
    if (sMatch) finalUrl = `https://streamruby.com/embed-${sMatch[1]}.html`;
  }
  // 5. Vinovo
  else if (locLower.includes('vinovo')) {
    const vinMatch = loc.match(/vinovo\.(?:to|com|net)\/(?:d\/|e\/)?([a-zA-Z0-9]+)/i);
    hosterName = 'Vinovo';
    height = 720;
    if (vinMatch) finalUrl = `https://vinovo.to/e/${vinMatch[1]}`;
  }
  // 6. Vidara
  else if (locLower.includes('vidara')) {
    const vidaraMatch = loc.match(/vidara\.(?:to|com)\/(?:v\/|e\/)?([a-zA-Z0-9]+)/i);
    hosterName = 'Vidara';
    height = 720;
    if (vidaraMatch) finalUrl = `https://vidara.to/e/${vidaraMatch[1]}`;
  }
  // 7. Mixdrop / Mxdrop
  else if (locLower.includes('mixdrop') || locLower.includes('mxdrop')) {
    const mxMatch = loc.match(/(?:mixdrop|mxdrop)\.(?:co|to|ch|bz|sx)\/(?:e\/|f\/)?([a-zA-Z0-9]+)/i);
    hosterName = 'Mixdrop';
    height = 720;
    if (mxMatch) finalUrl = `https://mixdrop.co/e/${mxMatch[1]}`;
  }
  // 8. Upstream
  else if (locLower.includes('upstream')) {
    const upMatch = loc.match(/upstream\.(?:to)\/(?:embed-)?([a-zA-Z0-9]+)/i);
    hosterName = 'Upstream';
    height = 720;
    if (upMatch) finalUrl = `https://upstream.to/embed-${upMatch[1]}.html`;
  }
  // 9. Waaw / Netu
  else if (locLower.includes('waaw') || locLower.includes('netu')) {
    const wMatch = loc.match(/(?:waaw|netu)\.(?:to|tv)\/(?:watch_video\.php\?v=|e\/|f\/)([a-zA-Z0-9]+)/i);
    hosterName = 'Netu / Waaw';
    height = 720;
    if (wMatch) finalUrl = `https://waaw.to/e/${wMatch[1]}`;
  }
  // 10. DoodStream
  else if (locLower.includes('dood') || locLower.includes('byselapuix')) {
    const dMatch = loc.match(/(?:doodstream|dood|ds2play)\.(?:com|to|so|cx|watch)\/(?:e\/|d\/)?([a-zA-Z0-9]+)/i);
    hosterName = 'DoodStream';
    height = 720;
    if (dMatch) finalUrl = `https://doodstream.com/e/${dMatch[1]}`;
  }
  // 11. Direct MP4 (frdl.io or direct cdn .mp4)
  else if (locLower.includes('frdl.io') || locLower.endsWith('.mp4') || locLower.includes('.mp4?')) {
    hosterName = 'Direct MP4';
    height = 1080;
  }
  // 12. Generic Hoster
  else {
    try {
      const uObj = new URL(loc);
      hosterName = uObj.hostname.replace(/^www\./, '');
    } catch (e) {
      hosterName = 'Hoster';
    }
  }

  const qualityBadge = height >= 1080 ? '1080p FHD' : '720p HD';
  return {
    name: `[HU] NetMozi (${hosterName}) ${qualityBadge}`,
    title: `${cleanTitle} [${qualityBadge}]\n🇭🇺 NetMozi / ${hosterName} • Szinkron • Közvetlen Lejátszó`,
    url: finalUrl,
    playerUrl: finalUrl,
    quality: height >= 1080 ? '1080p' : '720p',
    height: height,
    source: 'netmozi',
    behaviorHints: { bingeGroup: `hu-netmozi-${hosterName.toLowerCase()}` }
  };
}

/**
 * Searches and scrapes NetMozi for a specific title candidate.
 */
async function searchAndScrapeNetMozi(cleanTitle, targetYear, isSeries, season, episode, optsOrClientIp = null) {
  const opts = (typeof optsOrClientIp === 'object' && optsOrClientIp !== null)
    ? optsOrClientIp
    : { clientIp: optsOrClientIp };
  const clientIp = opts.clientIp || null;
  const streams = [];
  const cookieJar = new Map();
  const reqOpts = { clientIp };

  try {
    const normTarget = normalize(cleanTitle);

    // Step 1: Initial Search Request
    const searchUrl = `https://netmozi.com/?search=${encodeURIComponent(cleanTitle)}`;
    const searchRes = await netmoziTlsRequest(searchUrl, reqOpts, cookieJar);
    if (!searchRes.body) return streams;

    // Step 2: Extract Candidates (Modern SSR mode or Classic AJAX mode)
    let candidates = parseCandidatesFromHtml(searchRes.body, isSeries, normTarget, targetYear);

    // If no candidates found in initial HTML, check if classic async search is used (data-results-url)
    if (candidates.length === 0) {
      const m = searchRes.body.match(/data-results-url="([^"]+)"\s+data-results-token="([^"]+)"/);
      if (m) {
        const resultsUrl = 'https://netmozi.com' + m[1];
        const resultsToken = m[2];

        const resultsRes = await netmoziTlsRequest(resultsUrl, {
          method: 'POST',
          body: 'token=' + encodeURIComponent(resultsToken),
          referer: searchUrl,
          clientIp,
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }, cookieJar);

        try {
          const data = JSON.parse(resultsRes.body);
          if (data && data.success) {
            const classicHtml = data.html?.classic || '';
            const resolvedHtml = resolveContent(classicHtml);
            candidates = parseCandidatesFromHtml(resolvedHtml, isSeries, normTarget, targetYear);
          }
        } catch (e) {}
      }
    }

    if (candidates.length === 0) return streams;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const yearVerified = Boolean(!targetYear || !best.year || Math.abs(parseInt(best.year, 10) - parseInt(targetYear, 10)) <= 1);
    const scrapeOpts = {
      ...opts,
      mid: best.mid || '',
      yearVerified
    };

    // Fast-path: Directly resolve via unmetered Mindjart bypass if mid is known
    if (best && best.mid) {
      const s = season || 1;
      const e = episode || 1;
      const directStreams = await scrapeMindjartDirect(best.mid, best.isSeries, s, e, cleanTitle, scrapeOpts);
      if (directStreams && directStreams.length > 0) {
        return directStreams;
      }
    }

    // Step 3: Fetch details/episode page with automatic 301/302 redirect following
    let targetPageUrl = best.link.startsWith('http') ? best.link : (`https://netmozi.com${best.link}`);
    if (best.isSeries) {
      const s = season || 1;
      const e = episode || 1;
      targetPageUrl += `/s${s}/e${e}`;
    }

    return await scrapeNetMoziDetailPage(targetPageUrl, cleanTitle, scrapeOpts, cookieJar, season, episode);
  } catch (err) {
    console.warn('[NetMozi] Scraping error:', err.message);
  }

  return streams;
}

/**
 * Scrapes NetMozi.com for movies and series episodes.
 * Supports both meta object (Addon engine) and positional arguments.
 */
async function scrapeNetMozi(metaOrTitle, year = null, season = null, episode = null) {
  let cleanTitle = '';
  let targetYear = year;
  let targetSeason = season;
  let targetEpisode = episode;
  let englishTitle = '';
  let clientIp = null;
  let hostUrl = null;
  let imdbId = '';

  if (typeof metaOrTitle === 'object' && metaOrTitle !== null) {
    cleanTitle = metaOrTitle.hungarianTitle || metaOrTitle.englishTitle || '';
    englishTitle = metaOrTitle.englishTitle || '';
    targetYear = metaOrTitle.year || null;
    targetSeason = metaOrTitle.season || null;
    targetEpisode = metaOrTitle.episode || null;
    clientIp = metaOrTitle.clientIp || null;
    hostUrl = metaOrTitle.hostUrl || null;
    imdbId = metaOrTitle.imdbId || metaOrTitle.id || '';
  } else {
    cleanTitle = (metaOrTitle || '').trim();
  }

  const scrapeOpts = { clientIp, hostUrl, yearVerified: true };

  // Fast-path: If ID is directly a NetMozi identifier (e.g. netmozi:series:42579:1:1 or netmozi:movie:35134)
  if (imdbId && imdbId.startsWith('netmozi:')) {
    const parts = imdbId.split(':');
    const itemType = parts[1] || 'movie';
    const mid = parts[2] || '';
    let slug = '';
    let s = targetSeason;
    let e = targetEpisode;

    if (parts.length >= 5) {
      if (/^\d+$/.test(parts[3]) && /^\d+$/.test(parts[4])) {
        // netmozi:series:mid:season:episode[:title]
        s = parseInt(parts[3], 10);
        e = parseInt(parts[4], 10);
        if (parts[5]) {
          try { cleanTitle = cleanTitle || decodeURIComponent(parts[5]); } catch (err) {}
        }
      } else {
        // netmozi:series:mid:slug:season:episode
        slug = parts[3];
        s = parseInt(parts[4], 10);
        e = parts[5] ? parseInt(parts[5], 10) : 1;
      }
    } else if (parts.length === 4) {
      if (/^\d+$/.test(parts[3])) {
        s = parseInt(parts[3], 10);
        e = 1;
      } else {
        slug = parts[3];
      }
    }

    const isSer = itemType === 'series';
    if (isSer) {
      s = s || 1;
      e = e || 1;
    } else {
      s = null;
      e = null;
    }

    if (!slug) {
      slug = getNetMoziSlug(mid);
    }

    if (!slug && cleanTitle && cleanTitle !== 'NetMozi Média') {
      slug = normalize(cleanTitle).replace(/\s+/g, '-');
    }

    if (mid) {
      const directStreams = await scrapeMindjartDirect(mid, isSer, s, e, cleanTitle || 'NetMozi Média', { ...scrapeOpts, mid });
      if (directStreams && directStreams.length > 0) {
        return directStreams;
      }

      if (!slug || slug === 'film' || slug === 'sorozat') {
        try {
          const redirectCheck = await netmoziTlsRequest(`https://netmozi.com/${isSer ? 'sorozatok' : 'adatlap'}/${mid}`);
          const loc = redirectCheck.headers['location'];
          if (loc) {
            const mSlug = loc.match(/\/(?:sorozatok|adatlap|filmek|film)\/\d+\/([^/?#]+)/);
            if (mSlug) {
              slug = mSlug[1];
              netmoziSlugCache.set(String(mid), slug);
            }
          }
        } catch (err) {}
      }

      const finalSlug = slug || (cleanTitle && cleanTitle !== 'NetMozi Média' ? normalize(cleanTitle).replace(/\s+/g, '-') : 'film');
      const pageUrl = isSer
        ? `https://netmozi.com/sorozatok/${mid}/${finalSlug}/s${s}/e${e}`
        : `https://netmozi.com/filmek/${mid}/${finalSlug}`;

      const cookieJar = new Map();
      const fallbackStreams = await scrapeNetMoziDetailPage(pageUrl, cleanTitle || finalSlug.replace(/-/g, ' '), { ...scrapeOpts, mid }, cookieJar, s, e);
      return fallbackStreams;
    }
  }

  if (!cleanTitle) return [];

  const isSeries = Boolean(targetSeason && targetEpisode);

  // Generate candidate query titles (strip suffixes like "- A film", ": The Movie", etc.)
  const strippedHu = cleanTitle.replace(/\s*[-–:]\s*(a film|the movie|film|sorozat)\s*$/i, '').trim();
  const strippedEn = (englishTitle || '').replace(/\s*[-–:]\s*(a film|the movie|film|sorozat)\s*$/i, '').trim();

  const queryList = [];
  if (strippedHu) queryList.push(strippedHu);
  if (cleanTitle && !queryList.includes(cleanTitle)) queryList.push(cleanTitle);
  if (strippedEn && !queryList.includes(strippedEn)) queryList.push(strippedEn);
  if (englishTitle && !queryList.includes(englishTitle)) queryList.push(englishTitle);

  let streams = [];
  for (const q of queryList) {
    streams = await searchAndScrapeNetMozi(q, targetYear, isSeries, targetSeason, targetEpisode, scrapeOpts);
    if (streams.length > 0) break;
  }

  return streams;
}

/**
 * Directly queries Mindjart link listing by base64-encoded movie ID.
 * Bypasses NetMozi Cloudflare protections and CSRF dependencies completely.
 * E.g. https://mindjart.megnezed.com/links/vv/NDI1Nzk=/2/16 or /links/vv/MzAyOA==
 */
function getHostPriority(host) {
  const h = String(host || '').toLowerCase();
  if (!h || isDownloadOnlyHost(h)) return -1;
  // Skip known Cloudflare-challenged or unresolvable hosts to conserve /links/open requests
  if (/dood\.|doods\.|doodstream\.|savefiles\.|playmogo\.|vidnest\./.test(h)) return -1;
  // Tier 0: Direct open CDNs (zero proxy overhead)
  if (/rubystm\.|streamruby\.|nuvorel\.|vtbe\.to|luluvid\.|luluvdo\.|lulustream\.|mxdrop\.|mixdrop\./.test(h)) return 0;
  // Tier 1: Primary reliable extractors (HLS/MP4, proxied only when IP/ASN-locked)
  if (/voe\.|vidmoly\.|vidara\.to|bysesayeveum\.|byselapuix\.|bysetayico\.|byse\.|filemoon\.|ok\.ru|videa\.|indavideo\./.test(h)) return 1;
  return 2;
}

function getHosterFamily(host) {
  const h = String(host || '').toLowerCase();
  if (/rubystm\.|streamruby\.|nuvorel\./.test(h)) return 'streamruby';
  if (/bysesayeveum\.|byselapuix\.|bysetayico\.|byse\.|filemoon\./.test(h)) return 'filemoon';
  if (/mxdrop\.|mixdrop\./.test(h)) return 'mixdrop';
  if (/luluvid\.|luluvdo\.|lulustream\./.test(h)) return 'luluvid';
  if (/vidmoly\./.test(h)) return 'vidmoly';
  if (/voe\./.test(h)) return 'voe';
  if (/vidara\./.test(h)) return 'vidara';
  if (/vtbe\./.test(h)) return 'vtube';
  return h;
}

function parseMindjartRows(html, opts = {}) {
  const candidates = [];
  if (!html) return candidates;
  const remoteNoProxy = Boolean(opts.remoteNoProxy);

  const rowRe = /<tr\b([^>]*)data-link-row([^>]*)>([\s\S]*?)<\/tr>/gi;
  for (const m of html.matchAll(rowRe)) {
    const attrStr = `${m[1] || ''} ${m[2] || ''}`;
    const body = m[3] || '';

    if (body.includes('red_mark.png')) continue;
    if (body.includes('Letöltő link') || body.includes('diablo-lang')) continue;

    const linkType = (attrStr.match(/data-link-type=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    if (linkType === 'download') continue;

    const routeMatch = body.match(/href=["'](\/links\/open\/\d+)["']/i);
    if (!routeMatch) continue;

    const linkLang = (attrStr.match(/data-link-language=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    const linkHost = (attrStr.match(/data-link-host=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    const rowHostText = body.match(/col-host[^>]*>([^<]+)/i)?.[1]?.trim().toLowerCase() || '';
    const host = linkHost || rowHostText;

    const tier = getHostPriority(host);
    if (tier < 0) continue;

    const family = getHosterFamily(host);
    // In zero-proxy remote mode (e.g. Vercel), skip known IP/ASN-locked hosts upfront
    // so route slots go to open hosters (vTube, StreamRuby, LuluVid, MixDrop, OK.ru, Videa).
    if (remoteNoProxy && /^(voe|vidmoly|vidara|filemoon)$/.test(family)) continue;

    const hasAlert = body.includes('alert_icon.png');
    const colQual = body.match(/col-quality[^>]*>([^<]+)/i)?.[1]?.trim() || '';

    let langType = 'foreign';
    let langLabel = 'Külföldi';
    let langRank = 2;
    if (linkLang === 'dubbed' || body.includes('hungary.gif') || /magyar szinkron/i.test(body)) {
      langType = 'dub';
      langLabel = 'Magyar Szinkron';
      langRank = 0;
    } else if (linkLang === 'sub' || body.includes('uk-hu.png') || /felirat/i.test(body)) {
      langType = 'sub';
      langLabel = 'Magyar Felirat';
      langRank = 1;
    }

    candidates.push({
      route: routeMatch[1],
      host,
      family,
      tier,
      langType,
      langLabel,
      langRank,
      tableQuality: colQual,
      hasAlert
    });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.langRank !== b.langRank) return a.langRank - b.langRank;
      if (a.hasAlert !== b.hasAlert) return a.hasAlert ? 1 : -1;
      if (a.tier !== b.tier) return a.tier - b.tier;
      return 0;
    });

    const selected = [];
    const familyCounts = new Map();
    const seenRoutes = new Set();
    for (const c of candidates) {
      if (seenRoutes.has(c.route)) continue;
      const count = familyCounts.get(c.family) || 0;
      if (count >= 2) continue;
      seenRoutes.add(c.route);
      familyCounts.set(c.family, count + 1);
      selected.push(c);
      if (selected.length >= 12) break;
    }
    return selected;
  }

  // Fallback for legacy or encrypted payload HTML tables without data-link-row
  const seen = new Set();
  for (const m of html.matchAll(/href=["'](\/links\/open\/\d+)["']/g)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      candidates.push({
        route: m[1],
        host: '',
        family: 'unknown',
        tier: 2,
        langType: 'dub',
        langLabel: 'Magyar Szinkron',
        langRank: 0,
        tableQuality: '',
        hasAlert: false
      });
    }
  }
  if (candidates.length === 0) {
    const mPayload = html.match(/<script[^>]*data-link-payload[^>]*data-link-context="([^"]+)"[^>]*>(.*?)<\/script>/s);
    if (mPayload) {
      try {
        const routes = unpack(JSON.parse(mPayload[2]).value, mPayload[1]);
        if (Array.isArray(routes)) {
          for (const r of routes) {
            if (!r.startsWith('////diablo') && !r.startsWith('////torrent') && !seen.has(r)) {
              seen.add(r);
              candidates.push({
                route: r,
                host: '',
                family: 'unknown',
                tier: 2,
                langType: 'dub',
                langLabel: 'Magyar Szinkron',
                langRank: 0,
                tableQuality: '',
                hasAlert: false
              });
            }
          }
        }
      } catch (err) {}
    }
  }
  return candidates.slice(0, 10);
}

function finalizeNetMoziStream(s, rowMeta, cleanTitle, opts = {}) {
  if (!s || !s.url) return null;
  const h = Number.isFinite(s.height)
    ? s.height
    : (typeof s.quality === 'number' ? s.quality : parseInt(String(s.quality || ''), 10) || 720);
  const qStr = `${h}p`;
  const kindLabel = (s.isHls || String(s.url).includes('.m3u8')) ? 'HLS' : 'MP4';
  const hosterName = s.hoster || (rowMeta?.host ? rowMeta.host.replace(/^www\./, '') : 'NetMozi');
  const langLabel = rowMeta?.langLabel || 'Magyar';
  const langShort = rowMeta?.langType === 'sub' ? ' • Felirat' : (rowMeta?.langType === 'foreign' ? ' • ENG' : '');
  const rawUrl = String(s.url).trim();
  const reqHeaders = s.behaviorHints?.proxyHeaders?.request || s.headers || {};
  const referer = reqHeaders.Referer || reqHeaders.referer || s.playerUrl || '';

  const isProxied = shouldProxyNetMoziUrl(rawUrl, opts.hostUrl);
  // Zero-proxy remote guard: never return IP/ASN-locked CDN URLs to remote clients (prevents 403 errors)
  if (!isProxied && isRemoteHostContext(opts.hostUrl) && isUrlIpLocked(rawUrl)) {
    return null;
  }

  let finalUrl = rawUrl;
  if (isProxied && hasExternalProxy()) {
    const extBase = process.env.EXTERNAL_PROXY_URL.replace(/\/+$/, '');
    const ext = (kindLabel === 'HLS' || rawUrl.includes('.m3u8')) ? '.m3u8' : '';
    finalUrl = `${extBase}/proxy/hls${ext}?url=${encodeURIComponent(rawUrl)}&ref=${encodeURIComponent(referer)}`;
  }

  const normalized = { ...s };
  delete normalized.description;
  delete normalized.externalUrl;

  normalized.source = 'netmozi';
  normalized.height = h;
  normalized.quality = qStr;
  normalized.isHls = kindLabel === 'HLS';
  normalized.yearVerified = opts.yearVerified !== false;
  normalized.playerUrl = normalized.playerUrl || rawUrl;
  normalized.url = finalUrl;
  normalized.isProxied = isProxied;
  normalized.name = `🇭🇺 NetMozi${langShort}\n${qStr} ${kindLabel}`;
  const langIcon = rowMeta?.langType === 'sub' ? '💬' : (rowMeta?.langType === 'foreign' ? '🌐' : '🔊');
  const modeTag = isProxied ? ' • 🔒 Proxy' : '';
  normalized.title = `🎬 ${cleanTitle || 'NetMozi'}\n📺 ${qStr} ${kindLabel} • ${langIcon} ${langLabel} • 🌐 ${hosterName}${modeTag}`;

  const bingeId = opts.mid ? `netmozi-${opts.mid}-${rowMeta?.langType || 'dub'}-${rowMeta?.family || hosterName.toLowerCase()}` : undefined;
  normalized.behaviorHints = {
    notWebReady: false,
    ...(normalized.behaviorHints || {}),
    ...(bingeId ? { bingeGroup: bingeId } : {}),
    ...(!isProxied && Object.keys(reqHeaders).length > 0 ? { proxyHeaders: { request: reqHeaders } } : {})
  };
  if (isProxied && normalized.behaviorHints.proxyHeaders) {
    delete normalized.behaviorHints.proxyHeaders;
  }

  return normalized;
}

async function resolveMindjartHtml(html, mindjartUrl, cleanTitle, opts = {}, cookieJar = new Map(), useTlsRedirect = false) {
  const remoteNoProxy = isRemoteHostContext(opts.hostUrl) && !hasExternalProxy();
  const rowCandidates = parseMindjartRows(html, { remoteNoProxy });
  if (rowCandidates.length === 0) return [];

  const resolvedTargets = [];
  const seenEmbeds = new Set();

  for (let i = 0; i < rowCandidates.length; i += 4) {
    const batch = rowCandidates.slice(i, i + 4);
    const batchRes = await Promise.all(batch.map(async (item) => {
      try {
        const fullUrl = item.route.startsWith('http') ? item.route : ('https://mindjart.megnezed.com' + item.route);
        let loc = '';
        if (useTlsRedirect) {
          const r = await netmoziTlsRequest(fullUrl, { referer: mindjartUrl, clientIp: opts.clientIp }, cookieJar);
          loc = r.headers?.location || '';
        } else {
          const r = await fetch(fullUrl, {
            redirect: 'manual',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              Referer: mindjartUrl
            },
            signal: AbortSignal.timeout(4500)
          });
          loc = r.headers.get('location') || '';
        }
        if (loc && !seenEmbeds.has(loc) && !isDownloadOnlyHost(loc)) {
          seenEmbeds.add(loc);
          return { embedUrl: loc, rowMeta: item };
        }
      } catch {}
      return null;
    }));
    for (const r of batchRes) {
      if (r) resolvedTargets.push(r);
    }
  }

  if (resolvedTargets.length === 0) return [];

  const { resolveAnyEmbed } = require('../utils/hosters');
  const streams = [];
  await Promise.all(resolvedTargets.map(async ({ embedUrl, rowMeta }) => {
    try {
      let targetEmbed = embedUrl;
      const vidmolyWatchMatch = targetEmbed.match(/^https?:\/\/(?:www\.)?vidmoly\.[a-z]+\/(?:v|w)\/([a-zA-Z0-9]+)/i);
      if (vidmolyWatchMatch) {
        targetEmbed = `https://vidmoly.biz/embed-${vidmolyWatchMatch[1]}.html`;
      }
      const embeddedStreams = await resolveAnyEmbed(targetEmbed, 'NetMozi', cleanTitle, opts.clientIp);
      if (Array.isArray(embeddedStreams)) {
        for (const s of embeddedStreams) {
          const fin = finalizeNetMoziStream(s, rowMeta, cleanTitle, opts);
          if (fin) streams.push(fin);
        }
      }
    } catch {}
  }));

  return streams;
}

async function scrapeMindjartDirect(movieId, isSeries = false, season = null, episode = null, cleanTitle = 'NetMozi', optsOrClientIp = null) {
  const opts = (typeof optsOrClientIp === 'object' && optsOrClientIp !== null)
    ? optsOrClientIp
    : { clientIp: optsOrClientIp };
  try {
    if (!movieId) return [];
    const b64 = Buffer.from(String(movieId)).toString('base64');
    const s = season || 1;
    const e = episode || 1;
    const mindjartUrl = (isSeries && season && episode)
      ? `https://mindjart.megnezed.com/links/vv/${b64}/${s}/${e}`
      : `https://mindjart.megnezed.com/links/vv/${b64}`;

    const pageRes = await fetch(mindjartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Referer: 'https://netmozi.com/'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!pageRes.ok) return [];
    const html = await pageRes.text();
    return await resolveMindjartHtml(html, mindjartUrl, cleanTitle, { ...opts, mid: opts.mid || movieId }, new Map(), false);
  } catch (err) {
    console.warn('[NetMozi] scrapeMindjartDirect error:', err.message);
    return [];
  }
}

/**
 * Scrapes a specific NetMozi detail page URL (e.g. /sorozatok/42579/.../s1/e1 or /adatlap/1234/...)
 */
async function scrapeNetMoziDetailPage(targetPageUrl, cleanTitle, optsOrClientIp = null, cookieJar = new Map(), targetSeason = null, targetEpisode = null) {
  const opts = (typeof optsOrClientIp === 'object' && optsOrClientIp !== null)
    ? optsOrClientIp
    : { clientIp: optsOrClientIp };
  const clientIp = opts.clientIp || null;
  const streams = [];
  try {
    const urlMidMatch = targetPageUrl.match(/\/(?:sorozatok|adatlap|filmek|film)\/(\d+)/i);
    const urlSMatch = targetPageUrl.match(/\/s(\d+)\/e(\d+)/i);
    const urlMid = urlMidMatch ? urlMidMatch[1] : null;
    const urlS = targetSeason || (urlSMatch ? parseInt(urlSMatch[1], 10) : null);
    const urlE = targetEpisode || (urlSMatch ? parseInt(urlSMatch[2], 10) : null);
    const urlIsSeries = Boolean(urlS && urlE) || targetPageUrl.includes('/sorozatok/');

    if (urlMid) {
      const directStreams = await scrapeMindjartDirect(urlMid, urlIsSeries, urlS, urlE, cleanTitle, { ...opts, mid: opts.mid || urlMid });
      if (directStreams && directStreams.length > 0) {
        return directStreams;
      }
    }

    const detailPageRes = await netmoziFetchWithRedirects(targetPageUrl, { referer: 'https://netmozi.com/', clientIp }, cookieJar);
    if (!detailPageRes.body) return streams;

    const attrs = {};
    for (const mMatch of detailPageRes.body.matchAll(/(data-movie-id|data-token|data-csrf|data-season|data-episode)="([^"]*)"/g)) {
      attrs[mMatch[1]] = mMatch[2];
    }

    const movieId = attrs['data-movie-id'];
    const csrf = attrs['data-csrf'];
    const token = attrs['data-token'] || '';

    if (!movieId || !csrf) {
      return streams;
    }

    const s = targetSeason || attrs['data-season'];
    const e = targetEpisode || attrs['data-episode'];
    const isSeries = Boolean(s && e);

    const postBody = isSeries
      ? `token=${encodeURIComponent(token)}&season=${s}&episode=${e}`
      : `token=${encodeURIComponent(token)}`;

    const loadLinksUrl = `https://netmozi.com/details/loadLinks/${movieId}${csrf}`;
    const loadLinksRes = await netmoziTlsRequest(loadLinksUrl, {
      method: 'POST',
      body: postBody,
      referer: targetPageUrl,
      clientIp,
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      }
    }, cookieJar);

    let linksData;
    try {
      linksData = JSON.parse(loadLinksRes.body);
    } catch (e) {
      return streams;
    }

    if (!linksData || !linksData.success) {
      return streams;
    }

    let mindjartUrl = null;
    if (linksData.html) {
      const match = linksData.html.match(/href="([^"]+)"/);
      if (match) {
        mindjartUrl = match[1].replace(/\\/g, '');
      }
    }

    if (!mindjartUrl && linksData.linkPayload?.value) {
      const redirectPages = unpack(linksData.linkPayload.value, token);
      if (Array.isArray(redirectPages) && redirectPages.length > 0) {
        mindjartUrl = redirectPages[0];
      }
    }

    if (!mindjartUrl) return streams;

    const mindjartRes = await netmoziFetchWithRedirects(mindjartUrl, { referer: 'https://netmozi.com/', clientIp }, cookieJar);
    if (!mindjartRes.body) return streams;

    return await resolveMindjartHtml(
      mindjartRes.body,
      mindjartUrl,
      cleanTitle,
      { ...opts, mid: opts.mid || movieId },
      cookieJar,
      true
    );
  } catch (err) {
    console.warn('[NetMozi] scrapeNetMoziDetailPage error:', err.message);
  }
  return streams;
}

/**
 * Searches NetMozi for catalog browsing. Returns parsed media items.
 */
async function searchNetMozi(query, type = null) {
  if (!query || query.trim().length < 2) return [];
  const clean = query.trim();
  const cookieJar = new Map();

  try {
    const searchUrl = `https://netmozi.com/?search=${encodeURIComponent(clean)}`;
    const searchRes = await netmoziTlsRequest(searchUrl, {}, cookieJar);
    if (!searchRes.body) return [];

    const normTarget = normalize(clean);
    const isSeries = type === 'series' ? true : (type === 'movie' ? false : null);
    let candidates = parseCandidatesFromHtml(searchRes.body, isSeries, normTarget, null);

    if (candidates.length === 0) {
      const m = searchRes.body.match(/data-results-url="([^"]+)"\s+data-results-token="([^"]+)"/);
      if (m) {
        const resultsUrl = 'https://netmozi.com' + m[1];
        const resultsToken = m[2];

        const resultsRes = await netmoziTlsRequest(resultsUrl, {
          method: 'POST',
          body: 'token=' + encodeURIComponent(resultsToken),
          referer: searchUrl,
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }, cookieJar);

        try {
          const data = JSON.parse(resultsRes.body);
          if (data && data.success && data.html?.classic) {
            const resolvedHtml = resolveContent(data.html.classic);
            candidates = parseCandidatesFromHtml(resolvedHtml, isSeries, normTarget, null);
          }
        } catch (e) {}
      }
    }

    const filtered = candidates.filter(c => {
      if (type === 'series' && !c.isSeries) return false;
      if (type === 'movie' && c.isSeries) return false;
      return true;
    });

    return (filtered.length > 0 ? filtered : candidates).map(c => {
      const mid = c.mid || (c.link.match(/\d+/) ? c.link.match(/\d+/)[0] : '');
      const itemType = c.isSeries ? 'series' : 'movie';
      if (mid && c.title) {
        netmoziTitleCache.set(String(mid), c.title);
      }
      if (mid && c.link) {
        const slugMatch = c.link.match(/\/(?:sorozatok|adatlap|film)\/\d+\/([^/?#]+)/);
        if (slugMatch) {
          netmoziSlugCache.set(String(mid), slugMatch[1]);
        }
      }
      return {
        id: `netmozi:${itemType}:${mid}`,
        name: c.title,
        type: itemType,
        poster: c.poster || 'https://images.metahub.space/poster/medium/tt8111088/img',
        year: c.year || '',
        description: c.description || `NetMozi ${itemType === 'series' ? 'sorozat' : 'film'}: ${c.title}`,
        netmoziLink: c.link
      };
    });
  } catch (err) {
    return [];
  }
}

/**
 * Fetches episode structure for a NetMozi series (e.g. netmozi:series:42579).
 */
async function getNetMoziSeriesEpisodes(netmoziId) {
  if (!netmoziId) return null;
  const parts = netmoziId.split(':');
  const mid = parts[2] || parts[1];
  if (!mid) return null;
  const cookieJar = new Map();

  try {
    const titleHint = getNetMoziTitle(mid);
    const slug = getNetMoziSlug(mid) || (titleHint ? normalize(titleHint).replace(/\s+/g, '-') : '') || '_';
    
    // Prefer /adatlap/ which contains the complete series index without redirecting to a single episode
    let res = await netmoziFetchWithRedirects(`https://netmozi.com/adatlap/${mid}/${slug}`, { referer: 'https://netmozi.com/' }, cookieJar);
    if (!res.body || res.body.length < 500) {
      res = await netmoziFetchWithRedirects(`https://netmozi.com/sorozatok/${mid}/${slug}`, { referer: 'https://netmozi.com/' }, cookieJar);
    }
    if (!res.body) return null;

    let title = 'NetMozi Sorozat';
    let poster = '';
    let description = '';
    let year = '';

    const jsonLdMatch = res.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.name) title = jsonLd.name;
        if (jsonLd.image) poster = jsonLd.image;
        if (jsonLd.description) description = jsonLd.description;
      } catch (e) {}
    }

    const yearMatch = res.body.match(/Év:[\s\S]*?([0-9]{4})/i);
    if (yearMatch) year = yearMatch[1];

    const encTitle = encodeURIComponent(title || 'Sorozat');
    const seasonsMapSets = {};

    // Method 1: href="#season_X_episode_Y" or id="tab_sXeY"
    const tabRegex = /(?:href=["']#season_(\d+)_episode_(\d+)["']|id=["']tab_s(\d+)e(\d+)["'])/gi;
    for (const m of res.body.matchAll(tabRegex)) {
      const s = parseInt(m[1] || m[3], 10);
      const e = parseInt(m[2] || m[4], 10);
      if (!s || !e || e === 0 || s === 0) continue;
      if (!seasonsMapSets[s]) seasonsMapSets[s] = new Set();
      seasonsMapSets[s].add(e);
    }

    // Method 2: data-episodes (progress summary)
    const depMatches = [
      ...res.body.matchAll(/data-season=["'](\d+)["'][^>]*?data-episodes=["']([^"']+)["']/gi),
      ...res.body.matchAll(/data-episodes=["']([^"']+)["'][^>]*?data-season=["'](\d+)["']/gi)
    ];
    for (const dm of depMatches) {
      const s = parseInt(dm[1] || dm[2], 10);
      const epStr = dm[2] && dm[2].includes(',') ? dm[2] : dm[1];
      if (!s || s === 0 || !epStr) continue;
      if (!seasonsMapSets[s]) seasonsMapSets[s] = new Set();
      epStr.split(',').map(n => parseInt(n.trim(), 10)).filter(n => n > 0).forEach(n => seasonsMapSets[s].add(n));
    }

    // Method 3: any tag with data-episode and data-season in either order
    const eitherRegex = /<[^>]+(?:data-episode=["'](\d+)["'][^>]*?data-season=["'](\d+)["']|data-season=["'](\d+)["'][^>]*?data-episode=["'](\d+)["'])[^>]*>/gi;
    for (const em of res.body.matchAll(eitherRegex)) {
      const e = parseInt(em[1] || em[4], 10);
      const s = parseInt(em[2] || em[3], 10);
      if (!s || !e || e === 0 || s === 0) continue;
      if (!seasonsMapSets[s]) seasonsMapSets[s] = new Set();
      seasonsMapSets[s].add(e);
    }

    const totalParsedEps = Object.values(seasonsMapSets).reduce((sum, set) => sum + set.size, 0);

    // If datacenter IP returned a stub (fewer than 3 episodes), enrich with TVMaze or synthesized range
    if (totalParsedEps < 3 && title) {
      try {
        const tvMazeSearch = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, {
          signal: AbortSignal.timeout(3000)
        }).then(r => r.json());

        if (Array.isArray(tvMazeSearch) && tvMazeSearch.length > 0 && tvMazeSearch[0]?.show?.id) {
          const tvShow = tvMazeSearch[0].show;
          const tvEps = await fetch(`https://api.tvmaze.com/shows/${tvShow.id}/episodes`, {
            signal: AbortSignal.timeout(3500)
          }).then(r => r.json());

          if (Array.isArray(tvEps) && tvEps.length > 0) {
            if (!poster && (tvShow.image?.original || tvShow.image?.medium)) {
              poster = tvShow.image.original || tvShow.image.medium;
            }
            if (!description && tvShow.summary) {
              description = tvShow.summary.replace(/<[^>]+>/g, '').trim();
            }

            // Clear stub so we have exact episode structure
            for (const k in seasonsMapSets) delete seasonsMapSets[k];

            for (const ep of tvEps) {
              if (!ep.season || !ep.number) continue;
              const sNum = ep.season;
              const eNum = ep.number;
              if (!seasonsMapSets[sNum]) seasonsMapSets[sNum] = new Set();
              seasonsMapSets[sNum].add(eNum);
            }
          }
        }
      } catch (e) {}
    }

    // If still <= 1 episode, check if we found a max season/episode indicator and synthesize range
    const totalAfterTvMaze = Object.values(seasonsMapSets).reduce((sum, set) => sum + set.size, 0);
    if (totalAfterTvMaze <= 1) {
      let maxS = 1;
      let maxE = 1;
      for (const s in seasonsMapSets) {
        if (Number(s) > maxS) maxS = Number(s);
        for (const e of seasonsMapSets[s]) {
          if (e > maxE) maxE = e;
        }
      }
      if (maxE > 1 || maxS > 1) {
        for (let s = 1; s <= maxS; s++) {
          if (!seasonsMapSets[s]) seasonsMapSets[s] = new Set();
          const targetMax = (s === maxS) ? maxE : Math.max(maxE, 10);
          for (let e = 1; e <= targetMax; e++) {
            seasonsMapSets[s].add(e);
          }
        }
      }
    }

    const seasonsMap = {};
    const sortedSeasons = Object.keys(seasonsMapSets).map(Number).sort((a, b) => a - b);
    for (const sNum of sortedSeasons) {
      const sortedEps = [...seasonsMapSets[sNum]].sort((a, b) => a - b);
      seasonsMap[sNum] = sortedEps.map(eNum => ({
        id: `netmozi:series:${mid}:${sNum}:${eNum}:${encTitle}`,
        season: sNum,
        episode: eNum,
        name: `${eNum}. Rész`,
        overview: `${title} - ${sNum}. Évad ${eNum}. Rész`,
        thumbnail: poster
      }));
    }

    if (Object.keys(seasonsMap).length === 0) {
      seasonsMap['1'] = [{
        id: `netmozi:series:${mid}:1:1:${encTitle}`,
        season: 1,
        episode: 1,
        name: '1. Rész',
        overview: `${title} - 1. Évad 1. Rész`,
        thumbnail: poster
      }];
    }

    if (mid && title) {
      netmoziTitleCache.set(String(mid), title);
    }

    return {
      id: `netmozi:series:${mid}`,
      name: title,
      englishName: title,
      year,
      poster,
      background: poster,
      description,
      genres: ['Magyar Sorozat'],
      seasons: seasonsMap
    };
  } catch (err) {
    return null;
  }
}

/**
 * Fetches rich metadata for a NetMozi movie (e.g. netmozi:movie:35134).
 */
async function getNetMoziMovieMeta(netmoziId) {
  if (!netmoziId) return null;
  const parts = String(netmoziId).split(':');
  const mid = parts[2] || parts[1] || parts[0];
  if (!mid || !/^\d+$/.test(mid)) return null;

  const cachedTitle = getNetMoziTitle(mid);
  const slug = getNetMoziSlug(mid) || '_';
  const cookieJar = new Map();

  let title = cachedTitle || '';
  let year = '';
  let poster = '';
  let background = '';
  let description = '';
  let imdbId = '';

  try {
    let res = await netmoziFetchWithRedirects(`https://netmozi.com/filmek/${mid}/${slug}`, { referer: 'https://netmozi.com/' }, cookieJar);
    if (!res.body || res.body.length < 500) {
      res = await netmoziFetchWithRedirects(`https://netmozi.com/adatlap/${mid}/${slug}`, { referer: 'https://netmozi.com/' }, cookieJar);
    }
    if (res && res.body) {
      const ldMatch = res.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
      if (ldMatch) {
        try {
          const ld = JSON.parse(ldMatch[1]);
          if (ld.name) title = String(ld.name).trim();
          if (ld.description) description = String(ld.description).trim();
          if (ld.datePublished) {
            const ym = String(ld.datePublished).match(/\b(19|20)\d{2}\b/);
            if (ym) year = ym[0];
          }
          if (ld.image) {
            poster = String(ld.image).startsWith('http') ? ld.image : ('https://netmozi.com' + ld.image);
          }
        } catch {}
      }

      if (!title) {
        const tm = res.body.match(/<title>([^<(]+)(?:\((\d{4})\))?[^<]*<\/title>/i);
        if (tm) {
          title = tm[1].replace(/\s*online\s*film.*$/i, '').replace(/\s*::\s*NetMozi.*$/i, '').trim();
          if (!year && tm[2]) year = tm[2];
        }
      }
      if (!year) {
        const ty = res.body.match(/<title>[^<]*\((\d{4})\)/i);
        if (ty) year = ty[1];
      }
      const imdbMatch = res.body.match(/imdb\.com\/title\/(tt\d+)/i);
      if (imdbMatch) imdbId = imdbMatch[1];

      if (!poster) {
        const pm = res.body.match(/(https?:\/\/netmozi\.com\/pic\/imdb\/[^"'\s]+|\/pic\/imdb\/[^"'\s]+)/i);
        if (pm) {
          poster = pm[1].startsWith('http') ? pm[1] : ('https://netmozi.com' + pm[1]);
        } else if (imdbId) {
          poster = `https://images.metahub.space/poster/medium/${imdbId}/img`;
        }
      }
      if (imdbId) {
        background = `https://images.metahub.space/background/medium/${imdbId}/img`;
      }
      if (!description) {
        const dm = res.body.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        if (dm) description = dm[1].trim();
      }
      if (res.url) {
        const slugM = res.url.match(/\/(?:filmek|adatlap)\/\d+\/([^/?#]+)/);
        if (slugM && slugM[1] !== '_') netmoziSlugCache.set(String(mid), slugM[1]);
      }
    }
  } catch {}

  if (title) {
    netmoziTitleCache.set(String(mid), title);
  }

  return {
    id: `netmozi:movie:${mid}`,
    type: 'movie',
    name: title || 'NetMozi Film',
    ...(year ? { releaseInfo: year, year: parseInt(year, 10) } : {}),
    ...(poster ? { poster } : {}),
    background: background || poster || '',
    description: description || `NetMozi magyar film${title ? `: ${title}` : ''}`,
    ...(imdbId ? { imdb_id: imdbId } : {}),
    genres: ['Magyar Film']
  };
}

module.exports = {
  scrapeNetMozi,
  scrapeMindjartDirect,
  scrapeNetMoziDetailPage,
  searchNetMozi,
  getNetMoziMovieMeta,
  getNetMoziSeriesEpisodes,
  getNetMoziTitle,
  getNetMoziSlug,
  netmoziTitleCache,
  netmoziSlugCache,
  netmoziTlsRequest,
  netmoziFetchWithRedirects
};
