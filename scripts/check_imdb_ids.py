import urllib.request
import json

test_ids = [
    ('A miniszter félrelép', 'tt0120546'),
    ('A Pál utcai fiúk', 'tt0063462'),
    ('Egri csillagok', 'tt0062925'),
    ('Kontroll', 'tt0388182'),
    ('Kincsem', 'tt6067832'),
    ('Mephisto', 'tt0082806'),
    ('Sose halunk meg', 'tt0108188'),
    ('Az ötödik pecsét', 'tt0074195'),
    ('Macskafogó', 'tt0179955'),
    ('Indul a bakterház', 'tt0121403'),
    ('A tanú', 'tt0065067'),
    ('Üvegtigris', 'tt0257290')
]

for name, tid in test_ids:
    url = f'https://v3-cinemeta.strem.io/meta/movie/{tid}.json'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as r:
            d = json.loads(r.read().decode('utf-8'))
            meta = d.get('meta', {})
            print(f"'{name}' -> {tid} -> Cinemeta: '{meta.get('name')}' ({meta.get('year')})")
    except Exception as e:
        print(f"'{name}' -> {tid} -> ERR: {e}")
