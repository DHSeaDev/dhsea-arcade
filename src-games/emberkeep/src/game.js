// Emberkeep — game shell: loop, input, layered render, progression.
//
// v2.2: rooms are BIGGER THAN THE SCREEN and there is a camera. VW/VH are the viewport; the room
// is r.w x r.h tiles and may exceed it on either axis. Everything between the world-space save
// and its restore is drawn in room coordinates; everything outside it is screen space. Getting
// that boundary wrong is the defining bug of adding a camera to a game that never had one, so
// the boundary is marked in the source and gated in tools/capture.js against the __ek hook.
//
// RENDER STACK, back to front. The layering is the point — a single pass of flat shapes is
// what made v1.0 look like a diagram rather than a place.
//   0  the LIGHT FIELD is built first, before anything is drawn, because the tiles have to ask
//      it which way the light is coming from in order to have a lit face at all
//   1  four parallax planes, each with its own fog (atmospheric perspective)
//   2  background scenery -> tiles (culled, form-shaded) -> furniture
//   3  scorch  4  smoke + ash  5  creatures  5c ghost  6b foreground scenery
//   7a shots and particles into the glow buffer
//   5b depth of field
//   8  THE LIGHT: multiply by the field, then a low additive lift
//   6  Ember's mane into the bloom, then his BODY on top of it — he is the light source, not a
//      lit object, and drawn inside the lit block he blew out to a white smear
//   8b foreground occluder plane, which yields when he is behind it
//   9  dust, warm bounce, grain, vignette   10 HUD, all screen space

import { ROOMS } from './rooms.js';
import * as P from './physics.js';
import { EmberRig } from './ember.js';
import { Commentary } from './commentary.js';
import * as ACOM from './commentary.js';
import { VFX } from './vfx.js';
import { Creatures } from './creatures.js';
import { drawPortrait, drawPortraitFrame, drawBubble, drawToast } from './avatar.js';
import * as ACH from './achievements.js';
import { Audio } from './audio.js';
import { WICKS, WICK_IDS, WICK_CACHES, wick } from './wicks.js';
import { buildSprites, GLOW, blit } from './sprites.js';
import { LightField, FireFlicker } from './light.js';
import * as SCN from './scenery.js';

const cv = document.getElementById('cv');
const g = cv.getContext('2d');

// v2.2: VW/VH are the VIEWPORT, not the world. Through v2.1.2 they were both, which is why the
// game had no camera: every pass used raw world pixels as screen pixels. The viewport stays
// 40x20 tiles so the canvas aspect, the CSS and every HUD coordinate keep their meaning; the
// ROOM is now allowed to be bigger than that, and the camera moves inside it.
const VW = 40 * P.T, VH = 20 * P.T;          // 960 x 480 — the window, not the world
cv.width = VW; cv.height = VH;

// The camera. Follows with lookahead in the direction of travel, because a camera centred exactly
// on the player shows equal amounts of where you have been and where you are going, and only one
// of those is useful. Clamped to the room so it can never show outside the level.
const CAM = { x: 0, y: 0, tx: 0, ty: 0, shake: 0, sx: 0, sy: 0, kick: 0 };
function worldW(r) { return r.w * P.T; }
function worldH(r) { return r.h * P.T; }
function camClamp(r) {
  CAM.x = Math.max(0, Math.min(worldW(r) - VW, CAM.x));
  CAM.y = Math.max(0, Math.min(worldH(r) - VH, CAM.y));
  if (worldW(r) <= VW) CAM.x = 0;
  if (worldH(r) <= VH) CAM.y = 0;
}
function camSnap(r, s) {
  CAM.x = s.x + P.EW / 2 - VW / 2; CAM.y = s.y + P.EH / 2 - VH / 2;
  camClamp(r); CAM.tx = CAM.x; CAM.ty = CAM.y; CAM.shake = 0; CAM.sx = CAM.sy = 0;
}
function camStep(r, s) {
  const look = Math.max(-1, Math.min(1, s.vx / P.SPD)) * 96;
  CAM.tx = s.x + P.EW / 2 + look - VW / 2;
  CAM.ty = s.y + P.EH / 2 - VH / 2 - 12;
  const old = { x: CAM.x, y: CAM.y };
  CAM.x = old.x; CAM.y = old.y;
  CAM.x += (CAM.tx - CAM.x) * 0.085;          // slower on x: lookahead needs time to read
  CAM.y += (CAM.ty - CAM.y) * 0.115;
  camClamp(r);
  // shake decays geometrically; the offset is resampled per frame so it never reads as a wobble
  if (CAM.shake > 0.05) {
    CAM.shake *= 0.88;
    CAM.sx = (Math.random() - 0.5) * CAM.shake;
    CAM.sy = (Math.random() - 0.5) * CAM.shake;
  } else { CAM.shake = 0; CAM.sx = CAM.sy = 0; }
}
// screen-space position of a world point, which is what every full-screen pass needs
const scx = (wx) => wx - Math.round(CAM.x + CAM.sx);
const scy = (wy) => wy - Math.round(CAM.y + CAM.sy);

// The light field. Quarter resolution: a 900px light costs 225px of fill here, and the upscale
// is the browser's own bilinear filter running in native code.
const FIELD = new LightField(VW, VH, 4);
const FLICK = new FireFlicker(0x9e3779b1);

// Scale with the monitor: the canvas element fills its column via CSS, and we raise the backing
// store to match the displayed size x devicePixelRatio so a 4K panel gets 4K pixels rather than
// an upscaled 960x480. The drawing code keeps working in logical units.
function fitToScreen() {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const rect = cv.getBoundingClientRect();
  if (!rect.width) return;
  const bw = Math.round(rect.width * dpr), bh = Math.round(rect.width * (VH / VW) * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  g.setTransform(cv.width / VW, 0, 0, cv.width / VW, 0, 0);
}
addEventListener('resize', fitToScreen);

// A read-only diagnostics hook. tools/capture.js has read `window.__ek` since v1.x and it has
// never existed — a dead read that quietly returned undefined and asserted nothing, which is the
// same defect class as the tautology deleted from the burn check. It exists now because the
// camera cannot be honestly gated from pixels alone: "the scene changed" is true whether or not
// the view moved, and a gate that cannot tell those apart is not a gate. Read-only, no game
// state is settable through it, and it ships because a diagnostic that only exists in a test
// build is a diagnostic that is wrong about the shipped one.
Object.defineProperty(window, '__ek', {
  get() {
    const r = G.room, s = G.s;
    if (!r || !s) return null;
    return {
      cam: { x: CAM.x, y: CAM.y },
      world: { w: r.w * P.T, h: r.h * P.T },
      view: { w: VW, h: VH },
      ember: { x: s.x, y: s.y, sx: s.x - CAM.x, sy: s.y - CAM.y },
      room: { i: G.idx, name: r.name, decor: r.decor.length },
      quality: G.quality, fps: Math.round(G.fps),
      audio: { started: !!G.aud.ctx, muted: G.aud.muted,
               mood: G.aud.music ? G.aud.music.moodName : null,
               voices: G.aud.music ? G.aud.music.voices.length : 0 },
    };
  },
});

// The portrait lives on its OWN canvas in the side rail. It used to be drawn into the playfield
// and Ember could simply walk behind it — a HUD element that the player can collide with is a
// HUD element in the wrong place.
const pcv = document.getElementById('pt');
const pg = pcv ? pcv.getContext('2d') : null;
const PW = 150, PH = 230;
const pglow = document.createElement('canvas'); pglow.width = PW; pglow.height = PH;
const pgg = pglow.getContext('2d');
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// offscreen buffers: full-res glow, quarter-res bloom
const glow = document.createElement('canvas'); glow.width = VW; glow.height = VH;
const gg = glow.getContext('2d');
const bloom = document.createElement('canvas'); bloom.width = VW / 4; bloom.height = VH / 4;
const bg = bloom.getContext('2d');
// depth of field: the far scene is rendered, downsampled, blurred, and painted back through a
// radial mask that is transparent where Ember is standing. Cheap because out-of-focus detail
// is the one thing you are allowed to throw away.
const dofSmall = document.createElement('canvas'); dofSmall.width = VW / 4; dofSmall.height = VH / 4;
const ds = dofSmall.getContext('2d');
const dofMask = document.createElement('canvas'); dofMask.width = VW; dofMask.height = VH;
const dm = dofMask.getContext('2d');

// Baked full-screen passes. These were rebuilt as CanvasGradient objects on EVERY frame; the
// falloff's shape is constant and the vignette is entirely static, so neither ever needed to be.
// v2.2: the FALLOFF sprite is GONE. It was the single baked darkness mask that made everything
// in the game unlit-but-less-dark, and src/light.js replaces it with a real multi-light field.
// Deleted rather than left unused — a dead bake is a thing a future reader restores by accident.
// the DOF focus mask, baked: transparent where he stands, opaque at the edge of focus
const DOFMASK = document.createElement('canvas'); DOFMASK.width = DOFMASK.height = 256;
(() => {
  const c = DOFMASK.getContext('2d');
  const gr = c.createRadialGradient(128, 128, 128 * (0.20 / 1.30), 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.7, 'rgba(0,0,0,.55)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 256, 256);      // rect, for the same reason as FALLOFF
})();
const VIGNETTE = document.createElement('canvas'); VIGNETTE.width = 240; VIGNETTE.height = 120;
(() => {
  const c = VIGNETTE.getContext('2d');
  const gr = c.createRadialGradient(120, 60, 60 * 0.45 * 2, 120, 60, 120 * 0.68 * 2);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = gr; c.fillRect(0, 0, 240, 120);
})();

const store = {
  async get(k, d) { try { const r = await chrome.storage.local.get(k); return r[k] ?? d; } catch { return d; } },
  async set(k, v) { try { await chrome.storage.local.set({ [k]: v }); } catch {} },
};

const G = {
  idx: 0, room: null, s: null, rig: new EmberRig(), com: new Commentary(),
  vfx: new VFX(), cre: null, par: [],
  input: { left: 0, right: 0, jump: 0 },
  sinceBurn: 1e9, sinceDrop: 1e9, idle: 0,
  phase: 'play', tally: [],
  ach: null, toast: null, toastT: 0, showGoals: false, lastScore: null,
  aud: new Audio(), moodEl: null, wasGround: true, stepT: 0,
  mem: { roomsDone: 0, burned: 0, outs: 0, startles: 0, shards: 0 },
  memUsed: new Set(), logEl: null, showMap: false, best: {}, seen: {},
  wicks: ['ember'], wick: 'ember', cinder: false,
  ghost: null, ghostOn: true, roomT: 0, record: [], newWick: null, newWickT: 0,
  run: null, outFade: 0,
  grainX: 0, grainY: 0, grainT: 0, fps: 60, quality: 2, qAt: 0, showPerf: false, portraitDirty: true,
  toldPhantom: false, toldNear: false, toldWeb: false,
};

// ---------- grain
// Was 18 tile blits every frame (a 180px tile stamped across a 960x480 field). Now four
// full-field variants are baked once and one of them is drawn per frame — 18 draws to 1, and
// the variation that used to come from a random offset now comes from picking a variant.
const GRAIN = [];
(() => {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 180;
  const tc = tile.getContext('2d');
  for (let v = 0; v < 4; v++) {
    const im = tc.createImageData(180, 180);
    for (let i = 0; i < im.data.length; i += 4) {
      const n = 118 + Math.random() * 74;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = n; im.data[i + 3] = 255;
    }
    tc.putImageData(im, 0, 0);
    const full = document.createElement('canvas');
    full.width = VW; full.height = VH;
    const fc = full.getContext('2d');
    for (let y = 0; y < VH; y += 180) for (let x = 0; x < VW; x += 180) fc.drawImage(tile, x, y);
    GRAIN.push(full);
  }
})();

// ---------- parallax: the depth stack.
//
// v2.1.2 had TWO layers of six ellipses each, at depths 0.020 and 0.055 — a full-width traverse
// moved them 19px and 53px respectively, which is to say the background was static and the scene
// was exactly two planes deep. With a camera there is real travel to parallax against, so this is
// now a proper multiplane stack with a FOREGROUND plane that passes in front of Ember.
//
// Atmospheric perspective is applied per layer, three operations together: shift the hue toward
// the ambient, cut the contrast, cut the saturation, monotonically with distance. Doing only the
// first (a flat tint) is what makes faked depth read as coloured cellophane.
const LAYERS = [
  { depth: 0.10, tint: '#0d0d10', n: 7, lo: 40,  hi: 200, fog: 0.55 },   // furthest: almost sky
  { depth: 0.20, tint: '#12110f', n: 8, lo: 60,  hi: 240, fog: 0.38 },
  { depth: 0.34, tint: '#171510', n: 9, lo: 70,  hi: 260, fog: 0.22 },
  { depth: 0.52, tint: '#1c1913', n: 8, lo: 80,  hi: 280, fog: 0.10 },   // nearest background
];
const FORE = { depth: 1.55, tint: '#08080a', n: 6 };                      // IN FRONT of Ember

function makeParallax(seed, room) {
  let n = seed >>> 0;
  const rnd = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
  const span = room.w * P.T, tall = room.h * P.T;
  const layers = [];
  for (const L of LAYERS) {
    const shapes = [];
    for (let i = 0; i < L.n; i++) shapes.push({
      x: rnd() * span * 1.1 - span * 0.05,
      y: L.lo + rnd() * (Math.min(L.hi, tall) - L.lo),
      w: 90 + rnd() * 320, h: 90 + rnd() * 260,
    });
    layers.push({ ...L, shapes });
  }
  // Sat high and large in the first build and buried Ember behind a black blob — a foreground
  // plane that hides the player is not a depth cue, it is an obstruction. These are now small,
  // anchored BELOW the floor line so most of each one is cropped by the bottom edge, and they
  // yield when he is near (see the draw).
  const fshapes = [];
  for (let i = 0; i < FORE.n; i++) fshapes.push({
    x: rnd() * span, y: tall + 24 + rnd() * 40,
    w: 90 + rnd() * 150, h: 70 + rnd() * 90,
  });
  return { layers, fore: { ...FORE, shapes: fshapes } };
}

// ---------- room lifecycle
function load(i) {
  G.idx = i;
  G.room = ROOMS[i];
  G.s = P.spawnState(G.room);
  G.s.wick = G.wick;
  G.s.cinder = G.cinder;
  G.roomT = 0;
  // Cinders: the B-side. Same geometry, less light, and every emberdrop already spent. Neither
  // gates movement, so a Cinder room inherits the base room's no-burn proof rather than needing
  // its own — asserted by test.
  if (G.cinder) {
    for (let y = 0; y < G.room.h; y++) for (let x = 0; x < G.room.w; x++)
      if (G.room.grid[y][x] === 'o') G.s.taken.add(y * G.room.w + x);
  }
  // the ghost of your own best run on this room, replayed in a state of its own
  const gh = G.best[G.idx]?.ghost;
  if (gh && G.ghostOn && !G.cinder) {
    const gs = P.spawnState(G.room); gs.wick = gh.wick || 'ember'; gs.inputLog = null;
    G.ghost = { s: gs, log: gh.log, i: 0, done: false };
  } else G.ghost = null;
  G.rig = new EmberRig();
  G.vfx.reset();
  G.vfx.seedDust(VW, VH);
  G.cre = new Creatures(G.room);
  G.par = makeParallax(i * 7717 + 13, G.room);
  camSnap(G.room, G.s);
  G.sinceBurn = 1e9; G.sinceDrop = 1e9; G.idle = 0;
  G.toldPhantom = G.toldNear = G.toldWeb = G.sawCrow = false;
  G.seen = {};
  G.phase = 'play';
  G.outFade = 0;
  G.run = { won: false, shots: 0, startles: 0, outs: 0, biggestSpread: 0, shards: 0,
            shardsInRoom: countIn(G.room, '*'), caches: 0, burned: 0,
            wick: G.wick, cinder: G.cinder };
  // Ember refers to the run so far before he says anything about the room. This is what turns
  // eleven rooms into one journey rather than eleven unrelated introductions.
  const recalled = G.mem.roomsDone > 0 ? ACOM.pickMemory(G.mem, G.memUsed) : null;
  if (recalled) G.com.say(recalled, G.s.t);
  else if (G.room.final) G.com.fire('final', G.s.t, { force: true });
  else if (G.room.outdoor) G.com.fire('outside', G.s.t, { force: true });
  else G.com.fire('room_start', G.s.t, { force: true });
  G.aud.setRoom(i);
  document.getElementById('roomName').textContent = `${i + 1}. ${G.room.name}`;
  document.getElementById('roomHint').textContent = G.room.hint;
}

function countIn(room, ch) {
  let n = 0;
  for (const row of room.grid) for (const c of row) if (c === ch) n++;
  return n;
}

function award(fresh) {
  for (const id of fresh) {
    const a = ACH.byId(id);
    if (a) { G.toast = a; G.toastT = 240; G.aud.goal(); }
  }
  if (fresh.length) saveAch();
}
function saveAch() { store.set('ach', ACH.serialize(G.ach)); }

function clearRoom() {
  G.aud.clear();          // audio.js:162 was dead code for four versions — nothing ever called it
  G.phase = 'cleared';
  G.tally[G.idx] = G.s.burnCount;
  G.com.fire(G.s.burnCount === 0 ? 'clear_clean' : 'clear_burned', G.s.t, { force: true });
  store.set('progress', { idx: G.idx + 1, tally: G.tally });

  // scoring: reaching the brazier is the floor; everything above it is how you got there
  const bonusClean = G.s.burnCount === 0 ? 1500 : 0;
  const bonusQuiet = G.run.shots === 0 ? 600 : 0;
  const bonusWhole = G.run.startles === 0 ? 400 : 0;
  const penalty = G.s.burnCount * 40;
  G.lastScore = { base: 1000, clean: bonusClean, quiet: bonusQuiet, whole: bonusWhole,
                  finds: G.s.score, penalty };
  const gained = 1000 + bonusClean + bonusQuiet + bonusWhole + G.s.score - penalty;
  G.ach.score = (G.ach.score || 0) + Math.max(0, gained);
  const prev = G.best[G.idx] || { score: 0, clean: false, full: false, time: 0, ghost: null, cinder: false };
  const shardsHere = countIn(G.room, '*'), cachesHere = countIn(G.room, '?');
  const full = (G.s.shards.size >= shardsHere) && (G.s.caches.size >= cachesHere);
  const faster = !prev.time || G.roomT < prev.time;
  G.best[G.idx] = {
    score: Math.max(prev.score, Math.max(0, gained)),
    clean: prev.clean || G.s.burnCount === 0,
    full: prev.full || full,
    cinder: prev.cinder || G.cinder,
    time: faster ? G.roomT : prev.time,
    // keep the ghost of the FASTEST run, capped so storage cannot grow without bound
    ghost: faster && G.s.inputLog.length < 20000
      ? { log: G.s.inputLog.slice(), wick: G.s.wick } : prev.ghost,
  };
  store.set('best', G.best);
  if (G.room.final) { G.ach.reachedEnd = 1; G.ach.runBurned = G.mem.burned + G.s.burnCount; }
  if (G.room.name === 'Still') G.ach.stillVisited = 1;
  if (G.ghost && G.best[G.idx]?.time && G.roomT < G.best[G.idx].time) G.ach.beatGhost = (G.ach.beatGhost || 0) + 1;
  G.ach.recordLines = G.record.length;
  G.mem.roomsDone++;
  G.mem.burned += G.s.burnCount;
  G.mem.shards += G.s.shards.size;
  G.run.won = true;
  G.ach.cleared++;
  if (G.s.burnCount === 0 && !G.ach.cleanRoomIds.has(G.idx)) {
    G.ach.cleanRoomIds.add(G.idx); G.ach.cleanRooms++;
  }
  award(ACH.evaluate(G.ach, G.run));
}

// ---------- input
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
               ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };
addEventListener('keydown', e => {
  G.aud.start();                                   // browsers only allow audio after a gesture
  if (e.code === 'KeyM') { G.aud.setMuted(!G.aud.muted); store.set('muted', G.aud.muted); }
  if (KEYS[e.code]) { G.input[KEYS[e.code]] = 1; e.preventDefault(); }
  if (e.code === 'KeyR') load(G.idx);
  if (e.code === 'KeyQ' && G.wicks.length > 1) {          // swap wick, restart the room with it
    const i = (G.wicks.indexOf(G.wick) + 1) % G.wicks.length;
    G.wick = G.wicks[i]; store.set('wick', G.wick); load(G.idx);
  }
  if (e.code === 'KeyG') { G.ghostOn = !G.ghostOn; store.set('ghostOn', G.ghostOn); load(G.idx); }
  if (e.code === 'KeyP') { G.showPerf = !G.showPerf; }
  if (e.code === 'Tab') { e.preventDefault(); G.showGoals = !G.showGoals; if (G.showGoals) G.showMap = false; }
  if (e.code === 'KeyL') { G.showMap = !G.showMap; if (G.showMap) G.showGoals = false; }
  if (G.showMap && /^Digit[1-9]$/.test(e.code)) {          // replay any room you have finished
    const n = +e.code.slice(5) - 1;
    // shift enters CINDERS, which a room unlocks by having been cleared without burning anything
    const wantCinder = e.shiftKey && G.best[n]?.clean;
    if (G.best[n] || n === 0) { G.showMap = false; G.cinder = !!wantCinder; load(n); }
  }
  if (G.showMap && e.code === 'Digit0' && (G.best[9] || G.best[10])) { G.showMap = false; load(10); }
  // F, not Shift. Shift-as-an-action fights Windows StickyKeys (five presses opens a system
  // dialog over the game) and it was also double-firing on shift+number on the keep map.
  if (e.code === 'KeyF' || e.code === 'KeyB') {
    e.preventDefault();
    if (G.phase === 'play' && P.fire(G.room, G.s)) {
      G.run.shots++; G.aud.shot();
      G.vfx.emitMuzzle(G.s.x + P.EW / 2 + G.s.facing * 6, G.s.y + P.EH / 2 - 2, G.s.facing);
      G.com.fire('shot', G.s.t, { cooldown: 420 });
    }
  }
  if (e.code === 'Enter') {
    if (G.phase === 'cleared') { G.idx + 1 < ROOMS.length ? load(G.idx + 1) : (G.phase = 'done'); }
    else if (G.phase === 'done') { G.tally = []; load(0); }
  }
});
addEventListener('keyup', e => { if (KEYS[e.code]) { G.input[KEYS[e.code]] = 0; e.preventDefault(); } });

// ---------- loop
//
// FIXED TIMESTEP. The old loop ran exactly one physics step per rendered frame, which meant the
// simulation ran at whatever rate the renderer happened to achieve — measured at 20.8 fps, so
// Ember walked at a third speed with a step size that changed every frame. That is not an
// animation problem, it is a clock problem, and no amount of rendering polish fixes it.
//
// Now: accumulate real elapsed time, step at exactly 60 Hz, render once. MAX_STEPS caps the
// catch-up burst so a long stall (tab backgrounded, GC pause) cannot spiral into a freeze —
// time is dropped instead, which is the correct trade for a game with no network peer.
const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;
let acc = 0, prevT = performance.now();

function frame(now) {
  const dt = Math.min(250, now - prevT);      // a 250ms clamp: anything longer is a stall, not lag
  prevT = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP_MS && steps < MAX_STEPS) { acc -= STEP_MS; steps++; simulate(); }
  if (steps === MAX_STEPS) acc = 0;           // we are behind; drop the debt rather than chase it
  G.fps += ((1000 / Math.max(1, dt)) - G.fps) * 0.05;
  // Adaptive quality. The simulation is fixed and inviolable; the RENDERER is what gives way.
  // 2 = everything, 1 = no depth of field, 0 = no wide bloom pass either.
  if (G.fps < 40 && G.quality > 0 && now - G.qAt > 1500) { G.quality--; G.qAt = now; }
  else if (G.fps > 56 && G.quality < 2 && now - G.qAt > 6000) { G.quality++; G.qAt = now; }
  render();
  requestAnimationFrame(frame);
}

function simulate() {
  const s = G.s, r = G.room;

  if (G.phase === 'play') {
    P.step(s, G.input, r);
    G.roomT++;
    camStep(r, s);
    advanceGhost(r);
    G.cre.update(s, r, G.vfx);
    if (r.outdoor && !G.sawCrow && G.cre.list.some(c => c.kind === 'crow' && c.state === 'dive')) {
      G.sawCrow = true; G.ach.crowsMet = 1;
      G.com.fire('crow', s.t, { force: true });
      award(ACH.evaluate(G.ach, G.run));
    }
    G.sinceBurn++; G.sinceDrop++;

    for (const ev of s.events) {
      if (ev.k === 'ignite') {
        G.sinceBurn = 0; G.aud.ignite();
        G.ach.burned++; G.run.burned++;
        G.run.biggestSpread = Math.max(G.run.biggestSpread, s.burnCount);
        award(ACH.evaluate(G.ach, G.run));
        G.com.fire(s.burnCount >= 6 ? 'burn_spread' : (s.burnCount === 1 ? 'first_burn' : 'burn'), s.t, { cooldown: 200 });
      } else if (ev.k === 'collapse') {
        CAM.shake = Math.max(CAM.shake, 7.5);
        G.vfx.emitCollapse(ev.tx * P.T + 10, ev.ty * P.T + 12); G.aud.collapse();
      } else if (ev.k === 'drop') {
        G.sinceDrop = 0;
        G.com.fire('took_drop', s.t); G.aud.drop();
        G.vfx.emitBurst(ev.tx * P.T + 10, ev.ty * P.T + 10, 16);
      } else if (ev.k === 'fizzle') {
        G.vfx.emitFizzle(ev.x, ev.y); G.aud.fizzle();
      } else if (ev.k === 'rat') {
        G.com.fire('rat', s.t, { cooldown: 900 });
        if (!G.ach.ratsMet) { G.ach.ratsMet = 1; award(ACH.evaluate(G.ach, G.run)); }
      } else if (ev.k === 'rat_bold') {
        G.com.fire('rat_bold', s.t, { force: true });
        G.aud.shard();
        if (!G.ach.ratSat) { G.ach.ratSat = 1; award(ACH.evaluate(G.ach, G.run)); }
      } else if (ev.k === 'startle') {
        G.run.startles++; G.ach.startles++; G.mem.startles++;
        G.com.fire('startled', s.t, { force: true }); G.aud.startle();
        award(ACH.evaluate(G.ach, G.run));
      } else if (ev.k === 'shard') {
        G.run.shards++; G.ach.shardsFound++;
        G.vfx.emitBurst(ev.tx * P.T + 10, ev.ty * P.T + 10, 18);
        G.com.fire('shard', s.t); G.aud.shard();
        award(ACH.evaluate(G.ach, G.run));
      } else if (ev.k === 'cache') {
        const found = WICK_CACHES[r.name];
        if (found && !G.wicks.includes(found)) {
          G.wicks.push(found);
          G.ach.wicksFound = G.wicks.length;
          store.set('wicks', G.wicks);
          G.newWick = WICKS[found];
          G.newWickT = 420;
          G.aud.cache();
          G.com.say(`${WICKS[found].name}. ${WICKS[found].blurb}`, s.t);
        }
        G.run.caches++; G.ach.cachesFound++; G.ach.caches++;
        G.vfx.emitBurst(ev.tx * P.T + 10, ev.ty * P.T + 10, 30);
        G.com.fire('cache', s.t, { force: true }); G.aud.cache();
        award(ACH.evaluate(G.ach, G.run));
      } else if (ev.k === 'guttering') {
        G.com.fire('going_out', s.t, { force: true }); G.aud.guttering();
      } else if (ev.k === 'relit') {
        G.com.fire('saved', s.t, { force: true }); G.aud.relit();
      } else if (ev.k === 'out') {
        G.run.outs++; G.ach.outs++; G.mem.outs++;
        G.phase = 'out';
        G.com.fire('went_out', s.t, { force: true }); G.aud.out();
        award(ACH.evaluate(G.ach, G.run));
      }
    }
    for (const ev of s.events) if (ev.k === 'crumble') G.aud.crumble();
    s.events.length = 0;

    // footsteps, landings and jumps — read off the state, not hooked into input
    if ((s.t & 31) === 0) G.aud.setTension(Math.min(1, s.burning.size / 6) * 0.7 + (s.fuel / P.FUEL_MAX < 0.2 ? 0.3 : 0));
    if (s.onGround && Math.abs(s.vx) > 0.1 && s.t - G.stepT > 13) { G.stepT = s.t; G.aud.step(); }
    if (s.onGround && !G.wasGround) G.aud.land();
    if (!s.onGround && G.wasGround && s.vy < 0) G.aud.jump();
    G.wasGround = s.onGround;
    G.aud.tick(s.t, s.burning.size, s.inDraft);

    // the trail: he does not choose this
    if (s.onGround && Math.abs(s.vx) > 0.1) G.vfx.walkTrail(s.x + P.EW / 2, s.y + P.EH, s.t);
    for (const p of s.shots) G.vfx.emitShot(p.x, p.y, p.vx, p.vy);
    for (const [id] of s.burning) {
      G.vfx.emitTileFire((id % r.w) * P.T + 10, Math.floor(id / r.w) * P.T + 10, P.tileStage(s, id));
    }
    G.vfx.update();
    // The rig ticks with the SIMULATION, once per fixed 60Hz step. Advancing it from render()
    // meant the flame ran at renderRate/60 of real time and slid out of phase with the body.
    G.rig.update(STEP_MS / 1000, s.x + P.EW / 2, s.y - 24, s,
                 { sinceBurn: G.sinceBurn, sinceDrop: G.sinceDrop, idle: G.idle });

    G.idle = (G.input.left || G.input.right || G.input.jump) ? 0 : G.idle + 1;
    if (G.idle > 0 && G.idle % 420 === 0) G.com.fire('idle', s.t);
    if (s.fuel / P.FUEL_MAX < 0.16) G.com.fire('low_fuel', s.t, { cooldown: 600 });
    if (!G.toldNear && Math.abs(s.x / P.T - r.exit.x) < 6) { G.toldNear = true; G.com.fire('near_exit', s.t); }
    if (!G.toldPhantom && standingOn('=')) { G.toldPhantom = true; G.com.fire('phantom', s.t); }
    if (!G.toldWeb && nearChar('w', 46)) { G.toldWeb = true; G.com.fire('web', s.t); }
    // the keep's own history — each relic speaks once per room
    for (const [ch, pool] of [['k', 'hearth'], ['x', 'scorch'], ['y', 'tally']]) {
      if (!G.seen[ch] && nearChar(ch, 52)) {
        G.seen[ch] = true;
        G.com.fire(pool, s.t, { cooldown: 240 });
        G.ach.relicsSeen = (G.ach.relicsSeen || 0) + 1;
        // the thread: each relic adds one line to a record the player can read back
        const note = { k: 'The hearth in ' + r.name + ' is cold.', x: 'An old burn in ' + r.name + '. Not his.',
                       y: 'Someone kept count in ' + r.name + '.' }[ch];
        if (note && !G.record.includes(note)) { G.record.push(note); store.set('record', G.record); }
        award(ACH.evaluate(G.ach, G.run));
      }
    }
    if (s.won) clearRoom();
  } else if (G.phase === 'out') {
    G.vfx.update();
    G.outFade += 1 / 90;
    if (G.outFade >= 1.6) load(G.idx);       // the room begins again. Progress is untouched.
  }

  if (G.toastT > 0) G.toastT--;
}

// The ghost runs its own state object and never touches the live one. It replays the recorded
// input stream, including the inline -1 markers that mean "a spark was fired on this frame".
function advanceGhost(room) {
  const G_ = G.ghost;
  if (!G_ || G_.done) return;
  let guard = 0;
  while (G_.i < G_.log.length && guard++ < 8) {
    const v = G_.log[G_.i++];
    if (v === -1) { P.fire(room, G_.s); continue; }
    P.step(G_.s, { left: !!(v & 1), right: !!(v & 2), jump: !!(v & 4) }, room);
    break;
  }
  if (G_.i >= G_.log.length) G_.done = true;
}

function standingOn(ch) {
  if (!G.s.onGround) return false;
  const ty = Math.floor((G.s.y + P.EH + 1) / P.T), tx = Math.floor((G.s.x + P.EW / 2) / P.T);
  return G.room.grid[ty]?.[tx] === ch;
}
function nearChar(ch, px) {
  const cx = G.s.x + P.EW / 2, cy = G.s.y + P.EH / 2, r = G.room;
  const t = Math.ceil(px / P.T), tx = Math.floor(cx / P.T), ty = Math.floor(cy / P.T);
  for (let y = ty - t; y <= ty + t; y++) for (let x = tx - t; x <= tx + t; x++)
    if (r.grid[y]?.[x] === ch) return true;
  return false;
}

// ---------- render
function render() {
  const r = G.room, s = G.s;
  const wx = s.x + P.EW / 2, wy = s.y + P.EH / 2;        // WORLD centre of Ember
  const camx = Math.round(CAM.x + CAM.sx), camy = Math.round(CAM.y + CAM.sy);
  const cx = wx - camx, cy = wy - camy;                  // SCREEN centre of Ember
  const rad = P.lightRadius(s);
  const t = s.t;

  g.fillStyle = '#0a0a0c';
  g.fillRect(0, 0, VW, VH);
  gg.clearRect(0, 0, VW, VH);

  // ---- 0. THE LIGHT FIELD, built before a single pixel of the scene is drawn — because the
  // tiles have to ask it which way the light is coming from in order to have a lit face at all.
  // Lights are added in WORLD coordinates; the camera offset is applied once, at bake.
  FLICK.step(1000 / 60);
  const fgain = FLICK.gain, fwarm = FLICK.warm;
  FIELD.begin();
  FIELD.add(wx + FLICK.ox, wy - 12 + FLICK.oy, rad * 1.7 * fgain,
            255, 168 + (fwarm * 44 | 0), 88 + (fwarm * 56 | 0), 1.15 * fgain);
  SCN.sconceLights(r, FIELD, t, FLICK.i.v);
  // every burning tile is a real light, which is what makes a spreading fire light the room up
  for (const id of s.burning.keys()) {
    const stage = P.tileStage(s, id);
    if (stage === 'char') continue;
    const bx = (id % r.w) * P.T + 12, by = ((id / r.w) | 0) * P.T + 12;
    const k = stage === 'catching' ? 0.42 : 0.95;
    FIELD.add(bx, by - 6, 118 * k * fgain, 255, 150, 70, 0.72 * k * fgain);
  }
  {
    // the exit brazier lights its own alcove — cold when far, hot when he is nearly there
    const ex = r.exit.x * P.T + 12, ey = r.exit.y * P.T + 6;
    const near = Math.hypot(ex - wx, ey - wy) < 110;
    FIELD.add(ex, ey, near ? 150 : 96, near ? 255 : 150, near ? 176 : 190, near ? 96 : 235,
              near ? 0.80 : 0.34);
  }
  FIELD.bake(camx, camy);

  // ---- 1. the depth stack. Drawn in SCREEN space with a per-layer scroll divisor, and each
  // layer gets its own fog fill afterwards: hue toward ambient, contrast down, saturation down.
  for (const L of G.par.layers) {
    const ox = -camx * L.depth, oy = -camy * L.depth * 0.55;
    g.fillStyle = L.tint;
    for (const sh of L.shapes) {
      const px = sh.x + ox, py = sh.y + oy;
      if (px + sh.w < -40 || px - sh.w > VW + 40) continue;      // cull: a 64-tile room is wide
      g.beginPath(); g.ellipse(px, py, sh.w / 2, sh.h / 2, 0, 0, 7); g.fill();
    }
    if (L.fog > 0.02) {
      g.fillStyle = `rgba(15,15,20,${L.fog * 0.30})`;
      g.fillRect(0, 0, VW, VH);
    }
  }

  // ================= WORLD SPACE =================
  // Everything from here to the matching restore is drawn in room coordinates. The glow buffer
  // gets the identical transform, so an emissive thing and its own sprite cannot drift apart.
  g.save(); g.translate(-camx, -camy);
  gg.save(); gg.translate(-camx, -camy);

  // ---- 1b. background scenery: arches, pillars, banners, roots. Behind the geometry, so the
  // tiles occlude it and the room acquires a behind.
  SCN.drawBack(g, r, FIELD, t);

  // ---- 2. tiles. Culled to the viewport: v2.1.2 scanned all 800 cells every frame, and a
  // 64x20 room would have made that 1280 for no reason.
  const x0 = Math.max(0, (camx / P.T | 0) - 1), x1 = Math.min(r.w - 1, ((camx + VW) / P.T | 0) + 1);
  const y0 = Math.max(0, (camy / P.T | 0) - 1), y1 = Math.min(r.h - 1, ((camy + VH) / P.T | 0) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = r.grid[y][x], px = x * P.T, py = y * P.T, id = y * r.w + x;
      if (c === '.') continue;
      if (c === '#') {
        // FORM. The dominant light's direction at this tile picks which face gets the highlight
        // and which gets the shade. This is the difference between a lit surface and a bright
        // one: v2.1.2 filled every stone with the identical rgb and let a darkness mask sort it
        // out, so nothing ever showed which way the light was.
        const L = FIELD.shadeAt(px + 12, py + 12);
        const a = L.amt;
        g.fillStyle = '#3c3a34';
        g.fillRect(px, py, P.T, P.T);
        if (a > 0.015) {
          const hi = Math.min(0.62, a * 0.9);
          g.fillStyle = `rgba(255,${206 + (fwarm * 24 | 0)},${158 + (fwarm * 30 | 0)},${hi * 0.30})`;
          g.fillRect(px, py, P.T, P.T);                                  // the diffuse term
          g.fillStyle = `rgba(255,${222 + (fwarm * 18 | 0)},${176},${hi * 0.55})`;
          if (L.ny < -0.18) g.fillRect(px, py, P.T, 4);                  // lit from above
          if (L.ny > 0.18) g.fillRect(px, py + P.T - 4, P.T, 4);
          if (L.nx < -0.18) g.fillRect(px, py, 4, P.T);
          if (L.nx > 0.18) g.fillRect(px + P.T - 4, py, 4, P.T);
          g.fillStyle = `rgba(0,0,0,${hi * 0.34})`;                      // and the shaded face
          if (L.ny < -0.18) g.fillRect(px, py + P.T - 3, P.T, 3);
          if (L.ny > 0.18) g.fillRect(px, py, P.T, 3);
          if (L.nx < -0.18) g.fillRect(px + P.T - 3, py, 3, P.T);
          if (L.nx > 0.18) g.fillRect(px, py, 3, P.T);
        }
        // one stable per-tile grain so a 40-wide floor is not 40 identical stamps
        const n = ((x * 73856093) ^ (y * 19349663)) & 7;
        g.fillStyle = n < 3 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.030)';
        g.fillRect(px + (n & 3) * 5, py + ((n >> 1) & 3) * 5, 5, 4);
      } else if (c === '=') {
        const d = Math.hypot(px + 12 - wx, py + 12 - wy);
        if (d < rad * 1.05) {
          const a = Math.max(0, 1 - d / (rad * 1.05));
          g.fillStyle = `rgba(96,92,74,${0.32 + 0.55 * a})`; g.fillRect(px, py, P.T, P.T);
          g.fillStyle = `rgba(190,168,120,${0.42 * a})`; g.fillRect(px, py, P.T, 3);
          g.fillStyle = `rgba(0,0,0,${0.22 * a})`; g.fillRect(px, py + P.T - 2, P.T, 2);
        }
      } else if (c === '~') {
        const age = s.crumb.get(id);
        const gone = age != null && age >= P.CRUMBLE_SHAKE && age < P.CRUMBLE_SHAKE + P.CRUMBLE_GONE;
        if (gone) {
          g.fillStyle = 'rgba(70,66,56,.16)';                   // the ghost of where it was
          g.fillRect(px + 2, py + 2, P.T - 4, 3);
        } else {
          const L = FIELD.shadeAt(px + 12, py + 8);
          const sh = (age != null && age < P.CRUMBLE_SHAKE) ? Math.sin(t * 1.4) * (1 + age * 0.14) : 0;
          g.save(); g.translate(sh, 0);
          g.fillStyle = '#453f34'; g.fillRect(px, py, P.T, P.T * 0.62);
          if (L.amt > 0.02) {
            g.fillStyle = `rgba(255,214,164,${Math.min(0.5, L.amt * 0.8) * 0.4})`;
            g.fillRect(px, py, P.T, P.T * 0.62);
            g.fillStyle = `rgba(255,232,190,${Math.min(0.6, L.amt) * 0.5})`; g.fillRect(px, py, P.T, 3);
          }
          g.fillStyle = 'rgba(0,0,0,.35)';
          g.fillRect(px + 3, py + 6, 4, 2); g.fillRect(px + 11, py + 9, 6, 2); g.fillRect(px + 6, py + 12, 5, 2);
          g.restore();
          if (age != null && age < P.CRUMBLE_SHAKE && (t >> 2) % 2 === 0) {
            G.vfx.spawn('ash', px + 4 + Math.random() * 16, py + P.T * 0.6, {
              vx: (Math.random() - 0.5) * 0.4, vy: 0.4 + Math.random(), size: 1.2, life: 34, drag: 0.99 });
          }
        }
      } else if (c === 'x') {
        // an old burn. Not his. The keep was already like this.
        g.fillStyle = 'rgba(18,13,11,.62)';
        g.beginPath(); g.ellipse(px + 12, py + 19, 11, 4.5, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(26,19,16,.42)';
        g.beginPath(); g.ellipse(px + 7, py + 15, 5, 3.5, 0.3, 0, 7); g.fill();
        g.beginPath(); g.ellipse(px + 17, py + 13, 4, 2.6, -0.4, 0, 7); g.fill();
      } else if (c === 'k') {
        // A cold hearth. Same bowl as the exit brazier, and it does nothing at all.
        const L = FIELD.shadeAt(px + 12, py + 14);
        g.fillStyle = '#39342c'; g.fillRect(px + 3, py + 11, 18, 13);
        g.fillStyle = '#453f34'; g.fillRect(px + 2, py + 9, 20, 3);
        if (L.amt > 0.02) {
          g.fillStyle = `rgba(255,224,180,${Math.min(0.5, L.amt) * 0.45})`;
          g.fillRect(px + 2, py + 9, 20, 3);
        }
        g.fillStyle = 'rgba(20,16,14,.9)'; g.fillRect(px + 6, py + 12, 12, 4);
        g.fillStyle = 'rgba(150,146,134,.10)';                 // one thread of cold ash
        for (let k = 0; k < 3; k++) {
          const yy = py + 8 - ((t * 0.25 + k * 7) % 14);
          g.fillRect(px + 10 + Math.sin((t + k * 30) * 0.02) * 2, yy, 1.2, 3);
        }
      } else if (c === 'y') {
        // tally marks. Someone was in here long enough to keep score.
        const L = FIELD.shadeAt(px + 12, py + 12);
        g.strokeStyle = `rgba(196,186,164,${0.20 + L.amt * 0.5})`; g.lineWidth = 1.1;
        for (let k = 0; k < 5; k++) {
          g.beginPath(); g.moveTo(px + 4 + k * 3.4, py + 6); g.lineTo(px + 4 + k * 3.4, py + 17); g.stroke();
        }
        g.beginPath(); g.moveTo(px + 2, py + 16); g.lineTo(px + 20, py + 6); g.stroke();
        g.lineWidth = 1;
      } else if (c === 'v') {
        // a cold column. Drawn as faint falling streaks so you can read it before you fall in.
        for (let k = 0; k < 3; k++) {
          const yy = py + ((t * 2.4 + k * 9 + x * 7) % P.T);
          g.fillStyle = 'rgba(150,178,206,.10)';
          g.fillRect(px + 4 + k * 6, yy, 1.4, 7);
        }
        g.fillStyle = 'rgba(120,150,190,.045)'; g.fillRect(px, py, P.T, P.T);
      } else if (P.FLAMMABLE.has(c)) {
        drawFlammable(c, px, py, id, s, t);
      } else if (c === 'o' && !s.taken.has(id)) {
        const bob = Math.sin(t * 0.055 + x) * 2.2;
        gg.globalCompositeOperation = 'lighter';
        blit(gg, GLOW.warm, px + 12, py + 12 + bob, 15, 0.95);
        gg.globalCompositeOperation = 'source-over';
      } else if (c === '*' && !s.shards.has(id)) {
        const bob = Math.sin(t * 0.07 + x * 0.9) * 2;
        gg.globalCompositeOperation = 'lighter';
        blit(gg, GLOW.shard, px + 12, py + 12 + bob, 12, 0.95);
        gg.globalCompositeOperation = 'source-over';
        g.fillStyle = 'rgba(226,240,255,.9)';
        g.save(); g.translate(px + 12, py + 12 + bob); g.rotate(t * 0.02);
        g.beginPath(); g.moveTo(0, -4.5); g.lineTo(3.2, 0); g.lineTo(0, 4.5); g.lineTo(-3.2, 0);
        g.closePath(); g.fill(); g.restore();
      } else if (c === '?' && !s.caches.has(id)) {
        // HIDDEN. It renders only once Ember is close enough to have found it by looking.
        const d = Math.hypot(px + 12 - wx, py + 12 - wy);
        if (d < 58) {
          const a = 1 - d / 58;
          gg.globalCompositeOperation = 'lighter';
          blit(gg, GLOW.warm, px + 12, py + 12, 18 * a + 5, 0.9 * a);
          gg.globalCompositeOperation = 'source-over';
        }
      } else if (c === 'X') {
        g.fillStyle = '#413b31'; g.fillRect(px + 2, py + 9, 16, 11);
        g.fillStyle = '#4d4638'; g.fillRect(px + 1, py + 8, 18, 3);
        const near = Math.hypot(px + 12 - wx, py + 12 - wy) < 110;
        gg.globalCompositeOperation = 'lighter';
        blit(gg, near ? GLOW.hot : GLOW.cold, px + 12, py + 4, near ? 28 : 19, 0.9);
        gg.globalCompositeOperation = 'source-over';
      }
    }
  }

  // ---- 2b. furniture, sitting on the floor at the same depth as the geometry
  SCN.drawMid(g, r, FIELD, t);

  // ---- 3. scorch   4. smoke + ash
  G.vfx.drawScorch(g, t);
  G.vfx.drawSmoke(g);

  // ---- 5. creatures
  G.cre.draw(g, s, t);

  // ---- 5c. the ghost of your best run, behind him and unlit
  if (G.ghost && !G.ghost.done) {
    const q = G.ghost.s;
    const qx = q.x + P.EW / 2;
    g.save(); g.globalAlpha = 0.34;
    g.fillStyle = 'rgba(150,170,200,.55)';
    g.beginPath(); g.ellipse(qx, q.y + 6, 6, 9, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(qx, q.y - 8, 7, 8, 0, 0, 7); g.fill();
    blit(g, GLOW.cold, qx, q.y - 22, 17, 0.45);
    g.restore();
  }

  // ---- 6b. foreground scenery: chains, cobwebs, drips and the sconces themselves. Drawn AFTER
  // Ember so some of it passes in front of him — the cheapest depth cue there is, and the game
  // had none of it.
  SCN.drawFront(g, gg, r, FIELD, t);

  // ---- 7a. shots, in world space with the rest of the emissive content
  gg.globalCompositeOperation = 'lighter';
  for (const p of s.shots) {
    // a tapered trail sampled from the shot's own recent positions, then a hot head. Two stray
    // particles a frame never read as a projectile; this does.
    if (p.trail) {
      for (let k = 0; k < p.trail.length; k += 2) {
        const u = k / Math.max(2, p.trail.length - 2);
        blit(gg, GLOW.spark, p.trail[k], p.trail[k + 1], 3 + 7 * u, 0.10 + 0.35 * u);
      }
    }
    blit(gg, GLOW.spark, p.x, p.y, 15, 1);
    blit(gg, GLOW.warm, p.x, p.y, 7, 0.9);
  }
  blit(gg, GLOW.ember, wx, s.y - 14, 46 * fgain, 0.50);
  gg.globalCompositeOperation = 'source-over';
  G.vfx.drawGlow(gg, t);

  g.restore();
  gg.restore();
  // ================= /WORLD SPACE =================

  // ---- 5b. DEPTH OF FIELD, screen space. Everything painted so far is scene; blur a copy and
  // paint it back through a mask that is clear where Ember stands.
  if (G.quality >= 2) {
    ds.clearRect(0, 0, VW / 4, VH / 4);
    ds.drawImage(cv, 0, 0, VW / 4, VH / 4);       // the downsample IS the blur; no ctx.filter
    dm.clearRect(0, 0, VW, VH);
    dm.drawImage(dofSmall, 0, 0, VW, VH);
    dm.globalCompositeOperation = 'destination-out';
    dm.drawImage(DOFMASK, cx - rad * 1.30, cy - rad * 1.30, rad * 2.60, rad * 2.60);
    dm.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.85; g.drawImage(dofMask, 0, 0, VW, VH); g.globalAlpha = 1;
  }

  // ---- 8. THE LIGHT. Multiply the scene by the field. This replaced the single baked darkness
  // sprite of v2.1.2: everything above this line is unlit surface colour, everything below it is
  // emissive and must not be darkened by it.
  FIELD.apply(g, VW, VH);

  // ---- 6. EMBER, drawn AFTER the light pass, deliberately.
  // He is the light SOURCE, not a lit object. Drawn inside the world block he was multiplied and
  // then additively lifted by his own field at its brightest point, and blew out to a white smear
  // with the silhouette — the thing the whole character design rests on — completely gone. The
  // only light that touches him is the rim and head highlight his own rig draws, which is why
  // those exist. The rig is advanced in simulate(), not here.
  gg.save(); gg.translate(-camx, -camy);
  G.rig.drawMane(gg, wx, s.y, s);
  gg.restore();

  // ---- 7b. glow buffer + bloom, additive, on top of the lit scene
  g.globalCompositeOperation = 'lighter';
  g.drawImage(glow, 0, 0);
  bg.clearRect(0, 0, VW / 4, VH / 4);
  bg.drawImage(glow, 0, 0, VW / 4, VH / 4);
  bg.drawImage(bloom, 1, 1, VW / 4 - 2, VH / 4 - 2);   // a second pass smears it; still no filter
  g.globalAlpha = 0.66; g.drawImage(bloom, 0, 0, VW, VH);
  if (G.quality >= 1) { g.globalAlpha = 0.22; g.drawImage(bloom, -18, -18, VW + 36, VH + 36); }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // ---- 6b. Ember's BODY, on top of his own bloom. See the note on the split in ember.js.
  g.save(); g.translate(-camx, -camy);
  G.rig.drawBody(g, wx, s.y, s, FIELD.shadeAt(wx, s.y - 4));
  g.restore();

  // ---- 8b. the FOREGROUND plane, in front of everything including the bloom, because a thing
  // that light shines through is not in front of anything.
  {
    const F = G.par.fore;
    for (const sh of F.shapes) {
      const px = sh.x - camx * F.depth, py = sh.y - camy * F.depth * 0.4;
      if (px + sh.w < -60 || px - sh.w > VW + 60) continue;
      // YIELD NEAR EMBER. Games that put things in front of the player fade them when the player
      // is behind them; one that does not has traded readability for depth, which is not a trade
      // worth making in a game about being able to see.
      const d = Math.hypot(px - cx, py - cy) / (sh.w * 0.5 + 70);
      const a = Math.max(0, Math.min(1, (d - 0.55) / 0.6));
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.fillStyle = F.tint;
      g.beginPath(); g.ellipse(px, py, sh.w / 2, sh.h / 2, 0, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
  }

  // ---- 9. dust, warm bounce, grain, vignette
  G.vfx.drawDust(g, cx, cy, rad, t);

  g.globalCompositeOperation = 'lighter';
  blit(g, GLOW.ember, cx, cy, rad * fgain, 0.13);
  g.globalCompositeOperation = 'source-over';

  G.grainT++;
  if (!REDUCED && G.grainT % 10 === 0) G.grainX = (G.grainX + 1) & 3;
  g.globalAlpha = REDUCED ? 0.035 : 0.058;
  g.drawImage(GRAIN[G.grainX], 0, 0);
  g.globalAlpha = 1;

  g.drawImage(VIGNETTE, 0, 0, VW, VH);      // static: baked once, not rebuilt every frame

  if (G.phase === 'cleared' && G.room.final) {
    const total = G.mem.burned;
    panel(total === 0 ? 'You never once had to.' : 'He got out.',
      total === 0 ? 'Not one thing burned. Enter to begin again.'
                  : `${total} burned along the way. Enter to begin again.`);
  } else if (G.phase === 'cleared') {
    panel(s.burnCount === 0 ? 'Nothing lost.' : `You burned ${s.burnCount}.`,
      G.idx + 1 < ROOMS.length ? 'Enter to go on' : 'Enter for the last of it');
    const L = G.lastScore;
    if (L) {
      const rows = [
        ['reached the brazier', L.base],
        ['burned nothing', L.clean],
        ['never fired a spark', L.quiet],
        ['never startled', L.whole],
        ['what you found', L.finds],
        ['scorch', -L.penalty],
      ].filter(r => r[1]);
      g.textAlign = 'left';
      g.font = '400 13px ui-sans-serif, system-ui, sans-serif';
      let yy = VH / 2 + 24;
      for (const [label, v] of rows) {
        g.fillStyle = v < 0 ? '#a8695a' : '#9a9182';
        g.fillText(label, VW / 2 - 130, yy);
        g.textAlign = 'right';
        g.fillStyle = v < 0 ? '#c2806e' : '#e2d6bf';
        g.fillText((v > 0 ? '+' : '') + v, VW / 2 + 130, yy);
        g.textAlign = 'left';
        yy += 19;
      }
    }
  }
  if (G.phase === 'done') {
    const total = G.tally.reduce((a, b) => a + (b || 0), 0);
    const clean = G.tally.filter(v => v === 0).length;
    panel(total === 0 ? 'You never once had to.' : `${total} burned. ${clean} rooms clean.`, 'Enter to begin again');
  }

  // ---- portrait, on its own canvas in the rail. Redrawn at 20 fps: it is a HUD element whose
  // expression changes on a 12 fps rig anyway, so painting it 60 times a second bought nothing.
  if (pg && (G.grainT % 3 === 0 || G.portraitDirty)) {
    G.portraitDirty = false;
    pg.clearRect(0, 0, PW, PH);
    pgg.clearRect(0, 0, PW, PH);
    drawPortrait(pg, pgg, PW / 2, PH - 14, G.rig.expr, G.rig.blend, t, 1.0);
    pg.globalCompositeOperation = 'lighter';
    pg.drawImage(pglow, 0, 0);
    pg.globalCompositeOperation = 'source-over';
    if (G.moodEl && G.moodEl.textContent !== G.rig.expr) G.moodEl.textContent = G.rig.expr;
    if (G.logEl && G.logN !== G.com.log.length) {
      G.logN = G.com.log.length;
      G.logEl.innerHTML = '';
      for (const l of G.com.log.slice(-14)) {
        const d = document.createElement('p');
        d.textContent = l;
        G.logEl.appendChild(d);
      }
      G.logEl.scrollTop = G.logEl.scrollHeight;
    }
  }

  // ---- speech bubble, anchored to Ember
  const line = G.com.visible(s.t);
  if (line) {
    const age = s.t - G.com.lineAt;
    const a = Math.min(1, age / 8) * Math.min(1, (260 - age) / 40);
    // his real footprint: body plus the whole mane, so the bubble can steer around all of it
    // SCREEN space: the bubble is HUD, and s.y is a world coordinate. Left unconverted this is
    // the exact class of bug the camera introduces — a speech bubble drifting off the top of the
    // viewport in a tall room while looking perfectly correct in a short one.
    const by = s.y - camy;
    const emberBox = { x0: cx - 20, x1: cx + 20, y0: by - 96, y1: by + P.EH + 4 };
    drawBubble(g, cx, by - 30, line, Math.max(0, a), VW, VH, emberBox);
  }
  if (G.toast) drawToast(g, G.toast.name, G.toast.hint, Math.min(1, G.toastT / 40), VW);

  // a found wick announces itself properly — this is the moment the game opens up
  if (G.newWickT > 0) {
    G.newWickT--;
    const a = Math.min(1, G.newWickT / 60);
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(10,9,9,.80)'; g.fillRect(0, VH / 2 - 52, VW, 104);
    g.textAlign = 'center';
    const c = G.newWick.tint;
    g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    g.font = '600 30px ui-serif, Georgia, serif';
    g.fillText(G.newWick.name, VW / 2, VH / 2 - 6);
    g.fillStyle = '#a99f8f'; g.font = '400 14px ui-sans-serif, system-ui, sans-serif';
    g.fillText(G.newWick.blurb, VW / 2, VH / 2 + 20);
    g.fillStyle = '#6d6558'; g.font = '400 12px ui-sans-serif, system-ui, sans-serif';
    g.fillText('Q to change wick', VW / 2, VH / 2 + 42);
    g.textAlign = 'left'; g.restore();
  }

  // ---- going out
  if (s.outT > 0 && G.phase === 'play') {
    const k = s.outT / P.OUT_GRACE;
    g.fillStyle = `rgba(8,7,9,${0.45 * k})`; g.fillRect(0, 0, VW, VH);
    g.textAlign = 'center';
    g.fillStyle = `rgba(233,224,210,${0.35 + 0.5 * k})`;
    g.font = '400 13px ui-sans-serif, system-ui, sans-serif';
    g.fillText('going out', VW / 2, 34);
    g.textAlign = 'left';
  }
  if (G.phase === 'out') {
    g.fillStyle = `rgba(6,6,8,${Math.min(1, G.outFade)})`; g.fillRect(0, 0, VW, VH);
    if (G.outFade > 0.55) {
      g.textAlign = 'center';
      g.fillStyle = `rgba(226,214,196,${Math.min(1, (G.outFade - 0.55) * 2.4)})`;
      g.font = '600 24px ui-serif, Georgia, serif';
      g.fillText('He went out.', VW / 2, VH / 2 - 44);
      g.fillStyle = `rgba(150,140,126,${Math.min(1, (G.outFade - 0.75) * 2.4)})`;
      g.font = '400 13px ui-sans-serif, system-ui, sans-serif';
      g.fillText('Nothing is lost but the room. Beginning again\u2026', VW / 2, VH / 2 - 16);
      g.textAlign = 'left';
    }
  }

  if (G.showGoals) drawGoals();
  if (G.showMap) drawMap();
  if (G.showPerf) {
    // Measured on the player's own machine. My container has no GPU, so my numbers are a floor,
    // not his ceiling — this is how the real one gets known.
    g.fillStyle = 'rgba(8,8,10,.72)'; g.fillRect(VW - 168, VH - 62, 156, 50);
    g.fillStyle = G.fps > 55 ? '#7fd08a' : G.fps > 40 ? '#ffb43d' : '#d0736a';
    g.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText(`${G.fps.toFixed(0)} fps`, VW - 156, VH - 42);
    g.fillStyle = '#8e8474'; g.font = '400 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText(`sim 60Hz fixed · quality ${G.quality}`, VW - 156, VH - 26);
    g.fillText(`particles ${G.vfx.liveCount()}`, VW - 156, VH - 14);
  }

  const el = document.getElementById('say');
  el.textContent = line || '';
  const sh = countIn(r, '*');
  document.getElementById('burn').textContent =
    `${wick(G.wick).name}${G.cinder ? ' \u00b7 CINDERS' : ''}  \u00b7  ${(G.roomT / 60).toFixed(1)}s  \u00b7  ${(G.ach.score || 0).toLocaleString()} pts  \u00b7  ${s.burnCount === 0 ? 'nothing burned' : s.burnCount + ' burned'}  \u00b7  ${s.shards.size}/${sh} shards  \u00b7  ${G.ach.earned.size}/${ACH.ACHIEVEMENTS.length} goals`;
  document.getElementById('fuel').style.width = `${(s.fuel / P.FUEL_MAX) * 100}%`;
}

// Wood and web, drawn by combustion stage. Nothing blinks out of existence any more:
// it catches, it burns, it collapses, and the char stays on the floor for the rest of the room.
function drawFlammable(c, px, py, id, s, t) {
  const stage = P.tileStage(s, id);
  const age = s.burning.get(id) ?? 0;

  if (stage === 'char') {
    g.fillStyle = 'rgba(16,12,10,.92)'; g.fillRect(px + 1, py + 12, P.T - 2, 8);
    g.fillStyle = 'rgba(32,24,20,.85)'; g.fillRect(px + 3, py + 9, P.T - 8, 4);
    gg.globalCompositeOperation = 'lighter';   // embers still alive in the rubble
    gg.fillStyle = `rgba(255,90,20,${0.10 + 0.06 * Math.sin(t * 0.07 + px)})`;
    gg.fillRect(px + 4, py + 16, 4, 2); gg.fillRect(px + 12, py + 17, 3, 2);
    gg.globalCompositeOperation = 'source-over';
    return;
  }

  const burn = stage === 'intact' ? 0 : Math.min(1, age / P.BURN_END);

  if (c === 'W') {
    const b = [90 - 62 * burn, 67 - 46 * burn, 38 - 26 * burn].map(Math.round);
    g.fillStyle = `rgb(${b[0]},${b[1]},${b[2]})`; g.fillRect(px, py, P.T, P.T);
    g.fillStyle = `rgba(0,0,0,${0.22 + 0.30 * burn})`;
    g.fillRect(px, py + 8, P.T, 2); g.fillRect(px, py + 15, P.T, 2);
  } else {
    g.strokeStyle = `rgba(${Math.round(190 - 90 * burn)},${Math.round(186 - 96 * burn)},${Math.round(180 - 100 * burn)},${0.5 - 0.3 * burn})`;
    g.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(px + (i % 2 ? 0 : P.T), py + (i < 2 ? 0 : P.T));
      g.lineTo(px + (i % 2 ? P.T : 0), py + (i < 2 ? P.T : 0));
      g.stroke();
    }
    g.beginPath(); g.arc(px + 10, py + 10, 6.5, 0, 7); g.stroke();
    g.beginPath(); g.arc(px + 10, py + 10, 3.2, 0, 7); g.stroke();
  }

  if (stage !== 'intact') {
    gg.globalCompositeOperation = 'lighter';
    const k = stage === 'catching' ? age / P.IG_END : 1;
    blit(gg, GLOW.hot, px + 12, py + 12, 16 + 9 * k, 0.55 * k);
    gg.globalCompositeOperation = 'source-over';
  }
}

// Tab: the goals list. Earned entries show their name; unearned show only the hint, so the
// list reads as a set of things to try rather than a set of spoilers.
function drawGoals() {
  g.fillStyle = 'rgba(9,8,8,.972)'; g.fillRect(0, 0, VW, VH);
  g.textAlign = 'left';
  g.fillStyle = '#e9e0d2'; g.font = '600 20px ui-serif, Georgia, serif';
  g.fillText('Goals', 40, 52);
  g.fillStyle = '#8e8474'; g.font = '400 12px ui-sans-serif, system-ui, sans-serif';
  g.fillText(`${G.ach.earned.size} of ${ACH.ACHIEVEMENTS.length}  ·  ${(G.ach.score || 0).toLocaleString()} points  ·  ${G.wicks.length}/4 wicks`, 40, 72);

  // Two measured columns plus a record column. Widths are fixed and every label is TRUNCATED to
  // fit — an unmeasured label is how the last pass ran three strings through each other.
  const COL_W = 300, COL_X = [40, 356], REC_X = 690;
  const fit = (txt, w) => {
    if (g.measureText(txt).width <= w) return txt;
    let t = txt;
    while (t.length > 4 && g.measureText(t + '\u2026').width > w) t = t.slice(0, -1);
    return t + '\u2026';
  };
  const perCol = Math.ceil(ACH.ACHIEVEMENTS.length / 2);
  ACH.ACHIEVEMENTS.forEach((a, i) => {
    const col = i < perCol ? 0 : 1, row = i % perCol;
    const x = COL_X[col], y = 112 + row * 25;
    const got = G.ach.earned.has(a.id);
    blit(g, got ? GLOW.warm : GLOW.cold, x + 9, y - 4, 9, got ? 0.95 : 0.18);
    g.fillStyle = got ? '#f0e4cd' : '#6d6558';
    g.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    g.fillText(fit(got ? a.name : a.hint, COL_W - 30), x + 26, y);
  });
  // the thread: what the keep remembers, assembled one relic at a time
  if (G.record.length) {
    g.fillStyle = '#8e8474'; g.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    g.fillText('THE RECORD', REC_X, 112);
    g.font = 'italic 400 11.5px ui-serif, Georgia, serif';
    G.record.slice(-12).forEach((line, i, arr) => {
      g.fillStyle = i === arr.length - 1 ? '#d8cdb9' : '#6f665a';
      g.fillText(fit(line, VW - REC_X - 40), REC_X, 136 + i * 18);
    });
  }
  g.fillStyle = '#6d6558'; g.font = '400 11px ui-sans-serif, system-ui, sans-serif';
  g.fillText('Tab to close', 40, VH - 16);
}

// L: the keep. Every room you have finished, with your best and whether you did it clean.
// Clearing a room used to be terminal; this is the reason to walk back into one.
function drawMap() {
  g.fillStyle = 'rgba(9,8,8,.972)'; g.fillRect(0, 0, VW, VH);
  g.textAlign = 'left';
  g.fillStyle = '#e9e0d2'; g.font = '600 20px ui-serif, Georgia, serif';
  g.fillText('The Keep', 46, 52);
  g.fillStyle = '#8e8474'; g.font = '400 12px ui-sans-serif, system-ui, sans-serif';
  g.fillText('Number to re-enter a room  ·  shift+number for Cinders  ·  Q swaps wick  ·  G toggles ghost  ·  L closes', 46, 72);

  ROOMS.forEach((r, i) => {
    const col = i < 6 ? 0 : 1, row = i % 6;
    const x = 46 + col * ((VW - 92) / 2), y = 112 + row * 52;
    const b = G.best[i];
    const open = i === 0 || !!G.best[i - 1] || !!b;
    const key = r.final ? '0' : String(i + 1);
    g.fillStyle = open ? '#e2d6bf' : '#4b443c';
    g.font = '600 14px ui-sans-serif, system-ui, sans-serif';
    g.fillText(`${key}.  ${open ? r.name : '— — —'}`, x, y);
    if (b) {
      // Three marks, not a number. A four-digit score does not tell you what is LEFT in a room;
      // reached / clean / complete does, at a glance, which is the whole job of this screen.
      const medals = [
        ['reached', true],
        ['burned nothing', b.clean],
        ['found everything', b.full],
      ];
      let mx = x + 18;
      g.font = '400 11px ui-sans-serif, system-ui, sans-serif';
      for (const [label, got] of medals) {
        g.fillStyle = got ? '#ffb43d' : '#3f3931';
        g.beginPath(); g.arc(mx + 4, y + 13, 4, 0, 7); g.fill();
        g.fillStyle = got ? '#9a9182' : '#4b443c';
        g.fillText(label, mx + 12, y + 17);
        mx += g.measureText(label).width + 26;
      }
      if (b.time) {
        g.fillStyle = '#6d6558';
        g.fillText(`${(b.time / 60).toFixed(1)}s`, x + 18, y + 32);
      }
      if (b.clean) {
        g.fillStyle = '#8a7fd0';
        g.fillText('shift+' + key + ' \u2192 cinders', x + 70, y + 32);
      }
    } else if (open) {
      g.fillStyle = '#6d6558'; g.font = '400 11.5px ui-sans-serif, system-ui, sans-serif';
      g.fillText('not finished', x + 18, y + 17);
    }
  });
}

function panel(a, b) {
  g.fillStyle = 'rgba(10,9,9,.74)'; g.fillRect(0, 0, VW, VH);
  g.textAlign = 'center';
  g.fillStyle = '#e9e0d2'; g.font = '600 26px ui-serif, Georgia, serif'; g.fillText(a, VW / 2, VH / 2 - 44);
  g.fillStyle = '#9a9182'; g.font = '400 14px ui-sans-serif, system-ui, sans-serif'; g.fillText(b, VW / 2, VH / 2 - 8);
  g.textAlign = 'left';
}

buildSprites();

(async () => {
  const base = ACH.emptyTally(ROOMS.length, ACH.countTiles(ROOMS, '*'), ACH.countTiles(ROOMS, '?'));
  G.ach = ACH.deserialize(await store.get('ach', null), base);
  G.ach.roomCount = base.roomCount; G.ach.shardsTotal = base.shardsTotal; G.ach.cachesTotal = base.cachesTotal;
  const p = await store.get('progress', null);
  if (p && p.idx > 0 && p.idx < ROOMS.length) { G.tally = p.tally || []; load(p.idx); }
  else load(0);
  G.moodEl = document.getElementById('mood');
  G.logEl = document.getElementById('log');
  G.best = await store.get('best', {});
  G.wicks = await store.get('wicks', ['ember']);
  G.wick = await store.get('wick', 'ember');
  if (!G.wicks.includes(G.wick)) G.wick = 'ember';
  G.ghostOn = await store.get('ghostOn', true);
  G.record = await store.get('record', []);
  G.ach.wicksFound = G.wicks.length;
  G.ach.recordLines = G.record.length;
  G.aud.muted = await store.get('muted', false);
  fitToScreen();
  requestAnimationFrame(frame);
})();
