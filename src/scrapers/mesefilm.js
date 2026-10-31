const { UA, isTitleMatch } = require('../utils/meta');
const { resolveAnyEmbed } = require('../utils/hosters');

/**
 * MeseKincstár.tv & MeseFilmek.hu Scraper
 * Dedicated Hungarian kids, fairy tale, and animated movie/series scraper.
 */
async function searchMeseFilm(meta) {
  const { titles, year } = meta;
  const streams = [];

  for (const q of titles.slice(0, 2)) {
    // 1. MeseKincstár.tv
    try {
      const sUrl = `https://mesekincstar.tv/mesekereso/${encodeURIComponent(q)}`;
      const r = await fetch(sUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(4500)
      });
      if (r.ok) {
        const html = await r.text();
        const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"/gi)]
          .map((m) => ({ url: m[1], title: m[2].trim() }))
          .filter((l) => !l.url.includes('/tag/') && !l.url.includes('/mesekereso/') && isTitleMatch(l.title, titles, year));

        await Promise.allSettled(
          links.slice(0, 2).map(async (item) => {
            const pRes = await fetch(item.url, {
              headers: { 'User-Agent': UA },
              signal: AbortSignal.timeout(4500)
            });
            if (!pRes.ok) return;
            const pHtml = await pRes.text();
            const iframes = [...pHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
            for (const ifr of iframes.slice(0, 3)) {
              const resolved = await resolveAnyEmbed(ifr, 'MeseKincstár', item.title);
              streams.push(...resolved);
            }
          })
        );
      }
    } catch {}

    // 2. MeseFilmek.hu (with Cookie: mesefilmek=1)
    try {
      const mfUrl = `https://mesefilmek.hu/?s=${encodeURIComponent(q)}`;
      const mfRes = await fetch(mfUrl, {
        headers: { 'User-Agent': UA, Cookie: 'mesefilmek=1' },
        signal: AbortSignal.timeout(4500)
      });
      if (mfRes.ok) {
        const mfHtml = await mfRes.text();
        const posts = [...mfHtml.matchAll(/<h2[^>]*>\s*<a[^>]+href="(https?:\/\/mesefilmek\.hu\/[^"]+)"[^>]*>([^<]+)<\/a>/gi)]
          .map((m) => ({ url: m[1], title: m[2].trim() }))
          .filter((p) => isTitleMatch(p.title, titles, year));

        await Promise.allSettled(
          posts.slice(0, 2).map(async (post) => {
            const pRes = await fetch(post.url, {
              headers: { 'User-Agent': UA, Cookie: 'mesefilmek=1' },
              signal: AbortSignal.timeout(4500)
            });
            if (!pRes.ok) return;
            const pHtml = await pRes.text();
            const iframes = [...pHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
            const scriptVidea = [...pHtml.matchAll(/videa\.hu\/player\?v=([a-zA-Z0-9]+)/gi)].map((m) => `https://videa.hu/player?v=${m[1]}`);
            const scriptInda = [...pHtml.matchAll(/indavideo\.hu\/video\/([a-zA-Z0-9]+)/gi)].map((m) => `https://indavideo.hu/video/${m[1]}`);
            const allSources = [...new Set([...iframes, ...scriptVidea, ...scriptInda])];
            for (const src of allSources.slice(0, 3)) {
              const resolved = await resolveAnyEmbed(src, 'MeseFilmek.hu', post.title);
              streams.push(...resolved);
            }
          })
        );
      }
    } catch {}

    if (streams.length > 0) break;
  }

  return streams;
}

module.exports = { searchMeseFilm };
