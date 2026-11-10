import json, re

with open('src/scrapers/onlinestream.js', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n(?:module\.exports|async function|const )', text, re.DOTALL)
channels = json.loads(m.group(1))

connect_media_count = 0
for c in channels:
    for s in c.get('streams', []):
        u = s.get('url', '')
        if 'connectmedia.hu' in u:
            connect_media_count += 1
            print(f"{c['channelId']} {c['name']} (sub {s.get('sub_idx')}): {u[:75]}")

print('Total connectmedia URLs in ALL_CHANNELS:', connect_media_count)
