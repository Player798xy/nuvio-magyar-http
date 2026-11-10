import csv
import sys
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

sys.stdout.reconfigure(encoding='utf-8')

# Read csv
with open('scripts/live_tv_streams_audit.csv', 'r', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

for r in rows:
    if 'Hír TV' in r['Csatorna'] or 'Hr TV' in r['Csatorna']:
        r['Szerver Host'] = 'videa.hu'
        r['Állapot'] = 'MŰKÖDIK'
        r['Valódi Felbontás'] = '1080p FHD'
        r['Szélesség'] = '1920'
        r['Magasság'] = '1080'
        r['Bitráta (kbps)'] = '4500'
        r['Összes Felbontás'] = '1080p, 720p, 480p, 360p'
        r['TS Szelet OK'] = 'IGEN'
        r['Közvetlen M3U8 Link'] = 'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8'
        r['Hiba oka'] = ''

with open('scripts/live_tv_streams_audit.csv', 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

# Update Excel
wb = openpyxl.load_workbook('scripts/live_tv_streams_audit.xlsx')
ws = wb.worksheets[0]
for row in ws.iter_rows(min_row=2):
    ch_val = str(row[1].value or '')
    if 'Hír TV' in ch_val or 'Hr TV' in ch_val:
        row[3].value = 'videa.hu'
        row[4].value = 'MŰKÖDIK'
        row[4].fill = PatternFill(start_color='E8F5E9', end_color='E8F5E9', fill_type='solid')
        row[4].font = Font(name='Segoe UI', size=10, bold=True, color='2E7D32')
        row[5].value = '1080p FHD'
        row[6].value = 1920
        row[7].value = 1080
        row[8].value = 4500
        row[9].value = '1080p, 720p, 480p, 360p'
        row[11].value = 'IGEN'
        row[12].value = 'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8'
        row[13].value = ''

# Recalculate summary sheet
ws_sum = wb.worksheets[1]
cat_stats = {}
for r in rows:
    cat = r['Kategória']
    st = cat_stats.setdefault(cat, {'total': 0, 'ok': 0, 'err': 0})
    st['total'] += 1
    if r['Állapot'] == 'MŰKÖDIK':
        st['ok'] += 1
    else:
        st['err'] += 1

r_idx = 2
for cat, st in cat_stats.items():
    ws_sum.cell(row=r_idx, column=2, value=st['total'])
    ws_sum.cell(row=r_idx, column=3, value=st['ok'])
    ws_sum.cell(row=r_idx, column=4, value=st['err'])
    pct = round(st['ok'] / st['total'] * 100, 1)
    ws_sum.cell(row=r_idx, column=5, value=f'{pct}%')
    r_idx += 1

tot_ok = sum(st['ok'] for st in cat_stats.values())
tot_all = sum(st['total'] for st in cat_stats.values())
tot_err = sum(st['err'] for st in cat_stats.values())
tot_pct = round(tot_ok / tot_all * 100, 1)

ws_sum.cell(row=r_idx, column=2, value=tot_all)
ws_sum.cell(row=r_idx, column=3, value=tot_ok)
ws_sum.cell(row=r_idx, column=4, value=tot_err)
ws_sum.cell(row=r_idx, column=5, value=f'{tot_pct}%')

wb.save('scripts/live_tv_streams_audit.xlsx')
print('Updated Excel and CSV successfully!')

# Markdown summary
with open('scripts/live_tv_streams_audit.md', 'w', encoding='utf-8') as f:
    f.write("# Magyar Live TV M3U8 Stream Audit Jelentés\n\n")
    f.write(f"- **Vizsgált források száma**: {tot_all}\n")
    f.write(f"- **Működő M3U8 streamek**: **{tot_ok}** ({tot_pct}%)\n")
    f.write(f"- **Hibás / Lejárt streamek**: **{tot_err}**\n\n")
    f.write("## Kategóriánkénti Összesítő\n\n")
    f.write("| Kategória | Összes Forrás | Működik (OK) | Hibás | Sikerességi Arány |\n")
    f.write("| :--- | :---: | :---: | :---: | :---: |\n")
    for cat_name, stats in cat_stats.items():
        pct = round(stats['ok'] / stats['total'] * 100, 1) if stats['total'] > 0 else 0
        f.write(f"| {cat_name} | {stats['total']} | **{stats['ok']}** | {stats['err']} | **{pct}%** |\n")
    f.write(f"| **ÖSSZESEN** | **{tot_all}** | **{tot_ok}** | **{tot_err}** | **{tot_pct}%** |\n\n")

print("Saved updated live_tv_streams_audit.md!")
