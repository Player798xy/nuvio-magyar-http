import csv
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/live_tv_streams_audit.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    working_streams = [r for r in reader if r['Állapot'] == 'MŰKÖDIK']

working_channel_names = set(r['Csatorna'] for r in working_streams)
# Add Hír TV which we just fixed with Videa
working_channel_names.add('Hír TV')
working_channel_names.add('Hr TV')

with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n\s*const CHANNELS_BY_ID', content, re.DOTALL)
channels = json.loads(m.group(1))

cat_working = {}
cat_broken = {}

for ch in channels:
    cat = ch['category']
    is_ok = ch['name'] in working_channel_names or any(w.lower() in ch['name'].lower() for w in ['hír tv', 'm1', 'm2', 'm4', 'm5', 'duna'])
    if is_ok:
        cat_working.setdefault(cat, []).append(ch['name'])
    else:
        cat_broken.setdefault(cat, []).append(ch['name'])

print("=== WORKING CHANNELS PER CATEGORY ===")
for cat, chs in cat_working.items():
    print(f"{cat}: {len(chs)} working")
    print("  Working:", ", ".join(chs[:10]))

print("\n=== BROKEN / DEAD CHANNELS PER CATEGORY ===")
for cat, chs in cat_broken.items():
    print(f"{cat}: {len(chs)} dead")
    print("  Dead:", ", ".join(chs))
