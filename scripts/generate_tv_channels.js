#!/usr/bin/env node
/**
 * Writes the Git-served channel snapshot used by the /tv viewer.
 *
 * The viewer loads the channel list straight from GitHub (raw / jsDelivr), so
 * this file is the "fresh list from Git". Regenerate after changing
 * src/scrapers/onlinestream.js:
 *
 *   node scripts/generate_tv_channels.js
 */

const fs = require('fs');
const path = require('path');
const { buildChannelPayload } = require('../src/tv_channels');
const { ALL_CHANNELS, ONLINESTREAM_CATEGORIES, applyRuntimeCatalog } = require('../src/scrapers/onlinestream');
const { ensureLoaded, mergeWithLocals, getLocalChannels } = require('../src/local_channels');

// Local hand-added channels (data/channels.local.*) must end up in the Git snapshot too.
ensureLoaded({ force: true });
const local = getLocalChannels();
if (local.channels.length) {
  const merged = mergeWithLocals(ALL_CHANNELS, ONLINESTREAM_CATEGORIES, local);
  applyRuntimeCatalog(merged.channels, merged.categories);
  console.log(`+ ${local.channels.length} helyi csatorna a snapshotban`);
}

const outputPath = path.join(__dirname, '..', 'public', 'tv-channels.json');
const payload = buildChannelPayload();

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 1)}\n`, 'utf8');

const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
console.log(`tv-channels.json  ${payload.count} csatorna  ${payload.mirrorCount} tükör  ${sizeKb} KB`);
console.log(`Git URL: https://raw.githubusercontent.com/Player798xy/nuvio-magyar-http/main/public/tv-channels.json`);
