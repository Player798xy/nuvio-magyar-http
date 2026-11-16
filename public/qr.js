/**
 * Minimal, dependency-free ISO/IEC 18004 QR Code Generator (Byte Mode, Versions 1-10, ECC Level M).
 * Renders crisp high-contrast SVG markup safe for offline/static CDN pages and TV scanning.
 */
(function (root) {
  'use strict';

  // Version 1..10 capacities & Reed-Solomon block layouts for Error Correction Level M (format code 00)
  // Format: [version, size, totalDataCodewords, ecPerBlock, g1Blocks, g1DataCw, g2Blocks, g2DataCw, alignCoords]
  const QR_VERSIONS_M = [
    [1,  21,  16, 10, 1, 16, 0,  0, []],
    [2,  25,  28, 16, 1, 28, 0,  0, [6, 18]],
    [3,  29,  44, 26, 1, 44, 0,  0, [6, 22]],
    [4,  33,  64, 18, 2, 32, 0,  0, [6, 26]],
    [5,  37,  86, 24, 2, 43, 0,  0, [6, 30]],
    [6,  41, 108, 16, 4, 27, 0,  0, [6, 34]],
    [7,  45, 124, 18, 4, 31, 0,  0, [6, 22, 38]],
    [8,  49, 154, 22, 2, 38, 2, 39, [6, 24, 42]],
    [9,  53, 182, 22, 3, 36, 2, 37, [6, 26, 46]],
    [10, 57, 216, 26, 4, 43, 1, 44, [6, 28, 50]],
    [11, 61, 254, 30, 1, 50, 4, 51, [6, 30, 54]],
    [12, 65, 290, 22, 6, 36, 2, 37, [6, 32, 58]]
  ];

  function computeVersionBits(version) {
    let d = version << 12;
    let rem = d;
    for (let i = 5; i >= 0; i--) {
      if ((rem >>> (i + 12)) & 1) rem ^= 0x1F25 << i;
    }
    return d | rem;
  }

  function computeFormatBitsM(maskId) {
    // ECC Level M = 00
    const data = maskId & 0x07;
    let rem = data << 10;
    for (let i = 4; i >= 0; i--) {
      if ((rem >>> (i + 10)) & 1) rem ^= 0x537 << i;
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  // GF(256) with primitive polynomial 0x11D
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGalois() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function polyMul(p, q) {
    const res = new Uint8Array(p.length + q.length - 1);
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < q.length; j++) {
        res[i + j] ^= gfMul(p[i], q[j]);
      }
    }
    return res;
  }

  function rsGeneratorPoly(degree) {
    let g = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
      g = polyMul(g, new Uint8Array([1, GF_EXP[i]]));
    }
    return g;
  }

  function rsComputeEc(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const buf = new Uint8Array(data.length + ecCount);
    buf.set(data, 0);
    for (let i = 0; i < data.length; i++) {
      const factor = buf[i];
      if (factor !== 0) {
        for (let j = 0; j < gen.length; j++) {
          buf[i + j] ^= gfMul(gen[j], factor);
        }
      }
    }
    return buf.slice(data.length);
  }

  function encodeUtf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(String(str || '')));
    }
    const utf8 = unescape(encodeURIComponent(String(str || '')));
    const out = [];
    for (let i = 0; i < utf8.length; i++) out.push(utf8.charCodeAt(i));
    return out;
  }

  function selectVersion(byteLen) {
    for (let i = 0; i < QR_VERSIONS_M.length; i++) {
      const spec = QR_VERSIONS_M[i];
      const charCountBits = spec[0] >= 10 ? 16 : 8;
      const totalDataBits = spec[2] * 8;
      const neededBits = 4 + charCountBits + byteLen * 8;
      if (neededBits <= totalDataBits) return spec;
    }
    return null;
  }

  function buildDataCodewords(bytes, spec) {
    const version = spec[0];
    const totalCodewords = spec[2];
    const charCountBits = version >= 10 ? 16 : 8;
    const bits = [];

    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >>> i) & 1);
      }
    }

    // Mode indicator 0100 (Byte mode)
    pushBits(0b0100, 4);
    pushBits(bytes.length, charCountBits);
    for (let i = 0; i < bytes.length; i++) {
      pushBits(bytes[i], 8);
    }

    const totalBits = totalCodewords * 8;
    const terminatorLen = Math.min(4, totalBits - bits.length);
    for (let i = 0; i < terminatorLen; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataCw.push(b);
    }

    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (dataCw.length < totalCodewords) {
      dataCw.push(padBytes[padIdx % 2]);
      padIdx++;
    }
    return new Uint8Array(dataCw);
  }

  function interleaveBlocks(dataCw, spec) {
    const ecPerBlock = spec[3];
    const g1Blocks = spec[4];
    const g1DataLen = spec[5];
    const g2Blocks = spec[6];
    const g2DataLen = spec[7];

    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;

    for (let i = 0; i < g1Blocks; i++) {
      const blk = dataCw.slice(offset, offset + g1DataLen);
      offset += g1DataLen;
      dataBlocks.push(blk);
      ecBlocks.push(rsComputeEc(blk, ecPerBlock));
    }
    for (let i = 0; i < g2Blocks; i++) {
      const blk = dataCw.slice(offset, offset + g2DataLen);
      offset += g2DataLen;
      dataBlocks.push(blk);
      ecBlocks.push(rsComputeEc(blk, ecPerBlock));
    }

    const interleaved = [];
    const maxDataLen = Math.max(g1DataLen, g2DataLen);
    for (let col = 0; col < maxDataLen; col++) {
      for (let b = 0; b < dataBlocks.length; b++) {
        if (col < dataBlocks[b].length) interleaved.push(dataBlocks[b][col]);
      }
    }
    for (let col = 0; col < ecPerBlock; col++) {
      for (let b = 0; b < ecBlocks.length; b++) {
        interleaved.push(ecBlocks[b][col]);
      }
    }
    return interleaved;
  }

  function createEmptyMatrix(size) {
    const mod = Array.from({ length: size }, () => new Uint8Array(size));
    const isFunc = Array.from({ length: size }, () => new Uint8Array(size));
    return { size, mod, isFunc };
  }

  function setFuncMod(ctx, r, c, dark) {
    if (r >= 0 && r < ctx.size && c >= 0 && c < ctx.size) {
      ctx.mod[r][c] = dark ? 1 : 0;
      ctx.isFunc[r][c] = 1;
    }
  }

  function placeFinder(ctx, top, left) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= ctx.size || c < 0 || c >= ctx.size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFuncMod(ctx, r, c, inOuter || inInner);
      }
    }
  }

  function placeAlignment(ctx, centerR, centerC) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        setFuncMod(ctx, centerR + dr, centerC + dc, dark);
      }
    }
  }

  function placeFunctionPatterns(ctx, spec) {
    const n = ctx.size;
    placeFinder(ctx, 0, 0);
    placeFinder(ctx, 0, n - 7);
    placeFinder(ctx, n - 7, 0);

    // Alignment patterns
    const coords = spec[8];
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const r = coords[i];
        const c = coords[j];
        const overlapsFinder =
          (r <= 8 && c <= 8) ||
          (r <= 8 && c >= n - 9) ||
          (r >= n - 9 && c <= 8);
        if (!overlapsFinder) placeAlignment(ctx, r, c);
      }
    }

    // Timing patterns
    for (let i = 8; i < n - 8; i++) {
      const dark = i % 2 === 0;
      if (!ctx.isFunc[6][i]) setFuncMod(ctx, 6, i, dark);
      if (!ctx.isFunc[i][6]) setFuncMod(ctx, i, 6, dark);
    }

    // Dark module
    setFuncMod(ctx, 4 * spec[0] + 9, 8, true);

    // Reserve format areas
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        ctx.isFunc[8][i] = 1;
        ctx.isFunc[i][8] = 1;
      }
    }
    for (let i = n - 8; i < n; i++) {
      ctx.isFunc[8][i] = 1;
      ctx.isFunc[i][8] = 1;
    }

    // Reserve & write version info for >= 7
    if (spec[0] >= 7) {
      const vBits = computeVersionBits(spec[0]);
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
          const bit = ((vBits >>> (i * 3 + j)) & 1) === 1;
          setFuncMod(ctx, n - 11 + j, i, bit);
          setFuncMod(ctx, i, n - 11 + j, bit);
        }
      }
    }
  }

  function placeDataBits(ctx, allBytes) {
    const bits = [];
    for (let i = 0; i < allBytes.length; i++) {
      for (let b = 7; b >= 0; b--) bits.push((allBytes[i] >>> b) & 1);
    }

    const n = ctx.size;
    let bitIdx = 0;
    let upward = true;

    for (let rightCol = n - 1; rightCol >= 1; rightCol -= 2) {
      if (rightCol === 6) rightCol = 5;
      for (let step = 0; step < n; step++) {
        const r = upward ? (n - 1 - step) : step;
        for (let dc = 0; dc < 2; dc++) {
          const c = rightCol - dc;
          if (!ctx.isFunc[r][c]) {
            ctx.mod[r][c] = bitIdx < bits.length ? bits[bitIdx++] : 0;
          }
        }
      }
      upward = !upward;
    }
  }

  function maskFn(maskId, r, c) {
    switch (maskId) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  }

  function applyMaskAndFormat(ctx, maskId) {
    const n = ctx.size;
    const masked = Array.from({ length: n }, (_, r) => {
      const row = new Uint8Array(n);
      for (let c = 0; c < n; c++) {
        const invert = !ctx.isFunc[r][c] && maskFn(maskId, r, c);
        row[c] = invert ? (ctx.mod[r][c] ^ 1) : ctx.mod[r][c];
      }
      return row;
    });

    const fmt = computeFormatBitsM(maskId);
    const bit = k => (fmt >>> k) & 1;

    // Place format bits k = 14 (MSB) down to 0 (LSB) per ISO/IEC 18004
    for (let i = 0; i < 6; i++) {
      const b = bit(14 - i);
      masked[8][i] = b;
      masked[n - 1 - i][8] = b;
    }
    masked[8][7] = bit(8);
    masked[n - 7][8] = bit(8);

    masked[8][8] = bit(7);
    masked[8][n - 8] = bit(7);

    masked[7][8] = bit(6);
    masked[8][n - 7] = bit(6);

    for (let i = 0; i < 6; i++) {
      const b = bit(5 - i);
      masked[5 - i][8] = b;
      masked[8][n - 6 + i] = b;
    }
    return masked;
  }

  function scoreMask(grid) {
    const n = grid.length;
    let penalty = 0;

    // Rule 1: 5+ same-color in row/col
    for (let r = 0; r < n; r++) {
      let runRow = 1;
      let runCol = 1;
      for (let i = 1; i < n; i++) {
        if (grid[r][i] === grid[r][i - 1]) {
          runRow++;
          if (runRow === 5) penalty += 3;
          else if (runRow > 5) penalty += 1;
        } else runRow = 1;

        if (grid[i][r] === grid[i - 1][r]) {
          runCol++;
          if (runCol === 5) penalty += 3;
          else if (runCol > 5) penalty += 1;
        } else runCol = 1;
      }
    }

    // Rule 2: 2x2 blocks
    let darkCount = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        darkCount += grid[r][c];
        if (r < n - 1 && c < n - 1) {
          const sum = grid[r][c] + grid[r][c + 1] + grid[r + 1][c] + grid[r + 1][c + 1];
          if (sum === 0 || sum === 4) penalty += 3;
        }
      }
    }

    // Rule 3: finder-like 1:1:3:1:1 patterns
    function countFinderLike(arr) {
      let hits = 0;
      for (let i = 0; i <= arr.length - 11; i++) {
        if (
          arr[i] === 1 && arr[i + 1] === 0 && arr[i + 2] === 1 && arr[i + 3] === 1 &&
          arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 &&
          arr[i + 7] === 0 && arr[i + 8] === 0 && arr[i + 9] === 0 && arr[i + 10] === 0
        ) hits++;
        if (
          arr[i] === 0 && arr[i + 1] === 0 && arr[i + 2] === 0 && arr[i + 3] === 0 &&
          arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 &&
          arr[i + 7] === 1 && arr[i + 8] === 1 && arr[i + 9] === 0 && arr[i + 10] === 1
        ) hits++;
      }
      return hits;
    }

    for (let r = 0; r < n; r++) {
      penalty += countFinderLike(grid[r]) * 40;
      const col = new Uint8Array(n);
      for (let i = 0; i < n; i++) col[i] = grid[i][r];
      penalty += countFinderLike(col) * 40;
    }

    // Rule 4: dark ratio balance around 50%
    const pct = (darkCount * 100) / (n * n);
    const k = Math.min(Math.floor(Math.abs(pct - 50) / 5), 10);
    penalty += k * 10;
    return penalty;
  }

  function encodeMatrix(text) {
    const bytes = encodeUtf8Bytes(text);
    const spec = selectVersion(bytes.length);
    if (!spec) {
      throw new Error('QR payload too long for built-in encoder');
    }
    const dataCw = buildDataCodewords(bytes, spec);
    const allBytes = interleaveBlocks(dataCw, spec);
    const ctx = createEmptyMatrix(spec[1]);
    placeFunctionPatterns(ctx, spec);
    placeDataBits(ctx, allBytes);

    let bestGrid = null;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const candidate = applyMaskAndFormat(ctx, mask);
      const score = scoreMask(candidate);
      if (score < bestScore) {
        bestScore = score;
        bestGrid = candidate;
      }
    }
    return bestGrid;
  }

  function toSvg(text, opts) {
    const options = opts || {};
    const margin = Number.isFinite(options.margin) ? options.margin : 3;
    const darkColor = options.darkColor || '#050505';
    const lightColor = options.lightColor || '#ffffff';
    const grid = encodeMatrix(text);
    const n = grid.length;
    const total = n + margin * 2;

    const paths = [];
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (grid[r][c] === 1) {
          let run = 1;
          while (c + run < n && grid[r][c + run] === 1) run++;
          paths.push(`M${c + margin},${r + margin}h${run}v1h-${run}z`);
          c += run;
        } else {
          c++;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="QR kód" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${lightColor}"/><path d="${paths.join('')}" fill="${darkColor}"/></svg>`;
  }

  const api = { encodeMatrix, toSvg };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.NuvioQR = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
