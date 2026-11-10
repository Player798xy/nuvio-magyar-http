const http = require('http');
const express = require('express');
const { getManifest, handleStreamRequest, getMeta, ALL_SCRAPERS } = require('../src/addon');
const { fetchCatalogItems, CATALOG_DEFINITIONS } = require('../src/catalogs');
const { getOnlineStreamChannels, getOnlineStreamStreams } = require('../src/scrapers/onlinestream');

async function runTests() {
  console.log('=== STARTING FULL ADDON VERIFICATION ===\n');

  // 1. Manifest verification
  const manifest = getManifest();
  console.log(`1. Manifest loaded: ${manifest.name} v${manifest.version}`);
  console.log(`   Total catalogs in manifest: ${manifest.catalogs.length}`);
  const liveCatalogs = manifest.catalogs.filter(c => c.id.startsWith('hu-live-'));
  const vodCatalogs = manifest.catalogs.filter(c => !c.id.startsWith('hu-live-'));
  console.log(`   Live TV catalogs (${liveCatalogs.length}):`, liveCatalogs.map(c => c.id).join(', '));
  console.log(`   VOD catalogs (${vodCatalogs.length}):`, vodCatalogs.map(c => c.id).join(', '));
  if (manifest.catalogs.length !== 17 || liveCatalogs.length !== 6) {
    throw new Error(`Expected 17 catalogs (6 live), got ${manifest.catalogs.length}`);
  }

  // 2. Test each of the 6 Live Catalogs
  const expectedLiveCounts = {
    'hu-live-orszagos': 28,
    'hu-live-film': 21,
    'hu-live-doksi': 6,
    'hu-live-sport': 19,
    'hu-live-gyerek': 8,
    'hu-live-helyi': 64
  };

  console.log('\n2. Testing all 6 Live TV Catalogs:');
  for (const [catId, expectedCount] of Object.entries(expectedLiveCounts)) {
    const items = await fetchCatalogItems(catId, 'movie');
    console.log(`   - ${catId}: ${items.length} channels (expected: ${expectedCount})`);
    if (items.length !== expectedCount) {
      throw new Error(`Catalog ${catId} expected ${expectedCount} items, got ${items.length}`);
    }
    // Print first 3 items in popularity order
    const top3 = items.slice(0, 3).map(i => i.name).join(', ');
    console.log(`     Top 3: ${top3}`);
  }

  // 3. Test Meta resolution for Live Channels
  console.log('\n3. Testing Meta resolution for Live Channels:');
  const natGeoMeta = await getMeta('movie', 'onlinestream-live-5936');
  console.log(`   - Nat Geo meta:`, natGeoMeta?.meta?.name, '| Logo:', natGeoMeta?.meta?.logo?.slice(0, 45));
  const m4Meta = await getMeta('movie', 'mediaklikk-live-m4');
  console.log(`   - M4 Sport meta:`, m4Meta?.meta?.name, '| Logo:', m4Meta?.meta?.logo?.slice(0, 45));

  // 4. Test Stream Resolution for Key Channels
  console.log('\n4. Testing Stream Resolution for Live Channels:');
  
  // Nat Geo (5936)
  const natGeoStreams = await handleStreamRequest('movie', 'onlinestream-live-5936', {});
  console.log(`   - Nat Geo streams: ${natGeoStreams.streams?.length}`);
  if (!natGeoStreams.streams?.length) throw new Error('Nat Geo returned 0 streams');
  console.log(`     Sample URL: ${natGeoStreams.streams[0].url?.slice(0, 65)}...`);

  // Film+ (6150)
  const filmStreams = await handleStreamRequest('movie', 'onlinestream-live-6150', {});
  console.log(`   - Film+ streams: ${filmStreams.streams?.length}`);
  if (!filmStreams.streams?.length) throw new Error('Film+ returned 0 streams');
  console.log(`     Sample URL: ${filmStreams.streams[0].url?.slice(0, 65)}...`);

  // Sopron TV (5982)
  const sopronStreams = await handleStreamRequest('movie', 'onlinestream-live-5982', {});
  console.log(`   - Sopron TV streams: ${sopronStreams.streams?.length}`);
  if (!sopronStreams.streams?.length) throw new Error('Sopron TV returned 0 streams');
  console.log(`     Sample URL: ${sopronStreams.streams[0].url?.slice(0, 65)}...`);

  // M4 Sport (mediaklikk-live-m4)
  const m4Streams = await handleStreamRequest('movie', 'mediaklikk-live-m4', {});
  console.log(`   - M4 Sport streams: ${m4Streams.streams?.length} (MTVA primary + OnlineStream backups)`);
  if (!m4Streams.streams?.length) throw new Error('M4 Sport returned 0 streams');
  console.log(`     Primary: ${m4Streams.streams[0].name} -> ${m4Streams.streams[0].url?.slice(0, 65)}...`);

  // 5. Test Stremio Serde Compliance (NO description property on any stream)
  console.log('\n5. Testing Stremio Rust Serde Deserialization Compliance:');
  const allTestedStreams = [...natGeoStreams.streams, ...filmStreams.streams, ...sopronStreams.streams, ...m4Streams.streams];
  for (const s of allTestedStreams) {
    if (s.description !== undefined) {
      throw new Error(`Stream object contains invalid 'description' field: ${JSON.stringify(s)}`);
    }
    if (!s.url || !s.name || !s.title) {
      throw new Error(`Stream object missing required field (url, name, or title): ${JSON.stringify(s)}`);
    }
  }
  console.log(`   All ${allTestedStreams.length} tested stream objects are 100% Stremio Rust Serde compliant (no description, valid url/name/title)!`);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
