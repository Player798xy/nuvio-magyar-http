import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n\s*const CHANNELS_BY_ID', content, re.DOTALL)
channels = json.loads(m.group(1))

by_cat = {}
for ch in channels:
    by_cat.setdefault(ch['category'], []).append(ch['name'])

for cat, ch_list in by_cat.items():
    print(f"\n=== {cat} ({len(ch_list)}) ===")
    for idx, name in enumerate(ch_list, start=1):
        print(f"  {idx:2d}. {name}")
