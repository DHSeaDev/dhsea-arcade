// Emberkeep — VFX. Pooled particles, layered fire, smoke, cinders, ash, dust, and the
// heat-trail Ember drags behind him.
//
// Layering is the whole difference between "a fire effect" and fire. Parameters follow the
// standard two-emitter construction (a flame body plus a sparser, longer-lived, wider-spread
// cinder layer), scaled to our 20px tiles, with a third non-additive smoke layer on top —
// smoke is the part that makes additive fire read as burning rather than as glowing.
//
// Everything here is COSMETIC. The trail leaves heat and scorch; it cannot ignite anything.
// Ignition lives in physics.js and only ever happens from an aimed shot.

import { FLAME, CINDER, SMOKE, GLOW, blit, ramp } from './sprites.js';

const MAX = 900;

export class VFX {
  constructor() {
    this.p = new Array(MAX);
    for (let i = 0; i < MAX; i++) this.p[i] = { on: false };
    this.head = 0;
    this.trail = [];       // {x, y, born} — scorch + heat under Ember's feet
    this.dust = [];
    this.seeded = false;
  }

  _get() {
    for (let i = 0; i < MAX; i++) {
      const q = this.p[(this.head + i) % MAX];
      if (!q.on) { this.head = (this.head + i + 1) % MAX; return q; }
    }
    return this.p[this.head = (this.head + 1) % MAX];   // pool full: recycle oldest slot
  }

  spawn(type, x, y, o = {}) {
    const q = this._get();
    q.on = true; q.type = type; q.x = x; q.y = y;
    q.vx = o.vx ?? 0; q.vy = o.vy ?? 0;
    q.size = o.size ?? 3; q.dsize = o.dsize ?? 0;
    q.life = q.maxLife = o.life ?? 30;
    q.drag = o.drag ?? 1; q.hue = o.hue ?? 0;
    return q;
  }

  // ---- emitters ---------------------------------------------------------
  // A tile that is catching, then fully burning. Rate and spread widen with the stage.
  emitTileFire(cx, cy, stage, rnd = Math.random) {
    const heat = stage === 'catching' ? 0.45 : 1;
    const n = stage === 'catching' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const a = (85 + rnd() * 10) * Math.PI / 180;
      const sp = (1.0 + rnd() * 2.4) * heat;
      this.spawn('flame', cx + (rnd() - 0.5) * 16, cy + (rnd() - 0.5) * 12, {
        vx: Math.cos(a) * sp * (rnd() < 0.5 ? -1 : 1) * 0.5, vy: -Math.sin(a) * sp,
        size: (3.5 + rnd() * 4.5) * heat, dsize: -0.09, life: 26 + rnd() * 12, drag: 0.955,
      });
    }
    if (rnd() < 0.22 * heat) {                       // cinders: sparser, wider, longer-lived
      const a = (85 + rnd() * 40) * Math.PI / 180;
      this.spawn('cinder', cx + (rnd() - 0.5) * 14, cy, {
        vx: Math.cos(a) * (1.6 + rnd() * 1.6) * (rnd() < 0.5 ? -1 : 1), vy: -(2.2 + rnd() * 1.8),
        size: 1.0 + rnd() * 1.1, dsize: -0.004, life: 48 + rnd() * 32, drag: 0.985,
      });
    }
    if (rnd() < 0.30 * heat) {
      this.spawn('smoke', cx + (rnd() - 0.5) * 14, cy - 6, {
        vx: (rnd() - 0.5) * 0.5, vy: -(0.5 + rnd() * 0.7),
        size: 5 + rnd() * 5, dsize: 0.16, life: 80 + rnd() * 60, drag: 0.995,
      });
    }
  }

  emitCollapse(cx, cy, rnd = Math.random) {
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      this.spawn('ash', cx, cy, {
        vx: Math.cos(a) * (0.6 + rnd() * 1.8), vy: -Math.abs(Math.sin(a)) * (1 + rnd() * 2),
        size: 1 + rnd() * 2, dsize: -0.005, life: 60 + rnd() * 50, drag: 0.97,
      });
    }
    for (let i = 0; i < 8; i++) {
      this.spawn('smoke', cx + (rnd() - 0.5) * 16, cy, {
        vx: (rnd() - 0.5) * 0.8, vy: -(0.6 + rnd() * 0.9),
        size: 7 + rnd() * 7, dsize: 0.2, life: 90 + rnd() * 70, drag: 0.99,
      });
    }
  }

  // in-flight: a little back-blown flame, so the shot leaves something behind it
  emitShot(x, y, vx, vy, rnd = Math.random) {
    for (let i = 0; i < 2; i++) {
      this.spawn('flame', x, y, {
        vx: -vx * 0.16 + (rnd() - 0.5) * 0.8, vy: -vy * 0.16 - rnd() * 0.5,
        size: 2.4 + rnd() * 2.2, dsize: -0.13, life: 14 + rnd() * 10, drag: 0.92,
      });
    }
  }

  // the muzzle flash, once, at the moment of firing — the beat the spark was missing
  emitMuzzle(x, y, dir, rnd = Math.random) {
    for (let i = 0; i < 10; i++) {
      const spread = (rnd() - 0.5) * 1.1;
      this.spawn('flame', x, y, {
        vx: dir * (1.4 + rnd() * 3.2), vy: spread * 2.2 - 0.4,
        size: 3.2 + rnd() * 3.4, dsize: -0.22, life: 10 + rnd() * 9, drag: 0.86,
      });
    }
    for (let i = 0; i < 6; i++) {
      this.spawn('cinder', x, y, {
        vx: dir * (2.2 + rnd() * 4), vy: (rnd() - 0.5) * 2.6,
        size: 1 + rnd() * 1.2, dsize: -0.01, life: 20 + rnd() * 22, drag: 0.9,
      });
    }
  }

  emitFizzle(x, y, rnd = Math.random) {
    for (let i = 0; i < 5; i++) {
      this.spawn('flame', x, y, {
        vx: (rnd() - 0.5) * 2.4, vy: (rnd() - 0.5) * 2.4 - 0.8,
        size: 2.6 + rnd() * 2.4, dsize: -0.2, life: 10 + rnd() * 8, drag: 0.88,
      });
    }
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2;
      this.spawn('cinder', x, y, {
        vx: Math.cos(a) * (1 + rnd() * 2), vy: Math.sin(a) * (1 + rnd() * 2) - 0.6,
        size: 0.9 + rnd(), dsize: -0.012, life: 22 + rnd() * 20, drag: 0.93,
      });
    }
  }

  emitBurst(x, y, n, rnd = Math.random) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      this.spawn('cinder', x, y, {
        vx: Math.cos(a) * (1.4 + rnd() * 2.6), vy: Math.sin(a) * (1.4 + rnd() * 2) - 1,
        size: 1 + rnd() * 1.4, dsize: -0.01, life: 30 + rnd() * 34, drag: 0.94,
      });
    }
  }

  // The trail. He does not choose this — it is what he is.
  walkTrail(x, y, t, rnd = Math.random) {
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.abs(last.x - x) > 7) {
      this.trail.push({ x, y, born: t });
      if (this.trail.length > 90) this.trail.shift();
      if (rnd() < 0.5) this.spawn('flame', x + (rnd() - 0.5) * 5, y - 2, {
        vx: (rnd() - 0.5) * 0.4, vy: -(0.5 + rnd() * 0.9),
        size: 1.8 + rnd() * 1.8, dsize: -0.075, life: 16 + rnd() * 12, drag: 0.94,
      });
    }
  }

  seedDust(w, h, rnd = Math.random) {
    this.dust = [];
    for (let i = 0; i < 120; i++) this.dust.push({
      x: rnd() * w, y: rnd() * h, ph: rnd() * 6.28, sp: 0.10 + rnd() * 0.22, r: 0.5 + rnd() * 1.1,
    });
    this.seeded = true;
  }

  // ---- update -----------------------------------------------------------
  update() {
    for (let i = 0; i < MAX; i++) {
      const q = this.p[i];
      if (!q.on) continue;
      q.x += q.vx; q.y += q.vy;
      q.vx *= q.drag; q.vy *= q.drag;
      if (q.type === 'smoke') q.vy -= 0.012;
      if (q.type === 'ash') q.vy += 0.035;
      if (q.type === 'cinder') q.vy += 0.022;
      q.size += q.dsize;
      if (--q.life <= 0 || q.size <= 0.2) q.on = false;
    }
  }

  // ---- draw -------------------------------------------------------------
  // Additive pass: everything that emits light. Drawn to the glow buffer so it can bloom.
  // Every emissive particle is now ONE drawImage of a pre-baked sprite. The colour ramp survives
  // as a 10-step atlas; nothing here allocates.
  drawGlow(g, t) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < MAX; i++) {
      const q = this.p[i];
      if (!q.on) continue;
      const k = q.life / q.maxLife;
      if (q.type === 'flame') blit(g, ramp(FLAME, k), q.x, q.y, q.size, Math.min(1, k * 1.6) * 0.5);
      else if (q.type === 'cinder') blit(g, ramp(CINDER, k), q.x, q.y, q.size * 1.6, k * 0.95);
    }
    for (const m of this.trail) {
      const age = t - m.born;
      if (age > 150) continue;
      const k = 1 - age / 150;
      blit(g, GLOW.ember, m.x, m.y, 9 * k + 3, 0.30 * k * k);
    }
    g.globalCompositeOperation = 'source-over';
  }

  // Non-additive pass: smoke and ash occlude rather than glow.
  drawSmoke(g) {
    for (let i = 0; i < MAX; i++) {
      const q = this.p[i];
      if (!q.on) continue;
      const k = q.life / q.maxLife;
      if (q.type === 'smoke') {
        blit(g, SMOKE, q.x, q.y, q.size, Math.sin(Math.PI * k) * 0.16);
      } else if (q.type === 'ash') {
        g.fillStyle = `rgba(26,21,19,${k * 0.72})`;
        g.fillRect(q.x, q.y, q.size, q.size);
      }
    }
  }

  // Scorch stays after the heat is gone. Ember leaves a record of where he has been.
  drawScorch(g, t) {
    for (const m of this.trail) {
      const age = t - m.born;
      const a = age < 150 ? 0.30 : Math.max(0, 0.30 - (age - 150) / 2600);
      if (a <= 0.004) continue;
      g.fillStyle = `rgba(22,16,14,${a})`;
      g.beginPath(); g.ellipse(m.x, m.y + 1, 6, 2.2, 0, 0, 7); g.fill();
    }
  }

  drawDust(g, cx, cy, rad, t) {
    for (const d of this.dust) {
      const x = d.x + Math.sin(t * 0.004 + d.ph) * 14;
      const y = d.y - ((t * d.sp) % 420) + 210;
      const dd = Math.hypot(x - cx, y - cy);
      if (dd > rad) continue;
      const a = (1 - dd / rad) * 0.30;
      g.fillStyle = `rgba(255,214,168,${a})`;
      g.beginPath(); g.arc(x, ((y % 400) + 400) % 400, d.r, 0, 7); g.fill();
    }
  }

  liveCount() { let n = 0; for (let i = 0; i < MAX; i++) if (this.p[i].on) n++; return n; }
  reset() { for (let i = 0; i < MAX; i++) this.p[i].on = false; this.trail = []; }
}
