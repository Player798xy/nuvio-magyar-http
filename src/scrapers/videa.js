const { UA, isTitleMatch } = require('../utils/meta');
const { extractVideaStreams } = require('../utils/videa_indavideo');

const JUNK_TITLE_REGEX = /\b(filmzene|zene|soundtrack|ost|paródia|parodia|főcímdal|focimdal|trailer|előzetes|elozetes|interjú|interju)\b/i;

async function searchVidea(meta) {
  const { titles, year, type, season, episode } = meta;
  const isMovie = type === 'movie' || !season;
  const minDuration = isMovie ? 2100 : 500;
  const queries = [];

  for (const t of titles.slice(0, 2)) {
    if (!isMovie && season && episode) {
      const sPad = String(season).padStart(2, '0');
      const ePad = String(episode).padStart(2, '0');
      queries.push(`${t} S${sPad}E${ePad}`);
      queries.push(`${t} ${episode}. resz`);
      queries.push(`${t} ${season}x${ePad}`);
    } else {
      queries.push(`${t} teljes film`);
      if (year) queries.push(`${t} ${year}`);
      queries.push(t);
    }
  }

  const seenIds = new Set();
  const streams = [];

  for (const term of queries.slice(0, 2)) {
    try {
      const searchUrl = `https://videa.hu/kereses/${encodeURIComponent(term)}`;
      const r = await fetch(searchUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://videa.hu/' },
        signal: AbortSignal.timeout(4500)
      });
      if (!r.ok) continue;
      const html = await r.text();

      const linkRegex = /href=["'](https?:\/\/videa\.hu)?\/videok\/([^/"'\s]+)\/[^"'#\s]+-([A-Za-z0-9]{16})["']/g;
      const candidateIds = [];
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const category = m[2];
        const vid = m[3];
        if (['zene', 'emberek-vlogok', 'hirek-politika', 'vicces'].includes(category)) continue;
        if (!seenIds.has(vid)) {
          seenIds.add(vid);
          candidateIds.push(vid);
          if (candidateIds.length >= 4) break;
        }
      }

      const batches = await Promise.all(
        candidateIds.map((vid) => extractVideaStreams(vid, 'Videa.hu').catch(() => []))
      );

      for (const batch of batches) {
        for (const s of batch) {
          if (s.duration && s.duration < minDuration) continue;
          if (s.videoTitle && JUNK_TITLE_REGEX.test(s.videoTitle)) continue;
          if (s.videoTitle && !isTitleMatch(s.videoTitle, titles, isMovie ? year : null)) continue;
          streams.push(s);
        }
      }

      if (streams.length >= 6) break;
    } catch {}
  }

  return streams;
}

module.exports = { searchVidea };
