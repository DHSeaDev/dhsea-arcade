// Emberkeep — room data.
// Authored with a tiny op DSL rather than raw ASCII rows: hand-counted 40-char strings
// are an off-by-one factory, and a miscounted row silently changes level geometry.
//
// Legend
//   '~' crumbler   solid ledge that shakes and drops when stood on, then rebuilds. THE PROOF
//                  TREATS THESE AS ABSENT, so they can only ever ADD a route, never gate one
//   'v' downdraft  cold column: pushes down, drains fuel fast, squeezes the light. Non-lethal
//   '*' shard      collectable, in plain sight
//   '?' cache      HIDDEN — renders only when Ember is close
//   'x' old scorch someone else's burn, long cold. Decorative, never solid
//   'k' cold hearth a brazier that went out. The strongest thing in the room and it does nothing
//   'y' tally marks scratches on the wall. Somebody counted days in here
//   'r' rat        harmless. Scatters from the light, squeaks, and is entirely comic relief
//   'c' crow       outdoor only. Perches, watches, and dives once if you get too bright
//   'b' bat        patrols; drawn to bright light; startles Ember, never kills him
//   'p' spider     anchored; drops on a thread; leaves for good if its web catches
//   'w' web        SOLID like stone until it burns — so the solver treats it as permanent
//                  geometry and a proved room stays proved even if you never burn one
//   '#' stone      always solid, always visible
//   '=' phantom    ALWAYS SOLID, only VISIBLE inside Ember's light (the Candleman idea, no death)
//   'W' wood       solid until burned; burning spreads through the contiguous cluster
//   'o' emberdrop  guilt-free fuel
//   'E' spawn      'X' exit brazier
//
// Jump envelope (derived from physics.js): ~3.5 tiles up, ~4 tiles across.
// Nothing in here may require a burn — tools/solver.js proves that for every room.

import { T } from './physics.js';

// ---------------------------------------------------------------------------
// v2.2: rooms are no longer one screen. The viewport stays 40x20 tiles and the camera moves
// inside a larger room. Default is 64 wide; a room may override w/h through opts.
const W = 64, H = 20;

// DECOR — the scenery layer.
//
// Decor is deliberately NOT stored in the grid. It lives in its own list, so:
//   1. it can overlap geometry (an arch behind a floor, a chain through open air) without
//      fighting for a cell, and
//   2. it is STRUCTURALLY incapable of affecting the no-burn solvability proof or the physics.
//      The solver reads room.grid. Decor is not in room.grid. There is no code path by which a
//      decorative urn changes a jump envelope — which is a stronger guarantee than "I remembered
//      to leave it out of isSolidChar", and it is asserted by a test rather than trusted.
// Nothing here is flammable. FLAMMABLE stays exactly {'W','w'}; scenery is the part of the keep
// that the fire cannot take, which is also the point of it being here.
//
//   arch    a vaulted rib, background
//   pillar  a broken column, background
//   sconce  a LIT wall brazier — a real light source in the light field, and never burnable
//   bench   stone furniture
//   shelf   a stone ledge with pots
//   chain   hangs and sways
//   cobweb  a dusty corner strand. Named 'cobweb' and not 'web' deliberately: 'w' IS a
//           flammable tile char, and a decor kind whose name shadows a tile kind is how someone
//           eventually writes the wrong one into the wrong list.
//   drip    water, falls and lands
//   grate   a floor drain, light falls through it
//   bones   somebody's leavings, long picked clean
//   banner  cloth, sways slowly
//   root    a root through the ceiling (outdoor rooms)
export const DECOR_KINDS = ['arch','pillar','sconce','bench','shelf','chain','cobweb','drip','grate','bones','banner','root'];
const EXTRAS = {
  'The Doorway':   a => { a.p(11, 16, '*'); a.p(24, 15, '*'); a.p(33, 17, '*'); a.f(15, 14, 16, '~'); a.p(6, 17, 'x'); },
  'Trust':         a => { a.p(24, 6, 'b'); a.p(15, 14, '*'); a.p(23, 10, '*'); a.p(31, 14, '*'); a.p(6, 3, '?'); a.f(9, 20, 23, '~'); a.v(27, 5, 12, 'v'); a.p(12, 17, 'k'); a.p(13, 17, 'x'); a.p(11, 17, 'x'); },
  'What It Costs': a => { a.p(20, 8, 'b'); a.p(8, 17, '*'); a.p(19, 16, '*'); a.p(33, 17, '*'); a.p(24, 2, '?'); a.f(13, 21, 24, '~'); a.v(30, 4, 15, 'v'); a.p(5, 17, 'y'); a.p(29, 17, 'x'); },
  'Up':            a => { a.p(14, 11, 'b'); a.p(27, 11, 'b'); a.p(6, 15, '*'); a.p(12, 12, '*'); a.p(22, 6, '*'); a.p(2, 2, '?'); a.f(4, 19, 22, '~'); a.v(17, 8, 18, 'v'); a.p(29, 4, 'k'); a.p(28, 4, 'x'); },
  'The Long Way':  a => { a.p(17, 8, 'p'); a.v(17, 11, 12, 'w'); a.p(30, 6, 'b'); a.p(7, 15, '*'); a.p(16, 9, '*'); a.p(28, 15, '*'); a.p(37, 3, '?'); a.f(7, 22, 25, '~'); a.v(34, 4, 17, 'v'); a.p(35, 17, 'y'); a.p(21, 9, 'x'); },
  'Below':         a => { a.p(20, 5, 'b'); a.p(8, 14, 'p'); a.v(8, 17, 18, 'w'); a.p(24, 3, '*'); a.p(18, 11, '*'); a.p(12, 15, '*'); a.p(37, 11, '?'); a.f(10, 30, 34, '~'); a.v(2, 5, 15, 'v'); },
  'Still':         a => { a.p(9, 17, 'r'); a.p(22, 17, 'r'); a.p(31, 17, 'r'); a.p(17, 17, 'k'); a.p(16, 17, 'x'); a.p(18, 17, 'x'); a.p(4, 17, 'y'); a.p(14, 16, '*'); a.p(26, 16, '*'); a.p(34, 16, '*'); a.p(19, 3, '?'); },
  'The Rookery':   a => { a.p(8, 6, 'c'); a.p(21, 4, 'c'); a.p(33, 7, 'c'); a.p(15, 15, 'r'); a.p(4, 17, 'k'); a.p(5, 17, 'x'); a.p(6, 16, '*'); a.p(20, 11, '*'); a.p(31, 14, '*'); a.p(37, 2, '?'); },
  'The Door Out':  a => { a.p(12, 16, 'r'); a.p(20, 16, 'r'); a.p(28, 16, 'r'); a.p(19, 17, 'k'); a.p(6, 17, 'y'); },
  'It Spreads':    a => { a.p(12, 6, 'b'); a.p(30, 8, 'b'); a.p(24, 16, 'r'); a.p(7, 15, '*'); a.p(16, 13, '*'); a.p(31, 15, '*'); a.p(2, 9, '?'); a.f(6, 24, 27, '~'); a.v(36, 3, 16, 'v'); a.p(5, 17, 'x'); a.p(35, 17, 'x'); },
  'Thin':          a => { a.p(18, 8, 'p'); a.v(18, 16, 18, 'w'); a.p(8, 9, 'b'); a.p(5, 15, '*'); a.p(15, 11, '*'); a.p(25, 15, '*'); a.p(37, 17, '?'); a.f(9, 4, 7, '~'); a.v(22, 4, 16, 'v'); a.v(12, 4, 11, 'v'); },
  'Kindling':      a => { a.p(20, 5, 'b'); a.p(33, 10, 'b'); a.p(28, 13, 'p'); a.v(28, 17, 18, 'w'); a.p(8, 14, '*'); a.p(15, 11, '*'); a.p(22, 8, '*'); a.p(3, 3, '?'); a.f(6, 30, 34, '~'); a.v(19, 3, 8, 'v'); a.p(30, 17, 'y'); a.p(12, 17, 'x'); },
  'Emberkeep':     a => { a.p(18, 5, 'b'); a.p(34, 16, 'b'); a.p(21, 13, 'p'); a.v(21, 16, 18, 'w'); a.p(8, 15, '*'); a.p(19, 9, '*'); a.p(29, 9, '*'); a.p(2, 6, '?'); a.f(6, 22, 26, '~'); a.v(14, 3, 12, 'v'); a.v(30, 3, 9, 'v'); a.p(9, 17, 'k'); a.p(10, 17, 'x'); a.p(8, 17, 'x'); },
};

function build(name, hint, ops, opts = {}) {
  const w = opts.w ?? W, h = opts.h ?? H;
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const decor = [];
  const put = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; };
  const api = {
    f: (y, x0, x1, c = '#') => { for (let x = x0; x <= x1; x++) put(x, y, c); },
    v: (x, y0, y1, c = '#') => { for (let y = y0; y <= y1; y++) put(x, y, c); },
    b: (x0, y0, x1, y1, c = '#') => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); },
    p: put,
    // decor: kind, tile x, tile y, optional scale/phase seed. NEVER touches g.
    d: (kind, x, y, o = {}) => { decor.push({ k: kind, x, y, s: o.s ?? 1, r: o.r ?? 0 }); },
    // a run of one decor kind, because a colonnade is never one pillar
    dr: (kind, y, x0, x1, step = 1, o = {}) => {
      for (let x = x0; x <= x1; x += step) decor.push({ k: kind, x, y, s: o.s ?? 1, r: (x * 37) % 100 });
    },
  };
  ops(api);
  if (EXTRAS[name]) EXTRAS[name](api);
  const grid = g.map(r => r.join(''));
  let spawn = null, exit = null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // NB: this must use T. It was hardcoded to 20 and survived the 20->24 rescale silently,
    // spawning Ember most of a tile up and to the left of his marker in every room.
    if (grid[y][x] === 'E') spawn = { x: x * T + 4, y: y * T + 4 };
    if (grid[y][x] === 'X') exit = { x, y };
  }
  if (!spawn) throw new Error(`room ${name}: no spawn`);
  if (!exit) throw new Error(`room ${name}: no exit`);
  for (const d of decor) if (!DECOR_KINDS.includes(d.k)) throw new Error(`room ${name}: unknown decor "${d.k}"`);
  return { name, hint, w, h, grid, decor, spawn, exit, ...opts };
}

export const ROOMS = [

  build('The Doorway', 'Left and right move. Up jumps.', a => {
    a.f(18, 0, 63); a.f(19, 0, 63);
    a.p(2, 17, 'E');
    a.p(20, 17, 'o');
    a.b(28, 16, 29, 17, 'W');          // a crate. Burn it or step over it — both work.
    // second act: the corridor keeps going, and it is the first time it does
    a.f(15, 41, 46); a.f(15, 50, 55);
    a.p(44, 13, 'o'); a.p(52, 13, '*');
    a.f(17, 58, 63);
    a.p(61, 15, 'X');
    a.dr('arch', 4, 3, 63, 9);
    a.d('sconce', 8, 14); a.d('sconce', 34, 14); a.d('sconce', 56, 12);
    a.d('bench', 13, 17); a.d('shelf', 23, 16); a.d('bones', 45, 17);
    a.dr('chain', 5, 17, 53, 12); a.d('cobweb', 0, 15); a.d('cobweb', 63, 15);
    a.d('grate', 32, 19); a.d('drip', 19, 4); a.d('banner', 39, 6);
  }),

  build('Trust', 'Some floors are only there when you look at them.', a => {
    a.f(19, 0, 9); a.f(18, 0, 9);
    a.p(2, 17, 'E');
    a.f(15, 13, 17, '='); a.f(12, 21, 25, '='); a.f(15, 29, 33, '=');
    a.p(23, 11, 'o');
    a.f(18, 34, 40); a.f(19, 34, 40);
    a.b(19, 17, 20, 18, 'W');
    // second act: fewer certainties
    a.f(16, 44, 47, '='); a.f(13, 51, 54, '='); a.f(16, 58, 63);
    a.p(45, 14, 'o'); a.p(52, 11, '*');
    a.p(61, 15, 'X');
    a.dr('pillar', 17, 11, 59, 8);
    a.d('sconce', 6, 15); a.d('sconce', 41, 15); a.d('sconce', 60, 13);
    a.dr('arch', 3, 5, 61, 11);
    a.d('bones', 8, 17); a.d('cobweb', 43, 12); a.d('cobweb', 27, 8);
    a.d('drip', 30, 3); a.d('chain', 36, 4); a.d('chain', 49, 3);
  }),

  build('What It Costs', 'The bridge burns too.', a => {
    a.f(19, 0, 12); a.f(18, 0, 12);
    a.p(2, 17, 'E');
    a.f(17, 13, 26, 'W');              // the tempting wooden bridge
    a.f(19, 13, 26); a.f(18, 15, 16); a.f(18, 21, 22);   // the slower floor underneath
    a.p(16, 18, 'o');
    a.f(18, 27, 41); a.f(19, 27, 41);
    // second act: the same offer again, and this time the slow way is visible from the start
    a.f(16, 44, 56, 'W');
    a.f(19, 42, 63); a.f(18, 46, 47); a.f(18, 52, 53);
    a.p(50, 17, 'o'); a.p(45, 14, '*');
    a.p(61, 17, 'X');
    a.d('sconce', 10, 15); a.d('sconce', 30, 15); a.d('sconce', 58, 15);
    a.dr('arch', 5, 4, 62, 10); a.dr('pillar', 17, 29, 41, 6);
    a.d('grate', 20, 19); a.d('grate', 49, 19);
    a.d('drip', 24, 5); a.d('cobweb', 42, 14); a.d('bones', 33, 17); a.d('bench', 36, 17);
  }),

  // 4 — the vertical one. This room is TALLER than the viewport, not wider: the camera has to
  // climb with him, and the top of the shaft is not visible from the bottom of it.
  build('Up', 'Fuel is not a timer. It is how far you can see.', a => {
    a.f(29, 0, 39);
    a.p(2, 28, 'E');
    a.f(26, 4, 9); a.f(23, 11, 16); a.f(20, 5, 10); a.f(17, 12, 18);
    a.p(7, 25, 'o'); a.p(14, 22, 'o');
    a.f(14, 20, 25, '='); a.f(11, 27, 33);
    a.b(17, 27, 18, 28, 'W');
    a.f(8, 20, 26); a.f(5, 12, 18); a.f(2, 20, 27);
    a.p(23, 7, 'o'); a.p(15, 4, '*'); a.p(30, 10, '*');
    a.p(25, 1, 'X');
    a.dr('chain', 0, 6, 34, 5);
    a.d('sconce', 3, 26); a.d('sconce', 19, 19); a.d('sconce', 28, 10); a.d('sconce', 12, 4);
    a.dr('pillar', 27, 2, 38, 9);
    a.d('cobweb', 0, 24); a.d('cobweb', 39, 12); a.d('drip', 22, 3); a.d('bones', 9, 27);
    a.d('banner', 33, 6); a.d('grate', 17, 29);
  }, { w: 40, h: 30 }),

  build('The Long Way', 'There is always a long way.', a => {
    a.f(19, 0, 63); a.f(18, 0, 6);
    a.p(2, 17, 'E');
    a.b(12, 10, 13, 18, 'W');          // a wooden wall straight across the direct route
    a.f(16, 5, 9); a.f(13, 8, 12); a.f(10, 13, 20); a.f(13, 21, 26); a.f(16, 25, 30);
    a.p(16, 9, 'o');
    a.f(18, 31, 41);
    // second act: a genuine fork. The high road is shorter and has nothing on it.
    a.f(13, 44, 49); a.f(10, 51, 56); a.f(13, 57, 62);
    a.f(16, 45, 48); a.f(16, 54, 58);
    a.p(46, 14, 'o'); a.p(53, 8, '*'); a.p(56, 14, '*');
    a.f(17, 60, 63);
    a.p(61, 15, 'X');
    a.dr('arch', 4, 2, 62, 8); a.dr('pillar', 17, 33, 43, 5);
    a.d('sconce', 7, 15); a.d('sconce', 24, 9); a.d('sconce', 43, 15); a.d('sconce', 59, 12);
    a.d('bench', 34, 17); a.d('shelf', 38, 17); a.d('bones', 50, 17);
    a.d('chain', 29, 3); a.d('chain', 47, 2); a.d('cobweb', 11, 8); a.d('drip', 40, 5);
  }),

  // 6 — the breath. Nothing to burn, nothing that can hurt him, nowhere to fall. Every good
  // platformer has one of these and this game was relentless from room 2 onward without it.
  build('Still', 'Nothing in here wants anything from you.', a => {
    a.f(19, 0, 63); a.f(18, 0, 63);
    a.p(2, 17, 'E');
    a.f(15, 8, 12); a.f(13, 16, 22); a.f(15, 26, 30);
    a.p(19, 12, 'o');
    a.f(15, 40, 45); a.f(13, 49, 55); a.f(15, 58, 62);
    a.p(52, 12, 'o'); a.p(43, 14, '*');
    a.p(61, 17, 'X');
    a.dr('arch', 4, 3, 62, 7);
    a.dr('sconce', 15, 5, 61, 8);
    a.d('bench', 24, 17); a.d('bench', 36, 17); a.d('bench', 48, 17);
    a.d('shelf', 33, 17); a.d('shelf', 57, 17);
    a.dr('banner', 6, 12, 56, 11); a.d('drip', 44, 4); a.d('grate', 30, 19);
    a.d('bones', 8, 17); a.d('cobweb', 63, 14);
  }),

  build('It Spreads', 'One is never one.', a => {
    a.f(19, 0, 63); a.f(18, 0, 8);
    a.p(2, 17, 'E');
    a.f(16, 6, 8);                     // the step that makes the cluster climbable
    a.b(10, 14, 22, 18, 'W');          // one contiguous cluster — one touch takes all of it
    a.p(16, 12, 'o');
    a.f(15, 25, 28); a.f(16, 30, 33); a.f(18, 34, 41);
    a.p(31, 14, 'o');
    // second act: a bigger cluster, and a stone shelf over the top of it that never needed it
    a.f(15, 43, 46);
    a.b(48, 13, 58, 18, 'W');
    a.f(12, 47, 52); a.f(12, 56, 61); a.f(15, 60, 63);
    a.p(49, 11, 'o'); a.p(58, 11, '*');
    a.p(62, 14, 'X');
    a.dr('arch', 4, 4, 62, 9); a.dr('pillar', 17, 35, 42, 4);
    a.d('sconce', 5, 15); a.d('sconce', 28, 13); a.d('sconce', 45, 13); a.d('sconce', 62, 13);
    a.d('bones', 24, 17); a.d('grate', 38, 19); a.d('chain', 33, 3); a.d('chain', 54, 2);
    a.d('cobweb', 9, 10); a.d('cobweb', 47, 9); a.d('drip', 20, 4);
  }),

  // 8 — outside. Open sky, ambient light, and birds that have opinions about you.
  build('The Rookery', 'Out. Actually out, under the sky.', a => {
    a.f(19, 0, 63); a.f(18, 0, 7);
    a.p(2, 17, 'E');
    a.f(16, 9, 14); a.f(13, 17, 23); a.f(16, 26, 31); a.f(13, 33, 39);
    a.b(24, 17, 25, 18, 'W');
    a.p(11, 15, 'o'); a.p(28, 15, 'o');
    a.f(16, 42, 47); a.f(13, 50, 56); a.f(16, 58, 63);
    a.p(53, 11, 'o'); a.p(45, 14, '*'); a.p(60, 14, '*');
    a.p(61, 14, 'X');
    a.dr('root', 2, 4, 62, 7);
    a.d('pillar', 20, 17); a.d('pillar', 48, 17); a.d('pillar', 36, 17);
    a.d('bones', 15, 17); a.d('bench', 41, 17);
    a.dr('banner', 5, 9, 57, 16); a.d('cobweb', 30, 10); a.d('drip', 51, 3);
  }, { outdoor: true }),

  build('Kindling', 'Everything here would like to help.', a => {
    a.f(19, 0, 63); a.f(18, 0, 5);
    a.p(2, 17, 'E');
    a.b(7, 16, 9, 18, 'W'); a.b(14, 14, 16, 18, 'W'); a.b(22, 12, 24, 18, 'W');
    a.f(15, 6, 11); a.f(12, 12, 18); a.f(9, 19, 26); a.f(12, 27, 31);
    a.p(9, 14, 'o'); a.p(23, 8, 'o');
    a.f(15, 33, 39);
    // second act: it keeps offering
    a.b(42, 14, 44, 18, 'W'); a.b(50, 11, 52, 18, 'W');
    a.f(15, 41, 45); a.f(12, 46, 51); a.f(9, 53, 58); a.f(12, 59, 63);
    a.p(43, 13, 'o'); a.p(55, 8, '*');
    a.p(61, 11, 'X');
    a.dr('arch', 3, 3, 61, 8); a.dr('pillar', 17, 32, 40, 4);
    a.d('sconce', 4, 15); a.d('sconce', 30, 11); a.d('sconce', 47, 10); a.d('sconce', 62, 10);
    a.d('shelf', 35, 17); a.d('bones', 46, 17); a.d('grate', 20, 19);
    a.d('chain', 28, 2); a.d('chain', 57, 2); a.d('cobweb', 12, 11); a.d('drip', 39, 4);
  }),

  build('Emberkeep', 'You made it all this way without needing to.', a => {
    a.f(19, 0, 63); a.f(18, 0, 4);
    a.p(2, 17, 'E');
    a.f(16, 6, 10); a.b(12, 14, 13, 18, 'W');
    a.f(13, 11, 15); a.f(10, 16, 21, '='); a.f(13, 22, 26);
    a.b(24, 14, 25, 18, 'W');
    a.f(16, 27, 31); a.f(13, 32, 36); a.f(10, 27, 31); a.f(7, 32, 37);
    a.p(8, 15, 'o'); a.p(19, 9, 'o'); a.p(34, 12, 'o');
    // second act: the keep proper. Everything the game has taught, once more, in one span.
    a.f(7, 40, 45); a.f(10, 46, 50, '='); a.f(13, 51, 55);
    a.b(47, 14, 48, 18, 'W');
    a.f(16, 52, 57); a.f(13, 58, 63);
    a.p(42, 5, 'o'); a.p(53, 11, '*'); a.p(60, 11, '*');
    a.p(61, 11, 'X');
    a.dr('arch', 2, 4, 62, 6); a.dr('pillar', 17, 6, 62, 7);
    a.d('sconce', 5, 15); a.d('sconce', 23, 12); a.d('sconce', 39, 6); a.d('sconce', 56, 15);
    a.d('bench', 15, 17); a.d('shelf', 44, 17); a.d('bones', 30, 17); a.d('bones', 58, 17);
    a.dr('banner', 4, 10, 58, 13); a.d('grate', 36, 19); a.d('grate', 51, 19);
    a.d('chain', 21, 2); a.d('chain', 49, 2); a.d('cobweb', 3, 12); a.d('drip', 28, 3);
  }),

  // FINAL. There is nothing flammable in this room, no creature, no draft, no crumbler and no
  // puzzle. The whole game argues that not-burning is possible; this is where he gets to just
  // exist, and it is the only room whose point is that it has no point.
  build('The Door Out', 'You can put that down now.', a => {
    a.f(19, 0, 63); a.f(18, 0, 63);
    a.p(2, 17, 'E');
    a.f(15, 11, 15); a.f(15, 24, 28); a.f(15, 38, 42); a.f(15, 50, 54);
    // The room is 64 tiles now and had NOT ONE emberdrop in it. At 0.30 fuel/frame that is ~55s
    // of light for a walk that is 533 frames end to end, so a direct run was never in danger —
    // but this is the room whose entire point is that nothing is asked of you, and making the
    // player watch their own light gutter in it would be the opposite of that point.
    a.p(18, 13, 'o'); a.p(45, 13, 'o');
    a.p(61, 17, 'X');
    a.dr('arch', 4, 3, 62, 6);
    a.dr('sconce', 15, 4, 62, 6);
    a.dr('bench', 17, 8, 58, 10);
    a.dr('banner', 6, 6, 60, 9);
    a.d('grate', 32, 19); a.d('drip', 46, 4); a.d('bones', 20, 17);
  }, { final: true }),
];

export const ROOM_COUNT = ROOMS.length;
