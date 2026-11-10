import urllib.request
import json
import os

req = urllib.request.Request(
    'https://api.github.com/repos/tv-logo/tv-logos/contents/countries/hungary',
    headers={'User-Agent': 'Mozilla/5.0'}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))

logos = {}
for x in data:
    if x['name'].endswith('.png'):
        logos[x['name']] = x['download_url']

print(f"Total logos available: {len(logos)}")
with open('scripts/hungary_logos_map.json', 'w', encoding='utf-8') as f:
    json.dump(logos, f, indent=2)

print("Saved to scripts/hungary_logos_map.json")
