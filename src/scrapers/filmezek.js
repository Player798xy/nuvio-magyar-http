const { UA, isTitleMatch } = require('../utils/meta');
const { resolveAnyEmbed } = require('../utils/hosters');

/**
 * Filmezek.com Scraper (Movies & Series)
 * Uses Filmezek's fast JSON autocomplete endpoint (`searchinput.php`) and unpacks direct HTTP streams.
 */
async function searchFilmezek(meta) {
  const { titles, year, type, season, episode, imdbId } = meta;
  const isSeries = type === 'series';
  const streams = [];
  const seenUrls = new Set();

  for (const rawTerm of titles.slice(0, 2)) {
    const term = rawTerm.replace(/^(?:A|Az|The)\s+/i, '').trim();
    try {
      const searchUrl = `https://filmezek.com/searchinput.php?searchType=1&term=${encodeURIComponent(term)}`;
      const r = await fetch(searchUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://filmezek.com/' },
        signal: AbortSignal.timeout(5500)
      });
      if (!r.ok) continue;
      const items = await r.json();
      if (!Array.isArray(items) || !items.length) continue;

      let match = items.find((it) => it.MovieCover && imdbId && it.MovieCover.includes(imdbId));
      if (!match) {
        match = items.find((it) => {
          const t = it.MovieTitle || it.value || it.label || '';
          if (isSeries && it.type === 'online-sorozatok') {
            return isTitleMatch(t, titles, null) && (!season || t.includes(`${season}.`));
          }
          if (!isSeries && it.type === 'online-filmek') {
            return isTitleMatch(t, titles, year);
          }
          return false;
        });
      }
      if (!match) continue;

      const pageType = match.type || (isSeries ? 'online-sorozatok' : 'online-filmek');
      const itemUrl = `https://filmezek.com/${pageType}/${match.MovieSlug}/`;
      const pageRes = await fetch(itemUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://filmezek.com/' },
        signal: AbortSignal.timeout(6000)
      });
      if (!pageRes.ok) continue;
      const html = await pageRes.text();

      const dataUrls = [...html.matchAll(/data-url=["']([^"']+)["']/g)].map((m) => m[1]);
      const iframes = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
      const embeds = [...new Set([...dataUrls, ...iframes])].slice(0, 6);

      await Promise.allSettled(
        embeds.map(async (emb) => {
          const clean = emb.replace(/&amp;/g, '&');
          if (seenUrls.has(clean)) return;
          seenUrls.add(clean);
          const extracted = await resolveAnyEmbed(clean, 'Filmezek.com', match.MovieTitle);
          streams.push(...extracted);
        })
      );

      if (streams.length > 0) break;
    } catch {}
  }

  return streams;
}

module.exports = { searchFilmezek };
