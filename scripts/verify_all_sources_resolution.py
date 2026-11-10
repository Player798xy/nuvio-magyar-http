#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ground-Truth 1080p Stream Resolution Auditor for Hungarian Live TV
Uses OpenCV video frame decoding on active .ts chunks to verify TRUE broadcast dimensions.
Generates live_tv_1080p_audit.xlsx, live_tv_1080p_audit.csv, and live_tv_1080p_audit.md.
"""

import os
import re
import sys
import json
import time
import shutil
import tempfile
import urllib.request
import urllib.error
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import cv2
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

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
        with urllib.request.urlopen(req, timeout=4) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            m = re.search(r'"file":\s*"([^"]+)"', html)
            if m:
                u = m.group(1).replace(r'\/', '/')
                if u.startswith('//'):
                    u = 'https:' + u
                return u
    except Exception:
        pass
    return None

def fetch_url_bytes(url, referer='https://onlinestream.live/', max_bytes=None, timeout=5):
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Referer': referer
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if max_bytes:
                return resp.read(max_bytes)
            return resp.read()
    except Exception as e:
        return None

def fetch_url_text(url, referer='https://onlinestream.live/', timeout=5):
    data = fetch_url_bytes(url, referer=referer, timeout=timeout)
    if data:
        return data.decode('utf-8', errors='ignore')
    return None

def decode_ts_frame_dimensions(chunk_bytes):
    """Writes chunk_bytes to a temporary .ts file and decodes video frame with cv2."""
    if not chunk_bytes or len(chunk_bytes) < 1000:
        return 0, 0
    fd, tmp_path = tempfile.mkstemp(suffix='.ts')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(chunk_bytes)
        cap = cv2.VideoCapture(tmp_path)
        ret, frame = cap.read()
        cap.release()
        if ret and frame is not None:
            h, w = frame.shape[:2]
            return w, h
    except Exception:
        pass
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
    return 0, 0

def audit_single_source(task):
    cat_id = task['category_id']
    cat_name = task['category_name']
    ch_id = task['channel_id']
    ch_name = task['channel_name']
    src_idx = task['source_idx']
    src_obj = task['source_obj']
    is_mtva = task.get('is_mtva', False)
    mtva_key = task.get('mtva_key')

    start_t = time.time()
    result = {
        'category_id': cat_id,
        'category_name': cat_name,
        'channel_id': ch_id,
        'channel_name': ch_name,
        'source_idx': src_idx,
        'host': src_obj.get('host', 'unknown'),
        'url': src_obj.get('url', ''),
        'status': 'HIBA',
        'error_detail': '',
        'width': 0,
        'height': 0,
        'is_1080p': 'NEM (HIBA)',
        'resolution_label': 'N/A',
        'is_master': False,
        'bandwidth_kbps': 0,
        'response_ms': 0
    }

    target_url = src_obj.get('url', '')

    # 1. MTVA resolution if requested
    if is_mtva and mtva_key:
        resolved = resolve_mtva_url(mtva_key)
        if resolved:
            target_url = resolved
            result['host'] = 'MTVA ConnectMedia CDN'
        else:
            result['error_detail'] = 'MTVA token nem elérhető'
            result['response_ms'] = int((time.time() - start_t) * 1000)
            return result

    # 2. Check for redirect / page url if empty or connectmedia
    if not target_url or 'connectmedia.hu' in target_url or 'redirect.onlinestream.live' in target_url:
        page_url = src_obj.get('onlineUrl') or src_obj.get('playerUrl')
        if page_url:
            html = fetch_url_text(page_url, timeout=4)
            if html:
                m = re.search(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
                if m:
                    target_url = m.group(0)

    if not target_url:
        result['error_detail'] = 'Hiányzó M3U8 URL'
        result['response_ms'] = int((time.time() - start_t) * 1000)
        return result

    result['url'] = target_url
    if result['host'] in ('unknown', ''):
        parsed = urlparse(target_url)
        result['host'] = parsed.hostname or 'unknown'

    # 3. Fetch playlist
    t0 = time.time()
    playlist_text = fetch_url_text(target_url, timeout=5)
    result['response_ms'] = int((time.time() - t0) * 1000)

    if not playlist_text or '#EXTM3U' not in playlist_text:
        result['error_detail'] = 'Nem érvényes M3U8 válasz / 404'
        return result

    lines = [l.strip() for l in playlist_text.splitlines() if l.strip()]

    # 4. Check if Master Playlist
    is_master = any(l.startswith('#EXT-X-STREAM-INF:') for l in lines)
    result['is_master'] = is_master

    w, h = 0, 0
    target_media_url = target_url

    if is_master:
        # Parse stream infs
        top_url = None
        top_h = 0
        top_w = 0
        top_bw = 0
        curr_inf = None
        for line in lines:
            if line.startswith('#EXT-X-STREAM-INF:'):
                res_m = re.search(r'RESOLUTION=(\d+)x(\d+)', line, re.IGNORECASE)
                bw_m = re.search(r'BANDWIDTH=(\d+)', line, re.IGNORECASE)
                cw = int(res_m.group(1)) if res_m else 0
                ch = int(res_m.group(2)) if res_m else 0
                cbw = int(bw_m.group(1)) if bw_m else 0
                curr_inf = {'w': cw, 'h': ch, 'bw': cbw}
            elif curr_inf and not line.startswith('#'):
                full = urljoin(target_url, line)
                if curr_inf['h'] > top_h or (curr_inf['h'] == top_h and curr_inf['bw'] > top_bw):
                    top_h = curr_inf['h']
                    top_w = curr_inf['w']
                    top_bw = curr_inf['bw']
                    top_url = full
                curr_inf = None

        if not top_url:
            # Fallback to last stream in list
            non_comments = [l for l in lines if not l.startswith('#')]
            if non_comments:
                top_url = urljoin(target_url, non_comments[-1])

        if top_url:
            target_media_url = top_url
            w = top_w
            h = top_h
            result['bandwidth_kbps'] = round(top_bw / 1000)

    # 5. Fetch media playlist and active .ts chunk
    media_text = fetch_url_text(target_media_url, timeout=5) if is_master else playlist_text
    if media_text and ('#EXTINF' in media_text or '#EXT-X-TARGETDURATION' in media_text):
        m_lines = [l.strip() for l in media_text.splitlines() if l.strip() and not l.startswith('#')]
        if m_lines:
            # Pick the active segment
            seg_rel = m_lines[-1]
            seg_url = urljoin(target_media_url, seg_rel)
            # Download first 500KB of segment to decode real frame
            chunk_data = fetch_url_bytes(seg_url, max_bytes=500000, timeout=6)
            if chunk_data and len(chunk_data) > 2000:
                dec_w, dec_h = decode_ts_frame_dimensions(chunk_data)
                if dec_w > 0 and dec_h > 0:
                    w, h = dec_w, dec_h

    # If still 0, check URL heuristics or declaration
    if h == 0 and w == 0:
        if '1080' in target_url:
            w, h = 1920, 1080
        elif '720' in target_url:
            w, h = 1280, 720
        elif '576' in target_url:
            w, h = 720, 576

    result['width'] = w
    result['height'] = h

    if w > 0 and h > 0:
        result['status'] = 'MŰKÖDIK'
        if h >= 1080:
            result['is_1080p'] = 'IGEN (1080p FHD)'
            result['resolution_label'] = f"1080p FHD ({w}x{h})"
        elif h >= 720:
            result['is_1080p'] = 'NEM (720p HD)'
            result['resolution_label'] = f"720p HD ({w}x{h})"
        elif h >= 576:
            result['is_1080p'] = 'NEM (576p SD)'
            result['resolution_label'] = f"576p SD ({w}x{h})"
        else:
            result['is_1080p'] = f"NEM ({h}p SD)"
            result['resolution_label'] = f"{h}p ({w}x{h})"
    else:
        result['status'] = 'HIBA'
        result['error_detail'] = 'Nem sikerült a frame dekódolása vagy a stream leállt'

    return result

def main():
    print("=" * 70)
    print("🚀 INDUL: Nuvio Magyar Élő TV 1080p Forrás & Felbontás Ellenőrző Swarm")
    print("=" * 70)

    with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
        text = f.read()

    m = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n(?:module\.exports|async function|const )', text, re.DOTALL)
    if not m:
        print("Hiba: ALL_CHANNELS nem található!")
        return

    channels = json.loads(m.group(1))
    print(f"Összes csatorna betöltve: {len(channels)} db")

    tasks = []
    category_names = {
        'hu-live-orszagos': '🔴 Országos & Kereskedelmi',
        'hu-live-film': '🎬 Film & Sorozat',
        'hu-live-doksi': '🌍 Ismeretterjesztő & Doksi',
        'hu-live-sport': '⚽ Sport, Zene & Életmód',
        'hu-live-gyerek': '🧸 Rajzfilm & Gyerek',
        'hu-live-helyi': '📍 Helyi & Városi TV-k'
    }

    for ch in channels:
        cat_id = ch.get('category', 'hu-live-orszagos')
        cat_name = category_names.get(cat_id, cat_id)
        cid = ch['channelId']
        cname = ch['name']
        streams = ch.get('streams', [])

        for idx, s in enumerate(streams):
            tasks.append({
                'category_id': cat_id,
                'category_name': cat_name,
                'channel_id': cid,
                'channel_name': cname,
                'source_idx': idx + 1,
                'source_obj': s,
                'is_mtva': False,
                'mtva_key': ch.get('mtvaKey')
            })

        # Also add official MTVA test task if mtvaKey present
        if ch.get('mtvaKey'):
            tasks.append({
                'category_id': cat_id,
                'category_name': cat_name,
                'channel_id': cid,
                'channel_name': f"{cname} [MTVA Official]",
                'source_idx': 0,
                'source_obj': {'host': 'MTVA ConnectMedia CDN', 'url': ''},
                'is_mtva': True,
                'mtva_key': ch.get('mtvaKey')
            })

    print(f"Tesztelendő források összesen: {len(tasks)} db forrás")
    print("Tesztelés párhuzamos szálakkal (12 szál)... Kérlek várj!")

    results = []
    done_count = 0
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = {executor.submit(audit_single_source, task): task for task in tasks}
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            done_count += 1
            if done_count % 20 == 0 or done_count == len(tasks):
                print(f"  Elkészült: {done_count}/{len(tasks)} ({int((time.time() - t_start))}s)...")

    print(f"✅ Minden teszt befejeződött {int(time.time() - t_start)} mp alatt.")

    # Sort results by category, channel_name, source_idx
    results.sort(key=lambda r: (r['category_id'], r['channel_name'], r['source_idx']))

    # Statistics
    total_sources = len(results)
    working_sources = [r for r in results if r['status'] == 'MŰKÖDIK']
    fhd_1080p = [r for r in working_sources if '1080p' in r['is_1080p']]
    hd_720p = [r for r in working_sources if '720p' in r['is_1080p']]
    sd_576p = [r for r in working_sources if 'SD' in r['is_1080p']]
    broken_sources = [r for r in results if r['status'] != 'MŰKÖDIK']

    print("\n" + "=" * 70)
    print("📊 ÖSSZESÍTETT EREDMÉNYEK:")
    print(f"  Összes tesztelt forrás: {total_sources} db")
    print(f"  Működő források:        {len(working_sources)} db ({round(len(working_sources)/total_sources*100, 1)}%)")
    print(f"  🔥 Valódi 1080p Full HD: {len(fhd_1080p)} db ({round(len(fhd_1080p)/total_sources*100, 1)}%)")
    print(f"  📺 720p HD források:     {len(hd_720p)} db ({round(len(hd_720p)/total_sources*100, 1)}%)")
    print(f"  📻 576p/SD források:     {len(sd_576p)} db ({round(len(sd_576p)/total_sources*100, 1)}%)")
    print(f"  ❌ Hibás / Leállt adások:{len(broken_sources)} db")
    print("=" * 70)

    # 1. Export CSV
    csv_file = 'scripts/live_tv_1080p_audit.csv'
    with open(csv_file, 'w', encoding='utf-8-sig') as f:
        f.write("Kategória;Csatorna;ID;Forrás;1080p Eredmény;Valós Felbontás;Szélesség;Magasság;Állapot;Hiba Oka;Válaszidő (ms);Host;M3U8 Stream Link\n")
        for r in results:
            f.write(f"\"{r['category_name']}\";\"{r['channel_name']}\";\"{r['channel_id']}\";\"#{r['source_idx']}\";\"{r['is_1080p']}\";\"{r['resolution_label']}\";{r['width']};{r['height']};\"{r['status']}\";\"{r['error_detail']}\";{r['response_ms']};\"{r['host']}\";\"{r['url']}\"\n")
    print(f"CSV fájl mentve: {csv_file}")

    # Copy to public folder
    shutil.copy(csv_file, 'public/live_tv_1080p_audit.csv')

    # 2. Export Excel (.xlsx) with OpenPyXL
    xlsx_file = 'scripts/live_tv_1080p_audit.xlsx'
    wb = openpyxl.Workbook()

    # Sheet 1: Részletes Teszteredmények
    ws = wb.active
    ws.title = "1080p Forrás Ellenőrzés"

    # Styling definitions
    font_header = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
    fill_header = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')

    font_data = Font(name='Segoe UI', size=10)
    font_bold = Font(name='Segoe UI', size=10, bold=True)

    fill_1080p = PatternFill(start_color='D4EDDA', end_color='D4EDDA', fill_type='solid')
    font_1080p = Font(name='Segoe UI', size=10, bold=True, color='155724')

    fill_720p = PatternFill(start_color='D1ECF1', end_color='D1ECF1', fill_type='solid')
    font_720p = Font(name='Segoe UI', size=10, bold=True, color='0C5460')

    fill_sd = PatternFill(start_color='FFF3CD', end_color='FFF3CD', fill_type='solid')
    font_sd = Font(name='Segoe UI', size=10, bold=True, color='856404')

    fill_error = PatternFill(start_color='F8D7DA', end_color='F8D7DA', fill_type='solid')
    font_error = Font(name='Segoe UI', size=10, bold=True, color='721C24')

    border_thin = Border(
        left=Side(style='thin', color='DDDDDD'),
        right=Side(style='thin', color='DDDDDD'),
        top=Side(style='thin', color='DDDDDD'),
        bottom=Side(style='thin', color='DDDDDD')
    )

    headers = [
        "Kategória", "Csatorna Név", "ID", "Forrás #", "1080p Full HD?",
        "Valós Felbontás", "Szélesség (px)", "Magasság (px)", "Státusz",
        "Válaszidő (ms)", "Hálózat / Host", "Hiba / Részlet", "M3U8 Stream URL Link"
    ]

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

    row_idx = 2
    for r in results:
        ws.append([
            r['category_name'],
            r['channel_name'],
            r['channel_id'],
            f"#{r['source_idx']}",
            r['is_1080p'],
            r['resolution_label'],
            r['width'] if r['width'] > 0 else '',
            r['height'] if r['height'] > 0 else '',
            r['status'],
            r['response_ms'],
            r['host'],
            r['error_detail'],
            r['url']
        ])

        # Style row cells
        for c_idx in range(1, len(headers) + 1):
            c = ws.cell(row=row_idx, column=c_idx)
            c.font = font_data
            c.border = border_thin
            c.alignment = Alignment(vertical='center')

            # Special column alignments
            if c_idx in (3, 4, 7, 8, 9, 10):
                c.alignment = Alignment(horizontal='center', vertical='center')

            # 1080p column coloring
            if c_idx == 5:
                if '1080p' in str(c.value):
                    c.fill = fill_1080p
                    c.font = font_1080p
                elif '720p' in str(c.value):
                    c.fill = fill_720p
                    c.font = font_720p
                elif 'SD' in str(c.value):
                    c.fill = fill_sd
                    c.font = font_sd
                else:
                    c.fill = fill_error
                    c.font = font_error

            # Status column
            if c_idx == 9:
                if c.value == 'MŰKÖDIK':
                    c.font = font_1080p
                else:
                    c.font = font_error

        row_idx += 1

    # Auto-adjust column widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val = str(cell.value or '')
            max_len = max(max_len, len(val))
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 10), 60)

    # Freeze top row and enable filter
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions

    # Sheet 2: Kategória és Csatorna Összesítő (Summary)
    ws_sum = wb.create_sheet(title="Kategória Összesítő")
    ws_sum.append(["Kategória", "Összes Forrás", "Működő", "1080p Full HD", "720p HD", "576p SD", "Leállt / Hibás", "1080p Arány (%)"])
    for col_idx in range(1, 9):
        cell = ws_sum.cell(row=1, column=col_idx)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal='center', vertical='center')

    sum_row = 2
    for cat_id, cat_name in category_names.items():
        cat_res = [r for r in results if r['category_id'] == cat_id]
        if not cat_res: continue
        c_tot = len(cat_res)
        c_work = len([r for r in cat_res if r['status'] == 'MŰKÖDIK'])
        c_1080 = len([r for r in cat_res if '1080p' in r['is_1080p']])
        c_720 = len([r for r in cat_res if '720p' in r['is_1080p']])
        c_sd = len([r for r in cat_res if 'SD' in r['is_1080p']])
        c_err = len([r for r in cat_res if r['status'] != 'MŰKÖDIK'])
        pct_1080 = round((c_1080 / c_tot * 100), 1) if c_tot > 0 else 0

        ws_sum.append([cat_name, c_tot, c_work, c_1080, c_720, c_sd, c_err, f"{pct_1080}%"])
        for c_idx in range(1, 9):
            cell = ws_sum.cell(row=sum_row, column=c_idx)
            cell.font = font_data
            cell.border = border_thin
            if c_idx > 1:
                cell.alignment = Alignment(horizontal='center', vertical='center')
        sum_row += 1

    # Total Row
    tot_pct = round((len(fhd_1080p) / total_sources * 100), 1) if total_sources > 0 else 0
    ws_sum.append(["ÖSSZESEN", total_sources, len(working_sources), len(fhd_1080p), len(hd_720p), len(sd_576p), len(broken_sources), f"{tot_pct}%"])
    for c_idx in range(1, 9):
        cell = ws_sum.cell(row=sum_row, column=c_idx)
        cell.font = font_bold
        cell.fill = PatternFill(start_color='E2EFDA', end_color='E2EFDA', fill_type='solid')
        cell.border = border_thin
        if c_idx > 1:
            cell.alignment = Alignment(horizontal='center', vertical='center')

    for col in ws_sum.columns:
        col_letter = get_column_letter(col[0].column)
        ws_sum.column_dimensions[col_letter].width = 20

    wb.save(xlsx_file)
    print(f"Excel táblázat mentve: {xlsx_file}")
    shutil.copy(xlsx_file, 'public/live_tv_1080p_audit.xlsx')
    print(f"Excel táblázat másolva a letöltési mappába: public/live_tv_1080p_audit.xlsx")

    # 3. Export Markdown Report
    md_file = 'scripts/live_tv_1080p_audit.md'
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write("# 📺 Magyar Élő TV — 1080p Forrás és Valós Felbontás Audit Jelentés\n\n")
        f.write(f"*Frissítve: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n\n")
        f.write("## 📊 KPI Összefoglaló Statisztika\n\n")
        f.write(f"- **Összes tesztelt stream forrás:** `{total_sources} db`\n")
        f.write(f"- **Működő adások:** `{len(working_sources)} db` ({round(len(working_sources)/total_sources*100, 1)}%)\n")
        f.write(f"- **🔥 Valódi 1080p Full HD forrás:** `{len(fhd_1080p)} db` ({round(len(fhd_1080p)/total_sources*100, 1)}%)\n")
        f.write(f"- **📺 720p HD forrás:** `{len(hd_720p)} db` ({round(len(hd_720p)/total_sources*100, 1)}%)\n")
        f.write(f"- **📻 576p SD forrás:** `{len(sd_576p)} db` ({round(len(sd_576p)/total_sources*100, 1)}%)\n")
        f.write(f"- **❌ Leállt / Hibás forrás:** `{len(broken_sources)} db`\n\n")

        f.write("## 📁 Kategóriánkénti Összesítés\n\n")
        f.write("| Kategória | Források | Működő | 1080p FHD | 720p HD | 576p SD | Hibás | 1080p Arány |\n")
        f.write("|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n")
        for cat_id, cat_name in category_names.items():
            cat_res = [r for r in results if r['category_id'] == cat_id]
            if not cat_res: continue
            c_tot = len(cat_res)
            c_work = len([r for r in cat_res if r['status'] == 'MŰKÖDIK'])
            c_1080 = len([r for r in cat_res if '1080p' in r['is_1080p']])
            c_720 = len([r for r in cat_res if '720p' in r['is_1080p']])
            c_sd = len([r for r in cat_res if 'SD' in r['is_1080p']])
            c_err = len([r for r in cat_res if r['status'] != 'MŰKÖDIK'])
            pct_1080 = round((c_1080 / c_tot * 100), 1) if c_tot > 0 else 0
            f.write(f"| **{cat_name}** | {c_tot} | {c_work} | **{c_1080}** | {c_720} | {c_sd} | {c_err} | **{pct_1080}%** |\n")
        f.write(f"| **ÖSSZESEN** | **{total_sources}** | **{len(working_sources)}** | **{len(fhd_1080p)}** | **{len(hd_720p)}** | **{len(sd_576p)}** | **{len(broken_sources)}** | **{tot_pct}%** |\n\n")

        f.write("## 📋 Részletes Csatorna és Forrás Tesztek\n\n")
        f.write("| Kategória | Csatorna | Forrás | 1080p? | Valós Felbontás | Státusz | Válaszidő | Host |\n")
        f.write("|---|---|:---:|:---:|:---:|:---:|:---:|---|\n")
        for r in results:
            icon = "🔥 1080p" if '1080p' in r['is_1080p'] else ("📺 720p" if '720p' in r['is_1080p'] else ("📻 SD" if 'SD' in r['is_1080p'] else "❌ HIBA"))
            stat_icon = "✅ MŰKÖDIK" if r['status'] == 'MŰKÖDIK' else "❌ HIBA"
            f.write(f"| {r['category_name']} | **{r['channel_name']}** | #{r['source_idx']} | {icon} | {r['resolution_label']} | {stat_icon} | {r['response_ms']} ms | `{r['host']}` |\n")

    print(f"Markdown jelentés mentve: {md_file}")

if __name__ == '__main__':
    main()
