import urllib.request
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request(
    'https://videa.hu/static/uis/player/js/VideaPlayerClasses.min.js?_rc=2026101201',
    headers={'User-Agent': 'Mozilla/5.0'}
)
with urllib.request.urlopen(req, timeout=10) as r:
    js = r.read().decode('utf-8', errors='ignore')
    print("JS length:", len(js))
    m = re.findall(r'(\w+[\.\w]*\s*=\s*function[^\(]*\([^\)]*\)\s*\{[^\{]*_xt.*?\})', js)
    print("Matches for _xt:", len(m))
    idx2 = js.find('_xt')
    if idx2 != -1:
        print("Found _xt:", js[idx2-100:idx2+300])
