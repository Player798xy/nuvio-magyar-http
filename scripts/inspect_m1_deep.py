import cv2
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

cmd = ['node', '-e', 'console.log(JSON.stringify(require("./src/scrapers/onlinestream.js").ALL_CHANNELS.find(c=>c.channelId==="5901")) )']
ch = json.loads(subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8').stdout)

print(f"M1 channel config has {len(ch['streams'])} streams:")

# Also check MTVA direct resolve
from audit_live_streams import resolve_mtva_url
mtva_live_url = resolve_mtva_url('m1')
print(f"\n[MTVA MediaKlikk Official] resolved URL: {mtva_live_url}")
if mtva_live_url:
    try:
        req = urllib.request.Request(mtva_live_url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://mediaklikk.hu/'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
        print(f"MTVA index.m3u8 content:\n{content[:600]}")
    except Exception as e:
        print(f"Error fetching MTVA index: {e}")

for i, s in enumerate(ch['streams']):
    url = s.get('url')
    host = s.get('host')
    feat = s.get('features')
    print(f"\n[{i}] host: {host} (features: {feat})")
    print(f"    URL: {url}")
    if not url:
        print("    No URL")
        continue

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://onlinestream.live/'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            text = resp.read().decode('utf-8', errors='ignore')

        lines = [l.strip() for l in text.splitlines() if l.strip()]
        # Check master vs media
        is_master = any(l.startswith('#EXT-X-STREAM-INF:') for l in lines)
        print(f"    Is master: {is_master}, lines count: {len(lines)}")

        if is_master:
            for l in lines:
                if l.startswith('#EXT-X-STREAM-INF:'):
                    print(f"      INF: {l}")
            sub_url = [urllib.parse.urljoin(url, l) for l in lines if not l.startswith('#')][-1]
            print(f"    Selected sub: {sub_url}")
            req_sub = urllib.request.Request(sub_url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://onlinestream.live/'})
            with urllib.request.urlopen(req_sub, timeout=5) as r2:
                sub_text = r2.read().decode('utf-8', errors='ignore')
            lines = [l.strip() for l in sub_text.splitlines() if l.strip()]

        seg_lines = [urllib.parse.urljoin(url if not is_master else sub_url, l) for l in lines if not l.startswith('#')]
        if not seg_lines:
            print("    No segments found!")
            continue

        seg_url = seg_lines[-1]
        print(f"    Fetching seg: {seg_url}")
        req_seg = urllib.request.Request(seg_url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://onlinestream.live/'})
        with urllib.request.urlopen(req_seg, timeout=6) as r3:
            data = r3.read(800000)

        tmp = f"temp_m1_test_{i}.ts"
        with open(tmp, 'wb') as f:
            f.write(data)

        cap = cv2.VideoCapture(tmp)
        ret, frame = cap.read()
        if ret:
            h, w = frame.shape[:2]
            print(f"    ===> DECODED REAL RESOLUTION: {w}x{h} ({h}p)!")
        else:
            print(f"    ===> Could not decode frame from TS chunk (size: {len(data)})")
        cap.release()
        if os.path.exists(tmp): os.remove(tmp)

    except Exception as e:
        print(f"    ===> ERROR: {e}")
