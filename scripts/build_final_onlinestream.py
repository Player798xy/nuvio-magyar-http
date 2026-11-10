import json
import re
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
scratch_path = r"C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json"

with open(scratch_path, "r", encoding="utf-8") as f:
    d = json.load(f)

channels = d["channels"]
channels_by_id = {str(c["id"]): c for c in channels}

sys.path.append(r"C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http\scripts")
from build_onlinestream_module import ORDERED_CATEGORIES, MTVA_CHANNEL_MAPPING

# Comprehensive Hungarian descriptions for channels
DESCRIPTIONS = {
    # Országos & Kereskedelmi
    '6141': 'Magyarország vezető kereskedelmi tévécsatornája: Híradó, saját gyártású sikersorozatok, show-műsorok és premier mozifilmek.',
    '6143': 'Országos kereskedelmi adó: Tények hírműsor, nagyszabású családi show-műsorok, vetélkedők és szinkronizált sikerfilmek.',
    '5901': '24 órás élő nemzeti hírcsatorna: folyamatos hazai és nemzetközi hírfolyam, szakértői elemzések és tudósítások.',
    '5905': 'A nemzeti főadó: minőségi kulturális magazinok, magyar filmklasszikusok, vallási műsorok és családi szórakozás.',
    '6723': 'A TV2 Csoport szórakoztató televíziója: népszerű amerikai és török drámasorozatok, vetélkedők, vígjátékok és filmek.',
    '6142': 'Fiatalos szórakoztató csatorna: népszerű vígjátéksorozatok, valóságshow-k és szórakoztató műsorok.',
    '6147': 'Prémium filmcsatorna és európai labdarúgás: kasszasikerek, akciófilmek és UEFA Európa-liga rangadók.',
    '5911': 'Modern szórakoztató adó: premier külföldi dráma- és vígjátéksorozatok, realityk és hollywoodi mozifilmek.',
    '4739': 'Független hír- és közéleti televízió: Egyenes Beszéd, Heti Napló, politikai viták és tájékoztató műsorok.',
    '4740': 'Konzervatív nemzeti hír- és véleménytelevízió: híradók, stúdióbeszélgetések, politikai elemzések és riportok.',
    '6704': 'A TV2 Csoport prémium szórakoztató csatornája: amerikai sikersorozatok, krimik és családi filmek.',
    '6184': 'Bűnügyi és nyomozós sorozatok, Agatha Christie adaptációk és minőségi európai tévéfilmek.',
    '6236': 'Férfias szórakoztatás: sci-fi, akció- és horrorsorozatok, geek magazinok, animációk és motorsport.',
    '6148': 'A legnépszerűbb magyar vetélkedők, talk-show-k (Mónika, Balázs) és klasszikus teleregények (Barátok közt).',
    '5902': 'Napközben M2 rajzfilmek és mesék gyerekeknek, este Petőfi TV fiataloknak koncertekkel és kultúrával.',
    '5906': 'A határon túli magyarságnak szóló műsorok, népzene, nemzeti hagyományok és hétvégén M4 Sport+ közvetítések.',
    '5904': 'Kulturális, oktatási és ismeretterjesztő televízió: színházi közvetítések, irodalom, művészfilmek és történelmi műsorok.',
    '5931': 'Az MTVA archívumának legkedveltebb retró műsorai, legendás magyar tévéjátékok, kabaréjelenetek és zenés műsorok.',
    '8716': 'Könnyed női és családi szórakoztatás: romantikus vígjátékok, gasztroműsorok és életmód magazinok.',
    '5855': 'Független európai hírcsatorna magyar nyelven: nemzetközi hírek, gazdaság, tudomány és kultúra.',
    '4695': 'A vajdasági magyarság regionális televíziója: szabadkai hírek, bánáti riportok és kulturális műsorok.',
    '9073': 'A Vajdasági Rádió és Televízió egyes műsora, magyar nyelvű hír- és magazinblokkokkal.',
    '8999': 'A Vajdasági RTV kisebbségi és kulturális adása: vajdasági magyar híradó és közösségi programok.',
    '1819': 'Közéleti, kulturális, magazin és beszélgetős műsorok a fővárosból.',
    '6554': 'Magyar nóta, mulatós zene, kulturális beszélgetések és szórakoztató programok.',
    '4798': 'Katolikus televíziós hálózat magyar nyelvű adása: vatikáni hírek, imádságok és hitéleti műsorok.',
    '5927': 'Keresztény szellemiségű televízió: élő szentmise közvetítések, tanítások, lelkigondozás és egyházi hírek.',
    '5907': 'A közmédia időszakos és rendkívüli élő eseményeinek, sportközvetítéseinek adása.',

    # Film & Sorozat
    '6150': 'Non-stop akciófilmek, thrillerek, hollywoodi sikerfilmek és látványos mozik a nap 24 órájában.',
    '6152': 'A TV2 Csoport filmcsatornája: a legnagyobb amerikai kasszasikerek, akciók és sci-fik magyarul.',
    '6146': 'Fiatalos szórakoztatás: népszerű amerikai krimisorozatok, vígjátékok és közönségkedvenc filmek.',
    '6652': 'Díjnyertes drámasorozatok (The Walking Dead, Breaking Bad) és kultikus hollywoodi filmklasszikusok.',
    '6720': 'Prémium mozicsatorna: egész estés családi kalandfilmek, animációk és sikerfilmek reklám nélkül.',
    '7069': 'A prémium televíziózás etalonja: díjnyertes HBO Original sorozatok és a legfrissebb hollywoodi premierek.',
    '7158': 'Családi és vígjátékközpontú HBO csatorna: könnyed szórakozás, romantikus filmek és animációk.',
    '7159': 'Az HBO sorozatközpontja: maratoni évadok, minisorozatok és kultikus drámák a nap minden szakában.',
    '6254': 'Európai és amerikai romantikus filmek, kosztümös drámák és klasszikus bűnügyi történetek.',
    '7060': 'Egész napos felhőtlen nevetés: a legnépszerűbb szitkomok (Jóbarátok, Agymenők) és vígjátékok.',
    '6149': 'Bűnügyi, orvosi és romantikus drámasorozatok a világ minden tájáról.',
    '7074': 'Könnyed esti mozi: romantikus vígjátékok, családi történetek és szívhez szóló filmek.',
    '7154': 'Rejtélyek, pörgős akciósorozatok, pszichothrillerek és paranormális nyomozások.',
    '7422': 'Klasszikus és modern krimik, sci-fi sorozatok és rejtélyes bűnügyek.',
    '8714': 'Minőségi brit és skandináv krimik, történelmi sorozatok és prémium európai filmek.',
    '6163': 'A legnépszerűbb török és dél-amerikai teleregények, romantikus sorozatok és szerelmi történetek.',
    '6701': 'Klasszikus nosztalgia sorozatok: Dallas, Columbo, Klinika, Derrick és legendás hősök.',
    '8489': 'A magyar filmművészet legjava: fekete-fehér klasszikusoktól a legújabb hazai mozifilmekig.',
    '9310': 'Tematikus filmcsatorna: ismert hollywoodi kasszasikerek és szinkronos filmek.',
    '9312': 'Kedvenc tévésorozatok, folytatásos teleregények és bűnügyi történetek.',
    '9745': 'A világ filmtörténetének legendás retro klasszikusai és örökzöld alkotásai.',

    # Ismeretterjesztő & Doksi
    '5936': 'A világ vezető ismeretterjesztő csatornája: természet, tudomány, űrkutatás és emberi történetek.',
    '7325': 'A történelem kulisszái mögött: rejtélyek, legendás csaták, ókori civilizációk és valóságshow-k.',
    '6749': 'Színvonalas tudományos és történelmi magazinok, természetfilmek és hazai gyártású dokumentumfilmek.',
    '5937': 'A vadvilág lenyűgöző csodái: ragadozók, ritka állatfajok és egzotikus élőhelyek közelről.',
    '6589': 'Otthonteremtés, lakberendezés, építészet, kertészkedés és zöld életmód praktikus ötletekkel.',
    '8124': 'Környezetvédelem, klímaváltozás, fenntarthatóság, időjárás és lenyűgöző expedíciók.',

    # Sport, Zene & Életmód
    '5903': 'A hazai közmédia sportcsatornája: OTP Bank Liga, Forma-1, válogatott meccsek és Bajnokok Ligája élőben.',
    '6721': 'Az angol Premier League labdarúgó mérkőzéseinek és a nemzetközi motorsportnak az otthona.',
    '6722': 'A spanyol La Liga bajnokság hivatalos közvetítései: Real Madrid, Barcelona és rangadók élőben.',
    '6718': 'Kézilabda Bajnokok Ligája, NBA kosárlabda, darts és nemzetközi kupamérkőzések.',
    '6719': 'Élő európai futballbajnokságok, baseball, jégkorong és technikai sportok közvetítése.',
    '7084': 'NFL amerikai foci, MotoGP gyorsasági motoros világbajnokság és német Bundesliga meccsek.',
    '8271': 'Angol Premier League és francia Ligue 1 futball, IndyCar és nemzetközi sportversenyek.',
    '6748': 'A gasztronómia hazai otthona: mesterszakácsok, magyar konyha, sütemények és nemzetközi ízek.',
    '6751': 'Szokatlan emberi sorsok, esküvői műsorok, családi realityk és inspiráló élettörténetek.',
    '7087': 'Főzőműsorok, nemzetközi receptek, street food és kulináris utazások a nap minden órájában.',
    '6159': 'A legnépszerűbb magyar mulatós zene, örökzöld slágerek és nótaműsorok.',
    '6151': 'Hazai tánczene, lakodalmas slágerek, operett és nótaműsorok neves fellépőkkel.',
    '6162': 'Slágerek, retro koncertek, könnyűzene és népszerű hazai előadók zenei klipjei.',
    '6603': 'Életmód, egészség, szépségápolás, személyes beszélgetések és női magazinok.',
    '6455': 'Női szórakoztató csatorna: kapcsolatok, életmód, család, gasztronómia és inspiráló történetek.',
    '9311': 'Lakásfelújítás, belsőépítészet, barkácsolás és kreatív lakberendezési ötletek.',
    '5939': 'A hazai és nemzetközi galopp- és ügetőversenyek élő közvetítései és elemzései.',
    '9608': 'Küzdősportok, ökölvívás, MMA mérkőzések és harcművészeti gálák felvételei.',
    '9787': 'Szórakoztató és életmód programok a család minden tagjának.',

    # Rajzfilm & Gyerek
    '7079': 'Erőszakmentes, fejlesztő rajzfilmek és kedves mesék óvodásoknak és kisiskolásoknak.',
    '6764': 'SpongyaBob, A Mancs őrjárat, Veszélyes Henry és a legnépszerűbb vidám gyereksorozatok.',
    '6767': 'A Disney animációs sikerei, varázslatos kalandok és vicces ifjúsági sorozatok.',
    '6765': 'Kifejezetten a legkisebbeknek szóló, játékos és tanulást segítő kedves animációk.',
    '6705': 'Non-stop vicces rajzfilmek, akció-animációk és pörgős mesék a nap 24 órájában.',
    '6707': 'Klasszikus és modern európai mesék, családi rajzfilmsorozatok a legkisebbeknek.',
    '7080': 'Biztonságos és bájos mesék kicsiknek: Bob, a mester, Thomas és barátai, Sam, a tűzoltó.',
    '9309': 'Kedvenc rajzfilmek, ifjúsági animációk és játékos történetek.',

    # Helyi & Városi
    '4247': 'Debrecen és a hajdúsági térség hírei, közéleti és kulturális műsorai, magazinok és helyi közvetítések.',
    '1835': 'Tiszaújváros és a Tisza-menti térség híradója, közéleti és kulturális közvetítései.',
    '5982': 'Sopron és a Fertő-táj hírei, közéleti műsorai, kulturális programjai és helyi események tudósításai.',
    '1815': 'Székesfehérvár és Fejér vármegye hírei, kulturális, közéleti és sportműsorai.',
    '1853': 'Nyíregyháza és Szabolcs-Szatmár-Bereg vármegye helyi hírfolyama, magazinjai és rendezvényei.',
    '1901': 'Kecskemét és a hírös város környékének híradója, közéleti magazinműsorai.',
    '1827': 'Szombathely és Vas vármegye helyi televíziója: hírösszefoglalók, kultúra és sport.',
    '1829': 'Zalaegerszeg és a zalai dombság híradása, városi tudósítások és kulturális műsorok.',
    '5137': 'Kaposvár és a somogyi régió eseményei, helyi híradó és közösségi programok.',
    '1035': 'Eger és a hevesi térség hírei, borászat, történelem és kulturális események.',
    '4788': 'Szolnok és a Jászkunság hírei, regionális magazinok és eseményközvetítések.',
    '1821': 'Gyöngyös és a Mátraalja televíziója: hírek, szüreti programok és közélet.',
    '5425': 'Békés vármegye és Békéscsaba hírtelevíziója: helyi riportok, gazdaság és kultúra.',
    '3858': 'Baja és a bácskai Duna-part hírei, halászlé fesztivál és helyi közösségi élet.',
    '1811': 'Nagykanizsa és a dél-zalai térség híradója, gazdasági és kulturális magazinja.',
    '1812': 'Keszthely és a Nyugat-Balaton hírei, kastélyprogramok és balatoni események.',
    '5443': 'Budaörs és a budai agglomeráció hírei, helyi önkormányzati és kulturális magazin.'
}

all_channels_js = []
total_count = 0

for cat_id, cat_info in ORDERED_CATEGORIES.items():
    for cid in cat_info["ids"]:
        ch = channels_by_id.get(cid)
        if not ch:
            print(f"Warning: Channel {cid} not found!")
            continue

        total_count += 1
        name = ch["name"]
        mtva_key = MTVA_CHANNEL_MAPPING.get(cid)

        # Build curated description
        if cid in DESCRIPTIONS:
            desc = DESCRIPTIONS[cid]
        else:
            desc = f"{name} helyi hírfolyama, önkormányzati hírei, térségi magazinműsorai és rendezvényei."

        # Format stream servers
        streams_list = []
        for s in ch.get("streams", []):
            streams_list.append({
                "sub_idx": s.get("sub_idx", 1),
                "url": s.get("direct_stream_url") or "",
                "host": s.get("stream_host") or "",
                "features": ch.get("features") or "",
                "playerUrl": s.get("player_url") or "",
                "onlineUrl": s.get("online_url") or ch.get("online_url") or ""
            })

        all_channels_js.append({
            "id": f"onlinestream-live-{cid}",
            "channelId": str(cid),
            "name": name,
            "category": cat_id,
            "type": "movie",
            "year": "ÉLŐ • HD",
            "releaseInfo": "ÉLŐ • HD",
            "description": desc,
            "mtvaKey": mtva_key,
            "streams": streams_list,
            "behaviorHints": {
                "defaultVideoId": f"onlinestream-live-{cid}",
                "isLive": True
            }
        })

print(f"Total compiled channels: {len(all_channels_js)} across 6 categories.")

categories_list = [
    {
        "id": info["id"],
        "name": info["name"],
        "type": "movie",
        "category": "tv",
        "description": info["description"],
        "defaultEnabled": True,
        "count": len(info["ids"])
    }
    for info in ORDERED_CATEGORIES.values()
]

# Build the complete JS file
js_content = f"""/**
 * High Performance OnlineStream.live Scraper & Live TV Provider
 * Auto-generated with 146 Hungarian live TV channels categorized & sorted by popularity.
 * Features Real-Time HLS Variant Extraction (1080p FHD + Auto Master) + Universal HLS Proxy.
 */

const fetch = globalThis.fetch;
const {{ getMediaKlikkLiveStreams }} = require('./mediaklikk');

const HOST_URL = process.env.HOST_URL || 'https://nuvio-magyar-http.vercel.app';

// In-Memory Stream Cache (TTL: 2 minutes) for instant sub-second response
const STREAM_CACHE = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

const ONLINESTREAM_CATEGORIES = {json.dumps(categories_list, ensure_ascii=False, indent=2)};

const ALL_CHANNELS = {json.dumps(all_channels_js, ensure_ascii=False, indent=2)};

const CHANNELS_BY_ID = new Map(ALL_CHANNELS.map(ch => [ch.id, ch]));
const CHANNELS_BY_NUM_ID = new Map(ALL_CHANNELS.map(ch => [ch.channelId, ch]));

function normalize(str) {{
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}}

/**
 * Returns channels for a catalog (or filtered by search query) with dynamic vector artwork URLs
 */
function getOnlineStreamChannels(catalogId, query = '', hostUrl = HOST_URL) {{
  let list = ALL_CHANNELS;
  if (catalogId && catalogId !== 'all') {{
    list = list.filter(ch => ch.category === catalogId);
  }}
  if (query) {{
    const qNorm = normalize(query);
    list = list.filter(ch =>
      normalize(ch.name).includes(qNorm) ||
      normalize(ch.description).includes(qNorm) ||
      ch.channelId === qNorm
    );
  }}

  const cleanHost = hostUrl || HOST_URL;
  return list.map(ch => ({{
    ...ch,
    poster: `${{cleanHost}}/tv-posters/${{ch.channelId}}.png`,
    background: `${{cleanHost}}/tv-backgrounds/${{ch.channelId}}.png`,
    logo: `${{cleanHost}}/tv-logos/${{ch.channelId}}.png`
  }}));
}}

/**
 * Returns metadata for a live TV channel with dynamic vector artwork URLs
 */
function getOnlineStreamMeta(id, arg2 = 'movie', arg3 = null) {{
  if (!id) return null;
  let type = 'movie';
  let hostUrl = HOST_URL;

  if (typeof arg2 === 'string' && (arg2.startsWith('http://') || arg2.startsWith('https://'))) {{
    hostUrl = arg2;
  }} else if (arg2) {{
    type = arg2;
    if (typeof arg3 === 'string' && (arg3.startsWith('http://') || arg3.startsWith('https://'))) {{
      hostUrl = arg3;
    }}
  }}

  const cleanId = String(id).trim();
  const numId = cleanId.replace('onlinestream-live-', '').replace('mediaklikk-live-', '');
  const ch = CHANNELS_BY_ID.get(cleanId) || CHANNELS_BY_NUM_ID.get(numId) || ALL_CHANNELS.find(c => c.mtvaKey && c.mtvaKey === cleanId);
  if (!ch) return null;

  const cleanHost = hostUrl || HOST_URL;
  return {{
    meta: {{
      id: ch.id,
      type: type || 'movie',
      name: ch.name,
      poster: `${{cleanHost}}/tv-posters/${{ch.channelId}}.png`,
      background: `${{cleanHost}}/tv-backgrounds/${{ch.channelId}}.png`,
      logo: `${{cleanHost}}/tv-logos/${{ch.channelId}}.png`,
      description: ch.description,
      releaseInfo: ch.releaseInfo || 'ÉLŐ • HD',
      year: ch.year || 'ÉLŐ • HD',
      posterShape: 'poster',
      behaviorHints: {{
        defaultVideoId: ch.id,
        isLive: true
      }}
    }}
  }};
}}

/**
 * Parses HLS Master Playlist variants (#EXT-X-STREAM-INF) to extract highest resolution sub-playlist
 */
function parseHlsVariants(m3u8Content, masterUrl) {{
  const lines = m3u8Content.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
  const variants = [];
  let currentInfo = null;

  for (let i = 0; i < lines.length; i++) {{
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF:')) {{
      const resMatch = line.match(/RESOLUTION=(\\d+)x(\\d+)/i);
      const bwMatch = line.match(/BANDWIDTH=(\\d+)/i);
      const width = resMatch ? parseInt(resMatch[1], 10) : 0;
      const height = resMatch ? parseInt(resMatch[2], 10) : 0;
      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      currentInfo = {{ width, height, bandwidth }};
    }} else if (currentInfo && !line.startsWith('#')) {{
      try {{
        const fullUrl = new URL(line, masterUrl).toString();
        variants.push({{
          url: fullUrl,
          width: currentInfo.width,
          height: currentInfo.height,
          bandwidth: currentInfo.bandwidth,
          quality: currentInfo.height ? `${{currentInfo.height}}p` : `${{Math.round(currentInfo.bandwidth / 1000)}}k`
        }});
      }} catch (e) {{}}
      currentInfo = null;
    }}
  }}

  variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));
  return variants;
}}

/**
 * Resolves a server configuration to a verified working master m3u8 and top variant m3u8
 */
async function resolveServerStream(serverConfig) {{
  const cacheKey = serverConfig.url || serverConfig.onlineUrl || serverConfig.playerUrl;
  const cached = STREAM_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {{
    return cached.data;
  }}

  let masterUrl = serverConfig.url;

  // 1. If ConnectMedia, redirect, or missing URL: fetch onlineUrl or playerUrl to extract fresh token
  const pageUrl = serverConfig.onlineUrl || serverConfig.playerUrl;
  if (pageUrl && (!masterUrl || masterUrl.includes('connectmedia.hu') || masterUrl.includes('redirect.onlinestream.live'))) {{
    try {{
      const pageRes = await fetch(pageUrl, {{
        headers: {{
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://onlinestream.live/'
        }},
        signal: AbortSignal.timeout(3000)
      }});
      if (pageRes.ok) {{
        const html = await pageRes.text();
        const m = html.match(/https?:\\/\\/[^\\s"'<>]+\\.m3u8[^\\s"'<>]*/i);
        if (m) {{
          masterUrl = m[0];
        }}
      }}
    }} catch (e) {{}}
  }}

  if (!masterUrl) return null;

  // 2. Fetch master m3u8 and parse variants
  try {{
    const res = await fetch(masterUrl, {{
      headers: {{
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://onlinestream.live/'
      }},
      signal: AbortSignal.timeout(3500)
    }});

    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('#EXTM3U')) return null;

    const variants = parseHlsVariants(text, masterUrl);
    const topVariant = variants.length > 0 ? variants[0] : null;

    const data = {{
      masterUrl,
      topVariantUrl: topVariant ? topVariant.url : masterUrl,
      quality: topVariant ? (topVariant.quality === '1080p' ? '1080p FHD' : topVariant.quality) : '1080p / 720p HD',
      height: topVariant ? topVariant.height : 1080
    }};

    STREAM_CACHE.set(cacheKey, {{ data, timestamp: Date.now() }});
    return data;
  }} catch (err) {{
    return null;
  }}
}}

/**
 * Returns stream array for a live TV channel
 * Never returns both title and description on Stream objects (only name, title, url, behaviorHints).
 */
async function getOnlineStreamStreams(channelIdOrKey, clientIp = null, hostUrl = HOST_URL) {{
  const cleanId = String(channelIdOrKey || '').trim();
  const numId = cleanId.replace('onlinestream-live-', '').replace('mediaklikk-live-', '');

  const ch = CHANNELS_BY_ID.get(cleanId) ||
             CHANNELS_BY_NUM_ID.get(numId) ||
             ALL_CHANNELS.find(c => c.mtvaKey && c.mtvaKey === cleanId);

  if (!ch) return [];

  const results = [];
  const cleanHost = hostUrl || HOST_URL;

  // 1. Primary: If MTVA channel, fetch official MTVA 1080p HLS stream first!
  if (ch.mtvaKey) {{
    try {{
      const mtvaStreams = await getMediaKlikkLiveStreams(ch.mtvaKey, clientIp, cleanHost);
      if (Array.isArray(mtvaStreams) && mtvaStreams.length > 0) {{
        results.push(...mtvaStreams);
      }}
    }} catch (err) {{
      console.warn(`[OnlineStream] MTVA stream fallback for ${{ch.name}}:`, err.message);
    }}
  }}

  // 2. Secondary & Backup: Resolve OnlineStream direct HLS servers in parallel
  if (Array.isArray(ch.streams) && ch.streams.length > 0) {{
    const resolvedServers = await Promise.allSettled(
      ch.streams.map(s => resolveServerStream(s))
    );

    const directStreams = [];
    const proxyStreams = [];
    let activeIndex = 1;

    for (let i = 0; i < ch.streams.length; i++) {{
      const outcome = resolvedServers[i];
      const s = ch.streams[i];
      const res = outcome.status === 'fulfilled' ? outcome.value : null;

      if (!res && !s.url) continue;

      const serverHost = s.host || (res?.masterUrl ? new URL(res.masterUrl).hostname : `Szerver #${{activeIndex}}`);
      const quality = res?.quality || (s.features && !s.features.includes('-') ? s.features : '1080p FHD');
      const topUrl = res?.topVariantUrl || s.url;
      const masterUrl = res?.masterUrl || s.url;

      if (topUrl) {{
        // 1. KÖZVETLEN .m3u8 stream (LEGELÖL)
        directStreams.push({{
          name: `🔴 [HU] ${{ch.name}} — ${{quality}} (.m3u8)`,
          title: `📡 ${{ch.name}} • ${{serverHost}}\\n${{quality}} Közvetlen HLS Adás (.m3u8)\\nOnlineStream Forrás`,
          url: topUrl,
          behaviorHints: {{
            notWebReady: false,
            isLive: true
          }}
        }});

        // Proxy változat (később kerül be a lista végére)
        proxyStreams.push({{
          name: `⚡ [HU] ${{ch.name}} — ${{quality}} (HLS Proxy)`,
          title: `🚀 ${{ch.name}} • Akadozásmentes HLS Proxy\\n${{quality}} • Azonnali Nuvio / ExoPlayer Indulás\\nOnlineStream Forrás`,
          url: `${{cleanHost}}/proxy/hls.m3u8?url=${{encodeURIComponent(topUrl)}}`,
          behaviorHints: {{
            notWebReady: false,
            isLive: true
          }}
        }});
      }}

      // 2. KÖZVETLEN Auto Adaptív master .m3u8 stream (2. HELYEN)
      if (masterUrl && masterUrl !== topUrl) {{
        directStreams.push({{
          name: `🔴 [HU] ${{ch.name}} — Auto (.m3u8)`,
          title: `📡 ${{ch.name}} • ${{serverHost}}\\nAdaptív HLS Master Playlist (.m3u8)\\nOnlineStream Forrás`,
          url: masterUrl,
          behaviorHints: {{
            notWebReady: false,
            isLive: true
          }}
        }});

        proxyStreams.push({{
          name: `⚡ [HU] ${{ch.name}} — Auto (HLS Proxy)`,
          title: `🚀 ${{ch.name}} • Akadozásmentes Auto Proxy\\nAdaptív felbontás • OnlineStream Forrás`,
          url: `${{cleanHost}}/proxy/hls.m3u8?url=${{encodeURIComponent(masterUrl)}}`,
          behaviorHints: {{
            notWebReady: false,
            isLive: true
          }}
        }});
      }}

      activeIndex++;
    }}

    // MINDIG a közvetlen .m3u8 streamek legyenek legelöl az 1. és 2. helyen!
    results.push(...directStreams);
    // És csak ezek UTÁN jöjjenek a Proxy streamek!
    results.push(...proxyStreams);
  }}

  // 3. Fallback: If no stream resolved yet but a stream or playerUrl exists, add safe fallback
  if (results.length === 0 && Array.isArray(ch.streams) && ch.streams.length > 0) {{
    const firstStream = ch.streams[0];
    const targetUrl = firstStream.url || firstStream.playerUrl || firstStream.onlineUrl;
    if (targetUrl) {{
      results.push({{
        name: `🔴 [HU] ${{ch.name}} [Tartalék Adás]`,
        title: `📡 ${{ch.name}} • Tartalék IPTV Közvetítés\\nOnlineStream IPTV Forrás`,
        url: targetUrl,
        behaviorHints: {{
          notWebReady: false,
          isLive: true
        }}
      }});
    }}
  }}

  return results;
}}

module.exports = {{
  ONLINESTREAM_CATEGORIES,
  ALL_CHANNELS,
  getOnlineStreamChannels,
  getOnlineStreamMeta,
  getOnlineStreamStreams
}};
"""

out_path = r"C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http\src\scrapers\onlinestream.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Successfully generated {out_path} ({len(js_content)} bytes)")
