/**
 * Live egress/ingress traffic meter for the addon server.
 *
 * Counts actual response bytes per request (works for buffered JSON and for
 * streamed relay segments), keeps per-second / per-minute / per-hour rings and
 * exposes a snapshot for the /traffic dashboard.
 *
 * The point of this module is to make it obvious that video only flows through
 * the server when the opt-in relay is used — everything else is JSON/static.
 */

const MAX_SECONDS = 180;
const MAX_MINUTES = 120;
const MAX_HOURS = 48;

const CLASS_LABELS = {
  relay: 'Relay (videó)',
  epg: 'EPG / XMLTV',
  playlist: 'Lejátszási listák',
  api: 'API',
  static: 'Web / statikus',
  other: 'Egyéb'
};

function dayKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}

function emptyBucket() {
  return { bytes: 0, requests: 0, classes: Object.create(null), reqClasses: Object.create(null) };
}

const state = {
  bootAt: Date.now(),
  perSecond: new Map(),
  perMinute: new Map(),
  perHour: new Map(),
  todayKey: dayKey(),
  todayBytes: 0,
  todayRequests: 0,
  todayByClass: Object.create(null),
  todayReqByClass: Object.create(null),
  bootBytes: 0,
  bootRequests: 0,
  bootByClass: Object.create(null),
  bootReqByClass: Object.create(null),
  peakBytesPerSec: 0,
  peakAt: 0
};

function classify(pathname) {
  const p = String(pathname || '').toLowerCase();
  if (p.startsWith('/api/tv/relay')) return 'relay';
  if (p === '/xmltv.php' || p.startsWith('/api/tv/epg')) return 'epg';
  if (p === '/tv.m3u' || p === '/tv.m3u8' || p === '/get.php' || p === '/player_api.php'
      || p.startsWith('/playlist') || p.startsWith('/live/')) return 'playlist';
  if (p.startsWith('/api/')) return 'api';
  if (p === '/' || p.startsWith('/tv') || p === '/configure' || p === '/traffic'
      || p.startsWith('/logo') || p.startsWith('/icon') || p.startsWith('/favicon')
      || p.startsWith('/channels/')) return 'static';
  return 'other';
}

function bump(map, key, bytes, cls) {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = emptyBucket();
    map.set(key, bucket);
  }
  bucket.bytes += bytes;
  bucket.requests += 1;
  bucket.classes[cls] = (bucket.classes[cls] || 0) + bytes;
  bucket.reqClasses[cls] = (bucket.reqClasses[cls] || 0) + 1;
}

function prune(map, oldestKey) {
  for (const key of map.keys()) {
    if (key >= oldestKey) break;
    map.delete(key);
  }
}

function rollDay() {
  const today = dayKey();
  if (today === state.todayKey) return;
  state.todayKey = today;
  state.todayBytes = 0;
  state.todayRequests = 0;
  state.todayByClass = Object.create(null);
  state.todayReqByClass = Object.create(null);
}

function record(pathname, bytes, cls) {
  const now = Date.now();
  rollDay();

  const sec = Math.floor(now / 1000);
  const min = Math.floor(now / 60000);
  const hour = Math.floor(now / 3600000);

  bump(state.perSecond, sec, bytes, cls);
  bump(state.perMinute, min, bytes, cls);
  bump(state.perHour, hour, bytes, cls);

  prune(state.perSecond, sec - MAX_SECONDS);
  prune(state.perMinute, min - MAX_MINUTES);
  prune(state.perHour, hour - MAX_HOURS);

  state.todayBytes += bytes;
  state.todayRequests += 1;
  state.todayByClass[cls] = (state.todayByClass[cls] || 0) + bytes;
  state.todayReqByClass[cls] = (state.todayReqByClass[cls] || 0) + 1;

  state.bootBytes += bytes;
  state.bootRequests += 1;
  state.bootByClass[cls] = (state.bootByClass[cls] || 0) + bytes;
  state.bootReqByClass[cls] = (state.bootReqByClass[cls] || 0) + 1;

  const currentSecond = state.perSecond.get(sec);
  if (currentSecond && currentSecond.bytes > state.peakBytesPerSec) {
    state.peakBytesPerSec = currentSecond.bytes;
    state.peakAt = now;
  }
}

/**
 * Express middleware: counts the bytes actually written by the response,
 * including streamed relay segments, then files them under the right class.
 */
function trafficMiddleware(req, res, next) {
  let bytes = 0;
  let finished = false;

  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function write(chunk, encoding, callback) {
    if (chunk) {
      bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : undefined);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  res.end = function end(chunk, encoding, callback) {
    if (chunk) {
      bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : undefined);
    }
    return originalEnd.call(this, chunk, encoding, callback);
  };

  const finalize = () => {
    if (finished) return;
    finished = true;
    try { record(req.path, bytes, classify(req.path)); } catch (e) {}
  };

  res.once('finish', finalize);
  res.once('close', () => {
    if (!res.writableEnded) finalize();
  });

  next();
}

function bucketList(map, fromKey, toKey, step, secondsPerBucket) {
  const out = [];
  for (let key = fromKey; key <= toKey; key += step) {
    const bucket = map.get(key);
    out.push({
      t: key * step * 1000,
      bytes: bucket ? bucket.bytes : 0,
      requests: bucket ? bucket.requests : 0,
      classes: bucket ? { ...bucket.classes } : {},
      bps: bucket ? Math.round(bucket.bytes / secondsPerBucket) : 0
    });
  }
  return out;
}

function sumRecent(seconds) {
  const now = Math.floor(Date.now() / 1000);
  let bytes = 0;
  let requests = 0;
  for (let i = 0; i < seconds; i += 1) {
    const bucket = state.perSecond.get(now - i);
    if (!bucket) continue;
    bytes += bucket.bytes;
    requests += bucket.requests;
  }
  return { bytesPerSec: Math.round(bytes / seconds), reqPerSec: Math.round((requests / seconds) * 10) / 10 };
}

function prettyClassMap(bytesMap, reqMap) {
  const total = Object.values(bytesMap).reduce((sum, value) => sum + value, 0) || 1;
  return Object.entries(bytesMap)
    .sort((a, b) => b[1] - a[1])
    .map(([id, bytes]) => ({
      id,
      label: CLASS_LABELS[id] || id,
      bytes,
      requests: reqMap[id] || 0,
      share: Math.round((bytes / total) * 1000) / 10
    }));
}

function getTrafficSnapshot() {
  const now = Date.now();
  const sec = Math.floor(now / 1000);
  const min = Math.floor(now / 60000);
  const hour = Math.floor(now / 3600000);

  return {
    generatedAt: now,
    uptimeSec: Math.round((now - state.bootAt) / 1000),
    live: sumRecent(5),
    perSecond: bucketList(state.perSecond, sec - 119, sec, 1, 1),
    perMinute: bucketList(state.perMinute, min - 59, min, 1, 60),
    perHour: bucketList(state.perHour, hour - 23, hour, 1, 3600),
    totals: {
      todayBytes: state.todayBytes,
      todayRequests: state.todayRequests,
      bootBytes: state.bootBytes,
      bootRequests: state.bootRequests,
      peakBytesPerSec: state.peakBytesPerSec,
      peakAt: state.peakAt,
      dayKey: state.todayKey
    },
    byClass: prettyClassMap(state.todayByClass, state.todayReqByClass),
    byClassBoot: prettyClassMap(state.bootByClass, state.bootReqByClass),
    labels: CLASS_LABELS
  };
}

module.exports = { trafficMiddleware, getTrafficSnapshot, CLASS_LABELS };
