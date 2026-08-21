// Canvas particle layer. Prism shards, sparks, coins and light rays — all drawn
// as flat polygons with additive blending, which is what makes them read as
// refracted light rather than as dust.
//
// Two rules learned the expensive way on Emberkeep and carried here deliberately:
//  1. The SIMULATION is inviolable; the RENDERER gives way. Under load the layer
//     sheds particles, it never slows the game.
//  2. Never allocate a gradient per particle per frame. Everything here is a
//     filled path with a solid hsl colour; the glow comes from 'lighter'.

const TAU = Math.PI * 2;

export class Particles {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.p = [];
    this.motes = [];
    this.max = 900;
    this.running = false;
    this.reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.hues = [190, 220, 280, 320];   // overridden per theme
    this.last = 0;
    this._resize();
    globalThis.addEventListener?.('resize', () => this._resize());
    // A window-resize listener alone is not enough: this canvas's box changes when
    // the LAYOUT changes without the window doing anything — a rail pane opening, a
    // win-detail card appearing, fonts settling after boot. Observing the element
    // itself is the only signal that covers all of those.
    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(canvas);
    }
  }

  _resize() {
    const r = this.cv.getBoundingClientRect();
    // Guard against a zero/absent box (element hidden, or measured before layout):
    // writing width=0 would silently discard every subsequent draw.
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.motes.length === 0) this._seedMotes();
  }

  /**
   * DISABLED over the reels. Free-drifting motes were the original "why do only
   * some reels have animation" report: at any instant a few cells had a speck on
   * them and the rest did not, so the grid read as inconsistently animated. The
   * per-cell ambient layer is CSS now, identical in all 15 cells and in phase.
   * Kept as code because the emitters below still use the same machinery.
   */
  _seedMotes() {
    const n = 0;
    for (let i = 0; i < n; i++) {
      this.motes.push({
        x: Math.random() * this.w, y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 5, vy: -4 - Math.random() * 7,
        r: 0.8 + Math.random() * 1.9, hue: this.hues[Math.floor(Math.random() * this.hues.length)] + (Math.random() - 0.5) * 24,
        a: 0.12 + Math.random() * 0.22, ph: Math.random() * TAU,
      });
    }
  }

  /** Theme palette for the ambient layer. Re-tints existing motes in place so a
   *  skin switch is instant rather than waiting for them to drift off-screen. */
  setHues(hues) {
    if (Array.isArray(hues) && hues.length) {
      this.hues = hues;
      for (const m of this.motes) m.hue = hues[Math.floor(Math.random() * hues.length)] + (Math.random() - 0.5) * 24;
    }
  }

  start() { if (!this.running) { this.running = true; this.last = 0; requestAnimationFrame((t) => this._frame(t)); } }
  stop() { this.running = false; }
  clear() { this.p.length = 0; }

  _push(o) {
    if (this.reduced) return;
    if (this.p.length >= this.max) this.p.shift();   // shed, never stall
    this.p.push(o);
  }

  // --- emitters ------------------------------------------------------------
  /** Prism shards blowing out of a winning cell. */
  shards(x, y, hue, n = 18, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (70 + Math.random() * 190) * power;
      this._push({
        k: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * power,
        life: 0.6 + Math.random() * 0.7, age: 0, g: 620,
        r: 2.4 + Math.random() * 4.6 * power, rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 11, hue: hue + (Math.random() - 0.5) * 44, a: 0.95,
      });
    }
  }

  sparks(x, y, hue, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 150;
      this._push({
        k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.5, age: 0, g: 90,
        r: 1 + Math.random() * 2, hue, a: 1,
      });
    }
  }

  /** A coin arcing toward the counter. */
  coin(x, y, tx, ty) {
    this._push({
      k: 'coin', x, y, tx, ty, t: 0, life: 0.62, age: 0,
      r: 6 + Math.random() * 3, rot: 0, vr: 9, hue: 46, a: 1,
      ax: x + (tx - x) * 0.4 + (Math.random() - 0.5) * 180, ay: Math.min(y, ty) - 90 - Math.random() * 70,
    });
  }

  /** A horizontal light sweep — used when the Prism Meter fills. */
  sweep(hue = 280) {
    this._push({ k: 'sweep', x: -this.w * 0.3, y: 0, vx: this.w * 2.1, vy: 0, life: 0.75, age: 0, hue, a: 0.5, r: 0, g: 0 });
  }

  /** Big-win rain. Count is capped so a Grand cannot melt the frame. */
  rain(n = 90, hue = 280) {
    const k = Math.min(n, this.max - this.p.length);
    for (let i = 0; i < k; i++) {
      this._push({
        k: 'shard', x: Math.random() * this.w, y: -20 - Math.random() * this.h * 0.5,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 200,
        life: 1.6 + Math.random() * 1.4, age: 0, g: 260,
        r: 3 + Math.random() * 5, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8,
        hue: hue + (Math.random() - 0.5) * 90, a: 0.9,
      });
    }
  }

  ring(x, y, hue) {
    this._push({ k: 'ring', x, y, r: 4, vr: 340, life: 0.5, age: 0, hue, a: 0.8, vx: 0, vy: 0, g: 0 });
  }

  // --- loop ----------------------------------------------------------------
  _frame(t) {
    if (!this.running) return;
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0.016;
    this.last = t;
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';

    for (const m of this.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.ph += dt * 1.6;
      if (m.y < -10) { m.y = this.h + 10; m.x = Math.random() * this.w; }
      if (m.x < -10) m.x = this.w + 10; else if (m.x > this.w + 10) m.x = -10;
      c.globalAlpha = m.a * (0.55 + 0.45 * Math.sin(m.ph));
      c.fillStyle = `hsl(${m.hue} 92% 76%)`;
      c.beginPath(); c.arc(m.x, m.y, m.r, 0, TAU); c.fill();
    }

    for (let i = this.p.length - 1; i >= 0; i--) {
      const o = this.p[i];
      o.age += dt;
      if (o.age >= o.life) { this.p.splice(i, 1); continue; }
      const u = o.age / o.life;
      const fade = 1 - u * u;

      if (o.k === 'coin') {
        // quadratic bezier toward the counter, so it lands where the number is
        const s = u, is = 1 - s;
        const x = is * is * o.x + 2 * is * s * o.ax + s * s * o.tx;
        const y = is * is * o.y + 2 * is * s * o.ay + s * s * o.ty;
        o.rot += o.vr * dt;
        c.globalAlpha = fade;
        c.save(); c.translate(x, y); c.rotate(o.rot);
        c.fillStyle = `hsl(46 100% 72%)`;
        c.beginPath();
        c.ellipse(0, 0, o.r, o.r * Math.abs(Math.cos(o.rot)) * 0.9 + o.r * 0.15, 0, 0, TAU);
        c.fill();
        c.restore();
        continue;
      }
      if (o.k === 'sweep') {
        o.x += o.vx * dt;
        c.globalAlpha = fade * o.a;
        const g = 120;
        c.fillStyle = `hsl(${o.hue} 95% 78%)`;
        c.fillRect(o.x, 0, g, this.h);
        continue;
      }
      if (o.k === 'ring') {
        o.r += o.vr * dt;
        c.globalAlpha = fade * o.a;
        c.strokeStyle = `hsl(${o.hue} 95% 76%)`;
        c.lineWidth = 3 * fade + 0.6;
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, TAU); c.stroke();
        continue;
      }

      o.vy += o.g * dt;
      o.x += o.vx * dt; o.y += o.vy * dt;
      c.globalAlpha = fade * o.a;
      c.fillStyle = `hsl(${o.hue} 94% ${o.k === 'spark' ? 88 : 68}%)`;
      if (o.k === 'spark') {
        c.beginPath(); c.arc(o.x, o.y, o.r * fade + 0.4, 0, TAU); c.fill();
      } else {
        o.rot += o.vr * dt;
        c.save(); c.translate(o.x, o.y); c.rotate(o.rot);
        const r = o.r * (0.4 + fade * 0.6);
        c.beginPath();
        c.moveTo(0, -r * 1.6); c.lineTo(r * 0.7, 0); c.lineTo(0, r * 1.6); c.lineTo(-r * 0.7, 0);
        c.closePath(); c.fill();
        c.restore();
      }
    }

    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    requestAnimationFrame((t2) => this._frame(t2));
  }

  get count() { return this.p.length; }
}
