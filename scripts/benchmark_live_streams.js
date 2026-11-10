const fs = require('fs');
const path = require('path');
const { ALL_CHANNELS, resolveServerStream } = require('../src/scrapers/onlinestream.js');
const { getLiveChannelStreams } = require('../src/scrapers/mediaklikk.js');

const LOCAL_HOST = 'http://localhost:7000';

async function testFetch(url, headers = {}, timeoutMs = 3500) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const elapsed = Date.now() - t0;
    const ok = res.ok;
    const status = res.status;
    let text = '';
    let buffer = null;
    let size = 0;

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('mpegurl') || ct.includes('text') || url.includes('.m3u8')) {
      text = ok ? await res.text() : '';
      size = text.length;
    } else {
      const arr = ok ? await res.arrayBuffer() : new ArrayBuffer(0);
      size = arr.byteLength;
    }
    return { ok, status, elapsed, text, size, ct };
  } catch (err) {
    return { ok: false, status: 0, elapsed: Date.now() - t0, error: err.message, text: '', size: 0 };
  }
}

function parsePlaylist(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const segments = [];
  let currentInf = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#EXTINF:')) {
      const m = trimmed.match(/#EXTINF:([0-9.]+)/);
      currentInf = m ? parseFloat(m[1]) : 0;
    } else if (currentInf !== null && !trimmed.startsWith('#') && trimmed.length > 0) {
      try {
        const absUrl = new URL(trimmed, baseUrl).toString();
        segments.push({ duration: currentInf, url: absUrl });
      } catch (e) {}
      currentInf = null;
    }
  }

  const totalBufferSec = segments.reduce((sum, s) => sum + s.duration, 0);
  return {
    segmentCount: segments.length,
    totalBufferSec: Math.round(totalBufferSec * 10) / 10,
    firstSegmentUrl: segments.length > 0 ? segments[0].url : null
  };
}

async function benchmarkSingleStream(streamUrl, channelName, serverHost) {
  // 1. Direct playlist test (NO referer)
  const directPl = await testFetch(streamUrl, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }, 3500);

  let directPlParsed = { segmentCount: 0, totalBufferSec: 0, firstSegmentUrl: null };
  let directSeg = { ok: false, elapsed: 0, size: 0 };

  if (directPl.ok && directPl.text.includes('#EXTM3U')) {
    directPlParsed = parsePlaylist(directPl.text, streamUrl);
    if (directPlParsed.firstSegmentUrl) {
      // Test direct segment download
      directSeg = await testFetch(directPlParsed.firstSegmentUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }, 3500);
    }
  }

  // 2. Proxy playlist test
  const proxyPlUrl = `${LOCAL_HOST}/proxy/hls.m3u8?url=${encodeURIComponent(streamUrl)}`;
  const proxyPl = await testFetch(proxyPlUrl, {}, 3500);

  let proxyPlParsed = { segmentCount: 0, totalBufferSec: 0, firstSegmentUrl: null };
  let proxySeg = { ok: false, elapsed: 0, size: 0 };

  if (proxyPl.ok && proxyPl.text.includes('#EXTM3U')) {
    proxyPlParsed = parsePlaylist(proxyPl.text, proxyPlUrl);
    if (proxyPlParsed.firstSegmentUrl) {
      proxySeg = await testFetch(proxyPlParsed.firstSegmentUrl, {}, 3500);
    }
  }

  const directWorks = directPl.ok && (directSeg.ok || directPlParsed.segmentCount === 0);
  const proxyWorks = proxyPl.ok && (proxySeg.ok || proxyPlParsed.segmentCount === 0);

  let recommendation = 'PROXY_FIRST';
  let reason = '';

  if (!directWorks && !proxyWorks) {
    recommendation = 'OFFLINE';
    reason = 'Mindkét mód hibát ad';
  } else if (proxyWorks && !directWorks) {
    recommendation = 'PROXY_FIRST';
    reason = 'Közvetlen stream blokkolva/nem indul, csak a Proxy működik';
  } else if (directWorks && !proxyWorks) {
    recommendation = 'DIRECT_FIRST';
    reason = 'A Proxy sikertelen, de a közvetlen stream fut';
  } else {
    // Mindkettő működik -> buffer és sebesség összehasonlítás
    if (directPlParsed.totalBufferSec < 10) {
      recommendation = 'PROXY_FIRST';
      reason = `Közvetlen buffer túl alacsony (${directPlParsed.totalBufferSec}s < 10s) -> akadozna, Proxy kell`;
    } else if (directSeg.elapsed > 0 && proxySeg.elapsed > 0) {
      if (directSeg.elapsed <= proxySeg.elapsed + 80) {
        recommendation = 'DIRECT_FIRST';
        reason = `Közvetlen stream stabil (${directPlParsed.totalBufferSec}s buffer, ${directSeg.elapsed}ms) -> gyorsabb közvetlenül`;
      } else {
        recommendation = 'PROXY_FIRST';
        reason = `Proxy gyorsabban szállítja a szegmenseket (${proxySeg.elapsed}ms vs ${directSeg.elapsed}ms)`;
      }
    } else {
      recommendation = 'DIRECT_FIRST';
      reason = `Megfelelő buffer (${directPlParsed.totalBufferSec}s) -> közvetlen a preferált`;
    }
  }

  return {
    streamUrl,
    serverHost,
    direct: {
      works: directWorks,
      status: directPl.status,
      plMs: directPl.elapsed,
      segMs: directSeg.elapsed,
      segBytes: directSeg.size,
      bufferSec: directPlParsed.totalBufferSec,
      segs: directPlParsed.segmentCount
    },
    proxy: {
      works: proxyWorks,
      status: proxyPl.status,
      plMs: proxyPl.elapsed,
      segMs: proxySeg.elapsed,
      segBytes: proxySeg.size,
      bufferSec: proxyPlParsed.totalBufferSec,
      segs: proxyPlParsed.segmentCount
    },
    recommendation,
    reason
  };
}

async function runBenchmark() {
  console.log(`Starting Live Stream Benchmark for ${ALL_CHANNELS.length} channels...`);
  const results = [];
  let directFirstCount = 0;
  let proxyFirstCount = 0;
  let offlineCount = 0;

  for (let idx = 0; idx < ALL_CHANNELS.length; idx++) {
    const ch = ALL_CHANNELS[idx];
    process.stdout.write(`[${idx + 1}/${ALL_CHANNELS.length}] ${ch.name.padEnd(26)} `);

    const chResults = {
      channelId: ch.channelId,
      name: ch.name,
      category: ch.category,
      streams: []
    };

    if (Array.isArray(ch.streams) && ch.streams.length > 0) {
      for (const s of ch.streams) {
        let streamUrl = s.url;
        // Resolve if needed
        try {
          const resolved = await resolveServerStream(s, ch.height || 1080);
          if (resolved?.topVariantUrl) {
            streamUrl = resolved.topVariantUrl;
          }
        } catch (e) {}

        if (!streamUrl) continue;
        const host = s.host || (new URL(streamUrl)).hostname;
        const res = await benchmarkSingleStream(streamUrl, ch.name, host);
        chResults.streams.push(res);
      }
    }

    // Best recommendation for channel overall
    const validStreams = chResults.streams.filter(s => s.recommendation !== 'OFFLINE');
    let bestRec = 'PROXY_FIRST';
    if (validStreams.length > 0) {
      const directCandidate = validStreams.find(s => s.recommendation === 'DIRECT_FIRST');
      if (directCandidate) {
        bestRec = 'DIRECT_FIRST';
        directFirstCount++;
      } else {
        bestRec = 'PROXY_FIRST';
        proxyFirstCount++;
      }
    } else {
      bestRec = 'OFFLINE';
      offlineCount++;
    }

    chResults.bestRecommendation = bestRec;
    results.push(chResults);
    console.log(`=> ${bestRec}`);
  }

  console.log('\n================ BENCHMARK SUMMARY ================');
  console.log(`Total channels evaluated: ${results.length}`);
  console.log(`DIRECT_FIRST (Közvetlen .m3u8 jobb): ${directFirstCount}`);
  console.log(`PROXY_FIRST  (HLS Proxy jobb):       ${proxyFirstCount}`);
  console.log(`OFFLINE / NO STREAM:                ${offlineCount}`);

  const outPath = path.join(__dirname, 'stream_benchmark_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Results saved to: ${outPath}`);
}

runBenchmark().catch(console.error);
