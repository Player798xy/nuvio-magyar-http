#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Magyar Live TV M3U8 Stream Auditor & Resolution Verifier
Tests every stream source across all 146 Hungarian live TV channels.
Generates live_tv_streams_audit.xlsx, live_tv_streams_audit.csv, and live_tv_streams_audit.md.
"""

import os
import re
import json
import time
import urllib.request
import urllib.error
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

MTVA_KEYS = {
    'm1': 'mtv1live',
    'm2': 'mtv2live',
    'duna': 'dunalive',
    'm4': 'mtv4live',
    'dunaworld': 'dunaworldlive',
    'm5': 'mtv5live',
    'm3': 'm3live'
}

def resolve_mtva_url(mtva_key):
    slug = MTVA_KEYS.get(mtva_key, mtva_key)
    player_url = f"https://player.mediaklikk.hu/playernew/player.php?video={slug}"
    req = urllib.request.Request(player_url, headers={
        'User-Agent': USER_AGENT,
        'Referer': 'https://mediaklikk.hu/'
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            m = re.search(r'"file":\s*"([^"]+)"', html)
            if m:
                u = m.group(1).replace(r'\/', '/')
                if u.startswith('//'):
                    u = 'https:' + u
                return u
    except Exception as e:
        pass
    return None

def fetch_text(url, referer='https://onlinestream.live/', timeout=5):
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Referer': referer
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            return data.decode('utf-8', errors='ignore')
    except Exception as e:
        return None

def parse_master_variants(m3u8_text, base_url):
    lines = [l.strip() for l in m3u8_text.splitlines() if l.strip()]
    variants = []
    current_inf = None
    for line in lines:
        if line.startswith('#EXT-X-STREAM-INF:'):
            res_match = re.search(r'RESOLUTION=(\d+)x(\d+)', line, re.IGNORECASE)
            bw_match = re.search(r'BANDWIDTH=(\d+)', line, re.IGNORECASE)
            w = int(res_match.group(1)) if res_match else 0
            h = int(res_match.group(2)) if res_match else 0
            bw = int(bw_match.group(1)) if bw_match else 0
            current_inf = {'width': w, 'height': h, 'bandwidth': bw}
        elif current_inf and not line.startswith('#'):
            full_url = urljoin(base_url, line)
            variants.append({
                'url': full_url,
                'width': current_inf['width'],
                'height': current_inf['height'],
                'bandwidth': current_inf['bandwidth'],
                'quality': f"{current_inf['height']}p" if current_inf['height'] else f"{round(current_inf['bandwidth']/1000)}k"
            })
            current_inf = None
    variants.sort(key=lambda x: (x['height'], x['bandwidth']), reverse=True)
    return variants

def test_stream_source(task):
    cat_id = task['category_id']
    cat_name = task['category_name']
    ch_id = task['channel_id']
    ch_name = task['channel_name']
    source_idx = task['source_idx']
    source_obj = task['source_obj']
    mtva_key = task.get('mtva_key')
    is_mtva = task.get('is_mtva', False)

    start_time = time.time()
    result = {
        'category_id': cat_id,
        'category_name': cat_name,
        'channel_id': ch_id,
        'channel_name': ch_name,
        'source_idx': source_idx,
        'host': source_obj.get('host', 'unknown'),
        'original_url': source_obj.get('url', ''),
        'resolved_url': '',
        'status': 'HIBA',
        'error_reason': '',
        'is_master': False,
        'real_resolution': 'N/A',
        'width': 0,
        'height': 0,
        'bandwidth_kbps': 0,
        'all_resolutions': '',
        'response_time_ms': 0,
        'segment_ok': False,
        'segment_size': 0
    }

    target_url = source_obj.get('url', '')

    # 1. MTVA resolution
    if is_mtva and mtva_key:
        resolved = resolve_mtva_url(mtva_key)
        if resolved:
            target_url = resolved
            result['resolved_url'] = resolved
            result['host'] = 'MTVA ConnectMedia CDN'
        else:
            result['error_reason'] = 'MTVA token nem kérhető le'
            result['response_time_ms'] = int((time.time() - start_time) * 1000)
            return result

    # 2. Token refresh for onlinestream redirect / connectmedia
    if not target_url or 'redirect.onlinestream.live' in target_url or 'connectmedia.hu' in target_url:
        page_url = source_obj.get('onlineUrl') or source_obj.get('playerUrl')
        if page_url:
            html = fetch_text(page_url, timeout=4)
            if html:
                m = re.search(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
                if m:
                    target_url = m.group(0)

    if not target_url:
        result['error_reason'] = 'Nincs érvényes m3u8 URL'
        result['response_time_ms'] = int((time.time() - start_time) * 1000)
        return result

    result['resolved_url'] = target_url
    if result['host'] == 'unknown':
        parsed_host = urlparse(target_url).hostname
        result['host'] = parsed_host or 'unknown'

    # 3. Fetch M3U8
    t0 = time.time()
    m3u8_content = fetch_text(target_url, timeout=5)
    t_fetch = int((time.time() - t0) * 1000)
    result['response_time_ms'] = t_fetch

    if not m3u8_content or '#EXTM3U' not in m3u8_content:
        result['error_reason'] = 'Nem érvényes M3U8 válasz / 404 / Timeout'
        return result

    # 4. Parse Master vs Media Playlist
    variants = parse_master_variants(m3u8_content, target_url)
    if variants:
        result['is_master'] = True
        top = variants[0]
        result['width'] = top['width']
        result['height'] = top['height']
        result['bandwidth_kbps'] = round(top['bandwidth'] / 1000) if top['bandwidth'] else 0
        res_list = [f"{v['height']}p" for v in variants if v['height']]
        result['all_resolutions'] = ', '.join(res_list) if res_list else top['quality']
        
        if top['height'] >= 1080:
            result['real_resolution'] = f"1080p FHD ({top['width']}x{top['height']})"
        elif top['height'] >= 720:
            result['real_resolution'] = f"720p HD ({top['width']}x{top['height']})"
        elif top['height'] >= 576:
            result['real_resolution'] = f"576p SD ({top['width']}x{top['height']})"
        elif top['height'] > 0:
            result['real_resolution'] = f"{top['height']}p ({top['width']}x{top['height']})"
        else:
            result['real_resolution'] = top['quality']

        # Test variant playlist and segment
        test_variant_url = top['url']
        var_content = fetch_text(test_variant_url, timeout=4)
        if var_content and '#EXTINF' in var_content:
            seg_lines = [l.strip() for l in var_content.splitlines() if l.strip() and not l.startswith('#')]
            if seg_lines:
                first_seg_url = urljoin(test_variant_url, seg_lines[-1])
                try:
                    req_seg = urllib.request.Request(first_seg_url, headers={'User-Agent': USER_AGENT})
                    with urllib.request.urlopen(req_seg, timeout=4) as seg_resp:
                        seg_bytes = seg_resp.read(32768)
                        if len(seg_bytes) > 0:
                            result['segment_ok'] = True
                            result['segment_size'] = len(seg_bytes)
                except Exception:
                    pass
        result['status'] = 'MŰKÖDIK'
    else:
        # Direct media playlist
        result['is_master'] = False
        lines = [l.strip() for l in m3u8_content.splitlines() if l.strip()]
        seg_lines = [l for l in lines if not l.startswith('#')]
        if '#EXTINF' in m3u8_content and seg_lines:
            first_seg_url = urljoin(target_url, seg_lines[-1])
            try:
                req_seg = urllib.request.Request(first_seg_url, headers={'User-Agent': USER_AGENT})
                with urllib.request.urlopen(req_seg, timeout=4) as seg_resp:
                    seg_bytes = seg_resp.read(65536)
                    if len(seg_bytes) > 0:
                        result['segment_ok'] = True
                        result['segment_size'] = len(seg_bytes)
            except Exception:
                pass
            
            # Detect resolution using cv2
            try:
                import cv2
                cap = cv2.VideoCapture(target_url)
                ret, frame = cap.read()
                if ret and frame is not None:
                    h, w = frame.shape[:2]
                    result['width'] = w
                    result['height'] = h
                    if h >= 1080:
                        result['real_resolution'] = f"1080p FHD ({w}x{h})"
                    elif h >= 720:
                        result['real_resolution'] = f"720p HD ({w}x{h})"
                    elif h >= 576:
                        result['real_resolution'] = f"576p SD ({w}x{h})"
                    elif h > 0:
                        result['real_resolution'] = f"{h}p ({w}x{h})"
                cap.release()
            except Exception:
                pass

            if result['real_resolution'] == 'N/A':
                # Try inferring from URL name
                if '1080' in target_url:
                    result['real_resolution'] = '1080p FHD'
                elif '720' in target_url or 'hd' in target_url.lower():
                    result['real_resolution'] = '720p HD'
                elif '576' in target_url or 'sd' in target_url.lower():
                    result['real_resolution'] = '576p SD'
                else:
                    result['real_resolution'] = 'SD / HD (Egyedi HLS)'

            result['status'] = 'MŰKÖDIK'
        else:
            result['error_reason'] = 'Üres vagy ismeretlen M3U8 formátum'

    return result

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    onlinestream_js = os.path.join(root_dir, 'src', 'scrapers', 'onlinestream.js')
    
    with open(onlinestream_js, 'r', encoding='utf-8') as f:
        content = f.read()

    m_cats = re.search(r'const ONLINESTREAM_CATEGORIES = (\[.*?\]);\s*\n\s*const ALL_CHANNELS', content, re.DOTALL)
    m_chans = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n\s*const CHANNELS_BY_ID', content, re.DOTALL)

    categories = json.loads(m_cats.group(1))
    channels = json.loads(m_chans.group(1))

    cat_map = {c['id']: c['name'] for c in categories}

    print(f"Loaded {len(categories)} categories and {len(channels)} channels.")

    tasks = []
    
    # 1. Add MTVA official streams first for MTVA channels
    for ch in channels:
        if ch.get('mtvaKey'):
            tasks.append({
                'category_id': ch['category'],
                'category_name': cat_map.get(ch['category'], ch['category']),
                'channel_id': ch['id'],
                'channel_name': ch['name'],
                'source_idx': 0,
                'source_obj': {
                    'host': 'MTVA ConnectMedia CDN',
                    'url': '',
                    'playerUrl': f"https://mediaklikk.hu/elo/{ch['mtvaKey']}/"
                },
                'mtva_key': ch['mtvaKey'],
                'is_mtva': True
            })

    # 2. Add all streams from channels
    for ch in channels:
        streams = ch.get('streams', [])
        for idx, s in enumerate(streams):
            tasks.append({
                'category_id': ch['category'],
                'category_name': cat_map.get(ch['category'], ch['category']),
                'channel_id': ch['id'],
                'channel_name': ch['name'],
                'source_idx': idx + 1,
                'source_obj': s,
                'mtva_key': ch.get('mtvaKey'),
                'is_mtva': False
            })

    print(f"Total stream sources to test: {len(tasks)}")
    print("Testing streams in parallel with 16 threads...")

    results = []
    done_count = 0
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {executor.submit(test_stream_source, t): t for t in tasks}
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            done_count += 1
            if done_count % 25 == 0 or done_count == len(tasks):
                print(f"Progress: {done_count}/{len(tasks)} tested ({int(time.time() - t_start)}s)...")

    # Sort results by category, channel name, source index
    results.sort(key=lambda r: (r['category_id'], r['channel_name'], r['source_idx']))

    working_count = sum(1 for r in results if r['status'] == 'MŰKÖDIK')
    error_count = len(results) - working_count

    print(f"\nAudit complete in {int(time.time() - t_start)}s!")
    print(f"Working sources: {working_count}/{len(results)} ({round(working_count/len(results)*100, 1)}%)")
    print(f"Failing sources: {error_count}/{len(results)}")

    # 1. Export CSV
    csv_path = os.path.join(root_dir, 'scripts', 'live_tv_streams_audit.csv')
    import csv
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Kategória', 'Csatorna', 'Forrás #', 'Szerver Host', 'Állapot',
            'Valódi Felbontás', 'Szélesség', 'Magasság', 'Bitráta (kbps)',
            'Összes Felbontás', 'Válaszidő (ms)', 'TS Szelet OK',
            'Közvetlen M3U8 Link', 'Hiba oka'
        ])
        for r in results:
            writer.writerow([
                r['category_name'],
                r['channel_name'],
                f"Szerver #{r['source_idx']}" if r['source_idx'] > 0 else "Hivatalos MTVA CDN",
                r['host'],
                r['status'],
                r['real_resolution'],
                r['width'] if r['width'] else '',
                r['height'] if r['height'] else '',
                r['bandwidth_kbps'] if r['bandwidth_kbps'] else '',
                r['all_resolutions'],
                r['response_time_ms'],
                'IGEN' if r['segment_ok'] else 'NEM',
                r['resolved_url'] or r['original_url'],
                r['error_reason']
            ])
    print(f"Saved CSV: {csv_path}")

    # 2. Export Excel (.xlsx) with OpenPyXL
    xlsx_path = os.path.join(root_dir, 'scripts', 'live_tv_streams_audit.xlsx')
    wb = openpyxl.Workbook()
    ws_all = wb.active
    ws_all.title = "Összes Stream (Audit)"

    header_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid') # Slate 800
    sub_fill = PatternFill(start_color='334155', end_color='334155', fill_type='solid')
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    ok_fill = PatternFill(start_color='DCFCE7', end_color='DCFCE7', fill_type='solid') # Light green
    ok_font = Font(name='Segoe UI', size=10, bold=True, color='166534') # Dark green
    err_fill = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid') # Light red
    err_font = Font(name='Segoe UI', size=10, bold=True, color='991B1B') # Dark red
    regular_font = Font(name='Segoe UI', size=10)
    bold_font = Font(name='Segoe UI', size=10, bold=True)
    link_font = Font(name='Segoe UI', size=9, color='2563EB', underline='single')

    headers = [
        'Kategória', 'Csatorna Neve', 'Forrás', 'Szerver Host', 'Állapot',
        'Valódi Felbontás', 'Szélesség x Magasság', 'Bitráta (kbps)',
        'Összes Elérhető Felbontás', 'Válaszidő', 'Szelet (TS) Teszt',
        'Közvetlen M3U8 Stream Link', 'Hiba oka / Megjegyzés'
    ]

    ws_all.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws_all.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center')

    ws_all.row_dimensions[1].height = 28

    for row_idx, r in enumerate(results, start=2):
        source_label = f"Szerver #{r['source_idx']}" if r['source_idx'] > 0 else "Hivatalos MTVA"
        dim_label = f"{r['width']}x{r['height']}" if r['width'] and r['height'] else "-"
        row_data = [
            r['category_name'].split(': ')[-1] if ': ' in r['category_name'] else r['category_name'],
            r['channel_name'],
            source_label,
            r['host'],
            r['status'],
            r['real_resolution'],
            dim_label,
            r['bandwidth_kbps'] or '-',
            r['all_resolutions'] or '-',
            f"{r['response_time_ms']} ms",
            '✅ OK' if r['segment_ok'] else '❌ Nem',
            r['resolved_url'] or r['original_url'],
            r['error_reason'] or 'Stabil közvetlen HLS adás'
        ]
        ws_all.append(row_data)

        # Style cells
        ws_all.cell(row=row_idx, column=1).font = regular_font
        ws_all.cell(row=row_idx, column=2).font = bold_font
        ws_all.cell(row=row_idx, column=3).font = regular_font
        ws_all.cell(row=row_idx, column=4).font = regular_font

        # Status cell
        status_cell = ws_all.cell(row=row_idx, column=5)
        if r['status'] == 'MŰKÖDIK':
            status_cell.fill = ok_fill
            status_cell.font = ok_font
            status_cell.alignment = Alignment(horizontal='center', vertical='center')
        else:
            status_cell.fill = err_fill
            status_cell.font = err_font
            status_cell.alignment = Alignment(horizontal='center', vertical='center')

        # Resolution cell
        res_cell = ws_all.cell(row=row_idx, column=6)
        res_cell.font = bold_font
        if '1080p' in r['real_resolution']:
            res_cell.font = Font(name='Segoe UI', size=10, bold=True, color='047857') # Emerald green
        elif '720p' in r['real_resolution']:
            res_cell.font = Font(name='Segoe UI', size=10, bold=True, color='0369A1') # Blue
        elif '576p' in r['real_resolution']:
            res_cell.font = Font(name='Segoe UI', size=10, bold=True, color='B45309') # Amber

        ws_all.cell(row=row_idx, column=7).alignment = Alignment(horizontal='center')
        ws_all.cell(row=row_idx, column=8).alignment = Alignment(horizontal='right')
        ws_all.cell(row=row_idx, column=10).alignment = Alignment(horizontal='right')
        ws_all.cell(row=row_idx, column=11).alignment = Alignment(horizontal='center')

        # Link cell
        link_cell = ws_all.cell(row=row_idx, column=12)
        link_cell.font = link_font

        for col_idx in range(1, len(headers) + 1):
            ws_all.cell(row=row_idx, column=col_idx).border = border_thin

        ws_all.row_dimensions[row_idx].height = 20

    # Auto-adjust column widths
    for col in ws_all.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or '')
            if len(val) > max_len:
                max_len = len(val)
        ws_all.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 65)

    ws_all.auto_filter.ref = ws_all.dimensions

    # Summary Sheet
    ws_sum = wb.create_sheet(title="Összesítés Kategóriánként", index=0)
    ws_sum.append(["Kategória", "Összes Forrás", "Működő M3U8", "Hibás / Nem Elérhető", "Sikerességi Arány"])
    for col_idx in range(1, 6):
        c = ws_sum.cell(row=1, column=col_idx)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal='center', vertical='center')
    ws_sum.row_dimensions[1].height = 28

    cat_stats = {}
    for r in results:
        cid = r['category_name']
        if cid not in cat_stats:
            cat_stats[cid] = {'total': 0, 'ok': 0, 'err': 0}
        cat_stats[cid]['total'] += 1
        if r['status'] == 'MŰKÖDIK':
            cat_stats[cid]['ok'] += 1
        else:
            cat_stats[cid]['err'] += 1

    r_idx = 2
    for cat_name, stats in cat_stats.items():
        pct = round(stats['ok'] / stats['total'] * 100, 1) if stats['total'] > 0 else 0
        ws_sum.append([
            cat_name,
            stats['total'],
            stats['ok'],
            stats['err'],
            f"{pct}%"
        ])
        ws_sum.cell(row=r_idx, column=1).font = bold_font
        ws_sum.cell(row=r_idx, column=2).alignment = Alignment(horizontal='center')
        ws_sum.cell(row=r_idx, column=3).alignment = Alignment(horizontal='center')
        ws_sum.cell(row=r_idx, column=3).font = ok_font
        ws_sum.cell(row=r_idx, column=4).alignment = Alignment(horizontal='center')
        if stats['err'] > 0:
            ws_sum.cell(row=r_idx, column=4).font = err_font
        ws_sum.cell(row=r_idx, column=5).alignment = Alignment(horizontal='center')
        ws_sum.cell(row=r_idx, column=5).font = bold_font
        for col_idx in range(1, 6):
            ws_sum.cell(row=r_idx, column=col_idx).border = border_thin
        ws_sum.row_dimensions[r_idx].height = 22
        r_idx += 1

    # Total row
    total_pct = round(working_count / len(results) * 100, 1)
    ws_sum.append(["ÖSSZESEN", len(results), working_count, error_count, f"{total_pct}%"])
    tot_row = r_idx
    for col_idx in range(1, 6):
        c = ws_sum.cell(row=tot_row, column=col_idx)
        c.font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
        c.fill = sub_fill
        c.border = border_thin
        if col_idx > 1:
            c.alignment = Alignment(horizontal='center', vertical='center')

    for col in ws_sum.columns:
        col_letter = get_column_letter(col[0].column)
        ws_sum.column_dimensions[col_letter].width = 24

    wb.save(xlsx_path)
    print(f"Saved Excel: {xlsx_path}")

    # 3. Export Markdown summary
    md_path = os.path.join(root_dir, 'scripts', 'live_tv_streams_audit.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write("# Magyar Live TV M3U8 Stream Audit Jelentés\n\n")
        f.write(f"- **Vizsgált források száma**: {len(results)}\n")
        f.write(f"- **Működő M3U8 streamek**: **{working_count}** ({total_pct}%)\n")
        f.write(f"- **Hibás / Lejárt streamek**: **{error_count}**\n\n")
        f.write("## Kategóriánkénti Összesítő\n\n")
        f.write("| Kategória | Összes Forrás | Működik (OK) | Hibás | Sikerességi Arány |\n")
        f.write("| :--- | :---: | :---: | :---: | :---: |\n")
        for cat_name, stats in cat_stats.items():
            pct = round(stats['ok'] / stats['total'] * 100, 1) if stats['total'] > 0 else 0
            f.write(f"| {cat_name} | {stats['total']} | **{stats['ok']}** | {stats['err']} | **{pct}%** |\n")
        f.write(f"| **ÖSSZESEN** | **{len(results)}** | **{working_count}** | **{error_count}** | **{total_pct}%** |\n\n")

    print(f"Saved Markdown summary: {md_path}")

if __name__ == '__main__':
    main()
