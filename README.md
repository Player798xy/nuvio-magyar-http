# 🇭🇺 Nuvio Magyar HTTP Streaming Addon (Vercel Edition)

Magyar szinkronos és feliratos közvetlen HTTP streaming kiegészítő **Nuvio** és **Stremio** kliensekhez, **Vercel Serverless** környezetre optimalizálva.

## ✨ Főbb funkciók
- **12 Magyar HTTP Forrás**:
  - **Videa.hu** (`_xt` nonce + RC4 XML dekódolás + `fcode` noembed fallback -> közvetlen `1080p`/`720p`/`480p` MP4)
  - **NetMozi.com** (Cloudflare TLS bypass + FNV-1a/xorshift32 v2 `linkPayload` kicsomagoló)
  - **HDMozi.hu** (DooPlayer + `rpmshare.rpmstream.live` AES-128-CBC HLS `.m3u8` dekódolás)
  - **Filmezek.com** (Gyors JSON kereső + Videa / OK.ru / VOE kicsomagolás)
  - **OnlineFilmekIngyen** (DooPlay REST API v2 + AJAX forrásfeloldás)
  - **Sorozatok.net** (2200+ magyar sorozat API + `hunter` JS dekódoló + VOE 5-lépcsős HLS/MP4 kicsomagoló)
  - **MédiaKlikk / MTVA** (7 hivatalos magyar élő TV csatorna: **M4 Sport, M4 Sport+, M1, M2, M5, Duna, Duna World** + MTVA Archívum VOD)
  - **Indavideo.hu** (AMFPHP JSON token + közvetlen MP4 feloldás)
  - **Videakid.hu** (Gyerekfilmek, mesék, animációk közvetlen MP4 streammel)
  - **JobbMintATV** (ISO-8859-2 kereső + közvetlen Videa / Indavideo / OK.ru streamek)
  - **DMDAMedia.hu** (Magyar szinkronos filmek és sorozatok többszerveres feloldása)
  - **MeseKincstár & MeseFilmek.hu** (Magyar rajzfilmek és mesék)
- **Beépített Vercel HTTP & HLS Proxy (`/api/proxy` és `/api/hls`)**:
  - Automatikus `Range` (byte-range seeking) támogatás MP4 streamekhez
  - Egyedi `Referer`, `Origin`, `User-Agent` és magyar `X-Forwarded-For` fejlécek
  - HLS (`.m3u8`) Master Playlist átrendezés (automatikus **1080p Full HD** indítás első helyen)
- **Magyar Címfeloldó Motor**:
  - IMDb azonosítók (`tt...`) párhuzamos feloldása **TMDB (`hu-HU`)**, **Wikidata SPARQL** és **Cinemeta** segítségével.

## 🚀 Telepítés Vercelre

```bash
npm install
npx vercel --prod
```

## 💻 Helyi futtatás és tesztelés

```bash
npm install
npm start
# Tesztcsomag futtatása:
node scripts/verify.js
```

Nyisd meg a `http://localhost:3000/configure` oldalt a böngészőben a források testreszabásához, vagy másold be a `https://<vercel-domain>/manifest.json` címet közvetlenül a **Nuvio** alkalmazásba!
