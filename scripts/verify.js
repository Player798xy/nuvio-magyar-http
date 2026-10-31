const http = require('node:http');
const app = require('../server');

async function runVerification() {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log(`🚀 Test server listening on ${base}\n`);

  try {
    // 1. Manifest
    const manifest = await fetch(`${base}/manifest.json`).then((r) => r.json());
    console.log(`✅ 1. Manifest loaded: ${manifest.name} v${manifest.version} (${manifest.catalogs.length} catalogs)`);

    // 2. Catalog
    const liveCat = await fetch(`${base}/catalog/movie/hu-live-tv.json`).then((r) => r.json());
    console.log(`✅ 2. Live TV Catalog: ${liveCat.metas?.length} channels`);

    const trendCat = await fetch(`${base}/catalog/movie/hu-trending-movies.json`).then((r) => r.json());
    console.log(`✅ 3. Trending Movies Catalog: ${trendCat.metas?.length} movies (sample: ${trendCat.metas?.[0]?.name})`);

    // 3. Live TV Stream + Built-in HLS Proxy
    const liveStreamRes = await fetch(`${base}/stream/movie/mediaklikk-live-m4.json`).then((r) => r.json());
    console.log(`✅ 4. M4 Sport Live Streams: ${liveStreamRes.streams?.length}`);
    if (liveStreamRes.streams?.[0]) {
      console.log(`   -> Direct HLS Stream URL: ${liveStreamRes.streams[0].url.slice(0, 100)}...`);
    }

    // 3b. Test Built-in HTTP/HLS Proxy endpoint
    const proxyCheck = await fetch(`${base}/api/hls/master.m3u8?url=${encodeURIComponent('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')}`);
    const proxyText = await proxyCheck.text();
    console.log(`✅ 4b. Built-in Vercel HLS Proxy & 1080p Variant Sorter: status=${proxyCheck.status}, validM3u8=${proxyText.startsWith('#EXTM3U')}`);

    // 4. Movie Streams (Macskafogó tt0179955)
    console.log('\n⏳ 5. Testing Movie Streams for Macskafogó (tt0179955)...');
    const movieRes = await fetch(`${base}/stream/movie/tt0179955.json`).then((r) => r.json());
    console.log(`✅ Macskafogó total streams resolved: ${movieRes.streams?.length}`);
    for (const s of (movieRes.streams || []).slice(0, 6)) {
      console.log(`   - [${s.name.replace(/\n/g, ' ')}] -> ${s.url.slice(0, 85)}...`);
    }

    // 5. Series Streams (Alexander: The Making of a God tt31091099:1:1 or Magyar népmesék tt0861751:1:1)
    console.log('\n⏳ 6. Testing Series Streams for Magyar népmesék (tt0861751:1:1)...');
    const seriesRes = await fetch(`${base}/stream/series/tt0861751:1:1.json`).then((r) => r.json());
    console.log(`✅ Magyar népmesék S01E01 total streams resolved: ${seriesRes.streams?.length}`);
    for (const s of (seriesRes.streams || []).slice(0, 5)) {
      console.log(`   - [${s.name.replace(/\n/g, ' ')}] -> ${s.url.slice(0, 85)}...`);
    }
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
