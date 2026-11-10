const fs = require('fs');
const fetch = globalThis.fetch;

const rawData = JSON.parse(fs.readFileSync('C:/Users/Playe/.gemini/antigravity/brain/79aee8d7-ef25-401f-8944-a66a1bd7020d/scratch/onlinestream_channels.json', 'utf8'));
const channels = rawData.channels;

async function testStream(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://onlinestream.live/'
      },
      signal: AbortSignal.timeout(3000)
    });
    if (res.status === 200) {
      const text = await res.text();
      if (text.includes('#EXTM3U')) {
        return { ok: true, status: 200, length: text.length, isMaster: text.includes('#EXT-X-STREAM-INF') };
      }
    }
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function runScan() {
  console.log(`Scanning streams for ${channels.length} channels...`);
  const workingByChannel = {};

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const streams = ch.streams || [];
    const valid = [];

    for (const s of streams) {
      const u = s.direct_stream_url;
      if (!u) continue;
      const res = await testStream(u);
      if (res && res.ok) {
        valid.push({ url: u, isMaster: res.isMaster, host: s.stream_host });
      }
    }

    if (valid.length > 0) {
      workingByChannel[ch.id] = { name: ch.name, working: valid };
    }
    if ((i + 1) % 25 === 0 || i === channels.length - 1) {
      console.log(`Progress: ${i + 1} / ${channels.length} (working: ${Object.keys(workingByChannel).length})`);
    }
  }

  fs.writeFileSync('scripts/working_streams_report.json', JSON.stringify(workingByChannel, null, 2), 'utf8');
  console.log(`Finished! Total channels with confirmed 200 OK live streams: ${Object.keys(workingByChannel).length}`);
}

runScan();
