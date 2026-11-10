/**
 * Dynamic High-Resolution TV Graphics Generator (SVG 600x900 Poster, 1280x720 Background, 500x500 Logo)
 * Provides 100% crisp, retina-ready, vector-sharp artwork for Nuvio & Stremio on Android TV, PC, and Mobile.
 */

const CHANNEL_PALETTES = {
  'rtl': { accent: '#ff2244', bg1: '#1c0509', bg2: '#0d0204', tag: 'ORSZÁGOS' },
  'tv2': { accent: '#00a8ff', bg1: '#05162a', bg2: '#020b15', tag: 'ORSZÁGOS' },
  'm1': { accent: '#00cc66', bg1: '#041c0e', bg2: '#020e07', tag: 'KÖZMÉDIA' },
  'm2': { accent: '#ffaa00', bg1: '#241703', bg2: '#120b01', tag: 'GYEREK & IFJÚSÁGI' },
  'duna': { accent: '#2980b9', bg1: '#061726', bg2: '#030c14', tag: 'NEMZETI FŐADÓ' },
  'm4': { accent: '#0984e3', bg1: '#04172e', bg2: '#020c18', tag: 'ÉLŐ SPORT' },
  'm5': { accent: '#9b59b6', bg1: '#1a0824', bg2: '#0d0412', tag: 'KULTÚRA' },
  'film+': { accent: '#ff0055', bg1: '#24030d', bg2: '#120106', tag: 'AKCIÓ & MOZI' },
  'mozi+': { accent: '#6c5ce7', bg1: '#0e0e29', bg2: '#070714', tag: 'PREMIER MOZI' },
  'cool': { accent: '#00cec9', bg1: '#031c1c', bg2: '#010e0e', tag: 'SOROZAT & FILM' },
  'amc': { accent: '#e67e22', bg1: '#241405', bg2: '#120a02', tag: 'PRÉMIUM SOROZAT' },
  'hbo': { accent: '#575fcf', bg1: '#0b0c21', bg2: '#050610', tag: 'HBO ORIGINAL' },
  'nat geo': { accent: '#f1c40f', bg1: '#211b03', bg2: '#100d01', tag: 'DOKUMENTUM' },
  'national geographic': { accent: '#f1c40f', bg1: '#211b03', bg2: '#100d01', tag: 'DOKUMENTUM' },
  'history': { accent: '#d4ac0d', bg1: '#211a04', bg2: '#100d02', tag: 'TÖRTÉNELEM' },
  'spektrum': { accent: '#00b894', bg1: '#031c16', bg2: '#010e0b', tag: 'ISMERETTERJESZTŐ' },
  'minimax': { accent: '#fd79a8', bg1: '#240616', bg2: '#12030b', tag: 'RAJZFILM' },
  'nickelodeon': { accent: '#ff7675', bg1: '#260a08', bg2: '#130504', tag: 'GYEREK TV' },
  'disney': { accent: '#74b9ff', bg1: '#05162b', bg2: '#020b15', tag: 'DISNEY CSALÁD' },
  'spíler': { accent: '#d63031', bg1: '#240606', bg2: '#120303', tag: 'PREMIER LEAGUE' },
  'sport': { accent: '#00b894', bg1: '#041c14', bg2: '#020e0a', tag: 'ÉLŐ SPORT' },
  'arena': { accent: '#ff9f43', bg1: '#241404', bg2: '#120a02', tag: 'ARENA4 SPORT' },
  'match': { accent: '#e84118', bg1: '#240803', bg2: '#120401', tag: 'MATCH4 SPORT' },
  'atv': { accent: '#c0392b', bg1: '#1f0604', bg2: '#0f0302', tag: 'HÍR & KÖZÉLET' },
  'hír tv': { accent: '#b71540', bg1: '#1c0309', bg2: '#0e0104', tag: 'NEMZETI HÍR TV' },
  'sopron': { accent: '#0abde3', bg1: '#041724', bg2: '#020b12', tag: 'VÁROSI TV' },
  'debrecen': { accent: '#10ac84', bg1: '#041c15', bg2: '#020e0a', tag: 'VÁROSI TV' },
  'fehérvár': { accent: '#0984e3', bg1: '#041629', bg2: '#020b14', tag: 'VÁROSI TV' },
  'tisza': { accent: '#00d2d3', bg1: '#031c1c', bg2: '#010e0e', tag: 'VÁROSI TV' },
  'szeged': { accent: '#1abc9c', bg1: '#041c17', bg2: '#020e0b', tag: 'VÁROSI TV' }
};

const CATEGORY_PALETTES = {
  'hu-live-orszagos': { accent: '#ff4757', bg1: '#1f0609', bg2: '#0f0304', tag: 'ORSZÁGOS CSATORNA' },
  'hu-live-film': { accent: '#a55eea', bg1: '#160826', bg2: '#0b0413', tag: 'FILM & SOROZAT' },
  'hu-live-doksi': { accent: '#ffbe76', bg1: '#241604', bg2: '#120b02', tag: 'DOKUMENTUM & TUDOMÁNY' },
  'hu-live-sport': { accent: '#2ed573', bg1: '#041c0e', bg2: '#020e07', tag: 'SPORT, ZENE & ÉLETMÓD' },
  'hu-live-gyerek': { accent: '#ff78e3', bg1: '#24061d', bg2: '#12030e', tag: 'RAJZFILM & GYEREK' },
  'hu-live-helyi': { accent: '#00d2d3', bg1: '#031c1c', bg2: '#010e0e', tag: 'HELYI & VÁROSI TV' }
};

function getChannelTheme(name, categoryId) {
  const normName = (name || '').toLowerCase();
  for (const [key, palette] of Object.entries(CHANNEL_PALETTES)) {
    if (normName.includes(key)) {
      return palette;
    }
  }
  return CATEGORY_PALETTES[categoryId] || { accent: '#00d2d3', bg1: '#08141f', bg2: '#040a10', tag: 'ÉLŐ TV' };
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 600x900 Ultra Sharp Vector Poster SVG
 */
function generateTvPosterSvg(ch) {
  const name = ch.name || 'Élő TV';
  const categoryId = ch.category || 'hu-live-orszagos';
  const theme = getChannelTheme(name, categoryId);

  const safeName = escapeXml(name);
  const safeTag = escapeXml(theme.tag);
  const initials = safeName.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();

  const nameLength = safeName.length;
  const fontSize = nameLength > 18 ? 30 : nameLength > 13 ? 36 : 42;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg1}" />
      <stop offset="50%" stop-color="#0a0d14" />
      <stop offset="100%" stop-color="${theme.bg2}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.accent}" />
      <stop offset="100%" stop-color="${theme.accent}cc" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.8" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="900" fill="url(#bg)" />
  <rect width="600" height="900" fill="url(#glow)" />

  <!-- Geometric accent lines -->
  <line x1="0" y1="110" x2="600" y2="110" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
  <line x1="0" y1="780" x2="600" y2="780" stroke="rgba(255,255,255,0.05)" stroke-width="1" />

  <!-- Top Badges -->
  <g transform="translate(40, 48)">
    <!-- Red LIVE Dot Pill -->
    <rect x="0" y="0" width="82" height="30" rx="15" fill="#ff1f44" />
    <circle cx="16" cy="15" r="4.5" fill="#ffffff" />
    <text x="26" y="21" font-family="'Space Grotesk', system-ui, sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="0.08em">ÉLŐ</text>

    <!-- FHD 1080p Pill -->
    <rect x="92" y="0" width="96" height="30" rx="15" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
    <text x="140" y="20" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="700" fill="#cfffcf">1080p FHD</text>
  </g>

  <!-- Big Central Brand Icon / Monogram -->
  <g transform="translate(300, 390)" filter="url(#shadow)">
    <!-- Outer Rings -->
    <circle cx="0" cy="0" r="145" fill="#0d111a" stroke="${theme.accent}" stroke-width="3" stroke-opacity="0.75" />
    <circle cx="0" cy="0" r="130" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
    <!-- TV Antenna / Screen Frame icon -->
    <rect x="-85" y="-60" width="170" height="120" rx="16" fill="rgba(255,255,255,0.04)" stroke="${theme.accent}" stroke-width="2" stroke-opacity="0.9" />
    <text x="0" y="16" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-0.02em">
      ${initials}
    </text>
  </g>

  <!-- Channel Name (Big, Crisp) -->
  <text x="300" y="650" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff" letter-spacing="-0.02em" filter="url(#shadow)">
    ${safeName}
  </text>

  <!-- Category Bottom Badge -->
  <g transform="translate(300, 715)">
    <rect x="-140" y="-18" width="280" height="36" rx="18" fill="rgba(255,255,255,0.06)" stroke="${theme.accent}" stroke-width="1.5" stroke-opacity="0.6" />
    <text x="0" y="5" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-size="13" font-weight="700" fill="${theme.accent}" letter-spacing="0.08em">
      ${safeTag}
    </text>
  </g>

  <!-- Bottom Brand Footnote -->
  <text x="300" y="845" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="600" fill="#787878" letter-spacing="0.12em">
    MAGYAR STREAMING PRO · NUVIO
  </text>
</svg>`;
}

/**
 * 1280x720 Cinematic Backdrop SVG
 */
function generateTvBackgroundSvg(ch) {
  const name = ch.name || 'Élő TV';
  const categoryId = ch.category || 'hu-live-orszagos';
  const theme = getChannelTheme(name, categoryId);

  const safeName = escapeXml(name);
  const safeTag = escapeXml(theme.tag);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg1}" />
      <stop offset="60%" stop-color="#090d14" />
      <stop offset="100%" stop-color="${theme.bg2}" />
    </linearGradient>
    <radialGradient id="glow" cx="25%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.32" />
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1280" height="720" fill="url(#bg)" />
  <rect width="1280" height="720" fill="url(#glow)" />

  <!-- Big Atmospheric Watermark Text -->
  <text x="1200" y="440" text-anchor="end" font-family="'Space Grotesk', system-ui, sans-serif" font-size="140" font-weight="900" fill="rgba(255,255,255,0.03)" letter-spacing="-0.04em">
    ${safeName}
  </text>

  <!-- Left Content Info -->
  <g transform="translate(100, 240)">
    <!-- Live Pill -->
    <rect x="0" y="0" width="90" height="34" rx="17" fill="#ff1f44" />
    <circle cx="18" cy="17" r="5" fill="#ffffff" />
    <text x="28" y="24" font-family="'Space Grotesk', system-ui, sans-serif" font-size="14" font-weight="800" fill="#ffffff" letter-spacing="0.08em">ÉLŐ TV</text>

    <!-- FHD 1080p Pill -->
    <rect x="104" y="0" width="105" height="34" rx="17" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
    <text x="156" y="23" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="13" font-weight="700" fill="#cfffcf">1080p FHD</text>

    <!-- Channel Name -->
    <text x="0" y="110" font-family="'Space Grotesk', system-ui, sans-serif" font-size="64" font-weight="900" fill="#ffffff" letter-spacing="-0.03em">
      ${safeName}
    </text>

    <!-- Category Tag -->
    <text x="0" y="160" font-family="'Space Grotesk', system-ui, sans-serif" font-size="20" font-weight="700" fill="${theme.accent}" letter-spacing="0.05em">
      ${safeTag}
    </text>

    <text x="0" y="210" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="16" font-weight="400" fill="#a5a5a5">
      Valós idejű akadozásmentes HLS élő adás közvetítés Nuvio &amp; Stremio alatt.
    </text>
  </g>
</svg>`;
}

/**
 * 500x500 Clean Logo SVG
 */
function generateTvLogoSvg(ch) {
  const name = ch.name || 'Élő TV';
  const categoryId = ch.category || 'hu-live-orszagos';
  const theme = getChannelTheme(name, categoryId);

  const safeName = escapeXml(name);
  const initials = safeName.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg1}" />
      <stop offset="100%" stop-color="${theme.bg2}" />
    </linearGradient>
  </defs>

  <rect width="500" height="500" rx="100" fill="url(#bg)" stroke="${theme.accent}" stroke-width="5" stroke-opacity="0.8" />
  <circle cx="250" cy="250" r="190" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" stroke-width="2" />

  <!-- Channel Name / Emblem -->
  <text x="250" y="220" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-size="76" font-weight="900" fill="#ffffff" letter-spacing="-0.03em">
    ${initials}
  </text>
  <text x="250" y="310" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-size="28" font-weight="800" fill="${theme.accent}" letter-spacing="-0.01em">
    ${safeName}
  </text>
  <text x="250" y="360" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="14" font-weight="700" fill="#787878" letter-spacing="0.1em">
    ÉLŐ ADÁS
  </text>
</svg>`;
}

module.exports = {
  generateTvPosterSvg,
  generateTvBackgroundSvg,
  generateTvLogoSvg,
  getChannelTheme
};
