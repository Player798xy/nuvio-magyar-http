const fetch = globalThis.fetch;

async function checkDifferentHeaders() {
  const m3u8Url = 'https://redirect.onlinestream.live/sopronmedia.m3u8';
  const res = await fetch(m3u8Url);
  const text = await res.text();
  const subUrl = text.trim().split('\n').filter(l => l.startsWith('http'))[0];
  console.log('Sub URL from redirect:', subUrl);

  const referers = [
    'https://onlinestream.live/',
    'https://onlinestream.live/sopron-tv/online/5982-1',
    'https://redirect.onlinestream.live/',
    'https://www.soprontv.hu/',
    ''
  ];

  for (const ref of referers) {
    try {
      const h = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
      if (ref) h['Referer'] = ref;
      const r = await fetch(subUrl, { headers: h, signal: AbortSignal.timeout(3000) });
      console.log('Ref:', ref || '(empty)', '-> Status:', r.status);
    } catch (e) {
      console.log('Ref:', ref, '-> Error:', e.message);
    }
  }
}

checkDifferentHeaders();
