const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Hungarian title normalizer, Roman numeral helper, and similarity matcher.
 */
function stripAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeTitle(str) {
  return stripAccents(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROMAN_MAP = {
  1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v',
  6: 'vi', 7: 'vii', 8: 'viii', 9: 'ix', 10: 'x'
};

function toRoman(num) {
  return ROMAN_MAP[num] || String(num);
}

/**
 * Checks whether a candidate title from a Hungarian streaming site matches
 * the target Hungarian or English title and optional release year.
 */
function isTitleMatch(candidateRaw, targetTitles = [], targetYear = null) {
  if (!candidateRaw) return false;
  const candNorm = normalizeTitle(candidateRaw);
  if (!candNorm) return false;

  const yearInCand = (String(candidateRaw).match(/\b(19\d{2}|20\d{2})\b/) || [])[1];
  if (targetYear && yearInCand) {
    const diff = Math.abs(parseInt(yearInCand, 10) - parseInt(targetYear, 10));
    if (diff > 2) return false;
  }

  for (const t of targetTitles) {
    if (!t) continue;
    const tNorm = normalizeTitle(t);
    if (!tNorm || tNorm.length < 2) continue;

    if (candNorm === tNorm) return true;
    if (candNorm.includes(tNorm) || tNorm.includes(candNorm)) {
      const wordsT = tNorm.split(' ').filter(Boolean);
      const wordsC = candNorm.split(' ').filter(Boolean);
      if (wordsT.length === 1) {
        if (wordsC.includes(wordsT[0])) return true;
      } else {
        const hitCount = wordsT.filter(w => wordsC.includes(w)).length;
        if (hitCount / wordsT.length >= 0.65) return true;
      }
    }
  }
  return false;
}

/**
 * Resolves IMDb ID (e.g. tt0499549) or custom prefix ID into metadata:
 * - English title (`enTitle`)
 * - Hungarian localized title (`huTitle`) via Wikidata SPARQL / Wikipedia / Cinemeta
 * - Release year (`year`)
 * - Type (`movie` or `series`), `season`, `episode`
 */
const metaCache = new Map();

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ffe7ef8916c61835264d2df68276ddc2';

async function fetchTmdbTitles(imdbId) {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=hu-HU`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const hit = (data.movie_results || [])[0] || (data.tv_results || [])[0];
    if (!hit) return null;
    const yearStr = (hit.release_date || hit.first_air_date || '').slice(0, 4);
    return {
      huTitle: hit.title || hit.name || null,
      enTitle: hit.original_title || hit.original_name || null,
      year: yearStr ? parseInt(yearStr, 10) : null,
      poster: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : null
    };
  } catch {
    return null;
  }
}

async function resolveMeta(type, idRaw) {
  const parts = String(idRaw || '').split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1], 10) : null;
  const episode = parts[2] ? parseInt(parts[2], 10) : null;

  const cacheKey = `${type}:${imdbId}`;
  if (metaCache.has(cacheKey)) {
    const cached = metaCache.get(cacheKey);
    return { ...cached, season, episode };
  }

  if (!imdbId.startsWith('tt')) {
    return {
      imdbId,
      enTitle: imdbId,
      huTitle: imdbId,
      year: null,
      type,
      season,
      episode,
      titles: [imdbId]
    };
  }

  const [cinemetaRes, wikidataRes, tmdbRes] = await Promise.allSettled([
    fetchCinemeta(type, imdbId),
    fetchWikidataHungarianTitle(imdbId),
    fetchTmdbTitles(imdbId)
  ]);

  const cinemeta = cinemetaRes.status === 'fulfilled' ? cinemetaRes.value : null;
  const wikidata = wikidataRes.status === 'fulfilled' ? wikidataRes.value : null;
  const tmdb = tmdbRes.status === 'fulfilled' ? tmdbRes.value : null;

  const enTitle = cinemeta?.name || tmdb?.enTitle || wikidata?.enTitle || imdbId;
  const huTitle = tmdb?.huTitle || wikidata?.huTitle || cinemeta?.name || enTitle;
  const year = cinemeta?.year || tmdb?.year || wikidata?.year || null;

  const titles = [...new Set([huTitle, tmdb?.huTitle, wikidata?.huTitle, enTitle, ...(wikidata?.aliases || [])].filter(Boolean))];

  const result = {
    imdbId,
    enTitle,
    huTitle,
    year,
    poster: cinemeta?.poster || tmdb?.poster || null,
    background: cinemeta?.background || null,
    description: wikidata?.huDescription || cinemeta?.description || '',
    type,
    titles
  };

  metaCache.set(cacheKey, result);
  return { ...result, season, episode };
}

async function fetchCinemeta(type, imdbId) {
  const mediaType = type === 'series' ? 'series' : 'movie';
  const url = `https://v3-cinemeta.strem.io/meta/${mediaType}/${imdbId}.json`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(5000)
  });
  if (!r.ok) return null;
  const data = await r.json();
  const meta = data?.meta;
  if (!meta) return null;
  const yearMatch = String(meta.releaseInfo || meta.year || '').match(/\b(19\d{2}|20\d{2})\b/);
  return {
    name: meta.name,
    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    poster: meta.poster,
    background: meta.background,
    description: meta.description
  };
}

async function fetchWikidataHungarianTitle(imdbId) {
  const sparql = `
    SELECT ?itemLabel_hu ?itemLabel_en ?huWikiTitle ?pubYear WHERE {
      ?item wdt:P345 "${imdbId}".
      OPTIONAL { ?item rdfs:label ?itemLabel_hu FILTER(LANG(?itemLabel_hu) = "hu") }
      OPTIONAL { ?item rdfs:label ?itemLabel_en FILTER(LANG(?itemLabel_en) = "en") }
      OPTIONAL {
        ?huWiki schema:about ?item;
                schema:isPartOf <https://hu.wikipedia.org/>;
                schema:name ?huWikiTitle.
      }
      OPTIONAL { ?item wdt:P577 ?pubDate. BIND(YEAR(?pubDate) AS ?pubYear) }
    }
    LIMIT 3
  `;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'NuvioMagyarAddon/2.0 (https://nuvio.app)',
      'Accept': 'application/sparql-results+json'
    },
    signal: AbortSignal.timeout(4500)
  });
  if (!r.ok) return null;
  const data = await r.json();
  const bindings = data?.results?.bindings || [];
  if (!bindings.length) return null;

  const first = bindings[0];
  const rawWiki = first.huWikiTitle?.value
    ? first.huWikiTitle.value.replace(/\s*\([^)]*\)\s*$/, '').trim()
    : null;
  const huLabel = first.itemLabel_hu?.value || null;
  const enLabel = first.itemLabel_en?.value || null;
  const year = first.pubYear?.value ? parseInt(first.pubYear.value, 10) : null;

  const aliases = [huLabel, rawWiki, enLabel].filter(Boolean);
  return {
    huTitle: huLabel || rawWiki || enLabel,
    enTitle: enLabel,
    year,
    aliases
  };
}

module.exports = {
  UA,
  stripAccents,
  normalizeTitle,
  toRoman,
  isTitleMatch,
  resolveMeta
};
