import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request('https://hirtv.hu/', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        html = r.read().decode('utf-8', errors='ignore')
        idx = html.find('hirtv_kesleltetett')
        if idx != -1:
            print(html[idx:idx+500])
except Exception as e:
    print('Error:', e)
