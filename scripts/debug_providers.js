const { resolveMeta } = require('../src/utils/meta');
const { PROVIDERS } = require('../src/addon');

async function testMulti() {
  const targets = [
    ['movie', 'tt0499549'],       // Avatar (2009)
    ['series', 'tt31091099:1:1'], // Nagy Sándor: Egy isten születése S01E01
    ['series', 'tt0861751:1:1']   // Magyar népmesék S01E01
  ];

  for (const [type, id] of targets) {
    const meta = await resolveMeta(type, id);
    console.log(`\n=== Testing ${type} ${id}: ${meta.huTitle} / ${meta.enTitle} (${meta.year}) ===`);
    const results = await Promise.allSettled(
      PROVIDERS.map(async (p) => {
        const t0 = Date.now();
        const s = await p.fn(meta);
        return { id: p.id, count: s.length, ms: Date.now() - t0, sample: s[0] };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.count > 0) {
        console.log(`  ✅ [${r.value.id}] -> ${r.value.count} streams (${r.value.ms}ms) | ${r.value.sample.url.slice(0, 75)}`);
      }
    }
  }
}

testMulti();
