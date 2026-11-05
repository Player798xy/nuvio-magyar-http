/**
 * Filmvilag2 Scraper (onlinefilmvilag2.eu)
 * Extracts 1080p and 720p direct streams from Filmvilag2 articles (Videa, Indavideo, OK.ru).
 */

const { extractVideaStreams, isTitleMatch, isValidRuntime, checkPageMetadata } = require('./videa');
const { extractIndavideoStreams } = require('./indavideo');
const { resolveVideaEmbed, extractOkRuStreams } = require('./filmezek');

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeFilmvilag(meta) {
  const streams = [];
  const hu = meta.hungarianTitle || meta.englishTitle;
  if (!hu) return streams;

  const searchQueries = [hu];
  const strippedHu = hu.replace(/^(?:A|Az)\s+/i, '');
  if (strippedHu !== hu) searchQueries.push(strippedHu);
  if (meta.englishTitle && normalize(meta.englishTitle) !== normalize(hu)) {
    searchQueries.push(meta.englishTitle);
  }

  const seenUrls = new Set();

  for (const q of searchQueries) {
    try {
      const body = new URLSearchParams({
        uid: '1504382',
        key: q
      }).toString();

      const searchRes = await fetch('https://katalog.estranky.cz/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://onlinefilmvilag2.eu/'
        },
        body,
        signal: AbortSignal.timeout(4500)
      });
      if (!searchRes.ok) continue;

      const searchHtml = await searchRes.text();
      const rawLinks = [...searchHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
        .map(m => ({
          url: m[1].replace('http://', 'https://'),
          title: m[2].replace(/<[^>]+>/g, '').trim()
        }))
        .filter(l => l.url.includes('.html') && !l.url.includes('filmkeres-es-hibas-link') && !l.title.startsWith('http'));

      // Deduplicate by article URL
      const seenArticleUrls = new Set();
      const links = [];
      for (const l of rawLinks) {
        if (!seenArticleUrls.has(l.url)) {
          seenArticleUrls.add(l.url);
          links.push(l);
        }
      }

      if (links.length === 0) continue;

      const isSeries = Boolean(meta.season);
      const candidates = links
        .filter(item => {
          const cleanT = item.title.replace(/\(\s*(?:FHD|HD|SD|CAM|HUN|Sub)\s*\)/gi, '').trim();
          return isTitleMatch(hu, cleanT, meta.year, isSeries) ||
                 (meta.englishTitle && isTitleMatch(meta.englishTitle, cleanT, meta.year, isSeries));
        })
        .slice(0, 4);

      await Promise.all(candidates.map(async (item) => {
        try {
          const artRes = await fetch(item.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(5000)
          });
          if (!artRes.ok) return;

          const artHtml = await artRes.text();
          if (!isSeries) {
            const pageCheck = checkPageMetadata(artHtml, meta);
            if (!pageCheck.match) return;
          }
          const iframes = [...artHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);

          for (const ifr of iframes) {
            let iframeSrc = ifr.startsWith('//') ? 'https:' + ifr : ifr;

            // 1. Videa embed (supports both v= and f=)
            if (iframeSrc.includes('videa.hu')) {
              const vSources = await resolveVideaEmbed(iframeSrc);
              for (const vs of vSources) {
                if (!isValidRuntime(vs.duration, meta)) continue;
                if (seenUrls.has(vs.url)) continue;
                seenUrls.add(vs.url);
                const qualLabel = vs.height >= 1080 ? '1080p FHD' : vs.height >= 720 ? '720p HD' : `${vs.height}p`;
                streams.push({
                  name: `[HU] Filmvilág2 ${qualLabel}`,
                  title: `${item.title}\n🇭🇺 Filmvilág2 (Videa) • ${qualLabel} • Szinkron`,
                  url: vs.url,
                  quality: vs.height >= 1080 ? '1080p' : vs.height >= 720 ? '720p' : '480p',
                  height: vs.height,
                  source: 'filmvilag2',
                  yearVerified: true
                });
              }
              continue;
            }

            // 2. Indavideo embed
            if (iframeSrc.includes('embed.indavideo.hu/player/video/')) {
              const ihashMatch = iframeSrc.match(/video\/([a-zA-Z0-9]+)/);
              if (ihashMatch) {
                const ihash = ihashMatch[1];
                const iData = await extractIndavideoStreams(ihash);
                if (iData && !isValidRuntime(iData.duration, meta)) continue;
                const iStreams = iData?.streams || [];
                for (const is of iStreams) {
                  if (seenUrls.has(is.url)) continue;
                  seenUrls.add(is.url);
                  const qualLabel = is.height >= 1080 ? '1080p FHD' : is.height >= 720 ? '720p HD' : `${is.height}p`;
                  streams.push({
                    name: `[HU] Filmvilág2 ${qualLabel}`,
                    title: `${item.title}\n🇭🇺 Filmvilág2 (Indavideo) • ${qualLabel} • Szinkron`,
                    url: is.url,
                    quality: is.height >= 1080 ? '1080p' : is.height >= 720 ? '720p' : '480p',
                    height: is.height,
                    source: 'filmvilag2',
                    yearVerified: true
                  });
                }
              }
              continue;
            }

            // 3. OK.ru embed
            if (iframeSrc.includes('ok.ru')) {
              const okStreams = await extractOkRuStreams(iframeSrc, 'Filmvilág2', meta);
              for (const os of okStreams) {
                if (seenUrls.has(os.url)) continue;
                seenUrls.add(os.url);
                os.source = 'filmvilag2';
                os.yearVerified = true;
                streams.push(os);
              }
            }
          }
        } catch (e) {}
      }));

      if (streams.length > 0) break;
    } catch (err) {
      // Continue
    }
  }

  return streams;
}

module.exports = {
  scrapeFilmvilag
};
