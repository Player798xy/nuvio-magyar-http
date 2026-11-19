# 🇭🇺 Magyar HTTP Streams — Nuvio & Stremio Addon (`v2.7.0`)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPlayer798xy%2Fnuvio-magyar-http)
[![Zero Proxy](https://img.shields.io/badge/Zero_Proxy-0_Bájt_Videó_Forgalom-brightgreen?style=for-the-badge)](#3-miért-zero-proxy-és-okos-vercel-edge-cache)
[![Magyar Feliratok](https://img.shields.io/badge/Magyar_Feliratok-OpenSubtitles_HU-blue?style=for-the-badge)](#5-magyar-feliratok-és-webes-kapcsoló)
[![Élő TV](https://img.shields.io/badge/Élő_TV-162_Adó_%2B_EPG-red?style=for-the-badge)](#4-élő-tv-162-magyar-csatorna--valós-idejű-epg)
[![Katalógusok](https://img.shields.io/badge/Katalógusok-17_(11_VOD_%2B_6_Élő_TV)-orange?style=for-the-badge)](#7-katalógusok-poszter--forrás-garancia)
[![Licenc](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> ## ⛔ NYILVÁNOS SZERVER LEÁLLÍTVA / PUBLIC HOSTING DISCONTINUED
>
> **Magyarul:** A fejlesztő **többé nem hosztol nyilvános publikus szervert** — a korábbi központi Render / Vercel linkek véglegesen leállításra kerültek.  
> A projekt nyílt forráskódú (**MIT licenc**): **bárki szabadon nyithat magának saját ingyenes Vercelt** az alábbi gombbal, vagy futtathatja otthon saját gépen (**Docker / Node.js / Termux**) kizárólag saját használatra!
>
> **English:** All public hosted instances (`onrender.com`, `vercel.app`) have been **permanently shut down**. The author no longer hosts any public server. This repository remains open-source (MIT) — anyone is free to deploy their **own private Vercel instance** or **self-host** via Docker / Node.js.

Közvetlen **Direct HTTP** magyar szinkronos és feliratos film-, sorozat-, mese- és élő TV-streamek **Nuvio** és **Stremio** lejátszókhoz — **torrent (P2P), Real-Debrid előfizetés és videó proxy nélkül (`Zero Proxy`)!**

- **Élő TV kompatibilitás:** Nuvio-ban teljesen működik (és PC-s Stremión is jó), Stremio Androidon jelenleg nem megy a sima HTTP / relatív `.ts` szegmensek miatt.

---

### ▶️ Gyors indítás (ACCESS_KEY-vel)

```bash
./run.sh            # előtérben indít, ACCESS_KEY automatikusan generálva/olvasva (.access-key)
./run.sh bg         # háttérben (PID: .run.pid, log: /tmp/nuvio-magyar-tv.log)
./run.sh status     # fut-e + prefixelt URL-ek
./run.sh stop       # leállítás
./run.sh restart    # stop + bg
./run.sh logs       # élő log
./run.sh key        # az ACCESS_KEY és a használható URL-ek

NO_ACCESS_KEY=1 ./run.sh bg   # nyilvános mód (bárki elérheti — nem ajánlott)
```

`ACCESS_KEY` használatakor minden végpont a **`/p/<kulcs>/`** prefix alatt érhető el (kivéve `/api/health`), és a playlistek is prefixelt URL-eket generálnak. A kulcs a `.access-key` fájlba kerül (gitignore-olva), így újraindítás után ugyanaz marad.

TiviMate ilyenkor:

```text
Host:      http://<IP>:7000/p/<kulcs>
User/pass: bármi
M3U:       http://<IP>:7000/p/<kulcs>/tv.m3u
EPG:       http://<IP>:7000/p/<kulcs>/xmltv.php
```

## 🆕 Új eszközök és oldalak (v2.8)

| Oldal / végpont | Mit tud? | Részletek |
|---|---|---|
| **`/tv`** | Böngészős élő TV néző: 162 csatorna, tükrök, automatikus hiba-váltás, mozi (theater) mód, teljes képernyős műsorújság | [4b szekció](#-4b-böngészős-élő-tv-néző--stream-ellenőrző-tv) |
| **`/tv.m3u`** | TiviMate/Kodi auto-tükör lista — minden csatorna a legjobb élő szerverre mutat (302, Zero Proxy) | [TiviMate szekció](#-tivimate--iptv--automatikus-tükörrel-tvm3u-xtream-codes) |
| **Xtream Codes** | `player_api.php` + `/live/…` + `/xmltv.php` — TiviMate natív Xtream account (user/pass: bármi) | [TiviMate szekció](#-tivimate--iptv--automatikus-tükörrel-tvm3u-xtream-codes) |
| **EPG** | Élő Most/Következő sáv a lejátszó alatt, **Idősáv** műsorújság mind a 162 csatornához, valós **XMLTV** export | [EPG szekció](#-4b-böngészős-élő-tv-néző--stream-ellenőrző-tv) |
| **`/traffic`** | Élő szerver-forgalom grafikon (bájt/s, osztályonként: relay / EPG / API / statikus), relay figyelmeztetés | [Forgalom szekció](#-élő-forgalom-dashboard-traffic) |
| **`/profile`** | Profil készítő: élő TV kategóriák + VOD források ki-/bekapcsolása, saját M3U + EPG + Xtream + manifest URL, mentett profilok | [Profil szekció](#-profil-készítő-profile--saját-csatornalista--epg) |
| **Helyi csatornák** | `data/channels.local.json` / `.m3u` — saját adások hozzáadása kód nélkül, hot reloaddal | [Saját csatornák szekció](#-saját-csatornák-hozzáadása-helyi-fájl-kód-nélkül) |
| **Git auto-sync** | A futó szerver 12 óránként frissíti a csatornalistát a Git repóból, deploy nélkül | [Auto-sync szekció](#-git-katalógus-auto-sync-új-csatorna-deploy-nélkül) |

> A videó továbbra is **közvetlenül a CDN-ekről** megy (Zero Proxy) — a szerveren csak a lejátszási lista, az EPG, az API és az opcionális Relay forgalma jelenik meg. Ezt a `/traffic` oldal élőben mutatja.

---

## ✨ Újdonságok a `v2.7.0` kiadásban

- **📝 Magyar Feliratok (`subtitles` resource) + Ki/Be Kapcsoló:** OpenSubtitles v3 (`hun`) + TMDB→IMDb feloldás magyar `.srt` feliratokkal filmekhez és sorozatokhoz. A saját példányod `/configure` oldalán **külön kapcsolóval ki- vagy bekapcsolható** (`subtitles: true / false`).
- **📺 Valós Idejű Élő TV Műsorújság (EPG):** A `port.hu` műsoradatai alapján a csatorna adatlapján (`/meta`) és forrásválasztójában (`/stream`) azonnal látható a **Most** és **Következő** műsor címe és időpontja.
- **🧹 162 Ellenőrzött Élő Adó (halott csatornák & tartalékok kiszűrve):** A végleg leállt adók (`Sopron TV`, `Viasat Nature`) és a hibás tartalék szerverek eltávolításával kizárólag működő élő streamek jelennek meg.
- **⚡ Párhuzamosított Scraperek & Okos Edge CDN Cache:** Gyorsabb keresés (`Videa`, `Indavideo`, `MeseKincstár`, `OnlineFilmek`, `Sorozatok.net`, `Meta`) és Vercel Edge (`s-maxage`) gyorsítótárazás a minimális szerverterhelésért.
- **📱 Mobilra Optimalizált Webes Konfigurátor (`/configure`):** Javított reszponzív mobilos felület, külön felirat-kapcsoló, működő `Nuvio Telepítés` és `Link másolása` gombok, átlátható listák és élő stream/sorozat tesztelő.

---

## 🚀 1. Saját Ingyenes Vercel Indítása (1 kattintás) — vagy Self-Host

Mivel publikus szerver már nincs, **30 másodperc alatt csinálhatsz magadnak saját privát Vercelt** ingyenesen:

1. Kattints ide:  
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPlayer798xy%2Fnuvio-magyar-http)
2. Jelentkezz be a saját GitHub / Vercel fiókoddal, adj neki egy tetszőleges projektnevet, és nyomj a **Deploy** gombra.
3. Kész is! Megkapod a saját privát címedet (pl. `https://sajat-neved.vercel.app`):
   - **Konfigurátor:** `https://<sajat-domain>/configure`
   - **Manifest URL:** `https://<sajat-domain>/manifest.json`

*(Ha az összes forrást el akarod érni beleértve a VOE / HDMozi / DMDAMedia streameket is, vagy otthoni NAS/Docker szerveren futtatnád, használd a lentebbi **Docker / Node.js Self-Host útmutatót**!)*

---

## 🌐 2. Melyik forrás működik saját Vercelen és melyikhez kell Self-Host?

A kiegészítő **13 magyar VOD streaming forrást** tartalmaz. Mivel a saját **Vercel szerver** egy felhőalapú adatközpontban fut, és a kiegészítő **nem használ videó proxyt** (`Zero Proxy`), egyes fájlmegosztók viselkedése eltér a felhőben és otthoni interneten (**Self-Host**):

### 📊 Teljes 13-Forrásos Kompatibilitási Táblázat

| # | Forrás neve | Típus | ☁️ Publikus Vercel | 🏠 Saját gépen (Self-Host) | Technikai magyarázat & Megjegyzés |
| :-: | :--- | :--- | :-: | :-: | :--- |
| **1** | **🎥 Videa (`videa`)** | Film & Sorozat | ✅ **100%** | ✅ **100%** | Natív `_xt` RC4 XML + `fcode` dekódolás. Közvetlen `1080p/720p/480p` MP4 tokenek (nem IP-kötöttek). |
| **2** | **📺 JobbMintATV (`jobbmintatv`)** | Film & Sorozat | ✅ **100%** | ✅ **100%** | Videa MP4, Indavideo és fix-felbontású **OK.ru HLS (`1080p/720p`)** streamek akadásmentesen. |
| **3** | **🍿 Filmezek (`filmezek`)** | Film & Sorozat | ✅ **100%** | ✅ **100%** | Gyors JSON keresés + közvetlen Videa MP4 és **OK.ru HLS (`1080p/720p`)** sávok. |
| **4** | **🎞️ Filmvilág2 (`filmvilag2`)** | Film | ✅ **100%** | ✅ **100%** | A `katalog.estranky.cz` adatbázisból kinyert Videa, Indavideo és OK.ru streamek. |
| **5** | **🧸 MeseKincstár (`mesefilm`)** | Mese & Anime | ✅ **100%** | ✅ **100%** | `mesekincstar.tv` Videa/Indavideo beágyazások szigorú cím-, évszám- és hossz-ellenőrzéssel. |
| **6** | **🎈 Videakid (`videakid`)** | Mese & Családi | ✅ **100%** | ✅ **100%** | Gyerekbarát Videa RC4 direkt MP4 streamek (`Magyar népmesék`, klasszikus rajzfilmek). |
| **7** | **📼 Indavideo (`indavideo`)** | Film, Sorozat & Mese | ✅ **100%** | ✅ **100%** | AMFPHP JSON API + dinamikus `filesh` tokenek minden `*.indavideo.hu` aldomainről. |
| **8** | **🔴 MédiaKlikk (`mediaklikk`)** | Klasszikusok & Élő TV | ✅ **95%** *(VOD 100%)* | ✅ **100%** | **Magyar népmesék + Süsü + MTVA klasszikusok & élő adások** *(Hivatalos MTVA CDN adás).* |
| **9** | **🎬 NetMozi (`netmozi`)** | Film & Sorozat | ✅ **100%** *(0 Proxy)* | ✅ **100%** *(+VOE 1080p)* | Közvetlen Mindjart bypass + Vercelen is működő tárhelyek (`vTube`, `StreamRuby`, `LuluVid`, `MixDrop`, `Vidmoly`). |
| **10** | **🎞️ OnlineFilmek (`onlinefilmek`)** | Film & Sorozat | ⚡ **Részleges** *(Videa/OK)* | ✅ **100%** *(+VOE 1080p)* | DooPlayer v2 AJAX API. A Videa/OK.ru tükrök Vercelen is mennek, a **VOE** tükrök IP-kötés miatt Self-Hoston. |
| **11** | **📂 Sorozatok.net (`sorozatoknet`)** | Sorozat | ⚡ **Részleges** *(Videa/OK)* | ✅ **100%** *(+VOE 1080p)* | `d.sorozatok.net` `hunter` JS dekódolás. A **VOE** epizódok Self-Hoston mennek teljes sebességgel. |
| **12** | **🔥 HDMozi (`hdmozi`)** | Film & Sorozat | ❌ *Cloudflare tiltás* | ✅ **100%** *(1080p HLS)* | AES-128-CBC `rpmshare` 1080p HLS dekódolás. A Cloudflare blokkolja az AWS/Vercel adatközponti IP-ket, otthonról hibátlan. |
| **13** | **💿 DMDAMedia (`dmdamedia`)** | Film & Sorozat | ❌ *Cloudflare tiltás* | ✅ **100%** | A `dmdamedia.hu` tűzfala tiltja a felhős szervereket; saját gépen (Self-Host) azonnal működik. |

---

## ⚡ 3. Miért Zero Proxy és Okos Vercel Edge Cache?

1. **Nulla videó/stream proxy (`0 Bájt` Vercel videó-sávszélesség):**  
   A szerver kizárólag a közvetlen CDN/MP4/HLS URL-eket adja át a lejátszónak (a `/proxy/hls` végpont is már csak tiszta HTTP `302 Redirect`), így egyetlen video-szegmens sem terheli a Vercel `10 GB`-os Fast Origin Transfer keretét.
2. **VOE CDN IP-kötés védelem:**  
   A VOE videómegosztó a generált tokenbe beleégeti a lekérő gép IP-címét (`&i=IP`). Felhős Vercel futtatásnál az IP-kötött VOE streamek automatikusan ki vannak kapcsolva (hogy ne jelenjenek meg hibásan lejátszhatatlan linkek), míg saját hálózaton (Self-Host) automatikusan engedélyezettek.
3. **Okos Edge CDN (`s-maxage`) gyorsítótárazás:**  
   A `/manifest.json`, `/catalog`, `/meta`, `/subtitles`, `/stream`, `/api/episodes` és `/api/search` végpontok `Cache-Control` `s-maxage` + `stale-while-revalidate` fejlécekkel futnak (a tokenes `mediaklikk-live-` kivételével, ami `private, max-age=60`), így többszáz felhasználónál is gyors marad és minimálisra csökkenti a Vercel Function hívásokat.
4. **OK.ru 5 másodpercenkénti akadás javítása (`JobbMintATV`, `Filmezek`):**  
   Fix felbontású HLS lejátszási listák (`.../fn/track.m3u8` és `.../video/index.m3u8`) kinyerése, ahol a `.ts` szeletek korlátozás nélkül töltődnek le.

---

## 📺 4. Élő TV (162 Magyar Csatorna) & Valós Idejű EPG

A kiegészítő **162 ellenőrzött élő magyar televíziócsatornát** szolgáltat közvetlen HLS (`.m3u8`) formátumban, **valós idejű `port.hu` műsorújsággal (EPG)**:

- **📡 Valós Idejű EPG a csatorna adatlapján és forrásválasztójában:**  
  Amikor rákattintasz egy csatornára a Nuvio/Stremio appban, a leírásban és a stream választóban rögtön látod a **📺 Most** és **⏭️ Következő** műsor címét és időpontját (`60` perces csatornánkénti lusta cache).
- **🧹 Dead-Channel & Backup Tisztítás:**  
  A halott `Sopron TV` (`5982`) és `Viasat Nature` (`9848`), valamint a `403/404`/timeout hibás tartalék szerver-URL-ek kiszűrve.
- **🚀 Közvetlen Európai Gerinchálózat (`88.212.7.14`) & GradeTV Direct + MTVA CDN:**  
  Nincs `120` perces időlimit és egyetlen bájt sem megy át a Vercelen.
- **🎨 Egyedi HD Borítókép, Logó és Külső Lejátszó Listák (`/playlist.xspf`, `/playlist.m3u`):**  
  Minden adóhoz egyedi artwork tartozik, a weboldalon pedig VLC `.xspf` és Kodi/TiviMate `.m3u` lista is letölthető. Alapból csatornánként 1 stream kerül a listába, a **`/playlist-all.m3u`** (vagy `?mirrors=1`, illetve `/playlist.xspf?mirrors=1`) pedig mind a **454 tükör URL-t** kiírja, hogy egy hibás szerver esetén a lejátszó a következő tükröt is mutassa. Statikus másolatok: `public/nuvio-magyar-tv*.m3u` / `.xspf` (frissítés: `npm run playlists`).

### 📋 Elérhető Élő Csatornák Kategóriánként (Összesen 162 Adó):
- **🔴 Országos & Kereskedelmi (`28` adó):** RTL, TV2, M1, Duna, Super TV2, RTL Kettő, RTL Három, RTL Gold, RTL Otthon, ATV, ATV Spirit, Hír TV, Dikh TV, Viasat 3, Viasat 6, Prime, Izaura TV stb.
- **🎬 Film & Sorozat (`24` adó):** Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1–3, Film4, TV4, Story4, Film Mánia, AXN Spin, Magyar Mozi TV, Moziklub, Sorozat+, Sorozatklub stb.
- **🌍 Ismeretterjesztő & Doksi (`14` adó):** National Geographic, Nat Geo Wild, Discovery Channel, Animal Planet, ID, Spektrum, Spektrum Home, History, Viasat Explore, Viasat History, HGTV, Food Network, Travel Channel, The Fishing & Hunting.
- **⚽ Sport, Zene & Életmód (`20` adó):** M4 Sport, Sport 1, Sport 2, Spíler 1, Spíler 2, Arena4, Match 4, EuroSport 1, TV Paprika, Sláger TV, Muzsika TV, Zenebutik, Life TV, PVTV, Kincsem Park stb.
- **🧸 Rajzfilm & Gyerek (`8` adó):** Disney Channel, Minimax, Nickelodeon, Nick Jr., Nicktoons, TV2 Kids, JimJam, Kölyökklub.
- **📍 Helyi & Városi TV-k (`68` adó):** Debrecen TV, Fehérvár TV, Tisza TV, Szeged TV, Nyíregyházi TV, Kecskeméti TV, Eger TV, Szolnok TV, Gyöngyösi TV, Kapos TV stb. *(A konfigurátorban egy kattintással kikapcsolható a "Helyi nélkül" gombbal.)*

---

## 🖥️ 4b. Böngészős Élő TV néző & stream ellenőrző (`/tv`)

Nyisd meg: **`https://nuvio-magyar-http.onrender.com/tv`** — a teljes 162 csatornás kínálat közvetlenül a böngészőben, telepítés nélkül.

- **Csatornalista Git-ről:** a néző a `public/tv-channels.json`-t tölti be GitHub raw / jsDelivr forrásból (mindig a repó aktuális `main` állapota), és ha az nem érhető el, a szerver `/api/tv/channels` végpontjára esik vissza. A fejléc mutatja az aktív forrást és a lista generálási idejét.
- **Automatikus tükör-váltás:** ha egy stream nem indul vagy 12 másodpercnél tovább megakad, a lejátszó magától a következő tükörre vált (max. 12 URL / csatorna), és a tükör-sávban jelöli a hibás szervereket. A váltás hibajelzésre történik, nem folyamatos háttér-próbálkozásra.
- **Célzott stream-ellenőrzés (csak igény szerint):** nincs automatikus, katalógus-szintű pásztázás — kizárólag a kiválasztott csatorna tükröződnek a mérése (TTFB, buffer, Mbps, CORS, felvétel), illetve a szerveroldali tükör-feloldás fut lejátszáskor. Végpontok: `/api/tv/health/:channelId`, `/api/tv/check?url=…`.
- **Relay mód (opcionális, alapból KI):** csak CORS-tiltott vagy HTTPS oldalon nem játszható `http://` tükrökhöz; ilyenkor a szerver játssza át a playlistet és a szegmenseket (`/api/tv/relay.m3u8`, `/api/tv/relay/segment`). Sávszélességet fogyaszt, ezért nem alapértelmezett.
- **Full-page műsorújság (EPG):** a fejléc **📺 Műsorújság** gombjára váltva a lejátszó, az oldalsáv és a fül-sáv is eltűnik — a teljes oldalt a műsorújság tölti ki — a lejátszás automatikusan leáll (nincs háttér-audio), visszatéréskor kattintásra indul újra. Vissza: **▶ Élő TV** gomb a fejlécben. Deep link: **`/tv#epg`**. A fül-sáv csak a csatornanézetben látszik.
- **Idősáv nézet:** mind a **162 csatorna** egy sor, a műsorok időblokkokként egy 12 órás ablakban (piros „most" vonal, vízszintesen görgethető, kattintásra indítható), **⛶ Teljes képernyő** gombbal igazi fullscreenbe tehető. **Lista** nézet: most/következő párok. A műsorújság teljes szélességben jelenik meg (a bal kategóriasáv és a jobb oldali kártyák eltűnnek), a kategóriák a guide tetején, chipként válthatók. A lejátszó alatt ezen kívül élő **Most / Következő** sáv futásidő-csúszkával (5 percenként frissül). Forrás: port.hu (`src/epg.js`), cache: 10 perc csatornánként / 5 perc kategóriánként / 10 perc idősáv. Végpontok: `/api/tv/epg/:channelId`, `/api/tv/epg?category=…`, `/api/tv/epg/grid`, `/api/tv/epg/status`.
- **Mozi (theater) mód:** a lejátszó melletti ▭ gombbal (vagy `T` billentyűvel) eltűnik az oldalsáv, a jobb oldali kártyák, a fülek és a rács — csak a stream marad, a lejátszó a teljes szélességet kitölti (Esc / `T` kilépés). A választott mód megjegyződik.
- **Billentyűk:** `↑`/`↓` csatornaváltás, `M` némítás, `F` teljes képernyő, `T` mozi mód, `Esc` kilépés, `/` keresés.

### 📺 TiviMate / IPTV — automatikus tükörrel (`/tv.m3u`, Xtream Codes)

Az M3U és az Xtream szabvány egy csatornához egy URL-t ismer, ezért a tükröket a szerver oldja fel:

- **Auto-tükör M3U (ajánlott TiviMate-hez):** `https://nuvio-magyar-http.onrender.com/tv.m3u` — 162 csatorna, mindegyik egy stabil címre mutat (`/api/tv/live/<channelId>.m3u8`), amit a szerver minden lejátszáskor a **legjobb élő tükörre irányít (302)**. Ha az elsődleges host kiesik, ugyanaz a csatorna a következő működő tükörre vált — nincs playlist-szerkesztés, nincs manuális váltás. A válasz fejlécei: `X-Stream-Host`, `X-Stream-Online`.
- **Xtream Codes:** host = `https://nuvio-magyar-http.onrender.com`, username/password = **bármi** (a lista publikus). Megvalósított végpontok: `player_api.php` (login, `get_live_categories`, `get_live_streams`), `/live/<user>/<pass>/<id>.m3u8` → 302 a legjobb tükörre, `/get.php` (M3U export).
- **Valós XMLTV műsorújság:** a `/xmltv.php` már nem üres csatornalista — a port.hu napi műsorát fordítja XMLTV-vé (162 csatorna, ~2000 műsor). Az első kéréskor háttérben épül fel (nem blokkol), 6 óránként frissül, addig a korábbi (vagy csatornalista) verziót szolgálja ki. Állapot: `/api/tv/epg/status`.
- **Manuális tükrök:** ha mégis külön sorokat szeretnél, a `/playlist-all.m3u` a 454 tükör URL-t külön bejegyzésként adja (`RTL`, `RTL (2)`, …).
- A szerver csak **átirányít**, videó-bájt nem halad át rajta — a Zero Proxy elv érvényben marad.

### ➕ Saját csatornák hozzáadása (helyi fájl, kód nélkül)

Két egyszerű fájl olvasódik be automatikusan (bootkor és amikor változnak):

**`data/channels.local.json`** — több tükörrel, kényelmesen:

```json
{
  "categories": [{ "id": "sajat", "name": "🏠 Saját csatornák" }],
  "channels": [
    {
      "id": "rock-tv",
      "name": "Rock TV",
      "category": "sajat",
      "categoryName": "Saját csatornák",
      "logo": "https://example.com/rock.png",
      "description": "Saját adás",
      "streams": [
        "https://example.com/live.m3u8",
        "https://backup.example.com/live.m3u8"
      ]
    }
  ]
}
```

**`data/channels.local.m3u`** — bármilyen szabványos lejátszási lista (több azonos nevű/`tvg-id`-s bejegyzés = tükrök):

```m3u
#EXTM3U
#EXTINF:-1 tvg-id="rock-tv" tvg-logo="https://example.com/rock.png" group-title="Saját",Rock TV
https://example.com/live.m3u8
```

- **Hot reload:** a szerver induláskor és a fájl módosításakor (mtime-figyelés, max. pár másodperc) frissíti a listát — nincs restart, nincs deploy
- **Tükrök, health, auto-mirror, EPG:** a helyi csatornák ugyanúgy működnek, mint a beépítettek (`/tv` néző, `/tv.m3u`, `/api/tv/live/<id>`, Xtream, profilok)
- **Kategória:** ha az `id` létezik, oda kerül; ha nem, automatikusan létrejön (a `categoryName` lesz a neve)
- **Felülírás:** ha a `channelId`/`tvg-id` egyezik egy beépített csatornával, a helyi változat **lecseréli** (pl. saját tükör egy adóhoz)
- **Korlátok:** max. 300 helyi csatorna, csatornánként 12 tükör, fájlonként 2 MB; hibás sorokat kihagy és a `/api/tv/sync` `local.errors` mezőjében jelez
- **Git snapshot:** `npm run assets` (vagy `npm run channels`) a helyi csatornákat is beleírja a `public/tv-channels.json`-ba, így a Git-alapú néző is látja
- **Render:** a fájl a repóban van, ezért commit + push után a deploy is megkapja; környezeti változóval más útvonal is megadható: `LOCAL_CHANNELS_FILE=/path/a.json,/path/b.m3u`

### 🔐 Opcionális `ACCESS_KEY` (privát prefix)

Ha a szerveren be van állítva az `ACCESS_KEY` env (pl. `ACCESS_KEY=sajat-kulcs`), minden végpont a **`/p/<kulcs>/`** prefix alá kerül (az upstream új funkciója). Az új oldalak és a lejátszási listák is prefix-tudatosak:

- `/p/<kulcs>/tv`, `/p/<kulcs>/traffic`, `/p/<kulcs>/profile` — az asset- és API-hívások automatikusan a prefixre íródnak
- `/p/<kulcs>/tv.m3u`, `/p/<kulcs>/xmltv.php`, `/p/<kulcs>/pf/<kategóriák>/…` — a generált URL-ek is tartalmazzák a prefixet
- `GET /api/health` prefix nélkül is elérhető (health checkhez)

### 🧩 Profil készítő (`/profile`) — saját csatornalista + EPG

Élő TV kategóriák és VOD források ki-/bekapcsolása, majd a kijelölésből generált, **állapotmentes (URL-be kódolt) profil**:

- **Kategóriák:** a 6 élő TV kategória (Országos, Film, Doksi, Sport, Gyerek, Helyi) — csak a kijelöltek kerülnek a listába és a műsorújságba
- **VOD források:** a 13 scraper (Videa, NetMozi, HDMozi, …) — a Nuvio/Stremio manifest URL-hez
- **Generált URL-ek (másolás gombbal):**
  - `M3U · auto tükör` → `/tv.m3u?cats=…` (TiviMate/Kodi, tükröket a szerver oldja fel)
  - `M3U · minden tükör` → `/playlist-all.m3u?cats=…`
  - `XSPF` → `/playlist.xspf?cats=…`
  - **`EPG · XMLTV`** → `/xmltv.php?cats=…` (csak a kijelölt csatornák műsorai)
  - **Xtream host** → `/pf/<cats>` (a TiviMate Xtream account is csak a profilt látja)
  - **Nuvio/Stremio manifest** → `/manifest.json?sources=…`
- **Path-alapú profil:** bármely végpont elérhető `/pf/<kategória-id-k>/…` előtaggal is (pl. `/pf/hu-live-orszagos/player_api.php`), így olyan kliensek is használhatják, amelyek nem tudnak query paramétert a host mezőbe írni
- **Mentett profilok:** localStorage-ban (Max 30), egy kattintással visszatölthetők; a profil link (`?cats=&sources=`) megosztható, megnyitáskor ugyanaz a kijelölés töltődik be
- Üres/érvénytelen kijelölés esetén a végpontok a teljes listát adják (biztonságos alapértelmezés)

### 📈 Élő forgalom dashboard (`/traffic`)

A szerver valós kimenő bájtjait méri (`src/traffic.js` middleware, streamelt relay szegmensekkel együtt), és élő grafikont rajzol:

- **Élő grafikon:** 2 perc / 60 perc / 24 óra időtáv, 2 mp-es frissítés, egymásra rakott sávok osztályonként (Relay / EPG / lejátszási lista / API / statikus / egyéb), hover tooltip-pal
- **Csempék:** mostani sávszélesség, mai forgalom, indulás óta, csúcs
- **Megbontás táblázat:** osztályonkénti bájt, részesedés, kérésszám
- **Relay figyelmeztetés:** ha a videó a szerveren keresztül megy, piros sáv jelzi — így azonnal látszik, hogy a normál nézés (Zero Proxy) 0 bájt szerverforgalmat jelent
- **Hozzáférés:** ugyanaz a védelem, mint a `/stats`-nál (`STATS_KEY` env; ha nincs beállítva, nyilvános). A `/tv` letöltési blokkjában „📈 Szerver forgalom" link.

### 🔄 Git katalógus auto-sync (új csatorna deploy nélkül)

A futó szerver **12 óránként automatikusan letölti** a `public/tv-channels.json`-t GitHub raw-ról (jsDelivr tartalék), validálja, majd **hot-swap**-eli a memóriában lévő csatornalistát:

- Új csatorna hozzáadása: `ALL_CHANNELS` szerkesztés → `npm run assets` → commit + push → a futó szerver legkésőbb 12 órán belül (vagy a következő kérésnél, ha elavult) felveszi, **újradeploy nélkül**.
- Azonnali kényszerítés: `GET /api/tv/sync?force=1`; állapot: `GET /api/tv/sync` (forrás, utolsó sync, csatornaszám, hiba).
- Hibatűrés: hibás/üres letöltés esetén a korábbi lista marad (a kódban lévő katalógus a visszaállítási alap), a health cache-ek automatikusan ürülnek frissítéskor.
- A ciklus állítható: `TV_CATALOG_SYNC_MS` (alap: 12 óra), a forrás felülírható: `TV_CATALOG_URL` (vesszővel elválasztott URL lista). Forknál állítsd be: `GIT_OWNER`, `GIT_REPO`, `GIT_BRANCH` (alap: `Player798xy`, `nuvio-magyar-http`, `main`), a publikus hostot pedig: `PUBLIC_BASE_URL`.
- A webes néző jobb oldali panelján látszik: `Git szinkron: aktív · 14:20 · 162 csatorna / 12h`.

A letöltési/Xtream kártya a csatornalista alatt, összecsukható blokkban van (nincs jobb oldali sáv), és tartalmazza az **EPG · XMLTV** letöltést, valamint a **📋 EPG URL másolása** gombot (`<host>/xmltv.php` — ezt kell a TiviMate EPG-forrás mezőjébe illeszteni). Fejlesztői fájlok: `public/tv.html`, `public/tv-app.css`, `public/tv-app.js`, `public/traffic.*`, `public/profile.*`, `src/tv_health.js`, `src/tv_relay.js`, `src/tv_channels.js`, `src/tv_profiles.js`, `src/tv_epg.js`, `src/local_channels.js`, `src/traffic.js`, `src/xtream.js`. A Git-snapshot frissítése: `npm run assets`.

---

## 📝 5. Magyar Feliratok és Webes Kapcsoló

- **Forrás:** OpenSubtitles v3 közvetlen HTTP feliratok (Zero Proxy), TMDB ID → IMDb ID automatikus feloldással (`src/subtitles.js`).
- **Nyelvszűrés:** Kizárólag **magyar (`hun`)** feliratok filmekhez és sorozatokhoz.
- **Webes Ki/Be Kapcsoló (`/configure`):** A *CH 01 — Felbontás & Felirat Szűrő* szekcióban egy kattintással kikapcsolható (`subtitles=false` a generált config URL-ben), ilyenkor a `manifest.json`-ban sem jelenik meg a `subtitles` resource és a felirat végpont azonnal üres listát ad vissza.

---

## ⚠️ 6. Hogyan szűri ki a kiegészítő a rossz közösségi videókat?

A közösségi videómegosztóknál (`Videa`, `Indavideo`, `Videakid`) **3 lépcsős validáció** fut:
1. **Cím-, folytatás- és évszám-ellenőrzés (`±1 év`)**
2. **Játékidő (Runtime) ellenőrzés (`±10 perc` + `4%` PAL DVD korrekció)**
3. **`⚠️ [Lehet nem jó a videó!]` jelölés**, miközben az igazolt évszámú és kurátori források mindig előre kerülnek.

---

## 🔄 7. Katalógusok (Poszter + Forrás Garancia)

Összesen **17 alapértelmezett katalógus** (**6 Élő TV** + **11 Film & Sorozat** — többek között *MédiaKlikk Klasszikusok*, *Heti Trendi Filmek/Sorozatok*, *Friss Mozifilmek*, *Magyar Filmek/Sorozatok*, *Netflix HU*, *Max / HBO*, *Disney+ HU*, *SkyShowtime*, *Prime Video*), ISO naptári heti rotációval és garantált HD poszterekkel.

---

## 🏠 8. Self-Host Telepítési Útmutató (mind a 13 forrás 100%-os feloldásához!)

Ha szeretnéd, hogy a **HDMozi**, **DMDAMedia**, **OnlineFilmek (VOE)**, **Sorozatok.net (VOE)** és **NetMozi (extra VOE tükrök)** is a saját otthoni IP-címeddel működjön:

### A) Docker & Docker Compose (Ajánlott — Multi-Arch `amd64` + `arm64`, Watchtower támogatással)

1. Töltsd le a [`docker-compose.yml`](docker-compose.yml) fájlt (vagy másold ki a tartalmát):
```bash
curl -O https://raw.githubusercontent.com/Player798xy/nuvio-magyar-http/main/docker-compose.yml
```
2. Indítás:
```bash
# Normál indítás (ha már van Watchtowered vagy kézzel frissítesz):
docker compose up -d

# Indítás beépített automata frissítéssel (Watchtower 6 óránként frissíti az új GHCR buildet):
docker compose --profile auto-update up -d
```
Kézi frissítés bármikor Watchtower nélkül: `docker compose pull && docker compose up -d`

Vagy egyetlen `docker run` paranccsal:
```bash
docker run -d --name nuvio-magyar-http -p 7000:7000 \
  --label com.centurylinklabs.watchtower.enable=true \
  --restart unless-stopped \
  ghcr.io/player798xy/nuvio-magyar-http:latest
```

### B) PC / Mac / Linux (Node.js v18+)
```bash
git clone https://github.com/Player798xy/nuvio-magyar-http.git
cd nuvio-magyar-http
npm install
npm start
```
Az addon elérhető lesz a `http://127.0.0.1:7000/manifest.json` (valamint a helyi hálózati IP-címeden) keresztül, ellenőrzéshez pedig futtatható az `npm test` (`scripts/verify.js`).

### C) Android telefon / TV Box (Termux)
```bash
pkg update -y && pkg install -y nodejs git
git clone https://github.com/Player798xy/nuvio-magyar-http.git
cd nuvio-magyar-http
npm install
npm start
```
*(Port: `7000`, felülbírálható a `PORT` környezeti változóval.)*

---

## 📣 9. Saját Vercel & Docker Megjegyzés

A projekt szabadon klónozható és telepíthető bármilyen saját Vercel, Render, Docker vagy otthoni Node.js környezetbe privát használatra. Nyilvános központi példányt a fejlesztő nem üzemeltet.

---

## 🛠️ 10. Projekt Struktúra

- [`server.js`](server.js) — Express HTTP szerver, Vercel Edge `Cache-Control` szabályok, `/manifest.json`, `/catalog`, `/meta`, `/subtitles`, `/stream`, `/proxy/hls` (`302`), `/api/test`, `/playlist.xspf/.m3u`, `/tv` néző, `/tv.m3u` auto-tükör lista, Xtream (`/player_api.php`, `/live/…`, `/xmltv.php`) és `/api/tv/*` végpontok.
- [`src/addon.js`](src/addon.js) — Addon konfiguráció-kezelő (`parseConfig`, forrás/felbontás/katalógus/`subtitles` kapcsoló), manifest generátor, párhuzamos scraper futtató és EPG stream-formázás.
- [`src/subtitles.js`](src/subtitles.js) — Magyar OpenSubtitles v3 feliratkereső és TMDB → IMDb ID feloldó.
- [`src/epg.js`](src/epg.js) — Valós idejű `port.hu` műsorújság (EPG) feloldó és memória-cache.
- [`src/catalogs.js`](src/catalogs.js) & [`src/catalog.js`](src/catalog.js) — Heti rotációs VOD katalógusok, MédiaKlikk Klasszikusok és EPG-dúsított Live TV metaadatok.
- [`src/scrapers/onlinestream.js`](src/scrapers/onlinestream.js) — 162 ellenőrzött élő magyar TV csatorna kezelője közvetlen EU CDN és tartalék-szűréssel.
- [`src/scrapers/`](src/scrapers/) — A 13 magyar forrás-modul (`videa.js`, `jobbmintatv.js`, `filmezek.js`, `filmvilag.js`, `mesefilm.js`, `videakid.js`, `indavideo.js`, `mediaklikk.js`, `netmozi.js`, `onlinefilmek.js`, `sorozatok_net.js`, `hdmozi.js`, `dmdamedia.js`).
- [`src/tv_channels.js`](src/tv_channels.js) · [`src/tv_profiles.js`](src/tv_profiles.js) — csatorna-payload és stateless profil-szűrés (`?cats=…`, `/pf/<cats>/…`).
- [`src/tv_health.js`](src/tv_health.js) · [`src/tv_relay.js`](src/tv_relay.js) — tükör-státusz mérés és opcionális CORS/HTTP relay.
- [`src/tv_epg.js`](src/tv_epg.js) · [`src/xtream.js`](src/xtream.js) — EPG idősáv/XMLTV és Xtream Codes kompatibilitás.
- [`src/tv_catalog_sync.js`](src/tv_catalog_sync.js) · [`src/local_channels.js`](src/local_channels.js) — Git katalógus hot-swap és helyi csatornafájlok.
- [`src/traffic.js`](src/traffic.js) · [`src/playlists.js`](src/playlists.js) — forgalommérés és M3U/XSPF generálás.
- [`public/tv.html`](public/tv.html) · [`public/traffic.html`](public/traffic.html) · [`public/profile.html`](public/profile.html) — a három új webes felület (néző, forgalom, profil).
- [`data/channels.local.json`](data/channels.local.json) · [`data/channels.local.m3u`](data/channels.local.m3u) — saját csatornák egyszerű formátumban.
- [`public/index.html`](public/index.html) — Mobilbarát webes konfigurátor, felirat-kapcsoló és élő stream tesztelő.
- [`scripts/verify.js`](scripts/verify.js) — Automatizált végpont-, EPG-, felirat-, Zero-Proxy és VOD ellenőrző tesztscript (`npm test`).
- [`vercel.json`](vercel.json) — Európai (`fra1` Frankfurt) Serverless routing és statikus cache szabályok.

---

## ⚖️ 11. Jogi Nyilatkozat és Felelősségkizárás (Legal Disclaimer)

> **⚠️ FONTOS FIGYELMEZTETÉS – KÉRJÜK, OLVASD EL HASZNÁLAT ELŐTT!**

1. **Nem hosztolunk semmilyen tartalmat (No Hosting of Media):**
   Ez a projekt és a hozzá tartozó szerver **nem tárol, nem hosztol, nem tölt fel, nem streamel és nem terjeszt** semmilyen videófájlt, médiaállományt vagy szerzőiek által védett tartalmat. A kiegészítő kizárólag egy automatizált technikai keresőmotor (indexelő eszköz), amely az interneten már nyilvánosan elérhető, harmadik fél által üzemeltetett weboldalakon (*Videa, Indavideo, OK.ru, MédiaKlikk stb.*) található hivatkozásokat gyűjti össze.
2. **Külső szolgáltatókért való felelősség kizárása:**
   A fejlesztőnek nincs semmilyen ráhatása vagy ellenőrzése a külső weboldalakon elérhető tartalmakra, azok minőségére, pontosságára, elérhetőségére vagy jogszerűségére. Minden megtalált videóért és adatért kizárólag az adott külső tárhelyszolgáltató és a tartalom feltöltője felelős.
3. **Garancia és felelősség teljes kizárása („AS IS”):**
   A szoftver kizárólag **oktatási, tanulmányi és hobbi-fejlesztési célból** készült, és **„AHOGY VAN” (`AS IS`)** állapotban kerül közreadásra, bármiféle kifejezett vagy hallgatólagos garancia nélkül. **A fejlesztő semmilyen felelősséget nem vállal** a szoftver működési hibáiért, pontatlan találatokért, leállásokért, adatvesztésért, illetve semmilyen közvetlen vagy közvetett kárért vagy jogi következményért, amely a kiegészítő használatából ered.
4. **Felhasználói felelősség:**
   A kiegészítőt mindenki **kizárólag saját felelősségére** használja. A felhasználó köteles betartani a saját országában érvényes jogszabályokat, valamint az érintett harmadik fél weboldalak felhasználási feltételeit.

### 🌐 English Summary (Disclaimer)
- **No Content Hosted:** This repository and addon **do not host, store, upload, or distribute** any video files or copyrighted media. It functions strictly as a client/server-side metadata and link scraper (similar to a search engine) that indexes publicly accessible URLs on third-party websites.
- **No Liability ("AS IS"):** This project is provided strictly for **educational and personal research purposes** on an **"AS IS"** basis without warranties of any kind. The author/developer assumes **zero responsibility or liability** for any bugs, errors, broken streams, inaccurate matches, third-party content, misuse, or any damages arising from the use of this software. Use entirely at your own risk.
