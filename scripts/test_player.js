const fetch = globalThis.fetch;

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://onlinestream.live/'
  };

  const urls = [
    'https://onlinestream.live/national-geographic/videoplayer/5936-1',
    'https://onlinestream.live/film/videoplayer/6150-1',
    'https://onlinestream.live/rtl/videoplayer/5898-1',
    'https://onlinestream.live/sopron-tv/videoplayer/5982-1'
  ];

  for (const u of urls) {
    console.log('\n=== Testing:', u);
    try {
      const res = await fetch(u, { headers });
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Length:', text.length);

      // Search for .m3u8
      const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g;
      const found = text.match(m3u8Regex);
      console.log('Found m3u8:', found);

      // Search for Clappr / videojs / jwplayer / hls source
      const srcRegex = /(?:source|file|src)\s*:\s*["']([^"']+)["']/g;
      let m;
      while ((m = srcRegex.exec(text)) !== null) {
        console.log('Found source match:', m[1]);
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

test();
