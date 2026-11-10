function generateTvPosterSvg({ name, categoryName, accentColor = '#2575fc', bg1 = '#090d16', bg2 = '#131b2e', logoText = null }) {
  const safeName = (name || 'TV').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeCat = (categoryName || 'ÉLŐ TV').replace(/&/g, '&amp;');
  const displayLogo = logoText || safeName;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="50%" stop-color="#0c1017" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.7" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="900" fill="url(#bg)" />
  <rect width="600" height="900" fill="url(#glow)" />

  <!-- Subtle Grid lines -->
  <line x1="0" y1="120" x2="600" y2="120" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
  <line x1="0" y1="780" x2="600" y2="780" stroke="rgba(255,255,255,0.04)" stroke-width="1" />

  <!-- Top Badges -->
  <g transform="translate(40, 50)">
    <!-- Live Pill -->
    <rect x="0" y="0" width="84" height="30" rx="15" fill="#ff2244" />
    <circle cx="16" cy="15" r="4" fill="#ffffff" />
    <text x="26" y="21" font-family="'Space Grotesk', system-ui, sans-serif" font-size="13" font-weight="700" fill="#ffffff" letter-spacing="0.05em">ÉLŐ</text>

    <!-- FHD Pill -->
    <rect x="94" y="0" width="94" height="30" rx="15" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    <text x="141" y="20" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="600" fill="#cfffcf">1080p FHD</text>

    <!-- Audio Pill -->
    <rect x="198" y="0" width="80" height="30" rx="15" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    <text x="238" y="20" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="600" fill="#a5a5a5">STEREO</text>
  </g>

  <!-- Center Card Emblem / Logo -->
  <g transform="translate(300, 390)" filter="url(#shadow)">
    <!-- Outer Emblem Circle -->
    <circle cx="0" cy="0" r="140" fill="#0f141d" stroke="${accentColor}" stroke-width="2.5" stroke-opacity="0.6" />
    <circle cx="0" cy="0" r="126" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />

    <!-- Big Center Logo / Name -->
    <text x="0" y="16" text-anchor="middle" font-family="'Space Grotesk', system-ui, -apple-system, sans-serif" font-size="${displayLogo.length > 10 ? '34' : '44'}" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">
      ${displayLogo}
    </text>
  </g>

  <!-- Channel Name Title -->
  <text x="300" y="650" text-anchor="middle" font-family="'Space Grotesk', system-ui, -apple-system, sans-serif" font-size="${safeName.length > 14 ? '32' : '40'}" font-weight="700" fill="#ffffff" letter-spacing="-0.02em" filter="url(#shadow)">
    ${safeName}
  </text>

  <!-- Category Bottom Pill -->
  <g transform="translate(300, 715)">
    <rect x="-130" y="-18" width="260" height="36" rx="18" fill="rgba(255,255,255,0.06)" stroke="${accentColor}" stroke-width="1.2" stroke-opacity="0.4" />
    <text x="0" y="5" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-size="13" font-weight="600" fill="${accentColor}" letter-spacing="0.08em">
      ${safeCat.toUpperCase()}
    </text>
  </g>

  <!-- Bottom Brand Footer -->
  <text x="300" y="850" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="12" font-weight="500" fill="#666666" letter-spacing="0.1em">
    MAGYAR STREAMING PRO · NUVIO
  </text>
</svg>`;
}

const fs = require('fs');
const svg = generateTvPosterSvg({
  name: 'National Geographic',
  categoryName: 'Ismeretterjesztő & Doksi',
  accentColor: '#ffcc00',
  bg1: '#191504',
  bg2: '#332a08'
});

fs.writeFileSync('scripts/sample_poster.svg', svg, 'utf8');
console.log('Sample poster generated, length:', svg.length);
