/**
 * Hand-editable local channels ("saját adások").
 *
 * Two simple file formats are read at boot and hot-reloaded when they change:
 *
 *   data/channels.local.json   — explicit channels with multiple mirrors
 *   data/channels.local.m3u    — any standard M3U; duplicate names merge as mirrors
 *
 * Local channels are merged on top of the built-in / Git-synced catalog.
 * They are never stored in Git: the file lives in the repo (so a deploy picks
 * it up) and the runtime overlays it in memory.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_FILES = [
  path.join(DATA_DIR, 'channels.local.json'),
  path.join(DATA_DIR, 'channels.local.m3u')
];

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_LOCAL_CHANNELS = 300;
const MAX_STREAMS_PER_CHANNEL = 12;

const state = {
  loadedAt: 0,
  signature: '',
  channels: [],
  categories: [],
  files: [],
  errors: []
};

function slugify(value, fallback = 'sajat') {
  const clean = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return clean || fallback;
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch (e) { return ''; }
}

function filesToScan() {
  const override = String(process.env.LOCAL_CHANNELS_FILE || '').trim();
  if (override) {
    return override.split(',').map(file => file.trim()).filter(Boolean).map(file => path.resolve(file));
  }
  return DEFAULT_FILES;
}

function readFile(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
    return { file, mtimeMs: stat.mtimeMs, size: stat.size, text: fs.readFileSync(file, 'utf8') };
  } catch (e) {
    return null;
  }
}

function signatureOf(files) {
  return files.map(entry => `${entry.file}:${entry.mtimeMs}:${entry.size}`).join('|');
}

function validStreams(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const urls = [];
  const seen = new Set();

  for (const item of list) {
    const url = String(typeof item === 'string' ? item : item && item.url || '').trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_STREAMS_PER_CHANNEL) break;
  }
  return urls;
}

function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = slugify(raw.id || raw.name, 'sajat');
  const name = String(raw.name || raw.id || 'Saját').trim();
  return {
    id,
    name,
    description: String(raw.description || 'Helyi hozzáadott csatornák'),
    type: 'movie',
    category: 'tv',
    defaultEnabled: true,
    count: 0
  };
}

function normalizeChannel(raw, sourceFile) {
  if (!raw || typeof raw !== 'object') return null;

  const name = String(raw.name || raw.title || '').trim();
  if (!name) return null;

  const streams = validStreams(raw.streams || raw.url || raw.urls);
  if (!streams.length) return null;

  const channelId = slugify(raw.channelId || raw.id || name, 'sajat');
  const categoryRaw = raw.category || raw.group || 'sajat';
  const category = slugify(categoryRaw, 'sajat');

  return {
    channelId,
    id: /^[A-Za-z0-9._:-]{1,80}$/.test(String(raw.id || '')) ? String(raw.id) : `local-${channelId}`,
    name,
    category,
    categoryName: String(raw.categoryName || raw.category_name || categoryRaw || 'Saját').trim(),
    logo: String(raw.logo || raw.tvgLogo || '').trim(),
    description: String(raw.description || '').trim(),
    releaseInfo: String(raw.releaseInfo || raw.release_info || 'ÉLŐ').trim() || 'ÉLŐ',
    streams,
    sourceFile
  };
}

function parseJsonFile(text, file) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    state.errors.push(`${path.basename(file)}: érvénytelen JSON (${error.message})`);
    return { channels: [], categories: [] };
  }

  const categories = Array.isArray(data.categories) ? data.categories.map(normalizeCategory).filter(Boolean) : [];
  const rows = Array.isArray(data.channels) ? data.channels : [];
  const channels = rows.map(row => normalizeChannel(row, file)).filter(Boolean);

  return { channels, categories };
}

function parseM3uFile(text, file) {
  const lines = String(text || '').split(/\r?\n/);
  const entries = [];
  let pending = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#EXTINF')) {
      const attrs = {};
      trimmed.replace(/([A-Za-z0-9-]+)="([^"]*)"/g, (_match, key, value) => {
        attrs[key.toLowerCase()] = value;
        return '';
      });
      const name = trimmed.split(',').pop().trim();
      pending = {
        name,
        tvgId: attrs['tvg-id'] || '',
        group: attrs['group-title'] || attrs['tvg-group'] || 'Saját',
        logo: attrs['tvg-logo'] || ''
      };
      continue;
    }

    if (trimmed.startsWith('#')) continue;
    if (!pending || !/^https?:\/\//i.test(trimmed)) continue;

    entries.push({ ...pending, url: trimmed });
    pending = null;
  }

  const merged = new Map();
  for (const entry of entries) {
    const key = slugify(entry.tvgId || entry.name, 'sajat');
    if (!merged.has(key)) {
      merged.set(key, {
        channelId: key,
        id: `local-${key}`,
        name: entry.name || key,
        category: slugify(entry.group, 'sajat'),
        categoryName: entry.group || 'Saját',
        logo: entry.logo || '',
        description: '',
        releaseInfo: 'ÉLŐ',
        streams: []
      });
    }
    const target = merged.get(key);
    if (!target.streams.includes(entry.url) && target.streams.length < MAX_STREAMS_PER_CHANNEL) {
      target.streams.push(entry.url);
    }
  }

  return {
    channels: [...merged.values()].filter(channel => channel.streams.length).map(channel => ({ ...channel, sourceFile: file })),
    categories: []
  };
}

/**
 * (Re)reads the local files when their signature changed. Cheap: one stat per
 * file. Returns true when the in-memory local list was rebuilt.
 */
function ensureLoaded({ force = false } = {}) {
  const scans = filesToScan().map(readFile).filter(Boolean);
  const signature = signatureOf(scans);
  if (!force && signature === state.signature) return false;

  const channels = [];
  const categories = [];
  const seen = new Set();
  const errors = [];

  for (const scan of scans) {
    const isM3u = /\.m3u8?$/i.test(scan.file);
    const parsed = isM3u ? parseM3uFile(scan.text, scan.file) : parseJsonFile(scan.text, scan.file);
    for (const category of parsed.categories) {
      if (!categories.some(item => item.id === category.id)) categories.push(category);
    }
    for (const channel of parsed.channels) {
      if (seen.has(channel.channelId)) {
        errors.push(`${path.basename(scan.file)}: duplikált csatorna azonosító (${channel.channelId}) kihagyva`);
        continue;
      }
      if (channels.length >= MAX_LOCAL_CHANNELS) {
        errors.push(`túl sok helyi csatorna (max ${MAX_LOCAL_CHANNELS})`);
        break;
      }
      seen.add(channel.channelId);
      channels.push(channel);
    }
  }

  state.loadedAt = Date.now();
  state.signature = signature;
  state.channels = channels;
  state.categories = categories;
  state.files = scans.map(scan => path.basename(scan.file));
  state.errors = errors;

  if (channels.length) {
    console.log(`[local-channels] ${channels.length} helyi csatorna betöltve (${state.files.join(', ')})`);
  }
  return true;
}

function normalizeName(value) {
  return String(value || '')
    .replace(/^\p{Extended_Pictographic}+\s*/u, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Merges local channels on top of a base catalog (built-in or Git snapshot).
 * Same channelId replaces the base channel; new ids are appended.
 */
function mergeWithLocals(baseChannels, baseCategories, local) {
  const categories = (baseCategories || []).map(category => ({ ...category }));
  const byId = new Map(categories.map(category => [category.id, category]));
  const byName = new Map(categories.map(category => [normalizeName(category.name), category]));

  function resolveCategory(channel) {
    const wantedId = slugify(channel.category || 'sajat', 'sajat');
    if (byId.has(wantedId)) return wantedId;

    const wantedName = channel.categoryName || channel.category || 'Saját';
    const nameMatch = byName.get(normalizeName(wantedName));
    if (nameMatch) return nameMatch.id;

    const created = {
      id: wantedId,
      name: String(wantedName),
      description: 'Helyi hozzáadott csatornák',
      type: 'movie',
      category: 'tv',
      defaultEnabled: true,
      count: 0
    };
    categories.push(created);
    byId.set(created.id, created);
    byName.set(normalizeName(created.name), created);
    return created.id;
  }

  const channels = (baseChannels || []).map(channel => ({ ...channel, streams: (channel.streams || []).map(stream => ({ ...stream })) }));
  const index = new Map(channels.map((channel, position) => [channel.channelId, position]));

  for (const localChannel of local.channels || []) {
    const category = resolveCategory(localChannel);
    const entry = {
      id: localChannel.id,
      channelId: localChannel.channelId,
      name: localChannel.name,
      category,
      type: 'movie',
      year: localChannel.releaseInfo || 'ÉLŐ',
      releaseInfo: localChannel.releaseInfo || 'ÉLŐ',
      description: localChannel.description || '',
      mtvaKey: null,
      logoUrl: localChannel.logo || '',
      streams: localChannel.streams.map((url, position) => ({
        sub_idx: position + 1,
        url,
        host: hostOf(url),
        features: 'ÉLŐ',
        playerUrl: '',
        onlineUrl: url
      })),
      behaviorHints: { defaultVideoId: localChannel.id, isLive: true }
    };

    if (index.has(localChannel.channelId)) {
      channels[index.get(localChannel.channelId)] = entry;
    } else {
      index.set(localChannel.channelId, channels.length);
      channels.push(entry);
    }
  }

  return { channels, categories };
}

function getLocalChannels() {
  return { channels: state.channels, categories: state.categories };
}

function getLocalSignature() {
  return state.signature;
}

function getLocalSummary() {
  return {
    count: state.channels.length,
    categories: state.categories.map(category => category.id),
    files: state.files,
    errors: state.errors,
    loadedAt: state.loadedAt,
    channels: state.channels.map(channel => ({
      channelId: channel.channelId,
      name: channel.name,
      category: channel.category,
      streams: channel.streams.length
    }))
  };
}

module.exports = {
  ensureLoaded,
  mergeWithLocals,
  getLocalChannels,
  getLocalSummary,
  getLocalSignature,
  DEFAULT_FILES
};
