import json
with open(r'C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
ch_by_id = {c['id']: c for c in d['channels']}

import sys
sys.path.append(r'C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http\scripts')
from build_onlinestream_module import ORDERED_CATEGORIES

for cat_id, cat in ORDERED_CATEGORIES.items():
    print(f"=== {cat_id}: {len(cat['ids'])} channels ===")
    for cid in cat['ids']:
        ch = ch_by_id.get(cid)
        name = ch['name'] if ch else 'MISSING'
        print(f"  {cid}: {name}")
