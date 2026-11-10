import urllib.request

u = 'https://gradetv.net:443/api/s/DisneyChannel.hu:SD:5646.m3u8?via=grade'
req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://onlinestream.live/'})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        print("Status:", r.status)
        print("Text:", r.read().decode('utf-8')[:300])
except Exception as e:
    print("Error:", e)
