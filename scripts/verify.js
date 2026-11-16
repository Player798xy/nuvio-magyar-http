const http = require('node:http');
const app = require('../server');

async function runVerification() {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log(`🚀 Test server listening on ${base}\n`);

  let hasError = false;
  const fail = (msg) => {
    hasError = true;
    console.error(`❌ ${msg}`);
  };

  try {
    // 1. Manifest + Resources
    const manifest = await fetch(`${base}/manifest.json`).then((r) => r.json());
    const metaRes = (manifest.resources || []).find((r) => r.name === 'meta');
    const subRes = (manifest.resources || []).find((r) => r.name === 'subtitles');
    console.log(`✅ 1. Manifest: ${manifest.name} v${manifest.version} (${manifest.catalogs.length} catalogs)`);
    if (!metaRes?.idPrefixes?.includes('tt')) fail('Manifest meta resource is missing "tt" idPrefix');
    if (!subRes) fail('Manifest is missing "subtitles" resource');

    // 2. Live TV Catalog (All dead channels should be filtered out, sample >= 150)
    const liveCat = await fetch(`${base}/catalog/movie/hu-live-tv.json`).then((r) => r.json());
    console.log(`✅ 2. Live TV Catalog: ${liveCat.metas?.length} channels`);
    if (!liveCat.metas || liveCat.metas.length < 150) fail('Live TV catalog count unexpectedly low');
    if (liveCat.metas.some((m) => m.id === 'onlinestream-live-5982' || m.id === 'onlinestream-live-9848')) {
      fail('Known dead TV channels still present in Live TV catalog');
    }

    // 3. Trending Movies Catalog & Meta
    const trendCat = await fetch(`${base}/catalog/movie/hu-trending-movies.json`).then((r) => r.json());
    const sampleMovie = trendCat.metas?.[0];
    console.log(`✅ 3. Trending Movies Catalog: ${trendCat.metas?.length} movies (sample: ${sampleMovie?.name})`);
    if (sampleMovie) {
      const metaCheck = await fetch(`${base}/meta/${sampleMovie.type}/${encodeURIComponent(sampleMovie.id)}.json`).then((r) => r.json());
      if (!metaCheck?.meta?.name) fail(`Meta lookup failed for ${sampleMovie.id}`);
      else console.log(`   -> Meta OK: ${metaCheck.meta.name} (${metaCheck.meta.id})`);
    }

    // 4. Live TV Meta + Stream + EPG Check (RTL or M4 Sport)
    const liveMetaRes = await fetch(`${base}/meta/movie/onlinestream-live-5903.json`).then((r) => r.json());
    const liveStreamRes = await fetch(`${base}/stream/movie/onlinestream-live-5903.json`);
    const liveStreamCache = liveStreamRes.headers.get('cache-control') || '';
    const liveStreamJson = await liveStreamRes.json();
    console.log(`✅ 4. M4 Sport Live Streams: ${liveStreamJson.streams?.length} (Cache-Control: ${liveStreamCache})`);
    if (!liveStreamJson.streams?.length) fail('M4 Sport returned 0 live streams');
    if (liveMetaRes?.meta?.description) {
      console.log(`   -> Meta EPG Preview: ${liveMetaRes.meta.description.split('\n')[0]}`);
    }
    if (liveStreamJson.streams?.[0]) {
      console.log(`   -> Stream Title Preview: ${liveStreamJson.streams[0].title.split('\n')[0]}`);
    }

    // 4b. Zero-Proxy 302 Redirect Check
    const redirectCheck = await fetch(`${base}/proxy/hls?url=${encodeURIComponent('https://example.com/test.m3u8')}`, { redirect: 'manual' });
    console.log(`✅ 4b. Zero-Proxy 302 Redirect: status=${redirectCheck.status} -> ${redirectCheck.headers.get('location')}`);
    if (redirectCheck.status !== 302) fail(`Expected 302 redirect on /proxy/hls, got ${redirectCheck.status}`);

    // 5. Subtitles Endpoint Check (Hungarian only) + Subtitles Toggle Off Config
    const noSubsCfg = Buffer.from(JSON.stringify({ subtitles: false })).toString('base64url');
    const [movieSubs, seriesSubs, noSubsManifest, noSubsResult] = await Promise.all([
      fetch(`${base}/subtitles/movie/tt15239678.json`).then((r) => r.json()),
      fetch(`${base}/subtitles/series/tt1190634:1:1.json`).then((r) => r.json()),
      fetch(`${base}/${noSubsCfg}/manifest.json`).then((r) => r.json()),
      fetch(`${base}/${noSubsCfg}/subtitles/movie/tt15239678.json`).then((r) => r.json())
    ]);
    console.log(`✅ 5. Subtitles (HU): Dune=${movieSubs.subtitles?.length || 0}, The Boys S01E01=${seriesSubs.subtitles?.length || 0}`);
    const nonHun = [...(movieSubs.subtitles || []), ...(seriesSubs.subtitles || [])].find((s) => s.lang !== 'hun');
    if (nonHun) fail(`Unexpected non-Hungarian subtitle lang: ${nonHun.lang}`);
    if ((noSubsManifest.resources || []).some((r) => r.name === 'subtitles')) {
      fail('Configured manifest with subtitles=false still includes subtitles resource');
    }
    if ((noSubsResult.subtitles || []).length !== 0) {
      fail('Configured subtitles route with subtitles=false returned non-empty subtitles');
    }
    console.log(`   -> Subtitles Toggle OFF OK: manifest has no subtitles resource (${noSubsManifest.name})`);

    // 6. VOD Movie Streams (Macskafogó tt0179955 + Dűne: Második rész tt15239678)
    console.log('\n⏳ 6. Testing VOD Movie Streams (timing + sources)...');
    const tMovieStart = Date.now();
    const duneRes = await fetch(`${base}/stream/movie/tt15239678.json`);
    const duneCache = duneRes.headers.get('cache-control') || '';
    const duneJson = await duneRes.json();
    const duneMs = Date.now() - tMovieStart;
    console.log(`✅ Dune Part Two: ${duneJson.streams?.length} streams in ${duneMs}ms (Cache-Control: ${duneCache})`);
    if (!duneJson.streams?.length) fail('Dune Part Two returned 0 streams');
    for (const s of (duneJson.streams || []).slice(0, 5)) {
      console.log(`   - [${s.name.replace(/\n/g, ' ')}] -> ${(s.url || s.externalUrl || '').slice(0, 80)}...`);
    }

    // 7. Series Streams (The Boys S01E01 tt1190634:1:1 & A nagy ho-ho-ho-horgász tt0154077:1:1)
    console.log('\n⏳ 7. Testing VOD Series Streams...');
    const tSeriesStart = Date.now();
    const [boysJson, hohoJson] = await Promise.all([
      fetch(`${base}/stream/series/tt1190634:1:1.json`).then((r) => r.json()),
      fetch(`${base}/stream/series/tt0154077:1:1.json`).then((r) => r.json())
    ]);
    const seriesMs = Date.now() - tSeriesStart;
    console.log(`✅ Series in ${seriesMs}ms: The Boys S01E01=${boysJson.streams?.length || 0}, A nagy ho-ho-ho-horgász S01E01=${hohoJson.streams?.length || 0}`);
    if (!boysJson.streams?.length) fail('The Boys S01E01 returned 0 streams');
    for (const s of (boysJson.streams || []).slice(0, 4)) {
      console.log(`   - [${s.name.replace(/\n/g, ' ')}] -> ${(s.url || s.externalUrl || '').slice(0, 80)}...`);
    }

    // 8. Cache-Control (30m Edge Cache) & In-Memory VOD Cache Speedup
    if (!duneCache.includes('s-maxage=1800')) {
      fail(`Expected s-maxage=1800 on VOD streams, got "${duneCache}"`);
    }
    const tCachedStart = Date.now();
    const duneCachedJson = await fetch(`${base}/stream/movie/tt15239678.json`).then((r) => r.json());
    const cachedMs = Date.now() - tCachedStart;
    console.log(`✅ 8. VOD Edge + In-Memory Cache: s-maxage=1800 OK, second hit in ${cachedMs}ms (${duneCachedJson.streams?.length} streams)`);
    if (duneCachedJson.streams?.length !== duneJson.streams?.length || cachedMs > 250) {
      fail(`In-memory VOD cache miss or mismatch (${cachedMs}ms, ${duneCachedJson.streams?.length} vs ${duneJson.streams?.length})`);
    }

    // 9. Vercel-Only Migration Banner & QR Code Static Pages (Never shown on Render)
    const { handleStreamRequest, getRuntimeNoticeMeta } = require('../src/addon');
    const [qrJsRes, ujLinkRes, runtimeRes, previewStreamRes] = await Promise.all([
      fetch(`${base}/qr.js`),
      fetch(`${base}/uj-link`),
      fetch(`${base}/api/runtime-info`),
      fetch(`${base}/stream/movie/tt15239678.json?previewMigration=1`).then((r) => r.json())
    ]);
    if (qrJsRes.status !== 200) fail(`/qr.js returned HTTP ${qrJsRes.status}`);
    if (ujLinkRes.status !== 200) fail(`/uj-link returned HTTP ${ujLinkRes.status}`);
    const runtimeJson = await runtimeRes.json();
    if (runtimeJson.showMigrationBanner !== false && !process.env.MIGRATION_NOTICE_URL) {
      fail('Default runtime-info should keep showMigrationBanner=false until MIGRATION_NOTICE_URL is set');
    }
    if (!previewStreamRes.streams?.[0]?.name?.includes('🟨') || !previewStreamRes.streams?.[0]?.externalUrl?.includes('/uj-link.html')) {
      fail('Preview migration stream did not prepend yellow notice at index 0');
    }
    if (previewStreamRes.streams[0].description) {
      fail('Migration notice stream must not include description alongside title');
    }

    // Simulate Vercel vs Render env isolation
    const prevEnv = {
      VERCEL: process.env.VERCEL,
      RENDER: process.env.RENDER,
      MIGRATION_NOTICE_URL: process.env.MIGRATION_NOTICE_URL
    };
    try {
      delete process.env.RENDER;
      process.env.VERCEL = '1';
      process.env.MIGRATION_NOTICE_URL = 'https://nuvio-magyar-http.onrender.com';
      const vercelVod = await handleStreamRequest('movie', 'tt15239678', { hostUrl: 'https://nuvio-magyar-http.vercel.app' });
      const vercelLive = await handleStreamRequest('movie', 'onlinestream-live-5903', { hostUrl: 'https://nuvio-magyar-http.vercel.app' });
      const vercelMeta = getRuntimeNoticeMeta({ hostUrl: 'https://nuvio-magyar-http.vercel.app' });
      if (!vercelMeta.showMigrationBanner || vercelMeta.platform !== 'vercel') fail('Vercel runtime meta failed');
      if (!vercelVod.streams?.[0]?.name?.includes('🟨')) fail('Vercel VOD stream missing yellow banner at top');
      if (!vercelLive.streams?.[0]?.name?.includes('🟨')) fail('Vercel Live TV stream missing yellow banner at top');

      delete process.env.VERCEL;
      process.env.RENDER = 'true';
      const renderVod = await handleStreamRequest('movie', 'tt15239678', { hostUrl: 'https://nuvio-magyar-http.onrender.com' });
      const renderMeta = getRuntimeNoticeMeta({ hostUrl: 'https://nuvio-magyar-http.onrender.com' });
      if (renderMeta.showMigrationBanner || renderMeta.platform !== 'render') fail('Render runtime meta leaked migration banner');
      if (renderVod.streams?.[0]?.name?.includes('🟨')) fail('Render VOD stream must NOT show Vercel migration banner');
    } finally {
      if (prevEnv.VERCEL === undefined) delete process.env.VERCEL; else process.env.VERCEL = prevEnv.VERCEL;
      if (prevEnv.RENDER === undefined) delete process.env.RENDER; else process.env.RENDER = prevEnv.RENDER;
      if (prevEnv.MIGRATION_NOTICE_URL === undefined) delete process.env.MIGRATION_NOTICE_URL; else process.env.MIGRATION_NOTICE_URL = prevEnv.MIGRATION_NOTICE_URL;
    }
    console.log('✅ 9. Vercel-Only Yellow Notice, Render Isolation, /qr.js & /uj-link OK');

    // 10. SEO & Canonical Verification (Render primary vs Vercel noindex)
    const [homeHtml, robotsRenderRes, sitemapRes, vercelRobotsTest] = await Promise.all([
      fetch(`${base}/`).then((r) => r.text()),
      fetch(`${base}/robots.txt`),
      fetch(`${base}/sitemap.xml`).then((r) => r.text()),
      fetch(`${base}/`, { headers: { 'x-forwarded-host': 'nuvio-magyar-http.vercel.app' } })
    ]);
    if (!homeHtml.includes('rel="canonical" href="https://nuvio-magyar-http.onrender.com/"')) {
      fail('Homepage missing canonical link pointing to Render');
    }
    if (vercelRobotsTest.headers.get('x-robots-tag') !== 'noindex, follow') {
      fail(`Vercel forwarded host missing X-Robots-Tag noindex header, got "${vercelRobotsTest.headers.get('x-robots-tag')}"`);
    }
    const renderHomeRes = await fetch(`${base}/`, { headers: { 'x-forwarded-host': 'nuvio-magyar-http.onrender.com' } });
    if (renderHomeRes.headers.get('x-robots-tag')) {
      fail(`Render host must not emit X-Robots-Tag noindex header, got "${renderHomeRes.headers.get('x-robots-tag')}"`);
    }
    const robotsTxt = await robotsRenderRes.text();
    if (!robotsTxt.includes('Sitemap: https://nuvio-magyar-http.onrender.com/sitemap.xml') || !sitemapRes.includes('https://nuvio-magyar-http.onrender.com/configure')) {
      fail('robots.txt or sitemap.xml missing Render canonical URL');
    }
    console.log('✅ 10. SEO & Canonical Verification (Render indexed + Vercel noindex) OK');

    if (hasError) {
      process.exitCode = 1;
      console.error('\n❌ One or more verification assertions failed.');
    } else {
      console.log('\n🎉 All addon verification checks passed!');
    }
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
