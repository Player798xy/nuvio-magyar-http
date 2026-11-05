# 🇭🇺 Magyar HTTP Streams — Nuvio & Stremio Addon (`v2.3.0`)

[![Vercel Status](https://img.shields.io/badge/Vercel_Cloud-Online_(fra1_Frankfurt)-success?style=for-the-badge&logo=vercel)](https://nuvio-magyar-http.vercel.app/configure)
[![Források](https://img.shields.io/badge/Magyar_Források-13_Modul-blue?style=for-the-badge)](#2-melyik-forrás-működik-vercelen-és-melyikhez-kell-self-host)
[![Katalógusok](https://img.shields.io/badge/Katalógusok-7_Heti_Rotációs-orange?style=for-the-badge)](#5-heti-rotációs-katalógusok-poszter--forrás-garancia)
[![Licenc](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

Közvetlen **Direct HTTP** magyar szinkronos és feliratos film-, sorozat-, mese- és élő TV-streamek **Nuvio** és **Stremio** lejátszókhoz — **torrent (P2P) és Real-Debrid előfizetés nélkül!**

---

## 🚀 1. Azonnali Telepítés (Publikus Vercel Szerver)

A kiegészítő azonnal használható a publikus európai (**Frankfurt `fra1`**) szerverről:

- ⚙️ **Konfigurációs oldal & Telepítő (Ajánlott):**
  👉 **[https://nuvio-magyar-http.vercel.app/configure](https://nuvio-magyar-http.vercel.app/configure)**
- 🔗 **Alapértelmezett Manifest URL (Nuvio / Stremio bemásoláshoz):**
  ```text
  https://nuvio-magyar-http.vercel.app/manifest.json
  ```
- ⚡ **Stremio 1-kattintásos telepítés:**
  ```text
  stremio://nuvio-magyar-http.vercel.app/manifest.json
  ```

> 💡 **Tipp a Konfigurációs oldalhoz (`/configure`):** Kiválaszthatod, melyik forrásokat és katalógusokat szeretnéd látni, a rendszer pedig egy egyedi URL-t generál neked!

---

## 🌐 2. Melyik forrás működik Vercelen és melyikhez kell Self-Host?

A kiegészítő **13 magyar streaming forrást** tartalmaz. Mivel a publikus **Vercel szerver** egy felhőalapú adatközpontban fut (AWS Frankfurt), néhány videómegosztó másképp viselkedik felhőből, mint otthoni internetről (**Self-Host**):

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
| **8** | **🔴 MédiaKlikk (`mediaklikk`)** | Klasszikusok & Élő TV | ✅ **95%** *(VOD 100%)* | ✅ **100%** | **43 MTVA Klasszikus + Magyar népmesék + archívum** Vercelen is 100%-os! *(Az M4 Sport élő adás csak magyar IP-ről megy).* |
| **9** | **🎬 NetMozi (`netmozi`)** | Film & Sorozat | ⚡ **Részleges** *(Videa/OK)* | ✅ **100% (+VOE 1080p)** | FNV-1a `linkPayload` dekódolás. A **VOE** tükrök IP-kötöttek (`&i=...&asn=...`), így a VOE streamek automatikusan Self-Hoston aktiválódnak. |
| **10** | **🎞️ OnlineFilmek (`onlinefilmek`)** | Film & Sorozat | ⚡ **Részleges** *(Videa/OK)* | ✅ **100% (+VOE 1080p)** | DooPlayer v2 AJAX API. A Videa/OK.ru tükrök Vercelen is mennek, a **VOE 1080p HLS/MP4** tükrök Self-Hoston. |
| **11** | **📂 Sorozatok.net (`sorozatoknet`)** | Sorozat | ⚡ **Részleges** *(Videa/OK)* | ✅ **100% (+VOE 1080p)** | `d.sorozatok.net` `hunter` JS dekódolás. A **VOE 1080p** epizódok Self-Hoston mennek teljes sebességgel. |
| **12** | **🔥 HDMozi (`hdmozi`)** | Film & Sorozat | ❌ *Cloudflare tiltás* | ✅ **100% (1080p HLS)** | AES-128-CBC `rpmshare` 1080p HLS dekódolás. A Cloudflare blokkolja az AWS/Vercel adatközponti IP-ket, otthoni IP-ről viszont hibátlan. |
| **13** | **💿 DMDAMedia (`dmdamedia`)** | Film & Sorozat | ❌ *Cloudflare tiltás* | ✅ **100%** | A `dmdamedia.hu` tűzfala tiltja a felhős szervereket; saját gépen (Self-Host) azonnal működik. |

### 🔍 Miért van különbség bizonyos forrásoknál?
1. **VOE CDN IP-kötés (`NetMozi`, `OnlineFilmek`, `Sorozatok.net`):** A VOE videómegosztó a generált `.m3u8` / `.mp4` linkbe beleégeti annak a gépnek az IP-címét és szolgáltatóját (`&i=IP_CIM&asn=SZOLGALTATO`), amelyik lekérte az oldalt. Ha a Vercel szerver kéri le, a link a Vercel IP-jéhez lesz kötve, így a te telefonodon/TV-den nem indul el. **Ezért a kiegészítő Vercelen automatikusan kihagyja a VOE linkeket (hogy ne kapj hibás/töltőképernyős forrást), Self-Host módban viszont automatikusan bekapcsolja őket!**
2. **OK.ru 5 másodpercenkénti akadás javítása (`JobbMintATV`, `Filmezek`):** Az OK.ru a sima `.mp4` (`ct=0`) fájlokat 10 másodperc után `~500 KB/s`-ra korlátozza (`&pr=10`), a központi `video.m3u8` pedig 5 másodpercenként felbontást váltogat. A kiegészítő ehelyett a **fix felbontású HLS sáv-lejátszási listákat (`.../fn/track.m3u8` és `.../video/index.m3u8`)** nyeri ki, ahol minden `.ts` szelet külön HTTP kéréssel, **korlátozás nélkül (`5–10 MB/s`)** töltődik le!

---

## ⚠️ 3. Miért jöhet be néha rossz film a Videa / közösségi forrásokból, és hogyan védekezünk ellene?

Amikor a **Videa**, **Indavideo** vagy **Videakid** forrásokat használod, fontos tudni, hogyan működnek ezek az oldalak:
- Ezek **közösségi videómegosztók** (mint a YouTube), ahová a felhasználók kézzel írják be a videók címét.
- Sok feltöltő **nem írja oda a megjelenési évet** a címbe (pl. csak annyit ír: *„A hét mesterlövész teljes film magyarul”*), vagy egy **másik évben készült feldolgozást (remake-et)**, esetleg egy hasonló című filmet tölt fel.

### 🛡️ Hogyan szűri ki a kiegészítő a rossz filmeket? (3 lépcsős védelem)

1. **Szigorú cím-, folytatás- és évszám-ellenőrzés (`±1 év`):**
   - Ha a videó címében vagy a feltöltési dátumában szerepel egy évszám, és az több mint `±1 évvel` eltér a keresett filmtől (pl. az **1960-as** *A hét mesterlövész* a **2016-os** helyett, vagy egy 2012-ben feltöltött videó egy 2016-os filmhez), a kiegészítő **automatikusan eldobja**.
   - Ha te az 1. részt keresed (pl. *Shrek*), a szűrő automatikusan kizárja a folytatásokat (*Shrek 2*, *Shrek 3*, *Shrek 4*).
2. **Játékidő (Runtime) validáció (`±10 perc` + 4% PAL DVD korrekció):**
   - A kiegészítő lekéri a film hivatalos hosszát a Cinemeta/TMDB adatbázisból (pl. `132 perc`), és összehasonlítja a Videa/OK.ru/MeseKincstár videó tényleges másodperc-alapú hosszával.
   - Figyelembe veszi a magyar **PAL DVD/TV 25fps felgyorsítást (4%-kal rövidebb játékidő)** is. Ha a videó hossza több mint `10 perccel` eltér (pl. előzetes, részlet, vagy egy másik film), **automatikusan kiszűri**.
3. **⚠️ `[Lehet nem jó a videó!]` figyelmeztető jelzés a Nuvio/Stremio listában:**
   - Ha egy videó címe pontosan egyezik és a hossza is megfelelő, de **a feltöltő nem írt évszámot a címbe** (így 100%-os biztonsággal nem igazolható az évjárat), a forrás neve mellett megjelenik a figyelmeztetés:
     > `🎥 Videa • 720p HD ⚠️ [Lehet nem jó a videó!]`
   - A **✅ igazolt évszámú** és kurátori források (*JobbMintATV, Filmezek, MeseKincstár, MédiaKlikk*) mindig a lista **elejére** kerülnek!

---

## 📺 4. MédiaKlikk Klasszikusok (MTVA) & Magyar Népmesék

A kiegészítő külön kurátori katalógust kínál a **MédiaKlikk / Hirado.hu / MTVA Archívum** hivatalos, **1080p FHD** minőségű klasszikus magyar rajzfilmjeiből, sorozataiból és filmjeiből:
- 🐉 **Süsü, a sárkány kalandjai** *(összes epizód)*
- 🐦 **Magyar népmesék** *(széria & epizódok)*
- 🎣 **A nagy ho-ho-horgász**, **Pom Pom meséi**, **Frakk, a régizik réme**, **Mézga család**, **Kukori és Kotkoda**, **Vízipók-csodapók**, **Dr. Bubó**
- 🎬 **Macskafogó**, **Vuk**, **Lúdas Matyi**, **János vitéz**, **Szaffi**, **Indul a bakterház**, **A tanú**, **Az ötödik pecsét**

---

## 🔄 5. Heti Rotációs Katalógusok (Poszter + Forrás Garancia)

A főoldali katalógusok (**🔥 Magyar Trendi Filmek**, **🎬 Magyar Mozifilmek (Mafab)**, **📺 Magyar Trendi Sorozatok**, **🏛️ MédiaKlikk Klasszikusok**) úgy lettek felépítve, hogy:
1. **Garantált HD Poszter:** Egyetlen film vagy sorozat sem jelenik meg üres/hiányzó borítókép nélkül.
2. **Garantált Magyar Forrás:** Kiszűri a még be sem mutatott vagy csak moziban futó, online szinkronos streammel nem rendelkező filmeket, és előnyben részesíti a **Mafab / MédiaKlikk / Videa / JobbMintATV** által igazolt magyar közönségkedvenceket.
3. **Automatikus Heti Rotáció (Vercel-kompatibilis):** Az ISO naptári hét (`getWeeklyRotationSeed`) alapján **minden héten automatikusan frissül és átrendeződik** a katalógusok kínálata Vercelen is, így minden héten újabb magyar szinkronos filmeket és klasszikusokat fedezhetsz fel!

---

## 🏠 6. Self-Host Telepítési Útmutató ( mind a 13 forrás 100%-os feloldásához!)

Ha szeretnéd, hogy a **HDMozi**, **DMDAMedia**, **NetMozi (VOE)**, **OnlineFilmek (VOE)** és **Sorozatok.net (VOE)** is 100%-osan, a saját otthoni magyar IP-címeddel működjön, **2 perc alatt** elindíthatod a kiegészítőt a saját gépeden, NAS-odon vagy akár Android telefonodon!

### A) Indítás PC-n / Mac-en / Linuxon (Node.js)

1. Telepítsd a [Node.js](https://nodejs.org/) (v18+) környezetet.
2. Nyiss egy terminált (vagy PowerShellt) és futtasd:
   ```bash
   git clone https://github.com/Player798xy/nuvio-magyar-http.git
   cd nuvio-magyar-http
   npm install
   npm start
   ```
3. A szerver elindul a `http://127.0.0.1:7000` címen (és kiírja a helyi hálózati IP-címedet is, pl. `http://192.168.1.50:7000/manifest.json`, amit a TV-den vagy telefonodon lévő Nuvio/Stremio appba írhatsz be!).

### B) Indítás Android telefonon / TV Boxon (Termux)

1. Telepítsd a **Termux** alkalmazást (F-Droidról vagy GitHubról).
2. Futtasd az alábbi parancsokat:
   ```bash
   pkg update -y && pkg install -y nodejs git
   git clone https://github.com/Player798xy/nuvio-magyar-http.git
   cd nuvio-magyar-http
   npm install
   npm start
   ```
3. Add hozzá a Nuvio / Stremio alkalmazáshoz:
   ```text
   http://127.0.0.1:7000/manifest.json
   ```

### C) Indítás Dockerrel (Home Server / Synology NAS / Raspberry Pi)

```bash
git clone https://github.com/Player798xy/nuvio-magyar-http.git
cd nuvio-magyar-http
node server.js
```
*(Port: `7000`, környezeti változóval felülbírálható: `PORT=7000`)*

---

## 📣 7. Közösségi Megosztás (Reddit Poszt Sablon)

Ha szeretnéd megosztani a projektet Redditen (`r/StremioAddons`, `r/hungary`, `r/kockak`), használd bátran az alábbi bemutatót:

<details>
<summary>📋 <b>Kattints ide a Reddit poszt szövegének megnyitásához!</b></summary>

```markdown
# 🇭🇺 [Megosztás] Magyar HTTP Streams (Nuvio & Stremio Addon) – Magyar szinkronos filmek, sorozatok, mesék és MTVA klasszikusok torrent és Debrid nélkül!

Sziasztok!

Elkészült a **Magyar HTTP Streams** addon legújabb (`v2.3.0`) verziója **Nuvio** és **Stremio** lejátszókhoz. A cél egy olyan magyar kiegészítő volt, ami **nem használ torrentet (P2P)** és **nem igényel fizetős Real-Debrid előfizetést**, hanem közvetlen HTTP streameket (`1080p/720p MP4` és `HLS`) játszik le magyar videómegosztókról és archívumokból.

### ✨ Főbb újdonságok és funkciók:
- **13 Magyar Forrás:** Videa, JobbMintATV, Filmezek, Filmvilág2, MeseKincstár, Videakid, Indavideo, MédiaKlikk (MTVA Archívum + Magyar népmesék + Süsü), NetMozi, OnlineFilmek, Sorozatok.net, HDMozi, DMDAMedia.
- **Akadásmentes OK.ru 1080p HLS javítás:** A JobbMintATV és Filmezek OK.ru forrásai mostantól fix felbontású HLS szegmenseket használnak (Frankfurt EU szerverről), így megszűnt az 5 másodpercenkénti pufferelés.
- **Okos 3-lépcsős szűrő a rossz videók ellen:** Mivel a Videa/Indavideo közösségi feltöltéseknél néha más évjáratú (remake) filmek vannak fent, az addon ellenőrzi a címet, a megjelenési évet (`±1 év`) és a film tényleges hosszát (`±10 perc` + PAL korrekció). Ha egy videón nincs évszám, külön `⚠️ [Lehet nem jó a videó!]` jelzést kap.
- **7 Magyar Katalógus heti rotációval:** Magyar Trendi Filmek, Mafab Mozifilmek, MédiaKlikk Klasszikusok (43 felújított klasszikus magyar mese és film), Élő Magyar TV — garantált poszterekkel és heti frissüléssel.

### 🔗 Telepítés (Ingyenes Publikus Szerver):
- **Konfiguráció & Telepítés:** https://nuvio-magyar-http.vercel.app/configure
- **Manifest URL (Nuvio / Stremio):** `https://nuvio-magyar-http.vercel.app/manifest.json`

### 🏠 Self-Host lehetőség (Haladóknak):
A publikus Vercel szerveren 8 forrás (Videa, JobbMintATV, Filmezek, Filmvilág2, MeseKincstár, Videakid, Indavideo, MédiaKlikk) azonnal 100%-osan működik. Azokhoz a forrásokhoz, amik otthoni IP-hez kötik a videó tokent (VOE tükrök a NetMozi/OnlineFilmek/Sorozatok.net-en) vagy Cloudflare-rel tiltják a felhős szervereket (HDMozi, DMDAMedia), a GitHub oldalon találtok 1-perces PC / Termux (Android) Self-Host leírást:
- **GitHub Repo & Dokumentáció:** https://github.com/Player798xy/nuvio-magyar-http

Visszajelzéseket, ötleteket és hibajelentéseket szívesen fogadok! Jó filmezést! 🍿

*(Jogi nyilatkozat: Ez a kiegészítő nem tárol, nem tölt fel és nem hosztol semmilyen médiafájlt; kizárólag nyilvánosan elérhető külső weboldalak hivatkozásait indexeli keresőmotorként, oktatási és kutatási célból. A fejlesztő semmilyen felelősséget nem vállal a külső tartalmakért vagy esetleges hibákért.)*
```
</details>

---

## 🛠️ 8. Projekt Struktúra

- [`src/addon.js`](src/addon.js) — Stremio/Nuvio SDK szerver, párhuzamos forrás-lekérdezés, `yearVerified` rendezés és `⚠️ [Lehet nem jó a videó!]` jelölés.
- [`src/catalogs.js`](src/catalogs.js) & [`src/catalog.js`](src/catalog.js) — Heti rotációs (`getWeeklyRotationSeed`) magyar katalógusok, Mafab és MédiaKlikk Klasszikusok (43 kurátori műsor), garantált poszter- és lejátszhatósági szűrő.
- [`src/utils/crypto_decoders.js`](src/utils/crypto_decoders.js) — RC4, AES-128-CBC (`rpmshare`), FNV-1a (`NetMozi`), `hunter` (`Sorozatok.net`) és `VOE` (`extractVoeDirectStreams`) dekóderek.
- [`src/scrapers/`](src/scrapers/) — A 13 önálló magyar forrás-modul (`videa.js`, `jobbmintatv.js`, `filmezek.js`, `filmvilag.js`, `mesefilm.js`, `videakid.js`, `indavideo.js`, `mediaklikk.js`, `netmozi.js`, `onlinefilmek.js`, `sorozatok_net.js`, `hdmozi.js`, `dmdamedia.js`).
- [`vercel.json`](vercel.json) — Európai (`fra1` Frankfurt) Serverless konfiguráció és gyorsítótár-szabályok.

---

## ⚖️ 9. Jogi Nyilatkozat és Felelősségkizárás (Legal Disclaimer)

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
