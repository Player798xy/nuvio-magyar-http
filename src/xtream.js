/**
 * Minimal Xtream Codes compatible API for TiviMate and other IPTV apps.
 *
 * Live TV only: categories + channels are derived from the same ALL_CHANNELS
 * catalog as the addon, and every stream URL points at /api/tv/live/:id which
 * resolves to the best working mirror at playback time. There is no real auth
 * (the list is public), any username/password pair is accepted.
 */

const { ONLINESTREAM_CATEGORIES } = require('./scrapers/onlinestream');
const { buildChannelPayload } = require('./tv_channels');

const PUBLIC_HOST = String(process.env.PUBLIC_BASE_URL || 'https://nuvio-magyar-http.onrender.com').replace(/\/+$/, '');
const CATEGORY_INDEX = new Map(ONLINESTREAM_CATEGORIES.map((category, index) => [category.id, String(index + 1)]));

let payloadCache = null;
let payloadCacheAt = 0;

function getPayload() {
  if (!payloadCache || Date.now() - payloadCacheAt > 5 * 60 * 1000) {
    payloadCache = buildChannelPayload();
    payloadCacheAt = Date.now();
  }
  return payloadCache;
}

function parseHost(hostUrl) {
  try {
    const parsed = new URL(String(hostUrl || PUBLIC_HOST));
    return {
      url: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
      protocol: parsed.protocol.replace(':', ''),
      origin: parsed.origin
    };
  } catch (e) {
    return { url: 'nuvio-magyar-http.onrender.com', port: '443', protocol: 'https', origin: PUBLIC_HOST };
  }
}

function getLiveCategories(categoryFilter = null) {
  return getPayload().categories
    .filter(category => !categoryFilter || categoryFilter.has(category.id))
    .map(category => ({
      category_id: CATEGORY_INDEX.get(category.id) || '1',
      category_name: category.name,
      parent_id: 0
    }));
}

function getLiveStreams(categoryId = '', hostUrl = '', categoryFilter = null) {
  const payload = getPayload();
  const wanted = String(categoryId || '').trim();
  const host = String(hostUrl || PUBLIC_HOST).replace(/\/+$/, '');

  return payload.channels
    .filter(channel => !categoryFilter || categoryFilter.has(channel.category))
    .filter(channel => !wanted || CATEGORY_INDEX.get(channel.category) === wanted)
    .map((channel, index) => ({
      num: index + 1,
      name: channel.name,
      stream_type: 'live',
      stream_id: Number(channel.channelId),
      stream_icon: `${host}/tv-logo/${channel.channelId}.png`,
      epg_channel_id: String(channel.channelId),
      added: String(Math.floor(payloadCacheAt / 1000)),
      category_id: CATEGORY_INDEX.get(channel.category) || '1',
      custom_sid: '',
      tv_archive: 0,
      direct_source: '',
      tv_archive_duration: 0
    }));
}

function getUserInfo(username, password) {
  return {
    username: username || 'nuvio',
    password: password || 'magyar',
    message: 'Nuvio Magyar TV - Élő csatornák',
    auth: 1,
    status: 'Active',
    exp_date: null,
    is_trial: '0',
    active_cons: '0',
    created_at: String(Math.floor(Date.now() / 1000)),
    max_connections: '1',
    allowed_output_formats: ['m3u8']
  };
}

function getServerInfo(hostUrl) {
  const host = parseHost(hostUrl);
  const now = new Date();
  return {
    url: host.url,
    port: host.port,
    https_port: '443',
    server_protocol: host.protocol,
    rtmp_port: '25462',
    timezone: 'Europe/Budapest',
    timestamp_now: Math.floor(now.getTime() / 1000),
    time_now: now.toISOString().slice(0, 19).replace('T', ' '),
    process: true
  };
}

/**
 * player_api.php dispatcher. Unknown actions return an empty payload so the
 * client keeps working instead of failing the whole account.
 */
function handlePlayerApi(action, query, hostUrl, categoryFilter = null) {
  switch (String(action || '')) {
    case 'get_live_categories':
      return getLiveCategories(categoryFilter);
    case 'get_live_streams':
      return getLiveStreams(query.category_id, hostUrl, categoryFilter);
    case 'get_vod_categories':
    case 'get_series_categories':
    case 'get_vod_streams':
    case 'get_series':
      return [];
    case 'get_series_info':
    case 'get_vod_info':
      return {};
    case 'get_short_epg':
    case 'get_simple_data_table':
      return { epg_listings: [] };
    case '':
    case 'login':
      return {
        user_info: getUserInfo(query.username, query.password),
        server_info: getServerInfo(hostUrl)
      };
    default:
      return [];
  }
}

/**
 * Minimal but valid XMLTV document. TiviMate auto-detects /xmltv.php from the
 * Xtream account; without programmes it still maps channel names correctly.
 */
function buildXmltv(categoryFilter = null) {
  const payload = getPayload();
  const escape = (value) => String(value || '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;'
  }[c]));

  const channels = payload.channels
    .filter(channel => !categoryFilter || categoryFilter.has(channel.category))
    .map(channel => `  <channel id="${escape(channel.channelId)}">
    <display-name>${escape(channel.name)}</display-name>
    <icon src="${escape(channel.logo)}"/>
  </channel>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="Nuvio Magyar TV">
${channels.join('\n')}
</tv>
`;
}

function invalidatePayloadCache() {
  payloadCache = null;
  payloadCacheAt = 0;
}

module.exports = {
  handlePlayerApi,
  invalidatePayloadCache,
  getLiveCategories,
  getLiveStreams,
  buildXmltv,
  parseHost,
  PUBLIC_HOST
};
