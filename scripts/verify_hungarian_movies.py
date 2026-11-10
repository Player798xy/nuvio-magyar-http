import urllib.request
import json

pool = [
  ('Macskafogó', 'tt0179955', '1986'),
  ('Indul a bakterház', 'tt0121403', '1980'),
  ('A tanú', 'tt0065067', '1969'),
  ('Üvegtigris', 'tt0257290', '2001'),
  ('Vuk', 'tt0131636', '1981'),
  ('Szaffi', 'tt0137226', '1985'),
  ('Lúdas Matyi', 'tt0142632', '1977'),
  ('Valami Amerika', 'tt0303184', '2002'),
  ('Csinibaba', 'tt0118906', '1997'),
  ('A miniszter félrelép', 'tt0119677', '1997'),
  ('A Pál utcai fiúk', 'tt0062164', '1968'),
  ('Egri csillagok', 'tt0062925', '1968'),
  ('Kontroll', 'tt0373981', '2003'),
  ('Kincsem', 'tt4964310', '2017'),
  ('Mephisto', 'tt0082736', '1981'),
  ('Sose halunk meg', 'tt0108194', '1993'),
  ('Az ötödik pecsét', 'tt0075467', '1976'),
  ('Az élet muzsikája - Kálmán Imre', 'tt0174368', '1984')
]

for name, tid, expected_year in pool:
    url = f'https://v3-cinemeta.strem.io/meta/movie/{tid}.json'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as r:
            d = json.loads(r.read().decode('utf-8'))
            meta = d.get('meta', {})
            poster = meta.get('poster') or f'https://images.metahub.space/poster/medium/{tid}/img'
            print(f"OK {tid} | {name} --> Cinemeta: '{meta.get('name')}' ({meta.get('year')}) | Poster: {bool(poster)}")
    except Exception as e:
        print(f"ERR {tid} | {name} --> {e}")
