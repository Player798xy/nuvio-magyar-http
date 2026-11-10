import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
scratch_path = r"C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json"

with open(scratch_path, "r", encoding="utf-8") as f:
    d = json.load(f)

channels_by_id = {str(c["id"]): c for c in d["channels"]}

from build_onlinestream_module import ORDERED_CATEGORIES

for cat_id, cat_info in ORDERED_CATEGORIES.items():
    print(f"\n=== {cat_info['name']} ===")
    for cid in cat_info['ids']:
        ch = channels_by_id.get(str(cid))
        if ch:
            print(f"  {cid:6s} | {ch['name']}")
        else:
            print(f"  {cid:6s} | NOT FOUND")
