// Procedural critter sprites. Deterministic SVG from a species row — no image
// files, no licensing surface, no network, and the whole 100-creature set costs
// a few KB of code instead of a few MB of PNGs.
//
// Determinism matters twice over: the same species always draws identically
// (so the dex is stable across sessions), and the shape variation inside a body
// family is seeded from the species id rather than being hand-placed.

import { mulberry32 } from '../lib/rng.js';
import { rigFor, mouthPath, FILLED_MOUTHS } from './expression.js';


/**
 * Escape a value being interpolated into an SVG ATTRIBUTE. Every species name in this
 * repo is an authored constant, so nothing here is exploitable today — but this is the
 * one place player-supplied text would arrive the moment critters become nameable, and
 * an injection surface is cheapest to close while it is still theoretical.
 */
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\u0022': '&quot;', '\u0027': '&#39;' };
// The quote characters are written as \u0022 / \u0027 rather than literally. A literal
// quote inside this character class desyncs any string-aware source scanner reading
// this file — preship's brace-balance check reported art/critter.js at depth -1 while
// `node --check` passed. Loosening a blocking gate to accommodate one clever line is
// how a gate earns its way into being switched off; the line changes instead.
function esc(v) {
  return String(v ?? '').replace(/[&<>\u0022\u0027]/g, (c) => ESC_MAP[c]);
}

const TAU = Math.PI * 2;
const r2 = (n) => Math.round(n * 100) / 100;

function hsl(h, s, l, a = 1) {
  return a >= 1 ? `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`
                : `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;
}

/** A closed polygon from a radial profile: n points, per-point radius jitter. */
function radialPoly(cx, cy, rx, ry, n, rand, jitter = 0.18, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const j = 1 - jitter / 2 + rand() * jitter;
    pts.push([r2(cx + Math.cos(a) * rx * j), r2(cy + Math.sin(a) * ry * j)]);
  }
  return pts;
}

const pathOf = (pts) => `M${pts.map((p) => p.join(',')).join('L')}Z`;

/** Split a polygon into triangular facets from the centroid — the prism look. */
function facetsOf(pts, cx, cy) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push(`M${cx},${cy}L${a[0]},${a[1]}L${b[0]},${b[1]}Z`);
  }
  return out;
}

// --- body families ----------------------------------------------------------
// Each returns { hull: pts, cx, cy, headX, headY, headR, extras: svgString }

function bodyOrb(sp, rand) {
  const cx = 50, cy = 56, rx = 26 + rand() * 5, ry = 25 + rand() * 5;
  return { hull: radialPoly(cx, cy, rx, ry, sp.f + 4, rand, 0.14), cx, cy,
    headX: cx, headY: cy - ry * 0.22, headR: rx * 0.62, extras: '' };
}

function bodyShard(sp, rand) {
  const cx = 50, cy = 58;
  // Deliberately ASYMMETRIC — a shard is a broken piece, not a gem.
  const w = 19 + rand() * 5, h = 33 + rand() * 6;
  const pts = [[r2(cx + w * 0.25), r2(cy - h)], [r2(cx + w), r2(cy - h * 0.05)],
    [r2(cx + w * 0.5), r2(cy + h * 0.66)], [r2(cx - w * 0.62), r2(cy + h * 0.52)],
    [r2(cx - w), r2(cy - h * 0.3)], [r2(cx - w * 0.34), r2(cy - h * 0.72)]];
  return { hull: pts, cx, cy: cy - 2, headX: cx, headY: cy - h * 0.18, headR: w * 0.8, extras: '' };
}

function bodySpire(sp, rand) {
  const cx = 50, cy = 62;
  const w = 12.5 + rand() * 3, h = 48 + rand() * 6;   // tall + narrow, unmistakable next to an orb
  const pts = [[cx, r2(cy - h)], [r2(cx + w * 0.7), r2(cy - h * 0.45)], [r2(cx + w), r2(cy + h * 0.28)],
    [r2(cx + w * 0.5), r2(cy + h * 0.42)], [r2(cx - w * 0.5), r2(cy + h * 0.42)],
    [r2(cx - w), r2(cy + h * 0.26)], [r2(cx - w * 0.7), r2(cy - h * 0.45)]];
  return { hull: pts, cx, cy: cy - 4, headX: cx, headY: cy - h * 0.1, headR: w * 0.85, extras: '' };
}

function bodyWisp(sp, rand) {
  const cx = 50, cy = 50, rx = 21 + rand() * 4, ry = 24 + rand() * 4;
  const hull = radialPoly(cx, cy, rx, ry, sp.f + 5, rand, 0.3);
  const tail = `M${cx - 7},${cy + ry * 0.8} Q${cx - 3},${cy + ry * 1.6} ${cx + 2},${cy + ry * 1.15}
                Q${cx + 7},${cy + ry * 1.75} ${cx + 9},${cy + ry * 0.85}Z`;
  return { hull, cx, cy, headX: cx, headY: cy - ry * 0.2, headR: rx * 0.66,
    extras: `<path d="${tail}" fill="url(#g${sp.id}b)" opacity=".72"/>` };
}

function bodyMoth(sp, rand) {
  const cx = 50, cy = 56;
  const wingR = 24 + rand() * 5;
  const mk = (dir) => {
    const p = radialPoly(cx + dir * wingR * 0.72, cy - 4, wingR * 0.78, wingR * 0.92, 6, rand, 0.34);
    return `<path d="${pathOf(p)}" fill="url(#g${sp.id}w)" stroke="${hsl(sp.hue2, 70, 82, 0.5)}" stroke-width=".7"/>`;
  };
  const hull = radialPoly(cx, cy, 10 + rand() * 2, 22 + rand() * 3, sp.f + 2, rand, 0.12);
  return { hull, cx, cy, headX: cx, headY: cy - 16, headR: 9.5,
    extras: mk(-1) + mk(1), behind: true };
}

function bodyBeetle(sp, rand) {
  const cx = 50, cy = 58;
  const rx = 24 + rand() * 4, ry = 21 + rand() * 4;
  const hull = radialPoly(cx, cy, rx, ry, sp.f + 5, rand, 0.1);
  const seams = [0.35, 0.62, 0.85].map((t) =>
    `<path d="M${cx - rx * (1 - t * 0.5)},${cy - ry + ry * 2 * t} Q${cx},${cy - ry + ry * 2 * t + 3} ${cx + rx * (1 - t * 0.5)},${cy - ry + ry * 2 * t}"
      fill="none" stroke="${hsl(sp.hue, 60, 30, 0.35)}" stroke-width="1.1"/>`).join('');
  return { hull, cx, cy, headX: cx, headY: cy - ry * 0.55, headR: rx * 0.5, extras: seams };
}

function bodySerpent(sp, rand) {
  // A real coiling body: a tapered chain along an S-curve, head clearly largest
  // and clearly at the top. The first version drew shrinking blobs downward and
  // read as "blob with a smudge" at sprite size.
  const segs = 7;
  const headX = 42, headY = 34;
  let out = '';
  const pt = (t) => [headX + Math.sin(t * 4.4 + 0.6) * (10 + t * 16), headY + t * 44];
  for (let i = segs; i >= 1; i--) {
    const t = i / segs;
    const [x, y] = pt(t);
    const r = 13.5 * Math.pow(1 - t * 0.72, 0.85);
    out += `<path d="${pathOf(radialPoly(x, y, r * 1.05, r, 6, rand, 0.16))}"
      fill="url(#g${sp.id}b)" stroke="${hsl(sp.hue2, 78, 80, 0.4)}" stroke-width=".6"
      opacity="${r2(0.62 + 0.34 * (1 - t))}"/>`;
  }
  const hull = radialPoly(headX, headY, 15.5, 13.5, Math.max(6, sp.f), rand, 0.12);
  return { hull, cx: headX, cy: headY, headX, headY: headY - 1.5, headR: 11.5, extras: out, behind: true };
}

function bodyCluster(sp, rand) {
  // A bedrock base with spires GROWING OUT OF IT. The first version drew the
  // spires and then painted the hull on top, which read as a spiky crown.
  const cx = 50, cy = 70;
  let spires = '';
  const n = 4 + (sp.id % 3);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const dx = (t - 0.5) * 40 + (rand() - 0.5) * 5;
    const lean = dx * 0.14;
    const h = 30 + rand() * 26 - Math.abs(dx) * 0.35;
    const w = 6.5 + rand() * 3.5;
    const p = [[r2(cx + dx + lean), r2(cy - h)], [r2(cx + dx + w), r2(cy - h * 0.42)],
      [r2(cx + dx + w * 0.7), r2(cy + 4)], [r2(cx + dx - w * 0.7), r2(cy + 4)],
      [r2(cx + dx - w), r2(cy - h * 0.42)]];
    spires += `<path d="${pathOf(p)}" fill="url(#g${sp.id}b)" stroke="${hsl(sp.hue2, 78, 82, 0.5)}" stroke-width=".7" stroke-linejoin="round"/>`
      + `<path d="M${r2(cx + dx + lean)},${r2(cy - h)}L${r2(cx + dx + w)},${r2(cy - h * 0.42)}L${r2(cx + dx + w * 0.7)},${r2(cy + 4)}Z"
          fill="${hsl(sp.hue + 8, 84, 72, 0.4)}"/>`;
  }
  const hull = radialPoly(cx, cy + 2, 26, 12, Math.max(7, sp.f), rand, 0.12);
  return { hull, cx, cy: cy + 2, headX: cx, headY: cy + 1, headR: 15, extras: spires, behind: true };
}

function bodyConstruct(sp, rand) {
  // Built, not grown: hard bilateral symmetry, a shoulder plate, a chassis frame
  // and rivet nodes. The first version was a heptagon with an inner outline and
  // read as "generic blob with spikes".
  const cx = 50, cy = 54;
  const w = 25, h = 27;
  const pts = [[cx - 9, r2(cy - h)], [cx + 9, r2(cy - h)], [r2(cx + w), r2(cy - h * 0.34)],
    [r2(cx + w * 0.82), r2(cy + h * 0.5)], [r2(cx + w * 0.4), r2(cy + h)],
    [r2(cx - w * 0.4), r2(cy + h)], [r2(cx - w * 0.82), r2(cy + h * 0.5)],
    [r2(cx - w), r2(cy - h * 0.34)]];
  const inner = pts.map(([x, y]) => [r2(cx + (x - cx) * 0.6), r2(cy + (y - cy) * 0.6)]);
  const stroke = hsl(sp.hue2, 85, 84, 0.75);
  let rivets = '';
  for (const [x, y] of inner) rivets += `<circle cx="${x}" cy="${y}" r="1.5" fill="${stroke}" opacity=".8"/>`;
  const plate = `<path d="M${cx - w * 0.86},${r2(cy - h * 0.18)}L${cx + w * 0.86},${r2(cy - h * 0.18)}
    L${cx + w * 0.7},${r2(cy - h * 0.02)}L${cx - w * 0.7},${r2(cy - h * 0.02)}Z"
    fill="${hsl(sp.hue2, 70, 78, 0.35)}" stroke="${stroke}" stroke-width=".7"/>`;
  return { hull: pts, cx, cy, headX: cx, headY: r2(cy - h * 0.52), headR: w * 0.5,
    extras: `<path d="${pathOf(inner)}" fill="none" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>${plate}${rivets}` };
}

// --- Verdant body families --------------------------------------------------
// Plant silhouettes, built from the same primitives. They read as GROWN rather
// than CUT: fewer hard facets, more curves, and a stem that anchors them to the
// ground line so they look planted instead of floating.

function stem(sp, cx, yTop, yBase, w = 2.6) {
  return `<path d="M${r2(cx)},${r2(yBase)} Q${r2(cx - w * 1.6)},${r2((yTop + yBase) / 2)} ${r2(cx)},${r2(yTop)}"
    fill="none" stroke="${hsl(sp.hue + 12, 52, 38)}" stroke-width="${w}" stroke-linecap="round"/>`;
}

function bodyLeaf(sp, rand) {
  const cx = 50, cy = 50;
  const w = 17 + rand() * 4, h = 25 + rand() * 6;
  // A pointed ovate leaf: two quadratic sides meeting at a tip.
  const hull = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, a = Math.PI * t;
    hull.push([r2(cx + Math.sin(a) * w), r2(cy - h + t * h * 2)]);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10, a = Math.PI * t;
    hull.push([r2(cx - Math.sin(a) * w), r2(cy - h + t * h * 2)]);
  }
  const veins = [0.25, 0.5, 0.75].map((t) =>
    `<path d="M${cx},${r2(cy - h + t * h * 1.4)} L${r2(cx + w * 0.8 * (1 - t))},${r2(cy - h + t * h * 2.1)}"
       stroke="${hsl(sp.hue, 45, 30, .4)}" stroke-width=".9" fill="none"/>
     <path d="M${cx},${r2(cy - h + t * h * 1.4)} L${r2(cx - w * 0.8 * (1 - t))},${r2(cy - h + t * h * 2.1)}"
       stroke="${hsl(sp.hue, 45, 30, .4)}" stroke-width=".9" fill="none"/>`).join('');
  return { hull, cx, cy, headX: cx, headY: cy - h * 0.18, headR: w * 0.72,
    extras: stem(sp, cx, cy + h * 0.9, 88) + `<line x1="${cx}" y1="${r2(cy - h)}" x2="${cx}" y2="${r2(cy + h)}"
      stroke="${hsl(sp.hue, 48, 32, .5)}" stroke-width="1.3"/>` + veins };
}

function bodyBloom(sp, rand) {
  const cx = 50, cy = 48;
  const petals = 5 + (sp.id % 4);
  const pr = 15 + rand() * 5;
  let out = stem(sp, cx, cy + 12, 88, 3);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU - Math.PI / 2;
    const px = cx + Math.cos(a) * pr * 1.05, py = cy + Math.sin(a) * pr * 1.05;
    out += `<ellipse cx="${r2(px)}" cy="${r2(py)}" rx="${r2(pr * 0.62)}" ry="${r2(pr * 0.9)}"
      transform="rotate(${r2((a * 180) / Math.PI + 90)} ${r2(px)} ${r2(py)})"
      fill="url(#g${sp.id}w)" stroke="${hsl(sp.hue2, 72, 82, .55)}" stroke-width=".7"/>`;
  }
  const hull = radialPoly(cx, cy, 13, 12.5, Math.max(6, sp.f), rand, 0.1);
  return { hull, cx, cy, headX: cx, headY: cy - 1, headR: 11.5, extras: out, behind: true };
}

function bodyShroom(sp, rand) {
  const cx = 50, cy = 46;
  const w = 24 + rand() * 5;
  const cap = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    cap.push([r2(cx - w + t * w * 2), r2(cy - Math.sin(Math.PI * t) * (13 + rand() * 3))]);
  }
  cap.push([r2(cx + w * 0.86), r2(cy + 5)], [r2(cx - w * 0.86), r2(cy + 5)]);
  const stalkY = cy + 32;
  let out = `<path d="M${r2(cx - 7)},${r2(cy + 3)} Q${r2(cx - 9)},${r2(stalkY)} ${r2(cx - 5)},${r2(stalkY + 3)}
      L${r2(cx + 5)},${r2(stalkY + 3)} Q${r2(cx + 9)},${r2(stalkY)} ${r2(cx + 7)},${r2(cy + 3)} Z"
      fill="${hsl(sp.hue2, 32, 82)}" stroke="${hsl(sp.hue, 30, 58, .6)}" stroke-width=".8"/>`;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI + (i + 0.5) / 5 * Math.PI;
    out += `<circle cx="${r2(cx + Math.cos(a) * w * 0.62)}" cy="${r2(cy + Math.sin(a) * 9)}" r="${r2(1.6 + rand() * 1.8)}"
      fill="${hsl(sp.hue2, 90, 92, .8)}"/>`;
  }
  return { hull: cap, cx, cy: cy - 2, headX: cx, headY: cy + 16, headR: 9.5, extras: out, behind: true };
}

function bodyVine(sp, rand) {
  const cx = 46, cy = 34;
  let out = '';
  const pts = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    pts.push([cx + Math.sin(t * 5.2 + 0.4) * (9 + t * 17), cy + t * 48]);
  }
  out += `<polyline points="${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ')}" fill="none"
    stroke="${hsl(sp.hue, 50, 42)}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  for (let i = 2; i < pts.length; i += 2) {
    const [x, y] = pts[i];
    const dir = i % 4 === 0 ? 1 : -1;
    out += `<ellipse cx="${r2(x + dir * 9)}" cy="${r2(y)}" rx="7.5" ry="4.4"
      transform="rotate(${dir * 26} ${r2(x + dir * 9)} ${r2(y)})"
      fill="url(#g${sp.id}b)" stroke="${hsl(sp.hue2, 62, 76, .5)}" stroke-width=".6"/>`;
  }
  const hull = radialPoly(cx, cy, 12, 11, Math.max(6, sp.f), rand, 0.12);
  return { hull, cx, cy, headX: cx, headY: cy - 1, headR: 10, extras: out, behind: true };
}

function bodyPod(sp, rand) {
  const cx = 50, cy = 56;
  const w = 18 + rand() * 4, h = 24 + rand() * 5;
  const hull = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, a = Math.PI * t;
    hull.push([r2(cx + Math.sin(a) * w), r2(cy - h * Math.cos(a))]);
  }
  for (let i = 12; i >= 0; i--) {
    const t = i / 12, a = Math.PI * t;
    hull.push([r2(cx - Math.sin(a) * w), r2(cy - h * Math.cos(a))]);
  }
  const seam = `<path d="M${cx},${r2(cy - h)} Q${r2(cx + 4)},${cy} ${cx},${r2(cy + h)}"
    fill="none" stroke="${hsl(sp.hue, 40, 30, .45)}" stroke-width="1.4"/>`;
  const leaf = `<ellipse cx="${r2(cx + 11)}" cy="${r2(cy - h - 2)}" rx="8" ry="4"
    transform="rotate(-28 ${r2(cx + 11)} ${r2(cy - h - 2)})" fill="${hsl(sp.hue + 30, 55, 46)}"/>`;
  return { hull, cx, cy, headX: cx, headY: cy - h * 0.3, headR: w * 0.66, extras: seam + leaf };
}

function bodyBramble(sp, rand) {
  const cx = 50, cy = 58;
  let out = '';
  const n = 5 + (sp.id % 3);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.9 + (i / (n - 1)) * Math.PI * 0.8;
    const len = 24 + rand() * 16;
    const x2 = cx + Math.cos(a) * len, y2 = cy + Math.sin(a) * len;
    out += `<path d="M${cx},${r2(cy + 8)} Q${r2(cx + Math.cos(a) * len * 0.5 - 6)},${r2(cy + Math.sin(a) * len * 0.6)} ${r2(x2)},${r2(y2)}"
      fill="none" stroke="${hsl(sp.hue, 44, 36)}" stroke-width="2.6" stroke-linecap="round"/>`;
    out += `<circle cx="${r2(x2)}" cy="${r2(y2)}" r="${r2(3 + rand() * 2.4)}" fill="${hsl(sp.hue2, 78, 62)}"
      stroke="${hsl(sp.hue2, 84, 84, .6)}" stroke-width=".6"/>`;
  }
  const hull = radialPoly(cx, cy + 10, 20, 13, Math.max(7, sp.f), rand, 0.14);
  return { hull, cx, cy: cy + 10, headX: cx, headY: cy + 8, headR: 13, extras: out, behind: true };
}

const BODIES = {
  orb: bodyOrb, shard: bodyShard, spire: bodySpire, wisp: bodyWisp, moth: bodyMoth,
  beetle: bodyBeetle, serpent: bodySerpent, cluster: bodyCluster, construct: bodyConstruct,
  leaf: bodyLeaf, bloom: bodyBloom, shroom: bodyShroom, vine: bodyVine, pod: bodyPod, bramble: bodyBramble,
};

// --- parts ------------------------------------------------------------------
function faceOf(sp, b, rig) {
  // Drawn in head-local space then translated, so every part scales with headR
  // and no family needs its own hand-placed coordinates.
  const n = Math.max(1, Math.min(4, sp.eyes));
  const wide = Math.max(0, -rig.lidTop);
  const R = b.headR * (n >= 3 ? 0.21 : 0.27) * (1 + wide);
  const skin = `url(#g${sp.id}b)`;
  let out = '';

  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i - (n - 1) / 2) * (b.headR * (n >= 3 ? 0.52 : 0.68));
    const ex = b.headX + spread;
    const ey = b.headY + (n === 4 && i % 2 ? R * 1.4 : 0);
    const side = spread === 0 ? 0 : Math.sign(spread);

    // eyeball
    out += `<ellipse cx="${r2(ex)}" cy="${r2(ey)}" rx="${r2(R)}" ry="${r2(R * 1.12)}" fill="#0d1220" opacity=".9"/>`;
    // pupil highlight — its OFFSET is where the critter is looking
    const px = ex + rig.pupilDX * R * 0.8;
    const py = ey + rig.pupilDY * R * 0.8;
    const pr = R * 0.36 * rig.pupilScale;
    out += `<circle cx="${r2(px)}" cy="${r2(py)}" r="${r2(pr)}" fill="#fff" opacity=".94"/>`;
    if (rig.pupilScale > 1.2) {
      out += `<circle cx="${r2(px + pr * 0.6)}" cy="${r2(py + pr * 0.5)}" r="${r2(pr * 0.34)}" fill="#fff" opacity=".6"/>`;
    }

    // lids — filled with the BODY gradient so they read as the body closing over
    // the eye rather than as a grey bar sitting on top of it.
    const ry = R * 1.12;
    if (rig.lidTop > 0) {
      const cyL = ey - 2 * ry * (1 - rig.lidTop);
      out += `<ellipse cx="${r2(ex)}" cy="${r2(cyL)}" rx="${r2(R * 1.16)}" ry="${r2(ry)}" fill="${skin}"/>`;
    }
    if (rig.lidBot > 0) {
      const cyL = ey + 2 * ry * (1 - rig.lidBot);
      out += `<ellipse cx="${r2(ex)}" cy="${r2(cyL)}" rx="${r2(R * 1.16)}" ry="${r2(ry)}" fill="${skin}"/>`;
    }

    // brow — the single highest-signal facial part at sprite size
    const bw = R * 1.35;
    const by = ey - R * (2.15 - rig.browY * 4);
    const tilt = (side >= 0 ? -1 : 1) * rig.browTilt + (side > 0 ? rig.browAsym : 0);
    out += `<g transform="rotate(${r2(tilt)} ${r2(ex)} ${r2(by)})">
      <path d="M${r2(ex - bw)},${r2(by)} Q${r2(ex)},${r2(by - R * 0.5)} ${r2(ex + bw)},${r2(by)}"
        fill="none" stroke="#0d1220" stroke-width="${r2(R * 0.30)}" stroke-linecap="round" opacity=".7"/></g>`;
  }

  // mouth
  const mw = b.headR * rig.mouthW * 0.5;
  const mh = b.headR * rig.mouthH * 0.5;
  const my = b.headY + b.headR * 0.58;
  const d = mouthPath(rig.mouth, mw, mh);
  const filled = FILLED_MOUTHS.has(rig.mouth);
  out += `<g transform="translate(${r2(b.headX)} ${r2(my)})">
    <path d="${d}" fill="${filled ? '#160b14' : 'none'}" fill-opacity=".85"
      stroke="#160b14" stroke-width="${r2(Math.max(0.9, b.headR * 0.085))}" stroke-linecap="round" stroke-linejoin="round" opacity=".82"/></g>`;

  return out;
}

function limbsOf(sp, b, rand, rig) {
  if (!sp.limbs) return '';
  let out = '';
  const per = Math.ceil(sp.limbs / 2);
  const splay = rig.limbSplay, droop = rig.limbDroop;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < per; i++) {
      if (side * i > sp.limbs) break;
      const t = per === 1 ? 0.5 : i / (per - 1);
      const y = b.cy + 4 + t * 16;
      const x0 = b.cx + side * (14 + rand() * 3);
      const x1 = x0 + side * (7 + rand() * 5) * splay;
      const y1 = y + 8 + rand() * 6 + droop;
      out += `<path d="M${r2(x0)},${r2(y)}L${r2(x1)},${r2(y1 - 4)}L${r2(x1 - side * 2 * splay)},${r2(y1)}"
        fill="none" stroke="${hsl(sp.hue, 55, 62, 0.85)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  return out;
}

function auraOf(sp, rand) {
  switch (sp.aura) {
    case 'glow':
      return `<circle cx="50" cy="54" r="34" fill="url(#g${sp.id}a)" opacity=".55"/>`;
    case 'sparkle': {
      let out = '';
      for (let i = 0; i < 7; i++) {
        const a = rand() * TAU, d = 30 + rand() * 12;
        const x = r2(50 + Math.cos(a) * d), y = r2(52 + Math.sin(a) * d * 0.86);
        const s = r2(1.6 + rand() * 2.4);
        out += `<path d="M${x},${y - s}L${r2(x + s * 0.4)},${y}L${x},${y + s}L${r2(x - s * 0.4)},${y}Z" fill="${hsl(sp.hue2, 95, 84)}" opacity="${r2(0.5 + rand() * 0.45)}"/>`;
      }
      return out;
    }
    case 'corona': {
      let out = `<circle cx="50" cy="54" r="36" fill="url(#g${sp.id}a)" opacity=".5"/>`;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.2;
        const r0 = 31, r1 = 39 + rand() * 7;
        out += `<line x1="${r2(50 + Math.cos(a) * r0)}" y1="${r2(54 + Math.sin(a) * r0)}"
          x2="${r2(50 + Math.cos(a) * r1)}" y2="${r2(54 + Math.sin(a) * r1)}"
          stroke="${hsl(sp.hue2, 92, 78, 0.6)}" stroke-width="1.5" stroke-linecap="round"/>`;
      }
      return out;
    }
    case 'fracture': {
      let out = '';
      for (let i = 0; i < 5; i++) {
        const a = rand() * TAU;
        const x0 = r2(50 + Math.cos(a) * 12), y0 = r2(54 + Math.sin(a) * 12);
        const x1 = r2(50 + Math.cos(a) * 33), y1 = r2(54 + Math.sin(a) * 30);
        const mx = r2((x0 + x1) / 2 + (rand() - 0.5) * 9), my = r2((y0 + y1) / 2 + (rand() - 0.5) * 9);
        out += `<polyline points="${x0},${y0} ${mx},${my} ${x1},${y1}" fill="none"
          stroke="${hsl(sp.hue2, 90, 76, 0.75)}" stroke-width="1.3" stroke-linecap="round"/>`;
      }
      return out;
    }
    default: return '';
  }
}

// --- rarity layer -----------------------------------------------------------
// Rarity must be legible at a glance, at sprite size, before any label is read.
// The first pass had none: a Radiant looked no grander than a Quartz mote, which
// makes the whole 5-tier structure invisible in the one place it matters most.
// Three levers, all tier-driven: SCALE, a REGALIA ring, and ORBITING shards.
const TIER_SCALE = [0, 0.80, 0.88, 0.96, 1.02, 1.08, 1.02];   // index 6 = Verdant Grove

function regaliaOf(sp, rand) {
  // Verdant critters get a living wreath instead of the prism mandala — the same
  // "this one is special" signal in the theme's own vocabulary.
  if (sp.tier === 6) {
    const c1 = hsl(sp.hue2, 70, 74, 0.8);
    let out = `<circle cx="50" cy="50" r="43" fill="none" stroke="${c1}" stroke-width=".9" stroke-dasharray="3 6" opacity=".7"/>`;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + sp.id * 0.4;
      const x = r2(50 + Math.cos(a) * 43), y = r2(50 + Math.sin(a) * 43);
      out += `<ellipse cx="${x}" cy="${y}" rx="4.6" ry="2.4" transform="rotate(${r2((a * 180) / Math.PI + 90)} ${x} ${y})"
        fill="${hsl(sp.hue + (i % 2 ? 18 : -12), 62, 58)}" opacity=".92"/>`;
    }
    return out;
  }
  if (sp.tier < 3) return '';
  const c1 = hsl(sp.hue2, 92, 82, 0.85), c2 = hsl(sp.hue, 90, 70, 0.45);
  let out = '';

  if (sp.tier === 5) {
    // Mandala: a 16-point burst behind everything, the unmistakable "this is the
    // top of the collection" read.
    let star = '';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const r0 = 25, r1 = i % 2 ? 38 : 44;
      star += `<path d="M${r2(50 + Math.cos(a) * r0)},${r2(50 + Math.sin(a) * r0)}
        L${r2(50 + Math.cos(a + 0.1) * r1)},${r2(50 + Math.sin(a + 0.1) * r1)}
        L${r2(50 + Math.cos(a - 0.1) * r1)},${r2(50 + Math.sin(a - 0.1) * r1)}Z"
        fill="${c2}" opacity=".7"/>`;
    }
    out += star;
    out += `<circle cx="50" cy="50" r="46" fill="none" stroke="${c1}" stroke-width="1.1" opacity=".7"/>`;
    out += `<circle cx="50" cy="50" r="41" fill="none" stroke="${c1}" stroke-width=".7" stroke-dasharray="2 4" opacity=".8"/>`;
  } else {
    const R = sp.tier === 4 ? 44 : 42;
    out += `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${c1}" stroke-width="${sp.tier === 4 ? 1.1 : 0.8}"
      stroke-dasharray="${sp.tier === 4 ? '5 4' : '2 5'}" opacity=".75"/>`;
  }

  // Orbiting shards from tier 4 up.
  if (sp.tier >= 4) {
    const n = sp.tier === 5 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + sp.id * 0.7;
      const d = sp.tier === 5 ? 46 : 44;
      const x = r2(50 + Math.cos(a) * d), y = r2(50 + Math.sin(a) * d * 0.94);
      const k = sp.tier === 5 ? 4.4 : 3.4;
      out += `<path d="M${x},${r2(y - k)}L${r2(x + k * 0.6)},${y}L${x},${r2(y + k)}L${r2(x - k * 0.6)},${y}Z"
        fill="${hsl(sp.hue2, 95, 84)}" stroke="${hsl(sp.hue2, 95, 92, 0.9)}" stroke-width=".5"/>`;
    }
  }
  return out;
}

/**
 * Render one critter.
 * @param {object} sp species row from lib/species.js
 * @param {object} opts { size, bg, id } — `id` scopes the gradient ids when many
 *        sprites share one document.
 * @returns {string} a complete <svg> element
 */
export function renderCritter(sp, opts = {}) {
  const size = opts.size ?? 128;
  const rig = rigFor(opts.expression || sp.mood || 'calm');
  const rand = mulberry32(sp.id * 2654435761);
  const make = BODIES[sp.body] || bodyOrb;
  const b = make(sp, rand);
  const hullPath = pathOf(b.hull);
  const facets = facetsOf(b.hull, b.cx, b.cy);

  const defs = `
    <radialGradient id="g${sp.id}a" cx="50%" cy="45%">
      <stop offset="0%" stop-color="${hsl(sp.hue2, 95, 72, 0.85)}"/>
      <stop offset="60%" stop-color="${hsl(sp.hue, 90, 62, 0.28)}"/>
      <stop offset="100%" stop-color="${hsl(sp.hue, 90, 60, 0)}"/>
    </radialGradient>
    <linearGradient id="g${sp.id}b" x1="18%" y1="0%" x2="82%" y2="100%">
      <stop offset="0%"   stop-color="${hsl(sp.hue2, 88, 78)}"/>
      <stop offset="48%"  stop-color="${hsl(sp.hue, 78, 58)}"/>
      <stop offset="100%" stop-color="${hsl(sp.hue - 12, 68, 36)}"/>
    </linearGradient>
    <linearGradient id="g${sp.id}w" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${hsl(sp.hue2, 92, 82, 0.85)}"/>
      <stop offset="100%" stop-color="${hsl(sp.hue, 84, 60, 0.5)}"/>
    </linearGradient>`;

  // Facet shading: alternating light/dark wedges give the cut-gem read.
  // sp.f drives how many wedges the hull is cut into, so a high-facet species
  // visibly reads as a more complex cut rather than only differing in colour.
  let facetSvg = '';
  facets.forEach((d, i) => {
    const lit = (i + sp.id) % 2 === 0;
    facetSvg += `<path d="${d}" fill="${hsl(sp.hue + (lit ? 8 : -14), lit ? 82 : 62, lit ? 70 : 44, lit ? 0.5 : 0.42)}"/>`;
  });

  const behind = b.behind ? b.extras : '';
  const front = b.behind ? '' : b.extras;

  const k = TIER_SCALE[sp.tier] ?? 1;
  const core = sp.tier === 5
    ? `<circle cx="${r2(b.cx)}" cy="${r2(b.cy)}" r="9" fill="#fff" opacity=".28"/>`
    : '';

  // BODY LANGUAGE. Pivot the rotation and the squash at the feet (y=84) so a
  // tilted or braced critter still stands on its own shadow instead of sliding
  // off it. This is the half of the rig that survives at 40px, where a mouth is
  // three pixels and a brow is one.
  const pose = `translate(${r2(rig.lean)} 0) rotate(${r2(rig.tilt)} 50 84)`
    + ` translate(0 84) scale(1 ${r2(rig.squash)}) translate(0 -84)`;

  // Idle motion is DELIBERATELY STEPPED. calcMode="discrete" snaps between three
  // hold frames instead of interpolating: smooth procedural motion at 60fps reads
  // floaty, a low-rate hold reads handcrafted. Emberkeep learned this the
  // expensive way at 12fps and it transfers directly.
  const bob = rig.bob;
  const anim = opts.animate
    ? `<animateTransform attributeName="transform" type="translate" additive="sum"
         calcMode="discrete" dur="${r2(1.5 + (sp.id % 5) * 0.14)}s" repeatCount="indefinite"
         values="0 0; 0 ${r2(-bob)}; 0 ${r2(-bob * 0.45)}; 0 ${r2(bob * 0.35)}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(sp.name)}, ${esc(sp.set)}, looking ${esc(opts.expression || sp.mood)}">
  <defs>${defs}</defs>
  ${opts.bg ? `<rect width="100" height="100" rx="14" fill="${opts.bg}"/>` : ''}
  ${regaliaOf(sp, rand)}
  <ellipse cx="50" cy="88" rx="${r2((20 + sp.tier * 1.6) * k)}" ry="3.6" fill="#000" opacity=".3"/>
  <g transform="translate(50 52) scale(${k}) translate(-50 -52)">
    <g transform="${pose}">${anim}
      ${auraOf(sp, rand)}
      ${behind}
      ${limbsOf(sp, b, rand, rig)}
      <path d="${hullPath}" fill="url(#g${sp.id}b)" stroke="${hsl(sp.hue2, 80, 84, 0.65)}" stroke-width="1.1" stroke-linejoin="round"/>
      ${facetSvg}
      ${core}
      ${front}
      ${b.overHull || ''}
      <path d="${hullPath}" fill="none" stroke="${hsl(sp.hue2, 90, 88, 0.5)}" stroke-width="1" stroke-linejoin="round"/>
      ${faceOf(sp, b, rig)}
    </g>
  </g>
</svg>`;
}
