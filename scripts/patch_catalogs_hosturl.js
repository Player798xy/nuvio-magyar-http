const fs = require('fs');

// 1. Patch src/catalog.js
let catalogCode = fs.readFileSync('src/catalog.js', 'utf8');

catalogCode = catalogCode.replace(
  "if (catalogId.startsWith('hu-live-') || catalogId === 'hu-live-tv' || catalogId === 'hu-live-tv-channel' || type === 'tv' || type === 'channel') {",
  "if (catalogId && (catalogId.startsWith('hu-live-') || catalogId === 'hu-live-tv' || catalogId === 'hu-live-tv-channel' || type === 'tv' || type === 'channel')) {"
);

catalogCode = catalogCode.replace(
  "const list = getOnlineStreamChannels(catalogId === 'hu-live-tv' ? 'all' : catalogId, query).map(ch => ({",
  "const baseHost = (extra && extra.hostUrl) || process.env.HOST_URL || 'https://nuvio-magyar-http.vercel.app';\n    const list = getOnlineStreamChannels(catalogId === 'hu-live-tv' ? 'all' : catalogId, query, baseHost).map(ch => ({"
);

catalogCode = catalogCode.replace(
  "async function getMeta(type, rawId) {",
  "async function getMeta(type, rawId, hostUrl = null) {"
);

catalogCode = catalogCode.replace(
  "const onlineMeta = getOnlineStreamMeta(id, type);",
  "const onlineMeta = getOnlineStreamMeta(id, hostUrl);"
);

fs.writeFileSync('src/catalog.js', catalogCode, 'utf8');
console.log('src/catalog.js patched');

// 2. Patch src/catalogs.js
let catalogsCode = fs.readFileSync('src/catalogs.js', 'utf8');

catalogsCode = catalogsCode.replace(
  "async function fetchCatalogItems(catalogId, type, { search = '', skip = 0 } = {}) {",
  "async function fetchCatalogItems(catalogId, type, { search = '', skip = 0, hostUrl = null } = {}) {"
);

catalogsCode = catalogsCode.replace(
  "const liveChannels = getOnlineStreamChannels(catalogId === 'hu-live-tv' ? 'all' : catalogId, search);",
  "const liveChannels = getOnlineStreamChannels(catalogId === 'hu-live-tv' ? 'all' : catalogId, search, hostUrl);"
);

fs.writeFileSync('src/catalogs.js', catalogsCode, 'utf8');
console.log('src/catalogs.js patched');
