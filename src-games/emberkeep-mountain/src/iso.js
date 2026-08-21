// Emberkeep - Mountain — the projection, and the lie it makes possible.
//
// TRUE ISOMETRIC, ORTHOGRAPHIC. Camera yaw -45deg, pitch atan(1/sqrt2) = 35.264deg, view direction
// (1,1,1)/sqrt3. Perspective is FORBIDDEN here and that is not a style preference: under a
// perspective camera, translating an object along the view ray changes both its screen position
// and its size, so two bars at different depths can never be made to meet on screen. Every
// impossible join in this game is a pair of things at different depths that touch in screen space.
// Orthographic, or the game does not exist.
//
// The screen basis, derived rather than guessed:
//   right = (1,-1,0)/sqrt2        up = (-1,-1,2)/sqrt6
//   sx =  (x - y)      / sqrt2 * S
//   sy =  (x + y - 2z) / sqrt6 * S       (screen y grows downward)
//
// Two consequences, and both are load-bearing:
//
// 1. THE SCREEN KEY is (x - y, x + y - 2z). Two world points coincide on screen exactly when
//    those two integers match — no distance test, no epsilon, no tolerance to tune. Everything in
//    this game sits on a half-integer lattice, so doubling makes the key a pair of exact integers
//    and adjacency becomes ===. Every account of this technique that uses a float epsilon is
//    working around a lattice it did not commit to.
//
// 2. DEPTH is x + y + z, the distance along the view axis (1,1,1). For UNIT CUBES ON AN INTEGER
//    LATTICE viewed down the main diagonal, sorting by x+y+z is a correct painter's order and
//    occlusion CYCLES CANNOT OCCUR. That is the whole reason the lattice rule exists. Impossible
//    geometry famously breaks painter's algorithm — A over B over C over A — and the standard
//    fixes (Newell splitting, SCC decomposition) are miserable. Restricting the world to unit
//    cubes on a lattice buys correctness outright instead of repairing it afterwards.

export const B = 15;                     // half-height of a cube's top diamond, in px
export const A = B * Math.sqrt(3);       // half-width. The 1.732:1 true-isometric ratio.

// world (x,y,z) -> screen (px). z is up.
export function project(x, y, z) {
  return { x: (x - y) * A, y: (x + y - 2 * z) * B };
}

// The screen key, doubled so half-integer surface centres stay exact integers.
// `${u}|${v}` because a string key in a Map is exact and a float pair is not.
export function keyOf(x, y, z) {
  return `${Math.round(2 * (x - y))}|${Math.round(2 * (x + y - 2 * z))}`;
}

// Distance along the view axis. Bigger = nearer the camera = drawn later.
export function depthOf(x, y, z) { return x + y + z; }

// The six lattice directions, in the order used everywhere: +x -x +y -y +z -z
export const DIRS = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
];
export const DIR_NAMES = ['+x', '-x', '+y', '-y', '+z', '-z'];
export const dirIndex = (d) => DIRS.findIndex(q => q.x === d.x && q.y === d.y && q.z === d.z);
export const opposite = (i) => i ^ 1;                 // the pairing above makes this exact

// The four tangent directions of a face, i.e. the ways you can walk while standing on it.
export function tangents(upIdx) {
  const axis = upIdx >> 1;                            // 0=x 1=y 2=z
  const out = [];
  for (let i = 0; i < 6; i++) if ((i >> 1) !== axis) out.push(i);
  return out;
}

// The centre of the outward surface of face `upIdx` on cell (x,y,z). Half-integers.
export function faceCentre(x, y, z, upIdx) {
  const d = DIRS[upIdx];
  return { x: x + 0.5 + d.x * 0.5, y: y + 0.5 + d.y * 0.5, z: z + 0.5 + d.z * 0.5 };
}

// A cube occupies [x,x+1] x [y,y+1] x [z,z+1]. Looking down (1,1,1) the visible faces are exactly
// +x, +y and +z, so three parallelograms per cube and never more.
const CORNERS = {
  top:   [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  px:    [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  py:    [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
};
export function facePoly(x, y, z, which) {
  return CORNERS[which].map(([dx, dy, dz]) => project(x + dx, y + dy, z + dz));
}

// Inverse hit test for one cube's top face: is screen point p inside the top diamond?
// Used for tap-to-move. Solved analytically rather than by polygon containment because the top
// face of a lattice cube is always the same rhombus and the inverse of a 2x2 is free.
export function topFaceHit(px, py, x, y, z) {
  const c = project(x + 0.5, y + 0.5, z + 1);
  const dx = (px - c.x) / A, dy = (py - c.y) / B;
  return Math.abs(dx + dy) <= 1.0001 && Math.abs(dx - dy) <= 1.0001;
}
