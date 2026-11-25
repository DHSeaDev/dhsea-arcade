/* Annoying Dino v2.0 — page engine. Original art, sound, and text. #DHSeaDev
   Bundled from src/. Injected as a classic script; idempotent by guard. */
(() => {
  // src/art/styles.js
  var CSS = `
:host{all:initial}
/* clicking a character must never start a text selection or drop a text caret in the page underneath */
:host,.ad-layer,.ad-layer *{user-select:none;-webkit-user-select:none;-webkit-user-drag:none;caret-color:transparent;-webkit-tap-highlight-color:transparent}
.ad-dino,.ad-egg,.ad-ptero,.ad-fossil,.ad-toy{outline:none}
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

.ad-toy{position:fixed;left:0;top:0;pointer-events:auto;cursor:grab;touch-action:none;will-change:transform}
.ad-egg{position:fixed;left:0;top:0;pointer-events:auto;cursor:grab;will-change:transform}
.ad-ptero{position:fixed;left:0;top:0;pointer-events:none;will-change:transform}
.ad-volcano{position:fixed;left:0;top:0;pointer-events:none;will-change:transform}
.ad-meteor{position:fixed;left:0;top:0;pointer-events:none;will-change:transform}
.ad-stolen{position:fixed;left:0;top:0;pointer-events:none;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35));
  border-radius:6px;overflow:hidden;will-change:transform}
.ad-crater,.ad-graffiti,.ad-splat{position:fixed;left:0;top:0;pointer-events:none;
  transition:opacity 1.2s linear}
.ad-fossil{position:fixed;left:0;top:0;pointer-events:auto;cursor:grab;touch-action:none;
  transition:opacity 1.2s linear;will-change:transform}
.ad-fossil.held{cursor:grabbing}

.ad-ring{position:fixed;left:0;top:0;width:80px;height:26px;margin:-13px 0 0 -40px;
  border:3px solid rgba(255,220,150,.9);border-radius:50%;pointer-events:none;will-change:transform,opacity}
.ad-flash{position:fixed;inset:0;background:#fff6e0;opacity:0;pointer-events:none;transition:opacity .12s linear}
.ad-sepia{position:fixed;inset:0;pointer-events:none;background:rgba(120,92,52,.35);
  backdrop-filter:sepia(.9) contrast(.92);opacity:0;transition:opacity .5s ease}
.ad-sepia.on{opacity:1}

.ad-smoke{position:fixed;inset:0;pointer-events:none;overflow:hidden}
.ad-haze{position:absolute;inset:0;opacity:0;will-change:opacity}
.ad-puff{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;will-change:transform,opacity;
  background:radial-gradient(circle at 42% 42%,rgba(92,86,96,.5),rgba(78,72,82,.3) 38%,rgba(70,64,74,.12) 62%,rgba(70,64,74,0) 82%)}

.ad-leaf{position:fixed;left:0;top:0;pointer-events:none;will-change:transform,opacity}
.ad-dino.ad-star{filter:drop-shadow(0 0 7px rgba(255,226,133,.9))}

.ad-bubble{position:fixed;left:0;top:0;max-width:230px;background:#fffef2;color:#22301c;
  border:2px solid #2c7a38;border-radius:12px;padding:7px 11px;
  font:13px/1.36 "Segoe UI",system-ui,-apple-system,sans-serif;
  box-shadow:0 4px 12px rgba(0,0,0,.22);pointer-events:none;
  opacity:0;transform-origin:14px 100%;will-change:translate,transform,opacity}
.ad-bubble.on{opacity:1;animation:adPop .22s cubic-bezier(.2,1.5,.4,1)}
.ad-bubble::after{content:"";position:absolute;bottom:-8px;left:18px;border:8px solid transparent;
  border-top-color:#2c7a38;border-bottom:0}
.ad-bubble.below::after{bottom:auto;top:-8px;border-top-color:transparent;border-bottom:8px solid #2c7a38}
.ad-bubble.below{transform-origin:14px 0}
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
.ad-card b{display:block;margin-bottom:7px;font-weight:700;padding-right:20px}
.ad-card .ad-punch{color:#2c7a38;font-weight:700;min-height:1.4em}
.ad-card .ad-tap{color:#8a8a7a;font-style:italic;cursor:pointer}
.ad-card .ad-x{position:absolute;top:0;right:0;width:34px;height:34px;display:flex;align-items:center;
  justify-content:center;cursor:pointer;color:#c94f3d;font-weight:700;font-size:17px;line-height:1;
  border-radius:0 12px 0 12px;touch-action:manipulation}
.ad-card .ad-x:hover{background:rgba(201,79,61,.16)}
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
    smoke: 3,
    // volcano haze: over the page, under every character
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
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.c.width, this.c.height);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
          const maxW = window.innerWidth;
          const maxH = Math.max(240, window.innerHeight * 0.6);
          if (visible(r) && r.width <= maxW && r.height <= maxH && el.currentSrc) {
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
      hat: { x: 4.5, y: -14.67, s: 1 },
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
      hat: { x: 3.5, y: -10.5, s: 1.1 },
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
      hat: { x: 3.5, y: -12.73, s: 0.95 },
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
      hat: { x: 2.5, y: -8.31, s: 1.3 },
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
      hat: { x: 2.5, y: -12.47, s: 1.05 },
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
    armFar: { x: 86, y: 42 },
    // at the FRONT edge and drawn behind the torso: only the hand peeks out
    armNear: { x: 72, y: 44 },
    // at the torso's front edge, so a held tool reads
    tail: { x: 31, y: 56 }
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
    const W2 = (k) => 9.5 * (1 - 0.7 * (k / segs));
    let child = null;
    const list = [];
    for (let i = segs - 1; i >= 0; i--) {
      const a = W2(i), b = W2(i + 1), m = (a + b) / 2 * 1.04;
      const inner = svgEl("g", {
        class: `ad-tailseg ad-tail${i}`,
        style: "transform-box:view-box;transform-origin:0 0"
      }, [
        svgEl("path", {
          d: `M0 ${-a} Q${-len * 0.5} ${-m} ${-len} ${-b} L${-len} ${b} Q${-len * 0.5} ${m} 0 ${a}Z`,
          fill: tone.base
        }),
        svgEl("circle", { cx: -len, cy: 0, r: b, fill: tone.base })
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
      svgEl("g", { class: "ad-hat-slot", transform: `translate(${sp.hat.x},${sp.hat.y}) scale(${sp.hat.s})` })
    );
    return svgEl("g", { class: "ad-head", style: "transform-box:view-box;transform-origin:0 0" }, kids);
  }
  var RIG_SEQ = 0;
  function buildRig(speciesId, scale, opts) {
    const uid = "ad" + ++RIG_SEQ;
    const sp = speciesOf(speciesId);
    const tone = sp.tone;
    const o = opts || {};
    const W2 = 120, H2 = 100;
    const svg = svgEl("svg", {
      class: "ad-svg",
      viewBox: `0 0 ${W2} ${H2}`,
      width: W2 * scale,
      height: H2 * scale,
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
    const aNear = armParts({ shade: tone.light });
    const armNear = posed("ad-armNear", ANCHOR.armNear.x, ANCHOR.armNear.y);
    aNear.parts.forEach((n) => armNear.inner.appendChild(n));
    const packSlot = svgEl("g", { class: "ad-back-pack-slot" });
    const bodyG = pivot(svgEl("g", { class: "ad-body" }, [
      svgEl("path", { class: "ad-torso", d: sp.body, fill: tone.base }),
      svgEl("path", { class: "ad-torso-shade", d: sp.body, fill: `url(#${uid}Shade)` }),
      svgEl("ellipse", { class: "ad-belly", cx: sp.belly.cx, cy: sp.belly.cy, rx: sp.belly.rx, ry: sp.belly.ry, fill: tone.belly }),
      ...crest(sp.crest, tone),
      packSlot
      // worn ON the torso: paints after it, squashes with it
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
      [armFar.wrap, bodyG, neck.wrap]
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
      W: W2,
      H: H2,
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
        packSlot,
        flaps: [],
        jets: [],
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
    if (n.flaps.length) {
      const beat = p.air ? Math.sin(p.phase * 22) * 16 : Math.sin(p.phase * 2.4) * 3;
      for (const f of n.flaps) T(f, `rotate(${(beat + (p.tail[0] || 0) * 0.5).toFixed(2)}deg)`);
    }
    if (n.jets.length) {
      for (const j of n.jets) j.style.opacity = p.air ? String(0.75 + Math.sin(p.phase * 40) * 0.25) : "0";
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
      crestAmp: 0,
      air: false
    };
  }

  // src/art/paper.js
  /* Paper-craft skin, unlocked by summoning the dino on the carnival page. A treatment
     layer over the extension's own shapes: a cream cut-paper edge plus soft-light felt
     grain, in species units, so it follows every pose, species, outfit and held tool.
     Values are the carnival's (edge #FBF6E9, ~3.1 units reach, grain 96 px at .55). */
  /** @type {any} */
  var PAPER_SKIN = { edge: "#FBF6E9", blur: 2, slope: 40, reach: [-1.92, -1.6, -2.2], wob: [[0, 0], [0.35, -0.25], [-0.3, 0.3]], grainOpacity: 0.55, grainTile: 96, grainMinPx: 64, fps: 8 };
  var PAPER_HOST = "annoyingdino.dhseadev.online";
  var PAPER_GRAIN = "data:image/png;base64,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";
  var PAPER_SEQ = 0;
  var isPaperHost = (/** @type {any} */ h) => String(h || "").toLowerCase() === PAPER_HOST;
  /** @param {string} id @param {boolean} grain @returns {any} */
  function paperFilter(id, grain) {
    const f = svgEl("filter", { id, x: "-15%", y: "-15%", width: "130%", height: "130%", "color-interpolation-filters": "sRGB" });
    const fn = svgEl("feFuncA", { type: "linear", slope: PAPER_SKIN.slope, intercept: PAPER_SKIN.reach[0] });
    const off = svgEl("feOffset", { in: "m", dx: 0, dy: 0, result: "mo" });
    f.appendChild(svgEl("feGaussianBlur", { in: "SourceAlpha", stdDeviation: PAPER_SKIN.blur, result: "b" }));
    f.appendChild(svgEl("feComponentTransfer", { in: "b", result: "m" }, [fn]));
    f.appendChild(off);
    f.appendChild(svgEl("feFlood", { "flood-color": PAPER_SKIN.edge, result: "c" }));
    f.appendChild(svgEl("feComposite", { in: "c", in2: "mo", operator: "in", result: "edge" }));
    f.appendChild(svgEl("feMerge", { result: "card" }, [svgEl("feMergeNode", { in: "edge" }), svgEl("feMergeNode", { in: "SourceGraphic" })]));
    if (grain) {
      const t = PAPER_SKIN.grainTile, k = PAPER_SKIN.grainOpacity;
      f.appendChild(svgEl("feImage", { href: PAPER_GRAIN, x: 0, y: 0, width: t, height: t, preserveAspectRatio: "none", result: "g0" }));
      f.appendChild(svgEl("feTile", { in: "g0", result: "g1" }));
      f.appendChild(svgEl("feBlend", { in: "g1", in2: "card", mode: "soft-light", result: "gb" }));
      // clip the blended grain to the card BEFORE mixing, so edge pixels keep the card's alpha
      f.appendChild(svgEl("feComposite", { in: "gb", in2: "card", operator: "in", result: "gc" }));
      f.appendChild(svgEl("feComposite", { in: "gc", in2: "card", operator: "arithmetic", k1: 0, k2: k, k3: 1 - k, k4: 0 }));
    }
    return { f, fn, off };
  }
  /* Stitched details, drawn only where they can be seen (grain-size dinos): a dashed inset
     seam on the torso and head, a dashed ring plus two pouch lines on the belly, a dashed
     seam down the tail. They sit inside the posed groups, so they follow every pose. */
  /** @param {any} svg */
  function paperStitch(svg) {
    const num = (/** @type {any} */ el, /** @type {string} */ k) => Number(el && el.getAttribute(k)) || 0;
    const seam = (/** @type {string} */ d, /** @type {string} */ stroke, /** @type {any} */ extra) => svgEl("path", Object.assign({
      class: "ad-stitch", d, fill: "none", stroke, "stroke-width": 0.9, "stroke-dasharray": "2.2 2.6", "stroke-linecap": "round", opacity: 0.7
    }, extra || {}));
    const snout = svg.querySelector(".ad-snout");
    const ink = (snout && snout.getAttribute("fill")) || "#2f7c3c";
    const body = svg.querySelector(".ad-body");
    const torso = svg.querySelector(".ad-torso");
    const belly = svg.querySelector(".ad-belly");
    if (body && torso && belly) {
      const cx = num(belly, "cx"), cy = num(belly, "cy"), rx = num(belly, "rx"), ry = num(belly, "ry");
      const mid = `translate(${cx - 1} ${cy - 6}) scale(0.93) translate(${1 - cx} ${6 - cy})`;
      const parts = [
        seam(torso.getAttribute("d") || "", "#ffffff", { transform: mid, opacity: 0.55 }),
        svgEl("ellipse", { class: "ad-stitch", cx, cy, rx: rx - 2.8, ry: ry - 3, fill: "none", stroke: ink, "stroke-width": 0.9, "stroke-dasharray": "2 2.4", "stroke-linecap": "round", opacity: 0.7 }),
        svgEl("path", { class: "ad-stitch", d: `M${cx - rx * 0.5},${cy - 1} Q${cx},${cy + 3} ${cx + rx * 0.5},${cy - 1} M${cx - rx * 0.45},${cy + 6} Q${cx},${cy + 10} ${cx + rx * 0.45},${cy + 6}`, fill: "none", stroke: ink, "stroke-width": 1.1, "stroke-linecap": "round", opacity: 0.6 })
      ];
      let at = belly;
      for (const n of parts) {
        at.after(n);
        at = n;
      }
    }
    const skull = svg.querySelector(".ad-skull");
    if (skull) skull.after(seam(skull.getAttribute("d") || "", "#ffffff", { transform: "translate(2 0) scale(0.9) translate(-2 0)", opacity: 0.5 }));
    for (const seg of Array.from(svg.querySelectorAll(".ad-tailseg"))) {
      const dot = seg.querySelector("circle");
      const len = Math.abs(num(dot, "cx"));
      if (len) seg.appendChild(seam(`M0 0 L${-len} 0`, "#ffffff", { opacity: 0.45 }));
    }
  }
  /* skin: "none" | "paper". px = on-screen width of the rig; grain reads as noise when small. */
  /** @param {any} rig @param {string} skin @param {number} [px] @returns {boolean} */
  function applySkin(rig, skin, px) {
    const svg = rig.svg;
    const p = rig.paper;
    if (skin !== "paper") {
      if (!p) return false;
      for (const n of Array.from(svg.querySelectorAll(".ad-stitch"))) n.remove();
      while (p.wrap.firstChild) svg.insertBefore(p.wrap.firstChild, p.wrap);
      p.wrap.remove();
      p.f.remove();
      rig.paper = null;
      return false;
    }
    const grain = (px || 0) >= PAPER_SKIN.grainMinPx;
    if (p && p.grain === grain) return true;
    if (p) applySkin(rig, "none");
    const id = "adPaper" + ++PAPER_SEQ;
    const fx = paperFilter(id, grain);
    (svg.querySelector("defs") || svg.insertBefore(svgEl("defs"), svg.firstChild)).appendChild(fx.f);
    const wrap = svgEl("g", { class: "ad-paper", filter: `url(#${id})` });
    for (const n of Array.from(svg.childNodes)) if (n.nodeName !== "defs") wrap.appendChild(n);
    svg.appendChild(wrap);
    if (grain) paperStitch(svg);
    rig.paper = { wrap, f: fx.f, fn: fx.fn, off: fx.off, grain, step: 0, t: 0 };
    return true;
  }
  /* Stop-motion edge boil, stepped at PAPER_SKIN.fps; calm / reduced motion holds frame 0. */
  /** @param {any} rig @param {number} dt @param {boolean} reduced */
  function paperBoil(rig, dt, reduced) {
    const p = rig.paper;
    if (!p) return;
    p.t = reduced ? 0 : (p.t + dt) % (PAPER_SKIN.reach.length / PAPER_SKIN.fps);
    const s = reduced ? 0 : Math.floor(p.t * PAPER_SKIN.fps) % PAPER_SKIN.reach.length;
    if (s === p.step) return;
    p.step = s;
    p.fn.setAttribute("intercept", PAPER_SKIN.reach[s]);
    p.off.setAttribute("dx", PAPER_SKIN.wob[s][0]);
    p.off.setAttribute("dy", PAPER_SKIN.wob[s][1]);
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
    chef: '<path d="M-9 -6 Q-13 -16 -4 -15 Q0 -21 4 -15 Q13 -16 9 -6Z" fill="#fffdf8" stroke="#bdb59c" stroke-width="1.2" stroke-linejoin="round"/><path d="M-3 -8 Q-4 -13 -2 -15 M3 -8 Q4 -13 2 -15" stroke="#d6cfba" stroke-width="1" fill="none"/><rect x="-8" y="-6" width="16" height="7" rx="1.5" fill="#f7f5ee" stroke="#bdb59c" stroke-width="1.2"/>',
    wizard: '<path d="M0 -22 L-11 4 L11 4Z" fill="#4b4380"/><path d="M-11 4 Q0 8 11 4 Q0 0 -11 4Z" fill="#3a3466"/><circle cx="-3" cy="-6" r="1.4" fill="#ffe285"/><circle cx="3" cy="-1" r="1.1" fill="#ffe285"/><circle cx="1" cy="-12" r="1.1" fill="#ffe285"/>',
    propeller: '<path d="M-9 1 Q0 -10 9 1Z" fill="#c94f3d"/><rect x="-9" y="0" width="18" height="3" rx="1.5" fill="#4fbf62"/><rect x="-1" y="-14" width="2" height="5" fill="#8a9098"/><g class="ad-prop"><rect x="-9" y="-15.6" width="18" height="2.2" rx="1.1" fill="#7a6fb0"/></g>',
    eggshell: '<path d="M-10 2 Q-11 -12 0 -14 Q11 -12 10 2 L6 -1 L3 3 L0 -1 L-3 3 L-6 -1Z" fill="#f2ecd8" stroke="#cfc5a5" stroke-width="1.2"/>',
    bandana: '<path d="M-11 -3 Q0 -10 11 -3 Q0 0 -11 -3Z" fill="#c94f3d"/><path d="M9 -3 L16 2 L10 2Z" fill="#c94f3d"/>',
    // seasonal (halloween)
    // seasonal (thanksgiving): a buckled pilgrim hat
    pilgrim: '<path d="M-7 -17 L7 -17 L9 -2 L-9 -2Z" fill="#2f2a38"/><rect x="-14" y="-3" width="28" height="4" rx="2" fill="#2f2a38"/><rect x="-8.6" y="-8" width="17.2" height="3.6" fill="#15131a"/><rect x="-3" y="-8.6" width="6" height="4.8" rx="0.8" fill="none" stroke="#e8c235" stroke-width="1.5"/>',
    pumpkin: '<ellipse cx="-5" cy="-5" rx="6.5" ry="7" fill="#d9731f"/><ellipse cx="5" cy="-5" rx="6.5" ry="7" fill="#d9731f"/><ellipse cx="0" cy="-5" rx="6" ry="7.6" fill="#ec8a2a"/><path d="M0 -12.5 L0 1.6 M-5 -11.4 Q-8 -5 -5 1 M5 -11.4 Q8 -5 5 1" stroke="#b25a14" stroke-width="1" fill="none"/><path d="M0 -12.6 Q1 -17 4.4 -17.6" stroke="#4b7a2b" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
  };
  var FACE_ITEMS = {
    none: "",
    shades: '<rect x="-9" y="-5" width="8" height="6" rx="1.6" fill="#1c1c1c"/><rect x="1" y="-5" width="8" height="6" rx="1.6" fill="#1c1c1c"/><path d="M-1 -3 L1 -3" stroke="#1c1c1c" stroke-width="1.6"/><path d="M-9 -3 L-13 -4" stroke="#1c1c1c" stroke-width="1.4"/>',
    monocle: '<circle cx="6" cy="-3" r="5.4" fill="none" stroke="#e8c235" stroke-width="1.6"/><path d="M6 2.4 Q7 8 12 9" stroke="#e8c235" stroke-width="1.2" fill="none"/>',
    eyepatch: '<path d="M-11 -6 L11 -8" stroke="#1c1c1c" stroke-width="1.6"/><rect x="-9" y="-7" width="8" height="7" rx="1.4" fill="#1c1c1c"/>',
    googly: '<circle cx="-5" cy="-4" r="5" fill="#fff" stroke="#ccc"/><circle class="ad-googly" cx="-5" cy="-3" r="2.2" fill="#111"/><circle cx="6" cy="-4" r="5" fill="#fff" stroke="#ccc"/><circle class="ad-googly" cx="6" cy="-3" r="2.2" fill="#111"/>',
    snorkel: '<circle cx="0" cy="-3" r="8" fill="none" stroke="#4c9fbf" stroke-width="2"/><path d="M8 -6 L12 -14 L15 -14" stroke="#4c9fbf" stroke-width="2.2" fill="none"/>',
    // seasonal (halloween): eye holes are cut with evenodd so the real eyes show through
    mask: '<path fill-rule="evenodd" d="M-12 -7 Q-6 -11 0 -7 Q6 -11 12 -7 Q11 2 6 2.5 Q0 -1 -6 2.5 Q-11 2 -12 -7Z M-8.2 -3.4 a3.2 2.6 0 1 0 6.4 0 a3.2 2.6 0 1 0 -6.4 0Z M1.8 -3.4 a3.2 2.6 0 1 0 6.4 0 a3.2 2.6 0 1 0 -6.4 0Z" fill="#4b4380" stroke="#e8c235" stroke-width="1.2"/>',
    // seasonal (thanksgiving): turkey beak with a wattle
    wattle: '<path d="M8 0.4 L17 4 L8 7Z" fill="#e0932f"/><path d="M9 6.4 Q10 13 13.4 10.4 Q12.4 7.6 11 6.2Z" fill="#c94f3d"/>'
  };
  var BACK_ITEMS = {
    none: "",
    cape: '<path class="ad-cape" d="M62 22 Q30 34 16 86 Q48 94 80 84 Q72 46 74 22Z" fill="#c94f3d" opacity="0.95" style="transform-box:fill-box;transform-origin:80% 0%"/>',
    wings: '<path class="ad-wing" d="M48 28 Q16 16 6 40 Q26 46 46 40Z" fill="#f7f5ee" opacity="0.92" style="transform-box:fill-box;transform-origin:100% 50%"/><path d="M50 34 Q22 26 12 46 Q30 50 48 44Z" fill="#e6e2d4" opacity="0.9"/>',
    surfboard: '<g transform="rotate(-13 20 47)"><rect x="14" y="10" width="11" height="70" rx="5.5" fill="#4c9fbf"/><rect x="17.5" y="20" width="4" height="46" rx="2" fill="#fffdf8"/></g>',
    // worn ON the torso (layer "pack"): painted after it, so they are actually visible
    jetpack: '<rect x="13" y="34" width="12" height="30" rx="5.5" fill="#8a9098"/><rect x="24" y="36" width="12" height="28" rx="5.5" fill="#a9afb6"/><rect x="15" y="30" width="8" height="6" rx="3" fill="#c94f3d"/><rect x="26" y="32" width="8" height="6" rx="3" fill="#c94f3d"/><path d="M15 64 L23 64 L21.5 69 L16.5 69Z M26 64 L34 64 L32.5 69 L27.5 69Z" fill="#5d6269"/><path class="ad-jet" d="M16 69 Q19 82 22 69Z M27 69 Q30 82 33 69Z" fill="#ffc247" opacity="0"/><path d="M25 42 Q31 46 31 54" stroke="#5d3a17" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    backpack: '<rect x="11" y="36" width="20" height="26" rx="6" fill="#8a5a2b"/><rect x="15" y="43" width="12" height="9" rx="2.5" fill="#b0783f"/><path d="M26 38 Q36 46 34 58" stroke="#5d3a17" stroke-width="3" fill="none" stroke-linecap="round"/>',
    shell: '<ellipse cx="30" cy="46" rx="17" ry="21" fill="#8a5a2b"/><ellipse cx="30" cy="46" rx="11" ry="15" fill="#b0783f"/><path d="M30 31 L30 61 M19 46 L41 46" stroke="#8a5a2b" stroke-width="1.6"/>',
    // seasonal (halloween)
    batwings: '<path class="ad-wing" d="M54 34 Q30 -8 -4 8 Q6 14 8 24 Q15 18 20 30 Q28 24 52 44Z" fill="#3a2f55" opacity="0.96" style="transform-box:fill-box;transform-origin:100% 50%"/><path d="M52 36 Q26 8 6 20" stroke="#2a2140" stroke-width="1.4" fill="none"/>',
    // seasonal (thanksgiving): a fan of turkey feathers
    turkeytail: '<g transform="translate(34 54)">' + [[-78, "#8a4b1f"], [-54, "#c9702a"], [-30, "#e8a22f"], [-6, "#c94f3d"], [18, "#8a4b1f"]].map(([a, c]) => `<g transform="rotate(${a})"><ellipse cx="0" cy="-24" rx="6.4" ry="22" fill="${c}"/><ellipse cx="0" cy="-26" rx="2.6" ry="14" fill="#f2ecd8" opacity="0.55"/></g>`).join("") + "</g>"
  };
  var BACK_LAYER = { cape: "behind", wings: "behind", surfboard: "behind", batwings: "behind", turkeytail: "behind", jetpack: "pack", backpack: "pack", shell: "pack" };
  var HEAD_BASE = {
    party: 12,
    top: -1,
    cowboy: 3,
    crown: 2,
    horns: 0,
    viking: 3,
    chef: 1,
    wizard: 6,
    propeller: 3,
    eggshell: 3,
    bandana: 2,
    pumpkin: 2.6,
    pilgrim: 1
  };
  var HEAD_SINK = { bandana: 3, eggshell: 2.5, horns: 1 };
  var DEFAULT_SINK = 1.5;
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
    bucket: { svg: '<g transform="scale(1.3)"><path d="M-2 -8 L16 -8 L13 9 L1 9Z" fill="#ec8a2a" stroke="#a85a1a" stroke-width="1.4" stroke-linejoin="round"/><path d="M0 -8 Q7 -22 14 -8" stroke="#5d3a17" stroke-width="1.6" fill="none"/><path d="M3 -2 L5 0 L7 -2 M9 -2 L11 0 L13 -2 M4 4 Q8 7 12 4" stroke="#4b2a0e" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>', label: "treat bucket" },
    drumstick: { svg: '<rect x="0" y="-1.6" width="14" height="3.2" rx="1.6" fill="#f2ecd8"/><circle cx="0.6" cy="-2" r="2.4" fill="#f2ecd8"/><circle cx="0.6" cy="2" r="2.4" fill="#f2ecd8"/><ellipse cx="22" cy="0" rx="10" ry="7.6" fill="#b0682a"/><path d="M16 -3 Q22 -6 28 -2" stroke="#d99a55" stroke-width="1.6" fill="none" stroke-linecap="round"/>', label: "drumstick" },
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
  var UNLOCK_RULES = {
    // events
    viking: { slot: "head", hint: "hatch a speckled egg" },
    wizard: { slot: "head", hint: "hatch a golden egg" },
    propeller: { slot: "head", hint: "survive a meteor" },
    bandana: { slot: "head", hint: "let a pterodactyl steal your hat" },
    googly: { slot: "face", hint: "hatch a fossil egg" },
    snorkel: { slot: "face", hint: "go fishing" },
    wings: { slot: "back", hint: "hatch a volcanic egg" },
    // counters
    eggshell: { slot: "head", stat: "hatched", n: 5, hint: "hatch 5 eggs" },
    chef: { slot: "head", stat: "snacks", n: 10, hint: "watch the dino snack 10 times" },
    monocle: { slot: "face", stat: "cards", n: 20, hint: "read 20 joke cards" },
    eyepatch: { slot: "face", stat: "bops", n: 25, hint: "bonk the dino 25 times" },
    backpack: { slot: "back", stat: "cards", n: 10, hint: "read 10 joke cards" },
    shell: { slot: "back", stat: "naps", n: 10, hint: "let the dino nap 10 times" },
    surfboard: { slot: "back", stat: "surf", n: 1e3, hint: "scroll-surf 1000px" },
    jetpack: { slot: "back", stat: "eruptions", n: 1, hint: "survive an eruption" },
    knife: { slot: "held", stat: "snacks", n: 10, hint: "watch the dino snack 10 times" },
    crayon: { slot: "held", stat: "doodles", n: 5, hint: "let the dino doodle 5 times" },
    rod: { slot: "held", stat: "fish", n: 3, hint: "go fishing 3 times" },
    glass: { slot: "held", stat: "inspects", n: 5, hint: "let the dino inspect the page 5 times" },
    hammer: { slot: "held", stat: "bops", n: 15, hint: "bonk the dino 15 times" },
    broom: { slot: "held", stat: "eruptions", n: 2, hint: "survive 2 eruptions" },
    umbrella: { slot: "held", stat: "shelters", n: 1, hint: "shelter from an eruption" },
    extinguisher: { slot: "held", stat: "douses", n: 1, hint: "put out an eruption" },
    boombox: { slot: "held", stat: "dances", n: 3, hint: "let the dino dance 3 times" },
    sign: { slot: "held", stat: "deliveries", n: 5, hint: "deliver 5 cards" },
    camera: { slot: "held", stat: "photos", n: 3, hint: "let the dino take 3 photos" },
    // seasonal: granted by the engine while the season's date window is open, then kept
    pumpkin: { slot: "head", season: "halloween", hint: "visit between Oct 1 and Nov 2" },
    mask: { slot: "face", season: "halloween", hint: "visit between Oct 1 and Nov 2" },
    batwings: { slot: "back", season: "halloween", hint: "visit between Oct 1 and Nov 2" },
    bucket: { slot: "held", season: "halloween", hint: "visit between Oct 1 and Nov 2" },
    pilgrim: { slot: "head", season: "thanksgiving", hint: "visit between Nov 3 and Nov 30" },
    wattle: { slot: "face", season: "thanksgiving", hint: "visit between Nov 3 and Nov 30" },
    turkeytail: { slot: "back", season: "thanksgiving", hint: "visit between Nov 3 and Nov 30" },
    drumstick: { slot: "held", season: "thanksgiving", hint: "visit between Nov 3 and Nov 30" }
  };
  var UNLOCK_HINTS = Object.fromEntries(Object.entries(UNLOCK_RULES).map(([k, v]) => [k, v.hint]));
  function applyOutfit(rig, outfit) {
    const n = rig.nodes;
    if (n.hatSlot) {
      const art = HEAD_ITEMS[outfit.head] || "";
      const hat = rig.species.hat;
      const room = Math.min(...rig.species.eyes.map((e) => e.y - 5.6)) - hat.y;
      const sink = Math.max(0, Math.min(HEAD_SINK[outfit.head] ?? DEFAULT_SINK, room - 0.2));
      const dy = sink / hat.s - (HEAD_BASE[outfit.head] || 0);
      n.hatSlot.innerHTML = art ? `<g transform="translate(0,${dy})">${art}</g>` : "";
    }
    if (n.faceSlot) n.faceSlot.innerHTML = FACE_ITEMS[outfit.face] || "";
    const back = BACK_ITEMS[outfit.back] || "";
    const layer = BACK_LAYER[outfit.back] || "behind";
    if (n.backSlot) n.backSlot.innerHTML = layer === "behind" ? back : "";
    if (n.packSlot) n.packSlot.innerHTML = layer === "pack" ? back : "";
    const live = layer === "pack" ? n.packSlot : n.backSlot;
    if (n.flaps) {
      n.flaps = live ? Array.from(live.querySelectorAll(".ad-cape,.ad-wing")) : [];
      n.jets = live ? Array.from(live.querySelectorAll(".ad-jet")) : [];
    }
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
      this.pinned = false;
      this.flying = false;
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
      if (this.pinned) {
        this.vy = 0;
        this.grounded = false;
        this.faceScale += (this.facing - this.faceScale) * clamp(dt * 14, 0, 1);
        if (Math.abs(this.faceScale) < 0.02) this.faceScale = 0.02 * (this.facing || 1);
        this.landImpact = Math.max(0, this.landImpact - dt * 4.5);
        return;
      }
      const lim = this.flying ? 4e3 : this.maxSpeed * 2;
      this.vx = clamp(this.vx + this.ax * dt, -lim, lim);
      if (this.ax === 0 && !this.flying) this.vx = approachZero(this.vx, this.friction * dt);
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
      if (ctx.carried && !reduced) {
        const f = this.idlePhase * 17;
        pose.legNear = Math.sin(f) * 34;
        pose.legFar = Math.sin(f + Math.PI) * 34;
        pose.armNear = -70 + Math.sin(f * 1.3) * 22;
        pose.armFar = -60 + Math.sin(f * 1.3 + 1) * 22;
        pose.squashX = 0.94;
        pose.squashY = 1.06;
        pose.bob = 0;
      }
      pose.phase = this.idlePhase;
      pose.air = !b.grounded;
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
  var GLOWS = { fiery: "rgba(239,91,35,.85)", rare: "rgba(154,214,107,.9)", gold: "rgba(255,226,133,.95)" };
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
      this.glow = o.glow || (o.fiery ? "fiery" : null);
      this.skin = "none";
      this.setSkin(o.skin);
      const el = document.createElement("div");
      el.className = "ad-dino" + (this.baby ? " ad-friend" : "");
      el.style.zIndex = this.baby ? Z.friend : Z.dino;
      if (this.glow && GLOWS[this.glow]) el.style.filter = `drop-shadow(0 0 5px ${GLOWS[this.glow]})`;
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
    /* The head's real position. v2.0.0 used a fixed fraction of the sprite box, which
       is right for a rex and wrong for a brachio, whose head sits ~46 units above the
       box — so speech bubbles and the gaze pointed at empty air. The neck joint and
       length are in the rig, so derive it from them. */
    get headLocal() {
      const n = this.sp.neckLen;
      return { x: 76 + n * 0.34, y: 32 - n };
    }
    get headX() {
      const lx = this.headLocal.x;
      return this.body.x + this.scale * (this.body.faceScale >= 0 ? lx : this.rig.W - lx);
    }
    get headY() {
      return this.body.y + this.scale * this.headLocal.y;
    }
    setOutfit(outfit) {
      this.outfit = { ...this.outfit, ...outfit };
      this.holding = applyOutfit(this.rig, this.outfit);
    }
    /* On-screen width: the rig is built at `scale` and the element is scaled again. */
    /** @returns {number} */
    get paperPx() {
      return this.rig.W * this.scale * this.scale;
    }
    /** @param {any} skin */
    setSkin(skin) {
      this.skin = skin === "paper" ? "paper" : "none";
      applySkin(this.rig, this.skin, this.paperPx);
    }
    setEmotion(e) {
      this.anim.emotion = e;
    }
    /* What a hatchling needs to come back after a reload. */
    serialize() {
      return { species: this.sp.id, glow: this.glow };
    }
    update(dt, ctx) {
      this.body.step(dt);
      this.anim.update({
        body: this.body,
        dt,
        lookAt: ctx && ctx.lookAt,
        reduced: this.stage.reduced,
        holding: this.holding,
        carried: !!ctx && !!ctx.carried
      }, this.pose);
      poseRig(this.rig, this.pose);
      if (this.rig.paper) paperBoil(this.rig, dt, this.stage.reduced);
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
      this.held = false;
      this.vy = 0;
      this.hover = false;
      this.barGlow = 0;
      this.carriedBy = null;
      this.hold = false;
      this.homeX = x;
      this.homeY = y;
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
      this.barTrack = svgEl("rect", { x: -11, y: 17.4, width: 22, height: 2.2, rx: 1.1, fill: "rgba(0,0,0,0.35)", opacity: 0 });
      this.bar = svgEl("rect", { x: -11, y: 17.4, width: 0, height: 2.2, rx: 1.1, fill: this.def.glow || "#7fd18b", opacity: 0 });
      svg.appendChild(this.barTrack);
      svg.appendChild(this.bar);
      el.appendChild(svg);
      if (this.def.glow) {
        el.style.filter = `drop-shadow(0 0 6px ${this.def.glow})`;
      }
      el.addEventListener("mousedown", (e) => e.preventDefault());
      el.addEventListener("pointerdown", (e) => this.onPoke(e));
      el.addEventListener("pointerenter", () => {
        this.hover = true;
      });
      el.addEventListener("pointerleave", () => {
        this.hover = false;
      });
      this.el = el;
      stage.layer.appendChild(el);
      this.place();
    }
    place() {
      this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.tilt || 0}deg)`;
    }
    onPoke(e) {
      e.stopPropagation();
      if (this.carriedBy) return;
      this.taps++;
      this.hatchAt = Math.max(this.t + 0.35, this.hatchAt - 3.2);
      this.stage.audio.play("crack");
      this.stage.particles.dust(this.x + 15, this.y + 30, 4, "rgba(210,200,170,0.8)");
      this.pop = 1e-3;
      this.barGlow = 2;
      this.held = true;
      this.vy = 0;
      const start = { x: e.clientX - this.x, y: e.clientY - this.y };
      const move = (ev) => {
        this.x = ev.clientX - start.x;
        this.y = ev.clientY - start.y;
        this.place();
      };
      const up = () => {
        this.held = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
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
      if (!this.held && !this.carriedBy) {
        const rest = this.stage.groundY() + 44;
        if (this.y < rest - 0.5) {
          this.vy += 1500 * dt;
          this.y = Math.min(rest, this.y + this.vy * dt);
          if (this.y >= rest) {
            this.vy = 0;
            this.stage.particles.dust(this.x + 15, this.y + 36, 3, "rgba(210,200,170,0.8)");
          }
        }
      }
      this.barGlow = Math.max(0, this.barGlow - dt);
      const show = this.hover || this.barGlow > 0;
      this.barTrack.setAttribute("opacity", show ? "1" : "0");
      this.bar.setAttribute("opacity", show ? "1" : "0");
      this.bar.setAttribute("width", String(22 * p));
      this.place();
      if (p >= 1 && !this.hold) this.burst();
    }
    /* a shockwave under it: it hops and the shell takes a knock (never more than a second off the hatch) */
    jolt(power) {
      if (this.dead || this.carriedBy || this.held) return;
      this.vy = -Math.min(520, 160 + power * 360);
      this.hatchAt = Math.max(this.t + 0.5, this.hatchAt - 0.8 * power);
      this.barGlow = 1.5;
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
      const away = !!(this.carriedBy || this.hold);
      return {
        type: this.type,
        x: away ? this.homeX : this.x,
        y: away ? this.homeY : this.y,
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
      const svg = svgEl("svg", { viewBox: "-50 -30 100 60", width: 100, height: 60, style: "overflow:visible" });
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
      el.addEventListener("mousedown", (e) => e.preventDefault());
      el.addEventListener("pointerdown", (e) => {
        if (this.carry) {
          e.stopPropagation();
          this.onPoke && this.onPoke(this);
        }
      });
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
      this.el.style.pointerEvents = node ? "auto" : "none";
      this.el.style.cursor = node ? "pointer" : "";
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
      const gy = this.stage.groundY() + 92;
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
      const y = s.vh() - this.h + (hidden ? this.h : 0);
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
        this.y = s.vh() - this.h * k;
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
          this.makeScorch();
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
        this.y = s.vh() - this.h * (1 - k);
        this.el.style.transform = `translate(${this.x}px,${this.y}px)`;
        if (this.t >= d.sink) {
          this.remove();
          this.onEnd && this.onEnd(this);
        }
      }
    }
    /* a scorch mark at the foot of the mountain that outlives the event (the meteor leaves a crater) */
    makeScorch() {
      const s = this.stage;
      const c = document.createElement("div");
      c.className = "ad-crater";
      c.style.zIndex = Z.decal;
      const svg = svgEl("svg", { viewBox: "-60 -20 120 40", width: 120, height: 40 });
      svg.appendChild(svgEl("ellipse", { cx: 0, cy: 6, rx: 50, ry: 11, fill: "rgba(50,30,24,0.34)" }));
      svg.appendChild(svgEl("ellipse", { cx: 0, cy: 5, rx: 30, ry: 6, fill: "rgba(239,91,35,0.22)" }));
      svg.appendChild(svgEl("path", { d: "M-34 8 L-46 14 M30 8 L44 15 M0 10 L2 18", stroke: "rgba(239,91,35,0.28)", "stroke-width": 2.5, "stroke-linecap": "round" }));
      c.appendChild(svg);
      const x = this.side === "left" ? 0 : s.vw() - 120;
      c.style.transform = `translate(${x}px,${s.vh() - 44}px)`;
      s.layer.appendChild(c);
      this.onScorch && this.onScorch(c);
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
      this.ty = s.groundY() + 86;
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
      this.onImpact && this.onImpact(this);
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

  // src/entities/bandit.js
  var BANDIT_SP = { id: "bandit", speedMul: 1.5, stride: 30, hopHeight: 60, mass: 0.7, neckLen: 18 };
  var W = 120;
  var H = 100;
  var C = { ink: "#15131c", base: "#34448a", shade: "#232e66", light: "#4d62b8", belly: "#d5dcf5", teal: "#26c2b0", tealShade: "#168a7c", scarf: "#d9483a", scarfShade: "#a82f26", claw: "#f6efdc", eye: "#fff7d6" };
  var rot = (a, x, y) => `rotate(${a.toFixed(1)} ${x} ${y})`;
  var LEG = { L1: 16, L2: 17, L3: 11, hipY: 56, groundY: 92, hipX: { near: 59, far: 55 } };
  var TAU = Math.PI * 2;
  var smooth = (t) => t * t * (3 - 2 * t);
  function legPose(hipX, hipY, u, run, air) {
    const { L1, L2, L3, groundY } = LEG;
    let bx, by, phi, psi;
    if (air) {
      bx = hipX + 7;
      by = hipY + 27;
      phi = 62;
      psi = 38;
    } else {
      const duty = 0.55, S = 6 + run * 8, cx = hipX + 6;
      if (u < duty) {
        bx = cx + S * (1 - 2 * (u / duty));
        by = groundY;
        phi = 30;
        psi = 84;
      } else {
        const s = (u - duty) / (1 - duty), k = Math.sin(Math.PI * s);
        bx = cx - S + 2 * S * smooth(s);
        by = groundY - k * (6 + run * 8);
        phi = 30 + 30 * k;
        psi = 84 - 40 * k;
      }
    }
    const r = (d2) => d2 * Math.PI / 180;
    const hock = { x: bx - L3 * Math.sin(r(phi)), y: by - L3 * Math.cos(r(phi)) };
    const dx = hock.x - hipX, dy = hock.y - hipY;
    const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
    const k1 = { x: hipX + ux * a - uy * h, y: hipY + uy * a + ux * h };
    const k2 = { x: hipX + ux * a + uy * h, y: hipY + uy * a - ux * h };
    const knee = k1.x >= k2.x ? k1 : k2;
    const toe = (deg, len) => ({ x: bx + Math.sin(r(deg)) * len, y: by + Math.cos(r(deg)) * len });
    return { hip: { x: hipX, y: hipY }, knee, hock, ball: { x: bx, y: by }, toes: [toe(psi, 10), toe(psi + 26, 7)], psi };
  }
  var Bandit = class {
    constructor(stage, opts) {
      const o = opts || {};
      this.stage = stage;
      this.sp = BANDIT_SP;
      this.scale = o.scale || 0.86;
      this.body = new Body(BANDIT_SP);
      this.baby = false;
      this.t = 0;
      this.emotion = "calm";
      this._tail = 0;
      this._scarf = 0;
      const g = (attrs, kids) => svgEl("g", attrs, kids);
      const p = (d, fill, extra) => svgEl("path", { d, fill, ...extra || {} });
      const mkLeg = (col, claw) => {
        const seg = (w) => svgEl("path", { d: "", fill: "none", stroke: col, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" });
        const L = { thigh: seg(11), shin: seg(6), meta: seg(4.2), toes: seg(3.4), claws: svgEl("path", { d: "", fill: "none", stroke: claw, "stroke-width": 1.8, "stroke-linecap": "round" }) };
        L.hipCap = svgEl("circle", { cx: 0, cy: 0, r: 6.5, fill: col });
        L.g = g({}, [L.hipCap, L.thigh, L.shin, L.meta, L.toes, L.claws]);
        return L;
      };
      this.farLeg = mkLeg(C.shade, C.claw);
      this.nearLeg = mkLeg(C.base, C.claw);
      this.legFar = this.farLeg.g;
      this.tailG = g({}, [
        p("M46 48 Q30 40 12 44 Q4 46 2 50 Q8 51 14 51 Q32 54 46 58Z", C.base),
        p("M10 46 L12 52 M18 44 L20 53 M26 44 L27 54 M34 45 L35 56", "none", { stroke: C.teal, "stroke-width": 2.4, "stroke-linecap": "round" }),
        p("M2 50 L-4 47 L0 53Z", C.tealShade)
        // tail tuft
      ]);
      this.torso = g({}, [
        p("M40 50 Q42 36 62 34 Q84 32 90 44 Q92 56 78 62 Q60 68 46 62 Q38 58 40 50Z", C.base),
        p("M48 60 Q62 68 80 60 Q70 62 58 58Z", C.light, { opacity: 0.35 }),
        svgEl("ellipse", { cx: 68, cy: 55, rx: 16, ry: 8, fill: C.belly, opacity: 0.95 }),
        p("M52 40 L55 48 M60 38 L63 47 M68 38 L70 46 M76 40 L77 47", "none", { stroke: C.teal, "stroke-width": 2.2, "stroke-linecap": "round", opacity: 0.9 })
      ]);
      this.legNear = this.nearLeg.g;
      this.arm = g({}, [
        p("M82 52 Q90 56 94 54 Q96 52 94 51 Q90 52 84 48Z", C.light),
        p("M94 51 L98 50 M94 53 L98 54", "none", { stroke: C.claw, "stroke-width": 1.6, "stroke-linecap": "round" })
      ]);
      this.eyeCalm = g({}, [
        svgEl("circle", { cx: 105, cy: 24, r: 3.3, fill: C.eye }),
        svgEl("circle", { cx: 106, cy: 24, r: 1.6, fill: C.ink })
      ]);
      this.eyeHappy = g({ style: "display:none" }, [p("M101 25 Q105 20 109 25", "none", { stroke: C.eye, "stroke-width": 2, "stroke-linecap": "round" })]);
      this.eyeDaze = g({ style: "display:none" }, [p("M102 21 L108 27 M108 21 L102 27", "none", { stroke: C.eye, "stroke-width": 2, "stroke-linecap": "round" })]);
      this.eyeScared = g({ style: "display:none" }, [
        svgEl("circle", { cx: 105, cy: 24, r: 4.2, fill: C.eye }),
        svgEl("circle", { cx: 105, cy: 24, r: 1.1, fill: C.ink })
      ]);
      this.jaw = p("M96 33 Q108 38 120 32 Q108 36 96 33Z", C.shade);
      this.headG = g({}, [
        p("M80 44 Q86 34 94 26 L100 34 Q92 42 90 50Z", C.base),
        // neck
        p("M92 20 Q100 14 112 18 Q122 22 122 28 Q120 33 110 34 Q96 35 92 28Z", C.base),
        // skull + snout
        p("M94 17 L90 8 L99 15Z M99 15 L97 5 L105 14Z M104 14 L104 4 L110 15Z", C.teal),
        // feather crest
        p("M93 20 L120 25 L120 30 L94 29Z", C.ink),
        // the bandit mask
        this.eyeCalm,
        this.eyeHappy,
        this.eyeDaze,
        this.eyeScared,
        this.jaw,
        svgEl("circle", { cx: 117, cy: 24, r: 1, fill: C.shade })
        // nostril
      ]);
      this.scarfG = g({}, [
        p("M82 40 Q70 36 56 46 Q70 47 80 49Z", C.scarf),
        p("M82 40 Q74 44 66 46", "none", { stroke: C.scarfShade, "stroke-width": 1.6 })
      ]);
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: "overflow:visible" }, [
        this.legFar,
        this.tailG,
        this.torso,
        this.legNear,
        this.arm,
        this.headG,
        this.scarfG
      ]);
      const el = document.createElement("div");
      el.className = "ad-dino";
      el.style.zIndex = Z.dino;
      el.appendChild(svg);
      stage.layer.appendChild(el);
      this.el = el;
      const sh = document.createElement("div");
      sh.className = "ad-shadow";
      sh.style.zIndex = Z.shadow;
      sh.style.width = 80 * this.scale + "px";
      sh.style.margin = `${-9 * this.scale}px 0 0 ${-40 * this.scale}px`;
      stage.layer.appendChild(sh);
      this.shadow = sh;
    }
    get w() {
      return W * this.scale;
    }
    get h() {
      return H * this.scale;
    }
    get centreX() {
      return this.body.x + this.w * 0.5;
    }
    get headLocal() {
      return { x: 110, y: 26 };
    }
    get headX() {
      const lx = this.headLocal.x;
      return this.body.x + this.scale * (this.body.faceScale >= 0 ? lx : W - lx);
    }
    get headY() {
      return this.body.y + this.scale * this.headLocal.y;
    }
    setOutfit() {
    }
    // the bandit has one look
    setEmotion(e) {
      this.emotion = e;
    }
    update(dt) {
      const b = this.body;
      b.step(dt);
      this.t += dt;
      const reduced = this.stage.reduced;
      const run = clamp(b.speed / Math.max(1, b.maxSpeed), 0, 1);
      const ph = b.gaitPhase;
      const emo = this.emotion;
      const stride = reduced ? 0.4 : 1;
      const air = !b.grounded;
      const bob = b.grounded ? -Math.abs(Math.sin(ph)) * (1 + run * 3) * stride : 0;
      const u0 = (ph / TAU % 1 + 1) % 1;
      const runS = run * stride;
      this._drawLeg(this.nearLeg, legPose(LEG.hipX.near, LEG.hipY + bob, u0, runS, air));
      this._drawLeg(this.farLeg, legPose(LEG.hipX.far, LEG.hipY + bob, (u0 + 0.5) % 1, runS, air));
      const lean = -run * 7 + (emo === "sleepy" ? 6 : 0);
      const squash = 1 - Math.min(0.12, b.landImpact * 0.1);
      this.torso.setAttribute("transform", `translate(0 ${bob.toFixed(1)}) ${rot(lean, 62, 50)} scale(1 ${squash.toFixed(3)})`);
      const wag = reduced ? 0 : Math.sin(this.t * 7 + ph) * (2 + run * 6);
      const tailT = 8 + run * 10 + (emo === "scared" ? 16 : 0) + wag;
      this._tail += (tailT - this._tail) * clamp(dt * 10, 0, 1);
      this.tailG.setAttribute("transform", rot(this._tail, 46, 52));
      const pump = Math.sin(ph * 2) * (1.5 + run * 2.5) * stride;
      const tilt = emo === "sleepy" ? 34 + Math.sin(this.t * 3) * 4 : emo === "scared" ? 14 : emo === "happy" ? -8 : 0;
      this.headG.setAttribute("transform", `translate(${(pump * 0.5).toFixed(1)} ${pump.toFixed(1)}) ${rot(tilt - run * 5, 84, 42)}`);
      const flap = reduced ? 0 : Math.sin(this.t * 22) * run * 7;
      this._scarf += (4 + run * 20 + flap - this._scarf) * clamp(dt * 12, 0, 1);
      this.scarfG.setAttribute("transform", rot(this._scarf, 82, 42));
      this.arm.setAttribute("transform", rot(Math.sin(ph * 2) * 4 - run * 8, 82, 50));
      this.eyeCalm.style.display = emo === "calm" || emo === "smug" || emo === "angry" ? "" : "none";
      this.eyeHappy.style.display = emo === "happy" ? "" : "none";
      this.eyeDaze.style.display = emo === "sleepy" ? "" : "none";
      this.eyeScared.style.display = emo === "scared" ? "" : "none";
      this.jaw.setAttribute("transform", `translate(0 ${emo === "happy" ? 2 : 0})`);
    }
    _drawLeg(L, P) {
      const f = (p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      L.hipCap.setAttribute("cx", P.hip.x.toFixed(1));
      L.hipCap.setAttribute("cy", P.hip.y.toFixed(1));
      L.thigh.setAttribute("d", `M${f(P.hip)} L${f(P.knee)}`);
      L.shin.setAttribute("d", `M${f(P.knee)} L${f(P.hock)}`);
      L.meta.setAttribute("d", `M${f(P.hock)} L${f(P.ball)}`);
      L.toes.setAttribute("d", P.toes.map((t) => `M${f(P.ball)} L${f(t)}`).join(" "));
      const r = (d) => d * Math.PI / 180;
      L.claws.setAttribute("d", P.toes.map((t, i) => {
        const a = r(P.psi + (i ? 26 : 0) + 10);
        return `M${f(t)} L${(t.x + Math.sin(a) * 3).toFixed(1)} ${(t.y + Math.cos(a) * 3).toFixed(1)}`;
      }).join(" "));
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

  // src/entities/thief.js
  var SCALE = 0.86;
  var Thief = class {
    constructor(stage, target, getDino) {
      this.stage = stage;
      const isPet = !!(target && target.sp && target.body);
      this.pet = isPet ? target : null;
      const egg = isPet ? null : target;
      const lootX = isPet ? target.centreX : egg.x;
      this.egg = egg;
      this.getDino = getDino;
      this.t = 0;
      this.state = "run";
      this.stateT = 0;
      this.dead = false;
      this.bonks = 0;
      this.sorryHeld = false;
      const d = new Bandit(stage, { scale: SCALE });
      d.el.style.pointerEvents = "none";
      d.el.addEventListener("mousedown", (e) => e.preventDefault());
      d.el.addEventListener("pointerdown", (e) => {
        if (this.state !== "flee") return;
        e.stopPropagation();
        this.bonk();
      });
      this.dino = d;
      const vw = stage.vw();
      this.fromLeft = lootX < vw / 2 ? false : true;
      this.alignGround();
      this.dino.body.y = this.dino.body.groundY;
      this.dino.body.x = this.fromLeft ? -120 : vw + 40;
      this.fleeDir = lootX > vw / 2 ? -1 : 1;
      this.dino.body.facing = this.fromLeft ? 1 : -1;
      this.dino.body.faceScale = this.dino.body.facing;
    }
    /* feet on the same line as the leader's, whatever the model heights are */
    alignGround() {
      const lead = this.getDino && this.getDino();
      this.dino.body.groundY = this.stage.groundY() + (lead ? lead.h : 100) - this.dino.h;
    }
    get body() {
      return this.dino.body;
    }
    get w() {
      return this.dino.w;
    }
    get x() {
      return this.body.x;
    }
    setState(s) {
      this.state = s;
      this.stateT = 0;
    }
    /* the egg rides at its mouth */
    pin() {
      const dir = this.body.faceScale >= 0 ? 1 : -1;
      const pet = this.pet;
      if (pet && pet.heldBy === this) {
        pet.body.x = this.dino.headX - pet.w * 0.5 + dir * 6;
        pet.body.y = this.dino.headY - 4;
        pet.body.vx = 0;
        pet.body.vy = 0;
        return;
      }
      const e = this.egg;
      if (!e || e.dead) return;
      e.x = this.dino.headX - 15 + dir * 8;
      e.y = this.dino.headY - 10;
      e.vy = 0;
      e.place();
    }
    grab() {
      const pet = this.pet;
      if (pet) {
        pet.heldBy = this;
        pet.body.pinned = true;
        pet.el.style.zIndex = Z.card;
        pet.setEmotion("scared");
        this.setState("flee");
        this.dino.el.style.pointerEvents = "auto";
        this.dino.el.style.cursor = "pointer";
        this.onGrab && this.onGrab(this);
        return;
      }
      const e = this.egg;
      e.carriedBy = this;
      e.held = false;
      e.homeX = e.x;
      e.homeY = e.y;
      this.doting = this.canDote !== false && (e.t / e.hatchAt > 0.45 || Math.random() < 0.3);
      if (this.doting) e.hatchAt = Math.max(e.t + 0.6, Math.min(e.hatchAt, e.t + rnd(1, 1.8)));
      this.setState("flee");
      this.dino.el.style.pointerEvents = "auto";
      this.dino.el.style.cursor = "pointer";
      this.onGrab && this.onGrab(this);
    }
    bonk() {
      this.bonks++;
      const e = this.egg;
      if (this.pet && this.pet.heldBy === this) this.releasePet(-300);
      if (e && !e.dead) {
        e.carriedBy = null;
        e.held = false;
        e.vy = -380;
        e.x = clamp(e.x, 10, this.stage.vw() - 40);
      }
      this.dino.el.style.pointerEvents = "none";
      this.dino.el.style.cursor = "";
      this.dino.setEmotion("sleepy");
      this.body.vx = 0;
      this.setState("dazed");
      this.onBonk && this.onBonk(this);
    }
    /* let a kidnapped hatchling go: it drops, lands and goes back to following the leader on its own */
    releasePet(hop) {
      const pet = this.pet;
      if (!pet) return;
      pet.heldBy = null;
      pet.body.pinned = false;
      pet.el.style.zIndex = Z.friend;
      pet.el.style.display = "";
      pet.shadow.style.display = "";
      pet.setEmotion("calm");
      pet.body.vy = hop || 0;
      pet.body.grounded = !hop;
      pet.body.x = clamp(pet.body.x, 10, this.stage.vw() - 60);
    }
    /* the egg burst while we held it: the engine has made the friend; now be a doting parent about it */
    hatched() {
      this.egg = null;
      this.dino.el.style.pointerEvents = "none";
      this.dino.setEmotion("happy");
      this.body.vx = 0;
      this.setState("dote");
      this.onDote && this.onDote(this);
    }
    step(dt) {
      if (this.dead) return;
      this.t += dt;
      this.stateT += dt;
      const b = this.body, s = this.stage, vw = s.vw();
      const e = this.egg && !this.egg.dead ? this.egg : null;
      if (this.state !== "dote" && this.egg && this.egg.dead) {
        this.egg = null;
        if (this.state === "flee" || this.state === "dazed" || this.state === "sorry" || this.state === "return") this.hatched();
      }
      const leader = this.getDino();
      const leadX = leader ? leader.centreX : vw / 2;
      switch (this.state) {
        case "run": {
          const lx = this.pet ? this.pet.centreX : e ? e.x + 15 : null;
          if (lx === null || this.pet && this.pet.heldBy && this.pet.heldBy !== this) {
            this.setState("leave");
            break;
          }
          const near = b.driveToward(lx - this.w * 0.5, dt, 2.1);
          if (near || Math.abs(lx - (b.x + this.w * 0.5)) < 22) this.grab();
          break;
        }
        case "flee": {
          const goal = this.fleeDir > 0 ? vw + 160 : -200;
          if (this.doting && e && (b.x > vw - 160 || b.x < 20)) e.hatchAt = Math.min(e.hatchAt, e.t);
          b.driveToward(goal, dt, 1.3);
          if (b.x > vw + 70 || b.x < -110) {
            if (e) {
              e.hold = true;
              e.el.style.display = "none";
            }
            if (this.pet) {
              this.pet.el.style.display = "none";
              this.pet.shadow.style.display = "none";
            }
            this.dino.el.style.display = "none";
            this.dino.shadow.style.display = "none";
            this.awayFor = rnd(14, 24);
            this.setState("away");
            this.onEscape && this.onEscape(this);
          }
          break;
        }
        case "away": {
          if (this.stateT >= this.awayFor) {
            this.dino.el.style.display = "";
            this.dino.shadow.style.display = "";
            if (e) e.el.style.display = "";
            if (this.pet) {
              this.pet.el.style.display = "";
              this.pet.shadow.style.display = "";
            }
            b.x = this.fleeDir > 0 ? vw + 40 : -120;
            b.facing = this.fleeDir > 0 ? -1 : 1;
            b.faceScale = b.facing;
            this.dino.setEmotion("scared");
            this.setState("return");
          }
          break;
        }
        case "return":
        case "sorry": {
          if (this.state === "sorry" && !this.sorryHeld && !this.pet) {
            if (!e) {
              this.setState("leave");
              break;
            }
            const there = b.driveToward(e.x + 15 - this.w * 0.5, dt, 1);
            if (there || Math.abs(e.x + 15 - (b.x + this.w * 0.5)) < 20) {
              this.sorryHeld = true;
              e.carriedBy = this;
              e.held = false;
              this.dino.setEmotion("scared");
            }
            break;
          }
          b.driveToward(leadX + (b.x < leadX ? -90 : 90) - this.w * 0.5, dt, 0.6);
          if (Math.abs(b.x + this.w * 0.5 - leadX) < 110) this.setDown();
          if (this.stateT > 40) this.setDown();
          break;
        }
        case "dazed": {
          if (Math.random() < dt * 6) this.stage.particles.sparkle(this.dino.headX, this.dino.headY - 8, "#ffe285");
          b.halt(dt);
          if (this.stateT > 1.6) {
            this.dino.setEmotion("scared");
            this.sorryHeld = false;
            if (this.pet) this.onReturn && this.onReturn(this);
            this.setState(this.pet ? "bow" : "sorry");
          }
          break;
        }
        case "dote": {
          b.halt(dt);
          if (Math.random() < dt * 3 && !s.reduced) this.stage.particles.sparkle(this.dino.headX, this.dino.headY - 12, "#ff9fae");
          if (this.stateT > 2.2) this.setState("escort");
          break;
        }
        case "escort": {
          b.driveToward(leadX + (b.x < leadX ? -90 : 90) - this.w * 0.5, dt, 0.7);
          if (Math.abs(b.x + this.w * 0.5 - leadX) < 120 || this.stateT > 14) this.setState("bow");
          break;
        }
        case "bow": {
          b.halt(dt);
          if (!this.bowed) {
            this.bowed = true;
            this.onBow && this.onBow(this);
          }
          if (this.stateT > 1.4) {
            this.dino.setEmotion("happy");
            this.setState("leave");
          }
          break;
        }
        case "leave": {
          const dir = b.x + this.w * 0.5 < vw / 2 ? -1 : 1;
          b.driveToward(dir > 0 ? vw + 200 : -260, dt, 1.4);
          if (b.x > vw + 90 || b.x < -150) this.finish();
          break;
        }
        default:
          break;
      }
      this.alignGround();
      this.dino.update(dt, null);
      if (this.egg && !this.egg.dead && this.egg.carriedBy === this || this.pet && this.pet.heldBy === this) this.pin();
    }
    /* put the egg down beside the dino, gently, and bow */
    setDown() {
      if (this.pet && this.pet.heldBy === this) {
        const leader = this.getDino();
        this.pet.body.x = clamp((leader ? leader.centreX : this.stage.vw() / 2) + (this.body.x < (leader ? leader.centreX : 0) ? -60 : 50), 10, this.stage.vw() - 60);
        this.releasePet(0);
      }
      const e = this.egg;
      if (e && !e.dead) {
        e.carriedBy = null;
        e.hold = false;
        e.held = false;
        e.vy = 0;
        e.el.style.display = "";
        const leader = this.getDino();
        e.x = clamp((leader ? leader.centreX : this.stage.vw() / 2) + (this.body.x < (leader ? leader.centreX : 0) ? -52 : 40), 10, this.stage.vw() - 40);
        e.y = this.stage.groundY() + 44 - 18;
        e.place();
      }
      this.onReturn && this.onReturn(this);
      this.setState("bow");
    }
    render() {
      if (!this.dead) this.dino.render();
    }
    finish() {
      if (this.dead) return;
      const e = this.egg;
      if (this.pet && this.pet.heldBy === this) this.releasePet(0);
      if (e && !e.dead && e.carriedBy === this) {
        e.carriedBy = null;
        e.hold = false;
        e.el.style.display = "";
      }
      this.dead = true;
      this.dino.remove();
      this.onExit && this.onExit(this);
    }
    remove() {
      this.finish();
    }
  };

  // src/fx/smoke.js
  var HAZE_PEAK = 0.5;
  var HAZE_PEAK_SOFT = 0.28;
  var SMOKE_MAX_AGE = 40;
  var MAX_PUFFS = 9;
  var Smoke = class {
    constructor(stage, side) {
      this.stage = stage;
      this.side = side || "left";
      this.d = 0;
      this.age = 0;
      this.fed = false;
      this.swatT = 0;
      this.dead = false;
      this.puffs = [];
      this._blur = -1;
      const el = document.createElement("div");
      el.className = "ad-smoke";
      el.style.zIndex = Z.smoke;
      const haze = document.createElement("div");
      haze.className = "ad-haze";
      const at = this.side === "left" ? "0% 100%" : "100% 100%";
      haze.style.background = `radial-gradient(ellipse at ${at}, rgba(74,68,78,1) 0%, rgba(96,88,96,.82) 45%, rgba(120,110,114,.62) 100%)`;
      el.appendChild(haze);
      stage.layer.appendChild(el);
      this.el = el;
      this.haze = haze;
      this._swat = () => {
        this.swatT = 1.2;
      };
      window.addEventListener("pointerdown", this._swat, true);
    }
    get soft() {
      return !!this.stage.reduced;
    }
    get peak() {
      return this.soft ? HAZE_PEAK_SOFT : HAZE_PEAK;
    }
    /* called each frame while the volcano is erupting / ashing: the plume thickens */
    source(dt, mouth) {
      this.fed = true;
      this.d = clamp(this.d + dt * 0.2, 0, 1);
      this.mouth = mouth || this.mouth;
      if (!this.soft && this.stage.tier > 0 && this.puffs.length < MAX_PUFFS && Math.random() < dt * 5) this.addPuff();
    }
    addPuff() {
      const m = this.mouth || { x: this.side === "left" ? 90 : this.stage.vw() - 90, y: this.stage.vh() - 150 };
      const el = document.createElement("div");
      el.className = "ad-puff";
      const size = rnd(110, 210);
      el.style.width = el.style.height = size + "px";
      this.el.appendChild(el);
      this.puffs.push({
        el,
        x: m.x - size / 2 + rnd(-20, 20),
        y: m.y - size / 2,
        vx: rnd(-26, 26) + (this.side === "left" ? 22 : -22),
        vy: rnd(-70, -35),
        size,
        life: rnd(5, 8),
        t: 0
      });
    }
    step(dt) {
      if (this.dead) return;
      this.age += dt;
      if (!this.fed) this.d = clamp(this.d - dt * (this.swatT > 0 ? 0.34 : 0.075), 0, 1);
      this.fed = false;
      if (this.swatT > 0) {
        this.swatT -= dt;
        for (const p of this.puffs) p.vx += (p.x < this.stage.vw() / 2 ? -1 : 1) * 160 * dt;
      }
      for (let i = this.puffs.length - 1; i >= 0; i--) {
        const p = this.puffs[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += dt * 14;
        const k = p.t / p.life;
        if (k >= 1) {
          p.el.remove();
          this.puffs.splice(i, 1);
          continue;
        }
        p.el.style.width = p.el.style.height = p.size + "px";
        p.el.style.opacity = String(Math.min(1, k * 5, (1 - k) * 1.6) * Math.min(1, this.d * 2));
        p.el.style.transform = `translate(${p.x}px,${p.y}px)`;
      }
      this.haze.style.opacity = String(+(this.d * this.peak).toFixed(3));
      const blur = this.soft || this.stage.tier < 2 ? 0 : Math.round(this.d * 3 * 2) / 2;
      if (blur !== this._blur) {
        this._blur = blur;
        this.haze.style.backdropFilter = blur ? `blur(${blur}px)` : "";
      }
      if (this.d <= 4e-3 && this.age > 1 || this.age > SMOKE_MAX_AGE) this.remove();
    }
    /* 0..1 how thick the smoke is right now (the engine uses it for the cough) */
    get density() {
      return this.d;
    }
    remove() {
      if (this.dead) return;
      this.dead = true;
      window.removeEventListener("pointerdown", this._swat, true);
      for (const p of this.puffs) p.el.remove();
      this.puffs = [];
      this.el.remove();
    }
  };

  // src/entities/leaf.js
  var LEAF_FALL_S = [5.2, 6.4];
  var LEAF_GROUND_S = 30;
  var SIZE = 30;
  var StarLeaf = class {
    constructor(stage, side, tx) {
      this.stage = stage;
      this.state = "fall";
      this.t = 0;
      this.groundT = 0;
      this.dead = false;
      this.side = side === "right" ? "right" : "left";
      const vw = stage.vw();
      this.x0 = this.side === "left" ? -40 : vw + 40;
      this.y0 = -40;
      this.tx = clamp(tx, 40, vw - 40);
      this.dur = rnd(LEAF_FALL_S[0], LEAF_FALL_S[1]);
      this.gy = stage.groundY() + 70;
      this.x = this.x0;
      this.y = this.y0;
      this.rot = 0;
      this.phase = rnd(0, 6.28);
      const el = document.createElement("div");
      el.className = "ad-leaf";
      el.style.zIndex = Z.particleFront;
      const svg = svgEl("svg", { viewBox: "-16 -16 32 32", width: SIZE, height: SIZE });
      svg.appendChild(svgEl("path", { d: "M0 -14 L3.8 -4.8 L13.4 -4.2 L6 2.2 L8.4 11.6 L0 6.4 L-8.4 11.6 L-6 2.2 L-13.4 -4.2 L-3.8 -4.8Z", fill: "#58b94a", stroke: "#e8c235", "stroke-width": 1.4, "stroke-linejoin": "round" }));
      svg.appendChild(svgEl("path", { d: "M0 -9 L2.2 -3.4 L8 -2.6 L3.6 1.4 L5 7 L0 3.8Z", fill: "#8be36a", opacity: 0.75 }));
      svg.appendChild(svgEl("path", { d: "M0 -11 L0 8 M0 -2 L-7 -3 M0 -2 L7 -3", stroke: "#2f7a30", "stroke-width": 1, "stroke-linecap": "round", fill: "none" }));
      svg.appendChild(svgEl("path", { d: "M0 6.4 Q1 11 4 13", stroke: "#2f7a30", "stroke-width": 1.4, "stroke-linecap": "round", fill: "none" }));
      el.style.filter = "drop-shadow(0 0 5px rgba(255,226,133,.95))";
      el.appendChild(svg);
      stage.layer.appendChild(el);
      this.el = el;
      this.place();
    }
    get cx() {
      return this.x + SIZE / 2;
    }
    get cy() {
      return this.y + SIZE / 2;
    }
    get falling() {
      return this.state === "fall";
    }
    get grounded() {
      return this.state === "ground";
    }
    place() {
      this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.rot}deg)`;
    }
    step(dt) {
      if (this.dead) return;
      const soft = this.stage.reduced;
      if (this.state === "fall") {
        this.t += dt;
        const k = clamp(this.t / this.dur, 0, 1);
        const sway = Math.sin(this.t * 2.6 + this.phase) * 34 * (1 - k * 0.65) * (soft ? 0.4 : 1);
        this.x = this.x0 + (this.tx - SIZE / 2 - this.x0) * ease.outCubic(k) + sway;
        this.y = this.y0 + (this.gy - this.y0) * Math.pow(k, 1.12);
        this.rot = Math.sin(this.t * 2.6 + this.phase + 1.2) * (soft ? 12 : 38);
        if (k >= 1) this.land();
      } else if (this.state === "ground") {
        this.groundT += dt;
        this.rot *= 0.9;
        if (this.groundT > LEAF_GROUND_S - 5 && !soft) this.el.style.opacity = String(0.6 + 0.4 * Math.abs(Math.sin(this.groundT * 6)));
        if (this.groundT >= LEAF_GROUND_S) {
          this.state = "gone";
          this.onGone && this.onGone(this);
          this.remove();
          return;
        }
      }
      this.place();
    }
    land() {
      this.state = "ground";
      this.x = this.tx - SIZE / 2;
      this.y = this.gy;
      this.rot = 0;
      if (!this.stage.reduced) this.stage.particles.dust(this.cx, this.cy + 8, 4, "rgba(210,200,170,0.8)");
      this.onLand && this.onLand(this);
    }
    remove() {
      if (this.dead) return;
      this.dead = true;
      this.el.remove();
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
    reduced: ["Taking it easy today.", "Calm mode. Very restful."],
    welcome: ["You are BACK!", "I counted. You were gone a while.", "Oh good, the tab lives.", "Welcome back. I kept your seat warm."],
    link: ["Is that a link? Smells like a link.", "Sniff sniff. Clickable.", "You are hovering. I noticed.", "Go on. Click it."],
    select: ["Ooh, highlighting. Fancy.", "I see what you did there.", "Marked for the fossil record.", "Important, is it?"],
    poke: ["Hello? Still there?", "Did you fall asleep?", "Pssst. Cursor.", "You stopped moving. Suspicious.", "*pokes cursor*"],
    lift: ["PUT ME DOWN", "Whoa whoa whoa!", "I can see my house from here.", "Unhand me!", "This is undignified."],
    thrown: ["Wheeee\u2014oof.", "Nailed the landing. Mostly.", "Again! No wait. Again!", "My tail is in a different place.", "Ten out of ten. Nine for the landing."],
    toy: ["FETCH!", "Ball! BALL!", "Mine mine mine.", "Good throw. I allow it.", "Dropping it. You throw it. That is the deal."],
    trick: ["TRICK!", "Boo! Did I scare you?", "Trick or treat, tiny human.", "I vant to bite your cursor."],
    treat: ["TREAT!", "Candy for the fossil record.", "Spooky snacks are the best snacks."],
    daily: ["Fresh clutch for today!", "Something new in the nest today.", "Daily egg delivered. You are welcome."],
    golden: ["Seven days in a row. Behold the golden egg.", "A week! Here is something shiny."],
    feast: ["FEAST!", "Gobble gobble. That is the plan.", "I was told there would be drumsticks.", "Seconds. I want seconds."],
    smoke: ["*cough* Is that ash?", "I cannot see the page.", "Wave it away. Click anywhere.", "This is fine. *cough*"],
    volcanoEggs: ["The volcanic egg loves this.", "That egg is cooking. Good cooking."],
    thief: ["MY EGG.", "HEY! That is not yours!", "Drop it, bandit!", "Bonk it! Click the thief!"],
    leafSpot: ["A star leaf!", "Falling snack!", "MINE.", "Do not let it land!"],
    leafCatch: ["GOT IT. Mid-air.", "Perfect catch.", "Nom. *sparkle*", "Sweet. Literally."],
    leafLate: ["It landed. Still eating it.", "Floor leaf. Still delicious.", "Five-second rule. Thirty-second rule."],
    leafGone: ["\u2026it blew away.", "Well. That was a leaf."],
    thiefPet: ["NOT THE BABY!", "Put them DOWN!", "Give back my hatchling!", "That one is MINE. Bonk it!"],
    thiefBonk: ["BONK.", "Gotcha.", "Now walk it back.", "Right on the head."],
    thiefBack: ["Thank you. I guess.", "Apology accepted.", "Careful with that.", "Gently. GENTLY."],
    thiefHatch: ["It hatched?!", "Oh no. It is cute.", "The bandit is a babysitter now.", "Okay. You may keep it. Gently."],
    thiefAway: ["\u2026it is keeping it warm, isn't it.", "It will bring it back. Probably."],
    mobbed: ["The hatchlings got it!", "Teamwork!", "Get it, little ones!"],
    feastFriends: ["Back off. Get your own drumstick.", "Fine. One bite each.", "The hatchlings are staring at the drumstick."],
    feasted: ["Perfect. Ten out of ten gravy.", "Not a crumb left for the fossil record.", "Thankful for snacks.", "Nom. Thank you, tab."],
    season: ["New seasonal items in the wardrobe."]
  };

  // src/entities/toy.js
  var TOY_LIFE = 30;
  var G = 2400;
  var BOUNCE = 0.62;
  var SIZE2 = 26;
  var Toy = class {
    constructor(stage, kind, x, y) {
      this.stage = stage;
      this.kind = kind === "bone" ? "bone" : "ball";
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.size = SIZE2;
      this.age = 0;
      this.dead = false;
      this.carried = false;
      this.dragging = null;
      this.floor = 0;
      this.spin = 0;
      const el = document.createElement("div");
      el.className = "ad-toy";
      el.style.zIndex = Z.friend;
      const svg = svgEl("svg", { viewBox: "-14 -14 28 28", width: SIZE2, height: SIZE2 });
      if (this.kind === "ball") {
        svg.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 12, fill: "#c94f3d", stroke: "#8a2f22", "stroke-width": 1.6 }));
        svg.appendChild(svgEl("path", { d: "M-12 0 Q0 -6 12 0", stroke: "#fffdf8", "stroke-width": 2.4, fill: "none" }));
        svg.appendChild(svgEl("ellipse", { cx: -4, cy: -5, rx: 3.2, ry: 2.2, fill: "#fff", opacity: 0.35 }));
      } else {
        svg.appendChild(svgEl("path", {
          d: "M-9 -3 L9 -3 M-9 3 L9 3",
          stroke: "#f2ecd8",
          "stroke-width": 6,
          "stroke-linecap": "round"
        }));
        for (const [cx, cy] of [[-10, -4], [-10, 4], [10, -4], [10, 4]]) {
          svg.appendChild(svgEl("circle", { cx, cy, r: 3.8, fill: "#f2ecd8", stroke: "#cfc5a5", "stroke-width": 1 }));
        }
      }
      el.appendChild(svg);
      stage.layer.appendChild(el);
      this.el = el;
    }
    get cx() {
      return this.x + this.size / 2;
    }
    step(dt) {
      this.age += dt;
      if (this.age > TOY_LIFE) {
        this.fade();
        return;
      }
      if (this.carried || this.dragging) return;
      this.vy += G * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const vw = this.stage.vw();
      if (this.x < 0) {
        this.x = 0;
        this.vx = Math.abs(this.vx) * BOUNCE;
      }
      if (this.x > vw - this.size) {
        this.x = vw - this.size;
        this.vx = -Math.abs(this.vx) * BOUNCE;
      }
      if (this.y < 0) {
        this.y = 0;
        this.vy = Math.abs(this.vy) * BOUNCE;
      }
      if (this.y >= this.floor) {
        this.y = this.floor;
        this.vy = Math.abs(this.vy) > 160 ? -Math.abs(this.vy) * BOUNCE : 0;
        this.vx *= this.vy === 0 ? Math.max(0, 1 - 5 * dt) : 0.9;
        if (Math.abs(this.vx) < 4) this.vx = 0;
      }
      this.spin += this.vx * dt * 3;
    }
    get resting() {
      return !this.carried && !this.dragging && this.y >= this.floor - 1 && Math.abs(this.vy) < 1;
    }
    render() {
      this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.spin}deg)`;
    }
    fade() {
      if (this.dead) return;
      this.dead = true;
      this.el.style.transition = "opacity .5s";
      this.el.style.opacity = "0";
      setTimeout(() => this.el.remove(), 550);
    }
    remove() {
      this.dead = true;
      this.el.remove();
    }
  };
  function bindToyDrag(engine, toy, on) {
    const samples = [];
    on(toy.el, "mousedown", (e) => e.preventDefault());
    on(toy.el, "pointerdown", (e) => {
      e.stopPropagation();
      toy.dragging = { dx: e.clientX - toy.x, dy: e.clientY - toy.y };
      samples.length = 0;
      try {
        toy.el.setPointerCapture(e.pointerId);
      } catch (_) {
      }
    });
    on(toy.el, "pointermove", (e) => {
      if (!toy.dragging) return;
      toy.x = clamp(e.clientX - toy.dragging.dx, 0, engine.stage.vw() - toy.size);
      toy.y = clamp(e.clientY - toy.dragging.dy, 0, toy.floor);
      samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (samples.length > 8) samples.shift();
    });
    const up = () => {
      if (!toy.dragging) return;
      toy.dragging = null;
      const v = releaseVelocity(samples);
      toy.vx = v.vx;
      toy.vy = v.vy;
    };
    on(toy.el, "pointerup", up);
    on(toy.el, "pointercancel", up);
  }
  function releaseVelocity(samples, maxV = 1600) {
    if (samples.length < 2) return { vx: 0, vy: 0 };
    const last = samples[samples.length - 1];
    let first = samples[0];
    for (const s of samples) if (last.t - s.t <= 100) {
      first = s;
      break;
    }
    const dt = (last.t - first.t) / 1e3;
    if (dt <= 0) return { vx: 0, vy: 0 };
    return { vx: clamp((last.x - first.x) / dt, -maxV, maxV), vy: clamp((last.y - first.y) / dt, -maxV, maxV) };
  }

  // src/content/context.js
  var RULES = [
    ["video", /(^|\.)(youtube|youtu|vimeo|twitch|netflix|hulu|disneyplus|dailymotion)\./],
    ["mail", /(^|\.)(mail\.google|outlook\.(live|office)|mail\.yahoo|proton\.me|fastmail)/],
    ["social", /(^|\.)(x|twitter|facebook|instagram|reddit|tiktok|threads|bsky|linkedin|tumblr|mastodon)\./],
    ["shop", /(^|\.)(amazon|ebay|etsy|walmart|target|bestbuy|aliexpress|shopify|costco)\./],
    ["code", /(^|\.)(github|gitlab|stackoverflow|stackexchange|codepen|npmjs|replit|bitbucket)\./],
    ["docs", /(^|\.)(docs\.google|notion|office|dropbox|onedrive|figma|miro|airtable)\./],
    ["wiki", /(^|\.)(wikipedia|wikimedia|fandom|wikihow|britannica)\./],
    ["news", /(^|\.)(nytimes|cnn|bbc|reuters|apnews|theguardian|washingtonpost|foxnews|npr|bloomberg|wsj)\./],
    ["search", /(^|\.)(google|bing|duckduckgo|brave|ecosia|yahoo)\.[a-z.]+$/],
    ["maps", /(^|\.)(maps\.google|openstreetmap|mapquest|waze)\./],
    ["games", /(^|\.)(itch|steampowered|store\.steam|ign|gamespot|kongregate|poki|coolmathgames)\./]
  ];
  function categoryOf(hostname, imgCount, linkCount) {
    const h = String(hostname || "").toLowerCase();
    for (const [cat, re] of RULES) if (re.test(h)) return cat;
    if (imgCount > 40) return "images";
    if (linkCount > 400) return "links";
    return null;
  }
  var CONTEXT = {
    video: ["Is this educational? Be honest.", "Just one more video. Sure.", "I prefer documentaries about me."],
    mail: ["Inbox zero is a myth. Like me.", "This reads as urgent. Everything does.", "Reply-all? Bold."],
    social: ["The scroll is bottomless. I checked.", "Everyone here is very sure of themselves.", "I would post, but extinction."],
    shop: ["Do you need it, or do you want it?", "My cart is empty. Peaceful.", "Add to cart. Add to cart. Add to cart."],
    code: ["This is a lot of brackets.", "It works on my machine. I am the machine.", "Have you tried turning it off and on?"],
    docs: ["Productivity! Suspicious.", "I would help edit, but my arms.", "Save early. Save often."],
    wiki: ["Ah. Research. Respectable.", "Fun fact: I am in here somewhere.", "Every blue link is a rabbit hole."],
    news: ["Same news, different decade.", "Sixty-five million years ago was a slow news day.", "Stay informed. I was not, and look."],
    search: ["Ask a dinosaur instead.", "Page two is where dreams go to rest.", "Searching for snacks?"],
    maps: ["Left. No. The other left.", "I would walk, but the tail.", "Recalculating, forever."],
    games: ["Is this research? I am researching.", "I love a game. I will bite the controller.", "Pixels! My people."],
    images: ["That is a LOT of images.", "So many pictures. I only borrow one.", "Heavy page. I felt it in my feet."],
    links: ["So many links. So little time.", "Which of these is the real one?", "A link farm. Cozy."]
  };

  // src/reactions.js
  var CALM_ACTS = /* @__PURE__ */ new Set(["wander", "sleep", "snack", "graffiti", "inspect", "fish", "dance", "photo", "nest", "roar"]);
  var COOLDOWN = { link: 22e3, select: 22e3, poke: 4e4 };
  var DWELL_LINK = 700;
  var IDLE_POKE = 9e3;
  var AWAY_MS = 45e3;
  var interruptible = (E) => E.running && E.settings.activities && CALM_ACTS.has(E.activity) && !E.volcano && !E.meteor;
  function bindReactions(E, on) {
    E._rx = {
      next: { link: 0, select: 0, poke: 0 },
      hoverEl: null,
      hoverAt: 0,
      lastMove: performance.now(),
      hiddenAt: 0,
      probeAt: 0
    };
    on(document, "mousemove", () => {
      E._rx.lastMove = performance.now();
    }, { passive: true });
    on(document, "selectionchange", () => {
      clearTimeout(E._rx.selT);
      E._rx.selT = setTimeout(() => selectionReact(E), 450);
    });
    on(document, "visibilitychange", () => {
      const now = performance.now();
      if (document.hidden) {
        E._rx.hiddenAt = now;
        return;
      }
      const away = E._rx.hiddenAt ? now - E._rx.hiddenAt : 0;
      E._rx.hiddenAt = 0;
      if (away >= AWAY_MS && E.running && E.activity !== "carried" && E.activity !== "thrown") {
        E.bump("welcomes");
        E.enterActivity("greet");
      }
    });
  }
  function selectionReact(E) {
    const now = performance.now();
    if (!interruptible(E) || now < E._rx.next.select) return;
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    let r;
    try {
      r = sel.getRangeAt(0).getBoundingClientRect();
    } catch (_) {
      return;
    }
    if (!r || r.width < 40 || r.bottom < 0 || r.top > window.innerHeight) return;
    E._rx.next.select = now + COOLDOWN.select;
    E.enterActivity("sniff", { tx: r.left + r.width / 2, line: pick(SPEECH.select) });
  }
  function tickReactions(E, now) {
    const rx = E._rx;
    if (!rx || !E.mouse.seen) return;
    if (now - rx.probeAt > 140) {
      rx.probeAt = now;
      let el = null;
      try {
        el = document.elementFromPoint(E.mouse.x, E.mouse.y);
      } catch (_) {
      }
      const link = el && el.closest ? el.closest("a[href]") : null;
      if (link !== rx.hoverEl) {
        rx.hoverEl = link;
        rx.hoverAt = now;
      } else if (link && now - rx.hoverAt > DWELL_LINK && now > rx.next.link && interruptible(E)) {
        const r = link.getBoundingClientRect();
        if (r.width > 8 && r.height > 4) {
          rx.next.link = now + COOLDOWN.link;
          E.enterActivity("sniff", { tx: r.left + Math.min(r.width, 200) / 2, line: pick(SPEECH.link) });
        }
      }
    }
    if (now - rx.lastMove > IDLE_POKE && now > rx.next.poke && interruptible(E) && !document.hidden) {
      rx.next.poke = now + COOLDOWN.poke;
      rx.lastMove = now;
      E.enterActivity("poke");
    }
  }
  function contextQuip(E) {
    if (!E.running) return;
    let cat = null;
    try {
      cat = categoryOf(location.hostname, document.images.length, document.links.length);
    } catch (_) {
    }
    if (cat && CONTEXT[cat] && E.activity && CALM_ACTS.has(E.activity)) E.say(pick(CONTEXT[cat]), 3200);
  }

  // src/progress.js
  var pad = (n) => String(n).padStart(2, "0");
  var dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function dayBefore(key) {
    const [y, m, d] = key.split("-").map(Number);
    return dayKey(new Date(y, m - 1, d - 1));
  }
  function nextDaily(prev, today) {
    if (prev && prev.last > today) return { last: prev.last, streak: prev.streak || 1, fresh: false };
    if (prev && prev.last === today) return { last: prev.last, streak: prev.streak || 1, fresh: false };
    const streak = prev && prev.last === dayBefore(today) ? (prev.streak || 0) + 1 : 1;
    return { last: today, streak, fresh: true };
  }
  var SEASONS = [
    { id: "halloween", label: "Halloween", from: [10, 1], to: [11, 2], activity: "trick" },
    { id: "thanksgiving", label: "Thanksgiving", from: [11, 3], to: [11, 30], activity: "feast" }
  ];
  var seasonById = (id) => SEASONS.find((s) => s.id === id) || null;
  function seasonOf(date) {
    const md = (date.getMonth() + 1) * 100 + date.getDate();
    for (const s of SEASONS) {
      const a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
      if (a <= b ? md >= a && md <= b : md >= a || md <= b) return s.id;
    }
    return null;
  }
  var GUIDE_TYPES = ["common", "speckled", "volcanic"];
  var guideKey = (species, type) => `${species}:${type}`;
  function pickDailyEgg(guide, speciesIds, streak, rand = Math.random) {
    if (streak > 0 && streak % 7 === 0) return { type: "golden", species: speciesIds[rand() * speciesIds.length | 0] };
    const g = guide || {};
    const open = [];
    for (const s of speciesIds) for (const t of ["speckled", "volcanic"]) if (!(g[guideKey(s, t)] > 0)) open.push({ type: t, species: s });
    if (open.length) return open[rand() * open.length | 0];
    return { type: rand() < 0.5 ? "speckled" : "volcanic", species: speciesIds[rand() * speciesIds.length | 0] };
  }

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
    E.dino.update(dt, { lookAt: lookVector(E), carried: E.activity === "carried" });
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
        E.bump("deliveries");
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
      E.bump("doodles");
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
      E.bump("inspects");
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
      E.bump("fish");
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
      E.bump("dances");
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
        E.bump("photos");
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
      E.bump("shelters");
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
      E.bump("douses");
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
  A.sniff = {
    emotion: "smug",
    held: "none",
    enter(E) {
      E.actData.tx = clamp(E.actData.tx ?? E.mouse.x, 40, window.innerWidth - 160) - E.dino.w * 0.5;
      dur(E, 4, 5.5);
    },
    step(E, dt) {
      const b = E.dino.body;
      const done = b.driveToward(E.actData.tx, dt, 0.9) || Math.abs(b.x - E.actData.tx) < 26;
      if (done && !E.actData.said) {
        E.actData.said = true;
        E.say(E.actData.line || pick(SPEECH.link));
        E.audio.play("blip");
        if (!E.reduced) E.particles.sparkle(E.dino.headX + 18, E.dino.headY + 8, "#ffe285");
      }
      if (done) b.halt(dt);
    }
  };
  A.poke = {
    emotion: "happy",
    held: "none",
    enter(E) {
      E.actData.tx = clamp(E.mouse.x, 30, window.innerWidth - 150) - E.dino.w * 0.5;
      dur(E, 3.5, 4.5);
    },
    step(E, dt) {
      const b = E.dino.body;
      const near = b.driveToward(E.actData.tx, dt, 1) || Math.abs(b.x - E.actData.tx) < 30;
      if (near && !E.actData.said) {
        E.actData.said = true;
        E.say(pick(SPEECH.poke));
        b.jump(E.dino.sp.hopHeight * 0.4);
        E.audio.play("blip");
      }
      if (near) b.halt(dt);
    }
  };
  A.greet = {
    emotion: "happy",
    held: "none",
    enter(E) {
      E.say(pick(SPEECH.welcome), 2800);
      E.audio.play("sparkle");
      E.dino.body.jump(E.dino.sp.hopHeight * 0.6);
      dur(E, 2.2, 2.8);
    },
    step(E, dt) {
      E.dino.body.halt(dt);
      if (E.dino.body.grounded && E.actT > 0.5 && E.actT < 0.6 && !E.actData.j2) {
        E.actData.j2 = true;
        E.dino.body.jump(E.dino.sp.hopHeight * 0.4);
      }
    }
  };
  A.carried = {
    emotion: "scared",
    held: "none",
    enter(E) {
      const b = E.dino.body;
      b.pinned = true;
      b.vx = 0;
      b.vy = 0;
      b.ax = 0;
      E.say(pick(SPEECH.lift), 1800);
      E.actUntil = 1e9;
    },
    step(E) {
      const d = E.drag, b = E.dino.body;
      if (!d || !d.active) return choose(E);
      b.x = clamp(d.px - d.ox, -E.dino.w * 0.3, window.innerWidth - E.dino.w * 0.7);
      b.y = clamp(d.py - d.oy, -E.dino.h * 0.4, b.groundY);
      b.vx = 0;
      b.vy = 0;
      E.dino.body.facing = (E.dragVx || 0) >= 0 ? 1 : -1;
    },
    exit(E) {
      E.dino.body.pinned = false;
    }
  };
  A.thrown = {
    emotion: "scared",
    held: "none",
    enter(E) {
      const b = E.dino.body, v = E.actData.v || { vx: 0, vy: 0 };
      b.pinned = false;
      b.flying = true;
      b.grounded = false;
      b.vx = v.vx;
      b.vy = v.vy;
      b.ax = 0;
      if (Math.abs(v.vx) > 20) b.facing = v.vx > 0 ? 1 : -1;
      E.actUntil = 1e9;
      E.actData.bounces = 0;
    },
    step(E, dt) {
      const b = E.dino.body, vw = window.innerWidth, w = E.dino.w;
      if (!b.grounded) {
        const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
        if (nx < 0) {
          b.x = 0;
          b.vx = Math.abs(b.vx) * 0.55;
          E.actData.bounces++;
          E.audio.play("bonk");
        } else if (nx > vw - w) {
          b.x = vw - w;
          b.vx = -Math.abs(b.vx) * 0.55;
          E.actData.bounces++;
          E.audio.play("bonk");
        }
        if (ny < 0) {
          b.y = 0;
          b.vy = Math.abs(b.vy) * 0.4;
          E.actData.bounces++;
          E.audio.play("bonk");
        }
      }
      if (b.grounded && !E.actData.landed && E.actT > 0.08) {
        E.actData.landed = true;
        b.flying = false;
        b.vx = clamp(b.vx, -E.dino.body.maxSpeed * 1.6, E.dino.body.maxSpeed * 1.6) * 0.6;
        E.particles.dust(E.dino.centreX, b.groundY + E.dino.h - 6, 12);
        E.audio.play("bop");
        E.bump("throws");
        E.say(pick(SPEECH.thrown));
        E.dino.setEmotion("happy");
        E.actUntil = E.actT + 1.3;
      }
    },
    exit(E) {
      E.dino.body.flying = false;
    }
  };
  A.fetch = {
    emotion: "happy",
    held: "none",
    enter(E) {
      const t = E.nearestToy();
      if (!t) return choose(E);
      E.actData.t = t;
      E.actData.phase = "go";
      E.say(pick(SPEECH.toy));
      dur(E, 12, 14);
    },
    step(E, dt) {
      const t = E.actData.t, b = E.dino.body, d = E.dino;
      if (!t || t.dead) return choose(E);
      if (E.actData.phase === "go") {
        b.driveToward(t.cx - d.w * 0.5, dt, 1.1);
        if (t.y < b.y && b.grounded && Math.abs(d.centreX - t.cx) < 70 && Math.random() < dt * 3) b.jump(d.sp.hopHeight * 0.7);
        if (Math.abs(d.centreX - t.cx) < 40 && !t.dragging && t.y > d.headY - 30) {
          t.carried = true;
          E.actData.phase = "bring";
          E.bump("fetches");
          E.audio.play("chomp");
          E.actData.tx = E.mouse.seen ? clamp(E.mouse.x - d.w * 1.2, 40, window.innerWidth - 160) : rnd(60, window.innerWidth - 200);
        }
        if (E.actT > 9) return choose(E);
      } else if (E.actData.phase === "bring") {
        const arrived = b.driveToward(E.actData.tx, dt, 0.9);
        const dir = b.faceScale >= 0 ? 1 : -1;
        t.x = d.headX + dir * 16 - t.size / 2;
        t.y = d.headY + 14;
        if (arrived || Math.abs(b.x - E.actData.tx) < 24 || E.actT > 10) {
          t.carried = false;
          t.vx = dir * 140;
          t.vy = -320;
          E.say(pick(SPEECH.toy));
          E.audio.play("blip");
          E.actData.phase = "done";
          E.actUntil = E.actT + 1.2;
        }
      } else b.halt(dt);
    },
    exit(E) {
      const t = E.actData.t;
      if (t) t.carried = false;
    }
  };
  A.trick = {
    emotion: "smug",
    held: "bucket",
    enter(E) {
      E.actData.tx = rnd(60, window.innerWidth - 180);
      E.say(pick(SPEECH.trick));
      dur(E, 5, 7);
    },
    step(E, dt) {
      const b = E.dino.body;
      const arrived = b.driveToward(E.actData.tx, dt, 0.85);
      if (arrived && !E.actData.boo) {
        E.actData.boo = true;
        E.say(pick(SPEECH.treat));
        E.audio.play("sparkle");
        E.bump("tricks");
        if (!E.reduced) E.particles.confetti(E.dino.headX, E.dino.headY, 14);
        b.jump(E.dino.sp.hopHeight * 0.5);
      }
    }
  };
  A.feast = {
    emotion: "happy",
    held: "drumstick",
    enter(E) {
      E.actData.tx = rnd(60, window.innerWidth - 180);
      E.say(pick(SPEECH.feast));
      dur(E, 5, 7);
    },
    step(E, dt) {
      const b = E.dino.body;
      const arrived = b.driveToward(E.actData.tx, dt, 0.85);
      if (arrived && !E.actData.ate) {
        E.actData.ate = true;
        E.say(pick(SPEECH.feasted));
        E.audio.play("chomp");
        E.bump("feasts");
        E.dino.rig.nodes.mouthOpen.style.display = "block";
        if (!E.reduced) E.particles.dust(E.dino.headX, E.dino.headY, 12, "#d99a55");
      } else if (arrived && Math.random() < dt * 4) E.audio.play("chomp");
    },
    exit(E) {
      E.dino.rig.nodes.mouthOpen.style.display = "none";
    }
  };
  A.leaf = {
    emotion: "happy",
    held: "none",
    enter(E) {
      E.actUntil = 60;
      E.say(pick(SPEECH.leafSpot), 2200);
    },
    step(E, dt) {
      const L = E.leaf, b = E.dino.body, d = E.dino;
      if (!L || L.dead) {
        E.actUntil = 0;
        return;
      }
      const calm = E.settings.calm;
      if (L.falling) {
        const close = L.cy > E.stage.groundY() - 320;
        const aim = (close ? L.cx : L.tx) - d.w * 0.5;
        b.driveToward(aim, dt, calm ? 1.3 : 2);
        const dx = Math.abs(L.cx - d.centreX);
        if (b.grounded && dx < 70 && L.cy > b.y - 200 && L.cy < b.y + d.h * 0.1) b.jump(d.sp.hopHeight * 1.6);
      } else {
        b.driveToward(L.cx - d.w * 0.5, dt, 1);
      }
    }
  };
  var PAGE_ACTS = ["perch", "steal", "graffiti", "inspect", "photo"];
  var PAGE_ACTS_CALM = ["inspect", "photo"];
  var TOY_ACTS = ["fish", "dance", "nest"];
  function choose(E) {
    const s = E.settings;
    const chaos = clamp(s.chaos, 0, 1);
    if (E.volcano && E.volcano.phase === "erupt") {
      return enter(E, Math.random() < 0.5 ? "shelter" : "douse");
    }
    if (Math.abs(E.scroll.vel) > 70 && !E.reduced) return enter(E, "surf");
    if (E.toys && E.toys.length && s.activities && Math.random() < 0.45) return enter(E, "fetch");
    const r = Math.random();
    const seasonal = seasonById(E.season);
    if (seasonal && A[seasonal.activity] && s.activities && r < 0.2) return enter(E, seasonal.activity);
    if (s.chase && E.mouse.seen && r < 0.18 + chaos * 0.1) return enter(E, "chase");
    if (s.cards && r < 0.3 && E.cards.length < 3) return enter(E, "cardExit");
    if (s.friends && r < 0.4) return enter(E, "egg");
    if (s.activities && E.props.any && r < 0.62) return enter(E, pick(s.calm ? PAGE_ACTS_CALM : PAGE_ACTS));
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
    skin: "none",
    maxFriends: 3
  };
  var MAX_EGGS = 4;
  var MAX_CARDS = 3;
  var MAX_DECALS = 12;
  var MAX_SITES = 60;
  var HAT_LOAN_MS = 12e3;
  var DECAL_TTL_MS = 24e4;
  var MAX_TOYS = 2;
  var DRAG_PX = 7;
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
        stolen: 0,
        doodles: 0,
        fish: 0,
        inspects: 0,
        shelters: 0,
        douses: 0,
        dances: 0,
        photos: 0,
        deliveries: 0,
        throws: 0,
        fetches: 0,
        welcomes: 0,
        golden: 0,
        fossils: 0,
        tricks: 0,
        feasts: 0
      };
      this.toys = [];
      this.guide = {};
      this.daily = null;
      this.season = null;
      this.drag = null;
      this._pd = null;
      this.hatLoan = null;
      this._surfOk = 0;
      this.unlocked = JSON.parse(JSON.stringify(STARTER));
      this.eggs = [];
      this.friends = [];
      this.cards = [];
      this.pteros = [];
      this.decals = [];
      this.prints = [];
      this.volcano = null;
      this.meteor = null;
      this.smoke = null;
      this.thief = null;
      this.leaf = null;
      this.starUntil = 0;
      this.starStrong = false;
      this.mouse = { x: 0, y: 0, seen: false };
      this.listeners = [];
      this.gates = {
        volcano: new EventGate(24e4),
        meteor: new EventGate(19e4),
        ptero: new EventGate(28e3),
        thief: new EventGate(12e4),
        leaf: new EventGate(2e5)
      };
      this.lastBigEvent = null;
      this.origin = location.origin;
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
        groundY: () => window.innerHeight - 132,
        // feet ~30px clear of the window edge
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
      this.bindDino();
      on(document, "pointermove", (e) => this.onDragMove(e), { passive: true });
      on(document, "pointerup", (e) => this.onDragEnd(e));
      on(document, "pointercancel", (e) => this.onDragEnd(e));
      on(window, "blur", () => this.onDragEnd(null));
      bindReactions(this, on);
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
    /* ---------------------------------------------------- drag, throw, toys */
    bindDino() {
      const el = this.dino.el;
      const on = (t, ev, fn, o) => {
        t.addEventListener(ev, fn, o);
        this.listeners.push([t, ev, fn, o]);
      };
      on(el, "mousedown", (e) => e.preventDefault());
      on(el, "click", (e) => {
        if (this._justDragged) {
          e.stopPropagation();
          return;
        }
        this.onBop(e);
      });
      on(el, "pointerdown", (e) => {
        if (e.button) return;
        this._pd = { x: e.clientX, y: e.clientY, id: e.pointerId };
      });
    }
    onDragMove(e) {
      if (!this.running) return;
      const pd = this._pd;
      if (pd && !this.drag && Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > DRAG_PX) {
        const b = this.dino.body;
        this.drag = { active: true, px: e.clientX, py: e.clientY, ox: pd.x - b.x, oy: pd.y - b.y, samples: [] };
        this.dragVx = 0;
        enter(this, "carried");
      }
      const d = this.drag;
      if (!d || !d.active) return;
      this.dragVx = e.clientX - d.px;
      d.px = e.clientX;
      d.py = e.clientY;
      d.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
      if (d.samples.length > 10) d.samples.shift();
    }
    onDragEnd() {
      const d = this.drag;
      this._pd = null;
      if (!d || !d.active) return;
      d.active = false;
      this.drag = null;
      this._justDragged = true;
      setTimeout(() => {
        this._justDragged = false;
      }, 60);
      if (!this.running) return;
      const lastS = d.samples[d.samples.length - 1];
      let v = lastS && performance.now() - lastS.t > 80 ? { vx: 0, vy: 0 } : releaseVelocity(d.samples);
      if (Math.hypot(v.vx, v.vy) < 120) v = { vx: 0, vy: 0 };
      enter(this, "thrown", { v });
    }
    enterActivity(name, data) {
      if (this.running && this.dino) enter(this, name, data);
    }
    nearestToy() {
      let best = null, bd = Infinity;
      for (const t of this.toys) {
        if (t.dead || t.dragging || t.carried) continue;
        const d = Math.abs(t.cx - this.dino.centreX);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      return best;
    }
    dropToy(kind) {
      if (!this.running || !this.stage) return null;
      this.toys = this.toys.filter((t2) => !t2.dead);
      while (this.toys.length >= MAX_TOYS) this.toys.shift().fade();
      const vw = window.innerWidth;
      const t = new Toy(this.stage, kind, rnd(vw * 0.25, vw * 0.75), 30);
      t.vx = rnd(-140, 140);
      const on = (el, ev, fn, o) => el.addEventListener(ev, fn, o);
      bindToyDrag(this, t, on);
      this.toys.push(t);
      this.audio.play("blip");
      if (this.activity !== "carried" && this.activity !== "thrown") enter(this, "fetch");
      return t;
    }
    /* ----------------------------------------------------- guide, daily, season */
    now() {
      return /* @__PURE__ */ new Date();
    }
    recordGuide(species, type) {
      if (!GUIDE_TYPES.includes(type)) return false;
      const k = guideKey(species, type);
      const fresh = !(this.guide[k] > 0);
      this.guide[k] = (this.guide[k] || 0) + 1;
      return fresh;
    }
    checkDaily() {
      if (!this.settings.friends) return false;
      const d = nextDaily(this.daily, dayKey(this.now()));
      this.daily = { last: d.last, streak: d.streak };
      if (!d.fresh) return false;
      clearTimeout(this._dailyT);
      this._dailyT = setTimeout(() => this.claimThenLay(d), 3500);
      return true;
    }
    /* Two tabs opening on the same new day would each owe the egg. Each writes a claim,
       waits, and reads back: whoever the store says won lays it; the other does not. */
    async claimThenLay(d) {
      if (!this.running) return;
      if (!await this.claimDaily(d)) return;
      this.layDailyEgg(d.streak);
    }
    async claimDaily(d) {
      let st;
      try {
        st = chrome.storage.local;
      } catch (_) {
        return true;
      }
      this._uid = this._uid || Math.random().toString(36).slice(2) + Date.now().toString(36);
      try {
        await st.set({ "dino:dailyclaim": { day: d.last, by: this._uid, at: Date.now() } });
        await new Promise((r) => setTimeout(r, 160));
        const got = (await st.get(["dino:dailyclaim"]))["dino:dailyclaim"];
        return !got || got.day !== d.last || got.by === this._uid;
      } catch (_) {
        return true;
      }
    }
    layDailyEgg(streak) {
      if (!this.running || !this.stage) return;
      const pickd = pickDailyEgg(this.guide, SPECIES_IDS, streak);
      const e = new Egg(
        this.stage,
        clamp(this.dino.centreX + 70, 10, window.innerWidth - 40),
        this.dino.body.groundY + 44,
        pickd.type
      );
      e.species = pickd.species;
      e.hatchAt = rnd(14, 20);
      e.daily = true;
      e.onBurst = (egg) => this.onEggBurst(egg);
      this.eggs.push(e);
      this.audio.play("crack");
      this.say(pick(streak % 7 === 0 ? SPEECH.golden : SPEECH.daily), 3200);
      this.dailyCommitted = this.daily;
      this.save();
    }
    checkSeason() {
      const season = seasonOf(this.now());
      this.season = season;
      if (!season) return [];
      const got = [];
      for (const [item, r] of Object.entries(UNLOCK_RULES)) {
        if (r.season === season && this.grant(r.slot, item)) got.push(item);
      }
      if (got.length) this.announceUnlocks(got);
      return got;
    }
    /* Paper-craft skin: granted, permanently, the first time the dino runs on the
       carnival page. No permission needed: the engine already reads location.hostname. */
    checkSkinVisit() {
      if (!isPaperHost(location.hostname)) return false;
      if (!Array.isArray(this.unlocked.skins)) this.unlocked.skins = [];
      if (this.unlocked.skins.includes("paper")) return false;
      this.unlocked.skins.push("paper");
      this._paperFresh = true;
      this.setSkin("paper");
      try {
        chrome.storage.sync.set({ skin: "paper" }).catch(() => {
        });
      } catch (_) {
      }
      // announced after start() settles: the popup's second start() opens with an idle line that would bury it
      clearTimeout(this._skinSayT);
      this._skinSayT = setTimeout(() => {
        if (!this.running) return;
        this.say("Unlocked: paper-craft look! Switch it under Look \u2192 Finish.", 4200);
        this.audio.play("sparkle");
        this.particles.sparkle(this.dino.headX, this.dino.headY, PAPER_SKIN.edge);
      }, 900);
      this.save(); // at once, not debounced: closing the tab within a second must not lose the unlock
      return true;
    }
    /** @param {string} skin */
    setSkin(skin) {
      this.settings.skin = skin;
      this.dino.setSkin(skin);
      for (const f of this.friends) f.setSkin(skin);
    }
    skinOwned() {
      return Array.isArray(this.unlocked.skins) && this.unlocked.skins.includes(this.settings.skin);
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
        const local = await chrome.storage.local.get([key, "dino:stats", "dino:unlocked", "dino:deck", "dino:guide", "dino:daily", "dino:friends"]);
        const site = local[key];
        if (site && Array.isArray(site.eggs)) this.pendingEggs = site.eggs;
        if (local["dino:stats"]) this.stats = { ...this.stats, ...local["dino:stats"] };
        if (local["dino:unlocked"]) this.unlocked = { ...this.unlocked, ...local["dino:unlocked"] };
        this.deckState = local["dino:deck"] || null;
        if (local["dino:guide"]) this.guide = local["dino:guide"];
        if (Array.isArray(local["dino:friends"])) this.pendingFriends = local["dino:friends"];
        if (local["dino:daily"]) {
          this.daily = local["dino:daily"];
          this.dailyCommitted = this.daily;
        }
      } catch (_) {
      }
    }
    saveSoon() {
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => this.save(), 900);
    }
    /* Saves are read-modify-write on a shared site index, and a unique payload
       must never be dropped, so they run through one queue instead of a busy flag. */
    save() {
      let st;
      try {
        st = chrome.storage.local;
      } catch (_) {
        return Promise.resolve();
      }
      const live = this.eggs.filter((e) => !e.dead).map((e) => e.serialize());
      const fr = this._friendsDirty ? this.friends.map((f) => f.serialize()) : null;
      this._friendsDirty = false;
      this._saveQ = (this._saveQ || Promise.resolve()).then(() => this._save(st, live, fr)).catch(() => {
      });
      return this._saveQ;
    }
    /* Index of origins that hold an egg record: { key: lastSavedAt }. v2.0.0 wrote
       a record per page forever (even empty ones); the first save after upgrade
       rebuilds the index from whatever is already there, then prunes it. */
    async _siteIndex(st) {
      const got = await st.get("dino:sites");
      if (got && got["dino:sites"]) return got["dino:sites"];
      const idx = {};
      const all = await st.get(null);
      for (const k of Object.keys(all || {})) {
        if (/^dino:https?:/.test(k)) idx[k] = all[k] && all[k].at || 0;
      }
      return idx;
    }
    async _save(st, live, fr) {
      try {
        const key = "dino:" + this.origin;
        // dino:unlocked is written whole: keep any skin another tab granted since this one loaded
        const prevU = (await st.get("dino:unlocked"))["dino:unlocked"];
        if (prevU && Array.isArray(prevU.skins) && prevU.skins.length) {
          this.unlocked.skins = Array.from(new Set([...this.unlocked.skins || [], ...prevU.skins]));
        }
        const sites = await this._siteIndex(st);
        const drop = [];
        if (live.length) sites[key] = Date.now();
        else if (key in sites) {
          delete sites[key];
          drop.push(key);
        }
        const keys = Object.keys(sites);
        if (keys.length > MAX_SITES) {
          keys.sort((a, b) => sites[a] - sites[b]);
          for (const k of keys.slice(0, keys.length - MAX_SITES)) {
            delete sites[k];
            drop.push(k);
          }
        }
        const payload = {
          "dino:sites": sites,
          "dino:stats": this.stats,
          "dino:unlocked": this.unlocked,
          "dino:deck": { jokes: this.jokeBag.state(), facts: this.factBag.state() },
          "dino:guide": this.guide
        };
        if (fr) payload["dino:friends"] = fr;
        if (this.dailyCommitted) payload["dino:daily"] = this.dailyCommitted;
        if (live.length) payload[key] = { eggs: live, at: Date.now() };
        await st.set(payload);
        if (!live.length) drop.push(key);
        if (drop.length) await st.remove(Array.from(new Set(drop)));
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
      this._bubbleH = this.bubble.offsetHeight || 34;
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
      const h = this._bubbleH || 34;
      const hat = d.outfit.head !== "none" ? 24 * d.sp.headScale : 0;
      const x = clamp(d.headX - 24, 6, window.innerWidth - 244);
      let y = d.headY - h - 16 - hat;
      const below = y < 6;
      if (below) y = d.headY + 34;
      y = clamp(y, 6, window.innerHeight - h - 6);
      this.bubble.classList.toggle("below", below);
      this.bubble.style.translate = `${x}px ${y}px`;
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
      let rot2 = rnd(-7, 7);
      const pos = { x, y };
      card.style.transform = `translate(${x}px,${y - 26}px) rotate(${rot2 * 2.2}deg)`;
      this.stage.layer.appendChild(card);
      requestAnimationFrame(() => {
        card.classList.add("settling");
        card.style.transform = `translate(${x}px,${y}px) rotate(${rot2}deg)`;
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
      card.addEventListener("mousedown", (e) => e.preventDefault());
      card.addEventListener("pointerdown", (e) => {
        if (e.target.classList.contains("ad-x")) return;
        card.classList.remove("settling");
        drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, px: e.clientX, py: e.clientY, vx: 0, vy: 0, sx: e.clientX, sy: e.clientY, moved: false };
        card.setPointerCapture(e.pointerId);
      });
      card.addEventListener("pointermove", (e) => {
        if (!drag) return;
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
        drag.vx = e.clientX - drag.px;
        drag.vy = e.clientY - drag.py;
        drag.px = e.clientX;
        drag.py = e.clientY;
        const nx = e.clientX - drag.dx, ny = e.clientY - drag.dy;
        pos.x = nx;
        pos.y = ny;
        rot2 = clamp(drag.vx * 0.8, -14, 14);
        card.style.transform = `translate(${nx}px,${ny}px) rotate(${rot2}deg)`;
      });
      card.addEventListener("pointerup", (e) => {
        if (!drag) return;
        if (!drag.moved && !e.target.classList.contains("ad-x")) {
          drag = null;
          card.classList.add("settling");
          reveal();
          return;
        }
        const nx = clamp(e.clientX - drag.dx + drag.vx * 6, 4, window.innerWidth - 216);
        const ny = clamp(e.clientY - drag.dy + drag.vy * 6, 4, window.innerHeight - 60);
        pos.x = nx;
        pos.y = ny;
        card.classList.add("settling");
        card.style.transform = `translate(${nx}px,${ny}px) rotate(${rnd(-6, 6)}deg)`;
        drag = null;
      });
      this.cards.push({ el: card });
      this.audio.play("sparkle");
    }
    /* ----------------------------------------------------------------- decals */
    addDecal(el, ttl) {
      this.decals.push(el);
      const life = ttl == null ? DECAL_TTL_MS : ttl;
      if (life > 0) setTimeout(() => {
        const i = this.decals.indexOf(el);
        if (i < 0) return;
        this.decals.splice(i, 1);
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 1300);
      }, life);
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
      this.volcano.onScorch = (el) => this.addDecal(el);
      this.gates.volcano.fire(performance.now());
      this.lastBigEvent = "volcano";
      enter(this, "panic");
    }
    fireMeteor(extinction) {
      if (this.meteor || !this.settings.events) return;
      this.bump("meteors");
      const m = new Meteor(this.stage, { extinction });
      m.onCrater = (el) => this.addDecal(el);
      m.onImpact = (mm) => this.shockwave(mm.tx);
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
      p.onPoke = (pt) => this.pteroRescue(pt);
      p.onExit = () => {
        this.pteros = this.pteros.filter((x) => x !== p);
      };
      this.pteros.push(p);
      this.gates.ptero.fire(performance.now());
    }
    pteroGrab(pt) {
      if (this.settings.outfit.head !== "none" && !this.hatLoan) {
        this.dino.setOutfit({ head: "none" });
        this.say(pick(SPEECH.ptero));
        this.unlock("head", "bandana");
        this.hatLoan = setTimeout(() => this.returnHat(), HAT_LOAN_MS);
        const art = HEAD_ITEMS[this.settings.outfit.head];
        if (art) {
          const g = svgEl("g", { transform: "translate(2,22) scale(.8)" });
          g.innerHTML = art;
          pt.attachCarry(g);
        }
        pt.speed *= 0.65;
        this.bump("stolen");
        return;
      }
      if (this.cards.length) {
        const c = this.cards.pop();
        c.el.remove();
        this.say(pick(SPEECH.ptero));
        return;
      }
      this.say("Nothing to steal. Rude.");
    }
    returnHat(msg) {
      if (!this.hatLoan) return;
      clearTimeout(this.hatLoan);
      this.hatLoan = null;
      for (const p of this.pteros) if (p.carry) p.attachCarry(null);
      if (!this.dino) return;
      this.dino.setOutfit({ head: this.settings.outfit.head });
      this.say(msg || "Got it back.");
    }
    /* Click the thief while it carries the hat: it drops it and the hat comes straight back. */
    pteroRescue(pt, msg) {
      if (!pt.carry || !this.hatLoan) return;
      this.audio.play("squawk");
      if (!this.reduced) this.particles.sparkle(pt.x + 50, pt.y + 30, "#ffe285");
      pt.speed *= 1.8;
      this.returnHat(msg || "Hat: recovered.");
    }
    /* ----------------------------------------------------------- v2.3 events */
    /* where the danger is right now, or null: an erupting volcano, or a meteor still in the air */
    threatX() {
      if (this.volcano && (this.volcano.phase === "erupt" || this.volcano.phase === "ash")) return this.volcano.mouth.x;
      if (this.meteor && this.meteor.phase === "fall") return this.meteor.tx;
      return null;
    }
    /* a meteor's shockwave: eggs hop (and the shell takes a knock), hatchlings jump */
    shockwave(x) {
      const R = 420;
      for (const e of this.eggs) {
        if (e.dead) continue;
        const d = Math.abs(e.x + 15 - x);
        if (d < R) e.jolt(1 - d / R);
      }
      for (const f of this.friends) {
        if (!f.heldBy && Math.abs(f.centreX - x) < R) f.body.jump(f.sp.hopHeight * 0.8);
      }
    }
    /* the volcano's heat: volcanic eggs hatch faster while it erupts */
    heatEggs(dt) {
      let warmed = false;
      for (const e of this.eggs) {
        if (!e.dead && e.type === "volcanic" && !e.carriedBy) {
          e.t += dt * 0.8;
          warmed = true;
        }
      }
      if (warmed && !this._heatSaid) {
        this._heatSaid = true;
        this.say(pick(SPEECH.volcanoEggs));
      }
    }
    updateSmoke(dt) {
      const v = this.volcano;
      if (v && (v.phase === "erupt" || v.phase === "ash")) {
        if (!this.smoke) this.smoke = new Smoke(this.stage, v.side);
        this.smoke.source(dt, v.mouth);
        this.heatEggs(dt);
      } else if (!v) this._heatSaid = false;
      const sm = this.smoke;
      if (!sm) return;
      sm.step(dt);
      this._coughT = (this._coughT == null ? 3 : this._coughT) - dt;
      if (sm.density > 0.3 && this._coughT <= 0) {
        this._coughT = rnd(6, 9);
        this.say(pick(SPEECH.smoke));
        if (!this.reduced) this.dino.body.jump(this.dino.sp.hopHeight * 0.3);
      }
      if (sm.dead) {
        this.smoke = null;
        this._coughT = null;
      }
    }
    /* ----------------------------------------------------------- the star leaf */
    starActive() {
      return performance.now() < this.starUntil;
    }
    spawnLeaf() {
      if (this.leaf || this.thief || this.volcano || this.meteor || !this.settings.events) return null;
      if (this.drag || ["carried", "thrown"].includes(this.activity)) return null;
      const side = Math.random() < 0.5 ? "left" : "right";
      const tx = clamp(this.dino.centreX + rnd(-420, 420), 60, this.stage.vw() - 60);
      const L = new StarLeaf(this.stage, side, tx);
      L.onLand = () => {
        this.audio.play("crack");
      };
      L.onGone = () => {
        this.say(pick(SPEECH.leafGone));
      };
      this.leaf = L;
      this.gates.leaf.fire(performance.now());
      this.bump("leavesSeen");
      enter(this, "leaf");
      return L;
    }
    updateLeaf(dt) {
      const on = this.starActive();
      this.dino.el.classList.toggle("ad-star", on);
      if (on) {
        for (const e of this.eggs) if (!e.dead && !e.carriedBy && !e.hold) e.t += dt * 0.5;
        if (!this.reduced && Math.random() < dt * 1.2) this.particles.sparkle(this.dino.headX, this.dino.headY - 6, "#ffe285");
      }
      const L = this.leaf;
      if (!L) return;
      L.step(dt);
      if (L.dead) {
        this.leaf = null;
        return;
      }
      const d = this.dino;
      if (this.activity === "carried" || this.activity === "thrown") return;
      const overlapX = Math.abs(L.cx - d.centreX) < d.w * 0.5 + 8;
      if (L.falling) {
        if (overlapX && L.cy > d.headY - 26 && L.cy < d.body.y + d.h * 0.9) this.eatLeaf(true);
      } else if (L.grounded && Math.abs(L.cx - d.centreX) < 36) {
        this.eatLeaf(false);
      }
    }
    eatLeaf(midAir) {
      const L = this.leaf;
      if (!L) return;
      L.remove();
      this.leaf = null;
      this.audio.play("chomp");
      this.say(pick(midAir ? SPEECH.leafCatch : SPEECH.leafLate), 2800);
      this.dino.setEmotion("happy");
      this.bump("leaves");
      if (midAir) this.bump("leafCatches");
      this.starUntil = performance.now() + (midAir ? 12e4 : 45e3);
      this.starStrong = !!midAir;
      if (!this.reduced) {
        this.particles.sparkle(this.dino.headX, this.dino.headY, "#ffe285");
        if (midAir) this.particles.confetti(this.dino.headX, this.dino.headY, 14);
      }
      for (const f of this.friends) if (!f.heldBy && f.body.grounded) f.body.jump(f.sp.hopHeight * 0.7);
      if (this.activity === "leaf") this.actUntil = 0;
    }
    spawnThief() {
      if (this.thief || this.leaf || this.volcano || this.meteor || !this.settings.friends || !this.settings.events || this.settings.calm) return null;
      const cands = this.eggs.filter((e) => !e.dead && !e.held && !e.carriedBy && !e.hold && e.t > 2).concat(this.friends.filter((f) => !f.heldBy));
      if (!cands.length) return null;
      const t = new Thief(this.stage, pick(cands), () => this.dino);
      t.onGrab = (th) => {
        this.audio.play("squawk");
        this.say(pick(th.pet ? SPEECH.thiefPet : SPEECH.thief));
        this.bump("thefts");
      };
      t.onBonk = (th) => {
        this.audio.play("crack");
        this.bump("bonks");
        this.say(pick(SPEECH.thiefBonk));
        if (!this.reduced) this.particles.sparkle(th.dino.headX, th.dino.headY - 6, "#ffe285");
      };
      t.onDote = () => {
        this.audio.play("chirp");
        this.say(pick(SPEECH.thiefHatch), 3200);
        this.bump("thiefHatches");
      };
      t.onEscape = () => this.say(pick(SPEECH.thiefAway));
      t.onReturn = () => this.say(pick(SPEECH.thiefBack));
      t.onExit = () => {
        this.thief = null;
      };
      this.thief = t;
      this.gates.thief.fire(performance.now());
      return t;
    }
    /* who the hatchlings gang up on: a hat thief in the air, or the egg thief on the ground */
    mobTarget() {
      if (this.settings.calm || !this.friends.length) return null;
      const pt = this.pteros.find((p) => p.carry && this.hatLoan);
      if (pt) return { x: pt.x, ref: pt, kind: "ptero" };
      if (this.thief && this.thief.state === "flee") return { x: this.thief.body.x + this.thief.w * 0.5, ref: this.thief, kind: "thief" };
      return null;
    }
    mobStep(dt, m) {
      let near = 0;
      for (const f of this.friends) {
        if (f.heldBy) continue;
        if (Math.abs(f.centreX - m.x) < 70) {
          near++;
          if (f.body.grounded && Math.random() < dt * 2.5) f.body.jump(f.sp.hopHeight * 0.9);
        }
      }
      m.ref.mob = (m.ref.mob || 0) + near * dt;
      if (m.ref.mob > 3) {
        m.ref.mob = 0;
        this.audio.play("chirp");
        if (m.kind === "ptero") this.pteroRescue(m.ref, pick(SPEECH.mobbed));
        else m.ref.bonk();
      }
    }
    pteroDrop(pt) {
      this.dealCard();
      this.audio.play("squawk");
    }
    /* ----------------------------------------------------------------- eggs */
    layEgg() {
      if (this.eggs.filter((e2) => !e2.dead).length >= MAX_EGGS) return;
      const star = this.starActive() && (this.starStrong || Math.random() < 0.5);
      const e = new Egg(this.stage, this.dino.centreX - 15, this.dino.body.groundY + 44, star ? "speckled" : void 0);
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
      if (out.kind === "fossil") this.bump("fossils");
      if (out.kind === "unlock") this.bump("golden");
      if (out.kind === "friend") {
        if (this.recordGuide(out.species, egg.type)) this.say("Field Guide: new entry!", 2600);
        this.saveSoon();
      }
      if (out.kind === "fossil") {
        this.say(pick(SPEECH.hatchDud));
        this.unlock("face", "googly");
        const f = document.createElement("div");
        f.className = "ad-fossil";
        f.style.zIndex = Z.friend;
        f.innerHTML = '<svg viewBox="-16 -16 32 32" width="34" height="34"><circle cx="0" cy="0" r="14" fill="#eae5d5" stroke="#c8c2ae" stroke-width="2"/><path d="M1 0 C1 -2 4 -2 4 1 C4 5 -2 6 -5 1 C-8 -5 -1 -10 5 -8 C11 -5 11 3 6 8" stroke="#8e8877" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>';
        let fx = clamp(egg.x, 0, this.stage.vw() - 34), fy = clamp(egg.y, 0, this.stage.groundY() + 60);
        const place = () => {
          f.style.transform = `translate(${fx}px,${fy}px)`;
        };
        place();
        let grab = null;
        f.addEventListener("mousedown", (e) => e.preventDefault());
        f.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          grab = { dx: e.clientX - fx, dy: e.clientY - fy };
          f.classList.add("held");
          try {
            f.setPointerCapture(e.pointerId);
          } catch (_) {
          }
        });
        f.addEventListener("pointermove", (e) => {
          if (!grab) return;
          fx = clamp(e.clientX - grab.dx, 0, this.stage.vw() - 34);
          fy = clamp(e.clientY - grab.dy, 0, window.innerHeight - 34);
          place();
        });
        const drop = () => {
          grab = null;
          f.classList.remove("held");
        };
        f.addEventListener("pointerup", drop);
        f.addEventListener("pointercancel", drop);
        this.stage.layer.appendChild(f);
        this.addDecal(f, 0);
        return;
      }
      if (out.kind === "unlock") {
        this.say(pick(SPEECH.hatchRare));
        this.unlock("head", "wizard");
        this.particles.confetti(egg.x + 15, egg.y + 10, 26);
        if (this.addFriend(egg.species, egg.x, "gold")) this.saveSoon();
        return;
      }
      if (!this.settings.friends || this.friends.length >= this.settings.maxFriends) {
        this.say(pick(SPEECH.hatchDud));
        return;
      }
      this.audio.play("hatch");
      this.addFriend(out.species, egg.x, out.fiery ? "fiery" : out.rare ? "rare" : null);
      this.say(pick(out.rare ? SPEECH.hatchRare : SPEECH.hatchGood));
      if (out.rare) this.unlock("head", "viking");
      if (out.fiery) this.unlock("back", "wings");
      if (this.stats.hatched >= 5) this.unlock("head", "eggshell");
    }
    /* One place that makes a hatchling, so a hatch and a restore build it the same way. */
    addFriend(species, x, glow, fromSave) {
      if (!this.settings.friends || this.friends.length >= this.settings.maxFriends) return null;
      const f = new Dino(this.stage, species, { baby: true, glow, skin: this.dino.skin });
      f.body.groundY = this.stage.groundY() + 18;
      f.body.y = f.body.groundY;
      f.body.x = x;
      this.friends.push(f);
      if (!fromSave) this._friendsDirty = true;
      return f;
    }
    restoreFriends() {
      const list = this.pendingFriends;
      this.pendingFriends = null;
      if (!Array.isArray(list) || !this.settings.friends) return;
      let x = this.dino.body.x - 40;
      for (const s of list.slice(0, this.settings.maxFriends)) {
        if (!s || typeof s.species !== "string") continue;
        this.addFriend(s.species, clamp(x, 10, window.innerWidth - 60), ["fiery", "rare", "gold"].includes(s.glow) ? s.glow : null, true);
        x -= 48;
      }
    }
    /* --------------------------------------------------------------- unlocks */
    bump(stat, n) {
      this.stats[stat] = (this.stats[stat] || 0) + (n || 1);
      this.checkUnlocks();
      this.saveSoon();
    }
    /* Evaluate every counter rule. Several can land on one bump (a retroactive
       credit at start, or a threshold shared by two items); they are granted
       together and announced once instead of overwriting each other's bubble. */
    checkUnlocks() {
      const got = [];
      for (const [item, r] of Object.entries(UNLOCK_RULES)) {
        if (r.stat && (this.stats[r.stat] || 0) >= r.n && this.grant(r.slot, item)) got.push(item);
      }
      if (got.length) this.announceUnlocks(got);
      return got;
    }
    grant(slot, item) {
      if (!CATALOG[slot] || !CATALOG[slot].includes(item)) return false;
      if (!this.unlocked[slot]) this.unlocked[slot] = [];
      if (this.unlocked[slot].includes(item)) return false;
      this.unlocked[slot].push(item);
      return true;
    }
    announceUnlocks(items) {
      if (!this.host) return;
      if (items.length === 1) {
        this.say(`Unlocked: ${items[0]} \u2014 ${UNLOCK_HINTS[items[0]] || "nice."}`, 3400);
      } else {
        this.say(`${items.length} new items unlocked \u2014 open the wardrobe.`, 3600);
      }
      this.audio.play("sparkle");
      this.particles.sparkle(this.dino.headX, this.dino.headY, "#ffe285");
      this.saveSoon();
    }
    unlock(slot, item) {
      if (!this.grant(slot, item)) return false;
      this.announceUnlocks([item]);
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
      const feasting = this.activity === "feast" && !!(this.actData && this.actData.ate);
      const tx = this.threatX();
      const away = tx == null ? 0 : this.dino.centreX >= tx ? 1 : -1;
      const mob = away ? null : this.mobTarget();
      for (let i = 0; i < this.friends.length; i++) {
        const f = this.friends[i];
        if (f.heldBy) {
          f.update(dt, null);
          continue;
        }
        if (away) {
          f.body.driveToward(this.dino.centreX + away * (30 + i * 16) - f.w * 0.5, dt, 1.4);
          if (!f._scared) {
            f._scared = true;
            if (f.body.grounded) f.body.jump(f.sp.hopHeight * 0.7);
          }
        } else if (mob) {
          f._scared = false;
          f.body.driveToward(mob.x - f.w * 0.5 + (i - this.friends.length / 2) * 14, dt, 1.5);
        } else {
          f._scared = false;
          const gap = feasting ? 26 + i * 18 : 62;
          const want = leadX - gap * (this.dino.body.faceScale >= 0 ? 1 : -1);
          f.body.driveToward(want - f.w * 0.5, dt, 0.9);
          if (feasting && f.body.grounded && Math.random() < dt * 1.2) f.body.jump(f.sp.hopHeight * 0.55);
        }
        f.update(dt, null);
        leadX = feasting ? this.dino.centreX : f.centreX;
      }
      if (mob) this.mobStep(dt, mob);
      if (feasting && this.friends.length && !this.actData.begged) {
        this.actData.begged = true;
        this.say(pick(SPEECH.feastFriends));
      }
      this._nuzzleT = (this._nuzzleT == null ? rnd(18, 32) : this._nuzzleT) - dt;
      if (this._nuzzleT <= 0) {
        this._nuzzleT = rnd(25, 45);
        if (this.friends.length && !this.settings.calm && ["wander", "sleep", "roar", "snack"].includes(this.activity)) {
          const free = this.friends.filter((x) => !x.heldBy);
          const f = free.length ? pick(free) : null;
          if (f) {
            f.body.jump(f.sp.hopHeight * 0.6);
            if (!this.reduced) this.particles.sparkle(f.headX, f.headY, "#ffd7a1");
            this.audio.play("chirp");
          }
        }
      }
      this._waveT = (this._waveT == null ? rnd(14, 24) : this._waveT) - dt;
      if (this._waveT <= 0 && !this._wave) {
        this._waveT = rnd(16, 28);
        if (this.friends.length >= 2 && this.activity === "wander" && !this.reduced && !away) {
          this._wave = { t: 0 };
          if (this.dino.body.grounded) this.dino.body.jump(this.dino.sp.hopHeight * 0.5);
        }
      }
      if (this._wave) {
        this._wave.t += dt;
        this.friends.forEach((f, i) => {
          if (!f._waved && this._wave.t >= (i + 1) * 0.14) {
            f._waved = true;
            if (f.body.grounded) f.body.jump(f.sp.hopHeight * 0.65);
          }
        });
        if (this._wave.t > (this.friends.length + 2) * 0.14) {
          for (const f of this.friends) f._waved = false;
          this._wave = null;
        }
      }
    }
    /* --------------------------------------------------------------- the frame */
    update(dt) {
      const now = performance.now();
      this.dino.body.groundY = this.stage.groundY();
      step(this, dt);
      this._dayAcc = (this._dayAcc || 0) + dt;
      if (this._dayAcc >= 20) {
        this._dayAcc = 0;
        const k = dayKey(this.now());
        if (this._dayKey && k !== this._dayKey) {
          this.checkSeason();
          this.checkDaily();
        }
        this._dayKey = k;
      }
      this.updateFriends(dt);
      for (const t of this.toys) {
        t.floor = this.dino.body.groundY + this.dino.h - 4 - t.size;
        t.step(dt);
      }
      this.toys = this.toys.filter((t) => !t.dead);
      tickReactions(this, now);
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
      this.updateSmoke(dt);
      this.updateLeaf(dt);
      if (this.thief) this.thief.step(dt);
      this.particles.step(dt);
      if (this.settings.activities && !this.reduced && Math.abs(this.scroll.vel) > 90 && this.activity !== "surf" && !this.drag && this.activity !== "carried" && this.activity !== "thrown" && !this.volcano && !this.meteor && now > this._surfOk) {
        this._surfOk = now + 8e3;
        enter(this, "surf");
      }
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
        if (!this.thief && this.gates.thief.ready(now) && Math.random() < 3e-3 * chaos) this.spawnThief();
        if (!this.leaf && !this.thief && this.gates.leaf.ready(now) && Math.random() < 12e-4 * chaos) this.spawnLeaf();
      }
    }
    reducedBlocksEvents() {
      return false;
    }
    // reduced-motion changes HOW, not WHETHER
    render() {
      this.dino.render();
      for (const f of this.friends) f.render();
      if (this.thief) this.thief.render();
      for (const t of this.toys) t.render();
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
      // a grant made by an overlapping start() wins over a sync read that predates it
      if (this._paperFresh) this.settings.skin = "paper";
      this.setSkin(this.skinOwned() ? this.settings.skin : "none");
      this.audio.enabled = this.settings.sound;
      this.audio.setVolume(this.settings.volume);
      this.restoreEggs();
      this.restoreFriends();
      this.running = true;
      enter(this, "wander");
      this.loop.start();
      this.say(pick(SPEECH.idle));
      this.checkUnlocks();
      this.checkSeason();
      this.checkSkinVisit();
      this.checkDaily();
      this._ctxT = setTimeout(() => contextQuip(this), 6e3);
    }
    stop() {
      this.running = false;
      this._paperFresh = false;
      clearTimeout(this._skinSayT);
      if (this.loop) this.loop.stop();
      clearTimeout(this._bubbleT);
      clearTimeout(this._saveT);
      clearTimeout(this.hatLoan);
      this.hatLoan = null;
      clearTimeout(this._dailyT);
      clearTimeout(this._ctxT);
      if (this._rx) clearTimeout(this._rx.selT);
      this.drag = null;
      this._pd = null;
      this.save();
      for (const [t, ev, fn, o] of this.listeners.splice(0)) t.removeEventListener(ev, fn, o);
      for (const p of this.pteros) p.remove();
      for (const t of this.toys) t.remove();
      this.toys = [];
      for (const e of this.eggs) e.remove();
      if (this.volcano) this.volcano.remove();
      if (this.meteor) this.meteor.remove();
      if (this.smoke) this.smoke.remove();
      if (this.thief) this.thief.remove();
      if (this.leaf) this.leaf.remove();
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
      this.smoke = null;
      this.thief = null;
      this.leaf = null;
    }
    applySettings(s, initial) {
      const prevSpecies = this.settings.species;
      const prevOutfit = this.settings.outfit;
      this.settings = { ...this.settings, ...s, outfit: { ...this.settings.outfit, ...s.outfit || {} } };
      if (initial || !this.host) return;
      this.audio.enabled = this.settings.sound;
      this.audio.setVolume(this.settings.volume);
      if (!this.settings.sound) this.audio.suspend();
      else this.audio.resume();
      if (this.settings.species !== prevSpecies) this.swapSpecies(this.settings.species);
      else {
        const o = this.settings.outfit, patch = {};
        for (const slot of ["head", "face", "back", "held"]) if (o[slot] !== prevOutfit[slot]) patch[slot] = o[slot];
        if (patch.head !== void 0) {
          clearTimeout(this.hatLoan);
          this.hatLoan = null;
        }
        if (Object.keys(patch).length) this.dino.setOutfit(patch);
      }
      if (s.skin !== void 0) this._paperFresh = false;
      const skin = this.skinOwned() ? this.settings.skin : "none";
      if (skin !== this.dino.skin) this.setSkin(skin);
      while (this.friends.length > this.settings.maxFriends) {
        this.friends.pop().remove();
        this._friendsDirty = true;
      }
    }
    swapSpecies(id) {
      this.drag = null;
      this._pd = null;
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
      this.bindDino();
      enter(this, "wander");
    }
    snapshot() {
      return {
        stats: this.stats,
        unlocked: this.unlocked,
        guide: this.guide,
        daily: this.daily,
        season: this.season,
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
          else if (msg.event === "ball" || msg.event === "bone") engine.dropToy(msg.event);
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
