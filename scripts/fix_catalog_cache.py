with open('src/catalog.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx1 = text.find('const CATALOG_SEARCH_CACHE')
idx2 = text.find('// If dynamic toplist')

header = '''const CATALOG_SEARCH_CACHE = new Map();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

async function searchCatalog(type, query, catalogId = null, extra = {}) {
  const skipNum = typeof extra === 'number' ? extra : (extra?.skip || 0);
  const cacheKey = String(type || 'all') + ':' + String(catalogId || 'all') + ':' + String(query || '').trim().toLowerCase() + ':' + String(skipNum);
  if (query) {
    const cached = CATALOG_SEARCH_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  '''

new_text = text[:idx1] + header + text[idx2:]
with open('src/catalog.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Cleaned catalog.js via fix_catalog_cache.py!')
