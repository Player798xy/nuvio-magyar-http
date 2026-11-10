import urllib.request
import re

req = urllib.request.Request('https://hirtv.hu/', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        html = r.read().decode('utf-8', errors='ignore')
        matches = re.findall(r'href="([^"]*elo[^"]*)"', html, re.I)
        print('Elo matches on hirtv.hu:', matches)
        matches2 = re.findall(r'href="([^"]*live[^"]*)"', html, re.I)
        print('Live matches on hirtv.hu:', matches2)
except Exception as e:
    print('Error:', e)
