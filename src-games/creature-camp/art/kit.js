// Drawing kit shared by every creature.
//
// LOOK (svg-graphics §0) — declared once, read by every body:
//   subject:  woodland creatures of a lantern-lit pine camp
//   job:      read as a distinct individual at 48px, emote at 96–140px
//   use-size: 32 (feed) · 48 (bestiary) · 96–140 (camp) · 256 (snapshot)
//   idiom:    flat illustration + matte form shading
//   palette:  per species [line, shadow, base, light, hi] + named accents; shadows lean
//             blue-violet, lights lean amber. Camp accent (lantern amber) only at focal points.
//   light:    top-left, soft
//   line:     hierarchy — L1 silhouette 2.2, L2 forms 1.4, L3 detail 0.9; line colour is a
//             dark tint of the local hue, never black
//   ground:   both themes; contact shadow is a transparent-stop radial gradient, never a blur
//
// Rules carried from Lumenreel / Emberkeep, each paid for by a shipped defect:
//   * every gradient id is prefixed with a per-instance uid (duplicate ids resolve to
//     the FIRST match document-wide — one hue won for twelve symbols once);
//   * eyelids are ellipses clipped to the eye's own shape (rectangle lids bled);
//   * body language (tilt, lean, squash) carries the read at small sizes;
//   * idle motion is STEPPED in CSS — smooth procedural motion reads floaty.

import { rigFor, mouthPath, FILLED_MOUTHS } from '../vendor/expression.js';

export const VB = 120;
export const GROUND = 108;
export const CX = 60;

export const r2 = (n) => Math.round(n * 100) / 100;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\u0022': '&quot;', '\u0027': '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>\u0022\u0027]/g, (c) => ESC[c]);

/** Element builder. Attribute values are escaped; numbers are rounded. */
export function el(tag, attrs = {}, kids = '') {
  let a = '';
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    a += ` ${k}="${esc(typeof v === 'number' ? r2(v) : v)}"`;
  }
  const inner = Array.isArray(kids) ? kids.join('') : kids;
  return inner ? `<${tag}${a}>${inner}</${tag}>` : `<${tag}${a}/>`;
}

export const g = (attrs, kids) => el('g', attrs, kids);
export const path = (d, attrs = {}) => el('path', { d, ...attrs });
export const ell = (cx, cy, rx, ry, attrs = {}) => el('ellipse', { cx, cy, rx, ry, ...attrs });
export const circ = (cx, cy, r, attrs = {}) => el('circle', { cx, cy, r, ...attrs });

export const L1 = 2.2, L2 = 1.4, L3 = 0.9;
export const ink = (pal, w = L1) => ({ stroke: pal.line, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });

/** Per-render context: collects <defs> under unique ids. */
export class Ctx {
  constructor(uid, pal, rig, sig) {
    this.uid = uid; this.pal = pal; this.rig = rig; this.sig = sig;
    this.defs = [];
    this._n = 0;
  }
  id(name) { return `${this.uid}-${name}`; }
  url(name) { return `url(#${this.id(name)})`; }
  /** Form gradient lit from the top-left: light → base → shadow (3 stops). */
  form(name, light, base, shadow, { cx = '34%', cy = '28%', r = '78%' } = {}) {
    this.defs.push(el('radialGradient', { id: this.id(name), cx, cy, r }, [
      el('stop', { offset: '0%', 'stop-color': light }),
      el('stop', { offset: '55%', 'stop-color': base }),
      el('stop', { offset: '100%', 'stop-color': shadow }),
    ]));
    return this.url(name);
  }
  /** Soft glow / AO: colour → transparent. Never feGaussianBlur. */
  glow(name, color, opacity = 0.8, stop = '100%') {
    this.defs.push(el('radialGradient', { id: this.id(name) }, [
      el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': opacity }),
      el('stop', { offset: stop, 'stop-color': color, 'stop-opacity': 0 }),
    ]));
    return this.url(name);
  }
  linear(name, a, b, { x2 = '0', y2 = '1' } = {}) {
    this.defs.push(el('linearGradient', { id: this.id(name), x1: '0', y1: '0', x2, y2 }, [
      el('stop', { offset: '0%', 'stop-color': a }),
      el('stop', { offset: '100%', 'stop-color': b }),
    ]));
    return this.url(name);
  }
  clip(name, shape) {
    this.defs.push(el('clipPath', { id: this.id(name) }, shape));
    return this.url(name);
  }
  next(prefix) { return `${prefix}${this._n++}`; }
}

/** Contact shadow on the ground (AO where the creature meets the camp floor). */
export function shadow(ctx, rx, { y = GROUND + 1, ry = 3.2, lift = 0 } = {}) {
  const fill = ctx.glow('shadow', '#1d1a2e', 0.42);
  const k = 1 - Math.min(0.5, lift / 40);
  return ell(CX, y, rx * k, ry * k, { fill, class: 'cc-shadow' });
}

/**
 * The face: eyes, lids, brows, mouth, cheeks. Features move TOGETHER (one group),
 * never independently, or the face slides off the head.
 */
export function face(ctx, o) {
  // Every body plan draws its face through here, so this is the one place that knows
  // where a head IS — hats and future head props read it instead of guessing per plan.
  ctx.head = { x: o.x, y: o.y, R: o.R };
  const { x, y, R, gap, eyeR, mouthY = y + R * 0.42, pal = ctx.pal, cheeks = true, eyeStyle = 'bead', mouthScale = 1, noMouth = false, noBrows = false } = o;
  const rig = ctx.rig;
  const parts = [];
  const eyes = [[x - gap, -1], [x + gap, 1]];
  for (const [ex, side] of eyes) parts.push(eye(ctx, ex, y, eyeR, side, pal, eyeStyle));
  if (!noBrows) {
    for (const [ex, side] of eyes) {
      const by = y - eyeR * 1.75 + rig.browY * R;
      let tilt = rig.browTilt * -side;
      if (side === 1) tilt += rig.browAsym;
      const w = eyeR * 1.15;
      parts.push(path(`M${r2(ex - w)},${r2(by + 0.4)} Q${r2(ex)},${r2(by - 1.6)} ${r2(ex + w)},${r2(by + 0.4)} Q${r2(ex)},${r2(by - 0.5)} ${r2(ex - w)},${r2(by + 0.4)}Z`, {
        fill: pal.brow || pal.line, transform: `rotate(${r2(tilt)} ${r2(ex)} ${r2(by)})`,
      }));
    }
  }
  if (cheeks && pal.blush) {
    const big = ['happy', 'shy'].includes(ctx.expr) ? 1.25 : 1;
    for (const [ex, side] of eyes) parts.push(ell(ex + side * eyeR * 0.6, y + eyeR * 1.7, eyeR * 1.0 * big, eyeR * 0.55 * big, { fill: pal.blush, opacity: 0.5 }));
  }
  if (!noMouth) {
    const w = rig.mouthW * R * 0.62 * mouthScale, h = rig.mouthH * R * 0.62 * mouthScale;
    const d = mouthPath(rig.mouth, r2(w), r2(h));
    const filled = FILLED_MOUTHS.has(rig.mouth);
    parts.push(path(d, filled
      ? { fill: pal.mouth || '#5b2733', stroke: pal.line, 'stroke-width': L3, transform: `translate(${r2(x)} ${r2(mouthY)})`, 'stroke-linejoin': 'round' }
      : { fill: 'none', stroke: pal.line, 'stroke-width': L2 * 0.95, 'stroke-linecap': 'round', transform: `translate(${r2(x)} ${r2(mouthY)})` }));
  }
  return g({ class: 'cc-face' }, parts);
}

function eye(ctx, x, y, r, side, pal, style) {
  const rig = ctx.rig;
  const wide = rig.lidTop < 0 ? 1 - rig.lidTop * 0.8 : 1;
  const rx = r * 0.86 * wide, ry = r * 1.08 * wide;
  const cid = ctx.next('eye');
  ctx.clip(cid, ell(x, y, rx, ry));
  const out = [];
  const dx = rig.pupilDX * r * 0.45 * (style === 'glow' ? 0.5 : 1);
  const dy = rig.pupilDY * r * 0.45;
  if (style === 'glow') {
    out.push(ell(x, y, rx * 1.9, ry * 1.9, { fill: ctx.glow(cid + 'g', pal.eyeGlow || '#ffe9a8', 0.55 * (0.6 + 0.4 * Math.max(0, ctx.sig + 0.5))) , class: 'cc-glow' }));
    out.push(ell(x, y, rx, ry, { fill: pal.eye || '#fff4cf' }));
    out.push(ell(x + dx, y + dy, rx * 0.45 * rig.pupilScale, ry * 0.45 * rig.pupilScale, { fill: '#ffffff', opacity: 0.9 }));
  } else if (rig.pupilScale < 0.8) {
    out.push(ell(x, y, rx, ry, { fill: '#fbf6ee', stroke: pal.line, 'stroke-width': L3 }));
    out.push(circ(x + dx, y + dy, r * 0.42, { fill: pal.eye || '#241a24' }));
    out.push(circ(x + dx - r * 0.12, y + dy - r * 0.14, r * 0.12, { fill: '#fff' }));
  } else {
    out.push(ell(x, y, rx, ry, { fill: pal.eye || '#241a24' }));
    if (pal.iris) out.push(ell(x + dx * 0.6, y + dy * 0.6 + ry * 0.2, rx * 0.72, ry * 0.62, { fill: pal.iris, opacity: 0.75, 'clip-path': ctx.url(cid) }));
    const s = rig.pupilScale;
    out.push(circ(x + dx - r * 0.28, y + dy - r * 0.36, r * 0.34 * s, { fill: '#ffffff' }));
    out.push(circ(x + dx + r * 0.3, y + dy + r * 0.34, r * 0.13 * s, { fill: '#ffffff', opacity: 0.85 }));
  }
  const lidFill = pal.lid || pal.base;
  const lids = [];
  if (rig.lidTop > 0) {
    const cover = ry * 2 * rig.lidTop;
    lids.push(ell(x, y - ry - ry + cover, rx * 1.3, ry * 1.02, { fill: lidFill }));
    lids.push(path(`M${r2(x - rx)},${r2(y - ry + cover)} Q${r2(x)},${r2(y - ry + cover + 1.1)} ${r2(x + rx)},${r2(y - ry + cover)}`, { fill: 'none', stroke: pal.line, 'stroke-width': L3 }));
  }
  if (rig.lidBot > 0) {
    const cover = ry * 2 * rig.lidBot;
    lids.push(ell(x, y + ry + ry - cover, rx * 1.3, ry * 1.02, { fill: lidFill }));
  }
  if (lids.length) out.push(g({ 'clip-path': ctx.url(cid) }, lids));
  // Blink: a full lid, scaled from 0 in CSS (fast close, slow open). Pure decoration.
  out.push(g({ 'clip-path': ctx.url(cid) }, ell(x, y, rx * 1.2, ry * 1.1, { fill: lidFill, class: 'cc-blink', 'transform-origin': `${r2(x)} ${r2(y - ry)}` })));
  if (style !== 'glow') out.push(ell(x, y, rx, ry, { fill: 'none', stroke: pal.line, 'stroke-width': L3, opacity: 0.8 }));
  return g({}, out);
}

/** Signature channel value in [-1, 1] for an expression. */
export const SIG = { calm: 0, happy: 0.6, curious: 0.45, sleepy: -1, alarmed: 1, proud: 0.5, shy: -0.6, smug: 0.2, awe: 0.8 };

/** Body-language transform, pivoting at the feet so contact stays planted. */
export function bodyTransform(rig, gx = CX, gy = GROUND) {
  return `translate(${r2(rig.lean)} 0) translate(${gx} ${gy}) rotate(${r2(rig.tilt * 0.6)}) scale(1 ${r2(rig.squash)}) translate(${-gx} ${-gy})`;
}

/** Where a body-space point lands after bodyTransform(rig). Same maths, used by IK. */
export function bodyPointFn(rig, gx = CX, gy = GROUND) {
  const t = (rig.tilt * 0.6) * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t), sq = rig.squash;
  return ([x, y]) => {
    const lx = x - gx, ly = (y - gy) * sq;
    return [gx + rig.lean + lx * c - ly * sn, gy + lx * sn + ly * c];
  };
}

/** Seeded dapple / spot field clipped to a shape. */
export function spots(rand, n, box, rmin, rmax, attrs) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = box.x + rand() * box.w, y = box.y + rand() * box.h;
    const r = rmin + rand() * (rmax - rmin);
    s += ell(x, y, r, r * (0.7 + rand() * 0.3), attrs);
  }
  return s;
}

export { rigFor };
