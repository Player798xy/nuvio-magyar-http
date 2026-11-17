/**
 * Live Hungarian TV EPG (Electronic Program Guide) via Port.hu JSON API.
 * Fetches channel schedules lazily per channel and caches daily timetables in memory
 * so "Now Playing" / "Up Next" is computed in real-time with minimal network calls.
 */

const INIT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const SCHEDULE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SCHEDULE_CACHE = 200;

let portChannelsCache = { ts: 0, list: [], byNorm: new Map() };
let inflightPortInit = null;
const channelScheduleCache = new Map();
const inflightSchedules = new Map();

const CHANNEL_ALIASES = {
  'duna': ['duna televizio', 'duna tv'],
  'duna world / m4 sport+': ['duna world', 'm4 sport+'],
  'duna world': ['duna world'],
  'm1 hirado': ['m1'],
  'm2 gyerek & petofi tv': ['m2 / petofi tv', 'm2'],
  'm4 sport+': ['m4 sport+', 'duna world'],
  'cool tv': ['cool'],
  'rtl ii': ['rtl ketto'],
  'rtl 2': ['rtl ketto'],
  'rtl kettő': ['rtl ketto'],
  'rtl iii': ['rtl harom'],
  'rtl 3': ['rtl harom'],
  'super tv2': ['supertv2'],
  'sport 1': ['sport1'],
  'sport 2': ['sport2'],
  'spiler 1': ['spiler1 tv'],
  'spiler1': ['spiler1 tv'],
  'spiler 2': ['spiler2 tv'],
  'spiler2': ['spiler2 tv'],
  'match 4': ['match4'],
  'arena 4': ['arena4'],
  'atv spirit': ['atv extra'],
  'nat geo': ['national geographic'],
  'nat geo wild': ['national geographic wild'],
  'discovery': ['discovery channel'],
  'life tv': ['lifetv'],
  'ozone tv': ['ozonetv'],
  'pax tv': ['pax tv'],
  'tv2 sef': ['tv2 sef'],
  'comedy central': ['comedy central'],
  'film cafe': ['filmcafe'],
  'film plusz': ['film+'],
  'mozi plusz': ['mozi+'],
  'kecskemeti tv': ['kecskemeti televizio'],
  'szeged tv': ['szeged televizio'],
  'balaton tv': ['balaton televizio'],
  'fecske tv': ['fecske tv']
};

function normalizeChannelName(name) {
  return String(name || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*Élő$/i, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9+/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactKey(norm) {
  return norm.replace(/\s+/g, '');
}

async function ensurePortChannelsLoaded() {
  if (portChannelsCache.list.length > 0 && Date.now() - portChannelsCache.ts < INIT_CACHE_TTL_MS) {
    return portChannelsCache;
  }
  if (inflightPortInit) return inflightPortInit;

  inflightPortInit = (async () => {
    try {
      const res = await fetch('https://port.hu/tvapi/init', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(3500)
      });
      if (!res.ok) return portChannelsCache;
      const data = await res.json();
      const list = Array.isArray(data?.channels) ? data.channels : [];
      const byNorm = new Map();

      for (const ch of list) {
        if (!ch?.id || !ch?.name) continue;
        const norm = normalizeChannelName(ch.name);
        if (norm && !byNorm.has(norm)) byNorm.set(norm, ch.id);
        const cmp = compactKey(norm);
        if (cmp && !byNorm.has(cmp)) byNorm.set(cmp, ch.id);
      }

      if (list.length > 0) {
        portChannelsCache = { ts: Date.now(), list, byNorm };
      }
    } catch {}
    return portChannelsCache;
  })();

  try {
    return await inflightPortInit;
  } finally {
    inflightPortInit = null;
  }
}

async function resolvePortChannelId(channelName, channelId = '') {
  const { byNorm } = await ensurePortChannelsLoaded();
  if (byNorm.size === 0) return null;

  // Special static overrides for MTVA live IDs
  const lowerId = String(channelId || '').toLowerCase();
  if (lowerId.includes('mediaklikk-live-m1') || lowerId.endsWith('-m1')) return 'tvchannel-1';
  if (lowerId.includes('mediaklikk-live-m2') || lowerId.endsWith('-m2')) return 'tvchannel-2';
  if (lowerId.includes('mediaklikk-live-duna') && !lowerId.includes('world')) return 'tvchannel-6';
  if (lowerId.includes('mediaklikk-live-dunaworld')) return 'tvchannel-103';
  if (lowerId.includes('mediaklikk-live-m5')) return 'tvchannel-301';

  const norm = normalizeChannelName(channelName);
  const candidates = [norm, compactKey(norm)];

  const aliases = CHANNEL_ALIASES[norm] || [];
  for (const a of aliases) {
    candidates.push(a, compactKey(a));
  }

  // Fallback without trailing "tv" / "hd"
  const stripped = norm.replace(/\b(tv|hd|magyarorszag)\b/g, '').replace(/\s+/g, ' ').trim();
  if (stripped && stripped.length >= 2) {
    candidates.push(stripped, compactKey(stripped));
  }

  for (const c of candidates) {
    if (byNorm.has(c)) return byNorm.get(c);
  }
  return null;
}

function getBudapestDateStrings() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = fmt.format(now);
  const tomorrowStr = fmt.format(new Date(now.getTime() + 24 * 3600 * 1000));
  return { todayStr, tomorrowStr };
}

function formatHm(isoStr) {
  if (!isoStr) return '';
  const m = String(isoStr).match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

async function fetchChannelSchedule(portId) {
  const { todayStr, tomorrowStr } = getBudapestDateStrings();
  const cached = channelScheduleCache.get(portId);
  if (cached && cached.dayStr === todayStr && Date.now() - cached.ts < SCHEDULE_CACHE_TTL_MS) {
    return cached.programs;
  }

  const inflightKey = `${portId}:${todayStr}`;
  if (inflightSchedules.has(inflightKey)) {
    return inflightSchedules.get(inflightKey);
  }

  const fetchPromise = (async () => {
    try {
      const url = `https://port.hu/tvapi?channel_id[]=${encodeURIComponent(portId)}&i_datetime_from=${todayStr}&i_datetime_to=${tomorrowStr}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) return cached ? cached.programs : [];
      const data = await res.json();

      const programs = [];
      for (const val of Object.values(data || {})) {
        const chList = Array.isArray(val?.channels) ? val.channels : [];
        for (const chObj of chList) {
          if (chObj.id === portId && Array.isArray(chObj.programs)) {
            programs.push(...chObj.programs);
          }
        }
      }

      const parsed = programs
        .map(p => ({
          title: String(p.title || '').trim(),
          episodeTitle: p.episode_title ? String(p.episode_title).trim() : '',
          shortDesc: p.short_description ? String(p.short_description).trim() : '',
          startMs: Date.parse(p.start_datetime),
          endMs: Date.parse(p.end_datetime),
          startHm: formatHm(p.start_datetime),
          endHm: formatHm(p.end_datetime)
        }))
        .filter(p => p.title && !isNaN(p.startMs) && !isNaN(p.endMs))
        .sort((a, b) => a.startMs - b.startMs);

      if (channelScheduleCache.size >= MAX_SCHEDULE_CACHE) {
        const firstKey = channelScheduleCache.keys().next().value;
        if (firstKey !== undefined) channelScheduleCache.delete(firstKey);
      }
      channelScheduleCache.set(portId, { ts: Date.now(), dayStr: todayStr, programs: parsed });
      return parsed;
    } catch {
      return cached ? cached.programs : [];
    }
  })();

  inflightSchedules.set(inflightKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inflightSchedules.delete(inflightKey);
  }
}

/**
 * Returns the currently airing show (`now`) and upcoming shows (`upcoming`) for a channel.
 */
async function getChannelEpg(channelName, channelId = '') {
  const portId = await resolvePortChannelId(channelName, channelId);
  if (!portId) return null;

  const programs = await fetchChannelSchedule(portId);
  if (!programs || programs.length === 0) return null;

  const nowMs = Date.now();
  let current = null;
  const upcoming = [];

  for (const p of programs) {
    if (p.startMs <= nowMs && p.endMs > nowMs) {
      if (!current) current = p;
    } else if (p.startMs > nowMs && upcoming.length < 3) {
      upcoming.push(p);
    }
  }

  if (!current && upcoming.length === 0) return null;
  return { current, upcoming };
}

function formatProgramLine(p) {
  if (!p) return '';
  const epPart = p.episodeTitle ? ` – ${p.episodeTitle}` : '';
  return `${p.startHm}–${p.endHm} • ${p.title}${epPart}`;
}

function formatEpgStreamBanner(epg) {
  if (!epg) return '';
  const lines = [];
  if (epg.current) {
    lines.push(`📺 Most: ${formatProgramLine(epg.current)}`);
  }
  if (epg.upcoming && epg.upcoming[0]) {
    const next = epg.upcoming[0];
    const epPart = next.episodeTitle ? ` – ${next.episodeTitle}` : '';
    lines.push(`⏭️ Következő: ${next.startHm} • ${next.title}${epPart}`);
  }
  return lines.join('\n');
}

function formatEpgMetaText(epg) {
  if (!epg) return '';
  const parts = [];
  if (epg.current) {
    const info = epg.current.shortDesc ? ` (${epg.current.shortDesc})` : '';
    parts.push(`📺 Most a műsoron: ${formatProgramLine(epg.current)}${info}`);
  }
  if (epg.upcoming && epg.upcoming.length > 0) {
    const nextList = epg.upcoming
      .slice(0, 3)
      .map(u => `${u.startHm} ${u.title}`)
      .join(' | ');
    parts.push(`⏭️ Következő: ${nextList}`);
  }
  return parts.join('\n');
}

module.exports = {
  getChannelEpg,
  formatEpgStreamBanner,
  formatEpgMetaText,
  resolvePortChannelId
};
