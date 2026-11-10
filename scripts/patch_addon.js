const fs = require('fs');

let content = fs.readFileSync('src/addon.js', 'utf8');

const targetScraper = "{ id: 'onlinestream', name: 'OnlineStream IPTV', fn: async () => [], fast: true }";
const replScraper = "{ id: 'onlinestream', name: 'OnlineStream IPTV', fn: async () => [], fast: true },\n\n  { id: 'onlinestream_local', name: 'OnlineStream Helyi TV-k', fn: async () => [], fast: true }";

if (content.includes(targetScraper) && !content.includes('onlinestream_local')) {
  content = content.replace(targetScraper, replScraper);
  console.log('Added onlinestream_local to ALL_SCRAPERS');
}

const targetCall = 'const liveStreams = await getOnlineStreamStreams(id, config.clientIp, config.hostUrl);';
const replCall = 'const liveStreams = await getOnlineStreamStreams(id, config.clientIp, config.hostUrl, config);';

if (content.includes(targetCall)) {
  content = content.replace(targetCall, replCall);
  console.log('Passed config to getOnlineStreamStreams');
}

fs.writeFileSync('src/addon.js', content, 'utf8');
console.log('src/addon.js patched successfully');
