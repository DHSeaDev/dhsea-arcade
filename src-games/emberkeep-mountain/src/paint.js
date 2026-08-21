// Emberkeep - Mountain — how a cube is painted, and how light falls on it.
//
// Isometric form comes almost entirely from the three visible faces being three different values.
// Top brightest, then +x, then +y — flat shading, no gradients, no textures. Monument Valley's
// look is flat colour blocks with soft large-face gradients and heavy negative space, and the
// thing that makes it read as architecture rather than as a diagram is that the value steps are
// LARGE. Timid shading reads as a UI mock.
//
// Ember's light is added on top of that as a per-face term: distance falloff times the dot of the
// face normal with the direction to him. That is Lambert, computed once per face per frame — a few
// hundred dot products, not a per-pixel pass — which is the same reasoning that put per-tile
// shading in the platformer instead of per-pixel normals.

import { facePoly, DIRS, project } from './iso.js';

// An optional world-space transform, used only while a group is animating between quarter turns.
// The MODEL is already at the destination — the lattice guarantees depend on it being there — so
// this exists purely to sweep the drawing from where it was to where it now is.
const CORN = {
  top: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
  px:  [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
  py:  [[0,1,0],[1,1,0],[1,1,1],[0,1,1]],
};

// Face shading multipliers. The gap between them is the form.
const FACE_K = { top: 1.00, px: 0.72, py: 0.50 };
const FACE_N = { top: { x: 0, y: 0, z: 1 }, px: { x: 1, y: 0, z: 0 }, py: { x: 0, y: 1, z: 0 } };

// THE PALETTE, WIDENED IN HUE — and the art gate is why.
//
// The first version ran stone at hue 275 against an air colour at hue 280. Five degrees apart. The
// third rule of aerial perspective is that hue shifts toward the sky's hue with distance, and with
// a five-degree gap there is nothing to shift: the measurement was pure rounding noise, and more
// importantly the SCENE was nearly monochromatic, which is why it read flat no matter how correct
// the fog maths was. A ramp cannot rescue a palette with no hue in it.
//
// These are spread deliberately across the wheel — cool stone, green moss, warm sand, red-warm
// rose — so distance has real work to do and the scene has something to lose as it recedes.
export const PALETTE = {
  stone:  { r: 108, g: 118, b: 146 },   // cool blue-grey, ~222deg
  pale:   { r: 206, g: 196, b: 178 },   // warm bone, ~40deg
  warm:   { r: 196, g: 126, b: 88 },    // terracotta, ~21deg
  deep:   { r: 70,  g: 78,  b: 116 },   // deep indigo, ~228deg
  moss:   { r: 104, g: 142, b: 104 },   // green, ~120deg
  sand:   { r: 206, g: 176, b: 112 },   // ochre, ~41deg
  rose:   { r: 190, g: 118, b: 138 },   // dusty rose, ~342deg
  ink:    { r: 48,  g: 52,  b: 78 },    // near-black blue
  beacon: { r: 236, g: 178, b: 96 },    // the goal, warmest thing in the game
};

const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;

// ---------------------------------------------------------------------------
// AERIAL PERSPECTIVE — the whole reason this game will read as a place rather than a diagram.
//
// The rules are not stylistic preferences, they are five hundred years old and they are numeric.
// With distance from the viewer: VALUE compresses toward the sky's value, SATURATION drops, HUE
// shifts toward the sky's hue, edge contrast softens, and detail frequency falls off. Firewatch
// built its entire sense of depth from stacked coloured fog bands rather than from geometry
// detail, on the reasoning that the sky occupies half the frame and therefore sets the palette.
//
// We get this almost free because the lattice already carries a depth key: x+y+z. Cubes far from
// the camera are LOW depth, so the fog term is inverted from it. Three operations, in this order,
// because the order is what the art gate in tools/artgate.js checks:
//   1. lerp the colour toward the sky colour       (hue shift + value compression together)
//   2. an extra pull toward that colour's own grey (saturation drop on its own axis)
//   3. reduce the edge hairline's alpha            (contrast/detail falloff)
//
// FOG is set per level from the sky, so a chapter's air is the same colour as its sky. Air that is
// a different colour from the sky it sits under is the single most common way faked depth reads
// as coloured cellophane.
export const FOG = { r: 26, g: 24, b: 34, strength: 0.72, desat: 0.55, dmin: 0, dmax: 1 };

export function setFog(rgb, dmin, dmax, strength = 0.72) {
  FOG.r = rgb.r; FOG.g = rgb.g; FOG.b = rgb.b;
  FOG.dmin = dmin; FOG.dmax = Math.max(dmin + 1, dmax);
  FOG.strength = strength;
}

// 0 at the nearest cube, 1 at the furthest. Exported so the art gate can bucket by the same term
// the renderer uses, rather than by its own idea of what "far" means.
export function fogAt(depth) {
  const t = (FOG.dmax - depth) / (FOG.dmax - FOG.dmin);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  // BIASED, not linear. These levels span ~20 depth units, so a linear ramp put meaningful fog on
  // the cube Ember is standing on and killed his own light pool. Squaring pushes the effect out to
  // where distance actually is, which is also closer to how aerial perspective behaves in life —
  // the first few metres of air do almost nothing.
  return c * c;
}

function applyAerial(r, g2, b, f) {
  if (f <= 0.001) return { r, g: g2, b };
  const k = f * FOG.strength;
  // 1. toward the sky colour — this is hue shift and value compression in one operation
  r = r + (FOG.r - r) * k;
  g2 = g2 + (FOG.g - g2) * k;
  b = b + (FOG.b - b) * k;
  // 2. and an extra pull toward its own grey, because a pure lerp toward a coloured fog can leave
  //    a distant surface MORE saturated than a near one if the fog itself is saturated
  const grey = 0.299 * r + 0.587 * g2 + 0.114 * b;
  const d = f * FOG.desat;
  return { r: r + (grey - r) * d, g: g2 + (grey - g2) * d, b: b + (grey - b) * d };
}

// The lit colour of one face, before and after the air gets to it.
// Flat shading: top brightest, then +x, then +y. Isometric form comes almost entirely from those
// three values being far apart — timid value steps read as a UI mock rather than as architecture.
export function faceColour(cell, which, lights, fog = 0) {
  const base = PALETTE[cell.colour || 'stone'] || PALETTE.stone;
  const k = FACE_K[which];
  let lr = 0, lg = 0, lb = 0;
  const n = FACE_N[which];
  const cx = cell.x + 0.5 + n.x * 0.5, cy = cell.y + 0.5 + n.y * 0.5, cz = cell.z + 0.5 + n.z * 0.5;
  for (const L of lights) {
    const dx = L.x - cx, dy = L.y - cy, dz = L.z - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > L.radius) continue;
    const nd = Math.max(0, (dx * n.x + dy * n.y + dz * n.z) / Math.max(0.0001, d));
    // the same perceptual falloff the platformer settled on: literal inverse-square puts nearly
    // all of the light in the inner fifth and the rest of the scene reads unlit
    const f = Math.pow(1 - d / L.radius, 1.7) * (0.30 + 0.70 * nd) * L.gain;
    lr += f * 255; lg += f * 176; lb += f * 96;
  }
  // The light is added BEFORE the fog, not after. A lamp seen through a mile of air is dimmed by
  // that air; adding the glow afterwards would make distant lights the brightest things on screen,
  // which is the exact inverse of how distance works.
  const c = applyAerial(base.r * k + lr, base.g * k + lg, base.b * k + lb, fog);
  return `rgb(${clamp(c.r)},${clamp(c.g)},${clamp(c.b)})`;
}

export function drawCube(g, cell, lights, alpha = 1, xf = null, fog = 0) {
  g.globalAlpha = alpha;
  const poly4 = (which) => xf
    ? CORN[which].map(([dx, dy, dz]) => { const q = xf(cell.x + dx, cell.y + dy, cell.z + dz); return project(q.x, q.y, q.z); })
    : facePoly(cell.x, cell.y, cell.z, which);
  for (const which of ['py', 'px', 'top']) {
    const poly = poly4(which);
    g.fillStyle = faceColour(cell, which, lights, fog);
    g.beginPath();
    g.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x, poly[i].y);
    g.closePath();
    g.fill();
  }
  // A hairline on the top face's leading edges. Without it, two cubes of the same colour merge
  // into one blob and the lattice stops reading as blocks — which matters more here than usual,
  // because the player has to be able to COUNT steps to judge a route.
  const t = poly4('top');
  // 3. the edge hairline fades with distance too. Detail frequency falling off IS one of the five
  //    rules, and a crisp white edge on a far cube is the loudest possible violation of it.
  g.globalAlpha = alpha * 0.30 * (1 - fog * 0.85);
  g.strokeStyle = 'rgba(255,246,232,.5)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(t[0].x, t[0].y); g.lineTo(t[1].x, t[1].y); g.lineTo(t[2].x, t[2].y); g.stroke();
  g.globalAlpha = 1;
}

// A handle: the thing you drag to turn part of the mountain. It has to read as grabbable at a
// glance, because there is no tutorial text anywhere in this game.
export function drawHandle(g, h, t, hot) {
  const c = project(h.at.x, h.at.y, h.at.z);
  const r = 17 + (hot ? 3 : 0);
  g.save();
  g.translate(c.x, c.y);
  g.strokeStyle = hot ? 'rgba(255,214,150,.95)' : 'rgba(236,224,240,.62)';
  g.lineWidth = 2.4;
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.34, 0, 7); g.stroke();
  // three ticks, slowly turning, so a still frame still says "this rotates"
  for (let i = 0; i < 3; i++) {
    const a = t * 0.0055 + i * 2.094;
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52);
    g.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
    g.stroke();
  }
  g.restore();
}
