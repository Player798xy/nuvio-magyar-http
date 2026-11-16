const crypto = require('node:crypto');

const STATS_SALT = process.env.STATS_SALT || 'nuvio-magyar-stats-v1';
const UPSTASH_URL = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
const UPSTASH_TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

const BOT_UA_RE = /(cron-job|uptimerobot|better[\s-]?stack|statuscake|hetrixtools|googlebot|bingbot|yandexbot|ahrefsbot|semrushbot|petalbot|bytespider|mj12bot|render\/|pingdom|newrelicpinger)/i;
const MAX_DAILY_HASHES = 20000;
const MAX_TOP_ITEMS = 250;
const FLUSH_INTERVAL_MS = 15000;

const startedAtIso = new Date().toISOString();

// In-memory state (always available even without external Redis)
const mem = {
  dayKey: '',
  monthKey: '',
  addonHashesToday: new Set(),
  webHashesToday: new Set(),
  addonHashesSinceBoot: new Set(),
  recentAddonUsers: new Map(), // hash -> lastSeenMs (pruned for 15m & 1h windows)
  recentWebUsers: new Map(),
  todayCounts: Object.create(null),
  totalCounts: Object.create(null),
  clientsToday: Object.create(null),
  topItemsToday: new Map() // label -> count
};

// Pending Upstash batch buffer
const pending = {
  addonHashesByDay: new Map(), // dayKey -> Set<hash>
  webHashesByDay: new Map(),
  addonHashesByMonth: new Map(), // monthKey -> Set<hash>
  dailyCounts: new Map(), // dayKey -> Map<field, delta>
  totalCounts: new Map(), // field -> delta
  topItemsByDay: new Map(), // dayKey -> Map<label, delta>
  eventCount: 0,
  flushing: false
};

function getBudapestDayKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function getRecentDayKeys(days = 7) {
  const keys = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    keys.push(getBudapestDayKey(new Date(now - i * 86400000)));
  }
  return keys;
}

function ensureCurrentDayWindow() {
  const today = getBudapestDayKey();
  const month = today.slice(0, 7);
  if (mem.dayKey && mem.dayKey !== today) {
    mem.addonHashesToday.clear();
    mem.webHashesToday.clear();
    mem.todayCounts = Object.create(null);
    mem.clientsToday = Object.create(null);
    mem.topItemsToday.clear();
  }
  mem.dayKey = today;
  mem.monthKey = month;
}

function hashVisitor(clientIp, ua) {
  const ipPart = clientIp || 'local';
  const base = clientIp ? ipPart : `${ipPart}:${String(ua || '').slice(0, 80)}`;
  return crypto.createHash('sha256').update(`${STATS_SALT}:${base}`).digest('hex').slice(0, 16);
}

function detectClientPlatform(ua = '') {
  const s = String(ua).toLowerCase();
  if (s.includes('nuvio')) return 'Nuvio';
  if (s.includes('stremio') || s.includes('dart/') || s.includes('okhttp')) return 'Stremio / App';
  if (s.includes('mozilla') || s.includes('chrome') || s.includes('safari') || s.includes('firefox')) return 'Böngésző';
  return 'Egyéb kliens';
}

function classifyRequestBucket(pathname = '') {
  const p = String(pathname || '');
  if (p === '/manifest.json' || /^\/[^/]+\/manifest\.json$/.test(p)) return { kind: 'addon', metric: 'manifest' };
  if (p.startsWith('/catalog/') || /^\/[^/]+\/catalog\//.test(p)) return { kind: 'addon', metric: 'catalog' };
  if (p.startsWith('/meta/') || /^\/[^/]+\/meta\//.test(p)) return { kind: 'addon', metric: 'meta' };
  if (p.startsWith('/subtitles/') || /^\/[^/]+\/subtitles\//.test(p)) return { kind: 'addon', metric: 'subtitles' };
  if (p.startsWith('/stream/') || /^\/[^/]+\/stream\//.test(p)) return { kind: 'addon', metric: 'stream' };
  if (p === '/api/test') return { kind: 'web', metric: 'tester' };
  if (p === '/' || p === '/configure' || /^\/[^/]+\/configure$/.test(p) || p === '/uj-link' || p === '/uj-link.html') {
    return { kind: 'web', metric: 'web' };
  }
  return null;
}

function bumpMap(map, key, delta = 1) {
  map.set(key, (map.get(key) || 0) + delta);
}

function addNestedSet(outerMap, outerKey, val) {
  let set = outerMap.get(outerKey);
  if (!set) {
    set = new Set();
    outerMap.set(outerKey, set);
  }
  if (set.size < 2000) set.add(val);
}

function addNestedDelta(outerMap, outerKey, innerKey, delta = 1) {
  let inner = outerMap.get(outerKey);
  if (!inner) {
    inner = new Map();
    outerMap.set(outerKey, inner);
  }
  inner.set(innerKey, (inner.get(innerKey) || 0) + delta);
}

function pruneRecentMap(map, now, maxAgeMs = 3600000) {
  for (const [k, ts] of map.entries()) {
    if (now - ts > maxAgeMs) map.delete(k);
  }
  if (map.size > MAX_DAILY_HASHES) {
    let removeCount = map.size - MAX_DAILY_HASHES;
    for (const k of map.keys()) {
      map.delete(k);
      if (--removeCount <= 0) break;
    }
  }
}

function hasUpstashConfigured() {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

async function upstashPipeline(commands) {
  if (!hasUpstashConfigured() || !Array.isArray(commands) || commands.length === 0) return null;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(3500)
  });
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}`);
  }
  return res.json();
}

async function flushPendingToUpstash() {
  if (!hasUpstashConfigured() || pending.flushing || pending.eventCount === 0) return;
  pending.flushing = true;

  // Snapshot and clear current buffers before async I/O
  const snapAddonDay = new Map(pending.addonHashesByDay);
  const snapWebDay = new Map(pending.webHashesByDay);
  const snapAddonMonth = new Map(pending.addonHashesByMonth);
  const snapDailyCounts = new Map(pending.dailyCounts);
  const snapTotalCounts = new Map(pending.totalCounts);
  const snapTopByDay = new Map(pending.topItemsByDay);

  pending.addonHashesByDay.clear();
  pending.webHashesByDay.clear();
  pending.addonHashesByMonth.clear();
  pending.dailyCounts.clear();
  pending.totalCounts.clear();
  pending.topItemsByDay.clear();
  pending.eventCount = 0;

  try {
    const cmds = [];
    for (const [day, set] of snapAddonDay.entries()) {
      if (set.size > 0) {
        const key = `nm:u:addon:d:${day}`;
        cmds.push(['PFADD', key, ...set]);
        cmds.push(['EXPIRE', key, 90 * 86400]);
      }
    }
    for (const [day, set] of snapWebDay.entries()) {
      if (set.size > 0) {
        const key = `nm:u:web:d:${day}`;
        cmds.push(['PFADD', key, ...set]);
        cmds.push(['EXPIRE', key, 90 * 86400]);
      }
    }
    for (const [month, set] of snapAddonMonth.entries()) {
      if (set.size > 0) {
        const key = `nm:u:addon:m:${month}`;
        cmds.push(['PFADD', key, ...set]);
        cmds.push(['EXPIRE', key, 400 * 86400]);
      }
    }
    for (const [day, fields] of snapDailyCounts.entries()) {
      const key = `nm:cnt:d:${day}`;
      for (const [field, delta] of fields.entries()) {
        cmds.push(['HINCRBY', key, field, delta]);
      }
      cmds.push(['EXPIRE', key, 90 * 86400]);
    }
    for (const [field, delta] of snapTotalCounts.entries()) {
      cmds.push(['HINCRBY', 'nm:cnt:total', field, delta]);
    }
    for (const [day, items] of snapTopByDay.entries()) {
      const key = `nm:top:d:${day}`;
      for (const [label, delta] of items.entries()) {
        cmds.push(['ZINCRBY', key, delta, label]);
      }
      cmds.push(['EXPIRE', key, 35 * 86400]);
    }

    if (cmds.length > 0) {
      await upstashPipeline(cmds);
    }
  } catch (err) {
    console.warn('[Stats] Upstash flush warning:', err.message);
  } finally {
    pending.flushing = false;
  }
}

const flushTimer = setInterval(() => {
  flushPendingToUpstash().catch(() => {});
}, FLUSH_INTERVAL_MS);
flushTimer.unref();

/**
 * Records a completed HTTP request for privacy-preserving active user & top content statistics.
 */
function recordRequestMetric({ req, res, clientIp }) {
  try {
    if (!req || (req.method !== 'GET' && req.method !== 'POST')) return;
    const ua = String(req.headers['user-agent'] || '');
    if (BOT_UA_RE.test(ua)) return;

    const bucket = classifyRequestBucket(req.path);
    if (!bucket) return;

    ensureCurrentDayWindow();
    const now = Date.now();
    const visitorHash = hashVisitor(clientIp, ua);
    const statStreamType = res?.locals?.statStreamType || bucket.metric;
    const finalMetric = bucket.metric === 'stream' ? statStreamType : bucket.metric;

    mem.todayCounts[finalMetric] = (mem.todayCounts[finalMetric] || 0) + 1;
    mem.totalCounts[finalMetric] = (mem.totalCounts[finalMetric] || 0) + 1;

    if (bucket.kind === 'addon') {
      if (mem.addonHashesToday.size < MAX_DAILY_HASHES) mem.addonHashesToday.add(visitorHash);
      if (mem.addonHashesSinceBoot.size < MAX_DAILY_HASHES * 2) mem.addonHashesSinceBoot.add(visitorHash);
      mem.recentAddonUsers.set(visitorHash, now);
      if (mem.recentAddonUsers.size > MAX_DAILY_HASHES || (mem.totalCounts[finalMetric] % 50 === 0)) {
        pruneRecentMap(mem.recentAddonUsers, now, 3600000);
      }

      const clientLabel = detectClientPlatform(ua);
      mem.clientsToday[clientLabel] = (mem.clientsToday[clientLabel] || 0) + 1;
    } else {
      if (mem.webHashesToday.size < MAX_DAILY_HASHES) mem.webHashesToday.add(visitorHash);
      mem.recentWebUsers.set(visitorHash, now);
      if (mem.recentWebUsers.size > MAX_DAILY_HASHES) {
        pruneRecentMap(mem.recentWebUsers, now, 3600000);
      }
    }

    const statLabel = String(res?.locals?.statLabel || '').trim().slice(0, 90);
    if (statLabel) {
      if (mem.topItemsToday.size >= MAX_TOP_ITEMS && !mem.topItemsToday.has(statLabel)) {
        const oldest = mem.topItemsToday.keys().next().value;
        if (oldest !== undefined) mem.topItemsToday.delete(oldest);
      }
      bumpMap(mem.topItemsToday, statLabel, 1);
    }

    if (hasUpstashConfigured()) {
      if (bucket.kind === 'addon') {
        addNestedSet(pending.addonHashesByDay, mem.dayKey, visitorHash);
        addNestedSet(pending.addonHashesByMonth, mem.monthKey, visitorHash);
      } else {
        addNestedSet(pending.webHashesByDay, mem.dayKey, visitorHash);
      }
      addNestedDelta(pending.dailyCounts, mem.dayKey, finalMetric, 1);
      bumpMap(pending.totalCounts, finalMetric, 1);
      if (statLabel) {
        addNestedDelta(pending.topItemsByDay, mem.dayKey, statLabel, 1);
      }
      pending.eventCount++;
      if (pending.eventCount >= 35 || process.env.VERCEL) {
        flushPendingToUpstash().catch(() => {});
      }
    }
  } catch (_) {}
}

function isAuthorizedStatsRequest(req) {
  const configuredKey = String(process.env.STATS_KEY || '').trim();
  if (!configuredKey) return true;

  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const provided = String(req.query?.key || req.headers['x-stats-key'] || bearer || '').trim();
  if (!provided) return false;

  const a = Buffer.from(configuredKey, 'utf-8');
  const b = Buffer.from(provided, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseHgetallPairs(arr) {
  const out = {};
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < arr.length; i += 2) {
    out[arr[i]] = Number(arr[i + 1]) || 0;
  }
  return out;
}

function parseZrevrangeWithScores(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < arr.length; i += 2) {
    out.push({ label: String(arr[i]), count: Number(arr[i + 1]) || 0 });
  }
  return out;
}

async function getStatsSnapshot() {
  ensureCurrentDayWindow();
  const now = Date.now();
  pruneRecentMap(mem.recentAddonUsers, now, 3600000);
  pruneRecentMap(mem.recentWebUsers, now, 3600000);

  let activeAddon15m = 0;
  for (const ts of mem.recentAddonUsers.values()) {
    if (now - ts <= 15 * 60 * 1000) activeAddon15m++;
  }

  const memTopItems = [...mem.topItemsToday.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const dayKeys7 = getRecentDayKeys(7);
  const snapshot = {
    storage: hasUpstashConfigured() ? 'memory+upstash' : 'memory',
    passwordProtected: Boolean(String(process.env.STATS_KEY || '').trim()),
    startedAt: startedAtIso,
    uptimeSeconds: Math.floor(process.uptime()),
    today: mem.dayKey,
    month: mem.monthKey,
    realtime: {
      activeAddon15m,
      activeAddon1h: mem.recentAddonUsers.size,
      activeWeb1h: mem.recentWebUsers.size
    },
    users: {
      todayAddon: mem.addonHashesToday.size,
      todayWeb: mem.webHashesToday.size,
      sinceBootAddon: mem.addonHashesSinceBoot.size,
      monthAddon: mem.addonHashesSinceBoot.size,
      last7Days: dayKeys7.map(d => ({
        date: d,
        addonUsers: d === mem.dayKey ? mem.addonHashesToday.size : null,
        webUsers: d === mem.dayKey ? mem.webHashesToday.size : null
      }))
    },
    requestsToday: { ...mem.todayCounts },
    requestsTotal: { ...mem.totalCounts },
    clientsToday: { ...mem.clientsToday },
    topItemsToday: memTopItems
  };

  if (hasUpstashConfigured()) {
    try {
      await flushPendingToUpstash();
      const cmds = [];
      for (const d of dayKeys7) cmds.push(['PFCOUNT', `nm:u:addon:d:${d}`]);
      for (const d of dayKeys7) cmds.push(['PFCOUNT', `nm:u:web:d:${d}`]);
      cmds.push(['PFCOUNT', `nm:u:addon:m:${mem.monthKey}`]);
      cmds.push(['HGETALL', `nm:cnt:d:${mem.dayKey}`]);
      cmds.push(['HGETALL', 'nm:cnt:total']);
      cmds.push(['ZREVRANGE', `nm:top:d:${mem.dayKey}`, 0, 14, 'WITHSCORES']);

      const res = await upstashPipeline(cmds);
      if (Array.isArray(res)) {
        const addonDays = res.slice(0, 7).map(r => Number(r?.result) || 0);
        const webDays = res.slice(7, 14).map(r => Number(r?.result) || 0);
        const monthAddon = Number(res[14]?.result) || 0;
        const todayCnt = parseHgetallPairs(res[15]?.result);
        const totalCnt = parseHgetallPairs(res[16]?.result);
        const topZ = parseZrevrangeWithScores(res[17]?.result);

        snapshot.users.todayAddon = Math.max(addonDays[0] || 0, mem.addonHashesToday.size);
        snapshot.users.todayWeb = Math.max(webDays[0] || 0, mem.webHashesToday.size);
        snapshot.users.monthAddon = Math.max(monthAddon, snapshot.users.todayAddon);
        snapshot.users.last7Days = dayKeys7.map((d, i) => ({
          date: d,
          addonUsers: addonDays[i] || 0,
          webUsers: webDays[i] || 0
        }));
        if (Object.keys(todayCnt).length > 0) snapshot.requestsToday = todayCnt;
        if (Object.keys(totalCnt).length > 0) snapshot.requestsTotal = totalCnt;
        if (topZ.length > 0) snapshot.topItemsToday = topZ;
      }
    } catch (err) {
      snapshot.upstashError = err.message;
    }
  }

  return snapshot;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function formatDuration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}n ${h}ó ${m}p`;
  if (h > 0) return `${h}ó ${m}p`;
  return `${m}p ${s % 60}mp`;
}

function renderStatsHtml(data, queryKey = '') {
  const jsonHref = queryKey
    ? `?key=${encodeURIComponent(queryKey)}&format=json`
    : '?format=json';
  const rt = data.requestsToday || {};
  const tot = data.requestsTotal || {};
  const vodToday = rt.stream_vod || 0;
  const liveToday = rt.stream_live || 0;
  const topRows = (data.topItemsToday || []).length > 0
    ? data.topItemsToday.map((item, idx) => `
        <tr>
          <td class="idx">${idx + 1}.</td>
          <td>${escapeHtml(item.label)}</td>
          <td class="num">${item.count}</td>
        </tr>`).join('')
    : '<tr><td colspan="3" class="muted">Még nincs elég lejátszási adat az indulás óta.</td></tr>';

  const dayRows = (data.users.last7Days || []).map(row => `
      <tr>
        <td class="mono">${escapeHtml(row.date)}</td>
        <td class="num">${row.addonUsers == null ? '—' : row.addonUsers}</td>
        <td class="num">${row.webUsers == null ? '—' : row.webUsers}</td>
      </tr>`).join('');

  const clientEntries = Object.entries(data.clientsToday || {});
  const clientChips = clientEntries.length > 0
    ? clientEntries.map(([name, cnt]) => `<span class="chip">${escapeHtml(name)}: <b>${cnt}</b></span>`).join('')
    : '<span class="muted">Még nincs adat</span>';

  const upstashBanner = data.storage === 'memory'
    ? `<div class="note"><strong>Memória mód aktív:</strong> a számok az indulás óta (${escapeHtml(formatDuration(data.uptimeSeconds))}) gyűlnek. Ha tartós napi/havi történetet akarsz (újraindításon és Vercelen át is), add hozzá Renderen az ingyenes <code>UPSTASH_REDIS_REST_URL</code> és <code>UPSTASH_REDIS_REST_TOKEN</code> változókat.</div>`
    : `<div class="note ok"><strong>Upstash Redis tartós mentés aktív</strong> — a napi és havi adatok újraindításkor sem vesznek el.</div>`;

  const lockBanner = !data.passwordProtected
    ? `<div class="note warn"><strong>Tipp:</strong> Állíts be egy titkos <code>STATS_KEY</code> környezeti változót a Renderen, hogy ez az oldal csak a <code>?key=TE_KULCSOD</code> címmel nyíljon meg!</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Statisztika — Magyar Streaming Pro</title>
  <style>
    :root { --bg:#050505; --panel:#121212; --line:#242424; --ink:#ececec; --dim:#b8b8b8; --accent:#ff9c42; --gold:#ffcc4d; --ok:#38d399; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--ink); font-family:system-ui,-apple-system,sans-serif; padding:24px 16px 48px; line-height:1.45; }
    .wrap { max-width:960px; margin:0 auto; }
    .head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding-bottom:16px; border-bottom:1px solid var(--line); margin-bottom:20px; }
    h1 { font-size:22px; }
    h1 span { color:var(--accent); }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }
    .btn { background:var(--panel); border:1px solid var(--line); color:var(--ink); padding:7px 12px; border-radius:6px; text-decoration:none; font-size:13px; font-weight:600; cursor:pointer; }
    .btn:hover { border-color:var(--accent); }
    .btn-primary { background:var(--accent); color:#140800; border-color:var(--accent); }
    .note { background:#111; border:1px solid var(--line); border-radius:8px; padding:11px 14px; font-size:13px; color:var(--dim); margin-bottom:14px; }
    .note.warn { border-color:rgba(255,204,77,.45); background:rgba(255,204,77,.07); color:#ffdc96; }
    .note.ok { border-color:rgba(56,211,153,.4); background:rgba(56,211,153,.07); }
    code { background:#1c1c1c; padding:1px 5px; border-radius:4px; color:var(--gold); font-size:12px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(195px,1fr)); gap:12px; margin-bottom:20px; }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
    .k { font-size:12px; color:var(--dim); margin-bottom:4px; }
    .v { font-size:28px; font-weight:700; color:var(--accent); line-height:1.1; }
    .sub { font-size:12px; color:var(--dim); margin-top:5px; }
    .cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; margin-bottom:18px; }
    .box { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:15px 16px; }
    h2 { font-size:15px; margin-bottom:12px; color:var(--gold); }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { text-align:left; padding:7px 6px; border-bottom:1px solid #1e1e1e; }
    th { color:var(--dim); font-weight:600; font-size:12px; }
    td.idx { width:34px; color:var(--accent); font-weight:700; }
    td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; font-weight:600; }
    .mono { font-family:ui-monospace,monospace; font-size:12.5px; }
    .muted { color:#777; text-align:center; padding:14px 0; }
    .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
    .chip { background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; padding:5px 10px; font-size:12.5px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>Magyar Streaming <span>Pro</span> — Használati Statisztika</h1>
        <div class="sub">Dátum: ${escapeHtml(data.today)} · Üzemidő: ${escapeHtml(formatDuration(data.uptimeSeconds))} · Mód: ${escapeHtml(data.storage)}</div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" onclick="location.reload()">↻ Frissítés</button>
        <a class="btn" href="${escapeHtml(jsonHref)}">JSON</a>
        <a class="btn" href="/configure">← Konfigurátor</a>
      </div>
    </div>

    ${lockBanner}
    ${upstashBanner}

    <div class="grid">
      <div class="card">
        <div class="k">Most aktív app (15 perc)</div>
        <div class="v">${data.realtime.activeAddon15m}</div>
        <div class="sub">Utolsó 1 óra: ${data.realtime.activeAddon1h} egyedi app</div>
      </div>
      <div class="card">
        <div class="k">Mai egyedi app felhasználó</div>
        <div class="v">${data.users.todayAddon}</div>
        <div class="sub">Havi / futás óta: ${data.users.monthAddon}</div>
      </div>
      <div class="card">
        <div class="k">Mai weblap látogató</div>
        <div class="v">${data.users.todayWeb}</div>
        <div class="sub">Utolsó 1 óra: ${data.realtime.activeWeb1h}</div>
      </div>
      <div class="card">
        <div class="k">Mai stream kérések</div>
        <div class="v">${vodToday + liveToday}</div>
        <div class="sub">VOD: ${vodToday} · Élő TV: ${liveToday}</div>
      </div>
    </div>

    <div class="cols">
      <div class="box">
        <h2>Mai &amp; Összes Addon Forgalom</h2>
        <table>
          <thead><tr><th>Típus</th><th class="num">Ma</th><th class="num">Összesen</th></tr></thead>
          <tbody>
            <tr><td>Film &amp; Sorozat streamek</td><td class="num">${rt.stream_vod || 0}</td><td class="num">${tot.stream_vod || 0}</td></tr>
            <tr><td>Élő TV streamek</td><td class="num">${rt.stream_live || 0}</td><td class="num">${tot.stream_live || 0}</td></tr>
            <tr><td>Manifest lekérés (telepítés/frissítés)</td><td class="num">${rt.manifest || 0}</td><td class="num">${tot.manifest || 0}</td></tr>
            <tr><td>Katalógus böngészés</td><td class="num">${rt.catalog || 0}</td><td class="num">${tot.catalog || 0}</td></tr>
            <tr><td>Magyar feliratok</td><td class="num">${rt.subtitles || 0}</td><td class="num">${tot.subtitles || 0}</td></tr>
            <tr><td>Metaadat / epizódlista</td><td class="num">${rt.meta || 0}</td><td class="num">${tot.meta || 0}</td></tr>
            <tr><td>Webes kereső teszt (/api/test)</td><td class="num">${rt.tester || 0}</td><td class="num">${tot.tester || 0}</td></tr>
          </tbody>
        </table>
        <h2 style="margin-top:16px">App / Kliens típusok (ma)</h2>
        <div class="chips">${clientChips}</div>
      </div>

      <div class="box">
        <h2>Top 15 Népszerű Tartalom (Ma)</h2>
        <table>
          <thead><tr><th>#</th><th>Film / Sorozat / Csatorna</th><th class="num">Kérés</th></tr></thead>
          <tbody>${topRows}</tbody>
        </table>
      </div>
    </div>

    <div class="box">
      <h2>Utolsó 7 nap napi bontás</h2>
      <table>
        <thead><tr><th>Nap</th><th class="num">App felhasználók (egyedi)</th><th class="num">Weblátogatók</th></tr></thead>
        <tbody>${dayRows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  recordRequestMetric,
  isAuthorizedStatsRequest,
  getStatsSnapshot,
  renderStatsHtml,
  hasUpstashConfigured
};
