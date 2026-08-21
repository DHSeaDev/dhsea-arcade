// Emberkeep - Mountain — the world, and the node graph the illusion lives in.
//
// EVERYTHING IS A UNIT CUBE ON AN INTEGER LATTICE. That single restriction buys three things that
// are otherwise expensive or impossible:
//   * painter's order is exactly x+y+z, with occlusion cycles ruled out rather than repaired
//   * screen coincidence is integer equality, so there is no epsilon anywhere in this file
//   * a rotation that lands on a quarter turn maps lattice cells to lattice cells exactly, so
//     nothing drifts and nothing needs re-snapping with a tolerance
//
// A NODE is a walkable surface: an exposed face of a solid cell. It is identified by the cell and
// which of the six directions is "up" for someone standing on it. Ember's up-vector therefore
// lives on the NODE and on HIM, never baked into the cell — which is what lets a tower rotate
// without invalidating any node data, and what makes walking around the outside of a block a
// transition rather than a special case.

import { DIRS, keyOf, depthOf, faceCentre, opposite } from './iso.js';

export const ck = (x, y, z) => `${x},${y},${z}`;
export const nk = (x, y, z, up) => `${x},${y},${z},${up}`;

// How far to march along the view ray when testing whether a face is hidden. The lattice is small
// and bounded; this is the diagonal of the largest level plus slack.
const RAY = 64;

export class World {
  constructor(spec = {}) {
    this._ids = 0;
    this.cells = new Map();          // ck -> cell
    this.groups = new Map();         // id -> {id, pivot:{x,y,z}, axis:'x'|'y'|'z', angle:0..3}
    this.index = new Map();          // screenKey|up -> [node] frontmost first
    this.nodes = new Map();          // nk -> node
    this.dirty = true;
    if (spec.cells) for (const c of spec.cells) this.add(c);
    if (spec.groups) for (const g of spec.groups) this.groups.set(g.id, { angle: 0, ...g });
  }

  // kind: 'stone' default. flags:
  //   wrap  — you may walk around this cube's convex edges onto its side faces (gravity relative)
  //   glow  — this cube is a light source
  //   lit   — this cube's surfaces only EXIST while Ember's light reaches them (our mechanic)
  //   goal  — the beacon
  //   group — id of a rotating group this cube belongs to
  add(c) {
    // Every cube gets a stable id. Without one there is no way to answer "the cube I was standing
    // on moved — where is it now", and Ember was silently stranded in mid-air by his own dragger.
    const cell = { kind: 'stone', ...c };
    if (cell.id == null) cell.id = ++this._ids;
    this.cells.set(ck(c.x, c.y, c.z), cell);
    this.dirty = true;
  }
  at(x, y, z) { return this.cells.get(ck(x, y, z)); }
  has(x, y, z) { return this.cells.has(ck(x, y, z)); }

  // ---- visibility -------------------------------------------------------
  // A face is hidden when any cube sits between it and the camera, i.e. anywhere along the view
  // ray (1,1,1) from the face centre. Because the centre is on a half-integer lattice and the ray
  // direction is (1,1,1), the cells it passes through are exactly (x+k, y+k, z+k).
  faceVisible(x, y, z, up) {
    for (let k = 1; k <= RAY; k++) {
      if (this.has(x + k, y + k, z + k)) return false;
      // the face of a cube also hides behind a cube one step along the ray from the NEIGHBOUR
      // cell it faces into, for the +x/+y/+z faces whose outward offset shifts the ray origin
      const d = DIRS[up];
      if (this.has(x + d.x + k, y + d.y + k, z + d.z + k)) return false;
    }
    return true;
  }

  isExposed(x, y, z, up) {
    const d = DIRS[up];
    return this.has(x, y, z) && !this.has(x + d.x, y + d.y, z + d.z);
  }

  // ---- the node index ---------------------------------------------------
  // Rebuilt only when the geometry settles, never per frame and never mid-rotation. ustwo do the
  // same, and it is why a half-rotated tower cannot produce a nonsense connection.
  rebuild() {
    this.index.clear();
    this.nodes.clear();
    for (const [, c] of this.cells) {
      if (c.kind === 'void') continue;
      for (let up = 0; up < 6; up++) {
        if (!this.isExposed(c.x, c.y, c.z, up)) continue;
        const p = faceCentre(c.x, c.y, c.z, up);
        const n = {
          x: c.x, y: c.y, z: c.z, up, cell: c,
          key: keyOf(p.x, p.y, p.z),
          u: Math.round(2 * (p.x - p.y)), v: Math.round(2 * (p.x + p.y - 2 * p.z)),
          depth: depthOf(c.x, c.y, c.z),
          vis: this.faceVisible(c.x, c.y, c.z, up),
          p,
        };
        this.nodes.set(nk(c.x, c.y, c.z, up), n);
        const ik = n.key + '|' + up;
        let list = this.index.get(ik);
        if (!list) this.index.set(ik, list = []);
        list.push(n);
      }
    }
    // frontmost first. THIS is the line that makes the illusion pick the right block: two faces
    // that coincide on screen are the same place as far as the player is concerned, and the one
    // they can see is the one nearest the camera.
    for (const list of this.index.values()) list.sort((a, b) => b.depth - a.depth);
    this.dirty = false;
    return this;
  }

  // The frontmost VISIBLE walkable face at a screen key with a given up-vector.
  // This one lookup is simultaneously ordinary adjacency and impossible adjacency: when the
  // neighbouring cube really is there it is the frontmost match, and when it is not, whatever
  // else happens to line up on screen is. There is no separate code path for the trick.
  frontAt(key, up) {
    const list = this.index.get(key + '|' + up);
    if (!list) return null;
    for (const n of list) if (n.vis) return n;
    return null;
  }

  node(x, y, z, up) { return this.nodes.get(nk(x, y, z, up)) || null; }

  // ---- rotation ---------------------------------------------------------
  // A quarter turn about a lattice axis maps integers to integers exactly. The cells are actually
  // MOVED, not transformed at draw time, so after a rotation the world is an ordinary lattice
  // again and every guarantee above still holds. The animation is purely cosmetic.
  rotateGroup(id, steps = 1) {
    const g = this.groups.get(id);
    if (!g) return false;
    // steps MOD 4, not min(4, |steps|).
    // The old clamp meant rotateGroup(g, 5) performed FOUR quarter turns — the identity — and
    // returned true. A caller asking for five got a silent no-op reported as a success, which is
    // indistinguishable from the refusal that rule 18 reserves for a blocked rotation. Latent in
    // the shipped game, which only ever asks for +-1, and wrong the moment anything else does.
    const sign = steps < 0 ? -1 : 1;
    const n = Math.abs(steps) % 4;
    if (n === 0) return true;
    let done = 0;
    for (let i = 0; i < n; i++) { if (!this._quarter(g, sign)) break; done++; }
    if (done !== n) {                        // roll back, so a refused turn changes nothing at all
      for (let i = 0; i < done; i++) this._quarter(g, -sign);
      return false;
    }
    g.angle = (((g.angle + sign * n) % 4) + 4) % 4;
    this.rebuild();
    return true;
  }

  // A rotation that would land a group cube on top of a cube that is not in the group is REFUSED.
  // Without this check the Map write silently overwrote the world cube and it was gone forever —
  // the level was then unwinnable and the player had no idea why, because the crank still turned.
  // The completability proof found exactly this in two chapters, which is what it is for.
  _quarter(g, sign = 1) {
    const moved = [];
    for (const [, c] of this.cells) if (c.group === g.id) moved.push(c);
    if (!moved.length) return false;
    const mine = new Set(moved.map(c => ck(c.x, c.y, c.z)));
    const dest = [];
    const taken = new Set();
    for (const c of moved) {
      const p = rot90(c.x - g.pivot.x, c.y - g.pivot.y, c.z - g.pivot.z, g.axis, sign);
      const q = { x: p.x + g.pivot.x, y: p.y + g.pivot.y, z: p.z + g.pivot.z };
      const k = ck(q.x, q.y, q.z);
      if (taken.has(k)) return false;                       // two of its own cubes into one cell
      if (this.cells.has(k) && !mine.has(k)) return false;  // into somebody else's cube
      taken.add(k);
      dest.push(q);
    }
    for (const c of moved) this.cells.delete(ck(c.x, c.y, c.z));
    for (let i = 0; i < moved.length; i++) {
      moved[i].x = dest[i].x; moved[i].y = dest[i].y; moved[i].z = dest[i].z;
      this.cells.set(ck(dest[i].x, dest[i].y, dest[i].z), moved[i]);
    }
    return true;
  }

  // ---- translation (draggers and drawers) -------------------------------
  translateGroup(id, d) {
    const g = this.groups.get(id);
    if (!g) return false;
    const moved = [];
    for (const [, c] of this.cells) if (c.group === id) moved.push(c);
    // refuse a move that would put two cubes in one cell — the lattice is the invariant
    const occupied = new Set(moved.map(c => ck(c.x, c.y, c.z)));
    for (const c of moved) {
      const k = ck(c.x + d.x, c.y + d.y, c.z + d.z);
      if (this.cells.has(k) && !occupied.has(k)) return false;
    }
    for (const c of moved) this.cells.delete(ck(c.x, c.y, c.z));
    for (const c of moved) { c.x += d.x; c.y += d.y; c.z += d.z; }
    for (const c of moved) this.cells.set(ck(c.x, c.y, c.z), c);
    g.offset = { x: (g.offset?.x || 0) + d.x, y: (g.offset?.y || 0) + d.y, z: (g.offset?.z || 0) + d.z };
    this.rebuild();
    return true;
  }

  // painter's order: ascending x+y+z. Correct, total, and cycle-free for unit cubes on a lattice
  // viewed down the main diagonal — which is the entire reason for the lattice rule.
  drawOrder() {
    const out = [...this.cells.values()];
    out.sort((a, b) => depthOf(a.x, a.y, a.z) - depthOf(b.x, b.y, b.z));
    return out;
  }

  // a compact, order-independent fingerprint of the geometry — the solver uses it as a state key
  signature() {
    const parts = [];
    for (const [, c] of this.cells) parts.push(`${c.x},${c.y},${c.z}`);
    parts.sort();
    return parts.join(';');
  }

  clone() {
    const w = new World();
    for (const [, c] of this.cells) w.add({ ...c });
    for (const [id, g] of this.groups) w.groups.set(id, { ...g, pivot: { ...g.pivot } });
    return w.rebuild();
  }
}

// A quarter turn, either way. THE SIGN MATTERS AND IT USED NOT TO EXIST.
// Turning a crank back was implemented as three forward quarters, on the theory that -90 and +270
// are the same rotation. They are the same END state and NOT the same journey: the two
// intermediate positions can collide with the level, the collision check refuses the move, and the
// crank becomes one-way. The completability proof caught it as three breakable chapters — a
// player could turn a handle one click too far and quietly lose the level with no way back.
// A real inverse is the fix; "same destination" is not the same as "same path".
export function rot90(x, y, z, axis, sign = 1) {
  if (axis === 'x') return sign > 0 ? { x, y: -z, z: y } : { x, y: z, z: -y };
  if (axis === 'y') return sign > 0 ? { x: z, y, z: -x } : { x: -z, y, z: x };
  return sign > 0 ? { x: -y, y: x, z } : { x: y, y: -x, z };            // 'z'
}
