import json
import re

with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n\s*const CHANNELS_BY_ID', content, re.DOTALL)
channels = json.loads(m.group(1))

names = ['Film+', 'Spektrum', 'M4 Sport', 'Minimax', 'Debrecen', 'TV2', 'Sopron']
for ch in channels:
    for n in names:
        if n.lower() in ch['name'].lower():
            st_count = len(ch.get('streams', []))
            print(f"{ch['name']:25} | id: {ch['id']:25} | channelId: {ch['channelId']:10} | streams: {st_count}")
