# Magyar Streaming Pro (`nuvio-magyar-http`) — Master Agent Handoff & Architecture Guide

> [!IMPORTANT]
> **KÖTELEZŐ UTASÍTÁSOK AZ ÚJ AGENTNEK (Flash 3.8 High / Antigravity):**
> 1. **Nyelv és kommunikáció**: Mindig magyarul válaszolj, tömören, lényegretörően, és minden említett fájlhoz/függvényhez tegyél kattintható `file:///` markdown linket (pl. `[addon.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/addon.js)`).
> 2. **Minőségi elvárás**: Soha ne használj félmegoldást vagy teszteletlen kódot. Minden módosítás után valódi HTTP/Node teszttel ellenőrizd le a végpontokat (`/manifest.json`, `/catalog/...`, `/meta/...`, `/stream/...`).
> 3. **Vercel / GitHub Push szabály**: Ha a felhasználó azt kéri, hogy előbb helyi **self-host** szerveren (`http://localhost:7000` / `http://192.168.1.128:7000`) tesztelhessétek, akkor **NE csinálj `git push`-t**, amíg kifejezetten nem kéri! Amikor viszont élesítést kér a Vercelre, mindig frissítsd a verziószámot (`package.json`, `src/addon.js`, `public/index.html`), commitolj, pusholj az `origin main` ágra, és ellenőrizd le élőben a `https://nuvio-magyar-http.vercel.app/manifest.json` végpontot.

---

## 1. Projekt Elérhetőségek és Mappák

| Elem | Elérési út / URL |
| :--- | :--- |
| **Projekt gyökérkönyvtár (Workspace)** | `C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http` |
| **GitHub Repository** | `https://github.com/Player798xy/nuvio-magyar-http.git` (`main` branch) |
| **Éles Vercel szerver** | `https://nuvio-magyar-http.vercel.app` |
| **Éles Konfigurátor UI** | `https://nuvio-magyar-http.vercel.app/configure` (Régi UI backup: `/configure?old=1`) |
| **Éles Manifest URL** | `https://nuvio-magyar-http.vercel.app/manifest.json` |
| **Helyi Self-Host Szerver (PC)** | `http://localhost:7000/configure` és `http://localhost:7000/manifest.json` |
| **Helyi Self-Host (Wi-Fi / LAN)** | `http://192.168.1.128:7000/manifest.json` (Nuvio / Stremio telefonos és TV-s teszthez) |
| **Tailscale IP (távoli teszthez)** | `http://100.72.171.98:7000/manifest.json` |
| **Scrapelt `onlinestream.live` JSON adatbázis** | `C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json` |
| **Szortírozott TV táblázat dokumentum** | `C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\onlinestream_tv_tabla.md` |

---

## 2. Jelenlegi Állapot (Git & Helyi Módosítások)

### Mi van már fent élesben a GitHubon és a Vercelen (`v2.6.4`, commit `84b85c1`):
- **Stremio `stremio-core` (Rust Serde) 100%-os kompatibilitás** (`v2.5.4`).
- **Dinamikus sorozat évad- és epizódválasztó** (`v2.5.5`) a weboldal keresőjében (`CH 04`), amely Cinemeta + MédiaKlikk + TMDB alapján lekéri a sorozat valódi évad- és epizódszámát.
- **1. verziójú végleges logó** (`v2.6.0`): Fehér TV-keret (`#ececec`), fehér `HU`, piros `▶` (`#dc2626`) és alul magas vízszintes magyar zászló ([public/logo.svg](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/public/logo.svg), [public/logo.png](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/public/logo.png), [public/icon.png](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/public/icon.png), [public/favicon.ico](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/public/favicon.ico)).
- **Mobilra optimalizált fejléc és letisztult mikro-animációk** (`v2.6.1`–`v2.6.2`).
- **Szóeleji határ (`(?:^|\s)`) keresési javítás** (`v2.6.3`), hogy az *„Agymenők”* soha ne találja meg a *„Nagymenők”*-et, valamint szigorú évad-ellenőrzés (`matchesEpisode`).
- **Lenyíló (dropdown) menük** (`v2.6.4`) a weboldalon.

### Mi van jelenleg HELYILEG (még nincs commitolva/pusholva Vercelre, mert a felhasználó self-hostban teszteli):
1. **6 ÚJ Élő TV katalógus (a régi `hu-live-tv` helyett)** összesen **146 magyar TV csatornával** népszerűségi sorrendben:
   - `hu-live-orszagos` — **🔴 Élő TV: Országos & Kereskedelmi (28 adó)**: *RTL, TV2, M1, Duna, Super TV2, RTL Kettő, RTL Három, Viasat 3, ATV, Hír TV, Prime, TV4, Viasat 6, RTL Gold, M2, Duna World, M5...*
   - `hu-live-film` — **🎬 Élő TV: Film & Sorozat (21 adó)**: *Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO, HBO 2, HBO 3, Film4, TV2 Comedy, Sorozat+, Film Café, AXN Black, Galaxy 4, Max4, Izaura TV...*
   - `hu-live-doksi` — **🌍 Élő TV: Ismeretterjesztő & Doksi (6 adó)**: *National Geographic, History, Spektrum, Nat Geo Wild, Spektrum Home, Ozone TV*
   - `hu-live-sport` — **⚽ Élő TV: Sport, Zene & Életmód (19 adó)**: *M4 Sport, Spíler 1–2, Sport 1–2, Arena4, Match 4, TV Paprika, TLC, TV2 Séf, Sláger TV, Muzsika TV, Zenebutik...*
   - `hu-live-gyerek` — **🧸 Élő TV: Rajzfilm & Gyerek (8 adó)**: *Minimax, Nickelodeon, Disney Channel, Nick Jr, Nicktoons, TV2 Kids, JimJam, Kölyökklub*
   - `hu-live-helyi` — **📍 Élő TV: Helyi & Városi TV-k (64 adó)**: *Debrecen TV, Tisza TV, Sopron TV, Fehérvár TV, Nyíregyházi TV, Kecskeméti TV, Szombathelyi TV, Zalaegerszegi TV...*
2. **Valódi `.png` poszterek, hátterek és logók mind a 146 csatornához**:
   - `public/tv-posters/<id>.png` (`600×900` px valódi PNG kártya a hivatalos TV-logóval és csatornanévvel)
   - `public/tv-backgrounds/<id>.png` (`1280×720` px)
   - `public/tv-logos/<id>.png` (`500×500` px)
3. **4 Lenyíló Menü (Dropdown) a [public/index.html](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/public/index.html) oldalon**:
   - `CH 02a`: Film & Sorozat Források (13 VOD scraper)
   - `CH 02b`: Élő TV (IPTV) Források (MédiaKlikk 1080p, OnlineStream Országos/Prémium, OnlineStream Helyi TV-k)
   - `CH 03a`: Film & Sorozat Katalógusok (11 VOD katalógus)
   - `CH 03b`: Élő TV Katalógusok (a 6 új Élő TV kategória)
4. **Helyi módosított éles fájlok**:
   - [public/index.html](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/public/index.html)
   - [server.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/server.js)
   - [src/addon.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/addon.js)
   - [src/catalog.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/catalog.js)
   - [src/catalogs.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/catalogs.js)
   - [src/scrapers/mediaklikk.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/scrapers/mediaklikk.js)
   - [src/scrapers/onlinestream.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/scrapers/onlinestream.js)
   - [src/tv_graphics.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/tv_graphics.js)
   - `public/tv-posters/*.png`, `public/tv-backgrounds/*.png`, `public/tv-logos/*.png`
   - *(Megjegyzés: a `scripts/` mappában lévő ideiglenes segédscripteket — `scripts/test_*.js`, `scripts/*.py`, `scripts/*.html` — commitolás előtt érdemes kitakarítani, hogy csak a `scripts/verify.js` és a szükséges generátor maradjon!)*

---

## 3. Fájlszerkezet és Modulok Feladatai

- **[server.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/server.js)**:
  - Express szerver (Vercel Serverless + Self-Host `port 7000`).
  - Stremio/Nuvio végpontok: `/manifest.json`, `/:config/manifest.json`, `/catalog/:type/:id.json`, `/meta/:type/:id.json`, `/stream/:type/:id.json`.
  - Web UI végpontok: `/configure` (új UI: `public/index.html`, `?old=1` paraméterrel régi UI: `public/index.old.html`), `/api/test`, `/api/episodes`.
  - Beépített HLS és MP4 Proxy végpontok: `/proxy/hls.m3u8`, `/proxy/hls`, `/proxy/stream.mp4`, `/resolve/mediaklikk/:token/playlist.m3u8`.
  - Statikus képek ésキャッシュ-tiltó fejlécek (`Cache-Control: no-store, no-cache, must-revalidate, max-age=0`).
- **[src/addon.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/addon.js)**:
  - `getManifest(config)`, `parseConfig(configStr, query)`, `getStreams(type, rawId, config)`.
  - Összehangolja a 13 VOD scrapert és az Élő TV (`mediaklikk-live-*`, `onlinestream-live-*`) hívásokat.
- **[src/catalogs.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/catalogs.js)** és **[src/catalog.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/catalog.js)**:
  - A 17 katalógus (6 Élő TV + 11 Film/Sorozat) definíciója (`CATALOG_DEFINITIONS`), heti automatikus forgatása (`rotateWeekly`), keresése (`searchCatalog`) és metaadat-kiszolgálása (`getMeta`).
- **[src/utils/meta.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/utils/meta.js)**:
  - IMDb (`tt...`), TMDB (`tmdb:...`), Kitsu, TVMaze azonosítók és szöveges címek feloldása magyar + angol címre, évszámra, játékidőre (`runtimeMinutes`), valamint sorozatok teljes évad/epizód listájának lekérése (`getSeriesEpisodes`).
- **[src/scrapers/onlinestream.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/scrapers/onlinestream.js)**:
  - A 146 magyar élő TV csatorna adatbázisa 6 kategóriában, valós idejű `.m3u8` token-feloldója és HLS master playlist elemzője (`1080p FHD .m3u8` és `Auto .m3u8` opciókkal).
- **[src/scrapers/mediaklikk.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/scrapers/mediaklikk.js)**:
  - Hivatalos MTVA Élő TV (`M1, M2, Duna, M4 Sport, Duna World, M5, M3`) 1080p HLS stream kinyerő + 43 ellenőrzött klasszikus magyar sorozat/mese + 490+ MédiaKlikk műsor dinamikus epizód-lekérője.
- **[src/scrapers/videa.js](file:///C:/Users/Playe/.gemini/antigravity/scratch/nuvio-magyar-http/src/scrapers/videa.js)** (és a többi 11 VOD scraper: `indavideo.js`, `jobbmintatv.js`, `hdmozi.js`, `filmvilag.js`, `netmozi.js`, `filmezek.js`, `onlinefilmek.js`, `dmdamedia.js`, `mesefilm.js`, `videakid.js`, `sorozatok_net.js`):
  - RC4 XML dekódolás (Videa), tokenes CDN MP4 kinyerés (Indavideo), OK.ru / VOE HLS `.m3u8` kinyerés, valamint a közös validáló függvények (`isTitleMatch`, `isValidRuntime`, `checkPageMetadata`, `matchesEpisode`).

---

## 4. KRITIKUS TECHNIKAI SZABÁLYOK (Soha ne sértsd meg őket!)

> [!CAUTION]
> ### 1. Stremio `stremio-core` (Rust Serde) Szigorú Szabály
> A Stremio natív kliensei Rustban íródtak (`stremio-core`), és a `serde` deszerializáló **elutasítja az egész választ**, ha egy objektumban egy mező és annak `#[serde(alias = ...)]` álneve egyszerre szerepel:
> - **`Stream` objektumokon**: A `stremio-core`-ban `#[serde(default, alias = "title")] pub description: Option<String>` van definiálva. **SOHA ne tegyél egyszerre `title` ÉS `description` mezőt egy `Stream` objektumba!** Csak `name`, `title`, `url` és `behaviorHints` szerepeljen benne!
> - **`Video` objektumokon (`meta.videos`)**: A `stremio-core`-ban `#[serde(default, alias = "name")] pub title: String` van definiálva. **SOHA ne tegyél egyszerre `title` ÉS `name` mezőt egy `Video` objektumba!** Csak `id`, `title`, `season`, `episode`, `released`, `overview`, `thumbnail` szerepeljen benne!

> [!WARNING]
> ### 2. Nuvio Képmegjelenítő Szabály (Valódi `.png`, NEM `.svg`!)
> - A Nuvio mobil/TV képmegjelenítője az `.svg` poszterekből **nem rendereli ki a `<text>` elemeket** (üres keretek jelennek meg).
> - Ezért a TV csatornákhoz mindig **valódi, raszterizált `.png` képeket** (`public/tv-posters/<id>.png`, `600×900` px) kell használni, amelyekre a valódi csatornalogó (`tv-logos` / `onlinestream.live`) és a felirat közvetlenül rá van renderelve!

> [!IMPORTANT]
> ### 3. Élő TV (`.m3u8`) Streamek Sorrendje és Tokenek
> - Minden élő TV csatornánál a visszaadott `streams` tömbben **MINDIG a közvetlen `.m3u8` streameknek kell az 1. és 2. helyen lenniük**:
>   1. `🔴 [HU] <Csatorna> — 1080p FHD (.m3u8)` (közvetlen `.m3u8` URL)
>   2. `🔴 [HU] <Csatorna> — Auto (.m3u8)` (közvetlen master `.m3u8` URL)
>   3. Csak ezután következhetnek a `/proxy/hls.m3u8?url=...` proxyzott streamek!
> - A ConnectMedia és MTVA HLS linkek tokenjei 15–30 perc után lejárnak (`404`), ezért a tokenes csatornákat mindig dinamikusan (max. 2 perces memóriagyorsítótárral) kell feloldani!

> [!TIP]
> ### 4. Keresési Pontosság és Szóhatár Szabály
> - Címellenőrzésnél (`isTitleMatch`, `scoreItemRelevance`) **SOHA ne használj sima `.includes(w)` vizsgálatot szóhatár nélkül**, mert pl. a `"nagymenok".includes("agymenok")` kifejezés `true`-t ad! Mindig szóeleji határt (`new RegExp("(?:^|\\s)" + w, "i")`) kell használni.
> - Sorozatoknál a `matchesEpisode(title, season, episode, epTitle)` függvényben ha a videó címében szerepel `X. évad` (pl. `2. évad 1. rész`), és `X !== season`, azonnal `false`-szal kell elutasítani, hogy az `S01E01` keresés ne hozza fel más évadok 1. részét.
> - Filmeknél kötelező a `±1 év` megjelenési év ellenőrzés és a `±10 perc` (+4% PAL gyorsítás) játékidő (`isValidRuntime`) ellenőrzés.

---

## 5. Hogyan indítsd el a Helyi Self-Host Szervert új beszélgetésben

Ha a szerver nem futna a `7000`-es porton, így indítsd el háttérfolyamatként (`IsDaemon: true`):
```powershell
cd C:\Users\Playe\.gemini\antigravity\scratch\nuvio-magyar-http
node server.js
```
Majd ellenőrizd le:
```powershell
Invoke-RestMethod http://localhost:7000/manifest.json | Select-Object name, version, @{N='catalogs';E={$_.catalogs.Count}}
```
