import sys

sys.stdout.reconfigure(encoding="utf-8")
addon_path = r"C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http\src\addon.js"

with open(addon_path, "r", encoding="utf-8") as f:
    content = f.read().replace("\r\n", "\n")

# 1. Add import
old_import = "const { scrapeMediaKlikk, getLiveChannelStreams, LIVE_CHANNELS } = require('./scrapers/mediaklikk');"
new_import = """const { scrapeMediaKlikk, getLiveChannelStreams, LIVE_CHANNELS } = require('./scrapers/mediaklikk');
const { getOnlineStreamStreams } = require('./scrapers/onlinestream');"""

assert old_import in content, "old_import not found"
content = content.replace(old_import, new_import, 1)

# 2. Add onlinestream to FAST_SCRAPER_IDS and ALL_SCRAPERS
old_fast = "  'sorozatoknet'\n]);"
new_fast = "  'sorozatoknet',\n  'onlinestream'\n]);"
assert old_fast in content, "old_fast not found"
content = content.replace(old_fast, new_fast, 1)

old_scraper = "  { id: 'sorozatoknet', name: 'Sorozatok.net', fn: scrapeSorozatokNet, fast: true }\n];"
new_scraper = """  { id: 'sorozatoknet', name: 'Sorozatok.net', fn: scrapeSorozatokNet, fast: true },
  { id: 'onlinestream', name: 'OnlineStream IPTV', fn: async () => [], fast: true }
];"""
assert old_scraper in content, "old_scraper not found"
content = content.replace(old_scraper, new_scraper, 1)

# 3. Add onlinestream-live- to supportedIdPrefixes
old_prefixes = "    'mediaklikk-live-',"
new_prefixes = "    'onlinestream-live-',\n    'mediaklikk-live-',"
assert old_prefixes in content, "old_prefixes not found"
content = content.replace(old_prefixes, new_prefixes, 1)

# 4. Add onlinestream-live- to meta idPrefixes
old_meta_pfx = "idPrefixes: ['mediaklikk-live-'"
new_meta_pfx = "idPrefixes: ['onlinestream-live-', 'mediaklikk-live-'"
assert old_meta_pfx in content, "old_meta_pfx not found"
content = content.replace(old_meta_pfx, new_meta_pfx, 1)

# 5. Update live stream handler
old_handler = """  // 1. Handle Live TV channels (M4 Sport, M1, M2, Duna, M5, etc.)
  if (type === 'tv' || type === 'channel' || (id && id.startsWith('mediaklikk-live-'))) {
    const liveStreams = await getLiveChannelStreams(id, config.clientIp, config.hostUrl);
    return { streams: liveStreams };
  }"""

new_handler = """  // 1. Handle Live TV channels (OnlineStream 146 adó + MTVA MédiaKlikk)
  if (type === 'tv' || type === 'channel' || (id && (id.startsWith('onlinestream-live-') || id.startsWith('mediaklikk-live-')))) {
    const liveStreams = await getOnlineStreamStreams(id, config.clientIp, config.hostUrl);
    if (liveStreams && liveStreams.length > 0) {
      return { streams: liveStreams };
    }
    const fallbackStreams = await getLiveChannelStreams(id, config.clientIp, config.hostUrl);
    return { streams: fallbackStreams };
  }"""

assert old_handler in content, "old_handler not found"
content = content.replace(old_handler, new_handler, 1)

with open(addon_path, "w", encoding="utf-8") as f:
    f.write(content.replace("\n", "\r\n"))

print("Successfully updated src/addon.js")
