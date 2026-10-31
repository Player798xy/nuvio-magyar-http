const { UA, normalizeTitle } = require('../utils/meta');
const { resolveAnyEmbed } = require('../utils/hosters');

/**
 * JobbMintATV Scraper (jobbmintatv.org / jobbmintatv.pro)
 * Handles ISO-8859-2 Hungarian encoding and extracts Videa, Indavideo, OK.ru, and hoster streams.
 */
async function searchJobbMintATV(meta) {
  const { titles, type, season, episode } = meta;
  const streams = [];
  const baseDomains = ['https://jobbmintatv.org', 'https://jobbmintatv.pro'];

  for (const rawTitle of titles.slice(0, 2)) {
    const term = normalizeTitle(rawTitle);
    if (!term) continue;

    for (const baseDom of baseDomains) {
      try {
        const searchUrl = `${baseDom}/ajax.php?keres=${encodeURIComponent(term)}`;
        const r = await fetch(searchUrl, {
          headers: { 'User-Agent': UA, Referer: `${baseDom}/` },
          signal: AbortSignal.timeout(4500)
        });
        if (!r.ok) continue;

        const buf = await r.arrayBuffer();
        let html = '';
        try {
          html = new TextDecoder('iso-8859-2').decode(buf);
        } catch {
          html = new TextDecoder('utf-8').decode(buf);
        }
        if (html.includes('Nincs')) continue;

        const links = [...html.matchAll(/<a href=["']([^"']+)["'][^>]*><div[^>]*>([^<]+)<\/div><\/a>/gi)].map((m) => ({
          url: m[1].startsWith('//') ? 'https:' + m[1] : m[1],
          title: m[2].trim()
        }));

        const targetSlug = term.replace(/\s+/g, '_');
        const scored = [];
        for (const item of links) {
          const normT = normalizeTitle(item.title);
          let score = 0;
          if (normT === term || item.url.toLowerCase().includes(targetSlug)) score += 100;
          else if (normT.includes(term) || term.includes(normT)) score += 60;
          if (score >= 40) scored.push({ item, score });
        }

        if (!scored.length) continue;
        scored.sort((a, b) => b.score - a.score);

        await Promise.allSettled(
          scored.slice(0, 2).map(async ({ item }) => {
            let targetUrl = item.url;
            if (type === 'series' && season && episode) {
              targetUrl = `${targetUrl.replace(/\/+$/, '')}/${season}_evad/${episode}_resz/`;
            }

            const pageRes = await fetch(targetUrl, {
              headers: { 'User-Agent': UA, Referer: `${baseDom}/` },
              signal: AbortSignal.timeout(5000)
            });
            if (!pageRes.ok) return;
            const pageHtml = await pageRes.text();

            const iframes = [...pageHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
            await Promise.allSettled(
              iframes.slice(0, 4).map(async (ifr) => {
                const resolved = await resolveAnyEmbed(ifr, 'JobbMintATV', item.title);
                streams.push(...resolved);
              })
            );
          })
        );

        if (streams.length > 0) break;
      } catch {}
    }
    if (streams.length > 0) break;
  }

  return streams;
}

module.exports = { searchJobbMintATV };
