const fs = require('fs');
const path = require('path');

const gradeList = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'gradetv_hu_channels.json'), 'utf8'));
const onlinestreamPath = path.join(__dirname, '..', 'src', 'scrapers', 'onlinestream.js');
const rawCode = fs.readFileSync(onlinestreamPath, 'utf8');

const { ALL_CHANNELS } = require(onlinestreamPath);

const ALIASES = {
  'cool tv': 'Cool.hu',
  'cool': 'Cool.hu',
  'spíler 1 tv': 'Spiler1.hu',
  'spiler 1 tv': 'Spiler1.hu',
  'spiler 1': 'Spiler1.hu',
  'spíler 1': 'Spiler1.hu',
  'spíler 2 tv': 'Spiler2.hu',
  'spiler 2 tv': 'Spiler2.hu',
  'spíler 2': 'Spiler2.hu',
  'spiler 2': 'Spiler2.hu',
  'arena4': 'Arena4.hu',
  'match 4': 'Match4.hu',
  'match4': 'Match4.hu',
  'max4': 'MAX4.hu',
  'minimax': 'Minimax.hu',
  'spektrum': 'Spektrum.hu',
  'spektrum home': 'SpektrumHome.hu',
  'tv paprika': 'TVPaprika.hu',
  'ewtn': 'BonumTV.hu',
  'bonum tv': 'BonumTV.hu',
  'ewtn/bonum tv': 'EWTNBonumTV.hu',
  'national geographic': 'NationalGeographic.hu',
  'nat geo': 'NationalGeographic.hu',
  'national geographic wild': 'NationalGeographicWild.hu',
  'nat geo wild': 'NationalGeographicWild.hu',
  'rtl': 'RTL.hu',
  'rtl klub': 'RTLKlub.hu',
  'rtl kettő': 'RTLKetto.hu',
  'rtl ketto': 'RTLKetto.hu',
  'rtl 2': 'RTLKetto.hu',
  'rtl három': 'RTLHarom.hu',
  'rtl harom': 'RTLHarom.hu',
  'rtl 3': 'RTLHarom.hu',
  'rtl gold': 'RTLGold.hu',
  'rtl otthon': 'RTLOtthon.hu',
  'tv2': 'TV2.hu',
  'super tv2': 'SuperTV2.hu',
  'tv2 comedy': 'TV2Comedy.hu',
  'tv2 kids': 'TV2Kids.hu',
  'tv2 séf': 'TV2Sef.hu',
  'tv2 sef': 'TV2Sef.hu',
  'mozi+': 'MoziPlus.hu',
  'mozi plusz': 'MoziPlus.hu',
  'moziverzum': 'Moziverzum.hu',
  'film+': 'FilmPlus.hu',
  'film plusz': 'FilmPlus.hu',
  'film4': 'Film4.hu',
  'film café': 'FilmCafe.hu',
  'film cafe': 'FilmCafe.hu',
  'film kávé': 'FilmCafe.hu',
  'film mania': 'FilmMania.hu',
  'film mánia': 'FilmMania.hu',
  'tv4': 'TV4.hu',
  'story4': 'Story4.hu',
  'galaxy4': 'Galaxy4.hu',
  'm1': 'M1.hu',
  'm2': 'M2.hu',
  'm2 / petőfi tv': 'M2.hu',
  'm2 / petofi tv': 'M2.hu',
  'm4 sport': 'M4Sport.hu',
  'm5': 'M5.hu',
  'duna': 'Duna.hu',
  'duna world': 'DunaWorld.hu',
  'duna world / m4 sport+': 'DunaWorld.hu',
  'atv': 'ATV.hu',
  'atv spirit': 'ATVSpirit.hu',
  'hír tv': 'HirTV.hu',
  'hir tv': 'HirTV.hu',
  'hirtv': 'HirTV.hu',
  '7.tv (békéscsaba)': '7TV.hu',
  '7.tv (bekescsaba)': '7TV.hu',
  'komáromi tv': 'KomaromiTelevizio.hu',
  'komaromi tv': 'KomaromiTelevizio.hu',
  'móri városi tv': 'VTVMor.hu',
  'mori varosi tv': 'VTVMor.hu',
  'ózdi tv': 'OzdiVarosiTV.hu',
  'ozdi tv': 'OzdiVarosiTV.hu',
  'vásárhelyi tv': 'VasarhelyiTelevizio.hu',
  'vasarhelyi tv': 'VasarhelyiTelevizio.hu',
  'oroszlányi tv': 'OroszlanyiVarosiTelevizio.hu',
  'oroszlani tv': 'OroszlanyiVarosiTelevizio.hu',
  'sláger tv': 'SlagerTV.hu',
  'slager tv': 'SlagerTV.hu',
  'magyar mozi tv': 'MagyarMoziTV.hu',
  'sport 1': 'Sport1.hu',
  'sport 2': 'Sport2.hu',
  'animal planet': 'AnimalPlanet.hu',
  'discovery channel': 'DiscoveryChannel.hu',
  'discovery': 'DiscoveryChannel.hu',
  'disney channel': 'DisneyChannel.hu',
  'disney': 'DisneyChannel.hu',
  'eurosport 1': 'Eurosport1.hu',
  'eurosport': 'Eurosport1.hu',
  'food network': 'FoodNetwork.hu',
  'hgtv': 'HGTV.hu',
  'investigation discovery': 'InvestigationDiscovery.hu',
  'id': 'InvestigationDiscovery.hu',
  'viasat explore': 'ViasatExplore.hu',
  'viasat history': 'ViasatHistory.hu',
  'viasat nature': 'ViasatNature.hu',
  'viasat 3': 'Viasat3.hu',
  'viasat 6': 'Viasat6.hu',
  'viasat 2': 'Viasat2.hu',
  'viasat2': 'Viasat2.hu',
  'the fishing & hunting channel': 'TheFishingHuntingChannel.hu',
  'fishing & hunting': 'TheFishingHuntingChannel.hu',
  'travel channel': 'TravelChannel.hu',
  'life tv': 'LifeTV.hu',
  'ozone tv': 'OzoneTV.hu',
  'jocky tv': 'JockyTV.hu',
  'zenebutik': 'Zenebutik.hu',
  'nick jr.': 'NickJr.hu',
  'nick jr': 'NickJr.hu',
  'nickelodeon': 'Nickelodeon.hu',
  'nicktoons': 'Nicktoons.hu',
  'jimjam': 'JimJam.hu',
  'fem3': 'FEM3.hu',
  'prime': 'Prime.hu',
  'izaura tv': 'IzauraTV.hu',
  'muzsika tv': 'MuzsikaTV.hu',
  'sorozat+': 'SorozatPlus.hu',
  'sorozat plusz': 'SorozatPlus.hu',
  'tlc': 'TLC.hu',
  'history': 'History.hu',
  'dikh tv': 'DikhTV.hu',
  'fix tv': 'FIXTV.hu',
  'kapos tv': 'KaposTV.hu',
  'tv eger': 'TVEger.hu',
  'szolnok tv': 'SzolnokTV.hu',
  'bajai tv': 'BajaiTV.hu',
  'balaton tv': 'BalatonTV.hu',
  'fehérvár tv': 'FehervarTV.hu',
  'fehervar tv': 'FehervarTV.hu',
  'kecskeméti tv': 'KecskemetiTV.hu',
  'kecskemeti tv': 'KecskemetiTV.hu',
  'kanizsa tv': 'KanizsaTV.hu',
  'karcag tv': 'KarcagTV.hu',
  'líceum tv': 'LiceumTV.hu',
  'liceum tv': 'LiceumTV.hu',
  'city tv': 'CityTV.hu',
  'móra-net tv': 'MoraNetTV.hu',
  'mora-net tv': 'MoraNetTV.hu',
  'telepaks': 'TelePaks.hu',
  'zalaegerszegi tv': 'ZalaegerszegiTV.hu'
};

function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const gradeById = new Map(gradeList.map(c => [c.id.toLowerCase(), c]));
const gradeByName = new Map(gradeList.map(c => [norm(c.name), c]));

function findGrade(name) {
  const normName = norm(name);
  for (const [alias, gradeId] of Object.entries(ALIASES)) {
    if (norm(alias) === normName) {
      const g = gradeById.get(gradeId.toLowerCase());
      if (g) return g;
    }
  }
  let g = gradeByName.get(normName);
  if (g) return g;
  for (const [k, v] of gradeByName.entries()) {
    if (k.length > 3 && (normName.includes(k) || k.includes(normName))) {
      return v;
    }
  }
  return null;
}

function mergeChannelStreams(ch, g) {
  const newStreams = [];
  const seenUrls = new Set();

  if (g && Array.isArray(g.streams)) {
    for (const gs of g.streams) {
      // 1. Direct EU Provider stream (unmetered, fastest, outside 120m limit)
      if (gs.provider_url) {
        const u = gs.provider_url.trim();
        const normU = u.toLowerCase();
        if (!seenUrls.has(normU)) {
          seenUrls.add(normU);
          let host = '';
          try { host = new URL(u).hostname; } catch (e) {}
          newStreams.push({
            sub_idx: newStreams.length + 1,
            url: u,
            host: host || '88.212.7.14',
            features: gs.feed || '1080p FHD',
            playerUrl: `https://gradetv.net/?q=${encodeURIComponent(ch.name)}`,
            onlineUrl: u
          });
        }
      }
      // 2. GradeTV HTTPS playlist stream (backup)
      if (gs.url) {
        const u = gs.url.trim();
        const normU = u.toLowerCase();
        if (!seenUrls.has(normU)) {
          seenUrls.add(normU);
          let host = '';
          try { host = new URL(u).hostname; } catch (e) {}
          newStreams.push({
            sub_idx: newStreams.length + 1,
            url: u,
            host: host || 'm3m8.gradetv.net',
            features: gs.feed || '1080p FHD',
            playerUrl: `https://gradetv.net/?q=${encodeURIComponent(ch.name)}`,
            onlineUrl: u
          });
        }
      }
    }
  }

  // 3. Keep existing streams as secondary / tertiary backups
  if (Array.isArray(ch.streams)) {
    for (const oldS of ch.streams) {
      if (oldS.url) {
        const normU = oldS.url.trim().toLowerCase();
        if (!seenUrls.has(normU)) {
          seenUrls.add(normU);
          newStreams.push({
            ...oldS,
            sub_idx: newStreams.length + 1
          });
        }
      }
    }
  }

  return newStreams;
}

const updatedChannels = [];
const usedGradeIds = new Set();

for (const ch of ALL_CHANNELS) {
  const g = findGrade(ch.name);
  if (g) {
    usedGradeIds.add(g.id);
    ch.streams = mergeChannelStreams(ch, g);
  }
  updatedChannels.push(ch);
}

// Brand new channels
const BRAND_NEW_CATEGORIES = {
  'DiscoveryChannel.hu': { cat: 'hu-live-doksi', desc: 'A világ legnépszerűbb tudományos és felfedező csatornája.' },
  'AnimalPlanet.hu': { cat: 'hu-live-doksi', desc: 'Vadállatok, természet és állatvilág testközelből.' },
  'InvestigationDiscovery.hu': { cat: 'hu-live-doksi', desc: 'Valódi bűnügyi történetek és nyomozások.' },
  'ViasatExplore.hu': { cat: 'hu-live-doksi', desc: 'Extrém kalandok, felfedezések és emberi teljesítmények.' },
  'ViasatHistory.hu': { cat: 'hu-live-doksi', desc: 'Történelmi dokumentumfilmek az ókortól a modern korig.' },
  'ViasatNature.hu': { cat: 'hu-live-doksi', desc: 'Lenyűgöző természetfilmek és a Föld élővilága.' },
  'HGTV.hu': { cat: 'hu-live-doksi', desc: 'Otthonteremtés, lakberendezés és házfelújítás.' },
  'TravelChannel.hu': { cat: 'hu-live-doksi', desc: 'Utazások, egzotikus kultúrák és rejtett úti célok.' },
  'Eurosport1.hu': { cat: 'hu-live-sport', desc: 'Élő nemzetközi élsport: tenisz Grand Slamek, kerékpár körversenyek, téli sportok.' },
  'TheFishingHuntingChannel.hu': { cat: 'hu-live-sport', desc: 'Horgászat, vadászat és természetjárás Európa vizein.' },
  'PVTV.hu': { cat: 'hu-live-sport', desc: 'Horgász és vadász közvetítések a természet szerelmeseinek.' },
  'Loversenykozvetites.hu': { cat: 'hu-live-sport', desc: 'Élő Kincsem Park ügető és galopp lóverseny futamok.' },
  'DisneyChannel.hu': { cat: 'hu-live-gyerek', desc: 'A Disney animációs és ifjúsági sikersorozatai gyerekeknek és családoknak.' },
  'Story4.hu': { cat: 'hu-live-film', desc: 'Klasszikus és modern európai és amerikai drámák, krimik és romantikus sorozatok.' },
  'FilmMania.hu': { cat: 'hu-live-film', desc: 'Örökzöld hollywoodi klasszikusok és legendás mozifilmek.' },
  'AXNSpin.hu': { cat: 'hu-live-film', desc: 'Fiataloknak szóló akció, fantasy és anime sorozatok.' },
  'ATVSpirit.hu': { cat: 'hu-live-orszagos', desc: 'Az ATV testvércsatornája: könnyedebb közélet, magazinműsorok és talk-show-k.' },
  'DikhTV.hu': { cat: 'hu-live-orszagos', desc: 'A roma kultúra, zene és szórakoztató műsorok országos csatornája.' },
  'FIXTV.hu': { cat: 'hu-live-orszagos', desc: 'Technológiai hírek, informatika és kulturális magazinok.' },
  'BudapestEuropaTelevizio.hu': { cat: 'hu-live-orszagos', desc: 'Közéleti, kulturális és szórakoztató műsorok Budapestről.' },
  'FoodNetwork.hu': { cat: 'hu-live-doksi', desc: 'Gasztronómia, világhírű séfek és kulináris élmények.' }
};

let nextNumId = 9800;

for (const g of gradeList) {
  if (usedGradeIds.has(g.id)) continue;
  if (g.id.includes('Radio') || g.id.includes('Orszaggyules')) continue;

  const info = BRAND_NEW_CATEGORIES[g.id] || { cat: 'hu-live-helyi', desc: `${g.name} helyi és körzeti televízió élő adása.` };
  const numId = String(nextNumId++);
  const chId = `onlinestream-live-${numId}`;

  const channelObj = {
    id: chId,
    channelId: numId,
    name: g.name,
    category: info.cat,
    type: 'movie',
    year: 'ÉLŐ • HD',
    releaseInfo: 'ÉLŐ • HD',
    description: info.desc,
    mtvaKey: null,
    streams: mergeChannelStreams({ name: g.name, streams: [] }, g),
    behaviorHints: {
      defaultVideoId: chId,
      isLive: true
    }
  };

  updatedChannels.push(channelObj);
}

const categoryCounts = {};
for (const ch of updatedChannels) {
  categoryCounts[ch.category] = (categoryCounts[ch.category] || 0) + 1;
}

// Split by CRLF
const lines = rawCode.split('\r\n');
const startAllIdx = lines.findIndex(l => l.startsWith('const ALL_CHANNELS = ['));
const endAllIdx = lines.findIndex((l, idx) => idx > startAllIdx && l === '];' && lines[idx + 2] && lines[idx + 2].includes('CHANNELS_BY_ID'));

if (startAllIdx === -1 || endAllIdx === -1) {
  console.error('Lines not found! start:', startAllIdx, 'end:', endAllIdx);
  process.exit(1);
}

console.log('Replacing ALL_CHANNELS from line', startAllIdx + 1, 'to', endAllIdx + 1);

// 1. Update category counts in beforeLines
for (let i = 0; i < startAllIdx; i++) {
  if (lines[i].includes('"id": "hu-live-orszagos"')) {
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('"count":')) {
        lines[j] = `    "count": ${categoryCounts['hu-live-orszagos'] || 25}`;
        break;
      }
    }
  } else if (lines[i].includes('"id": "hu-live-film"')) {
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('"count":')) {
        lines[j] = `    "count": ${categoryCounts['hu-live-film'] || 21}`;
        break;
      }
    }
  } else if (lines[i].includes('"id": "hu-live-doksi"')) {
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('"count":')) {
        lines[j] = `    "count": ${categoryCounts['hu-live-doksi'] || 6}`;
        break;
      }
    }
  } else if (lines[i].includes('"id": "hu-live-sport"')) {
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('"count":')) {
        lines[j] = `    "count": ${categoryCounts['hu-live-sport'] || 16}`;
        break;
      }
    }
  } else if (lines[i].includes('"id": "hu-live-gyerek"')) {
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('"count":')) {
        lines[j] = `    "count": ${categoryCounts['hu-live-gyerek'] || 7}`;
        break;
      }
    }
  } else if (lines[i].includes('"id": "hu-live-helyi"')) {
    for (let j = i; j < i + 10; j++) {
      if (lines[j].includes('"count":')) {
        lines[j] = `    "count": ${categoryCounts['hu-live-helyi'] || 37}`;
        break;
      }
    }
  }
}

const beforeLines = lines.slice(0, startAllIdx);
const afterLines = lines.slice(endAllIdx + 1);

// 2. Generate middleLines
const channelsJson = JSON.stringify(updatedChannels, null, 2).split('\n').map(l => l.replace(/\r/, '')).join('\r\n');
const middleLines = `const ALL_CHANNELS = ${channelsJson};`.split('\r\n');

// 3. Update getStreamHostPriority in afterLines
const prioIdx = afterLines.findIndex(l => l.includes('function getStreamHostPriority'));
const prioEnd = afterLines.findIndex((l, idx) => idx > prioIdx && l === '}');

const newPrioCode = `/**
 * Prioritizes fast Direct EU CDN hosts (88.212.7.14 Antik Telecom, Lexanetwork - 7-10 MB/s, unmetered)
 * above GradeTV playlist server (subject to 120m daily allowance limit) and demotes slow fallback hosts.
 */
function getStreamHostPriority(s) {
  if (!s) return 0;
  const host = ((s.host || '') + ' ' + (s.url || '')).toLowerCase();
  
  // 1. High-speed Direct EU CDNs (88.212.7.14 Antik Telecom, Lexanetwork, Videa, ATV, Streaming4u)
  // Direct channel links are 100% UNMETERED and exempt from the GradeTV 120-minute daily allowance limit!
  if (host.includes('88.212.7.14') || host.includes('antik.sk')) return 100;
  if (host.includes('budapest-cache')) return 98;
  if (host.includes('lexanetwork')) return 96;
  if (host.includes('streamservers.atv.hu') || host.includes('stream.atv.hu')) return 95;
  if (host.includes('streaming4u')) return 94;
  if (host.includes('videa')) return 92;

  // 2. GradeTV Playlist Server (m3m8.gradetv.net - HTTPS backup, subject to 120m free daily allowance)
  if (host.includes('m3m8.gradetv.net') || host.includes('gradetv.net')) return 85;

  // 3. Official MTVA / ConnectMedia relays
  if (host.includes('mediaklikk') || host.includes('connectmedia')) return 80;

  // 4. Local / municipal TV direct streams that are reliable
  if (!host.includes('141.94.193.53')) return 50;

  // 5. Overloaded OVH single-node VPS (choked to ~1 Mbps in peak evening hours) -> Fallback only!
  return 10;
}`;

if (prioIdx !== -1 && prioEnd !== -1) {
  console.log('Replacing getStreamHostPriority lines in afterLines:', prioIdx, 'to', prioEnd);
  // Also replace preceding comment lines if any
  let commentStart = prioIdx;
  if (afterLines[prioIdx - 1] && afterLines[prioIdx - 1].includes('*/')) {
    while (commentStart > 0 && !afterLines[commentStart].includes('/**')) {
      commentStart--;
    }
  }
  afterLines.splice(commentStart, (prioEnd - commentStart + 1), ...newPrioCode.split('\n').map(l => l.replace(/\r/, '')));
}

// 4. Update tagging block in getOnlineStreamStreams
const tagIdx = afterLines.findIndex(l => l.includes('const directTag = isSlowServer'));
let tagEnd = -1;
if (tagIdx !== -1) {
  for (let i = tagIdx; i < tagIdx + 30; i++) {
    if (afterLines[i] === '      }' && afterLines[i + 2] && afterLines[i + 2].includes('topUrl !== masterUrl')) {
      tagEnd = i;
      break;
    }
  }
}

const newTagCode = `      const isEuDirect = (s.host || '').includes('88.212.7.14') ||
                         (s.url || '').includes('88.212.7.14') ||
                         (s.host || '').includes('antik.sk') ||
                         (s.host || '').includes('lexanetwork') ||
                         (s.host || '').includes('streamservers.atv.hu') ||
                         (s.host || '').includes('stream.atv.hu') ||
                         (s.host || '').includes('streaming4u') ||
                         (s.host || '').includes('videa.hu');
      const isGradeServer = (s.host || '').includes('gradetv') || (s.url || '').includes('gradetv');

      let directTag = '';
      let streamTitle = '';

      if (isEuDirect) {
        directTag = ' [EU Direkt • Korlátlan]';
        streamTitle = \`🚀 \${ch.name} • EU Közvetlen Szerver (Korlátlan / Nincs időkorlát)\\n\${quality} • Leggyorsabb EU Forrás (\${serverHost})\\nKözvetlen HLS Master Stream • Nulla pufferelés\`;
      } else if (isGradeServer) {
        directTag = ' [GradeTV • HTTPS]';
        streamTitle = \`📡 \${ch.name} • GradeTV HLS Szerver (HTTPS)\\n\${quality} • \${serverHost}\\nTartalék HLS Forrás\`;
      } else if (isSlowServer) {
        directTag = ' [Tartalék Szerver]';
        streamTitle = \`⚠️ \${ch.name} • Másodlagos Tartalék Adás\\n\${quality} • \${serverHost} Forrás\`;
      } else {
        directTag = ' [Direkt Adás]';
        streamTitle = \`📡 \${ch.name} • \${serverHost}\\n\${quality} Közvetlen Forrás\`;
      }

      // A Master Playlist (masterUrl) MINDIG az 1. helyre kerül, mert az tartalmazza a hangot (audio) ÉS a képet (video) szinkronban!
      if (masterUrl) {
        serverDirectStreams.push({
          name: \`🔴 [HU] \${ch.name} — \${quality} (.m3u8)\${directTag}\`,
          title: streamTitle,
          url: masterUrl,
          behaviorHints: {
            notWebReady: false,
            isLive: true
          }
        });
      }`;

if (tagIdx !== -1 && tagEnd !== -1) {
  console.log('Replacing stream tagging in afterLines:', tagIdx, 'to', tagEnd);
  afterLines.splice(tagIdx, (tagEnd - tagIdx + 1), ...newTagCode.split('\n').map(l => l.replace(/\r/, '')));
}

const finalLines = [...beforeLines, ...middleLines, ...afterLines];
fs.writeFileSync(onlinestreamPath, finalLines.join('\r\n'), 'utf8');
console.log('Successfully completed full migration! Total channels:', updatedChannels.length, 'Total lines:', finalLines.length);
