const fs = require('fs');

async function searchLogos() {
  try {
    const res = await fetch('https://api.github.com/repos/tv-logo/tv-logos/git/trees/main?recursive=1', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const paths = (data.tree || []).map(t => t.path).filter(p => p.endsWith('.png'));
    console.log('Total logos in repo:', paths.length);
    const huLogos = paths.filter(p => p.includes('hungary'));
    console.log('Hungary logos:', huLogos.length);
    const query = ['animal', 'discovery', 'disney', 'eurosport', 'story', 'food', 'hgtv', 'travel', 'viasat', 'fishing', 'atv', 'dikh', 'fix'];
    const results = {};
    for (const q of query) {
      results[q] = paths.filter(p => p.toLowerCase().includes(q)).slice(0, 5);
    }
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
searchLogos();
