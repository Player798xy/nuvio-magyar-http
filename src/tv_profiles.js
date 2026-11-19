/**
 * Stateless "profiles": a comma separated list of live TV category ids that
 * filters the IPTV playlist, XMLTV guide, Xtream API and channel payload.
 *
 * Profiles are encoded in the URL (query `?cats=...` or path prefix
 * `/p/<cats>/...`), so nothing needs to be stored server-side and the same
 * profile works for playlist + EPG on any player.
 */

const { ONLINESTREAM_CATEGORIES } = require('./scrapers/onlinestream');

const ALL_CATEGORY_IDS = new Set(ONLINESTREAM_CATEGORIES.map(category => category.id));

/**
 * Parses a raw `cats` value. Returns null for "everything" (no filter), which
 * is also the safe fallback for empty/invalid input.
 */
function parseCategories(raw) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  if (!value) return null;
  if (/^(all|\*|mind)$/i.test(value)) return null;

  const wanted = new Set(
    value.split(',').map(part => part.trim()).filter(part => ALL_CATEGORY_IDS.has(part))
  );

  return wanted.size ? wanted : null;
}

function channelMatches(channel, categories) {
  return !categories || categories.has(channel.category);
}

function filterChannels(channels, categories) {
  return categories ? channels.filter(channel => categories.has(channel.category)) : channels;
}

function filterCategories(categoriesList, categories) {
  return categories ? categoriesList.filter(category => categories.has(category.id)) : categoriesList;
}

function serializeCategories(raw) {
  const parsed = parseCategories(raw);
  if (!parsed) return '';
  return ONLINESTREAM_CATEGORIES
    .filter(category => parsed.has(category.id))
    .map(category => category.id)
    .join(',');
}

module.exports = {
  parseCategories,
  serializeCategories,
  channelMatches,
  filterChannels,
  filterCategories,
  ALL_CATEGORY_IDS
};
