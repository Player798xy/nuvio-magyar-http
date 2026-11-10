const fetch = globalThis.fetch;

async function testHttpEndpoints() {
  console.log('=== TESTING RUNNING SERVER ON http://localhost:7000 ===\n');

  // 1. Manifest
  const resMan = await fetch('http://localhost:7000/manifest.json');
  const man = await resMan.json();
  console.log(`1. Manifest: ${man.name} v${man.version} (${man.catalogs.length} catalogs)`);
  if (man.catalogs.length !== 17) throw new Error(`Expected 17 catalogs, got ${man.catalogs.length}`);

  // 2. Catalogs
  const catTests = [
    { id: 'hu-live-orszagos', count: 28 },
    { id: 'hu-live-film', count: 21 },
    { id: 'hu-live-doksi', count: 6 },
    { id: 'hu-live-sport', count: 19 },
    { id: 'hu-live-gyerek', count: 8 },
    { id: 'hu-live-helyi', count: 64 }
  ];

  console.log('\n2. Testing Catalogs via HTTP:');
  for (const c of catTests) {
    const r = await fetch(`http://localhost:7000/catalog/movie/${c.id}.json`);
    const data = await r.json();
    const count = data.metas ? data.metas.length : 0;
    console.log(`   - ${c.id}: ${count} channels (expected: ${c.count})`);
    if (count !== c.count) throw new Error(`${c.id} count mismatch: ${count} vs ${c.count}`);
    const first = data.metas[0];
    console.log(`     Sample #1: ${first.name} | Poster: ${first.poster}`);
    if (!first.poster.endsWith('.png')) {
      throw new Error(`Expected poster to end with .png, got ${first.poster}`);
    }
  }

  // 3. Real PNG Image Endpoints
  console.log('\n3. Testing Real PNG TV Artwork Endpoints:');
  const pngTests = [
    'http://localhost:7000/tv-posters/6141.png',
    'http://localhost:7000/tv-posters/5936.png',
    'http://localhost:7000/tv-posters/6150.png',
    'http://localhost:7000/tv-posters/7079.png',
    'http://localhost:7000/tv-backgrounds/6141.png',
    'http://localhost:7000/tv-logos/6141.png',
    'http://localhost:7000/tv-poster/6141.png',
    'http://localhost:7000/tv-background/6141.png'
  ];

  for (const url of pngTests) {
    const r = await fetch(url);
    const ct = r.headers.get('content-type');
    const buf = await r.arrayBuffer();
    const isPng = ct.includes('image/png') && buf.byteLength > 500;
    console.log(`   - ${url.split('/').slice(-2).join('/')}: Status ${r.status} | Content-Type: ${ct} | Size: ${buf.byteLength} B | Valid PNG: ${isPng}`);
    if (r.status !== 200 || !isPng) throw new Error(`PNG endpoint test failed for ${url}`);
  }

  // 4. Stream Resolution & Ordering
  console.log('\n4. Testing Stream Endpoints & Ordering (m3u8 FIRST):');
  const streamTests = [
    { name: 'RTL', id: 'onlinestream-live-6141' },
    { name: 'Film+', id: 'onlinestream-live-6150' },
    { name: 'Nat Geo', id: 'onlinestream-live-5936' },
    { name: 'M4 Sport', id: 'mediaklikk-live-m4' },
    { name: 'Sopron TV', id: 'onlinestream-live-5982' }
  ];

  for (const t of streamTests) {
    const t0 = Date.now();
    const r = await fetch(`http://localhost:7000/stream/movie/${t.id}.json`);
    const data = await r.json();
    const streams = data.streams || [];
    console.log(`   - ${t.name} (${t.id}): ${streams.length} streams in ${Date.now() - t0}ms`);
    if (streams.length === 0) throw new Error(`No streams for ${t.name}`);

    // Verify Stremio Serde compliance
    for (const s of streams) {
      if ('description' in s) throw new Error(`Stremio Rust Serde violation: stream contains 'description' field`);
    }

    // Verify that Stream 1 is DIRECT .m3u8
    const s1 = streams[0];
    console.log(`     Stream 1: ${s1.name}`);
    console.log(`     URL: ${s1.url?.slice(0, 75)}...`);
    if (!s1.name.includes('.m3u8')) {
      throw new Error(`Expected stream 1 to have (.m3u8) in name, got: ${s1.name}`);
    }
    if (s1.name.includes('Proxy')) {
      throw new Error(`Expected stream 1 to be direct stream, NOT proxy!`);
    }

    if (streams[1]) {
      console.log(`     Stream 2: ${streams[1].name}`);
    }
  }

  // 5. Test HLS Proxy endpoint
  console.log('\n5. Testing HLS Proxy via HTTP:');
  const proxyTestUrl = 'http://localhost:7000/proxy/hls.m3u8?url=' + encodeURIComponent('https://gradetv.net:443/api/s/NationalGeographic.hu:SD:9787.m3u8?via=grade');
  const proxyRes = await fetch(proxyTestUrl);
  const proxyText = await proxyRes.text();
  console.log(`   - Proxy status: ${proxyRes.status} | Has #EXTM3U: ${proxyText.includes('#EXTM3U')}`);
  if (proxyRes.status !== 200 || !proxyText.includes('#EXTM3U')) {
    throw new Error('HLS Proxy returned non-200 or invalid m3u8');
  }

  console.log('\n🎉 ALL HTTP ENDPOINTS TESTED AND VERIFIED 100% OPERATIONAL!');
}

testHttpEndpoints().catch(err => {
  console.error('\n❌ HTTP Test failed:', err);
  process.exit(1);
});
