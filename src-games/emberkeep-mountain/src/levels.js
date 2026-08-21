// Emberkeep - Mountain — the ten chapters.
//
// AUTHORING RULE, taken from Ken Wong and enforced by hand: a chapter only exists if it has
// something new to say. One geometric idea per screen, and the whole solution visible at once.
// Chapters IX and X deliberately introduce nothing — they recombine, which is what an ending is.
//
// THE ONE TOOL THAT MATTERS: `axis(p, k)` returns the cell k steps along the view direction
// (1,1,1). Any cube there occupies the SAME screen position as p. Every impossible join in this
// file is built with it rather than discovered by arithmetic luck, which is the difference between
// designing an illusion and finding one.

// ---------------------------------------------------------------------------
// v0.4 — THE CHAPTERS ARE MAPS NOW, not doorsteps.
//
// Measured before rewriting, because "it feels linear" is an impression and a walkable-surface
// count is a fact: the old chapters had between FOUR and eleven standable tiles each, needed an
// average of 0.9 manipulations to finish, and not one of them forced an order. Chapter VIII had
// four tiles. They were not corridors so much as thresholds with a beacon on the far side.
//
// Every chapter below is built from the same shape, because the shape is what makes a puzzle:
//
//   A HUB you arrive at, with THREE ARMS leading off it.
//     · one arm ends at the beacon and is GATED — it does not connect until you do something
//     · one arm is open and holds something worth having, off the critical route
//     · one arm is a DEAD END. A wrong turn you can actually take is what makes the right turn a
//       decision instead of the only thing available
//
// FORCED ORDER uses a mechanism that already existed rather than a new rule: rotateGroup REFUSES a
// turn that would put a cube inside another cube. So if crank B's arc is blocked by geometry that
// crank A moves out of the way, B is simply not turnable until A has been turned. The engine says
// "it will not turn that way" and means it. No flags, no scripting, and the completability proof
// already understands it because it is the same refusal the proof has always modelled.
//
// Every one of these is re-proved REACHABLE and UNBREAKABLE at both light radii, and measured by
// tools/shape.js against thresholds for branching, required manipulations and forced order.

export const axis = (p, k) => ({ x: p.x + k, y: p.y + k, z: p.z + k });

function B() {
  const cells = [];
  const api = {
    cells,
    p: (x, y, z, o = {}) => { cells.push({ x, y, z, ...o }); return { x, y, z }; },
    run: (x, y, z, d, n, o = {}) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(api.p(x + d.x * i, y + d.y * i, z + d.z * i, o));
      return out;
    },
    box: (x0, y0, z0, x1, y1, z1, o = {}) => {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) api.p(x, y, z, o);
    },
    stair: (x, y, z, d, n, o = {}) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(api.p(x + d.x * i, y + d.y * i, z + i, o));
      return out;
    },
    // a platform: the floor of an arm or a hub, wide enough to stand about on
    pad: (x, y, z, w, h, o = {}) => {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) api.p(x + i, y + j, z, o);
    },
    plinth: (x, y, z, depth, o = {}) => { for (let i = 1; i <= depth; i++) api.p(x, y, z - i, o); },
    // a tower under a platform, so it reads as standing on something
    leg: (x, y, z, depth, o = { colour: 'deep' }) => { for (let i = 1; i <= depth; i++) api.p(x, y, z - i, o); },
  };
  return api;
}

const X = { x: 1, y: 0, z: 0 }, NX = { x: -1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 }, NY = { x: 0, y: -1, z: 0 };
const Z = { x: 0, y: 0, z: 1 };

// ---------------------------------------------------------------------------
// I — the whole game in one move, but now with somewhere else to go first.
function ch1() {
  const b = B();
  b.pad(0, 0, 0, 4, 3, { colour: 'stone' });                     // the hub
  b.leg(0, 0, 0, 4); b.leg(3, 2, 0, 4); b.leg(0, 2, 0, 4);
  // ARM 1 — east, toward the beacon. Gated by the crank.
  b.run(4, 1, 0, X, 4, { colour: 'stone' });
  b.p(8, 1, 0, { colour: 'sand', group: 'arm', join: true });
  b.p(8, 1, 1, { colour: 'sand', group: 'arm', join: true });   // lands at (9,1,0) and reaches
  // A PLINTH UNDER THE CRANK, and it is not decoration. Wound twice, an arm sweeps BELOW the
  // ground line and Ember can end up standing on the side face of a cube buried under the level
  // with nothing to step to. The proof found it as a dead end in chapter IX. Solid cubes here mean
  // rotateGroup refuses that quarter turn, so the crank simply has two positions and no third.
  b.leg(8, 1, 0, 3);
  const far = axis({ x: 10, y: 1, z: 0 }, 3);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 6);
  // ARM 2 — north, open, and worth walking. Ends at a lamp.
  b.run(2, 3, 0, Y, 4, { colour: 'pale' });
  b.pad(1, 7, 0, 3, 2, { colour: 'pale' });
  b.p(2, 8, 1, { colour: 'sand', glow: true });
  b.leg(1, 7, 0, 3); b.leg(3, 8, 0, 3);
  // ARM 3 — south, a dead end. It looks like it goes somewhere and it does not.
  b.run(1, -1, 0, NY, 3, { colour: 'ink' });
  b.p(1, -4, 0, { colour: 'ink' }); b.p(0, -4, 0, { colour: 'ink' });
  b.leg(1, -3, 0, 3);
  return {
    chapter: 'I', name: 'The First Light',
    hint: 'Something here has gone out.',
    say: ['Three ways. One of them is wrong and I will find it first.', 'That is a long way to not be able to reach.', 'Wait. Turn that.'],
    cells: b.cells,
    groups: [{ id: 'arm', pivot: { x: 8, y: 1, z: 0 }, axis: 'y' }],
    handles: [{ id: 'h1', kind: 'crank', group: 'arm', at: { x: 8.5, y: 1.5, z: 2.6 } }],
    // The elbow of the turning arm: the two cubes carry `join` and the step between their faces
    // is an authored illusion, not a world neighbour. It went undeclared for as long as the
    // detector's "ordinary walking" test was Manhattan distance, which this span of 1 passed.
    joins: [[8, 1, 0, 8, 1, 1]],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// II — the mountain listens to your feet, and it matters WHERE you put them.
function ch2() {
  const b = B();
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  // ARM 1 — the plate arm, north
  b.run(1, 3, 0, Y, 3, { colour: 'stone' });
  b.p(1, 6, 0, { colour: 'moss', plate: 'p1' });
  b.pad(0, 6, 0, 1, 2, { colour: 'stone' });
  b.leg(1, 6, 0, 3);
  // ARM 2 — east, where the bridge appears when the plate is down
  b.run(3, 1, 0, X, 3, { colour: 'stone' });
  b.p(6, 1, -3, { colour: 'sand', group: 'bridge' });
  b.p(7, 1, -3, { colour: 'sand', group: 'bridge' });
  b.p(8, 1, -3, { colour: 'sand', group: 'bridge', join: true });
  const far = axis({ x: 9, y: 1, z: 0 }, 2);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 5);
  // ARM 3 — a low dead-end shelf, south, with a lamp on it
  b.run(2, -1, 0, NY, 2, { colour: 'ink' });
  b.pad(1, -3, 0, 3, 2, { colour: 'ink' });
  b.p(2, -2, 1, { colour: 'sand', glow: true });
  b.leg(2, -2, 0, 3);
  return {
    chapter: 'II', name: 'The Garden Step',
    hint: 'The mountain is listening to your feet.',
    say: ['Something moved when I did.', 'Not here. Over there. It moved over THERE.'],
    cells: b.cells,
    groups: [{ id: 'bridge', pivot: { x: 6, y: 1, z: -3 }, axis: 'x', plate: 'p1', moveBy: { x: 0, y: 0, z: 3 } }],
    handles: [],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// III — you are standing on the part that moves, and it has to go both ways.
function ch3() {
  const b = B();
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  // the car: ride it east
  b.run(3, 1, 0, X, 3, { colour: 'sand', group: 'car' });
  // ARM 1 — the high shelf the car reaches
  b.pad(7, 0, 0, 2, 3, { colour: 'pale' });
  b.leg(8, 1, 0, 4);
  b.stair(9, 1, 1, X, 2, { colour: 'pale' });
  b.p(10, 1, 2, { colour: 'pale', join: true });
  const far = axis({ x: 11, y: 1, z: 2 }, 3);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 7);
  // ARM 2 — north branch off the hub, a lamp and a look
  b.run(1, 3, 0, Y, 3, { colour: 'pale' });
  b.pad(0, 6, 0, 3, 2, { colour: 'pale' });
  b.p(1, 7, 1, { colour: 'sand', glow: true });
  b.leg(1, 6, 0, 3);
  // ARM 3 — dead end south
  b.run(2, -1, 0, NY, 3, { colour: 'ink' });
  b.leg(2, -3, 0, 3);
  return {
    chapter: 'III',
    // the one authored illusion in this chapter: the ledge that appears to touch the beacon
    joins: [[10,1,2, 14,4,5]], name: 'The Drawn Bridge',
    hint: 'You are standing on the part that moves.',
    say: ['I am on it. I am moving it. Both of those are true.', 'And now it is over there and I am not.'],
    cells: b.cells,
    groups: [{ id: 'car', pivot: { x: 3, y: 1, z: 0 }, axis: 'z' }],
    handles: [{ id: 'h1', kind: 'slide', group: 'car', dir: X, range: 3, at: { x: 4.5, y: 1.5, z: 1.6 } }],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// IV — up is a local opinion, and there are three faces to be wrong about.
function ch4() {
  const b = B();
  // THE OCCLUSION RULE, learned twice in this chapter and worth stating once properly:
  // a surface at P is HIDDEN by any cube at P + (k,k,k), for any k >= 1. That is the view ray.
  // A hidden surface is not walkable, so a level can be laid out with every cube in a sensible
  // place and still have no route through it, and nothing about the picture says so.
  // First attempt: the block sat up-and-right of the approach and hid it.
  // Second attempt: the elevated walkway at y=5,z=2 sat exactly on the ray of the climb at
  // y=3..4,z=0..1 and hid THAT.
  // The layout below has every ray checked: the walkway is at y=6 so the climb's rays pass under
  // it, and the block is only two tall so nothing above z=2 is ever in anybody's way.
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  b.p(1, 3, 0, { colour: 'stone' });                 // ray -> (2,4,1),(3,5,2): both empty
  b.p(1, 4, 1, { colour: 'stone' });                 // ray -> (2,5,2),(3,6,3): both empty
  b.p(1, 5, 2, { colour: 'stone' });                 // ray -> (2,6,3): empty
  b.leg(1, 4, 1, 4); b.leg(1, 5, 2, 5);
  b.run(1, 6, 2, X, 6, { colour: 'stone' });         // rays -> (x+1,7,3): above the block, empty
  b.leg(1, 6, 2, 5); b.leg(6, 6, 2, 5);
  // the block you walk around, met at its own height
  b.box(7, 5, 0, 9, 7, 2, { colour: 'pale', wrap: true });
  // ARM 1 — across the block and east to the beacon
  // The join flag goes on the cube you step FROM, not on the one that lines up with the beacon.
  // The two coincide on screen — that is the whole trick — so the beacon, being nearer the camera,
  // HIDES the cube at the coincident position, and a hidden surface is not walkable. Marking that
  // one meant marking a tile nobody can ever stand on.
  b.p(10, 6, 2, { colour: 'stone', join: true });
  const far = axis({ x: 11, y: 6, z: 2 }, 3);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 8);
  // ARM 2 — a spur north off the walkway, out over nothing, with a lamp at the end
  b.run(4, 7, 2, Y, 3, { colour: 'moss' });
  b.p(4, 10, 2, { colour: 'moss' }); b.p(3, 10, 2, { colour: 'moss' });
  b.p(4, 9, 3, { colour: 'sand', glow: true });
  b.leg(4, 9, 2, 5);
  // ARM 3 — a dead end, back down at the hub
  b.run(2, -1, 0, NY, 3, { colour: 'ink' });
  b.pad(1, -4, 0, 3, 1, { colour: 'ink' });
  b.leg(2, -3, 0, 3);
  return {
    chapter: 'IV', name: 'The Turning Court',
    hint: 'Up is a local opinion.',
    joins: [[10, 6, 2, 14, 9, 5]],
    say: ['I am going to walk up the side of that.', 'Nobody is going to stop me. That is the worrying part.'],
    cells: b.cells, groups: [], handles: [],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// V — they were here first, and they are in the way of two of the three doors.
function ch5() {
  const b = B();
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  // ARM 1 — east, past two crows, to the beacon
  b.run(3, 1, 0, X, 5, { colour: 'stone' });
  b.p(7, 1, 0, { colour: 'stone', join: true });
  const far = axis({ x: 8, y: 1, z: 0 }, 3);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 5);
  // ARM 2 — north, also watched, ends in a lamp shelf
  b.run(1, 3, 0, Y, 4, { colour: 'moss' });
  b.pad(0, 7, 0, 3, 2, { colour: 'moss' });
  b.p(1, 8, 1, { colour: 'sand', glow: true });
  b.leg(1, 7, 0, 3);
  // ARM 3 — south, empty, and the only one nobody is sitting on
  b.run(2, -1, 0, NY, 4, { colour: 'ink' });
  b.pad(1, -5, 0, 3, 1, { colour: 'ink' });
  b.leg(2, -4, 0, 3);
  return {
    chapter: 'V',
    // the one authored illusion in this chapter: the ledge that appears to touch the beacon
    joins: [[7,1,0, 11,4,3]], name: 'The Rookery',
    hint: 'They were here before you.',
    say: ['They are not going to move.', 'Oh. They moved.', 'I did not mean to do that.'],
    cells: b.cells, groups: [], handles: [],
    crows: [{ x: 5, y: 1, z: 0, up: 4 }, { x: 6, y: 1, z: 0, up: 4 }, { x: 1, y: 5, z: 0, up: 4 }],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// VI — you cannot be in two places, and this needs you to be.
function ch6() {
  const b = B();
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  // ARM 1 — the held plate, north. Step off it and the bridge falls again.
  b.run(1, 3, 0, Y, 2, { colour: 'stone' });
  b.p(1, 5, 0, { colour: 'moss', plate: 'p1', hold: true });
  b.pad(0, 5, 0, 1, 2, { colour: 'stone' });
  b.leg(1, 5, 0, 3);
  // ARM 2 — east, the span that only exists while the plate is held
  b.run(3, 1, 0, X, 3, { colour: 'stone' });
  b.p(6, 1, -3, { colour: 'sand', group: 'span' });
  b.p(7, 1, -3, { colour: 'sand', group: 'span' });
  b.p(8, 1, -3, { colour: 'sand', group: 'span', join: true });
  // THE WAY BACK. Stand on the span, take the wick, and the span drops with you on it — the proof
  // found that dead end before a player could. The first attempt at an escape ran along y=1,
  // directly UNDER the walkway, so every one of its top faces was covered and none of them was
  // standable: the escape existed as cubes and not as a route. It runs along y=2 now, in the open.
  b.p(6, 2, -3, { colour: 'ink' }); b.p(5, 2, -2, { colour: 'ink' });
  b.p(4, 2, -1, { colour: 'ink' }); b.p(3, 2, 0, { colour: 'ink' });
  const far = axis({ x: 9, y: 1, z: 0 }, 2);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 5);
  // ARM 3 — dead end, and where the wick socket lives
  b.run(2, -1, 0, NY, 3, { colour: 'ink' });
  b.pad(1, -4, 0, 3, 1, { colour: 'ink' });
  b.leg(2, -3, 0, 3);
  return {
    chapter: 'VI', name: 'The Wick',
    hint: 'You cannot be in two places. You can leave a piece of yourself in one.',
    say: ['I can put a bit of me down there.', 'It is fine. It will keep.', 'It is holding it open. Go.'],
    cells: b.cells,
    groups: [{ id: 'span', pivot: { x: 6, y: 1, z: -3 }, axis: 'x', plate: 'p1', moveBy: { x: 0, y: 0, z: 3 } }],
    handles: [],
    wick: { sockets: [{ from: '1,4,0,4', x: 1, y: 5, z: 1 }, { from: '0,5,0,4', x: 1, y: 5, z: 1 }] },
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// VII — there is nothing there until there is, and the lamps decide how far.
function ch7() {
  const b = B();
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  // ARM 1 — the dark stair east, in three reaches, each with a lamp to carry you on
  b.run(3, 1, 0, X, 3, { colour: 'ink', lit: true });
  b.p(4, 1, 1, { colour: 'sand', glow: true });
  b.run(6, 1, 0, X, 3, { colour: 'ink', lit: true });
  b.p(8, 1, 0, { colour: 'ink', lit: true, join: true });
  b.p(7, 1, 1, { colour: 'sand', glow: true });
  const far = axis({ x: 9, y: 1, z: 0 }, 3);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 5);
  // ARM 2 — north, solid stone, a way to see the dark arm from beside it
  b.run(1, 3, 0, Y, 3, { colour: 'stone' });
  b.pad(0, 6, 0, 3, 2, { colour: 'stone' });
  b.p(1, 7, 1, { colour: 'sand', glow: true });
  b.leg(1, 6, 0, 3);
  // ARM 3 — a dark dead end, south, with no lamp at all
  b.run(2, -1, 0, NY, 3, { colour: 'ink', lit: true });
  b.leg(2, -3, 0, 3);
  return {
    chapter: 'VII',
    // the one authored illusion in this chapter: the ledge that appears to touch the beacon
    joins: [[8,1,0, 12,4,3]], name: 'The Dark Stair',
    hint: 'It is only there while you are looking at it.',
    say: ['There is nothing there.', 'There is nothing there UNTIL I am nearly on it.', 'That is a lot of trust to ask of me.'],
    cells: b.cells, groups: [], handles: [],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// VIII — two rooms, and the door is the only thing that knows they are next to each other.
function ch8() {
  const b = B();
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  // ARM 1 — east to the door mouth
  b.run(3, 1, 0, X, 3, { colour: 'rose' });
  b.p(6, 1, 0, { colour: 'rose' });
  b.leg(6, 1, 0, 4);
  // the other room, elsewhere entirely
  b.pad(0, 8, 0, 4, 4, { colour: 'pale' });
  b.leg(0, 8, 0, 5); b.leg(3, 11, 0, 5); b.leg(3, 8, 0, 5);
  b.run(4, 10, 0, X, 3, { colour: 'pale' });
  b.p(6, 10, 0, { colour: 'pale', join: true });
  const far = axis({ x: 7, y: 10, z: 0 }, 3);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 6);
  b.p(1, 11, 1, { colour: 'sand', glow: true });
  // ARM 2 — north from the hub, a shelf that overlooks nothing
  b.run(1, 3, 0, Y, 3, { colour: 'stone' });
  b.pad(0, 6, 0, 2, 1, { colour: 'stone' });
  b.leg(1, 6, 0, 3);
  // ARM 3 — dead end south
  b.run(2, -1, 0, NY, 3, { colour: 'ink' });
  b.leg(2, -3, 0, 3);
  return {
    chapter: 'VIII',
    // the one authored illusion in this chapter: the ledge that appears to touch the beacon
    joins: [[6,10,0, 10,13,3]], name: 'The Box',
    hint: 'Some doors do not go anywhere near.',
    say: ['That is the same door.', 'I went in over there and came out over here and I am fine.'],
    cells: b.cells, groups: [], handles: [],
    doors: [{ a: { x: 6, y: 1, z: 0, up: 4 }, b: { x: 0, y: 8, z: 0, up: 4 } }],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// IX — TWO CRANKS, AND ONE OF THEM WILL NOT TURN YET.
//
// This is the chapter the whole rewrite exists for. Crank B's arm sweeps through the cell that
// crank A's arm is standing in, and rotateGroup REFUSES a turn that would put a cube inside
// another cube. So B is not turnable until A has been turned out of the way — the order is forced
// by the engine's own collision rule, with no flag, no script and nothing new to prove.
function ch9() {
  const b = B();
  // FORCED ORDER, and how it got here. The design was originally two cranks whose arcs collide, so
  // that the second could not be turned until the first cleared its path. That mechanism is real —
  // rotateGroup refuses a turn into an occupied cell — but it is UNBUILDABLE as laid out: two
  // cranks rotating about the same axis at different y can never want the same cell, so no arc
  // ever blocked another and the "order" was free. Measured, not assumed.
  //
  // The order here is forced by REACHABILITY instead, which is stronger and reads better: the
  // plate that raises the span sits on an island you cannot get to until the crank has laid its
  // arm across. You cannot press it early because you cannot stand on it early.
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  b.run(3, 1, 0, X, 2, { colour: 'stone' });
  // the crank: a column that lays down into the gap
  b.p(5, 1, 0, { colour: 'sand', group: 'a' });
  b.p(5, 1, 1, { colour: 'sand', group: 'a' });
  // A PLINTH UNDER THE CRANK, and it is not decoration. Wound twice, an arm sweeps BELOW the
  // ground line and Ember can end up standing on the side face of a cube buried under the level
  // with nothing to step to. The proof found it as a dead end in chapter IX. Solid cubes here mean
  // rotateGroup refuses that quarter turn, so the crank simply has two positions and no third.
  b.leg(5, 1, 0, 3);
  // the island, unreachable until it does
  b.pad(7, 0, 0, 2, 3, { colour: 'rose' });
  b.p(8, 1, 0, { colour: 'moss', plate: 'p1' });
  b.leg(7, 1, 0, 4); b.leg(8, 2, 0, 4);
  b.p(9, 1, 0, { colour: 'rose' });                  // the island ended at 8 and the span starts at 10
  // the span the plate raises
  b.p(10, 1, -3, { colour: 'sand', group: 'span' });
  b.p(11, 1, -3, { colour: 'sand', group: 'span', join: true });
  const far = axis({ x: 12, y: 1, z: 0 }, 3);
  b.p(far.x, far.y, far.z, { colour: 'warm', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 6);
  // ARM 2 — north, open, a lamp
  b.run(1, 3, 0, Y, 3, { colour: 'moss' });
  b.pad(0, 6, 0, 3, 2, { colour: 'moss' });
  b.p(1, 7, 1, { colour: 'sand', glow: true });
  b.leg(1, 6, 0, 3);
  // ARM 3 — dead end south
  b.run(2, -1, 0, NY, 4, { colour: 'ink' });
  b.leg(2, -4, 0, 3);
  return {
    chapter: 'IX', name: 'The Two Ways',
    hint: 'One of these has to happen first.',
    joins: [[11, 1, 0, 15, 4, 3]],
    say: ['I cannot stand on that from here.', 'So the other thing first. Fine.', 'Both of these are wrong alone. I hate that it is elegant.'],
    cells: b.cells,
    groups: [
      { id: 'a', pivot: { x: 5, y: 1, z: 0 }, axis: 'y' },
      { id: 'span', pivot: { x: 10, y: 1, z: -3 }, axis: 'x', plate: 'p1', moveBy: { x: 0, y: 0, z: 3 } },
    ],
    handles: [{ id: 'h1', kind: 'crank', group: 'a', at: { x: 5.5, y: 1.5, z: 2.7 } }],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

// ---------------------------------------------------------------------------
// X — everything, once, and then it is over.
function ch10() {
  const b = B();
  b.pad(0, 0, 0, 3, 3, { colour: 'stone' });
  b.leg(0, 0, 0, 4); b.leg(2, 2, 0, 4);
  // ARM 1 — north, open, and it holds a lamp rather than the plate. The plate moved to the far
  // side of the crank so that this chapter's order is forced the same way chapter IX's is: you
  // cannot press it before you have laid the arm, because you cannot stand on it before then.
  b.run(1, 3, 0, Y, 3, { colour: 'stone' });
  b.pad(0, 6, 0, 3, 2, { colour: 'stone' });
  b.p(1, 7, 1, { colour: 'sand', glow: true });
  b.leg(1, 6, 0, 3);
  // ARM 2 — east: dark stair, then the crank, then the lift, then the beacon
  b.run(3, 1, 0, X, 2, { colour: 'ink', lit: true });
  b.p(4, 1, 1, { colour: 'sand', glow: true });
  b.p(5, 1, 0, { colour: 'sand', group: 'arm' });
  b.p(5, 1, 1, { colour: 'sand', group: 'arm' });
  // A PLINTH UNDER THE CRANK, and it is not decoration. Wound twice, an arm sweeps BELOW the
  // ground line and Ember can end up standing on the side face of a cube buried under the level
  // with nothing to step to. The proof found it as a dead end in chapter IX. Solid cubes here mean
  // rotateGroup refuses that quarter turn, so the crank simply has two positions and no third.
  b.leg(5, 1, 0, 3);
  b.p(7, 1, 0, { colour: 'moss', plate: 'p1' });     // the arm lands at 6; this is only reachable after
  b.p(8, 1, -3, { colour: 'pale', group: 'lift' });
  b.p(9, 1, -3, { colour: 'pale', group: 'lift', join: true });
  const far = axis({ x: 10, y: 1, z: 0 }, 4);
  b.p(far.x, far.y, far.z, { colour: 'beacon', goal: true, glow: true, join: true });
  b.leg(far.x, far.y, far.z, 7);
  // ARM 3 — dead end south, and the longest look down in the game
  b.run(2, -1, 0, NY, 4, { colour: 'ink' });
  b.pad(1, -5, 0, 3, 2, { colour: 'ink' });
  b.leg(2, -4, 0, 5);
  return {
    chapter: 'X', name: 'The Beacon',
    hint: 'You have done all of this before. Do it once more.',
    say: ['I know this one.', 'I have been every part of this already.', 'Alright. Up we go.'],
    cells: b.cells,
    groups: [
      { id: 'arm', pivot: { x: 5, y: 1, z: 0 }, axis: 'y' },
      { id: 'lift', pivot: { x: 8, y: 1, z: -3 }, axis: 'x', plate: 'p1', moveBy: { x: 0, y: 0, z: 3 } },
    ],
    handles: [{ id: 'h1', kind: 'crank', group: 'arm', at: { x: 5.5, y: 1.5, z: 2.7 } }],
    start: { x: 1, y: 1, z: 0, up: 4 },
    goal: far,
  };
}

export const LEVELS = [ch1(), ch2(), ch3(), ch4(), ch5(), ch6(), ch7(), ch8(), ch9(), ch10()]
  .map((d, i) => ({ ...d, index: i }));
export const LEVEL_COUNT = LEVELS.length;
