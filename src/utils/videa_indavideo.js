const { UA } = require('./meta');

const STATIC_SECRET = 'xHb0ZvME5q8CBcoQi6AngerDu3FGO9fkUlwPmLVY_RTzj2hJIS4NasXWKy1td7p';

function rc4Decrypt(cipherBuf, keyStr) {
  const key = Buffer.from(keyStr, 'utf-8');
  const S = [];
  for (let i = 0; i < 256; i++) S[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) % 256;
    const tmp = S[i];
    S[i] = S[j];
    S[j] = tmp;
  }

  let i = 0;
  j = 0;
  const out = Buffer.alloc(cipherBuf.length);
  for (let m = 0; m < cipherBuf.length; m++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    const tmp = S[i];
    S[i] = S[j];
    S[j] = tmp;
    out[m] = cipherBuf[m] ^ S[(S[i] + S[j]) % 256];
  }
  return out.toString('utf-8');
}

function computeVideaParams(_xt) {
  const e = _xt.split('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 8; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));

  const c = {};
  let r = ['e', 'a', 'g', 'j', 'd', 'c', 'h', 'i', 'b', 'f'];
  for (let i = 0; i < e.length; i++) {
    if (i % 8 === 0) c[r[Math.floor(i / 8) + 1]] = '';
    c[r[Math.floor(i / 8) + 1]] += e[i];
  }
  c[r[0]] = t;

  const d = c.a + c.g + c.j + c.d;
  const u = c.c + c.h + c.i + c.b;
  let m = '';
  for (let i = 0; i < d.length; i++) {
    m += u.charAt(i - (STATIC_SECRET.indexOf(d.charAt(i)) - 31));
  }

  r = ['f', 'h', 'c', 'b', 'i'];
  for (let i = 0; i < m.length; i++) {
    if (i % 8 === 0) c[r[Math.floor(i / 8) + 1]] = '';
    c[r[Math.floor(i / 8) + 1]] += m.charAt(i);
  }
  c[r[0]] = '';

  return {
    _s: c.e,
    _t: c.h + c.c,
    buildKey: (xs) => c.b + c.i + c.e + (xs || '')
  };
}

function parseVideaXmlToStreams(xmlStr, sourceLabel = 'Videa.hu', customTitle = '') {
  if (!xmlStr || !xmlStr.includes('<video_source')) return { duration: 0, videoTitle: '', streams: [] };

  const titleMatch = xmlStr.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || xmlStr.match(/<title>([^<]+)<\/title>/i);
  const durationMatch = xmlStr.match(/<duration>(\d+)<\/duration>/i);
  const videoTitle = customTitle || (titleMatch ? titleMatch[1].trim() : sourceLabel);
  const duration = durationMatch ? parseInt(durationMatch[1], 10) : 0;

  const streams = [];
  const sourceRegex = /<video_source\s+([^>]+)>([^<]+)<\/video_source>/g;
  let match;
  while ((match = sourceRegex.exec(xmlStr)) !== null) {
    const attrs = match[1];
    let url = match[2].trim();
    if (url.startsWith('//')) url = 'https:' + url;

    const nameMatch = attrs.match(/name="([^"]+)"/);
    const heightMatch = attrs.match(/height="([^"]+)"/);
    const expMatch = attrs.match(/exp="([^"]+)"/);

    const name = nameMatch ? nameMatch[1] : 'unknown';
    const height = heightMatch ? parseInt(heightMatch[1], 10) : (name.includes('1080') ? 1080 : name.includes('720') ? 720 : 480);
    const exp = expMatch ? expMatch[1] : '';

    const hashMatch = xmlStr.match(new RegExp(`<hash_value_${name}>([^<]+)<\\/hash_value_${name}>`));
    if (hashMatch && exp) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}md5=${hashMatch[1]}&expires=${exp}`;
    }

    const resBadge = height >= 1080 ? '1080p' : height >= 720 ? '720p' : `${height}p`;
    const mins = duration ? ` • ${Math.round(duration / 60)} perc` : '';
    streams.push({
      name: `🇭🇺 ${sourceLabel}\n${resBadge}`,
      title: `🎬 ${videoTitle}\n📺 ${resBadge} MP4${mins} • 🔊 Magyar • 🌐 ${sourceLabel}`,
      url,
      quality: height,
      duration,
      videoTitle,
      headers: {
        Referer: 'https://videa.hu/',
        Origin: 'https://videa.hu',
        'User-Agent': UA
      }
    });
  }

  streams.sort((a, b) => b.quality - a.quality);
  return { duration, videoTitle, streams };
}

async function fetchAndDecryptVideaQuery(queryParam, baseDomain = 'https://videa.hu') {
  const playerUrl = `${baseDomain}/player?${queryParam}`;
  const resp = await fetch(playerUrl, {
    headers: { 'User-Agent': UA, Referer: `${baseDomain}/` },
    signal: AbortSignal.timeout(6000)
  });
  if (!resp.ok) return null;

  const html = await resp.text();
  const nonceMatch = html.match(/_xt\s*=\s*"([^"]+)"/);
  if (!nonceMatch) return null;

  const { _s, _t, buildKey } = computeVideaParams(nonceMatch[1]);
  const xmlUrl = `${baseDomain}/player/xml?${queryParam}&_s=${encodeURIComponent(_s)}&_t=${encodeURIComponent(_t)}`;
  const xmlResp = await fetch(xmlUrl, {
    headers: { 'User-Agent': UA, Referer: playerUrl },
    signal: AbortSignal.timeout(6000)
  });
  if (!xmlResp.ok) return null;

  const xs = xmlResp.headers.get('x-videa-xs') || '';
  const raw = await xmlResp.text();
  if (raw.startsWith('<?xml')) return raw;

  const key = buildKey(xs);
  return rc4Decrypt(Buffer.from(raw, 'base64'), key);
}

async function extractVideaStreams(vcodeOrUrl, sourceLabel = 'Videa.hu', customTitle = '') {
  try {
    const input = String(vcodeOrUrl || '').trim();
    const baseDomain = input.includes('videakid.hu') ? 'https://videakid.hu' : 'https://videa.hu';

    const fParamMatch = input.match(/[?&]f=([a-zA-Z0-9._-]+)/);
    if (fParamMatch) {
      const xml = await fetchAndDecryptVideaQuery(`f=${encodeURIComponent(fParamMatch[1])}&s=%7B%22loc%22%3A1%7D`, baseDomain);
      return parseVideaXmlToStreams(xml, sourceLabel, customTitle).streams;
    }

    let vcode = input;
    if (input.startsWith('http')) {
      const vMatch = input.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      const slugMatch = input.match(/-([a-zA-Z0-9]{16})(?:[/?#]|$)/);
      if (vMatch) vcode = vMatch[1];
      else if (slugMatch) vcode = slugMatch[1];
    }

    let xml = await fetchAndDecryptVideaQuery(`v=${encodeURIComponent(vcode)}`, baseDomain);

    if (xml && xml.includes('panelstyle="noembed"')) {
      const pageUrlMatch = xml.match(/<error[^>]*>(https?:\/\/[^<]+)<\/error>/);
      const pageTarget = pageUrlMatch ? pageUrlMatch[1] : (input.startsWith('http') ? input : null);
      if (pageTarget) {
        const pageRes = await fetch(pageTarget, {
          headers: { 'User-Agent': UA, Referer: `${baseDomain}/` },
          signal: AbortSignal.timeout(5000)
        });
        if (pageRes.ok) {
          const pageHtml = await pageRes.text();
          const fMatch = pageHtml.match(/\/player\?f=([a-zA-Z0-9_.]+)/);
          if (fMatch) {
            xml = await fetchAndDecryptVideaQuery(`f=${encodeURIComponent(fMatch[1])}&s=%7B%22loc%22%3A1%7D`, baseDomain);
          }
        }
      }
    }

    return parseVideaXmlToStreams(xml, sourceLabel, customTitle).streams;
  } catch {
    return [];
  }
}

async function extractIndavideoStreams(urlOrHash, sourceLabel = 'Indavideo.hu', customTitle = '') {
  const streams = [];
  const input = String(urlOrHash || '').trim();
  if (!input) return streams;

  try {
    let embHash = null;
    const directHash = input.match(/embed\.indavideo\.hu\/player\/video\/([a-fA-F0-9]{8,16})/i);
    if (directHash) {
      embHash = directHash[1];
    } else if (/^[a-fA-F0-9]{10,12}$/.test(input)) {
      embHash = input;
    } else {
      const pageUrl = input.startsWith('http') ? input : `https://indavideo.hu/video/${input}`;
      const pageRes = await fetch(pageUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://indavideo.hu/' },
        signal: AbortSignal.timeout(5000)
      });
      if (pageRes.ok) {
        const pHtml = await pageRes.text();
        const hm =
          pHtml.match(/id=['"]emb_hash['"][^>]+value=['"]([^'"]+)['"]/i) ||
          pHtml.match(/value=['"]([^'"]+)['"][^>]+id=['"]emb_hash['"]/i) ||
          pHtml.match(/embed\.indavideo\.hu\/player\/video\/([a-zA-Z0-9]+)/i);
        if (hm) embHash = hm[1];
      }
    }

    if (!embHash) return streams;

    const rnd = Math.floor(Math.random() * 2147483647);
    const dataUrl = `https://amfphp.indavideo.hu/SYm0json.php/player.playerHandler.getVideoData/${embHash}/12/?callback=json&_=${rnd}`;
    const res = await fetch(dataUrl, {
      headers: { 'User-Agent': UA, Referer: 'https://embed.indavideo.hu/' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return streams;

    let text = await res.text();
    if (text.startsWith('json(')) text = text.slice(5, text.lastIndexOf(')'));
    const data = JSON.parse(text)?.data;
    if (!data) return streams;

    const title = customTitle || data.title || sourceLabel;
    const filesh = data.filesh || {};
    const videoFiles = Array.isArray(data.video_files)
      ? [...data.video_files]
      : data.video_files && typeof data.video_files === 'object'
        ? Object.values(data.video_files)
        : [];
    if (data.video_file && !videoFiles.includes(data.video_file)) videoFiles.push(data.video_file);

    const seenHeights = new Set();
    for (const vUrl of videoFiles) {
      if (!vUrl || typeof vUrl !== 'string') continue;
      const hm = vUrl.match(/\.(\d{3,4})\.mp4/);
      const height = hm ? parseInt(hm[1], 10) : 360;
      if (seenHeights.has(height)) continue;
      seenHeights.add(height);

      const token = filesh[String(height)] || filesh[height] || Object.values(filesh)[0] || '';
      let finalUrl = vUrl.startsWith('//') ? 'https:' + vUrl : vUrl;
      finalUrl = finalUrl.replace('??', '?');
      if (token) finalUrl += (finalUrl.includes('?') ? '&' : '?') + `token=${token}`;

      const resBadge = height >= 1080 ? '1080p' : height >= 720 ? '720p' : `${height}p`;
      streams.push({
        name: `🇭🇺 ${sourceLabel}\n${resBadge}`,
        title: `🎬 ${title}\n📺 ${resBadge} MP4 • 🔊 Magyar • 🌐 ${sourceLabel}`,
        url: finalUrl,
        quality: height,
        headers: {
          Referer: 'https://indavideo.hu/',
          Origin: 'https://indavideo.hu',
          'User-Agent': UA
        }
      });
    }

    streams.sort((a, b) => b.quality - a.quality);
  } catch {}
  return streams;
}

module.exports = {
  extractVideaStreams,
  extractIndavideoStreams
};
