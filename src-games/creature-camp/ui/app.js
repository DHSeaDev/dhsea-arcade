// Creature Camp controller: the side panel AND the full-screen playground
// (ui/sidepanel.html?mode=playground, opened in a tab).
//
// One writer: this surface advances time and saves only while it holds the Web Lock
// 'creaturecamp-writer'. The browser releases that lock the instant a page closes,
// reloads or crashes, so the only open panel is writable immediately. A second open
// panel renders read-only, follows the saved state, and takes over the moment the
// first one closes. The playground STEALS the lock (it is the surface the player just
// asked for); the panel it took the lock from goes read-only and queues to take it back.
//
// Saves are sealed (lib/integrity.js). A save whose seal does not match is replaced by
// the last good shadow copy, or repaired. Every handler that changes the camp ignores
// script-made events (isTrusted === false). Every async handler carries a busy guard.

import { Storage } from '../vendor/storage.js';
import { load, owned, newGuest, NAME_MAX, GUEST_MAX } from '../lib/state.js';
import { SPECIES, BY_KEY, BASE, STARTER_KEY } from '../lib/species.js';
import * as E from '../lib/engine.js';
import { UNLOCKS, progressOf, hintFor, gameOpen, GAME_OPENS } from '../lib/unlocks.js';
import { activeDay } from '../lib/days.js';
import { redeem } from '../lib/codes.js';
import { refuseLine } from '../lib/chatter.js';
import { encodeCreature, decodeCreature, TINTS, BASES } from '../lib/share.js';
import { sealSave, verifySave, repairEarned } from '../lib/integrity.js';
import { CODE_TABLE } from '../data/codes.js';
import { renderCreature } from '../art/creature.js';
import { HATS, hatIcon } from '../art/hats.js';
import { hatRule, mementoFor, MEMENTO_CARES } from '../lib/cosmetics.js';
import { renderScene, renderStone, STONE_SPOTS, SCENES, DEFAULT_SCENE } from '../art/scene.js';
import { $, $$, h, art, announce, relTime } from './dom.js';
import { sfx, setSound } from './audio.js';
import { setAmbience, startAmbience, stopAmbience } from './ambience.js';
import { GAME_INFO, mountGame, real } from './games.js';
import { snapshotBlob, download, safeFileName } from './snapshot.js';
import { TOOLS, mountPlayground, snackText } from './playground.js';

const VERSION = chrome?.runtime?.getManifest?.().version ?? 'dev';
// panel | full | playground.
// Off-extension (the arcade build at play.dhseadev.online) there is no side panel:
// the page IS the window, so the whole app — playground tab included — has to be
// reachable. chrome.runtime.id is undefined under the arcade's storage-only shim and
// absent entirely on a plain page, which is the same test vendor/storage.js uses.
const MODE = new URLSearchParams(location.search).get('mode')
  || (globalThis.chrome?.runtime?.id ? 'panel' : 'full');
const PLAYGROUND = MODE === 'playground';
const FULL = MODE === 'full';        // the whole app in a browser tab, playground included
// Opened by the player from another surface: this window is where they mean to play, so it
// takes the writer instead of landing read-only behind a "Play here instead" banner.
const TAKE = new URLSearchParams(location.search).get('take') === '1';
const SECRET = `creature-camp/seal/v1/${globalThis.chrome?.runtime?.id || 'dev'}`;
const SHADOW_KEY = 'creaturecamp_shadow_v1';
const META_KEY = 'creaturecamp_meta_v1';
const SHADOW_EVERY_MS = 10 * 60_000;
const DEW_GUARD_MS = 60_000;
// per-session nonce: game layouts cannot be computed from the save (shard A)
const NONCE = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
const store = new Storage();
const now = () => Date.now();
let state = null;
let selected = STARTER_KEY;
let readOnly = false;
let dirty = false;
let lostToPlayground = false;
let integrityNote = '';

// ------------------------------------------------------------------ sealed load / save
async function readVerified(seed) {
  const raw = await store.load();
  if (raw == null) return { s: load(null, now(), seed), how: 'fresh', raw: null };
  const v = await verifySave(raw, SECRET);
  if (v === 'ok') return { s: load(raw, now(), seed), how: 'ok', raw };
  const meta = await store.get(META_KEY);
  // a save written by 1.0.0 is unsealed by nature: it loads once, and is sealed from then on
  if (v === 'unsealed' && !meta?.sealed && !(raw.schemaVersion >= 2)) return { s: load(raw, now(), seed), how: 'legacy', raw };
  const shadow = await store.get(SHADOW_KEY);
  if (shadow && (await verifySave(shadow, SECRET)) === 'ok') {
    const s = load(shadow, now(), seed);
    s.integrity = 'restored';
    return { s, how: 'restored', raw: shadow };
  }
  const s = load(raw, now(), seed);
  const notes = repairEarned(s);
  return { s, how: 'repaired', notes, raw: null };
}
function noteIntegrity(how) {
  if (how === 'restored') integrityNote = 'Your camp save did not look right, so the last good copy was restored. Nothing else changed.';
  else if (how === 'repaired') integrityNote = 'Your camp save did not look right. Progress the camp could not account for was set aside; everything you earned is still here.';
}

let saveBusy = false;
let lastShadowMs = 0;
let shadowFriends = 0;
let shadowThisSession = false;
let metaWritten = false;
async function save() {
  if (!isWriter || readOnly || state.futureSave || saveBusy) return;
  saveBusy = true;
  try {
    dirty = false;
    const sealed = await sealSave(state, SECRET);
    const ok = await store.save(sealed);
    if (!ok) { dirty = true; return; }
    if (!metaWritten) { metaWritten = await store.set(META_KEY, { sealed: true }); }
    // the shadow (last good copy) refreshes every 10 min and whenever a friend arrives,
    // so a restore never takes away a friend that was earned
    // first successful save of the session, every 10 min, and on every arrival: a stale
    // shadow is what turns an edited save into "10 of 20 friends set aside" (stress shard)
    if (!shadowThisSession || now() - lastShadowMs > SHADOW_EVERY_MS || lastShadowMs > now() || state.creatures.length !== shadowFriends) {
      lastShadowMs = now(); shadowFriends = state.creatures.length; shadowThisSession = true;
      await store.set(SHADOW_KEY, sealed);
    }
  } finally { saveBusy = false; banner(); }
}
function saveIfDirty() { if (dirty) save(); }
function changed() { dirty = true; renderAll(); saveIfDirty(); queueArrivals(); }

// ------------------------------------------------------------------ boot
async function boot() {
  if (PLAYGROUND) document.body.classList.add('pg');
  if (FULL) { document.body.classList.add('full'); $('#tab-play').hidden = false; }
  // the playground takes the camp first, then reads it (the panel saves on every change)
  let granted = claimWriter({ steal: PLAYGROUND || TAKE });
  if (PLAYGROUND) { await Promise.race([granted, new Promise((r) => setTimeout(r, 400))]); await new Promise((r) => setTimeout(r, 250)); }
  const first = await readVerified((Math.random() * 0xffffffff) >>> 0);
  state = first.s;
  noteIntegrity(first.how);
  if (first.how === 'ok' && first.raw) { lastShadowMs = now(); shadowFriends = state.creatures.length; shadowThisSession = true; store.set(SHADOW_KEY, first.raw); }
  metaWritten = !!(await store.get(META_KEY))?.sealed;
  if (!state.settings.motionInit) {
    state.settings.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (state.loadedFrom === 'fresh' && matchMedia('(prefers-color-scheme: dark)').matches) state.theme = 'night';
    state.settings.motionInit = true;
  }
  if (!PLAYGROUND) await Promise.race([granted, new Promise((r) => setTimeout(r, 400))]);
  readOnly = !isWriter || state.futureSave;
  if (!readOnly) startVisit();
  renderSceneNow();
  wire();
  if (PLAYGROUND) pg = mountPlayground(pgEnv());
  applySettings();
  renderAll();
  banner();
  bootDone = true;
  dirty = true; await save();
  setInterval(loop, 5000);
  setInterval(quietTick, 5000);
  quietTick();
  setInterval(saveIfDirty, 3000);
  document.addEventListener('visibilitychange', onVisibility);
  // the window the player just focused takes the camp (real focus only, never a script's)
  window.addEventListener('focus', real(() => { if (readOnly && !state.futureSave) takeOver(); }));
  new ResizeObserver(measureStage).observe($('#stage'));
  measureStage();
  requestAnimationFrame(wander);
  if (!readOnly && !state.tutorial.done) showArrival(STARTER_KEY, true);
  else if (!readOnly) queueArrivals();
}

let isWriter = false;
let bootDone = false;
let lastStealMs = -Infinity;
const STEAL_GAP_MS = 1500;
/**
 * Take the camp from whichever surface holds it, into THIS one. Chrome gives every
 * browser window its own side panel, so a second window used to render a dead,
 * fully disabled UI with one line of explanation (reported as "day one game does
 * not work"). The window the player is actually looking at should own the camp.
 */
function takeOver() {
  if (isWriter || !state || state.futureSave) return false;
  const t = performance.now();
  if (t - lastStealMs < STEAL_GAP_MS) return false;
  lastStealMs = t;
  claimWriter({ steal: true });
  return true;
}
function claimWriter({ steal = false } = {}) {
  if (!globalThis.navigator?.locks) { isWriter = true; return Promise.resolve(); }   // no Web Locks: single-surface fallback
  return new Promise((resolveFirst) => {
    const opts = steal ? { steal: true } : {};
    navigator.locks.request('creaturecamp-writer', opts, async () => {
      isWriter = true;
      resolveFirst();
      if (bootDone) await becameWriter();
      return new Promise(() => {});   // hold until this page goes away (or the lock is taken)
    }).catch((err) => {
      // The playground took the lock. Stop writing at once, follow along, and queue
      // to take the camp back when the playground closes.
      if (err?.name !== 'AbortError') return;
      isWriter = false;
      readOnly = true;
      lostToPlayground = true;
      if (pg) pg.release();
      if (bootDone) { banner(); announce('Your camp is open in the full-screen playground.'); }
      claimWriter();
    });
  });
}
function startVisit() {
  E.beginVisit(state, now());
  E.tick(state, now());
  E.applyUnlocks(state, now());
}
async function becameWriter() {
  const r = await readVerified(state.seed);
  state = r.s;
  noteIntegrity(r.how);
  readOnly = state.futureSave;
  lostToPlayground = false;
  if (!readOnly) { startVisit(); dirty = true; await save(); }
  applySettings(); renderAll(); banner();
  if (!readOnly && !state.tutorial.done) showArrival(STARTER_KEY, true);
  announce('This window can now make changes.');
}

let loopBusy = false;
async function loop() {
  if (loopBusy) return;
  loopBusy = true;
  try {
    readOnly = !isWriter || state.futureSave;
    if (readOnly) {
      if (!state.futureSave) {
        const r = await readVerified(state.seed);
        if (r.how !== 'fresh') state = r.s;
        renderAll();
      }
    } else {
      const r = E.tick(state, now());
      if (r.ticks) {
        dirty = true;
        for (const ev of r.events) showBubble(ev.keys[0], ev.text);
        if (r.digest) announce(r.digest.text);
      }
      if (E.dewReady(state, now())) showDew();
      renderAll();
      queueArrivals();
    }
    banner();
  } finally {
    loopBusy = false;
  }
}

let hiddenAt = 0;
function onVisibility() {
  if (document.hidden) { hiddenAt = now(); saveIfDirty(); stopAmbience(); quietTick(); return; }
  if (state?.settings.ambience) startAmbience();
  noteInput();
  if (isWriter && !state.futureSave && hiddenAt && now() - hiddenAt > 20 * 60_000) { E.beginVisit(state, now()); dirty = true; }
  loop();
}

function banner() {
  const b = $('#banner');
  if (!b || !state) return;
  const hl = store.health();
  let msg = '';
  if (state.futureSave) msg = 'This camp was saved by a newer version of Creature Camp. You can look around, but changes will not be saved here.';
  else if (hl.fatal) msg = 'Saving is paused because the extension was reloaded. Close and reopen the panel to keep your progress.';
  else if (!hl.ok) msg = 'Your camp could not be saved just now. It will try again in a moment.';
  else if (readOnly && lostToPlayground) msg = 'Your camp is open in the full-screen playground. This view follows along and will not save changes.';
  else if (readOnly) msg = 'Your camp is open in another window. This view follows along and will not save changes.';
  else if (integrityNote) msg = integrityNote;
  b.hidden = !msg;
  b.textContent = msg;
  // the button lives OUTSIDE the banner: appending it into a node that is rebuilt every
  // 5 s removed it from the document on the next pass ($('#banner-action') → null)
  $('#banner-action').hidden = !(readOnly && !state.futureSave && !hl.fatal);
  $$('[data-care], [data-tool], #btn-rename, #code-form button, #btn-reset, #btn-theme, #btn-sound, #pane-settings input, #file-import').forEach((x) => { x.disabled = readOnly; });
  document.body.classList.toggle('is-readonly', readOnly);
}

// ------------------------------------------------------------------ settings
const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
// ---------- quiet modes ----------
// still:       the camp holds its breath when nobody is looking (hidden tab, or unfocused
//              for a while). Measured: idle animation + wander cost 35% of one core at 20
//              creatures; the reduced-motion control run recovered 33.9 of those points.
// screensaver: after a few quiet minutes ON PURPOSE, the chrome fades and the camp is just
//              a view. Any input brings it straight back. Off is a setting, not a maze.
const STILL_AFTER_BLUR_MS = 20_000;
const SCREENSAVER_AFTER_MS = 150_000;
let blurAt = 0;
let lastInputMs = Date.now();
let screensaver = false;
let stillMode = false;
function setStill(on) {
  stillMode = on;
  if (document.body.classList.contains('still') === on) return;
  document.body.classList.toggle('still', on);
}
function setScreensaver(on) {
  const was = screensaver || document.body.classList.contains('screensaver');
  screensaver = on;
  // the class is toggled every time, never only on a change: the app stays authoritative
  // over it, so a stray class can never leave the chrome invisible with no way back
  document.body.classList.toggle('screensaver', on);
  if (on && !was) announce('The camp is resting. Move the mouse or press a key to come back.');
}
function noteInput() {
  lastInputMs = Date.now();
  if (screensaver || document.body.classList.contains('screensaver')) setScreensaver(false);
}
function quietTick() {
  const hidden = document.hidden;
  const unfocused = !document.hasFocus();
  if (!unfocused) blurAt = 0;
  else if (!blurAt) blurAt = Date.now();
  setStill(hidden || (blurAt && Date.now() - blurAt > STILL_AFTER_BLUR_MS));
  const canRest = (PLAYGROUND || FULL) && state?.settings.screensaver && !document.hidden && document.hasFocus();
  setScreensaver(!!canRest && Date.now() - lastInputMs > SCREENSAVER_AFTER_MS);
}

function applySettings() {
  const night = state.theme === 'night';
  document.documentElement.dataset.mode = night ? 'dark' : 'light';
  document.documentElement.classList.toggle('reduce-motion', state.settings.reducedMotion);
  setSound(state.settings.sound);
  const tb = $('#btn-theme');
  tb.setAttribute('aria-pressed', String(night));
  tb.title = night ? 'Switch to Day mode' : 'Switch to Night mode';
  const sb = $('#btn-sound');
  sb.setAttribute('aria-pressed', String(state.settings.sound));
  sb.title = state.settings.sound ? 'Sound on' : 'Sound off';
  $('#set-sound').checked = state.settings.sound;
  $('#set-motion').checked = state.settings.reducedMotion;
  $('#set-assist').checked = state.settings.assist;
  $('#set-ambience').checked = state.settings.ambience;
  $('#set-ambience-vol').value = String(Math.round((state.settings.ambienceVol ?? 0.5) * 100));
  $('#set-screensaver').checked = state.settings.screensaver !== false;
  setAmbience({ on: state.settings.ambience, volume: state.settings.ambienceVol ?? 0.5, scene: sceneToday(), night: state.theme === 'night' });
  $('#set-night').checked = night;
  $('#set-scene-shuffle').checked = !!state.sceneShuffle;
  $('#about-version').textContent = `Version ${VERSION}`;
}

/** Which backdrop today: the chosen one, or one that rotates with the camp day. */
function sceneToday() {
  if (!state.sceneShuffle) return state.scene || DEFAULT_SCENE;
  return SCENES[Math.max(0, activeDay(state) - 1) % SCENES.length].id;
}
let sceneShown = '';
function renderSceneNow() {
  const id = sceneToday();
  setAmbience({ scene: id, night: state.theme === 'night' });
  if (id === sceneShown) return;
  sceneShown = id;
  $('#scene').innerHTML = renderScene(id);
  $('#stones')._sig = '';                 // stones are redrawn over the new backdrop
}

function renderScenePicker() {
  const host = $('#scene-pick');
  const cur = state.scene || DEFAULT_SCENE;
  if (host._sig === cur + state.sceneShuffle) return;
  host._sig = cur + state.sceneShuffle;
  host.replaceChildren(...SCENES.map((sc) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'scene-opt', 'aria-checked': String(sc.id === cur), dataset: { scene: sc.id }, title: sc.note, disabled: readOnly },
      h('span', { class: `swatch scene-sw-${sc.id}`, 'aria-hidden': 'true' }), sc.name);
    b.addEventListener('click', real(() => {
      if (readOnly) return;
      state.scene = sc.id;
      state.sceneShuffle = false;
      $('#set-scene-shuffle').checked = false;
      renderSceneNow();
      announce(`${sc.name}. ${sc.note}`);
      changed();
      renderScenePicker();
    }));
    return b;
  }));
}

// ------------------------------------------------------------------ rendering
function renderAll() {
  if (!state) return;
  $('#daychip').textContent = `Camp day ${activeDay(state)}`;
  renderSceneNow();
  renderActors();
  renderStones();
  renderCare();
  if (PLAYGROUND) { pg?.render(); return; }
  renderGoals();
  renderTicker();
  renderFeed();
  if (!$('#pane-games').hidden && $('#game-area').hidden) renderGames();
  if (!$('#pane-journal').hidden) renderJournal();
  if (!$('#pane-bestiary').hidden) { renderDex(); renderMaker(); renderGuests(); }
  if (!$('#pane-settings').hidden) renderScenePicker();
}

// Actor placement uses transforms against a cached stage size: no per-frame layout
// (shard B: left/top/width writes cost ~14% of a core while creatures wandered).
const stageBox = { w: 0, h: 0 };
function measureStage() {
  const r = $('#stage').getBoundingClientRect();
  stageBox.w = r.width; stageBox.h = r.height;
  for (const [key, el] of actorEls) placeActor(el, motion.get(key), speciesOfKey(key), true);
}

// A creature's art is mostly transparent, so the square button box overlaps its
// neighbours and a tap landed on whichever box was in front. Hit-testing follows the
// drawn shapes (see sidepanel.css), plus this always-present body-sized target so a
// thin friend (Nib, Breeze) never becomes a hairline tap target. Decoration only: the
// shape carries no paint and is hidden from assistive tech.
const HIT_SHAPE = '<ellipse class="cc-hit" cx="60" cy="84" rx="30" ry="30" fill="none" aria-hidden="true"/>';
const withHitArea = (svg) => svg.replace(/<\/svg>\s*$/, `${HIT_SHAPE}</svg>`);

const tintOf = (id) => (TINTS.some((t) => t.id === id) ? id : 0);   // the class suffix, never an inline style
/** The species a key draws as — a visitor draws as the silhouette it was built from. */
function speciesOfKey(key) {
  if (typeof key === 'string' && key.startsWith('g:')) {
    const g = (state.guests || []).find((x) => `g:${x.id}` === key);
    return g ? BY_KEY[g.base] : null;
  }
  return BY_KEY[key] || null;
}
/** Friends and visitors, in one list, for the stage and the friend arrows. */
function beings() {
  return [...state.creatures, ...(state.guests || []).map((g) => ({
    key: `g:${g.id}`, name: g.name, expr: g.expr, hat: g.hat, guest: true, base: g.base, tint: g.tint, stats: g.stats, x: g.x, y: g.y,
  }))];
}

const actorEls = new Map();
const motion = new Map();
function renderActors() {
  const host = $('#actors');
  const all = beings();
  const keys = new Set(all.map((c) => c.key));
  for (const [k, el] of actorEls) if (!keys.has(k)) { el.remove(); actorEls.delete(k); motion.delete(k); }
  const t = now();
  for (const c of all) {
    let el = actorEls.get(c.key);
    if (!el) {
      el = h('button', { type: 'button', class: 'actor', dataset: { key: c.key } });
      el.addEventListener('click', real((e) => { select(c.key); if (PLAYGROUND) pg?.useOn(c.key, e); }));
      host.append(el);
      actorEls.set(c.key, el);
      motion.set(c.key, { x: c.x, y: c.y, tx: c.x, ty: c.y, wait: Math.random() * 4, hold: false });
    }
    const sp = BY_KEY[c.guest ? c.base : c.key];
    const suds = E.careStatus(state, c.key, t)?.suds;
    art(el, withHitArea(renderCreature(c.guest ? c.base : c.key, { expr: c.expr, uid: `a-${c.key.replace(':', '-')}`, hat: c.hat, tint: c.guest ? tintOf(c.tint) : null })));
    el.setAttribute('aria-label', `${c.name}, ${c.guest ? `a visitor shaped like a ${sp.kind}` : sp.kind}, feeling ${c.expr}${suds ? ', sudsy' : ''}${state.newKeys.includes(c.key) ? ', new' : ''}`);
    el.classList.toggle('selected', c.key === selected);
    el.classList.toggle('new', state.newKeys.includes(c.key));
    el.classList.toggle('sudsy', !!suds);
    el.setAttribute('aria-pressed', String(c.key === selected));
    placeActor(el, motion.get(c.key), sp, true);
  }
  // draw order: lower on screen = in front
  const order = [...actorEls.entries()].sort((a, b) => motion.get(a[0]).y - motion.get(b[0]).y);
  order.forEach(([, el], i) => { el.style.zIndex = String(10 + i); });
}

function placeActor(el, m, sp, sized = false) {
  if (!el || !m || !sp) return;
  const scale = sp.plan === 'colossus' ? 1.15 : sp.key === 'wicket' || sp.key === 'breeze' ? 0.85 : 1;
  const crowd = Math.max(0.68, Math.min(1, 1.12 - state.creatures.length * 0.022));   // a fuller camp draws everyone a little smaller
  if (sized) el.style.width = `${Math.round(stageBox.w * 0.22)}px`;
  const y = sp.key === 'hollow' ? Math.min(m.y, 0.62) : m.y;
  const k = scale * crowd * (0.82 + m.y * 0.25);
  el.style.transform = `translate(${(m.x * stageBox.w).toFixed(1)}px, ${(y * stageBox.h).toFixed(1)}px) translate(-50%, -88%) scale(${k.toFixed(3)})`;
  m.px = m.x * stageBox.w; m.py = y * stageBox.h;
}

let lastWander = 0;
let wanderTicks = 0;
function wander(t) {
  requestAnimationFrame(wander);
  // CSS pausing alone still left this loop writing transforms twelve times a second, which
  // was most of what was left of the idle cost after the animations stopped (measured).
  if (!state || state.settings.reducedMotion || document.hidden || stillMode) return;
  if (t - lastWander < 83) return;          // ~12 fps: stepped, handmade movement
  wanderTicks += 1;                         // read by the quiet suite: the loop really stopped
  const dt = Math.min(0.3, (t - lastWander) / 1000);
  lastWander = t;
  for (const [key, m] of motion) {
    const sp = speciesOfKey(key);
    const el = actorEls.get(key);
    if (!el || !sp || m.hold) continue;
    if (sp.key === 'hollow' || sp.key === 'sage' || sp.key === 'root') continue;   // hanging / rooted friends stay put
    m.wait -= dt;
    if (m.wait <= 0 && Math.hypot(m.tx - m.x, m.ty - m.y) < 0.01) {
      m.tx = 0.1 + Math.random() * 0.8;
      m.ty = 0.68 + Math.random() * 0.26;
      m.wait = 3 + Math.random() * 6;
    }
    const speed = sp.plan === 'serpent' || key === 'tuck' ? 0.02 : 0.05;
    const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
    if (d <= 0.005) continue;
    m.x += (dx / d) * Math.min(d, speed * dt); m.y += (dy / d) * Math.min(d, speed * dt);
    placeActor(el, m, sp);
    const svg = el.firstElementChild;
    const flip = dx < 0;
    if (svg && m.flip !== flip) { m.flip = flip; svg.style.transform = flip ? 'scaleX(-1)' : ''; }
  }
}

function showBubble(key, text) {
  const m = motion.get(key);
  if (!m || document.hidden) return;
  const host = $('#bubbles');
  host.querySelector(`[data-key="${key}"]`)?.remove();
  while (host.children.length >= 2) host.firstElementChild.remove();
  const b = h('div', { class: 'bubble', dataset: { key } }, text);
  b.style.left = `${Math.min(0.72, Math.max(0.28, m.x)) * 100}%`;
  b.style.top = `${Math.max(0.2, m.y - 0.3) * 100}%`;
  host.append(b);
  setTimeout(() => b.remove(), 5200);
}

function renderStones() {
  const host = $('#stones');
  host.hidden = !E.stonesOpen(state);
  if (host.hidden) return;
  E.refreshStones(state, now());
  const sig = state.stonesDay + state.stonesFlipped.join(',');
  if (host._sig === sig) return;
  host._sig = sig;
  host.replaceChildren();
  STONE_SPOTS.forEach(([x, y], i) => {
    const flipped = state.stonesFlipped.includes(i);
    const { art: svg, under } = renderStone(i, flipped);
    const b = h('button', { type: 'button', class: 'stone', 'aria-pressed': String(flipped), 'aria-label': flipped ? `Turned stone: ${under}` : 'A stone. Turn it over' });
    b.innerHTML = svg;
    b.style.left = `${(x / 400) * 100}%`;
    b.style.top = `${(y / 260) * 100}%`;
    b.addEventListener('click', real(() => {
      if (readOnly) return;
      if (E.flipStone(state, i, now())) { sfx.flip(); announce(`Under the stone: ${under}.`); changed(); }
    }));
    host.append(b);
  });
}

function showDew() {
  const d = $('#dew');
  if (!d.hidden) return;
  const spots = [[0.2, 0.62], [0.46, 0.7], [0.62, 0.58], [0.84, 0.66], [0.33, 0.8]];
  const [x, y] = spots[Math.floor(Math.random() * spots.length)];
  d.style.left = `${x * 100}%`; d.style.top = `${y * 100}%`;
  d.hidden = false;
  $('#dew-hint').hidden = false;
}

const mins = (ms) => Math.max(1, Math.ceil(ms / 60_000));

function renderCare() {
  const list = beings();
  const c = list.find((x) => x.key === selected) || list[0];
  selected = c.key;
  const sp = speciesOfKey(c.key);
  $('#care-title').textContent = c.name;
  $('#care-kind').textContent = c.guest
    ? `a visitor · shaped like a ${sp.kind} · feeling ${c.expr}`
    : `${sp.kind} · ${sp.voice} · feeling ${c.expr}`;
  art($('#care-art'), renderCreature(c.guest ? c.base : c.key, { expr: c.expr, uid: 'care', hat: c.hat, tint: c.guest ? tintOf(c.tint) : null }));
  const st = E.careStatus(state, c.key, now());
  const bowl = $('#snackbowl');
  const bowlText = `Snack bowl: ${state.snacks}${state.snacks === 0 ? ' — win a round in Games to fill it' : ''}`;
  if (bowl.textContent !== bowlText) bowl.textContent = bowlText;
  bowl.classList.toggle('empty', state.snacks === 0);
  const note = snackText(c.name, st) + (st?.suds ? ' Still sudsy: a cloth will dry it off.' : '');
  if ($('#care-note').textContent !== note) $('#care-note').textContent = note;
  const stats = $('#care-stats');
  const rows = [['Happiness', c.stats.happiness], ['Fullness', c.stats.hunger], ['Energy', c.stats.energy], ['Clean', c.stats.clean]];
  const sig = rows.map((r) => Math.round(r[1])).join(',');
  if (stats._sig !== sig) {
    stats._sig = sig;
    stats.replaceChildren(...rows.map(([label, v]) => h('div', { class: 'stat' },
      h('span', {}, label),
      h('div', { class: 'bar', role: 'meter', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(v)) }, h('i', {})))));
    $$('.bar > i', stats).forEach((el, i) => { el.style.width = `${Math.round(rows[i][1])}%`; });
  }
  $('#wardrobe').hidden = !!c.guest;         // a visitor arrives dressed by whoever made it
  if (!c.guest) renderWardrobe(c);
  renderMemento(c);
  const pick = $('#care-pick');
  const psig = list.map((x) => x.key + x.name).join('|') + selected;
  if (pick._sig !== psig) {
    pick._sig = psig;
    pick.replaceChildren(...list.map((x) => h('option', { value: x.key, selected: x.key === selected }, `${x.name} (${x.guest ? 'visitor' : BY_KEY[x.key].kind})`)));
  }
}

const REACTION_MS = { pet: 950, feed: 1100, play: 1000, wash: 1500, dry: 1150 };
/** Play a creature's reaction to a tool. Decoration only — nothing waits on it. */
function reactAnim(key, kind) {
  const el = actorEls.get(key);
  if (!el || !REACTION_MS[kind] || state.settings.reducedMotion) return;
  for (const c of [...el.classList]) if (c.startsWith('act-')) el.classList.remove(c);
  void el.offsetWidth;                       // restart the animation if the same tool is used twice
  el.classList.add(`act-${kind}`);
  clearTimeout(el._react);
  el._react = setTimeout(() => el.classList.remove(`act-${kind}`), REACTION_MS[kind]);
}

/** Step to the next/previous friend. Arrows are the primary way to choose one. */
function stepFriend(dir) {
  const keys = beings().map((c) => c.key);
  if (keys.length < 2) return;
  const i = Math.max(0, keys.indexOf(selected));
  select(keys[(i + dir + keys.length) % keys.length]);
  // beings(), not state.creatures: stepping onto a visitor threw here (its key is 'g:<id>')
  announce(`${beings().find((c) => c.key === selected)?.name || ''}.`);
}

function renderWardrobe(c) {
  const grid = $('#hat-grid');
  const sig = `${c.key}:${c.hat}:${state.hats.join(',')}:${readOnly}`;
  $('#hat-count').textContent = `(${state.hats.length} of ${HATS.length} earned)`;
  if (grid._sig !== sig) {
    grid._sig = sig;
    const btn = (id, label, on, title) => {
      const b = h('button', { type: 'button', role: 'radio', class: 'hat-opt', 'aria-checked': String(on), title, disabled: readOnly, dataset: { hat: id } }, label);
      b.addEventListener('click', real(() => {
        if (readOnly) return;
        const me = state.creatures.find((x) => x.key === selected);
        me.hat = me.hat === id ? '' : id;
        announce(me.hat ? `${me.name} is wearing the ${HATS.find((x) => x.id === me.hat).name.toLowerCase()}.` : `${me.name} took the hat off.`);
        changed();
      }));
      return b;
    };
    const none = btn('', 'No hat', !c.hat, 'No hat');
    grid.replaceChildren(none, ...HATS.map((hh) => {
      const earned = state.hats.includes(hh.id);
      if (!earned) {
        const rule = hatRule(hh.id);
        const locked = h('span', { class: 'hat-opt locked', title: rule ? rule.how : '' }, h('span', { class: 'hat-lock', 'aria-hidden': 'true' }, '\u{1F512}'), h('span', { class: 'sr' }, `${hh.name}, not earned yet: ${rule ? rule.how : ''}`));
        return locked;
      }
      const b = btn(hh.id, '', c.hat === hh.id, `${hh.name} — ${hh.note}`);
      b.innerHTML = hatIcon(hh.id);
      b.append(h('span', { class: 'sr' }, hh.name));
      return b;
    }));
  }
  const nextLocked = HATS.find((hh) => !state.hats.includes(hh.id));
  $('#hat-note').textContent = nextLocked ? `Next hat: ${hatRule(nextLocked.id)?.how || ''}.` : 'Every hat has been earned.';
}

function renderMemento(c) {
  const box = $('#memento');
  if (c.guest) { box.hidden = false; box.textContent = `A visitor from ${c.from || 'a friend of yours'}. Visitors keep you company; they do not join the roster.`; return; }
  const m = mementoFor(c.key);
  if (c.memento && m) {
    box.hidden = false;
    box.textContent = `${c.name} gave you ${m.item}.`;
    return;
  }
  const left = Math.max(0, MEMENTO_CARES - (c.cares || 0));
  box.hidden = !(left > 0 && left <= MEMENTO_CARES);
  box.textContent = left > 0 ? `${c.name} is warming to you. (${c.cares || 0} of ${MEMENTO_CARES} moments together)` : '';
}

function select(key) {
  selected = key;
  if (state.newKeys.includes(key)) { state.newKeys = state.newKeys.filter((k) => k !== key); dirty = true; }
  renderAll();
}

/** Apply one care tool to one creature. Shared by the panel buttons and the playground. */
function doCare(key, kind) {
  if (readOnly) return { ok: false, reason: 'readonly' };
  const c = state.creatures.find((x) => x.key === key);
  const r = E.care(state, key, kind, now());
  if (!r.ok) {
    // a refusal is a creature state the player can see and act on, never a silent no-op
    const msg = refuseLine(r.reason, c?.name || 'Your friend');
    if (msg) {
      showBubble(key, r.reason === 'nosnacks' ? 'Empty bowl…' : msg);
      announce(msg);
      renderCare();                     // refresh the card FIRST — it owns #care-note's default text
      const note = $('#care-note');
      note.textContent = msg;           // …then the refusal, which outranks it until the next action
      note.classList.remove('nudge'); void note.offsetWidth; note.classList.add('nudge');
      const btn = $(`[data-care="${kind}"]`) || $(`[data-tool="${kind}"]`);
      if (btn) { btn.classList.remove('nudge'); void btn.offsetWidth; btn.classList.add('nudge'); }
    }
    return r;
  }
  if (r.memento) { sfx.chime(); announce(r.memento.line); }
  sfx[kind]?.();
  reactAnim(key, kind);
  showBubble(key, r.line);
  announce(r.line);
  changed();
  // the card's own line describes the friend's state ("had a snack not long ago"), which read
  // as a refusal right after a successful snack. What just happened goes here too.
  renderCare();
  const done = $('#care-note');
  if (done && r.line) done.textContent = r.line;
  return r;
}

function miniArt(key, uid) {
  const s = h('span', { class: 'mini', 'aria-hidden': 'true' });
  return art(s, renderCreature(key, { uid }));
}

const goalWas = new Map();
function renderGoals() {
  const next = BASE.filter((s) => !owned(state, s.key) && UNLOCKS[s.key]).slice(0, 4);
  const host = $('#goals');
  const sig = next.map((s) => `${s.key}:${JSON.stringify(progressOf(state, s.key))}`).join('|') + activeDay(state);
  if (host._sig === sig) return;
  host._sig = sig;
  if (!next.length) { host.replaceChildren(h('li', {}, 'Every friend has found the camp. The pines are quiet and happy.')); return; }
  host.replaceChildren(...next.map((s, i) => {
    const p = progressOf(state, s.key);
    const hint = hintFor(state, s.key);
    const sil = h('span', { class: 'mini gsil', 'aria-hidden': 'true' });
    art(sil, renderCreature(s.key, { uid: `g${i}` }));
    const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': `Progress: ${hint}`, 'aria-valuemin': '0', 'aria-valuemax': String(p.target), 'aria-valuenow': String(p.current) }, h('i', {}));
    bar.firstChild.style.width = `${Math.round((p.current / p.target) * 100)}%`;
    const li = h('li', { class: 'goal' }, sil, h('div', {}, h('span', {}, hint, ` (${p.current}/${p.target})`), bar));
    // the row that MOVED is the only thing that says an action counted (no numbers on a clock)
    if (goalWas.has(s.key) && p.current > goalWas.get(s.key)) {
      li.classList.add('bumped');
      setTimeout(() => li.classList.remove('bumped'), 1400);
    }
    goalWas.set(s.key, p.current);
    return li;
  }));
}

// The camp ticker: the newest lines scroll across the top. WCAG 2.2.2 — moving content
// needs a way to stop it, so it pauses on a button, on hover and on keyboard focus, and
// it does not move at all under reduced motion. The full diary is always one click away.
let tickerSig = '';
let tickerPaused = false;
function renderTicker() {
  const host = $('#ticker');
  const items = [...state.feed].reverse().slice(0, 8);
  host.hidden = items.length === 0;
  if (host.hidden) return;
  const sig = items.map((e) => e.id).join(',') + state.settings.reducedMotion;
  if (sig === tickerSig) return;
  tickerSig = sig;
  const track = $('#ticker-track');
  const line = (e) => h('span', { class: `tick ${e.type}` }, h('span', { class: 'tick-dot', 'aria-hidden': 'true' }, e.type === 'game' ? '\u2605' : e.type === 'unlock' ? '\u2726' : e.type === 'journal' ? '\u270E' : '\u00B7'), e.text);
  if (state.settings.reducedMotion) {
    track.classList.add('still');
    track.replaceChildren(line(items[0]));
    return;
  }
  track.classList.remove('still');
  // two copies so the strip can loop seamlessly
  track.replaceChildren(...items.map(line), ...items.map(line));
  track.style.animationDuration = `${Math.max(24, items.length * 7)}s`;
}

function renderFeed() {
  const host = $('#feed');
  const t = now();
  const items = [...state.feed].reverse();
  const sig = items.map((e) => e.id).join(',');
  if (host._sig === sig) {
    // same entries: only the "5 min ago" labels move (shard C: the list was rebuilt every minute)
    const times = $$('time', host);
    items.forEach((e, i) => { const x = times[i]; const v = relTime(e.t, t); if (x && x.textContent !== v) x.textContent = v; });
    return;
  }
  host._sig = sig;
  if (!items.length) { host.replaceChildren(h('li', {}, h('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), h('span', {}, 'The camp is quiet. Say hello to your first friend.'))); return; }
  host.replaceChildren(...items.map((e, i) => {
    const icon = e.keys[0] ? miniArt(e.keys[0], `f${i}`) : h('span', { class: 'dot', 'aria-hidden': 'true' }, e.type === 'game' ? '★' : e.type === 'journal' ? '✎' : '·');
    const body = h('div', {}, h('span', {}, e.text), h('time', {}, relTime(e.t, t)));
    if (e.lines?.length) body.append(h('details', {}, h('summary', {}, 'A few moments'), ...e.lines.map((l) => h('p', {}, l))));
    return h('li', { class: e.type }, icon, body);
  }));
}

/** What a game is worth beyond snacks: the friend it brings, or that they already came. */
function gameBrings(name) {
  const key = Object.keys(UNLOCKS).find((k) => UNLOCKS[k].cond.kind === 'game' && UNLOCKS[k].cond.name === name);
  if (!key) return null;
  const sp = BY_KEY[key];
  if (owned(state, key)) return h('p', { class: 'muted' }, `${sp.name} joined the camp for this one.`);
  return h('p', { class: 'muted' }, `${UNLOCKS[key].cond.label} — then ${sp.name} joins the camp.`);
}

function renderGames() {
  const host = $('#games-list');
  const sig = JSON.stringify(state.games) + activeDay(state) + readOnly + state.creatures.length;
  if (host._sig === sig) return;      // shard C: the list was rebuilt every 5 s, dropping focus
  host._sig = sig;
  host.replaceChildren(...Object.entries(GAME_INFO).map(([name, info]) => {
    const open = gameOpen(state, name);
    const g = state.games[name];
    const day = GAME_OPENS[name];
    return h('section', { class: `card game-card${open ? '' : ' locked'}` },
      h('h2', {}, info.title, open ? null : h('span', { class: 'lock', title: `Opens on camp day ${day}` }, '\u{1F512}', h('span', { class: 'sr' }, ` Locked until camp day ${day}`))),
      h('p', { class: 'muted' }, info.goal),
      h('p', { class: 'muted pay' }, `Every round wins a snack. A new best wins ${E.SNACK_PER_BEST} more, and clearing it the first time wins ${E.SNACK_PER_FIRST_CLEAR}.`),
      gameBrings(name),
      h('p', { class: 'muted' }, open
        ? `Played ${g.plays} time${g.plays === 1 ? '' : 's'} · best ${g.best}${g.cleared ? ' · cleared' : ''}`
        : `Opens on camp day ${day} — ${Math.max(1, day - activeDay(state))} more camp ${day - activeDay(state) === 1 ? 'day' : 'days'}.`),
      h('button', { type: 'button', class: 'btn', disabled: !open || readOnly, 'aria-label': open ? `Play ${info.title}` : `${info.title} opens on camp day ${day}`, onclick: real(() => openGame(name)) }, open ? 'Play' : `Day ${day}`));
  }));
}

let stopGame = null;
let roundLive = false;
let gameRuns = 0;
function openGame(name) {
  if (stopGame) { stopGame(); stopGame = null; }
  $('#games-list').hidden = true;
  const area = $('#game-area');
  area.hidden = false;
  // Trail Memory shows only friends already at camp (never spoils the Bestiary), padded with woodland tokens
  const keys = state.creatures.map((c) => c.key).filter((k) => BY_KEY[k].pack === 'base');
  gameRuns++;
  stopGame = mountGame(name, area, {
    gentle: state.settings.assist,
    reduced: state.settings.reducedMotion,
    seed: (NONCE ^ Math.imul(gameRuns, 2654435761) ^ Math.imul(state.games[name].plays + 1, 40503)) >>> 0,
    keys,
    names: Object.fromEntries(state.creatures.map((c) => [c.key, c.name])),
    setLive: (on) => { roundLive = on; if (!on) setTimeout(queueArrivals, 50); },
    onFinish: (n, score, cleared, receipt) => {
      if (readOnly) return null;
      const r = E.recordGame(state, n, score, cleared, now(), receipt);
      if (r.recorded) {
        if (r.snacks > 0) announce(`${r.snacks} snack${r.snacks === 1 ? '' : 's'} for the bowl.`);
        changed();
      }
      return r;
    },
    onExit: closeGame,
    onReplay: () => openGame(name),
  });
}
function closeGame() {
  if (stopGame) stopGame();
  stopGame = null;
  roundLive = false;
  $('#game-area').hidden = true;
  $('#game-area').replaceChildren();
  $('#games-list').hidden = false;
  $('#games-list')._sig = '';
  renderGames();
  $('#games-list .btn:not(:disabled)')?.focus();
  queueArrivals();
}

function renderJournal() {
  const host = $('#journal');
  const day = activeDay(state);
  const sig = JSON.stringify(state.journal) + day + readOnly + Object.keys(E.JOURNAL).map((q) => E.journalCanAdvance(state, q)).join() + JSON.stringify(progressOf(state, 'hush')) + owned(state, 'hush');
  if (host._sig === sig) return;
  host._sig = sig;
  host.replaceChildren(...Object.entries(E.JOURNAL).map(([q, def]) => {
    const j = state.journal[q];
    const card = h('section', { class: 'card story' }, h('h2', {}, def.title));
    if (day < def.opensDay) { card.append(h('p', { class: 'muted' }, `This page is still blank. It fills in on camp day ${def.opensDay}.`)); return card; }
    const list = h('ol', {});
    def.steps.forEach((s, i) => {
      if (i < j.step) list.append(h('li', {}, s.text, ' ', h('em', {}, `(${s.action.toLowerCase()} — done)`)));
      else if (i === j.step) {
        const can = E.journalCanAdvance(state, q);
        list.append(h('li', {}, s.text, h('div', {},
          can ? h('button', { type: 'button', class: 'btn', disabled: readOnly, onclick: real(() => { if (!readOnly && E.journalAdvance(state, q, now())) { sfx.soft(); announce(`Journal: ${s.action}.`); changed(); renderJournal(); } }) }, s.action)
            : h('p', { class: 'muted' }, 'Come back on another camp day to continue.'))));
      }
    });
    card.append(list);
    if (j.step >= def.steps.length) card.append(h('p', { class: 'done-note' }, def.done));
    if (q === 'quietPines' && j.step >= def.steps.length && !owned(state, 'hush')) {
      const p = progressOf(state, 'hush');
      card.append(h('p', { class: 'muted' }, `The quiet is waiting for every friend to be at camp (${p.current}/${p.target}).`));
    }
    return card;
  }));
}

function renderDex() {
  const host = $('#dex');
  const guests = $('#dex-guests');
  const baseHave = state.creatures.filter((c) => BY_KEY[c.key].pack === 'base').length;
  const guestHave = state.creatures.filter((c) => BY_KEY[c.key].pack !== 'base').length;
  $('#dex-count').textContent = `${baseHave} of ${BASE.length} camp friends found.`;
  $('#dex-guest-count').textContent = guestHave
    ? `${guestHave} special guest${guestHave === 1 ? '' : 's'} visiting.`
    : baseHave >= BASE.length
      ? `Your camp is complete with its ${BASE.length} friends. Special guests may visit later with codes shared by DHSeaDev.`
      : 'Special guests arrive only with codes shared by DHSeaDev.';
  const sig = state.creatures.map((c) => c.key + c.name + c.hat + c.memento).join() + state.newKeys.join() + JSON.stringify(SPECIES.map((s) => progressOf(state, s.key)));
  if (host._sig === sig) return;
  host._sig = sig;
  const card = (sp, i) => {
    const mine = state.creatures.find((c) => c.key === sp.key);
    const a = h('div', { class: `art${mine ? '' : ' sil'}`, 'aria-hidden': 'true' });
    art(a, renderCreature(sp.key, { uid: `d${i}`, hat: mine?.hat }));
    if (mine) {
      const keep = mine.memento ? mementoFor(sp.key) : null;
      return h('li', { class: state.newKeys.includes(sp.key) ? 'is-new' : '' }, a,
        h('span', { class: 'name' }, mine.name), h('span', { class: 'rar' }, `${sp.rarity} ${sp.kind}`), h('span', { class: 'hint' }, sp.lore),
        keep ? h('span', { class: 'keepsake' }, `Gave you ${keep.item}.`) : null);
    }
    const p = progressOf(state, sp.key);
    const hint = hintFor(state, sp.key);
    const li = h('li', {}, a, h('span', { class: 'name' }, sp.pack === 'base' ? 'Not yet met' : 'Special guest'), h('span', { class: 'hint' }, hint));
    if (p) {
      const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': `Progress: ${hint}`, 'aria-valuemin': '0', 'aria-valuemax': String(p.target), 'aria-valuenow': String(p.current) }, h('i', {}));
      bar.firstChild.style.width = `${Math.round((p.current / p.target) * 100)}%`;
      li.append(bar);
    }
    return li;
  };
  host.replaceChildren(...SPECIES.filter((s) => s.pack === 'base').map(card));
  guests.replaceChildren(...SPECIES.filter((s) => s.pack !== 'base').map((s, i) => card(s, 100 + i)));
}

// ------------------------------------------------------------------ the visitor maker
function makerSpec() {
  return {
    base: $('#maker-base').value,
    tint: Number($('#maker-tint').value),
    hat: $('#maker-hat').value,
    name: $('#maker-name').value,
  };
}
function renderMakerLists() {
  const b = $('#maker-base');
  if (!b.options.length) {
    b.replaceChildren(...BASES.map((k) => h('option', { value: k }, `${BY_KEY[k].name} (${BY_KEY[k].kind})`)));
    $('#maker-tint').replaceChildren(...TINTS.map((t) => h('option', { value: String(t.id) }, t.name)));
    $('#maker-hat').replaceChildren(h('option', { value: '' }, 'No hat'), ...HATS.map((hh) => h('option', { value: hh.id }, hh.name)));
  }
}
function renderMaker() {
  renderMakerLists();
  const spec = makerSpec();
  art($('#maker-preview'), renderCreature(spec.base, { expr: 'happy', uid: 'mk', hat: spec.hat, tint: tintOf(spec.tint) }));
  const code = encodeCreature(spec);
  $('#maker-code').textContent = code || 'That combination cannot be written down.';
  return code;
}
function renderGuests() {
  const host = $('#guest-list');
  const gs = state.guests || [];
  const sig = gs.map((g) => g.id + g.name).join('|') + readOnly;
  if (host._sig === sig) return;
  host._sig = sig;
  host.replaceChildren(...gs.map((g) => h('li', {},
    h('span', {}, `${g.name}${g.from ? ` — from ${g.from}` : ''}`),
    h('button', { type: 'button', class: 'btn ghost small', disabled: readOnly, onclick: real(() => {
      state.guests = state.guests.filter((x) => x.id !== g.id);
      if (selected === `g:${g.id}`) selected = STARTER_KEY;
      announce(`${g.name} headed home.`);
      changed();
    }) }, 'Send home'))));
  if (!gs.length) host.replaceChildren(h('li', { class: 'muted' }, 'No visitors at the moment.'));
}

// ------------------------------------------------------------------ arrivals
const arrivalQueue = [];
const seenArrival = new Set();
let arrivalOpen = false;
function queueArrivals() {
  if (readOnly || roundLive) return;       // never interrupt a round in progress
  for (const c of state.creatures) if (!state.shown.includes(c.key) && !arrivalQueue.includes(c.key) && !seenArrival.has(c.key)) arrivalQueue.push(c.key);
  if (!arrivalOpen && arrivalQueue.length) showArrival(arrivalQueue.shift(), false);
}
function showArrival(key, tutorial) {
  arrivalOpen = true;
  seenArrival.add(key);
  const sp = BY_KEY[key];
  const c = state.creatures.find((x) => x.key === key);
  art($('#arrival-art'), renderCreature(key, { expr: 'happy', uid: 'arr', hat: c?.hat }));
  $('#arrival-title').textContent = tutorial ? 'Welcome to Creature Camp' : `${sp.name} has come to camp!`;
  $('#arrival-text').textContent = tutorial
    ? 'A small fox is watching the campfire. Give it a name, then pet it and share a snack to make your first friend feel at home.'
    : (state.feed.slice().reverse().find((e) => e.type === 'unlock' && e.keys[0] === key)?.text || sp.lore);
  const form = $('#arrival-form');
  form.hidden = !tutorial;
  if (tutorial) $('#arrival-name').value = c?.name || sp.name;
  if (!tutorial) sfx.chime();
  $('#arrival').hidden = false;
  (tutorial ? $('#arrival-name') : $('#arrival-ok')).focus();
  announce($('#arrival-title').textContent);
}
function closeArrival({ keepName = false } = {}) {
  const tutorial = !$('#arrival-form').hidden;
  if (tutorial && !readOnly) {
    // Escape keeps the name the friend already has; only the button or Enter applies the typed one
    if (!keepName) E.rename(state, STARTER_KEY, $('#arrival-name').value, now());
    E.finishTutorial(state);
    selected = STARTER_KEY;
    changed();
  }
  $('#arrival').hidden = true;
  arrivalOpen = false;
  const key = [...seenArrival].pop();
  if (key && !readOnly && !state.shown.includes(key)) { state.shown.push(key); changed(); }
  (tutorial ? $('[data-care="pet"]') || $('[data-tool="pet"]') : actorEls.get(key) || $('#tab-camp')).focus();
  setTimeout(queueArrivals, 300);
}

/** Open another surface of the same app in a browser tab. */
function openSurface(mode) {
  // In an extension this document lives at a chrome-extension:// URL; on the web it is
  // simply a sibling of the current page. Never call chrome.runtime.getURL under the
  // arcade's storage-only shim — it is undefined there, and a shipped call to an API the
  // shim does not provide is exactly the present-but-dead failure this port avoids.
  const rel = `sidepanel.html?mode=${mode}&take=1`;
  const url = globalThis.chrome?.runtime?.getURL
    ? chrome.runtime.getURL(`ui/${rel}`)
    : new URL(rel, location.href).href;
  if (globalThis.chrome?.tabs?.create) chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
  else window.open(url, '_blank');
}

// ------------------------------------------------------------------ playground bridge
let pg = null;
function pgEnv() {
  return {
    get state() { return state; },
    get readOnly() { return readOnly; },
    get selected() { return selected; },
    actorEls, motion, stageBox, now,
    select,
    care: doCare,
    placeActor: (key) => placeActor(actorEls.get(key), motion.get(key), speciesOfKey(key)),
    react: reactAnim,
    reduced: () => state.settings.reducedMotion,
  };
}

/** Add a visitor from a decoded code. Visitors never touch the roster or its goals. */
function addGuest(spec, from) {
  if ((state.guests || []).length >= GUEST_MAX) {
    $('#guest-msg').textContent = `This camp is hosting ${GUEST_MAX} visitors already. Send one home to make room.`;
    return;
  }
  const g = newGuest({ ...spec, from }, now());
  if (!g) { $('#guest-msg').textContent = 'That visitor could not be made.'; return; }
  state.guests = [...(state.guests || []), g];
  selected = `g:${g.id}`;
  $('#guest-msg').textContent = `${g.name} is visiting your camp. You can rename or send them home any time.`;
  announce(`${g.name} is visiting your camp.`);
  sfx.chime();
  changed();
}

// ------------------------------------------------------------------ wiring
/** Same rules the engine uses, for names the UI owns (visitors). */
function cleanNameUI(raw, fallback) {
  const clean = String(raw ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(clean).slice(0, NAME_MAX).join('') || fallback;
}

const clampName = (input) => {
  const cp = Array.from(input.value);
  if (cp.length > NAME_MAX) input.value = cp.slice(0, NAME_MAX).join('');
};

function wire() {
  // tabs (roving tabindex + arrow keys)
  const tabs = $$('[role="tab"]');
  // the Playground tab exists only in window mode: a hidden tab must not be reachable by
  // arrow keys, or ArrowRight lands on nothing and silently selects a pane you cannot see
  const openTabs = () => tabs.filter((t) => !t.hidden);
  const show = (tab) => {
    // Camp and Playground are two tabs over ONE pane. Hiding per-tab made the last tab in
    // the list win, so selecting Camp re-hid the camp pane it had just shown (found by the
    // a11y keyboard walk: every stop after the tab strip vanished).
    const wanted = tab.getAttribute('aria-controls');
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    for (const t of tabs) {
      const pane = $(`#${t.getAttribute('aria-controls')}`);
      if (pane) pane.hidden = t.getAttribute('aria-controls') !== wanted;
    }
    if (tab.id !== 'tab-games' && stopGame) closeGame();
    // in a window, the playground is a tab over the same camp stage
    if (FULL) {
      const on = tab.id === 'tab-play';
      document.body.classList.toggle('pg', on);
      if (on && !pg) pg = mountPlayground(pgEnv());
      measureStage();
      renderAll();
    }
    if (tab.id === 'tab-games') renderGames();
    if (tab.id === 'tab-journal') renderJournal();
    if (tab.id === 'tab-bestiary') renderDex();
  };
  tabs.forEach((t) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const live = openTabs();
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const n = live[e.key === 'Home' ? 0 : live.length - 1]; n.focus(); show(n); return; }
      if (!d) return;
      e.preventDefault();
      const here = Math.max(0, live.indexOf(t));
      const n = live[(here + d + live.length) % live.length];
      n.focus(); show(n);
    });
  });

  $$('[data-care]').forEach((b) => b.addEventListener('click', real(() => doCare(selected, b.dataset.care))));
  $('#friend-prev').addEventListener('click', real(() => stepFriend(-1)));
  $('#friend-next').addEventListener('click', real(() => stepFriend(1)));
  // left/right anywhere in the camp pane, as long as the player is not typing or on a tab
  $('#pane-camp').addEventListener('keydown', real((e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || document.activeElement?.getAttribute('role') === 'tab') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepFriend(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stepFriend(1); }
  }));
  $('#ticker-pause').addEventListener('click', real(() => {
    tickerPaused = !tickerPaused;
    $('#ticker-track').classList.toggle('paused', tickerPaused);
    const b = $('#ticker-pause');
    b.setAttribute('aria-pressed', String(tickerPaused));
    b.setAttribute('aria-label', tickerPaused ? 'Start the camp ticker' : 'Pause the camp ticker');
    b.firstElementChild.textContent = tickerPaused ? '\u25B6' : 'II';
  }));
  $('#btn-window')?.addEventListener('click', real(() => openSurface('full')));
  $('#banner-action').addEventListener('click', real(() => {
    if (takeOver()) announce('Taking the camp into this window.');
  }));
  $('#care-pick').addEventListener('change', (e) => select(e.target.value));
  $('#btn-playground')?.addEventListener('click', real(() => {
    if (FULL) { $('#tab-play').click(); return; }      // already in a window: just switch to it
    openSurface('playground');
  }));
  $('#btn-rename').addEventListener('click', () => {
    const f = $('#rename-form');
    f.hidden = false;
    $('#rename-input').value = beings().find((c) => c.key === selected)?.name || '';
    $('#rename-input').focus();
  });
  $('#rename-cancel').addEventListener('click', () => { $('#rename-form').hidden = true; $('#btn-rename').focus(); });
  const counter = (input, out) => input.addEventListener('input', () => { clampName(input); out.textContent = `${Array.from(input.value).length} of ${NAME_MAX} letters`; });
  counter($('#rename-input'), $('#rename-count'));
  counter($('#arrival-name'), $('#arrival-count'));
  $('#rename-form').addEventListener('submit', real((e) => {
    e.preventDefault();
    if (readOnly) return;
    if (String(selected).startsWith('g:')) {
      const g = state.guests.find((x) => `g:${x.id}` === selected);
      if (g) g.name = cleanNameUI($('#rename-input').value, g.name);
    } else {
      E.rename(state, selected, $('#rename-input').value, now());
    }
    $('#rename-form').hidden = true;
    announce(`Renamed to ${beings().find((c) => c.key === selected)?.name}.`);
    changed();
    $('#btn-rename').focus();
  }));
  let snapBusy = false;
  $('#btn-snap').addEventListener('click', async () => {
    if (snapBusy) return;
    snapBusy = true;
    const btn = $('#btn-snap');
    btn.disabled = true;
    try {
      const c = state.creatures.find((x) => x.key === selected);
      const blob = await snapshotBlob(c);
      download(blob, `${safeFileName(c.name)}-creature-camp.png`);
      announce(`Picture of ${c.name} saved to your downloads.`);
    } catch {
      announce('The picture could not be made this time.');
    } finally {
      snapBusy = false; btn.disabled = false;
    }
  });

  // dew: one per real minute of this session, whatever the system clock says
  let lastDewPerf = -Infinity;
  $('#dew').addEventListener('click', real(() => {
    if (readOnly) return;
    const p = performance.now();
    if (p - lastDewPerf >= DEW_GUARD_MS && E.collectDew(state, now())) { lastDewPerf = p; sfx.dew(); announce(`Dew drop gathered (${state.stats.dew}).`); changed(); }
    $('#dew').hidden = true;
    $('#dew-hint').hidden = true;
  }));

  const toggleTheme = real(() => { if (readOnly) return; E.setTheme(state, state.theme === 'night' ? 'day' : 'night', now()); applySettings(); changed(); });
  $('#btn-theme').addEventListener('click', toggleTheme);
  $('#set-night').addEventListener('change', toggleTheme);
  const toggleSound = () => { state.settings.sound = !state.settings.sound; applySettings(); changed(); if (state.settings.sound) sfx.soft(); };
  $('#btn-sound').addEventListener('click', toggleSound);
  $('#set-sound').addEventListener('change', toggleSound);
  $('#set-motion').addEventListener('change', (e) => { state.settings.reducedMotion = e.target.checked; applySettings(); changed(); });
  $('#set-assist').addEventListener('change', (e) => { state.settings.assist = e.target.checked; changed(); });
  $('#set-ambience').addEventListener('change', real((e) => {
    state.settings.ambience = e.target.checked;
    setAmbience({ on: state.settings.ambience, volume: state.settings.ambienceVol ?? 0.5, scene: sceneToday(), night: state.theme === 'night' });
    if (state.settings.ambience) { if (!startAmbience()) announce('Camp sounds are not available in this window.'); }
    else stopAmbience();
    changed();
  }));
  $('#set-ambience-vol').addEventListener('input', real((e) => {
    state.settings.ambienceVol = Math.max(0, Math.min(1, Number(e.target.value) / 100));
    setAmbience({ volume: state.settings.ambienceVol });
  }));
  $('#set-ambience-vol').addEventListener('change', () => changed());
  $('#set-screensaver').addEventListener('change', real((e) => { state.settings.screensaver = e.target.checked; if (!e.target.checked) setScreensaver(false); changed(); }));
  // any real input is a sign of life: it wakes the camp and starts sound on first gesture
  for (const evt of ['pointerdown', 'keydown', 'wheel']) {
    document.addEventListener(evt, real(() => {
      noteInput();
      if (state.settings.ambience) startAmbience();
    }), { passive: true });
  }
  window.addEventListener('blur', () => { blurAt = Date.now(); quietTick(); });
  window.addEventListener('focus', real(() => { blurAt = 0; noteInput(); quietTick(); }));
  $('#set-scene-shuffle').addEventListener('change', real((e) => {
    state.sceneShuffle = e.target.checked;
    renderSceneNow();
    renderScenePicker();
    changed();
  }));
  // follow the system setting live when it changes (shard C)
  osMotion.addEventListener?.('change', (e) => { state.settings.reducedMotion = e.matches; applySettings(); changed(); });

  let codeBusy = false;
  $('#code-form').addEventListener('submit', real(async (e) => {
    e.preventDefault();
    if (codeBusy || readOnly) return;
    codeBusy = true;
    const btn = $('#code-form button');
    btn.disabled = true;
    const msg = $('#code-msg');
    try {
      const r = await redeem(state, $('#code-input').value, CODE_TABLE, now());
      const text = {
        empty: 'Codes are at least 4 letters or numbers.',
        unknown: 'That code does not open anything yet. Special codes are shared by DHSeaDev.',
        used: 'That code has already been used at this camp.',
        owned: 'That friend is already at your camp.',
        readonly: 'This camp cannot change right now.',
        rest: `Lots of tries in a row. Take a short break and try again in about ${Math.ceil((r.restMs || 0) / 1000)} seconds.`,
      };
      msg.textContent = r.ok ? `${BY_KEY[r.key].name} is on the way!` : text[r.reason];
      if (r.ok) $('#code-input').value = '';
      changed();   // a failed try is recorded too (the try limit lives in the save)
    } finally {
      codeBusy = false; btn.disabled = readOnly;
    }
  }));

  // backups are sealed: an edited file is refused, and a restore can be undone
  let exportBusy = false;
  // the maker
  for (const id of ['#maker-base', '#maker-tint', '#maker-hat']) $(id).addEventListener('change', () => renderMaker());
  $('#maker-name').addEventListener('input', () => { clampName($('#maker-name')); renderMaker(); });
  $('#btn-maker-copy').addEventListener('click', real(async () => {
    const code = renderMaker();
    if (!code) return;
    try { await navigator.clipboard.writeText(code); $('#guest-msg').textContent = 'Code copied. Send it to whoever you like.'; }
    catch { $('#guest-msg').textContent = `Copy this code by hand: ${code}`; }
  }));
  $('#btn-maker-keep').addEventListener('click', real(() => {
    if (readOnly) return;
    const code = renderMaker();
    const spec = decodeCreature(code);
    addGuest(spec, 'you');
  }));
  $('#guest-form').addEventListener('submit', real((e) => {
    e.preventDefault();
    if (readOnly) return;
    const spec = decodeCreature($('#guest-input').value);
    if (spec.error) {
      $('#guest-msg').textContent = {
        shape: 'That does not look like a visitor code. They start with CC1-.',
        typo: 'That code has a typo in it — check the last two letters.',
        version: 'That code was made by a newer version of Creature Camp.',
        unknown: 'That code describes something this version does not have yet.',
      }[spec.error];
      return;
    }
    addGuest(spec, '');
    $('#guest-input').value = '';
  }));

  $('#btn-export').addEventListener('click', async () => {
    if (exportBusy) return;
    exportBusy = true;
    try {
      const save = await sealSave(state, SECRET);
      const blob = new Blob([JSON.stringify({ app: 'creature-camp', exportedAt: new Date().toISOString(), save }, null, 1)], { type: 'application/json' });
      download(blob, `creature-camp-backup-${new Date().toISOString().slice(0, 10)}.json`);
      $('#io-msg').textContent = 'Backup downloaded. It can be restored on this computer.';
    } finally { exportBusy = false; }
  });
  let importBusy = false;
  let pendingImport = null;
  let undoSave = null;
  $('#file-import').addEventListener('change', real(async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || importBusy || readOnly) return;
    importBusy = true;
    try {
      if (f.size > 5_000_000) throw new Error('bad');
      const data = JSON.parse(await f.text());
      if (data?.app !== 'creature-camp') throw new Error('bad');
      let next = null, checked = true;
      if (data.save && (await verifySave(data.save, SECRET)) === 'ok') next = load(data.save, now(), state.seed);
      else if (data.save) throw new Error('edited');
      else if (data.state && typeof data.state === 'object') {
        // a 1.0.0 backup has no seal: every friend in it must be backed by its progress
        next = load(data.state, now(), state.seed);
        checked = false;
      } else throw new Error('bad');
      if (next.futureSave) throw new Error('newer');
      const notes = checked ? [] : repairEarned(next);
      pendingImport = { next, notes };
      $('#import-text').textContent = `Replace this camp (${state.creatures.length} friends, camp day ${activeDay(state)}) with the backup (${next.creatures.length} friends, camp day ${activeDay(next)})?${notes.length ? ' Some progress in this older backup could not be checked and will be set aside.' : ''}`;
      $('#import-confirm').hidden = false;
      $('#btn-import-go').focus();
    } catch (err) {
      $('#io-msg').textContent = err.message === 'newer' ? 'That backup is from a newer version of Creature Camp.'
        : err.message === 'edited' ? 'That backup was changed after it was made, so it cannot be restored.'
          : 'That file is not a Creature Camp backup.';
    } finally {
      importBusy = false;
    }
  }));
  $('#btn-import-cancel').addEventListener('click', () => { pendingImport = null; $('#import-confirm').hidden = true; $('#io-msg').textContent = 'Your camp was kept as it is.'; });
  $('#btn-import-go').addEventListener('click', real(async () => {
    if (!pendingImport || readOnly) return;
    undoSave = await sealSave(state, SECRET);
    state = pendingImport.next;
    pendingImport = null;
    state.settings.motionInit = true;
    resetActors();
    $('#import-confirm').hidden = true;
    applySettings();
    changed();
    $('#io-msg').textContent = `Restored a camp with ${state.creatures.length} friends.`;
    $('#btn-undo-import').hidden = false;
    $('#btn-undo-import').focus();
  }));
  $('#btn-undo-import').addEventListener('click', real(() => {
    if (!undoSave || readOnly) return;
    state = load(undoSave, now(), state.seed);
    undoSave = null;
    resetActors();
    applySettings();
    changed();
    $('#btn-undo-import').hidden = true;
    $('#io-msg').textContent = 'Restore undone. Your camp is back as it was.';
  }));

  $('#btn-reset').addEventListener('click', () => { $('#reset-confirm').hidden = false; $('#reset-msg').textContent = ''; $('#reset-input').focus(); });
  $('#btn-reset-cancel').addEventListener('click', () => { $('#reset-confirm').hidden = true; $('#reset-input').value = ''; $('#reset-msg').textContent = ''; $('#btn-reset').focus(); });
  $('#btn-reset-go').addEventListener('click', real(async () => {
    if (readOnly) return;
    if ($('#reset-input').value.trim().toUpperCase() !== 'NEW CAMP') {
      $('#reset-msg').textContent = 'Type NEW CAMP in the box to confirm. Your camp has not changed.';
      announce('Type NEW CAMP to confirm.');
      $('#reset-input').focus();
      return;
    }
    $('#reset-msg').textContent = '';
    state = load(null, now(), (Math.random() * 0xffffffff) >>> 0);
    state.settings.motionInit = true;
    E.beginVisit(state, now());
    resetActors();
    $('#reset-confirm').hidden = true; $('#reset-input').value = '';
    integrityNote = '';
    dirty = true; await save();
    applySettings(); renderAll();
    $('#tab-camp').click();
    showArrival(STARTER_KEY, true);
  }));

  $('#arrival-ok').addEventListener('click', () => closeArrival());
  $('#arrival-form').addEventListener('submit', (e) => { e.preventDefault(); closeArrival(); });
  $('#arrival').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeArrival({ keepName: true }); }
    if (e.key === 'Tab') {   // keep focus inside the dialog
      const f = $$('#arrival input:not([hidden]), #arrival button').filter((x) => x.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener('pagehide', () => { if (dirty && !readOnly && isWriter) sealSave(state, SECRET).then((s) => store.save(s)); });
}

function resetActors() {
  for (const el of actorEls.values()) el.remove();
  actorEls.clear(); motion.clear(); seenArrival.clear(); arrivalQueue.length = 0;
  selected = STARTER_KEY;
  measureStage();
}

// test hook (read-only): lets the browser suites inspect progress. The layout seed is
// withheld so a script cannot compute a game board (shard A).
Object.defineProperty(globalThis, '__camp', {
  value: Object.freeze({
    get state() { const s = structuredClone(state); delete s.seed; return s; },
    get readOnly() { return readOnly; },
    get tools() { return TOOLS.map((t) => t.id); },
    get quiet() { return { still: stillMode, screensaver, wanderTicks }; },
  }),
});

boot().catch((e) => {
  const b = document.getElementById('banner');
  if (b) { b.hidden = false; b.textContent = 'Creature Camp could not start. Try closing and reopening the panel.'; }
  console.error(e);
});
