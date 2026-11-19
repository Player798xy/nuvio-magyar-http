/**
 * Opt-in HLS relay used only when direct playback is impossible
 * (http-only mirror on an https page, or a host that blocks browser CORS).
 *
 * Playlists are rewritten so every variant/segment/key URL points back at the
 * relay; segments are streamed through with Range passthrough. It is disabled
 * by default in the UI because it moves real video bytes through the server.
 */

const UPSTREAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: '*/*'
};

const PLAYLIST_TIMEOUT_MS = 8000;

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

/**
 * Rejects loopback/link-local/private targets so the public relay and the URL
 * checker cannot be used as an SSRF proxy into the host network.
 */
function isPublicHttpUrl(value) {
  if (!isHttpUrl(value)) return false;
  let parsed;
  try { parsed = new URL(String(value).trim()); } catch (e) { return false; }
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a >= 224) return false;
    return true;
  }

  if (host.startsWith('[') || host.includes(':')) {
    // IPv6 literals: allow only globally routable 2000::/3 addresses.
    return /^\[2[0-9a-f]{1,3}:/i.test(host);
  }

  return true;
}

function relayPlaylistUrl(absoluteUrl) {
  return `/api/tv/relay.m3u8?url=${encodeURIComponent(absoluteUrl)}`;
}

function relaySegmentUrl(absoluteUrl) {
  return `/api/tv/relay/segment?url=${encodeURIComponent(absoluteUrl)}`;
}

/**
 * Rewrites every URI in an HLS playlist to a relay URL.
 * Master playlists keep variant order, media playlists keep segment order,
 * encryption keys are relayed as well so AES-128 HLS still decrypts.
 */
function rewritePlaylist(body, baseUrl) {
  const lines = String(body || '').split(/\r?\n/);
  const out = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { out.push(''); continue; }

    if (line.startsWith('#EXT-X-KEY:') || line.startsWith('#EXT-X-MAP:') || line.startsWith('#EXT-X-MEDIA:')) {
      out.push(line.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          return `URI="${relaySegmentUrl(new URL(uri, baseUrl).toString())}"`;
        } catch (e) {
          return match;
        }
      }));
      continue;
    }

    if (line.startsWith('#')) { out.push(line); continue; }

    let absoluteUrl;
    try { absoluteUrl = new URL(line, baseUrl).toString(); } catch (e) { out.push(line); continue; }

    const isPlaylist = /\.m3u8?(\?|$)/i.test(absoluteUrl) || absoluteUrl.includes('playlist');
    out.push(isPlaylist ? relayPlaylistUrl(absoluteUrl) : relaySegmentUrl(absoluteUrl));
  }

  return out.join('\n');
}

async function fetchUpstream(url, { range = '' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAYLIST_TIMEOUT_MS);
  try {
    const headers = { ...UPSTREAM_HEADERS };
    if (range) headers.Range = range;
    const response = await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
    return { response };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the rewritten playlist body for a given upstream URL.
 */
async function getRelayedPlaylist(url) {
  if (!isPublicHttpUrl(url)) {
    const error = new Error('invalid or non-public url');
    error.statusCode = 400;
    throw error;
  }

  const { response } = await fetchUpstream(url);
  if (!response.ok) {
    const error = new Error(`upstream HTTP ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const body = await response.text();
  if (!body.includes('#EXTM3U')) {
    const error = new Error('not an HLS playlist');
    error.statusCode = 502;
    throw error;
  }

  return rewritePlaylist(body, response.url || url);
}

module.exports = { getRelayedPlaylist, rewritePlaylist, isHttpUrl, isPublicHttpUrl, UPSTREAM_HEADERS };
