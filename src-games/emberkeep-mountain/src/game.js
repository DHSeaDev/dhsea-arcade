// Emberkeep - Mountain — the shell: loop, camera, input, animation.
//
// The MODEL is always at a settled lattice position. Rotation animation is a DRAWING transform
// applied on the way from where a group was to where it already is — never a state the world is
// actually in. That ordering is what preserves every guarantee in lattice.js: exact adjacency,
// cycle-free painter order, integer everything. A world that spends 250ms at 47 degrees has none
// of those properties, and every one of them is load-bearing.

import { LEVELS } from './levels.js';
import { Level } from './level.js';
import { Ember } from './ember.js';
import { Music, ROOM_MOOD } from './music.js';
import { project, topFaceHit, depthOf, DIRS } from './iso.js';
import { drawCube, drawHandle, setFog, fogAt } from './paint.js';
import { Wind, Weather, Ambient, fbm } from './atmos.js';
import { drawMarks, drawWear } from './story.js';
import { rot90 } from './lattice.js';
import { Progress, stars, WISPS, lightRadius, BASE_LIGHT } from './collect.js';

const cv = document.getElementById('cv');
const g = cv.getContext('2d');
const VW = 1100, VH = 760;
cv.width = VW; cv.height = VH;

// A SILENT `catch {}` HERE MEANS PROGRESS STOPS BEING SAVED AND NOBODY IS TOLD. Storage can fail
// for reasons the player can act on (a full profile, a locked extension directory), so the first
// failure says so once — once, because saving happens after every step and a repeating complaint
// about it would be worse than the fault.
let storageWarned = false;
function storageFailed(e) {
  console.warn('Emberkeep: progress could not be saved.', e);
  if (storageWarned) return;
  storageWarned = true;
  try { say('The mountain is not remembering this. Your progress may not be kept.'); } catch {}
}
const store = {
  async get(k, d) { try { const r = await chrome.storage.local.get(k); return r[k] ?? d; } catch (e) { storageFailed(e); return d; } },
  async set(k, v) { try { await chrome.storage.local.set({ [k]: v }); } catch (e) { storageFailed(e); } },
};

const G = {
  idx: 0, L: null, cam: { x: 0, y: 0 }, zoom: 1, t: 0,
  ember: new Ember(),
  walk: null,               // {path, i, u}
  spin: null,               // {group, sign, t0, ms} — drawing only
  hot: null,                // handle under the pointer
  say: '', sayT: 0, sayQueue: [],
  music: null, muted: false, started: false,
  done: {}, showMenu: false, showSky: false, winT: 0, prog: new Progress(), toast: null, toastT: 0,
  timers: new Set(),
  wind: null, weather: null, amb: null, fogRange: { dmin: 0, dmax: 1 },
  fps: 60,
};

// ---------- camera: fit the whole level, always.
// Monument Valley's rule is that everything needed to solve a puzzle is on one screen. That is a
// hard constraint on the camera, not a hope: the view is FITTED to the level's bounding box every
// time one loads, so there is never anything to scroll to and never a reason to look away.
function frameLevel() {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [, c] of G.L.world.cells) {
    for (const [dx, dy, dz] of [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]]) {
      const p = project(c.x + dx, c.y + dy, c.z + dz);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
  }
  const pad = 130;                       // room for Ember's flame and for the level to breathe
  G.zoom = Math.min(2.6, Math.max(0.55,
    Math.min((VW - pad) / Math.max(1, x1 - x0), (VH - pad) / Math.max(1, y1 - y0))));
  G.cam.x = VW / 2 / G.zoom - (x0 + x1) / 2;
  G.cam.y = VH / 2 / G.zoom - (y0 + y1) / 2;
}

// A SKY, AND AN ARC.
// Sky: Children of the Light gives every realm its own palette and runs an emotional arc across
// them — dawn gold, open blue, melancholy grey-green, ash orange, cold violet, and finally a
// monochrome storm before the white of the ending. The palette is doing narrative work that no
// text in that game ever does. Ten chapters here get the same treatment: a two-stop gradient and a
// horizon glow, arranged so the mountain gets colder and higher until the last two turn warm again.
// It costs one gradient per frame and it is the single cheapest thing on this list.
// PER-CHAPTER ATMOSPHERE. Sky authors time-of-day per REALM rather than running a global clock,
// on the reasoning that mood beats simulation — each realm is locked at the one hour that says
// what that realm is about. Same here: ten chapters, ten fixed hours, one arc.
//
// `fog` is the colour of the AIR and it is deliberately close to the sky's lower stop. Air a
// different colour from the sky above it is the commonest way faked depth reads as cellophane.
// `land` is the single distant landmark — Journey's mountain, one per chapter, never two, because
// two landmarks compete and neither orients.
const CHAPTER_SKY = [
  { a: '#3b2a44', b: '#170f1e', glow: '#ffcf9a', fog: '#2a1e30', w: 'none',   land: 0.30, name: 'first light' },
  { a: '#2e3548', b: '#11141e', glow: '#cfd9ff', fog: '#212636', w: 'none',  land: 0.42, name: 'morning'     },
  { a: '#24404a', b: '#0d151a', glow: '#9fe0d8', fog: '#1a2e35', w: 'rain',  land: 0.36, name: 'clear'       },
  { a: '#303658', b: '#101223', glow: '#b9c4ff', fog: '#232742', w: 'snow',  land: 0.52, name: 'height'      },
  { a: '#40323f', b: '#171018', glow: '#e0b2a0', fog: '#2e242d', w: 'none',  land: 0.34, name: 'the birds'   },
  { a: '#1f2c42', b: '#0a0f19', glow: '#9fb8ff', fog: '#17202f', w: 'snow',  land: 0.46, name: 'quiet'       },
  { a: '#141322', b: '#07070d', glow: '#ffb15e', fog: '#101018', w: 'ash',   land: 0.22, name: 'the dark'    },
  { a: '#2c2646', b: '#0f0c1c', glow: '#c9a6ff', fog: '#201b33', w: 'spores', land: 0.40, name: 'the fold'    },
  { a: '#3a3350', b: '#131020', glow: '#d9c0ff', fog: '#2a2440', w: 'sand',  land: 0.44, name: 'the two'     },
  { a: '#523446', b: '#1c111a', glow: '#ffd9a0', fog: '#3a2434', w: 'spores', land: 0.62, name: 'the summit'  },
];

// THE DISTANT LANDMARK. One flat silhouette on the horizon, drawn behind everything, moving barely
// at all. Journey's mountain is the archetype: a single unreachable shape, visible from nearly
// everywhere, that orients, motivates and measures progress at once. Its outline is fbm-driven so
// each chapter gets its own ridge without a single byte of authored data.
function drawLandmark(i) {
  const c = CHAPTER_SKY[i % CHAPTER_SKY.length];
  const baseY = VH * (1.02 - c.land * 0.55);
  const peak = VH * c.land * 0.62;
  g.beginPath();
  g.moveTo(-20, VH + 10);
  for (let x = -20; x <= VW + 20; x += 14) {
    const u = x / VW;
    // one broad silhouette plus fbm roughness. The broad shape is what reads at a glance; the
    // roughness only has to survive being looked at for a second longer.
    const hump = Math.exp(-Math.pow((u - 0.62) * 2.6, 2)) * peak
               + Math.exp(-Math.pow((u - 0.22) * 4.4, 2)) * peak * 0.42;
    const rough = fbm(u * 3.1 + i * 7.3, i * 2.7, 4) * peak * 0.55;
    g.lineTo(x, baseY - hump - rough);
  }
  g.lineTo(VW + 20, VH + 10);
  g.closePath();
  // Barely darker than the sky behind it. A landmark that is high-contrast stops being distant.
  g.fillStyle = hexA(c.b, 0.85);
  g.fill();
  // a second, nearer ridge, lighter — stacked coloured bands are how Firewatch built depth
  g.beginPath();
  g.moveTo(-20, VH + 10);
  for (let x = -20; x <= VW + 20; x += 18) {
    const u = x / VW;
    const hump = Math.exp(-Math.pow((u - 0.30) * 3.0, 2)) * peak * 0.55;
    const rough = fbm(u * 4.7 + i * 3.1 + 40, i * 1.9, 3) * peak * 0.34;
    g.lineTo(x, baseY + peak * 0.24 - hump - rough);
  }
  g.lineTo(VW + 20, VH + 10);
  g.closePath();
  g.fillStyle = hexA(c.b, 0.55);
  g.fill();
}

// FOREGROUND FRAMING. A dark near-silhouette at the frame edge does two jobs at once: it forces a
// value jump between near-black foreground and pale distance, which is itself a depth cue, and it
// makes the vista feel LOOKED OUT UPON rather than merely present. It is also the one composition
// device a fixed-camera game can rely on completely — the Level Design Book calls leading lines
// "brain poison" in free-camera 3D because players look wherever they like, and that objection
// simply does not bind a game whose camera never moves.
function drawFraming(i) {
  const c = CHAPTER_SKY[i % CHAPTER_SKY.length];
  g.fillStyle = hexA(c.b, 0.72);
  // lower-left mass
  g.beginPath();
  g.moveTo(-10, VH + 10);
  g.lineTo(-10, VH * 0.70);
  for (let x = -10; x <= VW * 0.30; x += 16) {
    g.lineTo(x, VH * 0.70 + fbm(x * 0.006 + i, 11 + i, 3) * VH * 0.5 + VH * 0.12);
  }
  g.lineTo(VW * 0.30, VH + 10);
  g.closePath(); g.fill();
  // upper-right overhang
  g.beginPath();
  g.moveTo(VW + 10, -10);
  g.lineTo(VW * 0.74, -10);
  for (let x = VW * 0.74; x <= VW + 10; x += 16) {
    g.lineTo(x, fbm(x * 0.005 + i * 3, 23 + i, 3) * VH * 0.42 + VH * 0.10);
  }
  g.lineTo(VW + 10, -10);
  g.closePath(); g.fill();
}

function drawSky(i) {
  const c = CHAPTER_SKY[i % CHAPTER_SKY.length];
  const gr = g.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, c.a); gr.addColorStop(1, c.b);
  g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
}

// FOG AS GUIDANCE, not as weather.
// Sky has no HUD, no map and no waypoints; it steers you with a distant landmark, with light-
// coloured moving things, and with fog that occludes the wrong direction and clears toward the
// right one. "The best design is a nudge, rather than a leash" — Chen. An isometric single-screen
// game cannot do the distant-landmark trick, so the substitute is this: a warm bloom centred on
// the beacon, and a cool veil that deepens with distance from it. Nothing is labelled, nothing is
// arrowed, and you always know which way is on.
function drawBeaconGlow(i, sp, lit) {
  const c = CHAPTER_SKY[i % CHAPTER_SKY.length];
  const r = g.createRadialGradient(sp.x, sp.y, 8, sp.x, sp.y, VH * (lit ? 0.95 : 0.62));
  r.addColorStop(0, hexA(c.glow, lit ? 0.20 : 0.11));
  r.addColorStop(0.45, hexA(c.glow, lit ? 0.055 : 0.030));
  r.addColorStop(1, hexA(c.glow, 0));
  g.fillStyle = r; g.fillRect(0, 0, VW, VH);
}
function drawVeil(sp) {
  const r = g.createRadialGradient(sp.x, sp.y, VH * 0.18, sp.x, sp.y, VH * 1.05);
  r.addColorStop(0, 'rgba(8,8,14,0)');
  r.addColorStop(1, 'rgba(8,8,14,.62)');
  g.fillStyle = r; g.fillRect(0, 0, VW, VH);
}
const hexRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const hexA = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// THE ONE PLACE A CHAPTER INDEX BECOMES A LEVEL, so it is the one place worth validating.
// A stored `at` of 99, -5 or "seven" all reached LEVELS[i] === undefined and threw
// "Cannot read properties of undefined (reading 'cells')" out of the bootstrap, leaving a
// blank page that reloading could not clear because the bad value was in storage.
// Callers (the digit shortcuts, the Esc menu, __mvLoad, the bootstrap) no longer each need to
// get this right; a value that is not a real chapter index means chapter I.
function chapterIndex(i) {
  const n = typeof i === 'number' ? i : parseInt(i, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(LEVELS.length - 1, Math.trunc(n)));
}

function load(i) {
  clearTimers();
  G.idx = chapterIndex(i);
  i = G.idx;
  G.L = new Level(LEVELS[i]);
  G.L.lightR = G.prog.radius;                  // everything he has ever found, brought with him
  G.ember.setGrow(G.prog.moteCount / 30);
  G.walk = null; G.spin = null; G.winT = 0;
  G.sayQueue = [...(LEVELS[i].say || [])];
  G.say = ''; G.sayT = 0;
  frameLevel();
  // The fog range is the level's own depth extent, so every chapter uses its full ramp rather
  // than a global constant that would make small chapters flat and large ones soup.
  let dmin = 1e9, dmax = -1e9;
  for (const [, c] of G.L.world.cells) {
    const d = c.x + c.y + c.z;
    if (d < dmin) dmin = d;
    if (d > dmax) dmax = d;
  }
  const sky = CHAPTER_SKY[i % CHAPTER_SKY.length];
  setFog(hexRgb(sky.fog), dmin, dmax, 0.58);
  G.fogRange = { dmin, dmax };
  G.route = [...G.L.reachableNow()].map(k => {
    const [x, y, z, up] = k.split(',').map(Number);
    return G.L.world.node(x, y, z, up);
  }).filter(n => n && n.up === 4 && n.vis);
  G.wind = new Wind(i * 7919 + 3);
  G.weather = new Weather(sky.w, VW, VH, i * 2654435761 + 11);
  G.amb = new Ambient(VW, VH, i * 40503 + 7);
  // THE WORN PATH is every surface that is walkable from where Ember starts.
  //
  // The first version used the level's SOLUTION path, on the reasoning that wear should mark the
  // route people actually took. It was wrong for exactly the chapters that matter: in any chapter
  // that needs a crank turned first, there IS no path to the beacon at load, so the solution is
  // null and those chapters silently had no wear at all. The gate caught it as "every chapter has
  // a worn route" failing. Reachable ground is both always defined and still true — these are the
  // stones a person could have stood on, and something did.
  document.getElementById('chapter').textContent = `${LEVELS[i].chapter}. ${LEVELS[i].name}`;
  document.getElementById('title').textContent = LEVELS[i].hint;
  document.getElementById('progress').textContent =
    `${G.prog.lit.size} of ${LEVELS.length} lit  ·  ${G.prog.moteCount} motes  ·  ${G.prog.wisps.size} wisps`;
  if (G.music) G.music.setMood(ROOM_MOOD[i % ROOM_MOOD.length], i * 2654435761 + 17);
  nextLine(600);
}
// EVERY DEFERRED LINE IS CANCELLABLE. The spoken lines were plain setTimeouts, so restarting a
// chapter or jumping to another one left the previous chapter's dialogue in flight — it landed
// seconds later over the new one, and its fade-out cleared a line that was still being said.
const after = (fn, ms) => { const id = setTimeout(() => { G.timers.delete(id); fn(); }, ms); G.timers.add(id); return id; };
function clearTimers() { for (const id of G.timers) clearTimeout(id); G.timers.clear(); }

function nextLine(delay = 0) {
  if (!G.sayQueue.length) return;
  after(() => {
    G.say = G.sayQueue.shift();
    G.sayT = 300;
    const el = document.getElementById('say');
    el.textContent = G.say; el.style.opacity = '1';
    after(() => { el.style.opacity = '0'; }, 4200);
  }, delay);
}

// ---------- input
function toWorldPoint(ev) {
  const r = cv.getBoundingClientRect();
  // A canvas that is display:none or not yet laid out measures 0 wide, and VW/0 is Infinity —
  // every downstream hit test then compares against NaN and silently finds nothing.
  if (!r.width || !r.height) return { x: -Infinity, y: -Infinity };
  return { x: (ev.clientX - r.left) * (VW / r.width) / G.zoom - G.cam.x,
           y: (ev.clientY - r.top) * (VH / r.height) / G.zoom - G.cam.y };
}
function handleAt(p) {
  for (const h of G.L.handles) {
    const c = project(h.at.x, h.at.y, h.at.z);
    if (Math.hypot(c.x - p.x, c.y - p.y) < 22 / G.zoom) return h;
  }
  return null;
}
// Pick the frontmost cube whose TOP face contains the point, then the walkable node on it.
// Frontmost, because the frontmost thing at a screen position is the thing the player believes
// they are pointing at — the same rule the adjacency graph uses, applied to the pointer.
function nodeAt(p) {
  const cells = G.L.world.drawOrder();
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (!topFaceHit(p.x, p.y, c.x, c.y, c.z)) continue;
    const n = G.L.world.node(c.x, c.y, c.z, 4);
    if (n && n.vis) return n;
  }
  return null;
}

cv.addEventListener('mousemove', (ev) => {
  if (G.showSky) {
    const r = cv.getBoundingClientRect();
    const sx = (ev.clientX - r.left) * (VW / r.width), sy = (ev.clientY - r.top) * (VH / r.height);
    G.hoverStar = stars(G.prog).filter(s2 => s2.on)
      .find(s2 => Math.hypot(s2.x * VW - sx, s2.y * VH - sy) < 26) || null;
    cv.style.cursor = G.hoverStar ? 'help' : 'default';
    return;
  }
  if (!G.L) return;                    // the bootstrap awaits storage; input can arrive first
  G.hot = handleAt(toWorldPoint(ev));
  cv.style.cursor = G.hot ? 'grab' : 'pointer';
});
cv.addEventListener('click', (ev) => {
  startAudio();
  if (!G.L) return;                    // a click landing before the first chapter is loaded
  if (G.showSky) { G.showSky = false; return; }
  if (G.showMenu) { pickMenu(toWorldPoint(ev)); return; }
  if (G.spin || G.L.won) return;
  const p = toWorldPoint(ev);
  const h = handleAt(p);
  if (h) return turnHandle(h, ev.shiftKey ? -1 : 1);
  const n = nodeAt(p);
  if (!n) return;
  const path = G.L.pathTo(n);
  if (path && path.length) { G.walk = { path, i: 0, u: 0 }; }
  else if (path && !path.length) { /* already there */ }
  else { say('Not from here.'); }
});
cv.addEventListener('contextmenu', (ev) => {
  ev.preventDefault(); startAudio();
  if (!G.L) return;
  const h = handleAt(toWorldPoint(ev));
  if (h && !G.spin) turnHandle(h, -1);
});
addEventListener('keydown', (ev) => {
  startAudio();
  if (!G.L) return;
  if (ev.code === 'KeyR') load(G.idx);
  if (ev.code === 'KeyM') { G.muted = !G.muted; G.music?.setEnabled(!G.muted); store.set('muted', G.muted); }
  if (ev.code === 'Escape') { G.showMenu = !G.showMenu; G.showSky = false; }
  // C FOR CONSTELLATION, and Tab only as a courtesy while focus is still on the page body.
  // Tab used to be swallowed unconditionally, which is a WCAG 2.1.2 keyboard trap the moment
  // anything on the page becomes focusable — a keyboard user who tabs in can never tab out.
  // The sky now has a key of its own; Tab keeps working for players who learned it, but only
  // while there is no focus to move, and it is no longer the documented way in.
  if (ev.code === 'KeyC') { G.showSky = !G.showSky; G.showMenu = false; }
  if (ev.code === 'Tab' && !ev.shiftKey && (document.activeElement === document.body || document.activeElement === cv)) {
    ev.preventDefault(); G.showSky = !G.showSky; G.showMenu = false;
  }
  if (ev.code === 'KeyE') {
    // He can only perform an expression he has been shown. Sky's emotes are taught by the spirits
    // you free, and a vocabulary you had all along is not a vocabulary you earned.
    const known = G.prog.learned().filter(e => !['calm', 'walking'].includes(e));
    if (known.length) {
      G.exprIdx = ((G.exprIdx || 0) + 1) % known.length;
      G.exprHold = { e: known[G.exprIdx], t: 150 };
      G.music?.arpeggio(true);
    } else say('He does not know how to do that yet.');
  }
  if (ev.code === 'Enter' && G.L.won) advance();
  // ONE UNLOCK RULE, not two. The Esc menu opened a chapter whose PREDECESSOR was finished; the
  // digit shortcut required that chapter ITSELF be finished — so the chapter you had just been
  // handed was clickable in the menu and refused by its own number key.
  if (/^Digit[1-9]$/.test(ev.code)) { const n = +ev.code.slice(5) - 1; if (unlocked(n)) { G.showMenu = false; load(n); } }
  if (ev.code === 'Digit0' && unlocked(9)) { G.showMenu = false; load(9); }
  if (ev.code === 'KeyW' && G.L.wick) { G.L.canPlaceWick() ? G.L.placeWick() : G.L.takeWick(); }
});

function say(t) {
  G.say = t;
  const el = document.getElementById('say');
  el.textContent = t; el.style.opacity = '1';
  after(() => { el.style.opacity = '0'; }, 3200);
}

// Any geometry movement CANCELS the walk outright. Every implementation of this genre does the
// same, and it is not laziness: a path planned against geometry that has since moved is a path
// through a world that no longer exists, and re-validating it mid-stride is a whole bug class
// bought for nothing.
function turnHandle(h, sign) {
  const before = G.L.world.groups.get(h.group);
  const angle0 = before?.angle || 0;
  if (!G.L.turn(h.id, sign)) { say('It will not turn that way.'); return; }
  G.walk = null;
  if (h.kind === 'crank') G.spin = { group: h.group, sign, t0: performance.now(), ms: 260, pivot: before.pivot, axis: before.axis };
  G.music?.arpeggio(sign > 0);
}

function advance() {
  G.done[G.idx] = true;
  store.set('done', G.done);
  if (G.idx + 1 < LEVELS.length) load(G.idx + 1);
  else { G.showMenu = true; }
}

// ---------- loop
const STEP_MS = 1000 / 60;
let acc = 0, prevT = performance.now();
function frame(now) {
  const dt = Math.min(250, now - prevT); prevT = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP_MS && steps < 5) { acc -= STEP_MS; steps++; sim(); }
  if (steps === 5) acc = 0;
  G.fps += ((1000 / Math.max(1, dt)) - G.fps) * 0.05;
  render(now);
  requestAnimationFrame(frame);
}

function sim() {
  G.t++;
  const L = G.L;
  const dt = STEP_MS / 1000;
  if (G.wind) G.wind.step(dt);
  if (G.weather) G.weather.step(dt, G.wind);
  if (G.amb) G.amb.step(dt);
  if (G.spin && performance.now() - G.spin.t0 >= G.spin.ms) G.spin = null;
  if (G.walk && !G.spin) {
    G.walk.u += 0.16;
    if (G.walk.u >= 1) {
      G.walk.u = 0;
      const step = G.walk.path[G.walk.i++];
      L.arrive(step.to);
      G.music?.stepNote();
      collect(L);
      if (G.walk.i >= G.walk.path.length) {
        G.walk = null;
        if (L.won && !G.winT) {
          G.winT = 1; G.music?.chime(); nextLine(400);
          G.prog.lit.add(String(G.idx));
          if (L.moteNodes.every(m => G.prog.motes.has(m.id))) G.prog.clean.add(String(G.idx));
          saveProgress();
        }
      }
    }
  }
  if (L.won && G.winT) G.winT++;
  let expr = L.won ? 'pleased' : G.walk ? 'walking' : (G.t % 900 < 60 ? 'wonder' : 'calm');
  if (G.exprHold && G.exprHold.t-- > 0 && G.prog.knows(G.exprHold.e)) expr = G.exprHold.e;
  if (G.toastT > 0) G.toastT--;
  const s = emberScreen();
  G.ember.update(STEP_MS / 1000, s.x, s.y - 22, !!G.walk, expr);
}

// Picking things up is a side effect of walking. There is no collect button, because a button
// would turn "I went and looked over there" into "I performed an inventory action".
function collect(L) {
  const h = L.harvest();
  for (const id of h.motes) {
    G.prog.motes.add(id);
    L.lightR = G.prog.radius;                  // he is brighter from now on, and stays brighter
    G.ember.setGrow(G.prog.moteCount / 30);
    G.music?.arpeggio(true);
    G.exprHold = { e: 'pleased', t: 90 };
    // No count on the reward. Sky's principle is that achievement lives on the avatar and in the
    // sky, never as a number — and a number attached to the moment of finding turns "oh, light"
    // into "9/30". The running total stays in the header, where it is status rather than praise.
    toast('a mote of light');
  }
  if (h.wisp) {
    G.prog.wisps.add(h.wisp.id);
    G.music?.chime();
    G.exprHold = { e: h.wisp.expr, t: 220 };
    say(h.wisp.line);
    toast(`${h.wisp.name}  —  relit`);
  }
  if (h.motes.length || h.wisp) saveProgress();
}
function toast(t) { G.toast = t; G.toastT = 210; }
function saveProgress() { store.set('prog', G.prog.toJSON()); store.set('at', G.idx); }

// Where Ember is on screen: his node's surface centre, lerped toward the next one mid-step.
function emberScreen() {
  const L = G.L;
  const a = L.at ? project(L.at.p.x, L.at.p.y, L.at.p.z) : { x: 0, y: 0 };
  if (!G.walk) return a;
  const nx = G.walk.path[G.walk.i];
  if (!nx) return a;
  const b = project(nx.to.p.x, nx.to.p.y, nx.to.p.z);
  const u = G.walk.u;
  // a small hop on the vertical, so a step reads as a step rather than as a slide
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 4 };
}

function spinTransform() {
  if (!G.spin) return null;
  const u = Math.min(1, (performance.now() - G.spin.t0) / G.spin.ms);
  const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;   // ease in-out
  const ang = -G.spin.sign * (Math.PI / 2) * (1 - e);
  const { pivot, axis } = G.spin;
  const c = Math.cos(ang), s = Math.sin(ang);
  return (x, y, z) => {
    const dx = x - pivot.x, dy = y - pivot.y, dz = z - pivot.z;
    let a, b, cc;
    if (axis === 'x') { a = dx; b = dy * c - dz * s; cc = dy * s + dz * c; }
    else if (axis === 'y') { a = dx * c + dz * s; b = dy; cc = -dx * s + dz * c; }
    else { a = dx * c - dy * s; b = dx * s + dy * c; cc = dz; }
    return { x: a + pivot.x, y: b + pivot.y, z: cc + pivot.z };
  };
}

function render(now) {
  const L = G.L;
  g.setTransform(cv.width / VW, 0, 0, cv.width / VW, 0, 0);
  drawSky(G.idx);
  drawLandmark(G.idx);
  const skyC = CHAPTER_SKY[G.idx % CHAPTER_SKY.length];
  if (G.amb) G.amb.drawClouds(g, skyC.a);
  const gp = L.def.goal;
  const gproj = project(gp.x + 0.5, gp.y + 0.5, gp.z + 1);
  const gsp = { x: (gproj.x + G.cam.x) * G.zoom, y: (gproj.y + G.cam.y) * G.zoom };
  drawBeaconGlow(G.idx, gsp, L.won);
  drawVeil(gsp);
  if (G.amb) G.amb.drawBirds(g);
  g.save();
  g.scale(G.zoom, G.zoom);
  g.translate(G.cam.x, G.cam.y);

  const lights = L.lights();
  const xf = spinTransform();
  const cells = L.world.drawOrder();
  const es = emberScreen();

  let emberDrawn = false;
  for (const c of cells) {
    // A `lit` cube only exists while his light reaches it. It is drawn as a ghost when it does
    // not, because a puzzle you cannot see the shape of is not a puzzle, it is a maze.
    let alpha = 1;
    if (c.lit) {
      const n = L.world.node(c.x, c.y, c.z, 4);
      alpha = (n && L.litAt(n.p)) ? 1 : 0.10;
    }
    // Ember is painted between the cube he stands on and the one in front of it, so anything
    // nearer the camera correctly occludes him.
    if (!emberDrawn && L.at && depthOf(c.x, c.y, c.z) > depthOf(L.at.x, L.at.y, L.at.z)) {
      G.ember.draw(g, es.x, es.y); emberDrawn = true;
    }
    drawCube(g, c, lights, alpha, (xf && c.group === G.spin.group) ? xf : null,
             fogAt(c.x + c.y + c.z));
  }
  if (!emberDrawn) G.ember.draw(g, es.x, es.y);

  // the wick, if he has put it down, gets its own little flame
  if (L.wick && L.wick.placed) {
    const p = project(L.wick.x + 0.5, L.wick.y + 0.5, L.wick.z + 1);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(p.x, p.y - 6, 0, p.x, p.y - 6, 16);
    gr.addColorStop(0, 'rgba(255,214,150,.9)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y - 6, 16, 0, 7); g.fill();
    g.restore();
  }

  // crows: they block, they never hurt, and they leave when the light finds them
  for (const c of L.crows) {
    if (c.gone) continue;
    const p = project(c.x + 0.5, c.y + 0.5, c.z + 1);
    g.fillStyle = '#1b1720';
    g.beginPath(); g.ellipse(p.x, p.y - 9, 7, 9, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(p.x, p.y - 19, 4.6, 4.4, 0, 0, 7); g.fill();
    g.fillStyle = '#e8c25a';
    g.beginPath(); g.moveTo(p.x + 3, p.y - 20); g.lineTo(p.x + 9, p.y - 18.4); g.lineTo(p.x + 3, p.y - 17); g.fill();
    g.fillStyle = 'rgba(255,240,220,.9)';
    g.beginPath(); g.arc(p.x + 1.6, p.y - 20.4, 1.1, 0, 7); g.fill();
  }

  // ---- WEAR and MARKS. Both sit on the geometry, under everything that moves.
  drawWear(g, G.route, fogAt);
  G.markCount = drawMarks(g, cells, G.idx, fogAt);

  // ---- MOTES. Small, bright, bobbing, and additive — a light source rather than an icon.
  // The cheapest thing in Canvas that buys the whole glow register is an additive radial gradient,
  // and it is what makes a collectible read as light rather than as a pickup token.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const m of L.moteNodes) {
    if (G.prog.motes.has(m.id)) continue;
    const p = project(m.n.p.x, m.n.p.y, m.n.p.z);
    const bob = Math.sin(G.t * 0.045 + m.n.x * 1.7) * 3;
    const r = 13 + Math.sin(G.t * 0.08 + m.n.y) * 2;
    const gr = g.createRadialGradient(p.x, p.y - 16 + bob, 0, p.x, p.y - 16 + bob, r);
    gr.addColorStop(0, 'rgba(255,246,214,.95)');
    gr.addColorStop(0.4, 'rgba(255,196,110,.45)');
    gr.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(p.x, p.y - 16 + bob, r, 0, 7); g.fill();
  }
  g.restore();

  // ---- THE WISP. A fire that went out. It is drawn cold and small until he reaches it, and then
  // it burns on its own for the rest of the chapter — he gave it light and lost none.
  if (L.wispNode) {
    const p = project(L.wispNode.p.x, L.wispNode.p.y, L.wispNode.p.z);
    const on = L.wispLit;
    const bob = Math.sin(G.t * 0.03 + 1.3) * 2.5;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const r = on ? 26 : 11;
    const gr = g.createRadialGradient(p.x, p.y - 18 + bob, 0, p.x, p.y - 18 + bob, r);
    if (on) { gr.addColorStop(0, 'rgba(255,238,196,.95)'); gr.addColorStop(0.45, 'rgba(255,178,84,.5)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); }
    else { gr.addColorStop(0, 'rgba(176,196,226,.55)'); gr.addColorStop(1, 'rgba(120,150,200,0)'); }
    g.fillStyle = gr;
    g.beginPath(); g.arc(p.x, p.y - 18 + bob, r, 0, 7); g.fill();
    g.restore();
    if (!on) {                                  // a small cold shape, so it reads as a thing
      g.fillStyle = 'rgba(150,166,196,.5)';
      g.beginPath(); g.ellipse(p.x, p.y - 11, 4.2, 5.4, 0, 0, 7); g.fill();
    }
  }

  for (const h of L.handles) drawHandle(g, h, G.t, G.hot === h);
  g.restore();

  // WEATHER sits between the world and the frame: in front of the mountain, behind the framing
  // masses, because a snowflake passing in front of a foreground rock is a snowflake in the wrong
  // place.
  if (G.weather) G.weather.draw(g);
  drawFraming(G.idx);
  const cast = G.weather && G.weather.cast();
  if (cast) { g.fillStyle = cast.c; g.fillRect(0, 0, VW, VH); }

  if (G.toast && G.toastT > 0) {
    g.globalAlpha = Math.min(1, G.toastT / 50);
    g.textAlign = 'center';
    g.fillStyle = '#f2e6d2';
    g.font = 'italic 500 17px ui-serif, Georgia, serif';
    g.fillText(G.toast, VW / 2, VH - 46);
    g.textAlign = 'left'; g.globalAlpha = 1;
  }

  if (L.won) {
    g.fillStyle = 'rgba(10,9,14,.62)';
    g.fillRect(0, VH / 2 - 74, VW, 148);
    g.textAlign = 'center';
    g.fillStyle = '#f0e4d4';
    g.font = '600 30px ui-serif, Georgia, serif';
    g.fillText('It is lit.', VW / 2, VH / 2 - 8);
    g.fillStyle = '#9d93a6';
    g.font = '15px ui-sans-serif, system-ui, sans-serif';
    g.fillText(G.idx + 1 < LEVELS.length ? 'Enter to go on' : 'Enter — that is all of them',
               VW / 2, VH / 2 + 26);
    g.textAlign = 'left';
  }
  if (G.showSky) drawConstellation();
  else if (G.showMenu) drawMenu();
  if (G.showPerf) {
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.font = '12px ui-monospace, monospace';
    g.fillText(`${Math.round(G.fps)} fps  ${L.world.cells.size} cubes  ${L.world.nodes.size} nodes`, 12, 20);
  }
}

// THE CONSTELLATION — recognition without a number, lifted straight from Sky.
// Sky never shows you a score. Completion is your cape on your own body, and a night sky that
// fills with stars as you free the dead. A checklist with ticks says "7 of 10 chores"; a sky says
// "look what you brought back". The stars here are in fixed positions derived from their ids,
// because a constellation that reshuffles as it fills is a progress bar wearing a costume.
function drawConstellation() {
  // OPAQUE. At 0.96 the mountain showed through and the sky read as a bug rather than as a place.
  g.fillStyle = '#05050b'; g.fillRect(0, 0, VW, VH);
  // a faint static field, so an empty sky is still a sky
  for (let i = 0; i < 160; i++) {
    const h = ((i * 2654435761) >>> 0);
    const x = ((h & 0xffff) / 65535) * VW, y = (((h >>> 16) & 0xffff) / 65535) * VH;
    g.fillStyle = `rgba(190,196,220,${0.03 + ((h >>> 8) & 15) / 300})`;
    g.fillRect(x, y, 1.2, 1.2);
  }
  const list = stars(G.prog);
  // the faint ones first, so the found ones sit on top
  for (const st of list) {
    const x = st.x * VW, y = st.y * VH;
    if (!st.on) {
      g.fillStyle = 'rgba(150,150,180,.10)';
      g.beginPath(); g.arc(x, y, st.r * 0.5, 0, 7); g.fill();
      continue;
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    const r = st.r * 5;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = st.kind === 'wisp' ? '255,214,150' : st.kind === 'clean' ? '196,226,255' : '255,238,200';
    gr.addColorStop(0, `rgba(${c},.95)`); gr.addColorStop(0.35, `rgba(${c},.35)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.restore();
    g.fillStyle = '#fff8ea';
    g.beginPath(); g.arc(x, y, st.r * 0.8, 0, 7); g.fill();
  }
  // Lines between found wisps, joined NEAREST-NEIGHBOUR rather than in index order. Index order
  // draws a straight left-to-right rail — which is, again, a progress bar. A nearest-neighbour
  // chain wanders, which is what a constellation looks like.
  const w = list.filter(s2 => s2.kind === 'wisp' && s2.on);
  if (w.length > 1) {
    g.strokeStyle = 'rgba(255,214,150,.20)'; g.lineWidth = 1;
    const left = w.slice(1);
    let cur = w[0];
    while (left.length) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < left.length; i++) {
        const d = Math.hypot((left[i].x - cur.x) * VW, (left[i].y - cur.y) * VH);
        if (d < bd) { bd = d; bi = i; }
      }
      const nx = left.splice(bi, 1)[0];
      g.beginPath();
      g.moveTo(cur.x * VW, cur.y * VH); g.lineTo(nx.x * VW, nx.y * VH); g.stroke();
      cur = nx;
    }
    g.lineWidth = 1;
  }
  g.textAlign = 'center';
  g.fillStyle = '#efe3d3'; g.font = '600 21px ui-serif, Georgia, serif';
  g.fillText('What you have brought back', VW / 2, 54);
  g.fillStyle = '#8a8092'; g.font = 'italic 13px ui-serif, Georgia, serif';
  const on = list.filter(s2 => s2.on).length;
  g.fillText(on === 0 ? 'Nothing yet. That is alright — you have only just started.'
    : `${on} of ${list.length}. Hover a star.`, VW / 2, 78);
  // hovered star
  const hs = G.hoverStar;
  if (hs) {
    g.fillStyle = '#f4e8d6'; g.font = '600 16px ui-serif, Georgia, serif';
    g.fillText(hs.label, VW / 2, VH - 74);
    if (hs.line) { g.fillStyle = '#9d93a6'; g.font = 'italic 13px ui-serif, Georgia, serif'; g.fillText(hs.line, VW / 2, VH - 50); }
  }
  g.fillStyle = '#6d6580'; g.font = '12px ui-sans-serif, system-ui, sans-serif';
  g.fillText('C to close', VW / 2, VH - 22);
  g.textAlign = 'left';
}

function menuRects() {
  const out = [];
  for (let i = 0; i < LEVELS.length; i++) {
    out.push({ i, x: VW / 2 - 260 + (i % 5) * 106, y: VH / 2 - 70 + ((i / 5) | 0) * 96, w: 92, h: 82 });
  }
  return out;
}
function drawMenu() {
  g.fillStyle = 'rgba(10,9,14,.92)'; g.fillRect(0, 0, VW, VH);
  g.textAlign = 'center';
  g.fillStyle = '#efe3d3'; g.font = '600 22px ui-serif, Georgia, serif';
  g.fillText('The Mountain', VW / 2, VH / 2 - 116);
  g.fillStyle = '#8a8092'; g.font = 'italic 14px ui-serif, Georgia, serif';
  g.fillText('Nothing here can hurt you. Take as long as you like.', VW / 2, VH / 2 - 92);
  for (const r of menuRects()) {
    const open = r.i === 0 || G.done[r.i - 1] || G.done[r.i];
    g.fillStyle = G.done[r.i] ? 'rgba(226,170,96,.22)' : open ? 'rgba(150,140,165,.13)' : 'rgba(90,84,100,.07)';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = G.done[r.i] ? 'rgba(255,196,120,.7)' : 'rgba(160,150,175,.28)';
    g.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    g.fillStyle = open ? '#e6dccb' : '#5f5970';
    g.font = '600 17px ui-serif, Georgia, serif';
    g.fillText(LEVELS[r.i].chapter, r.x + r.w / 2, r.y + 34);
    g.font = '10px ui-sans-serif, system-ui, sans-serif';
    g.fillStyle = open ? '#9d93a6' : '#4d4860';
    g.fillText(LEVELS[r.i].name.slice(0, 13), r.x + r.w / 2, r.y + 58);
  }
  g.textAlign = 'left';
}
const unlocked = (i) => i === 0 || !!G.done[i - 1] || !!G.done[i];

function pickMenu(p) {
  const sp = { x: (p.x + G.cam.x) * G.zoom, y: (p.y + G.cam.y) * G.zoom };
  for (const r of menuRects()) {
    if (sp.x < r.x || sp.x > r.x + r.w || sp.y < r.y || sp.y > r.y + r.h) continue;
    if (!unlocked(r.i)) return;
    G.showMenu = false; load(r.i); return;
  }
}

function startAudio() {
  if (G.started) return;
  G.started = true;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    const ctx = new C();
    G.music = new Music();
    G.music.attach(ctx, ctx.destination);
    G.music.setEnabled(!G.muted);
    G.music.setMood(ROOM_MOOD[G.idx % ROOM_MOOD.length], G.idx * 2654435761 + 17);
  } catch { G.music = null; }
}

// The first handle's real screen position, for the gates. A test that clicks a hardcoded pixel is
// asserting that the layout has not changed, which is not what it claims to be asserting.
Object.defineProperty(window, '__mvHandle', {
  get() {
    return () => {
      const h = G.L?.handles[0];
      if (!h) return null;
      const p = project(h.at.x, h.at.y, h.at.z);
      const r = cv.getBoundingClientRect();
      return { x: r.left + (p.x + G.cam.x) * G.zoom * (r.width / VW),
               y: r.top + (p.y + G.cam.y) * G.zoom * (r.height / VH) };
    };
  },
});

// load a chapter from the gates, so the air can be measured in all ten without ten page loads
Object.defineProperty(window, '__mvLoad', { get() { return (n) => load(Math.max(0, Math.min(LEVELS.length - 1, n))); } });
Object.defineProperty(window, '__mvWorld', { get() { return () => G.L.world; } });

// A read-only diagnostics hook, for the gates. It exists because the things worth asserting here —
// which surface he is standing on, whether a join is an impossible one — cannot be read off pixels.
Object.defineProperty(window, '__mv', {
  get() {
    const L = G.L;
    if (!L) return null;
    return {
      chapter: LEVELS[G.idx].chapter, name: LEVELS[G.idx].name, idx: G.idx,
      at: L.at ? { x: L.at.x, y: L.at.y, z: L.at.z, up: L.at.up, key: L.at.key } : null,
      goal: L.def.goal, won: L.won,
      cubes: L.world.cells.size, nodes: L.world.nodes.size,
      handles: L.handles.length, crows: L.crows.filter(c => !c.gone).length,
      reach: L.reachableNow().size,
      fps: Math.round(G.fps),
      audio: { started: G.started, mood: G.music?.moodName || null, voices: G.music?.voices.length || 0 },
      motes: G.prog.moteCount, wisps: G.prog.wisps.size, lit: G.prog.lit.size,
      lightR: L.lightR, moteNodes: L.moteNodes.length, hasWisp: !!L.wispNode,
      stars: stars(G.prog).length, starsOn: stars(G.prog).filter(s2 => s2.on).length,
      marks: G.markCount || 0, routeLen: (G.route || []).length,
      weather: G.weather ? G.weather.kind : null, windAt: G.wind ? +G.wind.at(0, 0).toFixed(3) : 0,
      clouds: G.amb ? G.amb.clouds.length : 0, birds: G.amb ? G.amb.birds.length : 0,
      fog: { dmin: G.fogRange.dmin, dmax: G.fogRange.dmax },
      knows: G.prog.learned().length,
    };
  },
});

// THE BOOTSTRAP HAS NO CALLER TO CATCH IT. An async IIFE that throws produces an unhandled
// rejection and nothing else: no frame is ever requested, the canvas stays black, and the page
// looks broken rather than failed. Every step below reads persisted state, which is the input
// most likely to be wrong. If it goes wrong twice, we start from nothing rather than not at all.
(async () => {
  try {
    G.muted = await store.get('muted', false);
    G.done = await store.get('done', {});
    G.prog = new Progress(await store.get('prog', {}));
    for (const k of G.prog.lit) { const n = +k; if (Number.isFinite(n)) G.done[n] = true; }
    load(await store.get('at', 0));
  } catch (e) {
    console.error('Emberkeep: saved state could not be read; starting fresh.', e);
    G.muted = false; G.done = {}; G.prog = new Progress({});
    load(0);
  }
  requestAnimationFrame(frame);
})();
