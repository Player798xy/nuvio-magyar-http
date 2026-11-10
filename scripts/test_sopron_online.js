const fetch = globalThis.fetch;

async function checkOnline() {
  const res = await fetch('https://onlinestream.live/sopron-tv/online/5982-1', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://onlinestream.live/' }
  });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('Length:', html.length);
  const m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi);
  console.log('m3u8:', m);
  const iframes = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
  console.log('iframes:', iframes);
}

checkOnline();
