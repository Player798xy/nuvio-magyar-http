/**
 * MeseKincstár.tv & MeseFilmek.hu Scraper
 * Searches Hungarian cartoon/animation portals and extracts Videa/Indavideo direct MP4 streams
 * with strict title, release year (±1 year), sequel/numbered entry, and runtime (±10 min) verification.
 */

const {
  extractVideaStreams,
  isTitleMatch,
  isValidRuntime,
  hasVerifiedYearInTitle,
  checkPageMetadata,
  matchesEpisode
} = require('./videa');
const { extractIndavideoStreams } = require('./indavideo');

async function searchMeseKincstar(query) {
  const results = [];
  try {
    const searchUrl = `https://mesekincstar.tv/mesekereso/${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return results;

    const html = await res.text();
    const linkMatches = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/mesekincstar\.tv\/mesek\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const seen = new Set();

    for (const m of linkMatches) {
      const url = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      if (!seen.has(url) && title.length > 2 && !title.toLowerCase().includes('tovább')) {
        seen.add(url);
        results.push({ url, title });
      }
    }
  } catch (e) {}
  return results;
}

async function scrapeMeseFilm(meta) {
  const streams = [];
  const hu = meta.hungarianTitle || meta.englishTitle;
  if (!hu) return streams;

  const isMovie = meta.type === 'movie' || !meta.season;
  const isSeries = !isMovie;
  const targetYear = meta.year ? parseInt(meta.year, 10) : null;

  const queries = [hu];
  const stripped = hu.replace(/^(?:A|Az)\s+/i, '');
  if (stripped !== hu) queries.push(stripped);
  if (meta.englishTitle && meta.englishTitle !== hu) {
    queries.push(meta.englishTitle);
  }

  const seenUrls = new Set();
  const seenDetailUrls = new Set();

  // Parallelize search queries and candidate detail page processing
  const linkBatches = await Promise.all(
    queries.map(q => searchMeseKincstar(q).catch(() => []))
  );

  const matchingLinks = [];
  for (const links of linkBatches) {
    for (const item of links) {
      if (seenDetailUrls.has(item.url)) continue;
      if (
        !isTitleMatch(hu, item.title, meta.year, isSeries) &&
        !(meta.englishTitle && isTitleMatch(meta.englishTitle, item.title, meta.year, isSeries))
      ) {
        continue;
      }
      if (isSeries && !matchesEpisode(item.title, meta.season, meta.episode, meta.episodeTitle)) {
        continue;
      }
      seenDetailUrls.add(item.url);
      matchingLinks.push(item);
      if (matchingLinks.length >= 4) break;
    }
    if (matchingLinks.length >= 4) break;
  }

  await Promise.allSettled(matchingLinks.map(async (item) => {
    try {
      const pageRes = await fetch(item.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4500)
      });
      if (!pageRes.ok) return;

      const pageHtml = await pageRes.text();
      if (isMovie) {
        const pageCheck = checkPageMetadata(pageHtml, meta);
        if (!pageCheck.match) return;
      }

      const videaMatches = [
        ...pageHtml.matchAll(/videa\.hu\/player\?v=([a-zA-Z0-9]{16})/g),
        ...pageHtml.matchAll(/videa\.hu\/videok\/[^"'\s]+-([a-zA-Z0-9]{16})/g)
      ];
      const indaMatches = [...pageHtml.matchAll(/embed\.indavideo\.hu\/player\/video\/([a-zA-Z0-9]+)/g)];

      await Promise.allSettled([
        ...videaMatches.map(async (vm) => {
          const vData = await extractVideaStreams(vm[1]);
          if (!vData || !vData.sources || vData.sources.length === 0) return;
          if (!isValidRuntime(vData.duration, meta)) return;
          if (isMovie && targetYear && vData.uploadYear && vData.uploadYear < targetYear) return;

          const vTitleMatches =
            isTitleMatch(hu, vData.videoTitle, meta.year, isSeries) ||
            (meta.englishTitle && isTitleMatch(meta.englishTitle, vData.videoTitle, meta.year, isSeries)) ||
            isTitleMatch(item.title, vData.videoTitle, meta.year, isSeries);
          if (!vTitleMatches) return;
          if (isSeries && !matchesEpisode(vData.videoTitle, meta.season, meta.episode, meta.episodeTitle) && !matchesEpisode(item.title, meta.season, meta.episode, meta.episodeTitle)) {
            return;
          }

          const durationMins = Math.round((vData.duration || 0) / 60);
          const yearVerified = !isMovie || !targetYear ||
            hasVerifiedYearInTitle(item.title, targetYear, hu) ||
            hasVerifiedYearInTitle(vData.videoTitle, targetYear, hu) ||
            (meta.englishTitle && hasVerifiedYearInTitle(vData.videoTitle, targetYear, meta.englishTitle));

          for (const vs of vData.sources) {
            if (seenUrls.has(vs.url)) continue;
            seenUrls.add(vs.url);
            const qualLabel = vs.height >= 1080 ? '1080p FHD' : vs.height >= 720 ? '720p HD' : `${vs.height}p`;
            streams.push({
              name: `[HU] MeseKincstár ${qualLabel}`,
              title: `${item.title} (${vData.videoTitle})\n🇭🇺 MeseKincstár (Videa) • ${qualLabel}${durationMins ? ` • ${durationMins} perc` : ''} • Magyar mese`,
              url: vs.url,
              quality: vs.height >= 1080 ? '1080p' : vs.height >= 720 ? '720p' : '480p',
              height: vs.height,
              source: 'mesefilm',
              yearVerified,
              behaviorHints: { bingeGroup: `hu-mesefilm-${qualLabel}` }
            });
          }
        }),
        ...indaMatches.map(async (im) => {
          const iData = await extractIndavideoStreams(im[1]);
          if (!iData || !iData.streams || iData.streams.length === 0) return;
          if (!isValidRuntime(iData.duration, meta)) return;

          const iTitle = iData.videoTitle || item.title;
          const iTitleMatches =
            isTitleMatch(hu, iTitle, meta.year, isSeries) ||
            (meta.englishTitle && isTitleMatch(meta.englishTitle, iTitle, meta.year, isSeries));
          if (!iTitleMatches) return;

          const yearVerified = !isMovie || !targetYear ||
            hasVerifiedYearInTitle(item.title, targetYear, hu) ||
            hasVerifiedYearInTitle(iTitle, targetYear, hu);

          for (const is of iData.streams) {
            if (seenUrls.has(is.url)) continue;
            seenUrls.add(is.url);
            const qualLabel = is.height >= 1080 ? '1080p FHD' : is.height >= 720 ? '720p HD' : `${is.height}p`;
            streams.push({
              name: `[HU] MeseKincstár (Inda) ${qualLabel}`,
              title: `${item.title}\n🇭🇺 MeseKincstár (Indavideo) • ${qualLabel} • Magyar mese`,
              url: is.url,
              quality: is.height >= 1080 ? '1080p' : is.height >= 720 ? '720p' : '480p',
              height: is.height,
              source: 'mesefilm',
              yearVerified
            });
          }
        })
      ]);
    } catch (e) {}
  }));

  return streams;
}

module.exports = {
  scrapeMeseFilm
};
