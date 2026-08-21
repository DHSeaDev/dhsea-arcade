/* Prism Cascade — engine, physics, FX, UI glue.
   Crafted with sparkles by dhseadev. */
(function () {
  'use strict';
  const L = (typeof PCLogic !== 'undefined') ? PCLogic : null;
  if (!L) { console.error('PCLogic missing'); return; }

  // ============================== Storage ==============================
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const writeQueues = Object.create(null); // per-key serialize queue (unique data per write)
  const store = {
    async get(key) {
      try {
        if (hasChrome) {
          const o = await chrome.storage.local.get(key);
          return o ? o[key] : undefined;
        }
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : undefined;
      } catch (e) { return undefined; }
    },
    set(key, val) {
      const prev = writeQueues[key] || Promise.resolve();
      const next = prev.then(async () => {
        try {
          if (hasChrome) await chrome.storage.local.set({ [key]: val });
          else localStorage.setItem(key, JSON.stringify(val));
        } catch (e) { /* best-effort */ }
      });
      writeQueues[key] = next.catch(() => {});
      return next;
    },
  };

  // ============================== Audio ==============================
  // Synthesis lives in js/audio.js. Every call site below hands it the PHYSICS of the event
  // (mass, speed, splash energy, bubble size, combo position) rather than naming a preset,
  // which is what makes a big slow break sound different from a small fast one.
  const AX = (typeof PCAudio !== 'undefined') ? PCAudio : null;
  const AudioFX = AX ? AX.sfx : new Proxy({}, { get: () => () => {} });

  // ============================== Canvas / world ==============================
  const cv = document.getElementById('game');
  const cx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, S = 1; // S = ui scale
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    S = Math.max(0.6, Math.min(1.25, Math.min(W / 1500, H / 860)));
    layout();
  }
  const G = {
    waterY: 0, waterL: 0, waterR: 0, fallX: 0, fallW: 0, beamY: 0,
    launch: { x: 0, y: 0 },
  };
  function layout() {
    G.waterY = H * 0.80; G.waterL = 0; G.waterR = W * 0.995;
    G.fallX = W * 0.875; G.fallW = W * 0.055;
    buildTiers();
    G.beamY = H * 0.085;
    G.launch.x = W * 0.065; G.launch.y = H * 0.66;
  }
  window.addEventListener('resize', () => {
    resize(); initWater(); initAmbient(); initClouds(); renderCliffTex(); initRain(); initSeabed();
    // remap crystals to the new viewport from their normalized coords
    for (const c of crystals) { c.px = c.x * W; c.py = c.y * H; }
  });

  // ============================== Water surface (springs) ==============================
  const water = { cols: [], n: 0, spacing: 6 };
  function initWater() {
    water.n = Math.max(40, Math.floor(W / water.spacing));
    water.cols = new Array(water.n).fill(0).map(() => ({ h: 0, v: 0 }));
  }
  function waterIndex(x) { return Math.max(0, Math.min(water.n - 1, Math.floor(x / W * water.n))); }
  function disturbWater(x, power) {
    const i = waterIndex(x);
    water.cols[i].v += power;
    if (water.cols[i - 1]) water.cols[i - 1].v += power * 0.6;
    if (water.cols[i + 1]) water.cols[i + 1].v += power * 0.6;
  }
  function stepWater(dt) {
    const k = 0.025, damp = 0.976, spread = 0.14;
    const hMax = 34 * S, vMax = 46;
    const c = water.cols;
    for (let i = 0; i < water.n; i++) {
      const col = c[i];
      col.v += -k * col.h;
      col.v *= damp;
      if (col.v > vMax) col.v = vMax; else if (col.v < -vMax) col.v = -vMax;
      col.h += col.v * dt * 60;
      if (col.h > hMax) col.h = hMax; else if (col.h < -hMax) col.h = -hMax;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < water.n; i++) {
        if (i > 0) { const d = (c[i].h - c[i - 1].h) * spread; c[i - 1].v += d * 0.5; c[i].v -= d * 0.5; }
        if (i < water.n - 1) { const d = (c[i].h - c[i + 1].h) * spread; c[i + 1].v += d * 0.5; c[i].v -= d * 0.5; }
      }
    }
    // spatial smoothing — kills the alternating-column (Nyquist) instability mode
    // while preserving long-wavelength waves
    let prev = c[0].h;
    for (let i = 1; i < water.n - 1; i++) {
      const smoothed = (prev + 2 * c[i].h + c[i + 1].h) * 0.25;
      prev = c[i].h;
      c[i].h += (smoothed - c[i].h) * 0.55;
    }
  }

  // ============================== Entities ==============================
  const orbs = [], shards = [], bubbles = [], crystals = [], parts = [], popups = [], fireworks = [];
  const MAXP = 1400;

  // ============================== Scenes (time-of-day + weather, per level, visual only) ==============================
  const TODS = ['dawn', 'day', 'dusk', 'night'];
  const SKY = {
    dawn:  [[0, '#1b1a4a'], [0.42, '#4a2a6e'], [0.74, '#c96a8d'], [1, '#f7b267']],
    day:   [[0, '#2c6fbd'], [0.45, '#5aa7e8'], [0.78, '#9fd0f5'], [1, '#c9e8fb']],
    dusk:  [[0, '#241a55'], [0.42, '#5a2a72'], [0.74, '#b1487f'], [1, '#ff8f5e']],
    night: [[0, '#0b1035'], [0.45, '#1a1f5e'], [0.75, '#33256e'], [1, '#0d0a2a']],
  };
  const SCENE_TUNE = {
    dawn:  { stars: 0.28, aurora: 0,   clouds: 0.7,  fireflies: 0, sun: true,  spire: ['rgba(90,62,120,0.4)', 'rgba(122,80,150,0.5)'],  rock: ['#4a3960', '#6b5484', '#8d6da6'] },
    day:   { stars: 0,    aurora: 0,   clouds: 0.95, fireflies: 0, sun: true,  spire: ['rgba(70,110,170,0.35)', 'rgba(96,138,196,0.45)'], rock: ['#5c6a94', '#7d8cb4', '#9fb0d2'] },
    dusk:  { stars: 0.45, aurora: 0,   clouds: 0.7,  fireflies: 1, sun: false, spire: ['rgba(96,52,110,0.42)', 'rgba(130,70,140,0.52)'],  rock: ['#503a66', '#74538a', '#9a70a8'] },
    night: { stars: 1,    aurora: 1,   clouds: 0.25, fireflies: 1, sun: false, spire: ['rgba(66,58,138,0.38)', 'rgba(94,74,178,0.5)'],   rock: ['#2c2650', '#413a6e', '#5a5190'] },
  };
  // Seabeds rotate per level the same way weather does, so the pool you are splashing into
  // is not the same pool every round.
  const SEAS = {
    sandflats:  { name: 'Sand Flats',   floor: ['#e8d5a8', '#c9ad74'], plant: '#7fae5a', plantN: 7,  plantH: 0.30, rocks: 3,  coral: 0, shells: 7, vents: 0 },
    kelpforest: { name: 'Kelp Forest',  floor: ['#a89370', '#6b5a3e'], plant: '#3f7a44', plantN: 14, plantH: 0.95, rocks: 5,  coral: 0, shells: 3, vents: 1 },
    coralshelf: { name: 'Coral Shelf',  floor: ['#f0dcc0', '#cba98a'], plant: '#5f9e6a', plantN: 5, plantH: 0.35, rocks: 3, coral: 7, shells: 5, vents: 0 },
    seagrass:   { name: 'Seagrass Bed', floor: ['#d9cfa0', '#9d9463'], plant: '#6fae4e', plantN: 22, plantH: 0.45, rocks: 2,  coral: 0, shells: 4, vents: 0 },
    boulders:   { name: 'Boulder Bed',  floor: ['#9aa3ad', '#5d6672'], plant: '#4e7f5c', plantN: 5,  plantH: 0.35, rocks: 9,  coral: 1, shells: 2, vents: 0 },
    basalt:     { name: 'Basalt Vents', floor: ['#6b6a76', '#33323d'], plant: '#39694f', plantN: 4,  plantH: 0.55, rocks: 7,  coral: 2, shells: 1, vents: 3 },
  };
  const SEA_KEYS = Object.keys(SEAS);

  function sceneFor(level) {
    const tod = TODS[(Math.max(1, level) - 1) % 4];
    const rng = L.mulberry32(0x5CE7E ^ (level * 7919));
    const wr = rng();
    const weather = wr < 0.55 ? 'clear' : wr < 0.82 ? 'cloudy' : 'rain';
    const sea = SEA_KEYS[Math.floor(rng() * SEA_KEYS.length)];
    return { tod, weather, sea, ...SCENE_TUNE[tod] };
  }
  const clouds = [];
  function initClouds() {
    clouds.length = 0;
    const rng = Math.random;
    for (let i = 0; i < 6; i++) {
      clouds.push({ x: rng() * W, y: H * (0.06 + rng() * 0.26), sc: (0.6 + rng() * 0.9) * S, sp: 4 + rng() * 9, seed: rng() * 10 });
    }
  }
  function drawCelestial(t) {
    const sc = game.scene; if (!sc) return;
    // the sun/moon keep their own unhurried pace — one full pass ≈ 2.5 minutes,
    // phase-shifted per level so each scene starts at a different point in the sky
    const lvl = game.level ? game.level.level : 1;
    const p = (t / 150000 + lvl * 0.37) % 1;
    const px2 = W * (0.08 + p * 0.62);
    const py2 = H * 0.36 - Math.sin(p * Math.PI) * H * 0.24;
    cx.save();
    if (sc.sun) {
      const r = 34 * S;
      const glow = cx.createRadialGradient(px2, py2, 2, px2, py2, r * 3.4);
      glow.addColorStop(0, sc.tod === 'dawn' ? 'rgba(255,190,120,0.9)' : 'rgba(255,238,180,0.95)');
      glow.addColorStop(0.35, sc.tod === 'dawn' ? 'rgba(255,150,90,0.35)' : 'rgba(255,225,140,0.3)');
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      cx.fillStyle = glow;
      cx.beginPath(); cx.arc(px2, py2, r * 3.4, 0, 6.29); cx.fill();
      cx.fillStyle = sc.tod === 'dawn' ? '#ffd9a0' : '#fff6d8';
      cx.beginPath(); cx.arc(px2, py2, r, 0, 6.29); cx.fill();
      // slow rays
      cx.globalAlpha = 0.25;
      cx.strokeStyle = '#fff2c8'; cx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + t * 0.0001;
        cx.beginPath();
        cx.moveTo(px2 + Math.cos(a) * r * 1.3, py2 + Math.sin(a) * r * 1.3);
        cx.lineTo(px2 + Math.cos(a) * r * 1.75, py2 + Math.sin(a) * r * 1.75);
        cx.stroke();
      }
    } else {
      const r = 26 * S;
      const glow = cx.createRadialGradient(px2, py2, 2, px2, py2, r * 3);
      glow.addColorStop(0, 'rgba(220,235,255,0.55)');
      glow.addColorStop(1, 'rgba(220,235,255,0)');
      cx.fillStyle = glow;
      cx.beginPath(); cx.arc(px2, py2, r * 3, 0, 6.29); cx.fill();
      cx.fillStyle = '#e8efff';
      cx.beginPath(); cx.arc(px2, py2, r, 0, 6.29); cx.fill();
      // crescent bite + craters
      cx.fillStyle = 'rgba(90,100,160,0.55)';
      cx.beginPath(); cx.arc(px2 - r * 0.42, py2 - r * 0.18, r * 0.86, 0, 6.29); cx.fill();
      cx.fillStyle = 'rgba(160,175,220,0.5)';
      cx.beginPath(); cx.arc(px2 + r * 0.3, py2 + r * 0.28, r * 0.14, 0, 6.29); cx.fill();
      cx.beginPath(); cx.arc(px2 + r * 0.5, py2 - r * 0.1, r * 0.09, 0, 6.29); cx.fill();
    }
    cx.restore();
  }
  function drawClouds(t) {
    const sc = game.scene; if (!sc) return;
    let alpha = sc.clouds * (sc.weather === 'cloudy' || sc.weather === 'rain' ? 1 : 0.55);
    if (alpha <= 0.02) return;
    cx.save();
    for (const cl of clouds) {
      const tone = sc.weather === 'rain' ? '190,198,220' : sc.tod === 'night' ? '170,180,220' : '255,255,255';
      cx.fillStyle = 'rgba(' + tone + ',' + (alpha * 0.5) + ')';
      for (let i = 0; i < 5; i++) {
        const ox = Math.sin(cl.seed + i * 2.1) * 52 * cl.sc + i * 34 * cl.sc;
        const oy = Math.cos(cl.seed + i * 1.7) * 10 * cl.sc;
        const rr = (26 - Math.abs(i - 2) * 6) * cl.sc;
        cx.beginPath(); cx.arc(cl.x + ox, cl.y + oy, rr, 0, 6.29); cx.fill();
      }
    }
    cx.restore();
  }
  // Rain — stateful drops, three depth layers, uniform across the whole sky,
  // slanted with the ambient breeze, dimpling the surface where they land. Visual only.
  const rainDrops = [];
  const RAIN_LAYERS = [
    { sp: 620, len: 9,  w: 1.0, a: 0.16, drift: -34 },  // far
    { sp: 860, len: 14, w: 1.2, a: 0.26, drift: -46 },  // mid
    { sp: 1150, len: 20, w: 1.5, a: 0.38, drift: -60 }, // near
  ];
  function initRain() {
    rainDrops.length = 0;
    const n = game.reduceFx ? 54 : 132;
    for (let i = 0; i < n; i++) {
      rainDrops.push({
        x: Math.random() * (W + 240) - 120,
        y: Math.random() * G.waterY,
        layer: i % 3,
      });
    }
  }
  function stepRain(dt) {
    const sc = game.scene;
    if (!sc || sc.weather !== 'rain') return;
    if (!rainDrops.length) initRain();
    for (const d of rainDrops) {
      const l2 = RAIN_LAYERS[d.layer];
      d.y += l2.sp * dt;
      d.x += l2.drift * dt;
      if (d.y > G.waterY + 4) {
        // near drops dimple the surface with a tiny ring of spray
        if (d.layer === 2 && !game.reduceFx && Math.random() < 0.3) {
          spawnParts(2, d.x, G.waterY, { dir: -Math.PI / 2, spread: 1.3, speed: 55, hue: 205, life: 0.32, size: 1.3, grav: 420 });
        }
        d.y = -20 - Math.random() * 60;
        d.x = Math.random() * (W + 240) - 120;
      }
      if (d.x < -140) d.x += W + 260;
    }
  }
  function drawRain(t) {
    const sc = game.scene;
    if (!sc || sc.weather !== 'rain' || !rainDrops.length) return;
    cx.save();
    cx.lineCap = 'round';
    for (let l2 = 0; l2 < 3; l2++) {
      const cfg = RAIN_LAYERS[l2];
      cx.strokeStyle = 'rgba(200,222,252,' + cfg.a + ')';
      cx.lineWidth = cfg.w;
      cx.beginPath();
      for (const d of rainDrops) {
        if (d.layer !== l2 || d.y < -20) continue;
        const slant = cfg.drift / cfg.sp;
        cx.moveTo(d.x, d.y - cfg.len);
        cx.lineTo(d.x + slant * cfg.len, d.y);
      }
      cx.stroke();
    }
    // soft atmospheric wash so rainy scenes read cooler and unified
    const wash = cx.createLinearGradient(0, 0, 0, G.waterY);
    wash.addColorStop(0, 'rgba(150,170,210,0.08)');
    wash.addColorStop(1, 'rgba(150,170,210,0.03)');
    cx.fillStyle = wash;
    cx.fillRect(0, 0, W, G.waterY);
    cx.restore();
  }
  // Cliff — pre-rendered once per scene/resize into an offscreen canvas:
  // strata, speckle grain, cracks, moss, rim-light and ambient occlusion.
  let cliffTex = null;
  function renderCliffTex() {
    const sc = game.scene; if (!sc || !W || !H) { cliffTex = null; return; }
    const [dark, mid, lite] = sc.rock;
    const oc = document.createElement('canvas');
    oc.width = Math.max(2, W); oc.height = Math.max(2, H);
    const g = oc.getContext('2d');
    const x = G.fallX, w = G.fallW, wallX = x + w;
    const rng = L.mulberry32(0xC11F ^ ((game.level ? game.level.level : 1) * 131));
    // --- wall silhouette (jagged left edge facing the fall) ---
    const edge = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const y = (i / segs) * (G.waterY + 30);
      edge.push({ x: wallX + (2 + rng() * 16) * S * (i % 2 ? 1.4 : 0.6), y });
    }
    const wallPath = () => {
      g.beginPath();
      g.moveTo(W, 0);
      g.lineTo(edge[0].x, 0);
      for (const p of edge) g.lineTo(p.x, p.y);
      g.lineTo(W, G.waterY + 30);
      g.closePath();
    };
    // base gradient
    wallPath();
    const wg = g.createLinearGradient(wallX, 0, W, 0);
    wg.addColorStop(0, mid); wg.addColorStop(0.55, dark); wg.addColorStop(1, shade(dark, -18));
    g.fillStyle = wg; g.fill();
    // strata bands (clipped to the wall)
    g.save(); wallPath(); g.clip();
    for (let i = 0; i < 11; i++) {
      const by = (i / 11) * (G.waterY + 30) + rng() * 14;
      const hgt = 10 + rng() * 26;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,' + (0.03 + rng() * 0.04) + ')' : 'rgba(8,6,24,' + (0.06 + rng() * 0.06) + ')';
      g.beginPath();
      g.moveTo(wallX - 10, by);
      g.quadraticCurveTo(wallX + (W - wallX) / 2, by + (rng() - 0.5) * 18, W, by + (rng() - 0.5) * 10);
      g.lineTo(W, by + hgt);
      g.quadraticCurveTo(wallX + (W - wallX) / 2, by + hgt + (rng() - 0.5) * 18, wallX - 10, by + hgt);
      g.closePath(); g.fill();
    }
    // speckle grain
    for (let i = 0; i < 320; i++) {
      const px2 = wallX + rng() * (W - wallX), py2 = rng() * (G.waterY + 28);
      g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,' + (0.04 + rng() * 0.06) + ')' : 'rgba(6,4,20,' + (0.06 + rng() * 0.08) + ')';
      const sz = 0.8 + rng() * 2.2;
      g.fillRect(px2, py2, sz, sz * (0.6 + rng()));
    }
    // cracks
    g.strokeStyle = 'rgba(12,8,30,0.4)';
    g.lineWidth = 1.3;
    for (let c2 = 0; c2 < 5; c2++) {
      let px2 = wallX + 6 + rng() * (W - wallX - 20), py2 = rng() * G.waterY * 0.7;
      g.beginPath(); g.moveTo(px2, py2);
      for (let s3 = 0; s3 < 5; s3++) {
        px2 += (rng() - 0.4) * 26; py2 += 18 + rng() * 30;
        g.lineTo(px2, py2);
      }
      g.stroke();
    }
    // rim light on the fall-facing edge (the water's glow catching the rock)
    g.strokeStyle = 'rgba(170,225,255,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(edge[0].x, 0);
    for (const p of edge) g.lineTo(p.x, p.y);
    g.stroke();
    g.strokeStyle = 'rgba(170,225,255,0.14)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(edge[0].x + 2, 0);
    for (const p of edge) g.lineTo(p.x + 2, p.y);
    g.stroke();
    g.restore();
    // --- overhanging source ledge ---
    const ledgeY = 34 * S;
    const lg = g.createLinearGradient(0, 0, 0, ledgeY + 26 * S);
    lg.addColorStop(0, lite); lg.addColorStop(1, dark);
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(x - 46 * S, 0);
    g.lineTo(W, 0);
    g.lineTo(W, ledgeY + 10 * S);
    g.lineTo(x + w + 8 * S, ledgeY + 14 * S);
    g.lineTo(x + w - 2 * S, ledgeY + 4 * S);
    g.lineTo(x + 2 * S, ledgeY + 6 * S);
    g.lineTo(x - 8 * S, ledgeY + 18 * S);
    g.lineTo(x - 30 * S, ledgeY + 8 * S);
    g.closePath(); g.fill();
    // ledge grain + underside occlusion shadow
    for (let i = 0; i < 60; i++) {
      const px2 = x - 44 * S + rng() * (W - x + 44 * S), py2 = rng() * (ledgeY + 8 * S);
      g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(8,6,24,0.1)';
      g.fillRect(px2, py2, 1 + rng() * 2.4, 1 + rng() * 1.6);
    }
    const ao = g.createLinearGradient(0, ledgeY + 2 * S, 0, ledgeY + 30 * S);
    ao.addColorStop(0, 'rgba(6,4,22,0.4)');
    ao.addColorStop(1, 'rgba(6,4,22,0)');
    g.fillStyle = ao;
    g.fillRect(x - 40 * S, ledgeY + 2 * S, W - x + 40 * S, 28 * S);
    // moss clumps along the lip and dotted down the wall
    for (let i = 0; i < 26; i++) {
      const onLip = i < 14;
      const mx = onLip ? x - 26 * S + rng() * (w + 60 * S) : wallX + rng() * (W - wallX) * 0.5;
      const my = onLip ? ledgeY + (6 + rng() * 8) * S : rng() * G.waterY;
      const mr = (2 + rng() * 4.5) * S;
      g.fillStyle = 'hsla(' + (105 + rng() * 40) + ',45%,' + (30 + rng() * 22) + '%,' + (0.35 + rng() * 0.3) + ')';
      g.beginPath(); g.arc(mx, my, mr, 0, 6.29); g.fill();
    }
    cliffTex = oc;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g2 = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g2 + ',' + b + ')';
  }
  function drawCliff(t) {
    const sc = game.scene; if (!sc) return;
    if (!cliffTex) renderCliffTex();
    if (cliffTex) cx.drawImage(cliffTex, 0, 0, W, H);
    // living water welling over the lip (animated, drawn on top of the texture)
    const x = G.fallX, w = G.fallW, ledgeY = 34 * S;
    const sg = cx.createLinearGradient(0, ledgeY - 4 * S, 0, ledgeY + 18 * S);
    sg.addColorStop(0, 'rgba(190,235,255,0.15)');
    sg.addColorStop(1, 'rgba(210,242,255,0.65)');
    cx.fillStyle = sg;
    cx.beginPath();
    cx.moveTo(x - 2 * S, ledgeY + 5 * S);
    cx.quadraticCurveTo(x + w / 2, ledgeY + (1 + Math.sin(t * 0.006)) * S, x + w + 1 * S, ledgeY + 4 * S);
    cx.lineTo(x + w, ledgeY + 16 * S);
    cx.lineTo(x, ledgeY + 16 * S);
    cx.closePath(); cx.fill();
    // glisten on the lip
    cx.strokeStyle = 'rgba(240,252,255,' + (0.3 + 0.2 * Math.sin(t * 0.004)) + ')';
    cx.lineWidth = 1.4;
    cx.beginPath();
    cx.moveTo(x + 2 * S, ledgeY + 6 * S);
    cx.quadraticCurveTo(x + w / 2, ledgeY + 2 * S, x + w - 2 * S, ledgeY + 5 * S);
    cx.stroke();
  }

  // ============================== Ambient world (visual only — no gameplay physics) ==============================
  const fish = [], gusts = [], mist = [], foamBlobs = [], fireflies = [], motes = [], spires = [], drops = [];
  let nextGust = 3;
  const FISH_HUES = [16, 36, 200, 320, 168];
  // ============================== Seabed ==============================
  const seabed = { dunes: [], plants: [], rocks: [], coral: [], shells: [], vents: [], vbubs: [] };
  function initSeabed() {
    const key = (game.scene && game.scene.sea) || 'sandflats';
    const S2 = SEAS[key] || SEAS.sandflats;
    const rng = L.mulberry32(0x5EABED ^ ((game.level ? game.level.level : 1) * 40503));
    const floorY = H - Math.max(26, (H - G.waterY) * 0.34);
    seabed.def = S2; seabed.floorY = floorY;
    seabed.dunes.length = 0;
    for (let i = 0; i <= 26; i++) {
      seabed.dunes.push({ x: (i / 26) * W, y: floorY + Math.sin(i * 0.7 + rng() * 2) * (H - G.waterY) * 0.06 });
    }
    seabed.plants.length = 0;
    for (let i = 0; i < S2.plantN; i++) {
      seabed.plants.push({
        x: rng() * W, h: (H - floorY) * S2.plantH * (0.6 + rng() * 0.9),
        w: (2 + rng() * 3) * S, ph: rng() * 6.28, sway: 0.5 + rng() * 0.9,
        blades: 2 + Math.floor(rng() * 3), hue: -12 + rng() * 24,
      });
    }
    seabed.rocks.length = 0;
    for (let i = 0; i < S2.rocks; i++) {
      seabed.rocks.push({ x: rng() * W, r: (10 + rng() * 26) * S, sq: 0.5 + rng() * 0.4, tone: rng() });
    }
    seabed.coral.length = 0;
    for (let i = 0; i < S2.coral; i++) {
      seabed.coral.push({ x: rng() * W, h: (14 + rng() * 26) * S, hue: 330 + rng() * 60, arms: 3 + Math.floor(rng() * 3), ph: rng() * 6.28 });
    }
    seabed.shells.length = 0;
    for (let i = 0; i < S2.shells; i++) {
      seabed.shells.push({ x: rng() * W, r: (3 + rng() * 4) * S, kind: Math.floor(rng() * 3), rot: rng() * 6.28, hue: 20 + rng() * 40 });
    }
    seabed.vents.length = 0;
    for (let i = 0; i < S2.vents; i++) seabed.vents.push({ x: rng() * W, t: rng() * 2 });
    seabed.vbubs.length = 0;
  }

  function seabedY(x) {
    if (!seabed.dunes.length) return H - 30;
    const f = Math.max(0, Math.min(0.999, x / W)) * (seabed.dunes.length - 1);
    const i = Math.floor(f), fr = f - i;
    const a = seabed.dunes[i], b = seabed.dunes[Math.min(seabed.dunes.length - 1, i + 1)];
    return a.y + (b.y - a.y) * fr;
  }

  function stepSeabed(dt, t) {
    for (const v of seabed.vents) {
      v.t -= dt;
      if (v.t <= 0) {
        v.t = 0.25 + Math.random() * 0.7;
        seabed.vbubs.push({ x: v.x + (Math.random() - 0.5) * 8 * S, y: seabedY(v.x), r: (1.5 + Math.random() * 2.5) * S, ph: Math.random() * 6.28 });
      }
    }
    for (let i = seabed.vbubs.length - 1; i >= 0; i--) {
      const b = seabed.vbubs[i];
      b.y -= (26 + b.r * 4) * dt; b.ph += dt * 3;
      b.x += Math.sin(b.ph) * 8 * dt;
      if (b.y < G.waterY + 4) seabed.vbubs.splice(i, 1);
    }
  }

  function drawSeabed(t) {
    if (!seabed.dunes.length) return;
    const d = seabed.def || SEAS.sandflats;
    // floor
    cx.save();
    cx.beginPath();
    cx.moveTo(0, H);
    cx.lineTo(0, seabed.dunes[0].y);
    for (const p of seabed.dunes) cx.lineTo(p.x, p.y);
    cx.lineTo(W, H);
    cx.closePath();
    const g = cx.createLinearGradient(0, seabed.floorY - 10, 0, H);
    g.addColorStop(0, d.floor[0]); g.addColorStop(1, d.floor[1]);
    cx.fillStyle = g; cx.fill();
    // ripple texture in the sand
    cx.globalAlpha = 0.16;
    cx.strokeStyle = '#ffffff'; cx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      cx.beginPath();
      for (let x = 0; x <= W; x += 26) {
        const y = seabedY(x) + 6 + i * ((H - seabed.floorY) / 10) + Math.sin(x * 0.02 + i) * 2;
        x ? cx.lineTo(x, y) : cx.moveTo(x, y);
      }
      cx.stroke();
    }
    cx.globalAlpha = 1;
    cx.restore();

    // rocks
    for (const r of seabed.rocks) {
      const y = seabedY(r.x);
      cx.fillStyle = 'rgba(' + Math.round(70 + r.tone * 50) + ',' + Math.round(80 + r.tone * 45) + ',' + Math.round(95 + r.tone * 40) + ',0.92)';
      cx.beginPath();
      cx.ellipse(r.x, y + r.r * 0.15, r.r, r.r * r.sq, 0, Math.PI, 0);
      cx.fill();
      cx.fillStyle = 'rgba(255,255,255,0.10)';
      cx.beginPath();
      cx.ellipse(r.x - r.r * 0.3, y - r.r * 0.25, r.r * 0.4, r.r * r.sq * 0.35, -0.4, 0, 6.29);
      cx.fill();
    }
    // shells + starfish
    for (const sh of seabed.shells) {
      const y = seabedY(sh.x) + 2;
      cx.save(); cx.translate(sh.x, y); cx.rotate(sh.rot * 0.2);
      if (sh.kind === 2) { // starfish
        cx.fillStyle = 'hsla(' + (12 + sh.hue * 0.2) + ',75%,64%,0.95)';
        cx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * 6.28 - 1.57, rr = i % 2 ? sh.r * 0.45 : sh.r * 1.5;
          i ? cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.6) : cx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.6);
        }
        cx.closePath(); cx.fill();
      } else {
        cx.fillStyle = 'hsla(' + sh.hue + ',55%,82%,0.95)';
        cx.beginPath(); cx.ellipse(0, 0, sh.r * 1.4, sh.r, 0, Math.PI, 0); cx.fill();
        cx.strokeStyle = 'rgba(150,120,90,0.5)'; cx.lineWidth = 0.8;
        for (let i = 1; i < 4; i++) {
          cx.beginPath(); cx.ellipse(0, 0, sh.r * 1.4 * (i / 4), sh.r * (i / 4), 0, Math.PI, 0); cx.stroke();
        }
      }
      cx.restore();
    }
    // coral
    for (const c of seabed.coral) {
      const y = seabedY(c.x);
      cx.strokeStyle = 'hsla(' + c.hue + ',70%,66%,0.9)';
      cx.lineCap = 'round';
      for (let a = 0; a < c.arms; a++) {
        const off = (a - (c.arms - 1) / 2) * 0.5;
        cx.lineWidth = 4 * S;
        cx.beginPath();
        cx.moveTo(c.x, y);
        cx.quadraticCurveTo(c.x + off * c.h * 0.5 + Math.sin(t * 0.001 + c.ph) * 3, y - c.h * 0.6, c.x + off * c.h, y - c.h);
        cx.stroke();
      }
      cx.lineCap = 'butt';
    }
    // plants — seaweed / kelp, swaying with the current
    for (const p of seabed.plants) {
      const y = seabedY(p.x);
      for (let b = 0; b < p.blades; b++) {
        const lean = Math.sin(t * 0.0011 * p.sway + p.ph + b) * (18 + p.h * 0.10);
        const bx = p.x + (b - (p.blades - 1) / 2) * 4 * S;
        cx.strokeStyle = 'hsla(' + (120 + p.hue) + ',45%,' + (30 + b * 4) + '%,0.9)';
        cx.lineWidth = p.w * (1 - b * 0.12);
        cx.lineCap = 'round';
        cx.beginPath();
        cx.moveTo(bx, y);
        cx.bezierCurveTo(bx + lean * 0.2, y - p.h * 0.4, bx + lean * 0.8, y - p.h * 0.7, bx + lean, y - p.h);
        cx.stroke();
      }
      cx.lineCap = 'butt';
    }
    // vent bubbles
    cx.fillStyle = 'rgba(220,245,255,0.55)';
    for (const b of seabed.vbubs) {
      cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, 6.29); cx.fill();
    }
  }

  // ============================== Shark (friendly) ==============================
  // Appears now and then, cruises through, and everyone gets away. Never eats a fish;
  // there is no collision at all — the fish just decide they have somewhere else to be.
  const shark = { state: 'away', x: 0, y: 0, dir: 1, sp: 0, t: 0, next: 14, ph: 0, grin: 0 };
  function stepShark(dt) {
    if (game.mode !== 'play' && game.mode !== 'grace') return;
    if (shark.state === 'away') {
      shark.next -= dt;
      if (shark.next <= 0) {
        shark.state = 'cruise';
        shark.dir = Math.random() < 0.5 ? 1 : -1;
        shark.x = shark.dir > 0 ? -140 * S : W + 140 * S;
        shark.y = G.waterY + (H - G.waterY) * (0.35 + Math.random() * 0.35);
        shark.sp = (70 + Math.random() * 40) * S;
        shark.ph = 0; shark.grin = 0;
        game.round.sharkSeen = 1;
        AudioFX.shark();
        popup(W * 0.5, G.waterY - 40, '\u{1F988} a curious visitor!', 'big');
      }
      return;
    }
    shark.ph += dt * 2.2;
    shark.x += shark.dir * shark.sp * dt;
    shark.y += Math.sin(shark.ph * 0.5) * 10 * dt;
    shark.grin = Math.min(1, shark.grin + dt * 2);
    if (shark.x < -220 * S || shark.x > W + 220 * S) {
      shark.state = 'away';
      shark.next = 22 + Math.random() * 26;
    }
  }
  function drawShark(t) {
    if (shark.state !== 'cruise') return;
    const s2 = 26 * S;
    cx.save();
    cx.translate(shark.x, shark.y);
    cx.scale(shark.dir, 1);
    cx.globalAlpha = 0.94;
    // body
    const bg2 = cx.createLinearGradient(0, -s2, 0, s2);
    bg2.addColorStop(0, '#8fa8c4'); bg2.addColorStop(0.55, '#6d87a8'); bg2.addColorStop(1, '#dfe9f3');
    cx.fillStyle = bg2;
    cx.beginPath();
    cx.moveTo(-s2 * 2.6, 0);
    cx.quadraticCurveTo(-s2 * 1.2, -s2 * 0.95, s2 * 1.5, -s2 * 0.42);
    cx.quadraticCurveTo(s2 * 2.3, 0, s2 * 1.5, s2 * 0.42);
    cx.quadraticCurveTo(-s2 * 1.2, s2 * 0.95, -s2 * 2.6, 0);
    cx.closePath(); cx.fill();
    // tail
    const tail = Math.sin(shark.ph) * 0.35;
    cx.save(); cx.translate(-s2 * 2.5, 0); cx.rotate(tail);
    cx.fillStyle = '#7b93b3';
    cx.beginPath();
    cx.moveTo(0, 0); cx.lineTo(-s2 * 1.1, -s2 * 0.95); cx.lineTo(-s2 * 0.55, 0); cx.lineTo(-s2 * 1.1, s2 * 0.8);
    cx.closePath(); cx.fill();
    cx.restore();
    // dorsal + pectoral
    cx.fillStyle = '#7b93b3';
    cx.beginPath(); cx.moveTo(-s2 * 0.2, -s2 * 0.78); cx.lineTo(s2 * 0.25, -s2 * 1.7); cx.lineTo(s2 * 0.6, -s2 * 0.62); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(s2 * 0.3, s2 * 0.5); cx.lineTo(s2 * 0.1, s2 * 1.3); cx.lineTo(s2 * 0.95, s2 * 0.34); cx.closePath(); cx.fill();
    // big friendly eye
    cx.fillStyle = '#ffffff';
    cx.beginPath(); cx.arc(s2 * 1.05, -s2 * 0.24, s2 * 0.30, 0, 6.29); cx.fill();
    cx.fillStyle = '#16213c';
    cx.beginPath(); cx.arc(s2 * 1.12, -s2 * 0.22, s2 * 0.17, 0, 6.29); cx.fill();
    cx.fillStyle = '#ffffff';
    cx.beginPath(); cx.arc(s2 * 1.19, -s2 * 0.30, s2 * 0.07, 0, 6.29); cx.fill();
    // a smile, not a maw
    cx.strokeStyle = '#33465f'; cx.lineWidth = 2 * S; cx.lineCap = 'round';
    cx.beginPath();
    cx.arc(s2 * 1.18, s2 * 0.12, s2 * 0.42, 0.25, 1.25);
    cx.stroke();
    cx.lineCap = 'butt';
    // cheeks
    cx.fillStyle = 'rgba(255,150,170,0.35)';
    cx.beginPath(); cx.arc(s2 * 0.85, s2 * 0.22, s2 * 0.20, 0, 6.29); cx.fill();
    cx.restore();
  }

  function initAmbient() {
    const rng = Math.random;
    fish.length = 0;
    const nf = 5;
    for (let i = 0; i < nf; i++) {
      fish.push({
        x: W * 0.06 + rng() * (G.fallX - W * 0.12),
        y: G.waterY + 26 + rng() * Math.max(30, (H - G.waterY) * 0.5),
        dir: rng() < 0.5 ? -1 : 1, sp: 20 + rng() * 34, ph: rng() * 6.28,
        size: (7 + rng() * 6) * S, hue: FISH_HUES[i % FISH_HUES.length],
        leap: 0, vy: 0, baseY: 0,
      });
    }
    fireflies.length = 0;
    for (let i = 0; i < 8; i++) fireflies.push({ x: W * 0.02 + rng() * W * 0.3, y: G.waterY - 20 - rng() * 130, ph: rng() * 6.28, sp: 0.4 + rng() * 0.8 });
    foamBlobs.length = 0;
    const lastTier = TIERS.length ? TIERS[TIERS.length - 1] : null;
    for (let i = 0; i < 14; i++) foamBlobs.push({ x: (lastTier ? lastTier.x + rng() * lastTier.w : G.fallX), r: (3 + rng() * 9) * S, ph: rng() * 6.28 });
    motes.length = 0;
    for (let i = 0; i < 36; i++) motes.push({ x: rng() * W, y: rng() * G.waterY, sp: 3 + rng() * 8, ph: rng() * 6.28, s: 0.8 + rng() * 1.6 });
    spires.length = 0;
    const srng = L.mulberry32(0xA17A);
    for (let i = 0; i < 9; i++) spires.push({ x: srng(), w: 0.03 + srng() * 0.06, h: 0.12 + srng() * 0.22, layer: 0, tilt: (srng() - 0.5) * 0.14 });
    for (let i = 0; i < 6; i++) spires.push({ x: srng(), w: 0.025 + srng() * 0.05, h: 0.08 + srng() * 0.15, layer: 1, tilt: (srng() - 0.5) * 0.1 });
    mist.length = 0; gusts.length = 0; drops.length = 0;
  }

  function stepAmbient(dt, t) {
    // wind gusts — purely visual streaks
    nextGust -= dt;
    if (nextGust <= 0 && !game.reduceFx) {
      nextGust = 4 + Math.random() * 6;
      const fromLeft = Math.random() < 0.7;
      gusts.push({
        x: fromLeft ? -80 : W + 80, dir: fromLeft ? 1 : -1,
        y: H * (0.08 + Math.random() * 0.4), amp: 10 + Math.random() * 22,
        speed: 260 + Math.random() * 180, age: 0, life: (W + 400) / 300,
        wl: 90 + Math.random() * 70,
      });
      if (Math.random() < 0.4) gusts.push({
        x: fromLeft ? -180 : W + 180, dir: fromLeft ? 1 : -1,
        y: H * (0.12 + Math.random() * 0.4), amp: 8 + Math.random() * 16,
        speed: 300 + Math.random() * 160, age: 0, life: (W + 500) / 320, wl: 120,
      });
    }
    for (let i = gusts.length - 1; i >= 0; i--) {
      const g = gusts[i];
      g.age += dt; g.x += g.dir * g.speed * dt;
      if (g.age > g.life || g.x < -420 || g.x > W + 420) gusts.splice(i, 1);
    }
    // fish
    for (const f of fish) {
      if (f.leap) {
        f.vy += 620 * dt; f.y += f.vy * dt; f.x += f.dir * f.sp * 2.2 * dt;
        if (f.y >= f.baseY) {
          f.y = f.baseY; f.leap = 0;
          disturbWater(f.x, 4);
          spawnParts(7, f.x, G.waterY, { dir: -Math.PI / 2, spread: 0.9, speed: 130, hue: 195, life: 0.5, size: 2, grav: 520 });
        }
      } else {
        // Shark nearby? Turn tail and bolt for the far end and the surface. The shark has no
        // collision and no appetite — panic is the whole interaction, and it always works.
        if (shark.state === 'cruise') {
          const dx = f.x - shark.x;
          const dist = Math.hypot(dx, f.y - shark.y);
          if (dist < 340 * S) {
            f.panic = Math.max(f.panic || 0, 1.6);
            f.dir = dx >= 0 ? 1 : -1;
            f.y -= 26 * dt * (1 - dist / (340 * S)) * 4; // rise toward the surface
            if (!game.reduceFx && Math.random() < 0.05) {
              spawnParts(1, f.x, f.y, { hue: 195, speed: 30, life: 0.5, size: 1.4, grav: -40 });
            }
          }
        }
        const panicking = (f.panic || 0) > 0;
        if (panicking) f.panic -= dt;
        const sp = f.sp * (panicking ? 3.1 : 1);
        f.ph += dt * (panicking ? 9 : 3);
        f.x += f.dir * sp * dt;
        f.y += Math.sin(f.ph) * 6 * dt;
        const minX = W * 0.03, maxX = G.fallX - 30;
        if (f.x < minX) { f.x = minX; f.dir = 1; }
        if (f.x > maxX) { f.x = maxX; f.dir = -1; }
        const minY = G.waterY + 16, maxY = H - 24;
        f.y = Math.max(minY, Math.min(maxY, f.y));
        // a panicked fish is much more likely to break the surface entirely
        const leapChance = panicking ? 0.02 : 0.0011;
        if (!game.reduceFx && Math.random() < leapChance && f.y < G.waterY + (panicking ? 150 : 70)) {
          f.leap = 1; f.baseY = f.y; f.vy = -(240 + Math.random() * 130) * (panicking ? 1.25 : 1);
          game.save.c.leaps++;
          disturbWater(f.x, 3);
        }
      }
    }
    // waterfall droplets (streak sprites)
    // droplets peel off whichever step they were born on, and die on the step below —
    // a droplet falling the full height would contradict the terraces.
    if (!game.reduceFx && TIERS.length) for (let i = 0; i < 3; i++) {
      if (drops.length >= 80) break;
      const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
      drops.push({
        x: tier.x + Math.random() * tier.w,
        y: tier.y0 + Math.random() * (tier.y1 - tier.y0) * 0.4,
        vy: 150 + Math.random() * 180,            // gentler than v1.3.0's 480-780
        len: 7 + Math.random() * 10,
        floor: tier.y1,
      });
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += 240 * dt; d.y += d.vy * dt;
      if (d.y > (d.floor || G.waterY)) {
        drops.splice(i, 1);
        if (Math.random() < 0.12) disturbWater(d.x, 0.7);
      }
    }
    // mist at waterfall base
    if (mist.length < 46 && Math.random() < 0.6 && TIERS.length) {
      // mist rises off every ledge, not only the plunge pool
      const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
      mist.push({
        x: tier.x + Math.random() * tier.w, y: tier.y1 - 4,
        r: (6 + Math.random() * 10) * S,
        vx: -(6 + Math.random() * 14), vy: -(10 + Math.random() * 18),
        age: 0, life: 1.8 + Math.random() * 1.6,
      });
    }
    for (let i = mist.length - 1; i >= 0; i--) {
      const m = mist[i];
      m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.r += 9 * dt;
      if (m.age > m.life) mist.splice(i, 1);
    }
    // fireflies + motes + clouds + rain
    for (const ff of fireflies) { ff.ph += dt * ff.sp; ff.x += Math.sin(ff.ph * 0.7) * 12 * dt; ff.y += Math.cos(ff.ph) * 9 * dt; }
    for (const m of motes) { m.ph += dt; m.x += m.sp * dt * 0.4; m.y += Math.sin(m.ph) * 3 * dt; if (m.x > W + 4) m.x = -4; }
    for (const cl of clouds) { cl.x += cl.sp * dt; if (cl.x - 160 * cl.sc > W) cl.x = -170 * cl.sc; }
    stepRain(dt);
    stepSeabed(dt, t);
    stepShark(dt);
  }

  function drawGlint(x, y, r, alpha, hue) {
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = alpha;
    cx.strokeStyle = hue !== undefined ? 'hsla(' + hue + ',90%,80%,1)' : 'rgba(255,255,255,1)';
    cx.lineWidth = 1.3;
    cx.beginPath();
    cx.moveTo(x - r, y); cx.lineTo(x + r, y);
    cx.moveTo(x, y - r); cx.lineTo(x, y + r);
    cx.moveTo(x - r * 0.45, y - r * 0.45); cx.lineTo(x + r * 0.45, y + r * 0.45);
    cx.moveTo(x + r * 0.45, y - r * 0.45); cx.lineTo(x - r * 0.45, y + r * 0.45);
    cx.stroke();
    cx.restore();
  }

  function drawFish(f, t, submerged) {
    cx.save();
    cx.translate(f.x, f.y);
    cx.scale(f.dir, 1);
    cx.globalAlpha = submerged ? 0.8 : 1;
    const s2 = f.size;
    const flap = Math.sin(t * 0.012 + f.ph) * 0.5;
    // tail
    cx.fillStyle = 'hsla(' + f.hue + ',75%,68%,0.95)';
    cx.beginPath();
    cx.moveTo(-s2 * 0.9, 0);
    cx.lineTo(-s2 * 1.7, -s2 * 0.62 + flap * s2 * 0.5);
    cx.lineTo(-s2 * 1.7, s2 * 0.62 + flap * s2 * 0.5);
    cx.closePath(); cx.fill();
    // body
    const bg2 = cx.createLinearGradient(0, -s2, 0, s2);
    bg2.addColorStop(0, 'hsla(' + f.hue + ',85%,78%,1)');
    bg2.addColorStop(1, 'hsla(' + f.hue + ',70%,58%,1)');
    cx.fillStyle = bg2;
    cx.beginPath(); cx.ellipse(0, 0, s2 * 1.1, s2 * 0.72, 0, 0, 6.29); cx.fill();
    // belly shine
    cx.fillStyle = 'rgba(255,255,255,0.35)';
    cx.beginPath(); cx.ellipse(s2 * 0.1, -s2 * 0.22, s2 * 0.66, s2 * 0.26, -0.3, 0, 6.29); cx.fill();
    // fin
    cx.fillStyle = 'hsla(' + f.hue + ',75%,70%,0.9)';
    cx.beginPath();
    cx.moveTo(0, s2 * 0.2); cx.lineTo(-s2 * 0.35, s2 * 0.85 + flap * s2 * 0.3); cx.lineTo(s2 * 0.35, s2 * 0.4);
    cx.closePath(); cx.fill();
    // eye + blush (cute!)
    cx.fillStyle = '#1c2340';
    cx.beginPath(); cx.arc(s2 * 0.62, -s2 * 0.14, Math.max(1.4, s2 * 0.15), 0, 6.29); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,0.9)';
    cx.beginPath(); cx.arc(s2 * 0.66, -s2 * 0.19, Math.max(0.6, s2 * 0.055), 0, 6.29); cx.fill();
    cx.fillStyle = 'hsla(350,80%,75%,0.5)';
    cx.beginPath(); cx.arc(s2 * 0.52, s2 * 0.18, s2 * 0.14, 0, 6.29); cx.fill();
    cx.restore();
  }

  function drawAmbientSky(t) {
    // far crystal spires (two parallax depths) — depth layer, tinted by scene
    const spireCols = game.scene ? game.scene.spire : SCENE_TUNE.night.spire;
    for (const layer of [0, 1]) {
      cx.fillStyle = spireCols[layer];
      cx.beginPath();
      for (const sp of spires) {
        if (sp.layer !== layer) continue;
        const bx = sp.x * W, bw = sp.w * W * (layer ? 0.9 : 1.15), bh = sp.h * H * (layer ? 0.8 : 1);
        cx.moveTo(bx - bw / 2, G.waterY + 4);
        cx.lineTo(bx + bw * sp.tilt, G.waterY - bh);
        cx.lineTo(bx + bw / 2, G.waterY + 4);
      }
      cx.fill();
    }
    // aurora ribbons — additive, night only
    const auroraA = game.scene ? game.scene.aurora : 1;
    if (auroraA < 0.05) return drawMotes();
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    for (let rib = 0; rib < 2; rib++) {
      const baseY = H * (0.1 + rib * 0.07);
      const hueA = rib ? 280 : 160;
      for (let pass = 0; pass < 3; pass++) {
        cx.globalAlpha = (game.reduceFx ? 0.03 : 0.05) * (3 - pass);
        cx.lineWidth = 18 + pass * 16;
        cx.strokeStyle = 'hsla(' + hueA + ',80%,65%,1)';
        cx.beginPath();
        for (let x = -20; x <= W + 20; x += 36) {
          const y = baseY + Math.sin(x * 0.004 + t * 0.00035 + rib * 2) * 26 + Math.sin(x * 0.011 - t * 0.0002) * 12;
          x === -20 ? cx.moveTo(x, y) : cx.lineTo(x, y);
        }
        cx.stroke();
      }
    }
    cx.globalAlpha = 1;
    cx.restore();
    drawMotes();
  }
  function drawMotes() {
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      cx.globalAlpha = 0.12 + 0.1 * Math.sin(m.ph * 2);
      cx.fillStyle = '#cfe0ff';
      cx.beginPath(); cx.arc(m.x, m.y, m.s, 0, 6.29); cx.fill();
    }
    cx.globalAlpha = 1;
    cx.restore();
  }

  function drawWind(t) {
    cx.save();
    cx.lineCap = 'round';
    for (const g of gusts) {
      const fadeIn = Math.min(1, g.age * 2);
      const fadeOut = Math.max(0, Math.min(1, (g.life - g.age) * 1.5));
      cx.globalAlpha = 0.28 * fadeIn * fadeOut;
      cx.strokeStyle = 'rgba(220,235,255,1)';
      cx.lineWidth = 1.6;
      cx.beginPath();
      const segs = 26;
      for (let i2 = 0; i2 <= segs; i2++) {
        const px = g.x - g.dir * i2 * 13;
        const py = g.y + Math.sin((g.x - g.dir * i2 * 13) / g.wl + g.age * 2) * g.amp * (1 - i2 / segs * 0.4);
        i2 === 0 ? cx.moveTo(px, py) : cx.lineTo(px, py);
      }
      cx.stroke();
      // little curl at the head
      cx.beginPath();
      cx.arc(g.x, g.y + Math.sin(g.x / g.wl + g.age * 2) * g.amp, 7, Math.PI * 0.2, Math.PI * 1.5);
      cx.stroke();
    }
    cx.restore();
    cx.globalAlpha = 1;
  }

  function drawFireflies(t) {
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    for (const ff of fireflies) {
      const a = 0.25 + 0.55 * Math.max(0, Math.sin(ff.ph * 1.7));
      const gr = cx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, 7);
      gr.addColorStop(0, 'rgba(255,240,160,' + a + ')');
      gr.addColorStop(1, 'rgba(255,240,160,0)');
      cx.fillStyle = gr;
      cx.beginPath(); cx.arc(ff.x, ff.y, 7, 0, 6.29); cx.fill();
    }
    cx.restore();
  }

  function drawVignette() {
    const vg = cx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.42, W / 2, H * 0.52, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(5,6,25,0)');
    vg.addColorStop(1, 'rgba(5,6,25,0.42)');
    cx.fillStyle = vg;
    cx.fillRect(0, 0, W, H);
  }

  function crystalPoly(c) {
    // elongated hexagon (prism), pre-scaled
    const r = 26 * c.size * S, e = 1.45;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      pts.push({ x: c.px + Math.cos(a) * r, y: c.py + Math.sin(a) * r * e });
    }
    return pts;
  }
  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function circleHitsCrystal(x, y, r, c) {
    const poly = crystalPoly(c);
    if (pointInPoly(x, y, poly)) return true;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
      const cxp = a.x + t * dx, cyp = a.y + t * dy;
      if ((x - cxp) ** 2 + (y - cyp) ** 2 < r * r) return true;
    }
    return false;
  }

  // ============================== Particles / juice ==============================
  function spawnParts(n, x, y, opts) {
    if (game.reduceFx) n = Math.max(1, Math.round(n / 3));
    for (let i = 0; i < n; i++) {
      if (parts.length >= MAXP) parts.shift();
      const a = (opts.dir !== undefined) ? opts.dir + (Math.random() - 0.5) * (opts.spread || 1.2) : Math.random() * Math.PI * 2;
      const sp = (opts.speed || 120) * (0.4 + Math.random() * 0.9);
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
        life: (opts.life || 0.7) * (0.6 + Math.random() * 0.8), age: 0,
        size: (opts.size || 2.5) * (0.6 + Math.random() * 0.9),
        hue: opts.hue !== undefined ? opts.hue + (Math.random() - 0.5) * 30 : 200,
        grav: opts.grav !== undefined ? opts.grav : 300,
        glow: !!opts.glow, spark: !!opts.spark,
      });
    }
  }
  function popup(x, y, text, cls) {
    popups.push({ x, y, text, cls: cls || '', age: 0, life: 1.2 });
  }
  function launchFirework(x, y, hue) {
    fireworks.push({ x, y: H + 10, tx: x, ty: y, hue, phase: 0, vx: 0, vy: -(520 + Math.random() * 200), age: 0 });
  }
  function stepFireworks(dt) {
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const f = fireworks[i];
      if (f.phase === 0) {
        f.y += f.vy * dt; f.vy += 300 * dt;
        spawnParts(1, f.x, f.y, { hue: f.hue, speed: 20, life: 0.3, size: 2, glow: true, grav: 0 });
        if (f.y <= f.ty || f.vy > -60) {
          f.phase = 1;
          AudioFX.shatter(1.3, 900, f.hue);
          spawnParts(70, f.x, f.y, { hue: f.hue, speed: 260, life: 1.4, size: 2.8, glow: true, spark: true, grav: 90 });
          spawnParts(20, f.x, f.y, { hue: (f.hue + 40) % 360, speed: 120, life: 1.8, size: 2, glow: true, grav: 60 });
          fireworks.splice(i, 1);
        }
      }
    }
  }

  let shake = 0;
  function addShake(v) { if (!game.reduceFx) shake = Math.min(18, shake + v); }

  // ============================== Game state ==============================
  const game = {
    mode: 'menu', // menu | play | grace | tally
    save: L.newSave(),
    stats: L.derivedStats({}),
    level: null,          // { level, layout, crystals }
    thresholds: null,     // { one, two, three, par }
    rules: null,          // from L.roundRules — duration, wind, fog, shots, scoreMult...
    challenge: '',        // '' = standard play
    roundScore: 0, banked: 0, lost: 0, combo: 0, bestCombo: 0,
    timeLeft: 30, duration: 30, started: false,
    shotsFired: 0, crystalsLeft: 0,
    aim: { x: 0, y: 0, down: false },
    lastTick: 0, graceT: 0,
    reduceFx: false,
    // charge state for press-and-hold volleys
    charge: { active: false, t: 0, start: 0, handle: null },
    // one-round-only effects from consumables
    fx: { storm: 0, still: 0, golden: 0 },
    // per-round tally, handed to the achievement evaluator at round end
    round: {
      chain: 0, bestChain: 0, goldens: 0, popped: 0, wastedOrbs: 0,
      mirrorShots: 0, chargeShots: 0, itemsUsed: 0, shattered: 0, sharkSeen: 0,
      wasAbandoned: false,
    },
  };
  // levels the player walked away from — feeds the 'Comeback' achievement
  const abandoned = Object.create(null);

  function loadLevel(n, mode) {
    // A round-end panel left open would sit over the new board and swallow every click.
    // Every in-game path closes it first; this is the guard for the ones that forget.
    if (ui.els && ui.els.panels && ui.els.panels.dataset.kind === 'end') ui.closePanels();
    const def = L.genLevel(n);
    const ch = L.challengeById(mode) ? mode : '';
    game.level = def;
    game.challenge = ch;
    game.rules = L.roundRules(n, ch, game.stats);
    game.thresholds = L.starThresholds(n, ch);
    game.scene = sceneFor(n);
    renderCliffTex();
    initRain();
    initSeabed();
    crystals.length = 0; orbs.length = 0; shards.length = 0; bubbles.length = 0; popups.length = 0;
    for (const c of def.crystals) {
      crystals.push({
        ...c,
        px: (c.x) * W, py: (c.y) * H,
        maxHp: c.hp, flash: 0, wobble: Math.random() * 6.28,
        // Fogbank: a crystal stays hidden until something touches it
        seen: game.rules.fog ? 0 : 1,
      });
    }
    game.crystalsLeft = crystals.length;
    game.roundScore = 0; game.banked = 0; game.lost = 0; game.combo = 0; game.bestCombo = 0;
    game.duration = game.rules.duration;
    game.timeLeft = game.duration;
    game.started = false; game.shotsFired = 0;
    game.fx.storm = 0; game.fx.still = 0; game.fx.golden = 0;
    game.round = {
      chain: 0, bestChain: 0, goldens: 0, popped: 0, wastedOrbs: 0,
      mirrorShots: 0, chargeShots: 0, itemsUsed: 0, shattered: 0, sharkSeen: 0,
      wasAbandoned: !!abandoned[n + ':' + ch],
    };
    cancelCharge();
    shark.state = 'away'; shark.next = 10 + Math.random() * 14;
    game.mode = 'play';
    if (AX) AX.startMusic(game.scene, n);
    ui.syncHud();
    ui.syncItems();
  }

  // ============================== Shooting ==============================
  // Press-and-hold power. v1.3.0 derived launch speed from CURSOR DISTANCE, which meant a
  // prism you had to aim at steeply — anything high or far right — was simply unreachable:
  // aiming at it put the cursor close to the launcher, which cut the power. Charge time and
  // aim direction are now independent, so every prism on the board can be hit.
  const CHARGE_TIME = 0.85;              // seconds to full power
  const SPEED_MIN = 620, SPEED_MAX = 1750;

  function chargeLevel() {
    return Math.max(0, Math.min(1, game.charge.t / CHARGE_TIME));
  }
  function beginCharge() {
    if (game.mode !== 'play') return;
    if (game.rules && game.shotsFired >= game.rules.shots) { AudioFX.deny(); return; }
    game.charge.active = true;
    game.charge.t = 0;
    game.charge.start = performance.now();
    if (AX && !game.charge.handle) game.charge.handle = AudioFX.charge();
  }
  function cancelCharge() {
    game.charge.active = false;
    game.charge.t = 0;
    if (game.charge.handle) { try { game.charge.handle.stop(); } catch (e) {} game.charge.handle = null; }
  }
  function releaseCharge(tx, ty) {
    if (!game.charge.active) return;
    const p = chargeLevel();
    cancelCharge();
    fireVolley(tx, ty, p);
  }

  function fireVolley(tx, ty, power) {
    if (game.mode !== 'play') return;
    if (game.rules && game.shotsFired >= game.rules.shots) { AudioFX.deny(); return; }
    if (!game.started) { game.started = true; }
    const st = game.stats;
    const p = Math.max(0, Math.min(1, power === undefined ? 0.55 : power));
    const dx = tx - G.launch.x, dy = ty - G.launch.y;
    const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * p;
    const baseA = Math.atan2(dy, dx);
    // Prism Storm doubles the volley for its remaining shots
    const n = st.orbsPerShot * (game.fx.storm > 0 ? 2 : 1);
    if (game.fx.storm > 0) game.fx.storm--;
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.085;
      orbs.push({
        x: G.launch.x, y: G.launch.y,
        vx: Math.cos(baseA + spread) * speed, vy: Math.sin(baseA + spread) * speed,
        r: (8 + 3 * p) * S, age: 0, trail: 0, power: p, mirrored: 0,
      });
    }
    game.shotsFired++;
    if (p >= 0.97) { game.round.chargeShots++; game.save.c.maxCharge++; }
    game.save.c.shots++;
    AudioFX.shoot(p);
    addShake(1 + p * 3);
    spawnParts(8 + Math.round(p * 12), G.launch.x, G.launch.y,
      { dir: baseA, spread: 0.6, speed: 160 + p * 220, hue: 45, life: 0.4, size: 2 + p, glow: true, grav: 0 });
    ui.syncHud();
  }

  // ============================== Crystal damage ==============================
  function damageCrystal(c, dmg, fromX, fromY, impactSpeed) {
    c.hp -= dmg; c.flash = 1; c.seen = 1;
    // mass from the crystal's size and remaining structure; speed from the orb that hit it
    AudioFX.hit(c.size * (1 + (c.maxHp || 1) * 0.35), impactSpeed || 700, c.hue);
    spawnParts(6, c.px, c.py, { hue: c.hue, speed: 140, life: 0.5, size: 2.2, glow: true });
    if (c.hp <= 0) shatterCrystal(c, fromX, fromY);
  }
  function shatterCrystal(c, fromX, fromY) {
    const idx = crystals.indexOf(c);
    if (idx < 0) return;
    crystals.splice(idx, 1);
    game.crystalsLeft = crystals.length;
    game.round.shattered++;
    if (game.round.chain > game.round.bestChain) game.round.bestChain = game.round.chain;
    AudioFX.shatter(c.size * (1 + (c.maxHp || 1) * 0.5), 700 + (c.maxHp || 1) * 90, c.hue);
    addShake(4 + c.size * 2);
    spawnParts(34, c.px, c.py, { hue: c.hue, speed: 240, life: 0.9, size: 3, glow: true, spark: true });
    spawnParts(10, c.px, c.py, { hue: (c.hue + 40) % 360, speed: 90, life: 1.3, size: 1.8, glow: true, grav: 30 });
    // debris shards — these are what splash
    const n = 5 + Math.floor(Math.random() * 3) + (c.size > 1 ? 3 : 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 220;
      shards.push({
        x: c.px, y: c.py,
        vx: Math.cos(a) * sp + (c.px - fromX) * 0.3, vy: Math.sin(a) * sp - 80,
        r: (3.5 + Math.random() * 3.5) * S, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9,
        hue: c.hue, age: 0,
      });
    }
    // chain shatter — game.round.chain counts how many fell from one strike
    if (fromX !== undefined && !c.chained) game.round.chain = 1;
    if (game.stats.chainChance > 0) {
      for (const o of crystals.slice()) {
        const dd = Math.hypot(o.px - c.px, o.py - c.py);
        if (dd < 150 * S && Math.random() < game.stats.chainChance) {
          o.chained = 1;
          setTimeout(() => { if (crystals.includes(o)) { game.round.chain++; damageCrystal(o, 999, c.px, c.py, 900); } }, 90 + Math.random() * 140);
        }
      }
    }
  }

  // ============================== Splash → bubbles ==============================
  // Visual-only splash: for orbs sinking into water. Wasted shot — no bubbles, no points.
  function splashVisual(x, speed) {
    disturbWater(x, Math.min(12, 3 + speed / 260));
    AudioFX.splash(Math.min(1, speed / 900), true);
    spawnParts(8, x, G.waterY, { dir: -Math.PI / 2, spread: 1.0, speed: 150 + speed * 0.08, hue: 205, life: 0.55, size: 2.2, grav: 620, glow: true });
    popup(x, G.waterY - 14, 'plip!', 'lost');
  }

  function splashAt(x, speed, r) {
    const energy = Math.min(3.2, (speed / 640) * (r / (5 * S)) * game.stats.splashImpulse);
    disturbWater(x, Math.min(26, 6 + energy * 9));
    AudioFX.splash(energy, false);
    spawnParts(Math.round(8 + energy * 10), x, G.waterY, { dir: -Math.PI / 2, spread: 1.1, speed: 200 + energy * 90, hue: 195, life: 0.8, size: 2.6, grav: 620, glow: true });
    game.save.c.splashes++;
    // Golden Tide turns the next two splashes entirely gold
    const forceGold = game.fx.golden > 0;
    if (forceGold) game.fx.golden--;
    const defs = L.bubblesForSplash(energy, { ...game.stats, bubbleHP: game.rules ? game.rules.bubbleHP : game.stats.bubbleHP }, undefined, forceGold);
    for (const b of defs) {
      if (bubbles.length > 120) break;
      bubbles.push({
        x: x + (Math.random() - 0.5) * 46 * S,
        y: G.waterY - 6,
        r: (7 + Math.min(11, b.value / 22)) * S * (b.golden ? 1.3 : 1),
        vy: -(L.BUBBLE.riseBase + Math.random() * L.BUBBLE.riseJitter) * (H / L.BUBBLE.refHeight),
        wob: Math.random() * 6.28,
        value: b.value, golden: b.golden, hp: b.hp,
        age: 0,
      });
    }
  }

  function bankBubble(b, i) {
    bubbles.splice(i, 1);
    game.combo++;
    if (game.combo > game.bestCombo) game.bestCombo = game.combo;
    const mult = L.comboMultiplier(game.combo, game.stats);
    const pts = Math.round(b.value * mult);
    game.roundScore += pts; game.banked += pts;
    game.save.c.banked++;
    if (b.golden) game.round.goldens++;
    AudioFX.bank(game.combo, b.golden, b.value);
    popup(b.x, G.beamY + 16, '+' + pts + (mult > 1.15 ? ' ×' + mult.toFixed(1) : ''), b.golden ? 'gold' : 'bank');
    spawnParts(b.golden ? 30 : 15, b.x, G.beamY + 6, { hue: b.golden ? 48 : 190, speed: 150, life: 0.7, size: 2.4, glow: true, spark: b.golden });
    drawGlint(b.x, G.beamY + 6, b.golden ? 16 : 10, 0.9, b.golden ? 48 : 190);
    ui.syncHud();
  }
  function popBubble(b, i, cause) {
    b.hp--;
    if (b.hp > 0) {
      spawnParts(6, b.x, b.y, { hue: 200, speed: 90, life: 0.4, size: 2 });
      return;
    }
    bubbles.splice(i, 1);
    game.lost += b.value;
    game.round.popped++;
    game.combo = 0;
    AudioFX.pop(b.r, b.value);
    popup(b.x, b.y, '-' + b.value, 'lost');
    spawnParts(10, b.x, b.y, { hue: 350, speed: 130, life: 0.5, size: 2.2 });
    ui.syncHud();
  }

  // ============================== Physics step ==============================
  function step(dt) {
    const GRAV = 1350;
    stepWater(dt);
    stepFireworks(dt);

    // Orbs
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.age += dt;
      o.vy += GRAV * dt;
      // Gale: a steady crosswind, plus a slow gust cycle so it never feels like a fixed offset
      if (game.rules && game.rules.wind) o.vx -= (150 + Math.sin(o.age * 1.7 + o.x * 0.004) * 90) * dt;
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.trail += dt;
      if (o.trail > 0.016) {
        o.trail = 0;
        spawnParts(2, o.x, o.y, { hue: 48, speed: 16, life: 0.4, size: 2, glow: true, grav: 0, spark: true }); // pixie dust
      }
      // waterfall mirror
      if (!(game.rules && game.rules.noMirror) &&
          o.x + o.r > G.fallX && o.x - o.r < G.fallX + G.fallW && o.y < G.waterY && o.vx > 0) {
        o.vx = -Math.abs(o.vx) * 1.02;
        o.mirrored = 1;
        AudioFX.mirror();
        spawnParts(14, G.fallX, o.y, { hue: 200, dir: Math.PI, spread: 0.8, speed: 220, life: 0.5, size: 2.4, glow: true, spark: true });
      }
      // crystals
      let hit = false;
      for (const c of crystals) {
        if (circleHitsCrystal(o.x, o.y, o.r, c)) {
          c.seen = 1; // Fogbank: touching a crystal reveals it for the rest of the round
          if (o.mirrored) { game.round.mirrorShots++; game.save.c.mirrorShots++; }
          damageCrystal(c, game.stats.orbDamage, o.x, o.y, Math.hypot(o.vx, o.vy));
          spawnParts(10, o.x, o.y, { hue: 48, speed: 180, life: 0.5, size: 2.4, glow: true });
          hit = true; break;
        }
      }
      if (hit) { orbs.splice(i, 1); continue; }
      // bubbles — orbs pop them (friendly fire!)
      for (let j = bubbles.length - 1; j >= 0; j--) {
        const b = bubbles[j];
        if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < (o.r + b.r) ** 2) { popBubble(b, j, 'orb'); hit = true; break; }
      }
      if (hit) { orbs.splice(i, 1); continue; }
      // water — orbs FIZZLE: visual splash only, NO bubbles (only crystal debris makes bubbles)
      if (o.y + o.r >= G.waterY) {
        splashVisual(o.x, Math.hypot(o.vx, o.vy));
        game.round.wastedOrbs++;
        orbs.splice(i, 1); continue;
      }
      if (o.x < -40 || o.x > W + 40 || o.y > H + 40 || o.age > 7) orbs.splice(i, 1);
    }

    // Shards (debris)
    for (let i = shards.length - 1; i >= 0; i--) {
      const s2 = shards[i];
      s2.age += dt;
      s2.vy += GRAV * 0.8 * dt;
      // waterfall pushes debris down-left slightly
      if (s2.x > G.fallX && s2.x < G.fallX + G.fallW && s2.y < G.waterY) { s2.vy += 500 * dt; s2.vx -= 60 * dt; }
      s2.x += s2.vx * dt; s2.y += s2.vy * dt; s2.rot += s2.vr * dt;
      // debris pops bubbles (mitigated by Calm Waters)
      for (let j = bubbles.length - 1; j >= 0; j--) {
        const b = bubbles[j];
        if ((s2.x - b.x) ** 2 + (s2.y - b.y) ** 2 < (s2.r + b.r) ** 2) {
          if (game.fx.still <= 0 && Math.random() < (game.rules ? game.rules.debrisPopMult : game.stats.debrisPopMult)) popBubble(b, j, 'debris');
          else spawnParts(4, b.x, b.y, { hue: 190, speed: 60, life: 0.3, size: 1.8 });
          s2.vx *= 0.6; s2.vy *= 0.6;
          break;
        }
      }
      if (s2.y + s2.r >= G.waterY) {
        splashAt(s2.x, Math.hypot(s2.vx, s2.vy), s2.r);
        shards.splice(i, 1); continue;
      }
      if (s2.x < -40 || s2.x > W + 40 || s2.age > 8) shards.splice(i, 1);
    }

    // Bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt; b.wob += dt * 3;
      b.y += b.vy * game.stats.bubbleRiseMult * dt;
      b.x += Math.sin(b.wob) * 14 * dt;
      // waterfall zone nudges bubbles left, away from turbulence
      if (b.x > G.fallX - 8) b.x -= 30 * dt;
      if (b.y - b.r <= G.beamY) { bankBubble(b, i); continue; }
    }

    // crystals wobble/flash decay
    for (const c of crystals) { c.flash = Math.max(0, c.flash - dt * 3); c.wobble += dt; }

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.age += dt; p.y -= 30 * dt;
      if (p.age > p.life) popups.splice(i, 1);
    }

    shake = Math.max(0, shake - dt * 30);

    // charge winds up while the button is held
    if (game.charge.active) {
      // wall clock, not dt: on a stuttering frame the accumulated dt lags real time, and the
      // player who held the button for a full second was being handed 0.89 of a charge.
      game.charge.t = Math.min(CHARGE_TIME * 1.6, (performance.now() - game.charge.start) / 1000);
      if (game.charge.handle) game.charge.handle.update(chargeLevel());
    }
    // consumable timers
    if (game.fx.still > 0) game.fx.still = Math.max(0, game.fx.still - dt);

    // the music follows the round: a busy pool fills the melody in, a quiet one thins it out
    if (AX) AX.setIntensity(Math.min(1, (bubbles.length / 40) * 0.7 + (shards.length / 30) * 0.3));

    // Timer (paused while a menu panel is open — don't eat the round behind a menu)
    const panelOpen = ui.els.panels && ui.els.panels.classList.contains('open') && ui.els.panels.dataset.kind !== 'end';
    if (game.mode === 'play' && game.started && !panelOpen) {
      const prev = Math.ceil(game.timeLeft);
      game.timeLeft -= dt;
      game.save.c.secondsPlayed += dt;
      if (game.timeLeft <= 5 && Math.ceil(game.timeLeft) !== prev && game.timeLeft > 0) AudioFX.tick(1 - game.timeLeft / 5);
      if (game.timeLeft <= 0) {
        game.timeLeft = 0;
        game.mode = 'grace'; game.graceT = 2.3; // bubbles in flight still count
        popup(W / 2, H * 0.3, 'LAST CALL!', 'big');
      } else if (boardSettled()) {
        // v2.0.0: the round ends when there is nothing left to do, instead of making the
        // player watch an empty pool for the rest of the clock. Every crystal is gone, every
        // bubble has surfaced or popped, and nothing is still in the air.
        game.mode = 'grace'; game.graceT = 0.9;
        popup(W / 2, H * 0.3, 'CASCADE CLEARED!', 'big gold');
      }
      ui.syncHud();
    } else if (game.mode === 'grace') {
      game.graceT -= dt;
      if (game.graceT <= 0 || (bubbles.length === 0 && shards.length === 0)) endRound();
    }
  }

  // Nothing left in play: no crystals, no bubbles rising, no debris or orbs in flight.
  // Deliberately also requires the shot budget not to be the only thing left — a Rationed
  // run with orbs still airborne is not settled.
  function boardSettled() {
    return crystals.length === 0 && bubbles.length === 0 && shards.length === 0 && orbs.length === 0;
  }

  // Give up: end the round now, keeping whatever was banked. Not free — it is recorded, and
  // the level is marked so a later clean run can claim the comeback.
  function giveUp() {
    if (game.mode !== 'play' && game.mode !== 'grace') return;
    cancelCharge();
    game.save.c.giveUps++;
    game.round.gaveUp = true;
    abandoned[game.level.level + ':' + game.challenge] = 1;
    AudioFX.giveUp();
    game.mode = 'grace'; game.graceT = 0.35;
  }

  // ============================== Round end ==============================
  function endRound() {
    game.mode = 'tally';
    cancelCharge();
    const lvl = game.level.level;
    const th = game.thresholds;
    const sc = Math.round(game.roundScore * (game.rules.scoreMult || 1));
    const starsEarned = L.starsFor(sc, th);
    const mode = game.challenge;
    const cleared = crystals.length === 0;

    // lifetime counters (achievements read these)
    const C = game.save.c;
    C.shattered += game.round.shattered;
    C.popped += game.round.popped;
    C.goldens += game.round.goldens;
    C.sharks += game.round.sharkSeen;
    if (game.bestCombo > C.bestCombo) C.bestCombo = game.bestCombo;
    C.cleanSweeps = cleared ? C.cleanSweeps + 1 : 0;
    if (starsEarned >= 3 && game.scene) {
      // 'Four Skies' wants a three-star under each of the four skies; pack them as bits.
      const bit = { dawn: 1, day: 2, dusk: 4, night: 8 }[game.scene.tod] || 0;
      C.skySet = (C.skySet | 0) | bit;
    }

    const res = L.endRound(game.save, sc, lvl, starsEarned, mode);
    if (starsEarned >= 3) delete abandoned[lvl + ':' + mode];

    // the round summary the achievement predicates read
    const summary = {
      score: sc, stars: starsEarned, level: lvl, mode: mode, par: th.par,
      popped: game.round.popped, goldens: game.round.goldens, shots: game.shotsFired,
      chargeShots: game.round.chargeShots, wastedOrbs: game.round.wastedOrbs,
      bestChain: game.round.bestChain, itemsUsed: game.round.itemsUsed,
      timeLeft: Math.max(0, game.timeLeft), cleared: cleared,
      wasAbandoned: game.round.wasAbandoned, gaveUp: !!game.round.gaveUp,
      tod: game.scene ? game.scene.tod : '', weather: game.scene ? game.scene.weather : '',
    };
    const won = (typeof PCAch !== 'undefined') ? PCAch.evaluate(game.save, summary) : [];
    persistSave();

    if (res.advanced) {
      const newE = L.ENDOWMENTS.find(e => e.unlock === game.save.level);
      if (newE) {
        popup(W / 2, H * 0.24, '\u{1F4A0} ENDOWMENT UNLOCKED: ' + newE.name + '!', 'big gold');
        for (let i = 0; i < 3; i++) setTimeout(() => launchFirework(W * (0.35 + Math.random() * 0.3), H * 0.22, 265), i * 300);
      }
    }
    if (starsEarned >= 1) {
      AudioFX.fanfare(starsEarned);
      const n = Math.min(7, 3 + starsEarned * 2);
      for (let i = 0; i < n; i++) {
        setTimeout(() => launchFirework(W * (0.2 + Math.random() * 0.6), H * (0.15 + Math.random() * 0.3), Math.random() * 360), i * 260);
      }
    }
    if (AX) AX.setIntensity(0.15);
    ui.showRoundEnd(sc, starsEarned, res.advanced, lvl, won, summary);
  }

  function persistSave() { return store.set(L.SAVE_KEY, game.save); }

  // ============================== Render ==============================
  function bgGradient() {
    const stops = game.scene ? SKY[game.scene.tod] : SKY.night;
    const g = cx.createLinearGradient(0, 0, 0, H);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }
  const stars = [];
  function initStars() {
    stars.length = 0;
    for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random() * 0.75, tw: Math.random() * 6.28, s: 0.6 + Math.random() * 1.6 });
  }

  function render(t) {
    cx.save();
    if (shake > 0.3) cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    cx.fillStyle = bgGradient();
    cx.fillRect(-20, -20, W + 40, H + 40);

    // twinkling stars (faded by time of day)
    const starA = game.scene ? game.scene.stars : 1;
    if (starA > 0.01) {
      for (const s2 of stars) {
        const a = (0.35 + 0.35 * Math.sin(t * 0.001 + s2.tw)) * starA;
        cx.globalAlpha = a;
        cx.fillStyle = '#cfe0ff';
        cx.fillRect(s2.x * W, s2.y * H, s2.s, s2.s);
      }
      cx.globalAlpha = 1;
    }

    // moving sun / moon + drifting clouds
    drawCelestial(t);
    drawClouds(t);

    // ambient depth: spires, aurora, motes
    drawAmbientSky(t);

    // counting beam
    const bg = cx.createLinearGradient(0, G.beamY - 14, 0, G.beamY + 14);
    bg.addColorStop(0, 'rgba(120,220,255,0)');
    bg.addColorStop(0.5, 'rgba(140,230,255,' + (0.25 + 0.1 * Math.sin(t * 0.004)) + ')');
    bg.addColorStop(1, 'rgba(120,220,255,0)');
    cx.fillStyle = bg;
    cx.fillRect(0, G.beamY - 14, W, 28);
    cx.fillStyle = 'rgba(190,240,255,0.8)';
    for (let x = ((t * 0.06) % 40); x < W; x += 40) cx.fillRect(x, G.beamY - 1, 14, 2);

    // waterfall + its cliff source
    drawWaterfall(t);
    drawCliff(t);
    // crystals
    for (const c of crystals) drawCrystal(c, t);
    // launcher
    drawLauncher(t);
    // aim guide
    if (game.mode === 'play') drawAim();
    // first-run hint
    if (game.mode === 'play' && !game.started) {
      const a = 0.6 + 0.4 * Math.sin(t * 0.005);
      cx.globalAlpha = a;
      cx.font = '600 ' + 20 * S + 'px Rubik, system-ui, sans-serif';
      cx.textAlign = 'left';
      cx.fillStyle = '#ffe9a3';
      cx.fillText('✨ Hold to charge, release to throw — longer hold, farther reach', G.launch.x + 50 * S, G.launch.y - 8);
      cx.globalAlpha = a * 0.8;
      cx.font = '500 ' + 15 * S + 'px Rubik, system-ui, sans-serif';
      cx.fillStyle = '#cfe0ff';
      cx.fillText('shatter crystals → splash bubbles → float them to the beam', G.launch.x + 50 * S, G.launch.y + 16);
      cx.globalAlpha = 1;
    }
    // entities
    cx.globalCompositeOperation = 'lighter';
    for (const o of orbs) {
      const gr = cx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 2.6);
      gr.addColorStop(0, 'rgba(255,240,180,0.95)');
      gr.addColorStop(0.4, 'rgba(255,200,90,0.55)');
      gr.addColorStop(1, 'rgba(255,180,60,0)');
      cx.fillStyle = gr;
      cx.beginPath(); cx.arc(o.x, o.y, o.r * 2.6, 0, 6.29); cx.fill();
      cx.fillStyle = '#fff7e0';
      cx.beginPath(); cx.arc(o.x, o.y, o.r * 0.7, 0, 6.29); cx.fill();
    }
    cx.globalCompositeOperation = 'source-over';
    for (const s2 of shards) {
      cx.save();
      cx.translate(s2.x, s2.y); cx.rotate(s2.rot);
      cx.fillStyle = 'hsla(' + s2.hue + ',85%,72%,0.95)';
      cx.beginPath();
      cx.moveTo(0, -s2.r * 1.4); cx.lineTo(s2.r, s2.r); cx.lineTo(-s2.r, s2.r * 0.8);
      cx.closePath(); cx.fill();
      cx.restore();
    }
    // bubbles
    for (const b of bubbles) drawBubble(b, t);
    // water (drawn over sunk things)
    drawWater(t);
    // particles
    cx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const a = 1 - p.age / p.life;
      if (p.spark && ((p.age * 30) | 0) % 2 === 0) continue; // twinkle
      cx.globalAlpha = a * (p.glow ? 0.9 : 0.7);
      cx.fillStyle = 'hsla(' + p.hue + ',95%,' + (p.glow ? 72 : 62) + '%,1)';
      cx.beginPath(); cx.arc(p.x, p.y, p.size * (p.glow ? 1.2 : 1), 0, 6.29); cx.fill();
    }
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
    // rain (visual only), fireflies near the shore, visual wind
    drawRain(t);
    if (!game.scene || game.scene.fireflies) drawFireflies(t);
    drawWind(t);
    // popups
    for (const p of popups) {
      const a = 1 - p.age / p.life;
      cx.globalAlpha = Math.min(1, a * 1.6);
      cx.font = (p.cls.includes('big') ? 700 : 600) + ' ' + (p.cls.includes('big') ? 34 * S : 17 * S) + 'px Rubik, system-ui, sans-serif';
      cx.textAlign = 'center';
      cx.lineWidth = 4; cx.strokeStyle = 'rgba(10,10,30,0.8)';
      cx.strokeText(p.text, p.x, p.y);
      cx.fillStyle = p.cls.includes('gold') ? '#ffd257' : p.cls.includes('lost') ? '#ff7d9c' : '#a5f3ff';
      cx.fillText(p.text, p.x, p.y);
      cx.globalAlpha = 1;
    }
    // Still Water reads as a held breath over the pool
    if (game.fx.still > 0) {
      cx.save();
      cx.globalAlpha = Math.min(1, game.fx.still / 6) * 0.35;
      const sg = cx.createLinearGradient(0, G.beamY, 0, G.waterY);
      sg.addColorStop(0, 'rgba(180,240,255,0)');
      sg.addColorStop(1, 'rgba(180,240,255,0.55)');
      cx.fillStyle = sg;
      cx.fillRect(0, G.beamY, W, G.waterY - G.beamY);
      cx.globalAlpha = 0.85;
      cx.font = '700 ' + 15 * S + 'px Rubik, system-ui, sans-serif';
      cx.textAlign = 'center';
      cx.fillStyle = '#dff6ff';
      cx.fillText('\u{1FAB7} STILL WATER  ' + game.fx.still.toFixed(1) + 's', W / 2, G.waterY - 26);
      cx.restore();
    }
    if (game.fx.storm > 0) {
      cx.save();
      cx.globalAlpha = 0.85;
      cx.font = '700 ' + 14 * S + 'px Rubik, system-ui, sans-serif';
      cx.textAlign = 'left';
      cx.fillStyle = '#ffe9a3';
      cx.fillText('\u{1F329} STORM \u00D7' + game.fx.storm, G.launch.x - 30 * S, G.launch.y + 76);
      cx.restore();
    }
    if (game.fx.golden > 0) {
      cx.save();
      cx.globalAlpha = 0.85;
      cx.font = '700 ' + 14 * S + 'px Rubik, system-ui, sans-serif';
      cx.textAlign = 'left';
      cx.fillStyle = '#ffd257';
      cx.fillText('\u{1FA99} GOLDEN TIDE \u00D7' + game.fx.golden, G.launch.x - 30 * S, G.launch.y + 96);
      cx.restore();
    }
    drawVignette();
    cx.restore();
  }

  function drawCrystal(c, t) {
    // Fogbank: an unstruck crystal is a rumour in the mist. It still occupies its position
    // and can still be hit — you simply cannot see what you are aiming at until you connect.
    if (!c.seen) {
      const r = 26 * c.size * S;
      cx.save();
      const gm = cx.createRadialGradient(c.px, c.py, 1, c.px, c.py, r * 1.6);
      const puff = 0.10 + 0.05 * Math.sin(t * 0.001 + c.wobble);
      gm.addColorStop(0, 'rgba(226,235,255,' + (puff + 0.10) + ')');
      gm.addColorStop(0.6, 'rgba(210,222,250,' + puff * 0.6 + ')');
      gm.addColorStop(1, 'rgba(210,222,250,0)');
      cx.fillStyle = gm;
      cx.beginPath(); cx.arc(c.px, c.py, r * 1.6, 0, 6.29); cx.fill();
      cx.restore();
      return;
    }
    const poly = crystalPoly(c);
    const wob = Math.sin(c.wobble * 2) * 1.5;
    cx.save();
    cx.translate(0, wob);
    const grad = cx.createLinearGradient(c.px, c.py - 40, c.px, c.py + 40);
    grad.addColorStop(0, 'hsla(' + c.hue + ',85%,' + (72 + c.flash * 25) + '%,0.95)');
    grad.addColorStop(1, 'hsla(' + ((c.hue + 40) % 360) + ',80%,' + (48 + c.flash * 30) + '%,0.9)');
    cx.fillStyle = grad;
    cx.strokeStyle = 'hsla(' + c.hue + ',100%,85%,0.9)';
    cx.lineWidth = 2;
    cx.beginPath();
    poly.forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y));
    cx.closePath(); cx.fill(); cx.stroke();
    // inner facets
    cx.globalAlpha = 0.5;
    cx.beginPath();
    cx.moveTo(poly[0].x, poly[0].y); cx.lineTo(c.px, c.py); cx.lineTo(poly[2].x, poly[2].y);
    cx.moveTo(poly[3].x, poly[3].y); cx.lineTo(c.px, c.py); cx.lineTo(poly[5].x, poly[5].y);
    cx.strokeStyle = 'rgba(255,255,255,0.7)'; cx.lineWidth = 1; cx.stroke();
    cx.globalAlpha = 1;
    // glint sparkle
    if (((t * 0.001 + c.wobble) % 3) < 0.15) {
      cx.fillStyle = 'rgba(255,255,255,0.9)';
      cx.beginPath(); cx.arc(poly[0].x, poly[0].y, 2.4, 0, 6.29); cx.fill();
    }
    // hp pips
    if (c.maxHp > 1) {
      for (let i = 0; i < c.maxHp; i++) {
        cx.fillStyle = i < c.hp ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)';
        cx.beginPath(); cx.arc(c.px - (c.maxHp - 1) * 4 + i * 8, c.py + 34 * c.size * S, 2.5, 0, 6.29); cx.fill();
      }
    }
    cx.restore();
  }

  function drawBubble(b, t) {
    cx.save();
    const grd = cx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
    if (b.golden) {
      grd.addColorStop(0, 'rgba(255,245,200,0.95)');
      grd.addColorStop(0.6, 'rgba(255,205,80,0.55)');
      grd.addColorStop(1, 'rgba(255,180,40,0.35)');
    } else {
      grd.addColorStop(0, 'rgba(220,250,255,0.9)');
      grd.addColorStop(0.65, 'rgba(140,215,255,0.35)');
      grd.addColorStop(1, 'rgba(120,200,255,0.22)');
    }
    cx.fillStyle = grd;
    cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, 6.29); cx.fill();
    cx.strokeStyle = b.golden ? 'rgba(255,225,130,0.9)' : 'rgba(200,240,255,0.75)';
    cx.lineWidth = 1.4;
    cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.85)';
    cx.beginPath(); cx.arc(b.x - b.r * 0.4, b.y - b.r * 0.42, b.r * 0.18, 0, 6.29); cx.fill();
    // value
    cx.font = '600 ' + Math.max(9, b.r * 0.85) + 'px Rubik, system-ui, sans-serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = b.golden ? '#7a4c00' : '#0b3a55';
    cx.fillText(b.value, b.x, b.y + 1);
    if (b.hp > 1) { cx.strokeStyle = 'rgba(255,255,255,0.9)'; cx.lineWidth = 2.4; cx.beginPath(); cx.arc(b.x, b.y, b.r + 2.5, 0, 6.29); cx.stroke(); }
    cx.restore();
  }

  // ============================== Cascade ==============================
  // v1.3.0 drew ONE narrow sheet falling top-to-bottom at a constant rate, which is not what
  // a real cascade does. Rebuilt from the reference photo: the water steps down a series of
  // terraced ledges, each ledge splitting the flow into strands of different widths that
  // spread wider as they descend, with a catch pool churning on every step.
  //
  // The flow also BREATHES. Streak speed and strand width run off slow out-of-phase sines
  // rather than a fixed rate, so the fall surges and eases the way moving water does. The
  // whole thing is deliberately slower than v1.3.0 — this is meant to be calming.
  const TIERS = [];
  function buildTiers() {
    TIERS.length = 0;
    const rng = L.mulberry32(0xCA5CADE);
    // Four ledges between the crest and the plunge pool. Each one is wider than the last and
    // drifts left, so the cascade fans out toward the pool instead of dropping in a column.
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const f = i / steps;
      const nf = (i + 1) / steps;
      const y0 = G.beamY + 26 + f * (G.waterY - G.beamY - 40);
      const y1 = G.beamY + 26 + nf * (G.waterY - G.beamY - 40);
      const spread = 1 + f * 2.9;                       // sheet widens on the way down
      const cxm = G.fallX + G.fallW / 2 - f * G.fallW * 1.35;
      const w = G.fallW * spread;
      const strands = [];
      const n = 2 + i;                                   // more strands the wider it gets
      for (let k = 0; k < n; k++) {
        strands.push({
          off: (k + 0.5) / n,                            // position across the ledge
          w: (0.16 + rng() * 0.34) / n * 2,              // strand width as a fraction of ledge
          ph: rng() * 6.28,                              // its own breathing phase
          rate: 0.55 + rng() * 0.5,                      // and its own pace
        });
      }
      TIERS.push({ y0, y1, x: cxm - w / 2, w, strands, lipPh: rng() * 6.28 });
    }
  }

  // 0.7..1.3 — the slow surge every strand rides. One shared clock, per-strand phase.
  function flowPulse(t, ph, rate) {
    return 0.78 + 0.16 * Math.sin(t * 0.00042 * rate + ph) + 0.10 * Math.sin(t * 0.00121 * rate + ph * 1.7);
  }

  function drawWaterfall(t) {
    if (!TIERS.length) buildTiers();
    const rock = (game.scene && game.scene.rock) || ['#4a3960', '#6b5484', '#8d6da6'];

    // --- the terraced rock face the water is running over ---
    // Without this the ledges read as bars hanging in mid-air. It is drawn first, as a single
    // stepped silhouette, so every shelf below belongs to the same wall.
    cx.save();
    cx.beginPath();
    cx.moveTo(W + 40, G.beamY - 20);
    cx.lineTo(TIERS[0].x - TIERS[0].w * 0.30, G.beamY - 20);
    for (const tier of TIERS) {
      cx.lineTo(tier.x - tier.w * 0.30, tier.y1 + 4);
      cx.lineTo(tier.x - tier.w * 0.34 - tier.w * 0.10, tier.y1 + 4);
    }
    cx.lineTo(TIERS[TIERS.length - 1].x - TIERS[TIERS.length - 1].w * 0.45, G.waterY + 6);
    cx.lineTo(W + 40, G.waterY + 6);
    cx.closePath();
    const wall = cx.createLinearGradient(G.fallX - W * 0.2, 0, W, 0);
    wall.addColorStop(0, rock[0]); wall.addColorStop(0.5, rock[1]); wall.addColorStop(1, rock[2]);
    cx.fillStyle = wall; cx.fill();
    // damp streaking down the wall
    cx.globalAlpha = 0.12;
    cx.strokeStyle = '#0a0a1a'; cx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const x = TIERS[0].x + (i / 14) * (W - TIERS[0].x) + Math.sin(i * 3.1) * 8;
      cx.beginPath(); cx.moveTo(x, G.beamY); cx.lineTo(x - 6, G.waterY); cx.stroke();
    }
    cx.globalAlpha = 1;
    cx.restore();

    cx.save();
    for (let i = 0; i < TIERS.length; i++) {
      const tier = TIERS[i];
      const h = tier.y1 - tier.y0;
      // ---- the falling sheet for this step ----
      for (const st of tier.strands) {
        const pulse = flowPulse(t, st.ph, st.rate);
        const sw = Math.max(3, tier.w * st.w * pulse);
        const sx = tier.x + tier.w * st.off - sw / 2;
        const lean = Math.sin(t * 0.0006 + st.ph) * tier.w * 0.03;
        // body of the strand: narrow at the lip, fanning slightly at the foot
        cx.beginPath();
        cx.moveTo(sx, tier.y0);
        cx.bezierCurveTo(sx - sw * 0.10 + lean, tier.y0 + h * 0.5, sx - sw * 0.35 + lean, tier.y0 + h * 0.8, sx - sw * 0.45 + lean, tier.y1);
        cx.lineTo(sx + sw * 1.45 + lean, tier.y1);
        cx.bezierCurveTo(sx + sw * 1.35 + lean, tier.y0 + h * 0.8, sx + sw * 1.10 + lean, tier.y0 + h * 0.5, sx + sw, tier.y0);
        cx.closePath();
        const g = cx.createLinearGradient(sx, 0, sx + sw, 0);
        g.addColorStop(0, 'rgba(150,220,250,0.10)');
        g.addColorStop(0.35, 'rgba(215,244,255,0.42)');
        g.addColorStop(0.6, 'rgba(240,252,255,0.55)');
        g.addColorStop(1, 'rgba(150,220,250,0.10)');
        cx.fillStyle = g;
        cx.fill();

        // ---- streaks inside the strand ----
        // Speed is the pulse, not a constant: the fall visibly surges and eases.
        cx.save();
        cx.clip();
        const speed = 26 + pulse * 34;
        cx.strokeStyle = 'rgba(245,253,255,0.30)';
        cx.lineWidth = Math.max(1, sw * 0.10);
        const gap = 46;
        for (let k = 0; k < 4; k++) {
          const off = ((t * 0.001 * speed) + k * (gap / 4) + st.ph * 20) % gap;
          for (let y = tier.y0 - gap + off; y < tier.y1; y += gap) {
            const p = Math.max(0, (y - tier.y0) / Math.max(1, h));
            const len = 12 + p * 26;                       // streaks stretch as water accelerates
            const wob = Math.sin(y * 0.03 + t * 0.0011 + st.ph) * sw * 0.10;
            const xx = sx + sw * (0.25 + 0.5 * ((k + 1) / 5)) + wob + lean * p;
            cx.beginPath();
            cx.moveTo(xx, y);
            cx.lineTo(xx - sw * 0.05, Math.min(tier.y1, y + len));
            cx.stroke();
          }
        }
        cx.restore();

        // ---- catch pool where this strand lands on the next ledge ----
        const px = sx + sw * 0.5 + lean;
        const pw = sw * (1.9 + 0.25 * Math.sin(t * 0.002 + st.ph));
        const gr = cx.createRadialGradient(px, tier.y1, 1, px, tier.y1, pw);
        gr.addColorStop(0, 'rgba(235,250,255,0.5)');
        gr.addColorStop(1, 'rgba(235,250,255,0)');
        cx.fillStyle = gr;
        cx.beginPath(); cx.ellipse(px, tier.y1, pw, pw * 0.4, 0, 0, 6.29); cx.fill();
        // churn on the shelf
        cx.fillStyle = 'rgba(255,255,255,0.30)';
        for (let b = 0; b < 3; b++) {
          const bx = px + Math.sin(t * 0.003 + b * 2.1 + st.ph) * pw * 0.7;
          const br = (2.5 + b) * S * (0.7 + 0.3 * Math.sin(t * 0.004 + b));
          cx.beginPath(); cx.arc(bx, tier.y1 - 1, br, 0, 6.29); cx.fill();
        }
      }

      // ---- the ledge itself: wet rock lip the water pours over ----
      {
        const lipY = tier.y1;
        const lipX = tier.x - tier.w * 0.30, lipW = tier.w * 1.55;
        const faceH = 20 * S;
        // shadow the shelf casts on the water below it
        cx.fillStyle = 'rgba(10,12,32,0.18)';
        cx.beginPath();
        cx.ellipse(lipX + lipW * 0.5, lipY + faceH + 3, lipW * 0.5, 5 * S, 0, 0, 6.29);
        cx.fill();
        // top of the shelf: a wet, catching surface
        const tg = cx.createLinearGradient(0, lipY - 5, 0, lipY + 7 * S);
        tg.addColorStop(0, 'rgba(190,225,240,0.85)');
        tg.addColorStop(1, rock[2]);
        cx.fillStyle = tg;
        cx.beginPath();
        cx.moveTo(lipX, lipY + 2);
        for (let x = 0; x <= 1.001; x += 0.08) {
          cx.lineTo(lipX + lipW * x, lipY + 2 + Math.sin(x * 19 + tier.lipPh) * 2.2 * S);
        }
        cx.lineTo(lipX + lipW, lipY + 7 * S);
        cx.lineTo(lipX, lipY + 7 * S);
        cx.closePath(); cx.fill();
        // the face beneath it, in shadow
        const fg = cx.createLinearGradient(0, lipY + 6 * S, 0, lipY + faceH);
        fg.addColorStop(0, rock[1]); fg.addColorStop(1, rock[0]);
        cx.fillStyle = fg;
        cx.beginPath();
        cx.moveTo(lipX, lipY + 6 * S);
        cx.lineTo(lipX + lipW, lipY + 6 * S);
        cx.lineTo(lipX + lipW * 0.94, lipY + faceH);
        cx.lineTo(lipX + lipW * 0.04, lipY + faceH * 0.92);
        cx.closePath(); cx.fill();
        // moss clinging to the wet edge
        cx.strokeStyle = 'rgba(120,190,140,0.32)';
        cx.lineWidth = 2.4;
        cx.beginPath();
        for (let x = 0; x <= 1.001; x += 0.1) {
          const xx = lipX + lipW * x, yy = lipY + 7 * S + Math.sin(x * 14 + tier.lipPh) * 2;
          x ? cx.lineTo(xx, yy) : cx.moveTo(xx, yy);
        }
        cx.stroke();
      }
    }
    cx.restore();

    // falling droplet streaks (stateful, spawned in stepAmbient)
    cx.save();
    cx.strokeStyle = 'rgba(240,250,255,0.45)';
    cx.lineWidth = 1.3;
    cx.beginPath();
    for (const d of drops) { cx.moveTo(d.x, d.y - d.len); cx.lineTo(d.x, d.y); }
    cx.stroke();
    cx.restore();

    // mist plumes drifting up off the steps
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    for (const m of mist) {
      const a = 0.14 * (1 - m.age / m.life);
      const gr = cx.createRadialGradient(m.x, m.y, 1, m.x, m.y, m.r);
      gr.addColorStop(0, 'rgba(215,242,255,' + a + ')');
      gr.addColorStop(1, 'rgba(215,242,255,0)');
      cx.fillStyle = gr;
      cx.beginPath(); cx.arc(m.x, m.y, m.r, 0, 6.29); cx.fill();
    }
    cx.restore();

    // churning foam where the last step meets the plunge pool
    cx.save();
    for (const fb of foamBlobs) {
      const bob = Math.sin(t * 0.003 + fb.ph) * 3;
      cx.fillStyle = 'rgba(240,250,255,' + (0.30 + 0.18 * Math.sin(t * 0.004 + fb.ph * 2)) + ')';
      cx.beginPath(); cx.arc(fb.x, G.waterY + 2 + bob * 0.4, fb.r * (1 + 0.12 * Math.sin(t * 0.005 + fb.ph)), 0, 6.29); cx.fill();
    }
    cx.restore();

    // base glow
    const last = TIERS[TIERS.length - 1];
    const bx = last ? last.x + last.w / 2 : G.fallX;
    const mg = cx.createRadialGradient(bx, G.waterY, 4, bx, G.waterY, 110 * S);
    mg.addColorStop(0, 'rgba(215,242,255,0.42)');
    mg.addColorStop(1, 'rgba(215,242,255,0)');
    cx.fillStyle = mg;
    cx.beginPath(); cx.arc(bx, G.waterY, 110 * S, 0, 6.29); cx.fill();

    // the mirror band stays a readable vertical edge — it is a game surface, not just scenery.
    // Still Mirror mode dims it, because in that mode it does not reflect.
    const live = !(game.rules && game.rules.noMirror);
    cx.strokeStyle = live
      ? 'rgba(255,255,255,' + (0.30 + 0.18 * Math.sin(t * 0.004)) + ')'
      : 'rgba(180,190,210,0.16)';
    cx.lineWidth = live ? 1.6 : 1;
    if (!live) cx.setLineDash([6, 10]);
    cx.beginPath(); cx.moveTo(G.fallX, G.beamY); cx.lineTo(G.fallX, G.waterY); cx.stroke();
    cx.setLineDash([]);
  }

  function drawWater(t) {
    const base = G.waterY;
    cx.beginPath();
    cx.moveTo(0, H);
    cx.lineTo(0, base + (water.cols[0] ? water.cols[0].h : 0));
    for (let i = 0; i < water.n; i++) {
      cx.lineTo(i / water.n * W, base + water.cols[i].h);
    }
    cx.lineTo(W, base + (water.cols[water.n - 1] ? water.cols[water.n - 1].h : 0));
    cx.lineTo(W, H);
    cx.closePath();
    const g = cx.createLinearGradient(0, base - 20, 0, H);
    g.addColorStop(0, 'rgba(90,190,255,0.85)');
    g.addColorStop(0.3, 'rgba(50,130,230,0.8)');
    g.addColorStop(1, 'rgba(20,50,140,0.95)');
    cx.fillStyle = g;
    cx.fill();
    // the floor of the pool, then its residents
    drawSeabed(t);
    drawShark(t);
    // cute fish, submerged (leaping ones drawn after the surface line)
    for (const f of fish) if (!f.leap) drawFish(f, performance.now(), true);
    // surface highlight
    cx.beginPath();
    for (let i = 0; i < water.n; i++) {
      const px = i / water.n * W, py = base + water.cols[i].h;
      i ? cx.lineTo(px, py) : cx.moveTo(px, py);
    }
    cx.strokeStyle = 'rgba(200,240,255,0.8)';
    cx.lineWidth = 2;
    cx.stroke();
    // caustic sparkles
    cx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const px = ((i * 137 + t * 0.03) % W);
      const a = 0.15 + 0.15 * Math.sin(t * 0.003 + i * 2.1);
      cx.fillStyle = 'rgba(160,225,255,' + a + ')';
      cx.fillRect(px, base + 12 + (i % 4) * 14, 22, 2);
    }
    cx.globalCompositeOperation = 'source-over';
    // leaping fish above the surface, with a sparkle
    for (const f of fish) if (f.leap) {
      drawFish(f, performance.now(), false);
      drawGlint(f.x + f.dir * 8, f.y - 10, 5, 0.7);
    }
  }

  function drawLauncher(t) {
    const { x, y } = G.launch;
    // floating pedestal
    cx.save();
    const bob = Math.sin(t * 0.0015) * 3;
    cx.translate(x, y + bob);
    const pg = cx.createLinearGradient(0, 0, 0, 46);
    pg.addColorStop(0, '#5f79ff'); pg.addColorStop(1, '#2b3aa0');
    cx.fillStyle = pg;
    cx.beginPath();
    cx.moveTo(-30 * S, 18); cx.lineTo(30 * S, 18); cx.lineTo(20 * S, 46); cx.lineTo(-20 * S, 46);
    cx.closePath(); cx.fill();
    // orb cradle glow
    const ch = game.charge.active ? chargeLevel() : 0;
    const rad = (26 + ch * 14) * S;
    const cg = cx.createRadialGradient(0, 0, 2, 0, 0, rad);
    cg.addColorStop(0, 'rgba(255,' + Math.round(240 - ch * 40) + ',190,0.95)');
    cg.addColorStop(1, 'rgba(255,200,80,0)');
    cx.fillStyle = cg;
    cx.beginPath(); cx.arc(0, 0, rad, 0, 6.29); cx.fill();
    cx.fillStyle = '#fff3cf';
    cx.beginPath(); cx.arc(0, 0, (9 + ch * 4) * S, 0, 6.29); cx.fill();
    cx.restore();
  }

  function drawAim() {
    const { x, y } = G.launch;
    const dx = game.aim.x - x, dy = game.aim.y - y;
    const a = Math.atan2(dy, dx);
    // The trajectory shown is the one that will actually be fired: charge sets the speed,
    // the cursor sets only the direction.
    const p = game.charge.active ? chargeLevel() : 0.55;
    const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * p;
    let px = x, py = y, vx = Math.cos(a) * speed, vy = Math.sin(a) * speed;
    cx.save();
    const steps = game.charge.active ? 26 : 14;
    for (let i = 0; i < steps; i++) {
      const dt = 0.045;
      vy += 1350 * dt;
      if (game.rules && game.rules.wind) vx -= 150 * dt;
      px += vx * dt; py += vy * dt;
      if (py > G.waterY || px > W || px < 0) break;
      const fade = 0.85 - i * (0.85 / steps);
      cx.fillStyle = 'rgba(255,' + Math.round(235 - p * 60) + ',170,' + fade + ')';
      cx.beginPath(); cx.arc(px, py, (3.4 - i * 0.08) * (0.7 + p * 0.6), 0, 6.29); cx.fill();
    }
    cx.restore();

    // charge ring around the launcher
    if (game.charge.active) {
      const full = chargeLevel() >= 0.999;
      cx.save();
      cx.translate(x, y);
      cx.lineWidth = 5 * S;
      cx.strokeStyle = 'rgba(255,255,255,0.16)';
      cx.beginPath(); cx.arc(0, 0, 30 * S, 0, 6.29); cx.stroke();
      cx.strokeStyle = full ? '#fff0a8' : 'hsl(' + (55 - chargeLevel() * 45) + ',100%,65%)';
      cx.lineCap = 'round';
      cx.beginPath(); cx.arc(0, 0, 30 * S, -Math.PI / 2, -Math.PI / 2 + chargeLevel() * 6.283); cx.stroke();
      cx.lineCap = 'butt';
      if (full) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
        cx.globalAlpha = 0.35 + pulse * 0.4;
        cx.strokeStyle = '#fff6cc';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(0, 0, (36 + pulse * 5) * S, 0, 6.29); cx.stroke();
      }
      cx.restore();
    }
  }

  // ============================== UI (DOM) ==============================
  const $ = sel => document.querySelector(sel);
  const ui = {
    els: {},
    init() {
      this.els = {
        level: $('#hud-level'), score: $('#hud-score'), target: $('#hud-target'),
        fill: $('#hud-fill'), timer: $('#hud-timer'), wallet: $('#hud-wallet'),
        combo: $('#hud-combo'), stars: $('#hud-stars'), mode: $('#hud-mode'),
        shots: $('#hud-shots'), items: $('#itembar'), panels: $('#panels'),
      };
      const bind = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', fn); };
      bind('#btn-tree', () => this.togglePanel('tree'));
      bind('#btn-endow', () => this.togglePanel('endow'));
      bind('#btn-shop', () => this.togglePanel('shop'));
      bind('#btn-map', () => this.togglePanel('map'));
      bind('#btn-ach', () => this.togglePanel('ach'));
      bind('#btn-help', () => this.togglePanel('help'));
      bind('#btn-give', () => {
        if (game.mode !== 'play') return;
        giveUp();
      });
      bind('#btn-music', (e) => {
        const on = AX ? AX.setMusic(!AX.musicOn) : false;
        if (on && AX && game.level) AX.startMusic(game.scene, game.level.level);
        e.currentTarget.textContent = on ? '\u{1F3B5}' : '\u{1F507}';
        e.currentTarget.classList.toggle('off', !on);
        game.save.settings.music = on; persistSave();
      });
      bind('#btn-sfx', (e) => {
        const on = AX ? AX.setSfx(!AX.sfxOn) : false;
        e.currentTarget.textContent = on ? '\u{1F50A}' : '\u{1F515}';
        e.currentTarget.classList.toggle('off', !on);
        game.save.settings.sfx = on; persistSave();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closePanels(); });
      this.syncItems();
    },

    syncHud() {
      const e = this.els;
      if (!game.level || !e.level) return;
      const th = game.thresholds;
      e.level.textContent = 'Lv ' + game.level.level;
      e.score.textContent = fmt(game.roundScore);
      e.target.textContent = '/ ' + fmt(th.one);
      const f = Math.min(1, game.roundScore / th.three);
      e.fill.style.width = (f * 100).toFixed(1) + '%';
      e.fill.classList.toggle('over', game.roundScore >= th.one);
      // live star pips: you can see the next band coming
      const got = L.starsFor(game.roundScore, th);
      if (e.stars) {
        e.stars.innerHTML = [1, 2, 3].map(i => '<i class="' + (got >= i ? 'lit' : '') + '">★</i>').join('');
        e.stars.title = '★ ' + fmt(th.one) + '   ★★ ' + fmt(th.two) + '   ★★★ ' + fmt(th.three);
      }
      e.timer.textContent = game.started ? Math.ceil(game.timeLeft) : Math.round(game.duration);
      e.timer.classList.toggle('low', game.started && game.timeLeft <= 5.5);
      e.wallet.textContent = fmt(game.save.wallet);
      e.combo.textContent = game.combo > 1 ? '×' + L.comboMultiplier(game.combo, game.stats).toFixed(1) + ' combo ' + game.combo : '';
      if (e.mode) {
        const m = L.challengeById(game.challenge);
        e.mode.textContent = m ? m.icon + ' ' + m.name : '';
        e.mode.style.display = m ? '' : 'none';
      }
      if (e.shots) {
        const cap = game.rules ? game.rules.shots : Infinity;
        const finite = cap !== Infinity;
        e.shots.style.display = finite ? '' : 'none';
        if (finite) {
          const left = Math.max(0, cap - game.shotsFired);
          e.shots.textContent = '\u{1F3AF} ' + left;
          e.shots.classList.toggle('low', left <= 3);
        }
      }
      const give = $('#btn-give');
      if (give) give.disabled = game.mode !== 'play';
    },

    // the item bar: what you are carrying, and the key that spends it
    syncItems() {
      const bar = this.els.items;
      if (!bar) return;
      let html = '';
      L.CONSUMABLES.forEach((c, i) => {
        const n = game.save.items[c.id] | 0;
        html += '<button class="item' + (n ? '' : ' empty') + '" data-id="' + c.id + '" title="' + esc(c.name + ' — ' + c.desc) + '">' +
          '<span class="ic">' + c.icon + '</span><span class="n">' + n + '</span><span class="k">' + (i + 1) + '</span></button>';
      });
      bar.innerHTML = html;
      bar.querySelectorAll('.item').forEach(b => {
        b.addEventListener('click', () => useItem(b.dataset.id));
      });
    },

    closePanels() { this.els.panels.innerHTML = ''; this.els.panels.classList.remove('open'); this.els.panels.dataset.kind = ''; },
    togglePanel(kind) {
      if (this.els.panels.dataset.kind === kind && this.els.panels.classList.contains('open')) return this.closePanels();
      this.els.panels.dataset.kind = kind;
      this.els.panels.classList.add('open');
      if (kind === 'tree') this.renderTree();
      if (kind === 'endow') this.renderEndow();
      if (kind === 'shop') this.renderShop();
      if (kind === 'map') this.renderMap();
      if (kind === 'ach') this.renderAch();
      if (kind === 'help') this.renderHelp();
    },
    panelShell(title, inner, cls) {
      this.els.panels.innerHTML =
        '<div class="panel ' + (cls || '') + '"><div class="panel-head"><h2>' + title + '</h2>' +
        '<button class="x" id="panel-x" aria-label="Close">✕</button></div><div class="panel-body">' + inner + '</div></div>';
      $('#panel-x').addEventListener('click', () => this.closePanels());
    },

    renderTree() {
      const branches = { shatter: '⚔ Shatter', flow: '\u{1F30A} Flow', fortune: '✨ Fortune' };
      let html = '<div class="wallet-line">Stardrops: <b>' + fmt(game.save.wallet) + '</b>' +
        '<span class="sub">' + Math.round(L.stardropRate(game.save) * 100) + '% of each round is banked as drops</span></div><div class="tree">';
      for (const bk of Object.keys(branches)) {
        html += '<div class="branch"><h3>' + branches[bk] + '</h3>';
        for (const n of L.TREE.filter(n2 => n2.branch === bk)) {
          const rank = game.save.tree[n.id] | 0;
          const cost = L.upgradeCost(n.id, rank);
          const maxed = rank >= n.max;
          const afford = !maxed && game.save.wallet >= cost;
          html += '<div class="node' + (maxed ? ' maxed' : afford ? ' afford' : '') + '" data-id="' + n.id + '">' +
            '<span class="nicon">' + n.icon + '</span><span class="nname">' + n.name + '</span>' +
            '<span class="ndesc">' + n.desc + '</span>' +
            '<span class="nrank">' + '●'.repeat(rank) + '○'.repeat(n.max - rank) + '</span>' +
            '<button class="buy" ' + (afford ? '' : 'disabled') + '>' + (maxed ? 'MAX' : fmt(cost)) + '</button></div>';
        }
        html += '</div>';
      }
      html += '</div>';
      this.panelShell('Ability Tree', html);
      let busy = false; // re-entrancy guard: buy mutates save + persists
      this.els.panels.querySelectorAll('.node .buy:not([disabled])').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          if (busy) return; busy = true;
          try {
            const id = ev.target.closest('.node').dataset.id;
            if (L.buy(game.save, id)) {
              game.stats = L.derivedStats(game.save.tree, game.save.endow);
              AudioFX.buyOk();
              checkAchievements();
              await persistSave();
              this.renderTree();
              this.syncHud();
            } else AudioFX.deny();
          } finally { busy = false; }
        });
      });
    },

    renderShop() {
      let html = '<div class="wallet-line">Stardrops: <b>' + fmt(game.save.wallet) + '</b>' +
        '<span class="sub">Carried between rounds · press 1-4 mid-round to spend one</span></div><div class="shop">';
      for (const c of L.CONSUMABLES) {
        const have = game.save.items[c.id] | 0;
        const afford = game.save.wallet >= c.cost;
        html += '<div class="wares' + (afford ? ' afford' : '') + '" data-id="' + c.id + '">' +
          '<span class="wicon">' + c.icon + '</span>' +
          '<span class="wname">' + c.name + '</span>' +
          '<span class="wdesc">' + c.desc + '</span>' +
          '<span class="whave">carrying <b>' + have + '</b></span>' +
          '<span class="wbuy"><button class="buy1" ' + (afford ? '' : 'disabled') + '>' + fmt(c.cost) + '</button>' +
          '<button class="buy5" ' + (game.save.wallet >= c.cost * 5 ? '' : 'disabled') + '>×5</button></span>' +
          '</div>';
      }
      html += '</div>';
      this.panelShell('\u{1F9F0} Provisions', html);
      let busy = false;
      const buyIt = async (id, qty) => {
        if (busy) return; busy = true;
        try {
          if (L.buyConsumable(game.save, id, qty)) {
            AudioFX.buyOk(); await persistSave(); this.renderShop(); this.syncItems(); this.syncHud();
          } else AudioFX.deny();
        } finally { busy = false; }
      };
      this.els.panels.querySelectorAll('.wares').forEach(w => {
        const id = w.dataset.id;
        const b1 = w.querySelector('.buy1'), b5 = w.querySelector('.buy5');
        if (b1 && !b1.disabled) b1.addEventListener('click', () => buyIt(id, 1));
        if (b5 && !b5.disabled) b5.addEventListener('click', () => buyIt(id, 5));
      });
    },

    renderEndow() {
      let html = '<p class="endow-intro">Ancient boons surface as you climb. Carry <b>one</b> at a time.</p><div class="endow-list">';
      for (const e of L.ENDOWMENTS) {
        const unlocked = game.save.level >= e.unlock;
        const equipped = game.save.endow === e.id;
        html += '<div class="endow' + (equipped ? ' equipped' : unlocked ? ' avail' : ' locked') + '" data-id="' + e.id + '">' +
          '<span class="eicon">' + e.icon + '</span>' +
          '<span class="ename">' + e.name + '</span>' +
          '<span class="edesc">' + e.desc + '</span>' +
          '<span class="estate">' + (equipped ? 'EQUIPPED' : unlocked ? '' : '\u{1F512} Lv ' + e.unlock) + '</span>' +
          (unlocked ? '<button class="eq ' + (equipped ? 'ghost' : 'cta') + '">' + (equipped ? 'Unequip' : 'Equip') + '</button>' : '') +
          '</div>';
      }
      html += '</div>';
      this.panelShell('\u{1F4A0} Endowments', html);
      let busy = false;
      this.els.panels.querySelectorAll('.endow .eq').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          if (busy) return; busy = true;
          try {
            const id = ev.target.closest('.endow').dataset.id;
            const target = game.save.endow === id ? '' : id;
            if (L.equip(game.save, target)) {
              game.stats = L.derivedStats(game.save.tree, game.save.endow);
              AudioFX.buyOk();
              await persistSave();
              this.renderEndow();
              this.syncHud();
            }
          } finally { busy = false; }
        });
      });
    },

    renderMap() {
      let html = '<div class="map-grid">';
      for (let i = 1; i <= L.MAX_LEVEL; i++) {
        const st = game.save.stars[i] | 0;
        const locked = i > game.save.level;
        html += '<button class="lvl' + (locked ? ' locked' : i === game.save.level ? ' current' : ' done') + '" data-l="' + i + '" ' + (locked ? 'disabled' : '') + '>' +
          i + '<span class="st">' + (st ? '★'.repeat(st) : locked ? '\u{1F512}' : '') + '</span></button>';
      }
      html += '</div>' +
        '<div class="chal-head"><h3>\u{1F3AE} Challenge Runs</h3>' +
        '<p>Three-star a level in standard play to unlock its challenge runs. They score higher, ' +
        'and they ask a great deal more. Pick a level above, then a run below.</p></div>' +
        '<div class="chal-list" id="chal-list"></div>';
      this.panelShell('Levels & Challenges', html, 'wide');
      let picked = game.level ? game.level.level : game.save.level;
      const drawChal = () => {
        const unlocked = (game.save.stars[picked] | 0) >= 3;
        let h = '<div class="chal-for">Selected: <b>Level ' + picked + '</b>' +
          (unlocked ? '' : ' — <span class="warn">three-star it in standard play to unlock these</span>') + '</div>';
        for (const c of L.CHALLENGES) {
          const st = game.save.cstars[picked + ':' + c.id] | 0;
          const th = L.starThresholds(picked, c.id);
          h += '<div class="chal' + (unlocked ? '' : ' locked') + '" data-id="' + c.id + '">' +
            '<span class="cicon">' + c.icon + '</span>' +
            '<span class="cname">' + c.name + '</span>' +
            '<span class="cdesc">' + c.desc + '</span>' +
            '<span class="cstars">' + (st ? '★'.repeat(st) + '☆'.repeat(3 - st) : '☆☆☆') + '</span>' +
            '<span class="cscore">×' + c.scoreMult.toFixed(2) + ' score · ★★★ at ' + fmt(th.three) + '</span>' +
            (unlocked ? '<button class="cta go">Run it</button>' : '<span class="clock">\u{1F512}</span>') +
            '</div>';
        }
        const list = $('#chal-list');
        list.innerHTML = h;
        list.querySelectorAll('.chal:not(.locked) .go').forEach(b => {
          b.addEventListener('click', (ev) => {
            const id = ev.target.closest('.chal').dataset.id;
            this.closePanels();
            loadLevel(picked, id);
          });
        });
      };
      drawChal();
      this.els.panels.querySelectorAll('.lvl:not([disabled])').forEach(b => {
        b.addEventListener('click', (e) => {
          const n = +e.currentTarget.dataset.l;
          if (e.shiftKey) { picked = n; drawChal(); return; }
          picked = n;
          this.closePanels();
          loadLevel(n, '');
        });
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); picked = +e.currentTarget.dataset.l; drawChal(); });
      });
    },

    renderAch() {
      if (typeof PCAch === 'undefined') return this.panelShell('Achievements', '<p>Unavailable.</p>');
      const p = PCAch.progress(game.save);
      const rank = PCAch.rankFor(p.points);
      let html = '<div class="ach-top">' +
        '<div class="ach-rank"><span class="lbl">Rank</span><b>' + esc(rank) + '</b></div>' +
        '<div class="ach-prog"><div class="bar"><div class="fill" style="width:' + (p.pct * 100).toFixed(1) + '%"></div></div>' +
        '<span>' + p.got + ' / ' + p.total + ' · ' + p.points + ' pts</span></div>' +
        '<button class="cta" id="ach-share">\u{1F4F8} Share Card</button></div>';
      const tiers = ['mythic', 'gold', 'silver', 'bronze'];
      for (const t of tiers) {
        const list = PCAch.ALL.filter(a => a.tier === t);
        const got = list.filter(a => game.save.ach[a.id]).length;
        html += '<h3 class="ach-h" style="color:' + PCAch.TIERS[t].color + '">' + PCAch.TIERS[t].name +
          ' <span>' + got + '/' + list.length + '</span></h3><div class="ach-grid">';
        for (const a of list) {
          const has = !!game.save.ach[a.id];
          html += '<div class="ach' + (has ? ' got' : '') + '" data-id="' + a.id + '">' +
            '<span class="aicon">' + (has ? a.icon : '\u{1F512}') + '</span>' +
            '<span class="aname">' + esc(a.name) + '</span>' +
            '<span class="adesc">' + esc(a.desc) + '</span>' +
            (has ? '<button class="mini">card</button>' : '') +
            '</div>';
        }
        html += '</div>';
      }
      this.panelShell('\u{1F3C5} Achievements', html, 'wide');
      $('#ach-share').addEventListener('click', () => shareCard(null));
      this.els.panels.querySelectorAll('.ach.got .mini').forEach(b => {
        b.addEventListener('click', (ev) => shareCard(PCAch.byId(ev.target.closest('.ach').dataset.id)));
      });
    },

    renderHelp() {
      this.panelShell('How to Play',
        '<div class="help">' +
        '<p>\u{1F52E} <b>Hold to charge, release to throw.</b> The cursor picks the direction, the ' +
        'hold picks the power — hold longer to reach the high and distant prisms. Space works too.</p>' +
        '<p>\u{1F48E} Shattered crystals rain <b>debris into the water</b> — every splash births <b>point bubbles</b>.</p>' +
        '<p>\u{1FAE7} Bubbles <b>float to the counting beam</b>. Banked bubbles are points. Your own orbs and falling ' +
        'debris <b>pop bubbles</b>, and popped points are gone.</p>' +
        '<p>\u{1FA9E} The <b>cascade is a mirror</b> — bank shots off it for angles you cannot reach directly.</p>' +
        '<p>⏱ A round ends when the clock runs out <b>or the moment the pool settles</b> — no crystals, ' +
        'no bubbles, nothing in the air. No more waiting out an empty screen.</p>' +
        '<p>⭐ <b>Three stars is meant to be hard.</b> Targets are set against what a strong player actually ' +
        'scores on that level, and the bar tightens as you climb.</p>' +
        '<p>\u{1F3AE} Three-star a level to unlock its <b>challenge runs</b> — Gale, Fogbank, Brittle, Rationed, ' +
        'Still Mirror and Tempest. They pay more and forgive nothing.</p>' +
        '<p>✨ Part of every round becomes <b>Stardrops</b>. Spend them in the Ability Tree, or on ' +
        '<b>Provisions</b> you can burn mid-round with keys 1-4.</p>' +
        '<p>\u{1F3C5} There are <b>' + (typeof PCAch !== 'undefined' ? PCAch.ALL.length : 50) + ' achievements</b>. ' +
        'A few of them are, frankly, unreasonable. Each one makes a share card.</p>' +
        '<p>\u{1F41F} The fish are friends. The shark is also a friend — everybody gets away.</p>' +
        '<p>\u{1F3F3} Not going well? <b>Give up</b> keeps whatever you banked and ends the round.</p>' +
        '<p class="credit">Crafted with \u{1F49B} by <b><a href="https://dhseadev.online" target="_blank" rel="noopener noreferrer">dhseadev.online</a></b></p></div>');
    },

    showRoundEnd(score, starsEarned, advanced, lvl, won, summary) {
      const th = game.thresholds;
      const m = L.challengeById(game.challenge);
      const starHtml = [1, 2, 3].map(i =>
        '<span class="star' + (starsEarned >= i ? ' lit' : '') + '" style="animation-delay:' + (i * 0.25) + 's">★</span>').join('');
      const next = Math.min(L.MAX_LEVEL, lvl + 1);
      const gave = summary && summary.gaveUp;
      let html =
        (m ? '<div class="mode-seal">' + m.icon + ' ' + m.name + ' run</div>' : '') +
        '<div class="stars-row">' + starHtml + '</div>' +
        '<div class="tally">' +
        '<div class="trow"><span>Banked</span><b>' + fmt(game.banked) + '</b></div>' +
        '<div class="trow lost"><span>Popped away</span><b>-' + fmt(game.lost) + '</b></div>' +
        '<div class="trow"><span>Best combo</span><b>' + game.bestCombo + '</b></div>' +
        (m ? '<div class="trow"><span>Run bonus</span><b>×' + m.scoreMult.toFixed(2) + '</b></div>' : '') +
        '<div class="trow big"><span>Round score</span><b>' + fmt(score) + '</b></div>' +
        '<div class="trow"><span>✨ Stardrops earned</span><b>+' + fmt(Math.round(score * L.stardropRate(game.save))) + '</b></div>' +
        '<div class="trow targets"><span>Targets</span><b>★ ' + fmt(th.one) + ' · ★★ ' + fmt(th.two) + ' · ★★★ ' + fmt(th.three) + '</b></div>' +
        '</div>';
      if (won && won.length) {
        html += '<div class="won"><h3>\u{1F3C5} Unlocked</h3>' +
          won.map(a => '<div class="wrow" style="border-color:' + PCAch.TIERS[a.tier].color + '">' +
            '<span class="wi">' + a.icon + '</span><span class="wn">' + esc(a.name) + '</span>' +
            '<span class="wd">' + esc(a.desc) + '</span>' +
            '<button class="mini" data-id="' + a.id + '">card</button></div>').join('') + '</div>';
      }
      html += '<div class="end-btns">' +
        (starsEarned >= 1 && lvl < L.MAX_LEVEL && !game.challenge ? '<button class="cta" id="btn-next">Next Level ➜</button>' : '') +
        '<button class="' + (starsEarned >= 1 ? 'ghost' : 'cta') + '" id="btn-retry">↻ Retry</button>' +
        '<button class="ghost" id="btn-tree2">✨ Abilities</button>' +
        '<button class="ghost" id="btn-map2">\u{1F5FA} Levels</button>' +
        '</div>' +
        (starsEarned >= 3 && lvl >= L.MAX_LEVEL ? '<p class="wintext">\u{1F3C6} LEVEL 100 MASTERED — you are the Prism Sovereign! \u{1F3C6}</p>' : '');
      this.panelShell(gave ? 'Round Ended' : (starsEarned ? 'Level ' + lvl + ' Clear!' : 'Time’s Up!'), html);
      this.els.panels.classList.add('open');
      this.els.panels.dataset.kind = 'end';
      const bn = $('#btn-next');
      if (bn) bn.addEventListener('click', () => { this.closePanels(); loadLevel(next, ''); });
      $('#btn-retry').addEventListener('click', () => { this.closePanels(); loadLevel(lvl, game.challenge); });
      $('#btn-tree2').addEventListener('click', () => this.togglePanel('tree'));
      $('#btn-map2').addEventListener('click', () => this.togglePanel('map'));
      this.els.panels.querySelectorAll('.wrow .mini').forEach(b => {
        b.addEventListener('click', () => shareCard(PCAch.byId(b.dataset.id)));
      });
      this.syncItems();
    },
  };

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(Math.round(n));
  }
  function esc(s2) { return String(s2 == null ? '' : s2).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Evaluate achievements outside a round (a purchase can complete one).
  function checkAchievements() {
    if (typeof PCAch === 'undefined') return [];
    const won = PCAch.evaluate(game.save, null);
    if (won.length) {
      for (const a of won) {
        AudioFX.achievement(a.tier);
        popup(W / 2, H * 0.34, '\u{1F3C5} ' + a.name, 'big gold');
      }
      persistSave();
    }
    return won;
  }

  // ============================== Share card ==============================
  // Draws an elegant PNG the player can post. Two modes: the profile card (rank + totals)
  // and a single-achievement card. Both carry the player's name and are downloaded directly;
  // nothing is uploaded anywhere, because there is no server to upload to.
  function shareCard(ach) {
    const name = (game.save.name || '').trim();
    if (!name) {
      const entered = prompt('Name for the card (14 characters):', '');
      if (entered === null) return;
      game.save.name = Array.from(entered).slice(0, 14).join('');
      persistSave();
    }
    const who = game.save.name || 'A Mysterious Player';
    const Wc = 1200, Hc = 675; // 16:9, comfortable on every social surface
    const c = document.createElement('canvas');
    c.width = Wc; c.height = Hc;
    const g = c.getContext('2d');
    const tierColor = ach ? PCAch.TIERS[ach.tier].color : '#8fe3ff';

    // --- background: deep water gradient with a light shaft ---
    const bg = g.createLinearGradient(0, 0, Wc * 0.4, Hc);
    bg.addColorStop(0, '#0d1440'); bg.addColorStop(0.55, '#1d2168'); bg.addColorStop(1, '#3a1a5e');
    g.fillStyle = bg; g.fillRect(0, 0, Wc, Hc);
    // shaft
    g.save();
    g.globalCompositeOperation = 'lighter';
    const shaft = g.createLinearGradient(Wc * 0.25, 0, Wc * 0.75, Hc);
    shaft.addColorStop(0, 'rgba(140,220,255,0.05)');
    shaft.addColorStop(1, 'rgba(140,220,255,0)');
    g.fillStyle = shaft;
    // three nested wedges instead of one: a single hard-edged polygon read as a seam
    for (const k of [1, 0.72, 0.44]) {
      const c0 = 0.35 - 0.17 * k, c1 = 0.35 + 0.17 * k;
      g.beginPath();
      g.moveTo(Wc * c0, 0); g.lineTo(Wc * c1, 0);
      g.lineTo(Wc * (c1 + 0.34), Hc); g.lineTo(Wc * (c0 + 0.34), Hc);
      g.closePath(); g.fill();
    }
    g.restore();
    // stars + drifting bubbles
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(210,230,255,' + (0.15 + Math.random() * 0.5) + ')';
      g.fillRect(Math.random() * Wc, Math.random() * Hc, 2, 2);
    }
    for (let i = 0; i < 26; i++) {
      const bx = Math.random() * Wc, by = Math.random() * Hc, br = 4 + Math.random() * 22;
      const bgr = g.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
      bgr.addColorStop(0, 'rgba(255,255,255,0.16)');
      bgr.addColorStop(0.7, 'rgba(160,225,255,0.07)');
      bgr.addColorStop(1, 'rgba(160,225,255,0)');
      g.fillStyle = bgr;
      g.beginPath(); g.arc(bx, by, br, 0, 6.29); g.fill();
    }
    // frame
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2;
    g.strokeRect(28, 28, Wc - 56, Hc - 56);
    g.strokeStyle = tierColor; g.lineWidth = 4;
    g.beginPath(); g.moveTo(28, 28); g.lineTo(28 + 150, 28); g.moveTo(28, 28); g.lineTo(28, 28 + 110); g.stroke();
    g.beginPath(); g.moveTo(Wc - 28, Hc - 28); g.lineTo(Wc - 28 - 150, Hc - 28); g.moveTo(Wc - 28, Hc - 28); g.lineTo(Wc - 28, Hc - 28 - 110); g.stroke();

    const F = (w, sz) => w + ' ' + sz + 'px Rubik, Segoe UI, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(190,215,255,0.75)'; g.font = F(600, 26);
    g.fillText('P R I S M   C A S C A D E', Wc / 2, 92);

    if (ach) {
      g.font = F(400, 140);
      g.fillText(ach.icon, Wc / 2, 260);
      g.fillStyle = tierColor; g.font = F(700, 22);
      g.fillText(PCAch.TIERS[ach.tier].name.toUpperCase() + '  ·  ACHIEVEMENT UNLOCKED', Wc / 2, 312);
      g.fillStyle = '#ffffff'; g.font = F(800, 62);
      g.fillText(ach.name, Wc / 2, 388);
      g.fillStyle = '#c9d4ff'; g.font = F(400, 27);
      wrap(g, ach.desc, Wc / 2, 434, Wc - 260, 36);
      g.fillStyle = '#ffffff'; g.font = F(600, 30);
      g.fillText(who, Wc / 2, Hc - 132);
      g.fillStyle = 'rgba(190,215,255,0.7)'; g.font = F(400, 22);
      g.fillText('Level ' + game.save.level + '  ·  ' + PCAch.rankFor(PCAch.progress(game.save).points), Wc / 2, Hc - 100);
    } else {
      const p = PCAch.progress(game.save);
      g.fillStyle = '#ffffff'; g.font = F(700, 54);
      g.fillText(who, Wc / 2, 176);
      g.fillStyle = tierColor; g.font = F(600, 28);
      g.fillText(PCAch.rankFor(p.points), Wc / 2, 220);
      g.fillStyle = '#ffd257'; g.font = F(800, 104);
      g.fillText(fmt(game.save.bestRound), Wc / 2, 336);
      g.fillStyle = '#c9d4ff'; g.font = F(500, 26);
      g.fillText('best round', Wc / 2, 372);
      // three stat columns
      const stats = [
        ['Level', String(game.save.level)],
        ['Stars', L.totalStars(game.save) + ' / ' + (L.MAX_LEVEL * 3)],
        ['Achievements', p.got + ' / ' + p.total],
      ];
      stats.forEach((st, i) => {
        const x = Wc * (0.25 + i * 0.25);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        roundRect(g, x - 140, 420, 280, 96, 16); g.fill();
        g.fillStyle = '#ffffff'; g.font = F(700, 38);
        g.fillText(st[1], x, 472);
        g.fillStyle = 'rgba(190,215,255,0.8)'; g.font = F(500, 20);
        g.fillText(st[0], x, 500);
      });
    }
    g.fillStyle = 'rgba(160,180,255,0.72)'; g.font = F(500, 21);
    g.fillText('dhseadev.online', Wc / 2, Hc - 52);

    const a = document.createElement('a');
    a.download = 'prism-cascade-' + (ach ? ach.id : 'profile') + '.png';
    a.href = c.toDataURL('image/png');
    a.click();
  }
  function wrap(g, text, x, y, maxW, lh) {
    const words = String(text).split(' ');
    let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; }
      else line = test;
    }
    if (line) g.fillText(line, x, yy);
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ============================== Input ==============================
  function initInput() {
    cv.addEventListener('mousemove', (e) => { game.aim.x = e.clientX; game.aim.y = e.clientY; });
    cv.addEventListener('mousedown', (e) => {
      if (AX) AX.unlock();
      game.aim.x = e.clientX; game.aim.y = e.clientY;
      if (game.mode === 'play') beginCharge();
      else if (game.mode === 'tally' && !ui.els.panels.classList.contains('open')) loadLevel(game.level.level, game.challenge);
    });
    window.addEventListener('mouseup', (e) => {
      if (game.mode === 'play' && game.charge.active) releaseCharge(e.clientX, e.clientY);
      else cancelCharge();
    });
    // leaving the window mid-charge should not leave a humming oscillator behind
    window.addEventListener('blur', cancelCharge);
    cv.addEventListener('touchstart', (e) => {
      if (AX) AX.unlock();
      const t = e.touches[0];
      game.aim.x = t.clientX; game.aim.y = t.clientY;
      if (game.mode === 'play') beginCharge();
      e.preventDefault();
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      game.aim.x = t.clientX; game.aim.y = t.clientY;
      e.preventDefault();
    }, { passive: false });
    cv.addEventListener('touchend', (e) => {
      if (game.mode === 'play' && game.charge.active) releaseCharge(game.aim.x, game.aim.y);
      else cancelCharge();
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      // 1-4 spend a consumable mid-round
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0 && L.CONSUMABLES[idx]) { useItem(L.CONSUMABLES[idx].id); return; }
      if (e.key === ' ') {
        // space is a second way to charge, for players who would rather not hold a mouse button
        if (game.mode === 'play' && !game.charge.active) { if (AX) AX.unlock(); beginCharge(); }
        e.preventDefault();
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ' && game.charge.active) releaseCharge(game.aim.x, game.aim.y);
    });
  }

  // ============================== Consumables ==============================
  function useItem(id) {
    if (game.mode !== 'play') return;
    if (!L.consumableById(id)) return;
    if ((game.save.items[id] | 0) <= 0) { AudioFX.deny(); return; }
    if (!L.useConsumable(game.save, id)) { AudioFX.deny(); return; }
    game.round.itemsUsed++;
    AudioFX.item();
    if (id === 'storm') { game.fx.storm = 3; popup(G.launch.x, G.launch.y - 50, '\u{1F329} PRISM STORM', 'big gold'); }
    if (id === 'still') { game.fx.still = 6; popup(W / 2, G.waterY - 60, '\u{1FAB7} STILL WATER', 'big'); }
    if (id === 'golden') { game.fx.golden = 2; popup(W / 2, G.waterY - 60, '\u{1FA99} GOLDEN TIDE', 'big gold'); }
    if (id === 'dilate') {
      game.timeLeft += 8; game.duration += 8;
      popup(W / 2, H * 0.3, '⏱ +8 SECONDS', 'big');
    }
    persistSave();
    ui.syncItems();
    ui.syncHud();
  }

  // ============================== Main loop ==============================
  let raf = 0;
  function frame(t) {
    const dt = Math.min(0.033, (t - game.lastTick) / 1000 || 0.016);
    game.lastTick = t;
    stepAmbient(dt, t);
    if (game.mode === 'play' || game.mode === 'grace') step(dt);
    else { stepWater(dt); stepFireworks(dt); for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age >= p.life) parts.splice(i, 1); else { p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; } } }
    render(t);
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { game.lastTick = performance.now(); raf = requestAnimationFrame(frame); }
  });

  // ============================== Boot ==============================
  async function boot() {
    resize(); initWater(); initStars(); initAmbient(); initClouds(); ui.init(); initInput();
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    if (calm) { game.reduceFx = calm.matches; calm.addEventListener('change', e => { game.reduceFx = e.matches; }); }
    const rawSave = await store.get(L.SAVE_KEY);
    // v1 payloads are migrated in validateSave — progress carries over, the old local
    // leaderboard is dropped with the feature.
    game.save = L.validateSave(rawSave);
    game.stats = L.derivedStats(game.save.tree, game.save.endow);
    if (AX) { AX.setMusic(game.save.settings.music !== false); AX.setSfx(game.save.settings.sfx !== false); }
    const mb = $('#btn-music'), sb = $('#btn-sfx');
    if (mb) { const on = game.save.settings.music !== false; mb.textContent = on ? '\u{1F3B5}' : '\u{1F507}'; mb.classList.toggle('off', !on); }
    if (sb) { const on = game.save.settings.sfx !== false; sb.textContent = on ? '\u{1F50A}' : '\u{1F515}'; sb.classList.toggle('off', !on); }
    checkAchievements();
    loadLevel(game.save.level, '');
    // greet
    if (!rawSave) ui.togglePanel('help');
    raf = requestAnimationFrame(frame);
  }
  // test/debug hook (read-only inspection; harmless in production)
  if (typeof window !== 'undefined') { window.__PC_shareProfile = () => shareCard(null); window.__PC_shareAch = (id) => shareCard(PCAch.byId(id)); }
  if (typeof window !== 'undefined') window.__PC = { game, orbs, shards, bubbles, crystals, fish, drops, shark, seabed, TIERS, fire: fireVolley, giveUp, useItem, loadLevel };
  boot();
})();
