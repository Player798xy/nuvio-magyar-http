const fs = require('fs');
const path = require('path');
const { ALL_CHANNELS } = require('../src/scrapers/onlinestream.js');

const VERCEL_HOST = 'https://nuvio-magyar-http.vercel.app';

async function fetchWithTimeout(url, headers = {}, timeoutMs = 5000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const elapsed = Date.now() - t0;
    const ok = res.ok;
    const status = res.status;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let text = '';
    let size = 0;

    if (ok) {
      if (ct.includes('mpegurl') || ct.includes('text') || url.includes('.m3u8') || url.includes('json')) {
        text = await res.text();
        size = text.length;
      } else {
        const arr = await res.arrayBuffer();
        size = arr.byteLength;
      }
    }
    return { ok, status, elapsed, text, size, ct };
  } catch (err) {
    return { ok: false, status: 0, elapsed: Date.now() - t0, error: err.message, text: '', size: 0, ct: '' };
  }
}

async function resolveToMediaPlaylist(playlistUrl, headers = {}) {
  const plRes = await fetchWithTimeout(playlistUrl, headers, 5000);
  if (!plRes.ok || !plRes.text.includes('#EXTM3U')) {
    return { ok: false, status: plRes.status, elapsed: plRes.elapsed, bufferSec: 0, segments: [], error: 'Failed to fetch playlist' };
  }

  let text = plRes.text;
  let finalUrl = playlistUrl;

  // If Master Playlist: find top bitrate / resolution variant
  if (text.includes('#EXT-X-STREAM-INF')) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let subUrl = null;
    let maxBandwidth = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/i);
        const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
          if (!subUrl || bw > maxBandwidth) {
            maxBandwidth = bw;
            subUrl = lines[i + 1];
          }
        }
      }
    }

    if (!subUrl) {
      subUrl = lines.find(l => !l.startsWith('#'));
    }

    if (subUrl) {
      finalUrl = subUrl.startsWith('http') ? subUrl : new URL(subUrl, playlistUrl).toString();
      const subRes = await fetchWithTimeout(finalUrl, headers, 5000);
      if (subRes.ok && subRes.text.includes('#EXTM3U')) {
        text = subRes.text;
      }
    }
  }

  // Parse Media Playlist
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const segments = [];
  let currentDuration = 0;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const m = line.match(/#EXTINF:([0-9.]+)/);
      currentDuration = m ? parseFloat(m[1]) : 0;
    } else if (currentDuration > 0 && !line.startsWith('#')) {
      try {
        const segUrl = line.startsWith('http') ? line : new URL(line, finalUrl).toString();
        segments.push({ duration: currentDuration, url: segUrl });
      } catch (e) {}
      currentDuration = 0;
    }
  }

  const totalBufferSec = segments.reduce((acc, s) => acc + s.duration, 0);

  return {
    ok: true,
    status: plRes.status,
    elapsed: plRes.elapsed,
    finalUrl,
    bufferSec: Math.round(totalBufferSec * 10) / 10,
    segmentCount: segments.length,
    firstSegmentUrl: segments.length > 0 ? segments[0].url : null,
    lastSegmentUrl: segments.length > 0 ? segments[segments.length - 1].url : null
  };
}

async function runBenchmark() {
  console.log(`=======================================================`);
  console.log(`🚀 Starting Vercel Production Benchmark for ${ALL_CHANNELS.length} channels`);
  console.log(`📡 Vercel Target: ${VERCEL_HOST}`);
  console.log(`=======================================================\n`);

  const results = [];
  let directBetterCount = 0;
  let proxyBetterCount = 0;
  let offlineCount = 0;

  for (let i = 0; i < ALL_CHANNELS.length; i++) {
    const ch = ALL_CHANNELS[i];
    process.stdout.write(`[${(i + 1).toString().padStart(3, ' ')}/${ALL_CHANNELS.length}] ${ch.name.padEnd(25)} `);

    const streamApiUrl = `${VERCEL_HOST}/stream/tv/${ch.id}.json`;
    const apiRes = await fetchWithTimeout(streamApiUrl, {}, 5000);

    let streams = [];
    if (apiRes.ok) {
      try {
        const data = JSON.parse(apiRes.text);
        streams = data.streams || [];
      } catch (e) {}
    }

    if (streams.length === 0) {
      console.log('=> OFFLINE (Nincs stream)');
      offlineCount++;
      results.push({
        channelId: ch.channelId,
        name: ch.name,
        category: ch.category || 'hu-live-orszagos',
        bestRecommendation: 'OFFLINE',
        bufferSec: 0,
        segmentCount: 0,
        proxyMs: 0,
        directMs: 0,
        segDownloadMs: 0,
        segBytes: 0,
        speedMbps: 0,
        serverHost: 'N/A',
        topStreamName: 'Nincs elérhető stream',
        statusDesc: 'A csatorna jelenleg offline'
      });
      continue;
    }

    // Top stream on Vercel
    const topStream = streams[0];
    const isTopProxy = topStream.url.includes('/proxy/hls');

    // Find direct counterpart if top is proxy, or proxy counterpart if top is direct
    const directStream = streams.find(s => !s.url.includes('/proxy/hls')) || topStream;
    const proxyStream = streams.find(s => s.url.includes('/proxy/hls')) || topStream;

    // Measure Vercel HLS Proxy stream
    const proxyMedia = await resolveToMediaPlaylist(proxyStream.url);

    // Measure direct stream
    const directMedia = await resolveToMediaPlaylist(directStream.url, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://onlinestream.live/'
    });

    // Test downloading 1 live video segment from Vercel to measure true throughput
    let segDownloadMs = 0;
    let segBytes = 0;
    let speedMbps = 0;
    let targetSegUrl = proxyMedia.lastSegmentUrl || proxyMedia.firstSegmentUrl || directMedia.firstSegmentUrl;

    if (targetSegUrl) {
      const segRes = await fetchWithTimeout(targetSegUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }, 5000);
      if (segRes.ok && segRes.size > 0) {
        segDownloadMs = segRes.elapsed;
        segBytes = segRes.size;
        const durSec = Math.max(segDownloadMs / 1000, 0.05);
        speedMbps = Math.round(((segBytes * 8) / (durSec * 1024 * 1024)) * 10) / 10;
      }
    }

    const effectiveBuffer = Math.max(proxyMedia.bufferSec, directMedia.bufferSec);
    const effectiveSegs = Math.max(proxyMedia.segmentCount, directMedia.segmentCount);

    let hostName = 'CDN';
    try {
      const parsedUrl = new URL(directStream.url);
      hostName = parsedUrl.hostname;
    } catch (e) {}

    let rec = isTopProxy ? 'HLS Proxy' : 'Közvetlen .m3u8';
    if (!proxyMedia.ok && !directMedia.ok) {
      rec = 'Offline';
      offlineCount++;
    } else if (isTopProxy) {
      proxyBetterCount++;
    } else {
      directBetterCount++;
    }

    const statusDesc = effectiveBuffer > 0
      ? `Buffer: ${effectiveBuffer}s (${effectiveSegs} szelet) • ${speedMbps > 0 ? speedMbps + ' Mbps' : 'Aktív'}`
      : 'Aktív stream';

    console.log(`=> ${rec.padEnd(16)} [${effectiveBuffer.toString().padStart(4, ' ')}s buffer, ${speedMbps.toString().padStart(4, ' ')} Mbps]`);

    results.push({
      channelId: ch.channelId,
      name: ch.name,
      category: ch.category || 'hu-live-orszagos',
      bestRecommendation: rec,
      bufferSec: effectiveBuffer,
      segmentCount: effectiveSegs,
      proxyMs: proxyMedia.elapsed,
      directMs: directMedia.elapsed,
      segDownloadMs,
      segBytes,
      speedMbps,
      serverHost: hostName,
      topStreamName: topStream.name,
      statusDesc
    });
  }

  console.log(`\n================ VERCEL BENCHMARK SUMMARY ================`);
  console.log(`Összes ellenőrzött csatorna: ${results.length}`);
  console.log(`⚡ HLS Proxy az első helyen:  ${proxyBetterCount}`);
  console.log(`🔴 Közvetlen .m3u8 az elsőn:  ${directBetterCount}`);
  console.log(`❌ Offline / Nem elérhető:    ${offlineCount}`);

  const outPath = path.join(__dirname, 'stream_benchmark_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Eredmények elmentve: ${outPath}`);
}

runBenchmark().catch(console.error);
