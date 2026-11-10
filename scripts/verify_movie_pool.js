const fetch = globalThis.fetch;
const fs = require('fs');

const content = fs.readFileSync('src/catalogs.js', 'utf8');
const match = content.match(/const VERIFIED_HUNGARIAN_MOVIES_POOL = (\[[\s\S]*?\]);\s*\n/);
if (!match) {
  console.log('Not found');
  process.exit(1);
}

const pool = eval(match[1]);
console.log('Testing', pool.length, 'movies in VERIFIED_HUNGARIAN_MOVIES_POOL:\n');

async function testAll() {
  for (const item of pool) {
    const iid = item.id;
    const name = item.name;
    try {
      const res = await fetch(`https://v3-cinemeta.strem.io/meta/movie/${iid}.json`, { signal: AbortSignal.timeout(4000) });
      const d = await res.json();
      const meta = d.meta || {};
      const realName = meta.name || 'UNKNOWN';
      const realYear = meta.year || 'UNKNOWN';
      const realPoster = meta.poster || '';
      
      const isMatch = realName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(realName.toLowerCase());
      if (isMatch) {
        console.log(`✅ [${iid}] "${name}" matches Cinemeta: "${realName}" (${realYear})`);
      } else {
        console.log(`❌ MISMATCH: [${iid}] Expected "${name}", but Cinemeta says: "${realName}" (${realYear}) | Poster: ${realPoster}`);
      }
    } catch (e) {
      console.log(`⚠️ [${iid}] "${name}" -> Error: ${e.message}`);
    }
  }
}

testAll();
