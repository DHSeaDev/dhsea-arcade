
/* =====================================================================
   BLOOM RUSH — app1.js : boot, art library, particles, tweens, audio, UI
   ===================================================================== */
'use strict';
const Core = window.BloomCore;
const { CFG, ARCH, SPECIES, POT_COLORS, VENUES, LEVELS, UPGRADES, ACHIEVEMENTS, QUESTS } = Core;
const W = CFG.W, H = CFG.H;

// ------------------------------------------------------------- canvas
const canvas = document.getElementById('game');
canvas.width = W; canvas.height = H;
let ctx = canvas.getContext('2d');   // `let`: the share-card renderer temporarily swaps in an offscreen context via setCtx()
function fitCanvas() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
window.addEventListener('resize', fitCanvas); fitCanvas();
// While the rotate overlay is up the game is not operable: take the canvas out of the tab
// order and blur it, so a keyboard/AT user is not navigating a screen they cannot see.
function syncRotateGate() {
  const covered = getComputedStyle(document.getElementById('rotate')).display !== 'none';
  canvas.setAttribute('aria-hidden', covered ? 'true' : 'false');
  canvas.tabIndex = covered ? -1 : 0;
  if (covered && document.activeElement === canvas) canvas.blur();
}
window.addEventListener('resize', syncRotateGate);
window.addEventListener('orientationchange', syncRotateGate);
setTimeout(syncRotateGate, 0);

// pointer → game coords
function evPos(e) {
  const r = canvas.getBoundingClientRect();
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
}

// ------------------------------------------------------------ helpers
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = { out: t => 1 - Math.pow(1 - t, 3), inout: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function shade(hex, amt) { // lighten(+)/darken(-) a #rrggbb
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
let NOW = 0; // global animation clock (seconds)
// Respected nowhere before: the title bobs, benches pulse, scene changes run a 0.8s
// twelve-leaf wipe and results fires forty confetti particles. Live-updated, so toggling
// the OS setting takes effect without a reload.
let REDUCED = false;
try {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  REDUCED = mq.matches;
  mq.addEventListener ? mq.addEventListener('change', e => { REDUCED = e.matches; })
                      : mq.addListener(e => { REDUCED = e.matches; });
} catch (_) { REDUCED = false; }

// ------------------------------------------------------------- tweens
const tweens = [];
function tween(obj, props, dur, easing, done) {
  const from = {}; for (const k in props) from[k] = obj[k];
  tweens.push({ obj, from, to: props, t: 0, dur, easing: easing || ease.out, done });
}
function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt;
    const k = clamp(tw.t / tw.dur, 0, 1), e = tw.easing(k);
    for (const p in tw.to) tw.obj[p] = lerp(tw.from[p], tw.to[p], e);
    if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
}

// ----------------------------------------------------------- particles
const parts = [];
function puff(x, y, opts) {
  opts = opts || {};
  const n = opts.n || 8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = (opts.speed || 60) * (0.4 + Math.random() * 0.9);
    parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 30),
      life: 0, max: (opts.life || 0.7) * (0.7 + Math.random() * 0.6),
      size: (opts.size || 4) * (0.6 + Math.random() * 0.8),
      color: opts.color || '#8fd06a', kind: opts.kind || 'dot', g: opts.g == null ? 120 : opts.g,
      rot: Math.random() * TAU, vr: (Math.random() - .5) * 6,
    });
  }
}
function floatText(x, y, text, color, big) {
  parts.push({ x, y, vx: 0, vy: -42, life: 0, max: 1.1, kind: 'text', text, color: color || '#fff', size: big ? 22 : 15, g: -20 });
}
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; }
    p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
  }
}
function drawParts() {
  for (const p of parts) {
    const k = 1 - p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 2);
    if (p.kind === 'text') {
      ctx.font = `bold ${p.size}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,40,25,.75)';
      ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    } else if (p.kind === 'petal') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
    } else if (p.kind === 'drop') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke();
    } else if (p.kind === 'spark') {
      ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -1, p.size, 2); ctx.fillRect(-1, -p.size / 2, 2, p.size); ctx.restore();
    } else if (p.kind === 'heart') {
      drawHeart(p.x, p.y, p.size, p.color);
    } else {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawHeart(x, y, s, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.45, x - s * 0.5, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s, y - s * 0.45, x, y + s * 0.35);
  ctx.fill();
}

// -------------------------------------------------------------- audio
const AudioSys = (() => {
  let ac = null, master = null, sfxGain = null, musGain = null;
  let sfxOn = true, musOn = true, started = false;
  let pendingMood = null, unlocked = false;
  function ensure() {
    // Chrome's autoplay policy: constructing an AudioContext at load logs a warning and
    // leaves it suspended, so the first load was both silent AND noisy. Nothing is built
    // until a real gesture (pointerdown / keydown) has called unlock().
    if (!unlocked) return;
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
      sfxGain = ac.createGain(); sfxGain.connect(master);
      musGain = ac.createGain(); musGain.gain.value = 0.32; musGain.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function blip(freq, dur, type, vol, slide) {
    if (!sfxOn) return; ensure();
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.18, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(sfxGain); o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!sfxOn) return; ensure();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1800; f.Q.value = 0.8;
    const g = ac.createGain(); g.gain.value = vol || 0.12;
    src.connect(f); f.connect(g); g.connect(sfxGain); src.start();
  }
  const sfx = {
    click:   () => blip(660, 0.07, 'triangle', 0.12),
    seat:    () => { blip(392, 0.1, 'triangle', 0.14); blip(523, 0.12, 'triangle', 0.12); },
    match:   () => { blip(523, 0.09, 'sine', .15); setTimeout(() => blip(659, 0.09, 'sine', .15), 70); setTimeout(() => blip(784, 0.14, 'sine', .16), 140); },
    order:   () => blip(494, 0.09, 'square', 0.06, 590),
    ready:   () => { blip(880, 0.1, 'sine', 0.14); setTimeout(() => blip(1174, 0.12, 'sine', .12), 90); },
    deliver: () => noise(0.18, 0.10, 900),
    water:   () => noise(0.3, 0.12, 2400),
    coin:    () => { blip(988, 0.07, 'square', 0.08); setTimeout(() => blip(1319, 0.16, 'square', .08), 60); },
    chain:   (n) => blip(523 * Math.pow(1.122, Math.min(n, 8)), 0.12, 'triangle', 0.15),
    angry:   () => blip(220, 0.4, 'sawtooth', 0.10, 110),
    wash:    () => noise(0.35, 0.10, 3000),
    sing:    () => { blip(659, .12, 'sine', .13); setTimeout(() => blip(784, .12, 'sine', .13), 110); setTimeout(() => blip(988, .2, 'sine', .13), 220); },
    star:    () => { blip(784, .12, 'sine', .16); setTimeout(() => blip(988, .12, 'sine', .16), 110); setTimeout(() => blip(1319, .3, 'sine', .17), 220); },
    fail:    () => { blip(330, .25, 'sawtooth', .08, 220); setTimeout(() => blip(220, .4, 'sawtooth', .08, 147), 180); },
    toast:   () => { blip(587, .1, 'triangle', .12); setTimeout(() => blip(880, .16, 'triangle', .12), 90); },
    page:    () => noise(0.12, 0.07, 1200),
  };
  // generative ambient music: soft pentatonic plucks per venue root
  let musTimer = null, musStep = 0;
  const scales = { morning: [0, 2, 4, 7, 9], rain: [0, 3, 5, 7, 10], evening: [0, 2, 4, 7, 9], night: [0, 3, 5, 7, 10], golden: [0, 2, 4, 7, 9], title: [0, 2, 4, 7, 9] };
  const roots = { morning: 262, rain: 233, evening: 220, night: 196, golden: 247, title: 220 };
  function pluck(freq, vol) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 1600;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.6);
    o.connect(f); f.connect(g); g.connect(musGain); o.start(); o.stop(ac.currentTime + 1.7);
  }
  function startMusic(mood) {
    // Before the first gesture there is no context to start on; remember the mood and let
    // unlock() start it, instead of constructing a suspended context at load time.
    if (!unlocked) { pendingMood = mood; return; }
    stopMusic(); if (!musOn) return; ensure();
    const scale = scales[mood] || scales.title, root = roots[mood] || 220;
    musStep = 0;
    musTimer = setInterval(() => {
      if (!musOn) return;
      musStep++;
      if (Math.random() < 0.62) {
        const deg = scale[Math.floor(Math.random() * scale.length)];
        const oct = Math.random() < 0.25 ? 2 : 1;
        pluck(root * Math.pow(2, deg / 12) * oct, 0.05 + Math.random() * 0.05);
      }
      if (musStep % 8 === 0) pluck(root / 2, 0.07);
    }, 430);
  }
  function stopMusic() { if (musTimer) { clearInterval(musTimer); musTimer = null; } }
  return {
    sfx, startMusic, stopMusic, ensure,
    get sfxOn() { return sfxOn; }, get musOn() { return musOn; },
    toggleSfx() { sfxOn = !sfxOn; }, toggleMus(mood) { musOn = !musOn; if (musOn) startMusic(mood); else stopMusic(); },
    unlock() { if (!unlocked) { unlocked = true; started = true; ensure(); if (pendingMood) { const m = pendingMood; pendingMood = null; startMusic(m); } } },
  };
})();
const S = AudioSys.sfx;

// ============================================================ ART LIB
// -- pot ---------------------------------------------------------------
function drawPot(x, y, w, color, glyph, dirty) {
  const c = dirty ? '#7a6a58' : color;
  const h = w * 0.62;
  ctx.save(); ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(20,30,15,.18)'; ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * 0.62, w * 0.16, 0, 0, TAU); ctx.fill();
  // body (trapezoid with rounded bottom)
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, shade(c, -28)); grad.addColorStop(0.35, shade(c, 14)); grad.addColorStop(1, shade(c, -38));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, -h * 0.28);
  ctx.lineTo(w * 0.46, -h * 0.28);
  ctx.lineTo(w * 0.34, h * 0.42);
  ctx.quadraticCurveTo(0, h * 0.55, -w * 0.34, h * 0.42);
  ctx.closePath(); ctx.fill();
  // rim
  const rimg = ctx.createLinearGradient(0, -h * 0.5, 0, -h * 0.2);
  rimg.addColorStop(0, shade(c, 26)); rimg.addColorStop(1, shade(c, -16));
  ctx.fillStyle = rimg;
  rr(-w * 0.52, -h * 0.52, w * 1.04, h * 0.26, 4); ctx.fill();
  // glyph badge (colorblind support)
  if (!dirty && glyph) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    drawGlyph(glyph, 0, h * 0.06, w * 0.13);
  }
  if (dirty) { // grime
    ctx.fillStyle = 'rgba(60,45,30,.5)';
    ctx.beginPath(); ctx.arc(-w * 0.15, 0, w * 0.09, 0, TAU); ctx.arc(w * 0.18, h * 0.15, w * 0.07, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawGlyph(glyph, x, y, s) {
  ctx.beginPath();
  if (glyph === 'circle') ctx.arc(x, y, s, 0, TAU);
  else if (glyph === 'square') ctx.rect(x - s, y - s, s * 2, s * 2);
  else if (glyph === 'triangle') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.closePath(); }
  else if (glyph === 'diamond') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); }
  else if (glyph === 'star') { for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s, a = -Math.PI / 2 + i * Math.PI / 5; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
  ctx.fill();
}

// -- plants ------------------------------------------------------------
// Each species: layered vector foliage with sway + wilt droop.
function drawPlant(species, x, y, scale, opts) {
  opts = opts || {};
  const wilt = opts.wilt == null ? 0 : opts.wilt;          // 0 happy .. 1 dying
  const sway = Math.sin(NOW * 1.6 + x * 0.05) * (1 - wilt * 0.7) * 0.06;
  const droop = wilt * 0.55;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(sway * 0.4);
  const g = (hex, amt) => shade(hex, amt);
  const leaf = (ang, len, wid, color, curl) => {
    ctx.save(); ctx.rotate(ang + droop * (ang > 0 ? 0.6 : -0.6));
    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, g(color, -30)); grad.addColorStop(0.6, color); grad.addColorStop(1, g(color, 22));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid, -len * 0.35, -wid * (1 - (curl || 0)), -len * 0.85, 0, -len);
    ctx.bezierCurveTo(wid * (1 - (curl || 0)), -len * 0.85, wid, -len * 0.35, 0, 0);
    ctx.fill();
    // midrib
    ctx.strokeStyle = withAlpha(g(color, 34), 0.7); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(0, -len * 0.5, 0, -len * 0.92); ctx.stroke();
    ctx.restore();
  };
  switch (species) {
    case 'sprout': case 'basil': {
      const c = species === 'basil' ? '#3f9142' : '#5cb85c';
      ctx.strokeStyle = '#67a04a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(1, -12, 0, -20); ctx.stroke();
      leaf(-0.7, 22, 9, c); leaf(0.7, 22, 9, c);
      if (species === 'basil') { leaf(-0.25, 30, 10, g(c, 12)); leaf(0.25, 30, 10, g(c, 12)); }
      else { ctx.fillStyle = '#8fd06a'; ctx.beginPath(); ctx.arc(0, -22, 4, 0, TAU); ctx.fill(); }
      break;
    }
    case 'fern': case 'maiden': {
      const c = species === 'maiden' ? '#7cc47f' : '#3e8e41';
      for (let i = 0; i < 7; i++) {
        const a = -1.15 + i * 0.38;
        ctx.save(); ctx.rotate(a * 0.75 + droop * (a > 0 ? 0.5 : -0.5));
        const L = 34 + (i % 2) * 8;
        ctx.strokeStyle = g(c, -20); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -L * 0.5, 2, -L); ctx.stroke();
        for (let j = 1; j < 7; j++) {
          const t2 = j / 7, px = lerp(0, 2, t2) + 4 * Math.sin(t2 * 3), py = -L * t2;
          ctx.fillStyle = g(c, j * 4 - 10);
          ctx.beginPath(); ctx.ellipse(px - 4, py, 5.5, 2.2, -0.5, 0, TAU); ctx.ellipse(px + 4, py, 5.5, 2.2, 0.5, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
    case 'saguaro': {
      const c = '#4c8f5d';
      const arm = (sx, hgt) => {
        ctx.fillStyle = ctx.createLinearGradient ? (() => { const gr = ctx.createLinearGradient(sx - 8, 0, sx + 8, 0); gr.addColorStop(0, g(c, -26)); gr.addColorStop(0.5, g(c, 10)); gr.addColorStop(1, g(c, -30)); return gr; })() : c;
        rr(sx - 8, -hgt, 16, hgt, 8); ctx.fill();
        ctx.strokeStyle = withAlpha(g(c, -40), .5); ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx + i * 4.5, -6); ctx.lineTo(sx + i * 4.5, -hgt + 8); ctx.stroke(); }
      };
      arm(0, 52 - droop * 8);
      rr(-20, -30, 12, 18, 6); ctx.fillStyle = g(c, -8); ctx.fill();
      rr(14, -24, 11, 14, 5); ctx.fill();
      // spines
      ctx.strokeStyle = 'rgba(240,240,210,.8)'; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const yy = -8 - i * 5; ctx.beginPath(); ctx.moveTo(-9, yy); ctx.lineTo(-12, yy - 2); ctx.moveTo(9, yy); ctx.lineTo(12, yy - 2); ctx.stroke(); }
      // little flower crown when happy
      if (wilt < 0.3) { ctx.fillStyle = '#e97fb2'; ctx.beginPath(); ctx.arc(0, -56, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd66b'; ctx.beginPath(); ctx.arc(0, -56, 1.8, 0, TAU); ctx.fill(); }
      break;
    }
    case 'barrel': {
      const c = '#5a9e63';
      const grB = ctx.createRadialGradient(-6, -18, 4, 0, -16, 26);
      grB.addColorStop(0, g(c, 22)); grB.addColorStop(1, g(c, -24));
      ctx.fillStyle = grB;
      ctx.beginPath(); ctx.ellipse(0, -16, 22, 20 - droop * 3, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = withAlpha(g(c, -42), .6); ctx.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, -16, Math.abs(i) * 8 + 2, 20 - droop * 3, 0, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); ctx.stroke(); }
      ctx.fillStyle = '#ffd66b'; ctx.beginPath(); ctx.arc(0, -36 + droop * 4, 4.5, 0, TAU); ctx.fill();
      break;
    }
    case 'orchid': case 'vanda': {
      const stem = '#6d9b4f', pink = species === 'vanda' ? '#8f6fd9' : '#e97fb2';
      ctx.strokeStyle = stem; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(4, -20, -6 - droop * 14, -34, 8 - droop * 20, -52 + droop * 14); ctx.stroke();
      leaf(-0.9, 20, 8, '#4c8f5d'); leaf(0.95, 18, 7, '#4c8f5d');
      const bloom = (bx, by, s2) => {
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 + sway;
          ctx.fillStyle = i % 2 ? pink : g(pink, 22);
          ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
          ctx.beginPath(); ctx.ellipse(0, -s2 * 0.7, s2 * 0.42, s2 * 0.75, 0, 0, TAU); ctx.fill(); ctx.restore();
        }
        ctx.fillStyle = '#ffd66b'; ctx.beginPath(); ctx.arc(bx, by, s2 * 0.3, 0, TAU); ctx.fill();
      };
      bloom(8 - droop * 20, -54 + droop * 14, 11);
      bloom(-2 - droop * 10, -36 + droop * 8, 7);
      break;
    }
    case 'monstera': {
      const c = '#2f7d46';
      for (let i = 0; i < 3; i++) {
        const a = -0.7 + i * 0.7;
        ctx.save(); ctx.rotate(a * 0.7 + droop * (a > 0 ? .5 : -.5));
        ctx.strokeStyle = g(c, -14); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
        ctx.translate(0, -42);
        const grM = ctx.createLinearGradient(0, 14, 0, -14);
        grM.addColorStop(0, g(c, -18)); grM.addColorStop(1, g(c, 20));
        ctx.fillStyle = grM;
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 17, 0, 0, TAU); ctx.fill();
        // fenestrations
        ctx.fillStyle = opts.bgColor || '#204030';
        for (let s2 = -1; s2 <= 1; s2 += 2) for (let j2 = 0; j2 < 3; j2++) {
          ctx.beginPath(); ctx.ellipse(s2 * 8, -8 + j2 * 8, 4.5, 2, s2 * 0.5, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
    case 'venus': {
      const c = '#4f9e4f';
      leaf(-1.0, 18, 6, c); leaf(1.0, 18, 6, c);
      const head = (hx, hy, s2, open) => {
        ctx.save(); ctx.translate(hx, hy);
        ctx.strokeStyle = '#6aa84f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-hx * 0.8, -hy * 0.3 + 20); ctx.quadraticCurveTo(0, 8, 0, 2); ctx.stroke();
        const openA = open * 0.7;
        for (const side of [-1, 1]) {
          ctx.save(); ctx.rotate(side * openA);
          ctx.fillStyle = side < 0 ? '#c94f6d' : '#d95f7d';
          ctx.beginPath(); ctx.ellipse(0, -s2 * 0.5, s2 * 0.55, s2 * 0.72, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s2 * .4 + i * s2 * .27, -s2 * 1.1); ctx.lineTo(-s2 * .33 + i * s2 * .27, -s2 * 0.86); ctx.lineTo(-s2 * .26 + i * s2 * .27, -s2 * 1.1); ctx.fill(); }
          ctx.restore();
        }
        ctx.restore();
      };
      const chomp = 0.35 + 0.3 * Math.sin(NOW * 5 + x);
      head(-9, -30 + droop * 8, 10, chomp);
      head(10, -38 + droop * 10, 12, 0.5 - chomp * 0.4);
      break;
    }
    case 'echeveria': case 'string': {
      const c = species === 'string' ? '#79b077' : '#8fb98b';
      const rosette = (rx, ry, s2) => {
        for (let ring = 2; ring >= 0; ring--) {
          const n = 6 + ring * 3, rs = s2 * (0.45 + ring * 0.3);
          for (let i = 0; i < n; i++) {
            const a = i * TAU / n + ring * 0.3;
            ctx.fillStyle = shade(c, ring * 14 - 12);
            ctx.save(); ctx.translate(rx, ry); ctx.rotate(a);
            ctx.beginPath(); ctx.ellipse(0, -rs, s2 * 0.2, rs * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
          }
        }
        ctx.fillStyle = shade(c, 30); ctx.beginPath(); ctx.arc(rx, ry, s2 * 0.16, 0, TAU); ctx.fill();
      };
      if (species === 'string') {
        ctx.strokeStyle = '#67a04a'; ctx.lineWidth = 1.6;
        for (const sd of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(sd * 6, -6);
          ctx.quadraticCurveTo(sd * 18, 10 + droop * 8, sd * 14, 26);
          ctx.stroke();
          for (let i = 1; i < 5; i++) { ctx.fillStyle = shade(c, i * 4); ctx.beginPath(); ctx.arc(sd * (6 + i * 2.4), -6 + i * 7, 3.4, 0, TAU); ctx.fill(); }
        }
        rosette(-8, -14, 12); rosette(9, -10, 10);
      } else { rosette(-10, -12, 14); rosette(11, -9, 11); }
      break;
    }
  }
  ctx.restore();
}

// -- plant + pot combo (entity view) ----------------------------------
function drawPottedPlant(p, x, y, scale, benchColorIdx, dirtyPotOnly) {
  const potC = POT_COLORS[p ? p.color : benchColorIdx];
  if (!p) { drawPot(x, y, 46 * scale, POT_COLORS[benchColorIdx].hex, POT_COLORS[benchColorIdx].glyph, dirtyPotOnly); return; }
  const wilt = 1 - clamp(p.hearts / CFG.heartsMax, 0, 1);
  drawPot(x, y, 46 * scale, POT_COLORS[p.bench != null ? (p.matched ? p.color : (benchColorIdx == null ? p.color : benchColorIdx)) : p.color].hex,
    POT_COLORS[p.bench != null && benchColorIdx != null ? benchColorIdx : p.color].glyph, false);
  drawPlant(p.species, x, y - 16 * scale, scale, { wilt });
}

// -- hero (Sage) -------------------------------------------------------
function drawHero(x, y, moving, carry, facing) {
  const bob = moving ? Math.sin(NOW * 14) * 2.2 : Math.sin(NOW * 2.4) * 1.1;
  const legSwing = moving ? Math.sin(NOW * 14) * 6 : 0;
  ctx.save(); ctx.translate(x, y + bob * 0.3);
  if (facing < 0) ctx.scale(-1, 1);
  // shadow
  ctx.fillStyle = 'rgba(20,30,15,.22)'; ctx.beginPath(); ctx.ellipse(0, 4, 16, 5, 0, 0, TAU); ctx.fill();
  // legs
  ctx.strokeStyle = '#4a6741'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(-4 + legSwing * 0.4, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(4 - legSwing * 0.4, 0); ctx.stroke();
  // boots
  ctx.fillStyle = '#8a5a33';
  rr(-8 + legSwing * 0.4, -3, 8, 5, 2); ctx.fill();
  rr(0 - legSwing * 0.4, -3, 8, 5, 2); ctx.fill();
  // body / apron
  const bodyG = ctx.createLinearGradient(0, -46, 0, -14);
  bodyG.addColorStop(0, '#7fae6b'); bodyG.addColorStop(1, '#5d8a4e');
  ctx.fillStyle = bodyG;
  rr(-11, -44 - bob, 22, 28, 8); ctx.fill();
  ctx.fillStyle = '#e8dcc0'; // apron (trapezoid bib)
  ctx.beginPath();
  ctx.moveTo(-5, -38 - bob); ctx.lineTo(5, -38 - bob);
  ctx.lineTo(8, -18 - bob); ctx.quadraticCurveTo(0, -15 - bob, -8, -18 - bob);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c9b689'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-4, -25 - bob); ctx.lineTo(4, -25 - bob); ctx.stroke(); // pocket seam
  ctx.fillStyle = '#8fd06a'; ctx.beginPath(); ctx.arc(0, -27 - bob, 1.8, 0, TAU); ctx.fill(); // sprout pin
  // arms
  ctx.strokeStyle = '#7fae6b'; ctx.lineWidth = 4.5;
  const armSwing = moving ? Math.sin(NOW * 14 + Math.PI) * 5 : 0;
  ctx.beginPath(); ctx.moveTo(-10, -38 - bob); ctx.lineTo(-14 + armSwing * .3, -24 - bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, -38 - bob); ctx.lineTo(14 - armSwing * .3, -24 - bob); ctx.stroke();
  // head
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(0, -53 - bob, 10.5, 0, TAU); ctx.fill();
  // hair bun + fringe
  ctx.fillStyle = '#7a4b2a';
  ctx.beginPath(); ctx.arc(0, -58 - bob, 10.5, Math.PI, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -63 - bob, 5, 0, TAU); ctx.fill();
  // face
  const blink = (Math.sin(NOW * 0.7) > 0.985) ? 0.2 : 1;
  ctx.fillStyle = '#3a2e24';
  ctx.beginPath(); ctx.ellipse(3.5, -53 - bob, 1.5, 1.9 * blink, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8.2, -53 - bob, 1.5, 1.9 * blink, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c96b4a'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(6, -49 - bob, 2.6, 0.15, Math.PI - 0.15); ctx.stroke();
  // bandana
  ctx.fillStyle = '#c8622f';
  rr(-10.5, -60 - bob, 21, 4.6, 3); ctx.fill();
  // carried items float above
  let ci = 0;
  for (const c of carry) {
    const cx = -10 + ci * 20, cy = -76 - bob;
    if (c.type === 'mix') {
      ctx.fillStyle = '#d9c9a3'; rr(cx - 7, cy - 4, 14, 10, 3); ctx.fill();
      ctx.fillStyle = '#8a6a43'; rr(cx - 5, cy - 2, 10, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#8fd06a'; ctx.beginPath(); ctx.arc(cx, cy - 6, 3, 0, TAU); ctx.fill();
    } else {
      drawPot(cx, cy, 18, '#7a6a58', null, true);
    }
    ci++;
  }
  ctx.restore();
}

// -- speech bubble ------------------------------------------------------
function drawBubble(x, y, w, h, point) {
  ctx.fillStyle = 'rgba(255,255,252,.96)';
  ctx.strokeStyle = 'rgba(90,80,60,.35)'; ctx.lineWidth = 1.5;
  rr(x - w / 2, y - h, w, h, 8); ctx.fill(); ctx.stroke();
  if (point !== false) {
    ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x, y + 7); ctx.lineTo(x + 5, y - 1);
    ctx.fillStyle = 'rgba(255,255,252,.96)'; ctx.fill();
  }
}
// state icons inside bubbles
function drawStateIcon(kind, x, y, s, t) {
  switch (kind) {
    case 'dots': {
      for (let i = 0; i < 3; i++) {
        const on = Math.floor(NOW * 2.4) % 3 === i;
        ctx.fillStyle = on ? '#6a8a55' : '#c9c4b2';
        ctx.beginPath(); ctx.arc(x - s + i * s, y, s * 0.28, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'order': { // scoop + "!"
      ctx.fillStyle = '#8a6a43'; rr(x - s * .9, y - s * .2, s * 1.2, s * .6, 2); ctx.fill();
      ctx.strokeStyle = '#6a5233'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + s * .3, y + s * .1); ctx.lineTo(x + s * .9, y - s * .5); ctx.stroke();
      ctx.fillStyle = '#d9534f'; ctx.font = `bold ${Math.round(s * 1.5)}px 'Trebuchet MS'`; ctx.textAlign = 'center'; ctx.fillText('!', x + s * 1.6, y + s * .5);
      break;
    }
    case 'wait': { // hourglass
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - s * .6, y - s * .8); ctx.lineTo(x + s * .6, y - s * .8); ctx.lineTo(x - s * .6, y + s * .8); ctx.lineTo(x + s * .6, y + s * .8); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#d9b96b'; ctx.beginPath(); ctx.arc(x, y + s * .45, s * .22, 0, TAU); ctx.fill();
      break;
    }
    case 'mist': {
      ctx.fillStyle = '#5aa7d9'; rr(x - s * .5, y - s * .5, s * .7, s, 2); ctx.fill();
      ctx.fillStyle = '#3d7dc8'; rr(x - s * .4, y - s * .8, s * .5, s * .35, 1); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.fillStyle = withAlpha('#5aa7d9', .6 - i * .15); ctx.beginPath(); ctx.arc(x + s * .5 + i * s * .3, y - s * .4 - i * s * .16, s * .12, 0, TAU); ctx.fill(); }
      break;
    }
    case 'bill': {
      ctx.fillStyle = '#ffd66b'; ctx.beginPath(); ctx.arc(x, y, s * .7, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c8963f'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, s * .7, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#8a6a2a'; ctx.font = `bold ${Math.round(s)}px 'Trebuchet MS'`; ctx.textAlign = 'center'; ctx.fillText('¢', x, y + s * .36);
      break;
    }
  }
}
function drawHearts(x, y, hearts) {
  const n = CFG.heartsMax;
  for (let i = 0; i < n; i++) {
    const filled = hearts > i + 0.5 ? 1 : (hearts > i ? 0.5 : 0);
    const hx = x - (n - 1) * 6 + i * 12;
    drawHeart(hx, y, 5, filled ? (hearts < 1.6 ? '#e05b5b' : '#e97fb2') : 'rgba(255,255,255,.35)');
    if (filled === 0.5) { ctx.save(); ctx.beginPath(); ctx.rect(hx - 6, y - 8, 6, 14); ctx.clip(); drawHeart(hx, y, 5, '#e97fb2'); ctx.restore(); }
  }
}
/* =====================================================================
   BLOOM RUSH — app2.js : backgrounds, UI widgets, scene manager,
                          Title / Map / LevelIntro / Game scenes
   ===================================================================== */
'use strict';

// ======================================================== BACKGROUNDS
// Venue palettes: sky/wall, floor, accent, glass. Distinct hour-of-day light.
const VENUE_ART = [
  { sky: ['#ffe9c9', '#ffd7a3'], wall: '#e8d5b5', floor: '#caa877', accent: '#c8622f', glow: '#fff3dc', tint: 'rgba(255,220,160,.10)' },  // morning sill
  { sky: ['#9fb7c4', '#7d98a8'], wall: '#b8c9bb', floor: '#8fa08a', accent: '#5f7d3a', glow: '#dcefe2', tint: 'rgba(120,160,170,.14)' },  // rainy greenhouse
  { sky: ['#f2b988', '#d98a6a'], wall: '#e0c9ad', floor: '#b08a62', accent: '#8c4f8c', glow: '#ffdcb8', tint: 'rgba(230,150,110,.12)' },  // evening boutique
  { sky: ['#2c3a5c', '#1c2740'], wall: '#3d4a63', floor: '#55617a', accent: '#8fb0d9', glow: '#b8d0f0', tint: 'rgba(60,90,150,.16)' }, // night conservatory
  { sky: ['#ffd98c', '#f2a65a'], wall: '#e8cfa8', floor: '#c49a68', accent: '#c8963f', glow: '#fff0c8', tint: 'rgba(255,200,120,.12)' },  // golden atrium
];

function drawVenueBackground(vi, detail) {
  const A = VENUE_ART[vi];
  // sky / far wall through glass
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
  sky.addColorStop(0, A.sky[0]); sky.addColorStop(1, A.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.42);
  // distant silhouettes
  ctx.fillStyle = withAlpha(A.wall, 0.55);
  for (let i = 0; i < 7; i++) {
    const hx = (i * 173 + vi * 60) % (W + 200) - 100;
    const hh = 40 + ((i * 97) % 70);
    ctx.beginPath(); ctx.ellipse(hx, H * 0.42, 90, hh, 0, Math.PI, TAU); ctx.fill();
  }
  // glass panes (greenhouse/conservatory/atrium venues)
  if (vi >= 1) {
    ctx.strokeStyle = withAlpha('#ffffff', vi === 3 ? 0.14 : 0.35);
    ctx.lineWidth = 5;
    for (let x = 60; x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * 0.42); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, H * 0.22); ctx.lineTo(W, H * 0.22); ctx.stroke();
    // arch
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.quadraticCurveTo(W / 2, -40, W, 60); ctx.stroke();
  } else {
    // window frame on the sill level
    ctx.strokeStyle = withAlpha('#8a6a43', .8); ctx.lineWidth = 10;
    ctx.strokeRect(70, 20, W - 140, H * 0.34);
    ctx.beginPath(); ctx.moveTo(W / 2, 20); ctx.lineTo(W / 2, H * 0.34 + 20); ctx.stroke();
  }
  // wall band
  const wallG = ctx.createLinearGradient(0, H * 0.38, 0, H * 0.46);
  wallG.addColorStop(0, shade(A.wall, -18)); wallG.addColorStop(1, A.wall);
  ctx.fillStyle = wallG; ctx.fillRect(0, H * 0.40, W, H * 0.06);
  // floor
  const floorG = ctx.createLinearGradient(0, H * 0.44, 0, H);
  floorG.addColorStop(0, shade(A.floor, 16)); floorG.addColorStop(1, shade(A.floor, -26));
  ctx.fillStyle = floorG; ctx.fillRect(0, H * 0.44, W, H * 0.56);
  // floorboards
  ctx.strokeStyle = withAlpha(shade(A.floor, -50), .35); ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const y = H * 0.46 + i * i * 3.2 + i * 13;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 70, H * 0.44);
    ctx.lineTo(W / 2 + i * 170, H);
    ctx.stroke();
  }
  if (!detail) return;
  // background shelving with tiny plants
  ctx.save(); ctx.globalAlpha = 0.9;
  for (let sx = 120; sx < W - 100; sx += 220) {
    ctx.fillStyle = shade(A.wall, -34);
    rr(sx, H * 0.30, 130, 7, 3); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const px = sx + 22 + i * 44;
      drawPot(px, H * 0.30 - 7, 20, POT_COLORS[(i + sx) % POT_COLORS.length].hex, null, false);
      drawPlant(['sprout', 'fern', 'echeveria', 'basil'][(i + (sx / 220 | 0)) % 4], px, H * 0.30 - 14, 0.45, {});
    }
  }
  ctx.restore();
  // hanging plants
  for (let hx = 180; hx < W; hx += 300) {
    ctx.strokeStyle = withAlpha('#5a4a33', .7); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, 60 + Math.sin(NOW * 0.8 + hx) * 3); ctx.stroke();
    drawPot(hx, 72 + Math.sin(NOW * 0.8 + hx) * 3, 30, '#8a5a33', null, false);
    drawPlant('string', hx, 62 + Math.sin(NOW * 0.8 + hx) * 3, 0.8, {});
  }
  drawWeather(vi);
}

let fireflies = null, rainDrops = null, motes = null;
function drawWeather(vi) {
  if (vi === 1) { // rain on the glass
    if (!rainDrops) { rainDrops = []; for (let i = 0; i < 60; i++) rainDrops.push({ x: Math.random() * W, y: Math.random() * H * 0.42, sp: 140 + Math.random() * 120 }); }
    ctx.strokeStyle = 'rgba(200,225,240,.4)'; ctx.lineWidth = 1.5;
    for (const d of rainDrops) {
      d.y += d.sp / 60; d.x -= 0.4;
      if (d.y > H * 0.42) { d.y = -6; d.x = Math.random() * W; }
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 1.6, d.y + 9); ctx.stroke();
    }
  } else if (vi === 3) { // fireflies
    if (!fireflies) { fireflies = []; for (let i = 0; i < 16; i++) fireflies.push({ x: Math.random() * W, y: 80 + Math.random() * H * 0.45, ph: Math.random() * TAU }); }
    for (const f of fireflies) {
      f.x += Math.sin(NOW * 0.6 + f.ph) * 0.4; f.y += Math.cos(NOW * 0.5 + f.ph * 2) * 0.3;
      const glow = 0.4 + 0.6 * Math.pow(Math.sin(NOW * 1.4 + f.ph) * .5 + .5, 2);
      ctx.fillStyle = `rgba(220,240,140,${glow * 0.8})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 2.2, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(220,240,140,${glow * 0.16})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, TAU); ctx.fill();
    }
  } else { // light shafts + dust motes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const bx = 160 + i * 300 + Math.sin(NOW * 0.2 + i) * 12;
      const g = ctx.createLinearGradient(bx, 0, bx + 130, H * 0.7);
      g.addColorStop(0, withAlpha(VENUE_ART[vi].glow, 0.14)); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 70, 0); ctx.lineTo(bx + 190, H * 0.75); ctx.lineTo(bx + 40, H * 0.75); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (!motes) { motes = []; for (let i = 0; i < 24; i++) motes.push({ x: Math.random() * W, y: Math.random() * H * 0.7, ph: Math.random() * TAU }); }
    ctx.fillStyle = 'rgba(255,250,230,.5)';
    for (const m of motes) {
      const mx = m.x + Math.sin(NOW * 0.4 + m.ph) * 14, my = m.y + Math.cos(NOW * 0.3 + m.ph) * 8;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(NOW + m.ph);
      ctx.beginPath(); ctx.arc(mx, my, 1.3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // mood tint
  ctx.fillStyle = VENUE_ART[vi].tint; ctx.fillRect(0, 0, W, H);
}

// stations
function drawEntryMat(x, y) {
  ctx.save(); ctx.translate(x, y + 26);
  ctx.fillStyle = 'rgba(20,30,15,.15)'; ctx.beginPath(); ctx.ellipse(0, 6, 74, 18, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(-70, 0, 70, 0);
  g.addColorStop(0, '#a8794a'); g.addColorStop(.5, '#c49a68'); g.addColorStop(1, '#a8794a');
  ctx.fillStyle = g; rr(-72, -8, 144, 22, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 2; rr(-64, -4, 128, 14, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(90,60,30,.8)'; ctx.font = "bold 10px 'Trebuchet MS'"; ctx.textAlign = 'center';
  ctx.fillText('W E L C O M E', 0, 6.5);
  ctx.restore();
}
function drawCounterStation(x, y, prep, prepSlots, prepTime) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,30,15,.18)'; ctx.beginPath(); ctx.ellipse(0, 34, 92, 16, 0, 0, TAU); ctx.fill();
  // counter body
  const g = ctx.createLinearGradient(0, -30, 0, 34);
  g.addColorStop(0, '#9a6a3f'); g.addColorStop(1, '#6a4426');
  ctx.fillStyle = g; rr(-92, -26, 184, 60, 10); ctx.fill();
  ctx.fillStyle = '#c49a68'; rr(-96, -34, 192, 14, 6); ctx.fill();
  // sign
  ctx.fillStyle = '#5f7d3a'; rr(-60, -74, 120, 26, 8); ctx.fill();
  ctx.fillStyle = '#f5efdc'; ctx.font = "bold 13px 'Trebuchet MS'"; ctx.textAlign = 'center';
  ctx.fillText('MIX COUNTER', 0, -56);
  // jars
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = withAlpha('#d9c9a3', .9); rr(-78 + i * 26, -50, 18, 16, 3); ctx.fill();
    ctx.fillStyle = ['#8a6a43', '#5f7d3a', '#c8963f'][i]; rr(-75 + i * 26, -44, 12, 8, 2); ctx.fill();
  }
  // prep slots with progress rings
  for (let i = 0; i < prepSlots; i++) {
    const sx = -40 + i * 44, sy = 0;
    ctx.fillStyle = '#4a3018'; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, TAU); ctx.fill();
    const o = prep.queue[i];
    if (o) {
      ctx.fillStyle = '#d9c9a3'; ctx.beginPath(); ctx.arc(sx, sy, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8fd06a'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(sx, sy, 13, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(o.t / prepTime, 0, 1)); ctx.stroke();
    }
  }
  // ready shelf
  for (let i = 0; i < prep.ready.length; i++) {
    const sx = 56, sy = -6 - i * 16;
    ctx.fillStyle = '#d9c9a3'; rr(sx - 9, sy - 6, 18, 12, 3); ctx.fill();
    ctx.fillStyle = '#8fd06a'; ctx.beginPath(); ctx.arc(sx, sy - 8, 3.4, 0, TAU); ctx.fill();
    const pulse = 0.5 + 0.5 * Math.sin(NOW * 5);
    ctx.strokeStyle = withAlpha('#ffd66b', 0.5 + pulse * 0.5); ctx.lineWidth = 2;
    rr(sx - 11, sy - 8, 22, 16, 4); ctx.stroke();
  }
  ctx.restore();
}
function drawWashStation(x, y, wash, washPending, washSlots, washTime) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,30,15,.18)'; ctx.beginPath(); ctx.ellipse(0, 40, 74, 15, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -20, 0, 40);
  g.addColorStop(0, '#7d98a8'); g.addColorStop(1, '#54707e');
  ctx.fillStyle = g; rr(-70, -20, 140, 62, 12); ctx.fill();
  ctx.fillStyle = '#9fb7c4'; rr(-74, -28, 148, 14, 6); ctx.fill();
  // faucet
  ctx.strokeStyle = '#c9d4da'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(0, -52, 22, -52); ctx.stroke();
  ctx.fillStyle = '#c9d4da'; ctx.beginPath(); ctx.arc(22, -52, 4.5, 0, TAU); ctx.fill();
  // sign
  ctx.fillStyle = '#3d7dc8'; rr(-52, -78, 104, 24, 8); ctx.fill();
  ctx.fillStyle = '#f5efdc'; ctx.font = "bold 12px 'Trebuchet MS'"; ctx.textAlign = 'center';
  ctx.fillText('WASH RACK', 0, -61);
  // basins
  for (let i = 0; i < washSlots; i++) {
    const sx = -40 + i * 40, sy = 6;
    ctx.fillStyle = '#38505c'; ctx.beginPath(); ctx.ellipse(sx, sy, 16, 10, 0, 0, TAU); ctx.fill();
    const wsh = wash[i];
    if (wsh) {
      ctx.fillStyle = withAlpha('#bfe3f0', .85); ctx.beginPath(); ctx.ellipse(sx, sy, 13, 7.5, 0, 0, TAU); ctx.fill();
      // bubbles
      for (let b = 0; b < 3; b++) {
        const bph = (NOW * 1.4 + b * 1.1 + i) % 1;
        ctx.fillStyle = withAlpha('#ffffff', .7 - bph * .6);
        ctx.beginPath(); ctx.arc(sx - 6 + b * 6, sy - bph * 12, 2 + b * .6, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#8fd06a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, 17, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(wsh.t / washTime, 0, 1)); ctx.stroke();
    }
  }
  if (washPending > 0) {
    ctx.fillStyle = '#f5efdc'; ctx.font = "bold 11px 'Trebuchet MS'"; ctx.textAlign = 'center';
    ctx.fillText('+' + washPending + ' waiting', 0, 36);
  }
  ctx.restore();
}
function drawBench(b, vi, highlight) {
  const A = VENUE_ART[vi];
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(20,30,15,.2)'; ctx.beginPath(); ctx.ellipse(0, 30, 56, 13, 0, 0, TAU); ctx.fill();
  // table top
  const g = ctx.createLinearGradient(0, 6, 0, 30);
  g.addColorStop(0, shade(A.floor, 40)); g.addColorStop(1, shade(A.floor, 4));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 18, 54, 17, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(A.floor, -18);
  ctx.beginPath(); ctx.ellipse(0, 22, 54, 17, 0, Math.PI * 0.04, Math.PI - 0.12); ctx.fill();
  // legs
  ctx.strokeStyle = shade(A.floor, -40); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-40, 26); ctx.lineTo(-44, 44); ctx.moveTo(40, 26); ctx.lineTo(44, 44); ctx.stroke();
  if (b.needsPot) {
    // dashed ring + droplet: this bench is waiting on the wash rack, not free to seat.
    ctx.strokeStyle = 'rgba(120,180,215,.85)'; ctx.lineWidth = 3; ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.ellipse(0, 16, 30, 12, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(140,200,230,.9)';
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(7, 13, 0, 18);
    ctx.quadraticCurveTo(-7, 13, 0, 4); ctx.fill();
  }
  if (highlight) {
    const pulse = REDUCED ? 0.6 : 0.5 + 0.5 * Math.sin(NOW * 6);
    ctx.strokeStyle = withAlpha('#ffd66b', 0.35 + pulse * 0.5); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, 18, 60, 21, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ================================================================ UI
// Screen-reader announcer. Coalesces to one message per frame so a burst of events does
// not flood the live region, and skips repeats of the message already on screen.
const SAY = (() => {
  const el = document.getElementById('live');
  let pending = null, last = '';
  return {
    say(msg, force) { if (!msg || (msg === last && !force)) return; pending = msg; },
    flush() { if (pending == null) return; last = pending; el.textContent = pending; pending = null; },
  };
})();

const UI = {
  buttons: [],
  focusId: null,          // keyboard focus, tracked by stable button id across frames
  kbd: false,             // true once the player has used the keyboard: shows the focus ring
  begin() { this.buttons.length = 0; },
  button(id, x, y, w, h, label, opts) {
    opts = opts || {};
    // The disabled flag used to be dropped here, so a greyed-out control still registered a
    // hit rect, swallowed the tap and played the click sound.
    // `aria` overrides the drawn glyph for the announcer: "Sound effects on" beats "🔔".
    this.buttons.push({ id, x, y, w, h, cb: opts.cb, disabled: !!opts.disabled, label: opts.aria || label });
    const focused = this.kbd && this.focusId === id && !opts.disabled;
    const hov = focused || (MOUSE.x >= x && MOUSE.x <= x + w && MOUSE.y >= y && MOUSE.y <= y + h);
    const base = opts.color || '#5f7d3a';
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(base, hov ? 34 : 18)); g.addColorStop(1, shade(base, hov ? 4 : -14));
    ctx.fillStyle = opts.disabled ? '#8a8a80' : g;
    rr(x, y, w, h, opts.r == null ? 12 : opts.r); ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,30,.4)'; ctx.lineWidth = 2; rr(x, y, w, h, opts.r == null ? 12 : opts.r); ctx.stroke();
    if (hov && !opts.disabled) { ctx.strokeStyle = 'rgba(255,240,190,.7)'; rr(x + 2, y + 2, w - 4, h - 4, 9); ctx.stroke(); }
    if (focused) { ctx.strokeStyle = '#ffd66b'; ctx.lineWidth = 3; rr(x - 3, y - 3, w + 6, h + 6, 14); ctx.stroke(); }
    ctx.fillStyle = opts.disabled ? '#c9c9c0' : (opts.textColor || '#f8f5e8');
    ctx.font = `bold ${opts.size || 17}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    return hov;
  },
  hit(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (b.disabled) continue;                       // a disabled control is not a target
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  },
  // ---- keyboard navigation over whatever this frame drew
  live() { return this.buttons.filter(b => !b.disabled && b.cb); },
  move(dir) {
    const bs = this.live(); if (!bs.length) return false;
    this.kbd = true;
    let i = bs.findIndex(b => b.id === this.focusId);
    i = i < 0 ? (dir > 0 ? 0 : bs.length - 1) : (i + dir + bs.length) % bs.length;
    this.focusId = bs[i].id;
    SAY.say(bs[i].label + ', button', true);
    return true;
  },
  activate() {
    const b = this.live().find(b => b.id === this.focusId);
    if (!b) return false;
    S.click(); b.cb(); return true;
  },
  announceScreen(name, extra) { SAY.say(name + (extra ? '. ' + extra : ''), true); },
};
function panel(x, y, w, h, opts) {
  opts = opts || {};
  ctx.fillStyle = opts.fill || 'rgba(38,46,30,.88)';
  rr(x, y, w, h, opts.r == null ? 16 : opts.r); ctx.fill();
  ctx.strokeStyle = opts.stroke || 'rgba(220,230,190,.35)'; ctx.lineWidth = 2;
  rr(x + 1, y + 1, w - 2, h - 2, opts.r == null ? 15 : opts.r); ctx.stroke();
}
function title(text, x, y, size, color) {
  ctx.font = `italic bold ${size}px Georgia, serif`; ctx.textAlign = 'center';
  ctx.lineWidth = size / 5; ctx.strokeStyle = 'rgba(40,50,25,.85)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color || '#f8f5e8'; ctx.fillText(text, x, y);
}

// toasts (achievements etc.)
const toasts = [];
function toast(txt, sub) { toasts.push({ txt, sub, t: 0 }); S.toast(); }
function drawToasts(dt) {
  let y = 76;
  for (let i = toasts.length - 1; i >= 0; i--) {
    const t = toasts[i]; t.t += dt;
    if (t.t > 3.4) { toasts.splice(i, 1); continue; }
    const k = t.t < 0.3 ? ease.out(t.t / 0.3) : (t.t > 3 ? 1 - (t.t - 3) / 0.4 : 1);
    ctx.save(); ctx.globalAlpha = clamp(k, 0, 1);
    const w = 300, x = W - w - 14, yy = y - (1 - clamp(k, 0, 1)) * 20;
    panel(x, yy, w, 54, { fill: 'rgba(52,66,38,.94)' });
    ctx.fillStyle = '#ffd66b'; drawGlyph('star', x + 28, yy + 27, 11);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd66b'; ctx.font = "bold 14px 'Trebuchet MS'";
    ctx.fillText(t.txt, x + 48, yy + 24);
    ctx.fillStyle = '#e8e4d0'; ctx.font = "12px 'Trebuchet MS'";
    ctx.fillText(t.sub || '', x + 48, yy + 41);
    ctx.restore();
    y += 62;
  }
}

// ============================================== HELP OVERLAY (visible)
// The only rules text in the product used to be two lines inside the Pause menu, and the
// bubble icons had no legend anywhere. A first-time player reported reading the source to
// find out what the icons meant.
let helpOpen = false;
function toggleHelp(on) {
  helpOpen = on == null ? !helpOpen : !!on;
  SAY.say(helpOpen ? 'Help opened. Press H or Escape to close.' : 'Help closed.', true);
}
function drawHelp() {
  if (!helpOpen) return;
  ctx.fillStyle = 'rgba(16,22,12,.88)'; ctx.fillRect(0, 0, W, H);
  panel(W / 2 - 400, 26, 800, 548, { fill: 'rgba(40,50,30,.98)' });
  title('How to run the shop', W / 2, 68, 30, '#ffd66b');
  ctx.textAlign = 'left';
  const L = W / 2 - 372, R = W / 2 + 24;

  ctx.fillStyle = '#8fd06a'; ctx.font = "bold 15px 'Trebuchet MS'";
  ctx.fillText('THE LOOP', L, 104);
  ctx.fillStyle = '#f2efdf'; ctx.font = "13px 'Trebuchet MS'";
  const loop = [
    '1. Seat a waiting plant — drag it to a free bench, or click it then the bench.',
    '2. When it decides, take its order (click the bench).',
    '3. Collect the ready mix from the Mix Counter — it delivers itself.',
    '4. It drinks, then asks to pay — click the bench again to cash out.',
    '5. Lift the dirty pot and carry it to the Wash Rack.',
  ];
  loop.forEach((t, i) => ctx.fillText(t, L, 128 + i * 20));

  ctx.fillStyle = '#8fd06a'; ctx.font = "bold 15px 'Trebuchet MS'";
  ctx.fillText('WHAT THE BUBBLES MEAN', L, 250);
  const legend = [
    ['dots',  'Thinking — it has not decided yet. Nothing to do.'],
    ['order', 'Ready to order — click the bench.'],
    ['wait',  'Waiting for its mix — fetch it from the counter.'],
    ['mist',  'Asking for a mist — click the bench for a bonus heart.'],
    ['bill',  'Ready to pay — click the bench to collect.'],
  ];
  legend.forEach(([kind, txt], i) => {
    const y = 276 + i * 26;
    ctx.fillStyle = 'rgba(255,255,252,.96)'; rr(L + 2, y - 13, 30, 22, 6); ctx.fill();
    drawStateIcon(kind, L + 17, y - 2, 7);
    ctx.fillStyle = '#f2efdf'; ctx.font = "13px 'Trebuchet MS'"; ctx.textAlign = 'left';
    ctx.fillText(txt, L + 42, y + 2);
  });

  ctx.fillStyle = '#8fd06a'; ctx.font = "bold 15px 'Trebuchet MS'";
  ctx.fillText('SCORING', R, 104);
  ctx.fillStyle = '#f2efdf'; ctx.font = "13px 'Trebuchet MS'";
  const score = [
    'Every action scores ' + CFG.actionPoints + ' points; cashing out pays its bill.',
    'CHAIN: repeat the same KIND of action back to back and each',
    'one is worth more, up to ×' + CFG.chainCap + '. Batch your work.',
    'POT MATCH: seat a plant on a bench whose pot matches its own',
    'colour (the shapes on the pots tell you, not just the colour)',
    'for a bonus heart and +' + Math.round((CFG.colorMatchPay - 1) * 100) + '% pay.',
    'HEARTS drain while a plant waits on you. At zero it walks out',
    'and you lose ' + CFG.angryLossPoints + ' points.',
    'SUNSEEDS ☀ are the shop currency, spent in the Supply Shed.',
  ];
  score.forEach((t, i) => ctx.fillText(t, R, 128 + i * 19));

  ctx.fillStyle = '#8fd06a'; ctx.font = "bold 15px 'Trebuchet MS'";
  ctx.fillText('KEYBOARD (fully playable)', R, 316);
  ctx.fillStyle = '#f2efdf'; ctx.font = "13px 'Trebuchet MS'";
  const keys = [
    'Tab / arrows — move between buttons and benches',
    'Enter — activate the focused button, or serve the bench',
    '1…6 — do the obvious thing at that bench',
    'Q seat next   W collect a mix   E sing to a plant',
    'R lift a pot  F go and wash     P pause   M mute',
  ];
  keys.forEach((t, i) => ctx.fillText(t, R, 340 + i * 19));

  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd66b'; ctx.font = "bold 14px 'Trebuchet MS'";
  ctx.fillText('Singing to a plant restores hearts — but only twice per visit.', W / 2, 468);
  ctx.fillStyle = '#e8e4d0'; ctx.font = "13px 'Trebuchet MS'";
  ctx.fillText('A bench with a dashed ring and a droplet has no pot: wash one to bring it back.', W / 2, 492);
  UI.button('helpclose', W / 2 - 80, 516, 160, 40, 'Got it', { size: 15, cb: () => toggleHelp(false) });
}

// ====================================================== SCENE MANAGER
const Scenes = {};
let scene = null, sceneName = '';
let transition = null; // {t, dur, mid, done}
function go(name, arg) {
  transition = { t: 0, dur: REDUCED ? 0.18 : 0.8, mid: () => { sceneName = name; scene = Scenes[name]; scene.enter(arg); }, fired: false };
  S.page();
}
function goInstant(name, arg) { UI.focusId = null; sceneName = name; scene = Scenes[name]; scene.enter(arg); }
// leaf-wipe transition
function drawTransition(dt) {
  if (!transition) return;
  transition.t += dt;
  const k = transition.t / transition.dur;
  if (k >= 0.5 && !transition.fired) { transition.fired = true; transition.mid(); }
  if (k >= 1) { transition = null; return; }
  const cover = k < 0.5 ? ease.inout(k * 2) : 1 - ease.inout((k - 0.5) * 2);
  ctx.save();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const cx = (i % 4) * (W / 4) + W / 8, cy = Math.floor(i / 4) * (H / 3) + H / 6;
    const r = cover * 240;
    ctx.fillStyle = i % 2 ? '#4a6741' : '#5f7d3a';
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(i + NOW * 0.2);
    // big leaf
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r, r * 0.2, -r * 0.7, -r * 0.8, 0, -r);
    ctx.bezierCurveTo(r * 0.7, -r * 0.8, r, r * 0.2, 0, r * 0.9);
    ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

// ============================================================ PROFILE
// Career meta. Persisted to localStorage by the block below (arcade build).
const PROFILE = {
  coins: 0,
  levelStars: {},          // idx -> 0..3
  levelBest: {},           // idx -> best score
  expertBeaten: {},        // idx -> true
  upgrades: {},            // id -> 1
  achievements: {},        // id -> true
  speciesSeen: {},         // id -> count served
  totalServed: 0, bestChain: 0, colorMatches: 0, serenades: 0, mists: 0, washed: 0,
  servedByArchTotal: {},
  bestEndlessServed: 0, bestEndlessScore: 0,
  careerDone: false, flags: { perfectLevel: false, sawHelp: false },
  unlockedLevel: 0,        // highest playable
  dialoguesSeen: {},
};

/* ============================================ SAVE / LOAD  (arcade build)
 * Bloom Rush shipped with no persistence at all — every run started from zero.
 * This block adds it without touching a single line of game logic: PROFILE is
 * already the one object holding all career meta, so persisting PROFILE is the
 * whole feature.
 *
 * Placed immediately after the PROFILE literal and BEFORE the boot call at the
 * end of the file, so the title screen paints restored progress on first frame
 * rather than showing zeros and correcting itself.
 *
 * MERGE, NOT REPLACE. Only keys the current PROFILE already declares are taken
 * from the save, and only when the stored type matches. A save written by an
 * older build is therefore forward-compatible (new fields keep their defaults),
 * and a corrupted or hand-edited value cannot crash the boot path — it is
 * dropped and the default stands.
 */
const BR_SAVE_KEY = 'bloomrush.profile.v1';

function brLoadProfile() {
  let raw = null;
  try { raw = localStorage.getItem(BR_SAVE_KEY); } catch (e) { return false; }  // private mode throws
  if (!raw) return false;
  let saved;
  try { saved = JSON.parse(raw); } catch (e) { return false; }
  if (!saved || typeof saved !== 'object') return false;
  for (const k of Object.keys(PROFILE)) {
    if (!Object.prototype.hasOwnProperty.call(saved, k)) continue;
    const cur = PROFILE[k], next = saved[k];
    // Type must match the default's shape, or the value is not trusted.
    if (typeof cur === 'number') { if (typeof next === 'number' && isFinite(next)) PROFILE[k] = next; }
    else if (typeof cur === 'boolean') { if (typeof next === 'boolean') PROFILE[k] = next; }
    else if (cur && typeof cur === 'object') { if (next && typeof next === 'object' && !Array.isArray(next)) PROFILE[k] = next; }
  }
  return true;
}

let brLastSaved = '';
function brSaveProfile() {
  let json;
  try { json = JSON.stringify(PROFILE); } catch (e) { return; }
  if (json === brLastSaved) return;            // nothing changed; do not touch storage
  try {
    localStorage.setItem(BR_SAVE_KEY, json);
    brLastSaved = json;
  } catch (e) {
    // Quota or private mode. Stop retrying every tick; the run stays playable.
    brSaveProfile = function () {};
  }
}

brLoadProfile();
try { brLastSaved = JSON.stringify(PROFILE); } catch (e) {}

/* Autosave on a timer plus on the way out. A timer rather than hooks inside
 * level-complete / achievement code because that would mean editing game logic
 * in several places to catch every mutation; one poll catches all of them and
 * writes only on an actual change. pagehide is the reliable last-chance event
 * (visibilitychange alone misses some desktop close paths). */
setInterval(brSaveProfile, 4000);
addEventListener('pagehide', brSaveProfile);
addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') brSaveProfile(); });
/* ====================================================== end SAVE / LOAD */
function metaStats() {
  let totalStars = 0; for (const k in PROFILE.levelStars) totalStars += PROFILE.levelStars[k];
  let expertCount = 0; for (const k in PROFILE.expertBeaten) expertCount++;
  return {
    totalServed: PROFILE.totalServed, bestChain: PROFILE.bestChain, colorMatches: PROFILE.colorMatches,
    serenades: PROFILE.serenades, mists: PROFILE.mists, washed: PROFILE.washed,
    totalStars, expertCount, venueReached: Math.floor(PROFILE.unlockedLevel / 4),
    careerDone: PROFILE.careerDone, speciesMet: Object.keys(PROFILE.speciesSeen).length,
    bestEndlessServed: PROFILE.bestEndlessServed, flags: PROFILE.flags,
    servedByArchTotal: PROFILE.servedByArchTotal,
  };
}
function checkAchievements() {
  const s = metaStats();
  for (const a of ACHIEVEMENTS) {
    if (!PROFILE.achievements[a.id] && a.check(s)) {
      PROFILE.achievements[a.id] = true;
      toast('Achievement: ' + a.name, a.desc);
    }
  }
}

function lv0Goal(lv) {
  const g = lv.cfg.goals || {};
  return 'One star at ' + (g.one || 0) + ' points.';
}

// ============================================================== INPUT
const MOUSE = { x: -1, y: -1, down: false };
let drag = null; // {plantId, x, y}
canvas.addEventListener('pointermove', e => { const p = evPos(e); MOUSE.x = p.x; MOUSE.y = p.y; if (drag) { drag.x = p.x; drag.y = p.y; } });
canvas.addEventListener('pointerdown', e => {
  AudioSys.unlock();
  const p = evPos(e); MOUSE.x = p.x; MOUSE.y = p.y; MOUSE.down = true;
  if (transition) return;
  const b = UI.hit(p.x, p.y);
  if (b) { S.click(); if (b.cb) b.cb(); return; }
  if (helpOpen) { toggleHelp(false); return; }   // click anywhere to dismiss help
  if (scene && scene.pointerdown) scene.pointerdown(p);
});
canvas.addEventListener('pointerup', e => {
  const p = evPos(e); MOUSE.down = false;
  if (scene && scene.pointerup) scene.pointerup(p);
});
// B9: the canvas was the only element on the page, had tabIndex -1, and the sole key
// handler covered pause and mute. There was no keyboard route to start a run, choose a
// level, or seat a plant - i.e. no way to play at all without a pointer.
const NAV_KEYS = new Set(['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Spacebar']);
window.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  AudioSys.unlock();
  if (helpOpen) {                       // help owns the keyboard while it is open
    if (e.key === 'h' || e.key === 'H' || e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      toggleHelp(false); e.preventDefault();
    }
    return;
  }
  // The scene gets first refusal; it returns true when it has consumed the key.
  if (scene && scene.key && scene.key(e.key, e)) { e.preventDefault(); return; }
  if (transition) return;
  let handled = false;
  switch (e.key) {
    case 'Tab': handled = UI.move(e.shiftKey ? -1 : 1); break;
    case 'ArrowRight': case 'ArrowDown': handled = UI.move(1); break;
    case 'ArrowLeft': case 'ArrowUp': handled = UI.move(-1); break;
    case 'Enter': case ' ': case 'Spacebar': handled = UI.activate(); break;
    case 'h': case 'H': case '?': toggleHelp(); handled = true; break;
    case 'Escape': if (helpOpen) { toggleHelp(false); handled = true; } break;
  }
  if (handled) e.preventDefault();
});
canvas.addEventListener('focus', () => { UI.kbd = true; });
setTimeout(() => { try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); } }, 0);

// ======================================================= TITLE SCENE
Scenes.title = {
  enter() { AudioSys.startMusic('title'); this.t = 0;
    UI.focusId = null;
    UI.announceScreen('Bloom Rush title screen',
      'Press Tab to move between buttons, Enter to choose, H for the full control list.'); },
  update(dt) { this.t += dt; },
  draw() {
    drawVenueBackground(0, true);
    // big hero plant arrangement
    drawPot(W / 2 - 250, H - 90, 90, '#c8622f', 'triangle'); drawPlant('monstera', W / 2 - 250, H - 122, 1.9, {});
    drawPot(W / 2 + 250, H - 90, 80, '#3d7dc8', 'circle'); drawPlant('orchid', W / 2 + 250, H - 118, 1.8, {});
    drawPot(W / 2 + 150, H - 60, 56, '#8c4f8c', 'diamond'); drawPlant('venus', W / 2 + 150, H - 80, 1.2, {});
    drawPot(W / 2 - 150, H - 56, 52, '#5f7d3a', 'star'); drawPlant('echeveria', W / 2 - 150, H - 74, 1.15, {});
    drawHero(W / 2, H - 70, false, [], 1);
    // floating petals
    if (Math.random() < 0.06) parts.push({ x: Math.random() * W, y: -10, vx: 18 - Math.random() * 30, vy: 26, life: 0, max: 8, kind: 'petal', size: 5, color: ['#e97fb2', '#8fd06a', '#ffd66b'][Math.floor(Math.random() * 3)], g: 2, rot: Math.random() * TAU, vr: 1.2 });
    // title
    const bob = REDUCED ? 0 : Math.sin(NOW * 1.4) * 5;
    title('Bloom Rush', W / 2, 148 + bob, 78, '#8fd06a');
    title('· Propagation Station ·', W / 2, 190 + bob, 26, '#ffd66b');
    ctx.font = "bold 15px 'Trebuchet MS'"; ctx.fillStyle = '#22301a'; ctx.textAlign = 'center';
    ctx.fillText('Seat the plants · match the pots · mix the feed · keep every frond happy', W / 2, 226 + bob);
    UI.begin();
    UI.button('play', W / 2 - 110, 290, 220, 56, PROFILE.unlockedLevel > 0 ? 'Continue' : 'Start Career', { cb: () => go('map'), size: 22 });
    UI.button('endless', W / 2 - 110, 358, 220, 44, 'Endless Greenhouse', {
      color: '#8c4f8c', cb: () => { if (PROFILE.unlockedLevel >= 2) startEndless(); },
      disabled: PROFILE.unlockedLevel < 2,
    });
    if (PROFILE.unlockedLevel < 2) { ctx.font = "bold 13px 'Trebuchet MS'"; ctx.fillStyle = '#22301a'; ctx.fillText('(finish 2 career days to unlock)', W / 2, 418); }
    UI.button('album', W / 2 - 110, 432, 104, 40, 'Plantdex', { color: '#3d7dc8', size: 15, cb: () => go('album') });
    UI.button('ach', W / 2 + 6, 432, 104, 40, 'Awards', { color: '#c8963f', size: 15, cb: () => go('achievements') });
    ctx.font = "bold 12px 'Trebuchet MS'"; ctx.fillStyle = '#26331c';
    ctx.fillText('An original botanical time-management game · progress saves in this browser', W / 2, H - 14);
    drawAudioButtons(); drawHelpButton();
  },
};
function drawHelpButton(x, y) {
  UI.button('help', x == null ? W - 190 : x, y == null ? 10 : y, 56, 44, '?',
    { color: '#7a5ea8', size: 22, aria: 'How to play', cb: () => toggleHelp(true) });
}
function drawAudioButtons() {
  // SC 2.5.8: 44x34 game px letterboxes to ~18x14 CSS px on a phone, well under the 24x24 floor.
  UI.button('sfx', W - 128, 10, 58, 44, AudioSys.sfxOn ? '🔔' : '🔕',
    { color: '#54707e', size: 18, aria: AudioSys.sfxOn ? 'Sound effects on' : 'Sound effects off', cb: () => AudioSys.toggleSfx() });
  UI.button('mus', W - 64, 10, 58, 44, AudioSys.musOn ? '♫' : '♪̶',
    { color: '#54707e', size: 18, aria: AudioSys.musOn ? 'Music on' : 'Music off', cb: () => AudioSys.toggleMus(currentMood()) });
}
function currentMood() {
  if (sceneName === 'game' && Scenes.game.lv) return VENUES[Math.floor(Scenes.game.levelIdx / 4)] ? VENUES[Math.floor(Scenes.game.levelIdx / 4)].time : 'title';
  return 'title';
}

// ========================================================= MAP SCENE
Scenes.map = {
  enter() { AudioSys.startMusic('title');
    UI.focusId = null;
    UI.announceScreen('The Bloom Trail, level select',
      'Tab moves between days, Enter starts one. ' + (PROFILE.unlockedLevel + 1) + ' days unlocked.'); },
  update() {},
  draw() {
    // parchment-garden map
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#dfe8c9'); g.addColorStop(1, '#c2d4a8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // winding path
    ctx.strokeStyle = '#b39a6a'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(120, H - 150);
    ctx.bezierCurveTo(250, H - 230, 150, 300, 340, 250);
    ctx.bezierCurveTo(540, 220, 480, 420, 650, 380);
    ctx.bezierCurveTo(800, 345, 800, 200, 870, 130);
    ctx.stroke();
    ctx.setLineDash([2, 14]); ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(120, H - 150);
    ctx.bezierCurveTo(250, H - 230, 150, 300, 340, 250);
    ctx.bezierCurveTo(540, 220, 480, 420, 650, 380);
    ctx.bezierCurveTo(800, 345, 800, 200, 870, 130);
    ctx.stroke(); ctx.setLineDash([]);
    title('The Bloom Trail', W / 2, 54, 36, '#4a6741');
    // venue nodes along the path
    const nodePos = [
      { x: 152, y: H - 172 }, { x: 320, y: 268 }, { x: 520, y: 300 }, { x: 680, y: 370 }, { x: 850, y: 150 },
    ];
    UI.begin();
    for (let vi = 0; vi < 5; vi++) {
      const np = nodePos[vi];
      const unlockedInVenue = clamp(PROFILE.unlockedLevel - vi * 4 + 1, 0, 4);
      const locked = unlockedInVenue <= 0;
      // venue medallion
      ctx.fillStyle = locked ? 'rgba(120,120,105,.8)' : shade(VENUE_ART[vi].accent, 20);
      ctx.beginPath(); ctx.arc(np.x, np.y, 34, 0, TAU); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = locked ? '#8a8a7a' : '#f5efdc';
      ctx.beginPath(); ctx.arc(np.x, np.y, 34, 0, TAU); ctx.stroke();
      drawPlant(['sprout', 'fern', 'orchid', 'venus', 'monstera'][vi], np.x, np.y + 16, 0.85, {});
      if (locked) { ctx.fillStyle = 'rgba(50,50,40,.85)'; ctx.font = "bold 22px 'Trebuchet MS'"; ctx.textAlign = 'center'; ctx.fillText('🔒', np.x, np.y + 8); }
      ctx.font = "bold 13px 'Trebuchet MS'"; ctx.textAlign = 'center';
      ctx.fillStyle = '#313b22';
      ctx.fillText(VENUES[vi].name, np.x, np.y + 56);
      // level dots
      for (let li = 0; li < 4; li++) {
        const idx = vi * 4 + li;
        const dx = np.x - 57 + li * 38, dy = np.y - 52;   // wider pitch: SC 2.5.8 at phone-landscape scale
        const stars = PROFILE.levelStars[idx] || 0;
        const avail = idx <= PROFILE.unlockedLevel;
        ctx.fillStyle = avail ? (stars > 0 ? '#ffd66b' : '#f5efdc') : 'rgba(140,140,120,.6)';
        ctx.beginPath(); ctx.arc(dx, dy, 13, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(70,70,50,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        if (stars > 0) { ctx.fillStyle = '#6d5220'; ctx.font = "bold 14px 'Trebuchet MS'"; ctx.fillText(stars, dx, dy + 5); }
        if (avail) UI.buttons.push({ id: 'lvl' + idx, x: dx - 19, y: dy - 19, w: 38, h: 38,
          cb: () => enterLevel(idx), disabled: false,
          label: 'Day ' + (idx + 1) + ', ' + VENUES[vi].name + ', ' + stars + ' of 3 stars' });
        if (UI.kbd && UI.focusId === 'lvl' + idx) {
          ctx.strokeStyle = '#c8622f'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(dx, dy, 19, 0, TAU); ctx.stroke();
        }
      }
    }
    // side panel: quests
    panel(14, 84, 224, 252, {});
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd66b'; ctx.font = "bold 16px Georgia";
    ctx.fillText('Garden Quests', 30, 112);
    const st = metaStats();
    let qy = 126;
    for (const q of QUESTS) {
      const v = Math.min(q.target, q.stat(st));
      const done = v >= q.target;
      ctx.fillStyle = done ? '#8fd06a' : '#e8e4d0'; ctx.font = "bold 12px 'Trebuchet MS'";
      ctx.fillText((done ? '✓ ' : '') + q.name, 30, qy);
      ctx.fillStyle = 'rgba(232,232,214,.9)'; ctx.font = "11px 'Trebuchet MS'";
      ctx.fillText(q.desc, 30, qy + 13);
      // bar
      ctx.fillStyle = 'rgba(255,255,255,.15)'; rr(30, qy + 18, 180, 5, 3); ctx.fill();
      ctx.fillStyle = done ? '#8fd06a' : '#ffd66b'; rr(30, qy + 18, 180 * (v / q.target), 5, 3); ctx.fill();
      qy += 36;
    }
    // stats strip
    panel(14, H - 78, 380, 46, {});   // was H-66/52: it overpainted venue 0's label
    ctx.fillStyle = '#ffd66b'; ctx.font = "bold 14px 'Trebuchet MS'"; ctx.textAlign = 'left';
    ctx.fillText('☀ ' + PROFILE.coins + ' sunseeds', 30, H - 44);
    ctx.fillStyle = '#e8e4d0';
    ctx.fillText('★ ' + st.totalStars + '/60', 180, H - 44);
    ctx.fillText('Served: ' + st.totalServed, 260, H - 44);
    ctx.font = "11px 'Trebuchet MS'"; ctx.fillStyle = 'rgba(230,230,210,.7)';
    ctx.textAlign = 'center'; ctx.fillStyle = '#3a4a2a'; ctx.font = "bold 14px 'Trebuchet MS'";
    ctx.fillText('Click a numbered dot to play that day · earn ★ to open the next station', W / 2, 82);
    ctx.textAlign = 'left';
    drawHelpButton(W - 192, 10);
    UI.button('shop', W - 250, H - 66, 110, 44, 'Supply Shed', { color: '#c8963f', size: 14, cb: () => go('shop') });
    UI.button('back', W - 130, H - 66, 110, 44, 'Title', { color: '#54707e', size: 14, cb: () => go('title') });
    drawAudioButtons();
  },
};

function enterLevel(idx) {
  const story = STORY_BEATS[idx];
  if (story && !PROFILE.dialoguesSeen[idx]) { go('dialogue', { beat: story, then: () => goInstant('intro', idx), markSeen: idx }); }
  else go('intro', idx);
}
function startEndless() {
  go('intro', 'endless');
}

// ================================================== LEVEL INTRO SCENE
Scenes.intro = {
  enter(idx) {
    if (!PROFILE.flags.sawHelp) { PROFILE.flags.sawHelp = true; toggleHelp(true); }
    this.idx = idx; this.t = 0;
    this.endless = idx === 'endless';
    this.cfg = this.endless ? LEVELS[19] : LEVELS[idx];
    const g = this.cfg.goals || {};
    UI.announceScreen(this.endless ? 'Endless Greenhouse' : 'Day ' + (idx + 1) + ' briefing',
      'One star at ' + (g.one || 0) + ' points, three at ' + (g.three || 0) +
      '. Tab to Open the doors, then Enter.');
  },
  update(dt) { this.t += dt; },
  draw() {
    const vi = this.endless ? 4 : Math.floor(this.idx / 4);
    drawVenueBackground(vi, true);
    ctx.fillStyle = 'rgba(30,38,24,.55)'; ctx.fillRect(0, 0, W, H);
    const k = ease.back(clamp(this.t / 0.5, 0, 1));
    ctx.save(); ctx.translate(W / 2, H / 2 - 30); ctx.scale(k, k);
    panel(-260, -150, 520, 310, { fill: 'rgba(44,56,34,.96)' });
    const V = VENUES[vi];
    title(this.endless ? 'Endless Greenhouse' : `Day ${this.idx + 1}`, 0, -100, 40, '#8fd06a');
    ctx.font = "bold 18px Georgia"; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd66b';
    ctx.fillText(V.name + ' — ' + V.sub, 0, -66);
    if (!this.endless) {
      const g = this.cfg.goals;
      ctx.font = "15px 'Trebuchet MS'"; ctx.fillStyle = '#e8e4d0';
      ctx.fillText(`${this.cfg.spawns.length} plant guests on the books`, 0, -34);
      // star goals
      const stars = [['★', g.one], ['★★', g.two], ['★★★', g.three]];
      for (let i = 0; i < 3; i++) {
        const sx = -150 + i * 150;
        panel(sx - 60, -10, 120, 56, { fill: 'rgba(255,255,255,.08)', r: 10 });
        ctx.fillStyle = '#ffd66b'; ctx.font = "bold 17px 'Trebuchet MS'"; ctx.fillText(stars[i][0], sx, 14);
        ctx.fillStyle = '#f5efdc'; ctx.font = "bold 15px 'Trebuchet MS'"; ctx.fillText(stars[i][1] + ' pts', sx, 36);
      }
      ctx.font = "12px 'Trebuchet MS'"; ctx.fillStyle = 'rgba(238,238,220,.85)';
      ctx.fillText('Expert score: ' + g.expert + ' · beat it for a golden leaf', 0, 66);
      ctx.fillStyle = '#8fd06a'; ctx.font = "bold 12px 'Trebuchet MS'";
      ctx.fillText('WHERE POINTS COME FROM', 0, 96);
      ctx.fillStyle = '#eeeedc'; ctx.font = "12px 'Trebuchet MS'";
      ctx.fillText('Every action ' + CFG.actionPoints + ' pts · cashing out pays the bill · matched pot +'
        + Math.round((CFG.colorMatchPay - 1) * 100) + '% pay', 0, 116);
      ctx.fillText('Repeat the same kind of action for a chain, up to ×' + CFG.chainCap
        + ' · a walk-out costs ' + CFG.angryLossPoints, 0, 134);
    } else {
      ctx.font = "15px 'Trebuchet MS'"; ctx.fillStyle = '#e8e4d0';
      ctx.fillText('Plants keep coming, faster and faster.', 0, -30);
      ctx.fillText('Five angry walk-outs ends the shift.', 0, -8);
      ctx.fillText('Best so far: ' + PROFILE.bestEndlessServed + ' served · ' + PROFILE.bestEndlessScore + ' pts', 0, 20);
    }
    ctx.restore();
    UI.begin();
    UI.button('go', W / 2 - 90, H / 2 + 130, 180, 50, 'Open the doors!', { size: 17, cb: () => this.start() });
    UI.button('bk', W / 2 - 90, H / 2 + 190, 180, 36, 'Back', { color: '#54707e', size: 13, cb: () => go(this.endless ? 'title' : 'map') });
    drawHelpButton(W - 192, 10);
  },
  start() {
    const upgrades = PROFILE.upgrades;
    goInstant('game', { idx: this.endless ? 'endless' : this.idx, upgrades });
  },
};
/* =====================================================================
   BLOOM RUSH — app3.js : the Game scene (play field, HUD, input→core)
   ===================================================================== */
'use strict';

Scenes.game = {
  enter(arg) {
    this.endless = arg.idx === 'endless';
    this.levelIdx = this.endless ? 19 : arg.idx;
    this.lv = new Core.Level(LEVELS[this.levelIdx], { upgrades: arg.upgrades, endless: this.endless });
    this.vi = Math.floor(this.levelIdx / 4);
    this.paused = false;
    this.selQueue = null;         // click-click seating: selected queue plant id
    this.heroPrev = { x: this.lv.hero.x, y: this.lv.hero.y };
    this.facing = 1;
    this.resultSent = false;
    this.plantVis = {};           // id -> {x,y} rendered position (tweened)
    this.shake = 0;
    AudioSys.startMusic(VENUES[this.vi].time);
    this.kbBench = 0;
    UI.announceScreen('Day ' + (this.levelIdx + 1) + ' at ' + VENUES[this.vi].name,
      lv0Goal(this.lv) + ' Number keys act on a bench, Q seats the next plant, H for help.');
  },

  // ---------- helpers
  benchAt(x, y) {
    for (const b of this.lv.benches) if (Math.hypot(x - b.x, y - (b.y + 6)) < 62) return b;
    return null;
  },
  queuePlantAt(x, y) {
    const L = this.lv.layout;
    for (let i = 0; i < this.lv.queue.length; i++) {
      const px = L.entry.x + (i === 0 ? 0 : -i * 46) + (i ? 0 : 0);
      const qx = this.queueX(i), qy = this.queueY(i);
      if (Math.hypot(x - qx, y - qy) < 46) return this.lv.plantById(this.lv.queue[i]);
    }
    return null;
  },
  queueX(i) { return this.lv.layout.entry.x - i * 52 + (i > 2 ? (i - 2) * 6 : 0); },
  queueY(i) { return this.lv.layout.entry.y + Math.sin(i * 2.1) * 4; },

  // ---------- input
  pointerdown(p) {
    if (this.paused || this.lv.over) return;
    const lv = this.lv;
    // 1. queue plant → start drag (or select)
    const qp = this.queuePlantAt(p.x, p.y);
    if (qp) { drag = { plantId: qp.id, x: p.x, y: p.y }; this.selQueue = qp.id; S.click(); return; }
    // 2. counter ready mixes
    const L = lv.layout;
    if (Math.hypot(p.x - (L.counter.x + 56), p.y - L.counter.y) < 46 || Math.hypot(p.x - L.counter.x, p.y - L.counter.y) < 66) {
      if (lv.counter.ready.length) {
        // most urgent ready mix first
        const o = lv.counter.ready[0];
        if (lv.cmd('pickup', { plantId: o.plantId })) { S.click(); return; }
      }
    }
    // 3. wash rack
    if (Math.hypot(p.x - L.wash.x, p.y - L.wash.y) < 70) {
      if (lv.cmd('wash', {})) { S.click(); return; }
    }
    // 4. benches: context action
    const b = this.benchAt(p.x, p.y);
    if (b) {
      // click-click seating
      if (this.selQueue != null && b.plant == null && !b.dirty && !b.needsPot) {
        const sel = lv.plantById(this.selQueue);
        if (sel && sel.state === 'queue' && lv.cmd('seat', { plantId: sel.id, benchId: b.id })) { this.selQueue = null; S.click(); return; }
      }
      if (b.dirty) { if (lv.cmd('pot', { benchId: b.id })) { S.click(); return; } }
      const pl = b.plant != null ? lv.plantById(b.plant) : null;
      if (pl) {
        if (pl.state === 'ready_order' && lv.cmd('order', { plantId: pl.id })) { S.click(); return; }
        if (pl.state === 'waiting_mix') { // clicking bench with mix ready = fetch it
          if (lv.counter.ready.some(o => o.plantId === pl.id) && lv.cmd('pickup', { plantId: pl.id })) { S.click(); return; }
        }
        if (pl.state === 'special' && lv.cmd('mist', { plantId: pl.id })) { S.click(); return; }
        if (pl.state === 'billing' && lv.cmd('checkout', { plantId: pl.id })) { S.click(); return; }
        // fallback: serenade. A spent plant looks identical to an available one once the
        // cooldown bar clears, so say why nothing happened instead of eating the click.
        if (lv.cmd('serenade', { plantId: pl.id })) { S.click(); return; }
        if (pl.serenadesLeft <= 0) { floatText(b.x, b.y - 40, 'heard enough ♪', '#c9c4b2'); S.click(); return; }
      }
    }
  },
  pointerup(p) {
    if (!drag) return;
    const lv = this.lv;
    const b = this.benchAt(p.x, p.y);
    if (b && b.plant == null && !b.dirty && !b.needsPot) {
      if (lv.cmd('seat', { plantId: drag.plantId, benchId: b.id })) { this.selQueue = null; }
    }
    drag = null;
  },
  // Full keyboard control of a shift. Returns true when the key was consumed.
  key(k, e) {
    if (k === 'p' || k === 'P' || k === 'Escape') { this.paused = !this.paused; SAY.say(this.paused ? 'Paused' : 'Resumed', true); return true; }
    if (k === 'm' || k === 'M') { AudioSys.toggleSfx(); AudioSys.toggleMus(VENUES[this.vi].time); return true; }
    if (this.paused || this.lv.over) return false;
    const lv = this.lv;
    if (this.kbBench == null) this.kbBench = 0;

    // 1..6 select a bench and immediately do the obvious thing on it.
    if (k >= '1' && k <= '9') {
      const i = +k - 1;
      if (i < lv.benches.length) { this.kbBench = i; this.kbAct(i); return true; }
      return false;
    }
    switch (k) {
      case 'ArrowRight': case 'ArrowDown':
        this.kbBench = (this.kbBench + 1) % lv.benches.length; this.kbDescribe(); return true;
      case 'ArrowLeft': case 'ArrowUp':
        this.kbBench = (this.kbBench - 1 + lv.benches.length) % lv.benches.length; this.kbDescribe(); return true;
      case 'Enter': case ' ': case 'Spacebar':
        // If the player has tabbed onto an on-screen control, Enter belongs to THAT, not to
        // the bench cursor - otherwise the focus ring points at a button Enter cannot press.
        if (UI.kbd && UI.focusId && UI.live().some(b => b.id === UI.focusId)) return false;
        this.kbAct(this.kbBench); return true;
      case 'q': case 'Q': {                          // seat the front of the queue
        if (!lv.queue.length) { SAY.say('Nobody waiting', true); return true; }
        const b = lv.benches[this.kbBench];
        const target = (b && b.plant == null && !b.dirty && !b.needsPot) ? b : lv.benches.find(x => x.plant == null && !x.dirty && !x.needsPot);
        if (!target) { SAY.say('No free bench', true); return true; }
        const p = lv.plantById(lv.queue[0]);
        if (lv.cmd('seat', { plantId: lv.queue[0], benchId: target.id })) {
          SAY.say('Seating ' + this.spName(p) + ' at bench ' + (target.id + 1) +
                  (p && p.color === target.color ? ', pot match' : ''), true);
        }
        return true;
      }
      case 'w': case 'W': {                          // collect the oldest ready mix
        if (!lv.counter.ready.length) { SAY.say('No mix ready', true); return true; }
        const o = lv.counter.ready[0];
        if (lv.cmd('pickup', { plantId: o.plantId })) SAY.say('Collecting a mix', true);
        else SAY.say('Hands full - wash the pots first', true);
        return true;
      }
      case 'e': case 'E': {                          // sing to the selected plant
        const b = lv.benches[this.kbBench];
        const p = b && b.plant != null && lv.plantById(b.plant);
        if (!p) { SAY.say('Bench ' + (this.kbBench + 1) + ' is empty', true); return true; }
        if (lv.cmd('serenade', { plantId: p.id })) SAY.say('Singing to ' + this.spName(p), true);
        else SAY.say(p.serenadesLeft <= 0 ? 'That one has heard enough' : 'Not yet', true);
        return true;
      }
      case 'r': case 'R': {                          // lift a dirty pot
        const b = lv.benches[this.kbBench];
        const dirty = (b && b.dirty) ? b : lv.benches.find(x => x.dirty);
        if (!dirty) { SAY.say('No dirty pots', true); return true; }
        if (lv.cmd('pot', { benchId: dirty.id })) SAY.say('Lifting the pot from bench ' + (dirty.id + 1), true);
        return true;
      }
      case 'f': case 'F':
        if (lv.cmd('wash', {})) SAY.say('Off to the wash rack', true);
        else SAY.say('Nothing to wash', true);
        return true;
    }
    return false;
  },
  spName(p) { if (!p) return 'a plant'; const sp = SPECIES.find(s => s.id === p.species); return sp ? sp.name : 'a plant'; },
  kbState(b) {
    const lv = this.lv;
    if (!b) return 'nothing';
    if (b.dirty) return 'a dirty pot';
    if (b.plant == null) return 'empty';
    const p = lv.plantById(b.plant); if (!p) return 'empty';
    const h = Math.max(0, Math.round(p.hearts * 10) / 10);
    const st = { reading: 'reading the menu', ready_order: 'ready to order', waiting_mix: 'waiting for a mix',
                 absorbing: 'drinking', special: 'asking for a mist', billing: 'ready to pay',
                 leaving: 'leaving', seating: 'being seated' }[p.state] || p.state;
    return this.spName(p) + ', ' + st + ', ' + h + ' hearts';
  },
  kbDescribe() { SAY.say('Bench ' + (this.kbBench + 1) + ': ' + this.kbState(this.lv.benches[this.kbBench]), true); },
  // One key, the obvious action: order -> mist -> pay, whichever this bench is asking for.
  kbAct(i) {
    const lv = this.lv, b = lv.benches[i];
    if (!b) return;
    if (b.dirty) { if (lv.cmd('pot', { benchId: b.id })) SAY.say('Lifting the pot from bench ' + (i + 1), true); return; }
    if (b.plant == null) {
      if (lv.queue.length && lv.cmd('seat', { plantId: lv.queue[0], benchId: b.id })) { SAY.say('Seating at bench ' + (i + 1), true); return; }
      SAY.say('Bench ' + (i + 1) + ' is empty', true); return;
    }
    const p = lv.plantById(b.plant); if (!p) return;
    if (p.state === 'ready_order' && lv.cmd('order', { plantId: p.id })) { SAY.say('Taking the order at bench ' + (i + 1), true); return; }
    if (p.state === 'special' && lv.cmd('mist', { plantId: p.id })) { SAY.say('Misting bench ' + (i + 1), true); return; }
    if (p.state === 'billing' && lv.cmd('checkout', { plantId: p.id })) { SAY.say('Cashing out bench ' + (i + 1), true); return; }
    this.kbDescribe();
  },

  // ---------- update
  update(dt) {
    if (this.paused || this.lv.over) { if (this.lv.over && !this.resultSent) { this.resultSent = true; setTimeout(() => this.finishLevel(), 600); } return; }
    const lv = this.lv;
    lv.update(dt);
    // hero facing
    if (lv.hero.x > this.heroPrev.x + 0.5) this.facing = 1;
    else if (lv.hero.x < this.heroPrev.x - 0.5) this.facing = -1;
    this.heroPrev = { x: lv.hero.x, y: lv.hero.y };
    this.shake = Math.max(0, this.shake - dt * 3);
    // drain events → juice
    for (const ev of lv.events) this.onEvent(ev);
    lv.events.length = 0;
  },
  onEvent(ev) {
    const lv = this.lv;
    const posOf = id => { const p = lv.plantById(id); const b = p && lv.benchOf(p); return b ? { x: b.x, y: b.y - 20 } : { x: this.queueX(0), y: this.queueY(0) - 20 }; };
    switch (ev.type) {
      case 'arrive': { S.click();
        const p = lv.plantById(ev.id);
        SAY.say(this.spName(p) + ' just walked in. ' + lv.queue.length + ' waiting.'); break; }
      case 'seated': {
        const p = posOf(ev.id); S.seat();
        if (ev.matched) { S.match(); puff(p.x, p.y, { n: 12, color: '#ffd66b', kind: 'spark', size: 8, up: 40 }); floatText(p.x, p.y - 24, 'Pot match!', '#ffd66b', true); }
        else puff(p.x, p.y, { n: 6, color: '#c9b689', size: 3 });
        break;
      }
      case 'ordered': { S.order(); break; }
      // The three moments a plant is blocked on the player. A non-sighted player has no
      // other way to learn that a bench needs attention.
      case 'wants': { const p = lv.plantById(ev.id);
        SAY.say('Bench ' + ((p && p.bench != null ? p.bench + 1 : '?')) + ' is ready to order.'); break; }
      case 'special': { const p = lv.plantById(ev.id);
        SAY.say('Bench ' + ((p && p.bench != null ? p.bench + 1 : '?')) + ' is asking for a mist.'); break; }
      case 'bill': { const p = lv.plantById(ev.id);
        SAY.say('Bench ' + ((p && p.bench != null ? p.bench + 1 : '?')) + ' is ready to pay.'); break; }
      case 'mixready': S.ready(); break;
      case 'pickup': S.click(); break;
      case 'delivered': { const p = posOf(ev.id); S.deliver(); S.water(); puff(p.x, p.y, { n: 10, color: '#5aa7d9', kind: 'drop', speed: 90, up: 60 }); break; }
      case 'misted': { const p = posOf(ev.id); S.water(); puff(p.x, p.y - 10, { n: 14, color: '#9fd4e8', size: 3, speed: 40, up: 20, g: -10 }); break; }
      case 'specialmiss': { const p = posOf(ev.id); floatText(p.x, p.y - 20, '*sigh*', '#c9c4b2'); break; }
      case 'serenade': { const p = posOf(ev.id); S.sing(); for (let i = 0; i < 3; i++) parts.push({ x: p.x - 12 + i * 12, y: p.y - 26, vx: (i - 1) * 14, vy: -46, life: 0, max: 1, kind: 'text', text: i % 2 ? '♪' : '♫', color: '#e97fb2', size: 15, g: -14 }); break; }
      case 'paid': {
        SAY.say('Paid ' + ev.pay + ' coins.');
        const p = posOf(ev.id); S.coin();
        puff(p.x, p.y, { n: 8, color: '#ffd66b', size: 4, up: 60 });
        floatText(p.x, p.y - 26, '+' + ev.pay + ' ☀', '#ffd66b', true);
        if (ev.hearts >= 4.5) floatText(p.x, p.y - 48, 'Delighted!', '#8fd06a');
        break;
      }
      case 'aura': { for (const b of lv.benches) if (b.plant != null) { puff(b.x, b.y - 20, { n: 5, kind: 'heart', color: '#e97fb2', size: 5, up: 40, g: -20 }); } break; }
      case 'points': {
        if (ev.chain >= 2) { const h = lv.hero; floatText(h.x, h.y - 92, '×' + ev.chain + ' chain!', ['', '', '#8fd06a', '#5aa7d9', '#c88fe0', '#ffd66b', '#ff9f6b'][clamp(ev.chain, 2, 6)], ev.chain >= 4); S.chain(ev.chain); }
        break;
      }
      case 'angry': {
        SAY.say('A plant gave up and left. Score penalty.', true);
        const p = lv.plantById(ev.id);
        const pos = p.bench != null ? posOf(ev.id) : { x: this.queueX(0), y: this.queueY(0) };
        S.angry(); this.shake = 0.5;
        puff(pos.x, pos.y - 10, { n: 10, color: '#8a8a80', size: 4, up: 30 });
        floatText(pos.x, pos.y - 30, ev.overflow ? 'Too crowded!' : 'Wilted away…', '#e05b5b', true);
        break;
      }
      case 'fading': { const p = lv.plantById(ev.id);
        SAY.say('Bench ' + ((p && p.bench != null ? p.bench + 1 : '?')) + ' is about to give up!', true); break; }
      case 'washload': S.wash(); break;
      case 'washdone': { const L2 = lv.layout; puff(L2.wash.x, L2.wash.y, { n: 8, color: '#bfe3f0', size: 3.5, up: 50 }); break; }
      case 'recolor': { const b = lv.benches[ev.bench]; puff(b.x, b.y, { n: 6, color: POT_COLORS[ev.color].hex, size: 4, up: 30 }); break; }
      case 'finish': break;
    }
  },
  finishLevel() {
    const lv = this.lv, r = lv.result;
    // fold into profile
    PROFILE.totalServed += r.served;
    PROFILE.bestChain = Math.max(PROFILE.bestChain, r.maxChain);
    PROFILE.colorMatches += r.stats.colorMatches;
    PROFILE.serenades += r.stats.serenades;
    PROFILE.mists += r.stats.mists;
    PROFILE.washed += r.stats.washed;
    for (const k in r.stats.servedBySpecies) PROFILE.speciesSeen[k] = (PROFILE.speciesSeen[k] || 0) + r.stats.servedBySpecies[k];
    for (const k in r.stats.servedByArch) PROFILE.servedByArchTotal[k] = (PROFILE.servedByArchTotal[k] || 0) + r.stats.servedByArch[k];
    if (!this.endless) {
      PROFILE.coins += r.coins;
      const prev = PROFILE.levelStars[this.levelIdx] || 0;
      if (r.stars > prev) PROFILE.levelStars[this.levelIdx] = r.stars;
      PROFILE.levelBest[this.levelIdx] = Math.max(PROFILE.levelBest[this.levelIdx] || 0, r.score);
      if (r.expert) PROFILE.expertBeaten[this.levelIdx] = true;
      if (r.stars >= 1 && this.levelIdx === PROFILE.unlockedLevel && PROFILE.unlockedLevel < 19) PROFILE.unlockedLevel++;
      if (r.stars >= 1 && this.levelIdx === 19) PROFILE.careerDone = true;
      if (r.angry === 0 && r.stars > 0) PROFILE.flags.perfectLevel = true;
    } else {
      PROFILE.coins += Math.round(r.coins * 0.5);
      PROFILE.bestEndlessServed = Math.max(PROFILE.bestEndlessServed, r.served);
      PROFILE.bestEndlessScore = Math.max(PROFILE.bestEndlessScore, r.score);
    }
    checkAchievements();
    goInstant('results', { r, idx: this.levelIdx, endless: this.endless });
  },

  // ---------- draw
  draw() {
    const lv = this.lv;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - .5) * this.shake * 10, (Math.random() - .5) * this.shake * 8);
    drawVenueBackground(this.vi, true);
    const L = lv.layout;

    drawEntryMat(L.entry.x - 20, L.entry.y);
    drawCounterStation(L.counter.x, L.counter.y, lv.counter, lv.prepSlots, lv.prepTime());
    drawWashStation(L.wash.x, L.wash.y, lv.wash, lv.washPending, lv.washSlots, lv.washTime());

    // draw order: sort by y for painter's algorithm
    const drawables = [];
    for (const b of lv.benches) drawables.push({ y: b.y, fn: () => this.drawBenchEntity(b) });
    drawables.push({ y: lv.hero.y, fn: () => drawHero(lv.hero.x, lv.hero.y, lv.hero.tasks.length > 0 && lv.hero.busyT <= 0, lv.hero.carry, this.facing) });
    // queue plants
    for (let i = 0; i < lv.queue.length; i++) {
      const p = lv.plantById(lv.queue[i]);
      if (!p || (drag && drag.plantId === p.id)) continue;
      const qx = this.queueX(i), qy = this.queueY(i);
      drawables.push({ y: qy, fn: () => this.drawQueuePlant(p, qx, qy, i) });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    // seating carry ghost (hero carrying a plant)
    if (lv.hero.seating != null) {
      const p = lv.plantById(lv.hero.seating);
      if (p) drawPottedPlant(p, lv.hero.x + 16 * this.facing, lv.hero.y - 66, 0.7, null);
    }
    // drag ghost
    if (drag) {
      const p = lv.plantById(drag.plantId);
      if (p) {
        // highlight valid benches
        for (const b of lv.benches) if (b.plant == null && !b.dirty && !b.needsPot) drawBench(b, this.vi, true);
        ctx.globalAlpha = 0.85;
        drawPottedPlant(p, drag.x, drag.y - 10, 0.9, null);
        ctx.globalAlpha = 1;
      }
    } else if (this.selQueue != null) {
      for (const b of lv.benches) if (b.plant == null && !b.dirty && !b.needsPot) drawBench(b, this.vi, true);
    }
    // Keyboard cursor. Only painted once the keyboard has actually been used, so pointer
    // players never see it, and it is a shape as well as a colour (not colour-only).
    if (UI.kbd && this.kbBench != null && lv.benches[this.kbBench]) {
      const b = lv.benches[this.kbBench];
      ctx.save();
      ctx.strokeStyle = '#ffd66b'; ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
      ctx.lineDashOffset = -NOW * 18;
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 8, 58, 34, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd66b'; ctx.font = "bold 15px 'Trebuchet MS'"; ctx.textAlign = 'center';
      ctx.fillText('▼ ' + (this.kbBench + 1), b.x, b.y - 52);
      ctx.restore();
    }

    drawParts();
    ctx.restore();
    this.drawHUD();
    if (this.paused) this.drawPause();
  },

  drawQueuePlant(p, qx, qy, i) {
    const sel = this.selQueue === p.id;
    if (sel) { ctx.strokeStyle = withAlpha('#ffd66b', .8); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(qx, qy + 10, 30, 12, 0, 0, TAU); ctx.stroke(); }
    const hop = i === 0 ? Math.abs(Math.sin(NOW * 3)) * 3 : 0;
    drawPottedPlant(p, qx, qy - hop, 0.78, null);
    drawHearts(qx, qy - 72, p.hearts);
    // pot color ribbon tag (stick + tag, contrast-aware glyph)
    const pc = POT_COLORS[p.color];
    ctx.strokeStyle = '#8a6a43'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(qx + 22, qy - 30); ctx.lineTo(qx + 24, qy - 44); ctx.stroke();
    ctx.fillStyle = pc.hex; rr(qx + 16, qy - 60, 18, 18, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,35,.55)'; ctx.lineWidth = 1.5; rr(qx + 16, qy - 60, 18, 18, 4); ctx.stroke();
    const lum = parseInt(pc.hex.slice(1, 3), 16) * .3 + parseInt(pc.hex.slice(3, 5), 16) * .6 + parseInt(pc.hex.slice(5), 16) * .1;
    ctx.fillStyle = lum > 150 ? 'rgba(60,50,30,.85)' : 'rgba(255,255,255,.92)';
    drawGlyph(pc.glyph, qx + 25, qy - 51, 5);
  },

  drawBenchEntity(b) {
    const lv = this.lv;
    drawBench(b, this.vi, false);
    if (b.dirty) { drawPot(b.x, b.y - 2, 40, '#7a6a58', null, true); return; }
    if (b.needsPot) return;   // no pot to draw - that is the whole point of the state
    const p = b.plant != null ? lv.plantById(b.plant) : null;
    if (!p) {
      drawPot(b.x, b.y - 2, 44, POT_COLORS[b.color].hex, POT_COLORS[b.color].glyph, false);
      return;
    }
    // plant in its (matched or bench) pot
    const potColor = POT_COLORS[b.color];
    drawPot(b.x, b.y - 2, 46, potColor.hex, potColor.glyph, false);
    const wilt = 1 - clamp(p.hearts / CFG.heartsMax, 0, 1);
    drawPlant(p.species, b.x, b.y - 18, 0.95, { wilt });
    if (p.state === 'leaving') return;
    drawHearts(b.x, b.y - 86, p.hearts);
    if (p.matched) { ctx.fillStyle = '#ffd66b'; drawGlyph('star', b.x - 40, b.y - 84, 5); }
    // state bubble
    const bx = b.x + 34, by = b.y - 68;
    switch (p.state) {
      case 'reading': drawBubble(bx, by, 44, 26); drawStateIcon('dots', bx, by - 13, 7); break;
      case 'ready_order': drawBubble(bx, by, 48, 28); drawStateIcon('order', bx - 8, by - 13, 8); break;
      case 'waiting_mix': drawBubble(bx, by, 40, 26); drawStateIcon('wait', bx, by - 13, 8); break;
      case 'absorbing': {
        // progress sparkle ring
        const a = Core.ARCH[p.arch];
        const k = clamp(p.t / a.absorb, 0, 1);
        ctx.strokeStyle = withAlpha('#8fd06a', .8); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y - 30, 34, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
        if (Math.random() < 0.05) puff(b.x + (Math.random() - .5) * 30, b.y - 20, { n: 1, color: '#8fd06a', size: 2.5, up: 26, g: -20 });
        break;
      }
      case 'special': { drawBubble(bx, by, 44, 28); drawStateIcon('mist', bx, by - 13, 8); break; }
      case 'billing': { const bob = Math.sin(NOW * 5) * 3; drawBubble(bx, by + bob, 40, 28); drawStateIcon('bill', bx, by - 13 + bob, 8); break; }
    }
    // serenade cooldown shimmer
    if (p.serenadeCd > 0 && p.serenadeCd < CFG.serenadeCooldown) {
      ctx.fillStyle = withAlpha('#e97fb2', .5);
      rr(b.x - 20, b.y + 26, 40 * (1 - p.serenadeCd / CFG.serenadeCooldown), 3, 1.5); ctx.fill();
    }
  },

  // A contextual nudge for the situation the player is actually in. Written after a
  // first-time player sat for several minutes in front of a floor of pot-less benches with
  // nothing on screen explaining why nobody could be seated.
  coachLine() {
    const lv = this.lv;
    const potless = lv.benches.filter(b => b.needsPot).length;
    const dirty = lv.benches.filter(b => b.dirty).length;
    const held = lv.hero.carry.filter(c => c.type === 'pot').length;
    const free = lv.benches.filter(b => b.plant == null && !b.dirty && !b.needsPot).length;
    if (held > 0 && potless > 0) return 'Carry those pots to the Wash Rack →';
    if (potless > 0 && dirty > 0) return 'Lift the dirty pots, then wash them to bring benches back';
    if (potless > 0 && !free) return 'Every bench is waiting on a clean pot — wash one at the rack';
    if (dirty >= 2) return 'Dirty pots are blocking benches — click one to lift it';
    if (lv.queue.length && free && lv.time < 30 && lv.served === 0) return 'Drag a waiting plant onto a free bench';
    if (lv.counter.ready.length) return 'A mix is ready at the counter — click it';
    return null;
  },

  drawHUD() {
    const lv = this.lv;
    // top bar
    ctx.fillStyle = 'rgba(30,38,24,.82)';
    rr(10, 8, 500, 46, 12); ctx.fill();
    // score + progress toward stars
    ctx.textAlign = 'left'; ctx.fillStyle = '#f8f5e8'; ctx.font = "bold 18px 'Trebuchet MS'";
    ctx.fillText(lv.score + ' pts', 24, 38);
    if (lv.debt > 0) {
      // otherwise the score sits at 0 while the player earns points and nothing explains it
      ctx.fillStyle = '#e87a6a'; ctx.font = "bold 12px 'Trebuchet MS'";
      ctx.fillText('−' + Math.round(lv.debt) + ' to repay', 24, 52);
    }
    if (!this.endless) {
      const g = lv.cfg.goals;
      const bw = 250, bx = 130, by = 22;
      ctx.fillStyle = 'rgba(255,255,255,.16)'; rr(bx, by, bw, 16, 8); ctx.fill();
      const frac = clamp(lv.score / g.three, 0, 1);
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#8fd06a'); grad.addColorStop(1, '#ffd66b');
      ctx.fillStyle = grad; rr(bx, by, bw * frac, 16, 8); ctx.fill();
      // star markers
      for (const [goal, sym] of [[g.one, '★'], [g.two, '★★'], [g.three, '★★★']]) {
        const mx = bx + bw * (goal / g.three);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx, by - 2); ctx.lineTo(mx, by + 18); ctx.stroke();
        ctx.fillStyle = lv.score >= goal ? '#ffd66b' : 'rgba(255,255,255,.55)';
        ctx.font = "10px 'Trebuchet MS'"; ctx.textAlign = 'center';
        ctx.fillText(sym, mx, by - 5);
      }
      // remaining guests
      const remaining = lv.cfg.spawns.length - lv.spawnIdx + lv.plants.filter(p => p.state !== 'gone').length;
      ctx.textAlign = 'left'; ctx.fillStyle = '#e8e4d0'; ctx.font = "bold 13px 'Trebuchet MS'";
      ctx.fillText('🌱 ' + lv.served + '/' + lv.cfg.spawns.length + ' served', 396, 26);
      ctx.fillText('☀ ' + lv.coins, 396, 45);
    } else {
      ctx.fillStyle = '#e8e4d0'; ctx.font = "bold 14px 'Trebuchet MS'";
      ctx.fillText('Served: ' + lv.served, 150, 30);
      ctx.fillText('☀ ' + lv.coins, 150, 48);
      // angry meter
      ctx.fillText('Walk-outs:', 260, 30);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < lv.angryLeaves ? '#e05b5b' : 'rgba(255,255,255,.25)';
        ctx.beginPath(); ctx.arc(350 + i * 20, 26, 7, 0, TAU); ctx.fill();
      }
    }
    // chain badge
    if (lv.chain.n >= 2) {
      const pulse = 1 + Math.sin(NOW * 8) * 0.08;
      ctx.save(); ctx.translate(548, 32); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#c88fe0'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#f5efdc'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = "bold 16px 'Trebuchet MS'"; ctx.textAlign = 'center';
      ctx.fillText('×' + lv.chain.n, 0, 6); ctx.restore();
    }
    UI.begin();
    const coach = this.coachLine();
    if (coach) {
      if (coach !== this._coach) { this._coach = coach; SAY.say(coach); }
      ctx.textAlign = 'center';
      ctx.font = "bold 15px 'Trebuchet MS'";          // measure with the font we draw with
      const w = ctx.measureText(coach).width;
      ctx.fillStyle = 'rgba(30,38,24,.90)';
      rr(W / 2 - (w + 56) / 2, H - 54, w + 56, 36, 10); ctx.fill();
      ctx.fillStyle = '#ffd66b';
      ctx.fillText(coach, W / 2, H - 30);
    } else this._coach = null;
    drawHelpButton(W - 256, 10);
    UI.button('pause', W - 192, 10, 58, 44, this.paused ? '▶' : '⏸',
      { color: '#54707e', size: 17, aria: this.paused ? 'Resume' : 'Pause', cb: () => { this.paused = !this.paused; } });
    drawAudioButtons();
    drawToasts(0.016);
  },

  drawPause() {
    ctx.fillStyle = 'rgba(20,26,16,.72)'; ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 190, H / 2 - 130, 380, 260, {});
    title('Paused', W / 2, H / 2 - 76, 36, '#8fd06a');
    ctx.font = "13px 'Trebuchet MS'"; ctx.fillStyle = '#e8e4d0'; ctx.textAlign = 'center';
    ctx.fillText('Drag (or click-click) plants to pots · click benches to serve', W / 2, H / 2 - 40);
    ctx.fillText('Match pot ribbon colors for bonus · wash pots at the rack', W / 2, H / 2 - 20);
    UI.button('resume', W / 2 - 90, H / 2 + 4, 180, 44, 'Resume', { cb: () => { this.paused = false; } });
    UI.button('retry', W / 2 - 90, H / 2 + 56, 180, 36, 'Restart Day', { color: '#c8963f', size: 14, cb: () => goInstant('intro', this.endless ? 'endless' : this.levelIdx) });
    UI.button('quit', W / 2 - 90, H / 2 + 100, 180, 30, 'Leave (lose progress)', { color: '#a05252', size: 12, cb: () => go(this.endless ? 'title' : 'map') });
  },
};
/* =====================================================================
   BLOOM RUSH — app4.js : Results + share card, Shop, Plantdex,
                          Achievements, Dialogue, story data, main loop
   ===================================================================== */
'use strict';

// ======================================================= STORY BEATS
// Original characters: Sage (you), Gran (letters), Marisol the courier,
// and rival chain "Bigg Boxx Garden Co." — all-new writing.
const STORY_BEATS = {
  0: [
    { who: 'gran', name: 'Gran (letter)', text: 'Sage, love — the windowsill is yours now. Water with patience, listen with both ears. Plants tell you what they need; the trick is being there when they say it.' },
    { who: 'sage', name: 'Sage', text: 'One windowsill. Six little pots. Okay, Gran. Let’s see who shows up.' },
  ],
  4: [
    { who: 'marisol', name: 'Marisol (courier)', text: 'Word’s out, Sage! Half the neighborhood ferns are asking for you by name. I found you a greenhouse — leaky roof, good bones, rain does half the misting.' },
    { who: 'sage', name: 'Sage', text: 'A real greenhouse… Gran would plant tomatoes in it out of spite. Let’s open the doors.' },
  ],
  8: [
    { who: 'rival', name: 'Bigg Boxx Garden Co.', text: 'NOTICE: Bigg Boxx now offers 12-minute repotting. Fast. Cheap. Beige. Why wait for “care” when you can have SPEED?' },
    { who: 'sage', name: 'Sage', text: 'Beige?! Plants aren’t parcels. We’ll out-care them — new boutique on Bramble Street, evening hours, warm light.' },
  ],
  12: [
    { who: 'marisol', name: 'Marisol', text: 'The old conservatory’s reopening for night owls. Moon-blooming orchids, fireflies at the glass… also every diva in town. You ready for the night shift?' },
    { who: 'sage', name: 'Sage', text: 'Fireflies work for free, so the lighting budget is settled. Bring on the divas.' },
  ],
  16: [
    { who: 'rival', name: 'Bigg Boxx Garden Co.', text: 'FINAL NOTICE: Bigg Boxx will open in the Grand Atrium. The biggest glass. The beigest pots. Surrender your watering can, "Sage."' },
    { who: 'gran', name: 'Gran (letter)', text: 'They offered the Atrium to whoever grows a crowd by solstice. Show them, Sage. Show them what a place feels like when every plant in it is loved.' },
  ],
  19.5: [ // finale (after career)
    { who: 'sage', name: 'Sage', text: 'The Atrium is full — full of ferns and divas and one extremely smug cactus. Gran… we did it. Every pot matched, every frond happy.' },
    { who: 'gran', name: 'Gran (letter)', text: 'I never doubted it for a second, love. P.S. — Bigg Boxx is now a beige mattress outlet. Water with patience. Always.' },
  ],
};
// portraits
function drawPortrait(who, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  if (who === 'sage') { drawHero(0, s * 0.75, false, [], 1); }
  else if (who === 'gran') {
    ctx.fillStyle = '#e8dcc0'; rr(-s * .5, -s * .55, s, s * 1.1, 8); ctx.fill();
    ctx.strokeStyle = '#b39a6a'; ctx.lineWidth = 2; rr(-s * .5, -s * .55, s, s * 1.1, 8); ctx.stroke();
    ctx.strokeStyle = '#c9b689'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * .34, -s * .3 + i * s * .18); ctx.lineTo(s * .34, -s * .3 + i * s * .18); ctx.stroke(); }
    ctx.fillStyle = '#c8622f'; ctx.beginPath(); ctx.arc(s * .28, s * .34, s * .13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f5efdc'; ctx.font = `italic ${Math.round(s * .2)}px Georgia`; ctx.textAlign = 'center';
    ctx.fillText('G', s * .28, s * .41);
    drawPlant('sprout', -s * .26, s * .5, 0.7, {});
  } else if (who === 'marisol') {
    ctx.fillStyle = 'rgba(20,30,15,.2)'; ctx.beginPath(); ctx.ellipse(0, s * .78, s * .5, s * .12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9a05a'; ctx.beginPath(); ctx.arc(0, -s * .1, s * .32, 0, TAU); ctx.fill(); // face
    ctx.fillStyle = '#2e2a3d'; ctx.beginPath(); ctx.arc(0, -s * .22, s * .33, Math.PI, TAU); ctx.fill(); // hair
    ctx.fillStyle = '#2e2a3d'; rr(-s * .38, -s * .26, s * .12, s * .5, 4); ctx.fill();
    ctx.fillStyle = '#3a2e24'; ctx.beginPath(); ctx.arc(-s * .1, -s * .1, s * .04, 0, TAU); ctx.arc(s * .1, -s * .1, s * .04, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a05252'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, s * .1, .2, Math.PI - .2); ctx.stroke();
    ctx.fillStyle = '#c8963f'; rr(-s * .3, s * .12, s * .6, s * .5, 6); ctx.fill(); // courier jacket
    ctx.fillStyle = '#f5efdc'; rr(-s * .3, s * .26, s * .6, s * .08, 2); ctx.fill();
    // parcel of seedlings
    ctx.fillStyle = '#a8794a'; rr(s * .2, s * .3, s * .34, s * .26, 3); ctx.fill();
    drawPlant('sprout', s * .37, s * .32, 0.5, {});
  } else { // rival: beige box robot
    ctx.fillStyle = '#cfc4ae'; rr(-s * .42, -s * .5, s * .84, s * 1.1, 4); ctx.fill();
    ctx.strokeStyle = '#8a8070'; ctx.lineWidth = 2; rr(-s * .42, -s * .5, s * .84, s * 1.1, 4); ctx.stroke();
    ctx.fillStyle = '#8a8070'; rr(-s * .3, -s * .34, s * .6, s * .2, 2); ctx.fill();
    ctx.fillStyle = '#e05b5b'; ctx.beginPath(); ctx.arc(-s * .14, -s * .24, s * .05, 0, TAU); ctx.arc(s * .14, -s * .24, s * .05, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a8070'; ctx.font = `bold ${Math.round(s * .16)}px 'Trebuchet MS'`; ctx.textAlign = 'center';
    ctx.fillText('BIGG', 0, s * .1); ctx.fillText('BOXX', 0, s * .28);
    ctx.fillStyle = '#cfc4ae'; rr(-s * .56, -s * .1, s * .14, s * .4, 3); ctx.fill(); rr(s * .42, -s * .1, s * .14, s * .4, 3); ctx.fill();
  }
  ctx.restore();
}

// ===================================================== DIALOGUE SCENE
Scenes.dialogue = {
  enter(arg) {
    this.beat = arg.beat; this.then = arg.then; this.i = 0; this.chars = 0;
    if (arg.markSeen != null) PROFILE.dialoguesSeen[arg.markSeen] = true;
  },
  update(dt) {
    this.chars += dt * 46;
    const line = this.beat[this.i];
    if (line && this.chars >= line.text.length && this._said !== this.i) {
      this._said = this.i;
      SAY.say(line.name + ' says: ' + line.text + '. Press Enter to continue.', true);
    }
  },
  key(k) {
    if (k === 'Enter' || k === ' ' || k === 'Spacebar' || k === 'ArrowRight') { this.pointerdown(); return true; }
    if (k === 'Escape') { this.i = this.beat.length - 1; this.pointerdown(); return true; }
    return false;
  },
  draw() {
    const vi = 0;
    drawVenueBackground(clamp(Math.floor((PROFILE.unlockedLevel) / 4), 0, 4), false);
    ctx.fillStyle = 'rgba(28,34,22,.6)'; ctx.fillRect(0, 0, W, H);
    const line = this.beat[this.i];
    // portrait
    drawPortrait(line.who, 150, H - 260, 120);
    // dialogue panel
    panel(60, H - 190, W - 120, 150, { fill: 'rgba(38,46,30,.94)' });
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd66b'; ctx.font = "bold 17px Georgia";
    ctx.fillText(line.name, 90, H - 158);
    // typewriter body
    const shown = line.text.slice(0, Math.floor(this.chars));
    ctx.fillStyle = '#f0ecd8'; ctx.font = "15px 'Trebuchet MS'";
    wrapText(shown, 90, H - 132, W - 190, 22);
    ctx.font = "12px 'Trebuchet MS'"; ctx.fillStyle = 'rgba(230,230,210,.6)';
    ctx.fillText('click or press Enter to continue  ·  ' + (this.i + 1) + '/' + this.beat.length, 90, H - 56);
    UI.begin();
  },
  pointerdown() {
    const line = this.beat[this.i];
    if (this.chars < line.text.length) { this.chars = line.text.length; return; }
    this.i++; this.chars = 0; S.page();
    if (this.i >= this.beat.length) { this.then ? this.then() : go('map'); }
  },
};
function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w2 of words) {
    const test = line ? line + ' ' + w2 : w2;
    if (ctx.measureText(test).width > maxW) { ctx.fillText(line, x, yy); line = w2; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

// ====================================================== RESULTS SCENE
Scenes.results = {
  enter(arg) {
    this.r = arg.r; this.idx = arg.idx; this.endless = arg.endless;
    this.t = 0; this.starsShown = 0; this.confettiDone = false;
    this.shareUrl = null;
    if (!this.endless && this.r.stars > 0) S.star(); else if (!this.endless) S.fail();
    if (this.endless) S.star();
    // The whole result was on-canvas only: a screen-reader user finished a shift and was
    // told nothing about how it went.
    const r = this.r;
    UI.announceScreen(this.endless ? 'Endless shift over' : 'Day ' + (this.idx + 1) + ' complete',
      (this.endless ? '' : r.stars + ' of 3 stars. ') +
      r.score + ' points, ' + r.served + ' plants served, ' + r.angry + ' walked out, ' +
      r.coins + ' sunseeds earned, best chain ' + r.maxChain + '.' +
      (r.expert ? ' Expert score beaten.' : ''));
    // finale story
    this.finale = (!this.endless && this.idx === 19 && this.r.stars > 0 && !PROFILE.dialoguesSeen[19.5]);
  },
  update(dt) {
    this.t += dt;
    const target = this.endless ? 0 : this.r.stars;
    if (this.starsShown < target && this.t > 0.8 + this.starsShown * 0.5) { this.starsShown++; S.star(); }
    if (!REDUCED && !this.confettiDone && this.t > 0.6 && (this.endless || this.r.stars >= 2)) {
      this.confettiDone = true;
      for (let i = 0; i < 40; i++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * 100, vx: (Math.random() - .5) * 40, vy: 60 + Math.random() * 60, life: 0, max: 4, kind: 'petal', size: 5 + Math.random() * 3, color: ['#e97fb2', '#8fd06a', '#ffd66b', '#5aa7d9', '#c88fe0'][i % 5], g: 10, rot: Math.random() * TAU, vr: 2 });
    }
  },
  draw() {
    const vi = Math.floor(this.idx / 4);
    drawVenueBackground(vi, false);
    ctx.fillStyle = 'rgba(30,38,24,.6)'; ctx.fillRect(0, 0, W, H);
    drawParts();
    const r = this.r;
    panel(W / 2 - 270, 46, 540, 470, { fill: 'rgba(40,50,32,.95)' });
    if (!this.endless) {
      title(r.stars > 0 ? 'Day Complete!' : 'The shift got away…', W / 2, 100, 38, r.stars > 0 ? '#8fd06a' : '#e0a05b');
      // stars
      for (let i = 0; i < 3; i++) {
        const sx = W / 2 - 70 + i * 70, sy = 150;
        const on = i < this.starsShown;
        const pop = on ? 1 + Math.max(0, 0.4 - (this.t - 0.8 - i * 0.5)) * 1.2 : 1;
        ctx.save(); ctx.translate(sx, sy); ctx.scale(pop, pop);
        ctx.fillStyle = on ? '#ffd66b' : 'rgba(255,255,255,.18)';
        drawGlyph('star', 0, 0, 26);
        if (on) { ctx.strokeStyle = 'rgba(255,240,190,.8)'; ctx.lineWidth = 2; drawGlyphStroke('star', 0, 0, 26); }
        ctx.restore();
      }
      if (r.expert) { ctx.fillStyle = '#8fd06a'; ctx.font = "bold 15px Georgia"; ctx.textAlign = 'center'; ctx.fillText('🍃 EXPERT SCORE — golden leaf earned!', W / 2, 196); }
    } else {
      title('Shift Report', W / 2, 100, 38, '#8fd06a');
      ctx.fillStyle = '#ffd66b'; ctx.font = "bold 20px 'Trebuchet MS'"; ctx.textAlign = 'center';
      ctx.fillText(r.served + ' plants served', W / 2, 150);
      if (r.served >= PROFILE.bestEndlessServed) { ctx.fillStyle = '#8fd06a'; ctx.font = "bold 14px 'Trebuchet MS'"; ctx.fillText('New personal best!', W / 2, 176); }
    }
    // stat rows
    const rows = [
      ['Score', r.score + (this.endless ? '' : ' / ' + LEVELS[this.idx].goals.three + ' for ★★★')],
      ['Sunseeds earned', '☀ ' + r.coins + (this.endless ? ' (half banked from endless)' : '')],
      ['Best chain', '×' + r.maxChain],
      ['Pot matches', r.colorMatches + ''],
      ['Happy checkouts', (r.served - r.angry < 0 ? 0 : r.served) + ''],
      ['Wilted walk-outs', r.angry + (r.angry === 0 ? '  🌟 perfect!' : '')],
    ];
    let ry = this.endless ? 210 : 232;
    ctx.font = "15px 'Trebuchet MS'";
    for (const [k, v] of rows) {
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(230,230,210,.85)'; ctx.fillText(k, W / 2 - 220, ry);
      ctx.textAlign = 'right'; ctx.fillStyle = '#f8f5e8'; ctx.fillText(v, W / 2 + 220, ry);
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(W / 2 - 220, ry + 8); ctx.lineTo(W / 2 + 220, ry + 8); ctx.stroke();
      ry += 30;
    }
    UI.begin();
    const canNext = !this.endless && r.stars > 0 && this.idx < 19;
    let bx = W / 2 - 250;
    if (!this.endless && r.stars === 0) {
      UI.button('retry', bx, 440, 150, 46, 'Try Again', { color: '#c8963f', cb: () => goInstant('intro', this.idx) }); bx += 162;
    } else if (!this.endless) {
      UI.button('replay', bx, 440, 120, 46, 'Replay', { color: '#54707e', size: 14, cb: () => goInstant('intro', this.idx) }); bx += 132;
    } else {
      UI.button('again', bx, 440, 150, 46, 'One More Shift', { color: '#8c4f8c', size: 14, cb: () => goInstant('intro', 'endless') }); bx += 162;
    }
    UI.button('share', bx, 440, 150, 46, 'Share Card', { color: '#3d7dc8', size: 15, cb: () => this.makeShare() }); bx += 162;
    if (canNext) { UI.button('next', bx, 440, 176, 46, this.finale ? 'Finale ➜' : 'Next: Shop ➜', { size: 15, cb: () => this.exit(true) }); }
    else { UI.button('map', bx, 440, 176, 46, this.endless ? 'Title' : 'Back to Map', { color: '#5f7d3a', size: 15, cb: () => this.exit(false) }); }
    drawToasts(0.016);
  },
  exit(next) {
    if (this.finale) { go('dialogue', { beat: STORY_BEATS[19.5], then: () => goInstant('shop'), markSeen: 19.5 }); return; }
    if (this.endless) { go('title'); return; }
    if (next) go('shop'); else go('map');
  },
  makeShare() {
    const url = renderShareCard(this.r, this.idx, this.endless);
    const a = document.createElement('a');
    a.href = url; a.download = 'bloom-rush-day' + (this.endless ? '-endless' : (this.idx + 1)) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Share card saved!', 'A 1200×630 PNG postcard of this run.');
  },
};
function drawGlyphStroke(glyph, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r2 = i % 2 ? s * 0.45 : s, a = -Math.PI / 2 + i * Math.PI / 5; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r2, y + Math.sin(a) * r2); }
  ctx.closePath(); ctx.stroke();
}

// ------------------------------------------------------- SHARE CARD
function renderShareCard(r, idx, endless) {
  const cw = 1200, ch = 630;
  const oc = document.createElement('canvas'); oc.width = cw; oc.height = ch;
  const c = oc.getContext('2d');
  const mainCtx = ctx;             // swap global ctx so art lib draws onto the card
  setCtx(c);
  // background
  const vi = Math.floor(idx / 4);
  const A = VENUE_ART[vi];
  const g = c.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, A.sky[0]); g.addColorStop(0.55, A.sky[1]); g.addColorStop(1, shade(A.floor, -10));
  c.fillStyle = g; c.fillRect(0, 0, cw, ch);
  // decorative frame
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 6;
  c.strokeRect(24, 24, cw - 48, ch - 48);
  c.strokeStyle = 'rgba(60,70,40,.5)'; c.lineWidth = 2;
  c.strokeRect(34, 34, cw - 68, ch - 68);
  // corner plants
  drawPot(110, 560, 110, '#c8622f', 'triangle'); drawPlant('monstera', 110, 520, 2.3, {});
  drawPot(1090, 560, 100, '#3d7dc8', 'circle'); drawPlant('orchid', 1090, 524, 2.2, {});
  drawPot(980, 585, 70, '#5f7d3a', 'star'); drawPlant('echeveria', 980, 560, 1.5, {});
  // petals
  for (let i = 0; i < 26; i++) {
    c.save(); c.translate((i * 217 + 60) % cw, (i * 133 + 40) % (ch * 0.5)); c.rotate(i);
    c.fillStyle = withAlpha(['#e97fb2', '#8fd06a', '#ffd66b'][i % 3], .5);
    c.beginPath(); c.ellipse(0, 0, 9, 5, 0, 0, TAU); c.fill(); c.restore();
  }
  // title
  c.textAlign = 'center';
  c.font = 'italic bold 64px Georgia'; c.lineWidth = 12; c.strokeStyle = 'rgba(40,50,25,.9)';
  c.strokeText('Bloom Rush', cw / 2, 110); c.fillStyle = '#8fd06a'; c.fillText('Bloom Rush', cw / 2, 110);
  c.font = 'bold 30px Georgia'; c.fillStyle = '#3f4a2e';
  c.fillText(endless ? 'Endless Greenhouse — Shift Report' : `Day ${idx + 1} · ${VENUES[vi].name}`, cw / 2, 158);
  // stars
  if (!endless) {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i < r.stars ? '#ffd66b' : 'rgba(255,255,255,.35)';
      c.save(); c.translate(cw / 2 - 90 + i * 90, 226);
      c.beginPath();
      for (let j = 0; j < 10; j++) { const rr2 = j % 2 ? 16 : 36, a = -Math.PI / 2 + j * Math.PI / 5; c[j ? 'lineTo' : 'moveTo'](Math.cos(a) * rr2, Math.sin(a) * rr2); }
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(120,90,20,.5)'; c.lineWidth = 3; c.stroke();
      c.restore();
    }
    if (r.expert) { c.fillStyle = '#4a8a3a'; c.font = 'bold 26px Georgia'; c.fillText('🍃 EXPERT — golden leaf', cw / 2, 296); }
  } else {
    c.fillStyle = '#3f4a2e'; c.font = 'bold 54px Georgia';
    c.fillText(r.served + ' plants served', cw / 2, 240);
  }
  // stat plaques
  const plaques = [
    ['SCORE', String(r.score)], ['BEST CHAIN', '×' + r.maxChain],
    ['POT MATCHES', String(r.colorMatches)], ['SUNSEEDS', '☀ ' + r.coins],
  ];
  for (let i = 0; i < 4; i++) {
    const px = 190 + i * 210, py = endless ? 330 : 340;
    c.fillStyle = 'rgba(40,50,32,.85)';
    c.beginPath(); c.roundRect(px - 90, py, 180, 110, 14); c.fill();
    c.strokeStyle = 'rgba(220,230,190,.4)'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(px - 87, py + 3, 174, 104, 12); c.stroke();
    c.fillStyle = '#ffd66b'; c.font = "bold 20px 'Trebuchet MS'"; c.fillText(plaques[i][0], px, py + 36);
    c.fillStyle = '#f8f5e8'; c.font = "bold 40px 'Trebuchet MS'"; c.fillText(plaques[i][1], px, py + 86);
  }
  // MVP plant
  let mvp = null, mvpN = 0;
  for (const k in r.stats.servedBySpecies) if (r.stats.servedBySpecies[k] > mvpN) { mvpN = r.stats.servedBySpecies[k]; mvp = k; }
  if (mvp) {
    const sp = SPECIES.find(s => s.id === mvp);
    drawPot(cw / 2, 560, 90, '#8c4f8c', 'diamond'); drawPlant(mvp, cw / 2, 528, 2.0, {});
    c.fillStyle = '#3f4a2e'; c.font = 'bold 22px Georgia';
    c.fillText('Guest of honor: ' + sp.name + ' (×' + mvpN + ')', cw / 2, 610);
  }
  c.fillStyle = 'rgba(60,70,45,.75)'; c.font = "18px 'Trebuchet MS'";
  c.fillText(r.angry === 0 ? 'Not a single frond wilted. Flawless.' : 'An original botanical time-management game', cw / 2, endless ? 300 : 320);
  setCtx(mainCtx);
  return oc.toDataURL('image/png');
}
// ctx swap shim: art lib reads the shared `ctx` binding (declared with `let` in app1)
function setCtx(c) { ctx = c; }

// ========================================================= SHOP SCENE
Scenes.shop = {
  enter() { this.bought = null;
    UI.announceScreen('The Supply Shed', PROFILE.coins + ' sunseeds. Tab through the upgrades, Enter to buy.'); },
  draw() {
    drawVenueBackground(clamp(Math.floor(PROFILE.unlockedLevel / 4), 0, 4), false);
    ctx.fillStyle = 'rgba(30,38,24,.66)'; ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 330, 28, 660, 528, { fill: 'rgba(44,54,34,.96)' });
    title('The Supply Shed', W / 2, 68, 32, '#ffd66b');
    ctx.font = "13px 'Trebuchet MS'"; ctx.fillStyle = '#f2efdf'; ctx.textAlign = 'center';
    ctx.fillText('Permanent upgrades — every level is beatable without them, but oh, the comfort.', W / 2, 92);
    ctx.font = "bold 16px 'Trebuchet MS'"; ctx.fillStyle = '#ffd66b';
    ctx.fillText('☀ ' + PROFILE.coins + ' sunseeds', W / 2, 114);
    UI.begin();
    const venueNow = Math.floor(PROFILE.unlockedLevel / 4);
    // Row pitch is derived from the row COUNT and the panel height, so adding an upgrade
    // can never again push the last buy button off the bottom of the canvas.
    const rowTop = 134, rowBottom = 524;
    const step = Math.min(46, Math.floor((rowBottom - rowTop) / UPGRADES.length));
    let y = rowTop + Math.round(step * 0.32);
    for (const u of UPGRADES) {
      const owned = !!PROFILE.upgrades[u.id];
      const locked = u.venue > venueNow;
      const afford = PROFILE.coins >= u.cost;
      ctx.textAlign = 'left';
      ctx.fillStyle = owned ? '#8fd06a' : (locked ? 'rgba(200,200,180,.5)' : '#f8f5e8');
      ctx.font = "bold 15px 'Trebuchet MS'";
      ctx.fillText(u.name, W / 2 - 300, y + 8);
      ctx.fillStyle = 'rgba(225,225,205,.75)'; ctx.font = "12px 'Trebuchet MS'";
      ctx.fillText(locked ? u.desc + '   (unlocks at ' + VENUES[u.venue].name + ')' : u.desc, W / 2 - 300, y + 26);
      if (owned) {
        ctx.fillStyle = '#8fd06a'; ctx.font = "bold 14px 'Trebuchet MS'"; ctx.textAlign = 'right';
        ctx.fillText('OWNED ✓', W / 2 + 300, y + 16);
      } else if (!locked) {
        UI.button('buy_' + u.id, W / 2 + 176, y - 8, 124, Math.min(36, step - 4), 'Buy ☀ ' + u.cost, {
          size: 13, color: afford ? '#5f7d3a' : '#6a6a60', disabled: !afford,
          cb: () => { if (PROFILE.coins >= u.cost && !PROFILE.upgrades[u.id]) { PROFILE.coins -= u.cost; PROFILE.upgrades[u.id] = 1; S.coin(); toast('Upgrade installed!', u.name + ' — ' + u.desc); } },
        });
      } else {
        ctx.fillStyle = 'rgba(200,200,180,.5)'; ctx.font = "bold 16px 'Trebuchet MS'"; ctx.textAlign = 'right';
        ctx.fillText('🔒', W / 2 + 296, y + 16);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.beginPath();
      ctx.moveTo(W / 2 - 300, y + step - 10); ctx.lineTo(W / 2 + 300, y + step - 10); ctx.stroke();
      y += step;
    }
    UI.button('done', W / 2 - 90, 548, 180, 40, 'Back to the Trail', { size: 15, cb: () => go('map') });
    drawToasts(0.016);
  },
  update() {},
};

// ====================================================== ALBUM SCENE
Scenes.album = {
  enter() {
    const met = SPECIES.filter(s => PROFILE.speciesSeen[s.id]).length;
    UI.announceScreen('Plantdex', met + ' of ' + SPECIES.length + ' species met. Tab to the Back button to leave.'); },
  update() {},
  draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2e3a26'); g.addColorStop(1, '#1e2818');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    title('The Plantdex', W / 2, 64, 44, '#8fd06a');
    ctx.font = "14px 'Trebuchet MS'"; ctx.fillStyle = 'rgba(230,230,210,.75)'; ctx.textAlign = 'center';
    const met = Object.keys(PROFILE.speciesSeen).length;
    ctx.fillText('Every guest you serve earns a page · ' + met + '/' + SPECIES.length + ' met', W / 2, 92);
    UI.begin();
    for (let i = 0; i < SPECIES.length; i++) {
      const sp = SPECIES[i];
      const col = i % 4, row = Math.floor(i / 4);
      const x = W / 2 - 340 + col * 176, y2 = 130 + row * 152;
      const seen = PROFILE.speciesSeen[sp.id];
      panel(x, y2, 160, 136, { fill: seen ? 'rgba(58,72,44,.92)' : 'rgba(40,44,36,.8)', r: 12 });
      if (seen) {
        drawPot(x + 80, y2 + 84, 44, POT_COLORS[i % 5].hex, POT_COLORS[i % 5].glyph);
        drawPlant(sp.id, x + 80, y2 + 68, 0.85, {});
        ctx.fillStyle = '#ffd66b'; ctx.font = "bold 12.5px 'Trebuchet MS'"; ctx.textAlign = 'center';
        ctx.fillText(sp.name, x + 80, y2 + 116);
        ctx.fillStyle = 'rgba(230,230,210,.7)'; ctx.font = "10px 'Trebuchet MS'";
        ctx.fillText('served ×' + seen + ' · ' + Core.ARCH[sp.arch].name, x + 80, y2 + 130);
      } else {
        ctx.fillStyle = 'rgba(150,160,130,.5)'; ctx.font = "bold 42px Georgia"; ctx.textAlign = 'center';
        ctx.fillText('?', x + 80, y2 + 82);
        ctx.font = "11px 'Trebuchet MS'"; ctx.fillText('not yet met', x + 80, y2 + 116);
      }
    }
    // flavor text for hovered card
    for (let i = 0; i < SPECIES.length; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = W / 2 - 340 + col * 176, y2 = 130 + row * 152;
      if (PROFILE.speciesSeen[SPECIES[i].id] && MOUSE.x >= x && MOUSE.x <= x + 160 && MOUSE.y >= y2 && MOUSE.y <= y2 + 136) {
        const tip = SPECIES[i].flavor;
        ctx.font = "italic 13px Georgia";
        const tw = ctx.measureText(tip).width + 26;
        panel(clamp(MOUSE.x - tw / 2, 8, W - tw - 8), y2 - 34, tw, 28, { fill: 'rgba(30,36,24,.95)', r: 8 });
        ctx.fillStyle = '#ffe9b3'; ctx.textAlign = 'left';
        ctx.fillText(tip, clamp(MOUSE.x - tw / 2, 8, W - tw - 8) + 13, y2 - 15);
      }
    }
    UI.button('back', W / 2 - 80, H - 52, 160, 38, 'Back', { color: '#54707e', size: 14, cb: () => go('title') });
  },
};

// ================================================ ACHIEVEMENTS SCENE
Scenes.achievements = {
  enter() {
    UI.announceScreen('Awards', Object.keys(PROFILE.achievements).length + ' of ' + ACHIEVEMENTS.length + ' earned. Tab to the Back button to leave.'); },
  update() {},
  draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a2e26'); g.addColorStop(1, '#241d18');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const got = Object.keys(PROFILE.achievements).length;
    title('Garden Awards', W / 2, 60, 40, '#ffd66b');
    ctx.font = "14px 'Trebuchet MS'"; ctx.fillStyle = 'rgba(235,225,205,.75)'; ctx.textAlign = 'center';
    ctx.fillText(got + ' of ' + ACHIEVEMENTS.length + ' earned', W / 2, 88);
    UI.begin();
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      const col = i % 3, row = Math.floor(i / 3);
      const x = W / 2 - 435 + col * 300, y2 = 112 + row * 56;
      const has = PROFILE.achievements[a.id];
      panel(x, y2, 284, 48, { fill: has ? 'rgba(90,72,36,.9)' : 'rgba(52,46,40,.8)', r: 10 });
      ctx.fillStyle = has ? '#ffd66b' : 'rgba(160,150,130,.5)';
      drawGlyph('star', x + 24, y2 + 24, has ? 10 : 8);
      ctx.textAlign = 'left'; ctx.font = "bold 12.5px 'Trebuchet MS'";
      ctx.fillStyle = has ? '#ffe9b3' : 'rgba(190,180,160,.6)';
      ctx.fillText(a.name, x + 44, y2 + 20);
      ctx.font = "10.5px 'Trebuchet MS'"; ctx.fillStyle = has ? 'rgba(235,225,200,.8)' : 'rgba(170,160,145,.55)';
      ctx.fillText(a.desc, x + 44, y2 + 36);
    }
    UI.button('back', W / 2 - 80, H - 46, 160, 36, 'Back', { color: '#54707e', size: 14, cb: () => go('title') });
  },
};

// =========================================================== MAIN LOOP
let last = 0, acc = 0;
const STEP = 1 / 60;
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000;
  let dt = Math.min(0.1, t - last); last = t;
  NOW = t;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) { if (scene && scene.update) scene.update(STEP); stepTweens(STEP); stepParts(STEP); acc -= STEP; steps++; }
  if (scene && scene.draw) { UI.begin(); scene.draw(); }
  if (helpOpen) { UI.begin(); drawHelp(); }   // rebuild hit rects: help owns input while open
  drawTransition(dt);
  SAY.flush();
}
goInstant('title');
requestAnimationFrame(frame);
