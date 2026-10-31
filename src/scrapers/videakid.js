const { UA, isTitleMatch } = require('../utils/meta');
const { extractVideaStreams } = require('../utils/videa_indavideo');

/**
 * Videakid.hu Scraper (Hungarian Kids, Animation, Family Movies & Cartoons)
 * Uses Videakid's search engine and Videa's RC4 XML decryptor for direct MP4 links.
 */
async function searchVideakid(meta) {
  const { titles, year, type, season, episode } = meta;
  const queries = [];

  for (const t of titles.slice(0, 2)) {
    if (type === 'series' && season && episode) {
      queries.push(`${t} ${season}. évad ${episode}. rész`);
      queries.push(`${t} ${episode}. rész`);
    } else {
      queries.push(t);
    }
  }

  const candidates = [];
  const seen = new Set();

  await Promise.allSettled(
    queries.slice(0, 2).map(async (q) => {
      const searchUrl = `https://videakid.hu/kereses/${encodeURIComponent(q)}`;
      const r = await fetch(searchUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://videakid.hu/' },
        signal: AbortSignal.timeout(6000)
      });
      if (!r.ok) return;
      const html = await r.text();

      const linkRegex = /<a[^>]+href="(https?:\/\/videakid\.hu\/videok\/[^"]+-([a-zA-Z0-9]{16}))"[^>]*title="([^"]+)"/gi;
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const href = m[1];
        const vcode = m[2];
        const title = m[3].trim();
        if (seen.has(vcode)) continue;
        if (!isTitleMatch(title, titles, year)) continue;
        seen.add(vcode);
        candidates.push({ url: href, vcode, title });
      }
    })
  );

  const streams = [];
  await Promise.allSettled(
    candidates.slice(0, 3).map(async (c) => {
      const extracted = await extractVideaStreams(c.url, 'Videakid.hu', c.title);
      streams.push(...extracted);
    })
  );

  return streams;
}

module.exports = { searchVideakid };
