const fetch = globalThis.fetch;

function parseHlsMasterPlaylist(m3u8Content, masterUrl) {
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
      currentInfo = { width, height, bandwidth, raw: line };
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

  // Sort descending by height, then bandwidth
  variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));
  return variants;
}

async function run() {
  const testUrls = [
    'http://141.94.193.53:80/RTL_HD/index.m3u8',
    'http://141.94.193.53:80/Film+_HD/index.m3u8',
    'https://gradetv.net:443/api/s/NationalGeographic.hu:SD:9787.m3u8?via=grade',
    'https://cloudfront44.lexanetwork.com:1344/relay44_1/HDE046.sdp/playlist.m3u8'
  ];

  for (const u of testUrls) {
    console.log('\n=== Testing:', u);
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) });
      const text = await res.text();
      const variants = parseHlsMasterPlaylist(text, u);
      console.log('Variants found:', variants.length);
      if (variants.length > 0) {
        console.log('Top (1080p/Best):', variants[0]);
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

run();
