import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
scratch_path = r"C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json"

with open(scratch_path, "r", encoding="utf-8") as f:
    d = json.load(f)

for cat_id, cat_info in d["categories"].items():
    print(f"=== {cat_id}: {cat_info['title']} ({cat_info['count']}) ===")
    chs = [c for c in d["channels"] if c["category"] == cat_id]
    for c in chs:
        direct_urls = [s.get("direct_stream_url") for s in c.get("streams", []) if s.get("direct_stream_url")]
        print(f"  [{c['id']}] {c['name']} | direct_streams: {len(direct_urls)} | logo: {c.get('logo')}")
