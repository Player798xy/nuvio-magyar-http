const {
  extractVideaStreams,
  isTitleMatch,
  isValidRuntime,
  hasVerifiedYearInTitle
} = require('./videa');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Videakid.hu Scraper (Hungarian Kids, Animation, Family Movies & Cartoons)
 * Uses Videakid's search engine and Videa's RC4 XML decryptor for direct MP4 links.
 */
async function scrapeVideakid(meta) {
  const rawTitles = meta.searchTitles || meta.titles || [meta.hungarianTitle, meta.englishTitle];
  const titles = [...new Set(rawTitles.filter(Boolean))];
  const { year, type, season, episode } = meta;
  const isMovie = type === 'movie';
  const queries = [];

  for (const t of titles.slice(0, 2)) {
    if (!isMovie && season && episode) {
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
        if (!titles.some(t => isTitleMatch(t, title, year, !isMovie))) continue;
        seen.add(vcode);
        candidates.push({ url: href, vcode, title });
      }
    })
  );

  const streams = [];
  const targetYear = year ? parseInt(year, 10) : null;
  await Promise.allSettled(
    candidates.slice(0, 4).map(async (c) => {
      const videoData = await extractVideaStreams(c.vcode);
      if (!videoData || !videoData.sources || videoData.sources.length === 0) return;
      if (!isValidRuntime(videoData.duration, meta)) return;
      if (isMovie && targetYear && videoData.uploadYear && videoData.uploadYear < targetYear) return;

      const candTitle = videoData.videoTitle || c.title;
      const yearVerified = !isMovie || !targetYear || titles.some(t => hasVerifiedYearInTitle(candTitle, targetYear, t));
      const warnBadge = (!yearVerified && isMovie && targetYear) ? ' [⚠️ Év?]' : '';

      const durationMins = Math.round((videoData.duration || 0) / 60);
      for (const vs of videoData.sources) {
        const qualLabel = vs.height >= 1080 ? '1080p FHD' : vs.height >= 720 ? '720p HD' : `${vs.height}p`;
        streams.push({
          name: `[HU] Videakid ${qualLabel}${warnBadge}`,
          title: `${candTitle}\n🇭🇺 Videakid.hu • ${qualLabel}${durationMins ? ` • ${durationMins} perc` : ''}`,
          url: vs.url,
          quality: vs.height >= 1080 ? '1080p' : vs.height >= 720 ? '720p' : '480p',
          height: vs.height,
          source: 'videakid',
          yearVerified,
          behaviorHints: {
            bingeGroup: `hu-videakid-${qualLabel}`
          }
        });
      }
    })
  );

  return streams;
}

module.exports = { scrapeVideakid, searchVideakid: scrapeVideakid };
