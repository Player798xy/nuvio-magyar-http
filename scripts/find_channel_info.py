import json

with open(r'C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for ch in d['channels']:
    if 'hír tv' in ch['name'].lower() or 'hirtv' in ch['name'].lower() or 'disney' in ch['name'].lower() or 'tisza' in ch['name'].lower():
        print(f"Name: {ch['name']} | ID: {ch['id']} | Streams: {len(ch.get('streams', []))}")
        for s in ch.get('streams', []):
            print(f"   m3u_url: {s.get('m3u_url')} | player_url: {s.get('player_url')}")
