const fetch = globalThis.fetch;

async function checkSopronOfficial() {
  const urls = [
    'https://www.soprontv.hu/elo-adas',
    'https://www.soprontv.hu/elo',
    'https://www.soprontv.hu/'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) });
      const html = await res.text();
      const m3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
      const iframes = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
      console.log(u, 'status:', res.status, 'm3u8:', m3u8, 'iframes:', iframes);
    } catch (e) {
      console.log(u, 'error:', e.message);
    }
  }
}

checkSopronOfficial();
