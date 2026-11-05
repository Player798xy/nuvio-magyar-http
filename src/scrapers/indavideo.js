/**
 * Indavideo.hu Scraper
 * Extracts direct MP4 streams with authenticated CDN tokens from Indavideo.
 */

const {
  isTitleMatch,
  isValidRuntime,
  hasVerifiedYearInTitle,
  extractUploadYearFromText,
  matchesEpisode
} = require('./videa');

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractIndavideoStreams(embHash) {
  try {
    const rnd = Math.floor(Math.random() * 2147483647);
    const dataUrl = `https://amfphp.indavideo.hu/SYm0json.php/player.playerHandler.getVideoData/${embHash}/12/?callback=json&_=${rnd}`;

    const res = await fetch(dataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://embed.indavideo.hu/'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;
    let text = await res.text();
    if (text.startsWith('json(')) {
      text = text.slice(5, text.lastIndexOf(')'));
    }
    const json = JSON.parse(text);
    const data = json?.data;
    if (!data) return null;

    const title = data.title || '';
    const duration = parseInt(data.length || '0', 10) || 0;
    const uploadYear = extractUploadYearFromText(String(data.date || '')) || null;
    const filesh = data.filesh || {};
    const videoFiles = [];

    if (Array.isArray(data.video_files)) {
      videoFiles.push(...data.video_files);
    } else if (data.video_files && typeof data.video_files === 'object') {
      videoFiles.push(...Object.values(data.video_files));
    }
    if (data.video_file && !videoFiles.includes(data.video_file)) {
      videoFiles.push(data.video_file);
    }

    const streams = [];
    const seenHeights = new Set();

    for (const vUrl of videoFiles) {
      if (!vUrl || typeof vUrl !== 'string') continue;
      const heightMatch = vUrl.match(/\.(\d{3,4})\.mp4/);
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 360;

      if (seenHeights.has(height)) continue;
      seenHeights.add(height);

      let token = filesh[height.toString()] || filesh[height];
      if (!token) {
        token = Object.values(filesh)[0] || '';
      }

      let finalUrl = vUrl.replace('??', '?');
      if (token) {
        finalUrl += `&token=${token}`;
      }

      streams.push({
        height,
        url: finalUrl,
        title
      });
    }

    streams.sort((a, b) => b.height - a.height);
    return { title, videoTitle: title, duration, uploadYear, streams };
  } catch (err) {
    return null;
  }
}

async function scrapeIndavideo(meta) {
  const streams = [];
  const hu = meta.hungarianTitle || meta.englishTitle;
  if (!hu) return streams;

  const isSeries = Boolean(meta.season);
  const targetYear = meta.year ? parseInt(meta.year, 10) : null;

  const searchTerms = [];
  if (meta.season && meta.episode) {
    const s = meta.season;
    const e = meta.episode;
    const ePad = e.toString().padStart(2, '0');
    if (meta.episodeTitle) searchTerms.push(`${hu} ${meta.episodeTitle}`);
    searchTerms.push(`${hu} ${s} evad ${e} resz`);
    searchTerms.push(`${hu} ${e}. resz`);
    searchTerms.push(`${hu} S${s}E${ePad}`);
    searchTerms.push(hu);
  } else {
    searchTerms.push(hu);
    searchTerms.push(`${hu} teljes film`);
    if (meta.year) searchTerms.push(`${hu} ${meta.year}`);
  }

  const seenVideoUrls = new Set();

  for (const term of searchTerms.slice(0, 3)) {
    try {
      const searchUrl = `https://indavideo.hu/search?search=${encodeURIComponent(term)}&view=detailed&sort_mode=magic`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) continue;

      const html = await res.text();
      // Match any subdomain of indavideo.hu (e.g. index.indavideo.hu, auto.indavideo.hu, indavideo.hu)
      const videoLinks = [...html.matchAll(/href=["'](https?:\/\/(?:[a-z0-9-]+\.)?indavideo\.hu\/video\/[^"'#\s]+)["']/gi)].map(m => m[1]);

      const urlsToProcess = [];
      for (const vUrl of videoLinks) {
        if (!seenVideoUrls.has(vUrl)) {
          seenVideoUrls.add(vUrl);
          urlsToProcess.push(vUrl);
          if (urlsToProcess.length >= 4) break;
        }
      }

      await Promise.all(urlsToProcess.map(async (videoPageUrl) => {
        try {
          const pageRes = await fetch(videoPageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(4000)
          });
          if (!pageRes.ok) return;

          const pHtml = await pageRes.text();
          const hashMatch = pHtml.match(/id=['"]emb_hash['"][^>]+value=['"]([^'"]+)['"]/i) ||
                            pHtml.match(/value=['"]([^'"]+)['"][^>]+id=['"]emb_hash['"]/i) ||
                            pHtml.match(/embed\.indavideo\.hu\/player\/video\/([a-zA-Z0-9]+)/);

          if (!hashMatch) return;
          const embHash = hashMatch[1];

          const vData = await extractIndavideoStreams(embHash);
          if (!vData || !vData.streams || vData.streams.length === 0) return;

          const uploadYear = vData.uploadYear || extractUploadYearFromText(pHtml);

          // 1. Strict runtime check (±10 min + 4% PAL speedup)
          if (!isValidRuntime(vData.duration, meta)) return;

          // 2. Upload-year sanity check: reject videos uploaded before targetYear
          if (!isSeries && targetYear && uploadYear && uploadYear < targetYear) return;

          // 3. Check title match (±1 year)
          if (!isTitleMatch(hu, vData.title, meta.year, isSeries) && (!meta.englishTitle || !isTitleMatch(meta.englishTitle, vData.title, meta.year, isSeries))) {
            return;
          }

          if (isSeries && !matchesEpisode(vData.title, meta.season, meta.episode, meta.episodeTitle)) {
            return;
          }

          const yearVerified = isSeries || !targetYear ||
            hasVerifiedYearInTitle(vData.title, targetYear, hu) ||
            (meta.englishTitle && hasVerifiedYearInTitle(vData.title, targetYear, meta.englishTitle));
          const warnBadge = (!yearVerified && !isSeries && targetYear) ? ' [⚠️ Év?]' : '';
          const warnNote = (!yearVerified && !isSeries && targetYear) ? ' • ⚠️ Évszám nincs a címben' : '';

          for (const s of vData.streams) {
            const qualLabel = s.height >= 1080 ? '1080p FHD' : s.height >= 720 ? '720p HD' : `${s.height}p`;
            streams.push({
              name: `[HU] Indavideo ${qualLabel}${warnBadge}`,
              title: `${vData.title}\n🇭🇺 Indavideo.hu • ${qualLabel} • Közvetlen MP4${warnNote}`,
              url: s.url,
              quality: s.height >= 1080 ? '1080p' : s.height >= 720 ? '720p' : '480p',
              height: s.height,
              source: 'indavideo',
              yearVerified
            });
          }
        } catch (e) {
          // ignore
        }
      }));

      if (streams.length > 0) break;
    } catch (err) {
      // Continue
    }
  }

  return streams;
}

module.exports = {
  scrapeIndavideo,
  extractIndavideoStreams
};
