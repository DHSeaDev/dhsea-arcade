/* Annoying Dino v2.0 — page engine. Original art, sound, and text. #DHSeaDev
   Bundled from src/. Injected as a classic script; idempotent by guard. */
(() => {
  // src/art/styles.js
  var CSS = `
:host{all:initial}
*{box-sizing:border-box}
.ad-layer{position:fixed;inset:0;pointer-events:none}
.ad-canvas{position:fixed;left:0;top:0;pointer-events:none}

.ad-dino{position:fixed;left:0;top:0;will-change:transform;cursor:pointer;pointer-events:auto;touch-action:none}
.ad-dino.ad-friend{pointer-events:none;opacity:.96}
.ad-svg{display:block;overflow:visible}
.ad-body,.ad-spine,.ad-neck,.ad-head,.ad-leg,.ad-arm,.ad-tailseg{transform-box:view-box}
.ad-eyes{transform-box:fill-box;transform-origin:center}

.ad-shadow{position:fixed;left:0;top:0;width:90px;height:18px;margin:-9px 0 0 -45px;
  border-radius:50%;background:radial-gradient(closest-side,rgba(20,26,18,.42),rgba(20,26,18,0));
  pointer-events:none;will-change:transform,opacity}
.ad-ptero-shadow{width:110px;height:20px;margin:-10px 0 0 -55px}

.ad-egg{position:fixed;left:0;top:0;pointer-events:auto;cursor:grab;will-change:transform}
.ad-ptero{position:fixed;left:0;top:0;pointer-events:none;will-change:transform}
.ad-volcano{position:fixed;left:0;top:0;pointer-events:none;will-change:transform}
.ad-meteor{position:fixed;left:0;top:0;pointer-events:none;will-change:transform}
.ad-stolen{position:fixed;left:0;top:0;pointer-events:none;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35));
  border-radius:6px;overflow:hidden;will-change:transform}
.ad-crater,.ad-graffiti,.ad-splat,.ad-fossil{position:fixed;left:0;top:0;pointer-events:none;
  transition:opacity 1.2s linear}

.ad-ring{position:fixed;left:0;top:0;width:80px;height:26px;margin:-13px 0 0 -40px;
  border:3px solid rgba(255,220,150,.9);border-radius:50%;pointer-events:none;will-change:transform,opacity}
.ad-flash{position:fixed;inset:0;background:#fff6e0;opacity:0;pointer-events:none;transition:opacity .12s linear}
.ad-sepia{position:fixed;inset:0;pointer-events:none;background:rgba(120,92,52,.35);
  backdrop-filter:sepia(.9) contrast(.92);opacity:0;transition:opacity .5s ease}
.ad-sepia.on{opacity:1}

.ad-bubble{position:fixed;left:0;top:0;max-width:230px;background:#fffef2;color:#22301c;
  border:2px solid #2c7a38;border-radius:12px;padding:7px 11px;
  font:13px/1.36 "Segoe UI",system-ui,-apple-system,sans-serif;
  box-shadow:0 4px 12px rgba(0,0,0,.22);pointer-events:none;
  opacity:0;transform-origin:14px 100%;will-change:transform,opacity}
.ad-bubble.on{opacity:1;animation:adPop .22s cubic-bezier(.2,1.5,.4,1)}
.ad-bubble::after{content:"";position:absolute;bottom:-8px;left:18px;border:8px solid transparent;
  border-top-color:#2c7a38;border-bottom:0}
@keyframes adPop{0%{transform:scale(.6)}100%{transform:scale(1)}}

.ad-card{position:fixed;left:0;top:0;width:206px;pointer-events:auto;cursor:grab;
  font:13px/1.42 "Segoe UI",system-ui,-apple-system,sans-serif;color:#22301c;
  will-change:transform;user-select:none;-webkit-user-select:none}
.ad-card .ad-card-in{padding:13px 13px 11px;border-radius:12px;position:relative}
.ad-card.paper .ad-card-in{background:#fffef2;border:3px solid #e0932f;
  box-shadow:0 8px 22px rgba(0,0,0,.28)}
.ad-card.polaroid .ad-card-in{background:#fff;border:1px solid #ddd;border-bottom-width:34px;
  border-radius:3px;box-shadow:0 10px 24px rgba(0,0,0,.3)}
.ad-card.tablet .ad-card-in{background:linear-gradient(160deg,#cfc9b6,#b6b0a0);border:3px solid #8f8975;
  border-radius:6px;color:#2b271d;box-shadow:0 8px 20px rgba(0,0,0,.35)}
.ad-card.comic .ad-card-in{background:#fffdf0;border:3px solid #1c1c1c;border-radius:2px;
  box-shadow:6px 6px 0 #1c1c1c}
.ad-card b{display:block;margin-bottom:7px;font-weight:700}
.ad-card .ad-punch{color:#2c7a38;font-weight:700;min-height:1.4em}
.ad-card .ad-tap{color:#8a8a7a;font-style:italic;cursor:pointer}
.ad-card .ad-x{position:absolute;top:2px;right:8px;cursor:pointer;color:#c94f3d;
  font-weight:700;font-size:15px;line-height:1}
.ad-card.settling{transition:transform .5s cubic-bezier(.2,1.3,.35,1)}

.ad-print{position:fixed;left:0;top:0;width:12px;height:8px;margin:-4px 0 0 -6px;border-radius:50%;
  background:rgba(60,90,50,.30);transition:opacity 2.4s linear;pointer-events:none}

@media (prefers-reduced-motion: reduce){
  .ad-bubble.on{animation:none}
  .ad-flash{display:none}
}
`;

  // src/art/style.js
  var TONE = {
    shell: { shade: "#cfc5a5", base: "#f2ecd8", light: "#fffdf3" },
    bone: { shade: "#c8c2ae", base: "#eae5d5", light: "#ffffff" },
    ink: { shade: "#12130f", base: "#1c1c1c", light: "#3a3a3a" },
    paper: { shade: "#efe7c9", base: "#fffef2", light: "#ffffff" },
    blush: { shade: "#e37f90", base: "#ff9fae", light: "#ffc4cf" },
    lava: { shade: "#a02510", base: "#ef5b23", light: "#ffc247" },
    ash: { shade: "#4a4a52", base: "#6f6f7a", light: "#a3a3ad" },
    sky: { shade: "#4b4380", base: "#7a6fb0", light: "#a89fd6" },
    wood: { shade: "#5d3a17", base: "#8a5a2b", light: "#b0783f" },
    metal: { shade: "#8a9098", base: "#c9cdd2", light: "#eceff2" },
    gold: { shade: "#a8862a", base: "#e8c235", light: "#ffe285" }
  };
  var LINE = { silhouette: 0, feature: 1.2, accent: 2.2 };
  var Z = {
    decal: 1,
    // craters, graffiti, splats, fossil stickers
    shadow: 2,
    // ground contact shadows
    particleBack: 3,
    volcano: 4,
    friend: 5,
    dino: 6,
    card: 7,
    particleFront: 8,
    ptero: 9,
    meteor: 10,
    bubble: 11,
    flash: 12
  };
  var HOST_Z = 2147483646;

  // src/core/loop.js
  var STEP = 1 / 60;
  var MAX_STEPS = 5;
  var Loop = class {
    constructor({ update, render, onTierChange }) {
      this.update = update;
      this.render = render;
      this.onTierChange = onTierChange || (() => {
      });
      this.acc = 0;
      this.last = 0;
      this.raf = 0;
      this.running = false;
      this.tier = 2;
      this.cost = 0;
      this.samples = 0;
      this._tick = this._tick.bind(this);
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = 0;
      this.raf = requestAnimationFrame(this._tick);
    }
    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    _tick(now) {
      if (!this.running) return;
      this.raf = requestAnimationFrame(this._tick);
      if (document.hidden) {
        this.last = now;
        this.acc = 0;
        return;
      }
      const t0 = performance.now();
      if (!this.last) this.last = now;
      let frame = (now - this.last) / 1e3;
      this.last = now;
      if (frame > 0.25) frame = STEP;
      this.acc += frame;
      let steps = 0;
      while (this.acc >= STEP && steps < MAX_STEPS) {
        this.update(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;
      this.render(this.acc / STEP);
      const ms = performance.now() - t0;
      this.cost = this.cost * 0.94 + ms * 0.06;
      if (++this.samples > 90) {
        this.samples = 0;
        const want = this.cost > 5.5 ? 0 : this.cost > 2.6 ? 1 : 2;
        if (want < this.tier || want > this.tier && this.cost < 1.4) {
          this.tier = want;
          this.onTierChange(want);
        }
      }
    }
  };

  // src/core/util.js
  var rnd = (a, b) => a + Math.random() * (b - a);
  var pick = (arr) => arr[Math.random() * arr.length | 0];
  var clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  var sign = (v) => v < 0 ? -1 : v > 0 ? 1 : 0;
  var ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    outElastic: (t) => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * 2.094) + 1,
    outBounce: (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    }
  };
  var Spring = class {
    constructor(value = 0, stiffness = 120, damping = 18) {
      this.v = value;
      this.target = value;
      this.vel = 0;
      this.k = stiffness;
      this.d = damping;
    }
    set(v) {
      this.v = v;
      this.target = v;
      this.vel = 0;
    }
    step(dt) {
      const a = this.k * (this.target - this.v) - this.d * this.vel;
      this.vel += a * dt;
      this.v += this.vel * dt;
      return this.v;
    }
  };
  var ShuffleBag = class {
    constructor(items, seedState) {
      this.items = items.slice();
      this.order = [];
      this.i = 0;
      if (seedState && Array.isArray(seedState.order) && seedState.order.length === items.length) {
        this.order = seedState.order.slice();
        this.i = clamp(seedState.i | 0, 0, this.order.length);
      } else {
        this.reshuffle();
      }
    }
    reshuffle() {
      this.order = this.items.map((_, i) => i);
      for (let n = this.order.length - 1; n > 0; n--) {
        const j = Math.random() * (n + 1) | 0;
        [this.order[n], this.order[j]] = [this.order[j], this.order[n]];
      }
      this.i = 0;
    }
    next() {
      if (this.i >= this.order.length) this.reshuffle();
      return this.items[this.order[this.i++]];
    }
    state() {
      return { order: this.order.slice(), i: this.i };
    }
  };
  var Pool = class {
    constructor(factory, size) {
      this.free = [];
      this.factory = factory;
      for (let i = 0; i < size; i++) this.free.push(factory());
    }
    take() {
      return this.free.length ? this.free.pop() : this.factory();
    }
    give(o) {
      if (this.free.length < 4096) this.free.push(o);
    }
  };
  var EventGate = class {
    constructor(minGapMs) {
      this.gap = minGapMs;
      this.last = -Infinity;
    }
    ready(now) {
      return now - this.last >= this.gap;
    }
    fire(now) {
      this.last = now;
    }
  };

  // src/fx/particles.js
  var MAX = { 2: 420, 1: 180, 0: 0 };
  function blank() {
    return {
      on: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      size: 3,
      g: 900,
      drag: 0,
      color: "#fff",
      shape: "dot",
      rot: 0,
      vr: 0,
      fade: 1
    };
  }
  var Particles = class {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext("2d");
      this.pool = new Pool(blank, 260);
      this.live = [];
      this.tier = 2;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
    }
    resize(w, h) {
      this.c.width = Math.ceil(w * this.dpr);
      this.c.height = Math.ceil(h * this.dpr);
      this.c.style.width = w + "px";
      this.c.style.height = h + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    setTier(t) {
      this.tier = t;
      if (t === 0) this.clear();
    }
    clear() {
      for (const p of this.live) {
        p.on = false;
        this.pool.give(p);
      }
      this.live.length = 0;
    }
    spawn(cfg) {
      if (this.live.length >= MAX[this.tier]) return null;
      const p = this.pool.take();
      p.on = true;
      p.x = cfg.x;
      p.y = cfg.y;
      p.vx = cfg.vx || 0;
      p.vy = cfg.vy || 0;
      p.max = p.life = cfg.life || 0.8;
      p.size = cfg.size || 3;
      p.g = cfg.g == null ? 900 : cfg.g;
      p.drag = cfg.drag || 0;
      p.color = cfg.color || "#fff";
      p.shape = cfg.shape || "dot";
      p.rot = cfg.rot || 0;
      p.vr = cfg.vr || 0;
      p.fade = cfg.fade == null ? 1 : cfg.fade;
      this.live.push(p);
      return p;
    }
    step(dt) {
      for (let i = this.live.length - 1; i >= 0; i--) {
        const p = this.live[i];
        p.life -= dt;
        if (p.life <= 0) {
          p.on = false;
          this.live[i] = this.live[this.live.length - 1];
          this.live.pop();
          this.pool.give(p);
          continue;
        }
        p.vy += p.g * dt;
        if (p.drag) {
          const k = 1 - p.drag * dt;
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }
    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.c.width, this.c.height);
      if (this.tier === 0) return;
      for (const p of this.live) {
        const a = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = p.fade === 1 ? a : Math.min(1, a * p.fade + (1 - p.fade));
        ctx.fillStyle = p.color;
        if (p.shape === "dot") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, 6.2832);
          ctx.fill();
        } else if (p.shape === "square") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (0.5 + a * 0.5));
          ctx.restore();
        } else if (p.shape === "shard") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(-p.size, p.size * 0.6);
          ctx.lineTo(0, -p.size);
          ctx.lineTo(p.size, p.size * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (p.shape === "streak") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillRect(-p.size * 3, -p.size * 0.4, p.size * 4, p.size * 0.8);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
    /* ---------------------------------------------------------- emitters */
    dust(x, y, n, tint) {
      for (let i = 0; i < (n || 6); i++) this.spawn({
        x: x + rnd(-6, 6),
        y,
        vx: rnd(-70, 70),
        vy: rnd(-120, -30),
        life: rnd(0.35, 0.7),
        size: rnd(2, 4.6),
        g: 420,
        drag: 1.6,
        color: tint || "rgba(160,150,120,0.75)"
      });
    }
    shards(x, y, n, color) {
      for (let i = 0; i < (n || 12); i++) this.spawn({
        x,
        y,
        vx: rnd(-190, 190),
        vy: rnd(-320, -80),
        life: rnd(0.6, 1.2),
        size: rnd(2.4, 5),
        g: 1300,
        color: color || "#f2ecd8",
        shape: "shard",
        rot: rnd(0, 6.28),
        vr: rnd(-9, 9)
      });
    }
    embers(x, y, n) {
      for (let i = 0; i < (n || 10); i++) this.spawn({
        x: x + rnd(-10, 10),
        y,
        vx: rnd(-90, 90),
        vy: rnd(-360, -140),
        life: rnd(0.9, 1.9),
        size: rnd(1.6, 3.4),
        g: 260,
        drag: 0.5,
        color: Math.random() < 0.5 ? "#ef5b23" : "#ffc247"
      });
    }
    ash(x, y, n) {
      for (let i = 0; i < (n || 8); i++) this.spawn({
        x,
        y,
        vx: rnd(-40, 40),
        vy: rnd(10, 60),
        life: rnd(2.2, 4.4),
        size: rnd(1.4, 3.2),
        g: 12,
        drag: 0.4,
        color: "rgba(111,111,122,0.65)"
      });
    }
    confetti(x, y, n) {
      const cols = ["#ef5b23", "#4fbf62", "#e8c235", "#7a6fb0", "#ff9fae"];
      for (let i = 0; i < (n || 22); i++) this.spawn({
        x,
        y,
        vx: rnd(-220, 220),
        vy: rnd(-420, -160),
        life: rnd(1.1, 2),
        size: rnd(3, 6),
        g: 780,
        drag: 0.3,
        shape: "square",
        color: cols[Math.random() * cols.length | 0],
        rot: rnd(0, 6.28),
        vr: rnd(-12, 12)
      });
    }
    notes(x, y) {
      for (let i = 0; i < 3; i++) this.spawn({
        x: x + rnd(-8, 8),
        y,
        vx: rnd(-30, 30),
        vy: rnd(-90, -50),
        life: rnd(1, 1.6),
        size: rnd(3, 5),
        g: -30,
        drag: 0.8,
        color: "#2c7a38"
      });
    }
    sparkle(x, y, color) {
      for (let i = 0; i < 8; i++) this.spawn({
        x,
        y,
        vx: rnd(-140, 140),
        vy: rnd(-140, 140),
        life: rnd(0.3, 0.6),
        size: rnd(1.6, 3.2),
        g: 0,
        drag: 3,
        color: color || "#ffe285"
      });
    }
    trail(x, y, vx, vy, color) {
      this.spawn({
        x,
        y,
        vx: vx * 0.2 + rnd(-30, 30),
        vy: vy * 0.2 + rnd(-30, 30),
        life: rnd(0.25, 0.55),
        size: rnd(2, 5),
        g: 60,
        drag: 2,
        color,
        shape: "streak"
      });
    }
  };

  // src/audio/kit.js
  var AudioKit = class {
    constructor() {
      this.ac = null;
      this.master = null;
      this.noiseBuf = null;
      this.unlocked = false;
      this.volume = 0.55;
      this.enabled = true;
      this.duck = 1;
    }
    ensure() {
      if (this.ac) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = this.volume * 0.3;
      this.master.connect(this.ac.destination);
      const len = Math.floor(this.ac.sampleRate * 1.2);
      const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    unlock() {
      this.ensure();
      if (this.ac && this.ac.state === "suspended") this.ac.resume().catch(() => {
      });
      this.unlocked = true;
    }
    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      if (this.master) this.master.gain.value = this.volume * 0.3 * this.duck;
    }
    setDuck(d) {
      this.duck = d;
      if (this.master) this.master.gain.value = this.volume * 0.3 * this.duck;
    }
    suspend() {
      if (this.ac) this.ac.suspend().catch(() => {
      });
    }
    resume() {
      if (this.ac && this.unlocked && this.enabled) this.ac.resume().catch(() => {
      });
    }
    close() {
      if (this.ac) {
        this.ac.close().catch(() => {
        });
        this.ac = null;
        this.unlocked = false;
      }
    }
    get ok() {
      return this.enabled && this.ac && this.unlocked && !document.hidden;
    }
    _osc(type, f0, f1, dur2, vol, t0, dest) {
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, f0), t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur2);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(2e-4, vol), t0 + dur2 * 0.08);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur2);
      o.connect(g);
      g.connect(dest || this.master);
      o.start(t0);
      o.stop(t0 + dur2 + 0.03);
    }
    _noise(dur2, vol, t0, filterType, f0, f1, q) {
      const src = this.ac.createBufferSource();
      src.buffer = this.noiseBuf;
      const flt = this.ac.createBiquadFilter();
      flt.type = filterType || "bandpass";
      flt.frequency.setValueAtTime(f0, t0);
      flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1 || f0), t0 + dur2);
      flt.Q.value = q == null ? 1 : q;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur2);
      src.connect(flt);
      flt.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur2 + 0.03);
    }
    play(name, opt) {
      if (!this.ok) return;
      const t = this.ac.currentTime;
      const o = opt || {};
      switch (name) {
        case "step":
          this._noise(0.07, 0.16 * (o.heavy ? 1.7 : 1), t, "lowpass", 900, 260, 0.7);
          this._osc("sine", o.heavy ? 74 : 96, 42, 0.08, 0.16, t);
          break;
        case "roar": {
          const v = o.variant == null ? Math.random() * 3 | 0 : o.variant;
          const base = [150, 122, 178][v];
          this._osc("sawtooth", base, base * 0.36, 0.55, 0.3, t);
          this._osc("square", base * 0.62, base * 0.26, 0.62, 0.16, t + 0.02);
          this._noise(0.5, 0.14, t, "bandpass", 700, 240, 0.9);
          break;
        }
        case "squawk":
          this._osc("sawtooth", 900, 420, 0.13, 0.16, t);
          this._osc("square", 1400, 700, 0.09, 0.09, t + 0.05);
          break;
        case "chomp":
          this._noise(0.09, 0.24, t, "bandpass", 1800, 400, 1.4);
          this._osc("square", 320, 90, 0.11, 0.2, t);
          break;
        case "bonk":
          this._osc("triangle", 240, 780, 0.14, 0.26, t);
          this._noise(0.06, 0.12, t, "highpass", 1200, 1600, 0.5);
          break;
        case "bop":
          this._osc("square", 560, 200, 0.09, 0.22, t);
          break;
        case "crack":
          this._noise(0.05, 0.26, t, "bandpass", 2600, 1100, 2.2);
          this._noise(0.05, 0.2, t + 0.09, "bandpass", 2200, 900, 2.2);
          break;
        case "burst":
          this._noise(0.22, 0.3, t, "bandpass", 2400, 500, 1.1);
          this._osc("triangle", 700, 180, 0.2, 0.16, t);
          break;
        case "hatch":
          this._osc("sine", 620, 1250, 0.2, 0.24, t);
          this._osc("sine", 930, 1650, 0.16, 0.12, t + 0.1);
          break;
        case "chirp":
          this._osc("sine", 1500, 2100, 0.07, 0.16, t);
          this._osc("sine", 1900, 1400, 0.06, 0.1, t + 0.07);
          break;
        case "flap":
          this._noise(0.13, 0.1, t, "bandpass", 420, 180, 0.8);
          break;
        case "rumble": {
          const dur2 = o.dur || 1.8;
          this._osc("sine", 46, 34, dur2, 0.34, t);
          this._osc("sine", 69, 51, dur2, 0.14, t);
          this._noise(dur2, 0.1, t, "lowpass", 220, 90, 0.6);
          break;
        }
        case "erupt":
          this._noise(1.5, 0.34, t, "lowpass", 900, 150, 0.5);
          this._osc("sawtooth", 90, 32, 1.2, 0.22, t);
          break;
        case "whoosh":
          this._noise(0.9, 0.22, t, "bandpass", 300, 2600, 0.7);
          break;
        case "boom":
          this._osc("sine", 120, 26, 1.1, 0.42, t);
          this._noise(0.8, 0.3, t, "lowpass", 700, 80, 0.5);
          break;
        case "shockwave":
          this._noise(0.5, 0.18, t, "highpass", 200, 2400, 0.4);
          break;
        case "blip":
          this._osc("square", 880, 1320, 0.05, 0.12, t);
          break;
        case "sparkle":
          for (let i = 0; i < 4; i++) this._osc("sine", 1200 + i * 420, 2400 + i * 300, 0.09, 0.07, t + i * 0.05);
          break;
        case "splat":
          this._noise(0.16, 0.22, t, "lowpass", 1400, 240, 0.9);
          break;
        case "beat":
          this._osc("sine", 110, 52, 0.12, 0.24, t);
          this._noise(0.05, 0.1, t, "highpass", 4e3, 6e3, 0.4);
          break;
        case "scribble":
          this._noise(0.12, 0.09, t, "bandpass", 1800 + rnd(-400, 400), 1200, 3);
          break;
        case "shutter":
          this._noise(0.04, 0.2, t, "bandpass", 3e3, 1200, 3);
          this._noise(0.05, 0.16, t + 0.06, "bandpass", 2400, 900, 3);
          break;
      }
    }
  };

  // src/world/props.js
  var HEAD_SEL = "h1,h2,h3";
  var IMG_SEL = "img";
  var BAR_SEL = 'header,nav,[role="banner"],[role="navigation"]';
  var MIN_W = 90;
  var MIN_H = 18;
  function visible(r) {
    return r.width >= MIN_W && r.height >= MIN_H && r.top > 40 && r.bottom < window.innerHeight - 40 && r.left > -20 && r.right < window.innerWidth + 20;
  }
  var Props = class {
    constructor() {
      this.cache = { t: 0, perch: [], images: [], text: [] };
      this.ttl = 2500;
    }
    refresh(force) {
      const now = performance.now();
      if (!force && now - this.cache.t < this.ttl) return this.cache;
      const perch = [];
      const images = [];
      const text = [];
      try {
        const heads = document.querySelectorAll(HEAD_SEL);
        for (let i = 0; i < heads.length && perch.length < 12; i++) {
          const r = heads[i].getBoundingClientRect();
          if (visible(r)) {
            perch.push(rect(r));
            text.push(rect(r));
          }
        }
        const bars = document.querySelectorAll(BAR_SEL);
        for (let i = 0; i < bars.length && perch.length < 16; i++) {
          const r = bars[i].getBoundingClientRect();
          if (visible(r) && r.height < 200) perch.push(rect(r));
        }
        const imgs = document.querySelectorAll(IMG_SEL);
        for (let i = 0; i < imgs.length && images.length < 10; i++) {
          const el = imgs[i];
          const r = el.getBoundingClientRect();
          if (visible(r) && r.width < 520 && r.height < 520 && el.currentSrc) {
            images.push({ ...rect(r), src: el.currentSrc });
            if (perch.length < 20) perch.push(rect(r));
          }
        }
      } catch (_) {
      }
      this.cache = { t: now, perch, images, text };
      return this.cache;
    }
    pickPerch() {
      const c = this.refresh();
      return c.perch.length ? c.perch[Math.random() * c.perch.length | 0] : null;
    }
    pickImage() {
      const c = this.refresh();
      return c.images.length ? c.images[Math.random() * c.images.length | 0] : null;
    }
    pickText() {
      const c = this.refresh();
      return c.text.length ? c.text[Math.random() * c.text.length | 0] : null;
    }
    get any() {
      const c = this.refresh();
      return c.perch.length > 0;
    }
  };
  function rect(r) {
    return {
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2
    };
  }
  function cloneImage(prop, layer, z) {
    const el = document.createElement("div");
    el.className = "ad-stolen";
    el.style.zIndex = z;
    const img = document.createElement("img");
    img.src = prop.src;
    img.alt = "";
    img.style.width = Math.min(140, prop.w) + "px";
    img.style.height = "auto";
    img.draggable = false;
    el.appendChild(img);
    layer.appendChild(el);
    return el;
  }

  // src/art/species.js
  var hue = (shade, base, light, belly) => ({ shade, base, light, belly });
  var SPECIES = {
    rex: {
      id: "rex",
      name: "Chibi Rex",
      tone: hue("#379246", "#4fbf62", "#6fd882", "#e4f7de"),
      neckLen: 14,
      headScale: 1,
      legLen: 16,
      tailSegs: 3,
      tailLen: 13,
      stride: 26,
      speedMul: 1,
      mass: 1,
      hopHeight: 46,
      crest: "nubs",
      body: "M22 52 Q17 76 40 80 L70 80 Q92 76 92 52 Q92 26 68 21 Q40 16 27 31 Q19 39 22 52Z",
      belly: { cx: 58, cy: 58, rx: 20, ry: 15 },
      head: "M-6 -14 Q20 -18 24 2 Q26 16 6 18 Q-14 17 -16 1 Q-17 -9 -6 -14Z",
      snout: "M8 8 Q20 8 24 13 Q20 18 8 17Z",
      eyes: [{ x: 2, y: -3 }, { x: 15, y: -3 }],
      blush: [{ x: -6, y: 5 }, { x: 21, y: 5 }],
      lines: ["RAWR.", "Tiny arms, big dreams.", "This tab is MY territory."],
      idle: "breathe"
    },
    stego: {
      id: "stego",
      name: "Stego",
      tone: hue("#2f6f8a", "#4c9fbf", "#77c6dd", "#e2f4fa"),
      neckLen: 10,
      headScale: 0.82,
      legLen: 14,
      tailSegs: 4,
      tailLen: 15,
      stride: 22,
      speedMul: 0.82,
      mass: 1.35,
      hopHeight: 32,
      crest: "plates",
      body: "M20 54 Q14 78 40 82 L74 82 Q96 77 94 54 Q92 32 66 26 Q38 21 26 34 Q17 42 20 54Z",
      belly: { cx: 58, cy: 62, rx: 22, ry: 15 },
      head: "M-4 -10 Q16 -13 19 2 Q20 13 4 14 Q-11 13 -13 1 Q-14 -6 -4 -10Z",
      snout: "M5 6 Q16 6 19 10 Q16 14 5 13Z",
      eyes: [{ x: 1, y: -2 }, { x: 12, y: -2 }],
      blush: [{ x: -5, y: 5 }, { x: 17, y: 5 }],
      lines: ["Plates are load-bearing.", "Slow is a lifestyle.", "Do not touch the plates."],
      idle: "plateRipple"
    },
    tricera: {
      id: "tricera",
      name: "Tricera",
      tone: hue("#8a5a2b", "#c08a4a", "#e0b478", "#f7ecd8"),
      neckLen: 11,
      headScale: 1.12,
      legLen: 15,
      tailSegs: 2,
      tailLen: 10,
      stride: 24,
      speedMul: 1.1,
      mass: 1.5,
      hopHeight: 30,
      crest: "frill",
      body: "M22 54 Q16 78 40 82 L72 82 Q94 77 93 54 Q92 30 68 25 Q40 20 28 33 Q19 41 22 54Z",
      belly: { cx: 58, cy: 60, rx: 21, ry: 15 },
      head: "M-6 -12 Q18 -16 22 2 Q24 15 4 17 Q-14 16 -16 1 Q-17 -8 -6 -12Z",
      snout: "M6 7 Q20 6 24 12 Q20 17 6 16Z",
      eyes: [{ x: 1, y: -2 }, { x: 14, y: -2 }],
      blush: [{ x: -6, y: 6 }, { x: 20, y: 6 }],
      lines: ["Three horns. Zero patience.", "CHARGE.", "I brake for nothing."],
      idle: "headDown"
    },
    brachio: {
      id: "brachio",
      name: "Brachio",
      tone: hue("#6b4d8a", "#9a78bf", "#c1a6dd", "#f0e8f8"),
      neckLen: 46,
      headScale: 0.62,
      legLen: 20,
      tailSegs: 3,
      tailLen: 14,
      stride: 30,
      speedMul: 0.7,
      mass: 1.8,
      hopHeight: 22,
      crest: "none",
      body: "M20 50 Q14 78 40 82 L74 82 Q98 76 96 50 Q94 26 68 20 Q38 15 26 30 Q17 38 20 50Z",
      belly: { cx: 58, cy: 58, rx: 22, ry: 16 },
      head: "M-3 -8 Q12 -10 14 1 Q15 9 3 10 Q-9 9 -10 0 Q-11 -5 -3 -8Z",
      snout: "M4 4 Q12 4 14 7 Q12 10 4 10Z",
      eyes: [{ x: 0, y: -2 }, { x: 9, y: -2 }],
      blush: [{ x: -4, y: 4 }, { x: 13, y: 4 }],
      lines: ["The view is fine up here.", "I browse the top of the page.", "Long neck, long thoughts."],
      idle: "neckSway"
    },
    raptor: {
      id: "raptor",
      name: "Raptor",
      tone: hue("#a5442b", "#d97a45", "#f0a674", "#fbeadd"),
      neckLen: 16,
      headScale: 0.88,
      legLen: 19,
      tailSegs: 4,
      tailLen: 18,
      stride: 32,
      speedMul: 1.45,
      mass: 0.75,
      hopHeight: 58,
      crest: "quills",
      body: "M24 54 Q20 76 40 79 L68 79 Q88 75 88 54 Q88 32 66 27 Q40 22 29 34 Q22 42 24 54Z",
      belly: { cx: 56, cy: 58, rx: 18, ry: 13 },
      head: "M-8 -12 Q16 -15 21 1 Q23 13 4 15 Q-15 14 -17 0 Q-18 -8 -8 -12Z",
      snout: "M6 6 Q22 5 27 11 Q22 16 6 15Z",
      eyes: [{ x: 1, y: -3 }, { x: 13, y: -3 }],
      blush: [{ x: -6, y: 5 }, { x: 19, y: 5 }],
      lines: ["Clever girl.", "I opened the door. I can do that now.", "Long distance is safer."],
      idle: "twitch"
    }
  };
  var SPECIES_IDS = Object.keys(SPECIES);
  var speciesOf = (id) => SPECIES[id] || SPECIES.rex;
  var HATCH_WEIGHTS = { rex: 40, raptor: 24, stego: 18, tricera: 12, brachio: 6 };
  function rollSpecies(exclude) {
    const ids = SPECIES_IDS.filter((i) => i !== exclude);
    const total = ids.reduce((s, i) => s + HATCH_WEIGHTS[i], 0);
    let r = Math.random() * total;
    for (const id of ids) {
      r -= HATCH_WEIGHTS[id];
      if (r <= 0) return id;
    }
    return "rex";
  }
  var FOSSIL_TONE = TONE.bone;

  // src/art/rig.js
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, kids) {
    const e = document.createElementNS(NS, tag);
    if (attrs) {
      for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (kids) {
      for (const c of kids) if (c) e.appendChild(c);
    }
    return e;
  }
  function posed(cls, x, y, extra) {
    const inner = svgEl("g", {
      class: cls,
      style: "transform-box:view-box;transform-origin:0 0"
    });
    const wrap = svgEl("g", { class: cls + "-anchor", transform: `translate(${x},${y})` + (extra || "") }, [inner]);
    return { wrap, inner };
  }
  function pivot(el, x, y) {
    el.style.transformBox = "view-box";
    el.style.transformOrigin = `${x}px ${y}px`;
    return el;
  }
  var ANCHOR = {
    pelvis: { x: 52, y: 74 },
    shoulder: { x: 76, y: 32 },
    hipFar: { x: 42, y: 70 },
    hipNear: { x: 62, y: 70 },
    armFar: { x: 46, y: 44 },
    armNear: { x: 66, y: 50 },
    // forward, so a held tool reads at the body's front edge
    tail: { x: 24, y: 56 }
  };
  function crest(kind, tone) {
    switch (kind) {
      case "nubs":
        return [svgEl("path", {
          class: "ad-crest",
          d: "M36 22 Q38 13 44 17 Q41 22 38 24Z M47 16 Q49 7 56 12 Q52 18 49 20Z M59 14 Q62 6 68 12 Q64 18 61 19Z",
          fill: tone.shade
        })];
      case "plates": {
        const g = svgEl("g", { class: "ad-crest ad-plates" });
        const pts = [[34, 30], [44, 22], [55, 18], [66, 20], [76, 26]];
        pts.forEach(([x, y], i) => g.appendChild(svgEl("path", {
          class: "ad-plate",
          "data-i": i,
          d: `M${x} ${y + 10} Q${x - 7} ${y - 6} ${x} ${y - 10} Q${x + 7} ${y - 6} ${x} ${y + 10}Z`,
          fill: i % 2 ? tone.shade : tone.light,
          style: "transform-box:fill-box;transform-origin:50% 100%"
        })));
        return [g];
      }
      case "quills": {
        const g = svgEl("g", { class: "ad-crest" });
        for (let i = 0; i < 6; i++) {
          const x = 34 + i * 7, y = 35 - i * 2.2;
          g.appendChild(svgEl("path", {
            class: "ad-quill",
            "data-i": i,
            d: `M${x} ${y} L${x - 4} ${y - 11} L${x + 2} ${y - 3}Z`,
            fill: tone.shade,
            opacity: 0.9,
            style: "transform-box:fill-box;transform-origin:50% 100%"
          }));
        }
        return [g];
      }
      default:
        return [];
    }
  }
  function frill(tone) {
    return svgEl("g", { class: "ad-frill" }, [
      svgEl("path", {
        d: "M-15 -8 Q-24 -19 -13 -24 Q0 -28 13 -24 Q23 -19 15 -7 Q0 -2 -15 -8Z",
        fill: tone.shade
      }),
      svgEl("path", {
        d: "M-12 -9 Q-19 -18 -10 -21 Q0 -24 10 -21 Q19 -18 12 -8 Q0 -4 -12 -9Z",
        fill: tone.light,
        opacity: 0.55
      }),
      svgEl("path", {
        d: "M-17 -14 L-22 -21 M0 -25 L0 -31 M17 -14 L22 -21",
        stroke: tone.shade,
        "stroke-width": LINE.accent,
        "stroke-linecap": "round",
        fill: "none"
      })
    ]);
  }
  function legParts(tone, len) {
    return [
      svgEl("path", { class: "ad-thigh", d: `M-6 0 Q-8 ${len * 0.6} -3 ${len} L6 ${len} Q9 ${len * 0.6} 6 0Z`, fill: tone.shade }),
      svgEl("ellipse", { class: "ad-foot", cx: 2, cy: len + 2, rx: 9, ry: 5, fill: tone.shade }),
      svgEl("ellipse", { cx: 4, cy: len + 1, rx: 6, ry: 3, fill: tone.base, opacity: 0.5 })
    ];
  }
  function armParts(tone) {
    const hold = svgEl("g", { class: "ad-hold" });
    const wrap = svgEl("g", { transform: "translate(3,15)" }, [hold]);
    return { parts: [
      svgEl("path", { d: "M0 0 Q-5 8 -2 15 Q3 18 7 14 Q8 6 5 0Z", fill: tone.shade }),
      svgEl("circle", { cx: 3, cy: 15, r: 4, fill: tone.shade }),
      wrap
    ], hold };
  }
  function tailChain(tone, segs, len) {
    let child = null;
    const list = [];
    for (let i = segs - 1; i >= 0; i--) {
      const t = i / segs;
      const w = 8.5 * (1 - t * 0.74);
      const inner = svgEl("g", {
        class: `ad-tailseg ad-tail${i}`,
        style: "transform-box:view-box;transform-origin:0 0"
      }, [
        svgEl("path", {
          d: `M0 ${-w} Q${-len * 0.6} ${-w * 0.85} ${-len} ${-w * 0.55} L${-len} ${w * 0.55} Q${-len * 0.6} ${w * 0.85} 0 ${w}Z`,
          fill: i === 0 ? tone.shade : tone.base
        })
      ]);
      if (child) inner.appendChild(svgEl("g", { transform: `translate(${-len},0)` }, [child]));
      list.unshift(inner);
      child = inner;
    }
    return { root: child, segs: list };
  }
  function head(sp, tone) {
    const eyes = svgEl("g", { class: "ad-eyes" });
    sp.eyes.forEach((e, i) => {
      eyes.appendChild(svgEl("g", { class: "ad-eyeball", "data-i": i }, [
        svgEl("ellipse", { cx: e.x, cy: e.y, rx: 5.4, ry: 5.6, fill: "#fffdf8" }),
        svgEl("circle", { class: "ad-pupil", cx: e.x, cy: e.y, r: 3.5, fill: "#1c1c1c" }),
        svgEl("circle", { class: "ad-glint", cx: e.x + 1.4, cy: e.y - 1.6, r: 1.4, fill: "#fff" })
      ]));
    });
    const kids = [];
    if (sp.crest === "frill") kids.push(frill(tone));
    kids.push(
      svgEl("path", { class: "ad-skull", d: sp.head, fill: tone.base }),
      svgEl("path", { class: "ad-snout", d: sp.snout, fill: tone.shade }),
      svgEl("path", { class: "ad-mouth-open", d: sp.snout, fill: "#7a3226", style: "display:none" }),
      eyes,
      svgEl("g", { class: "ad-brows", style: "display:none" }, [
        svgEl("path", {
          d: `M${sp.eyes[0].x - 5} ${sp.eyes[0].y - 7} L${sp.eyes[0].x + 4} ${sp.eyes[0].y - 5}`,
          stroke: "#1c1c1c",
          "stroke-width": LINE.accent,
          "stroke-linecap": "round"
        }),
        svgEl("path", {
          d: `M${sp.eyes[1].x + 5} ${sp.eyes[1].y - 7} L${sp.eyes[1].x - 4} ${sp.eyes[1].y - 5}`,
          stroke: "#1c1c1c",
          "stroke-width": LINE.accent,
          "stroke-linecap": "round"
        })
      ])
    );
    sp.blush.forEach((b) => kids.push(
      svgEl("ellipse", { cx: b.x, cy: b.y, rx: 4, ry: 2.6, fill: "#ff9fae", opacity: 0.7 })
    ));
    if (sp.crest === "frill") {
      kids.push(svgEl("g", { class: "ad-horns" }, [
        svgEl("path", {
          d: "M1 -8 Q0 -14 -2 -17",
          stroke: "#f5f1e4",
          "stroke-width": 3.2,
          "stroke-linecap": "round",
          fill: "none"
        }),
        svgEl("path", {
          d: "M14 -8 Q15 -14 17 -17",
          stroke: "#f5f1e4",
          "stroke-width": 3.2,
          "stroke-linecap": "round",
          fill: "none"
        }),
        svgEl("path", {
          d: "M17 7 Q23 6 27 2",
          stroke: "#f5f1e4",
          "stroke-width": 3,
          "stroke-linecap": "round",
          fill: "none"
        })
      ]));
    }
    kids.push(
      svgEl("g", { class: "ad-face-slot", transform: `translate(${(sp.eyes[0].x + sp.eyes[1].x) / 2},${sp.eyes[0].y + 1})` }),
      svgEl("g", { class: "ad-hat-slot", transform: `translate(${(sp.eyes[0].x + sp.eyes[1].x) / 2},${sp.eyes[0].y - 12})` })
    );
    return svgEl("g", { class: "ad-head", style: "transform-box:view-box;transform-origin:0 0" }, kids);
  }
  var RIG_SEQ = 0;
  function buildRig(speciesId, scale, opts) {
    const uid = "ad" + ++RIG_SEQ;
    const sp = speciesOf(speciesId);
    const tone = sp.tone;
    const o = opts || {};
    const W = 120, H = 100;
    const svg = svgEl("svg", {
      class: "ad-svg",
      viewBox: `0 0 ${W} ${H}`,
      width: W * scale,
      height: H * scale,
      xmlns: NS,
      "aria-hidden": "true"
    });
    const defs = svgEl("defs", null, [
      (() => {
        const g = svgEl("radialGradient", { id: `${uid}Shade`, cx: "32%", cy: "24%", r: "82%" });
        g.appendChild(svgEl("stop", { offset: "0%", "stop-color": tone.light, "stop-opacity": "0.95" }));
        g.appendChild(svgEl("stop", { offset: "58%", "stop-color": tone.base, "stop-opacity": "0" }));
        return g;
      })(),
      (() => {
        const g = svgEl("linearGradient", { id: `${uid}Rim`, x1: "0", y1: "0", x2: "1", y2: "1" });
        g.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": "0.0" }));
        g.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#ffffff", "stop-opacity": "0.22" }));
        return g;
      })()
    ]);
    svg.appendChild(defs);
    const backSlot = svgEl("g", { class: "ad-back-slot" });
    const tail = tailChain(tone, sp.tailSegs, sp.tailLen);
    const tailWrap = svgEl("g", { transform: `translate(${ANCHOR.tail.x},${ANCHOR.tail.y})` }, [tail.root]);
    const legFar = posed("ad-legFar", ANCHOR.hipFar.x, ANCHOR.hipFar.y);
    legParts({ shade: tone.shade, base: tone.base }, sp.legLen).forEach((n) => legFar.inner.appendChild(n));
    const legNear = posed("ad-legNear", ANCHOR.hipNear.x, ANCHOR.hipNear.y);
    legParts({ shade: tone.base, base: tone.light }, sp.legLen).forEach((n) => legNear.inner.appendChild(n));
    const aFar = armParts({ shade: tone.shade });
    const armFar = posed("ad-armFar", ANCHOR.armFar.x, ANCHOR.armFar.y);
    aFar.parts.forEach((n) => armFar.inner.appendChild(n));
    const aNear = armParts({ shade: tone.base });
    const armNear = posed("ad-armNear", ANCHOR.armNear.x, ANCHOR.armNear.y);
    aNear.parts.forEach((n) => armNear.inner.appendChild(n));
    const bodyG = pivot(svgEl("g", { class: "ad-body" }, [
      svgEl("path", { class: "ad-torso", d: sp.body, fill: tone.base }),
      svgEl("path", { class: "ad-torso-shade", d: sp.body, fill: `url(#${uid}Shade)` }),
      svgEl("ellipse", { class: "ad-belly", cx: sp.belly.cx, cy: sp.belly.cy, rx: sp.belly.rx, ry: sp.belly.ry, fill: tone.belly }),
      ...crest(sp.crest, tone)
    ]), ANCHOR.pelvis.x, ANCHOR.pelvis.y);
    const headG = head(sp, tone);
    const headWrap = svgEl("g", {
      transform: `translate(${sp.neckLen * 0.34},${-sp.neckLen}) scale(${o.baby ? sp.headScale * 1.22 : sp.headScale})`
    }, [headG]);
    const neck = posed("ad-neck", ANCHOR.shoulder.x, ANCHOR.shoulder.y);
    neck.inner.appendChild(svgEl("path", {
      class: "ad-neck-path",
      d: `M-9 6 Q-7 ${-sp.neckLen * 0.55} ${sp.neckLen * 0.34 - 6.5} ${-sp.neckLen} L${sp.neckLen * 0.34 + 6.5} ${-sp.neckLen} Q9 ${-sp.neckLen * 0.55} 10 6Z`,
      fill: tone.base
    }));
    neck.inner.appendChild(headWrap);
    const spineG = pivot(svgEl(
      "g",
      { class: "ad-spine" },
      [bodyG, armFar.wrap, neck.wrap]
    ), ANCHOR.pelvis.x, ANCHOR.pelvis.y);
    svg.appendChild(backSlot);
    svg.appendChild(tailWrap);
    svg.appendChild(legFar.wrap);
    svg.appendChild(legNear.wrap);
    svg.appendChild(spineG);
    svg.appendChild(armNear.wrap);
    const q = (sel) => svg.querySelector(sel);
    const rig = {
      species: sp,
      scale,
      svg,
      W,
      H,
      nodes: {
        spine: spineG,
        body: bodyG,
        neck: neck.inner,
        head: headG,
        tailSegs: tail.segs,
        legFar: legFar.inner,
        legNear: legNear.inner,
        armFar: armFar.inner,
        armNear: armNear.inner,
        hold: aNear.hold,
        holdFar: aFar.hold,
        hatSlot: q(".ad-hat-slot"),
        faceSlot: q(".ad-face-slot"),
        backSlot,
        eyes: q(".ad-eyes"),
        pupils: Array.from(svg.querySelectorAll(".ad-pupil")),
        brows: q(".ad-brows"),
        mouthOpen: q(".ad-mouth-open"),
        snout: q(".ad-snout"),
        plates: Array.from(svg.querySelectorAll(".ad-plate")),
        quills: Array.from(svg.querySelectorAll(".ad-quill"))
      }
    };
    return rig;
  }
  var T = (n, s) => {
    if (n) n.style.transform = s;
  };
  function poseRig(rig, p) {
    const n = rig.nodes;
    T(n.body, `translate(0px,${p.bob}px) scale(${p.squashX},${p.squashY})`);
    T(n.spine, `rotate(${p.lean}deg)`);
    T(n.neck, `rotate(${p.neck}deg)`);
    T(n.head, `rotate(${p.headTilt}deg) translate(0px,${p.headBob}px)`);
    T(n.legFar, `rotate(${p.legFar}deg)`);
    T(n.legNear, `rotate(${p.legNear}deg)`);
    T(n.armFar, `rotate(${p.armFar}deg)`);
    T(n.armNear, `rotate(${p.armNear}deg)`);
    for (let i = 0; i < n.tailSegs.length; i++) {
      T(n.tailSegs[i], `rotate(${p.tail[i] || 0}deg)`);
    }
    if (n.eyes) n.eyes.style.transform = `scaleY(${p.blink})`;
    for (const pupil of n.pupils) {
      pupil.style.transform = `translate(${p.gazeX}px,${p.gazeY}px)`;
    }
    if (rig.species.crest === "plates") {
      for (let i = 0; i < n.plates.length; i++) {
        T(n.plates[i], `rotate(${Math.sin(p.phase * 2 - i * 0.7) * p.crestAmp}deg)`);
      }
    } else if (rig.species.crest === "quills") {
      for (let i = 0; i < n.quills.length; i++) {
        T(n.quills[i], `rotate(${Math.sin(p.phase * 3 - i * 0.5) * p.crestAmp * 1.6}deg)`);
      }
    }
  }
  function neutralPose() {
    return {
      bob: 0,
      squashX: 1,
      squashY: 1,
      lean: 0,
      neck: 0,
      headTilt: 0,
      headBob: 0,
      legFar: 0,
      legNear: 0,
      armFar: 0,
      armNear: 0,
      tail: [0, 0, 0, 0],
      blink: 1,
      gazeX: 0,
      gazeY: 0,
      phase: 0,
      crestAmp: 0
    };
  }

  // src/art/outfits.js
  var HEAD_ITEMS = {
    none: "",
    party: '<path d="M0 -6 L-9 12 L9 12Z" fill="#e0932f"/><circle cx="0" cy="-7" r="3.4" fill="#c94f3d"/><path d="M-6 5 L6 5" stroke="#fff" stroke-width="1.6"/><path d="M-4 -1 L4 -1" stroke="#fff" stroke-width="1.6"/>',
    top: '<rect x="-8" y="-18" width="16" height="15" rx="1.4" fill="#222"/><rect x="-13" y="-5" width="26" height="4" rx="2" fill="#222"/><rect x="-8" y="-8" width="16" height="3.2" fill="#c94f3d"/>',
    cowboy: '<path d="M-15 -2 Q0 -13 15 -2 Q15 3 0 3 Q-15 3 -15 -2Z" fill="#8a5a2b"/><rect x="-7" y="-12" width="14" height="11" rx="5" fill="#8a5a2b"/><path d="M-7 -5 L7 -5" stroke="#5d3a17" stroke-width="2.2"/>',
    crown: '<path d="M-9 2 L-9 -9 L-4 -3 L0 -12 L4 -3 L9 -9 L9 2Z" fill="#e8c235"/><circle cx="0" cy="-13" r="2" fill="#c94f3d"/><circle cx="-5" cy="-1" r="1.4" fill="#a8862a"/><circle cx="5" cy="-1" r="1.4" fill="#a8862a"/>',
    horns: '<path d="M-8 0 Q-13 -11 -6 -13 Q-6 -5 -4 -1Z" fill="#f0ece0"/><path d="M8 0 Q13 -11 6 -13 Q6 -5 4 -1Z" fill="#f0ece0"/>',
    viking: '<path d="M-10 0 Q0 -14 10 0 Z" fill="#8a9098"/><rect x="-11" y="-1" width="22" height="4" rx="2" fill="#6b7178"/><path d="M-10 -2 Q-19 -12 -13 -17 Q-9 -10 -8 -3Z" fill="#f0ece0"/><path d="M10 -2 Q19 -12 13 -17 Q9 -10 8 -3Z" fill="#f0ece0"/>',
    chef: '<rect x="-8" y="-6" width="16" height="7" rx="1.5" fill="#f7f5ee"/><path d="M-9 -6 Q-13 -16 -4 -15 Q0 -21 4 -15 Q13 -16 9 -6Z" fill="#fffdf8"/>',
    wizard: '<path d="M0 -22 L-11 4 L11 4Z" fill="#4b4380"/><path d="M-11 4 Q0 8 11 4 Q0 0 -11 4Z" fill="#3a3466"/><circle cx="-3" cy="-6" r="1.4" fill="#ffe285"/><circle cx="3" cy="-1" r="1.1" fill="#ffe285"/><circle cx="1" cy="-12" r="1.1" fill="#ffe285"/>',
    propeller: '<path d="M-9 1 Q0 -10 9 1Z" fill="#c94f3d"/><rect x="-9" y="0" width="18" height="3" rx="1.5" fill="#4fbf62"/><rect x="-1" y="-14" width="2" height="5" fill="#8a9098"/><g class="ad-prop"><rect x="-9" y="-15.6" width="18" height="2.2" rx="1.1" fill="#7a6fb0"/></g>',
    eggshell: '<path d="M-10 2 Q-11 -12 0 -14 Q11 -12 10 2 L6 -1 L3 3 L0 -1 L-3 3 L-6 -1Z" fill="#f2ecd8" stroke="#cfc5a5" stroke-width="1.2"/>',
    bandana: '<path d="M-11 -3 Q0 -10 11 -3 Q0 0 -11 -3Z" fill="#c94f3d"/><path d="M9 -3 L16 2 L10 2Z" fill="#c94f3d"/>'
  };
  var FACE_ITEMS = {
    none: "",
    shades: '<rect x="-9" y="-5" width="8" height="6" rx="1.6" fill="#1c1c1c"/><rect x="1" y="-5" width="8" height="6" rx="1.6" fill="#1c1c1c"/><path d="M-1 -3 L1 -3" stroke="#1c1c1c" stroke-width="1.6"/><path d="M-9 -3 L-13 -4" stroke="#1c1c1c" stroke-width="1.4"/>',
    monocle: '<circle cx="6" cy="-3" r="5.4" fill="none" stroke="#e8c235" stroke-width="1.6"/><path d="M6 2.4 Q7 8 12 9" stroke="#e8c235" stroke-width="1.2" fill="none"/>',
    eyepatch: '<path d="M-11 -6 L11 -8" stroke="#1c1c1c" stroke-width="1.6"/><rect x="-9" y="-7" width="8" height="7" rx="1.4" fill="#1c1c1c"/>',
    googly: '<circle cx="-5" cy="-4" r="5" fill="#fff" stroke="#ccc"/><circle class="ad-googly" cx="-5" cy="-3" r="2.2" fill="#111"/><circle cx="6" cy="-4" r="5" fill="#fff" stroke="#ccc"/><circle class="ad-googly" cx="6" cy="-3" r="2.2" fill="#111"/>',
    snorkel: '<circle cx="0" cy="-3" r="8" fill="none" stroke="#4c9fbf" stroke-width="2"/><path d="M8 -6 L12 -14 L15 -14" stroke="#4c9fbf" stroke-width="2.2" fill="none"/>'
  };
  var BACK_ITEMS = {
    none: "",
    cape: '<path class="ad-cape" d="M62 22 Q30 34 16 86 Q48 94 80 84 Q72 46 74 22Z" fill="#c94f3d" opacity="0.95" style="transform-box:fill-box;transform-origin:80% 0%"/>',
    jetpack: '<rect x="22" y="34" width="16" height="26" rx="7" fill="#8a9098"/><rect x="26" y="30" width="8" height="6" rx="3" fill="#c94f3d"/><path class="ad-jet" d="M26 60 Q30 74 34 60Z" fill="#ffc247" opacity="0"/>',
    backpack: '<rect x="20" y="36" width="20" height="24" rx="5" fill="#8a5a2b"/><rect x="24" y="42" width="12" height="8" rx="2" fill="#b0783f"/>',
    wings: '<path class="ad-wing" d="M48 28 Q16 16 6 40 Q26 46 46 40Z" fill="#f7f5ee" opacity="0.92" style="transform-box:fill-box;transform-origin:100% 50%"/><path d="M50 34 Q22 26 12 46 Q30 50 48 44Z" fill="#e6e2d4" opacity="0.9"/>',
    surfboard: '<rect x="6" y="30" width="10" height="52" rx="5" fill="#4c9fbf" transform="rotate(-16 11 56)"/><rect x="9" y="40" width="4" height="32" rx="2" fill="#fffdf8" transform="rotate(-16 11 56)"/>',
    shell: '<ellipse cx="34" cy="48" rx="20" ry="17" fill="#8a5a2b"/><ellipse cx="34" cy="48" rx="13" ry="11" fill="#b0783f"/>'
  };
  var HELD_ITEMS = {
    none: { svg: "", label: "" },
    knife: { svg: '<rect x="0" y="-2" width="17" height="4.6" rx="2.3" fill="#c9cdd2"/><rect x="15" y="-1" width="7" height="2.4" rx="1.2" fill="#8a5a2b"/>', label: "butter knife" },
    crayon: { svg: '<rect x="0" y="-2.4" width="16" height="5" rx="1.4" fill="#c94f3d"/><path d="M16 -2.4 L21 0 L16 2.6Z" fill="#8a2f22"/>', label: "crayon" },
    rod: { svg: '<rect x="0" y="-1.4" width="30" height="2.8" rx="1.4" fill="#8a5a2b"/><path d="M30 0 Q34 14 28 22" stroke="#cfc5a5" stroke-width="1" fill="none"/>', label: "fishing rod" },
    glass: { svg: '<rect x="0" y="-1.6" width="12" height="3.2" rx="1.6" fill="#8a5a2b"/><circle cx="20" cy="0" r="8" fill="rgba(180,220,255,0.35)" stroke="#8a9098" stroke-width="2"/>', label: "magnifying glass" },
    hammer: { svg: '<rect x="0" y="-1.6" width="15" height="3.2" rx="1.6" fill="#8a5a2b"/><rect x="13" y="-6" width="8" height="12" rx="2" fill="#8a9098"/>', label: "tiny hammer" },
    broom: { svg: '<rect x="0" y="-1.4" width="24" height="2.8" rx="1.4" fill="#8a5a2b"/><path d="M24 -6 L32 -8 L32 8 L24 6Z" fill="#e0932f"/>', label: "broom" },
    umbrella: { svg: '<rect x="0" y="-1.4" width="4" height="24" rx="1.4" fill="#8a5a2b"/><path d="M-16 -2 Q2 -22 20 -2 Q2 -8 -16 -2Z" fill="#c94f3d"/>', label: "umbrella" },
    extinguisher: { svg: '<rect x="0" y="-7" width="11" height="18" rx="4" fill="#c94f3d"/><rect x="9" y="-9" width="9" height="4" rx="2" fill="#8a9098"/>', label: "fire extinguisher" },
    boombox: { svg: '<rect x="-4" y="-9" width="26" height="18" rx="3" fill="#3a3a3a"/><circle cx="3" cy="0" r="5" fill="#8a9098"/><circle cx="15" cy="0" r="5" fill="#8a9098"/><rect x="-2" y="-7" width="22" height="2" rx="1" fill="#c94f3d"/>', label: "boombox" },
    sign: { svg: '<rect x="0" y="-2" width="4" height="20" fill="#8a5a2b"/><rect x="-12" y="-20" width="28" height="18" rx="2" fill="#fffef2" stroke="#8a5a2b" stroke-width="2"/>', label: "sign" },
    camera: { svg: '<rect x="-2" y="-7" width="22" height="15" rx="3" fill="#3a3a3a"/><circle cx="9" cy="0" r="5" fill="#4b4380"/><rect x="12" y="-10" width="7" height="4" rx="1.5" fill="#c9cdd2"/>', label: "camera" }
  };
  var CATALOG = {
    head: Object.keys(HEAD_ITEMS),
    face: Object.keys(FACE_ITEMS),
    back: Object.keys(BACK_ITEMS),
    held: Object.keys(HELD_ITEMS)
  };
  var STARTER = {
    head: ["none", "party", "top", "cowboy", "crown", "horns"],
    face: ["none", "shades"],
    back: ["none", "cape"],
    held: ["none"]
  };
  var UNLOCK_HINTS = {
    viking: "hatch a speckled egg",
    chef: "watch the dino snack 10 times",
    wizard: "hatch a golden egg",
    propeller: "survive a meteor",
    eggshell: "hatch 5 eggs",
    bandana: "let a pterodactyl steal your hat",
    monocle: "read 20 joke cards",
    eyepatch: "bonk the dino 25 times",
    googly: "hatch a fossil egg",
    snorkel: "go fishing",
    jetpack: "survive an eruption",
    backpack: "deliver 10 cards",
    wings: "hatch a volcanic egg",
    surfboard: "scroll-surf 1000px",
    shell: "let the dino nap 10 times"
  };
  function applyOutfit(rig, outfit) {
    const n = rig.nodes;
    if (n.hatSlot) n.hatSlot.innerHTML = HEAD_ITEMS[outfit.head] || "";
    if (n.faceSlot) n.faceSlot.innerHTML = FACE_ITEMS[outfit.face] || "";
    if (n.backSlot) n.backSlot.innerHTML = BACK_ITEMS[outfit.back] || "";
    const held = HELD_ITEMS[outfit.held] || HELD_ITEMS.none;
    if (n.hold) n.hold.innerHTML = held.svg;
    return !!held.svg;
  }

  // src/core/physics.js
  var GRAVITY = 2400;
  var GROUND_EPS = 0.5;
  var Body = class {
    constructor(sp) {
      this.sp = sp;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.ax = 0;
      this.groundY = 0;
      this.grounded = true;
      this.facing = 1;
      this.faceScale = 1;
      this.maxSpeed = 190 * sp.speedMul;
      this.accel = 900 * sp.speedMul;
      this.friction = 1400;
      this.gaitPhase = 0;
      this.gaitTotal = 0;
      this.distance = 0;
      this.landImpact = 0;
      this.prevVx = 0;
    }
    get speed() {
      return Math.abs(this.vx);
    }
    get speed01() {
      return clamp(this.speed / this.maxSpeed, 0, 1);
    }
    driveToward(tx, dt, speedScale) {
      const dx = tx - this.x;
      const stop = 26;
      if (Math.abs(dx) < 3) {
        this.ax = 0;
        this.vx *= 0.7;
        return true;
      }
      const t = clamp(Math.abs(dx) / stop, 0, 1);
      const want = sign(dx) * this.maxSpeed * (speedScale == null ? 1 : speedScale) * ease.outQuad(t);
      this.ax = clamp((want - this.vx) * 8, -this.accel * 2.2, this.accel * 2.2);
      if (Math.abs(dx) > 6) this.facing = sign(dx);
      return false;
    }
    halt(dt) {
      this.ax = 0;
      this.vx = approachZero(this.vx, this.friction * dt);
    }
    jump(power) {
      if (!this.grounded) return false;
      this.vy = -Math.sqrt(2 * GRAVITY * (power || this.sp.hopHeight));
      this.grounded = false;
      return true;
    }
    step(dt) {
      this.prevVx = this.vx;
      this.vx = clamp(this.vx + this.ax * dt, -this.maxSpeed * 2, this.maxSpeed * 2);
      if (this.ax === 0) this.vx = approachZero(this.vx, this.friction * dt);
      this.x += this.vx * dt;
      if (!this.grounded) {
        this.vy += GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y >= this.groundY - GROUND_EPS) {
          this.landImpact = clamp(this.vy / 900, 0, 1.4);
          this.y = this.groundY;
          this.vy = 0;
          this.grounded = true;
        }
      } else {
        this.y = this.groundY;
      }
      const moved = Math.abs(this.vx) * dt;
      this.distance += moved;
      const advance = moved / this.sp.stride * Math.PI * 2;
      this.gaitTotal += advance;
      this.gaitPhase = (this.gaitPhase + advance) % (Math.PI * 2);
      this.faceScale += (this.facing - this.faceScale) * clamp(dt * 14, 0, 1);
      if (Math.abs(this.faceScale) < 0.02) this.faceScale = 0.02 * (this.facing || 1);
      this.landImpact = Math.max(0, this.landImpact - dt * 4.5);
    }
  };
  function approachZero(v, step2) {
    if (Math.abs(v) <= step2) return 0;
    return v - sign(v) * step2;
  }
  var Animator = class {
    constructor(sp) {
      this.sp = sp;
      this.neck = new Spring(0, 150, 20);
      this.headTilt = new Spring(0, 190, 22);
      this.tail = [];
      for (let i = 0; i < 4; i++) this.tail.push(new Spring(0, 130 - i * 18, 15));
      this.gaze = { x: new Spring(0, 220, 26), y: new Spring(0, 220, 26) };
      this.blinkT = 2 + Math.random() * 3;
      this.blink = 1;
      this.breath = Math.random() * 6.28;
      this.emotion = "calm";
      this.idlePhase = Math.random() * 6.28;
    }
    /* ctx: { body, dt, lookAt:{dx,dy}|null, reduced:boolean, pose:string } */
    update(ctx, pose) {
      const b = ctx.body, dt = ctx.dt, sp = this.sp;
      const s01 = b.speed01;
      const accel = (b.vx - b.prevVx) / Math.max(dt, 1e-4);
      const reduced = ctx.reduced;
      this.breath += dt * (1.4 + s01 * 2.2);
      this.idlePhase += dt;
      const g = b.gaitPhase;
      const swing = 26 * s01 + (b.grounded ? 0 : -8);
      pose.legNear = reduced ? 0 : Math.sin(g) * swing;
      pose.legFar = reduced ? 0 : Math.sin(g + Math.PI) * swing;
      const bob = reduced ? 0 : Math.abs(Math.cos(g)) * -2.4 * s01;
      let sx = 1, sy = 1;
      if (!reduced) {
        const a01 = clamp(accel / 2200, -1, 1);
        sx = 1 + a01 * 0.1 + b.landImpact * -0.16;
        sy = 1 - a01 * 0.1 + b.landImpact * 0.2;
        if (!b.grounded) {
          const air = clamp(-b.vy / 700, -1, 1);
          sx -= air * 0.07;
          sy += air * 0.09;
        }
        const breathe = Math.sin(this.breath) * (0.012 + 0.01 * (1 - s01));
        sy += breathe;
        sx -= breathe * 0.6;
      }
      pose.squashX = sx;
      pose.squashY = sy;
      pose.bob = bob + (reduced ? 0 : Math.sin(this.breath * 0.5) * 0.6 * (1 - s01));
      const leanTarget = reduced ? 0 : clamp(-accel / 260, -9, 9) + (b.grounded ? 0 : clamp(b.vy / 260, -4, 4));
      pose.lean = leanTarget;
      this.neck.target = reduced ? 0 : clamp(accel / 190, -14, 14) * -1 + this.emotionNeck();
      this.headTilt.target = reduced ? 0 : clamp(accel / 300, -9, 9) * -1 + this.emotionHead();
      pose.neck = this.neck.step(dt);
      pose.headTilt = this.headTilt.step(dt);
      pose.headBob = reduced ? 0 : Math.sin(g * 1 + 0.6) * 1.6 * s01;
      const drive = reduced ? 0 : Math.sin(this.breath * 0.9) * 4 * (1 - s01) + clamp(-accel / 200, -18, 18) + Math.sin(g) * 7 * s01;
      let prev = drive;
      for (let i = 0; i < this.tail.length; i++) {
        this.tail[i].target = prev * (i === 0 ? 1 : 0.72);
        pose.tail[i] = this.tail[i].step(dt);
        prev = pose.tail[i];
      }
      const armSwing = reduced ? 0 : Math.sin(g + Math.PI * 0.35) * 12 * s01;
      pose.armNear = (ctx.holding ? -62 : 0) + armSwing + this.emotionArm();
      pose.armFar = (ctx.holding ? -18 : 0) - armSwing * 0.6;
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blinkT = 2.2 + Math.random() * 4.2;
        this.blinkFor = 0.11;
      }
      if (this.blinkFor > 0) {
        this.blinkFor -= dt;
        this.blink = 0.08;
      } else this.blink = 1;
      if (this.emotion === "sleepy") this.blink = 0.16;
      pose.blink = this.blink;
      if (ctx.lookAt && !reduced) {
        this.gaze.x.target = clamp(ctx.lookAt.dx / 60, -1.7, 1.7);
        this.gaze.y.target = clamp(ctx.lookAt.dy / 60, -1.4, 1.4);
      } else {
        this.gaze.x.target = 0;
        this.gaze.y.target = 0;
      }
      pose.gazeX = this.gaze.x.step(dt);
      pose.gazeY = this.gaze.y.step(dt);
      pose.phase = this.idlePhase;
      pose.crestAmp = reduced ? 0 : 3 + s01 * 6 + b.landImpact * 8;
      return pose;
    }
    emotionNeck() {
      switch (this.emotion) {
        case "angry":
          return -8;
        case "scared":
          return 10;
        case "sleepy":
          return 14;
        case "smug":
          return -5;
        default:
          return 0;
      }
    }
    emotionHead() {
      switch (this.emotion) {
        case "happy":
          return -6;
        case "scared":
          return 8;
        case "sleepy":
          return 12;
        case "smug":
          return -8;
        default:
          return 0;
      }
    }
    emotionArm() {
      switch (this.emotion) {
        case "happy":
          return -18;
        case "scared":
          return -34;
        default:
          return 0;
      }
    }
  };

  // src/dino.js
  var Dino = class {
    constructor(stage, speciesId, opts) {
      const o = opts || {};
      this.stage = stage;
      this.sp = speciesOf(speciesId);
      this.baby = !!o.baby;
      this.scale = o.scale || (this.baby ? 0.46 : 1);
      this.rig = buildRig(this.sp.id, this.scale, { baby: this.baby });
      this.body = new Body(this.sp);
      this.anim = new Animator(this.sp);
      this.pose = neutralPose();
      this.outfit = { head: "none", face: "none", back: "none", held: "none" };
      this.holding = false;
      this.fiery = !!o.fiery;
      const el = document.createElement("div");
      el.className = "ad-dino" + (this.baby ? " ad-friend" : "");
      el.style.zIndex = this.baby ? Z.friend : Z.dino;
      el.appendChild(this.rig.svg);
      stage.layer.appendChild(el);
      this.el = el;
      const sh = document.createElement("div");
      sh.className = "ad-shadow";
      sh.style.zIndex = Z.shadow;
      sh.style.width = 90 * this.scale + "px";
      sh.style.margin = `${-9 * this.scale}px 0 0 ${-45 * this.scale}px`;
      stage.layer.appendChild(sh);
      this.shadow = sh;
    }
    get w() {
      return this.rig.W * this.scale;
    }
    get h() {
      return this.rig.H * this.scale;
    }
    /* Where the character actually is on screen, independent of the sprite box. */
    get centreX() {
      return this.body.x + this.w * 0.5;
    }
    get headX() {
      return this.body.x + this.w * (this.body.faceScale >= 0 ? 0.72 : 0.28);
    }
    get headY() {
      return this.body.y + this.h * 0.24;
    }
    setOutfit(outfit) {
      this.outfit = { ...this.outfit, ...outfit };
      this.holding = applyOutfit(this.rig, this.outfit);
    }
    setEmotion(e) {
      this.anim.emotion = e;
    }
    update(dt, ctx) {
      this.body.step(dt);
      this.anim.update({
        body: this.body,
        dt,
        lookAt: ctx && ctx.lookAt,
        reduced: this.stage.reduced,
        holding: this.holding
      }, this.pose);
      poseRig(this.rig, this.pose);
    }
    render() {
      const b = this.body;
      this.el.style.transform = `translate(${b.x}px,${b.y}px) scaleX(${b.faceScale}) scale(${this.scale})`;
      const air = Math.max(0, b.groundY - b.y);
      const k = Math.max(0.22, 1 - air / 220);
      this.shadow.style.transform = `translate(${b.x + this.w * 0.5}px,${b.groundY + this.h - 6}px) scale(${k * this.scale},${k * this.scale})`;
      this.shadow.style.opacity = String(0.42 * k);
    }
    remove() {
      this.el.remove();
      this.shadow.remove();
    }
  };

  // src/entities/egg.js
  var EGG_TYPES = {
    common: { w: 58, shell: "#f2ecd8", speck: "#cfc5a5", glow: null, label: "egg" },
    speckled: { w: 20, shell: "#e8f0dc", speck: "#7a9a52", glow: null, label: "speckled egg" },
    golden: { w: 8, shell: "#ffe285", speck: "#a8862a", glow: "#e8c235", label: "golden egg" },
    fossil: { w: 9, shell: "#d9d3c2", speck: "#8e8877", glow: null, label: "stone egg" },
    volcanic: { w: 5, shell: "#5a4038", speck: "#ef5b23", glow: "#ef5b23", label: "volcanic egg" }
  };
  function rollEggType() {
    const keys = Object.keys(EGG_TYPES);
    const total = keys.reduce((s, k) => s + EGG_TYPES[k].w, 0);
    let r = Math.random() * total;
    for (const k of keys) {
      r -= EGG_TYPES[k].w;
      if (r <= 0) return k;
    }
    return "common";
  }
  var CRACKS = [
    "",
    "M-4 -2 L0 2 L3 -1",
    "M-6 -4 L-2 1 L1 -2 L5 3",
    "M-7 -5 L-3 0 L0 -3 L4 2 L7 -2 M-2 4 L1 7"
  ];
  var Egg = class {
    constructor(stage, x, y, type) {
      this.stage = stage;
      this.type = type || rollEggType();
      this.def = EGG_TYPES[this.type];
      this.x = x;
      this.y = y;
      this.t = 0;
      this.hatchAt = rnd(9, 16);
      this.stageIdx = 0;
      this.dead = false;
      this.taps = 0;
      this.dragging = null;
      this.species = rollSpecies();
      const el = document.createElement("div");
      el.className = "ad-egg";
      el.style.zIndex = Z.friend;
      const svg = svgEl("svg", { viewBox: "-14 -20 28 40", width: 30, height: 42 });
      this.shell = svgEl("ellipse", {
        cx: 0,
        cy: 2,
        rx: 11,
        ry: 14,
        fill: this.def.shell,
        stroke: this.def.speck,
        "stroke-width": 1.5
      });
      this.crack = svgEl("path", {
        d: "",
        stroke: this.def.speck,
        "stroke-width": 1.6,
        fill: "none",
        "stroke-linecap": "round"
      });
      svg.appendChild(this.shell);
      svg.appendChild(svgEl("circle", { cx: -3, cy: -2, r: 1.7, fill: this.def.speck, opacity: 0.8 }));
      svg.appendChild(svgEl("circle", { cx: 4, cy: 5, r: 1.3, fill: this.def.speck, opacity: 0.8 }));
      svg.appendChild(svgEl("ellipse", { cx: -3.5, cy: -4, rx: 3.4, ry: 4.4, fill: "#fff", opacity: 0.28 }));
      svg.appendChild(this.crack);
      el.appendChild(svg);
      if (this.def.glow) {
        el.style.filter = `drop-shadow(0 0 6px ${this.def.glow})`;
      }
      el.addEventListener("pointerdown", (e) => this.onPoke(e));
      this.el = el;
      stage.layer.appendChild(el);
      this.place();
    }
    place() {
      this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.tilt || 0}deg)`;
    }
    onPoke(e) {
      e.stopPropagation();
      this.taps++;
      this.hatchAt = Math.max(this.t + 0.35, this.hatchAt - 3.2);
      this.stage.audio.play("crack");
      this.stage.particles.dust(this.x + 15, this.y + 30, 4, "rgba(210,200,170,0.8)");
      this.pop = 1e-3;
      const start = { x: e.clientX - this.x, y: e.clientY - this.y };
      const move = (ev) => {
        this.x = ev.clientX - start.x;
        this.y = ev.clientY - start.y;
        this.place();
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    step(dt) {
      if (this.dead) return;
      this.t += dt;
      const p = clamp(this.t / this.hatchAt, 0, 1);
      const next = p > 0.86 ? 3 : p > 0.62 ? 2 : p > 0.34 ? 1 : 0;
      if (next !== this.stageIdx) {
        this.stageIdx = next;
        this.crack.setAttribute("d", CRACKS[next]);
        if (next > 0) {
          this.stage.audio.play("crack");
          this.stage.particles.dust(this.x + 15, this.y + 26, 3, "rgba(210,200,170,0.85)");
        }
      }
      const amp = 3 + p * p * 13;
      const rate = 4 + p * 9;
      this.tilt = Math.sin(this.t * rate) * amp * (this.stage.reduced ? 0.25 : 1);
      if (this.pop != null) {
        this.pop += dt * 4;
        if (this.pop >= 1) this.pop = null;
      }
      this.place();
      if (p >= 1) this.burst();
    }
    burst() {
      this.dead = true;
      const cx = this.x + 15, cy = this.y + 22;
      this.stage.audio.play("burst");
      this.stage.particles.shards(cx, cy, this.stage.tier ? 16 : 0, this.def.shell);
      if (this.type === "volcanic") this.stage.particles.embers(cx, cy, 14);
      if (this.type === "golden") this.stage.particles.sparkle(cx, cy, "#ffe285");
      this.el.remove();
      this.onBurst && this.onBurst(this);
    }
    remove() {
      this.dead = true;
      this.el.remove();
    }
    serialize() {
      return {
        type: this.type,
        x: this.x,
        y: this.y,
        t: this.t,
        hatchAt: this.hatchAt,
        species: this.species
      };
    }
  };
  function eggOutcome(egg) {
    switch (egg.type) {
      case "fossil":
        return { kind: "fossil" };
      case "golden":
        return { kind: "unlock", tier: "gold" };
      case "speckled":
        return { kind: "friend", species: egg.species, rare: true };
      case "volcanic":
        return { kind: "friend", species: egg.species, fiery: true };
      default:
        return { kind: "friend", species: egg.species };
    }
  }

  // src/entities/ptero.js
  var PTERO_BEHAVIOURS = ["flyby", "steal", "perch", "airdrop"];
  var Ptero = class {
    constructor(stage, behaviour) {
      this.stage = stage;
      this.behaviour = behaviour || "flyby";
      this.dead = false;
      this.t = 0;
      this.carry = null;
      this.state = "enter";
      this.flap = 0;
      const fromLeft = Math.random() < 0.5;
      this.dir = fromLeft ? 1 : -1;
      this.x = fromLeft ? -120 : stage.vw() + 120;
      this.y = rnd(40, Math.max(90, stage.vh() * 0.34));
      this.baseY = this.y;
      this.speed = rnd(190, 280);
      this.bobAmp = rnd(8, 20);
      this.bobRate = rnd(1.4, 2.4);
      const el = document.createElement("div");
      el.className = "ad-ptero";
      el.style.zIndex = Z.ptero;
      const svg = svgEl("svg", { viewBox: "-50 -30 100 60", width: 100, height: 60 });
      const t = TONE.sky;
      this.wingL = svgEl("path", {
        d: "M-6 -2 Q-26 -18 -44 -6 Q-26 2 -8 4Z",
        fill: t.base,
        style: "transform-box:fill-box;transform-origin:100% 40%"
      });
      this.wingR = svgEl("path", {
        d: "M6 -2 Q26 -18 44 -6 Q26 2 8 4Z",
        fill: t.shade,
        style: "transform-box:fill-box;transform-origin:0% 40%"
      });
      svg.appendChild(this.wingR);
      svg.appendChild(svgEl("path", { d: "M-8 0 Q0 -12 10 -4 Q16 -2 22 -6 L20 2 Q10 8 0 8 Q-6 6 -8 0Z", fill: t.base }));
      svg.appendChild(svgEl("path", { d: "M10 -6 Q18 -14 26 -10 Q20 -4 14 -3Z", fill: t.shade }));
      svg.appendChild(svgEl("path", { d: "M14 -3 L30 1 L14 3Z", fill: t.light }));
      svg.appendChild(svgEl("circle", { cx: 13, cy: -4, r: 1.8, fill: "#1d1633" }));
      svg.appendChild(this.wingL);
      this.carrySlot = svgEl("g", { class: "ad-ptero-carry", transform: "translate(0,10)" });
      svg.appendChild(this.carrySlot);
      el.appendChild(svg);
      stage.layer.appendChild(el);
      this.el = el;
      const sh = document.createElement("div");
      sh.className = "ad-shadow ad-ptero-shadow";
      sh.style.zIndex = Z.shadow;
      stage.layer.appendChild(sh);
      this.shadow = sh;
    }
    attachCarry(node) {
      this.carry = node;
      this.carrySlot.innerHTML = "";
      if (node) this.carrySlot.appendChild(node);
    }
    step(dt, ctx) {
      if (this.dead) return;
      this.t += dt;
      const sp = this.speed * (this.state === "dive" ? 1.9 : 1);
      this.flap += dt * (5 + sp / 90);
      if (this.state === "perch") {
        if (this.t > this.perchUntil) {
          this.state = "exit";
        }
      } else {
        this.x += this.dir * sp * dt;
      }
      if (this.state === "enter") {
        this.y = this.baseY + Math.sin(this.t * this.bobRate) * this.bobAmp;
        if (this.behaviour === "steal" && ctx.target && this.nearX(ctx.target.x, 90)) {
          this.state = "dive";
          this.diveFrom = this.y;
          this.diveTo = ctx.target.y;
        } else if (this.behaviour === "perch" && ctx.perch && this.nearX(ctx.perch.x, 60)) {
          this.state = "perch";
          this.x = ctx.perch.x;
          this.y = ctx.perch.y - 26;
          this.perchUntil = this.t + rnd(3.5, 7);
          this.stage.audio.play("squawk");
          this.stage.say("perch");
        } else if (this.behaviour === "airdrop" && this.nearX(this.stage.vw() * 0.5, 120)) {
          this.state = "drop";
        }
      } else if (this.state === "dive") {
        const k = clamp((this.t - 0) * 2, 0, 1);
        this.y += (this.diveTo - this.y) * clamp(dt * 6, 0, 1);
        if (Math.abs(this.y - this.diveTo) < 14) {
          this.state = "climb";
          this.stage.audio.play("squawk");
          this.onGrab && this.onGrab(this);
        }
      } else if (this.state === "climb") {
        this.y += (this.baseY - 30 - this.y) * clamp(dt * 3, 0, 1);
        if (this.offscreen()) this.finish();
      } else if (this.state === "drop") {
        this.onDrop && this.onDrop(this);
        this.state = "exit";
      }
      if (this.state === "exit" || this.state === "enter") {
        if (this.offscreen()) this.finish();
      }
      if (Math.sin(this.flap) > 0.92) this.stage.audio.play("flap");
      const fl = Math.sin(this.flap) * (this.state === "perch" ? 4 : 52);
      this.wingL.style.transform = `rotate(${-fl}deg)`;
      this.wingR.style.transform = `rotate(${fl}deg)`;
      this.el.style.transform = `translate(${this.x}px,${this.y}px) scaleX(${this.dir})`;
      const gy = this.stage.groundY() + 66;
      const spread = clamp(1 - (gy - this.y) / 700, 0.25, 1);
      this.shadow.style.transform = `translate(${this.x}px,${gy}px) scale(${spread})`;
      this.shadow.style.opacity = String(0.22 * spread);
    }
    nearX(x, tol) {
      return Math.abs(this.x - x) < tol;
    }
    offscreen() {
      return this.x < -220 || this.x > this.stage.vw() + 220;
    }
    finish() {
      this.dead = true;
      this.onExit && this.onExit(this);
      this.remove();
    }
    remove() {
      this.dead = true;
      this.el.remove();
      this.shadow.remove();
    }
  };

  // src/entities/volcano.js
  var Volcano = class {
    constructor(stage, side) {
      this.stage = stage;
      this.side = side || (Math.random() < 0.5 ? "left" : "right");
      this.t = 0;
      this.phase = "rise";
      this.dead = false;
      this.shake = 0;
      this.duration = { rise: 1.4, rumble: 3, erupt: 4.5, ash: 6, sink: 1.6 };
      const w = 200, h = 176;
      this.w = w;
      this.h = h;
      const el = document.createElement("div");
      el.className = "ad-volcano";
      el.style.zIndex = Z.volcano;
      const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
      const lava = TONE.lava;
      const rock = { shade: "#3b3540", base: "#544c58", light: "#6d6472" };
      svg.appendChild(svgEl("path", {
        d: `M4 ${h} Q30 ${h - 40} 62 40 Q80 18 100 24 Q124 32 150 ${h - 46} Q170 ${h - 14} ${w - 4} ${h}Z`,
        fill: rock.base
      }));
      svg.appendChild(svgEl("path", {
        d: `M4 ${h} Q30 ${h - 40} 62 40 Q76 22 90 26 L86 ${h}Z`,
        fill: rock.light,
        opacity: 0.55
      }));
      svg.appendChild(svgEl("path", {
        d: `M150 ${h - 46} Q170 ${h - 14} ${w - 4} ${h} L120 ${h}Z`,
        fill: rock.shade,
        opacity: 0.6
      }));
      svg.appendChild(svgEl("path", {
        d: `M74 60 Q66 100 56 ${h} M108 58 Q118 104 128 ${h}`,
        stroke: rock.shade,
        "stroke-width": 3,
        fill: "none",
        opacity: 0.5
      }));
      this.crater = svgEl("path", { d: "M62 30 Q84 16 106 28 Q84 42 62 30Z", fill: lava.shade });
      svg.appendChild(this.crater);
      this.glow = svgEl("ellipse", { cx: 84, cy: 29, rx: 21, ry: 8, fill: lava.light, opacity: 0 });
      svg.appendChild(this.glow);
      this.flow = svgEl("path", {
        d: `M76 32 Q70 74 54 ${h} L104 ${h} Q96 76 96 32Z`,
        fill: lava.base,
        opacity: 0
      });
      svg.appendChild(this.flow);
      el.appendChild(svg);
      stage.layer.appendChild(el);
      this.el = el;
      this.place(1);
    }
    place(hidden) {
      const s = this.stage;
      const x = this.side === "left" ? -18 : s.vw() - this.w + 18;
      const y = s.groundY() + 76 - this.h + (hidden ? this.h : 0);
      const sx = this.shake ? rnd(-this.shake, this.shake) : 0;
      const sy = this.shake ? rnd(-this.shake, this.shake) : 0;
      this.x = x;
      this.y = y;
      this.el.style.transform = `translate(${x + sx}px,${y + sy}px)`;
    }
    get mouth() {
      return { x: this.x + 84, y: this.y + 28 };
    }
    step(dt) {
      if (this.dead) return;
      this.t += dt;
      const d = this.duration;
      const reduced = this.stage.reduced;
      if (this.phase === "rise") {
        const k = ease.outCubic(clamp(this.t / d.rise, 0, 1));
        const s = this.stage;
        this.x = this.side === "left" ? -18 : s.vw() - this.w + 18;
        this.y = s.groundY() + 76 - this.h * k;
        this.el.style.transform = `translate(${this.x}px,${this.y}px)`;
        if (this.t >= d.rise) {
          this.next("rumble");
          this.stage.audio.play("rumble", { dur: d.rumble });
          this.stage.say("volcano");
        }
      } else if (this.phase === "rumble") {
        const k = clamp(this.t / d.rumble, 0, 1);
        this.shake = reduced ? 0 : k * 5;
        this.glow.setAttribute("opacity", String(k * 0.85));
        if (Math.random() < k * 0.5) this.stage.particles.embers(this.mouth.x, this.mouth.y, 2);
        this.place();
        if (this.t >= d.rumble) {
          this.next("erupt");
          this.stage.audio.play("erupt");
        }
      } else if (this.phase === "erupt") {
        const k = clamp(this.t / d.erupt, 0, 1);
        this.shake = reduced ? 0 : (1 - k) * 9;
        this.flow.setAttribute("opacity", String(clamp(k * 3, 0, 0.95)));
        const m = this.mouth;
        const n = this.stage.tier === 2 ? 5 : this.stage.tier === 1 ? 2 : 0;
        for (let i = 0; i < n; i++) {
          this.stage.particles.spawn({
            x: m.x + rnd(-16, 16),
            y: m.y,
            vx: rnd(-260, 260),
            vy: rnd(-760, -420) * (1 - k * 0.5),
            life: rnd(1.1, 2.1),
            size: rnd(2.6, 6),
            g: 1150,
            drag: 0.15,
            color: Math.random() < 0.55 ? "#ef5b23" : "#ffc247"
          });
        }
        this.place();
        if (this.t >= d.erupt) this.next("ash");
      } else if (this.phase === "ash") {
        this.shake = 0;
        this.glow.setAttribute("opacity", String(clamp(0.85 - this.t / d.ash, 0, 0.85)));
        if (this.stage.tier === 2 && Math.random() < 0.7) {
          this.stage.particles.ash(rnd(0, this.stage.vw()), -10, 2);
        }
        this.place();
        if (this.t >= d.ash) this.next("sink");
      } else if (this.phase === "sink") {
        const k = ease.inCubic(clamp(this.t / d.sink, 0, 1));
        const s = this.stage;
        this.y = s.groundY() + 76 - this.h * (1 - k);
        this.el.style.transform = `translate(${this.x}px,${this.y}px)`;
        if (this.t >= d.sink) {
          this.remove();
          this.onEnd && this.onEnd(this);
        }
      }
    }
    next(p) {
      this.phase = p;
      this.t = 0;
    }
    remove() {
      this.dead = true;
      this.el.remove();
    }
  };

  // src/entities/meteor.js
  var Meteor = class {
    constructor(stage, opts) {
      this.stage = stage;
      const o = opts || {};
      this.t = 0;
      this.phase = "fall";
      this.dead = false;
      this.extinction = !!o.extinction;
      const s = stage;
      this.tx = o.x == null ? rnd(s.vw() * 0.2, s.vw() * 0.8) : o.x;
      this.ty = s.groundY() + 70;
      this.fromLeft = this.tx > s.vw() * 0.5;
      this.x = this.fromLeft ? -140 : s.vw() + 140;
      this.y = -140;
      this.dur = 2.2;
      const el = document.createElement("div");
      el.className = "ad-meteor";
      el.style.zIndex = Z.meteor;
      const svg = svgEl("svg", { viewBox: "-40 -20 80 40", width: 80, height: 40 });
      svg.appendChild(svgEl("path", { d: "M-36 0 Q-16 -7 0 -3 Q-16 7 -36 0Z", fill: "#ffc247", opacity: 0.75 }));
      svg.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 9, fill: "#4a4a52" }));
      svg.appendChild(svgEl("circle", { cx: -2, cy: -2, r: 6, fill: "#6f6f7a" }));
      svg.appendChild(svgEl("circle", { cx: 3, cy: 2, r: 2.4, fill: "#3a3a40" }));
      svg.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 11, fill: "#ef5b23", opacity: 0.28 }));
      el.appendChild(svg);
      stage.layer.appendChild(el);
      this.el = el;
      stage.audio.play("whoosh");
    }
    step(dt) {
      if (this.dead) return;
      this.t += dt;
      if (this.phase === "fall") {
        const k = clamp(this.t / this.dur, 0, 1);
        const e = ease.inQuad(k);
        const sx = this.fromLeft ? -140 : this.stage.vw() + 140;
        this.x = sx + (this.tx - sx) * e;
        this.y = -140 + (this.ty + 140) * e;
        const ang = Math.atan2(this.ty + 140, this.tx - sx) * 57.2958;
        this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${ang}deg)`;
        if (this.stage.tier === 2) {
          this.stage.particles.trail(
            this.x,
            this.y,
            -(this.tx - sx) * 0.4,
            -(this.ty + 140) * 0.4,
            Math.random() < 0.5 ? "#ffc247" : "#ef5b23"
          );
        }
        if (k >= 1) this.impact();
      } else if (this.phase === "ring") {
        const k = clamp(this.t / 0.75, 0, 1);
        const r = ease.outCubic(k) * 380;
        this.ring.style.transform = `translate(${this.tx}px,${this.ty}px) scale(${r / 40})`;
        this.ring.style.opacity = String((1 - k) * 0.55);
        if (this.flash) this.flash.style.opacity = String(Math.max(0, 0.55 - k * 1.4));
        if (k >= 1) {
          this.ring.remove();
          if (this.flash) this.flash.remove();
          this.dead = true;
          this.onDone && this.onDone(this);
        }
      }
    }
    impact() {
      this.el.remove();
      this.phase = "ring";
      this.t = 0;
      const s = this.stage;
      s.audio.play("boom");
      s.audio.play("shockwave");
      s.particles.dust(this.tx, this.ty, s.tier === 2 ? 26 : 8, "rgba(150,140,115,0.85)");
      s.particles.shards(this.tx, this.ty, s.tier === 2 ? 18 : 6, "#6f6f7a");
      s.particles.embers(this.tx, this.ty, s.tier === 2 ? 14 : 4);
      const ring = document.createElement("div");
      ring.className = "ad-ring";
      ring.style.zIndex = Z.meteor;
      s.layer.appendChild(ring);
      this.ring = ring;
      if (!s.reduced) {
        const f = document.createElement("div");
        f.className = "ad-flash";
        f.style.zIndex = Z.flash;
        s.layer.appendChild(f);
        this.flash = f;
      }
      const c = document.createElement("div");
      c.className = "ad-crater";
      c.style.zIndex = Z.decal;
      const svg = svgEl("svg", { viewBox: "-60 -20 120 40", width: 120, height: 40 });
      svg.appendChild(svgEl("ellipse", { cx: 0, cy: 6, rx: 46, ry: 13, fill: "rgba(60,55,48,0.30)" }));
      svg.appendChild(svgEl("ellipse", { cx: 0, cy: 4, rx: 34, ry: 9, fill: "rgba(40,36,32,0.34)" }));
      svg.appendChild(svgEl("path", {
        d: "M-42 8 L-52 2 M42 8 L52 3 M-20 12 L-26 18 M22 12 L28 18",
        stroke: "rgba(60,55,48,0.30)",
        "stroke-width": 3,
        "stroke-linecap": "round"
      }));
      c.appendChild(svg);
      c.style.transform = `translate(${this.tx}px,${this.ty + 44}px)`;
      s.layer.appendChild(c);
      this.onCrater && this.onCrater(c);
    }
    remove() {
      this.dead = true;
      this.el.remove();
      if (this.ring) this.ring.remove();
      if (this.flash) this.flash.remove();
    }
  };

  // src/content/jokes.js
  var CARD_STYLES = ["paper", "polaroid", "tablet", "comic"];
  var JOKES = [
    ["Why can't you hear a pterodactyl in the bathroom?", 'The "P" is silent.'],
    ["What do you call a dinosaur that naps?", "A dino-SNORE."],
    ["What does a triceratops sit on?", "Its tricera-bottom."],
    ["Why did the dinosaur cross the road?", "Chickens hadn't evolved yet."],
    ["What do you call a dino with a great vocabulary?", "A thesaurus."],
    ["How do you invite a dinosaur to lunch?", '"Tea, Rex?"'],
    ["What made the dinosaur's car stop?", "A flat Tire-annosaurus."],
    ["Best way to talk to a velociraptor?", "Long distance."],
    ["What do you call a sleeping stegosaurus?", "A stego-snore-us."],
    ["Why do dinosaurs make bad drivers?", "They all died before the driving test."],
    ["What is a dinosaur\u2019s least favourite reading?", "The extinction column."],
    ["What do you call a dinosaur with one eye?", "Do-you-think-he-saw-us."],
    ["Why was the dinosaur afraid of the ocean?", "Something about a giant rock from space. Long story."],
    ["What do you get when a dinosaur walks through a strawberry patch?", "Strawberry jam."],
    ["What is heavier: a tonne of feathers or a tonne of raptor?", "The raptor. It argues."],
    ["Why did the raptor open the door?", "Because it could. That was the whole point."],
    ["How do you know a dinosaur has been in your fridge?", "Footprints in the butter."],
    ["What do you call an anxious dinosaur?", "A nervous rex."],
    ["Why are dinosaurs bad at hide and seek?", "The tail always gives it away."],
    ["What is a T. rex\u2019s worst nightmare?", "A shelf."],
    ["Why did the T. rex fail woodworking?", "Nothing was within reach."],
    ["How does a T. rex applaud?", "Enthusiastically. Silently."],
    ["What do you call a T. rex on a keyboard?", "A very slow typist."],
    ["Why did the T. rex skip the hug?", "It just wasn\u2019t going to work out."],
    ["What did the T. rex say to the shelf?", '"You win. Again."'],
    ["Why can\u2019t a T. rex do push-ups?", "It cannot even reach the floor."],
    ["What is a T. rex\u2019s favourite exercise?", "Cardio. Obviously."],
    ["What do you call a brachiosaurus in an elevator?", "A structural concern."],
    ["Why did the brachiosaurus get the promotion?", "It could see the big picture."],
    ["What is a brachiosaurus\u2019s least favourite room?", "The basement."],
    ["Why do stegosaurs make bad house guests?", "They keep knocking over the shelves."],
    ["What is a stegosaurus\u2019s favourite band?", "The Plates."],
    ["Why did the triceratops get three parking tickets?", "Three horns, three fines. That\u2019s the rule."],
    ["What is a triceratops\u2019s favourite drink?", "Anything with a good charge."],
    ["What do you call a polite pterodactyl?", "Pleasant. Also still silent."],
    ["Why did the pterodactyl take your hat?", "It was a better hat."],
    ["What do pterodactyls do on their day off?", "Whatever they were already doing. It never stops."],
    ["What did the meteor say to Earth?", '"Sorry, this is going to be a whole thing."'],
    ["Why don\u2019t dinosaurs check the sky?", "They did, once. It did not help."],
    ["What is 65 million years between friends?", "A rounding error."],
    ["What did the volcano say to the dinosaur?", '"I lava you." Then it erupted. Bad timing.'],
    ["Why did the dinosaur stand near the volcano?", "Great ambience. Terrible decision."],
    ["What is a volcano\u2019s favourite music?", "Anything with a good flow."],
    ["Why did the dinosaur bring an umbrella?", "The forecast said ash with a chance of doom."],
    ["What do you call a dinosaur who survived?", "A bird. Genuinely."],
    ["Why do dinosaurs love this browser tab?", "Warm, well lit, nobody scrolls away."],
    ["What is a dinosaur\u2019s favourite HTTP status?", "410 Gone."],
    ["Why did the dinosaur uninstall the extension?", "It didn\u2019t. That would be rude."],
    ["What is a dinosaur\u2019s favourite CSS property?", "z-index. Very high."],
    ["Why did the dinosaur fail code review?", "Too many breaking changes."],
    ["What do you call a dinosaur that ships on Friday?", "Brave."],
    ["What is a dinosaur\u2019s favourite key?", "Escape. It never worked."],
    ["Why did the dinosaur refuse to merge?", "Conflicts going back 65 million years."],
    ["What did the dinosaur name its startup?", "Extinction as a Service."],
    ["Why is a dinosaur bad at version control?", "Everything is a fossil branch."],
    ["What is a dinosaur\u2019s favourite font?", "Anything but Comic Sans. It lived through the real thing."],
    ["Why did the dinosaur close the tab?", "It didn\u2019t. Look behind you."],
    ["Why was the dinosaur hungry at midnight?", "The last meal was a while ago."],
    ["What is a dinosaur\u2019s favourite snack?", "Whatever is closest. Do not test this."],
    ["Why did the dinosaur bring a knife to the webpage?", "It heard there was a slice of the market."],
    ["What did the dinosaur order?", "Everything. Twice."],
    ["Why do dinosaurs never share snacks?", "Portion control is a modern invention."],
    ["What do you call a hungry dinosaur?", "A dinosaur."],
    ["Why did the dinosaur lay an egg on your homepage?", "Prime real estate."],
    ["What came first, the dinosaur or the egg?", "The egg. And it wobbled for ages."],
    ["Why don\u2019t dinosaurs count their eggs?", "They hatch when they hatch."],
    ["What do you call an egg that never hatched?", "A very long nap."],
    ["Why did the dinosaur build a nest here?", "Nice margins."],
    ["What is a baby dinosaur\u2019s first word?", '"Rawr." It\u2019s not complicated.'],
    ["Why do baby dinosaurs follow you?", "You look like you know where the snacks are."],
    ["What do you call a line of baby dinosaurs?", "A commitment."],
    ["Why did the dinosaur wear a crown?", "It was already in charge. This is just paperwork."],
    ["What is a dinosaur\u2019s favourite accessory?", "Anything that stays on at a full sprint."],
    ["Why did the dinosaur wear sunglasses indoors?", "Extinction is bright."],
    ["What do you call a dinosaur in a top hat?", "Overdressed. Still hungry."],
    ["Why did the dinosaur take up graffiti?", "Cave painting, but with better distribution."],
    ["What did the dinosaur write on the wall?", '"Was here." It really was.'],
    ["Why did the dinosaur take a photo of your page?", "For the fossil record."],
    ["What is a dinosaur\u2019s favourite sport?", "Scroll surfing. Undefeated."],
    ["Why did the dinosaur go fishing on a webpage?", "Something\u2019s always biting in the comments."],
    ["What do you call a dinosaur with a magnifying glass?", "A code reviewer."],
    ["Why did the dinosaur bring a boombox?", "Every extinction needs a soundtrack."],
    ["What is the dinosaur\u2019s five year plan?", "Ambitious, given the circumstances."]
  ];
  var FACTS = [
    ["Birds are dinosaurs.", 'Not "descended from" \u2014 birds are the surviving lineage of theropod dinosaurs.'],
    ["T. rex arms were strong.", "Short, but built with heavy bone and large muscle attachments. Small does not mean weak."],
    ["Stegosaurus and T. rex never met.", "More time separates them than separates T. rex from you."],
    ["Many dinosaurs had feathers.", "Feather impressions and quill knobs are known from multiple theropod groups."],
    ["The asteroid hit near Chicxulub.", "The impact crater sits under the Yucat\xE1n Peninsula, about 180 km across."],
    ["Dinosaurs ruled for ~165 million years.", "Modern humans have been around for roughly 0.2% of that."],
    ["Velociraptor was turkey-sized.", "About 2 m long including the tail, and feathered."],
    ["Sauropods had air-filled bones.", "Hollow, air-sac-invaded vertebrae \u2014 the same system birds use to breathe."],
    ["Some dinosaurs cared for their young.", "Nesting colonies with juveniles are preserved at several sites."],
    ["Colour is recoverable.", "Fossilised melanosomes have been used to reconstruct plumage colour in some species."],
    ["Pterosaurs were not dinosaurs.", "They are close relatives \u2014 a separate branch of archosaurs."],
    ["Dinosaur is a young word.", 'Richard Owen coined "Dinosauria" in 1842.']
  ];

  // src/content/speech.js
  var SPEECH = {
    idle: [
      "RAWR.",
      "I was told there would be snacks.",
      "Have you seen my friends?",
      "This tab is now MY territory.",
      "Comet? What comet?",
      "Tiny arms, big dreams.",
      "I do my own stunts.",
      "You scroll, I stroll.",
      "Fear the stomp.",
      "Egg-cellent day for chaos.",
      "Nice page. Load-bearing?",
      "I have opinions about this layout.",
      "Sixty-five million years and no snacks.",
      "I am not blocking anything. Relax.",
      "Do not mind me.",
      "Keep working. I am supervising."
    ],
    chase: ["Here I come!", "Get that cursor!", "STOMP STOMP STOMP", "You cannot outrun the past.", "Little pointer. Big mistake."],
    caught: ["CHOMP! Got it.", "Tail-BONK!", "Gotcha.", "That is one cursor.", "Delicious. Ten out of ten."],
    bop: ["Ow! Rude.", "HEY.", "That tickles.", "Extinction was less painful.", "I will remember this.", "Again? Fine. Again."],
    sleep: ["zzz\u2026 zzz\u2026", "Just resting my eyes.", "Wake me for the meteor.", "Five more million years."],
    snack: ["Snack time!", "Do not judge me.", "Protein.", "Chef\u2019s kiss.", "This counts as lunch."],
    egg: ["One moment. Nature calls.", "Do not look.", "Making an investment.", "This one feels lucky."],
    hatchGood: ["A friend appears!", "Welcome, little one.", "The pack grows.", "Hello, tiny problem."],
    hatchDud: ["Hm. Just yolk in that one.", "Nothing. Typical.", "Well. That was a fossil.", "Better luck next clutch."],
    hatchRare: ["Ooh. That one is SPECIAL.", "Look at this magnificent creature.", "Rare! Do not touch."],
    meteorSpot: ["Wait.", "Not again.", "I have seen this movie.", "Everyone stay calm.", "That is a big rock."],
    meteorAfter: ["Survived it. Again.", "Fine. Everything is fine.", "That buffed out.", "Anyway."],
    volcano: ["Is that smoke?", "Oh, THAT is new.", "I lava this page.", "RUN. Politely."],
    ptero: ["Sky rat!", "Bring that back!", "Rude bird. RUDE.", "It has my hat."],
    perch: ["Great view from up here.", "This heading is mine now.", "I live here now."],
    steal: ["Mine.", "I am borrowing this.", "Finders keepers.", "This image is better on the floor."],
    graffiti: ["Cave painting.", "For the record.", "Art.", "Do not clean this."],
    inspect: ["This markup is\u2026 a choice.", "Who wrote this?", "Interesting. Wrong, but interesting.", "Nested. Deeply nested."],
    fish: ["Something is biting.", "Patience.", "Big one down there."],
    dance: ["This is my song.", "Do not stop the beat.", "Extinction can wait."],
    photo: ["For the fossil record.", "Say cheese.", "One for the archives."],
    surf: ["WHOA", "Cowabunga, technically.", "Scroll slower!"],
    card: ["Special delivery.", "Read this.", "Card for you.", "You will love this one."],
    unlock: ["New look unlocked!", "Fashion.", "Try it on."],
    reduced: ["Taking it easy today.", "Calm mode. Very restful."]
  };

  // src/activities.js
  var A = {};
  function enter(E, name, data) {
    const prev = E.activity;
    if (prev && A[prev] && A[prev].exit) A[prev].exit(E);
    E.activity = name;
    E.actT = 0;
    E.actData = data || {};
    const def = A[name] || A.wander;
    E.dino.setEmotion(def.emotion || "calm");
    if (def.held !== void 0) E.dino.setOutfit({ held: def.held });
    else E.dino.setOutfit({ held: E.settings.outfit.held });
    if (def.enter) def.enter(E);
  }
  function step(E, dt) {
    E.actT += dt;
    const def = A[E.activity] || A.wander;
    if (def.step) def.step(E, dt);
    E.dino.update(dt, { lookAt: lookVector(E) });
    footprints(E, dt);
    if (E.actT >= (E.actUntil || 3)) choose(E);
  }
  function lookVector(E) {
    if (!E.mouse.seen || E.reduced) return null;
    return { dx: E.mouse.x - E.dino.headX, dy: E.mouse.y - E.dino.headY };
  }
  function footprints(E, dt) {
    const b = E.dino.body;
    if (!b.grounded || b.speed < 12 || E.loop.tier === 0) return;
    E._stepAcc = (E._stepAcc || 0) + b.speed * dt;
    if (E._stepAcc < E.dino.sp.stride * 0.5) return;
    E._stepAcc = 0;
    E.audio.play("step", { heavy: E.dino.sp.mass > 1.3 });
    const p = document.createElement("div");
    p.className = "ad-print";
    p.style.zIndex = Z.decal;
    p.style.transform = `translate(${E.dino.centreX + rnd(-6, 6)}px,${b.groundY + E.dino.h - 4}px)`;
    E.stage.layer.appendChild(p);
    E.prints.push(p);
    requestAnimationFrame(() => {
      p.style.opacity = "0";
    });
    setTimeout(() => {
      p.remove();
      E.prints = E.prints.filter((x) => x !== p);
    }, 2500);
    if (E.dino.outfit.held === "crayon") scribble(E);
  }
  function scribble(E) {
    const g = document.createElement("div");
    g.className = "ad-graffiti";
    g.style.zIndex = Z.decal;
    const svg = svgEl("svg", { viewBox: "-14 -14 28 28", width: 28, height: 28 });
    svg.appendChild(svgEl("path", {
      d: `M-10 ${rnd(-6, 6)} Q0 ${rnd(-12, 12)} 10 ${rnd(-6, 6)}`,
      stroke: "#c94f3d",
      "stroke-width": 3,
      fill: "none",
      "stroke-linecap": "round"
    }));
    g.appendChild(svg);
    g.style.transform = `translate(${E.dino.centreX}px,${E.dino.body.groundY + E.dino.h * 0.6}px)`;
    E.stage.layer.appendChild(g);
    E.addDecal(g);
    E.audio.play("scribble");
  }
  var dur = (E, a, b) => {
    E.actUntil = rnd(a, b);
  };
  A.wander = {
    held: void 0,
    enter(E) {
      E.actData.tx = rnd(30, Math.max(120, window.innerWidth - 160));
      dur(E, 2.6, 6.5);
    },
    step(E, dt) {
      E.dino.body.driveToward(E.actData.tx, dt, 0.55);
    }
  };
  A.chase = {
    emotion: "angry",
    held: "none",
    enter(E) {
      E.say(pick(SPEECH.chase));
      dur(E, 4.5, 8);
    },
    step(E, dt) {
      const b = E.dino.body;
      b.driveToward(E.mouse.x - E.dino.w * 0.6, dt, 1);
      if (E.mouse.y < b.groundY - 40 && b.grounded && Math.random() < dt * 1.4) b.jump();
      const d = Math.hypot(E.mouse.x - E.dino.headX, E.mouse.y - E.dino.headY);
      if (d < 52) {
        if (Math.random() < 0.5) {
          E.audio.play("chomp");
        } else {
          E.audio.play("bonk");
        }
        E.say(pick(SPEECH.caught));
        E.particles.sparkle(E.mouse.x, E.mouse.y, "#ffd7a1");
        choose(E);
      }
    }
  };
  A.roar = {
    emotion: "angry",
    held: "none",
    enter(E) {
      E.dino.body.halt(0.2);
      E.audio.play("roar");
      E.say("RAAAWR!");
      E.dino.body.landImpact = 0.6;
      E.particles.dust(E.dino.centreX, E.dino.body.groundY + E.dino.h - 6, 10);
      dur(E, 1.4, 1.9);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
    }
  };
  A.sleep = {
    emotion: "sleepy",
    held: "none",
    enter(E) {
      E.say(pick(SPEECH.sleep));
      E.bump("naps");
      dur(E, 4, 8);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
      if (Math.random() < dt * 0.7) E.particles.notes(E.dino.headX, E.dino.headY - 10);
    }
  };
  A.egg = {
    emotion: "calm",
    held: "none",
    enter(E) {
      E.say(pick(SPEECH.egg));
      dur(E, 1.6, 2.2);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
    },
    exit(E) {
      E.layEgg();
    }
  };
  A.nest = {
    emotion: "calm",
    held: "none",
    enter(E) {
      E.say("Building. Do not judge the craftsmanship.");
      dur(E, 4, 6);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
      if (Math.random() < dt * 3) E.particles.dust(E.dino.centreX + rnd(-20, 20), E.dino.body.groundY + E.dino.h - 6, 2);
    },
    exit(E) {
      if (Math.random() < 0.6) E.layEgg();
    }
  };
  A.snack = {
    emotion: "happy",
    held: "knife",
    enter(E) {
      E.audio.play("chomp");
      E.say(pick(SPEECH.snack));
      E.bump("snacks");
      E.dino.rig.nodes.mouthOpen.style.display = "block";
      dur(E, 1.8, 2.6);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
      if (Math.random() < dt * 4) E.audio.play("chomp");
    },
    exit(E) {
      E.dino.rig.nodes.mouthOpen.style.display = "none";
    }
  };
  A.cardExit = {
    emotion: "smug",
    held: "none",
    enter(E) {
      E.actData.tx = E.dino.body.x < window.innerWidth / 2 ? -160 : window.innerWidth + 60;
      dur(E, 6, 6);
    },
    step(E, dt) {
      E.dino.body.driveToward(E.actData.tx, dt, 1);
      if (Math.abs(E.dino.body.x - E.actData.tx) < 40) enter(E, "cardReturn");
    }
  };
  A.cardReturn = {
    emotion: "happy",
    held: "sign",
    enter(E) {
      E.actData.tx = rnd(window.innerWidth * 0.22, window.innerWidth * 0.7);
      dur(E, 7, 7);
    },
    step(E, dt) {
      E.dino.body.driveToward(E.actData.tx, dt, 0.9);
      if (Math.abs(E.dino.body.x - E.actData.tx) < 24) {
        E.dealCard();
        E.say(pick(SPEECH.card));
        choose(E);
      }
    }
  };
  A.perch = {
    emotion: "smug",
    held: "none",
    enter(E) {
      const p = E.props.pickPerch();
      if (!p) return choose(E);
      E.actData.p = p;
      E.actData.landed = false;
      dur(E, 6, 10);
    },
    step(E, dt) {
      const p = E.actData.p;
      if (!p) return;
      const b = E.dino.body;
      if (!E.actData.landed) {
        b.driveToward(p.cx - E.dino.w * 0.5, dt, 0.9);
        if (Math.abs(b.x + E.dino.w * 0.5 - p.cx) < 26) {
          b.groundY = p.y - E.dino.h + 8;
          if (b.y > b.groundY) {
            b.jump(Math.max(30, b.y - b.groundY + 24));
          } else {
            E.actData.landed = true;
            E.say(pick(SPEECH.perch));
          }
        }
      } else {
        b.halt(dt);
        b.groundY = p.y - E.dino.h + 8;
      }
    },
    exit(E) {
      E.dino.body.groundY = E.stage.groundY();
    }
  };
  A.steal = {
    emotion: "smug",
    held: "none",
    enter(E) {
      const img = E.props.pickImage();
      if (!img) return choose(E);
      E.actData.img = img;
      E.actData.got = false;
      dur(E, 8, 11);
    },
    step(E, dt) {
      const im = E.actData.img;
      const b = E.dino.body;
      if (!E.actData.got) {
        b.driveToward(im.cx - E.dino.w * 0.5, dt, 1);
        if (Math.abs(b.x + E.dino.w * 0.5 - im.cx) < 30) {
          E.actData.got = true;
          E.actData.el = cloneImage(im, E.stage.layer, Z.card);
          E.say(pick(SPEECH.steal));
          E.audio.play("chomp");
          E.bump("stolen");
          E.actData.tx = rnd(40, window.innerWidth - 180);
        }
      } else {
        b.driveToward(E.actData.tx, dt, 0.85);
        const el = E.actData.el;
        if (el) el.style.transform = `translate(${E.dino.headX - 30}px,${E.dino.headY + 6}px) rotate(${Math.sin(E.actT * 6) * 7}deg)`;
      }
    },
    exit(E) {
      const el = E.actData.el;
      if (el) {
        el.style.transition = "opacity .6s";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 700);
      }
    }
  };
  A.graffiti = {
    emotion: "happy",
    held: "crayon",
    enter(E) {
      E.say(pick(SPEECH.graffiti));
      E.actData.tx = rnd(60, window.innerWidth - 160);
      dur(E, 4, 7);
    },
    step(E, dt) {
      E.dino.body.driveToward(E.actData.tx, dt, 0.5);
    }
  };
  A.inspect = {
    emotion: "smug",
    held: "glass",
    enter(E) {
      const t = E.props.pickText();
      if (!t) return choose(E);
      E.actData.t = t;
      dur(E, 5, 8);
    },
    step(E, dt) {
      const t = E.actData.t;
      E.dino.body.driveToward(t.x - E.dino.w * 0.4, dt, 0.8);
      if (!E.actData.said && Math.abs(E.dino.centreX - t.x) < 60) {
        E.actData.said = true;
        E.say(pick(SPEECH.inspect));
        E.audio.play("blip");
      }
    }
  };
  A.fish = {
    emotion: "calm",
    held: "rod",
    enter(E) {
      E.say(pick(SPEECH.fish));
      E.unlock("face", "snorkel");
      dur(E, 6, 9);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
      if (!E.actData.bit && E.actT > 3.4) {
        E.actData.bit = true;
        E.audio.play("sparkle");
        E.dealCard();
        E.say("Got one!");
      }
    }
  };
  A.dance = {
    emotion: "happy",
    held: "boombox",
    enter(E) {
      E.say(pick(SPEECH.dance));
      dur(E, 6, 9);
      E.actData.beat = 0;
    },
    step(E, dt) {
      const b = E.dino.body;
      b.halt(dt);
      E.actData.beat += dt;
      if (E.actData.beat > 0.45) {
        E.actData.beat = 0;
        E.audio.play("beat");
        if (b.grounded) b.jump(E.dino.sp.hopHeight * 0.32);
        E.particles.notes(E.dino.headX + rnd(-14, 14), E.dino.headY - 12);
      }
    }
  };
  A.photo = {
    emotion: "happy",
    held: "camera",
    enter(E) {
      dur(E, 3.2, 4.4);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
      if (!E.actData.shot && E.actT > 1.4) {
        E.actData.shot = true;
        E.audio.play("shutter");
        E.say(pick(SPEECH.photo));
        if (!E.reduced) E.particles.sparkle(E.dino.headX + 24, E.dino.headY, "#ffffff");
        E.dealCard();
      }
    }
  };
  A.surf = {
    emotion: "scared",
    held: "none",
    enter(E) {
      E.say(pick(SPEECH.surf));
      E.dino.setOutfit({ back: "surfboard" });
      dur(E, 2.5, 3.5);
    },
    step(E, dt) {
      const b = E.dino.body;
      b.ax = clamp(E.scroll.vel * 40, -2600, 2600);
      if (b.grounded && Math.abs(E.scroll.vel) > 60) b.jump(28);
    },
    exit(E) {
      E.dino.setOutfit({ back: E.settings.outfit.back });
    }
  };
  A.panic = {
    emotion: "scared",
    held: "none",
    enter(E) {
      E.actData.tx = E.dino.body.x < window.innerWidth / 2 ? 30 : window.innerWidth - 150;
      dur(E, 3.5, 6);
    },
    step(E, dt) {
      const b = E.dino.body;
      b.driveToward(E.actData.tx, dt, 1.25);
      if (b.grounded && Math.random() < dt * 1.6) b.jump(E.dino.sp.hopHeight * 0.6);
    }
  };
  A.shelter = {
    emotion: "scared",
    held: "umbrella",
    enter(E) {
      E.say("Ash. Lovely.");
      dur(E, 4, 7);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
    }
  };
  A.douse = {
    emotion: "angry",
    held: "extinguisher",
    enter(E) {
      E.say("I have got this.");
      dur(E, 4, 6);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
      if (Math.random() < dt * 12) {
        E.particles.spawn({
          x: E.dino.headX + 20,
          y: E.dino.headY,
          vx: rnd(120, 260) * (E.dino.body.faceScale >= 0 ? 1 : -1),
          vy: rnd(-60, 40),
          life: rnd(0.4, 0.8),
          size: rnd(3, 7),
          g: 60,
          drag: 2.2,
          color: "rgba(240,244,248,0.75)"
        });
      }
    }
  };
  var PAGE_ACTS = ["perch", "steal", "graffiti", "inspect", "photo"];
  var TOY_ACTS = ["fish", "dance", "nest"];
  function choose(E) {
    const s = E.settings;
    const chaos = clamp(s.chaos, 0, 1);
    if (E.volcano && E.volcano.phase === "erupt") {
      return enter(E, Math.random() < 0.5 ? "shelter" : "douse");
    }
    if (Math.abs(E.scroll.vel) > 70 && !E.reduced) return enter(E, "surf");
    const r = Math.random();
    if (s.chase && E.mouse.seen && r < 0.18 + chaos * 0.1) return enter(E, "chase");
    if (s.cards && r < 0.3 && E.cards.length < 3) return enter(E, "cardExit");
    if (s.friends && r < 0.4) return enter(E, "egg");
    if (s.activities && E.props.any && r < 0.62) return enter(E, pick(PAGE_ACTS));
    if (s.activities && r < 0.7) return enter(E, pick(TOY_ACTS));
    if (r < 0.78) return enter(E, "snack");
    if (r < 0.86) return enter(E, "roar");
    if (r < 0.92 && !E.reduced) return enter(E, "sleep");
    return enter(E, "wander");
  }

  // src/engine.js
  var DEFAULTS = {
    species: "rex",
    outfit: { head: "none", face: "none", back: "none", held: "none" },
    sound: true,
    volume: 0.55,
    friends: true,
    cards: true,
    chase: true,
    activities: true,
    events: true,
    deck: "jokes",
    chaos: 0.5,
    calm: false,
    maxFriends: 3
  };
  var MAX_EGGS = 4;
  var MAX_CARDS = 3;
  var MAX_DECALS = 12;
  var Engine = class {
    constructor() {
      this.running = false;
      this.settings = JSON.parse(JSON.stringify(DEFAULTS));
      this.stats = {
        eggs: 0,
        cards: 0,
        bops: 0,
        meteors: 0,
        eruptions: 0,
        naps: 0,
        snacks: 0,
        surf: 0,
        hatched: 0,
        stolen: 0
      };
      this.unlocked = JSON.parse(JSON.stringify(STARTER));
      this.eggs = [];
      this.friends = [];
      this.cards = [];
      this.pteros = [];
      this.decals = [];
      this.prints = [];
      this.volcano = null;
      this.meteor = null;
      this.mouse = { x: 0, y: 0, seen: false };
      this.listeners = [];
      this.gates = {
        volcano: new EventGate(24e4),
        meteor: new EventGate(19e4),
        ptero: new EventGate(28e3)
      };
      this.lastBigEvent = null;
      this.origin = location.origin + location.pathname;
      this.scroll = { last: 0, vel: 0 };
    }
    /* ------------------------------------------------------------- mounting */
    mount() {
      this.host = document.createElement("div");
      this.host.id = "annoying-dino-host";
      this.host.style.cssText = `position:fixed;inset:0;z-index:${HOST_Z};pointer-events:none;border:0;margin:0;padding:0`;
      this.root = this.host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = CSS;
      this.root.appendChild(style);
      const canvasBack = document.createElement("canvas");
      canvasBack.className = "ad-canvas";
      canvasBack.style.zIndex = Z.particleBack;
      this.root.appendChild(canvasBack);
      const layer = document.createElement("div");
      layer.className = "ad-layer";
      this.root.appendChild(layer);
      (document.body || document.documentElement).appendChild(this.host);
      this.reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.particles = new Particles(canvasBack);
      this.audio = new AudioKit();
      this.props = new Props();
      const engine = this;
      this.stage = {
        layer,
        get particles() {
          return engine.particles;
        },
        get audio() {
          return engine.audio;
        },
        get tier() {
          return engine.loop ? engine.loop.tier : 2;
        },
        get reduced() {
          return engine.reduced;
        },
        vw: () => window.innerWidth,
        vh: () => window.innerHeight,
        groundY: () => window.innerHeight - 112,
        say: (poolName) => engine.say(pick(SPEECH[poolName] || SPEECH.idle))
      };
      this.dino = new Dino(this.stage, this.settings.species);
      this.dino.setOutfit(this.settings.outfit);
      this.dino.body.groundY = this.stage.groundY();
      this.dino.body.y = this.dino.body.groundY;
      this.dino.body.x = rnd(60, Math.max(160, window.innerWidth - 200));
      this.bubble = document.createElement("div");
      this.bubble.className = "ad-bubble";
      this.bubble.style.zIndex = Z.bubble;
      layer.appendChild(this.bubble);
      this.resize();
      this.bindEvents();
      this.newDecks();
      this.loop = new Loop({
        update: (dt) => this.update(dt),
        render: () => this.render(),
        onTierChange: (t) => {
          this.particles.setTier(t);
        }
      });
    }
    bindEvents() {
      const on = (t, ev, fn, o) => {
        t.addEventListener(ev, fn, o);
        this.listeners.push([t, ev, fn, o]);
      };
      on(this.dino.el, "click", (e) => this.onBop(e));
      on(document, "mousemove", (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.seen = true;
      }, { passive: true });
      on(document, "pointerdown", () => this.audio.unlock(), { passive: true });
      on(document, "keydown", () => this.audio.unlock());
      on(document, "visibilitychange", () => {
        if (document.hidden) this.audio.suspend();
        else this.audio.resume();
      });
      on(window, "resize", () => this.resize(), { passive: true });
      on(window, "scroll", () => {
        const y = window.scrollY || 0;
        this.scroll.vel = y - this.scroll.last;
        this.scroll.last = y;
      }, { passive: true });
      if (this.reducedQuery && this.reducedQuery.addEventListener) {
        on(this.reducedQuery, "change", () => {
        });
      }
    }
    get reduced() {
      return this.settings.calm || (this.reducedQuery ? this.reducedQuery.matches : false);
    }
    resize() {
      this.particles.resize(window.innerWidth, window.innerHeight);
      const g = this.stage.groundY();
      this.dino.body.groundY = g;
      for (const f of this.friends) f.body.groundY = g + 18;
    }
    /* ------------------------------------------------------------ persistence */
    async load() {
      try {
        const sync = await chrome.storage.sync.get(DEFAULTS);
        this.settings = { ...DEFAULTS, ...sync, outfit: { ...DEFAULTS.outfit, ...sync.outfit || {} } };
      } catch (_) {
      }
      try {
        const key = "dino:" + this.origin;
        const local = await chrome.storage.local.get([key, "dino:stats", "dino:unlocked", "dino:deck"]);
        const site = local[key];
        if (site && Array.isArray(site.eggs)) this.pendingEggs = site.eggs;
        if (local["dino:stats"]) this.stats = { ...this.stats, ...local["dino:stats"] };
        if (local["dino:unlocked"]) this.unlocked = { ...this.unlocked, ...local["dino:unlocked"] };
        this.deckState = local["dino:deck"] || null;
      } catch (_) {
      }
    }
    saveSoon() {
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => this.save(), 900);
    }
    async save() {
      try {
        const key = "dino:" + this.origin;
        await chrome.storage.local.set({
          [key]: { eggs: this.eggs.filter((e) => !e.dead).map((e) => e.serialize()), at: Date.now() },
          "dino:stats": this.stats,
          "dino:unlocked": this.unlocked,
          "dino:deck": { jokes: this.jokeBag.state(), facts: this.factBag.state() }
        });
      } catch (_) {
      }
    }
    newDecks() {
      const d = this.deckState || {};
      this.jokeBag = new ShuffleBag(JOKES, d.jokes);
      this.factBag = new ShuffleBag(FACTS, d.facts);
    }
    restoreEggs() {
      if (!this.pendingEggs) return;
      for (const s of this.pendingEggs.slice(0, MAX_EGGS)) {
        const e = new Egg(
          this.stage,
          clamp(s.x, 10, window.innerWidth - 40),
          clamp(s.y, 10, window.innerHeight - 60),
          s.type
        );
        e.t = s.t || 0;
        e.hatchAt = s.hatchAt || 12;
        e.species = s.species || rollSpecies();
        e.onBurst = (egg) => this.onEggBurst(egg);
        this.eggs.push(e);
      }
      this.pendingEggs = null;
    }
    /* ---------------------------------------------------------------- speech */
    say(text, ms) {
      if (!this.bubble) return;
      this.bubble.textContent = text;
      this.bubble.classList.remove("on");
      void this.bubble.offsetWidth;
      this.bubble.classList.add("on");
      clearTimeout(this._bubbleT);
      this._bubbleT = setTimeout(() => this.bubble.classList.remove("on"), ms || 2400);
      this.positionBubble();
    }
    positionBubble() {
      if (!this.bubble.classList.contains("on")) return;
      const d = this.dino;
      const x = clamp(d.headX - 24, 6, window.innerWidth - 244);
      const y = clamp(d.headY - 54, 6, window.innerHeight - 60);
      this.bubble.style.transform = `translate(${x}px,${y}px)`;
    }
    /* ----------------------------------------------------------------- cards */
    dealCard() {
      if (this.cards.length >= MAX_CARDS) return;
      const useFacts = this.settings.deck === "facts";
      const [setup, punch] = useFacts ? this.factBag.next() : this.jokeBag.next();
      const style = pick(CARD_STYLES);
      const card = document.createElement("div");
      card.className = "ad-card " + style;
      card.style.zIndex = Z.card;
      const inner = document.createElement("div");
      inner.className = "ad-card-in";
      inner.innerHTML = '<span class="ad-x" title="Close">\u2715</span><b></b><div class="ad-punch"><span class="ad-tap">tap to reveal</span></div>';
      inner.querySelector("b").textContent = setup;
      card.appendChild(inner);
      const x = clamp(this.dino.centreX + rnd(-40, 80), 10, window.innerWidth - 216);
      const y = clamp(this.dino.body.y - 40, 10, window.innerHeight - 140);
      let rot = rnd(-7, 7);
      card.style.transform = `translate(${x}px,${y - 26}px) rotate(${rot * 2.2}deg)`;
      this.stage.layer.appendChild(card);
      requestAnimationFrame(() => {
        card.classList.add("settling");
        card.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`;
      });
      const punchEl = inner.querySelector(".ad-punch");
      let revealed = false;
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        punchEl.textContent = punch;
        this.audio.play("blip");
        this.bump("cards");
      };
      punchEl.addEventListener("click", reveal);
      card.addEventListener("dblclick", reveal);
      inner.querySelector(".ad-x").addEventListener("click", (e) => {
        e.stopPropagation();
        card.remove();
        this.cards = this.cards.filter((c) => c.el !== card);
      });
      let drag = null;
      card.addEventListener("pointerdown", (e) => {
        if (e.target.classList.contains("ad-x")) return;
        card.classList.remove("settling");
        drag = { dx: e.clientX - x, dy: e.clientY - y, px: e.clientX, py: e.clientY, vx: 0, vy: 0 };
        card.setPointerCapture(e.pointerId);
      });
      card.addEventListener("pointermove", (e) => {
        if (!drag) return;
        drag.vx = e.clientX - drag.px;
        drag.vy = e.clientY - drag.py;
        drag.px = e.clientX;
        drag.py = e.clientY;
        const nx = e.clientX - drag.dx, ny = e.clientY - drag.dy;
        rot = clamp(drag.vx * 0.8, -14, 14);
        card.style.transform = `translate(${nx}px,${ny}px) rotate(${rot}deg)`;
      });
      card.addEventListener("pointerup", (e) => {
        if (!drag) return;
        const nx = clamp(e.clientX - drag.dx + drag.vx * 6, 4, window.innerWidth - 216);
        const ny = clamp(e.clientY - drag.dy + drag.vy * 6, 4, window.innerHeight - 60);
        card.classList.add("settling");
        card.style.transform = `translate(${nx}px,${ny}px) rotate(${rnd(-6, 6)}deg)`;
        drag = null;
      });
      this.cards.push({ el: card });
      this.audio.play("sparkle");
    }
    /* ----------------------------------------------------------------- decals */
    addDecal(el) {
      this.decals.push(el);
      while (this.decals.length > MAX_DECALS) {
        const old = this.decals.shift();
        old.style.opacity = "0";
        setTimeout(() => old.remove(), 1300);
      }
    }
    /* ----------------------------------------------------------------- events */
    fireVolcano() {
      if (this.volcano || !this.settings.events) return;
      this.bump("eruptions");
      this.volcano = new Volcano(this.stage);
      this.volcano.onEnd = () => {
        this.volcano = null;
      };
      this.gates.volcano.fire(performance.now());
      this.lastBigEvent = "volcano";
      enter(this, "panic");
    }
    fireMeteor(extinction) {
      if (this.meteor || !this.settings.events) return;
      this.bump("meteors");
      const m = new Meteor(this.stage, { extinction });
      m.onCrater = (el) => this.addDecal(el);
      m.onDone = () => {
        this.meteor = null;
        this.say(pick(SPEECH.meteorAfter));
        if (extinction) this.extinctionGag();
      };
      this.meteor = m;
      this.gates.meteor.fire(performance.now());
      this.lastBigEvent = "meteor";
      enter(this, "panic");
      this.say(pick(SPEECH.meteorSpot));
      this.unlock("head", "propeller");
    }
    extinctionGag() {
      if (this.reduced) return;
      const veil = document.createElement("div");
      veil.className = "ad-sepia";
      veil.style.zIndex = Z.flash;
      this.stage.layer.appendChild(veil);
      requestAnimationFrame(() => veil.classList.add("on"));
      this.dino.el.style.filter = "grayscale(1) contrast(1.3) brightness(1.15)";
      setTimeout(() => {
        veil.classList.remove("on");
        this.dino.el.style.filter = "";
        setTimeout(() => veil.remove(), 700);
        this.say("\u2026anyway.");
      }, 2100);
    }
    spawnPtero(behaviour) {
      if (this.pteros.length >= 2 || !this.settings.friends) return;
      const b = behaviour || pick(PTERO_BEHAVIOURS);
      const p = new Ptero(this.stage, b);
      p.onGrab = (pt) => this.pteroGrab(pt);
      p.onDrop = (pt) => this.pteroDrop(pt);
      p.onExit = () => {
        this.pteros = this.pteros.filter((x) => x !== p);
      };
      this.pteros.push(p);
      this.gates.ptero.fire(performance.now());
    }
    pteroGrab(pt) {
      if (this.settings.outfit.head !== "none") {
        const taken = this.settings.outfit.head;
        this.setOutfit({ head: "none" });
        this.say(pick(SPEECH.ptero));
        this.unlock("head", "bandana");
        setTimeout(() => {
          this.setOutfit({ head: taken });
          this.say("Got it back.");
        }, 12e3);
        this.bump("stolen");
        return;
      }
      if (this.cards.length) {
        const c = this.cards.pop();
        c.el.remove();
        this.say(pick(SPEECH.ptero));
        return;
      }
      const live = this.eggs.filter((e) => !e.dead);
      if (live.length) {
        live[0].remove();
        this.say("MY EGG.");
      }
    }
    pteroDrop(pt) {
      this.dealCard();
      this.audio.play("squawk");
    }
    /* ----------------------------------------------------------------- eggs */
    layEgg() {
      if (this.eggs.filter((e2) => !e2.dead).length >= MAX_EGGS) return;
      const e = new Egg(this.stage, this.dino.centreX - 15, this.dino.body.groundY + 44);
      e.onBurst = (egg) => this.onEggBurst(egg);
      this.eggs.push(e);
      this.audio.play("crack");
      this.bump("eggs");
      this.saveSoon();
    }
    onEggBurst(egg) {
      this.eggs = this.eggs.filter((e) => e !== egg);
      const out = eggOutcome(egg);
      this.bump("hatched");
      if (out.kind === "fossil") {
        this.say(pick(SPEECH.hatchDud));
        this.unlock("face", "googly");
        const f2 = document.createElement("div");
        f2.className = "ad-fossil";
        f2.style.zIndex = Z.decal;
        f2.innerHTML = '<svg viewBox="-16 -16 32 32" width="34" height="34"><circle cx="0" cy="0" r="13" fill="#eae5d5" stroke="#c8c2ae" stroke-width="2"/><path d="M-6 5 Q-2 -6 6 -5 M-2 6 L-4 9 M2 6 L1 10" stroke="#8e8877" stroke-width="2" fill="none"/></svg>';
        f2.style.transform = `translate(${egg.x}px,${egg.y}px)`;
        this.stage.layer.appendChild(f2);
        this.addDecal(f2);
        return;
      }
      if (out.kind === "unlock") {
        this.say(pick(SPEECH.hatchRare));
        this.unlock("head", "wizard");
        this.particles.confetti(egg.x + 15, egg.y + 10, 26);
        return;
      }
      if (!this.settings.friends || this.friends.length >= this.settings.maxFriends) {
        this.say(pick(SPEECH.hatchDud));
        return;
      }
      this.audio.play("hatch");
      const f = new Dino(this.stage, out.species, { baby: true, fiery: !!out.fiery });
      f.body.groundY = this.stage.groundY() + 18;
      f.body.y = f.body.groundY;
      f.body.x = egg.x;
      this.friends.push(f);
      this.say(pick(out.rare ? SPEECH.hatchRare : SPEECH.hatchGood));
      if (out.rare) this.unlock("head", "viking");
      if (out.fiery) this.unlock("back", "wings");
      if (this.stats.hatched >= 5) this.unlock("head", "eggshell");
    }
    /* --------------------------------------------------------------- unlocks */
    bump(stat, n) {
      this.stats[stat] = (this.stats[stat] || 0) + (n || 1);
      const s = this.stats;
      if (s.snacks >= 10) this.unlock("held", "knife") && this.unlock("head", "chef");
      if (s.cards >= 20) this.unlock("face", "monocle");
      if (s.bops >= 25) this.unlock("face", "eyepatch");
      if (s.cards >= 10) this.unlock("back", "backpack");
      if (s.naps >= 10) this.unlock("back", "shell");
      if (s.surf >= 1e3) this.unlock("back", "surfboard");
      if (s.eruptions >= 1) this.unlock("back", "jetpack");
      this.saveSoon();
    }
    unlock(slot, item) {
      if (!CATALOG[slot] || !CATALOG[slot].includes(item)) return false;
      if (!this.unlocked[slot]) this.unlocked[slot] = [];
      if (this.unlocked[slot].includes(item)) return false;
      this.unlocked[slot].push(item);
      this.say(`Unlocked: ${item} \u2014 ${UNLOCK_HINTS[item] || "nice."}`, 3400);
      this.audio.play("sparkle");
      this.particles.sparkle(this.dino.headX, this.dino.headY, "#ffe285");
      this.saveSoon();
      return true;
    }
    setOutfit(partial) {
      this.settings.outfit = { ...this.settings.outfit, ...partial };
      this.dino.setOutfit(this.settings.outfit);
      try {
        chrome.storage.sync.set({ outfit: this.settings.outfit });
      } catch (_) {
      }
    }
    /* ------------------------------------------------------------------ bop */
    onBop(e) {
      e.stopPropagation();
      this.audio.unlock();
      this.audio.play("bop");
      this.bump("bops");
      this.dino.body.jump(this.dino.sp.hopHeight * 0.45);
      this.dino.body.landImpact = 0.9;
      this.dino.setEmotion("angry");
      setTimeout(() => this.dino.setEmotion("calm"), 1200);
      this.particles.sparkle(this.dino.headX, this.dino.headY, "#ffd7a1");
      this.say(pick(SPEECH.bop));
    }
    /* --------------------------------------------------------------- friends */
    updateFriends(dt) {
      let leadX = this.dino.centreX;
      for (const f of this.friends) {
        const gap = 62;
        const want = leadX - gap * (this.dino.body.faceScale >= 0 ? 1 : -1);
        f.body.driveToward(want - f.w * 0.5, dt, 0.9);
        f.update(dt, null);
        if (f.fiery && this.loop.tier === 2 && Math.random() < 0.25) {
          this.particles.embers(f.centreX, f.body.y + f.h * 0.7, 1);
        }
        leadX = f.centreX;
      }
    }
    /* --------------------------------------------------------------- the frame */
    update(dt) {
      const now = performance.now();
      this.dino.body.groundY = this.stage.groundY();
      step(this, dt);
      this.updateFriends(dt);
      for (const e of this.eggs) e.step(dt);
      this.eggs = this.eggs.filter((e) => !e.dead);
      const ctx = {
        target: { x: this.dino.centreX, y: this.dino.headY },
        perch: this.settings.activities ? this.props.pickPerch() : null
      };
      for (const p of this.pteros) p.step(dt, ctx);
      this.pteros = this.pteros.filter((p) => !p.dead);
      if (this.volcano) this.volcano.step(dt);
      if (this.meteor) this.meteor.step(dt);
      this.particles.step(dt);
      if (Math.abs(this.scroll.vel) > 24) {
        this.bump("surf", Math.min(60, Math.abs(this.scroll.vel) | 0));
        this.scroll.vel *= 0.6;
      }
      if (this.settings.events && !this.reducedBlocksEvents()) {
        const chaos = 0.35 + this.settings.chaos * 1.3;
        if (!this.volcano && this.lastBigEvent !== "volcano" && this.gates.volcano.ready(now) && Math.random() < 16e-5 * chaos) this.fireVolcano();
        if (!this.meteor && this.lastBigEvent !== "meteor" && this.gates.meteor.ready(now) && Math.random() < 18e-5 * chaos) {
          this.fireMeteor(Math.random() < 0.06);
        }
        if (this.gates.ptero.ready(now) && Math.random() < 12e-4 * chaos) this.spawnPtero();
      }
    }
    reducedBlocksEvents() {
      return false;
    }
    // reduced-motion changes HOW, not WHETHER
    render() {
      this.dino.render();
      for (const f of this.friends) f.render();
      this.particles.draw();
      this.positionBubble();
    }
    /* ------------------------------------------------------------- lifecycle */
    async start(settings) {
      if (settings) this.applySettings(settings, true);
      if (this.running) return;
      if (!this.host) this.mount();
      await this.load();
      this.newDecks();
      this.dino.setOutfit(this.settings.outfit);
      this.audio.enabled = this.settings.sound;
      this.audio.setVolume(this.settings.volume);
      this.restoreEggs();
      this.running = true;
      enter(this, "wander");
      this.loop.start();
      this.say(pick(SPEECH.idle));
    }
    stop() {
      this.running = false;
      if (this.loop) this.loop.stop();
      clearTimeout(this._bubbleT);
      clearTimeout(this._saveT);
      this.save();
      for (const [t, ev, fn, o] of this.listeners.splice(0)) t.removeEventListener(ev, fn, o);
      for (const p of this.pteros) p.remove();
      for (const e of this.eggs) e.remove();
      if (this.volcano) this.volcano.remove();
      if (this.meteor) this.meteor.remove();
      if (this.particles) this.particles.clear();
      if (this.audio) this.audio.close();
      if (this.host) this.host.remove();
      this.host = null;
      this.root = null;
      this.stage = null;
      this.eggs = [];
      this.friends = [];
      this.cards = [];
      this.pteros = [];
      this.decals = [];
      this.volcano = null;
      this.meteor = null;
    }
    applySettings(s, initial) {
      const prevSpecies = this.settings.species;
      this.settings = { ...this.settings, ...s, outfit: { ...this.settings.outfit, ...s.outfit || {} } };
      if (initial || !this.host) return;
      this.audio.enabled = this.settings.sound;
      this.audio.setVolume(this.settings.volume);
      if (!this.settings.sound) this.audio.suspend();
      else this.audio.resume();
      if (this.settings.species !== prevSpecies) this.swapSpecies(this.settings.species);
      else this.dino.setOutfit(this.settings.outfit);
      while (this.friends.length > this.settings.maxFriends) this.friends.pop().remove();
    }
    swapSpecies(id) {
      const b = this.dino.body;
      const x = b.x, facing = b.facing;
      this.particles.sparkle(this.dino.headX, this.dino.headY, "#cfe8ff");
      this.audio.play("sparkle");
      this.dino.remove();
      this.dino = new Dino(this.stage, id);
      this.dino.setOutfit(this.settings.outfit);
      this.dino.body.groundY = this.stage.groundY();
      this.dino.body.y = this.dino.body.groundY;
      this.dino.body.x = x;
      this.dino.body.facing = facing;
      this.dino.el.addEventListener("click", (e) => this.onBop(e));
      enter(this, "wander");
    }
    snapshot() {
      return {
        stats: this.stats,
        unlocked: this.unlocked,
        settings: this.settings,
        running: this.running,
        counts: {
          eggs: this.eggs.length,
          friends: this.friends.length,
          cards: this.cards.length,
          pteros: this.pteros.length,
          particles: this.particles ? this.particles.live.length : 0,
          decals: this.decals.length
        },
        tier: this.loop ? this.loop.tier : null,
        frameCost: this.loop ? Number(this.loop.cost.toFixed(3)) : null
      };
    }
  };

  // src/index.js
  if (!window.__annoyingDino) {
    const engine = new Engine();
    window.__annoyingDino = engine;
    const handle = (msg, _sender, sendResponse) => {
      if (!msg || typeof msg.type !== "string") return;
      switch (msg.type) {
        case "dino:start":
          engine.start(msg.settings);
          sendResponse({ ok: true });
          break;
        case "dino:stop":
          engine.stop();
          sendResponse({ ok: true });
          break;
        case "dino:settings":
          engine.applySettings(msg.settings);
          sendResponse({ ok: true });
          break;
        case "dino:event":
          if (msg.event === "volcano") engine.fireVolcano();
          else if (msg.event === "meteor") engine.fireMeteor(!!msg.extinction);
          else if (msg.event === "ptero") engine.spawnPtero(msg.behaviour);
          else if (msg.event === "egg") engine.layEgg();
          else if (msg.event === "card") engine.dealCard();
          sendResponse({ ok: true });
          break;
        case "dino:state":
          sendResponse(engine.snapshot());
          break;
        default:
          return;
      }
      return true;
    };
    try {
      chrome.runtime.onMessage.addListener(handle);
    } catch (_) {
    }
    engine.start().catch(() => {
    });
  }
})();
