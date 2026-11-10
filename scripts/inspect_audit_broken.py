import csv

with open('scripts/live_tv_1080p_audit.csv', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')
    rows = list(reader)

print(f'Total rows in CSV: {len(rows)}')
broken = [r for r in rows if r['Állapot'] != 'MŰKÖDIK']
print(f'Broken sources count: {len(broken)}')
print('\nBroken Sources List:')
for r in broken:
    print(f"  {r['Kategória']} | {r['Csatorna']} ({r['ID']}) {r['Forrás']} | {r['Host']} | {r['Hiba Oka']}")
