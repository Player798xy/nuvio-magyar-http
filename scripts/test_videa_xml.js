async function test() {
  const vcode = 'CDzWNlyZ6ji2UTDc';
  const playerUrl = 'https://videa.hu/player?v=' + vcode;
  const resp = await fetch(playerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://hirtv.origo.hu/'
    }
  });
  const html = await resp.text();
  const nonceMatch = html.match(/_xt\s*=\s*"([^"]+)"/);
  if (!nonceMatch) { console.log('no xt'); return; }
  const _xt = nonceMatch[1];
  const e = _xt.split('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 8; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
  const c = {};
  const o = 'xHb0ZvME5q8CBcoQi6AngerDu3FGO9fkUlwPmLVY_RTzj2hJIS4NasXWKy1td7p';
  let r = ['e', 'a', 'g', 'j', 'd', 'c', 'h', 'i', 'b', 'f'];
  for (let i = 0; i < e.length; i++) {
    if (i % 8 === 0) c[r[Math.floor(i / 8) + 1]] = '';
    c[r[Math.floor(i / 8) + 1]] += e[i];
  }
  c[r[0]] = t;
  const d = c.a + c.g + c.j + c.d;
  const u = c.c + c.h + c.i + c.b;
  let m = '';
  for (let i = 0; i < d.length; i++) {
    m += u.charAt(i - (o.indexOf(d.charAt(i)) - 31));
  }
  r = ['f', 'h', 'c', 'b', 'i'];
  for (let i = 0; i < m.length; i++) {
    if (i % 8 === 0) c[r[Math.floor(i / 8) + 1]] = '';
    c[r[Math.floor(i / 8) + 1]] += m.charAt(i);
  }
  c[r[0]] = '';
  const _s = c.e;
  const _t = c.h + c.c;
  const xmlUrl = 'https://videa.hu/player/xml?v=' + vcode + '&_s=' + encodeURIComponent(_s) + '&_t=' + encodeURIComponent(_t);
  const xmlResp = await fetch(xmlUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://videa.hu/player?v=' + vcode
    }
  });
  console.log('XML status:', xmlResp.status);
  const raw = await xmlResp.text();
  console.log('XML raw length:', raw.length);
  console.log('XML raw preview:', raw.slice(0, 300));
}
test();
