import sys

sys.stdout.reconfigure(encoding="utf-8")
catalog_path = r"C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http\src\catalog.js"

with open(catalog_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
old_import = "const { fetchCatalogItems, rotateWeekly } = require('./catalogs');"
new_import = "const { fetchCatalogItems, rotateWeekly } = require('./catalogs');\nconst { getOnlineStreamChannels, getOnlineStreamMeta } = require('./scrapers/onlinestream');"

assert old_import in content, "old_import not found"
content = content.replace(old_import, new_import, 1)

# 2. Update searchCatalog for Live TV
old_live_block = """  // If Live TV catalog requested (either by catalog id or by type)
  if (catalogId === 'hu-live-tv' || catalogId === 'hu-live-tv-channel' || type === 'tv' || type === 'channel') {
    const list = LIVE_CHANNELS.map(ch => ({
      id: ch.id,
      name: ch.name,
      type: type || 'movie',
      poster: ch.poster,
      background: ch.poster,
      logo: ch.logo,
      description: ch.description,
      releaseInfo: ch.year || 'ÉLŐ • 1080p FHD',
      year: ch.year || 'ÉLŐ • 1080p FHD',
      posterShape: 'poster',
      behaviorHints: {
        defaultVideoId: ch.id,
        isLive: true
      }
    }));
    if (!query) return list;
    const qNorm = normalize(query);
    return list.filter(ch => 
      normalize(ch.name).includes(qNorm) || 
      normalize(ch.description).includes(qNorm) ||
      ch.channelKey.includes(qNorm)
    );
  }"""

new_live_block = """  // If Live TV catalog requested (either by catalog id or by type)
  if (catalogId.startsWith('hu-live-') || catalogId === 'hu-live-tv' || catalogId === 'hu-live-tv-channel' || type === 'tv' || type === 'channel') {
    const list = getOnlineStreamChannels(catalogId === 'hu-live-tv' ? 'all' : catalogId, query).map(ch => ({
      id: ch.id,
      name: ch.name,
      type: type || 'movie',
      poster: ch.poster,
      background: ch.background,
      logo: ch.logo,
      description: ch.description,
      releaseInfo: ch.releaseInfo || 'ÉLŐ • TV',
      year: ch.year || 'ÉLŐ • TV',
      posterShape: 'poster',
      behaviorHints: {
        defaultVideoId: ch.id,
        isLive: true
      }
    }));
    return list;
  }"""

# Normalize CRLF
content = content.replace("\r\n", "\n")
old_live_block = old_live_block.replace("\r\n", "\n")
new_live_block = new_live_block.replace("\r\n", "\n")

assert old_live_block in content, "old_live_block not found"
content = content.replace(old_live_block, new_live_block, 1)

# 3. Update getMeta for Live TV
old_meta_block = """  // Handle Live TV channels
  if (type === 'tv' || type === 'channel' || type === 'movie' || (id && id.startsWith('mediaklikk-live-'))) {
    const channel = LIVE_CHANNELS.find(ch => ch.id === id || ch.channelKey === id);
    if (channel) {
      return {
        meta: {
          id: channel.id,
          type: type || 'movie',
          name: channel.name,
          poster: channel.poster,
          background: channel.poster,
          logo: channel.logo,
          description: channel.description,
          releaseInfo: channel.year,
          behaviorHints: {
            defaultVideoId: channel.id,
            isLive: true
          }
        }
      };
    }
  }"""

new_meta_block = """  // Handle Live TV channels (OnlineStream or MédiaKlikk)
  if (type === 'tv' || type === 'channel' || (id && (id.startsWith('onlinestream-live-') || id.startsWith('mediaklikk-live-')))) {
    const onlineMeta = getOnlineStreamMeta(id, type);
    if (onlineMeta) return onlineMeta;

    const channel = LIVE_CHANNELS.find(ch => ch.id === id || ch.channelKey === id);
    if (channel) {
      return {
        meta: {
          id: channel.id,
          type: type || 'movie',
          name: channel.name,
          poster: channel.poster,
          background: channel.poster,
          logo: channel.logo,
          description: channel.description,
          releaseInfo: channel.year,
          behaviorHints: {
            defaultVideoId: channel.id,
            isLive: true
          }
        }
      };
    }
  }"""

old_meta_block = old_meta_block.replace("\r\n", "\n")
new_meta_block = new_meta_block.replace("\r\n", "\n")

assert old_meta_block in content, "old_meta_block not found"
content = content.replace(old_meta_block, new_meta_block, 1)

# Write back with CRLF
content_crlf = content.replace("\n", "\r\n")
with open(catalog_path, "w", encoding="utf-8") as f:
    f.write(content_crlf)

print("Successfully updated src/catalog.js")
