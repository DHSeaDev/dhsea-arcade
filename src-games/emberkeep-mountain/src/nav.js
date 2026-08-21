// Emberkeep - Mountain — walking.
//
// There is no physics here and there is no gravity. Ember does not jump, cannot fall and cannot
// die. He walks a graph. That is not a simplification of a platformer, it is the genre: the player
// never controls the character directly beyond "go there" — what they control is the architecture.
//
// THE ONE RULE, and every other rule in this file is a consequence of it:
//   If two surfaces look joined, they ARE joined.
// Implemented as: take a step in the character's own frame, project where that step lands, and ask
// the world which walkable surface is FRONTMOST at that point on screen. When the neighbouring
// cube really is there, it is the frontmost answer and the walk is ordinary. When it is not,
// whatever else happens to line up is the answer, and the walk is impossible. There is deliberately
// no separate code path for the trick — a second path is how the trick and the ordinary case drift
// apart and the illusion starts lying inconsistently.

import { DIRS, tangents, faceCentre, keyOf } from './iso.js';
import { nk } from './lattice.js';

// Where a step in tangent `t` from node `n` can land, in priority order.
// flat first, then a step UP, then a step DOWN — the ordering platformers have used forever,
// because a player who walks at a step expects to climb it rather than to stop.
function candidates(n, t) {
  const s = n.p, T = DIRS[t], U = DIRS[n.up];
  return [
    { x: s.x + T.x, y: s.y + T.y, z: s.z + T.z, kind: 'flat' },
    { x: s.x + T.x + U.x, y: s.y + T.y + U.y, z: s.z + T.z + U.z, kind: 'up' },
    { x: s.x + T.x - U.x, y: s.y + T.y - U.y, z: s.z + T.z - U.z, kind: 'down' },
  ];
}

// Is there room for Ember to stand on this node? The space he occupies is the cell one step
// along its up-vector; if something is in it, he cannot be.
function headroom(w, m) {
  const U = DIRS[m.up];
  return !w.has(m.x + U.x, m.y + U.y, m.z + U.z);
}

function walkable(w, m, ctx) {
  if (!m || !m.vis || !headroom(w, m)) return false;
  if (m.cell.kind === 'void') return false;
  // OUR mechanic, not Monument Valley's: a `lit` surface only exists while Ember's light reaches
  // it. It is Emberkeep's phantom floor reborn in three dimensions, and it is the reason this is
  // a fire's game rather than a very good tribute.
  if (m.cell.lit && ctx && !ctx.isLit(m)) return false;
  // CROWS. This line used to read `if (m.cell.blockedBy && ctx && ctx.blocked(m))` — gated behind
  // a cell property that NOTHING in the game has ever set. Crows have therefore never blocked
  // anything since the day they were added; chapter V was a walk past some birds. No gate caught
  // it because the chapter was completable either way, which is exactly the blind spot a
  // completability proof has: it asks whether you CAN get through, never whether the obstacle
  // that is supposed to stop you does.
  if (ctx && ctx.blocked && ctx.blocked(m)) return false;
  return true;
}

// Is this step onto the cube the step actually aimed at, or onto one that merely LOOKS like it?
//
// THIS USED TO BE A MANHATTAN-DISTANCE TEST (<= 2) and that was too loose by exactly the amount
// that matters. All three candidate offsets are themselves within Manhattan 2 of the node, so a
// coincidence landing on some OTHER cube within 2 read as ordinary walking and was let through
// without an authored join. The stress harness found the consequence in chapter II: standing on
// the raised sand block at 2,-2,1 and walking back toward the courtyard, the FLAT candidate
// 2,-1,1 is empty, but 1,-2,0 shares its screen point and sits at Manhattan 2 — so it won the
// resolution, and it wins before the DOWN candidate (the real step home) is ever tried. The arm
// was a one-way trap: 24 reachable surfaces became 5, in a game with no fail state and therefore
// no way to tell the player they are stuck.
//
// The rule the illusion actually wants is the strict one: ordinary walking means the cube really
// is where you stepped. Anything else is an illusion and must be authored at both ends.
// `c` is a point in FACE-CENTRE space (n.p plus a unit direction), not a cube coordinate — so the
// comparison is against the resolved node's own face centre, m.p, and not against m.x/m.y/m.z.
const exact = (c, m) => m.p.x === c.x && m.p.y === c.y && m.p.z === c.z;

// One step. Returns the destination node or null.
export function step(w, n, t, ctx) {
  if (!n) return null;                 // no node, no step. It used to throw from candidates().
  for (const c of candidates(n, t)) {
    const m = w.frontAt(keyOf(c.x, c.y, c.z), n.up);
    if (!m || m === n) continue;
    if (!walkable(w, m, ctx)) continue;
    // AN ILLUSION JOIN MUST BE AUTHORED.
    //
    // This is the one place this game differs from Monument Valley's own rule, and it is because
    // of how the levels are made rather than because the rule is wrong. In Monument Valley every
    // level is hand-built, so every screen-space coincidence is one somebody chose. Here levels are
    // laid out with pads, arms and legs, and coincidence is a property of ARITHMETIC: any two
    // surfaces whose (x-y, x+y-2z) happen to match become a bridge nobody drew.
    //
    // Measured, the first time it was looked for: 159 accidental joins across ten chapters. They
    // let you walk out of chapter VIII's first room into the second without using the door, and
    // across a two-tile gap in chapter III that the puzzle depended on. Both were invisible in a
    // screenshot and both deleted the puzzle outright.
    //
    // So a step onto something that is NOT a world-neighbour requires one end to carry `join`.
    // Ordinary walking is unaffected. Every authored illusion still works. Every accident is gone.
    // BOTH ends, not either. Marking one end legalises every coincidence that end happens to
    // take part in — flagging a three-cube run left six accidental joins alive in chapter VIII,
    // including one from a support leg buried under a platform. A join is a PAIR somebody chose.
    if (!exact(c, m) && !(n.cell.join && m.cell.join)) continue;
    return { to: m, kind: c.kind };
  }
  // WRAPPING a convex edge — how you walk up the outside of a block and end up standing on its
  // side, which is where "which way is up" stops being a fixed fact. Opt-in per cube rather than
  // universal: a world where every edge wraps lets the player stroll around the outside of every
  // puzzle, which is a shortcut past the puzzle rather than a solution to it.
  const T = DIRS[t];
  if (n.cell.wrap && !w.has(n.x + T.x, n.y + T.y, n.z + T.z)) {
    const m = w.node(n.x, n.y, n.z, t);
    if (walkable(w, m, ctx)) return { to: m, kind: 'wrap' };
  }
  return null;
}

export function neighbours(w, n, ctx) {
  const out = [];
  for (const t of tangents(n.up)) {
    const r = step(w, n, t, ctx);
    if (r) out.push({ ...r, t });
  }
  return out;
}

// A*, with the heuristic measured in SCREEN space rather than world space. That is not an
// approximation — screen distance is the metric the illusion makes true, and a world-space
// heuristic would be actively wrong across an impossible join, where two adjacent surfaces are
// twelve units apart in the world.
export function findPath(w, from, to, ctx) {
  if (!from || !to) return null;
  if (from === to) return [];
  const h = (a) => Math.abs(a.u - to.u) + Math.abs(a.v - to.v);
  const open = [{ n: from, g: 0, f: h(from), prev: null, via: null }];
  const seen = new Map([[nk(from.x, from.y, from.z, from.up), 0]]);
  let guard = 0;
  while (open.length && guard++ < 20000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.n === to) {
      const path = [];
      for (let c = cur; c.prev; c = c.prev) path.unshift({ to: c.n, kind: c.via });
      return path;
    }
    for (const e of neighbours(w, cur.n, ctx)) {
      const k = nk(e.to.x, e.to.y, e.to.z, e.to.up);
      const g = cur.g + 1;
      if (seen.has(k) && seen.get(k) <= g) continue;
      seen.set(k, g);
      open.push({ n: e.to, g, f: g + h(e.to), prev: cur, via: e.kind });
    }
  }
  return null;
}

// Every node reachable from a start node. The solver's primitive.
export function reachable(w, from, ctx) {
  const out = new Set();
  if (!from) return out;
  const q = [from];
  out.add(nk(from.x, from.y, from.z, from.up));
  while (q.length) {
    const n = q.shift();
    for (const e of neighbours(w, n, ctx)) {
      const k = nk(e.to.x, e.to.y, e.to.z, e.to.up);
      if (out.has(k)) continue;
      out.add(k); q.push(e.to);
    }
  }
  return out;
}
