import urllib.request
import re

req = urllib.request.Request('https://onlinestream.live/disney-channel/online/6767-1', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        html = r.read().decode('utf-8', errors='ignore')
        m3u8s = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
        print('Disney online m3u8s:', m3u8s)
        # also find all play.m3u
        m3us = re.findall(r'https?://[^\s"\'<>]+\.m3u[^\s"\'<>]*', html)
        print('Disney online m3us:', m3us)
except Exception as e:
    print('Error:', e)
