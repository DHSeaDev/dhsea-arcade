// Emberkeep - Mountain — the runtime a level actually is.
//
// THE GAME AND THE SOLVER BOTH RUN THIS FILE. That coupling is deliberate and it is the same one
// the platformer used: if the prover and the played game drift apart, the proof stops proving
// anything about the thing anyone plays. Every rule about what is walkable, what a handle does and
// what counts as finished lives here exactly once.
//
// THERE IS NO FAIL STATE. Nothing in this file can kill Ember, drain him, time him or lock him
// out. The strongest form of that claim is the one the solver checks: from EVERY configuration
// reachable from the start, the beacon is still reachable. A level that can be put into a dead end
// is a bug here, not a difficulty setting.

import { World, nk } from './lattice.js';
import { DIRS } from './iso.js';
import { findPath, reachable, neighbours } from './nav.js';
import { WISPS, BASE_LIGHT } from './collect.js';

export class Level {
  constructor(def) {
    this.def = def;
    this.world = new World({ cells: def.cells.map(c => ({ ...c })), groups: (def.groups || []).map(g => ({ ...g, pivot: { ...g.pivot } })) });
    this.world.rebuild();
    this.handles = (def.handles || []).map(h => ({ ...h }));
    this.crows = (def.crows || []).map(c => ({ ...c, gone: false }));
    this.doors = def.doors || [];
    this.wick = def.wick ? { ...def.wick, placed: false } : null;
    this.plates = new Map();          // plate id -> pressed?
    this.at = this.world.node(def.start.x, def.start.y, def.start.z, def.start.up ?? 4);
    this.lightR = def.lightR ?? BASE_LIGHT;
    this.won = false;
    this.syncPlates();
    this.placeCollectibles();
    this.got = new Set();          // mote ids taken this visit
    this.wispLit = false;
  }

  // COLLECTIBLES ARE DERIVED FROM THE GRAPH, NOT HAND-PLACED.
  // Three motes and one wisp per chapter, positioned by walking the reachable set from the start.
  // The reason is not laziness: a hand-placed collectible in a level whose geometry ROTATES can
  // end up somewhere unreachable, and nothing would catch it — the completability proof only cares
  // about the beacon. Deriving them from reachability makes "every collectible can be collected"
  // true by construction rather than by inspection, and the suite still asserts it.
  //
  // The wisp goes to the node FURTHEST from the start that is not the beacon, because a thing you
  // find on the way to the exit is not a thing you found.
  placeCollectibles() {
    const set = [...this.reachableNow()];
    const g = this.def.goal;
    const nodes = set.map(k => {
      const [x, y, z, up] = k.split(',').map(Number);
      return this.world.node(x, y, z, up);
    }).filter(n => n && n.up === 4 && n.vis && !(n.x === g.x && n.y === g.y && n.z === g.z));
    // stable order, so a chapter's motes are in the same places every time it is opened
    nodes.sort((a, b) => (a.x - b.x) || (a.y - b.y) || (a.z - b.z));
    const start = this.at;
    const d = (n) => Math.abs(n.x - start.x) + Math.abs(n.y - start.y) + Math.abs(n.z - start.z);
    const far = nodes.slice().sort((a, b) => d(b) - d(a));
    this.wispNode = far[0] || null;
    this.wisp = WISPS[this.def.index ?? 0] || null;
    const pick = [];
    const want = Math.min(3, Math.max(0, nodes.length - 1));
    for (let i = 0; i < want; i++) {
      const t = Math.floor(((i + 1) / (want + 1)) * nodes.length);
      const n = nodes[(t + i * 3) % nodes.length];
      if (n && n !== this.wispNode && !pick.includes(n)) pick.push(n);
      else { const alt = nodes.find(q => q !== this.wispNode && !pick.includes(q)); if (alt) pick.push(alt); }
    }
    this.moteNodes = pick.map((n, i) => ({ n, id: `${this.def.index ?? 0}:${i}` }));
  }

  // What Ember picked up by standing here. Collection is a side effect of walking, never a
  // separate verb — there is no pick-up button in this genre and there should not be one.
  harvest() {
    const out = { motes: [], wisp: null };
    if (!this.at) return out;
    for (const m of this.moteNodes) {
      if (this.got.has(m.id)) continue;
      if (m.n.x === this.at.x && m.n.y === this.at.y && m.n.z === this.at.z && m.n.up === this.at.up) {
        this.got.add(m.id); out.motes.push(m.id);
      }
    }
    if (!this.wispLit && this.wispNode && this.wispNode.x === this.at.x &&
        this.wispNode.y === this.at.y && this.wispNode.z === this.at.z && this.wispNode.up === this.at.up) {
      this.wispLit = true; out.wisp = this.wisp;
    }
    return out;
  }

  // ---- light ------------------------------------------------------------
  // Light is VISION and a puzzle verb. It is never a resource and it never runs out — the whole
  // reason this game has no fail state is that its one consumable was deleted rather than tuned.
  lights() {
    const out = [];
    if (this.at) {
      const p = this.at.p;
      out.push({ x: p.x, y: p.y, z: p.z + 0.4, radius: this.lightR, gain: 1 });
    }
    for (const [, c] of this.world.cells) {
      if (c.glow) out.push({ x: c.x + 0.5, y: c.y + 0.5, z: c.z + 1.2, radius: 4.2, gain: 0.75 });
    }
    // a relit wisp keeps burning. He gave it light and did not lose any, which is the one thing
    // a fire can do that nothing else in this world can.
    if (this.wispLit && this.wispNode) {
      const p = this.wispNode.p;
      out.push({ x: p.x, y: p.y, z: p.z + 0.5, radius: 5.0, gain: 0.85 });
    }
    return out;
  }
  litAt(p) {
    for (const L of this.lights()) {
      const d = Math.hypot(L.x - p.x, L.y - p.y, L.z - p.z);
      if (d <= L.radius) return true;
    }
    return false;
  }

  // The nav context: everything that makes a surface conditionally walkable.
  ctx() {
    return {
      isLit: (n) => this.litAt(n.p),
      blocked: (n) => this.crows.some(c => !c.gone && c.x === n.x && c.y === n.y && c.z === n.z && c.up === n.up),
    };
  }

  // ---- plates -----------------------------------------------------------
  // A plate is pressed by anything standing on it: Ember, or the Wick. `hold` plates release when
  // you step off, which is the constraint that makes a second body worth having; the others latch.
  syncPlates() {
    const on = new Set();
    const mark = (x, y, z, up) => {
      const c = this.world.at(x, y, z);
      if (c && c.plate != null) on.add(c.plate);
    };
    if (this.at) mark(this.at.x, this.at.y, this.at.z, this.at.up);
    // THE WICK PRESSES THE PLATE IT IS STANDING ON, NOT THE ONE IT IS MADE OF.
    // `this.wick.{x,y,z}` is the cell the wick OCCUPIES — it sits on top of the plate, one cell
    // above it, exactly as Ember does. The first version looked up that cell and found the wick's
    // own cube, which has no plate on it, so the wick never pressed anything. Chapter VI's entire
    // mechanic has never fired: the only thing that could hold the plate down was Ember, and it is
    // a HOLD plate, so the span dropped the instant he left to use it. The chapter was unfinishable.
    if (this.wick && this.wick.placed) mark(this.wick.x, this.wick.y, this.wick.z - 1);
    let changed = false;
    for (const [, c] of this.world.cells) {
      if (c.plate == null) continue;
      const want = on.has(c.plate);
      const prev = this.plates.get(c.plate) || false;
      if (c.hold) {
        if (want !== prev) { this.plates.set(c.plate, want); changed = true; }
      } else if (want && !prev) { this.plates.set(c.plate, true); changed = true; }
    }
    if (changed) this.applyPlates();
    return changed;
  }

  // A plate drives a group: it swings a bridge into place, or slides one out of a wall. The effect
  // is expressed as a target state, never as a delta, so pressing a plate twice is idempotent and
  // a level can never be desynchronised by the order the player does things in.
  applyPlates() {
    for (const g of this.world.groups.values()) {
      if (g.plate == null) continue;
      const want = this.plates.get(g.plate) ? 1 : 0;
      const have = g.state || 0;
      if (want === have) continue;
      g.state = want;
      if (g.rotBy) this.world.rotateGroup(g.id, want ? g.rotBy : -g.rotBy);
      else if (g.moveBy) {
        const d = g.moveBy;
        this.world.translateGroup(g.id, want ? d : { x: -d.x, y: -d.y, z: -d.z });
      }
    }
    this.reseat();
  }

  // After geometry moves, Ember is re-seated onto whatever surface is now under him. ustwo and
  // every clone cancel the walk on any geometry change; doing anything cleverer means handling a
  // path that was valid when it was planned and is nonsense now, which is a whole bug class bought
  // for nothing.
  // RE-SEATING MUST BE TOTAL. Ember has to be standing somewhere after every geometry change, and
  // the first version of this could leave him standing nowhere at all: rotate a block over his
  // head, his face stops being exposed, the node vanishes and `at` was left pointing at a surface
  // that no longer existed. The proof reported it as three breakable chapters whose dead-end
  // sample was literally "none" — no position. There is no fail state in this game, and being
  // deleted by the scenery is a fail state.
  //
  // The ladder, in order: the exact same surface; any other exposed face of the same cube; the
  // nearest node in the world. The last rung cannot fail while any cube exists.
  reseat() {
    if (!this.at) { this.at = this.anyNode(); return; }
    const exact = this.world.node(this.at.x, this.at.y, this.at.z, this.at.up);
    if (exact) { this.at = exact; return; }
    const want = this.at.cell.id;
    if (want != null) {
      let best = null;
      for (const [, c] of this.world.cells) {
        if (c.id !== want) continue;
        for (const up of [this.at.up, 4, 0, 2, 1, 3, 5]) {
          const m = this.world.node(c.x, c.y, c.z, up);
          if (m && m.vis) { best = m; break; }
        }
        if (best) break;
      }
      if (best) { this.at = best; return; }
    }
    const near = this.nearestNode(this.at.x, this.at.y, this.at.z);
    if (near) this.at = near;
  }

  anyNode() {
    for (const n of this.world.nodes.values()) if (n.up === 4 && n.vis) return n;
    for (const n of this.world.nodes.values()) return n;
    return null;
  }
  nearestNode(x, y, z) {
    let best = null, bd = Infinity;
    for (const n of this.world.nodes.values()) {
      if (!n.vis) continue;
      const d = Math.abs(n.x - x) + Math.abs(n.y - y) + Math.abs(n.z - z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // ---- verbs ------------------------------------------------------------
  turn(handleId, steps = 1) {
    const h = this.handles.find(q => q.id === handleId);
    if (!h) return false;
    let ok = false;
    if (h.kind === 'crank') ok = this.world.rotateGroup(h.group, steps);
    else if (h.kind === 'slide') {
      const d = h.dir;
      const dir = steps > 0 ? d : { x: -d.x, y: -d.y, z: -d.z };
      const g = this.world.groups.get(h.group);
      if (!g) return false;                      // a handle naming a group no level defines
      const at = g.slid || 0;
      const next = at + (steps > 0 ? 1 : -1);
      if (next < 0 || next > (h.range ?? 1)) return false;
      ok = this.world.translateGroup(h.group, dir);
      if (ok) g.slid = next;
      // the handle rides along with the piece it moves, or it is a button, not a handle
      if (ok) { h.at.x += dir.x; h.at.y += dir.y; h.at.z += dir.z; }
    }
    if (ok) { this.reseat(); this.syncPlates(); this.updateCrows(); }
    return ok;
  }

  // Crows block a surface and can never hurt anybody. In Monument Valley they are guilt made
  // walkable — obstruction without punishment. Here they are afraid of the light, which turns the
  // one thing Ember cannot help being into the tool that moves them.
  updateCrows() {
    for (const c of this.crows) {
      if (c.gone) continue;
      const n = this.world.node(c.x, c.y, c.z, c.up);
      if (n && this.litAt(n.p)) c.gone = true;
    }
  }

  // ---- the wick ---------------------------------------------------------
  // A companion block: a second body, so a held plate can be held by something other than Ember.
  // Placed only at authored sockets, which keeps the state space small enough to prove exhaustively.
  canPlaceWick() {
    if (!this.wick || this.wick.placed || !this.at) return false;
    return this.wick.sockets.some(s => s.from === nk(this.at.x, this.at.y, this.at.z, this.at.up));
  }
  placeWick() {
    if (!this.canPlaceWick()) return false;
    const s = this.wick.sockets.find(q => q.from === nk(this.at.x, this.at.y, this.at.z, this.at.up));
    this.wick.placed = true; this.wick.x = s.x; this.wick.y = s.y; this.wick.z = s.z;
    this.world.add({ x: s.x, y: s.y, z: s.z, colour: 'beacon', glow: true, wick: true });
    this.world.rebuild();
    this.reseat(); this.syncPlates(); this.updateCrows();
    return true;
  }
  takeWick() {
    if (!this.wick || !this.wick.placed) return false;
    this.world.cells.delete(`${this.wick.x},${this.wick.y},${this.wick.z}`);
    this.wick.placed = false;
    this.world.rebuild();
    this.reseat(); this.syncPlates(); this.updateCrows();
    return true;
  }

  // ---- movement ---------------------------------------------------------
  pathTo(node) { return findPath(this.world, this.at, node, this.ctx()); }
  arrive(node) {
    this.at = node;
    // A DOOR folds screen space: step into one mouth, come out of the other. It is the only
    // movement in the game that is not a step, and it exists because some joins cannot be made to
    // line up on screen no matter how the mountain turns.
    const d = this.doors.find(q => q.a && nk(q.a.x, q.a.y, q.a.z, q.a.up) === nk(node.x, node.y, node.z, node.up));
    const e = this.doors.find(q => q.b && nk(q.b.x, q.b.y, q.b.z, q.b.up) === nk(node.x, node.y, node.z, node.up));
    if (d) { const m = this.world.node(d.b.x, d.b.y, d.b.z, d.b.up); if (m) this.at = m; }
    else if (e) { const m = this.world.node(e.a.x, e.a.y, e.a.z, e.a.up); if (m) this.at = m; }
    this.syncPlates(); this.updateCrows();
    const g = this.def.goal;
    if (this.at.x === g.x && this.at.y === g.y && this.at.z === g.z) this.won = true;
    return this.at;
  }

  reachableNow() { return reachable(this.world, this.at, this.ctx()); }
  goalNode() {
    const g = this.def.goal;
    return this.world.node(g.x, g.y, g.z, g.up ?? 4);
  }
  // The state key the solver searches over: geometry + every switchable thing + where he stands.
  stateKey() {
    return [
      this.world.signature(),
      [...this.world.groups.values()].map(g => `${g.id}:${g.angle || 0}:${g.slid || 0}:${g.state || 0}`).join(','),
      this.crows.map(c => c.gone ? 1 : 0).join(''),
      this.wick ? (this.wick.placed ? `${this.wick.x},${this.wick.y},${this.wick.z}` : '-') : '-',
      this.at ? nk(this.at.x, this.at.y, this.at.z, this.at.up) : 'none',
    ].join('#');
  }
  // Cheap clone: the constructor rebuilds the world from the definition, which is wasted work
  // when the caller is about to replace it. The solver clones tens of thousands of times.
  clone() {
    const L = Object.create(Level.prototype);
    L.def = this.def;
    L.doors = this.doors;
    L.lightR = this.lightR;
    L.world = this.world.clone();
    L.handles = this.handles.map(h => ({ ...h, at: { ...h.at } }));
    L.crows = this.crows.map(c => ({ ...c }));
    L.wick = this.wick ? { ...this.wick } : null;
    L.plates = new Map(this.plates);
    L.at = this.at ? (L.world.node(this.at.x, this.at.y, this.at.z, this.at.up) || L.nearestNode(this.at.x, this.at.y, this.at.z)) : L.anyNode();
    L.won = this.won;
    return L;
  }
}
