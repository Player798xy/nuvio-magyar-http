async function test() {
  const testUrls = [
    'http://141.94.193.53/RTL_HD/tracks-v1a1/mono.m3u8',
    'http://141.94.193.53/Film+_HD/tracks-v1a1/mono.m3u8',
    'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8',
    'https://m3m8.gradetv.net/api/s/Spiler1.hu:SD:13725.m3u8?via=grade&faixa=video'
  ];

  for (const u of testUrls) {
    console.log('\n========================================');
    console.log('Testing proxy for:', u);
    const start = Date.now();
    try {
      const res = await fetch('http://localhost:7000/proxy/hls.m3u8?url=' + encodeURIComponent(u));
      const elapsed = Date.now() - start;
      console.log('Status:', res.status, 'Time:', elapsed + 'ms');
      const text = await res.text();
      const lines = text.split('\n');
      console.log('Total lines:', lines.length);
      console.log('First 10 lines:');
      lines.slice(0, 10).forEach(l => console.log('  ', l));

      // Find first segment URL
      const firstSegment = lines.find(l => l.startsWith('http://localhost:7000/proxy/hls'));
      if (firstSegment) {
        console.log('Testing segment download for:', firstSegment.slice(0, 80) + '...');
        const sStart = Date.now();
        const sRes = await fetch(firstSegment);
        const sElapsed = Date.now() - sStart;
        console.log('Segment status:', sRes.status, 'Time:', sElapsed + 'ms', 'Content-Type:', sRes.headers.get('content-type'), 'Content-Length:', sRes.headers.get('content-length'));
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

test();
