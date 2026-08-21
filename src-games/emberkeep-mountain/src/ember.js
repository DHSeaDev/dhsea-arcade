// Emberkeep - Mountain — Ember, isometric.
//
// He is drawn in SCREEN space at his node's projected position, not modelled as geometry. Nothing
// is gained by making the protagonist out of cubes: the whole point of the character is that he is
// the one soft, moving, warm thing in a world of hard flat stone, and that contrast is the read.
// Monument Valley does the same with Ida — a white triangle and a dot, legible at any size.
//
// The flame is a short verlet chain, as in the platformer. The face is the same three channels
// that mattered there — brow, eye, mouth — because three is the whole of facial expression at this
// scale and there is no fourth worth having.

const SEG = 6, SEGLEN = 4.6, RIG_HZ = 30;
const BLINK_CLOSE = 3, BLINK_OPEN = 6, BLINK_MEAN = 30 * 6.6;

// No 'guttering' and no 'worried-about-fuel'. He cannot run out here, so the states that existed
// to communicate danger have nothing to communicate and are gone rather than left as decoration.
const EXPR = {
  calm:    { h: 1.00, agit: 0.30, lid: 0.00, brow: 0.00, mouth: 0.12, curve: 0.25 },
  walking: { h: 1.06, agit: 0.45, lid: 0.00, brow: -0.25, mouth: 0.22, curve: 0.18 },
  wonder:  { h: 1.20, agit: 0.55, lid: 0.00, brow: -0.70, mouth: 0.55, curve: 0.35 },
  puzzled: { h: 0.92, agit: 0.35, lid: 0.12, brow: 0.60, mouth: 0.18, curve: -0.30 },
  pleased: { h: 1.26, agit: 0.75, lid: 0.05, brow: -0.50, mouth: 0.66, curve: 0.90 },
  sleepy:  { h: 0.76, agit: 0.15, lid: 0.60, brow: 0.20, mouth: 0.16, curve: -0.05 },
  // LEARNED. Sky makes expressiveness itself the collectible — you unlock emotes, then levels of
  // the same emote, so what grows is your vocabulary rather than your stats. These six are taught
  // by the wisps Ember relights, and he cannot perform one he has not been shown.
  proud:   { h: 1.34, agit: 0.60, lid: 0.05, brow: -0.30, mouth: 0.30, curve: 0.55 },
  careful: { h: 0.84, agit: 0.20, lid: 0.30, brow: 0.45, mouth: 0.10, curve: -0.15 },
  shy:     { h: 0.80, agit: 0.30, lid: 0.40, brow: 0.25, mouth: 0.14, curve: 0.20 },
  kind:    { h: 1.08, agit: 0.35, lid: 0.22, brow: -0.30, mouth: 0.34, curve: 0.70 },
  brave:   { h: 1.22, agit: 0.50, lid: 0.00, brow: 0.50, mouth: 0.24, curve: 0.05 },
  joy:     { h: 1.44, agit: 0.95, lid: 0.00, brow: -0.85, mouth: 0.80, curve: 1.00 },
};
export const EXPR_NAMES = Object.keys(EXPR);

export class Ember {
  constructor() {
    this.pts = [];
    this.acc = 0; this.frame = 0; this.tt = 0;
    this.expr = 'calm';
    this.blend = { ...EXPR.calm };
    this.seeded = false;
    this.blinkT = 40 + Math.random() * BLINK_MEAN;
    this.blinkP = -1; this.blinkAmp = 1;
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0, hold: 0 };
    this.jx = 0; this.jy = 0;
    this.rnd = 0x2545f491;
    this.lean = 0;
    this.grow = 0;
  }
  _r() { this.rnd = (this.rnd * 1664525 + 1013904223) >>> 0; return this.rnd / 4294967296; }

  // Asymmetric per the Disney blink study: the close accelerates, the open decelerates. A
  // symmetric blink is the single clearest tell that a face was animated by a programmer.
  _blink() {
    if (this.blinkP < 0) return 0;
    const i = this.blinkP;
    if (i < BLINK_CLOSE) { const u = i / BLINK_CLOSE; return this.blinkAmp * u * u; }
    const u = (i - BLINK_CLOSE) / BLINK_OPEN;
    return this.blinkAmp * (1 - u) * (2 - (1 - u));
  }

  _seed(x, y) {
    this.pts = [];
    for (let i = 0; i < SEG; i++) this.pts.push({ x, y: y - i * SEGLEN, px: x, py: y - i * SEGLEN });
    this.seeded = true;
  }

  update(dt, sx, sy, moving, expr) {
    if (!this.seeded) this._seed(sx, sy);
    this.tt += dt; this.acc += dt;
    const stepT = 1 / RIG_HZ;
    let guard = 0;
    while (this.acc >= stepT && guard++ < 3) {
      this.acc -= stepT;
      this.frame++;
      this.expr = expr;
      const target = EXPR[expr] || EXPR.calm;
      for (const k in target) this.blend[k] += (target[k] - this.blend[k]) * 0.42;
      if (--this.gaze.hold <= 0) {
        this.gaze.hold = 6 + (this._r() * 4 | 0);
        this.gaze.tx = (this._r() - 0.5) * 1.5;
        this.gaze.ty = (this._r() - 0.5) * 0.8;
      }
      this.gaze.x += (this.gaze.tx - this.gaze.x) * 0.42;
      this.gaze.y += (this.gaze.ty - this.gaze.y) * 0.42;
      this.jx = (this._r() - 0.5) * 0.22; this.jy = (this._r() - 0.5) * 0.18;
      if (this.blinkP >= 0) { if (++this.blinkP >= BLINK_CLOSE + BLINK_OPEN) this.blinkP = -1; }
      else if (--this.blinkT <= 0) {
        this.blinkP = 0;
        this.blinkAmp = this._r() < 0.5 ? 0.55 + this._r() * 0.3 : 1;
        this.blinkT = BLINK_MEAN * (0.45 + this._r() * 1.5);
      }
      this._sim(sx, sy, moving);
    }
  }

  // SCALE IS THE PROGRESS BAR. Sky puts your winged light on your body as cape wedges, so you can
  // see how far you have come by looking at yourself and never at a meter. `grow` is the same
  // idea: every mote makes his flame visibly taller and brighter, permanently, for the rest of the
  // mountain. There is no number on screen and there is not going to be one.
  setGrow(g) { this.grow = Math.max(0, Math.min(1, g)); }

  _sim(hx, hy, moving) {
    const B = this.blend, t = this.frame;
    const up = -1.5 * (0.6 + 0.4 * B.h) * (1 + (this.grow || 0) * 0.55);
    this.lean += ((moving ? 0.55 : 0) - this.lean) * 0.2;
    this.pts[0].x = hx; this.pts[0].y = hy; this.pts[0].px = hx; this.pts[0].py = hy;
    for (let i = 1; i < this.pts.length; i++) {
      const p = this.pts[i];
      const vx = (p.x - p.px) * 0.70, vy = (p.y - p.py) * 0.70;
      p.px = p.x; p.py = p.y;
      const w = i / this.pts.length;
      const n = Math.sin(t * 0.6 + i * 1.25) * 1.1 + Math.sin(t * 0.27 + i * 2.1) * 0.7;
      p.x += vx + n * (0.5 + 1.6 * B.agit) * w - this.lean * 2.2 * w;
      p.y += vy + up * (1 - w * 0.45);
      const a = this.pts[i - 1];
      let dx = p.x - a.x, dy = p.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const s = SEGLEN / d;
      p.x = a.x + dx * s; p.y = a.y + dy * s;
      // hard anchor clamp: a link can never wander far from the skull, which makes the mane
      // detaching structurally impossible rather than merely unlikely
      const maxOff = 1.8 + 1.9 * i;
      const ox = p.x - hx, oy = p.y - hy;
      const od = Math.hypot(ox, oy);
      if (od > maxOff) { p.x = hx + ox / od * maxOff; p.y = hy + oy / od * maxOff; }
    }
  }

  // sx, sy = the screen position of the surface he is standing on.
  draw(g, sx, sy) {
    const B = this.blend;
    // contact shadow, so he sits ON the stone rather than in front of it
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(28,22,34,.55)';
    g.beginPath(); g.ellipse(sx, sy + 1, 11, 4.4, 0, 0, 7); g.fill();
    g.restore();

    // the mane, additive
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = this.pts.length - 1; i >= 0; i--) {
      const p = this.pts[i], k = 1 - i / this.pts.length;
      const r = (3.2 + 7.5 * k) * (1 + (this.grow || 0) * 0.42);
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, `rgba(255,${226 - i * 12},${170 - i * 20},${0.42 + 0.3 * k})`);
      gr.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
    }
    g.restore();

    // the body: a small dark shape with a pale head. The silhouette test — fill him solid black
    // and the pose still reads — is what keeps him legible against flat architecture.
    g.save();
    g.translate(sx, sy - 12);
    g.fillStyle = '#3a2c33';
    g.beginPath(); g.ellipse(0, 3, 5.4, 6.0, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(-3.2, 8.6, 1.9, 3.4, 0.1, 0, 7); g.fill();
    g.beginPath(); g.ellipse(2.8, 8.8, 1.9, 3.2, -0.1, 0, 7); g.fill();
    g.fillStyle = '#a2939c';
    g.beginPath(); g.ellipse(0, -6.4, 5.8, 6.6, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-5.0, -10.2); g.lineTo(-6.0, -15.0); g.lineTo(-2.2, -11.8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(5.0, -10.2); g.lineTo(6.0, -15.0); g.lineTo(2.2, -11.8); g.closePath(); g.fill();
    this._face(g, B);
    g.restore();
  }

  _face(g, B) {
    const shut = Math.max(this._blink(), B.lid);
    const EY = -6.8, EX = 2.4;
    g.strokeStyle = 'rgba(34,26,30,.9)'; g.lineWidth = 1.05;
    const bA = B.brow * 0.5;
    g.beginPath();
    g.moveTo(-EX - 2.0, EY - 3.5 + B.brow * 0.9 - bA); g.lineTo(-EX + 1.7, EY - 3.8 + B.brow * 1.4 + bA); g.stroke();
    g.beginPath();
    g.moveTo(EX - 1.7, EY - 3.8 + B.brow * 1.4 + bA); g.lineTo(EX + 2.0, EY - 3.5 + B.brow * 0.9 - bA); g.stroke();
    const eh = 2.6 * (1 - shut);
    if (eh > 0.3) {
      for (const s of [-EX, EX]) {
        g.fillStyle = '#241b21';
        g.beginPath(); g.ellipse(s, EY, 1.8, eh, 0, 0, 7); g.fill();
        const px = s + Math.max(-0.8, Math.min(0.8, this.gaze.x + this.jx)) * 0.8;
        const py = EY + Math.max(-0.6, Math.min(0.6, this.gaze.y + this.jy)) * Math.min(1, eh * 0.4);
        g.fillStyle = 'rgba(255,228,182,.94)';
        g.beginPath(); g.ellipse(px, py, 0.7, Math.min(0.9, eh * 0.42), 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,250,232,.95)';
        g.beginPath(); g.ellipse(px - 0.3, py - 0.35, 0.32, Math.min(0.4, eh * 0.24), 0, 0, 7); g.fill();
      }
    } else {
      g.fillStyle = '#241b21';
      g.fillRect(-EX - 1.8, EY - 0.4, 3.6, 0.9); g.fillRect(EX - 1.8, EY - 0.4, 3.6, 0.9);
    }
    const open = B.mouth * 2.2, curve = B.curve * 1.4, MY = -2.6;
    g.strokeStyle = 'rgba(32,24,28,.9)'; g.lineWidth = 0.95;
    g.beginPath(); g.moveTo(-2.2, MY - curve * 0.35);
    g.quadraticCurveTo(0, MY + curve, 2.2, MY - curve * 0.35); g.stroke();
    if (open > 0.5) {
      g.fillStyle = 'rgba(32,18,20,.8)';
      g.beginPath();
      g.moveTo(-2.0, MY - curve * 0.3);
      g.quadraticCurveTo(0, MY + curve, 2.0, MY - curve * 0.3);
      g.quadraticCurveTo(0, MY + curve + open, -2.0, MY - curve * 0.3);
      g.fill();
    }
    g.lineWidth = 1;
  }
}
