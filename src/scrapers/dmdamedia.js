const { cfRequest } = require('../utils/http');
const { normalizeTitle } = require('../utils/meta');
const { resolveAnyEmbed } = require('../utils/hosters');

const EXCLUDED = new Set([
  '/filmek', '/sorozatok', '/hirek', '/kapcsolat', '/belepes',
  '/regisztracio', '/kereses', '/top-filmek', '/top-sorozatok',
  '/rolunk', '/kategoria', '/szineszek', '/cdn-cgi'
]);

/**
 * DMDAMedia.hu Scraper (Movies & Series)
 * Uses TLS session-ticket bypass (`cfRequest`) to search and extract direct HTTP streams.
 */
async function searchDMDAMedia(meta) {
  const { titles, type, season, episode } = meta;
  const isSeries = type === 'series';
  const streams = [];

  for (const q of titles.slice(0, 2)) {
    try {
      const searchRes = await cfRequest('https://dmdamedia.hu/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://dmdamedia.hu/'
        },
        body: new URLSearchParams({ search: q }).toString(),
        timeoutMs: 6000
      });
      if (!searchRes?.text) continue;

      const links = [...searchRes.text.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((m) => ({
          url: m[1].split('?')[0],
          title: m[2].replace(/<[^>]+>/g, '').trim()
        }))
        .filter((l) => l.url.startsWith('/') && l.url.length > 2 && !EXCLUDED.has(l.url.toLowerCase()));

      const normTarget = normalizeTitle(q);
      const matched = links.find((l) => {
        const nt = normalizeTitle(l.title);
        const slug = normalizeTitle(l.url);
        return nt === normTarget || nt.includes(normTarget) || slug.includes(normTarget);
      });
      if (!matched) continue;

      let targetUrl = `https://dmdamedia.hu${matched.url}`;
      if (isSeries && season && episode) {
        targetUrl = `${targetUrl}/${season}.evad/${episode}.resz`;
      }

      const pageRes = await cfRequest(targetUrl, {
        headers: { Referer: 'https://dmdamedia.hu/' },
        timeoutMs: 4500
      });
      if (!pageRes?.text) continue;

      const iframes = [...pageRes.text.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
      const tabMatches = [...pageRes.text.matchAll(/href=["'](\?a=[^"'#]+)(?:#[^"']*)?["']/gi)].map((m) => m[1]);
      const uniqueTabs = [...new Set(tabMatches)].slice(0, 2);

      await Promise.allSettled(
        uniqueTabs.map(async (tab) => {
          const tRes = await cfRequest(`${targetUrl}${tab}`, { headers: { Referer: targetUrl }, timeoutMs: 3500 });
          if (tRes?.text) {
            const tIframes = [...tRes.text.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
            iframes.push(...tIframes);
          }
        })
      );

      const allEmbeds = [...new Set(iframes)].slice(0, 4);

      await Promise.allSettled(
        allEmbeds.map(async (emb) => {
          const resolved = await resolveAnyEmbed(emb, 'DMDAMedia', matched.title || q);
          streams.push(...resolved);
        })
      );

      if (streams.length > 0) break;
    } catch {}
  }

  return streams;
}

module.exports = { searchDMDAMedia };
