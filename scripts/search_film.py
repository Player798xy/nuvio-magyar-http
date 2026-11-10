import re

with open('scripts/film_player.html', 'r', encoding='utf-8') as f:
    text = f.read()

print('Text length:', len(text))
matches = [m.start() for m in re.finditer(r'6150', text)]
print('Matches for 6150:', len(matches))
for m in matches[:5]:
    print('---')
    print(ascii(text[max(0, m-50):min(len(text), m+150)]))
