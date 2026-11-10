import json
import re
import csv

# 1. Load audit results to get verified channel resolutions
with open('scripts/live_tv_1080p_audit.csv', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')
    rows = list(reader)

ch_res_map = {}
for r in rows:
    cid = r['ID']
    if r['Állapot'] == 'MŰKÖDIK':
        h = int(r['Magasság'])
        if cid not in ch_res_map or h > ch_res_map[cid]['h']:
            ch_res_map[cid] = {'h': h, 'label': r['1080p Eredmény'], 'real': r['Valós Felbontás']}

# Also add Hír TV as 1080p
ch_res_map['4740'] = {'h': 1080, 'label': 'IGEN (1080p FHD)', 'real': '1080p FHD (1440x1080)'}

print(f"Loaded verified resolutions for {len(ch_res_map)} channels")

# 2. Load onlinestream.js
with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n(?:module\.exports|async function|const )', content, re.DOTALL)
if not m:
    print("Error: ALL_CHANNELS not found!")
    exit(1)

channels = json.loads(m.group(1))

# Prune dead streams and update channel metadata
for ch in channels:
    cid = ch['channelId']
    name = ch['name']

    # Update releaseInfo and year based on ground-truth
    if cid in ch_res_map:
        h = ch_res_map[cid]['h']
        if h >= 1080:
            ch['year'] = 'ÉLŐ • 1080p FHD'
            ch['releaseInfo'] = 'ÉLŐ • 1080p FHD'
        elif h >= 720:
            ch['year'] = 'ÉLŐ • 720p HD'
            ch['releaseInfo'] = 'ÉLŐ • 720p HD'
        elif h >= 480:
            ch['year'] = 'ÉLŐ • SD'
            ch['releaseInfo'] = 'ÉLŐ • SD'
        else:
            ch['year'] = 'ÉLŐ • TV'
            ch['releaseInfo'] = 'ÉLŐ • TV'

    # Filter streams
    new_streams = []
    streams = ch.get('streams', [])

    # Hír TV special case
    if cid == '4740':
        new_streams = [
            {
                "sub_idx": 1,
                "url": "https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8",
                "host": "videa.hu",
                "features": "1440x1080 1080p Full HD",
                "playerUrl": "https://videa.hu/player?v=CDzWNlyZ6ji2UTDc",
                "onlineUrl": "https://hirtv.hu/"
            }
        ]
        ch['streams'] = new_streams
        continue

    for s in streams:
        u = (s.get('url') or '').strip()
        host = (s.get('host') or '').strip()

        # Drop empty URLs
        if not u:
            continue

        # Drop dead connectmedia URLs
        if 'connectmedia.hu' in u:
            continue

        # Drop dead cdn.mediaklikk.org URLs
        if 'cdn.mediaklikk.org' in u:
            continue

        # Drop other dead local stream URLs
        if 'stream.vasarhelyitelevizio.hu' in u or 'eurobioinvest.hu' in u:
            continue

        new_streams.append(s)

    # Re-index sub_idx
    for idx, s in enumerate(new_streams):
        s['sub_idx'] = idx + 1

    ch['streams'] = new_streams

print(f"Channels processed. Total: {len(channels)}")

# Format JSON
channels_json = json.dumps(channels, indent=2, ensure_ascii=False)
replacement = f"const ALL_CHANNELS = {channels_json};\n"

# Replace ALL_CHANNELS block in onlinestream.js
all_ch_idx = content.find('const ALL_CHANNELS = [')
end_idx = content.find('\nasync function', all_ch_idx)
if end_idx == -1:
    end_idx = content.find('\nmodule.exports', all_ch_idx)

new_content = content[:all_ch_idx] + replacement + content[end_idx:]

with open('src/scrapers/onlinestream.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("src/scrapers/onlinestream.js successfully updated with cleaned ALL_CHANNELS!")
