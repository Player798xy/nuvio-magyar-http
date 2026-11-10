async function check() {
  try {
    const res = await fetch('https://onlinestream.live/rtl/videoplayer/6141-1', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://onlinestream.live/' }
    });
    const html = await res.text();
    const m = html.match(/href=[\"']([^\"']*play\.xspf[^\"']*)[\"']/i);
    console.log('Match href:', m ? m[1] : 'none');
    if (m) {
      const xspfUrl = new URL(m[1], 'https://onlinestream.live').toString();
      console.log('Fetching XSPF from:', xspfUrl);
      const xspfRes = await fetch(xspfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://onlinestream.live/' }
      });
      const xml = await xspfRes.text();
      console.log('XSPF Content:\n', xml);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}
check();
