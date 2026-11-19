/**
 * EPG layer for the /tv viewer and the XMLTV export.
 *
 * Reuses the existing port.hu engine (src/epg.js) and adds:
 *  - per-channel now/next payloads with a short cache
 *  - category-wide "what's on now" lists for the programme guide tab
 *  - a full XMLTV document built in the background (never blocks a request),
 *    cached in memory and refreshed when stale
 */

const { createBoundedCache } = require('./cache');
const { ALL_CHANNELS, ONLINESTREAM_CATEGORIES } = require('./scrapers/onlinestream');
const { getChannelEpg, getChannelSchedule } = require('./epg');
const { buildXmltv: buildChannelOnlyXmltv } = require('./xtream');

const CHANNEL_CACHE_TTL_MS = 10 * 60 * 1000;
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;
const XMLTV_TTL_MS = 6 * 60 * 60 * 1000;
const CHANNEL_CONCURRENCY = 6;
const BUILD_CONCURRENCY = 5;

const channelCache = createBoundedCache({ maxEntries: 400, ttlMs: CHANNEL_CACHE_TTL_MS });
const categoryCache = createBoundedCache({ maxEntries: 16, ttlMs: CATEGORY_CACHE_TTL_MS });

const xmlState = {
  xml: '',
  builtAt: 0,
  building: false,
  error: null,
  channels: 0,
  programmes: 0,
  durationMs: 0
};

function findChannel(channelId) {
  return ALL_CHANNELS.find(channel => channel.id === channelId || channel.channelId === channelId) || null;
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function slimProgram(program) {
  if (!program) return null;
  return {
    title: program.title || '',
    episodeTitle: program.episodeTitle || '',
    shortDesc: program.shortDesc || '',
    startMs: program.startMs,
    endMs: program.endMs,
    startHm: program.startHm || '',
    endHm: program.endHm || ''
  };
}

/**
 * Now/next for a single channel, cached for 10 minutes.
 */
async function getChannelEpgPayload(channelId, { fresh = false } = {}) {
  const channel = findChannel(channelId);
  if (!channel) return null;

  const cacheKey = channel.channelId;
  if (!fresh) {
    const cached = channelCache.get(cacheKey);
    if (cached) return cached;
  }

  // Shared in-flight dedupe through the bounded cache's getOrLoad.
  return channelCache.getOrLoad(cacheKey, async () => {
    let epg = null;
    try {
      epg = await getChannelEpg(channel.name, channel.id);
    } catch (e) {}

    return {
      channelId: channel.channelId,
      name: channel.name,
      category: channel.category,
      current: slimProgram(epg && epg.current),
      upcoming: (epg && epg.upcoming ? epg.upcoming : []).map(slimProgram),
      hasData: Boolean(epg),
      updatedAt: Date.now()
    };
  }, { ttlMs: CHANNEL_CACHE_TTL_MS, shouldCache: () => true });
}

/**
 * "What's on now" for a whole category (or all channels when category is empty).
 */
async function getCategoryEpg(categoryId = '', { fresh = false } = {}) {
  const wanted = String(categoryId || '').trim();
  if (wanted && !ONLINESTREAM_CATEGORIES.some(category => category.id === wanted)) return null;

  const cacheKey = wanted || '*';
  if (!fresh) {
    const cached = categoryCache.get(cacheKey);
    if (cached) return cached;
  }

  return categoryCache.getOrLoad(cacheKey, async () => {
    const channels = ALL_CHANNELS.filter(channel => !wanted || channel.category === wanted);
    const entries = await mapPool(channels, CHANNEL_CONCURRENCY, async (channel) => {
      const payload = await getChannelEpgPayload(channel.channelId).catch(() => null);
      return {
        channelId: channel.channelId,
        name: channel.name,
        category: channel.category,
        logo: `/tv-logo/${channel.channelId}.png`,
        current: payload && payload.current,
        next: payload && payload.upcoming && payload.upcoming[0] ? payload.upcoming[0] : null,
        hasData: Boolean(payload && payload.hasData)
      };
    });

    return {
      category: wanted || null,
      generatedAt: Date.now(),
      total: entries.length,
      withEpg: entries.filter(entry => entry.hasData).length,
      channels: entries
    };
  }, { ttlMs: CATEGORY_CACHE_TTL_MS, shouldCache: () => true });
}


const gridCache = createBoundedCache({ maxEntries: 12, ttlMs: 10 * 60 * 1000 });

/**
 * Timeline grid: full programme windows for every channel in a category.
 * Used by the "Idősáv" EPG view. The window starts one hour before now.
 */
async function getScheduleGrid(categoryId = '', { hours = 12, fresh = false } = {}) {
  const wanted = String(categoryId || '').trim();
  if (wanted && !ONLINESTREAM_CATEGORIES.some(category => category.id === wanted)) return null;

  const spanHours = Math.min(Math.max(Number(hours) || 12, 4), 36);
  const now = Date.now();
  const fromMs = Math.floor(now / 3600000) * 3600000 - 3600000;
  const toMs = fromMs + spanHours * 3600000;

  const bucket = Math.floor(now / (10 * 60 * 1000));
  const cacheKey = `${wanted || '*'}:${spanHours}:${bucket}`;
  if (!fresh) {
    const cached = gridCache.get(cacheKey);
    if (cached) return cached;
  }

  return gridCache.getOrLoad(cacheKey, async () => {
    const channels = ALL_CHANNELS.filter(channel => !wanted || channel.category === wanted);
    const entries = await mapPool(channels, CHANNEL_CONCURRENCY, async (channel) => {
      let schedule = null;
      try {
        schedule = await getChannelSchedule(channel.name, channel.id);
      } catch (e) {}

      const programmes = [];
      if (schedule) {
        for (const program of schedule.programs) {
          if (!program.title || !program.startMs || !program.endMs) continue;
          if (program.endMs <= fromMs || program.startMs >= toMs) continue;
          programmes.push(slimProgram(program));
        }
      }

      return {
        channelId: channel.channelId,
        name: channel.name,
        category: channel.category,
        logo: `/tv-logo/${channel.channelId}.png`,
        programmes
      };
    });

    return {
      category: wanted || null,
      fromMs,
      toMs,
      hours: spanHours,
      generatedAt: Date.now(),
      total: entries.length,
      withData: entries.filter(entry => entry.programmes.length).length,
      channels: entries
    };
  }, { ttlMs: 10 * 60 * 1000, shouldCache: () => true });
}

/* ---------------- XMLTV ---------------- */

function xmltvDate(ms) {
  const date = new Date(ms);
  const parts = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const read = type => (parts.find(part => part.type === type) || {}).value || '00';
  const offsetName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Budapest',
    timeZoneName: 'longOffset'
  }).formatToParts(date).find(part => part.type === 'timeZoneName');
  const match = String(offsetName && offsetName.value || 'GMT+01:00').match(/GMT([+-])(\d{2}):(\d{2})/);
  const tz = match ? `${match[1]}${match[2]}${match[3]}` : '+0100';

  return `${read('year')}${read('month')}${read('day')}${read('hour')}${read('minute')}${read('second')} ${tz}`;
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;'
  }[c]));
}

async function buildXmltv() {
  if (xmlState.building) return xmlState;
  xmlState.building = true;
  const startedAt = Date.now();

  try {
    const channels = ALL_CHANNELS.map(channel => ({ ...channel }));
    const fromMs = startedAt - 12 * 3600 * 1000;
    const toMs = startedAt + 36 * 3600 * 1000;

    const schedules = await mapPool(channels, BUILD_CONCURRENCY, async (channel) => {
      try {
        const schedule = await getChannelSchedule(channel.name, channel.id);
        return { channel, schedule };
      } catch (e) {
        return { channel, schedule: null };
      }
    });

    const channelLines = [];
    const programmeLines = [];
    const channelEntries = [];
    const programmeEntries = [];
    let programmes = 0;

    for (const { channel, schedule } of schedules) {
      const channelLine = `  <channel id="${escapeXml(channel.channelId)}">
    <display-name>${escapeXml(channel.name)}</display-name>
    <icon src="${escapeXml(`https://nuvio-magyar-http.onrender.com/tv-logo/${channel.channelId}.png`)}"/>
  </channel>`;
      channelLines.push(channelLine);
      channelEntries.push({ channelId: channel.channelId, category: channel.category, line: channelLine });

      if (!schedule) continue;
      for (const program of schedule.programs) {
        if (!program.title || !program.startMs || !program.endMs) continue;
        if (program.endMs < fromMs || program.startMs > toMs) continue;

        const subTitle = program.episodeTitle
          ? `    <sub-title lang="hu">${escapeXml(program.episodeTitle)}</sub-title>\n`
          : '';
        const desc = program.shortDesc
          ? `    <desc lang="hu">${escapeXml(program.shortDesc)}</desc>\n`
          : '';

        const programmeLine = `  <programme start="${xmltvDate(program.startMs)}" stop="${xmltvDate(program.endMs)}" channel="${escapeXml(channel.channelId)}">
    <title lang="hu">${escapeXml(program.title)}</title>
${subTitle}${desc}  </programme>`;
        programmeLines.push(programmeLine);
        programmeEntries.push({ channelId: channel.channelId, category: channel.category, line: programmeLine });
        programmes += 1;
      }
    }

    xmlState.xml = `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="Nuvio Magyar TV" source-info-name="port.hu">
${channelLines.join('\n')}
${programmeLines.join('\n')}
</tv>
`;
    // A failed/blocked port.hu run (0 programmes) must not erase the previous guide.
    if (programmes > 0 || !xmlState.programmeEntries || xmlState.programmeEntries.length === 0) {
      xmlState.channelEntries = channelEntries;
      xmlState.programmeEntries = programmeEntries;
    } else {
      console.warn('[epg] útmutató frissítés 0 műsorral érkezett — a korábbi megtartva');
    }
    xmlState.builtAt = Date.now();
    xmlState.error = null;
    xmlState.channels = channels.length;
    xmlState.programmes = programmes;
    xmlState.durationMs = Date.now() - startedAt;

    console.log(`[epg] XMLTV frissítve: ${channels.length} csatorna, ${programmes} műsor (${xmlState.durationMs} ms)`);
  } catch (error) {
    xmlState.error = error.message || 'build failed';
    console.warn(`[epg] XMLTV build hiba: ${xmlState.error}`);
  } finally {
    xmlState.building = false;
  }

  return xmlState;
}

/**
 * Serves the cached XMLTV immediately. When the cache is missing or stale the
 * rebuild runs in the background, so TiviMate never waits on a 162-channel crawl.
 */
function composeXmltv(channelEntries, programmeEntries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="Nuvio Magyar TV" source-info-name="port.hu">
${channelEntries.map(entry => entry.line).join('\n')}
${programmeEntries.map(entry => entry.line).join('\n')}
</tv>
`;
}

function getXmltvDocument(categoryFilter = null) {
  const stale = !xmlState.xml || Date.now() - xmlState.builtAt > XMLTV_TTL_MS;
  if (stale && !xmlState.building) {
    buildXmltv().catch(() => {});
  }

  if (categoryFilter && xmlState.channelEntries && xmlState.channelEntries.length) {
    const channels = xmlState.channelEntries.filter(entry => categoryFilter.has(entry.category));
    const allowed = new Set(channels.map(entry => entry.channelId));
    const programmes = (xmlState.programmeEntries || []).filter(entry => allowed.has(entry.channelId));
    return composeXmltv(channels, programmes);
  }

  return xmlState.xml || buildChannelOnlyXmltv(categoryFilter);
}

function getXmltvStatus() {
  return {
    builtAt: xmlState.builtAt,
    building: xmlState.building,
    error: xmlState.error,
    channels: xmlState.channels,
    programmes: xmlState.programmes,
    durationMs: xmlState.durationMs,
    ttlMs: XMLTV_TTL_MS
  };
}

function invalidateEpgCaches() {
  channelCache.clear();
  categoryCache.clear();
  gridCache.clear();
  xmlState.xml = '';
  xmlState.channelEntries = null;
  xmlState.programmeEntries = null;
  xmlState.builtAt = 0;
}

module.exports = {
  getChannelEpgPayload,
  getCategoryEpg,
  getScheduleGrid,
  getXmltvDocument,
  getXmltvStatus,
  buildXmltv,
  invalidateEpgCaches,
  xmltvDate
};
