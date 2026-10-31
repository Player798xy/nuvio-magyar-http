const { UA, normalizeTitle } = require('../utils/meta');
const { resolveAnyEmbed } = require('../utils/hosters');

const BASE_URL = 'https://www.onlinefilmekingyen1.com';

async function resolveDooPlayEmbed(post, nume, type, referer) {
  try {
    const v2Url = `${BASE_URL}/wp-json/dooplayer/v2/${post}/${type}/${nume}`;
    const r = await fetch(v2Url, {
      headers: { 'User-Agent': UA, Referer: referer },
      signal: AbortSignal.timeout(4500)
    });
    if (r.ok) {
      const data = await r.json();
      if (data?.embed_url) return data.embed_url;
    }
  } catch {}

  try {
    const r = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest',
        Referer: referer,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: new URLSearchParams({
        action: 'doo_player_ajax',
        post: String(post),
        nume: String(nume),
        type: type || 'movie'
      }).toString(),
      signal: AbortSignal.timeout(4500)
    });
    if (r.ok) {
      const data = await r.json();
      return data?.embed_url || null;
    }
  } catch {}
  return null;
}

async function searchOnlineFilmek(meta) {
  const { titles, year, type, season, episode } = meta;
  const isSeries = type === 'series';
  const streams = [];

  for (const term of titles.slice(0, 2)) {
    try {
      let itemUrl = null;
      let postTitle = term;

      const wpSearchUrl = `${BASE_URL}/?s=${encodeURIComponent(term)}`;
      const wpRes = await fetch(wpSearchUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(5000)
      });
      if (wpRes.ok) {
        const html = await wpRes.text();
        const matches = [...html.matchAll(/<div class="title"><a href="([^"]+)">([^<]+)<\/a>/gi)];
        const normTarget = normalizeTitle(term);
        for (const m of matches) {
          const mUrl = m[1];
          const mTitle = m[2].trim();
          const isTv = mUrl.includes('/tvshows/');
          if (isSeries !== isTv) continue;
          const normM = normalizeTitle(mTitle);
          if (normM === normTarget || normM.includes(normTarget) || normTarget.includes(normM)) {
            itemUrl = mUrl;
            postTitle = mTitle;
            break;
          }
        }
      }

      if (!itemUrl) continue;

      if (isSeries && season && episode) {
        const slug = itemUrl.replace(/\/$/, '').split('/').pop();
        itemUrl = `${BASE_URL}/episodes/${slug}-${season}x${episode}/`;
      }

      const pageRes = await fetch(itemUrl, {
        headers: { 'User-Agent': UA, Referer: `${BASE_URL}/` },
        signal: AbortSignal.timeout(5500)
      });
      if (!pageRes.ok) continue;
      const pageHtml = await pageRes.text();

      const options = [...pageHtml.matchAll(/data-type=['"]([^'"]+)['"]\s+data-post=['"](\d+)['"]\s+data-nume=['"](\d+)['"]/gi)];
      await Promise.allSettled(
        options.slice(0, 5).map(async (opt) => {
          const [, pType, pPost, pNume] = opt;
          if (pNume === 'trailer') return;
          const rawEmbed = await resolveDooPlayEmbed(pPost, pNume, pType, itemUrl);
          if (!rawEmbed) return;
          const iframeMatch = rawEmbed.match(/src=["']([^"']+)["']/i);
          const embedUrl = iframeMatch ? iframeMatch[1] : rawEmbed;
          const resolved = await resolveAnyEmbed(embedUrl, 'OnlineFilmek', postTitle);
          streams.push(...resolved);
        })
      );

      if (streams.length > 0) break;
    } catch {}
  }

  return streams;
}

module.exports = { searchOnlineFilmek };
