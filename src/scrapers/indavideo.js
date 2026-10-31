const { UA, isTitleMatch } = require('../utils/meta');
const { extractIndavideoStreams } = require('../utils/videa_indavideo');

async function searchIndavideo(meta) {
  const { titles, year, type, season, episode } = meta;
  const queries = [];

  for (const hu of titles.slice(0, 2)) {
    if (type === 'series' && season && episode) {
      const ePad = String(episode).padStart(2, '0');
      queries.push(`${hu} S${season}E${ePad}`);
      queries.push(`${hu} ${season}x${episode}`);
      queries.push(`${hu} ${season} evad ${episode} resz`);
    } else {
      queries.push(`${hu} teljes film`);
      if (year) queries.push(`${hu} ${year}`);
    }
  }

  const seenSlugs = new Set();
  const streams = [];

  for (const term of queries.slice(0, 2)) {
    try {
      const searchUrl = `https://indavideo.hu/search?search=${encodeURIComponent(term)}&view=detailed&sort_mode=magic`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://indavideo.hu/' },
        signal: AbortSignal.timeout(5500)
      });
      if (!res.ok) continue;

      const html = await res.text();
      const videoLinks = [...html.matchAll(/href="https?:\/\/indavideo\.hu\/video\/([^"#\s]+)"/g)].map((m) => m[1]);
      const slugs = [];
      for (const s of videoLinks) {
        if (!seenSlugs.has(s)) {
          seenSlugs.add(s);
          slugs.push(s);
          if (slugs.length >= 3) break;
        }
      }

      await Promise.allSettled(
        slugs.map(async (slug) => {
          const extracted = await extractIndavideoStreams(`https://indavideo.hu/video/${slug}`, 'Indavideo.hu');
          for (const item of extracted) {
            if (isTitleMatch(item.title, titles, type === 'series' ? null : year)) {
              streams.push(item);
            }
          }
        })
      );

      if (streams.length > 0) break;
    } catch {}
  }

  return streams;
}

module.exports = { searchIndavideo };
