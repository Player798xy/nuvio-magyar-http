const { UA, normalizeTitle } = require('./utils/meta');
const { LIVE_CHANNELS } = require('./scrapers/mediaklikk');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ffe7ef8916c61835264d2df68276ddc2';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const CATALOG_DEFINITIONS = [
  {
    id: 'hu-live-tv',
    name: '🔴 Magyar Élő TV (M4 Sport, M1, Duna)',
    type: 'movie',
    extra: [{ name: 'search', isRequired: false }]
  },
  {
    id: 'hu-trending-movies',
    name: '🔥 Magyarországi Top Filmek',
    type: 'movie',
    extra: [{ name: 'search', isRequired: false }, { name: 'skip', isRequired: false }]
  },
  {
    id: 'hu-trending-series',
    name: '🔥 Magyarországi Top Sorozatok',
    type: 'series',
    extra: [{ name: 'search', isRequired: false }, { name: 'skip', isRequired: false }]
  },
  {
    id: 'hu-hungarian-movies',
    name: '🇭🇺 Klasszikus és Új Magyar Filmek',
    type: 'movie',
    extra: [{ name: 'search', isRequired: false }]
  },
  {
    id: 'hu-mediaklikk-classics',
    name: '🏛️ Magyar Retro & Mese Klasszikusok',
    type: 'series',
    extra: [{ name: 'search', isRequired: false }]
  }
];

const FEATURED_MOVIES = [
  { id: 'tt0179955', name: 'Macskafogó (Cat City)', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0179955/img', releaseInfo: '1986', description: 'Grabowski a szuperegér titkos küldetése a macskaszindikátus ellen Ternovszky Béla kultikus rajzfilmjében.' },
  { id: 'tt0257290', name: 'Üvegtigris', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0257290/img', releaseInfo: '2001', description: 'Kultikus magyar vígjáték Rudolf Péter rendezésében.' },
  { id: 'tt0065067', name: 'A tanú', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0065067/img', releaseInfo: '1969', description: 'Pelikán József gátőr legendás szatírája Bacsó Péter filmjében.' },
  { id: 'tt0121403', name: 'Indul a bakterház', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0121403/img', releaseInfo: '1980', description: 'Regős Bendegúz, a bakter és a banya felejthetetlen története.' },
  { id: 'tt0131636', name: 'Vuk', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0131636/img', releaseInfo: '1981', description: 'Fekete István regényéből készült rajzfilmklasszikus Dargay Attila rendezésében.' },
  { id: 'tt0303184', name: 'Valami Amerika', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0303184/img', releaseInfo: '2002', description: 'Három testvér és az amerikai filmproducer története.' },
  { id: 'tt0069697', name: 'Különben dühbe jövünk', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0069697/img', releaseInfo: '1974', description: 'Bud Spencer és Terence Hill kultikus akció-vígjátéka magyar szinkronnal.' },
  { id: 'tt0085327', name: 'Kincs, ami nincs', type: 'movie', poster: 'https://images.metahub.space/poster/medium/tt0085327/img', releaseInfo: '1981', description: 'Alan és Charlie kalandjai a lakatlan szigeten.' }
];

const FEATURED_SERIES = [
  { id: 'tt0861751', name: 'Magyar népmesék', type: 'series', poster: 'https://images.metahub.space/poster/medium/tt0861751/img', releaseInfo: '1980–2012', description: 'Klasszikus magyar népmesék animációs sorozat Szabó Gyula mesemondásával.' },
  { id: 'tt0154077', name: 'A nagy ho-ho-horgász', type: 'series', poster: 'https://images.metahub.space/poster/medium/tt0154077/img', releaseInfo: '1982–1984', description: 'A nagy ho-ho-horgász és a Főkukac kalandjai.' },
  { id: 'tt0129719', name: 'Süsü, a sárkány kalandjai', type: 'series', poster: 'https://m.media-amazon.com/images/M/MV5BYjBjN2Y1OGItYTRhNC00ZmZiLTk0NWItMTBjNzI5ZThjOTkyXkEyXkFqcGc@._V1_SX250.jpg', releaseInfo: '1977–1984', description: 'Csukás István legendás bábfilmsorozata a jólelkű egyfejű sárkányról.' },
  { id: 'tt0136650', name: 'Üzenet a jövőből - A Mézga család', type: 'series', poster: 'https://images.metahub.space/poster/medium/tt0136650/img', releaseInfo: '1969', description: 'Klasszikus magyar rajzfilmsorozat Nepp Zoltán és Romhányi József tollából.' },
  { id: 'tt0167595', name: 'Frakk, a macskák réme', type: 'series', poster: 'https://images.metahub.space/poster/medium/tt0167595/img', releaseInfo: '1971–1985', description: 'Károly bácsi, Irmuska, Lukrécia és Szerénke története.' },
  { id: 'tt0166931', name: 'Pom-Pom meséi', type: 'series', poster: 'https://images.metahub.space/poster/medium/tt0166931/img', releaseInfo: '1980–1984', description: 'Picur, Pom-Pom és Gombóc Artúr meséi.' },
  { id: 'tt0056789', name: 'A Tenkes kapitánya', type: 'series', poster: 'https://images.metahub.space/poster/medium/tt0056789/img', releaseInfo: '1964', description: 'Történelmi kalandfilmsorozat Zenthe Ferenc főszereplésével.' }
];

const imdbCache = new Map();
const catalogCache = new Map();

async function resolveTmdbToImdb(tmdbId, isSeries) {
  const key = `${isSeries ? 'tv' : 'movie'}:${tmdbId}`;
  if (imdbCache.has(key)) return imdbCache.get(key);
  try {
    const r = await fetch(`${TMDB_BASE}/${isSeries ? 'tv' : 'movie'}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(3500)
    });
    if (r.ok) {
      const data = await r.json();
      if (data.imdb_id) {
        imdbCache.set(key, data.imdb_id);
        return data.imdb_id;
      }
    }
  } catch {}
  return null;
}

async function mapTmdbList(results, isSeries) {
  const items = await Promise.all(
    (results || []).slice(0, 18).map(async (item) => {
      const imdbId = await resolveTmdbToImdb(item.id, isSeries);
      if (!imdbId) return null;
      const year = (item.release_date || item.first_air_date || '').slice(0, 4);
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : `https://images.metahub.space/poster/medium/${imdbId}/img`;
      return {
        id: imdbId,
        type: isSeries ? 'series' : 'movie',
        name: item.title || item.name || item.original_title,
        poster,
        description: item.overview || '',
        releaseInfo: year
      };
    })
  );
  return items.filter(Boolean);
}

async function getCatalogMetas(type, catalogId, extra = {}) {
  const search = extra.search ? String(extra.search).trim() : '';

  if (search) {
    const isSeries = type === 'series';
    try {
      const url = `${TMDB_BASE}/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&language=hu-HU&query=${encodeURIComponent(search)}&page=1`;
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4500) });
      if (r.ok) {
        const data = await r.json();
        const mapped = await mapTmdbList(data.results, isSeries);
        if (mapped.length > 0) return mapped;
      }
    } catch {}

    const pool = isSeries ? FEATURED_SERIES : [...LIVE_CHANNELS, ...FEATURED_MOVIES];
    const normQ = normalizeTitle(search);
    return pool.filter((item) => normalizeTitle(item.name).includes(normQ));
  }

  if (catalogId === 'hu-live-tv') {
    return LIVE_CHANNELS.map((c) => ({
      id: c.id,
      type: 'movie',
      name: c.name,
      poster: c.poster,
      description: c.description,
      releaseInfo: c.year
    }));
  }

  if (catalogId === 'hu-mediaklikk-classics') {
    return FEATURED_SERIES;
  }

  const cacheKey = `${type}:${catalogId}`;
  if (catalogCache.has(cacheKey)) {
    const cached = catalogCache.get(cacheKey);
    if (Date.now() - cached.time < 30 * 60 * 1000) return cached.items;
  }

  try {
    let tmdbUrl = null;
    const isSeries = type === 'series';
    if (catalogId === 'hu-trending-movies') {
      tmdbUrl = `${TMDB_BASE}/trending/movie/week?api_key=${TMDB_API_KEY}&language=hu-HU&region=HU`;
    } else if (catalogId === 'hu-trending-series') {
      tmdbUrl = `${TMDB_BASE}/trending/tv/week?api_key=${TMDB_API_KEY}&language=hu-HU&region=HU`;
    } else if (catalogId === 'hu-hungarian-movies') {
      tmdbUrl = `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=hu-HU&with_original_language=hu&sort_by=vote_count.desc`;
    }

    if (tmdbUrl) {
      const r = await fetch(tmdbUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const data = await r.json();
        const items = await mapTmdbList(data.results, isSeries);
        if (items.length > 0) {
          catalogCache.set(cacheKey, { items, time: Date.now() });
          return items;
        }
      }
    }
  } catch {}

  return type === 'series' ? FEATURED_SERIES : FEATURED_MOVIES;
}

async function getCustomMeta(type, id) {
  const ch = LIVE_CHANNELS.find((c) => c.id === id);
  if (ch) {
    return {
      id: ch.id,
      type: 'movie',
      name: ch.name,
      poster: ch.poster,
      background: ch.poster,
      description: ch.description,
      releaseInfo: ch.year,
      genres: ['Élő TV', 'Magyar', 'MTVA']
    };
  }
  return null;
}

module.exports = {
  CATALOG_DEFINITIONS,
  getCatalogMetas,
  getCustomMeta
};
