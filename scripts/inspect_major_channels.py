import csv

with open('scripts/live_tv_1080p_audit.csv', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')
    rows = list(reader)

channels_to_check = ['5901', '6141', '6143', '5905', '5903', '5902', '5904', '5906']
for cid in channels_to_check:
    print(f"\n--- Csatorna ID: {cid} ---")
    ch_rows = [r for r in rows if r['ID'] == cid]
    for r in ch_rows:
        print(f"  {r['Csatorna']} {r['Forrás']} -> {r['1080p Eredmény']} | {r['Valós Felbontás']} | {r['Állapot']} | {r['Host']}")
