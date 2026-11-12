const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const { unpackPacker, decodeVoePayload, resolveRpmStream } = require('./crypto_decoders');
const { extractVideaStreams, extractIndavideoStreams } = require('./videa_indavideo');

/**
 * Universal Direct HTTP Stream Unpacker for Hungarian Aggregators
 * Converts embed links (VOE, Filemoon, Streamwish, Vidmoly, OK.ru, Mixdrop, DoodStream, Videa, Indavideo, RPM)
 * into direct `.m3u8` / `.mp4` streams with required Referer/Origin headers.
 */

async function extractVidmoly(embedUrl, sourceLabel = 'Vidmoly', customTitle = '', clientIp = null) {
  const streams = [];
  try {
    let url = embedUrl;
    const wMatch = url.match(/\/w\/([a-zA-Z0-9]+)/);
    if (wMatch) {
      url = `https://vidmoly.biz/embed-${wMatch[1]}.html`;
    } else if (url.includes('/embed-')) {
      url = url.replace(/https?:\/\/[^/]+/, 'https://vidmoly.biz');
    }
    const huIp = clientIp || '185.112.156.1';
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://vidmoly.biz/',
        'X-Forwarded-For': huIp,
        'Client-IP': huIp,
        'X-Real-IP': huIp
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return streams;
    const html = await res.text();

    const m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
    if (m3u8) {
      streams.push({
        name: `🇭🇺 ${sourceLabel}\nHD HLS`,
        title: `🎬 ${customTitle || sourceLabel}\n📺 HD HLS (m3u8) • 🔊 Magyar • 🌐 Vidmoly Direct`,
        url: m3u8[1],
        quality: 1080,
        isHls: true,
        headers: {
          Referer: 'https://vidmoly.biz/',
          Origin: 'https://vidmoly.biz',
          'User-Agent': UA
        }
      });
    }
  } catch (e) {}
  return streams;
}

async function extractVoe(embedUrl, sourceLabel = 'VOE', customTitle = '', clientIp = null) {
  const streams = [];
  try {
    const huIp = clientIp || '185.112.156.1';
    let currentUrl = embedUrl;
    let html = await fetch(currentUrl, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://voe.sx/',
        'X-Forwarded-For': huIp,
        'Client-IP': huIp,
        'X-Real-IP': huIp
      },
      signal: AbortSignal.timeout(6000)
    }).then((r) => r.text());

    // Follow JS window.location.href redirect used by VOE mirror domains
    const jsRedirect = html.match(/window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/i);
    if (jsRedirect) {
      currentUrl = jsRedirect[1];
      html = await fetch(currentUrl, {
        headers: {
          'User-Agent': UA,
          Referer: embedUrl,
          'X-Forwarded-For': huIp,
          'Client-IP': huIp,
          'X-Real-IP': huIp
        },
        signal: AbortSignal.timeout(6000)
      }).then((r) => r.text());
    }

    const origin = new URL(currentUrl).origin;
    const headers = { Referer: `${origin}/`, Origin: origin, 'User-Agent': UA };

    // 1. New 5-step JSON payload inside <script type="application/json">["..."]</script>
    const jsonScriptMatch = html.match(/<script type="application\/json">\["([^"]+)"\]<\/script>/i);
    if (jsonScriptMatch) {
      const data = decodeVoePayload(jsonScriptMatch[1]);
      if (data) {
        if (data.source && data.source.startsWith('http')) {
          streams.push({
            name: `🇭🇺 ${sourceLabel}\nHD HLS`,
            title: `🎬 ${customTitle || sourceLabel}\n📺 HD HLS (m3u8) • 🔊 Magyar • 🌐 VOE Direct`,
            url: data.source,
            quality: 1080,
            isHls: true,
            headers
          });
        }
        if (data.direct_access_url && data.direct_access_url.startsWith('http')) {
          streams.push({
            name: `🇭🇺 ${sourceLabel}\nMP4`,
            title: `🎬 ${customTitle || sourceLabel}\n📺 Direct MP4 • 🔊 Magyar • 🌐 VOE Direct`,
            url: data.direct_access_url,
            quality: 720,
            headers
          });
        }
      }
    }

    // 2. Classic hls / mp4 variable fallback
    if (streams.length === 0) {
      const hlsMatch = html.match(/['"]hls['"]\s*:\s*['"]([^'"]+)['"]/i);
      if (hlsMatch) {
        let u = hlsMatch[1];
        if (!u.startsWith('http')) {
          try { u = Buffer.from(u, 'base64').toString('utf8'); } catch {}
        }
        if (u.startsWith('http')) {
          streams.push({
            name: `🇭🇺 ${sourceLabel}\nHD HLS`,
            title: `🎬 ${customTitle || sourceLabel}\n📺 HD HLS • 🔊 Magyar • 🌐 VOE Direct`,
            url: u,
            quality: 1080,
            isHls: true,
            headers
          });
        }
      }
    }
  } catch {}
  return streams;
}

async function extractPackerHoster(embedUrl, sourceLabel = 'Stream', customTitle = '', hostName = 'Hoster') {
  const streams = [];
  try {
    const r = await fetch(embedUrl, {
      headers: { 'User-Agent': UA, Referer: embedUrl },
      signal: AbortSignal.timeout(6000)
    });
    if (!r.ok) return streams;
    const html = await r.text();
    const unpacked = unpackPacker(html) || html;
    const origin = new URL(r.url || embedUrl).origin;
    const headers = { Referer: `${origin}/`, Origin: origin, 'User-Agent': UA };

    const m3u8Matches = [...unpacked.matchAll(/(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/gi)];
    const seen = new Set();
    for (const m of m3u8Matches) {
      const u = m[1].replace(/\\+/g, '');
      if (seen.has(u)) continue;
      seen.add(u);
      streams.push({
        name: `🇭🇺 ${sourceLabel}\n1080p`,
        title: `🎬 ${customTitle || sourceLabel}\n📺 HD HLS • 🔊 Magyar • 🌐 ${hostName}`,
        url: u,
        quality: 1080,
        isHls: true,
        headers
      });
    }

    if (streams.length === 0) {
      const mp4Matches = [...unpacked.matchAll(/(https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*)/gi)];
      for (const m of mp4Matches) {
        const u = m[1].replace(/\\+/g, '');
        if (seen.has(u) || u.includes('Big_Buck_Bunny')) continue;
        seen.add(u);
        streams.push({
          name: `🇭🇺 ${sourceLabel}\n720p`,
          title: `🎬 ${customTitle || sourceLabel}\n📺 Direct MP4 • 🔊 Magyar • 🌐 ${hostName}`,
          url: u,
          quality: 720,
          headers
        });
      }
    }
  } catch {}
  return streams;
}

async function extractOkRu(embedUrl, sourceLabel = 'OK.ru', customTitle = '') {
  const streams = [];
  try {
    const url = embedUrl.startsWith('//') ? 'https:' + embedUrl : embedUrl;
    const html = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://ok.ru/' },
      signal: AbortSignal.timeout(6000)
    }).then((r) => r.text());

    const optsMatch = html.match(/data-options="([^"]+)"/i);
    if (!optsMatch) return streams;

    const decodedOpts = optsMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'");
    const opts = JSON.parse(decodedOpts);
    const meta = opts?.flashvars?.metadata ? JSON.parse(opts.flashvars.metadata) : null;
    if (!meta) return streams;

    const headers = { Referer: 'https://ok.ru/', Origin: 'https://ok.ru', 'User-Agent': UA };
    const qMap = { ultra: 2160, quad: 1440, full: 1080, hd: 720, sd: 480, low: 360, lowest: 240 };

    if (Array.isArray(meta.videos)) {
      for (const v of meta.videos) {
        if (!v.url) continue;
        const height = qMap[v.name] || 480;
        streams.push({
          name: `🇭🇺 ${sourceLabel}\n${height}p`,
          title: `🎬 ${customTitle || meta.movie?.title || sourceLabel}\n📺 ${height}p MP4 • 🔊 Magyar • 🌐 OK.ru Direct`,
          url: v.url,
          quality: height,
          headers
        });
      }
    } else if (meta.hlsManifestUrl) {
      streams.push({
        name: `🇭🇺 ${sourceLabel}\nHD HLS`,
        title: `🎬 ${customTitle || meta.movie?.title || sourceLabel}\n📺 HD HLS • 🔊 Magyar • 🌐 OK.ru Direct`,
        url: meta.hlsManifestUrl,
        quality: 1080,
        isHls: true,
        headers
      });
    }
    streams.sort((a, b) => b.quality - a.quality);
  } catch {}
  return streams;
}

/**
 * Main dispatcher: Given any embed URL found on a Hungarian streaming site,
 * attempts to resolve direct HTTP streams (`.m3u8` / `.mp4`).
 */
async function resolveAnyEmbed(rawUrl, sourceLabel = 'Magyar', customTitle = '', clientIp = null) {
  if (!rawUrl || typeof rawUrl !== 'string') return [];
  let url = rawUrl.trim();
  if (url.startsWith('//')) url = 'https:' + url;
  if (!url.startsWith('http')) return [];

  const lower = url.toLowerCase();

  if (lower.includes('videa.hu') || lower.includes('videakid.hu')) {
    return extractVideaStreams(url, sourceLabel, customTitle);
  }
  if (lower.includes('indavideo.hu')) {
    return extractIndavideoStreams(url, sourceLabel, customTitle);
  }
  if (lower.includes('rpmstream') || lower.includes('rpmvid') || lower.includes('rpmhub') || lower.includes('rpmshare')) {
    const rpm = await resolveRpmStream(url);
    if (rpm) {
      return [{
        name: `🇭🇺 ${sourceLabel}\n1080p`,
        title: `🎬 ${customTitle || rpm.title || sourceLabel}\n📺 1080p HLS • 🔊 Magyar • 🌐 RPM Direct`,
        url: rpm.url,
        quality: 1080,
        isHls: true,
        headers: rpm.headers
      }];
    }
    return [];
  }
  const isVoeCandidate = (
    lower.includes('voe.sx') ||
    lower.includes('voe.') ||
    lower.includes('voe-') ||
    lower.includes('shanelocaldog') ||
    lower.includes('walterprettytheir') ||
    lower.includes('yodelswart') ||
    lower.includes('launchreliant') ||
    lower.includes('diananatureforeign') ||
    lower.includes('susanexpectcare') ||
    lower.includes('jilliandeborah') ||
    lower.includes('reputationsicklyheavily') ||
    lower.includes('tupacpreston') ||
    lower.includes('cloudwindow') ||
    lower.includes('ugc-cdn') ||
    lower.includes('eunice') ||
    lower.includes('generousdiscipline') ||
    lower.includes('audaciouscarpenter') ||
    lower.includes('fractional') ||
    lower.includes('timely') ||
    lower.includes('fidget') ||
    lower.includes('wolf') ||
    lower.includes('leona') ||
    lower.includes('stephanie') ||
    lower.includes('donald') ||
    lower.includes('mikayla') ||
    lower.includes('greys')
  );
  if (isVoeCandidate) {
    const voeStreams = await extractVoe(url, sourceLabel, customTitle, clientIp);
    if (voeStreams && voeStreams.length > 0) return voeStreams;
  }
  if (lower.includes('ok.ru') || lower.includes('odnoklassniki.ru')) {
    return extractOkRu(url, sourceLabel, customTitle);
  }
  if (lower.includes('vidmoly')) {
    const vidmolyStreams = await extractVidmoly(url, sourceLabel, customTitle, clientIp);
    if (vidmolyStreams.length > 0) return vidmolyStreams;
  }
  if (
    lower.includes('filemoon') ||
    lower.includes('kerapoxy') ||
    lower.includes('streamwish') ||
    lower.includes('wishembed') ||
    lower.includes('vidoza') ||
    lower.includes('speedfiles') ||
    lower.includes('luluvdo') ||
    lower.includes('Goodstream'.toLowerCase()) ||
    lower.includes('supervideo')
  ) {
    const hostDomain = new URL(url).hostname.replace(/^www\./, '');
    return extractPackerHoster(url, sourceLabel, customTitle, hostDomain);
  }

  // Direct .m3u8 or .mp4 URL
  if (/\.m3u8(\?|$)/i.test(lower)) {
    const origin = new URL(url).origin;
    return [{
      name: `🇭🇺 ${sourceLabel}\nHD HLS`,
      title: `🎬 ${customTitle || sourceLabel}\n📺 HLS Stream • 🔊 Magyar`,
      url,
      quality: 1080,
      isHls: true,
      headers: { Referer: `${origin}/`, Origin: origin, 'User-Agent': UA }
    }];
  }
  if (/\.mp4(\?|$)/i.test(lower)) {
    const origin = new URL(url).origin;
    return [{
      name: `🇭🇺 ${sourceLabel}\nHD MP4`,
      title: `🎬 ${customTitle || sourceLabel}\n📺 Direct MP4 • 🔊 Magyar`,
      url,
      quality: 720,
      headers: { Referer: `${origin}/`, Origin: origin, 'User-Agent': UA }
    }];
  }

  // Smart fallback: check if unknown URL might be an unlisted VOE mirror
  if (/^https?:\/\/[^/]+\/(?:[a-zA-Z0-9]{8,20}|e\/[a-zA-Z0-9]+|d\/[a-zA-Z0-9]+)\/?$/.test(url)) {
    try {
      const voeFallback = await extractVoe(url, sourceLabel, customTitle, clientIp);
      if (voeFallback && voeFallback.length > 0) return voeFallback;
    } catch (e) {}
  }

  return [];
}

module.exports = {
  extractVidmoly,
  extractVoe,
  extractPackerHoster,
  extractOkRu,
  resolveAnyEmbed
};
