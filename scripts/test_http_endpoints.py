import urllib.request
import json

endpoints = [
    'http://localhost:7000/manifest.json',
    'http://localhost:7000/catalog/movie/hu-live-orszagos.json',
    'http://localhost:7000/stream/movie/onlinestream-live-5901.json',
    'http://localhost:7000/stream/movie/onlinestream-live-6141.json',
    'http://localhost:7000/stream/movie/onlinestream-live-4740.json',
    'http://localhost:7000/stream/movie/onlinestream-live-7079.json',
    'http://localhost:7000/stream/movie/onlinestream-live-4247.json',
    'http://localhost:7000/tv-posters/5937.png',
    'http://localhost:7000/live_tv_1080p_audit.xlsx',
    'http://localhost:7000/playlist.xspf',
    'http://localhost:7000/playlist.m3u'
]

for ep in endpoints:
    try:
        req = urllib.request.Request(ep)
        with urllib.request.urlopen(req, timeout=5) as r:
            data = r.read()
            print(f'OK {r.status} (bytes: {len(data)}) --> {ep}')
            if 'stream' in ep:
                d = json.loads(data.decode('utf-8'))
                streams = d.get('streams', [])
                print(f'   Streams count: {len(streams)}')
                if streams:
                    print(f'   Top stream: {streams[0].get("name")}')
    except Exception as e:
        print(f'ERR {e} --> {ep}')
