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
    if (metaRes?.idPrefixes?.includes('tt')) fail('Manifest meta resource must NOT declare broad "tt" prefix (triggers Stremio library meta flood)');
    if (!metaRes?.idPrefixes?.includes('tt0154077') || !metaRes?.idPrefixes?.includes('tmdb:')) {
      fail('Manifest meta resource missing curated classic or tmdb prefix');
    }
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
      const manualMeta = await fetch(`${base}/meta/${sampleMovie.type}/${encodeURIComponent(sampleMovie.id)}.json`, { redirect: 'manual' });
      if (sampleMovie.id.startsWith('tt') && (manualMeta.status !== 302 || !String(manualMeta.headers.get('location') || '').startsWith('https://v3-cinemeta.strem.io/'))) {
        fail(`Expected 302 Cinemeta offload for standard IMDb ${sampleMovie.id}, got status=${manualMeta.status}`);
      }
      const metaCheck = await fetch(`${base}/meta/${sampleMovie.type}/${encodeURIComponent(sampleMovie.id)}.json`).then((r) => r.json());
      if (!metaCheck?.meta?.name) fail(`Meta lookup failed for ${sampleMovie.id}`);
      else console.log(`   -> Meta OK (302 Cinemeta offload): ${metaCheck.meta.name} (${metaCheck.meta.id})`);
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
    const firstPlayableLive = liveStreamJson.streams.find((s) => s.url);
    if (firstPlayableLive?.title) {
      console.log(`   -> Stream Title Preview: ${firstPlayableLive.title.split('\n')[0]}`);
    }
    const rtlLiveJson = await fetch(`${base}/stream/movie/onlinestream-live-6141.json`).then((r) => r.json());
    const playableLiveAll = [...liveStreamJson.streams, ...(rtlLiveJson.streams || [])].filter((s) => s.url);
    if (!playableLiveAll.length) fail('RTL/M4 Sport returned 0 playable live streams');
    for (const ls of playableLiveAll) {
      if (ls.behaviorHints?.proxyHeaders) {
        fail(`Live stream "${ls.name}" must omit proxyHeaders (triggers Stremio Android /proxy/ crash)`);
      }
      const needsNotWebReady = !String(ls.url || '').startsWith('https://') || String(ls.url || '').includes('gradetv');
      if (Boolean(ls.behaviorHints?.notWebReady) !== needsNotWebReady) {
        fail(`Live stream "${ls.name}" expected notWebReady=${needsNotWebReady}, got ${ls.behaviorHints?.notWebReady}`);
      }
    }
    const brokenGradetv = (rtlLiveJson.streams || []).find((s) => String(s.url || '').includes('m3m8.gradetv.net') && !String(s.url).includes('faixa=video'));
    if (brokenGradetv) {
      fail(`GradeTV RTL stream still uses dual TYPE=AUDIO wrapper instead of clean muxed faixa=video: ${brokenGradetv.url}`);
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

    // 9. Vercel-Only Migration Banner, Universal Ko-fi Support Notice & QR Code Static Pages
    const { handleStreamRequest, getRuntimeNoticeMeta } = require('../src/addon');
    const [qrJsRes, ujLinkRes, supportPageRes, runtimeRes, previewStreamRes] = await Promise.all([
      fetch(`${base}/qr.js`),
      fetch(`${base}/uj-link`),
      fetch(`${base}/tamogatas`),
      fetch(`${base}/api/runtime-info`),
      fetch(`${base}/stream/movie/tt15239678.json?previewMigration=1`).then((r) => r.json())
    ]);
    if (qrJsRes.status !== 200) fail(`/qr.js returned HTTP ${qrJsRes.status}`);
    if (ujLinkRes.status !== 200) fail(`/uj-link returned HTTP ${ujLinkRes.status}`);
    if (supportPageRes.status !== 200) fail(`/tamogatas returned HTTP ${supportPageRes.status}`);
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
      const renderLive = await handleStreamRequest('movie', 'onlinestream-live-5903', { hostUrl: 'https://nuvio-magyar-http.onrender.com' });
      const renderMeta = getRuntimeNoticeMeta({ hostUrl: 'https://nuvio-magyar-http.onrender.com' });
      if (renderMeta.showMigrationBanner || renderMeta.platform !== 'render') fail('Render runtime meta leaked migration banner');
      if (!renderVod.streams?.[0]?.name?.includes('☕') || !renderVod.streams?.[0]?.externalUrl?.includes('/tamogatas.html')) {
        fail('Render VOD streams[0] missing top standout Ko-fi TV QR notice');
      }
      if (!renderVod.streams?.[0]?.title?.includes('OPCIONÁLIS') || !renderVod.streams?.[0]?.title?.toLowerCase().includes('ingyenes')) {
        fail('Render VOD streams[0] must clearly state optional + always free');
      }
      if (!renderVod.streams?.[1]?.url || !renderVod.streams?.[1]?.behaviorHints?.bingeGroup) {
        fail('Render VOD streams[1] must remain a playable video stream with bingeGroup');
      }
      if (!renderLive.streams?.[0]?.name?.includes('☕') || !renderLive.streams?.[0]?.externalUrl?.includes('/tamogatas.html')) {
        fail('Render Live TV streams[0] missing top standout Ko-fi TV QR notice');
      }
      if (!renderLive.streams?.[1]?.url) {
        fail('Render Live TV streams[1] must remain a playable live stream');
      }
    } finally {
      if (prevEnv.VERCEL === undefined) delete process.env.VERCEL; else process.env.VERCEL = prevEnv.VERCEL;
      if (prevEnv.RENDER === undefined) delete process.env.RENDER; else process.env.RENDER = prevEnv.RENDER;
      if (prevEnv.MIGRATION_NOTICE_URL === undefined) delete process.env.MIGRATION_NOTICE_URL; else process.env.MIGRATION_NOTICE_URL = prevEnv.MIGRATION_NOTICE_URL;
    }
    console.log('✅ 9. Vercel-Only Yellow Notice, Universal Ko-fi Notice, /qr.js, /uj-link & /tamogatas OK');

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
    if (homeHtml.includes('supportQrFrame') || homeHtml.includes('migrationQrFrame')) {
      fail('Homepage must NOT embed inline QR frames (only dedicated /tamogatas.html and /uj-link.html show TV QR)');
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

    // 11. Private Stats Endpoint & Bot Filtering
    const beforeHealthStats = await fetch(`${base}/api/stats?format=json`, {
      headers: { 'x-forwarded-for': '203.0.113.10' }
    }).then((r) => r.json());
    await fetch(`${base}/api/health`, { headers: { 'x-forwarded-for': '203.0.113.55', 'user-agent': 'cron-job.org' } });
    await fetch(`${base}/manifest.json`, { headers: { 'x-forwarded-for': '203.0.113.77', 'user-agent': 'Stremio/4.4' } });
    const afterStats = await fetch(`${base}/api/stats?format=json`, {
      headers: { 'x-forwarded-for': '203.0.113.10' }
    }).then((r) => r.json());
    if ((afterStats.requestsToday?.manifest || 0) <= (beforeHealthStats.requestsToday?.manifest || 0)) {
      fail('/api/stats did not record addon manifest request');
    }
    if ((afterStats.users?.todayAddon || 0) < 1 || (afterStats.requestsToday?.stream_vod || 0) < 1) {
      fail('/api/stats missing unique addon user or stream_vod count');
    }
    const prevStatsKey = process.env.STATS_KEY;
    try {
      const importWithoutKeyEnv = await fetch(`${base}/api/stats/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalCounts: { catalog: 99999 } })
      });
      if (importWithoutKeyEnv.status !== 403) {
        fail(`Expected 403 on /api/stats/import when STATS_KEY is unset, got ${importWithoutKeyEnv.status}`);
      }

      process.env.STATS_KEY = 'secret-test-key';
      const unauthStats = await fetch(`${base}/api/stats?format=json`);
      const authStatsHtml = await fetch(`${base}/api/stats?key=secret-test-key`, { headers: { Accept: 'text/html' } });
      const backupRes = await fetch(`${base}/api/stats/backup?key=secret-test-key`);
      const backupJson = await backupRes.json();
      if (unauthStats.status !== 401) fail(`Expected 401 without STATS_KEY, got ${unauthStats.status}`);
      if (authStatsHtml.status !== 200 || !(await authStatsHtml.text()).includes('Használati Statisztika')) {
        fail('Authenticated HTML /api/stats dashboard failed to render');
      }
      if (backupRes.status !== 200 || !backupJson.exportedAt || typeof backupJson.totalCounts !== 'object') {
        fail('Stats backup export endpoint failed');
      }
      const importOkRes = await fetch(`${base}/api/stats/import?key=secret-test-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalCounts: { catalog: 10 }, addonHashesSinceBoot: ['testhash_backup_1'] })
      });
      const importOkJson = await importOkRes.json();
      if (importOkRes.status !== 200 || !importOkJson.ok) {
        fail(`Authenticated stats import failed: HTTP ${importOkRes.status}`);
      }
    } finally {
      if (prevStatsKey === undefined) delete process.env.STATS_KEY; else process.env.STATS_KEY = prevStatsKey;
    }
    console.log(`✅ 11. Privacy-Safe Stats Dashboard & STATS_KEY Guard OK (todayAddon=${afterStats.users?.todayAddon}, stream_vod=${afterStats.requestsToday?.stream_vod})`);

    // 12. Render PNG Asset Offloading to Free jsDelivr CDN (Saves 5 GB Render bandwidth limit)
    const prevRenderForCdn = process.env.RENDER;
    try {
      process.env.RENDER = 'true';
      const [renderManifest, renderLiveCat, renderAssetRedirect] = await Promise.all([
        fetch(`${base}/manifest.json`).then((r) => r.json()),
        fetch(`${base}/catalog/movie/hu-live-tv.json`).then((r) => r.json()),
        fetch(`${base}/tv-posters/5903.png`, { redirect: 'manual' })
      ]);
      if (!String(renderManifest.logo || '').startsWith('https://cdn.jsdelivr.net/gh/Player798xy/nuvio-magyar-http@main/public/logo.png')) {
        fail(`Render manifest logo not offloaded to jsDelivr CDN: ${renderManifest.logo}`);
      }
      if (!String(renderLiveCat.metas?.[0]?.poster || '').startsWith('https://cdn.jsdelivr.net/gh/Player798xy/nuvio-magyar-http@main/public/tv-posters/')) {
        fail(`Render Live TV poster not offloaded to jsDelivr CDN: ${renderLiveCat.metas?.[0]?.poster}`);
      }
      if (renderAssetRedirect.status !== 302 || !String(renderAssetRedirect.headers.get('location') || '').startsWith('https://cdn.jsdelivr.net/')) {
        fail(`Expected 302 CDN redirect for legacy PNG hit on Render, got status=${renderAssetRedirect.status}`);
      }
    } finally {
      if (prevRenderForCdn === undefined) delete process.env.RENDER; else process.env.RENDER = prevRenderForCdn;
    }
    console.log('✅ 12. Render Heavy TV Artwork Offload to Free jsDelivr CDN OK');

    // 13. Daily Catalog, Extended Live TV, Search, Meta, Manifest + 304 ETag Caches
    const [manCacheRes, liveCatRes, trendCachedStartRes, liveStreamCacheRes] = await Promise.all([
      fetch(`${base}/manifest.json`),
      fetch(`${base}/catalog/movie/hu-live-tv.json`),
      fetch(`${base}/catalog/movie/hu-trending-movies.json`),
      fetch(`${base}/stream/movie/onlinestream-live-6141.json`)
    ]);
    const manCC = manCacheRes.headers.get('cache-control') || '';
    const liveCatCC = liveCatRes.headers.get('cache-control') || '';
    const trendCC = trendCachedStartRes.headers.get('cache-control') || '';
    const trendEtag = trendCachedStartRes.headers.get('etag') || '';
    const liveStreamCC2 = liveStreamCacheRes.headers.get('cache-control') || '';
    if (!manCC.includes('max-age=21600')) fail(`Expected max-age=21600 on /manifest.json, got "${manCC}"`);
    if (!liveCatCC.includes('max-age=86400') || !trendCC.includes('max-age=86400')) {
      fail(`Expected max-age=86400 (daily) on browse catalogs, got live="${liveCatCC}", trend="${trendCC}"`);
    }
    if (!liveStreamCC2.includes('max-age=180')) {
      fail(`Expected max-age=180 on OnlineStream Live TV stream, got "${liveStreamCC2}"`);
    }
    if (!trendEtag) fail('Expected ETag header on /catalog/movie/hu-trending-movies.json');

    const tLiveStart = Date.now();
    const liveStreamHit2 = await fetch(`${base}/stream/movie/onlinestream-live-6141.json`).then((r) => r.json());
    const liveHitMs = Date.now() - tLiveStart;
    if (!liveStreamHit2.streams?.length || liveHitMs > 250) {
      fail(`Live TV stream second hit slow or empty (${liveHitMs}ms)`);
    }

    const etag304Res = await fetch(`${base}/catalog/movie/hu-trending-movies.json`, {
      headers: { 'If-None-Match': trendEtag }
    });
    if (etag304Res.status !== 304) fail(`Expected 304 Not Modified for matching ETag, got ${etag304Res.status}`);

    const tCatHitStart = Date.now();
    const trendCatHit = await fetch(`${base}/catalog/movie/hu-trending-movies.json`).then((r) => r.json());
    const catHitMs = Date.now() - tCatHitStart;
    if (!trendCatHit.metas?.length || catHitMs > 150) {
      fail(`Catalog cache hit too slow or empty (${catHitMs}ms)`);
    }

    const searchRes1 = await fetch(`${base}/catalog/movie/hu-trending-movies/search=Matrix.json`);
    const searchCC = searchRes1.headers.get('cache-control') || '';
    const searchJson1 = await searchRes1.json();
    const tSearchStart = Date.now();
    const searchJson2 = await fetch(`${base}/catalog/movie/hu-trending-movies/search=Matrix.json`).then((r) => r.json());
    const searchHitMs = Date.now() - tSearchStart;
    if (searchJson1.metas?.length > 0 && !searchCC.includes('max-age=1800')) {
      fail(`Expected max-age=1800 on search catalog, got "${searchCC}"`);
    }
    if (searchJson2.metas?.length !== searchJson1.metas?.length || searchHitMs > 150) {
      fail(`Search catalog cache miss or mismatch (${searchHitMs}ms)`);
    }

    const metaOffloadRes = await fetch(`${base}/meta/movie/tt15239678.json`, { redirect: 'manual' });
    if (metaOffloadRes.status !== 302 || !String(metaOffloadRes.headers.get('location') || '').includes('v3-cinemeta.strem.io')) {
      fail(`Expected 302 Cinemeta offload on standard IMDb /meta/, got status=${metaOffloadRes.status}`);
    }

    await fetch(`${base}/meta/series/tt0154077.json`);
    const tMetaStart = Date.now();
    const metaHitRes = await fetch(`${base}/meta/series/tt0154077.json`);
    const metaHitMs = Date.now() - tMetaStart;
    const metaHitCC = metaHitRes.headers.get('cache-control') || '';
    const metaHitJson = await metaHitRes.json();
    if (!metaHitJson?.meta?.id || metaHitMs > 150) {
      fail(`Curated VOD meta cache miss or slow hit (${metaHitMs}ms)`);
    }
    if (!metaHitCC.includes('max-age=7200')) {
      fail(`Expected max-age=7200 on curated VOD /meta/, got "${metaHitCC}"`);
    }
    console.log(`✅ 13. Catalog (${catHitMs}ms), Search (${searchHitMs}ms), Curated Meta (${metaHitMs}ms), Cinemeta 302 Offload & ETag 304 OK`);

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
