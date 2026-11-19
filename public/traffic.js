/* Live traffic dashboard for the addon server. */

(() => {
  'use strict';

  const BASE_PREFIX = window.__BASE_PREFIX || '';
  const $ = (id) => document.getElementById(id);

  const CLASS_ORDER = ['relay', 'epg', 'playlist', 'api', 'static', 'other'];
  const COLORS = {
    relay: '#ff6b6b',
    epg: '#b79bff',
    playlist: '#ffcc4d',
    api: '#38bdf8',
    static: '#34d399',
    other: '#8a8a8a'
  };

  const state = {
    data: null,
    range: '2m',
    timer: null,
    rate: 2000,
    chart: null,
    hoverIndex: -1,
    error: null
  };

  const el = {
    livePill: $('livePill'),
    refreshRate: $('refreshRate'),
    tileNow: $('tileNow'), tileNowSub: $('tileNowSub'),
    tileToday: $('tileToday'), tileTodaySub: $('tileTodaySub'),
    tileBoot: $('tileBoot'), tileBootSub: $('tileBootSub'),
    tilePeak: $('tilePeak'), tilePeakSub: $('tilePeakSub'),
    chart: $('chart'), chartSub: $('chartSub'), chartEmpty: $('chartEmpty'),
    canvasWrap: $('canvasWrap'), tooltip: $('tooltip'), legend: $('legend'),
    rangeToggle: $('rangeToggle'), relayNote: $('relayNote'), relayNoteValue: $('relayNoteValue'),
    classBody: $('classBody'), classTotal: $('classTotal')
  };

  const authKey = new URLSearchParams(location.search).get('key') || '';

  /* ---------------- formatting ---------------- */

  function fmtBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function fmtRate(bytesPerSec) {
    const value = Number(bytesPerSec) || 0;
    if (value < 1024) return `${Math.round(value)} B/s`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB/s`;
    return `${(value / 1024 / 1024).toFixed(2)} MB/s`;
  }

  function fmtClock(ts, withSeconds = false) {
    const opts = { hour: '2-digit', minute: '2-digit' };
    if (withSeconds) opts.second = '2-digit';
    return new Date(ts).toLocaleTimeString('hu-HU', opts);
  }

  function fmtUptime(sec) {
    const s = Number(sec) || 0;
    if (s < 60) return `${s} mp`;
    if (s < 3600) return `${Math.floor(s / 60)} perc`;
    if (s < 86400) return `${Math.floor(s / 3600)} óra ${Math.floor((s % 3600) / 60)} p`;
    return `${Math.floor(s / 86400)} nap ${Math.floor((s % 86400) / 3600)} óra`;
  }

  function niceCeil(value) {
    if (!value || value <= 0) return 1024;
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    const frac = value / base;
    const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * base;
  }

  /* ---------------- range data ---------------- */

  function rangeConfig() {
    if (state.range === '1h') {
      return { key: 'perMinute', seconds: 60, label: '60 perc', withSeconds: false };
    }
    if (state.range === '24h') {
      return { key: 'perHour', seconds: 3600, label: '24 óra', withSeconds: false };
    }
    return { key: 'perSecond', seconds: 1, label: '2 perc', withSeconds: true };
  }

  function buckets() {
    if (!state.data) return [];
    return state.data[rangeConfig().key] || [];
  }

  function bucketTotal(bucket, seconds) {
    const classes = bucket.classes || {};
    return Object.values(classes).reduce((sum, value) => sum + value, 0) / seconds;
  }

  /* ---------------- chart ---------------- */

  function setupCanvas() {
    const canvas = el.chart;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || canvas.parentElement.clientWidth;
    const height = canvas.clientHeight || 320;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function drawChart() {
    const canvas = el.chart;
    if (!canvas) return;

    const list = buckets();
    const { seconds, withSeconds } = rangeConfig();
    const { ctx, width, height } = setupCanvas();

    const pad = { l: 64, r: 14, t: 12, b: 26 };
    const plotW = Math.max(10, width - pad.l - pad.r);
    const plotH = Math.max(10, height - pad.t - pad.b);

    ctx.clearRect(0, 0, width, height);

    const totals = list.map(bucket => bucketTotal(bucket, seconds));
    const maxTotal = Math.max(...totals, 0);
    const scaleMax = niceCeil(maxTotal);

    // grid + y labels
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.t + (plotH / 4) * i;
      const value = scaleMax - (scaleMax / 4) * i;
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.fillStyle = '#7d7d7d';
      ctx.fillText(fmtRate(value), pad.l - 8, y);
    }

    if (!list.length || maxTotal <= 0) {
      el.chartEmpty.hidden = false;
      state.chart = { list, seconds, pad, plotW, plotH, width, height };
      return;
    }
    el.chartEmpty.hidden = true;

    const stepX = list.length > 1 ? plotW / (list.length - 1) : plotW;
    const xAt = (index) => pad.l + stepX * index;
    const yAt = (value) => pad.t + plotH - (value / scaleMax) * plotH;

    // stacked areas per class
    for (const cls of CLASS_ORDER) {
      ctx.beginPath();
      let started = false;
      const tops = [];
      const bottoms = [];

      for (let i = 0; i < list.length; i += 1) {
        const classes = list[i].classes || {};
        let below = 0;
        for (const other of CLASS_ORDER) {
          if (other === cls) break;
          below += (classes[other] || 0) / seconds;
        }
        const value = (classes[cls] || 0) / seconds;
        const x = xAt(i);
        tops.push([x, yAt(below + value)]);
        bottoms.push([x, yAt(below)]);
      }

      for (let i = 0; i < tops.length; i += 1) {
        if (i === 0) ctx.moveTo(tops[i][0], tops[i][1]);
        else {
          const prev = tops[i - 1];
          const mid = (prev[0] + tops[i][0]) / 2;
          ctx.quadraticCurveTo(prev[0] + (mid - prev[0]) * 0.2, prev[1], tops[i][0], tops[i][1]);
        }
        started = true;
      }
      if (!started) continue;

      for (let i = bottoms.length - 1; i >= 0; i -= 1) {
        ctx.lineTo(bottoms[i][0], bottoms[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = `${COLORS[cls]}cc`;
      ctx.fill();
    }

    // total outline
    ctx.beginPath();
    for (let i = 0; i < totals.length; i += 1) {
      const x = xAt(i);
      const y = yAt(totals[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // x labels
    ctx.fillStyle = '#7d7d7d';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'top';
    const labelIdx = [0, Math.floor((list.length - 1) / 2), list.length - 1];
    for (const index of labelIdx) {
      const bucket = list[index];
      if (!bucket) continue;
      ctx.textAlign = index === 0 ? 'left' : index === list.length - 1 ? 'right' : 'center';
      ctx.fillText(fmtClock(bucket.t, withSeconds), xAt(index), pad.t + plotH + 8);
    }

    state.chart = { list, seconds, pad, plotW, plotH, width, height, xAt };
  }

  /* ---------------- tooltip ---------------- */

  function showTooltip(event) {
    if (!state.chart || !state.chart.list.length) return;
    const rect = el.chart.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const { pad, plotW, list, seconds } = state.chart;

    if (x < pad.l - 8 || x > pad.l + plotW + 8) {
      hideTooltip();
      return;
    }

    const ratio = Math.min(1, Math.max(0, (x - pad.l) / plotW));
    const index = Math.round(ratio * (list.length - 1));
    const bucket = list[index];
    if (!bucket) return;
    state.hoverIndex = index;

    const classes = bucket.classes || {};
    const total = bucketTotal(bucket, seconds);
    const rows = CLASS_ORDER
      .filter(cls => (classes[cls] || 0) > 0)
      .map(cls => `<div class="tt-row"><span class="dot" style="background:${COLORS[cls]}"></span><span class="name">${escapeHtml(state.data.labels[cls] || cls)}</span><span class="val">${fmtRate((classes[cls] || 0) / seconds)}</span></div>`)
      .join('');

    el.tooltip.innerHTML = `<div class="tt-time">${fmtClock(bucket.t, rangeConfig().withSeconds)}</div>
      <div class="tt-total">${fmtRate(total)}</div>${rows || '<div class="muted" style="font-size:10.5px">nincs forgalom</div>'}`;
    el.tooltip.hidden = false;

    const tooltipWidth = 210;
    const left = Math.min(el.canvasWrap.clientWidth - tooltipWidth - 6, Math.max(6, x - tooltipWidth / 2));
    el.tooltip.style.left = `${left}px`;
    el.tooltip.style.top = '10px';
  }

  function hideTooltip() {
    el.tooltip.hidden = true;
    state.hoverIndex = -1;
  }

  /* ---------------- render ---------------- */

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderTiles() {
    const data = state.data;
    if (!data) return;
    const { live, totals } = data;

    el.tileNow.textContent = fmtRate(live.bytesPerSec);
    el.tileNowSub.textContent = `${live.reqPerSec} kérés/s · 5 mp átlag`;

    el.tileToday.textContent = fmtBytes(totals.todayBytes);
    el.tileTodaySub.textContent = `${totals.todayRequests} kérés · ${totals.dayKey}`;

    el.tileBoot.textContent = fmtBytes(totals.bootBytes);
    el.tileBootSub.textContent = `uptime ${fmtUptime(data.uptimeSec)}`;

    el.tilePeak.textContent = fmtRate(totals.peakBytesPerSec);
    el.tilePeakSub.textContent = totals.peakAt ? `csúcs: ${fmtClock(totals.peakAt, true)}` : 'nincs adat';
  }

  function renderLegend() {
    if (!state.data) return;
    el.legend.innerHTML = CLASS_ORDER.map(cls => `
      <span class="lg"><i style="background:${COLORS[cls]}"></i>${escapeHtml(state.data.labels[cls] || cls)}</span>
    `).join('');
  }

  function renderClasses() {
    if (!state.data) return;
    const rows = state.data.byClass || [];
    if (!rows.length) {
      el.classBody.innerHTML = '<tr><td colspan="4" class="muted">Még nincs mai forgalom.</td></tr>';
      el.classTotal.textContent = '0 B';
      return;
    }

    el.classTotal.textContent = fmtBytes(state.data.totals.todayBytes);
    el.classBody.innerHTML = rows.map(row => `
      <tr>
        <td><span class="cls"><i style="background:${COLORS[row.id] || '#8a8a8a'}"></i>${escapeHtml(row.label || row.id)}</span></td>
        <td class="num">${fmtBytes(row.bytes)}</td>
        <td>
          <span class="share">
            <span class="bar"><i style="width:${Math.max(1, row.share)}%;background:${COLORS[row.id] || '#34d399'}"></i></span>
            <span class="pct">${row.share}%</span>
          </span>
        </td>
        <td class="num">${row.requests}</td>
      </tr>`).join('');
  }

  function renderRelayNote() {
    const rows = state.data ? state.data.byClass || [] : [];
    const relay = rows.find(row => row.id === 'relay');
    const lastMinuteRelay = (state.data && state.data.perMinute || []).slice(-1)[0];
    const recentRelay = lastMinuteRelay && lastMinuteRelay.classes ? (lastMinuteRelay.classes.relay || 0) : 0;

    if ((relay && relay.bytes > 0) || recentRelay > 0) {
      el.relayNote.hidden = false;
      el.relayNoteValue.textContent = relay
        ? `${fmtBytes(relay.bytes)} ma (${relay.share}%)`
        : fmtBytes(recentRelay) + ' az elmúlt percben';
    } else {
      el.relayNote.hidden = true;
    }
  }

  function renderChart() {
    const config = rangeConfig();
    el.chartSub.textContent = `${config.label} · utolsó mérés: ${state.data ? fmtClock(state.data.generatedAt, true) : '–'}`;
    el.rangeToggle.querySelectorAll('button').forEach(button => {
      button.classList.toggle('on', button.dataset.range === state.range);
    });
    drawChart();
  }

  function render() {
    renderTiles();
    renderLegend();
    renderClasses();
    renderRelayNote();
    renderChart();
  }

  /* ---------------- data ---------------- */

  async function load() {
    try {
      const url = BASE_PREFIX + '/api/tv/traffic' + (authKey ? `?key=${encodeURIComponent(authKey)}` : '');
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 401) throw new Error('Jogosulatlan (STATS_KEY szükséges)');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      state.error = null;
      el.livePill.classList.toggle('paused', document.hidden);
      render();
    } catch (error) {
      state.error = error;
      el.chartEmpty.hidden = false;
      el.chartEmpty.textContent = `Nem sikerült betölteni: ${error.message}`;
      el.livePill.classList.add('paused');
    }
  }

  function schedule() {
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (document.hidden) return;
      load();
    }, state.rate);
  }

  /* ---------------- events ---------------- */

  el.rangeToggle.addEventListener('click', (event) => {
    const button = event.target.closest('[data-range]');
    if (!button) return;
    state.range = button.dataset.range;
    hideTooltip();
    renderChart();
  });

  el.refreshRate.addEventListener('change', () => {
    state.rate = Number(el.refreshRate.value) || 2000;
    schedule();
  });

  el.chart.addEventListener('mousemove', showTooltip);
  el.chart.addEventListener('mouseleave', hideTooltip);
  el.canvasWrap.addEventListener('mouseleave', hideTooltip);

  document.addEventListener('visibilitychange', () => {
    el.livePill.classList.toggle('paused', document.hidden);
    if (!document.hidden) load();
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawChart(), 150);
  });

  load();
  schedule();
})();
