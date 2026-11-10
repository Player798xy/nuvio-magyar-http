const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

// 1. Update Navigation links
html = html.replace(
  '<a href="#ch02"><span class="ch-tag">02</span>Források (13)</a>\n        <a href="#ch03"><span class="ch-tag">03</span>Katalógusok (12)</a>',
  '<a href="#ch02"><span class="ch-tag">02</span>Források (16)</a>\n        <a href="#ch03"><span class="ch-tag">03</span>Katalógusok (17)</a>'
);
html = html.replace(
  '<a href="#ch02"><span class="ch-tag">02</span>Források (13)</a>\r\n        <a href="#ch03"><span class="ch-tag">03</span>Katalógusok (12)</a>',
  '<a href="#ch02"><span class="ch-tag">02</span>Források (16)</a>\r\n        <a href="#ch03"><span class="ch-tag">03</span>Katalógusok (17)</a>'
);

// 2. Update Dropdown CSS styles
const oldCssTarget = `    /* CH 02 & CH 03: Modern Interactive Dropdown Menus */
    .dropdown-wrap {
      border: 1.5px solid var(--line-3);
      border-radius: 6px;
      background: var(--band);
      overflow: hidden;
      transition: border-color 0.22s ease, box-shadow 0.22s ease;
      margin-bottom: 6px;
    }
    .dropdown-wrap:hover {
      border-color: rgba(255, 255, 255, 0.2);
    }
    .dropdown-wrap.is-open {
      border-color: rgba(0, 223, 162, 0.45);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    #catalogsDropdownWrap.is-open {
      border-color: rgba(167, 139, 250, 0.45);
    }
    .dropdown-trigger {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      background: var(--band);
      cursor: pointer;
      user-select: none;
      transition: background-color 0.18s ease;
    }
    .dropdown-trigger:hover {
      background: var(--band-2);
    }
    .dropdown-trigger:focus-visible {
      outline: 2px solid var(--mint);
      outline-offset: -2px;
    }
    .dropdown-trigger-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1 1 auto;
      min-width: 0;
      flex-wrap: wrap;
    }
    .dropdown-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: var(--panel);
      border: 1px solid var(--line-3);
      color: var(--green);
      flex-shrink: 0;
    }
    #catalogsDropdownWrap .dropdown-icon {
      color: var(--violet);
    }
    .dropdown-title {
      font-family: var(--f-head);
      font-size: 15px;
      font-weight: 700;
      color: var(--ink);
      letter-spacing: -0.015em;
      white-space: nowrap;
    }
    .dropdown-badge {
      font-family: var(--f-ch);
      font-size: 16px;
      padding: 1px 8px;
      border-radius: 4px;
      line-height: 1.1;
      white-space: nowrap;
    }
    .badge-sources {
      background: #0a190b;
      border: 1px solid #254d27;
      color: var(--green);
    }
    .badge-catalogs {
      background: #170b1a;
      border: 1px solid #4c2954;
      color: var(--violet);
    }
    .dropdown-preview {
      font-size: 12px;
      color: var(--dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 320px;
      display: inline-block;
      opacity: 0.85;
    }
    .dropdown-trigger-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .dropdown-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chip-mini {
      padding: 4px 9px;
      font-size: 11.5px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .dropdown-chevron {
      font-size: 11px;
      color: var(--dim);
      display: inline-block;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
      padding: 2px 4px;
      line-height: 1;
    }
    .dropdown-wrap.is-open .dropdown-chevron {
      transform: rotate(180deg);
      color: var(--mint);
    }
    #catalogsDropdownWrap.is-open .dropdown-chevron {
      color: var(--violet);
    }

    /* Smooth accordion animation using grid-template-rows */
    .dropdown-panel {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
      opacity: 0;
      border-top: 1px solid transparent;
    }
    .dropdown-wrap.is-open .dropdown-panel {
      grid-template-rows: 1fr;
      opacity: 1;
      border-top-color: var(--line);
    }
    .dropdown-panel-inner {
      overflow: hidden;
      min-height: 0;
    }
    .dropdown-panel .clean-list {
      border: none;
      border-radius: 0;
      background: transparent;
    }`;

const newCssReplacement = `    /* CH 02 & CH 03: 4 Modern Interactive Dropdown Menus */
    .dropdown-wrap {
      border: 1.5px solid var(--line-3);
      border-radius: 6px;
      background: var(--band);
      overflow: hidden;
      transition: border-color 0.22s ease, box-shadow 0.22s ease;
      margin-bottom: 12px;
    }
    .dropdown-wrap:hover {
      border-color: rgba(255, 255, 255, 0.2);
    }
    .dropdown-wrap.is-open {
      border-color: rgba(0, 223, 162, 0.45);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    #liveSourcesDropdownWrap.is-open {
      border-color: rgba(127, 227, 224, 0.45);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    #vodCatalogsDropdownWrap.is-open,
    #catalogsDropdownWrap.is-open {
      border-color: rgba(167, 139, 250, 0.45);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    #liveCatalogsDropdownWrap.is-open {
      border-color: rgba(255, 82, 119, 0.45);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    .dropdown-trigger {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      background: var(--band);
      cursor: pointer;
      user-select: none;
      transition: background-color 0.18s ease;
    }
    .dropdown-trigger:hover {
      background: var(--band-2);
    }
    .dropdown-trigger:focus-visible {
      outline: 2px solid var(--mint);
      outline-offset: -2px;
    }
    .dropdown-trigger-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1 1 auto;
      min-width: 0;
      flex-wrap: wrap;
    }
    .dropdown-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: var(--panel);
      border: 1px solid var(--line-3);
      color: var(--green);
      flex-shrink: 0;
    }
    #liveSourcesDropdownWrap .dropdown-icon {
      color: var(--cyan);
    }
    #vodCatalogsDropdownWrap .dropdown-icon,
    #catalogsDropdownWrap .dropdown-icon {
      color: var(--violet);
    }
    #liveCatalogsDropdownWrap .dropdown-icon {
      color: var(--rose);
    }
    .dropdown-title {
      font-family: var(--f-head);
      font-size: 15px;
      font-weight: 700;
      color: var(--ink);
      letter-spacing: -0.015em;
      white-space: nowrap;
    }
    .dropdown-badge {
      font-family: var(--f-ch);
      font-size: 16px;
      padding: 1px 8px;
      border-radius: 4px;
      line-height: 1.1;
      white-space: nowrap;
    }
    .badge-sources {
      background: #0a190b;
      border: 1px solid #254d27;
      color: var(--green);
    }
    .badge-live-sources {
      background: #061d1e;
      border: 1px solid #195052;
      color: var(--cyan);
    }
    .badge-vod-catalogs,
    .badge-catalogs {
      background: #170b1a;
      border: 1px solid #4c2954;
      color: var(--violet);
    }
    .badge-live-catalogs {
      background: #240b10;
      border: 1px solid #5a1c27;
      color: var(--rose);
    }
    .dropdown-preview {
      font-size: 12px;
      color: var(--dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 320px;
      display: inline-block;
      opacity: 0.85;
    }
    .dropdown-trigger-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .dropdown-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chip-mini {
      padding: 4px 9px;
      font-size: 11.5px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .dropdown-chevron {
      font-size: 11px;
      color: var(--dim);
      display: inline-block;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
      padding: 2px 4px;
      line-height: 1;
    }
    .dropdown-wrap.is-open .dropdown-chevron {
      transform: rotate(180deg);
      color: var(--mint);
    }
    #liveSourcesDropdownWrap.is-open .dropdown-chevron {
      color: var(--cyan);
    }
    #vodCatalogsDropdownWrap.is-open .dropdown-chevron,
    #catalogsDropdownWrap.is-open .dropdown-chevron {
      color: var(--violet);
    }
    #liveCatalogsDropdownWrap.is-open .dropdown-chevron {
      color: var(--rose);
    }

    /* Smooth accordion animation using grid-template-rows */
    .dropdown-panel {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
      opacity: 0;
      border-top: 1px solid transparent;
    }
    .dropdown-wrap.is-open .dropdown-panel {
      grid-template-rows: 1fr;
      opacity: 1;
      border-top-color: var(--line);
    }
    .dropdown-panel-inner {
      overflow: hidden;
      min-height: 0;
    }
    .dropdown-panel .clean-list {
      border: none;
      border-radius: 0;
      background: transparent;
    }`;

// Normalize newlines for replace
const norm = s => s.replace(/\r\n/g, '\n');
if (norm(html).includes(norm(oldCssTarget))) {
  html = norm(html).replace(norm(oldCssTarget), newCssReplacement);
  console.log('CSS updated successfully');
} else {
  console.log('CSS target not matched directly, attempting regex replacement');
  html = html.replace(/\/\* CH 02 & CH 03: Modern Interactive Dropdown Menus \*\/[\s\S]*?\/\* CH 02 & CH 03: Compact Vertical List/, `${newCssReplacement}\n\n    /* CH 02 & CH 03: Compact Vertical List`);
}

// 3. Replace CH 02 (Now contains 2 dropdowns: VOD Scrapers + Live IPTV Sources)
// 4. Replace CH 03 (Now contains 2 dropdowns: VOD Catalogs + Live TV 6 Categories)
// 5. Replace CH 04 preset line (Now contains live TV quick buttons: M4 Sport, Nat Geo, Film+, Sopron TV + movies)

const newCh02AndCh03 = `    <!-- CH 02: SOURCES & LIVE IPTV (2 INTERACTIVE DROPDOWNS) -->
    <section class="sec" id="ch02">
      <div class="sec-head">
        <div class="sec-title">
          <span class="ch-badge c-green">CH 02</span>
          <h2>Magyar Források &amp; Élő TV (IPTV)</h2>
        </div>
      </div>

      <!-- Dropdown 1: Film & Sorozat VOD Források (13 Scraper) -->
      <div class="dropdown-wrap" id="sourcesDropdownWrap">
        <div class="dropdown-trigger" id="sourcesDropdownTrigger" role="button" tabindex="0" aria-expanded="false" aria-controls="sourcesDropdownPanel" onclick="toggleDropdown('sources')">
          <div class="dropdown-trigger-left">
            <span class="dropdown-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            </span>
            <span class="dropdown-title">Film &amp; Sorozat Források</span>
            <span class="dropdown-badge badge-sources" id="sourcesDropdownCount">13 / 13 aktív</span>
            <span class="dropdown-preview" id="sourcesDropdownPreview">Minden VOD forrás aktív (13/13)</span>
          </div>
          <div class="dropdown-trigger-right">
            <div class="dropdown-actions">
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); toggleAllVodSources(true)">Mind be</button>
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); toggleAllVodSources(false)">Mind ki</button>
            </div>
            <span class="dropdown-chevron" aria-hidden="true">▼</span>
          </div>
        </div>

        <div class="dropdown-panel" id="sourcesDropdownPanel">
          <div class="dropdown-panel-inner">
            <div class="clean-list" id="sourcesGrid">
              <label class="list-row" data-tier="verified">
                <input type="checkbox" class="clean-cb" value="mediaklikk" checked onchange="onConfigChange()" />
                <span class="row-idx">01</span>
                <span class="row-name">MédiaKlikk (MTVA)</span>
                <span class="row-desc">43 klasszikus mese/sorozat archívum + 7 élő TV (1080p HLS)</span>
                <span class="row-meta"><span class="tag tag-ok">Hivatalos MTVA</span></span>
              </label>
              <label class="list-row" data-tier="verified">
                <input type="checkbox" class="clean-cb" value="jobbmintatv" checked onchange="onConfigChange()" />
                <span class="row-idx">02</span>
                <span class="row-name">JobbMintATv</span>
                <span class="row-desc">Mozifilmek és sorozat epizódok (Videa MP4 &amp; OK.ru 1080p HLS)</span>
                <span class="row-meta"><span class="tag tag-ok">IMDb ellenőrzött</span></span>
              </label>
              <label class="list-row" data-tier="verified">
                <input type="checkbox" class="clean-cb" value="filmezek" checked onchange="onConfigChange()" />
                <span class="row-idx">03</span>
                <span class="row-name">Filmezek.com</span>
                <span class="row-desc">Több tárhelyes magyar film- és sorozatgyűjtemény (Videa &amp; OK.ru 1080p)</span>
                <span class="row-meta"><span class="tag tag-ok">IMDb ellenőrzött</span></span>
              </label>
              <label class="list-row" data-tier="community">
                <input type="checkbox" class="clean-cb" value="videa" checked onchange="onConfigChange()" />
                <span class="row-idx">04</span>
                <span class="row-name">Videa.hu</span>
                <span class="row-desc">RC4 XML dekódoló — közvetlen 1080p/720p MP4 streamek</span>
                <span class="row-meta"><span class="tag tag-warn">Közösségi MP4</span></span>
              </label>
              <label class="list-row" data-tier="community">
                <input type="checkbox" class="clean-cb" value="indavideo" checked onchange="onConfigChange()" />
                <span class="row-idx">05</span>
                <span class="row-name">Indavideo.hu</span>
                <span class="row-desc">Dinamikus amfphp token feloldó — 720p/360p MP4</span>
                <span class="row-meta"><span class="tag tag-warn">Közösségi MP4</span></span>
              </label>
              <label class="list-row" data-tier="community">
                <input type="checkbox" class="clean-cb" value="filmvilag2" checked onchange="onConfigChange()" />
                <span class="row-idx">06</span>
                <span class="row-name">Filmvilág2</span>
                <span class="row-desc">Magyar szinkronos teljes filmek (Videa, Indavideo, OK.ru)</span>
                <span class="row-meta"><span class="tag tag-warn">Cím alapú</span></span>
              </label>
              <label class="list-row" data-tier="verified">
                <input type="checkbox" class="clean-cb" value="mesefilm" checked onchange="onConfigChange()" />
                <span class="row-idx">07</span>
                <span class="row-name">MeseKincstár</span>
                <span class="row-desc">Családi animációk, bábfilmek és mesék (évszám/hossz szűrővel)</span>
                <span class="row-meta"><span class="tag tag-ok">Ellenőrzött</span></span>
              </label>
              <label class="list-row" data-tier="community">
                <input type="checkbox" class="clean-cb" value="videakid" checked onchange="onConfigChange()" />
                <span class="row-idx">08</span>
                <span class="row-name">Videakid.hu</span>
                <span class="row-desc">Gyerekfilmek, rajzfilmek és mesék közvetlen MP4-ben</span>
                <span class="row-meta"><span class="tag tag-warn">Közösségi</span></span>
              </label>
              <label class="list-row" data-tier="selfhost">
                <input type="checkbox" class="clean-cb" value="netmozi" checked onchange="onConfigChange()" />
                <span class="row-idx">09</span>
                <span class="row-name">NetMozi</span>
                <span class="row-desc">Szinkronos filmek és sorozatok (VOE 1080p Self-Hoston)</span>
                <span class="row-meta"><span class="tag tag-ok">Évszám szűrt</span><span class="tag tag-sh">VOE Self-Host</span></span>
              </label>
              <label class="list-row" data-tier="selfhost">
                <input type="checkbox" class="clean-cb" value="onlinefilmek" checked onchange="onConfigChange()" />
                <span class="row-idx">10</span>
                <span class="row-name">Online-Filmek.me</span>
                <span class="row-desc">Közvetlen Videa, OK.ru és Self-Host VOE 1080p folyamok</span>
                <span class="row-meta"><span class="tag tag-warn">Közösségi</span><span class="tag tag-sh">VOE Self-Host</span></span>
              </label>
              <label class="list-row" data-tier="selfhost">
                <input type="checkbox" class="clean-cb" value="sorozatoknet" checked onchange="onConfigChange()" />
                <span class="row-idx">11</span>
                <span class="row-name">Sorozatok.net</span>
                <span class="row-desc">Hunter JS dekódoló sorozat epizódokhoz</span>
                <span class="row-meta"><span class="tag tag-sh">VOE Self-Host</span></span>
              </label>
              <label class="list-row" data-tier="selfhost">
                <input type="checkbox" class="clean-cb" value="hdmozi" checked onchange="onConfigChange()" />
                <span class="row-idx">12</span>
                <span class="row-name">HDMozi</span>
                <span class="row-desc">1080p FHD AES-128 HLS mozifilmek és sorozatok</span>
                <span class="row-meta"><span class="tag tag-ok">IMDb ellenőrzött</span><span class="tag tag-sh">Csak Self-Host</span></span>
              </label>
              <label class="list-row" data-tier="selfhost">
                <input type="checkbox" class="clean-cb" value="dmdamedia" checked onchange="onConfigChange()" />
                <span class="row-idx">13</span>
                <span class="row-name">DMDamedia</span>
                <span class="row-desc">Magyar szinkronos sorozatok és filmek</span>
                <span class="row-meta"><span class="tag tag-warn">Cím alapú</span><span class="tag tag-sh">Csak Self-Host</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Dropdown 2: Élő TV (IPTV) Források (3 Csomag) -->
      <div class="dropdown-wrap" id="liveSourcesDropdownWrap">
        <div class="dropdown-trigger" id="liveSourcesDropdownTrigger" role="button" tabindex="0" aria-expanded="false" aria-controls="liveSourcesDropdownPanel" onclick="toggleDropdown('liveSources')">
          <div class="dropdown-trigger-left">
            <span class="dropdown-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
            </span>
            <span class="dropdown-title">Élő TV (IPTV) Források</span>
            <span class="dropdown-badge badge-live-sources" id="liveSourcesDropdownCount">3 / 3 csomag aktív</span>
            <span class="dropdown-preview" id="liveSourcesDropdownPreview">Minden IPTV forrás aktív (MTVA + OnlineStream)</span>
          </div>
          <div class="dropdown-trigger-right">
            <div class="dropdown-actions">
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); toggleAllLiveSources('all')">Mind be</button>
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); toggleAllLiveSources('no_local')">Helyi nélkül</button>
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); toggleAllLiveSources('none')">Mind ki</button>
            </div>
            <span class="dropdown-chevron" aria-hidden="true">▼</span>
          </div>
        </div>

        <div class="dropdown-panel" id="liveSourcesDropdownPanel">
          <div class="dropdown-panel-inner">
            <div class="clean-list" id="liveSourcesGrid">
              <label class="list-row" data-tier="verified">
                <input type="checkbox" class="clean-cb" value="mediaklikk" checked onchange="onConfigChange()" />
                <span class="row-idx">01</span>
                <span class="row-name">MédiaKlikk Hivatalos MTVA (1080p HLS)</span>
                <span class="row-desc">M1, M2, Duna, M4 Sport, M5, Duna World hivatalos, akadozásmentes élő streamje</span>
                <span class="row-meta"><span class="tag tag-ok">Hivatalos MTVA</span><span class="tag tag-live">● Élő 1080p</span></span>
              </label>
              <label class="list-row" data-tier="verified">
                <input type="checkbox" class="clean-cb" value="onlinestream" checked onchange="onConfigChange()" />
                <span class="row-idx">02</span>
                <span class="row-name">OnlineStream IPTV — Országos, Film, Doksi, Sport &amp; Gyerek</span>
                <span class="row-desc">82 válogatott prémium adó (RTL, TV2, Film+, Mozi+, AMC, Nat Geo, History, Spíler, Sport 1-2...)</span>
                <span class="row-meta"><span class="tag tag-live">● 82 Prémium Adó</span><span class="tag tag-ok">Közvetlen HLS</span></span>
              </label>
              <label class="list-row" data-tier="community">
                <input type="checkbox" class="clean-cb" value="onlinestream_local" checked onchange="onConfigChange()" />
                <span class="row-idx">03</span>
                <span class="row-name">OnlineStream IPTV — Helyi &amp; Regionális Városi TV-k</span>
                <span class="row-desc">64 helyi körzeti adás (Debrecen TV, Sopron TV, Fehérvár TV, Tisza TV, Szeged TV, Nyíregyházi TV...)</span>
                <span class="row-meta"><span class="tag tag-warn">64 Helyi Városi TV</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CH 03: CATALOGS (2 INTERACTIVE DROPDOWNS) -->
    <section class="sec" id="ch03">
      <div class="sec-head">
        <div class="sec-title">
          <span class="ch-badge c-violet">CH 03</span>
          <h2>Katalógus Polcok (11 VOD &amp; 6 Élő TV)</h2>
        </div>
      </div>

      <!-- Dropdown 3: Film & Sorozat Katalógusok (11 Polc) -->
      <div class="dropdown-wrap" id="vodCatalogsDropdownWrap">
        <div class="dropdown-trigger" id="vodCatalogsDropdownTrigger" role="button" tabindex="0" aria-expanded="false" aria-controls="vodCatalogsDropdownPanel" onclick="toggleDropdown('vodCatalogs')">
          <div class="dropdown-trigger-left">
            <span class="dropdown-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </span>
            <span class="dropdown-title">Film &amp; Sorozat Katalógusok</span>
            <span class="dropdown-badge badge-vod-catalogs" id="vodCatalogsDropdownCount">11 / 11 aktív</span>
            <span class="dropdown-preview" id="vodCatalogsDropdownPreview">Mind a 11 VOD katalógus aktív</span>
          </div>
          <div class="dropdown-trigger-right">
            <div class="dropdown-actions">
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); setVodCatalogPreset('all')">Mind be</button>
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); setVodCatalogPreset('core')">Csak alap (6)</button>
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); setVodCatalogPreset('none')">Mind ki</button>
            </div>
            <span class="dropdown-chevron" aria-hidden="true">▼</span>
          </div>
        </div>

        <div class="dropdown-panel" id="vodCatalogsDropdownPanel">
          <div class="dropdown-panel-inner">
            <div class="clean-list" id="vodCatalogsGrid">
              <label class="list-row" data-cat="classics">
                <input type="checkbox" class="clean-cb" value="hu-mediaklikk-classics" checked onchange="onConfigChange()" />
                <span class="row-idx">01</span>
                <span class="row-name">MédiaKlikk Klasszikusok</span>
                <span class="row-desc">30 MTVA archív mese és sorozat (Magyar népmesék, Süsü, Ho-ho-horgász)</span>
                <span class="row-meta"><span class="tag tag-gold">MTVA Klasszikus</span></span>
              </label>
              <label class="list-row" data-cat="top">
                <input type="checkbox" class="clean-cb" value="hu-trending-movies" checked onchange="onConfigChange()" />
                <span class="row-idx">02</span>
                <span class="row-name">Heti Trendi Filmek</span>
                <span class="row-desc">Mafab.hu &amp; TMDB magyar heti filmes toplista</span>
                <span class="row-meta"><span class="tag tag-ok">Heti toplista</span></span>
              </label>
              <label class="list-row" data-cat="top">
                <input type="checkbox" class="clean-cb" value="hu-trending-series" checked onchange="onConfigChange()" />
                <span class="row-idx">03</span>
                <span class="row-name">Heti Trendi Sorozatok</span>
                <span class="row-desc">Mafab.hu &amp; TMDB magyar heti sorozat toplista</span>
                <span class="row-meta"><span class="tag tag-ok">Heti toplista</span></span>
              </label>
              <label class="list-row" data-cat="top">
                <input type="checkbox" class="clean-cb" value="hu-cinema-movies" checked onchange="onConfigChange()" />
                <span class="row-idx">04</span>
                <span class="row-name">Friss Mozifilmek</span>
                <span class="row-desc">Már elérhető szinkronos mozis sikerfilmek</span>
                <span class="row-meta"><span class="tag tag-ok">Mozisikerek</span></span>
              </label>
              <label class="list-row" data-cat="classics">
                <input type="checkbox" class="clean-cb" value="hu-hungarian-movies" checked onchange="onConfigChange()" />
                <span class="row-idx">05</span>
                <span class="row-name">Magyar Filmek</span>
                <span class="row-desc">Legjobb hazai gyártású magyar filmek és klasszikusok</span>
                <span class="row-meta"><span class="tag tag-gold">Magyar Mozi</span></span>
              </label>
              <label class="list-row" data-cat="classics">
                <input type="checkbox" class="clean-cb" value="hu-hungarian-series" checked onchange="onConfigChange()" />
                <span class="row-idx">06</span>
                <span class="row-name">Magyar Sorozatok</span>
                <span class="row-desc">Hazai sorozatok és MTVA klasszikusok</span>
                <span class="row-meta"><span class="tag tag-gold">Magyar Sorozat</span></span>
              </label>
              <label class="list-row" data-cat="stream">
                <input type="checkbox" class="clean-cb" value="hu-stream-netflix" checked onchange="onConfigChange()" />
                <span class="row-idx">07</span>
                <span class="row-name">Netflix HU</span>
                <span class="row-desc">Netflix magyarországi szinkronos kínálat</span>
                <span class="row-meta"><span class="tag tag-stream s-netflix">Netflix</span></span>
              </label>
              <label class="list-row" data-cat="stream">
                <input type="checkbox" class="clean-cb" value="hu-stream-max" checked onchange="onConfigChange()" />
                <span class="row-idx">08</span>
                <span class="row-name">Max / HBO</span>
                <span class="row-desc">Max Magyarország toplista</span>
                <span class="row-meta"><span class="tag tag-stream s-max">Max</span></span>
              </label>
              <label class="list-row" data-cat="stream">
                <input type="checkbox" class="clean-cb" value="hu-stream-disney" checked onchange="onConfigChange()" />
                <span class="row-idx">09</span>
                <span class="row-name">Disney+ HU</span>
                <span class="row-desc">Disney, Marvel, Star Wars magyar szinkronnal</span>
                <span class="row-meta"><span class="tag tag-stream s-disney">Disney+</span></span>
              </label>
              <label class="list-row" data-cat="stream">
                <input type="checkbox" class="clean-cb" value="hu-stream-skyshowtime" checked onchange="onConfigChange()" />
                <span class="row-idx">10</span>
                <span class="row-name">SkyShowtime</span>
                <span class="row-desc">Universal &amp; Paramount sikerfilmek magyarul</span>
                <span class="row-meta"><span class="tag tag-stream s-skyshowtime">SkyShowtime</span></span>
              </label>
              <label class="list-row" data-cat="stream">
                <input type="checkbox" class="clean-cb" value="hu-stream-prime" checked onchange="onConfigChange()" />
                <span class="row-idx">11</span>
                <span class="row-name">Prime Video</span>
                <span class="row-desc">Amazon Prime Video magyarországi kínálat</span>
                <span class="row-meta"><span class="tag tag-stream s-prime">Prime</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Dropdown 4: Élő TV Katalógusok (6 Kategória - 146 Adó) -->
      <div class="dropdown-wrap" id="liveCatalogsDropdownWrap">
        <div class="dropdown-trigger" id="liveCatalogsDropdownTrigger" role="button" tabindex="0" aria-expanded="false" aria-controls="liveCatalogsDropdownPanel" onclick="toggleDropdown('liveCatalogs')">
          <div class="dropdown-trigger-left">
            <span class="dropdown-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path></svg>
            </span>
            <span class="dropdown-title">Élő TV Katalógusok (6 Kategória)</span>
            <span class="dropdown-badge badge-live-catalogs" id="liveCatalogsDropdownCount">6 / 6 aktív</span>
            <span class="dropdown-preview" id="liveCatalogsDropdownPreview">Mind a 6 kategória aktív (146 élő adó)</span>
          </div>
          <div class="dropdown-trigger-right">
            <div class="dropdown-actions">
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); setLiveCatalogPreset('all')">Mind be (6)</button>
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); setLiveCatalogPreset('no_local')">Helyi nélkül (5)</button>
              <button type="button" class="btn-chip chip-mini" onclick="event.stopPropagation(); setLiveCatalogPreset('none')">Mind ki</button>
            </div>
            <span class="dropdown-chevron" aria-hidden="true">▼</span>
          </div>
        </div>

        <div class="dropdown-panel" id="liveCatalogsDropdownPanel">
          <div class="dropdown-panel-inner">
            <div class="clean-list" id="liveCatalogsGrid">
              <label class="list-row" data-cat="livetv">
                <input type="checkbox" class="clean-cb" value="hu-live-orszagos" checked onchange="onConfigChange()" />
                <span class="row-idx">01</span>
                <span class="row-name">🔴 Élő TV: Országos &amp; Kereskedelmi</span>
                <span class="row-desc">28 adó (RTL, TV2, M1, Duna, Super TV2, RTL Kettő/Három, ATV, Hír TV, Viasat 3...)</span>
                <span class="row-meta"><span class="tag tag-live">● 28 Adó</span><span class="tag tag-ok">1080p HLS</span></span>
              </label>
              <label class="list-row" data-cat="livetv">
                <input type="checkbox" class="clean-cb" value="hu-live-film" checked onchange="onConfigChange()" />
                <span class="row-idx">02</span>
                <span class="row-name">🎬 Élő TV: Film &amp; Sorozat</span>
                <span class="row-desc">21 adó (Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1-2-3, Film4, TV2 Comedy...)</span>
                <span class="row-meta"><span class="tag tag-live">● 21 Adó</span><span class="tag tag-ok">Filmes</span></span>
              </label>
              <label class="list-row" data-cat="livetv">
                <input type="checkbox" class="clean-cb" value="hu-live-doksi" checked onchange="onConfigChange()" />
                <span class="row-idx">03</span>
                <span class="row-name">🌍 Élő TV: Ismeretterjesztő &amp; Doksi</span>
                <span class="row-desc">6 adó (National Geographic, History, Spektrum, Nat Geo Wild, Spektrum Home, Ozone...)</span>
                <span class="row-meta"><span class="tag tag-live">● 6 Adó</span><span class="tag tag-gold">Dokumentum</span></span>
              </label>
              <label class="list-row" data-cat="livetv">
                <input type="checkbox" class="clean-cb" value="hu-live-sport" checked onchange="onConfigChange()" />
                <span class="row-idx">04</span>
                <span class="row-name">⚽ Élő TV: Sport, Zene &amp; Életmód</span>
                <span class="row-desc">19 adó (M4 Sport, Spíler 1-2, Sport 1-2, Arena4, Match 4, TV Paprika, Muzsika TV...)</span>
                <span class="row-meta"><span class="tag tag-live">● 19 Adó</span><span class="tag tag-ok">Sport &amp; Zene</span></span>
              </label>
              <label class="list-row" data-cat="livetv">
                <input type="checkbox" class="clean-cb" value="hu-live-gyerek" checked onchange="onConfigChange()" />
                <span class="row-idx">05</span>
                <span class="row-name">🧸 Élő TV: Rajzfilm &amp; Gyerek</span>
                <span class="row-desc">8 adó (Minimax, Nickelodeon, Disney Channel, Nick Jr, Nicktoons, TV2 Kids, JimJam...)</span>
                <span class="row-meta"><span class="tag tag-live">● 8 Adó</span><span class="tag tag-ok">Gyerek</span></span>
              </label>
              <label class="list-row" data-cat="livetv">
                <input type="checkbox" class="clean-cb" value="hu-live-helyi" checked onchange="onConfigChange()" />
                <span class="row-idx">06</span>
                <span class="row-name">📍 Élő TV: Helyi &amp; Városi TV-k</span>
                <span class="row-desc">64 adó (Debrecen TV, Sopron TV, Fehérvár TV, Tisza TV, Szeged TV, Nyíregyházi TV...)</span>
                <span class="row-meta"><span class="tag tag-warn">64 Helyi Városi TV</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>`;

// Replace old CH 02 and CH 03 block
const ch02TargetRegex = /<!-- CH 02: 13 SOURCES \(DROPDOWN MENU\) -->[\s\S]*?<!-- CH 04: STREAM TESTER -->/;
if (ch02TargetRegex.test(html)) {
  html = html.replace(ch02TargetRegex, `${newCh02AndCh03}\n\n    <!-- CH 04: STREAM TESTER -->`);
  console.log('CH 02 and CH 03 replaced successfully');
} else {
  console.log('CH 02 target regex not matched');
}

// 6. Update CH 04 Presets line
const oldPresetsRegex = /<div class="preset-line">[\s\S]*?<\/div>\s*<div id="seriesSelectorBar"/;
const newPresetsLine = `<div class="preset-line">
          <span>Gyors TV:</span>
          <button class="preset-link" onclick="runPreset('movie', 'mediaklikk-live-m4')">M4 Sport (1080p)</button>
          <button class="preset-link" onclick="runPreset('movie', 'onlinestream-live-5936')">Nat Geo</button>
          <button class="preset-link" onclick="runPreset('movie', 'onlinestream-live-6150')">Film+</button>
          <button class="preset-link" onclick="runPreset('movie', 'onlinestream-live-5982')">Sopron TV</button>
          <span style="opacity:0.4; margin: 0 4px">|</span>
          <span>Filmek &amp; Sorozatok:</span>
          <button class="preset-link" onclick="runPreset('movie', 'Macskafogó')">Macskafogó</button>
          <button class="preset-link" onclick="runPreset('movie', 'Egri csillagok')">Egri csillagok</button>
          <button class="preset-link" onclick="runPreset('series', 'A nagy ho-ho-horgász')">A nagy ho-ho-horgász</button>
          <button class="preset-link" onclick="runPreset('series', 'Magyar népmesék')">Magyar népmesék</button>
          <button class="preset-link" onclick="runPreset('series', 'Trónok harca')">Trónok harca</button>
        </div>

        <div id="seriesSelectorBar"`;

if (oldPresetsRegex.test(html)) {
  html = html.replace(oldPresetsRegex, newPresetsLine);
  console.log('CH 04 Presets line updated successfully');
} else {
  console.log('CH 04 Presets regex not matched');
}

// 7. Update JavaScript block
const oldScriptStart = `<script>
    const origin = window.location.origin;
    const ALL_SOURCE_IDS = [
      'mediaklikk','videa','indavideo','hdmozi','filmvilag2','jobbmintatv',
      'netmozi','filmezek','onlinefilmek','dmdamedia','mesefilm','videakid','sorozatoknet'
    ];`;

const newScriptBlock = `<script>
    const origin = window.location.origin;

    const ALL_VOD_SOURCE_IDS = [
      'mediaklikk','videa','indavideo','hdmozi','filmvilag2','jobbmintatv',
      'netmozi','filmezek','onlinefilmek','dmdamedia','mesefilm','videakid','sorozatoknet'
    ];
    const ALL_LIVE_SOURCE_IDS = ['mediaklikk', 'onlinestream', 'onlinestream_local'];
    const ALL_SOURCE_IDS = [...ALL_VOD_SOURCE_IDS, 'onlinestream', 'onlinestream_local'];
    const ALL_RES_IDS = ['1080p', '720p', '480p', '360p'];

    const ALL_VOD_CATALOG_IDS = [
      'hu-mediaklikk-classics','hu-trending-movies',
      'hu-trending-series','hu-cinema-movies','hu-hungarian-movies','hu-hungarian-series',
      'hu-stream-netflix','hu-stream-max','hu-stream-disney','hu-stream-skyshowtime','hu-stream-prime'
    ];
    const CORE_VOD_CATALOG_IDS = [
      'hu-mediaklikk-classics','hu-trending-movies',
      'hu-trending-series','hu-cinema-movies','hu-hungarian-movies','hu-hungarian-series'
    ];

    const ALL_LIVE_CATALOG_IDS = [
      'hu-live-orszagos','hu-live-film','hu-live-doksi','hu-live-sport','hu-live-gyerek','hu-live-helyi'
    ];
    const CORE_LIVE_CATALOG_IDS = [
      'hu-live-orszagos','hu-live-film','hu-live-doksi','hu-live-sport','hu-live-gyerek'
    ];

    const DEFAULT_CATALOG_IDS = [...ALL_LIVE_CATALOG_IDS, ...ALL_VOD_CATALOG_IDS];

    let lastFetchedStreams = [];
    let activeResTab = 'all';

    function showToast(html, duration = 3000) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.innerHTML = html;
      toast.classList.add('show');
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(() => {
        toast.classList.remove('show');
      }, duration);
    }

    function getSelectedVodSources() {
      return [...document.querySelectorAll('#sourcesGrid input[type="checkbox"]:checked')].map(cb => cb.value);
    }

    function getSelectedLiveSources() {
      return [...document.querySelectorAll('#liveSourcesGrid input[type="checkbox"]:checked')].map(cb => cb.value);
    }

    function getSelectedSources() {
      const vod = getSelectedVodSources();
      const live = getSelectedLiveSources();
      return [...new Set([...vod, ...live])];
    }

    function getSelectedResolutions() {
      return [...document.querySelectorAll('#resolutionsGrid input[type="checkbox"]:checked')].map(cb => cb.value);
    }

    function getSelectedVodCatalogs() {
      return [...document.querySelectorAll('#vodCatalogsGrid input[type="checkbox"]:checked')].map(cb => cb.value);
    }

    function getSelectedLiveCatalogs() {
      return [...document.querySelectorAll('#liveCatalogsGrid input[type="checkbox"]:checked')].map(cb => cb.value);
    }

    function getSelectedCatalogs() {
      return [...getSelectedLiveCatalogs(), ...getSelectedVodCatalogs()];
    }

    function onConfigChange() {
      updateManifestUrl();
      if (lastFetchedStreams.length > 0) {
        renderStreams();
      }
    }

    function updateManifestUrl() {
      const selectedVodSources = getSelectedVodSources();
      const selectedLiveSources = getSelectedLiveSources();
      const selectedSources = getSelectedSources();
      const selectedRes = getSelectedResolutions();
      const selectedVodCats = getSelectedVodCatalogs();
      const selectedLiveCats = getSelectedLiveCatalogs();
      const selectedCats = getSelectedCatalogs();

      // Top summary badge
      const summaryEl = document.getElementById('activeSummaryBadge');
      if (summaryEl) {
        summaryEl.textContent = \`\${selectedSources.length} forrás · \${selectedCats.length} katalógus · \${selectedRes.length} felbontás\`;
      }

      // 1. VOD Sources Dropdown badge & preview
      const sourcesCountEl = document.getElementById('sourcesDropdownCount');
      const sourcesPreviewEl = document.getElementById('sourcesDropdownPreview');
      if (sourcesCountEl) {
        sourcesCountEl.textContent = \`\${selectedVodSources.length} / \${ALL_VOD_SOURCE_IDS.length} aktív\`;
      }
      if (sourcesPreviewEl) {
        if (selectedVodSources.length === ALL_VOD_SOURCE_IDS.length) {
          sourcesPreviewEl.textContent = 'Minden VOD forrás aktív (13/13)';
        } else if (selectedVodSources.length === 0) {
          sourcesPreviewEl.textContent = 'Nincs VOD forrás kiválasztva';
        } else {
          const nameMap = {
            'mediaklikk': 'MédiaKlikk', 'jobbmintatv': 'JobbMintATv', 'filmezek': 'Filmezek',
            'videa': 'Videa', 'indavideo': 'Indavideo', 'filmvilag2': 'Filmvilág2',
            'mesefilm': 'MeseKincstár', 'videakid': 'Videakid', 'netmozi': 'NetMozi',
            'onlinefilmek': 'OnlineFilmek', 'sorozatoknet': 'Sorozatok.net', 'hdmozi': 'HDMozi',
            'dmdamedia': 'DMDamedia'
          };
          const names = selectedVodSources.map(s => nameMap[s] || s);
          sourcesPreviewEl.textContent = names.length <= 3 ? names.join(', ') : \`\${names.slice(0, 3).join(', ')} +\${names.length - 3}\`;
        }
      }

      // 2. Live Sources Dropdown badge & preview
      const liveSourcesCountEl = document.getElementById('liveSourcesDropdownCount');
      const liveSourcesPreviewEl = document.getElementById('liveSourcesDropdownPreview');
      if (liveSourcesCountEl) {
        liveSourcesCountEl.textContent = \`\${selectedLiveSources.length} / \${ALL_LIVE_SOURCE_IDS.length} csomag aktív\`;
      }
      if (liveSourcesPreviewEl) {
        if (selectedLiveSources.length === ALL_LIVE_SOURCE_IDS.length) {
          liveSourcesPreviewEl.textContent = 'Minden IPTV forrás aktív (MTVA + OnlineStream)';
        } else if (selectedLiveSources.length === 0) {
          liveSourcesPreviewEl.textContent = 'Nincs élő TV forrás kiválasztva';
        } else if (!selectedLiveSources.includes('onlinestream_local')) {
          liveSourcesPreviewEl.textContent = 'MTVA + OnlineStream Országos (helyi nélkül)';
        } else {
          liveSourcesPreviewEl.textContent = \`\${selectedLiveSources.length} IPTV forrás aktív\`;
        }
      }

      // 3. VOD Catalogs Dropdown badge & preview
      const vodCatsCountEl = document.getElementById('vodCatalogsDropdownCount');
      const vodCatsPreviewEl = document.getElementById('vodCatalogsDropdownPreview');
      if (vodCatsCountEl) {
        vodCatsCountEl.textContent = \`\${selectedVodCats.length} / \${ALL_VOD_CATALOG_IDS.length} aktív\`;
      }
      if (vodCatsPreviewEl) {
        if (selectedVodCats.length === ALL_VOD_CATALOG_IDS.length) {
          vodCatsPreviewEl.textContent = 'Mind a 11 VOD katalógus aktív';
        } else if (selectedVodCats.length === 0) {
          vodCatsPreviewEl.textContent = 'Nincs VOD katalógus kiválasztva';
        } else {
          const catNameMap = {
            'hu-mediaklikk-classics': 'MédiaKlikk', 'hu-trending-movies': 'Heti Filmek',
            'hu-trending-series': 'Heti Sorozatok', 'hu-cinema-movies': 'Friss Mozifilmek',
            'hu-hungarian-movies': 'Magyar Filmek', 'hu-hungarian-series': 'Magyar Sorozatok',
            'hu-stream-netflix': 'Netflix', 'hu-stream-max': 'Max', 'hu-stream-disney': 'Disney+',
            'hu-stream-skyshowtime': 'SkyShowtime', 'hu-stream-prime': 'Prime'
          };
          const names = selectedVodCats.map(c => catNameMap[c] || c);
          vodCatsPreviewEl.textContent = names.length <= 3 ? names.join(', ') : \`\${names.slice(0, 3).join(', ')} +\${names.length - 3}\`;
        }
      }

      // 4. Live Catalogs Dropdown badge & preview
      const liveCatsCountEl = document.getElementById('liveCatalogsDropdownCount');
      const liveCatsPreviewEl = document.getElementById('liveCatalogsDropdownPreview');
      if (liveCatsCountEl) {
        liveCatsCountEl.textContent = \`\${selectedLiveCats.length} / \${ALL_LIVE_CATALOG_IDS.length} aktív\`;
      }
      if (liveCatsPreviewEl) {
        if (selectedLiveCats.length === ALL_LIVE_CATALOG_IDS.length) {
          liveCatsPreviewEl.textContent = 'Mind a 6 kategória aktív (146 élő adó)';
        } else if (selectedLiveCats.length === 0) {
          liveCatsPreviewEl.textContent = 'Nincs élő TV kategória kiválasztva';
        } else if (!selectedLiveCats.includes('hu-live-helyi') && selectedLiveCats.length === 5) {
          liveCatsPreviewEl.textContent = 'Országos, Film, Doksi, Sport, Gyerek (helyi nélkül)';
        } else {
          const liveNameMap = {
            'hu-live-orszagos': 'Országos', 'hu-live-film': 'Film & Sorozat',
            'hu-live-doksi': 'Doksi', 'hu-live-sport': 'Sport & Zene',
            'hu-live-gyerek': 'Gyerek', 'hu-live-helyi': 'Helyi TV-k'
          };
          const names = selectedLiveCats.map(c => liveNameMap[c] || c);
          liveCatsPreviewEl.textContent = names.join(', ');
        }
      }

      // Manifest URL assembly
      let manifestUrl = \`\${origin}/manifest.json\`;
      const cfgObj = {};
      if (selectedSources.length > 0 && selectedSources.length < ALL_SOURCE_IDS.length) {
        cfgObj.sources = selectedSources;
      }
      if (selectedRes.length > 0 && selectedRes.length < ALL_RES_IDS.length) {
        cfgObj.qualities = selectedRes;
      }
      const isDefaultCats = selectedCats.length === DEFAULT_CATALOG_IDS.length && DEFAULT_CATALOG_IDS.every(c => selectedCats.includes(c));
      if (!isDefaultCats && selectedCats.length > 0) {
        cfgObj.catalogs = selectedCats;
      }

      if (Object.keys(cfgObj).length > 0) {
        const b64 = btoa(JSON.stringify(cfgObj)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
        manifestUrl = \`\${origin}/\${b64}/manifest.json\`;
      }

      const urlEl = document.getElementById('manifestUrl');
      const prevUrl = urlEl.textContent;
      urlEl.textContent = manifestUrl;
      if (prevUrl && prevUrl !== 'Betöltés...' && prevUrl !== manifestUrl) {
        urlEl.classList.remove('url-flash');
        void urlEl.offsetWidth;
        urlEl.classList.add('url-flash');
      }
      document.getElementById('stremioInstallBtn').href = manifestUrl.replace(/^https?:\\/\\//, 'stremio://');
    }

    function setResolutions(resList) {
      const set = new Set(resList);
      document.querySelectorAll('#resolutionsGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = set.has(cb.value);
      });
      onConfigChange();
    }

    function toggleAllVodSources(state) {
      document.querySelectorAll('#sourcesGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = state;
      });
      onConfigChange();
    }

    function toggleAllLiveSources(mode) {
      document.querySelectorAll('#liveSourcesGrid input[type="checkbox"]').forEach(cb => {
        if (mode === 'all') cb.checked = true;
        else if (mode === 'none') cb.checked = false;
        else if (mode === 'no_local') cb.checked = cb.value !== 'onlinestream_local';
      });
      onConfigChange();
    }

    function setVodCatalogPreset(mode) {
      const set = new Set(mode === 'core' ? CORE_VOD_CATALOG_IDS : ALL_VOD_CATALOG_IDS);
      document.querySelectorAll('#vodCatalogsGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = mode === 'all' ? true : (mode === 'none' ? false : set.has(cb.value));
      });
      onConfigChange();
    }

    function setLiveCatalogPreset(mode) {
      const set = new Set(mode === 'no_local' ? CORE_LIVE_CATALOG_IDS : ALL_LIVE_CATALOG_IDS);
      document.querySelectorAll('#liveCatalogsGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = mode === 'all' ? true : (mode === 'none' ? false : set.has(cb.value));
      });
      onConfigChange();
    }

    function toggleDropdown(type) {
      const map = {
        'sources': { wrap: 'sourcesDropdownWrap', trigger: 'sourcesDropdownTrigger' },
        'liveSources': { wrap: 'liveSourcesDropdownWrap', trigger: 'liveSourcesDropdownTrigger' },
        'vodCatalogs': { wrap: 'vodCatalogsDropdownWrap', trigger: 'vodCatalogsDropdownTrigger' },
        'liveCatalogs': { wrap: 'liveCatalogsDropdownWrap', trigger: 'liveCatalogsDropdownTrigger' }
      };
      const item = map[type];
      if (!item) return;
      const wrap = document.getElementById(item.wrap);
      const trigger = document.getElementById(item.trigger);
      if (!wrap) return;
      const isOpen = wrap.classList.toggle('is-open');
      if (trigger) {
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    }

    function openDropdown(type) {
      const map = {
        'sources': { wrap: 'sourcesDropdownWrap', trigger: 'sourcesDropdownTrigger' },
        'liveSources': { wrap: 'liveSourcesDropdownWrap', trigger: 'liveSourcesDropdownTrigger' },
        'vodCatalogs': { wrap: 'vodCatalogsDropdownWrap', trigger: 'vodCatalogsDropdownTrigger' },
        'liveCatalogs': { wrap: 'liveCatalogsDropdownWrap', trigger: 'liveCatalogsDropdownTrigger' }
      };
      const item = map[type];
      if (!item) return;
      const wrap = document.getElementById(item.wrap);
      const trigger = document.getElementById(item.trigger);
      if (!wrap) return;
      wrap.classList.add('is-open');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'true');
      }
    }`;

// Replace script functions up to getStreamBucket
const scriptTargetRegex = /<script>\s*const origin = window\.location\.origin;[\s\S]*?function getStreamBucket\(s\)/;
if (scriptTargetRegex.test(html)) {
  html = html.replace(scriptTargetRegex, `${newScriptBlock}\n\n    function getStreamBucket(s)`);
  console.log('Script block updated successfully');
} else {
  console.log('Script target regex not matched');
}

// 8. Update keyboard accessibility and navlink open events at the bottom
const oldKeyEventsRegex = /\/\/ Dropdown keyboard accessibility[\s\S]*?updateManifestUrl\(\);/;
const newKeyEvents = `// Dropdown keyboard accessibility & navlink auto-open
    ['sourcesDropdownTrigger', 'liveSourcesDropdownTrigger', 'vodCatalogsDropdownTrigger', 'liveCatalogsDropdownTrigger'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            el.click();
          }
        });
      }
    });

    document.querySelectorAll('a[href="#ch02"]').forEach(a => {
      a.addEventListener('click', () => {
        openDropdown('sources');
        openDropdown('liveSources');
      });
    });
    document.querySelectorAll('a[href="#ch03"]').forEach(a => {
      a.addEventListener('click', () => {
        openDropdown('vodCatalogs');
        openDropdown('liveCatalogs');
      });
    });

    updateManifestUrl();`;

if (oldKeyEventsRegex.test(html)) {
  html = html.replace(oldKeyEventsRegex, newKeyEvents);
  console.log('Key events and navlink hooks updated successfully');
} else {
  console.log('Key events regex not matched');
}

fs.writeFileSync(filePath, html, 'utf8');
console.log('public/index.html updated successfully!');
