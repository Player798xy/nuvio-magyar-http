const fs = require('fs');
const { ALL_CHANNELS } = require('../src/scrapers/onlinestream');

const missingPosters = [];
const missingLogos = [];
const missingBgs = [];

for (const ch of ALL_CHANNELS) {
  const pPath = `public/tv-posters/${ch.channelId}.png`;
  const lPath = `public/tv-logos/${ch.channelId}.png`;
  const bPath = `public/tv-backgrounds/${ch.channelId}.png`;
  if (!fs.existsSync(pPath)) missingPosters.push({ id: ch.channelId, name: ch.name });
  if (!fs.existsSync(lPath)) missingLogos.push({ id: ch.channelId, name: ch.name });
  if (!fs.existsSync(bPath)) missingBgs.push({ id: ch.channelId, name: ch.name });
}

console.log('Total channels:', ALL_CHANNELS.length);
console.log('Missing posters count:', missingPosters.length);
console.log('Missing logos count:', missingLogos.length);
console.log('Missing bgs count:', missingBgs.length);
console.log('All missing channels:', missingPosters);
