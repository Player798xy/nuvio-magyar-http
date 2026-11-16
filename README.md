# 🇭🇺 Magyar HTTP Streams — Nuvio & Stremio Addon (`v2.7.0`)

[![Render Status](https://img.shields.io/badge/Render_Cloud-Online_(EU_Frankfurt)-ff7b1c?style=for-the-badge&logo=render)](https://nuvio-magyar-http.onrender.com/configure)
[![Zero Proxy](https://img.shields.io/badge/Zero_Proxy-0_Bájt_Videó_Forgalom-brightgreen?style=for-the-badge)](#3-miért-zero-proxy-és-okos-vercel-edge-cache)
[![Magyar Feliratok](https://img.shields.io/badge/Magyar_Feliratok-OpenSubtitles_HU-blue?style=for-the-badge)](#5-magyar-feliratok-és-webes-kapcsoló)
[![Élő TV](https://img.shields.io/badge/Élő_TV-162_Adó_%2B_EPG-red?style=for-the-badge)](#4-élő-tv-162-magyar-csatorna--valós-idejű-epg)
[![Katalógusok](https://img.shields.io/badge/Katalógusok-17_(11_VOD_%2B_6_Élő_TV)-orange?style=for-the-badge)](#7-katalógusok-poszter--forrás-garancia)
[![Licenc](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

Közvetlen **Direct HTTP** magyar szinkronos és feliratos film-, sorozat-, mese- és élő TV-streamek **Nuvio** és **Stremio** lejátszókhoz — **torrent (P2P), Real-Debrid előfizetés és videó proxy nélkül (`Zero Proxy`)!**

---

## ✨ Újdonságok a `v2.7.0` kiadásban

- **📝 Magyar Feliratok (`subtitles` resource) + Ki/Be Kapcsoló:** OpenSubtitles v3 (`hun`) + TMDB→IMDb feloldás magyar `.srt` feliratokkal filmekhez és sorozatokhoz. A [webes konfigurátorban](https://nuvio-magyar-http.onrender.com/configure) **külön kapcsolóval ki- vagy bekapcsolható** (`subtitles: true / false`).
- **📺 Valós Idejű Élő TV Műsorújság (EPG):** A `port.hu` műsoradatai alapján a csatorna adatlapján (`/meta`) és forrásválasztójában (`/stream`) azonnal látható a **Most** és **Következő** műsor címe és időpontja.
- **🧹 162 Ellenőrzött Élő Adó (halott csatornák & tartalékok kiszűrve):** A végleg leállt adók (`Sopron TV`, `Viasat Nature`) és a hibás tartalék szerverek eltávolításával kizárólag működő élő streamek jelennek meg.
- **⚡ Párhuzamosított Scraperek & Okos Edge CDN Cache:** Gyorsabb keresés (`Videa`, `Indavideo`, `MeseKincstár`, `OnlineFilmek`, `Sorozatok.net`, `Meta`) és Vercel Edge (`s-maxage`) gyorsítótárazás a minimális szerverterhelésért.
- **📱 Mobilra Optimalizált Webes Konfigurátor (`/configure`):** Javított reszponzív mobilos felület, külön felirat-kapcsoló, működő `Nuvio Telepítés` és `Link másolása` gombok, átlátható listák és élő stream/sorozat tesztelő.

---

## 🚀 1. Azonnali Telepítés (Elsődleges Render Szerver — EU Frankfurt)

A kiegészítő azonnal használható a publikus európai (**Frankfurt EU Central**) Render szerverről *(a korábbi Vercel szerverről érdemes átállni erre)*:

- ⚙️ **Mobilbarát Konfigurátor & Stream Tesztelő (Ajánlott):**
  👉 **[https://nuvio-magyar-http.onrender.com/configure](https://nuvio-magyar-http.onrender.com/configure)**
- 🔗 **Alapértelmezett Manifest URL (Nuvio / Stremio bemásoláshoz):**
  ```text
  https://nuvio-magyar-http.onrender.com/manifest.json
  ```
- ⚡ **Stremio 1-kattintásos telepítés:**
  ```text
  stremio://nuvio-magyar-http.onrender.com/manifest.json
  ```

> 💡 **Tipp a Konfigurációs oldalhoz (`/configure`):** A felbontásokon, forrásokon és katalógusokon felül itt kapcsolhatod ki vagy be a **Magyar Feliratokat (OpenSubtitles HU)** is — az egyedi URL azonnal generálódik és egyetlen kattintással másolható! *(Ha korábban már telepítetted az addont Nuvio-ba, frissítsd / telepítsd újra a `v2.7.0` URL-t, hogy az új `subtitles` funkció is megjelenjen.)*

---

## 🌐 2. Melyik forrás működik Vercelen és melyikhez kell Self-Host?

A kiegészítő **13 magyar VOD streaming forrást** tartalmaz. Mivel a publikus **Vercel szerver** egy felhőalapú adatközpontban fut (AWS Frankfurt), és a kiegészítő **nem használ videó proxyt** (`Zero Proxy`), egyes fájlmegosztók viselkedése eltér a felhőben és otthoni interneten (**Self-Host**):

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
  Minden adóhoz egyedi artwork tartozik, a weboldalon pedig VLC `.xspf` és Kodi/TiviMate `.m3u` lista is letölthető.

### 📋 Elérhető Élő Csatornák Kategóriánként (Összesen 162 Adó):
- **🔴 Országos & Kereskedelmi (`28` adó):** RTL, TV2, M1, Duna, Super TV2, RTL Kettő, RTL Három, RTL Gold, RTL Otthon, ATV, ATV Spirit, Hír TV, Dikh TV, Viasat 3, Viasat 6, Prime, Izaura TV stb.
- **🎬 Film & Sorozat (`24` adó):** Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1–3, Film4, TV4, Story4, Film Mánia, AXN Spin, Magyar Mozi TV, Moziklub, Sorozat+, Sorozatklub stb.
- **🌍 Ismeretterjesztő & Doksi (`14` adó):** National Geographic, Nat Geo Wild, Discovery Channel, Animal Planet, ID, Spektrum, Spektrum Home, History, Viasat Explore, Viasat History, HGTV, Food Network, Travel Channel, The Fishing & Hunting.
- **⚽ Sport, Zene & Életmód (`20` adó):** M4 Sport, Sport 1, Sport 2, Spíler 1, Spíler 2, Arena4, Match 4, EuroSport 1, TV Paprika, Sláger TV, Muzsika TV, Zenebutik, Life TV, PVTV, Kincsem Park stb.
- **🧸 Rajzfilm & Gyerek (`8` adó):** Disney Channel, Minimax, Nickelodeon, Nick Jr., Nicktoons, TV2 Kids, JimJam, Kölyökklub.
- **📍 Helyi & Városi TV-k (`68` adó):** Debrecen TV, Fehérvár TV, Tisza TV, Szeged TV, Nyíregyházi TV, Kecskeméti TV, Eger TV, Szolnok TV, Gyöngyösi TV, Kapos TV stb. *(A konfigurátorban egy kattintással kikapcsolható a "Helyi nélkül" gombbal.)*

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

### A) PC / Mac / Linux (Node.js v18+)
```bash
git clone https://github.com/Player798xy/nuvio-magyar-http.git
cd nuvio-magyar-http
npm install
npm start
```
Az addon elérhető lesz a `http://127.0.0.1:7000/manifest.json` (valamint a helyi hálózati IP-címeden) keresztül, ellenőrzéshez pedig futtatható az `npm test` (`scripts/verify.js`).

### B) Android telefon / TV Box (Termux)
```bash
pkg update -y && pkg install -y nodejs git
git clone https://github.com/Player798xy/nuvio-magyar-http.git
cd nuvio-magyar-http
npm install
npm start
```
*(Port: `7000`, felülbírálható a `PORT` környezeti változóval.)*

---

## 📣 9. Közösségi Megosztás (Reddit Poszt Sablon)

<details>
<summary>📋 <b>Kattints ide a Reddit poszt szövegének megnyitásához!</b></summary>

```markdown
# 🇭🇺 [Megosztás] Magyar HTTP Streams (v2.7.0) – Magyar filmek, sorozatok, feliratok és 162 Élő TV adó + EPG torrent, Debrid és proxy nélkül!

Sziasztok!

Elkészült a **Magyar HTTP Streams (`v2.7.0`)** addon **Nuvio** és **Stremio** lejátszókhoz — teljesen Zero Proxy módban, közvetlen HTTP (`1080p/720p MP4` és `HLS`) linkekkel!

### ✨ Újdonságok és funkciók:
- **📝 Magyar Feliratok (OpenSubtitles HU):** Automatikus magyar `.srt` feliratok filmekhez és sorozatokhoz (IMDb & TMDB), a webes konfigurátorban ki/be kapcsolható.
- **📺 162 Élő Magyar TV Adó + Valós Idejű EPG:** RTL, TV2, MTVA (M1–M5), M4 Sport, Sport 1–2, Spíler 1–2, Arena4, Match 4, EuroSport 1, Film+, Mozi+, Spektrum, Discovery, Disney, Minimax, Nick, 68 Helyi TV — élő **Most / Következő** műsorinfóval (`port.hu`), halott csatornák nélkül.
- **⚡ 13 Magyar VOD Forrás & Okos Edge Cache:** Videa, JobbMintATV, Filmezek, Filmvilág2, MeseKincstár, Videakid, Indavideo, MédiaKlikk, NetMozi Vercelen is azonnali direkt linkekkel (+ Self-Hoston VOE / HDMozi / DMDAMedia).
- **📱 Mobilbarát Konfigurátor:** https://nuvio-magyar-http.onrender.com/configure

### 🔗 Telepítés:
- **Manifest URL:** `https://nuvio-magyar-http.onrender.com/manifest.json`
- **GitHub:** https://github.com/Player798xy/nuvio-magyar-http
```
</details>

---

## 🛠️ 10. Projekt Struktúra

- [`server.js`](server.js) — Express HTTP szerver, Vercel Edge `Cache-Control` szabályok, `/manifest.json`, `/catalog`, `/meta`, `/subtitles`, `/stream`, `/proxy/hls` (`302`), `/api/test`, `/playlist.xspf/.m3u`.
- [`src/addon.js`](src/addon.js) — Addon konfiguráció-kezelő (`parseConfig`, forrás/felbontás/katalógus/`subtitles` kapcsoló), manifest generátor, párhuzamos scraper futtató és EPG stream-formázás.
- [`src/subtitles.js`](src/subtitles.js) — Magyar OpenSubtitles v3 feliratkereső és TMDB → IMDb ID feloldó.
- [`src/epg.js`](src/epg.js) — Valós idejű `port.hu` műsorújság (EPG) feloldó és memória-cache.
- [`src/catalogs.js`](src/catalogs.js) & [`src/catalog.js`](src/catalog.js) — Heti rotációs VOD katalógusok, MédiaKlikk Klasszikusok és EPG-dúsított Live TV metaadatok.
- [`src/scrapers/onlinestream.js`](src/scrapers/onlinestream.js) — 162 ellenőrzött élő magyar TV csatorna kezelője közvetlen EU CDN és tartalék-szűréssel.
- [`src/scrapers/`](src/scrapers/) — A 13 magyar forrás-modul (`videa.js`, `jobbmintatv.js`, `filmezek.js`, `filmvilag.js`, `mesefilm.js`, `videakid.js`, `indavideo.js`, `mediaklikk.js`, `netmozi.js`, `onlinefilmek.js`, `sorozatok_net.js`, `hdmozi.js`, `dmdamedia.js`).
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
