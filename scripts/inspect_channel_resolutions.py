import csv
from collections import defaultdict

with open('scripts/live_tv_1080p_audit.csv', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')
    rows = list(reader)

# Group by channel ID
by_ch = defaultdict(list)
for r in rows:
    by_ch[(r['ID'], r['Csatorna'], r['Kategória'])].append(r)

channel_max_res = {}
for (cid, cname, cat), streams in by_ch.items():
    working = [s for s in streams if s['Állapot'] == 'MŰKÖDIK']
    if not working:
        channel_max_res[cid] = {'name': cname, 'cat': cat, 'max_h': 0, 'label': 'NINCS MŰKÖDŐ', 'streams_count': len(streams), 'working_count': 0}
        continue
    max_h = max(int(s['Magasság']) for s in working)
    if max_h >= 1080:
        label = '1080p FHD'
    elif max_h >= 720:
        label = '720p HD'
    elif max_h >= 576:
        label = '576p SD'
    elif max_h > 0:
        label = f'{max_h}p SD'
    else:
        label = 'SD'
    channel_max_res[cid] = {'name': cname, 'cat': cat, 'max_h': max_h, 'label': label, 'streams_count': len(streams), 'working_count': len(working)}

print("=== 720p HD CSATORNÁK ===")
for cid, info in channel_max_res.items():
    if info['label'] == '720p HD':
        print(f"  [{cid}] {info['name']} ({info['cat']}) -> {info['label']} ({info['working_count']} működő forrás)")

print("\n=== 576p SD CSATORNÁK ===")
for cid, info in channel_max_res.items():
    if 'SD' in info['label']:
        print(f"  [{cid}] {info['name']} ({info['cat']}) -> {info['label']} ({info['working_count']} működő forrás)")

print("\n=== NEM MŰKÖDŐ CSATORNÁK ===")
for cid, info in channel_max_res.items():
    if info['working_count'] == 0:
        print(f"  [{cid}] {info['name']} ({info['cat']})")
