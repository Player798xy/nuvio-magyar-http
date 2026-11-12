# NUVIO-MAGYAR-HTTP — TELJES PROJEKT & ARCHITEKTÚRA ÖSSZEFOGLALÓ (GEMINI HYDROGEN HANDOVER)

Ez a dokumentum a **nuvio-magyar-http** projekt teljes jelenlegi állapotát, működését, belső mechanizmusait, a felderített hibákat és azok javításait tartalmazza. Kifejezetten úgy készült, hogy egy új AI modell (Gemini Hydrogen) vagy fejlesztő ebből a fájlból 100%-os pontossággal folytatni tudja a munkát.

---

## 1. Projekt Áttekintés

* **Név:** `nuvio-magyar-http`
* **Verzió:** `2.6.5`
* **Platform:** Node.js (Express) + Vercel Serverless (Frankfurt `fra1`)
* **GitHub Repó:** `https://github.com/Player798xy/nuvio-magyar-http` (branch: `main`)
* **Éles Vercel URL:** `https://nuvio-magyar-http.vercel.app`
* **Stremio / Nuvio Manifest:** `https://nuvio-magyar-http.vercel.app/manifest.json`
* **Webes Konfigurátor & Tesztelő:** `https://nuvio-magyar-http.vercel.app/configure`
* **XSPF Lejátszási Lista (VLC / Kodi):** `https://nuvio-magyar-http.vercel.app/playlist.xspf`

---

## 2. Architektúra & Fő Filozófia

1. **Zero-Proxy Videó Streamelés Vercelen:**
   * A Vercel ingyenes csomagja havi 100 GB sávszélességet és 50 másodperces execution timeoutot engedélyez.
   * Emiatt a videó streameket (MP4 / HLS TS szegmensek) **NEM a Vercelen keresztül streameljük át**, hanem a szerver csak feloldja a közvetlen `.m3u8` / `.mp4` CDN linkeket vagy beágyazott lejátszó URL-eket, és a kliens (Nuvio, Stremio, böngésző) közvetlenül a CDN-ről játssza le őket.
2. **Kettős működési mód:**
   * **Vercel Cloud:** Felhőben futó publikus addon.
   * **Self-Host (helyi futtatás / Docker):** A felhasználó otthoni IP-címéről fut, így a helyhez/IP-hez kötött szolgáltatók (pl. VOE, Vidmoly közvetlen Exoplayer HLS) natívan működnek.

---

## 3. Támogatott Szolgáltatók (14 Forrás)

A `src/addon.js`-ben regisztrált `ALL_SCRAPERS`:

1. **Videa** (`videa.js`): Közvetlen MP4 / HLS minőségek (1080p, 720p, 480p, 360p).
2. **Indavideo** (`indavideo.js`): Közvetlen MP4 videók.
3. **JobbMintATV** (`jobbmintatv.js`): Sorozat/film közvetlen és beágyazott linkek.
4. **HDMozi** (`hdmozi.js`): Közvetlen HLS / MP4 (Self-host preferált).
5. **Filmvilág2** (`filmvilag2.js`): Film és mese aggregátor.
6. **MédiaKlikk** (`mediaklikk.js`): Nemzeti Audiovizuális Archívum és M1–M5 VOD programok.
7. **NetMozi** (`netmozi.js`): **(Frissen javítva!)** 100%-os film- és sorozatbázis Mindjart közvetlen feloldással.
8. **Filmezek** (`filmezek.js`): Magyar szinkronos filmforrások.
9. **OnlineFilmek** (`onlinefilmek.js`): Film- és sorozatkereső.
10. **DMDAMedia** (`dmdamedia.js`): Sorozat adatbázis.
11. **MeseFilm** (`mesefilm.js`): Gyermek- és rajzfilmek.
12. **Videakid** (`videakid.js`): Gyermek Videa kategóriák.
13. **Sorozatok.net** (`sorozatoknet.js`): Epizódlista és tárhely feloldás.
14. **OnlineStream IPTV** (`onlinestream.js`): 100+ magyar és regionális élő TV csatorna.

---

## 4. Élő TV Rendszer (GradeTV + OnlineStream + MédiaKlikk)

* **Csatornalista:** Több mint 100 magyar csatorna (M1, M2, M4 Sport 1080p FHD, RTL, TV2, Duna, Film+, Mozi+, Animal Planet, Discovery, helyi körzeti TV-k).
* **GradeTV Integráció:**
  * Endpoint: `https://m3m8.gradetv.net/api/s/...`
  * **120 perces napi limit bypass:** A GradeTV hálózatonként (IP-címenként) 120 ingyenes percet ad HLS csatornákra. A szerver fejléc rotációval és közvetlen CDN végpontokkal kerüli meg a korlátozást.
  * **Szerverválasztás:** Automatikus EU / leggyorsabb szerver prioritás.
* **Dinamikus SVG Ikon- és Grafika Generálás (`src/tv_graphics.js`):**
  * Minden csatornához automatikusan generálódik sötét témájú, elegáns SVG logó, poszter (`/tv-posters/:id.svg`) és háttérkép (`/tv-backgrounds/:id.svg`).
  * Külön stílus a tematikus csatornáknak (pl. Animal Planet zöld állatvilág motívummal, sportcsatornák kék/piros dinamikus neonnal).

---

## 5. A NetMozi Rendszer Részletes Működése & Hibajavítások

### A) Mindjart Bypass Mechanizmus
A NetMozi weboldalán a filmek és sorozatok egy rejtett AJAX/iframe rendszert használnak.
A közvetlen és korlátlan feloldási út:
1. Az elem azonosítója a `movieId` (pl. `42579`).
2. Ezt base64 kódoljuk: `Buffer.from(movieId).toString('base64')` (pl. `NDI1Nzk=`).
3. Sorozatoknál a közvetlen link: `https://mindjart.megnezed.com/links/vv/${b64}/${season}/${episode}`
4. A HTML táblázatból kinyerjük a megnyitási útvonalakat: `/links/open/<id>` (pl. `/links/open/2933144`).
5. A `/links/open/<id>` egy HTTP 302 átirányítással elküld a tényleges tárhelyre:
   * **Vidmoly:** `https://vidmoly.me/w/<id>` vagy `embed-<id>.html`
   * **VOE:** `https://voe.sx/<id>` vagy `susanexpectcare.com/<id>`
   * **DoodStream / Byse:** `https://bysesayeveum.com/d/<id>`
   * **Savefiles:** `https://savefiles.com/<id>`

### B) VOE Extractor & DDoS-Guard Bypass
* **Hiba volt:** A `voe.sx` front domaint a DDoS-Guard és Cloudflare védi a datacenter IP-k (Vercel AWS) ellen (HTTP 403 Challenge), ráadásul a `User-Agent` fejléc `undefined` volt.
* **Megoldás (`src/utils/hosters.js`):**
  1. Fix valós böngésző `User-Agent` beállítása.
  2. Ha a `voe.sx` nem elérhető vagy DDoS-Guard védelmet dob, automatikusan az aktív tükördomainre ugrik: `https://susanexpectcare.com/${slug}`.
  3. A VOE oldalon lévő új 5-lépcsős titkosított JSON payloadot a `src/utils/crypto_decoders.js` `decodeVoePayload` függvénye fejti meg:
     * ROT13 transzpozíció
     * Zajkarakterek törlése (`@$`, `^^`, `~@`, `%?`, `*~`, `!!`, `#&`)
     * Base64 dekódolás
     * Karakterkódok csökkentése 3-mal (`fromCharCode(code - 3)`)
     * String megfordítása (`reverse()`)
     * Második Base64 dekódolás -> Eredmény: JSON objektum `{ source: 'https://ugc-cdn-.../master.m3u8', direct_access_url: 'https://ugc-cdn-.../download/...mp4' }`.
  4. Így előáll:
     * **VOE HD HLS 1080p**
     * **VOE Direct MP4 720p**

### C) Vidmoly Extractor
* **Cím:** `https://vidmoly.biz/embed-${id}.html`
* **Kinyerés:** A forráskódból közvetlenül kinyeri a `.m3u8` playlist URL-t (`https://prx-1331-ant-q.vmpx.online/hls2/.../master.m3u8?t=...`).

### D) A 403 Forbidden és Végtelen Puffer Valódi Oka (CDN Token IP/ASN Binding)
* **A jelenség:** Amikor a felhasználó a Nuvioban elindította a filmet, vagy a böngészőben rákattintott a `.m3u8` linkre, az nginx `403 Forbidden`-t adott, a Nuvio pedig végtelenül pufferelt.
* **A rejtély megoldása:**
  * Mind a Vidmoly (`*.vmpx.online`), mind a VOE (`*.cloudwindow-route.com`) tárolószerverei **`secure_link_md5` token hitelesítést** használnak (`t=` paraméter a linkben).
  * A tokent a szerver a letöltő IP-címéből és ASN-jéből számolja ki.
  * Mivel a Vercel futtatta az embed kinyerést, a token az **Amazon AWS frankfurti IP-jére (`asn=16509`)** lett kiállítva.
  * Amikor a felhasználó otthoni magyar internetjéről (pl. Telekom `asn=5483`, Vodafone, Digi) a lejátszó közvetlenül kérte a `.m3u8` fájlt, a CDN nginx szervere összehasonlította a bejövő IP-t a tokennel -> **IP/ASN eltérés miatt 403 Forbidden!**
* **A megoldás:**
  1. A stream objektumok mostantól tartalmazzák a **`playerUrl`** és **`externalUrl`** mezőket is:
     * Vidmoly esetén: `https://vidmoly.me/embed-${id}.html`
     * VOE esetén: `https://susanexpectcare.com/${slug}`
  2. A webes tesztelőben (`public/index.html`) a **„Megnyitás →”** gomb már a `playerUrl`-t nyitja meg a böngészőben. Így a felhasználó böngészője közvetlenül kéri le a beágyazott lejátszót, a token a saját lakossági IP-jére íródik alá, és a videó **azonnal 1080p Full HD-ban elindul, 403 hiba nélkül!**
  3. Nuvio / Stremio alatt a felhasználó külső lejátszóval / böngészővel is megnyithatja, míg Self-Host esetén a Nuvio belső lejátszója is natívan viszi.

---

## 6. Fájlstruktúra & Kulcsfájlok

```
nuvio-magyar-http/
├── api/
│   └── index.js                   # Vercel Serverless belépési pont (exportálja a server.js-t)
├── public/
│   ├── index.html                 # Modern sötét témájú konfigurátor és élő stream tesztelő
│   └── tv-posters/                # Generált TV csatorna poszterek
├── src/
│   ├── addon.js                   # Stremio Addon SDK: manifest, handleStreamRequest, bingeGroups
│   ├── catalog.js                 # Katalógus definíciók és keresés (Cinemathéque / IMDb fallback)
│   ├── tv_graphics.js             # SVG grafika generátor TV csatornákhoz
│   ├── scrapers/
│   │   ├── netmozi.js             # NetMozi: TLS bypass, Mindjart direct resolver, epizódkereső
│   │   ├── onlinestream.js        # GradeTV + OnlineStream élő TV csatornák (100+)
│   │   ├── mediaklikk.js          # MédiaKlikk élő adások + VOD
│   │   ├── videa.js               # Videa közvetlen videók
│   │   └── ... (többi 10 scraper)
│   └── utils/
│       ├── hosters.js             # Univerzális hoster feloldó: extractVidmoly, extractVoe, resolveAnyEmbed
│       ├── crypto_decoders.js     # VOE 5-lépcsős dekóder, Dean Edwards packer unpacker, RPM dekóder
│       ├── meta.js                # IMDb / TMDb / Cinemathéque metaadat feloldó
│       └── videa_indavideo.js     # Videa és Indavideo belső HLS/MP4 kinyerő
├── server.js                      # Express szerver, routing, TV XSPF lejátszási lista, stream endpointok
├── package.json                   # v2.6.5
└── vercel.json                    # Vercel build és routing konfiguráció
```

---

## 7. Főbb API Végpontok

* `GET /manifest.json`: Stremio/Nuvio kompatibilis manifest (katalógusok, típusok, források).
* `GET /stream/:type/:id.json`: Film és sorozat stream lekérés:
  * Film pl.: `/stream/movie/tt0091461.json` (Macskafogó)
  * Sorozat pl.: `/stream/series/netmozi:series:42579:2:11.json` (Ingatlanvadászok S02E11)
* `GET /api/provider-test?provider=netmozi&title=Ingatlanvadászok&type=series&season=2&episode=11`: Szolgáltató tesztelő végpont (azonnal visszaadja a kinyert streameket, minőséget, időtartamot).
* `GET /playlist.xspf` vagy `/tv.xspf`: VLC / Kodi kompatibilis XML lejátszási lista az összes élő TV csatornával.
* `GET /configure`: Interaktív webes konfigurátor és forrástesztelő.

---

## 8. Fejlesztési & Telepítési Útmutató

### Helyi futtatás (Self-Host):
```bash
git clone https://github.com/Player798xy/nuvio-magyar-http.git
cd nuvio-magyar-http
npm install
npm start
# A szerver a http://localhost:7000 címen fut
```

### Élesítés Vercelre:
```bash
git add .
git commit -m "feat/fix: leírás"
git push origin main
# A Vercel Git integráció automatikusan építi és élesíti másodpercek alatt
```

---

## 9. Következő Lehetséges Lépések (Gemini Hydrogen Teendők)

1. **További tárhelyek támogatása:** Ha a NetMozi vagy más források újabb tárhelyeket adnak hozzá (pl. Filemoon, Streamwish, DoodStream), a `src/utils/hosters.js`-ben érdemes tovább bővíteni a közvetlen feloldókat.
2. **Könnyűsúlyú HLS Playlist Rewriter:** Opcionálisan bevezethető egy olyan végpont, amely csak a `.m3u8` szöveges playlistet írja át a Vercelen (pár kilobájt), míg a nehéz `.ts` szegmensek a megfelelő refererrel mennek.
3. **Újabb TV csatornák és GradeTV monitoring:** A `src/scrapers/onlinestream.js` csatornalinkjeinek időszakos ellenőrzése és tartalék stream URL-ek frissítése.
