// Emberkeep — shared simulation. The game AND the solver import this exact module.
// If these ever diverge, the solvability proof stops proving anything about the game.
//
// v1.1 adds: staged combustion (things no longer blink out of existence), spark shots,
// flammable webs, and non-lethal startles. Creatures and the walk-trail live OUTSIDE this
// module on purpose — see the note above `ignite` — so neither can affect the proof.
//
// v1.3 gives Ember a fail state: he can go out, and the round restarts. It is deliberately a
// SOFT fail, and the distinction is load-bearing:
//   * fuel reaching zero does not end anything — it starts a 3 SECOND GUTTERING WINDOW, and
//     an emberdrop grabbed inside that window brings him back
//   * going out costs THE ROOM and nothing else. No lives, no score, no lost progress, no
//     lost achievements, no lost shards. The room simply begins again
// The grace window exists so the player is never punished for a resource draining out of
// sight, and the room-only cost keeps a mistake cheap. `outs` is counted for achievements,
// never spent.

import { wick } from './wicks.js';

export const T = 24;              // 40x20 tiles = 960x480 logical
export const GRAV = 0.60;         // all px constants below are the 20px set x1.2, so the
export const JUMP = -10.08;       // jump envelope IN TILES (3.5 up, 4 across) is unchanged
export const SPD = 2.88;
export const MAXFALL = 13.2;
export const EW = 15.6, EH = 19.2;

export const LIGHT_MAX = 286;
export const LIGHT_MIN = 55;    // he dims to this and no further while guttering
export const FUEL_MAX = 1000;
export const FUEL_DRAIN = 0.30;
export const DROP_FUEL = 340;
export const CHAR_FUEL = 26;      // per tile, released when it finishes charring
export const SHOT_COST = 85;
export const STARTLE_COST = 130;
export const OUT_GRACE = 180;    // 3s of guttering before he goes out — long enough to save it
export const SHARD_FUEL = 190;
export const CACHE_FUEL = 430;

// --- combustion timing, in frames at 60fps
export const IG_END = 30;         // 0.5s — catching. Still solid.
export const SPREAD_AT = 54;      // 0.9s — the fire reaches its neighbours
export const BURN_END = 128;      // 2.1s — collapses to char. NOW passable.

// '#' stone  '=' phantom (solid, only VISIBLE in light)  'W' wood  'w' web  '.' empty
// 'o' emberdrop  'E' spawn  'X' exit  'b' bat  'p' spider
// '*' shard (collectable, visible)  '?' hidden cache (only rendered when Ember is close)
// '~' crumbling ledge — solid, but it shakes and drops the moment you stand on it, then
//     rebuilds. THE PROOF TREATS EVERY CRUMBLER AS ABSENT, so no room can ever depend on one:
//     they are the fast, risky route, never the only route.
// 'v' downdraft — a column of cold air. It pushes Ember down, drains him faster and squeezes
//     his light. It cannot kill; it can absolutely make you go out if you linger.
export const FLAMMABLE = new Set(['W', 'w']);
export const CRUMBLE_SHAKE = 26;   // frames of warning before it lets go
export const CRUMBLE_GONE = 150;   // frames it stays gone before rebuilding
export const DRAFT_PUSH = 0.42;
export const DRAFT_DRAIN = 1.45;   // extra fuel per frame inside a downdraft (2.1 was punishing)
export function isSolidChar(c) { return c === '#' || c === '='; }

export function solidAt(room, tx, ty, burned) {
  if (tx < 0 || tx >= room.w || ty < 0) return true;
  if (ty >= room.h) return false;
  const c = room.grid[ty][tx];
  if (isSolidChar(c)) return true;
  if (FLAMMABLE.has(c)) return !burned.has(ty * room.w + tx);   // solid until fully charred
  return false;
}

// Crumblers are handled outside solidAt so the solver can ignore them entirely by passing a
// state that never has any. `crumb` maps tileId -> frames since it was first stood on.
export function solidAtLive(room, tx, ty, s) {
  if (solidAt(room, tx, ty, s.burned)) return true;
  if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return false;
  if (room.grid[ty][tx] !== '~') return false;
  if (s.noCrumble) return false;        // the solver's view: crumblers are simply not there
  const age = s.crumb?.get(ty * room.w + tx);
  if (age == null) return true;                       // untouched: solid
  return age < CRUMBLE_SHAKE || age >= CRUMBLE_SHAKE + CRUMBLE_GONE;
}

function rectHitsSolid(room, x, y, s) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + EW - 1) / T);
  const y0 = Math.floor(y / T), y1 = Math.floor((y + EH - 1) / T);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (solidAtLive(room, tx, ty, s)) return true;
  return false;
}

export function spawnState(room) {
  return {
    x: room.spawn.x, y: room.spawn.y,
    vx: 0, vy: 0, onGround: false, facing: 1,
    fuel: FUEL_MAX,
    burning: new Map(),    // tileId -> frames since ignition. STILL SOLID.
    burned: new Set(),     // tileId -> fully charred. Passable.
    taken: new Set(),
    shots: [],
    burnCount: 0,
    startles: 0,
    shards: new Set(),     // '*' picked up this room
    caches: new Set(),     // '?' found this room
    crumb: new Map(),      // crumbling ledge id -> frames since first stood on
    inDraft: false,
    wick: 'ember',
    cinder: false,         // the B-side pass: less light, no emberdrops, same geometry
    inputLog: [],          // one byte per frame; the ghost is a replayable INPUT stream
    score: 0,
    outT: 0,               // frames spent at zero fuel
    out: false,            // he went out. The room restarts; nothing else is lost.
    knock: 0,              // frames of knockback lockout after a startle
    safe: 0,               // frames of immunity so one creature cannot chain-startle
    won: false,
    t: 0,
    events: [],            // drained by the renderer each frame; never read by the sim
  };
}

export function cloneState(s) {
  return { ...s, burning: new Map(s.burning), burned: new Set(s.burned), taken: new Set(s.taken), shards: new Set(s.shards), caches: new Set(s.caches), crumb: new Map(s.crumb), shots: s.shots.map(o => ({ ...o })) };
}

// ---------------------------------------------------------------- combustion
// IGNITION IS ALWAYS DELIBERATE. Nothing here fires on contact, on proximity, or from the
// walk-trail — only a spark shot the player aimed. That is what keeps every room completable
// without burning: you cannot set the level alight by accident, so burning stays a choice.
export function ignite(room, s, tx, ty) {
  if (!wick(s.wick).canIgnite) return false;      // Coldfire cannot, even when asked
  if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return false;
  if (!FLAMMABLE.has(room.grid[ty][tx])) return false;
  const id = ty * room.w + tx;
  if (s.burning.has(id) || s.burned.has(id)) return false;
  s.burning.set(id, 0);
  s.burnCount++;
  s.events.push({ k: 'ignite', tx, ty });
  return true;
}

function advanceCombustion(room, s) {
  if (s.burning.size === 0) return;
  const done = [];
  for (const [id, age] of s.burning) {
    const a = age + 1;
    s.burning.set(id, a);
    if (a === (wick(s.wick).spreadFast ? 6 : SPREAD_AT)) {
      const ty = Math.floor(id / room.w), tx = id % room.w;
      ignite(room, s, tx + 1, ty); ignite(room, s, tx - 1, ty);
      ignite(room, s, tx, ty + 1); ignite(room, s, tx, ty - 1);
    }
    if (a >= BURN_END) done.push(id);
  }
  for (const id of done) {
    s.burning.delete(id);
    s.burned.add(id);
    s.fuel = Math.min(FUEL_MAX, s.fuel + CHAR_FUEL);
    s.events.push({ k: 'collapse', tx: id % room.w, ty: Math.floor(id / room.w) });
  }
}

export function tileStage(s, id) {
  if (s.burned.has(id)) return 'char';
  const a = s.burning.get(id);
  if (a == null) return 'intact';
  return a < IG_END ? 'catching' : 'burning';
}

// ---------------------------------------------------------------- shots
export function fire(room, s) {
  if (s.fuel < SHOT_COST) return false;
  if (s.inputLog) s.inputLog.push(-1);          // a shot is logged inline so the ghost fires too
  s.fuel -= SHOT_COST;
  s.shots.push({ x: s.x + EW / 2, y: s.y + EH / 2 - 2, vx: s.facing * 6.24, vy: -0.42, life: 90,
                 trail: [] });
  s.events.push({ k: 'shot' });
  return true;
}

function advanceShots(room, s) {
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const p = s.shots[i];
    p.vy += 0.066;
    if (p.trail) { p.trail.push(p.x, p.y); if (p.trail.length > 14) p.trail.splice(0, 2); }
    p.x += p.vx; p.y += p.vy; p.life--;
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    const hit = solidAt(room, tx, ty, s.burned);
    if (hit) {
      if (!ignite(room, s, tx, ty)) s.events.push({ k: 'fizzle', x: p.x, y: p.y });
      s.shots.splice(i, 1);
    } else if (p.life <= 0 || p.x < -20 || p.x > room.w * T + 20 || p.y > room.h * T + 40) {
      s.events.push({ k: 'fizzle', x: p.x, y: p.y });
      s.shots.splice(i, 1);
    }
  }
}

// A startle costs fuel and footing. It never costs a life, because there are none.
export function startle(s, fromX) {
  if (s.knock > 0 || s.safe > 0) return false;
  s.fuel = Math.max(0, s.fuel - STARTLE_COST);
  s.vy = -6.24;
  s.knock = 26;
  s.safe = 110;      // brief immunity — being chain-startled by one spider is not a challenge
  s.startles++;
  s.knockDir = (s.x + EW / 2) < fromX ? -1 : 1;
  s.events.push({ k: 'startle' });
  return true;
}

// ---------------------------------------------------------------- step
export function step(s, input, room) {
  s.t++;
  // The ghost is this: three bits a frame. The physics is deterministic and there is a test
  // that proves it, so an input stream replays to the identical run — far cheaper and far more
  // faithful than sampling positions.
  if (s.inputLog) s.inputLog.push((input.left ? 1 : 0) | (input.right ? 2 : 0) | (input.jump ? 4 : 0));
  if (s.events.length > 64) s.events.length = 0;

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (s.knock > 0) { s.knock--; s.vx = (s.knockDir || 1) * SPD * 0.75; }
  else { s.vx = dir * SPD; if (dir !== 0) s.facing = dir; }

  const W = wick(s.wick);
  if (input.jump && s.onGround && s.knock === 0) s.vy = JUMP * W.jump;
  s.vy = Math.min(s.vy + GRAV * W.grav, MAXFALL);

  if (s.vx !== 0) {
    const nx = s.x + s.vx;
    if (rectHitsSolid(room, nx, s.y, s)) {
      const st = Math.sign(s.vx); let px = s.x;
      while (!rectHitsSolid(room, px + st, s.y, s) && Math.abs(px - s.x) < Math.abs(s.vx)) px += st;
      s.x = px; s.vx = 0;
    } else s.x = nx;
  }

  s.onGround = false;
  if (s.vy !== 0) {
    const ny = s.y + s.vy;
    if (rectHitsSolid(room, s.x, ny, s)) {
      const st = Math.sign(s.vy); let py = s.y;
      while (!rectHitsSolid(room, s.x, py + st, s) && Math.abs(py - s.y) < Math.abs(s.vy)) py += st;
      s.y = py;
      if (s.vy > 0) s.onGround = true;
      s.vy = 0;
    } else s.y = ny;
  }

  if (s.y > room.h * T + 80) { s.x = room.spawn.x; s.y = room.spawn.y; s.vy = 0; s.vx = 0; s.knock = 0; }

  if (s.safe > 0) s.safe--;

  // --- crumbling ledges: standing on one starts its clock; it never stops once started
  if (s.onGround && !s.noCrumble) {
    const fy = Math.floor((s.y + EH + 1) / T);
    for (const fx of [Math.floor((s.x + 2) / T), Math.floor((s.x + EW - 2) / T)]) {
      if (fx < 0 || fy < 0 || fx >= room.w || fy >= room.h) continue;
      if (room.grid[fy][fx] !== '~') continue;
      const id = fy * room.w + fx;
      if (!s.crumb.has(id)) { s.crumb.set(id, 0); s.events.push({ k: 'crumble', tx: fx, ty: fy }); }
    }
  }
  if (s.crumb.size) {
    for (const [id, age] of s.crumb) {
      const a = age + 1;
      if (a >= CRUMBLE_SHAKE + CRUMBLE_GONE) s.crumb.delete(id);   // rebuilt
      else s.crumb.set(id, a);
    }
  }

  // --- downdraft: cold air pushing a small fire around and thinning it out
  s.inDraft = false;
  if (!s.noCrumble) {
    const dx = Math.floor((s.x + EW / 2) / T), dy = Math.floor((s.y + EH / 2) / T);
    if (dy >= 0 && dy < room.h && dx >= 0 && dx < room.w && room.grid[dy][dx] === 'v') {
      s.inDraft = true;
      s.vy = Math.min(MAXFALL, s.vy + DRAFT_PUSH);
      s.fuel = Math.max(0, s.fuel - DRAFT_DRAIN);
    }
  }

  s.fuel = Math.max(0, s.fuel - FUEL_DRAIN * W.drain);
  advanceCombustion(room, s);
  advanceShots(room, s);

  const cx = Math.floor((s.x + EW / 2) / T), cy = Math.floor((s.y + EH / 2) / T);
  if (cy >= 0 && cy < room.h && cx >= 0 && cx < room.w) {
    const c = room.grid[cy][cx], id = cy * room.w + cx;
    if (c === 'o' && !s.taken.has(id)) {
      s.taken.add(id);
      s.fuel = Math.min(FUEL_MAX, s.fuel + DROP_FUEL);
      s.events.push({ k: 'drop', tx: cx, ty: cy });
    }
    if (c === '*' && !s.shards.has(id)) {
      s.shards.add(id);
      s.fuel = Math.min(FUEL_MAX, s.fuel + SHARD_FUEL);
      s.score += 250;
      s.events.push({ k: 'shard', tx: cx, ty: cy });
    }
    if (c === '?' && !s.caches.has(id)) {
      s.caches.add(id);
      s.fuel = Math.min(FUEL_MAX, s.fuel + CACHE_FUEL);
      s.score += 750;
      s.events.push({ k: 'cache', tx: cx, ty: cy });
    }
    if (c === 'X') s.won = true;
  }

  // Guttering is evaluated LAST, after every fuel source has had its say this frame.
  // Found by the behavioural sim: run earlier, it flagged him as going out on the very frame
  // he grabbed a shard, because char and pickups top the tank up further down the step.
  // Reaching zero is not the failure — ENDING the frame at zero is.
  if (s.fuel <= 0) {
    s.outT++;
    if (s.outT === 1) s.events.push({ k: 'guttering' });
    if (s.outT >= OUT_GRACE && !s.out) { s.out = true; s.events.push({ k: 'out' }); }
  } else if (s.outT > 0) {
    s.outT = 0;
    s.events.push({ k: 'relit' });
  }
  return s;
}

// The light floor is RELATIVE now: a wick or Cinders scales the whole range, so "never goes
// fully dark" cannot be asserted against the bare LIGHT_MIN constant any more. One function so
// the game, the tests and the sim all read the same floor.
export function lightFloor(s) {
  return LIGHT_MIN * wick(s.wick).light * (s.cinder ? 0.62 : 1);
}

export function lightRadius(s) {
  const frac = s.fuel / FUEL_MAX;
  const base = (LIGHT_MIN + (LIGHT_MAX - LIGHT_MIN) * frac) * wick(s.wick).light * (s.cinder ? 0.62 : 1);
  // Flicker is ADDITIVE ONLY — it can brighten, never dim. Found by the behavioural sim:
  // a symmetric multiplier pushed the radius ~5% under LIGHT_MIN at zero fuel, quietly
  // breaking the one invariant the whole never-dies law rests on. A flame that only ever
  // flares up can never violate its own floor.
  // A guttering flame is also a jumpier one, so amplitude rises as fuel falls.
  const amp = 0.030 + 0.050 * (1 - frac);
  const w = Math.sin(s.t * 0.147) + Math.sin(s.t * 0.061) * 0.6 + Math.sin(s.t * 0.31) * 0.25;
  const f = (w / 1.85 + 1) / 2;                     // -> [0,1], never negative
  return base * (1 + amp * f);
}
