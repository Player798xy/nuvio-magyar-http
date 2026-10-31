const { UA, normalizeTitle } = require('../utils/meta');
const { HU_IP } = require('../utils/proxy');

/**
 * MédiaKlikk (MTVA) Live TV & VOD Archive Scraper
 * Provides:
 * 1. 7 Official Hungarian Live TV Channels (M1, M2, M4 Sport, M4 Sport+, M5, Duna, Duna World) in 1080p FHD HLS
 * 2. On-demand (VOD) Hungarian movies, series, and classic cartoons from MTVA's archive.
 */
const LIVE_CHANNELS = [
  {
    id: 'mediaklikk-live-m4',
    channelKey: 'm4',
    streamId: 'mtv4live',
    pageUrl: 'https://m4sport.hu/elo/',
    name: 'M4 Sport Élő',
    type: 'movie',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/M4_Sport_logo_2015.svg/512px-M4_Sport_logo_2015.svg.png',
    year: 'ÉLŐ • 1080p FHD',
    description: 'A nemzeti sportcsatorna: Forma-1, NB I, Bajnokok Ligája és nemzetközi sportközvetítések élőben.'
  },
  {
    id: 'mediaklikk-live-m4plus',
    channelKey: 'm4plus',
    streamId: 'mtv4plus',
    pageUrl: 'https://mediaklikk.hu/m4-sport-plusz-elo/',
    name: 'M4 Sport+ Élő',
    type: 'movie',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/M4_Sport_logo_2015.svg/512px-M4_Sport_logo_2015.svg.png',
    year: 'ÉLŐ • 1080p FHD',
    description: 'M4 Sport Plusz: párhuzamos hazai és nemzetközi sportközvetítések élőben.'
  },
  {
    id: 'mediaklikk-live-m1',
    channelKey: 'm1',
    streamId: 'mtv1live',
    pageUrl: 'https://mediaklikk.hu/elo/mtv1live/',
    name: 'M1 Híradó Élő',
    type: 'movie',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/M1_logo_2015.svg/512px-M1_logo_2015.svg.png',
    year: 'ÉLŐ • 1080p FHD',
    description: 'Nemzeti hírcsatorna: élő híradások, percről percre frissülő tudósítások 24 órában.'
  },
  {
    id: 'mediaklikk-live-m2',
    channelKey: 'm2',
    streamId: 'mtv2live',
    pageUrl: 'https://mediaklikk.hu/elo/mtv2live/',
    name: 'M2 Gyerek & Petőfi TV Élő',
    type: 'movie',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/M2_logo_2015.svg/512px-M2_logo_2015.svg.png',
    year: 'ÉLŐ • 1080p FHD',
    description: 'Nappal M2 Gyerekcsatorna (rajzfilmek, mesék), este M2 Petőfi TV (zene, koncertek, magazinok).'
  },
  {
    id: 'mediaklikk-live-m5',
    channelKey: 'm5',
    streamId: 'mtv5live',
    pageUrl: 'https://mediaklikk.hu/elo/mtv5live/',
    name: 'M5 Kultúra Élő',
    type: 'movie',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/M5_logo_2016.svg/512px-M5_logo_2016.svg.png',
    year: 'ÉLŐ • 1080p FHD',
    description: 'Kulturális, oktatási és tudományos csatorna: színházi közvetítések, dokumentumfilmek.'
  },
  {
    id: 'mediaklikk-live-duna',
    channelKey: 'duna',
    streamId: 'dunalive',
    pageUrl: 'https://mediaklikk.hu/elo/duna/',
    name: 'Duna TV Élő',
    type: 'movie',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Duna_logo_2015.svg/512px-Duna_logo_2015.svg.png',
    year: 'ÉLŐ • 1080p FHD',
    description: 'A nemzeti főadó: magyar filmek, sorozatok, családi és kulturális műsorok élőben.'
  },
  {
    id: 'mediaklikk-live-dunaworld',
    channelKey: 'dunaworld',
    streamId: 'dunaworldlive',
    pageUrl: 'https://mediaklikk.hu/elo/dunaworldlive/',
    name: 'Duna World Élő',
    type: 'movie',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Duna_World_logo_2015.svg/512px-Duna_World_logo_2015.svg.png',
    year: 'ÉLŐ • 1080p FHD',
    description: 'A határon túli magyarság csatornája: magyar klasszikusok és kulturális műsorok.'
  }
];

const liveCache = new Map();

async function resolveMtvaPlayerToken(videoIdOrToken) {
  const cached = liveCache.get(videoIdOrToken);
  if (cached && Date.now() - cached.time < 30 * 60 * 1000) {
    return cached.url;
  }

  try {
    const playerUrl = `https://player.mediaklikk.hu/playernew/player.php?video=${encodeURIComponent(videoIdOrToken)}`;
    const r = await fetch(playerUrl, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://mediaklikk.hu/'
      },
      signal: AbortSignal.timeout(5500)
    });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/"file":\s*"([^"]+\.m3u8[^"]*)"/i);
    if (m) {
      let url = m[1].replace(/\\\//g, '/');
      if (url.startsWith('//')) url = 'https:' + url;
      liveCache.set(videoIdOrToken, { url, time: Date.now() });
      return url;
    }
  } catch {}
  return null;
}

async function getLiveChannelStreams(channelId) {
  const clean = String(channelId || '').toLowerCase();
  const ch = LIVE_CHANNELS.find(
    (c) => c.id === clean || c.channelKey === clean || c.streamId === clean || clean.includes(c.channelKey)
  );
  if (!ch) return [];

  const hlsUrl = await resolveMtvaPlayerToken(ch.streamId);
  if (!hlsUrl) return [];

  return [
    {
      name: `🇭🇺 ${ch.name}\n1080p ÉLŐ`,
      title: `🔴 ${ch.name} (1080p FHD HLS)\n${ch.description}`,
      url: hlsUrl,
      quality: 1080,
      isHls: true,
      isLive: true,
      headers: {
        Referer: 'https://mediaklikk.hu/',
        Origin: 'https://mediaklikk.hu',
        'User-Agent': UA
      }
    }
  ];
}

function parseSeasonEpisode(title) {
  let s = null;
  let e = null;
  const slashMatch = title.match(/\b(I{1,3}|IV|V|\d+)\s*\/\s*(\d+)/i);
  if (slashMatch) {
    const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
    const sStr = slashMatch[1].toUpperCase();
    s = roman[sStr] || parseInt(sStr, 10);
    e = parseInt(slashMatch[2], 10);
  }
  if (e === null) {
    const eMatch = title.match(/(\d+)\.\s*rész/i);
    if (eMatch) e = parseInt(eMatch[1], 10);
  }
  return { season: s, episode: e };
}

async function searchMediaKlikk(meta) {
  const { imdbId, titles, type, season, episode } = meta;

  if (imdbId && (imdbId.startsWith('mediaklikk-live-') || LIVE_CHANNELS.some((c) => c.id === imdbId))) {
    return getLiveChannelStreams(imdbId);
  }

  if (imdbId && imdbId.startsWith('mediaklikk:video:')) {
    const token = decodeURIComponent(imdbId.replace('mediaklikk:video:', ''));
    const hlsUrl = await resolveMtvaPlayerToken(token);
    if (!hlsUrl) return [];
    return [
      {
        name: `🇭🇺 MédiaKlikk\n1080p FHD`,
        title: `🎬 MTVA Archívum\n📺 1080p HLS • 🔊 Magyar`,
        url: hlsUrl,
        quality: 1080,
        isHls: true,
        headers: { Referer: 'https://mediaklikk.hu/', 'User-Agent': UA }
      }
    ];
  }

  const streams = [];
  const searchUrl = 'https://mediaklikk.hu/wp-content/plugins/hms-mediaklikk/interfaces/get_results.php';

  for (const q of titles.slice(0, 2)) {
    try {
      const body = new URLSearchParams({
        action: 'search',
        s_type: 'video',
        keyword: q,
        fromDate: '2013-01-01',
        toDate: new Date().toISOString().slice(0, 10),
        pageSize: '30',
        getAudioPrograms: 'false'
      });

      const r = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Referer: `https://mediaklikk.hu/talalati-lista/?search_mk=${encodeURIComponent(q)}`
        },
        body: body.toString(),
        signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) continue;

      const data = await r.json();
      const items = data[0]?.data?.items || [];
      const normTarget = normalizeTitle(q);

      for (const item of items.slice(0, 8)) {
        const rawTitle = (item.post_title || item.source?.post_title || '').replace(/<[^>]+>/g, '').trim();
        const normItem = normalizeTitle(rawTitle);
        const token = item.token || item.source?.token;
        if (!token) continue;

        let isMatch = false;
        if (type === 'series' && episode) {
          const parsed = parseSeasonEpisode(rawTitle);
          if (parsed.episode === Number(episode) && (!season || !parsed.season || parsed.season === Number(season))) {
            isMatch = true;
          }
        } else if (normItem.includes(normTarget) || normTarget.includes(normItem)) {
          isMatch = true;
        }

        if (isMatch) {
          const hlsUrl = await resolveMtvaPlayerToken(token);
          if (hlsUrl) {
            streams.push({
              name: `🇭🇺 MédiaKlikk\n1080p`,
              title: `🎬 ${rawTitle}\n📺 1080p FHD HLS • 🔊 Magyar • 🌐 MTVA Archívum`,
              url: hlsUrl,
              quality: 1080,
              isHls: true,
              headers: { Referer: 'https://mediaklikk.hu/', 'User-Agent': UA }
            });
          }
        }
        if (streams.length >= 3) break;
      }
      if (streams.length > 0) break;
    } catch {}
  }

  return streams;
}

module.exports = {
  LIVE_CHANNELS,
  resolveMtvaPlayerToken,
  getLiveChannelStreams,
  searchMediaKlikk
};
