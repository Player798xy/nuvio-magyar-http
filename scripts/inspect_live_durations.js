async function inspectPlaylists() {
  const samples = {
    'RTL (141.94.193.53)': 'http://141.94.193.53/RTL_HD/tracks-v1a1/mono.m3u8',
    'Spíler 1 (GradeTV)': 'https://m3m8.gradetv.net/api/s/Spiler1.hu:SD:13725.m3u8?via=grade&faixa=video',
    'TV2 Comedy (GradeTV)': 'https://m3m8.gradetv.net/api/s/TV2Comedy.hu:SD:11342.m3u8?via=grade&faixa=video',
    'Hír TV (Videa)': 'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8',
    'Debrecen TV (Lexa)': 'https://cloudfront44.lexanetwork.com:1344/relay44_1/livestream002.sdp/chunklist.m3u8'
  };

  for (const [name, url] of Object.entries(samples)) {
    console.log('\n=============================================');
    console.log('Channel:', name);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
          'Referer': 'https://onlinestream.live/'
        },
        signal: AbortSignal.timeout(4000)
      });
      const text = await res.text();
      console.log('Playlist text:\n' + text);
    } catch (e) {
      console.error('Fetch error:', e.message);
    }
  }
}

inspectPlaylists();
