import urllib.request

urls = [
    'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/national-geographic-us.png',
    'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/nickelodeon-us.png',
    'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/disney-channel-us.png',
    'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/history-us.png',
    'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/nick-jr-us.png',
    'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/tlc-us.png'
]
for u in urls:
    name = u.split('/')[-1]
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            print(f"OK ({resp.status}): {name}")
    except Exception as e:
        print(f"FAIL: {name} -> {e}")
