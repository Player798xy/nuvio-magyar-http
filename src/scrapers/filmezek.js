/**
 * Filmezek.com Scraper
 * Uses Filmezek's fast JSON autocomplete API (searchinput.php) and extracts Videa/OK.ru direct streams.
 */

const {
  extractVideaStreams,
  extractVideaFCodeStreams,
  isTitleMatch,
  isValidRuntime,
  checkPageMetadata
} = require('./videa');

const OKRU_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

/**
 * Extracts smooth, non-buffering HLS track playlists & direct MP4 streams from OK.ru embed URLs.
 *
 * Why OK.ru previously buffered every 5 seconds:
 * 1. OK.ru's progressive MP4 URLs (ct=0, meta.videos) include `&pr=10` in the HMAC signature, which
 *    throttles a single long-lived TCP connection after the initial 10-second burst (~0.5-1.1 MB/s).
 * 2. OK.ru's master HLS playlist (`video.m3u8` / `ondemandHls`) puts 144p/480p first, causing ExoPlayer/Nuvio
 *    to switch resolution and flush the decoder every 5 seconds.
 * 3. Solution: Extract the locked single-resolution HLS sub-playlists (`.../fn/track.m3u8` and
 *    `.../type/5/.../video/index.m3u8`). Each 3-9s `.ts` segment is fetched as a separate HTTP request
 *    that receives the full unthrottled burst speed (5-9 MB/s) while locking resolution from second 0.
 */
async function extractOkRuStreams(embedUrl, providerName = 'Filmezek', mediaMeta = null) {
  const streams = [];
  try {
    let url = embedUrl;
    if (url.startsWith('//')) url = 'https:' + url;

    const reqHeaders = {
      'User-Agent': OKRU_UA,
      'Referer': 'https://ok.ru/'
    };
    if (mediaMeta?.clientIp) {
      reqHeaders['X-Forwarded-For'] = mediaMeta.clientIp;
      reqHeaders['X-Real-IP'] = mediaMeta.clientIp;
    }

    const res = await fetch(url, {
      headers: reqHeaders,
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return streams;

    const html = await res.text();
    const match = html.match(/data-options="([^"]+)"/);
    if (!match) return streams;

    const decoded = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const opts = JSON.parse(decoded);
    const rawMeta = opts?.flashvars?.metadata;
    if (!rawMeta) return streams;

    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    const durationSec = parseInt(meta?.movie?.duration || '0', 10);

    // Reject short trailers/clips (< 40 min for movies, < 8 min for series)
    const isSeries = Boolean(mediaMeta?.season);
    if (durationSec > 0 && durationSec < (isSeries ? 480 : 2400)) {
      return streams;
    }

    const durationMins = durationSec > 0 ? Math.round(durationSec / 60) : 0;
    const durTag = durationMins > 0 ? ` • ${durationMins} perc` : '';
    const seenTrackHeights = new Set();

    const qualityMap = {
      ultra: { label: '4K UHD', height: 2160 },
      quad: { label: '1440p QHD', height: 1440 },
      fullhd: { label: '1080p FHD', height: 1080 },
      full: { label: '1080p FHD', height: 1080 },
      high: { label: '720p HD', height: 720 },
      hd: { label: '720p HD', height: 720 },
      medium: { label: '480p SD', height: 480 },
      sd: { label: '480p SD', height: 480 },
      low: { label: '360p', height: 360 },
      lowest: { label: '240p', height: 240 },
      mobile: { label: '144p', height: 144 }
    };

    // Helper to resolve canonical 1080/720/480/360 height even for 2.39:1 widescreen (e.g. 1920x800, 1280x536) or vkuser /type/N/ paths
    const resolveTrackHeight = (line, trackPath = '') => {
      const qualMatch = line.match(/QUALITY=["']?([a-z0-9]+)["']?/i);
      const qKey = (qualMatch?.[1] || '').toLowerCase();
      if (qualityMap[qKey]) return qualityMap[qKey].height;

      if (/\/type\/5\//.test(trackPath)) return 1080;
      if (/\/type\/3\//.test(trackPath)) return 720;
      if (/\/type\/2\//.test(trackPath)) return 480;
      if (/\/type\/1\//.test(trackPath)) return 360;
      if (/\/type\/0\//.test(trackPath)) return 240;
      if (/\/type\/4\//.test(trackPath)) return 144;

      const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
      if (resMatch) {
        const w = parseInt(resMatch[1], 10);
        const h = parseInt(resMatch[2], 10);
        if (w >= 1800 || h >= 800) return 1080;
        if (w >= 1200 || h >= 500) return 720;
        if (w >= 800 || h >= 350) return 480;
        if (w >= 600 || h >= 240) return 360;
        return h;
      }
      return 720;
    };

    const proxyHints = {
      notWebReady: false,
      proxyHeaders: {
        request: {
          'User-Agent': OKRU_UA,
          'Referer': 'https://ok.ru/'
        }
      }
    };

    // 1. Primary: Extract locked single-resolution HLS tracks from ondemandHls (ct=28, 3s segments, zero throttling)
    if (meta.ondemandHls) {
      try {
        const hlsRes = await fetch(meta.ondemandHls, {
          headers: reqHeaders,
          signal: AbortSignal.timeout(4500)
        });
        if (hlsRes.ok) {
          const masterTxt = await hlsRes.text();
          const lines = masterTxt.split('\n').map(l => l.trim()).filter(Boolean);
          const tracks = [];
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
              const nextLine = lines[i + 1];
              if (nextLine && !nextLine.startsWith('#')) {
                const height = resolveTrackHeight(lines[i], nextLine);
                if (height < 360) continue;
                const label = height >= 1080 ? '1080p FHD' : height >= 720 ? '720p HD' : height >= 480 ? '480p SD' : '360p';
                const trackUrl = new URL(nextLine, meta.ondemandHls).toString();
                tracks.push({ height, label, trackUrl });
              }
            }
          }
          tracks.sort((a, b) => b.height - a.height);
          for (const tr of tracks) {
            if (seenTrackHeights.has(tr.height)) continue;
            seenTrackHeights.add(tr.height);
            streams.push({
              name: `[HU] ${providerName} (OK.ru) ${tr.label}`,
              title: `${meta.movie?.title || 'Magyar Stream'}\n🇭🇺 ${providerName} • OK.ru Fix ${tr.label} HLS${durTag} • Szinkron`,
              url: tr.trackUrl,
              quality: tr.height >= 1080 ? '1080p' : tr.height >= 720 ? '720p' : '480p',
              height: tr.height,
              source: providerName.toLowerCase(),
              behaviorHints: {
                ...proxyHints,
                bingeGroup: `hu-${providerName.toLowerCase()}-okru-hls-${tr.height}`
              }
            });
          }
        }
      } catch (e) {}
    }

    // 2. Secondary: Extract locked single-resolution HLS tracks from hlsManifestUrl (ct=8, `/video/index.m3u8`)
    if (meta.hlsManifestUrl) {
      try {
        const hlsRes = await fetch(meta.hlsManifestUrl, {
          headers: reqHeaders,
          signal: AbortSignal.timeout(4500)
        });
        if (hlsRes.ok) {
          const masterTxt = await hlsRes.text();
          const lines = masterTxt.split('\n').map(l => l.trim()).filter(Boolean);
          const tracks = [];
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
              const nextLine = lines[i + 1];
              if (nextLine && !nextLine.startsWith('#')) {
                const height = resolveTrackHeight(lines[i], nextLine);
                if (height < 360) continue;
                const label = height >= 1080 ? '1080p FHD' : height >= 720 ? '720p HD' : height >= 480 ? '480p SD' : '360p';
                const baseTrackUrl = new URL(nextLine, meta.hlsManifestUrl).toString();
                const trackUrl = baseTrackUrl.endsWith('.m3u8')
                  ? baseTrackUrl
                  : `${baseTrackUrl.replace(/\/?$/, '/')}index.m3u8`;
                tracks.push({ height, label, trackUrl });
              }
            }
          }
          tracks.sort((a, b) => b.height - a.height);
          for (const tr of tracks) {
            if (seenTrackHeights.has(tr.height)) continue;
            seenTrackHeights.add(tr.height);
            streams.push({
              name: `[HU] ${providerName} (OK.ru) ${tr.label}`,
              title: `${meta.movie?.title || 'Magyar Stream'}\n🇭🇺 ${providerName} • OK.ru Fix ${tr.label} HLS${durTag} • Szinkron`,
              url: tr.trackUrl,
              quality: tr.height >= 1080 ? '1080p' : tr.height >= 720 ? '720p' : '480p',
              height: tr.height,
              source: providerName.toLowerCase(),
              behaviorHints: {
                ...proxyHints,
                bingeGroup: `hu-${providerName.toLowerCase()}-okru-hls-${tr.height}`
              }
            });
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: Direct MP4 links for any resolution height not already covered by HLS tracks
    if (Array.isArray(meta.videos)) {
      for (const v of meta.videos) {
        if (!v.url || v.disallowed) continue;
        const q = qualityMap[v.name] || { label: v.name, height: 480 };
        if (q.height < 360 || seenTrackHeights.has(q.height)) continue;
        seenTrackHeights.add(q.height);
        streams.push({
          name: `[HU] ${providerName} (OK.ru MP4) ${q.label}`,
          title: `${meta.movie?.title || 'Magyar Stream'}\n🇭🇺 ${providerName} • OK.ru ${q.label} MP4${durTag} • Szinkron`,
          url: v.url,
          quality: q.height >= 1080 ? '1080p' : q.height >= 720 ? '720p' : '480p',
          height: q.height,
          source: providerName.toLowerCase(),
          behaviorHints: {
            ...proxyHints,
            bingeGroup: `hu-${providerName.toLowerCase()}-okru-mp4-${q.height}`
          }
        });
      }
    }
  } catch (e) {
    // Ignore error
  }
  return streams;
}

/**
 * Extracts Videa streams from any Videa embed URL (supports both v= and f= formats)
 */
async function resolveVideaEmbed(embedUrl) {
  let clean = embedUrl.replace(/&amp;/g, '&');
  if (clean.startsWith('//')) clean = 'https:' + clean;

  // 1. Check standard v=<16-char-vcode> or /videok/...-<16-char-vcode>
  const vMatch = clean.match(/(?:[?&]v=|[-/])([a-zA-Z0-9]{16})(?:[?&#]|$)/);
  if (vMatch) {
    const data = await extractVideaStreams(vMatch[1]);
    if (data && data.sources && data.sources.length > 0) {
      return data.sources;
    }
  }

  // 2. Check f=<fcode> format (e.g. f=8.2720056.2191928.0)
  const fMatch = clean.match(/[?&]f=([0-9.]+)/);
  if (fMatch) {
    const fData = await extractVideaFCodeStreams(fMatch[1]);
    if (fData && fData.sources && fData.sources.length > 0) {
      return fData.sources;
    }
  }

  // 3. Fallback: fetch the player HTML and look for canonical vcode inside
  try {
    const res = await fetch(clean, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://filmezek.com/'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      const canonicalMatch = html.match(/[-/]([a-zA-Z0-9]{16})(?:["'?&#]|$)/);
      if (canonicalMatch) {
        const data = await extractVideaStreams(canonicalMatch[1]);
        if (data && data.sources) return data.sources;
      }
    }
  } catch (e) {}

  return [];
}

async function scrapeFilmezek(meta) {
  const streams = [];
  const searchTerms = [];

  const hu = meta.hungarianTitle || meta.englishTitle;
  if (!hu) return streams;

  // Filmezek autocomplete search handles titles very well
  searchTerms.push(hu);
  const strippedHu = hu.replace(/^(?:A|Az)\s+/i, '');
  if (strippedHu !== hu) searchTerms.push(strippedHu);

  if (meta.englishTitle && meta.englishTitle !== hu) {
    searchTerms.push(meta.englishTitle);
    const strippedEn = meta.englishTitle.replace(/^(?:The|A|An)\s+/i, '');
    if (strippedEn !== meta.englishTitle) searchTerms.push(strippedEn);
  }

  const seenUrls = new Set();

  for (const term of searchTerms) {
    try {
      const searchUrl = `https://filmezek.com/searchinput.php?searchType=1&term=${encodeURIComponent(term)}`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) continue;

      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) continue;

      // Filter matching item by IMDb ID or title + ±1 year similarity
      const isSeries = Boolean(meta.season);
      const targetYear = meta.year ? parseInt(meta.year, 10) : null;
      let matchingItems = items.filter(it => it.MovieCover && meta.imdbId && it.MovieCover.includes(meta.imdbId));
      if (matchingItems.length === 0) {
        matchingItems = items.filter(it => {
          const title = it.MovieTitle || it.value || it.label || '';
          const itemYear = parseInt(it.MovieYear || it.year || '', 10);
          if (!isSeries && targetYear && !isNaN(itemYear) && Math.abs(itemYear - targetYear) > 1) {
            return false;
          }
          if (isSeries && it.type === 'online-sorozatok') {
            return isTitleMatch(hu, title, meta.year, true) && (!meta.season || title.includes(`${meta.season}.`));
          }
          if (!isSeries && it.type === 'online-filmek') {
            return isTitleMatch(hu, title, meta.year, false) || isTitleMatch(meta.englishTitle, title, meta.year, false);
          }
          return false;
        });
      }

      if (matchingItems.length === 0) continue;

      for (const matchingItem of matchingItems.slice(0, 3)) {
        const pageType = matchingItem.type || (meta.season ? 'online-sorozatok' : 'online-filmek');
        const itemUrl = `https://filmezek.com/${pageType}/${matchingItem.MovieSlug}/`;

        const pageRes = await fetch(itemUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(6000)
        });
        if (!pageRes.ok) continue;

        const pageHtml = await pageRes.text();

        // Check IMDb ID and release year on detail page HTML
        if (!isSeries) {
          const pageCheck = checkPageMetadata(pageHtml, meta);
          if (!pageCheck.match) continue;
        }

        // Extract embed urls from data-url attributes and iframes
        const dataUrls = [...pageHtml.matchAll(/data-url=["']([^"']+)["']/g)].map(m => m[1]);
        const iframes = [...pageHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
        const allEmbeds = [...new Set([...dataUrls, ...iframes])];

        // Resolve Videa embeds and OK.ru HLS tracks in parallel for speed
        const videaEmbeds = allEmbeds.filter(e => e.includes('videa.hu')).slice(0, 4);
        const okEmbeds = allEmbeds.filter(e => e.includes('ok.ru/videoembed/') || e.includes('ok.ru/video/')).slice(0, 5);

        const [videaResults, okResults] = await Promise.all([
          Promise.all(videaEmbeds.map(embed => resolveVideaEmbed(embed).catch(() => []))),
          Promise.all(okEmbeds.map(embed => extractOkRuStreams(embed, 'Filmezek', meta).catch(() => [])))
        ]);

        for (const vSources of videaResults) {
          for (const vs of vSources) {
            if (vs.duration && vs.duration > 0 && vs.duration < (isSeries ? 480 : 2400)) continue;
            if (seenUrls.has(vs.url)) continue;
            seenUrls.add(vs.url);

            const qualLabel = vs.height >= 1080 ? '1080p FHD' : vs.height >= 720 ? '720p HD' : `${vs.height}p`;
            streams.push({
              name: `[HU] Filmezek (Videa) ${qualLabel}`,
              title: `${matchingItem.MovieTitle}\n🇭🇺 Filmezek.com (Videa) • ${qualLabel} • Szinkron`,
              url: vs.url,
              quality: vs.height >= 1080 ? '1080p' : vs.height >= 720 ? '720p' : '480p',
              height: vs.height,
              source: 'filmezek',
              yearVerified: true,
              behaviorHints: { bingeGroup: `hu-filmezek-videa-${qualLabel}` }
            });
          }
        }

        for (const okStreams of okResults) {
          for (const os of okStreams) {
            if (seenUrls.has(os.url)) continue;
            seenUrls.add(os.url);
            os.yearVerified = true;
            streams.push(os);
          }
        }

        if (streams.length > 0) break;
      }

      if (streams.length > 0) break;
    } catch (e) {
      // Continue to next search term
    }
  }

  return streams;
}

module.exports = {
  scrapeFilmezek,
  extractOkRuStreams,
  resolveVideaEmbed
};
