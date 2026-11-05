const { cfRequest } = require('../utils/http');
const { decodeHunter, extractVoeDirectStreams } = require('../utils/crypto_decoders');
const { extractVideaStreams } = require('./videa');
const { extractIndavideoStreams } = require('./indavideo');
const { extractOkRuStreams } = require('./filmezek');

function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let searchIndexCache = null;
let searchIndexTime = 0;

async function getSorozatokIndex() {
  if (searchIndexCache && Date.now() - searchIndexTime < 6 * 3600 * 1000) {
    return searchIndexCache;
  }
  const res = await cfRequest('https://sorozatok.net/api/search.json', { timeoutMs: 7000 });
  if (res?.status === 200 && res.text) {
    try {
      const parsed = JSON.parse(res.text);
      if (Array.isArray(parsed) && parsed.length > 100) {
        searchIndexCache = parsed;
        searchIndexTime = Date.now();
        return parsed;
      }
    } catch {}
  }
  return searchIndexCache || [];
}

/**
 * Resolves hoster stream from Sorozatok.net redirect URL.
 * Supports Videa, Videakid, Indavideo, OK.ru (both Vercel & Self-Host)
 * and VOE direct HLS/MP4 (Self-Host only, since VOE tokens are IP-bound).
 */
async function resolveHosterStream(rawUrl, epLabel) {
  const streams = [];
  if (!rawUrl || typeof rawUrl !== 'string') return streams;
  const url = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
  const lower = url.toLowerCase();

  try {
    // 1. Videa / Videakid (Direct non-IP-bound MP4)
    if (lower.includes('videa.hu') || lower.includes('videakid.hu')) {
      const vMatch = url.match(/[?&]v=([a-zA-Z0-9]{16})/) || url.match(/-([a-zA-Z0-9]{16})(?:$|[/?#])/);
      if (vMatch) {
        const vd = await extractVideaStreams(vMatch[1]);
        if (vd && vd.sources) {
          for (const vs of vd.sources) {
            const qualLabel = vs.height >= 1080 ? '1080p FHD' : vs.height >= 720 ? '720p HD' : `${vs.height}p`;
            streams.push({
              name: `[HU] Sorozatok.net ${qualLabel}`,
              title: `${epLabel}\n🇭🇺 Sorozatok.net (Videa) • ${qualLabel}`,
              url: vs.url,
              quality: vs.height >= 1080 ? '1080p' : vs.height >= 720 ? '720p' : '480p',
              height: vs.height,
              source: 'sorozatoknet',
              behaviorHints: { bingeGroup: `hu-sorozatoknet-${qualLabel}` }
            });
          }
        }
      }
      return streams;
    }

    // 2. Indavideo (Direct non-IP-bound MP4)
    if (lower.includes('indavideo.hu')) {
      const iMatch = url.match(/(?:video\/|v\/)([a-zA-Z0-9]+)/);
      if (iMatch) {
        const iData = await extractIndavideoStreams(iMatch[1]);
        for (const is of (iData?.streams || [])) {
          const qualLabel = is.height >= 1080 ? '1080p FHD' : is.height >= 720 ? '720p HD' : `${is.height}p`;
          streams.push({
            name: `[HU] Sorozatok.net ${qualLabel}`,
            title: `${epLabel}\n🇭🇺 Sorozatok.net (Indavideo) • ${qualLabel}`,
            url: is.url,
            quality: is.height >= 1080 ? '1080p' : is.height >= 720 ? '720p' : '480p',
            height: is.height,
            source: 'sorozatoknet',
            behaviorHints: { bingeGroup: `hu-sorozatoknet-${qualLabel}` }
          });
        }
      }
      return streams;
    }

    // 3. OK.ru (Direct HLS/MP4)
    if (lower.includes('ok.ru')) {
      const okStreams = await extractOkRuStreams(url, 'Sorozatok.net');
      for (const os of okStreams) {
        os.source = 'sorozatoknet';
        streams.push(os);
      }
      return streams;
    }

    // 4. VOE (Self-Host Direct HLS/MP4 extraction)
    if (lower.includes('voe.sx') || lower.includes('voe.')) {
      const voeStreams = await extractVoeDirectStreams(url, 'Sorozatok.net', epLabel, 'sorozatoknet');
      streams.push(...voeStreams);
      return streams;
    }
  } catch {}
  return streams;
}

async function scrapeSorozatokNet(meta) {
  const rawTitles = meta.searchTitles || meta.titles || [meta.hungarianTitle, meta.englishTitle];
  const titles = [...new Set(rawTitles.filter(Boolean))];
  const { type, season, episode } = meta;
  if (type !== 'series' || !season || !episode) return [];

  const index = await getSorozatokIndex();
  const normTargets = titles.map(normalizeTitle).filter(Boolean);
  let matchedSeries = null;

  for (const item of index) {
    const huNorm = normalizeTitle(item.cat_name);
    const enNorm = normalizeTitle(item.cat_eng);
    if (normTargets.some((t) => t === huNorm || t === enNorm)) {
      matchedSeries = item;
      break;
    }
  }

  const targetYear = meta.year ? parseInt(meta.year, 10) : null;
  if (!matchedSeries) {
    for (const item of index) {
      const itemYear = item.year ? parseInt(item.year, 10) : null;
      if (targetYear && itemYear && Math.abs(targetYear - itemYear) > 2) continue;
      const huNorm = normalizeTitle(item.cat_name);
      const enNorm = normalizeTitle(item.cat_eng);
      if (normTargets.some((t) => t.length > 3 && (huNorm.includes(t) || enNorm.includes(t)))) {
        matchedSeries = item;
        break;
      }
    }
  }

  const slug = matchedSeries?.url || normalizeTitle(meta.hungarianTitle || meta.englishTitle).replace(/\s+/g, '-');
  if (!slug) return [];

  const seriesUrl = `https://sorozatok.net/${slug}-online`;
  const seriesRes = await cfRequest(seriesUrl, { timeoutMs: 6500 });
  if (!seriesRes?.text) return [];

  const epBlocks = [...seriesRes.text.matchAll(/<a[^>]+class="clip-link"[^>]*>[\s\S]*?<h4[^>]+class="video-title"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi)];
  let targetEpHref = null;
  let targetEmbedId = null;
  let targetEpTitle = '';

  for (const m of epBlocks) {
    const fullTag = m[0];
    const hrefMatch = fullTag.match(/href="([^"]+)"/i);
    const idMatch = fullTag.match(/data-id="(\d+)"/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    const epTitle = m[1].trim();
    const nums = [...epTitle.matchAll(/\d+/g)].map((n) => parseInt(n[0], 10));
    if (nums.length >= 2) {
      const sNum = nums[nums.length - 2];
      const eNum = nums[nums.length - 1];
      if (sNum === Number(season) && eNum === Number(episode)) {
        targetEpHref = href;
        targetEmbedId = idMatch ? idMatch[1] : null;
        targetEpTitle = epTitle;
        break;
      }
    }
  }

  if (!targetEpHref) return [];

  const epUrl = new URL(targetEpHref, 'https://sorozatok.net').href;
  const urlId = (epUrl.match(/watch.*v=([a-zA-Z0-9_-]+)/) || [])[1];
  if (!urlId) return [];

  if (!targetEmbedId) {
    const epPage = await cfRequest(epUrl, { timeoutMs: 6000 });
    if (!epPage?.text) return [];
    const embedIdMatch =
      epPage.text.match(new RegExp(`data-id="([^"]+)"[^>]*${urlId}`)) ||
      epPage.text.match(/data-id="(\d+)"/);
    if (!embedIdMatch) return [];
    targetEmbedId = embedIdMatch[1];
  }

  const goUrl = `https://sorozatok.net/go.php?id=${targetEmbedId}&key=${urlId}`;
  const sbPage = await cfRequest(goUrl, { timeoutMs: 6500 }, 4);
  if (!sbPage?.text) return [];

  const hunterRegex = /decodeURIComponent\(escape\(r\)\)\}\(\s*"([^"]+)",\s*(\d+),\s*"([^"]+)",\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/g;
  const hosterUrls = [];
  let hm;
  while ((hm = hunterRegex.exec(sbPage.text)) !== null) {
    const decoded = decodeHunter(hm[1], Number(hm[2]), hm[3], Number(hm[4]), Number(hm[5]), Number(hm[6]));
    const vpMatch = decoded.match(/https?:\/\/[^\s"'<>]+\/videoplayback\.php\?hash=[a-zA-Z0-9]+/);
    if (vpMatch) hosterUrls.push(vpMatch[0]);
  }

  const streams = [];
  const seen = new Set();

  await Promise.allSettled(
    hosterUrls.slice(0, 4).map(async (vpUrl) => {
      const vpRes = await cfRequest(vpUrl, { timeoutMs: 5500 }, 0);
      const loc = vpRes?.headers?.location;
      if (!loc || seen.has(loc)) return;
      seen.add(loc);

      const resolved = await resolveHosterStream(loc, targetEpTitle || `${(matchedSeries?.cat_name || meta.hungarianTitle || meta.englishTitle)} S${season}E${episode}`);
      streams.push(...resolved);
    })
  );

  return streams;
}

module.exports = { scrapeSorozatokNet, searchSorozatokNet: scrapeSorozatokNet, getSorozatokIndex };
