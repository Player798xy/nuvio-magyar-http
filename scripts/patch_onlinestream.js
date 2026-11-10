const fs = require('fs');

let content = fs.readFileSync('src/scrapers/onlinestream.js', 'utf8');

const targetStr = 'if (!ch) return [];';
const insertion = `if (!ch) return [];

  if (config && Array.isArray(config.sources) && config.sources.length > 0) {
    if (ch.category === 'hu-live-helyi' && !config.sources.includes('onlinestream_local')) {
      return [];
    }
  }`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, insertion);
  console.log('Inserted config check after if (!ch) return [];');
  fs.writeFileSync('src/scrapers/onlinestream.js', content, 'utf8');
} else {
  console.log('Target string not found');
}
