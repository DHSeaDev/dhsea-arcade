// Emberkeep - Mountain — the air.
//
// Everything in this file is about making a small pile of cubes read as a PLACE. Almost none of it
// is rendering technology; it is composition and colour, which is the finding that shaped the
// whole cycle — Sky, Journey, Firewatch and Gris all won their atmosphere with flat shapes, one
// strong silhouette, one dominant sky colour and a disciplined value ramp, not with simulation.
//
// NOTHING HERE CAN TAKE ANYTHING FROM THE PLAYER. Sky's weather is a light economy: rain eats your
// cape charge, dark water eats light, Eden's storm is a scripted attrition curve that converts
// everything you have gathered into a walk of exhaustion. That is a beautiful piece of design and
// it is the exact thing this game deleted. Weather here is mood, and at most it HIDES — which
// routes through the `lit` mechanism the completability proof already models. It never drains.

// ---------------------------------------------------------------------------
// NOISE. Written rather than imported, deliberately.
// simplex-noise is MIT and 4KB and would have done. But value-noise fBm is forty lines, is
// visually indistinguishable from simplex at this art scale, and carries no licence file and no
// attribution surface. Taking a dependency to avoid forty lines you fully understand is a bad
// trade — and the research's own conclusion for this whole cycle was "stylise, don't approximate".
const P = new Uint8Array(512);
(() => {
  let n = 0x9e3779b1;
  const r = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
  const t = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [t[i], t[j]] = [t[j], t[i]]; }
  for (let i = 0; i < 512; i++) P[i] = t[i & 255];
})();
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);

export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = P[X] + Y, b = P[X + 1] + Y;
  return lerp(
    lerp(grad(P[a], x, y), grad(P[b], x - 1, y), u),
    lerp(grad(P[a + 1], x, y - 1), grad(P[b + 1], x - 1, y - 1), u), v) * 0.5;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += noise2(x * f, y * f) * a; a *= 0.5; f *= 2; }
  return s;
}

// ---------------------------------------------------------------------------
// WIND. Air is invisible; wind is only ever inferred from what it moves.
//
// Sucker Punch's account of Ghost of Tsushima is the load-bearing finding: they chose VOLUME OF
// VISIBLE RESPONSE over physical accuracy. Wind is not a fluid simulation and does not need to be
// — it is one global direction plus time-varying noise, and then four or five completely unrelated
// things all agreeing on that direction at once. The agreement is the whole effect. One swaying
// banner is a banner; a banner, drifting ash, a leaning flame and a lagging chain all tilting the
// same way at the same moment is weather.
export class Wind {
  constructor(seed = 1) {
    this.seed = seed;
    this.t = 0;
    this.dir = 1;            // -1 or 1 along the screen x axis
    this.base = 0.5;
    this.gust = 0;
  }
  step(dt) {
    this.t += dt;
    // two non-harmonic periods, so the gusting never settles into an audible rhythm
    // fbm's rms here is ~0.09, so it needs a real gain to be felt. Measured rather than guessed —
    // a noise function's output range is an empirical fact about the implementation, not a given.
    this.gust = fbm(this.t * 0.11 + this.seed, this.seed * 0.37, 3) * 7.0
              + Math.sin(this.t * 0.23 + this.seed) * 0.22;
  }
  // strength at a point, -1..1 ish. Passing the point in lets receivers at different places lag,
  // which is what stops the whole screen pulsing in lockstep.
  at(x = 0, y = 0) {
    return this.dir * (this.base + this.gust) * (0.7 + 0.3 * Math.sin(x * 0.008 + y * 0.011 + this.t * 0.4));
  }
}

// ---------------------------------------------------------------------------
// WEATHER. One system per chapter, chosen for mood.
//
// Particles are pre-rendered ONCE into offscreen canvases and blitted. Canvas 2D's bottleneck is
// fill and draw calls, not maths — stroking an arc per flake per frame is how a snow effect ends
// up costing more than the entire rest of the scene.
// NOT 'motes'. The first version called the drifting ambient particle a mote, which is also the
// name of the COLLECTIBLE — so the screen filled with bright specks and three of them were worth
// something. A weather particle that looks like a pickup is a lie the game tells the player about
// what is worth walking to. Renamed, dimmed, and thinned to a third of the count.
export const WEATHER = ['none', 'rain', 'snow', 'ash', 'sand', 'spores'];

let SPR = null;
function sprites() {
  if (SPR || typeof document === 'undefined') return SPR;
  const mk = (size, draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    return c;
  };
  const soft = (r, g2, b) => (x, s) => {
    const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, `rgba(${r},${g2},${b},1)`);
    gr.addColorStop(1, `rgba(${r},${g2},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, s, s);
  };
  SPR = {
    flake: mk(16, soft(232, 240, 255)),
    ember: mk(20, soft(255, 176, 92)),
    dust: mk(14, soft(226, 206, 172)),
    splash: mk(18, soft(190, 214, 240)),
  };
  return SPR;
}

export class Weather {
  constructor(kind, w, h, seed = 1) {
    this.kind = kind;
    this.w = w; this.h = h;
    this.t = 0;
    this.seed = seed;
    let n = seed >>> 0;
    this.rnd = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
    this.p = [];
    const counts = { none: 0, rain: 380, snow: 230, ash: 150, sand: 300, spores: 42 };
    // PREFERS-REDUCED-MOTION IS A VESTIBULAR REQUEST, NOT A STYLE PREFERENCE. Hundreds of
    // particles drifting across a full-screen scene is exactly the pattern it is asking about.
    // The weather is not removed — it is thinned to a tenth, so the chapter still reads as
    // raining without a moving field filling the viewport.
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.calm = calm;
    const N = Math.round((counts[kind] ?? 0) * (calm ? 0.1 : 1));
    for (let i = 0; i < N; i++) this.p.push(this._spawn(true));
    this.splashes = [];
  }
  _spawn(anywhere) {
    const r = this.rnd;
    return {
      x: r() * this.w * 1.25 - this.w * 0.12,
      y: anywhere ? r() * this.h : -20 - r() * 60,
      // THREE PARALLAX DEPTHS. Weather at one depth reads as a screen effect pasted over the game;
      // three reads as weather the scene is inside of.
      z: 0.45 + r() * 0.85,
      ph: r() * 6.28,
      life: 0,
    };
  }
  step(dt, wind) {
    this.t += dt;
    if (this.kind === 'none') return;
    const W = wind.at(0, 0);
    for (const q of this.p) {
      const d = q.z;
      switch (this.kind) {
        case 'rain':
          q.y += 640 * dt * d; q.x += W * 150 * dt * d;
          break;
        case 'snow':
          q.y += 46 * dt * d;
          q.x += (W * 40 + Math.sin(this.t * 0.7 + q.ph) * 22) * dt * d;
          break;
        case 'ash':
          q.y += 26 * dt * d - Math.sin(this.t * 0.4 + q.ph) * 6 * dt;
          q.x += (W * 55 + Math.sin(this.t * 0.31 + q.ph * 1.7) * 18) * dt * d;
          break;
        case 'sand':
          q.x += (W * 320 + 90) * dt * d;
          q.y += Math.sin(this.t * 1.1 + q.ph) * 26 * dt;
          break;
        case 'spores':
          q.y -= (7 + Math.sin(this.t * 0.5 + q.ph) * 5) * dt * d;
          q.x += (W * 26 + Math.sin(this.t * 0.27 + q.ph) * 12) * dt * d;
          break;
      }
      if (q.y > this.h + 30 || q.y < -80 || q.x > this.w * 1.2 || q.x < -this.w * 0.2) {
        if (this.kind === 'rain' && q.y > this.h + 30 && this.splashes.length < 40) {
          this.splashes.push({ x: q.x, y: this.h - 4 - this.rnd() * this.h * 0.5, t: 0, z: q.z });
        }
        Object.assign(q, this._spawn(false));
        if (this.kind === 'spores') q.y = this.h + 20;
        if (this.kind === 'sand') { q.x = -this.w * 0.15; q.y = this.rnd() * this.h; }
      }
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      this.splashes[i].t += dt;
      if (this.splashes[i].t > 0.35) this.splashes.splice(i, 1);
    }
  }
  draw(g) {
    if (this.kind === 'none') return;
    const S = sprites();
    if (!S) return;
    if (this.kind === 'rain') {
      g.save();
      g.strokeStyle = 'rgba(186,208,236,.30)';
      g.lineCap = 'round';
      for (const q of this.p) {
        g.globalAlpha = 0.12 + q.z * 0.24;
        g.lineWidth = 0.7 + q.z * 0.9;
        g.beginPath();
        g.moveTo(q.x, q.y);
        g.lineTo(q.x - q.z * 3.5, q.y - 12 - q.z * 12);   // velocity skew, not a vertical stick
        g.stroke();
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter';
      for (const s of this.splashes) {
        const u = s.t / 0.35, r = 3 + u * 9;
        g.globalAlpha = (1 - u) * 0.22 * s.z;
        g.drawImage(S.splash, s.x - r, s.y - r * 0.4, r * 2, r * 0.8);
      }
      g.restore();
      return;
    }
    g.save();
    const add = this.kind === 'ash' || this.kind === 'spores';
    if (add) g.globalCompositeOperation = 'lighter';
    const spr = this.kind === 'snow' ? S.flake : this.kind === 'sand' ? S.dust
              : this.kind === 'ash' ? S.ember : S.ember;
    for (const q of this.p) {
      const r = (this.kind === 'snow' ? 1.7 : this.kind === 'sand' ? 2.4 : this.kind === 'spores' ? 1.3 : 2.1) * q.z * 2.4;
      g.globalAlpha = (this.kind === 'sand' ? 0.13 : this.kind === 'spores' ? 0.10 : 0.24) * q.z;
      g.drawImage(spr, q.x - r, q.y - r, r * 2, r * 2);
    }
    g.restore();
  }
  // A sandstorm is not particles alone — it is a colour cast over everything, which is the part
  // that actually sells it. Returns an overlay the renderer paints after the scene.
  cast() {
    if (this.kind === 'sand') return { c: 'rgba(196,164,110,.10)', a: 1 };
    if (this.kind === 'rain') return { c: 'rgba(120,150,190,.07)', a: 1 };
    if (this.kind === 'snow') return { c: 'rgba(200,214,238,.05)', a: 1 };
    return null;
  }
}

// ---------------------------------------------------------------------------
// AMBIENT LIFE — the difference between a place and a diorama.
// The rule that matters: SEVERAL NON-HARMONIC PERIODS. If every drifting thing shares a period, or
// shares a multiple of one, the scene visibly loops and the eye catches it within a minute.
export class Ambient {
  constructor(w, h, seed = 3) {
    let n = seed >>> 0;
    const r = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
    this.w = w; this.h = h; this.t = 0;
    this.clouds = [];
    for (let i = 0; i < 7; i++) this.clouds.push({
      x: r() * w * 1.4 - w * 0.2, y: h * (0.04 + r() * 0.34),
      w: 220 + r() * 460, h: 20 + r() * 40,
      // primes over a common base, so no two layers share a period
      sp: (2 + i * 1.7) * (r() < 0.5 ? 1 : 0.6), a: 0.012 + r() * 0.022,
    });
    this.birds = [];
    this.nextBird = 4 + r() * 14;
    this.r = r;
  }
  step(dt) {
    this.t += dt;
    for (const c of this.clouds) {
      c.x += c.sp * dt;
      if (c.x - c.w > this.w * 1.2) c.x = -c.w - this.r() * 200;
    }
    // birds cross at intervals. Not always, not never — something happening while you do nothing
    this.nextBird -= dt;
    if (this.nextBird <= 0 && this.birds.length < 3) {
      this.nextBird = 9 + this.r() * 22;
      const dir = this.r() < 0.5 ? 1 : -1;
      this.birds.push({
        x: dir > 0 ? -60 : this.w + 60, y: this.h * (0.08 + this.r() * 0.28),
        dir, sp: 46 + this.r() * 40, ph: this.r() * 6.28, n: 3 + (this.r() * 3 | 0),
      });
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.x += b.dir * b.sp * dt;
      b.y += Math.sin(this.t * 0.8 + b.ph) * 6 * dt;
      if (b.x < -120 || b.x > this.w + 120) this.birds.splice(i, 1);
    }
  }
  drawClouds(g, tint) {
    for (const c of this.clouds) {
      g.globalAlpha = c.a;
      g.fillStyle = tint;
      g.beginPath();
      g.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, 7);
      g.fill();
      g.beginPath();
      g.ellipse(c.x + c.w * 0.18, c.y - c.h * 0.22, c.w / 3.2, c.h / 2.6, 0, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  drawBirds(g) {
    g.strokeStyle = 'rgba(24,22,32,.42)';
    g.lineWidth = 1.4;
    for (const b of this.birds) {
      for (let i = 0; i < b.n; i++) {
        const x = b.x - b.dir * i * 15, y = b.y + Math.sin(this.t * 3 + i) * 4 + i * 5;
        const f = Math.sin(this.t * 7 + b.ph + i * 0.7) * 4;
        g.beginPath();
        g.moveTo(x - 6, y + f); g.lineTo(x, y); g.lineTo(x + 6, y + f);
        g.stroke();
      }
    }
    g.lineWidth = 1;
  }
}
