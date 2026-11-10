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
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        html = r.read().decode('utf-8', errors='ignore')
        print("Videa player html length:", len(html))
        # Look for player XML or tokens
        scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
        for s in scripts:
            if '_s' in s or '_t' in s or 'flv' in s or 'm3u8' in s or 'mp4' in s or 'sources' in s or 'get_xml' in s:
                print("Script chunk:", s[:400])
except Exception as e:
    print('Error:', e)
