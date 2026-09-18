// Creature renderer. Deterministic: same (key, expression) → same picture, every
// session. Returns an SVG string; the caller inserts it once and replaces it only
// when the expression changes (signature guard in the UI — never per tick).

import { mulberry32 } from '../vendor/rng.js';
import { EXPRESSIONS } from '../vendor/expression.js';
import { Ctx, rigFor, SIG, VB, el, g, shadow, bodyTransform, bodyPointFn, esc } from './kit.js';
import { PAL } from './palettes.js';
import { renderHat } from './hats.js';
import * as A from './bodies-a.js';
import * as B from './bodies-b.js';
import { BY_KEY } from '../lib/species.js';

export const DRAWERS = {
  ember: A.ember, pip: A.pip, clover: A.clover, fen: A.fen, thistle: A.thistle, sage: A.sage,
  bramble: A.bramble, tuck: A.tuck, burr: A.burr, dapple: A.dapple, moss: A.moss, root: A.root,
  wicket: B.wicket, wren: B.wren, morrow: B.morrow, hollow: B.hollow, luna: B.luna,
  nib: B.nib, lichen: B.lichen, ripple: B.ripple, cove: B.cove, juniper: B.juniper,
  breeze: B.breeze, hush: B.hush, astra: B.astra,
};

let _uid = 0;
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/**
 * @param key   species key
 * @param opts  { expr, uid, title, silhouette }
 * @returns {{ svg: string, joints: object|null }}
 */
export function drawCreature(key, opts = {}) {
  const sp = BY_KEY[key];
  const drawer = DRAWERS[key];
  if (!sp || !drawer) throw new Error(`no drawer for ${key}`);
  const expr = EXPRESSIONS.includes(opts.expr) ? opts.expr : sp.rest;
  const base = rigFor(expr);
  // Planted, articulated legs (quadruped plan) get a damped pose: full squash would
  // lift the shoulders past the legs' reach and IK would have to stretch a bone.
  const rig = sp.plan === 'quadruped' ? { ...base, squash: 1 + (base.squash - 1) * 0.3, tilt: base.tilt * 0.5 } : base;
  const uid = opts.uid || `cc${(_uid++).toString(36)}`;
  const ctx = new Ctx(uid, PAL[key], rig, SIG[expr] ?? 0);
  ctx.expr = expr;
  ctx.rand = mulberry32(hash(key));
  ctx.joints = null;
  ctx.bodyPoint = bodyPointFn(rig);
  const out = drawer(ctx);
  // a hat rides with the body and the head anchor kit.face() recorded
  const hat = opts.hat ? renderHat(opts.hat, ctx.head) : '';
  const posed = g({ class: 'cc-body', transform: bodyTransform(rig) }, g({ class: 'cc-idle' }, out.svg + hat));
  const body = (out.groundBack || '') + posed + (out.groundFront || '');
  const shade = out.shadowRx ? shadow(ctx, out.shadowRx, { lift: out.lift || 0 }) : '';
  const title = opts.title ? el('title', {}, esc(opts.title)) : '';
  const svg = el('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${VB} ${VB}`,
    // A tint is a CLASS, not an inline style: the extension's CSP is style-src 'self',
    // so a style attribute inside injected SVG is refused outright (found in the packed build).
    class: `cc cc-${key} cc-plan-${sp.plan} cc-x-${expr}${Number.isInteger(opts.tint) ? ` cc-tint-${opts.tint}` : ''}`,
    role: opts.title ? 'img' : null,
    'aria-hidden': opts.title ? null : 'true',
    focusable: 'false',
  }, [title, el('defs', {}, ctx.defs.join('')), shade, body]);
  return { svg, joints: ctx.joints };
}

export function renderCreature(key, opts) { return drawCreature(key, opts).svg; }
