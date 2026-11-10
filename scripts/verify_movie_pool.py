import json, re, urllib.request

with open('src/catalogs.js', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'const VERIFIED_HUNGARIAN_MOVIES_POOL = (\[.*?\]);\s*\n', text, re.DOTALL)
if not m:
    print('VERIFIED_HUNGARIAN_MOVIES_POOL not found')
    exit(1)

pool = json.loads(m.group(1))
print(f'Checking {len(pool)} movies in VERIFIED_HUNGARIAN_MOVIES_POOL:')

for item in pool:
    iid = item['id']
    name = item['name']
    url = f'https://v3-cinemeta.strem.io/meta/movie/{iid}.json'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=4) as r:
            d = json.loads(r.read().decode('utf-8'))
            meta = d.get('meta', {})
            real_name = meta.get('name', 'UNKNOWN')
            real_year = meta.get('year', 'UNKNOWN')
            real_poster = meta.get('poster', '')
            match = (name.lower() in real_name.lower()) or (real_name.lower() in name.lower())
            status = '✅ OK' if match else f'❌ MISMATCH! Expected "{name}" but got "{real_name}" ({real_year})'
            print(f"[{iid}] {name} ({item.get('releaseInfo')}) -> {status}")
    except Exception as e:
        print(f"[{iid}] {name} -> ERR: {e}")
