const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replaceAll('Mind a 6 kategória aktív (146 élő adó)', 'Mind a 6 kategória aktív (164 élő adó)');
html = html.replace('<!-- Dropdown 4: Élő TV Katalógusok (6 Kategória - 146 Adó) -->', '<!-- Dropdown 4: Élő TV Katalógusok (6 Kategória - 164 Adó) -->');

html = html.replace(
  '<span class="row-desc">82 válogatott prémium adó (RTL, TV2, Film+, Mozi+, AMC, Nat Geo, History, Spíler, Sport 1-2...)</span>',
  '<span class="row-desc">95 válogatott prémium adó (RTL, TV2, Film+, Mozi+, Spektrum, Spektrum Home, Nat Geo, Discovery, Animal Planet, EuroSport 1, Spíler 1-2...) közvetlen EU gerinchálózatból (88.212.7.14)</span>'
);
html = html.replace(
  '<span class="tag tag-live">● 82 Prémium Adó</span>',
  '<span class="tag tag-live">● 95 Prémium Adó</span>'
);

html = html.replace(
  '<span class="row-desc">21 adó (Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1-2-3, Film4, TV2 Comedy...)</span>',
  '<span class="row-desc">24 adó (Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1-2-3, Film4, Story4, Film Mánia...)</span>'
);
html = html.replace(
  '<span class="tag tag-live">● 21 Adó</span>',
  '<span class="tag tag-live">● 24 Adó</span>'
);

html = html.replace(
  '<span class="row-desc">6 adó (National Geographic, History, Spektrum, Nat Geo Wild, Spektrum Home, Ozone...)</span>',
  '<span class="row-desc">15 adó (Discovery Channel, Animal Planet, Nat Geo, Spektrum, Spektrum Home, ID, Viasat Explore/History/Nature, HGTV...)</span>'
);
html = html.replace(
  '<span class="tag tag-live">● 6 Adó</span>',
  '<span class="tag tag-live">● 15 Adó</span>'
);

html = html.replace(
  '<span class="row-desc">19 adó (M4 Sport, Spíler 1-2, Sport 1-2, Arena4, Match 4, TV Paprika, Muzsika TV...)</span>',
  '<span class="row-desc">20 adó (M4 Sport, Spíler 1-2, Sport 1-2, Arena4, Match 4, EuroSport 1, Fishing & Hunting, TV Paprika...)</span>'
);
html = html.replace(
  '<span class="tag tag-live">● 19 Adó</span>',
  '<span class="tag tag-live">● 20 Adó</span>'
);

html = html.replace(
  '<span class="row-desc">64 adó (Debrecen TV, Sopron TV, Fehérvár TV, Tisza TV, Szeged TV, Nyíregyházi TV...)</span>',
  '<span class="row-desc">69 adó (Debrecen TV, Sopron TV, Fehérvár TV, Tisza TV, Szeged TV, Nyíregyházi TV...)</span>'
);
html = html.replace(
  '<span class="tag tag-warn">64 Helyi Városi TV</span>',
  '<span class="tag tag-warn">69 Helyi Városi TV</span>'
);

html = html.replace(
  'valamint a 146 csatornás felbontás- és forrás-ellenőrzési táblázat',
  'valamint a 164 csatornás felbontás- és forrás-ellenőrzési táblázat'
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully updated index.html!');
