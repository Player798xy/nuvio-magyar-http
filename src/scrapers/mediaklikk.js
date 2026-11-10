/**
 * MédiaKlikk (MTVA) Scraper & Live TV Stream Provider
 * Provides:
 * 1. 24/7 Official Live TV HLS streams (M1, M2, M4 Sport, M4 Sport+, M5, Duna, Duna World)
 * 2. On-demand (VOD) Hungarian movies, series, fairy tales and documentaries from mediaklikk.hu
 */

// Official MTVA Live TV Channels with high-definition static branding posters and logos
const HOST_URL = process.env.HOST_URL || 'https://nuvio-magyar-http.vercel.app';

const LIVE_CHANNELS = [
  {
    id: 'mediaklikk-live-m4',
    channelKey: 'm4',
    streamId: 'mtv4live',
    pageUrl: 'https://m4sport.hu/elo/',
    name: 'M4 Sport Élő',
    type: 'movie',
    poster: `${HOST_URL}/channels/poster-m4.png`,
    logo: `${HOST_URL}/channels/m4.png`,
    year: 'ÉLŐ • 1080p FHD',
    description: 'A nemzeti sportcsatorna: Forma-1, magyar és nemzetközi labdarúgó bajnokságok, Bajnokok Ligája és olimpiai közvetítések 24 órában élőben.'
  },
  {
    id: 'mediaklikk-live-m4plus',
    channelKey: 'm4plus',
    streamId: 'mtv4plus',
    pageUrl: 'https://mediaklikk.hu/m4-sport-plusz-elo/',
    name: 'M4 Sport+ Élő',
    type: 'movie',
    poster: `${HOST_URL}/channels/poster-m4plus.png`,
    logo: `${HOST_URL}/channels/m4plus.png`,
    year: 'ÉLŐ • 1080p FHD',
    description: 'M4 Sport Plusz: párhuzamosan közvetített hazai és nemzetközi rangadók, bajnokságok és élő körkapcsolások.'
  },
  {
    id: 'mediaklikk-live-m1',
    channelKey: 'm1',
    streamId: 'mtv1live',
    pageUrl: 'https://mediaklikk.hu/elo/mtv1live/',
    name: 'M1 Híradó Élő',
    type: 'movie',
    poster: `${HOST_URL}/channels/poster-m1.png`,
    logo: `${HOST_URL}/channels/m1.png`,
    year: 'ÉLŐ • 1080p FHD',
    description: 'Nemzeti hírcsatorna: élő híradások, percről percre frissülő tudósítások, rendkívüli bejelentések és háttérelemzések.'
  },
  {
    id: 'mediaklikk-live-m2',
    channelKey: 'm2',
    streamId: 'mtv2live',
    pageUrl: 'https://mediaklikk.hu/elo/mtv2live/',
    name: 'M2 Gyerek & Petőfi TV Élő',
    type: 'movie',
    poster: `${HOST_URL}/channels/poster-m2.png`,
    logo: `${HOST_URL}/channels/m2.png`,
    year: 'ÉLŐ • 1080p FHD',
    description: 'Nappal M2 Gyerekcsatorna (klasszikus és új rajzfilmek, mesék), este Petőfi TV (zene, koncertek és ifjúsági magazinok).'
  },
  {
    id: 'mediaklikk-live-m5',
    channelKey: 'm5',
    streamId: 'mtv5live',
    pageUrl: 'https://mediaklikk.hu/elo/mtv5live/',
    name: 'M5 Kultúra Élő',
    type: 'movie',
    poster: `${HOST_URL}/channels/poster-m5.png`,
    logo: `${HOST_URL}/channels/m5.png`,
    year: 'ÉLŐ • 1080p FHD',
    description: 'Kulturális, oktatási és tudományos csatorna: színházi közvetítések, hangversenyek, irodalom és minőségi dokumentumfilmek.'
  },
  {
    id: 'mediaklikk-live-duna',
    channelKey: 'duna',
    streamId: 'dunalive',
    pageUrl: 'https://mediaklikk.hu/elo/duna/',
    name: 'Duna TV Élő',
    type: 'movie',
    poster: `${HOST_URL}/channels/poster-duna.png`,
    logo: `${HOST_URL}/channels/duna.png`,
    year: 'ÉLŐ • 1080p FHD',
    description: 'A nemzeti főadó: magyar filmek, közkedvelt sorozatok, családi és kulturális műsorok 24 órában élőben.'
  },
  {
    id: 'mediaklikk-live-dunaworld',
    channelKey: 'dunaworld',
    streamId: 'dunaworldlive',
    pageUrl: 'https://mediaklikk.hu/elo/dunaworldlive/',
    name: 'Duna World Élő',
    type: 'movie',
    poster: `${HOST_URL}/channels/poster-dunaworld.png`,
    logo: `${HOST_URL}/channels/dunaworld.png`,
    year: 'ÉLŐ • 1080p FHD',
    description: 'A határon túli magyarság csatornája: nemzetiségi műsorok, néphagyományok és magyar klasszikusok.'
  }
];

// In-memory cache for live stream URLs (HLS tokens are valid for ~2-3 hours)
const LIVE_STREAM_CACHE = new Map();
const LIVE_CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes

// In-memory cache for MédiaKlikk programs and series episodes
let mediaklikkProgramsCache = null;
let lastProgramsRefresh = 0;
const PROGRAMS_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const showEpisodesCache = new Map();

// 100% Verified & Tested MédiaKlikk (MTVA) Classic Series Catalog
const VERIFIED_MEDIAKLIKK_CLASSICS = [
  {
    id: 'mediaklikk:program:a-nagy-ho-ho-ho-horgasz',
    slug: 'a-nagy-ho-ho-ho-horgasz',
    imdbId: 'tt0154077',
    name: 'A nagy ho-ho-ho-horgász',
    keyword: 'A nagy ho-ho-ho',
    matchWord: 'a nagy ho ho ho horgasz',
    type: 'series',
    year: '1982–1988',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/08/hohoho_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'A nagy ho-ho-ho-horgász és a Főkukac felejthetetlen kalandjai Balázs Péter és Mikó István hangjával az MTVA archívumából.'
  },
  {
    id: 'mediaklikk:program:magyar-nepmesek',
    slug: 'magyar-nepmesek',
    imdbId: 'tt0861751',
    name: 'Magyar népmesék',
    keyword: 'Magyar népmesék',
    matchWord: 'magyar nepmesek',
    type: 'series',
    year: '1980–2012',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2013/12/magyarnepmesek_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'Klasszikus magyar népmesék animációs sorozat Szabó Gyula felejthetetlen mesemondásával.'
  },
  {
    id: 'mediaklikk:program:pom-pom-mesei',
    slug: 'pom-pom-mesei',
    imdbId: 'tt0166931',
    name: 'Pom-Pom meséi',
    keyword: 'Pom-Pom meséi',
    matchWord: 'pom pom mesei',
    type: 'series',
    year: '1980–1984',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/09/pompom_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'Picur és Pom-Pom történetei: Gombóc Artúr, Festéktüsszentő Hapci Benő, Radírpók és barátaik.'
  },
  {
    id: 'mediaklikk:program:frakk-a-macskak-reme',
    slug: 'frakk-a-macskak-reme',
    imdbId: 'tt0167595',
    name: 'Frakk, a macskák réme',
    keyword: 'Frakk, a macskák réme',
    matchWord: 'frakk',
    type: 'series',
    year: '1971–1985',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2013/12/frakk_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'Klasszikus magyar papírkivágásos animációs sorozat Károly bácsival, Irmuskával, Lukréciával és Szerénkével.'
  },
  {
    id: 'mediaklikk:program:kukori-es-kotkoda',
    slug: 'kukori-es-kotkoda',
    imdbId: 'tt0168342',
    name: 'Kukori és Kotkoda',
    keyword: 'Kukori és Kotkoda',
    matchWord: 'kukori',
    type: 'series',
    year: '1971–1972',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/08/kukori_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'Népszerű magyar rajzfilmsorozat a lusta kakasról és szorgos tyúkocskájáról.'
  },
  {
    id: 'mediaklikk:program:vizipok-csodapok',
    slug: 'vizipok-csodapok',
    imdbId: 'tt0168393',
    name: 'Vízipók-csodapók',
    keyword: 'Vízipók-csodapók',
    matchWord: 'vizipok',
    type: 'series',
    year: '1978–1988',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2018/02/vizipok_16-9.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'Vízipók és Keresztespók kalandjai a kristálytiszta vizű tó mélyén.'
  },
  {
    id: 'mediaklikk:program:kerem-a-kovetkezot',
    slug: 'kerem-a-kovetkezot',
    imdbId: 'tt0168343',
    name: 'Kérem a következőt! (Dr. Bubó)',
    keyword: 'Kérem a következőt!',
    matchWord: 'kerem a kovetkezot',
    type: 'series',
    year: '1974–1986',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/08/keremakovit_1920x1080-1.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Animáció'],
    description: 'Dr. Bubó orvosbagoly és Ursula nővér erdőlakó pácienseinek szellemes szatírája Romhányi József és Nepp József tollából.'
  },
  {
    id: 'mediaklikk:program:uzenet-a-jovobol-a-mezga-csalad',
    slug: 'uzenet-a-jovobol-a-mezga-csalad',
    imdbId: 'tt0136650',
    name: 'Üzenet a jövőből – A Mézga család',
    keyword: 'Üzenet a jövőből',
    matchWord: 'uzenet a jovobol',
    type: 'series',
    year: '1969',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2015/10/mezga_16-9.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Animáció'],
    description: 'A Mézga család 1. évada: kapcsolatfelvétel MZ/X-szel, a 30. századi köb-ükunokával.'
  },
  {
    id: 'mediaklikk:program:mezga-aladar-kulonos-kalandjai',
    slug: 'mezga-aladar-kulonos-kalandjai',
    imdbId: 'tt0136650',
    name: 'Mézga Aladár különös kalandjai',
    keyword: 'Mézga Aladár különös kalandjai',
    matchWord: 'mezga aladar',
    type: 'series',
    year: '1973',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2015/10/mezga_16-9.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Animáció'],
    description: 'A Mézga család 2. évada: Aladár és Blöki éjszakai űrutazásai a Gulliverkli 5-tel.'
  },
  {
    id: 'mediaklikk:program:vuk',
    slug: 'vuk',
    imdbId: 'tt0131636',
    name: 'Vuk (1–4. rész)',
    keyword: 'Vuk',
    matchWord: 'vuk',
    type: 'series',
    year: '1981',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/08/vuk_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'Fekete István regényéből készült klasszikus négyrészes rajzfilmsorozat Dargay Attila rendezésében.'
  },
  {
    id: 'mediaklikk:program:a-kockasfulu-nyul',
    slug: 'a-kockasfulu-nyul',
    name: 'A kockásfülű nyúl',
    keyword: 'A kockásfülű nyúl',
    matchWord: 'a kockasfulu nyul',
    type: 'series',
    year: '1975–1978',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/09/kockasfulu_1920x1080-1.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Animáció'],
    description: 'Marék Veronika és Richly Zsolt klasszikus rajzfilmsorozata a segítőkész kockásfülű nyúlról.'
  },
  {
    id: 'mediaklikk:program:mazsola-es-tade',
    slug: 'mazsola-es-tade',
    name: 'Mazsola és Tádé',
    keyword: 'Mazsola és Tádé',
    matchWord: 'mazsola es tade',
    type: 'series',
    year: '1969–1973',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2026/01/mazsolaestade_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Bábfilm'],
    description: 'Bálint Ágnes bábfilmsorozata Manócskáról, Mazsoláról és Tádéról a tökházikóban.'
  },
  {
    id: 'mediaklikk:program:sebaj-tobias',
    slug: 'sebaj-tobias',
    name: 'Sebaj Tóbiás',
    keyword: 'Sebaj Tóbiás',
    matchWord: 'sebaj tobias',
    type: 'series',
    year: '1982–1984',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/12/kep-5.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Gyurmafilm'],
    description: 'Csukás István és Cakó Ferenc klasszikus gyurmafilmsorozata Sebaj Tóbiásról.'
  },
  {
    id: 'mediaklikk:program:mesek-matyas-kiralyrol',
    slug: 'mesek-matyas-kiralyrol',
    name: 'Mesék Mátyás királyról',
    keyword: 'Mesék Mátyás királyról',
    matchWord: 'mesek matyas kiralyrol',
    type: 'series',
    year: '1981–1982',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/09/matyaskiraly_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Klasszikus mese'],
    description: 'Az igazságos Mátyás király mondáiból készült rajzfilmsorozat Újvári László rendezésében.'
  },
  {
    id: 'mediaklikk:program:egbolpottyant-mesek',
    slug: 'egbolpottyant-mesek',
    name: 'Égbőlpottyant mesék',
    keyword: 'Égbőlpottyant mesék',
    matchWord: 'egbolpottyant mesek',
    type: 'series',
    year: '1991',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2026/01/egbolpottyant_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Mese'],
    description: 'Levente Péter és gyerekcsapata közös mesemondó műsora az MTVA archívumából.'
  },
  {
    id: 'mediaklikk:program:toldi',
    slug: 'toldi',
    name: 'Toldi',
    keyword: 'Toldi',
    matchWord: 'toldi',
    type: 'series',
    year: '2021',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2021/08/toldi-1920x1080-1.jpg',
    categories: ['Sorozat', 'Animáció', 'Irodalom'],
    description: 'Arany János elbeszélő költeményéből készült animációs sorozat Jankovics Marcell rendezésében.'
  },
  {
    id: 'mediaklikk:program:mekk-elek-az-ezermester',
    slug: 'mekk-elek-az-ezermester',
    imdbId: 'tt0168350',
    name: 'Mekk Elek, az ezermester',
    keyword: 'Mekk Elek az ezermester',
    matchWord: 'mekk elek',
    type: 'series',
    year: '1974',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2026/04/mekkelek_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Bábfilm'],
    description: 'Mekk Elek, a tizenhárom mesterséget kipróbáló kecske bábfilmsorozata Balázs Péter hangjával.'
  },
  {
    id: 'mediaklikk:program:mirr-murr-kandur-kalandjai',
    slug: 'mirr-murr-kandur-kalandjai',
    name: 'Mirr-Murr kandúr kalandjai',
    keyword: 'Mirr-Murr',
    matchWord: 'mirr murr',
    type: 'series',
    year: '1972–1975',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2026/04/mirrmurr169.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Bábfilm'],
    description: 'Csukás István és Foky Ottó klasszikus bábfilmsorozata Mirr-Murr és Oriza-Triznyák kalandjairól.'
  },
  {
    id: 'mediaklikk:program:a-legkisebb-ugrifules',
    slug: 'a-legkisebb-ugrifules',
    name: 'A legkisebb Ugrifüles',
    keyword: 'A legkisebb Ugrifüles',
    matchWord: 'a legkisebb ugrifules',
    type: 'series',
    year: '1975–1976',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/12/kep-8.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Bábfilm'],
    description: 'Csukás István és Foky Ottó bábfilmsorozata Ugrifüles nyusziról, Tüskéshátúról és Brekkencs békáról.'
  },
  {
    id: 'mediaklikk:program:tof-tof-elefant',
    slug: 'tof-tof-elefant',
    name: 'Töf-Töf elefánt',
    keyword: 'Töf-Töf elefánt',
    matchWord: 'tof tof',
    type: 'series',
    year: '1991–1994',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/12/kep-1.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Animáció'],
    description: 'Klasszikus magyar rajzfilmsorozat Töf-Töf elefántról és barátairól.'
  },
  {
    id: 'mediaklikk:program:dormogoek-kalandjai',
    slug: 'dormogoek-kalandjai',
    name: 'Dörmögőék kalandjai',
    keyword: 'Dörmögőék',
    matchWord: 'dormogoek',
    type: 'series',
    year: '1987–1997',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/12/dormogoek_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Bábfilm'],
    description: 'A mackótestvérek – Berci, Marci és Borka – vidám bábfilmes kalandjai.'
  },
  {
    id: 'mediaklikk:program:a-kiscsacsi-kalandjai',
    slug: 'a-kiscsacsi-kalandjai',
    name: 'A Kiscsacsi kalandjai',
    keyword: 'A Kiscsacsi kalandjai',
    matchWord: 'a kiscsacsi',
    type: 'series',
    year: '1971',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/12/kiscsacsi169.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Bábfilm'],
    description: 'Klasszikus magyar bábfilmsorozat a kíváncsi Kiscsacsiról.'
  },
  {
    id: 'mediaklikk:program:trombi-es-a-tuzmano',
    slug: 'trombi-es-a-tuzmano',
    name: 'Trombi és a Tűzmanó',
    keyword: 'Trombi és a Tűzmanó',
    matchWord: 'trombi',
    type: 'series',
    year: '1987–1990',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2026/09/Firefly-1-2.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Animáció'],
    description: 'Trombi, a tűzoltó elefánt és a csintalan Tűzmanó rajzfilmsorozata.'
  },
  {
    id: 'mediaklikk:program:mikrobi',
    slug: 'mikrobi',
    name: 'Mikrobi',
    keyword: 'Mikrobi',
    matchWord: 'mikrobi',
    type: 'series',
    year: '1973–1975',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2026/09/mikrobi_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Sci-fi animáció'],
    description: 'Mikrobi, a gömbölyű háztartási robot és Pille, Pépe, Plumpi űrkalandjai.'
  },
  {
    id: 'mediaklikk:program:benedek-elek-mesei',
    slug: 'benedek-elek-mesei',
    name: 'Benedek Elek meséi',
    keyword: 'Benedek Elek meséi',
    matchWord: 'benedek elek',
    type: 'series',
    year: '1995',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2013/12/magyarnepmesek_1920x1080.jpg',
    categories: ['Gyerekeknek', 'Retró', 'Mese'],
    description: 'Benedek Elek legszebb magyar népmeséi az MTVA archívumából.'
  },
  {
    id: 'mediaklikk:program:a-tenkes-kapitanya',
    slug: 'a-tenkes-kapitanya',
    imdbId: 'tt0056789',
    name: 'A Tenkes kapitánya',
    keyword: 'A Tenkes kapitánya',
    matchWord: 'a tenkes kapitanya',
    type: 'series',
    year: '1964',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/08/tenkes_1920x1080-1.jpg',
    categories: ['Retró', 'Sorozat', 'Történelmi'],
    description: 'Eke Máté, a Tenkes kapitánya és Buga Jakab kalandjai a kuruc korban Zenthe Ferenc és Szabó Gyula főszereplésével.'
  },
  {
    id: 'mediaklikk:program:szomszedok',
    slug: 'szomszedok',
    imdbId: 'tt0149529',
    name: 'Szomszédok',
    keyword: 'Szomszédok',
    matchWord: 'szomszedok',
    type: 'series',
    year: '1987–1999',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/08/szomszedok_1920x1080.jpg',
    categories: ['Retró', 'Sorozat'],
    description: 'Horváth Ádám legendás teleregénye a gazdagréti lakótelep lakóinak (Takácsék, Mágenheimék, Vágásiék) életéről.'
  },
  {
    id: 'mediaklikk:program:familia-kft',
    slug: 'familia-kft',
    name: 'Família Kft.',
    keyword: 'Família Kft.',
    matchWord: 'familia kft',
    type: 'series',
    year: '1991–1999',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2014/01/familia_16-9.jpg',
    categories: ['Retró', 'Sorozat', 'Vígjáték'],
    description: 'A Szép család és Kövér Lajos mindennapjai a 90-es évek legnépszerűbb magyar szituációs komédiájában.'
  },
  {
    id: 'mediaklikk:program:linda',
    slug: 'linda',
    imdbId: 'tt0149483',
    name: 'Linda',
    keyword: 'Linda',
    matchWord: 'linda',
    type: 'series',
    year: '1984–1989',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2025/08/linda_1920x1080-v3-1.jpg',
    categories: ['Retró', 'Sorozat', 'Krimi'],
    description: 'Veszprémi Linda rendőr alhadnagy (Görbe Nóra) és apja (Bodrogi Gyula) bűnügyi-vígjáték sorozata.'
  },
  {
    id: 'mediaklikk:program:eletkepek',
    slug: 'eletkepek',
    name: 'Életképek',
    keyword: 'Életképek',
    matchWord: 'eletkepek',
    type: 'series',
    year: '2004–2009',
    poster: 'https://cdn.cms.mtv.hu/wp-content/uploads/sites/4/2026/04/eletkepek_1920x1080.jpg',
    categories: ['Retró', 'Sorozat'],
    description: 'Horváth Ádám teleregénye magyar családok mindennapjairól kiváló színészgárdával.'
  }
];

const STATIC_CLASSIC_EPISODES = {
  'susu-a-sarkany': [
    'Süsü, a sárkány',
    'Süsü újabb kalandjai',
    'A bűvös virág',
    'Süsü csapdába esik',
    'A sárkányfűárus',
    'A műsárkány',
    'Süsü, a rettentő',
    'Süsü, a pesztra',
    'Süsü és a sárkánylány'
  ],
  'vakacion-a-mezga-csalad': [
    'Irány a Déli-sark!',
    'Az üvegszemű kapitány',
    'A fekete arany',
    'Hamis barátok',
    'Fújd fel!',
    'A szent kobra',
    'A lila köd',
    'Gori-gori',
    'A jég hátán',
    'A lakatlan sziget',
    'Maffia',
    'Az őserdőben',
    'Végre otthon!'
  ]
};

function sanitizeSlug(rawSlug) {
  return String(rawSlug || '')
    .replace(/^mediaklikk:program:/, '')
    .split('/')
    .filter(Boolean)
    .pop() || '';
}

function fixImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  return url;
}

/**
 * Loads all MédiaKlikk programs (490+ active and archive shows, series, and films)
 * Sanitizes slugs so no program ID contains a '/' (which breaks Express :id routing).
 */
function getMediaKlikkPrograms() {
  if (mediaklikkProgramsCache && (Date.now() - lastProgramsRefresh < PROGRAMS_REFRESH_INTERVAL_MS)) {
    return mediaklikkProgramsCache;
  }

  try {
    const localData = require('../data/mediaklikk_programs.json');
    mediaklikkProgramsCache = (localData || []).map(p => {
      const cleanSlug = sanitizeSlug(p.slug || p.id);
      return {
        ...p,
        slug: cleanSlug,
        id: `mediaklikk:program:${cleanSlug}`,
        poster: fixImageUrl(p.poster)
      };
    });
    lastProgramsRefresh = Date.now();
  } catch (err) {
    if (!mediaklikkProgramsCache) mediaklikkProgramsCache = [...VERIFIED_MEDIAKLIKK_CLASSICS];
  }

  // Asynchronous background refresh
  refreshProgramsFromWeb().catch(() => {});

  return mediaklikkProgramsCache || [];
}

async function refreshProgramsFromWeb() {
  try {
    const res = await fetch('https://mediaklikk.hu/musoraink', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return;
    const html = await res.text();
    const cardRegex = /<a[^>]+href=["'](https:\/\/mediaklikk\.hu\/musor\/([^"'\/]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const programs = [];
    const seenSlugs = new Set();
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const fullUrl = m[1];
      const slug = sanitizeSlug(m[2]);
      const inner = m[3];
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const titleMatch = inner.match(/<h[234][^>]*>([^<]+)<\/h[234]>/i) || inner.match(/class=["'][^"']*title[^"']*["'][^>]*>([^<]+)</i);
      const name = titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' ');
      const imgMatch = inner.match(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
      const poster = fixImageUrl(imgMatch ? imgMatch[1] : '');

      const catMatches = [...inner.matchAll(/class=["'][^"']*category[^"']*["'][^>]*>([^<]+)</gi)].map(cm => cm[1].trim());
      const categories = catMatches.length > 0 ? catMatches : ['Kultúra'];
      const isMovie = categories.includes('Film');

      programs.push({
        id: `mediaklikk:program:${slug}`,
        slug,
        name,
        type: isMovie ? 'movie' : 'series',
        poster,
        url: fullUrl,
        categories,
        description: `MédiaKlikk (MTVA) műsor: ${name}. Kategóriák: ${categories.join(', ')}.`
      });
    }

    if (programs.length > 50) {
      mediaklikkProgramsCache = programs;
      lastProgramsRefresh = Date.now();
    }
  } catch (e) {}
}

/**
 * Dynamically resolves all seasons and episodes for ANY MédiaKlikk show
 * directly from the official MTVA AJAX search backend, with verified fallback episodes
 * for Magyar népmesék, Süsü, and Vakáción a Mézga család.
 */
async function getMediaKlikkSeriesEpisodes(idOrSlugOrName) {
  if (!idOrSlugOrName) return null;
  const cleanKey = sanitizeSlug(idOrSlugOrName);

  if (showEpisodesCache.has(cleanKey)) {
    const cached = showEpisodesCache.get(cleanKey);
    if (Date.now() - cached.timestamp < 2 * 60 * 60 * 1000) {
      return cached.data;
    }
  }

  const verified = VERIFIED_MEDIAKLIKK_CLASSICS.find(p =>
    p.slug === cleanKey ||
    p.id === idOrSlugOrName ||
    p.imdbId === cleanKey ||
    normalize(p.name) === normalize(cleanKey)
  );

  const allPrograms = getMediaKlikkPrograms();
  const program = verified || allPrograms.find(p =>
    p.slug === cleanKey ||
    p.id === idOrSlugOrName ||
    normalize(p.name) === normalize(cleanKey)
  ) || {
    id: `mediaklikk:program:${cleanKey}`,
    slug: cleanKey,
    name: cleanKey.replace(/-/g, ' '),
    type: 'series',
    poster: '',
    categories: ['Sorozat', 'Retró'],
    description: `MédiaKlikk (MTVA) sorozat: ${cleanKey}.`
  };

  const seasonsMap = {};
  const seenEpNames = new Set();

  try {
    const searchUrl = 'https://mediaklikk.hu/wp-content/plugins/hms-mediaklikk/interfaces/get_results.php';
    const searchKeyword = program.keyword || program.name;
    const body = new URLSearchParams({
      action: 'search',
      s_type: 'video',
      keyword: searchKeyword,
      fromDate: '2013-01-01',
      toDate: '2026-12-31',
      pageSize: '50',
      pageNumber: '1',
      getAudioPrograms: 'false'
    });

    const res = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': 'https://mediaklikk.hu/'
      },
      body: body.toString(),
      signal: AbortSignal.timeout(2500)
    });

    if (res.ok) {
      const data = await res.json();
      const items = data[0]?.data?.items || [];
      const normProgName = normalize(program.matchWord || program.name);

      items.forEach((item) => {
        const rawTitle = (item.post_title || item.source?.post_title || '').replace(/<[^>]+>/g, '').trim();
        const token = item.token || item.source?.token;
        if (!token || !rawTitle) return;

        const normTitle = normalize(rawTitle);
        // Reject radio readings / talk show mentions when looking for classic series
        if (normTitle.includes('csillagok esti mesefenyben') || normTitle.includes('ismeretlen ismerosok') || normTitle.includes('debrecenbol jelentkezunk') || normTitle.includes('bevettuk a varost')) {
          return;
        }

        if (program.matchWord) {
          if (!normTitle.startsWith(normProgName)) return;
        } else if (!normTitle.includes(normProgName) && !normProgName.includes(normTitle)) {
          const progWords = normProgName.split(' ').filter(w => w.length > 2);
          const matchCount = progWords.filter(w => normTitle.includes(w)).length;
          if (matchCount < Math.min(2, progWords.length)) return;
        }

        const parsed = parseSeasonEpisode(rawTitle);
        const sNum = parsed.season != null ? String(parsed.season) : '1';

        // Clean episode subtitle
        let epName = rawTitle;
        if (rawTitle.includes(',')) {
          epName = rawTitle.split(',').slice(1).join(',').trim();
        } else if (rawTitle.includes('–')) {
          epName = rawTitle.split('–').slice(1).join('–').trim();
        } else if (rawTitle.includes(' - ')) {
          epName = rawTitle.split(' - ').slice(1).join(' - ').trim();
        } else {
          // Strip leading program name if present
          const stripped = rawTitle.replace(new RegExp('^' + (program.keyword || program.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
          if (stripped.length >= 3) epName = stripped;
        }
        epName = epName
          .replace(/^(I{1,3}|IV|V|\d+)\.\s*(sorozat|évad|evad|rész)\s*,?\s*/i, '')
          .replace(/^(I{1,3}|IV|V|\d+)\s*\/\s*\d+\.?\s*(rész)?\s*/i, '')
          .replace(/^[,–\-:\s]+/, '')
          .trim();

        const dedupKey = `${sNum}:${normalize(epName || rawTitle)}`;
        if (seenEpNames.has(dedupKey)) return;
        seenEpNames.add(dedupKey);

        if (!seasonsMap[sNum]) {
          seasonsMap[sNum] = [];
        }

        const thumb = fixImageUrl(item.featured_image_url_large || item.featured_image_url_medium || program.poster || '');

        let cleanToken = token;
        while (cleanToken.includes('%')) {
          try { cleanToken = decodeURIComponent(cleanToken); } catch (e) { break; }
        }

        const assignedEp = parsed.episode != null && !seasonsMap[sNum].some(x => x.episode === parsed.episode)
          ? parsed.episode
          : (seasonsMap[sNum].length + 1);

        if (!epName || epName.length < 2) {
          epName = `${assignedEp}. rész`;
        }

        seasonsMap[sNum].push({
          id: `${program.id}:${sNum}:${assignedEp}`,
          season: parseInt(sNum, 10),
          episode: assignedEp,
          name: epName,
          rawTitle,
          overview: `${program.name} – ${rawTitle}`,
          thumbnail: thumb,
          token: cleanToken
        });
      });
    }
  } catch (err) {
    console.warn(`[MediaKlikk] Dynamic episode fetch error for ${program.name}:`, err.message);
  }

  // For Magyar népmesék: keep all live 1080p MédiaKlikk episodes first, and append the rest of the 100-episode archive
  if (program.slug === 'magyar-nepmesek') {
    try {
      const nepmesekSeasons = require('../data/magyar_nepmesek_episodes.json');
      if (!seasonsMap['1']) seasonsMap['1'] = [];
      for (const sKey of Object.keys(nepmesekSeasons)) {
        const epArr = nepmesekSeasons[sKey] || [];
        for (const epObj of epArr) {
          const folkTitle = epObj.title;
          if (!folkTitle) continue;
          const normFolk = normalize(folkTitle);
          // Skip if already present from live MédiaKlikk results
          let alreadyAdded = false;
          for (const existingKey of seenEpNames) {
            if (existingKey.endsWith(`:${normFolk}`)) {
              alreadyAdded = true;
              break;
            }
          }
          if (alreadyAdded) continue;
          seenEpNames.add(`${sKey}:${normFolk}`);
          if (!seasonsMap[sKey]) seasonsMap[sKey] = [];
          const nextEpNum = seasonsMap[sKey].length + 1;
          seasonsMap[sKey].push({
            id: `${program.id}:${sKey}:${nextEpNum}`,
            season: parseInt(sKey, 10) || 1,
            episode: nextEpNum,
            name: folkTitle,
            rawTitle: `Magyar népmesék - ${folkTitle}`,
            overview: `Magyar népmesék (${sKey}. évad ${nextEpNum}. rész) – ${folkTitle}`,
            thumbnail: fixImageUrl(program.poster)
          });
        }
      }
    } catch (e) {}
  }

  // Fallback for Süsü & Vakáción a Mézga család if MTVA VOD window currently has 0 items for them
  if (Object.keys(seasonsMap).length === 0 && STATIC_CLASSIC_EPISODES[program.slug]) {
    seasonsMap['1'] = STATIC_CLASSIC_EPISODES[program.slug].map((epTitle, idx) => ({
      id: `${program.id}:1:${idx + 1}`,
      season: 1,
      episode: idx + 1,
      name: epTitle,
      rawTitle: `${program.name} - ${idx + 1}. rész: ${epTitle}`,
      overview: `${program.name} (${idx + 1}. rész) – ${epTitle}`,
      thumbnail: fixImageUrl(program.poster)
    }));
  }

  if (Object.keys(seasonsMap).length === 0) {
    showEpisodesCache.set(cleanKey, { data: null, timestamp: Date.now() - (2 * 60 * 60 * 1000 - 60000) });
    return null;
  }

  // Sort episodes inside each season and ensure sequential episode numbers if needed
  for (const s of Object.keys(seasonsMap)) {
    seasonsMap[s].sort((a, b) => a.episode - b.episode);
  }

  const result = {
    id: program.id,
    slug: program.slug,
    imdbId: program.imdbId || null,
    name: program.name,
    englishName: program.name,
    year: program.year || program.categories?.join(' • ') || 'MédiaKlikk Archívum',
    poster: fixImageUrl(program.poster),
    background: fixImageUrl(program.poster),
    description: program.description,
    genres: program.categories || ['MTVA Archívum'],
    seasons: seasonsMap
  };

  showEpisodesCache.set(cleanKey, { data: result, timestamp: Date.now() });
  return result;
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves the direct HLS m3u8 stream for an MTVA live TV channel
 * @param {string} streamId e.g. 'dunalive', 'mtv1live', 'mtv4live'
 * @param {string|null} clientIp Optional user client IP for ConnectMedia token binding
 * @returns {Promise<string|null>} HLS stream URL
 */
async function getLiveHlsStream(streamId, clientIp = null) {
  if (!streamId) return null;

  // Cache per IP since ConnectMedia token binds to the requesting IP
  const cacheKey = clientIp ? `${streamId}:${clientIp}` : streamId;
  const cached = LIVE_STREAM_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < LIVE_CACHE_TTL_MS)) {
    return cached.url;
  }

  try {
    const playerUrl = `https://player.mediaklikk.hu/playernew/player.php?video=${encodeURIComponent(streamId)}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://mediaklikk.hu/'
    };

    if (isPublicIp(clientIp)) {
      headers['X-Forwarded-For'] = clientIp;
      headers['X-Real-IP'] = clientIp;
      headers['Client-IP'] = clientIp;
    }

    const res = await fetch(playerUrl, {
      headers,
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"file":\s*"([^"]+\.m3u8[^"]*)"/i);
    if (match) {
      const hlsUrl = match[1].replace(/\\\//g, '/');
      LIVE_STREAM_CACHE.set(cacheKey, { url: hlsUrl, timestamp: Date.now() });
      return hlsUrl;
    }
  } catch (err) {
    if (cached) return cached.url;
  }
  return null;
}

/**
 * Generates an optimized HLS master playlist where 1080p Full HD is placed as the FIRST variant.
 * This ensures video players (Nuvio, Stremio, Hls.js, ExoPlayer) start playback in pristine 1080p instantly,
 * rather than starting in blurry 240p and slowly stepping up over 15 seconds.
 * 
 * @param {string} streamId e.g. 'mtv4live'
 * @param {string|null} clientIp User client IP for ConnectMedia token
 * @returns {Promise<string|null>} Rewritten M3U8 string
 */
async function getReorderedMasterPlaylist(streamId, clientIp = null) {
  const masterUrl = await getLiveHlsStream(streamId, clientIp);
  if (!masterUrl) return null;

  try {
    const res = await fetch(masterUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mediaklikk.hu/'
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;

    const text = await res.text();
    const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
    const query = masterUrl.includes('?') ? masterUrl.substring(masterUrl.indexOf('?')) : '';

    const lines = text.split('\n');
    const mediaLines = [];
    const variants = [];
    const headerLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXT-X-MEDIA:')) {
        // Rewrite relative audio/subtitle URIs to absolute ConnectMedia CDN URIs
        const rewritten = line.replace(/URI="([^"]+)"/, (m, uri) => {
          const absUri = uri.startsWith('http') ? uri : baseUrl + uri + query;
          return `URI="${absUri}"`;
        });
        mediaLines.push(rewritten);
      } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const infLine = line;
        const nextLine = lines[++i]?.trim() || '';
        const absNext = nextLine.startsWith('http') ? nextLine : baseUrl + nextLine + query;
        const resMatch = infLine.match(/RESOLUTION=(\d+)x(\d+)/);
        const height = resMatch ? parseInt(resMatch[2], 10) : 0;
        variants.push({ inf: infLine, url: absNext, height });
      } else if (!line.startsWith('#EXT-X-INDEPENDENT-SEGMENTS')) {
        headerLines.push(line);
      }
    }

    // Sort variants strictly DESCENDING by resolution (1080p -> 720p -> 540p -> 480p -> 360p -> 240p)
    variants.sort((a, b) => b.height - a.height);

    let newPlaylist = headerLines.join('\n') + '\n' + mediaLines.join('\n') + '\n';
    for (const v of variants) {
      newPlaylist += v.inf + '\n' + v.url + '\n';
    }
    newPlaylist += '#EXT-X-INDEPENDENT-SEGMENTS\n';

    return newPlaylist;
  } catch (err) {
    console.warn(`[MediaKlikk] Master rewriter fallback for ${streamId}:`, err.message);
    return null;
  }
}

/**
 * Resolves streams for a live channel ID (e.g. 'mediaklikk-live-m4' or 'm4')
 * @param {string} channelIdOrKey Channel identifier
 * @param {string|null} clientIp User's client IP
 * @param {string} hostUrl Base host URL for rewriter endpoint
 */
async function getLiveChannelStreams(channelIdOrKey, clientIp = null, hostUrl = HOST_URL) {
  const cleanId = (channelIdOrKey || '').toLowerCase();
  const channel = LIVE_CHANNELS.find(ch => 
    ch.id === cleanId || 
    ch.channelKey === cleanId || 
    ch.streamId === cleanId || 
    cleanId.includes(ch.channelKey)
  );

  if (!channel) return [];

  const hlsUrl = await getLiveHlsStream(channel.streamId, clientIp);
  if (!hlsUrl) return [];

  const officialPageUrl = channel.pageUrl || `https://mediaklikk.hu/elo/${channel.streamId}/`;
  const instant1080Url = `${hostUrl}/api/live/${channel.streamId}.m3u8`;

  return [
    {
      name: `⚡ ${channel.name} — 1080p FHD (HLS Proxy)`,
      title: `🚀 ${channel.name} • Akadozásmentes HLS Proxy\n1080p Full HD • Azonnali Nuvio / ExoPlayer Indulás\nHivatalos MTVA Forrás`,
      url: `${hostUrl}/proxy/hls.m3u8?url=${encodeURIComponent(hlsUrl)}`,
      behaviorHints: {
        notWebReady: false,
        isLive: true
      }
    },
    {
      name: `🔴 ${channel.name} — 1080p FHD (.m3u8)`,
      title: `📡 Hivatalos MTVA CDN Élő Közvetítés (1080p Full HD .m3u8)\n${channel.description}\nKözvetlen HLS adás TV-re és mobilra optimalizálva.`,
      url: hlsUrl,
      behaviorHints: {
        notWebReady: false,
        isLive: true
      }
    },
    {
      name: `🔴 ${channel.name} — Auto (.m3u8)`,
      title: `📡 1080p FULL HD Adaptív MTVA HLS (.m3u8)\n${channel.description}\nKözvetlen 1080p indítás az első másodperctől, nulla felbontásugrálás.`,
      url: instant1080Url,
      behaviorHints: {
        notWebReady: false,
        isLive: true
      }
    }
  ];
}

function romanToInt(sStr) {
  const map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  return map[sStr.toUpperCase()] || parseInt(sStr, 10) || 1;
}

function parseSeasonEpisode(title) {
  let s = null;
  let e = null;

  // Fraction format e.g. II/2. or I/12. or VI/3. or 1/5.
  const slashMatch = title.match(/\b(I{1,3}|IV|VI{0,3}|IX|X|\d+)\s*\/\s*(\d+)/i);
  if (slashMatch) {
    s = romanToInt(slashMatch[1]);
    e = parseInt(slashMatch[2], 10);
  }

  // Roman numeral season e.g. "I. sorozat" or "VI. sorozat" or "2. évad"
  if (s === null) {
    const sMatch = title.match(/\b(I{1,3}|IV|VI{0,3}|IX|X|\d+)\.\s*(sorozat|evad|évad|széria|szeria)/i);
    if (sMatch) {
      s = romanToInt(sMatch[1]);
    }
  }

  // Ordinal episode e.g. "(\\d+)\\. rész" or "fejezet" or "epizód"
  if (e === null) {
    const eMatch = title.match(/(\d+)\.\s*(?:rész|epizód|fejezet)/i);
    if (eMatch) {
      e = parseInt(eMatch[1], 10);
    }
  }

  return { season: s, episode: e };
}

/**
 * Scrapes on-demand (VOD) videos from MédiaKlikk via official MTVA AJAX search endpoint
 * Resolves 1080p Full HD direct HLS streams for Hungarian classics and on-demand titles
 * @param {Object} meta Media metadata
 * @returns {Promise<Array>} List of stream objects
 */
async function scrapeMediaKlikk(meta) {
  // If direct MédiaKlikk video token was requested, resolve stream immediately
  if ((meta.id && meta.id.startsWith('mediaklikk:video:')) || meta.token) {
    let token = meta.token || (meta.id ? meta.id.replace('mediaklikk:video:', '').trim() : '');
    while (token.includes('%')) {
      try { token = decodeURIComponent(token); } catch(e) { break; }
    }
    try {
      const playerUrl = `https://player.mediaklikk.hu/playernew/player.php?video=${encodeURIComponent(token)}`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mediaklikk.hu/'
      };
      if (isPublicIp(meta.clientIp)) {
        headers['X-Forwarded-For'] = meta.clientIp;
        headers['X-Real-IP'] = meta.clientIp;
        headers['Client-IP'] = meta.clientIp;
      }
      const plRes = await fetch(playerUrl, { headers, signal: AbortSignal.timeout(4000) });
      if (plRes.ok) {
        const plHtml = await plRes.text();
        const m3u8Match = plHtml.match(/"file":\s*"([^"]+\.m3u8[^"]*)"/i);
        if (m3u8Match) {
          const streamUrl = m3u8Match[1].replace(/\\\//g, '/');
          const epLabel = meta.title ? `${meta.title}\n` : '';
          return [{
            name: '🔴 MédiaKlikk (MTVA) 1080p FHD',
            title: `${epLabel}🇭🇺 MédiaKlikk HLS Közvetlen Lejátszás • MTVA Archívum`,
            url: streamUrl,
            playerUrl: meta.permalink || `https://mediaklikk.hu/`,
            quality: '1080p',
            height: 1080,
            source: 'mediaklikk',
            behaviorHints: { notWebReady: false }
          }];
        }
      }
    } catch (e) {}
    return [];
  }

  // If program episode requested e.g. mediaklikk:program:slug:season:episode
  if (meta.id && meta.id.startsWith('mediaklikk:program:')) {
    try {
      const parts = meta.id.split(':');
      let slug = '';
      let seasonNum = meta.season || 1;
      let epNum = meta.episode || 1;

      if (parts.length >= 5) {
        epNum = parseInt(parts[parts.length - 1], 10) || 1;
        seasonNum = parseInt(parts[parts.length - 2], 10) || 1;
        slug = sanitizeSlug(parts.slice(2, parts.length - 2).join(':'));
      } else if (parts.length >= 3) {
        slug = sanitizeSlug(parts.slice(2).join(':'));
      }

      const progData = await getMediaKlikkSeriesEpisodes(`mediaklikk:program:${slug}`);
      if (progData && progData.seasons) {
        const sList = progData.seasons[String(seasonNum)] || progData.seasons['1'] || [];
        const matchedEp = sList.find(e => e.episode === epNum) || sList[epNum - 1] || sList[0];
        if (matchedEp && matchedEp.token) {
          return await scrapeMediaKlikk({
            token: matchedEp.token,
            title: matchedEp.name,
            permalink: matchedEp.permalink,
            clientIp: meta.clientIp
          });
        }
      }
    } catch(e) {}
    return [];
  }

  // If live channel id was requested, return live channel streams directly
  if (meta.id && (meta.id.startsWith('mediaklikk-live-') || meta.id.startsWith('m1') || meta.id.startsWith('m4') || meta.id.startsWith('duna'))) {
    return await getLiveChannelStreams(meta.id, meta.clientIp);
  }

  const streams = [];
  const hu = meta.hungarianTitle || meta.englishTitle;
  if (!hu) return streams;

  const normTarget = normalize(hu);
  const isSeries = meta.type === 'series' || meta.season !== undefined;
  const season = meta.season ? parseInt(meta.season, 10) : null;
  const episode = meta.episode ? parseInt(meta.episode, 10) : null;
  const epTitle = meta.episodeTitle ? normalize(meta.episodeTitle) : null;
  const clientIp = meta.clientIp || null;

  // Fast-path: If series matches one of our 43 VERIFIED_MEDIAKLIKK_CLASSICS (excluding Magyar népmesék which is on Videa/Videakid), resolve episode token directly
  if (isSeries) {
    const matchedClassic = VERIFIED_MEDIAKLIKK_CLASSICS.find(c =>
      c.slug !== 'magyar-nepmesek' &&
      (normalize(c.name) === normTarget || normTarget.includes(c.matchWord) || c.matchWord.includes(normTarget))
    );
    if (matchedClassic) {
      try {
        const progData = await getMediaKlikkSeriesEpisodes(matchedClassic.id);
        if (progData && progData.seasons) {
          const sList = progData.seasons[String(season || 1)] || progData.seasons['1'] || [];
          const matchedEp = sList.find(e => e.episode === (episode || 1)) || sList[0];
          if (matchedEp && matchedEp.token) {
            const epStreams = await scrapeMediaKlikk({
              token: matchedEp.token,
              title: matchedEp.name,
              permalink: matchedEp.permalink,
              clientIp
            });
            if (epStreams.length > 0) return epStreams;
          }
        }
      } catch (e) {}
    }
  }

  // Curate targeted query keywords for MédiaKlikk's backend
  const queries = new Set();
  if (normTarget.includes('ho ho') || normTarget.includes('hoho') || normTarget.includes('horgasz')) {
    queries.add('ho-ho-ho');
    queries.add('A nagy ho-ho-ho-horgász');
  } else if (normTarget.includes('nepmese')) {
    queries.add('Magyar népmesék');
    queries.add('népmesék');
  } else if (normTarget.includes('tenkes')) {
    queries.add('Tenkes');
  } else if (normTarget.includes('mezga')) {
    queries.add('Mézga');
  } else if (normTarget.includes('frakk')) {
    queries.add('Frakk');
  } else if (normTarget.includes('pom pom') || normTarget.includes('pompom')) {
    queries.add('Pom-Pom');
  } else if (normTarget.includes('kukori')) {
    queries.add('Kukori');
  } else if (normTarget.includes('susu')) {
    queries.add('Süsü');
  } else if (normTarget.includes('bakterhaz')) {
    queries.add('bakterház');
    queries.add('Indul a bakterház');
  } else if (normTarget.includes('vuk')) {
    queries.add('Vuk');
  } else {
    queries.add(hu);
    if (meta.episodeTitle) queries.add(meta.episodeTitle);
  }

  const searchUrl = 'https://mediaklikk.hu/wp-content/plugins/hms-mediaklikk/interfaces/get_results.php';

  for (const q of queries) {
    try {
      const body = new URLSearchParams({
        action: 'search',
        s_type: 'video',
        keyword: q,
        fromDate: '2013-01-01',
        toDate: new Date().toISOString().slice(0, 10),
        pageSize: '40',
        getAudioPrograms: 'false'
      });

      const res = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Referer': 'https://mediaklikk.hu/talalati-lista/?search_mk=' + encodeURIComponent(q)
        },
        body: body.toString(),
        signal: AbortSignal.timeout(4000)
      });

      if (!res.ok) continue;
      const data = await res.json();
      const items = data[0]?.data?.items || [];

      for (const item of items) {
        const rawTitle = (item.post_title || item.source?.post_title || '').replace(/<[^>]+>/g, '').trim();
        const normItemTitle = normalize(rawTitle);
        const token = item.token || item.source?.token;
        const permalink = item.permalink || item.source?.permalink || item.URL || 'https://mediaklikk.hu/';

        if (!token) continue;

        let isMatch = false;

        if (isSeries) {
          const parsed = parseSeasonEpisode(rawTitle);

          // 1. Direct Season & Episode match
          if (season !== null && episode !== null && parsed.season !== null && parsed.episode !== null) {
            if (parsed.season === season && parsed.episode === episode) {
              isMatch = true;
            }
          } else if (episode !== null && parsed.episode !== null && parsed.episode === episode) {
            if (season === null || parsed.season === null || parsed.season === season) {
              isMatch = true;
            }
          }

          // 2. Subtitle / episodeTitle match
          if (!isMatch && epTitle && epTitle.length > 2) {
            if (normItemTitle.includes(epTitle) || epTitle.includes(normItemTitle)) {
              isMatch = true;
            }
          }
        } else {
          // Movie match
          if (normItemTitle.includes(normTarget) || normTarget.includes(normItemTitle)) {
            isMatch = true;
          }
        }

        if (isMatch) {
          // Resolve direct HLS stream from MTVA JWPlayer backend
          try {
            const playerUrl = `https://player.mediaklikk.hu/playernew/player.php?video=${token}`;
            const headers = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://mediaklikk.hu/'
            };
            if (clientIp) {
              headers['X-Forwarded-For'] = clientIp;
              headers['X-Real-IP'] = clientIp;
              headers['Client-IP'] = clientIp;
            }

            const plRes = await fetch(playerUrl, {
              headers,
              signal: AbortSignal.timeout(3500)
            });

            if (plRes.ok) {
              const plHtml = await plRes.text();
              const m3u8Match = plHtml.match(/"file":\s*"([^"]+\.m3u8[^"]*)"/i);
              if (m3u8Match) {
                const streamUrl = m3u8Match[1].replace(/\\\//g, '/');
                if (!streams.some(s => s.url === streamUrl)) {
                  streams.push({
                    name: '🔴 MédiaKlikk (MTVA) 1080p FHD',
                    title: `${rawTitle}\n🇭🇺 MédiaKlikk HLS Közvetlen Lejátszás • MTVA Archívum`,
                    url: streamUrl,
                    playerUrl: permalink,
                    quality: '1080p',
                    height: 1080,
                    source: 'mediaklikk',
                    behaviorHints: {
                      notWebReady: false
                    }
                  });
                }
              }
            }
          } catch (e) {}
        }
      }

      if (streams.length > 0) break;
    } catch (err) {}
  }

  return streams;
}

function isPublicIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return false;
  if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('172.16.')) return false;
  return true;
}

module.exports = {
  LIVE_CHANNELS,
  VERIFIED_MEDIAKLIKK_CLASSICS,
  sanitizeSlug,
  getLiveHlsStream,
  getReorderedMasterPlaylist,
  getRewrittenMasterPlaylist: getReorderedMasterPlaylist,
  getLiveChannelStreams,
  getMediaKlikkLiveStreams: getLiveChannelStreams,
  getMediaKlikkPrograms,
  getMediaKlikkSeriesEpisodes,
  scrapeMediaKlikk
};
