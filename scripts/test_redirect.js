const fetch = globalThis.fetch;

async function checkRedirect() {
  const u = 'https://redirect.onlinestream.live/sopronmedia.m3u8';
  console.log('Fetching:', u);
  const res = await fetch(u, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://onlinestream.live/'
    },
    redirect: 'manual'
  });
  console.log('Status:', res.status, 'Location:', res.headers.get('location'));
  if (res.status === 200) {
    const text = await res.text();
    console.log('Body:', text.slice(0, 300));
  } else if (res.status === 302 || res.status === 301) {
    const loc = res.headers.get('location');
    const res2 = await fetch(loc, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log('Followed location status:', res2.status);
    const text2 = await res2.text();
    console.log('Body:', text2.slice(0, 300));
  }
}

checkRedirect();
