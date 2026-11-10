import urllib.request
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request('https://hirtv.origo.hu/adas', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        html = r.read().decode('utf-8', errors='ignore')
        print("hirtv.origo.hu/adas length:", len(html))
        m3u8s = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
        print("m3u8s:", m3u8s)
        iframes = re.findall(r'<iframe[^\>]+src=["\']([^"\']+)["\']', html)
        print("iframes:", iframes)
except Exception as e:
    print('Error:', e)
