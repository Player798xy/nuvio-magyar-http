import json, re

with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n\s*const CHANNELS_BY_ID', content, re.DOTALL)
channels = json.loads(m.group(1))

for ch in channels:
    if ch['name'] == 'TCL' or ch['name'] == 'TLC':
        print(f"Name: {ch['name']} | ID: {ch['id']} | ChannelId: {ch['channelId']}")
        for s in ch.get('streams', []):
            print(f"   {s.get('host')} | {s.get('url')}")
