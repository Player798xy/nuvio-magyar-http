import urllib.request
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request(
    'https://videa.hu/player?v=CDzWNlyZ6ji2UTDc',
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://hirtv.origo.hu/'
    }
)
with urllib.request.urlopen(req, timeout=5) as r:
    html = r.read().decode('utf-8', errors='ignore')
    idx = html.find('changePlayerSize')
    if idx != -1:
        print(html[idx:idx+2000])
