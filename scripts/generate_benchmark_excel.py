import json
import csv
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_excel_and_csv():
    json_path = os.path.join(os.path.dirname(__file__), 'stream_benchmark_results.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1. CSV generation
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'live_stream_speed_benchmark.csv')
    csv_headers = [
        'ID', 'Csatorna Név', 'Kategória', 'Ajánlott Mód (Tetején)', 
        'Mért Puffer (mp)', 'Puffer Szeletek', 'Vercel Válaszidő (ms)',
        'Szelet Letöltési Idő', 'Mért Sebesség (Mbps)', 'Elsődleges Host', 'Legfelső Stream Állapot'
    ]

    csv_rows = []
    for ch in data:
        rec = ch.get('bestRecommendation', 'HLS Proxy')
        rec_hu = '🔴 Közvetlen .m3u8' if 'Közvetlen' in rec else ('⚡ HLS Proxy' if 'Proxy' in rec else '❌ Offline')

        buffer_sec = ch.get('bufferSec') or 0
        buffer_str = f"{buffer_sec}s" if buffer_sec > 0 else "N/A"
        segs = ch.get('segmentCount') or 0
        segs_str = f"{segs} szelet" if segs > 0 else "0"

        latency = ch.get('proxyMs') or ch.get('directMs') or 0
        seg_ms = ch.get('segDownloadMs') or 0
        speed = ch.get('speedMbps') or 0
        speed_str = f"{speed} Mbps" if speed > 0 else "N/A"
        host = ch.get('serverHost') or 'CDN'
        stream_name = ch.get('topStreamName') or ch.get('statusDesc') or 'Aktív'

        csv_rows.append([
            ch.get('channelId', ''),
            ch.get('name', ''),
            ch.get('category', 'hu-live-orszagos'),
            rec_hu,
            buffer_str,
            segs_str,
            f"{latency} ms",
            f"{seg_ms} ms" if seg_ms > 0 else "N/A",
            speed_str,
            host,
            stream_name
        ])

    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        writer.writerows(csv_rows)
    print(f"CSV generated: {csv_path}")

    # 2. Excel (.xlsx) generation with high-quality styling
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Vercel Éles Mérés"
    ws.views.sheetView[0].showGridLines = True

    # Title Banner
    ws.merge_cells('A1:K1')
    title_cell = ws['A1']
    title_cell.value = "MAGYAR STREAMING PRO — VERCEL ÉLES STREAM MÉRÉSI AUDIT"
    title_cell.font = Font(name='Calibri', size=14, bold=True, color='FFFFFF')
    title_cell.fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
    title_cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 36

    # Subtitle
    ws.merge_cells('A2:K2')
    sub_cell = ws['A2']
    sub_cell.value = "112 élő magyar TV csatorna valós Vercel szerveres sebesség-, buffer- és sávszélesség-auditja. Valós mérési adatok (nem elméleti becslés)."
    sub_cell.font = Font(name='Calibri', size=10, italic=True, color='555555')
    sub_cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[2].height = 20

    # Headers
    headers = [
        'ID', 'Csatorna Név', 'Kategória', 'Ajánlott Mód (Tetején)', 
        'Valós Puffer (mp)', 'Szeletek Száma', 'Vercel Válaszidő',
        'Szelet Letöltés', 'Mért Sávszélesség', 'Elsődleges Host', 'Legfelső Stream Állapot'
    ]
    ws.append([]) # row 3 is blank
    ws.append(headers) # row 4
    ws.row_dimensions[4].height = 26

    header_fill = PatternFill(start_color='2F5597', end_color='2F5597', fill_type='solid')
    header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )

    for col_idx in range(1, len(headers) + 1):
        c = ws.cell(row=4, column=col_idx)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

    # Fill rows
    direct_fill = PatternFill(start_color='E2EFDA', end_color='E2EFDA', fill_type='solid') # soft green
    direct_font = Font(name='Calibri', size=11, bold=True, color='276A3C')
    proxy_fill = PatternFill(start_color='DDEBF7', end_color='DDEBF7', fill_type='solid') # soft blue
    proxy_font = Font(name='Calibri', size=11, bold=True, color='1F4E79')
    off_fill = PatternFill(start_color='FCE4D6', end_color='FCE4D6', fill_type='solid') # soft orange
    off_font = Font(name='Calibri', size=11, bold=True, color='C00000')

    for r_idx, row in enumerate(csv_rows, start=5):
        ws.append(row)
        ws.row_dimensions[r_idx].height = 20
        rec = row[3]

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=r_idx, column=col_idx)
            cell.border = thin_border
            cell.font = Font(name='Calibri', size=10)
            cell.alignment = Alignment(vertical='center')

            if col_idx in [1, 3, 5, 6, 7, 8, 9]:
                cell.alignment = Alignment(horizontal='center', vertical='center')

            if col_idx == 4: # Ajánlott Mód
                if 'Közvetlen' in rec:
                    cell.fill = direct_fill
                    cell.font = direct_font
                elif 'Proxy' in rec:
                    cell.fill = proxy_fill
                    cell.font = proxy_font
                else:
                    cell.fill = off_fill
                    cell.font = off_font

    # Column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    ws.column_dimensions['A'].width = 8
    ws.column_dimensions['B'].width = 24
    ws.column_dimensions['D'].width = 22
    ws.column_dimensions['E'].width = 18
    ws.column_dimensions['F'].width = 16
    ws.column_dimensions['I'].width = 20
    ws.column_dimensions['J'].width = 24
    ws.column_dimensions['K'].width = 54

    xlsx_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'live_stream_speed_benchmark.xlsx')
    wb.save(xlsx_path)
    print(f"Excel generated: {xlsx_path}")

if __name__ == '__main__':
    build_excel_and_csv()
