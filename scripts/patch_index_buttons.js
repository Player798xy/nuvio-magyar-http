const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

const target = `<button class="btn-action btn-copy" onclick="copyManifest()" id="copyBtn">\r\n              <span class="btn-ico">📋</span> Link másolása\r\n            </button>`;

const replacement = `<button class="btn-action btn-copy" onclick="copyManifest()" id="copyBtn">\r\n              <span class="btn-ico">📋</span> Link másolása\r\n            </button>\r\n            <a class="btn-action" style="background:linear-gradient(135deg, #e67e22, #d35400);color:#fff;text-decoration:none;" href="/playlist.xspf" download="nuvio-magyar-tv.xspf" title="VLC és Kodi XSPF Lejátszási Lista">\r\n              <span class="btn-ico">📻</span> VLC XSPF\r\n            </a>\r\n            <a class="btn-action" style="background:linear-gradient(135deg, #27ae60, #219653);color:#fff;text-decoration:none;" href="/playlist.m3u" download="nuvio-magyar-tv.m3u" title="IPTV M3U Lejátszási Lista">\r\n              <span class="btn-ico">📺</span> M3U IPTV\r\n            </a>`;

if (html.includes(target)) {
  html = html.replace(target, replacement);
  fs.writeFileSync('public/index.html', html, 'utf8');
  console.log('Successfully added XSPF and M3U buttons to public/index.html!');
} else {
  console.log('Target not found in public/index.html!');
}
