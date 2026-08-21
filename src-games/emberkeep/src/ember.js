// Emberkeep — the creature.
//
// v2.2: HE HAS A FACE NOW. Through v2.1.2 the in-world sprite had eye-holes and nothing else,
// while the full brow/mouth/eye rig lived on the HUD portrait — which meant every piece of acting
// happened in the sidebar, away from where the player is looking. The silhouette test still
// governs (fill him solid black and the pose must read), so the face ADDS to posture and flame
// rather than replacing them; if the face were removed tomorrow the character would still work.
//
// The blink is not eyeballed. Disney Research's blink study puts a natural-reading blink at ~9
// frames at 30fps (~300ms) and — the part that matters — says the curve is ASYMMETRIC: the close
// is fast and accelerating, the open is slow and decelerating. That directly contradicts the
// standard symmetric-timing advice, and a symmetric blink is the thing that reads as a doll.
// Blink rate is 6.6-27/min in their subjects; ~50% of real blinks never reach full closure.
// Gaze: fixations run 200-300ms with about 3 saccades a second, plus sub-1-degree microsaccades,
// which is why the pupils here never sit perfectly still — eyes that do read as dead.
//
// The flame is a verlet chain, not a sprite sheet — it leans, trails and recovers for free,
// and it is driven by the same state the game already has.
//
// RIG RATE: the pose was resampled at 12 fps to read as handcrafted rather than floaty. That
// was the right call when a pose cost 76 gradient allocations; it is the wrong one now that it
// costs 76 blits, because at 12 fps the flame visibly STEPS. 30 Hz keeps the hand-drawn weight
// and removes the stutter. The rig is driven from the fixed-timestep simulation, not from
// render(), so this rate is real time and not render time.

import { FUEL_MAX } from './physics.js';
import { MANE, MANE_CORE, blit, ramp } from './sprites.js';

const SEG = 7;              // chain links
const SEGLEN = 6.2;
const RIG_HZ = 30;          // was 12

// Blink, in RIG ticks (30Hz). 3 ticks to close, 6 to open = 9 total = the measured 300ms, with
// the close:open ratio the study describes rather than a symmetric triangle.
const BLINK_CLOSE = 3, BLINK_OPEN = 6;
const BLINK_MEAN = 30 * 6.6;        // ~9 blinks a minute, inside the measured 6.6-27 band

// state -> rig parameters. Same nine states as the original face sheet; the table survived,
// the cartoon rendering did not.
// brow: -1 raised (surprise/hope) .. +1 drawn down and in (worry/effort)
// mouth: 0 flat .. 1 open, with `curve` as the corners: +1 up, -1 down
const EXPR = {
  content:    { h: 1.00, lean: 0.0, agit: 0.35, warm: 1.00, lid: 0.00, squash: 0.00, ear: 0.0,  brow: 0.00, mouth: 0.12, curve: 0.22 },
  joyful:     { h: 1.28, lean: 0.0, agit: 0.85, warm: 1.10, lid: 0.00, squash: -0.08, ear: -0.25, brow: -0.55, mouth: 0.70, curve: 0.90 },
  curious:    { h: 1.06, lean: 0.25, agit: 0.40, warm: 1.02, lid: 0.00, squash: 0.00, ear: -0.15, brow: -0.35, mouth: 0.30, curve: 0.10 },
  determined: { h: 0.92, lean: 0.0, agit: 0.25, warm: 1.05, lid: 0.15, squash: 0.06, ear: 0.10, brow: 0.55, mouth: 0.10, curve: -0.10 },
  worried:    { h: 0.80, lean: -0.15, agit: 0.55, warm: 0.90, lid: 0.10, squash: 0.10, ear: 0.35, brow: 0.70, mouth: 0.26, curve: -0.55 },
  guilty:     { h: 0.68, lean: -0.30, agit: 0.30, warm: 0.86, lid: 0.45, squash: 0.16, ear: 0.55, brow: 0.85, mouth: 0.14, curve: -0.75 },
  flinch:     { h: 1.45, lean: 0.0, agit: 1.30, warm: 1.16, lid: 0.90, squash: -0.14, ear: 0.60, brow: -0.90, mouth: 0.85, curve: -0.30 },
  sleepy:     { h: 0.72, lean: 0.10, agit: 0.15, warm: 0.88, lid: 0.62, squash: 0.12, ear: 0.40, brow: 0.20, mouth: 0.18, curve: -0.05 },
  guttering:  { h: 0.52, lean: 0.0, agit: 0.90, warm: 0.60, lid: 0.35, squash: 0.14, ear: 0.45, brow: 0.60, mouth: 0.40, curve: -0.60 },
};

export const EXPR_NAMES = Object.keys(EXPR);

// Derive the expression from game state. Order matters: transient beats ambient.
export function pickExpression(s, ctx = {}) {
  const f = s.fuel / FUEL_MAX;
  if (ctx.sinceBurn != null && ctx.sinceBurn < 18) return 'flinch';
  if (ctx.sinceBurn != null && ctx.sinceBurn < 150) return 'guilty';
  if (ctx.sinceDrop != null && ctx.sinceDrop < 60) return 'joyful';
  if (f < 0.10) return 'guttering';
  if (f < 0.30) return 'worried';
  if (ctx.idle > 260) return 'sleepy';
  if (!s.onGround) return 'determined';
  if (Math.abs(s.vx) > 0.1) return 'curious';
  return 'content';
}

// The sternum glow, baked once. It was a createRadialGradient allocated on EVERY draw — the last
// surviving instance of the exact defect v2.1.0 removed two hundred of, and it survived because
// it was one call rather than a loop. One per frame is still 3,600 allocations a minute.
let CHEST_C = null;
function CHEST() {
  if (CHEST_C || typeof document === 'undefined') return CHEST_C;
  const c = document.createElement('canvas'); c.width = 36; c.height = 45;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(18, 22, 0, 18, 22, 22);
  gr.addColorStop(0, 'rgba(255,178,72,1)');
  gr.addColorStop(1, 'rgba(255,140,40,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 36, 45);
  CHEST_C = c;
  return c;
}

export class EmberRig {
  constructor() {
    this.pts = [];
    this.acc = 0;
    this.frame = 0;
    this.tt = 0;        // continuous seconds, for the sway only
    this.expr = 'content';
    this.blend = { ...EXPR.content };
    this.seeded = false;
    // --- the gaze and blink rig -----------------------------------------
    this.blinkT = 40 + Math.random() * BLINK_MEAN;  // ticks until the next blink
    this.blinkP = -1;                                // -1 = not blinking, else tick index
    this.blinkAmp = 1;                               // ~half of real blinks never fully close
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0, hold: 0 };
    this.jx = 0; this.jy = 0;                        // microsaccade
    this.rnd = 0x2545f491;
  }

  _r() { this.rnd = (this.rnd * 1664525 + 1013904223) >>> 0; return this.rnd / 4294967296; }

  // Blink shape, asymmetric per the study: fast accelerating close, slow decelerating open.
  // 0 = open, 1 = shut.
  _blink() {
    if (this.blinkP < 0) return 0;
    const i = this.blinkP;
    if (i < BLINK_CLOSE) {
      const u = i / BLINK_CLOSE;
      return this.blinkAmp * u * u;                       // accelerating shut
    }
    const u = (i - BLINK_CLOSE) / BLINK_OPEN;
    return this.blinkAmp * (1 - u) * (2 - (1 - u));       // decelerating open
  }

  _gazeStep(s) {
    // fixations of 200-300ms with roughly 3 saccades a second; at 30Hz that is a new target
    // every 6-9 ticks, which is what stops the eyes reading as painted on.
    if (--this.gaze.hold <= 0) {
      this.gaze.hold = 6 + (this._r() * 4 | 0);
      const bias = Math.max(-1, Math.min(1, s.vx));       // he looks where he is going
      this.gaze.tx = bias * 0.75 + (this._r() - 0.5) * 0.9;
      this.gaze.ty = (this._r() - 0.5) * 0.7 + (s.onGround ? 0 : 0.35);
    }
    this.gaze.x += (this.gaze.tx - this.gaze.x) * 0.42;   // saccades are fast, not instant
    this.gaze.y += (this.gaze.ty - this.gaze.y) * 0.42;
    this.jx = (this._r() - 0.5) * 0.22;                   // microsaccade, sub-1-degree
    this.jy = (this._r() - 0.5) * 0.18;
  }

  _seed(hx, hy) {
    this.pts = [];
    for (let i = 0; i < SEG; i++) this.pts.push({ x: hx, y: hy - i * SEGLEN, px: hx, py: hy - i * SEGLEN });
    this.seeded = true;
  }

  // dt in seconds. Advances the 12 fps rig; call every render frame, it throttles itself.
  update(dt, headX, headY, s, ctx) {
    if (!this.seeded) this._seed(headX, headY);
    this.tt += dt;
    this.acc += dt;
    const stepT = 1 / RIG_HZ;
    let guard = 0;
    while (this.acc >= stepT && guard++ < 3) {
      this.acc -= stepT;
      this.frame++;
      this.expr = pickExpression(s, ctx);
      const target = EXPR[this.expr];
      for (const k in target) this.blend[k] += (target[k] - this.blend[k]) * 0.45;
      this._gazeStep(s);
      if (this.blinkP >= 0) {
        if (++this.blinkP >= BLINK_CLOSE + BLINK_OPEN) this.blinkP = -1;
      } else if (--this.blinkT <= 0) {
        this.blinkP = 0;
        this.blinkAmp = this._r() < 0.5 ? 0.55 + this._r() * 0.3 : 1;   // half are partial
        this.blinkT = BLINK_MEAN * (0.45 + this._r() * 1.5);
      }
      this._sim(headX, headY, s);
    }
  }

  _sim(hx, hy, s) {
    const B = this.blend;
    const t = this.frame;
    const up = -1.58 * (0.6 + 0.4 * B.h);
    const drag = -s.vx * 0.30;                      // the mane trails behind movement

    this.pts[0].x = hx; this.pts[0].y = hy;
    this.pts[0].px = hx; this.pts[0].py = hy;

    for (let i = 1; i < this.pts.length; i++) {
      const p = this.pts[i];
      const vx = (p.x - p.px) * 0.70, vy = (p.y - p.py) * 0.70;
      p.px = p.x; p.py = p.y;
      const w = i / this.pts.length;
      const noise = Math.sin(t * 0.62 + i * 1.25) * 1.15 + Math.sin(t * 0.27 + i * 2.1) * 0.75;
      p.x += vx + (noise * B.agit * 0.85 * w) + drag * w + B.lean * 1.6 * w;
      p.y += vy + up * (0.5 + w);

      // HARD ANCHOR CLAMP. Without it the whole mane slides off the head under lateral
      // drag and reads as a separate object flying away — which is exactly what it did.
      // Each link may only stray so far sideways from the skull, and the allowance grows
      // slowly with distance up the chain, so the base is welded and the tip is free.
      const maxOff = 2.0 + 2.1 * i;
      const off = p.x - hx;
      if (off > maxOff) p.x = hx + maxOff;
      else if (off < -maxOff) p.x = hx - maxOff;
      if (p.y > hy + 2) p.y = hy + 2;                 // and it can never sag below the head
    }

    const target = SEGLEN * (0.80 + 0.45 * B.h);
    for (let k = 0; k < 2; k++) {
      for (let i = 1; i < this.pts.length; i++) {
        const a = this.pts[i - 1], b = this.pts[i];

        // distance constraint — keeps the mane the right length
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - target) / d * 0.5;
        b.x -= dx * diff; b.y -= dy * diff;

        // ANGULAR STIFFNESS — without this the chain folds back on itself and Ember
        // wears a question mark. Each link continues its parent's direction rather than
        // bending freely; the tip stays loose, the base stays upright.
        const gp = this.pts[i - 2];
        let ux, uy;
        if (gp) {
          ux = a.x - gp.x; uy = a.y - gp.y;
          const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m;
        } else { ux = 0; uy = -1; }
        const wantX = a.x + ux * target, wantY = a.y + uy * target;
        const stiff = 0.26 * Math.pow(1 - i / this.pts.length, 1.6);   // looser toward the tip
        b.x += (wantX - b.x) * stiff;
        b.y += (wantY - b.y) * stiff;
      }
    }
  }

  // ---- drawing ----------------------------------------------------------
  // gctx = the additive glow buffer. The body goes on the main canvas, the fire goes in the glow.
  // `lit` is {nx, ny, amt} from the light field at his own position — which is dominated by his
  // own mane, so he is rim-lit from above by default and re-lit from the side when he passes a
  // sconce. That is correct and not a happy accident: the brightest thing near Ember is Ember.
  // SPLIT DELIBERATELY into mane and body, because they belong on opposite sides of the bloom.
  // Drawn together, the mane's bloom was composited over the body and erased the silhouette the
  // entire character design rests on — he became a white smear with a face on it. The mane goes
  // into the glow buffer and blooms; the body is painted on top of the bloom, dark, and reads.
  draw(g, gctx, x, y, s, lit) { this.drawMane(gctx, x, y, s); this.drawBody(g, x, y, s, lit); }

  drawMane(gctx, x, y, s) { if (gctx) this._mane(gctx, x, y, s); }

  drawBody(g, x, y, s, lit = { nx: 0, ny: -1, amt: 0.8 }) {
    const B = this.blend;


    const sq = 1 + B.squash, st = 1 - B.squash * 0.7;
    const SC = 1.62;                 // visual scale only; the hitbox in physics.js is unchanged

    // ---- CONTACT SHADOW. He had none, which is why he read as pasted onto the room rather than
    // standing in it. It is the cheapest possible grounding cue and it costs one ellipse.
    if (s.onGround) {
      const w = 9.5 * SC * (1 + B.squash * 0.5);
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgba(24,20,26,${0.42 + lit.amt * 0.30})`;
      g.beginPath(); g.ellipse(x, y + 14.5 * SC, w, 2.6 * SC, 0, 0, 7); g.fill();
      g.restore();
    }

    g.save();
    g.translate(x, y);
    g.scale((s.facing < 0 ? -1 : 1) * SC, SC);
    // the light direction, brought into his local (possibly mirrored) frame
    const lx = (s.facing < 0 ? -1 : 1) * lit.nx, ly = lit.ny;

    g.fillStyle = '#3d2e28';
    // legs
    g.beginPath(); g.ellipse(-3.4, 7.5 * sq, 2.1, 4.2 * st, 0.1, 0, 7); g.fill();
    g.beginPath(); g.ellipse(3.0, 7.8 * sq, 2.1, 4.0 * st, -0.1, 0, 7); g.fill();
    // torso
    g.beginPath(); g.ellipse(0, 2.5 * sq, 5.6 * sq, 6.4 * st, 0, 0, 7); g.fill();
    // arms
    g.beginPath(); g.ellipse(-5.6, 2.0, 1.7, 4.4, 0.35, 0, 7); g.fill();
    g.beginPath(); g.ellipse(5.6, 2.0, 1.7, 4.4, -0.35, 0, 7); g.fill();
    // the small warm spot at the sternum — the only thing that says he is lit from inside.
    // Baked, not allocated: this was the last surviving per-frame createRadialGradient in the
    // hot path after v2.1.0 removed the other two hundred.
    if (B.warm > 0.02) {
      g.globalAlpha = 0.85 * B.warm;
      const cs = CHEST();
      if (cs) g.drawImage(cs, -3.6, -3.0, 7.2, 9.0);
      g.globalAlpha = 1;
    }

    // ---- RIM LIGHT. No normal map: the rim is placed by the light direction against the known
    // silhouette, which is the 2D equivalent of the 4-neighbour alpha trick and costs two arcs
    // instead of a per-pixel pass over 460k pixels a frame.
    if (lit.amt > 0.05) {
      const rim = Math.min(0.70, lit.amt * 0.95);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,196,120,${rim * 0.55})`;
      g.lineWidth = 1.5;
      const ang = Math.atan2(ly, lx);
      g.beginPath(); g.ellipse(0, 2.5 * sq, 5.6 * sq, 6.4 * st, 0, ang - 1.15, ang + 1.15); g.stroke();
      g.beginPath(); g.ellipse(0, -7.5, 6.2, 7.4, 0, ang - 1.25, ang + 1.25); g.stroke();
      g.restore();
    }

    // head: lighter mask, ears droop with mood
    g.fillStyle = '#9c8d80';
    g.beginPath(); g.ellipse(0, -7.5, 6.2, 7.4, 0, 0, 7); g.fill();
    g.beginPath();
    g.moveTo(-5.4, -11.5); g.lineTo(-6.4 - B.ear * 2.4, -16.5 + B.ear * 5.5); g.lineTo(-2.4, -13.2);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(5.4, -11.5); g.lineTo(6.4 + B.ear * 2.4, -16.5 + B.ear * 5.5); g.lineTo(2.4, -13.2);
    g.closePath(); g.fill();
    // the head is a curved mask, so it takes the light unevenly too
    if (lit.amt > 0.05) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(0.30, lit.amt * 0.30);
      g.fillStyle = 'rgba(255,206,150,1)';
      g.beginPath(); g.ellipse(lx * 2.2, -7.5 + ly * 2.6, 4.0, 4.6, 0, 0, 7); g.fill();
      g.restore();
    }

    // ---- THE FACE ---------------------------------------------------------
    this._face(g, B, lx, ly);

    g.restore();
  }

  // Eyes, pupils, brows, mouth. Three channels is the whole of facial expression in animation
  // and there is no fourth worth having at this size.
  _face(g, B, lx, ly) {
    const shut = Math.max(this._blink(), B.lid);
    const EY = -8.0, EX = 2.5;

    // ---- brows. The single highest-value channel: a brow angle reads at any size, and it is
    // what lets a two-dot face be worried rather than merely awake.
    const bA = B.brow * 0.55;
    g.strokeStyle = 'rgba(30,23,22,.88)';
    g.lineWidth = 1.05;
    g.beginPath();
    g.moveTo(-EX - 2.0, EY - 3.6 + B.brow * 0.9 - bA);
    g.lineTo(-EX + 1.7, EY - 3.9 + B.brow * 1.5 + bA);
    g.stroke();
    g.beginPath();
    g.moveTo(EX - 1.7, EY - 3.9 + B.brow * 1.5 + bA);
    g.lineTo(EX + 2.0, EY - 3.6 + B.brow * 0.9 - bA);
    g.stroke();
    g.lineWidth = 1;

    // ---- eyes
    const eh = 2.7 * (1 - shut);
    if (eh > 0.30) {
      for (const sx of [-EX, EX]) {
        g.fillStyle = '#241b19';
        g.beginPath(); g.ellipse(sx, EY, 1.85, eh, 0, 0, 7); g.fill();
        // pupil: gaze + microsaccade, clamped inside the eye so it can never leave the socket
        const px = sx + Math.max(-0.8, Math.min(0.8, this.gaze.x + this.jx)) * 0.8;
        const py = EY + Math.max(-0.6, Math.min(0.6, this.gaze.y + this.jy)) * Math.min(1, eh * 0.4);
        g.fillStyle = 'rgba(255,226,178,.92)';
        g.beginPath(); g.ellipse(px, py, 0.72, Math.min(0.9, eh * 0.42), 0, 0, 7); g.fill();
        // eyeshine, offset toward the light. Two pixels, and they are what make him alive.
        g.fillStyle = 'rgba(255,248,226,.95)';
        g.beginPath(); g.ellipse(px + lx * 0.5 - 0.25, py + ly * 0.4 - 0.3, 0.34,
                                 Math.min(0.42, eh * 0.24), 0, 0, 7); g.fill();
      }
    } else {
      g.fillStyle = '#241b19';
      g.fillRect(-EX - 1.9, EY - 0.45, 3.8, 0.95);
      g.fillRect(EX - 1.9, EY - 0.45, 3.8, 0.95);
    }

    // ---- mouth. Open-ness and corner curve are separate, which is the difference between a
    // mouth and an emoticon: he can be open-mouthed and unhappy at the same time.
    const open = B.mouth * 2.4, curve = B.curve * 1.5, MY = -3.4;
    g.strokeStyle = 'rgba(28,21,20,.9)';
    g.lineWidth = 0.95;
    g.beginPath();
    g.moveTo(-2.3, MY - curve * 0.35);
    g.quadraticCurveTo(0, MY + curve, 2.3, MY - curve * 0.35);
    g.stroke();
    if (open > 0.5) {
      g.fillStyle = 'rgba(30,18,16,.82)';
      g.beginPath();
      g.moveTo(-2.1, MY - curve * 0.3);
      g.quadraticCurveTo(0, MY + curve, 2.1, MY - curve * 0.3);
      g.quadraticCurveTo(0, MY + curve + open, -2.1, MY - curve * 0.3);
      g.fill();
    }
    g.lineWidth = 1;
  }

  // Catmull-Rom through the chain, then a run of soft additive blobs along it.
  _mane(gc, x, y, st) {
    const B = this.blend;
    const P = this.pts;
    if (P.length < 3) return;

    const n = P.length - 1;
    const amp = 1.6 + 3.4 * B.agit;
    // The POSE is 12 fps (handcrafted look). The SWAY runs on continuous time so the fire
    // itself flows smoothly at 60 — stepping the sway too made the flame look strobed.
    const ts = this.tt * 6.0;
    const ctrl = P.map((p, i) => {
      const w = Math.pow(i / n, 1.4);
      return {
        x: p.x + (Math.sin(ts - i * 0.95) * 0.75 + Math.sin(ts * 1.7 - i * 0.5) * 0.25) * amp * w + B.lean * 3.4 * w,
        y: p.y,
      };
    });

    const SAMPLES = 46;
    const pts = [];
    for (let k = 0; k < SAMPLES; k++) {
      const u = (k / (SAMPLES - 1)) * n;
      const i = Math.min(n - 1, Math.floor(u));
      const f = u - i;
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n, i + 2)];
      const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
      pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), u: k / (SAMPLES - 1) });
    }

    const warm = B.warm;
    gc.globalCompositeOperation = 'lighter';
    for (const q of pts) {
      // taper: fat at the skull, a thread at the tip
      const r = (10.8 * Math.pow(1 - q.u, 0.72) + 1.3) * (0.85 + 0.25 * B.h);
      // colour walks up the flame: white-hot base -> orange body -> deep red tip
      const hot = Math.pow(1 - q.u, 1.7);
      // ramp in over the first stretch: the base of the fire must not white out the head,
      // which is the only part of Ember with a face on it
      const rootFade = Math.min(1, q.u / 0.16);
      const a = (0.24 + 0.19 * hot) * (0.55 + 0.45 * warm) * rootFade;
      blit(gc, ramp(MANE, hot), q.x, q.y, r, a);
    }
    // a tight bright core so it reads as flame rather than haze
    for (const q of pts) {
      if (q.u > 0.62) continue;
      const r = 3.4 * Math.pow(1 - q.u / 0.62, 0.8) + 0.6;
      const a = 0.21 * (1 - q.u / 0.62) * Math.min(1, q.u / 0.16);
      blit(gc, MANE_CORE, q.x, q.y, r, a);
    }
    gc.globalCompositeOperation = 'source-over';
  }

}
