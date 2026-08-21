// Emberkeep - Mountain — what the mountain says without saying anything.
//
// Don Carson's environmental-storytelling doctrine, which came out of theme-park design and is
// still the best statement of it: the physical space carries the story, and the VISITOR'S
// EXPECTATIONS do the heavy lifting. You dress a space with evidence of use and let inference
// fill the gap. The vocabulary that works without text:
//
//   scale of construction  — this was built by more people than are here now
//   wear                   — a path worn where feet went, which is a map of past behaviour
//   absence                — something is missing and its shape is still visible
//   damage direction       — what fell, from where
//   repeated motif         — one glyph across every chapter implies one culture and one history
//   graves and markers     — loss, unnamed
//   murals                 — the only permitted "text"
//
// All of it is drawn with the same primitives as everything else. None of it is a media file, none
// of it is interactive, and none of it touches the completability proof — this module draws on the
// faces of cubes that already exist and never adds, removes or changes one.

import { facePoly, project } from './iso.js';

// THE MOTIF. One mark, in every chapter, in a slightly different hand. A glyph that recurs is the
// cheapest way to say "the same people made all of this, and they are not here".
// It is a flame, obviously — but drawn the way people who had lost theirs would draw it.
function motif(g, cx, cy, s, a) {
  g.strokeStyle = `rgba(228,214,196,${a})`;
  g.lineWidth = Math.max(0.8, s * 0.10);
  g.beginPath();
  g.moveTo(cx, cy + s * 0.7);
  g.quadraticCurveTo(cx - s * 0.62, cy - s * 0.1, cx, cy - s * 0.8);
  g.quadraticCurveTo(cx + s * 0.62, cy - s * 0.1, cx, cy + s * 0.7);
  g.stroke();
  g.beginPath();
  g.moveTo(cx, cy + s * 0.34);
  g.quadraticCurveTo(cx - s * 0.24, cy - s * 0.02, cx, cy - s * 0.34);
  g.stroke();
  g.lineWidth = 1;
}

// A tally: somebody counted something here, and stopped.
function tally(g, cx, cy, s, a, n) {
  g.strokeStyle = `rgba(216,204,188,${a})`;
  g.lineWidth = Math.max(0.7, s * 0.07);
  for (let i = 0; i < n; i++) {
    const x = cx - s * 0.5 + i * s * 0.26;
    g.beginPath(); g.moveTo(x, cy - s * 0.4); g.lineTo(x + s * 0.06, cy + s * 0.4); g.stroke();
  }
  if (n >= 4) { g.beginPath(); g.moveTo(cx - s * 0.62, cy + s * 0.3); g.lineTo(cx + s * 0.5, cy - s * 0.3); g.stroke(); }
  g.lineWidth = 1;
}

// A hand. Older than the tally, and the only human thing on the mountain.
function hand(g, cx, cy, s, a) {
  g.fillStyle = `rgba(206,188,170,${a * 0.8})`;
  g.beginPath(); g.ellipse(cx, cy + s * 0.18, s * 0.30, s * 0.34, 0, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) {
    const ang = -1.9 + i * 0.42;
    g.beginPath();
    g.ellipse(cx + Math.cos(ang) * s * 0.36, cy + Math.sin(ang) * s * 0.42 + s * 0.02,
              s * 0.075, s * 0.20, ang + 1.57, 0, 7);
    g.fill();
  }
}

const MARKS = [motif, tally, hand];

// Deterministic per cube: the same cube always carries the same mark, so the mountain does not
// redecorate itself while you look away.
function pick(cell) {
  let h = 2166136261;
  for (const c of `${cell.x},${cell.y},${cell.z}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Marks go on the +x and +y faces — the two vertical faces you can see. Never the top: a mark on a
// floor is a rug, and a mark on a wall is a message.
export function drawMarks(g, cells, chapter, fogFn) {
  // A FIXED SHARE, NOT A FIXED THRESHOLD.
  // A per-cube probability of 1-in-5 gives a seventeen-cube chapter anywhere from one mark to six,
  // and the gate caught a chapter that got exactly one — which reads as an accident rather than as
  // a culture. Ranking the cubes and taking the top share makes the count deterministic and never
  // less than two, so every chapter says something.
  const usable = cells.filter(c => c.kind !== 'void' && !c.group);
  if (!usable.length) return 0;
  const ranked = usable.map(c => ({ c, r: pick(c) })).sort((a, b) => a.r - b.r);
  const want = Math.max(2, Math.min(ranked.length, Math.round(ranked.length * 0.20)));
  let placed = 0;
  for (let i = 0; i < want; i++) {
    const { c, r } = ranked[i];
    const fog = fogFn ? fogFn(c.x + c.y + c.z) : 0;
    const a = (0.40 - fog * 0.34) * (0.72 + r * 1.4);
    if (a < 0.03) continue;
    const which = (r * 977) % 1 < 0.5 ? 'px' : 'py';
    const p = facePoly(c.x, c.y, c.z, which);
    const cx = (p[0].x + p[2].x) / 2, cy = (p[0].y + p[2].y) / 2;
    // the FIRST chapter always gets the flame motif first, because a motif you meet late is a
    // decoration and a motif you meet first is a question
    const fn = (chapter === 0 && placed === 0) ? MARKS[0] : MARKS[(r * 313) % 3 | 0];
    g.save();
    fn(g, cx, cy, 8.5, a, 2 + ((r * 61) % 4 | 0));
    g.restore();
    placed++;
  }
  return placed;
}

// WEAR. Pale patches worn into the tops of the stones that can be stood on. It is the single most
// efficient sentence in the whole vocabulary: people walked here, many times, and are not here now.
// Drawn on the REACHABLE ground rather than on a solution path — see the note in game.js for why
// the solution was the wrong choice and how the gate found it.
export function drawWear(g, route, fogFn) {
  if (!route || !route.length) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < route.length; i++) {
    const n = route[i];
    const fog = fogFn ? fogFn(n.x + n.y + n.z) : 0;
    const a = (0.055 - fog * 0.045);
    if (a <= 0.004) continue;
    const p = project(n.p.x, n.p.y, n.p.z);
    g.fillStyle = `rgba(255,238,214,${a})`;
    g.beginPath();
    g.ellipse(p.x, p.y, 15, 8.6, 0, 0, 7);
    g.fill();
  }
  g.restore();
}
