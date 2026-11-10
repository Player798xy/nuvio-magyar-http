import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/live_tv_streams_audit.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    failing = [r for r in reader if r['Állapot'] != 'MŰKÖDIK']

print(f"Total failing: {len(failing)}")
print("-" * 100)
for r in failing:
    kat = r['Kategória']
    csat = r['Csatorna']
    forras = r['Forrás #']
    host = r['Szerver Host']
    hiba = r['Hiba oka']
    link = r['Közvetlen M3U8 Link'][:70]
    print(f"{kat[:15]:15} | {csat:20} | {forras:12} | {host:20} | {hiba[:25]:25} | {link}")
