/**
 * IPTV playlist builders (M3U / XSPF) for the Live TV catalog.
 * Shared by the HTTP endpoints in server.js and by scripts/generate_playlists.js,
 * so a single change keeps the dynamic routes and the downloadable snapshots in sync.
 */

const { ALL_CHANNELS, ONLINESTREAM_CATEGORIES } = require('./scrapers/onlinestream');

const DEFAULT_LOGO_BASE = 'https://nuvio-magyar-http.onrender.com/tv-logos';
// Hír TV publishes the same live feed on videa.hu, which is the most stable mirror for the channel.
const HIRTV_MIRROR = 'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8';
const DEFAULT_GROUP = 'Magyar TV';

function sanitizeAttribute(value) {
  return String(value || '').replace(/["\r\n]+/g, ' ').trim();
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Ordered, de-duplicated playable URLs of a channel (primary first).
 */
function getStreamTargets(channel) {
  const targets = [];
  const seen = new Set();
  const push = (url) => {
    const clean = String(url || '').trim();
    if (!clean || !/^https?:\/\//i.test(clean) || seen.has(clean)) return;
    seen.add(clean);
    targets.push(clean);
  };

  if (channel.channelId === '4740') push(HIRTV_MIRROR);
  for (const stream of channel.streams || []) push(stream.url || stream.playerUrl);
  return targets;
}

/**
 * Flat playlist entries: one per channel (default) or one per mirror (allMirrors).
 */
function getPlaylistEntries({ allMirrors = false, logoBase = DEFAULT_LOGO_BASE, logoUrlFor = null, categoryFilter = null } = {}) {
  const categories = new Map(ONLINESTREAM_CATEGORIES.map(c => [c.id, c.name]));
  const resolveLogo = typeof logoUrlFor === 'function'
    ? logoUrlFor
    : (channelId) => `${String(logoBase).replace(/\/+$/, '')}/${channelId}.png`;
  const entries = [];

  for (const channel of ALL_CHANNELS) {
    if (categoryFilter && !categoryFilter.has(channel.category)) continue;
    const targets = getStreamTargets(channel);
    if (!targets.length) continue;

    const urls = allMirrors ? targets : targets.slice(0, 1);
    const logo = resolveLogo(channel.channelId);

    urls.forEach((url, index) => {
      entries.push({
        id: channel.id,
        channelId: channel.channelId,
        name: index === 0 ? channel.name : `${channel.name} (${index + 1})`,
        category: categories.get(channel.category) || DEFAULT_GROUP,
        description: channel.description || '',
        logo,
        url,
        mirror: index + 1
      });
    });
  }

  return entries;
}

/**
 * VLC / Kodi / TiviMate / IPTV Smarters compatible M3U playlist.
 */
function buildM3u(options = {}) {
  const entries = getPlaylistEntries(options);
  const lines = ['#EXTM3U name="Nuvio Magyar TV"'];

  for (const entry of entries) {
    const name = sanitizeAttribute(entry.name);
    lines.push(
      `#EXTINF:-1 tvg-id="${sanitizeAttribute(entry.channelId)}" tvg-name="${name}" ` +
      `tvg-logo="${sanitizeAttribute(entry.logo)}" group-title="${sanitizeAttribute(entry.category)}",${name}`
    );
    lines.push(entry.url);
  }

  return `${lines.join('\n')}\n`;
}

/**
 * XSPF playlist used by VLC and Kodi.
 */
function buildXspf(options = {}, { hostUrl = 'https://nuvio-magyar-http.onrender.com' } = {}) {
  const entries = getPlaylistEntries(options);
  const tracks = entries.map(entry => `    <track>
      <title>${escapeXml(entry.name)}</title>
      <creator>${escapeXml(entry.category)}</creator>
      <album>Nuvio Magyar TV</album>
      <location>${escapeXml(entry.url)}</location>
      <image>${escapeXml(entry.logo)}</image>
      <annotation>${escapeXml(entry.description)}</annotation>
    </track>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<playlist version="1" xmlns="http://xspf.org/ns/0/">
  <title>Nuvio Magyar TV - Élő TV Csatornák (${ALL_CHANNELS.length} Adó)</title>
  <creator>Nuvio Magyar Streaming Pro</creator>
  <info>${escapeXml(hostUrl)}</info>
  <trackList>
${tracks.join('\n')}
  </trackList>
</playlist>
`;
}


/**
 * IPTV playlist for players without mirror support (TiviMate, Kodi, Smarters).
 * Every channel gets ONE stable URL that our server resolves to the best live
 * mirror on each request, so the same entry keeps working when a host dies.
 */
function buildAutoMirrorM3u({ hostUrl = 'https://nuvio-magyar-http.onrender.com', logoBase, logoUrlFor, categoryFilter = null } = {}) {
  const base = String(hostUrl || '').replace(/\/+$/, '');
  const entries = getPlaylistEntries({ allMirrors: false, logoBase, logoUrlFor, categoryFilter });
  const lines = ['#EXTM3U name="Nuvio Magyar TV"'];

  for (const entry of entries) {
    const name = sanitizeAttribute(entry.name);
    lines.push(
      `#EXTINF:-1 tvg-id="${sanitizeAttribute(entry.channelId)}" tvg-name="${name}" ` +
      `tvg-logo="${sanitizeAttribute(entry.logo)}" group-title="${sanitizeAttribute(entry.category)}",${name}`
    );
    lines.push(`${base}/api/tv/live/${encodeURIComponent(entry.channelId)}.m3u8`);
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  ALL_CHANNEL_COUNT: ALL_CHANNELS.length,
  getStreamTargets,
  getPlaylistEntries,
  buildM3u,
  buildAutoMirrorM3u,
  buildXspf,
  DEFAULT_LOGO_BASE
};
