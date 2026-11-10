const fetch = globalThis.fetch;

// Fast in-memory cache for resolved stream URLs (TTL: 2 minutes)
const STREAM_CACHE = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

function parseHlsVariants(m3u8Content, masterUrl) {
  const lines = m3u8Content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const variants = [];
  let currentInfo = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
      const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
      const width = resMatch ? parseInt(resMatch[1], 10) : 0;
      const height = resMatch ? parseInt(resMatch[2], 10) : 0;
      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      currentInfo = { width, height, bandwidth };
    } else if (currentInfo && !line.startsWith('#')) {
      try {
        const fullUrl = new URL(line, masterUrl).toString();
        variants.push({
          url: fullUrl,
          width: currentInfo.width,
          height: currentInfo.height,
          bandwidth: currentInfo.bandwidth,
          quality: currentInfo.height ? `${currentInfo.height}p` : `${Math.round(currentInfo.bandwidth / 1000)}k`
        });
      } catch (e) {}
      currentInfo = null;
    }
  }

  variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));
  return variants;
}

async function resolveServerStream(serverConfig) {
  const cacheKey = serverConfig.direct_stream_url || serverConfig.player_url;
  const cached = STREAM_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  let masterUrl = serverConfig.direct_stream_url;

  // 1. If ConnectMedia or player_url / online_url is present, resolve fresh token
  const pageUrl = serverConfig.online_url || serverConfig.player_url;
  if (pageUrl && (!masterUrl || masterUrl.includes('connectmedia.hu'))) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://onlinestream.live/'
        },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const html = await res.text();
        const m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
        if (m) {
          masterUrl = m[0];
        }
      }
    } catch (e) {}
  }

  if (!masterUrl) return null;

  // 2. Fetch master m3u8 and parse variants
  try {
    const res = await fetch(masterUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://onlinestream.live/'
      },
      signal: AbortSignal.timeout(3500)
    });

    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('#EXTM3U')) return null;

    const variants = parseHlsVariants(text, masterUrl);
    const topVariant = variants.length > 0 ? variants[0] : null;

    const data = {
      masterUrl,
      topVariantUrl: topVariant ? topVariant.url : masterUrl,
      quality: topVariant ? topVariant.quality : 'HD',
      height: topVariant ? topVariant.height : 1080
    };

    STREAM_CACHE.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    return null;
  }
}

async function test() {
  console.log('Testing stream resolution...\n');
  const testServers = [
    { name: 'Nat Geo', direct_stream_url: 'https://gradetv.net:443/api/s/NationalGeographic.hu:SD:9787.m3u8?via=grade' },
    { name: 'Film+', direct_stream_url: 'http://141.94.193.53:80/Film+_HD/index.m3u8' },
    { name: 'RTL', direct_stream_url: 'http://141.94.193.53:80/RTL_HD/index.m3u8' },
    { name: 'Sopron TV', online_url: 'https://onlinestream.live/sopron-tv/online/5982-1', player_url: 'https://onlinestream.live/sopron-tv/videoplayer/5982-1' },
    { name: 'Fehérvár TV', direct_stream_url: 'https://cloudfront44.lexanetwork.com:1344/relay44_1/HDE046.sdp/playlist.m3u8' }
  ];

  const t0 = Date.now();
  const results = await Promise.all(testServers.map(s => resolveServerStream(s)));
  console.log(`Resolved ${results.filter(Boolean).length} / ${testServers.length} in ${Date.now() - t0}ms\n`);

  testServers.forEach((s, idx) => {
    const res = results[idx];
    if (res) {
      console.log(`✅ ${s.name}:`);
      console.log(`   - 1080p / Top: ${res.topVariantUrl} (${res.quality})`);
      console.log(`   - Auto / Master: ${res.masterUrl}`);
    } else {
      console.log(`❌ ${s.name}: Failed to resolve`);
    }
  });
}

test();
