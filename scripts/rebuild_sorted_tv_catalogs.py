#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import re
import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load audit results
with open('scripts/live_tv_streams_audit.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    working_rows = [r for r in reader if r['Állapot'] == 'MŰKÖDIK']

working_by_channel = {}
for r in working_rows:
    working_by_channel.setdefault(r['Csatorna'], []).append(r)

# 2. Load existing ALL_CHANNELS from onlinestream.js
with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    code = f.read()

m_chans = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n\s*const CHANNELS_BY_ID', code, re.DOTALL)
channels = json.loads(m_chans.group(1))

channel_map = {ch['channelId']: ch for ch in channels}
channel_name_map = {ch['name']: ch for ch in channels}

# Define the exact new curated, sorted lists for each category

# 🔴 ORSZÁGOS & KERESKEDELMI (25 csatorna - legnépszerűbb országos és közszolgálati adók)
ORSZAGOS_SORTED = [
    '6141', # RTL
    '6143', # TV2
    '5901', # M1 (mtva: m1)
    '5905', # Duna (mtva: duna)
    '6723', # Super TV2
    '6142', # RTL Kettő
    '6147', # RTL Három
    '5911', # Viasat 3
    '4739', # ATV
    '4740', # Hír TV (Videa 1080p)
    '6704', # Prime
    '6184', # TV4
    '6236', # Viasat 6
    '6148', # RTL Gold
    '5902', # M2 / Petőfi TV (mtva: m2)
    '5906', # Duna World / M4 Sport+ (mtva: dunaworld)
    '5904', # M5 (mtva: m5)
    '8716', # Viasat 2
    '5855', # Euronews
    '4695', # Pannon RTV
    '9073', # RTV-1 Vajdaság
    '8999', # RTV-2 Vajdaság
    '1819', # Budapest Európa Televízió
    '5927', # Apostol TV
    '4798'  # EWTN
]

# 🎬 FILM & SOROZAT (21 csatorna - 100% működő prémium mozis és sorozat adók)
FILM_SORTED = [
    '6150', # Film+
    '6149', # Mozi+
    '6144', # Cool TV
    '6750', # AMC
    '6705', # Moziverzum
    '6746', # HBO
    '6747', # HBO2
    '6748', # HBO3
    '6703', # Film4
    '7060', # TV2 Comedy
    '6146', # Sorozat+
    '6752', # Film Café
    '6753', # AXN Black
    '6702', # Galaxy 4
    '6701', # Max4
    '6706', # Izaura TV
    '7061', # Jocky TV
    '6154', # Magyar Mozi TV
    '6151', # Moziklub
    '6152', # Sorozatklub
    '6710'  # Classics TV Magyarország
]

# 🌍 ISMERETTERJESZTŐ & DOKSI (6 csatorna - 100% működő természet, tudomány, doksi)
DOKSI_SORTED = [
    '5936', # National Geographic
    '5937', # National Geographic Wild
    '6749', # Spektrum
    '7325', # History
    '6589', # Spektrum Home
    '8124'  # Ozone TV
]

# ⚽ SPORT, ZENE & ÉLETMÓD (17 csatorna - Sportok elöl, Gasztro/Életmód középen, Zene hátul)
SPORT_SORTED = [
    '5903', # M4 Sport (mtva: m4)
    '7063', # Spíler 1
    '7064', # Spíler 2
    '6744', # Sport 1
    '6745', # Sport 2
    '6708', # Arena4
    '6709', # Match 4
    '6711', # Lóverseny közvetítés (Kincsem Park)
    '6754', # TV Paprika
    '7087', # TV2 Séf
    '6751', # TLC (merged with 9787)
    '7062', # Life TV
    '7088', # FEM3
    '6153', # RTL Otthon
    '5928', # Sláger TV
    '6145', # Muzsika TV
    '6724'  # Zenebutik
]

# 🧸 RAJZFILM & GYEREK (7 csatorna - 100% működő mesecsatornák)
GYEREK_SORTED = [
    '7079', # Minimax
    '5939', # Nickelodeon
    '5940', # Nick Jr
    '7080', # Nicktoons
    '6707', # TV2 Kids
    '7081', # JimJam
    '6155'  # Kölyökklub
]

# 📍 HELYI & VÁROSI TV-K (36 csatorna - 100% működő helyi televíziók nagyvárosoktól a térségi adókig)
HELYI_SORTED = [
    '4247', # Debrecen Televízió -> Debrecen TV
    '5982', # Sopron TV
    '5983', # Fehérvár TV
    '5984', # Nyíregyházi Televízió -> Nyíregyházi TV
    '5985', # Kecskeméti Televízió -> Kecskeméti TV
    '5987', # Szolnok TV
    '5989', # TV Eger
    '5988', # Kapos TV
    '5986', # Zalaegerszegi Televízió -> Zalaegerszegi TV
    '5992', # 7.tv (Békéscsaba)
    '5993', # Bajai TV
    '5991', # Gyöngyösi TV
    '5994', # Kanizsa TV
    '5995', # TV Keszthely
    '6010', # Vásárhelyi Televízió -> Vásárhelyi TV
    '6011', # TelePaks
    '6012', # Balaton TV
    '6035', # Cegléd Városi TV -> Cegléd TV
    '5997', # Komáromi Televízió -> Komáromi TV
    '6002', # Ózdi Városi Televízió -> Ózdi TV
    '6034', # Gran TV - Esztergom
    '6030', # Bicskei Városi Televízió -> Bicskei TV
    '6031', # Hévízi TV
    '5998', # Móri Városi TV
    '6000', # Karcag TV
    '6001', # Halom TV
    '6013', # ESTV - A térség televíziója (Vác)
    '6020', # Alföld TV
    '6023', # Oroszlányi Városi Televízió -> Oroszlányi TV
    '6004', # XVTV (Budapest XV. kerület)
    '6008', # TV13 (Budapest XIII. kerület)
    '6038', # City TV (Budapest V. kerület)
    '6005', # Jászsági Térségi TV
    '6006', # Líceum TV
    '6026', # Móra-Net TV - A térség televíziója
    '6033'  # Sixo TV
]

NEW_CATEGORIES = [
    {
        "id": "hu-live-orszagos",
        "name": "🔴 Élő TV: Országos & Kereskedelmi",
        "type": "movie",
        "category": "tv",
        "description": "Fő országos kereskedelmi és közszolgálati televíziók nézettségi sorrendben: RTL, TV2, M1, Duna, Super TV2, ATV, stb.",
        "defaultEnabled": True,
        "count": len(ORSZAGOS_SORTED)
    },
    {
        "id": "hu-live-film",
        "name": "🎬 Élő TV: Film & Sorozat",
        "type": "movie",
        "category": "tv",
        "description": "Prémium mozifilmes és sorozatcsatornák népszerűségi sorrendben: Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1-3, stb.",
        "defaultEnabled": True,
        "count": len(FILM_SORTED)
    },
    {
        "id": "hu-live-doksi",
        "name": "🌍 Élő TV: Ismeretterjesztő & Doksi",
        "type": "movie",
        "category": "tv",
        "description": "Természetfilmek, történelem, tudomány és dokumentumfilmek népszerűségi sorrendben: Nat Geo, History, Spektrum, stb.",
        "defaultEnabled": True,
        "count": len(DOKSI_SORTED)
    },
    {
        "id": "hu-live-sport",
        "name": "⚽ Élő TV: Sport, Zene & Életmód",
        "type": "movie",
        "category": "tv",
        "description": "Élő sportközvetítések, életmód és zenei csatornák népszerűségi sorrendben: M4 Sport, Spíler 1-2, Sport 1-2, Arena4, TV Paprika, Sláger TV, stb.",
        "defaultEnabled": True,
        "count": len(SPORT_SORTED)
    },
    {
        "id": "hu-live-gyerek",
        "name": "🧸 Élő TV: Rajzfilm & Gyerek",
        "type": "movie",
        "category": "tv",
        "description": "Rajzfilmek, animációk és ifjúsági műsorok népszerűségi sorrendben: Minimax, Nickelodeon, Disney Channel, stb.",
        "defaultEnabled": True,
        "count": len(GYEREK_SORTED)
    },
    {
        "id": "hu-live-helyi",
        "name": "📍 Élő TV: Helyi & Városi TV-k",
        "type": "movie",
        "category": "tv",
        "description": "Magyar városok és térségek működő helyi televíziói fontossági sorrendben: Debrecen, Sopron, Fehérvár, Nyíregyháza, stb.",
        "defaultEnabled": True,
        "count": len(HELYI_SORTED)
    }
]

# Assemble the new curated ALL_CHANNELS list
NEW_ALL_CHANNELS = []

def process_channel(cid, target_cat):
    ch = channel_map.get(cid)
    if not ch:
        print(f"Warning: channel {cid} not found!")
        return None
    
    ch_copy = dict(ch)
    ch_copy['category'] = target_cat

    # Special handling: TLC merge with TCL (9787)
    if cid == '6751':
        tcl_ch = channel_map.get('9787')
        if tcl_ch:
            existing_urls = set(s.get('url') for s in ch_copy.get('streams', []))
            for s in tcl_ch.get('streams', []):
                if s.get('url') and s.get('url') not in existing_urls:
                    ch_copy.setdefault('streams', []).append(s)

    # Clean duplicates in streams
    seen_urls = set()
    clean_streams = []
    for s in ch_copy.get('streams', []):
        u = s.get('url', '').strip()
        if u and u not in seen_urls:
            seen_urls.add(u)
            clean_streams.append(s)
        elif not u and s.get('playerUrl') and s.get('playerUrl') not in seen_urls:
            seen_urls.add(s.get('playerUrl'))
            clean_streams.append(s)
    ch_copy['streams'] = clean_streams

    # Nice name cleanup
    if ch_copy['name'] == 'Debrecen Televízió':
        ch_copy['name'] = 'Debrecen TV'
    elif ch_copy['name'] == 'HBO2':
        ch_copy['name'] = 'HBO 2'
    elif ch_copy['name'] == 'HBO3':
        ch_copy['name'] = 'HBO 3'
    elif ch_copy['name'] == 'Spíler 1':
        ch_copy['name'] = 'Spíler 1 TV'
    elif ch_copy['name'] == 'Spíler 2':
        ch_copy['name'] = 'Spíler 2 TV'
    elif ch_copy['name'] == 'Nyíregyházi Televízió':
        ch_copy['name'] = 'Nyíregyházi TV'
    elif ch_copy['name'] == 'Kecskeméti Televízió':
        ch_copy['name'] = 'Kecskeméti TV'
    elif ch_copy['name'] == 'Zalaegerszegi Televízió':
        ch_copy['name'] = 'Zalaegerszegi TV'
    elif ch_copy['name'] == 'Vásárhelyi Televízió':
        ch_copy['name'] = 'Vásárhelyi TV'
    elif ch_copy['name'] == 'Komáromi Televízió':
        ch_copy['name'] = 'Komáromi TV'
    elif ch_copy['name'] == 'Ózdi Városi Televízió':
        ch_copy['name'] = 'Ózdi TV'
    elif ch_copy['name'] == 'Cegléd Városi TV':
        ch_copy['name'] = 'Cegléd TV'
    elif ch_copy['name'] == 'Bicskei Városi Televízió':
        ch_copy['name'] = 'Bicskei TV'
    elif ch_copy['name'] == 'Oroszlányi Városi Televízió':
        ch_copy['name'] = 'Oroszlányi TV'

    return ch_copy

for cid in ORSZAGOS_SORTED:
    c = process_channel(cid, 'hu-live-orszagos')
    if c: NEW_ALL_CHANNELS.append(c)

for cid in FILM_SORTED:
    c = process_channel(cid, 'hu-live-film')
    if c: NEW_ALL_CHANNELS.append(c)

for cid in DOKSI_SORTED:
    c = process_channel(cid, 'hu-live-doksi')
    if c: NEW_ALL_CHANNELS.append(c)

for cid in SPORT_SORTED:
    c = process_channel(cid, 'hu-live-sport')
    if c: NEW_ALL_CHANNELS.append(c)

for cid in GYEREK_SORTED:
    c = process_channel(cid, 'hu-live-gyerek')
    if c: NEW_ALL_CHANNELS.append(c)

for cid in HELYI_SORTED:
    c = process_channel(cid, 'hu-live-helyi')
    if c: NEW_ALL_CHANNELS.append(c)

total_curated = len(NEW_ALL_CHANNELS)
print(f"Total curated, 100% working channels: {total_curated}")
for cat in NEW_CATEGORIES:
    count = sum(1 for ch in NEW_ALL_CHANNELS if ch['category'] == cat['id'])
    print(f"  {cat['name']}: {count} csatorna")

# 3. Patch onlinestream.js
cats_json = json.dumps(NEW_CATEGORIES, indent=2, ensure_ascii=False)
chans_json = json.dumps(NEW_ALL_CHANNELS, indent=2, ensure_ascii=False)

new_code = re.sub(
    r'const ONLINESTREAM_CATEGORIES = \[.*?\];\s*\n\s*const ALL_CHANNELS = \[.*?\];\s*\n\s*const CHANNELS_BY_ID',
    f'const ONLINESTREAM_CATEGORIES = {cats_json};\n\nconst ALL_CHANNELS = {chans_json};\n\nconst CHANNELS_BY_ID',
    code,
    flags=re.DOTALL
)

with open('src/scrapers/onlinestream.js', 'w', encoding='utf-8') as f:
    f.write(new_code)

print("Saved updated src/scrapers/onlinestream.js!")

# 4. Update public/index.html with the new exact channel counts
with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update channel count numbers in HTML
html = html.replace('146 magyar TV csatorna', f'{total_curated} magyar TV csatorna')
html = html.replace('146 adó', f'{total_curated} adó')
html = html.replace('Országos & Kereskedelmi (28 adó)', f'Országos & Kereskedelmi ({len(ORSZAGOS_SORTED)} adó)')
html = html.replace('Film & Sorozat (21 adó)', f'Film & Sorozat ({len(FILM_SORTED)} adó)')
html = html.replace('Ismeretterjesztő & Doksi (6 adó)', f'Ismeretterjesztő & Doksi ({len(DOKSI_SORTED)} adó)')
html = html.replace('Sport, Zene & Életmód (19 adó)', f'Sport, Zene & Életmód ({len(SPORT_SORTED)} adó)')
html = html.replace('Rajzfilm & Gyerek (8 adó)', f'Rajzfilm & Gyerek ({len(GYEREK_SORTED)} adó)')
html = html.replace('Helyi & Városi TV-k (64 adó)', f'Helyi & Városi TV-k ({len(HELYI_SORTED)} adó)')

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Saved updated public/index.html!")
