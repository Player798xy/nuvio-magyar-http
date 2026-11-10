const fetch = globalThis.fetch;

async function testChannels() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://onlinestream.live/'
  };

  const chs = [
    { name: 'M1', id: '5901', player: 'https://onlinestream.live/m1/videoplayer/5901-1' },
    { name: 'M4 Sport', id: '5903', player: 'https://onlinestream.live/m4-sport/videoplayer/5903-1' },
    { name: 'Sopron TV', id: '5982', player: 'https://onlinestream.live/sopron-tv/videoplayer/5982-1' },
    { name: 'Fehérvár TV', id: '5984', player: 'https://onlinestream.live/fehervar-tv/videoplayer/5984-1' },
    { name: 'Nat Geo', id: '5936', player: 'https://onlinestream.live/national-geographic/videoplayer/5936-1' },
    { name: 'Film+', id: '6150', player: 'https://onlinestream.live/film/videoplayer/6150-1' },
    { name: 'RTL', id: '6141', player: 'https://onlinestream.live/rtl/videoplayer/6141-1' }
  ];

  for (const c of chs) {
    try {
      const res = await fetch(c.player, { headers, signal: AbortSignal.timeout(3000) });
      const text = await res.text();
      const m3u8 = text.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g) || [];
      console.log(`${c.name} (${c.id}) -> Status: ${res.status}, M3U8 count: ${m3u8.length}`, m3u8[0] || 'NONE');
    } catch (e) {
      console.log(`${c.name} -> Error: ${e.message}`);
    }
  }
}

testChannels();
