import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/live_tv_streams_audit.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    working = [r for r in reader if r['Állapot'] == 'MŰKÖDIK']

res_dist = {}
for r in working:
    res = r['Valódi Felbontás']
    # group by main quality
    tag = res.split(' (')[0] if ' (' in res else res
    res_dist[tag] = res_dist.get(tag, 0) + 1

print(f"Total working streams: {len(working)}")
print("Resolution distribution:")
for k, v in sorted(res_dist.items(), key=lambda x: x[1], reverse=True):
    print(f"  {k:25}: {v}")

print("\nExamples of true resolutions for top channels:")
for r in working[:30]:
    print(f"  {r['Csatorna']:22} | {r['Forrás #']:15} | {r['Szerver Host']:25} | {r['Valódi Felbontás']}")
