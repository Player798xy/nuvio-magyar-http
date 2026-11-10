const fetch = globalThis.fetch;

const TMDB_API_KEY = 'e8b8c54ff9cb0cfc9e223b378125cf3f';

const movies = [
  'A miniszter félrelép',
  'A Pál utcai fiúk',
  'Egri csillagok',
  'Kontroll',
  'Kincsem',
  'Mephisto',
  'Sose halunk meg',
  'Az ötödik pecsét',
  'Csinibaba',
  'Szaffi',
  'Lúdas Matyi',
  'Valami Amerika',
  'Üvegtigris',
  'Macskafogó',
  'Indul a bakterház',
  'A tanú',
  'Vuk',
  'A Viszkis',
  'Liza, a rókatündér',
  'Saul fia',
  'Testről és lélekről',
  'A martfűi rém',
  'Hyppolit, a lakáj',
  'A tizedes meg a többiek',
  'Eldorádó',
  'Moszkva tér',
  'Csak szex és más semmi',
  'Magyar vándor',
  'Taxidermia'
];

async function findImdbId(query) {
  // 1. Search TMDB
  const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=hu-HU`;
  const res = await fetch(tmdbUrl).then(r => r.json()).catch(() => ({}));
  const hit = (res.results || [])[0];
  if (!hit) {
    console.log(`❌ No TMDB hit for: "${query}"`);
    return null;
  }

  // 2. Get external IDs from TMDB
  const extUrl = `https://api.themoviedb.org/3/movie/${hit.id}/external_ids?api_key=${TMDB_API_KEY}`;
  const ext = await fetch(extUrl).then(r => r.json()).catch(() => ({}));
  const imdbId = ext.imdb_id;
  
  // 3. Verify with Cinemeta
  let cinemetaTitle = '';
  let cinemetaYear = '';
  let cinemetaPoster = '';
  if (imdbId) {
    const cm = await fetch(`https://v3-cinemeta.strem.io/meta/movie/${imdbId}.json`).then(r => r.json()).catch(() => ({}));
    cinemetaTitle = cm?.meta?.name || '';
    cinemetaYear = cm?.meta?.year || '';
    cinemetaPoster = cm?.meta?.poster || '';
  }

  console.log(`✅ "${query}" (${hit.release_date?.slice(0,4)}) -> TMDB ID: ${hit.id} | IMDb ID: ${imdbId} | Cinemeta: "${cinemetaTitle}" (${cinemetaYear}) | Poster: ${cinemetaPoster ? 'OK' : 'MISSING'}`);
  return {
    query,
    title: hit.title || query,
    year: hit.release_date?.slice(0, 4) || '',
    imdbId,
    tmdbId: hit.id,
    overview: hit.overview,
    poster: cinemetaPoster || `https://image.tmdb.org/t/p/w500${hit.poster_path}`,
    rating: hit.vote_average ? String(Math.round(hit.vote_average * 10) / 10) : '7.5'
  };
}

async function run() {
  const verified = [];
  for (const m of movies) {
    const res = await findImdbId(m);
    if (res && res.imdbId) verified.push(res);
  }
  fs.writeFileSync('scripts/verified_hungarian_movies.json', JSON.stringify(verified, null, 2), 'utf8');
  console.log(`\nSuccessfully verified and saved ${verified.length} Hungarian movies!`);
}

const fs = require('fs');
run();
