import json
import urllib.request
import os

with open(r'C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

channels_by_id = {str(c['id']): c for c in d['channels']}

with open('scripts/hungary_logos_map.json', 'r', encoding='utf-8') as f:
    hu_logos = json.load(f)

# Known explicit mappings from channelId to repo logo URL
EXPLICIT_LOGOS = {
    # Országos
    '6141': hu_logos.get('rtl-hu.png'),
    '6143': hu_logos.get('tv2-hu.png'),
    '5901': hu_logos.get('m1-hu.png'),
    '5905': hu_logos.get('duna-hu.png'),
    '6723': hu_logos.get('tv2-super-hu.png') or hu_logos.get('super-one-hu.png'),
    '6142': hu_logos.get('rtl-ketto-hu.png'),
    '6147': hu_logos.get('rtl-harom-hu.png'),
    '5911': hu_logos.get('viasat3-hu.png'),
    '4739': hu_logos.get('atv-hu.png'),
    '4740': hu_logos.get('hir-tv-hu.png'),
    '6704': hu_logos.get('prime-hu.png'),
    '6184': hu_logos.get('tv4-hu.png'),
    '6236': hu_logos.get('viasat6-hu.png'),
    '6148': hu_logos.get('rtl-gold-hu.png'),
    '5902': hu_logos.get('m2-hu.png'),
    '5906': hu_logos.get('duna-world-hu.png'),
    '5904': hu_logos.get('m5-hu.png'),
    '5931': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/m1-hu.png', # M3 retro uses MTVA emblem
    '8716': hu_logos.get('viasat2-hu.png'),
    '5855': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/euronews-fr.png',

    # Film & Sorozat
    '6150': hu_logos.get('film-plus-hu.png'),
    '6152': hu_logos.get('mozi-plus-hu.png'),
    '6146': hu_logos.get('cool-tv-hu.png'),
    '6652': hu_logos.get('amc-hu.png'),
    '6720': hu_logos.get('moziverzum-hu.png'),
    '7069': hu_logos.get('hbo-hu.png'),
    '7158': hu_logos.get('hbo2-hu.png'),
    '7159': hu_logos.get('hbo3-hu.png'),
    '6254': hu_logos.get('film4-hu.png'),
    '7060': hu_logos.get('tv2-comedy-hu.png'),
    '6149': hu_logos.get('sorozat-plus-hu.png'),
    '7074': hu_logos.get('film-cafe-hu.png'),
    '7154': hu_logos.get('axn-hu.png'),
    '7422': hu_logos.get('galaxy4-hu.png'),
    '8714': hu_logos.get('max4-hu.png'),
    '6163': hu_logos.get('izaura-tv-hu.png'),
    '6701': hu_logos.get('jocky-tv-hu.png'),
    '8489': hu_logos.get('magyar-mozi-tv-hu.png'),

    # Ismeretterjesztő
    '5936': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/national-geographic-us.png',
    '7325': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/history-channel-us.png',
    '6749': hu_logos.get('spektrum-hu.png'),
    '5937': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/national-geographic-wild-us.png',
    '6589': hu_logos.get('spektrum-home-hu.png'),
    '8124': hu_logos.get('ozone-tv-hu.png'),

    # Sport & Életmód
    '5903': hu_logos.get('m4-sport-hu.png'),
    '6721': hu_logos.get('spiler-1-hu.png'),
    '6722': hu_logos.get('spiler-2-hu.png'),
    '6718': hu_logos.get('sport1-hu.png'),
    '6719': hu_logos.get('sport2-hu.png'),
    '7084': hu_logos.get('arena4-hu.png'),
    '8271': hu_logos.get('match4-hu.png'),
    '6748': hu_logos.get('tv-paprika-hu.png'),
    '6751': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/tlc-us.png',
    '7087': hu_logos.get('tv2-sef-hu.png'),
    '6159': hu_logos.get('slager-tv-hu.png'),
    '6151': hu_logos.get('muzsika-tv-hu.png'),
    '6162': hu_logos.get('zenebutik-hu.png'),
    '6603': hu_logos.get('life-tv-hu.png'),
    '6455': hu_logos.get('fem3-hu.png'),

    # Gyerek
    '7079': hu_logos.get('minimax-hu.png'),
    '6764': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/nickelodeon-us.png',
    '6767': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/disney-channel-us.png',
    '6765': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/nick-jr-us.png',
    '6705': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/nicktoons-us.png',
    '6707': hu_logos.get('tv2-kids-hu.png'),
    '7080': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-kingdom/jimjam-uk.png'
}

with open('scripts/explicit_logos_map.json', 'w', encoding='utf-8') as f:
    json.dump(EXPLICIT_LOGOS, f, indent=2)

print(f"Mapped {len(EXPLICIT_LOGOS)} high-res logos from tv-logos repo.")
