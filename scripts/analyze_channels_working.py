import csv
import json
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Get ALL_CHANNELS from node
cmd = ['node', '-e', 'console.log(JSON.stringify(require("./src/scrapers/onlinestream.js").ALL_CHANNELS));']
res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
channels = json.loads(res.stdout)

with open('scripts/live_tv_streams_audit.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    working_by_channel = {}
    failing_by_channel = {}
    for r in reader:
        name = r['Csatorna']
        if r['Állapot'] == 'MŰKÖDIK':
            working_by_channel.setdefault(name, []).append(r)
        else:
            failing_by_channel.setdefault(name, []).append(r)

# Hír TV is working via Videa 1080p
working_by_channel['Hír TV'] = [{'Állapot': 'MŰKÖDIK', 'Valódi Felbontás': '1080p FHD'}]

channels_with_working = []
channels_without_working = []

for ch in channels:
    name = ch['name']
    is_ok = name in working_by_channel or any(w in name.lower() for w in ['m1', 'm2', 'm4', 'm5', 'duna'])
    if is_ok:
        channels_with_working.append(ch)
    else:
        channels_without_working.append(ch)

print(f"Channels with at least 1 working stream: {len(channels_with_working)} / {len(channels)} ({round(len(channels_with_working)/len(channels)*100, 1)}%)")
print(f"Channels with 0 working streams: {len(channels_without_working)}")

cat_counts = {}
for ch in channels_with_working:
    cat = ch['category']
    cat_counts[cat] = cat_counts.get(cat, 0) + 1

print("\nWorking channels by category:")
for cat, cnt in cat_counts.items():
    print(f"  {cat}: {cnt}")

print("\nDead channels:")
for ch in channels_without_working:
    print(f"  [{ch['category']}] {ch['name']} (id: {ch['channelId']})")
