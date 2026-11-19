/**
 * Canonical Live TV channel payload for the /tv viewer.
 * One shape used by the API route, the Git snapshot (public/tv-channels.json)
 * and the static playlist generator, so the viewer always sees the same data.
 */

const { ALL_CHANNELS, ONLINESTREAM_CATEGORIES } = require('./scrapers/onlinestream');
const { getStreamTargets } = require('./playlists');
const { filterCategories } = require('./tv_profiles');

const PUBLIC_HOST = String(process.env.PUBLIC_BASE_URL || 'https://nuvio-magyar-http.onrender.com').replace(/\/+$/, '');

/**
 * Artwork uses the dynamic /tv-logo|/tv-poster|/tv-background routes: they serve
 * the bundled PNG when it exists and a generated SVG otherwise, so a channel can
 * never render a broken image. The host is the request host at runtime.
 */
function channelLogos(channelId, base = PUBLIC_HOST) {
  const host = String(base || PUBLIC_HOST).replace(/\/+$/, '');
  return {
    logo: `${host}/tv-logo/${channelId}.png`,
    poster: `${host}/tv-poster/${channelId}.png`,
    background: `${host}/tv-background/${channelId}.png`
  };
}

function normalizeMirror(url, limit = 12) {
  const out = [];
  const seen = new Set();
  for (const raw of url) {
    const clean = String(raw || '').trim();
    if (!clean || !/^https?:\/\//i.test(clean) || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function buildChannelPayload({ hostUrl = PUBLIC_HOST, categoryFilter = null } = {}) {
  const selected = ALL_CHANNELS.filter(channel => !categoryFilter || categoryFilter.has(channel.category));

  const categories = filterCategories(ONLINESTREAM_CATEGORIES, categoryFilter).map(category => ({
    id: category.id,
    name: category.name,
    description: category.description || '',
    count: selected.filter(ch => ch.category === category.id).length
  }));

  const channels = selected.map(channel => {
    const urls = normalizeMirror(getStreamTargets(channel));
    return {
      id: channel.id,
      channelId: channel.channelId,
      name: channel.name,
      category: channel.category,
      description: channel.description || '',
      releaseInfo: channel.releaseInfo || '',
      ...channelLogos(channel.channelId, hostUrl),
      ...(channel.logoUrl ? { logo: channel.logoUrl } : {}),
      mirrors: urls.map(url => {
        let host = '';
        try { host = new URL(url).hostname; } catch (e) {}
        return {
          url,
          host,
          secure: url.startsWith('https://')
        };
      })
    };
  });

  const mirrorCount = channels.reduce((sum, ch) => sum + ch.mirrors.length, 0);

  return {
    version: require('../package.json').version,
    generatedAt: new Date().toISOString(),
    count: channels.length,
    mirrorCount,
    categories,
    channels
  };
}

module.exports = { buildChannelPayload, normalizeMirror };
