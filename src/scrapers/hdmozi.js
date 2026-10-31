const { UA, normalizeTitle } = require('../utils/meta');
const { resolveRpmStream } = require('../utils/crypto_decoders');
const { resolveAnyEmbed } = require('../utils/hosters');

const HDMOZI_BASE = 'https://hdmozi.hu';

function slugifyHu(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '-')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findHdMoziPageUrl(meta) {
  const { titles, year, type, season, episode } = meta;

  for (const title of titles.slice(0, 2)) {
    try {
      const searchUrl = `${HDMOZI_BASE}/?s=${encodeURIComponent(title)}`;
      const r = await fetch(searchUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) continue;
      const html = await r.text();

      const detailsPattern = /<div class="details">([\s\S]*?)<\/div>\s*<\/div>/gi;
      const results = [];
      let m;
      while ((m = detailsPattern.exec(html)) !== null) {
        const block = m[1];
        const tm = block.match(/<div class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/i);
        if (!tm) continue;
        const href = tm[1];
        const rTitle = tm[2].trim();
        const ym = block.match(/<span class="year">\s*(\d{4})\s*<\/span>/i);
        const rYear = ym ? parseInt(ym[1], 10) : null;
        const rType = href.includes('/movies/') ? 'movie' : 'series';
        results.push({ href, title: rTitle, year: rYear, type: rType });
      }

      const normTarget = normalizeTitle(title);
      const scored = results
        .map((item) => {
          const rt = normalizeTitle(item.title);
          let score = 0;
          if (rt === normTarget) score += 100;
          else if (rt.includes(normTarget) || normTarget.includes(rt)) score += 60;
          if (year && item.year) score += Math.max(0, 30 - Math.abs(year - item.year) * 10);
          if (type === item.type) score += 20;
          return { ...item, score };
        })
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 50) {
        const best = scored[0];
        if (type === 'series' && season && episode) {
          const slug = best.href.replace(/\/$/, '').split('/').pop().replace(/-\d+x\d+$/, '');
          return { url: `${HDMOZI_BASE}/episodes/${slug}-${season}x${episode}/`, title: best.title };
        }
        return { url: best.href, title: best.title };
      }
    } catch {}
  }

  const slug = slugifyHu(titles[0]);
  if (!slug) return null;
  if (type === 'series' && season && episode) {
    return { url: `${HDMOZI_BASE}/episodes/${slug}-${season}x${episode}/`, title: titles[0] };
  }
  return { url: `${HDMOZI_BASE}/movies/${slug}/`, title: titles[0] };
}

async function searchHdMozi(meta) {
  const streams = [];
  const target = await findHdMoziPageUrl(meta);
  if (!target) return streams;

  try {
    const r = await fetch(target.url, {
      headers: { 'User-Agent': UA, Referer: `${HDMOZI_BASE}/` },
      signal: AbortSignal.timeout(5500)
    });
    if (!r.ok) return streams;
    const html = await r.text();

    const postIdMatch =
      html.match(/data-post\s*=\s*['"](\d+)['"]/) ||
      html.match(/post_id['"]\s*:\s*['"]*(\d+)['"]*/) ||
      html.match(/wp-post-(\d+)/);
    if (!postIdMatch) return streams;
    const postId = postIdMatch[1];

    const dooType = target.url.includes('/episodes/') ? 'tv' : 'movie';
    const nums = [...html.matchAll(/player-option[^>]*data-nume=['"](\d+)['"]/g)].map((m) => m[1]);
    if (nums.length === 0) nums.push('1', '2');

    await Promise.allSettled(
      nums.slice(0, 3).map(async (nume) => {
        let embedText = '';
        const restUrl = `${HDMOZI_BASE}/wp-json/dooplayer/v2/${postId}/${dooType}/${nume}`;
        const restRes = await fetch(restUrl, {
          headers: { 'User-Agent': UA, Referer: target.url },
          signal: AbortSignal.timeout(4500)
        }).catch(() => null);

        if (restRes && restRes.ok) {
          embedText = await restRes.text();
        } else {
          const ajaxRes = await fetch(`${HDMOZI_BASE}/wp-admin/admin-ajax.php`, {
            method: 'POST',
            headers: {
              'User-Agent': UA,
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: target.url,
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: new URLSearchParams({ action: 'doo_player_ajax', post: postId, nume, type: dooType }).toString(),
            signal: AbortSignal.timeout(4500)
          }).catch(() => null);
          if (ajaxRes && ajaxRes.ok) embedText = await ajaxRes.text();
        }

        if (!embedText) return;
        let embedUrl = embedText;
        try {
          const parsed = JSON.parse(embedText);
          if (parsed.embed_url) embedUrl = parsed.embed_url;
        } catch {}

        const rpmMatch = embedUrl.match(/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9_-]+)/i);
        if (rpmMatch) {
          const rpm = await resolveRpmStream(rpmMatch[1], target.url);
          if (rpm) {
            streams.push({
              name: `🇭🇺 HDMozi (RPM)\n1080p`,
              title: `🎬 ${target.title}\n📺 1080p FHD HLS • 🔊 Magyar • 🌐 HDMozi.hu`,
              url: rpm.url,
              quality: 1080,
              isHls: true,
              headers: rpm.headers
            });
            return;
          }
        }

        const iframeMatch = embedUrl.match(/src=["']([^"']+)["']/i);
        const candidateUrl = iframeMatch ? iframeMatch[1] : embedUrl;
        const resolved = await resolveAnyEmbed(candidateUrl, 'HDMozi.hu', target.title);
        streams.push(...resolved);
      })
    );
  } catch {}

  return streams;
}

module.exports = { searchHdMozi };
