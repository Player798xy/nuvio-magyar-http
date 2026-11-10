const fetch = globalThis.fetch;

async function checkSopron() {
  const pRes = await fetch('https://onlinestream.live/sopron-tv/videoplayer/5982-1', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://onlinestream.live/' }
  });
  const html = await pRes.text();
  const m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
  console.log('ConnectMedia url from player:', m ? m[0] : 'NONE');

  if (m) {
    try {
      const res = await fetch(m[0], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://onlinestream.live/'
        },
        signal: AbortSignal.timeout(4000)
      });
      console.log('Stream status:', res.status, 'Content-Type:', res.headers.get('content-type'));
      const text = await res.text();
      console.log('Text preview:\n', text.slice(0, 300));
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
  }
}

checkSopron();
