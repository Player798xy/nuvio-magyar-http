import json
import re
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
scratch_path = r"C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json"

with open(scratch_path, "r", encoding="utf-8") as f:
    d = json.load(f)

channels = d["channels"]
channels_by_id = {c["id"]: c for c in channels}

# Popularity ordered channel IDs per category
ORDERED_CATEGORIES = {
    "hu-live-orszagos": {
        "id": "hu-live-orszagos",
        "name": "🔴 Élő TV: Országos & Kereskedelmi",
        "categoryKey": "orszagos",
        "description": "Fő országos kereskedelmi és közszolgálati televíziók nézettségi sorrendben: RTL, TV2, M1, Duna, Super TV2, ATV, stb.",
        "ids": [
            "6141", "6143", "5901", "5905", "6723", "6142", "6147", "5911",
            "4739", "4740", "6704", "6184", "6236", "6148", "5902", "5906",
            "5904", "5931", "8716", "5855", "4695", "9073", "8999", "1819",
            "6554", "4798", "5927", "5907"
        ]
    },
    "hu-live-film": {
        "id": "hu-live-film",
        "name": "🎬 Élő TV: Film & Sorozat",
        "categoryKey": "film_sorozat",
        "description": "Prémium mozifilmes és sorozatcsatornák népszerűségi sorrendben: Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1-3, stb.",
        "ids": [
            "6150", "6152", "6146", "6652", "6720", "7069", "7158", "7159",
            "6254", "7060", "6149", "7074", "7154", "7422", "8714", "6163",
            "6701", "8489", "9310", "9312", "9745"
        ]
    },
    "hu-live-doksi": {
        "id": "hu-live-doksi",
        "name": "🌍 Élő TV: Ismeretterjesztő & Doksi",
        "categoryKey": "ismeretterjeszto",
        "description": "Természetfilmek, történelem, tudomány és dokumentumfilmek népszerűségi sorrendben: Nat Geo, History, Spektrum, stb.",
        "ids": [
            "5936", "7325", "6749", "5937", "6589", "8124"
        ]
    },
    "hu-live-sport": {
        "id": "hu-live-sport",
        "name": "⚽ Élő TV: Sport, Zene & Életmód",
        "categoryKey": "sport_zene_eletmod",
        "description": "Élő sportközvetítések, zenei csatornák és életmód népszerűségi sorrendben: M4 Sport, Spíler 1-2, Sport 1-2, Arena4, TV Paprika, stb.",
        "ids": [
            "5903", "6721", "6722", "6718", "6719", "7084", "8271", "6748",
            "6751", "7087", "6159", "6151", "6162", "6603", "6455", "9311",
            "5939", "9608", "9787"
        ]
    },
    "hu-live-gyerek": {
        "id": "hu-live-gyerek",
        "name": "🧸 Élő TV: Rajzfilm & Gyerek",
        "categoryKey": "rajzfilm",
        "description": "Rajzfilmek, animációk és ifjúsági műsorok népszerűségi sorrendben: Minimax, Nickelodeon, Disney Channel, stb.",
        "ids": [
            "7079", "6764", "6767", "6765", "6705", "6707", "7080", "9309"
        ]
    },
    "hu-live-helyi": {
        "id": "hu-live-helyi",
        "name": "📍 Élő TV: Helyi & Városi TV-k",
        "categoryKey": "helyi",
        "description": "Magyar városok és térségek helyi televíziói fontossági sorrendben: Debrecen, Sopron, Tisza TV, Fehérvár, Nyíregyháza, stb.",
        "ids": [
            "4247", "1835", "5982", "1815", "1853", "1901", "1827", "1829",
            "5137", "1035", "4788", "1821", "5425", "3858", "1811", "1812",
            "5443", "4590", "4650", "4653", "4662", "4699", "4738", "4782",
            "4792", "4794", "5026", "5317", "5462", "5594", "5656", "5838",
            "5913", "6144", "6283", "6294", "6328", "6356", "6358", "6411",
            "6491", "6495", "6627", "6638", "6670", "6675", "6676", "6677",
            "6744", "6790", "7371", "7374", "8586", "9068", "9081", "9332",
            "9711", "9713", "1802", "9727", "9654", "8975", "9665", "9668"
        ]
    }
}

# MTVA mapping to link official MédiaKlikk 1080p stream
MTVA_CHANNEL_MAPPING = {
    "5901": "m1",
    "5902": "m2",
    "5903": "m4",
    "5904": "m5",
    "5905": "duna",
    "5906": "dunaworld",
    "5931": "m3"
}

# Generate JS file content
lines = []
lines.append("/**")
lines.append(" * OnlineStream.live TV Scraper & Comprehensive IPTV Stream Provider")
lines.append(" * Provides all 146 Hungarian TV channels across 6 popularity-sorted categories.")
lines.append(" * Merged with official MTVA MédiaKlikk 1080p HLS feeds for primary state channels.")
lines.append(" */")
lines.append("")
lines.append("const { getLiveChannelStreams: getMediaKlikkLiveStreams, LIVE_CHANNELS: MEDIAKLIKK_LIVE_CHANNELS } = require('./mediaklikk');")
lines.append("")
lines.append("const HOST_URL = process.env.HOST_URL || 'https://nuvio-magyar-http.vercel.app';")
lines.append("")
lines.append("// 6 Live TV Catalog Definitions")
lines.append("const ONLINESTREAM_CATEGORIES = [")
for cat_id, info in ORDERED_CATEGORIES.items():
    lines.append("  {")
    lines.append(f"    id: '{cat_id}',")
    lines.append(f"    name: '{info['name']}',")
    lines.append(f"    type: 'movie',")
    lines.append(f"    category: 'tv',")
    lines.append(f"    description: '{info['description']}',")
    lines.append(f"    defaultEnabled: true,")
    lines.append(f"    count: {len(info['ids'])}")
    lines.append("  },")
lines.append("];")
lines.append("")

# Generate ALL_CHANNELS array
lines.append("// 146 Live TV Channels sorted by popularity inside their categories")
lines.append("const ALL_CHANNELS = [")

for cat_id, cat_info in ORDERED_CATEGORIES.items():
    for cid in cat_info["ids"]:
        raw_ch = channels_by_id[cid]
        name = raw_ch["name"]
        clean_name = name.replace("'", "\\'")
        
        # Check MTVA mapping
        mtva_key = MTVA_CHANNEL_MAPPING.get(cid)
        
        # Poster and logo URLs
        logo_url = raw_ch.get("logo") or f"https://onlinestream.live/logos/s{cid}.png"
        
        # If MTVA channel, use official branded poster from /channels/poster-...
        if mtva_key:
            poster_url = f"${{HOST_URL}}/channels/poster-{mtva_key}.png"
            logo_field = f"${{HOST_URL}}/channels/{mtva_key}.png"
        else:
            # High-res poster fallback
            poster_url = logo_url
            logo_field = logo_url

        streams_data = []
        for s in raw_ch.get("streams", []):
            direct_u = s.get("direct_stream_url")
            if direct_u and (direct_u.startswith("http://") or direct_u.startswith("https://")):
                streams_data.append({
                    "sub_idx": s.get("sub_idx", 1),
                    "url": direct_u,
                    "host": s.get("stream_host") or "HLS CDN",
                    "features": s.get("features") or "1080p / 720p HLS",
                    "playerUrl": s.get("player_url") or raw_ch.get("player_url") or ""
                })

        streams_json = json.dumps(streams_data, ensure_ascii=False)
        
        lines.append("  {")
        lines.append(f"    id: 'onlinestream-live-{cid}',")
        lines.append(f"    channelId: '{cid}',")
        lines.append(f"    name: '{clean_name}',")
        lines.append(f"    category: '{cat_id}',")
        lines.append(f"    type: 'movie',")
        lines.append(f"    poster: `{poster_url}`,")
        lines.append(f"    logo: `{logo_field}`,")
        lines.append(f"    background: `{logo_field}`,")
        lines.append(f"    year: 'ÉLŐ • TV',")
        lines.append(f"    releaseInfo: 'ÉLŐ • TV',")
        lines.append(f"    description: '{clean_name} élő televíziós közvetítés ({cat_info['name']}).',")
        lines.append(f"    mtvaKey: {f"'{mtva_key}'" if mtva_key else 'null'},")
        lines.append(f"    streams: {streams_json},")
        lines.append(f"    behaviorHints: {{ defaultVideoId: 'onlinestream-live-{cid}', isLive: true }}")
        lines.append("  },")

lines.append("];")
lines.append("")

# Add helper functions
lines.append("""
// In-memory channel lookup maps
const CHANNELS_BY_ID = new Map(ALL_CHANNELS.map(ch => [ch.id, ch]));
const CHANNELS_BY_NUM_ID = new Map(ALL_CHANNELS.map(ch => [ch.channelId, ch]));

// In-memory stream cache
const STREAM_CACHE = new Map();
const STREAM_CACHE_TTL_MS = 30 * 60 * 1000; // 30 mins

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

/**
 * Returns channels for a catalog (or filtered by search query)
 */
function getOnlineStreamChannels(catalogId, query = '') {
  let list = ALL_CHANNELS;
  if (catalogId && catalogId !== 'all') {
    list = list.filter(ch => ch.category === catalogId);
  }
  if (!query) return list;

  const qNorm = normalize(query);
  return list.filter(ch =>
    normalize(ch.name).includes(qNorm) ||
    normalize(ch.description).includes(qNorm) ||
    ch.channelId === qNorm
  );
}

/**
 * Returns metadata for a live TV channel
 */
function getOnlineStreamMeta(id, type = 'movie') {
  if (!id) return null;
  const cleanId = String(id).trim();
  const ch = CHANNELS_BY_ID.get(cleanId) || CHANNELS_BY_NUM_ID.get(cleanId.replace('onlinestream-live-', ''));
  if (!ch) return null;

  return {
    meta: {
      id: ch.id,
      type: type || 'movie',
      name: ch.name,
      poster: ch.poster,
      background: ch.background,
      logo: ch.logo,
      description: ch.description,
      releaseInfo: ch.releaseInfo,
      year: ch.year,
      posterShape: 'poster',
      behaviorHints: {
        defaultVideoId: ch.id,
        isLive: true
      }
    }
  };
}

/**
 * Returns stream array for a live TV channel
 * Never returns both title and description on Stream objects (only name, title, url, behaviorHints).
 */
async function getOnlineStreamStreams(channelIdOrKey, clientIp = null, hostUrl = HOST_URL) {
  const cleanId = String(channelIdOrKey || '').trim();
  const numId = cleanId.replace('onlinestream-live-', '').replace('mediaklikk-live-', '');
  
  const ch = CHANNELS_BY_ID.get(cleanId) || 
             CHANNELS_BY_NUM_ID.get(numId) ||
             ALL_CHANNELS.find(c => c.mtvaKey && c.mtvaKey === cleanId);

  if (!ch) return [];

  const results = [];

  // 1. Primary: If MTVA channel, fetch official MTVA 1080p HLS stream first!
  if (ch.mtvaKey) {
    try {
      const mtvaStreams = await getMediaKlikkLiveStreams(ch.mtvaKey, clientIp, hostUrl);
      if (Array.isArray(mtvaStreams) && mtvaStreams.length > 0) {
        results.push(...mtvaStreams);
      }
    } catch (err) {
      console.warn(`[OnlineStream] MTVA stream fallback for ${ch.name}:`, err.message);
    }
  }

  // 2. Secondary & Backup: OnlineStream direct HLS streams
  if (Array.isArray(ch.streams) && ch.streams.length > 0) {
    for (let i = 0; i < ch.streams.length; i++) {
      const s = ch.streams[i];
      if (!s.url) continue;

      const serverLabel = s.host || `Szerver #${i + 1}`;
      const qualityLabel = s.features && !s.features.includes('-') ? s.features : '1080p / 720p HD';

      results.push({
        name: `🔴 [HU] ${ch.name} [IPTV #${i + 1}]`,
        title: `📡 ${ch.name} • ${serverLabel}\n${qualityLabel} • Közvetlen HLS Adás\nOnlineStream IPTV Forrás`,
        url: s.url,
        behaviorHints: {
          notWebReady: false,
          isLive: true
        }
      });
    }
  }

  // 3. If no stream yet but playerUrl exists, add direct player link or fallback
  if (results.length === 0 && ch.streams && ch.streams[0] && ch.streams[0].playerUrl) {
    results.push({
      name: `🔴 [HU] ${ch.name} [Web Lejátszó]`,
      title: `🌐 ${ch.name} • Webes Élő Adás\nNyisd meg a lejátszót a közvetítés megtekintéséhez.`,
      url: ch.streams[0].playerUrl,
      behaviorHints: {
        notWebReady: false,
        isLive: true
      }
    });
  }

  return results;
}

module.exports = {
  ONLINESTREAM_CATEGORIES,
  ALL_CHANNELS,
  getOnlineStreamChannels,
  getOnlineStreamMeta,
  getOnlineStreamStreams
};
""")

output_file = r"C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http\src\scrapers\onlinestream.js"
code_text = "\n".join(lines)
with open(output_file, "w", encoding="utf-8") as f:
    f.write(code_text)

print(f"Generated {output_file} ({len(code_text)} bytes, {len(lines)} lines)")
