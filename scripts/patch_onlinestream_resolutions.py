import re

with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update parseHlsVariants
old_variants_pattern = r'const fullUrl = new URL\(line, masterUrl\)\.toString\(\);\s*variants\.push\({\s*url: fullUrl,\s*width: currentInfo\.width,\s*height: currentInfo\.height,\s*bandwidth: currentInfo\.bandwidth,\s*quality: currentInfo\.height \? `\${currentInfo\.height}p` : `\${Math\.round\(currentInfo\.bandwidth / 1000\)}k`\s*}\);'

new_variants_code = '''const fullUrl = new URL(line, masterUrl).toString();
        let quality = '';
        let h = currentInfo.height;

        if (h >= 1080) {
          quality = '1080p FHD';
        } else if (h >= 720) {
          quality = '720p HD';
        } else if (h >= 576) {
          quality = '576p SD';
        } else if (h > 0) {
          quality = `${h}p`;
        } else {
          // No RESOLUTION attribute in header (e.g. Antik / gradetv feeds)
          if (fullUrl.includes('_HD') || fullUrl.includes('1080') || fullUrl.includes('1200_atk') || (currentInfo.bandwidth >= 1100000 && !fullUrl.includes(':SD:'))) {
            quality = '1080p FHD';
            h = 1080;
          } else if (fullUrl.includes('720') || fullUrl.includes('_hd') || currentInfo.bandwidth >= 700000) {
            quality = '720p HD';
            h = 720;
          } else {
            quality = '576p SD';
            h = 576;
          }
        }

        variants.push({
          url: fullUrl,
          width: currentInfo.width,
          height: h,
          bandwidth: currentInfo.bandwidth,
          quality
        });'''

code = re.sub(old_variants_pattern, new_variants_code, code)

# 2. Update resolveServerStream resolution defaults
old_res_data = r'const data = \{\s*masterUrl,\s*topVariantUrl: topVariant \? topVariant\.url : masterUrl,\s*quality: topVariant \? \(topVariant\.quality === \'1080p\' \? \'1080p FHD\' : topVariant\.quality\) : \'1080p / 720p HD\',\s*height: topVariant \? topVariant\.height : 1080\s*\};'

new_res_data = '''let quality = '1080p FHD';
    let height = 1080;

    if (topVariant && topVariant.quality) {
      quality = topVariant.quality;
      height = topVariant.height;
    } else {
      if (masterUrl.includes('1080') || masterUrl.includes('_HD') || masterUrl.includes('1200_atk')) {
        quality = '1080p FHD';
        height = 1080;
      } else if (masterUrl.includes('720') || masterUrl.includes('_hd')) {
        quality = '720p HD';
        height = 720;
      } else if (masterUrl.includes('576') || masterUrl.includes('sd') || masterUrl.includes(':SD:')) {
        quality = '576p SD';
        height = 576;
      } else {
        quality = '720p HD';
        height = 720;
      }
    }

    const data = {
      masterUrl,
      topVariantUrl: topVariant ? topVariant.url : masterUrl,
      quality,
      height
    };'''

code = re.sub(old_res_data, new_res_data, code)

# 3. Update getOnlineStreamStreams
old_get_streams = r'async function getOnlineStreamStreams\(channelIdOrKey, clientIp = null, hostUrl = HOST_URL\) \{.*?return results;\s*\}'

new_get_streams = '''async function getOnlineStreamStreams(channelIdOrKey, clientIp = null, hostUrl = HOST_URL) {
  const cleanId = String(channelIdOrKey || '').trim();
  const numId = cleanId.replace('onlinestream-live-', '').replace('mediaklikk-live-', '');

  const ch = CHANNELS_BY_ID.get(cleanId) ||
             CHANNELS_BY_NUM_ID.get(numId) ||
             ALL_CHANNELS.find(c => c.mtvaKey && c.mtvaKey === cleanId);

  if (!ch) return [];

  const results = [];
  const cleanHost = hostUrl || HOST_URL;
  const seenUrls = new Set();

  const addStream = (streamObj) => {
    if (!streamObj || !streamObj.url) return;
    const norm = streamObj.url.trim().toLowerCase();
    if (seenUrls.has(norm)) return;
    seenUrls.add(norm);
    results.push(streamObj);
  };

  // 1. Primary: If MTVA channel, fetch official MTVA 1080p HLS stream first!
  if (ch.mtvaKey) {
    try {
      const mtvaStreams = await getLiveChannelStreams(ch.mtvaKey, clientIp, cleanHost);
      if (Array.isArray(mtvaStreams) && mtvaStreams.length > 0) {
        for (const s of mtvaStreams) addStream(s);
      }
    } catch (err) {
      console.warn(`[OnlineStream] MTVA stream fallback for ${ch.name}:`, err.message);
    }
  }

  // 1b. Dedicated Hír TV Videa 1080p live stream
  if (ch.channelId === '4740' || (ch.name && (ch.name.toLowerCase().includes('hír tv') || ch.name.toLowerCase().includes('hirtv')))) {
    const hirTvUrl = 'https://videa.hu/static/live/8.3754346.2530409.1.0.1.1/index.m3u8';
    addStream({
      name: `🔴 [HU] ${ch.name} — 1080p FHD (.m3u8)`,
      title: `📡 ${ch.name} • Hivatalos Videa HLS Közvetítés\\n1080p Full HD • Közvetlen .m3u8 Adás`,
      url: hirTvUrl,
      behaviorHints: { notWebReady: false, isLive: true }
    });
    addStream({
      name: `⚡ [HU] ${ch.name} — 1080p FHD (HLS Proxy)`,
      title: `🚀 ${ch.name} • Akadozásmentes HLS Proxy\\n1080p Full HD • Azonnali Nuvio / ExoPlayer Indulás`,
      url: `${cleanHost}/proxy/hls.m3u8?url=${encodeURIComponent(hirTvUrl)}`,
      behaviorHints: { notWebReady: false, isLive: true }
    });
  }

  // 2. Secondary & Backup: Resolve OnlineStream direct HLS servers in parallel
  if (Array.isArray(ch.streams) && ch.streams.length > 0) {
    const resolvedServers = await Promise.allSettled(
      ch.streams.map(s => resolveServerStream(s))
    );

    const directStreams = [];
    const proxyStreams = [];
    let activeIndex = 1;

    for (let i = 0; i < ch.streams.length; i++) {
      const outcome = resolvedServers[i];
      const s = ch.streams[i];
      const res = outcome.status === 'fulfilled' ? outcome.value : null;

      if (!res && !s.url) continue;

      const serverHost = s.host || (res?.masterUrl ? new URL(res.masterUrl).hostname : `Szerver #${activeIndex}`);
      const quality = res?.quality || (s.features && !s.features.includes('-') && !s.features.includes(',') ? s.features : '1080p FHD');
      const topUrl = res?.topVariantUrl || s.url;
      const masterUrl = res?.masterUrl || s.url;

      if (topUrl) {
        // 1. KÖZVETLEN .m3u8 stream (LEGELÖL)
        directStreams.push({
          name: `🔴 [HU] ${ch.name} — ${quality} (.m3u8)`,
          title: `📡 ${ch.name} • ${serverHost}\\n${quality} Közvetlen HLS Adás (.m3u8)\\nOnlineStream Forrás`,
          url: topUrl,
          behaviorHints: {
            notWebReady: false,
            isLive: true
          }
        });

        // Proxy változat (később kerül be a lista végére)
        proxyStreams.push({
          name: `⚡ [HU] ${ch.name} — ${quality} (HLS Proxy)`,
          title: `🚀 ${ch.name} • Akadozásmentes HLS Proxy\\n${quality} • Azonnali Nuvio / ExoPlayer Indulás\\nOnlineStream Forrás`,
          url: `${cleanHost}/proxy/hls.m3u8?url=${encodeURIComponent(topUrl)}`,
          behaviorHints: {
            notWebReady: false,
            isLive: true
          }
        });
      }

      // 2. KÖZVETLEN Auto Adaptív master .m3u8 stream (2. HELYEN)
      if (masterUrl && masterUrl !== topUrl) {
        directStreams.push({
          name: `🔴 [HU] ${ch.name} — Auto (.m3u8)`,
          title: `📡 ${ch.name} • ${serverHost}\\nAdaptív HLS Master Playlist (.m3u8)\\nOnlineStream Forrás`,
          url: masterUrl,
          behaviorHints: {
            notWebReady: false,
            isLive: true
          }
        });

        proxyStreams.push({
          name: `⚡ [HU] ${ch.name} — Auto (HLS Proxy)`,
          title: `🚀 ${ch.name} • Akadozásmentes Auto Proxy\\nAdaptív felbontás • OnlineStream Forrás`,
          url: `${cleanHost}/proxy/hls.m3u8?url=${encodeURIComponent(masterUrl)}`,
          behaviorHints: {
            notWebReady: false,
            isLive: true
          }
        });
      }

      activeIndex++;
    }

    // MINDIG a közvetlen .m3u8 streamek legyenek legelöl az 1. és 2. helyen!
    for (const s of directStreams) addStream(s);
    // És csak ezek UTÁN jöjjenek a Proxy streamek!
    for (const s of proxyStreams) addStream(s);
  }

  // 3. Fallback: If no stream resolved yet but a stream or playerUrl exists, add safe fallback
  if (results.length === 0 && Array.isArray(ch.streams) && ch.streams.length > 0) {
    const firstStream = ch.streams[0];
    const targetUrl = firstStream.url || firstStream.playerUrl || firstStream.onlineUrl;
    if (targetUrl) {
      addStream({
        name: `🔴 [HU] ${ch.name} [Tartalék Adás]`,
        title: `📡 ${ch.name} • Tartalék IPTV Közvetítés\\nOnlineStream IPTV Forrás`,
        url: targetUrl,
        behaviorHints: {
          notWebReady: false,
          isLive: true
        }
      });
    }
  }

  return results;
}'''

code = re.sub(old_get_streams, new_get_streams, code, flags=re.DOTALL)

with open('src/scrapers/onlinestream.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Successfully patched onlinestream.js!")
