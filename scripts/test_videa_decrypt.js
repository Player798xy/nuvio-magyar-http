const { rc4Decrypt } = (() => {
  function rc4Decrypt(cipherBuf, key) {
    const s = [];
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
      const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }
    let i = 0; j = 0;
    const res = Buffer.alloc(cipherBuf.length);
    for (let k = 0; k < cipherBuf.length; k++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
      res[k] = cipherBuf[k] ^ s[(s[i] + s[j]) % 256];
    }
    return res.toString('utf8');
  }
  return { rc4Decrypt };
})();

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
  const xs = xmlResp.headers.get('x-videa-xs') || '';
  c.f = xs;
  const raw = await xmlResp.text();
  const key = c.b + c.i + c.e + c.f;
  const cipherBuf = Buffer.from(raw, 'base64');
  const xmlStr = rc4Decrypt(cipherBuf, key);
  console.log('Decrypted XML:');
  const srcIdx = xmlStr.indexOf('<video_sources');
  console.log(srcIdx !== -1 ? xmlStr.slice(srcIdx) : xmlStr.slice(0, 1000));
}
test();
