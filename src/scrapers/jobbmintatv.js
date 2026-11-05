/**
 * JobbMintATV Scraper
 * Extracts direct Videa, Indavideo, and OK.ru streams from jobbmintatv.org / jobbmintatv.pro.
 */

const {
  isTitleMatch,
  checkPageMetadata,
  extractCandidateYears
} = require('./videa');
const { extractIndavideoStreams } = require('./indavideo');
const { extractOkRuStreams, resolveVideaEmbed } = require('./filmezek');

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeJobbMintATV(meta) {
  const streams = [];
  const hu = meta.hungarianTitle || meta.englishTitle;
  if (!hu) return streams;

  const searchTerms = [];
  const addTerm = (t) => {
    const n = normalize(t);
    if (n && n.length >= 2 && !searchTerms.includes(n)) searchTerms.push(n);
  };
  addTerm(hu);
  const baseHu = hu.split(/[:\-–&]/)[0].trim();
  if (baseHu && baseHu.length >= 3) addTerm(baseHu);

  if (meta.englishTitle && normalize(meta.englishTitle) !== normalize(hu)) {
    addTerm(meta.englishTitle);
    const baseEn = meta.englishTitle.split(/[:\-–&]/)[0].trim();
    if (baseEn && baseEn.length >= 3) addTerm(baseEn);
  }

  const baseDomains = ['https://jobbmintatv.org', 'https://jobbmintatv.pro'];
  const seenUrls = new Set();

  for (const term of searchTerms) {
    for (const baseDom of baseDomains) {
      try {
        const searchUrl = `${baseDom}/ajax.php?keres=${encodeURIComponent(term)}`;
        const res = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(4000)
        });
        if (!res.ok) continue;

        const buf = await res.arrayBuffer();
        let html = '';
        try {
          html = new TextDecoder('iso-8859-2').decode(buf);
        } catch (e) {
          html = new TextDecoder('utf-8').decode(buf);
        }
        if (html.includes('Nincs')) continue;

        const links = [...html.matchAll(/<a href=["']([^"']+)["'][^>]*><div[^>]*>([^<]+)<\/div><\/a>/gi)].map(m => ({
          url: m[1].startsWith('//') ? 'https:' + m[1] : m[1],
          title: m[2].trim()
        }));

        if (links.length === 0) continue;

        const normTarget = normalize(hu);
        const targetSlug = normTarget.replace(/\s+/g, '_');
        const targetYear = meta.year ? parseInt(meta.year, 10) : null;
        const isSeries = Boolean(meta.season && meta.episode);
        const scoredItems = [];

        for (const item of links) {
          if (!isSeries && targetYear) {
            const candYears = extractCandidateYears(item.title, hu);
            if (candYears.length > 0 && !candYears.some(cy => Math.abs(cy - targetYear) <= 1)) {
              continue;
            }
          }

          if (!isTitleMatch(hu, item.title, meta.year, isSeries) && (!meta.englishTitle || !isTitleMatch(meta.englishTitle, item.title, meta.year, isSeries))) {
            continue;
          }

          const normTitle = normalize(item.title);
          let score = 0;
          if (normTitle === normTarget || item.url.toLowerCase().includes(targetSlug)) {
            score += 100;
          } else if (normTitle.startsWith(normTarget) || normTarget.startsWith(normTitle)) {
            score += 60;
          } else {
            const targetWords = normTarget.split(' ').filter(w => w.length > 2);
            const itemWords = normTitle.split(' ').filter(w => w.length > 2);
            let overlap = 0;
            for (const w of targetWords) {
              if (itemWords.includes(w) || item.url.toLowerCase().includes(w)) overlap++;
            }
            if (overlap === 0) continue;
            score += (overlap / Math.max(targetWords.length, 1)) * 40;
          }

          if (score >= 40) {
            scoredItems.push({ item, score });
          }
        }

        if (scoredItems.length === 0) continue;
        scoredItems.sort((a, b) => b.score - a.score);
        const candidates = scoredItems.slice(0, 3).map(x => x.item);

        await Promise.all(candidates.map(async (candidate) => {
          let targetUrl = candidate.url;

          if (meta.season && meta.episode) {
            const s = meta.season;
            const e = meta.episode;
            const cleanUrl = targetUrl.replace(/\/+$/, '');
            targetUrl = `${cleanUrl}/${s}_evad/${e}_resz/`;
          }

          try {
            const pageRes = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              signal: AbortSignal.timeout(5000)
            });
            if (!pageRes.ok) return;

            const pageHtml = await pageRes.text();

            // Verify IMDb ID and release year on candidate page so remakes (e.g. 1960 vs 2016) are never merged
            if (!isSeries) {
              const pageCheck = checkPageMetadata(pageHtml, meta);
              if (!pageCheck.match) return;
            }

            const iframes = [...pageHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
            const dataUrls = [...pageHtml.matchAll(/data-url=["']([^"']+)["']/gi)].map(m => m[1]);
            const allEmbeds = [...new Set([...iframes, ...dataUrls])];

            for (const ifr of allEmbeds) {
              let iframeSrc = ifr.startsWith('//') ? 'https:' + ifr : ifr;

              // 1. Videa embed (both v= and f=) -> decode direct MP4s
              if (iframeSrc.includes('videa.hu')) {
                const vStreams = await resolveVideaEmbed(iframeSrc);
                for (const vs of vStreams) {
                  if (vs.duration && vs.duration > 0 && vs.duration < (isSeries ? 480 : 2400)) continue;
                  if (seenUrls.has(vs.url)) continue;
                  seenUrls.add(vs.url);
                  const qualLabel = vs.height >= 1080 ? '1080p FHD' : vs.height >= 720 ? '720p HD' : `${vs.height}p`;
                  streams.push({
                    name: `[HU] JobbMintATV (Videa) ${qualLabel}`,
                    title: `${candidate.title}\n🇭🇺 JobbMintATV (Videa) • ${qualLabel} • Szinkron`,
                    url: vs.url,
                    quality: vs.height >= 1080 ? '1080p' : vs.height >= 720 ? '720p' : '480p',
                    height: vs.height,
                    source: 'jobbmintatv',
                    yearVerified: true
                  });
                }
              }

              // 2. Indavideo embed -> decode direct MP4s
              if (iframeSrc.includes('embed.indavideo.hu/player/video/') || iframeSrc.includes('indavideo.hu/video/')) {
                const ihashMatch = iframeSrc.match(/video\/([a-zA-Z0-9_-]+)/);
                if (ihashMatch) {
                  const ihash = ihashMatch[1];
                  const iData = await extractIndavideoStreams(ihash);
                  if (iData && iData.duration > 0 && iData.duration < (isSeries ? 480 : 2400)) continue;
                  const iStreams = iData?.streams || [];
                  for (const is of iStreams) {
                    if (seenUrls.has(is.url)) continue;
                    seenUrls.add(is.url);
                    const qualLabel = is.height >= 1080 ? '1080p FHD' : is.height >= 720 ? '720p HD' : `${is.height}p`;
                    streams.push({
                      name: `[HU] JobbMintATV (Inda) ${qualLabel}`,
                      title: `${candidate.title}\n🇭🇺 JobbMintATV (Indavideo) • ${qualLabel} • Szinkron`,
                      url: is.url,
                      quality: is.height >= 1080 ? '1080p' : is.height >= 720 ? '720p' : '480p',
                      height: is.height,
                      source: 'jobbmintatv',
                      yearVerified: true
                    });
                  }
                }
              }

              // 3. OK.ru embed -> decode locked single-resolution HLS tracks & MP4 fallback
              if (iframeSrc.includes('ok.ru/videoembed/') || iframeSrc.includes('ok.ru/video/')) {
                const okStreams = await extractOkRuStreams(iframeSrc, 'JobbMintATV', meta);
                for (const os of okStreams) {
                  if (seenUrls.has(os.url)) continue;
                  seenUrls.add(os.url);
                  os.yearVerified = true;
                  streams.push(os);
                }
              }
            }
          } catch (e) {}
        }));

        if (streams.length >= 6) break;
      } catch (err) {
        // Continue
      }
    }
    if (streams.length >= 6) break;
  }

  return streams;
}

module.exports = {
  scrapeJobbMintATV
};
