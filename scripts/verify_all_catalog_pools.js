const fetch = globalThis.fetch;
const fs = require('fs');

async function testPool(name, items) {
  console.log(`\n=================== Testing ${name} (${items.length} items) ===================`);
  for (const item of items) {
    const iid = item.id;
    const name = item.name;
    const type = item.type || 'movie';
    try {
      const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${iid}.json`, { signal: AbortSignal.timeout(4000) });
      const d = await res.json();
      const meta = d.meta || {};
      const realName = meta.name || 'UNKNOWN';
      const realYear = meta.year || 'UNKNOWN';
      const realPoster = meta.poster || '';
      
      const isMatch = realName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(realName.toLowerCase());
      if (isMatch) {
        console.log(`✅ [${iid}] "${name}" matches Cinemeta: "${realName}" (${realYear})`);
      } else {
        console.log(`❌ MISMATCH: [${iid}] Expected "${name}", but Cinemeta says: "${realName}" (${realYear})`);
      }
    } catch (e) {
      console.log(`⚠️ [${iid}] "${name}" -> Error: ${e.message}`);
    }
  }
}

const catContent = fs.readFileSync('src/catalog.js', 'utf8');

function extractArray(str, varName) {
  const m = str.match(new RegExp(`const ${varName} = (\\[[\\s\\S]*?\\]);\\s*\\n`));
  if (m) return eval(m[1]);
  return [];
}

async function run() {
  const classics = extractArray(catContent, 'FEATURED_MEDIAKLIKK_CLASSICS');
  const series = extractArray(catContent, 'FEATURED_HUNGARIAN_SERIES');
  const movies = extractArray(catContent, 'FEATURED_HUNGARIAN_MOVIES');
  
  await testPool('FEATURED_MEDIAKLIKK_CLASSICS', classics);
  await testPool('FEATURED_HUNGARIAN_SERIES', series);
  await testPool('FEATURED_HUNGARIAN_MOVIES', movies);
}

run();
