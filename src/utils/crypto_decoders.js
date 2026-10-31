const crypto = require('node:crypto');
const { UA } = require('./meta');

/**
 * 1. NetMozi LinkPayload Decoder (FNV-1a + xorshift32 v2 & v1)
 * Used by NetMozi and mindjart.megnezed.com redirect wrappers.
 */
function _seed(value) {
  let state = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    state ^= value.charCodeAt(i);
    state = (state + (state << 1) + (state << 4) + (state << 7) + (state << 8) + (state << 24)) >>> 0;
  }
  return state >>> 0;
}

function _generator(state) {
  let s = state >>> 0;
  return function nxt() {
    s ^= (s << 13) >>> 0;
    s ^= s >>> 17;
    s ^= (s << 5) >>> 0;
    return s >>> 0;
  };
}

function unpackNetMoziPayload(value, token) {
  if (!value || typeof token !== 'string' || !token) return [];
  if (value.v === 2) {
    try {
      if (!value.s || !Array.isArray(value.d) || typeof value.m !== 'string') return [];
      const manifest = Buffer.from(value.m, 'base64').toString('binary');
      if (!manifest.length || manifest.length % 4) return [];
      const order = _generator(_seed(token + '|' + value.s + '|v2/positions') || 1);
      let encoded = '';
      for (let i = 0; i < manifest.length; i += 4) {
        const entry = (((manifest.charCodeAt(i) << 24) | (manifest.charCodeAt(i + 1) << 16)
          | (manifest.charCodeAt(i + 2) << 8) | manifest.charCodeAt(i + 3))) >>> 0;
        const position = (entry ^ order()) >>> 0;
        const bin = position % 4;
        const index = Math.floor(position / 4);
        if (!Array.isArray(value.d[bin]) || typeof value.d[bin][index] !== 'string') return [];
        encoded += value.d[bin][index];
      }
      const state = _seed('v2|' + value.s + '|' + token) || 1;
      let previous = state & 255;
      const bytes = Buffer.from(encoded, 'base64').toString('binary');
      const next = _generator(state);
      let escaped = '';
      for (let i = 0; i < bytes.length; i++) {
        const cipher = bytes.charCodeAt(i);
        const code = ((cipher ^ (next() & 255)) - previous - (i % 251)) & 255;
        previous = cipher;
        escaped += '%' + ('0' + code.toString(16)).slice(-2);
      }
      const routes = JSON.parse(decodeURIComponent(escaped));
      return Array.isArray(routes) ? routes : [routes];
    } catch {
      return [];
    }
  }
  if (value.r && value.p) {
    try {
      const order = _generator(_seed(token + '|' + value.n + '|order') || 1);
      let encoded = '';
      for (const r of value.r) {
        const position = (Number(r) ^ order()) >>> 0;
        encoded += value.p[position % 3][Math.floor(position / 3)];
      }
      const raw = Buffer.from(encoded, 'base64');
      const nxt = _generator(_seed(token + '|' + value.n) || 1);
      const plain = Buffer.alloc(raw.length);
      for (let i = 0; i < raw.length; i++) {
        plain[i] = raw[i] ^ (nxt() & 255);
      }
      return JSON.parse(plain.toString('utf8'));
    } catch {
      return [];
    }
  }
  return [];
}

function resolveNetMoziContent(html) {
  if (!html || typeof html !== 'string') return '';
  for (let iter = 0; iter < 3; iter++) {
    if (!html.includes('data-content-payload')) break;
    const regex = /<script[^>]*data-content-payload[^>]*data-content-context="([^"]+)"[^>]*>(.*?)<\/script>/gs;
    let match;
    let replacedAny = false;
    while ((match = regex.exec(html)) !== null) {
      try {
        const context = match[1];
        const payload = JSON.parse(match[2]);
        const decodedArr = unpackNetMoziPayload(payload.value, context);
        const decoded = Array.isArray(decodedArr) ? decodedArr.join('') : String(decodedArr);
        const scopeRegex = new RegExp('<div[^>]*data-content-scope="' + payload.scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>.*?<\\/div>', 's');
        html = html.replace(scopeRegex, decoded);
        html = html.replace(match[0], '');
        replacedAny = true;
      } catch {}
    }
    if (!replacedAny) break;
  }
  return html;
}

/**
 * 2. RPMStream / HDMozi AES-CBC-128 Stream Decryptor
 */
const RPM_KEY = Buffer.from('6b69656d7469656e6d75613931316361', 'hex');
const RPM_IV = Buffer.from('123456789oiuytr\0', 'utf8').subarray(0, 16);

async function resolveRpmStream(rpmUrlOrId, referer = 'https://hdmozi.hu/') {
  let videoId = String(rpmUrlOrId || '').trim();
  const hashMatch = videoId.match(/#([a-zA-Z0-9]+)/);
  if (hashMatch) videoId = hashMatch[1];
  else {
    const idMatch = videoId.match(/\/([a-zA-Z0-9]{5,24})$/);
    if (idMatch) videoId = idMatch[1];
  }
  if (!videoId || videoId.length < 4) return null;

  const hosts = [
    'https://rpmshare.rpmstream.live',
    'https://rpmvid.com',
    'https://rpmhub.site'
  ];

  for (const host of hosts) {
    try {
      const apiUrl = `${host}/api/v1/video?id=${encodeURIComponent(videoId)}&w=1920&h=1080&r=${encodeURIComponent(new URL(referer).hostname)}`;
      const r = await fetch(apiUrl, {
        headers: {
          'User-Agent': UA,
          Referer: `${host}/#${videoId}`,
          Origin: host
        },
        signal: AbortSignal.timeout(5500)
      });
      if (!r.ok) continue;
      const hexCipher = (await r.text()).trim();
      if (!hexCipher || hexCipher.length < 32 || !/^[0-9a-fA-F]+$/.test(hexCipher)) continue;

      const decipher = crypto.createDecipheriv('aes-128-cbc', RPM_KEY, RPM_IV);
      decipher.setAutoPadding(true);
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(hexCipher, 'hex')),
        decipher.final()
      ]).toString('utf8');

      const data = JSON.parse(decrypted);
      const hlsUrl = data.source || data.hls || data.file;
      if (hlsUrl && hlsUrl.startsWith('http')) {
        return {
          url: hlsUrl,
          title: data.title || null,
          host,
          headers: {
            Referer: `${host}/`,
            Origin: host,
            'User-Agent': UA
          }
        };
      }
    } catch {}
  }
  return null;
}

/**
 * 3. Dean Edwards `eval(function(p,a,c,k,e,d)...)` Unpacker
 */
function unpackPacker(str) {
  const m = String(str || '').match(/}\(\s*'([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
  if (!m) return null;
  let [_, p, aStr, cStr, kRaw] = m;
  const a = parseInt(aStr, 10);
  let c = parseInt(cStr, 10);
  const k = kRaw.split('|');

  const encodeBase = (num) => {
    const first = num < a ? '' : encodeBase(Math.floor(num / a));
    const rem = num % a;
    const ch = rem > 35 ? String.fromCharCode(rem + 29) : rem.toString(36);
    return first + ch;
  };

  while (c--) {
    if (k[c]) {
      const token = encodeBase(c);
      p = p.replace(new RegExp(`\\b${token}\\b`, 'g'), k[c]);
    }
  }
  return p;
}

/**
 * 4. Hunter JS Obfuscation Decoder (used by Sorozatok.net / Streambot)
 */
function decodeHunter(h, u, n, t, e, r) {
  try {
    const sep = n[e];
    const parts = String(h).split(sep);
    const bytes = [];
    for (const part of parts) {
      if (!part) continue;
      let val = 0;
      for (const ch of part) {
        const idx = n.indexOf(ch);
        if (idx !== -1) val = val * e + idx;
      }
      bytes.push(val - t);
    }
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return '';
  }
}

/**
 * 5. VOE 5-Stage Payload Decoder
 * (ROT13 -> Symbol Strip -> Base64 -> CharShift(-3) -> Reverse -> Base64 -> JSON)
 */
function decodeVoePayload(encoded) {
  try {
    const rot13 = encoded.replace(/[a-zA-Z]/g, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
    const cleaned = rot13.replace(/(@\$|\^\^|~@|%\?|\*~|!!|#&)/g, '');
    const step3 = Buffer.from(cleaned, 'base64').toString('utf8');
    let step4 = '';
    for (let i = 0; i < step3.length; i++) {
      step4 += String.fromCharCode(step3.charCodeAt(i) - 3);
    }
    const reversed = step4.split('').reverse().join('');
    const jsonStr = Buffer.from(reversed, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

module.exports = {
  unpackNetMoziPayload,
  resolveNetMoziContent,
  resolveRpmStream,
  unpackPacker,
  decodeHunter,
  decodeVoePayload
};
