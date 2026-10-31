const { cfRequest } = require('../utils/http');
const { normalizeTitle } = require('../utils/meta');
const { decodeHunter } = require('../utils/crypto_decoders');
const { resolveAnyEmbed } = require('../utils/hosters');

/**
 * Sorozatok.net Scraper (Hungarian TV Series Catalog & Direct Hoster Extractor)
 * 1. Queries `https://sorozatok.net/api/search.json` (cached in memory)
 * 2. Matches Hungarian or English title
 * 3. Finds target season & episode (`/watch.php?v=...`)
 * 4. Follows `/go.php?id=...&key=...` -> `streambot.click` -> `hunter(...)` deobfuscation -> `videoplayback.php`
 * 5. Unpacks direct HLS / MP4 from VOE / Filemoon / Videa / etc.
 */

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

async function searchSorozatokNet(meta) {
  const { titles, type, season, episode } = meta;
  if (type !== 'series' || !season || !episode) return [];

  const index = await getSorozatokIndex();
  if (!index.length) return [];

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

  if (!matchedSeries) {
    for (const item of index) {
      const huNorm = normalizeTitle(item.cat_name);
      const enNorm = normalizeTitle(item.cat_eng);
      if (normTargets.some((t) => t.length > 3 && (huNorm.includes(t) || enNorm.includes(t)))) {
        matchedSeries = item;
        break;
      }
    }
  }

  if (!matchedSeries || !matchedSeries.url) return [];

  const seriesUrl = `https://sorozatok.net/${matchedSeries.url}-online`;
  const seriesRes = await cfRequest(seriesUrl, { timeoutMs: 6500 });
  if (!seriesRes?.text) return [];

  const epBlocks = [...seriesRes.text.matchAll(/<a[^>]+class="clip-link"[^>]+href="([^"]+)"[\s\S]*?<h4[^>]+class="video-title"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi)];
  let targetEpHref = null;
  let targetEpTitle = '';

  for (const m of epBlocks) {
    const href = m[1];
    const epTitle = m[2].trim();
    const nums = [...epTitle.matchAll(/\d+/g)].map((n) => parseInt(n[0], 10));
    if (nums.length >= 2) {
      const sNum = nums[nums.length - 2];
      const eNum = nums[nums.length - 1];
      if (sNum === Number(season) && eNum === Number(episode)) {
        targetEpHref = href;
        targetEpTitle = epTitle;
        break;
      }
    }
  }

  if (!targetEpHref) return [];

  const epUrl = new URL(targetEpHref, 'https://sorozatok.net').href;
  const urlId = (epUrl.match(/watch.*v=([a-zA-Z0-9_-]+)/) || [])[1];
  if (!urlId) return [];

  const epPage = await cfRequest(epUrl, { timeoutMs: 6000 });
  if (!epPage?.text) return [];

  const embedIdMatch =
    epPage.text.match(new RegExp(`data-id="([^"]+)"[^>]*${urlId}`)) ||
    epPage.text.match(/data-id="(\d+)"/);
  if (!embedIdMatch) return [];

  const goUrl = `https://sorozatok.net/go.php?id=${embedIdMatch[1]}&key=${urlId}`;
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

      const resolved = await resolveAnyEmbed(loc, 'Sorozatok.net', targetEpTitle || matchedSeries.cat_name);
      streams.push(...resolved);
    })
  );

  return streams;
}

module.exports = { searchSorozatokNet, getSorozatokIndex };
