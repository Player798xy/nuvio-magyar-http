const fs = require('fs');

// 1. Patch src/catalog.js
let cat = fs.readFileSync('src/catalog.js', 'utf8');

if (!cat.includes('CATALOG_SEARCH_CACHE')) {
  cat = cat.replace(
    'async function searchCatalog(type, query, catalogId = null, extra = {}) {',
    `const CATALOG_SEARCH_CACHE = new Map();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

async function searchCatalog(type, query, catalogId = null, extra = {}) {
  const skipNum = typeof extra === 'number' ? extra : (extra?.skip || 0);
  const cacheKey = \`\${type || 'all'}:\${catalogId || 'all'}:\${(query || '').trim().toLowerCase()}:\${skipNum}\`;
  if (query) {
    const cached = CATALOG_SEARCH_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS)) {
      return cached.data;
    }
  }`
  );

  // Wrap final executeMultiSourceSearch return with cache store
  cat = cat.replace(
    'return await executeMultiSourceSearch(type, query);',
    `const searchOut = await executeMultiSourceSearch(type, query);
  if (query) CATALOG_SEARCH_CACHE.set(cacheKey, { data: searchOut, timestamp: Date.now() });
  return searchOut;`
  );

  fs.writeFileSync('src/catalog.js', cat, 'utf8');
  console.log('Patched src/catalog.js with fast in-memory search caching!');
}

// 2. Silence query logging in hdmozi.js and netmozi.js for privacy
let hd = fs.readFileSync('src/scrapers/hdmozi.js', 'utf8');
hd = hd.replace(/console\.log\(`\[HDMozi\] Extracted \${streams\.length} stream\(s\) for "\${title}"`\);/g, '// query log removed for privacy');
fs.writeFileSync('src/scrapers/hdmozi.js', hd, 'utf8');

let net = fs.readFileSync('src/scrapers/netmozi.js', 'utf8');
net = net.replace(/console\.log\(`\[NetMozi\] Found \${streams\.length} stream\(s\) for "\${cleanTitle}"`\);/g, '// query log removed for privacy');
net = net.replace(/console\.log\(`\[NetMozi\] Best match: "\${best\.title}".*`\);/g, '// query log removed for privacy');
net = net.replace(/console\.log\(`\[NetMozi TLS Debug\].*`\);/g, '// debug log removed');
fs.writeFileSync('src/scrapers/netmozi.js', net, 'utf8');

console.log('Silenced search query console logs for user privacy!');
