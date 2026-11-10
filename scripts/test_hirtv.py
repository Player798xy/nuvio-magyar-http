import urllib.request
import re
import json

req = urllib.request.Request('https://hirtv.hu/hirtv_elo_adas', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        html = r.read().decode('utf-8', errors='ignore')
        m3u8s = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
        print('hirtv.hu m3u8s:', m3u8s)
        iframes = re.findall(r'<iframe[^\>]+src=["\']([^"\']+)["\']', html)
        print('hirtv.hu iframes:', iframes)
except Exception as e:
    print('hirtv error:', e)

# Also check Videa info for CDzWNlyZ6ji2UTDc
v_url = 'https://videa.hu/videaplayer_get_xml.php?v=CDzWNlyZ6ji2UTDc'
req2 = urllib.request.Request(v_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req2, timeout=5) as r2:
        print('videa xml:', r2.read().decode('utf-8', errors='ignore')[:300])
except Exception as e:
    print('videa error:', e)
