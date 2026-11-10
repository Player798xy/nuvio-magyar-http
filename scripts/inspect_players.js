const fetch = globalThis.fetch;
const fs = require('fs');

async function checkBody() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://onlinestream.live/'
  };

  const resFilm = await fetch('https://onlinestream.live/film/videoplayer/6150-1', { headers });
  const textFilm = await resFilm.text();
  fs.writeFileSync('scripts/film_player.html', textFilm, 'utf8');

  const resRtl = await fetch('https://onlinestream.live/rtl/videoplayer/5898-1', { headers });
  const textRtl = await resRtl.text();
  fs.writeFileSync('scripts/rtl_player.html', textRtl, 'utf8');

  console.log('Saved film_player.html and rtl_player.html');
}

checkBody();
