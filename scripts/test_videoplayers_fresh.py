import urllib.request
import re

urls = [
    ('Hír TV', 'https://onlinestream.live/hir-tv/videoplayer/4740-1'),
    ('Disney Channel', 'https://onlinestream.live/disney-channel/videoplayer/6767-1'),
    ('Tisza TV', 'https://onlinestream.live/tisza-tv/videoplayer/1835-1')
]

for name, u in urls:
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://onlinestream.live/'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            html = r.read().decode('utf-8', errors='ignore')
            m3u8s = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
            iframes = re.findall(r'<iframe[^\>]+src=["\']([^"\']+)["\']', html)
            print(f"=== {name} ===")
            print("m3u8s:", m3u8s)
            print("iframes:", iframes)
            # also print video source
            sources = re.findall(r'<source[^\>]+src=["\']([^"\']+)["\']', html)
            print("sources:", sources)
    except Exception as e:
        print(f"Error for {name}: {e}")
