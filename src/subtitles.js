/**
 * Hungarian Subtitles Provider (OpenSubtitles v3 + TMDB->IMDb Bridge)
 * Returns direct UTF-8 transcoded .srt subtitle URLs with zero proxying.
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ffe7ef8916c61835264d2df68276ddc2';
const SUBTITLES_CACHE = new Map();
const IMDB_FROM_TMDB_CACHE = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 150;

function setBoundedCache(map, key, val) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, val);
}

/**
 * Resolves a `tmdb:<id>` (optional `:season:episode`) identifier into an IMDb `tt...` identifier.
 */
async function resolveImdbIdForSubtitles(type, rawId) {
  const clean = String(rawId || '').trim();
  if (clean.startsWith('tt')) return clean;
  if (!clean.startsWith('tmdb:')) return null;

  const parts = clean.split(':');
  const tmdbNum = parts[1];
  if (!tmdbNum || !/^\d+$/.test(tmdbNum)) return null;

  const suffix = parts.length >= 4 ? `:${parts[2]}:${parts[3]}` : '';
  const mapKey = `${type}:${tmdbNum}`;
  let imdbBase = IMDB_FROM_TMDB_CACHE.get(mapKey);

  if (!imdbBase) {
    const kind = type === 'series' ? 'tv' : 'movie';
    try {
      const url = `https://api.themoviedb.org/3/${kind}/${tmdbNum}/external_ids?api_key=${TMDB_API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data?.imdb_id && String(data.imdb_id).startsWith('tt')) {
          imdbBase = String(data.imdb_id);
          setBoundedCache(IMDB_FROM_TMDB_CACHE, mapKey, imdbBase);
        }
      }
    } catch {}
  }

  return imdbBase ? `${imdbBase}${suffix}` : null;
}

/**
 * Fetches Hungarian subtitles (`lang === 'hun'`) from OpenSubtitles v3 Stremio addon.
 * @param {string} type 'movie' or 'series'
 * @param {string} rawId IMDb (`tt...` or `tt...:S:E`) or TMDB (`tmdb:...`) ID
 * @returns {Promise<Array>} Normalized Hungarian subtitle objects
 */
async function getSubtitles(type, rawId) {
  let cleanId = String(rawId || '').replace(/\.json$/i, '').trim();
  try {
    cleanId = decodeURIComponent(cleanId);
  } catch {}
  if (!cleanId) return [];

  const stremioType = type === 'series' ? 'series' : 'movie';
  const cacheKey = `${stremioType}:${cleanId}`;
  const cached = SUBTITLES_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.subtitles;
  }

  const targetId = await resolveImdbIdForSubtitles(stremioType, cleanId);
  if (!targetId || !targetId.startsWith('tt')) {
    return [];
  }

  try {
    const url = `https://opensubtitles-v3.strem.io/subtitles/${stremioType}/${encodeURIComponent(targetId)}.json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return [];

    const data = await res.json();
    const rawList = Array.isArray(data?.subtitles) ? data.subtitles : [];
    const seenUrls = new Set();
    const hunSubtitles = [];

    for (const s of rawList) {
      if (!s || !s.url) continue;
      const lang = String(s.lang || '').toLowerCase().trim();
      if (lang !== 'hun' && lang !== 'hu') continue;
      if (seenUrls.has(s.url)) continue;
      seenUrls.add(s.url);

      hunSubtitles.push({
        id: String(s.id || `hu-${hunSubtitles.length + 1}`),
        url: String(s.url),
        lang: 'hun',
        SubEncoding: s.SubEncoding || 'UTF-8',
        movieReleaseName: s.movieReleaseName || s.subtitleFileName || 'Magyar felirat'
      });
    }

    setBoundedCache(SUBTITLES_CACHE, cacheKey, { ts: Date.now(), subtitles: hunSubtitles });
    return hunSubtitles;
  } catch {
    return [];
  }
}

module.exports = { getSubtitles };
