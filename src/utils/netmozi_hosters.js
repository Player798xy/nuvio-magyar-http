'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DOWNLOAD_ONLY_HOSTS = [
  'frdl.io', 'fredl.ru', 'katfile.', 'uploady.', 'rapidgator.', 'turbobit.',
  'nitroflare.', 'ddownload.', '1fichier.', 'mega.nz', 'mediafire.com',
  'diablotorrent', 'myupload.us'
];

const IP_LOCKED_HOST_PATTERNS = [
  'cloudwindow-route',
  'ugc-cdn',
  'vmpx.online',
  'vmnow.online',
  'r66nv9ed.com',
  'sprintcdn',
  '97bf1.com'
];

function isDownloadOnlyHost(url) {
  const lower = String(url || '').toLowerCase();
  return DOWNLOAD_ONLY_HOSTS.some(h => lower.includes(h));
}

/**
 * Checks whether a resolved media URL is bound to the scraper's egress IP or ASN.
 */
function isUrlIpLocked(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return false;
  const lower = mediaUrl.toLowerCase();
  if (IP_LOCKED_HOST_PATTERNS.some(p => lower.includes(p))) return true;
  if (/[?&]asn=\d+/i.test(mediaUrl)) return true;
  if (/token=[^&]*-\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-/i.test(mediaUrl)) return true;
  if (/[?&]i=(?!0\.3(?:&|$)|0\.0(?:&|$))\d{1,3}\.\d{1,3}/i.test(mediaUrl)) return true;
  return false;
}

function httpRequest(targetUrl, options = {}, redirectsLeft = 4) {
  return new Promise((resolve) => {
    try {
      const u = new URL(targetUrl);
      const client = u.protocol === 'http:' ? http : https;
      const req = client.request({
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        timeout: options.timeout || 7000,
        headers: {
          'User-Agent': UA,
          ...(options.headers || {})
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, targetUrl).toString();
          return resolve(httpRequest(next, options, redirectsLeft - 1));
        }
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => resolve({
          status: res.statusCode,
          finalUrl: targetUrl,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 0, finalUrl: targetUrl, headers: {}, body: '' });
      });
      req.on('error', () => resolve({ status: 0, finalUrl: targetUrl, headers: {}, body: '' }));
      if (options.body) req.write(options.body);
      req.end();
    } catch {
      resolve({ status: 0, finalUrl: targetUrl, headers: {}, body: '' });
    }
  });
}

function generalUnpack(html) {
  const results = [];
  if (!html) return results;
  const re = /eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]*?\}\((['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\((['"])\|\7\)/g;
  for (const m of html.matchAll(re)) {
    let p = m[2];
    const a = parseInt(m[3], 10);
    let c = parseInt(m[4], 10);
    const k = m[6].split('|');
    if (!a || !Number.isFinite(c) || c <= 0) continue;
    const encode = (n) => {
      const prefix = n < a ? '' : encode(Math.floor(n / a));
      const rem = n % a;
      return prefix + (rem > 35 ? String.fromCharCode(rem + 29) : rem.toString(36));
    };
    while (c--) {
      if (k[c]) {
        p = p.replace(new RegExp('\\b' + encode(c) + '\\b', 'g'), k[c]);
      }
    }
    results.push(p);
  }
  return results;
}

function inferHeight(text, fallback = 720) {
  const s = String(text || '');
  if (/\b2160p?\b|\b4k\b|\buhd\b/i.test(s)) return 2160;
  if (/\b1080p?\b|\bfhd\b|\bfull\s*hd\b/i.test(s)) return 1080;
  if (/\b720p?\b/i.test(s)) return 720;
  if (/\b480p?\b|\bsd\b|\bdvd\b/i.test(s)) return 480;
  if (/\b360p?\b/i.test(s)) return 360;
  return fallback;
}

function buildStreamObject({ url, playerUrl, sourceLabel, customTitle, hosterName, height, isHls, headers }) {
  const h = Number.isFinite(height) ? height : 720;
  const qStr = `${h}p`;
  const kindLabel = isHls ? 'HLS' : 'MP4';
  const reqHeaders = headers || {};
  return {
    name: `🇭🇺 ${sourceLabel}\n${qStr} ${kindLabel}`,
    title: `🎬 ${customTitle || sourceLabel}\n📺 ${qStr} ${kindLabel} • 🔊 Magyar • 🌐 ${hosterName}`,
    url,
    playerUrl: playerUrl || url,
    quality: qStr,
    height: h,
    isHls: Boolean(isHls),
    hoster: hosterName,
    source: 'netmozi',
    headers: reqHeaders,
    behaviorHints: {
      notWebReady: false,
      proxyHeaders: { request: reqHeaders }
    }
  };
}

function b64urlDecode(str) {
  let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function decryptBysePlayback(playback) {
  if (!playback || playback.algorithm !== 'AES-256-GCM') return null;
  if (!Array.isArray(playback.key_parts) || !playback.iv || !playback.payload) return null;

  const tryIndices = [];
  const v = parseInt(playback.version, 10);
  if (Number.isInteger(v) && v >= 1 && v <= playback.key_parts.length && (30 - v) < playback.key_parts.length) {
    tryIndices.push([v - 1, 30 - v]);
  }

  for (const [idx1, idx2] of tryIndices) {
    try {
      const key = Buffer.concat([b64urlDecode(playback.key_parts[idx1]), b64urlDecode(playback.key_parts[idx2])]);
      const iv = b64urlDecode(playback.iv);
      const buf = b64urlDecode(playback.payload);
      if (key.length !== 32 || iv.length !== 12 || buf.length <= 16) continue;
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(buf.subarray(buf.length - 16));
      const plain = Buffer.concat([decipher.update(buf.subarray(0, buf.length - 16)), decipher.final()]).toString('utf8');
      return JSON.parse(plain);
    } catch {
      // ignore mismatch
    }
  }
  return null;
}

async function extractStreamRuby(url, sourceLabel, customTitle) {
  const res = await httpRequest(url, { headers: { Referer: 'https://mindjart.megnezed.com/' } });
  let html = res.body || '';
  let refUrl = res.finalUrl || url;
  let m3u8 = html.match(/https?:\/\/[^\s"'`<>]+\.m3u8[^\s"'`<>]*/i)?.[0];

  if (!m3u8) {
    const code = new URL(refUrl).pathname.replace(/^\/+/, '').replace(/\.html$/i, '').replace(/^embed-/, '');
    if (code) {
      const embedUrl = `${new URL(refUrl).origin}/embed-${code}.html`;
      const er = await httpRequest(embedUrl, { headers: { Referer: refUrl } });
      html = er.body || html;
      refUrl = er.finalUrl || embedUrl;
      m3u8 = html.match(/https?:\/\/[^\s"'`<>]+\.m3u8[^\s"'`<>]*/i)?.[0];
    }
  }
  if (!m3u8) return [];
  const origin = new URL(refUrl).origin;
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  return [buildStreamObject({
    url: m3u8,
    playerUrl: refUrl,
    sourceLabel,
    customTitle,
    hosterName: 'StreamRuby',
    height: inferHeight(pageTitle, 720),
    isHls: true,
    headers: { Referer: `${origin}/`, Origin: origin, 'User-Agent': UA }
  })];
}

async function extractVtube(url, sourceLabel, customTitle) {
  const res = await httpRequest(url, { headers: { Referer: 'https://mindjart.megnezed.com/' } });
  const html = res.body || '';
  const m3u8 = html.match(/https?:\/\/[^\s"'`<>]+\.m3u8[^\s"'`<>]*/i)?.[0];
  if (!m3u8) return [];
  const origin = new URL(res.finalUrl || url).origin;
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  return [buildStreamObject({
    url: m3u8,
    playerUrl: res.finalUrl || url,
    sourceLabel,
    customTitle,
    hosterName: 'vTube',
    height: inferHeight(pageTitle, 720),
    isHls: true,
    headers: { Referer: `${origin}/`, Origin: origin, 'User-Agent': UA }
  })];
}

async function extractLuluvid(url, sourceLabel, customTitle) {
  const u = new URL(url);
  const code = u.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/i, '');
  if (!code) return [];
  const embedUrl = `${u.origin}/e/${code}`;
  const res = await httpRequest(embedUrl, { headers: { Referer: `${u.origin}/` } });
  const unpackedList = generalUnpack(res.body);
  const haystack = unpackedList.join('\n') + '\n' + (res.body || '');
  const m3u8 = haystack.match(/https?:\/\/[^\s"'`<>]+\.m3u8[^\s"'`<>]*/i)?.[0];
  if (!m3u8) return [];
  const pageTitle = (res.body || '').match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  return [buildStreamObject({
    url: m3u8,
    playerUrl: embedUrl,
    sourceLabel,
    customTitle,
    hosterName: 'LuluVid',
    height: inferHeight(pageTitle, 720),
    isHls: true,
    headers: { Referer: `${u.origin}/`, Origin: u.origin, 'User-Agent': UA }
  })];
}

async function extractMixdrop(url, sourceLabel, customTitle) {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const code = parts[1] || parts[0];
  if (!code) return [];
  const embedUrl = `${u.origin}/e/${code}`;
  const res = await httpRequest(embedUrl, { headers: { Referer: `${u.origin}/` } });
  const unpackedList = generalUnpack(res.body);
  const unpacked = unpackedList.join('\n');
  let mp4 = unpacked.match(/(?:MDCore\.)?wurl\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!mp4 || mp4.trim().length < 5) return [];
  if (mp4.startsWith('//')) mp4 = 'https:' + mp4;
  const pageTitle = (res.body || '').match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  return [buildStreamObject({
    url: mp4,
    playerUrl: embedUrl,
    sourceLabel,
    customTitle,
    hosterName: 'MixDrop',
    height: inferHeight(pageTitle, 720),
    isHls: false,
    headers: { Referer: `${u.origin}/`, Origin: u.origin, 'User-Agent': UA }
  })];
}

async function extractVidara(url, sourceLabel, customTitle) {
  const u = new URL(url);
  const code = u.pathname.match(/\/(?:v|e)\/([a-zA-Z0-9]+)/)?.[1] || u.pathname.split('/').filter(Boolean).pop();
  if (!code) return [];
  const apiUrl = `${u.origin}/api/stream`;
  const res = await httpRequest(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: url,
      Origin: u.origin
    },
    body: JSON.stringify({ filecode: code })
  });
  if (res.status !== 200 || !res.body) return [];
  try {
    const data = JSON.parse(res.body);
    if (!data.streaming_url || !data.streaming_url.startsWith('http')) return [];
    return [buildStreamObject({
      url: data.streaming_url,
      playerUrl: url,
      sourceLabel,
      customTitle,
      hosterName: 'Vidara',
      height: inferHeight(data.title || '', 720),
      isHls: true,
      headers: { Referer: `${u.origin}/`, Origin: u.origin, 'User-Agent': UA }
    })];
  } catch {
    return [];
  }
}

async function extractByse(url, sourceLabel, customTitle) {
  const u = new URL(url);
  const code = u.pathname.match(/\/(?:d|e|v|f)\/([a-zA-Z0-9]+)/)?.[1];
  if (!code) return [];
  const apiUrl = `${u.origin}/api/videos/${code}`;
  const res = await httpRequest(apiUrl, { headers: { Referer: `${u.origin}/e/${code}` } });
  if (res.status !== 200 || !res.body) return [];
  try {
    const data = JSON.parse(res.body);
    const decrypted = decryptBysePlayback(data.playback);
    if (!decrypted || !Array.isArray(decrypted.sources) || decrypted.sources.length === 0) return [];
    const sorted = [...decrypted.sources]
      .filter(s => s && typeof s.url === 'string' && s.url.startsWith('http'))
      .sort((a, b) => (b.height || 0) - (a.height || 0));
    if (sorted.length === 0) return [];
    const best = sorted[0];
    const h = Number(best.height) || inferHeight(best.label || data.title || '', 720);
    return [buildStreamObject({
      url: best.url,
      playerUrl: `${u.origin}/e/${code}`,
      sourceLabel,
      customTitle,
      hosterName: 'Filemoon',
      height: h,
      isHls: best.url.includes('.m3u8') || (best.mime_type || '').includes('mpegurl'),
      headers: { Referer: `${u.origin}/`, Origin: u.origin, 'User-Agent': UA }
    })];
  } catch {
    return [];
  }
}

/**
 * Resolves additional modern NetMozi hosters not handled in legacy hosters.js.
 * Returns null if URL hoster is not recognized here (caller can fall back to generic handlers).
 */
async function resolveExtraNetMoziHoster(url, sourceLabel = 'NetMozi', customTitle = '') {
  if (!url || typeof url !== 'string') return [];
  const lower = url.toLowerCase();

  if (isDownloadOnlyHost(lower)) return [];

  if (/rubystm\.|streamruby\.|nuvorel\.|rubyvid\./.test(lower)) {
    return await extractStreamRuby(url, sourceLabel, customTitle);
  }
  if (/vtbe\.to/.test(lower)) {
    return await extractVtube(url, sourceLabel, customTitle);
  }
  if (/luluvid\.|luluvdo\.|lulustream\./.test(lower)) {
    return await extractLuluvid(url, sourceLabel, customTitle);
  }
  if (/mxdrop\.|mixdrop\./.test(lower)) {
    return await extractMixdrop(url, sourceLabel, customTitle);
  }
  if (/vidara\.to/.test(lower)) {
    return await extractVidara(url, sourceLabel, customTitle);
  }
  if (/bysesayeveum\.|byselapuix\.|bysetayico\.|byse\.|filemoon\.|moonmov\./.test(lower)) {
    return await extractByse(url, sourceLabel, customTitle);
  }

  return null;
}

module.exports = {
  isDownloadOnlyHost,
  isUrlIpLocked,
  generalUnpack,
  inferHeight,
  buildStreamObject,
  resolveExtraNetMoziHoster
};
