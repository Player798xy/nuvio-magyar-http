import urllib.request
import re

req = urllib.request.Request('https://hirtv.hu/', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        html = r.read().decode('utf-8', errors='ignore')
        idx = html.find('live.svg')
        if idx != -1:
            print(html[max(0, idx-300):min(len(html), idx+300)])
except Exception as e:
    print('Error:', e)
