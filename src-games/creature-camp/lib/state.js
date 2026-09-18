// Game state: shape, creation, migration and sanitisation. PURE — no chrome.*,
// no DOM, no clock reads (every time value is passed in).
//
// Save seam rules (learned on Lumenreel 0.7.0, where sanitize() stamped the
// current version without ever READING the saved one):
//   1. migrate() runs FIRST and records what version the save was loaded from.
//   2. A save with no schemaVersion is version 0 — an old save, not a fresh install.
//   3. A save from a NEWER build than this one is never downgraded: it loads
//      read-only (`futureSave`) and the UI refuses to write over it.

import { SPECIES, BY_KEY, STARTER_KEY, isSpecies } from './species.js';
import { cleanDays } from './days.js';
import { EXPRESSIONS } from '../vendor/expression.js';
import { CODE_TABLE } from '../data/codes.js';
import { SCENE_IDS, DEFAULT_SCENE } from '../art/scene.js';
import { HAT_IDS } from '../art/hats.js';
import { TINTS, BASES, guestMatchesCode } from './share.js';

export const SCHEMA_VERSION = 3;
export const FEED_CAP = 50;
export const NAME_MAX = 16;
export const STAT_FLOOR = 20;          // no severe-neglect states: stats never fall below this
export const STAT_MAX = 100;
export const GAMES = ['firefly', 'pondskip', 'birdsong', 'acorn', 'trail'];
export const THEMES = ['day', 'night'];
export const CARE_KINDS = ['pet', 'feed', 'play', 'wash', 'dry'];
export const GAME_MAX = { firefly: 12, pondskip: 8, birdsong: 40, acorn: 60, trail: 8 };
// Snacks are EARNED in the games and spent on friends. The bowl starts with a few so the
// first day works, and it has a ceiling so a stockpile never replaces playing.
export const SNACK_START = 3;
export const SNACK_MAX = 20;
export const GUEST_MAX = 6;          // visitors a camp can host at once

const num = (v, d, lo = -Infinity, hi = Infinity) =>
  (typeof v === 'number' && Number.isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : d;
const int = (v, d, lo = 0, hi = 1e9) => Math.floor(num(v, d, lo, hi));
const str = (v, d, max = 200) => (typeof v === 'string' ? v.slice(0, max) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Player-typed creature name → safe display string. Rendered with textContent only. */
export function cleanName(raw, fallback) {
  const s = String(raw ?? '')
    // ZWNJ/ZWJ (\u200c/\u200d) are kept: emoji sequences and Indic/Persian names need them
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(s).slice(0, NAME_MAX).join('');
  return chars || fallback;
}

export function newCreature(key, now, x = 0.42, y = 0.8) {
  const sp = BY_KEY[key];
  return {
    key,
    name: sp.name,
    expr: sp.rest,
    stats: { happiness: 70, hunger: 70, energy: 70, clean: 70 },
    x, y,
    unlockedMs: now,
    lastCareMs: 0,
    snackReadyMs: 0,       // snacks are on a per-creature timer, not endless
    contentUntilMs: 0,     // a friend just petted is content for a while — a creature state, not a clock
    hat: '',               // chosen by the player from the earned wardrobe
    cares: 0,              // counted care actions with THIS friend (the memento is at 12)
    memento: false,
    sudsUntilMs: 0,        // soap leaves suds; the cloth wipes them off
    countedMs: Object.fromEntries(CARE_KINDS.map((k) => [k, 0])),   // last time each care kind counted (anti-spam)
  };
}

export function createState(now, seed) {
  return {
    schemaVersion: SCHEMA_VERSION,
    loadedFrom: null,
    futureSave: false,
    seed: (seed >>> 0) || 1,
    createdMs: now,
    lastSimMs: now,
    lastSeenMs: now,
    tickIndex: 0,
    days: { base: 0, dates: [], last: '', count: 0 },
    returnDates: [],
    lastActionMs: now,
    codeTries: { fails: 0, windowMs: 0, restUntilMs: 0 },
    integrity: 'ok',
    snacks: SNACK_START,
    hats: [],
    guests: [],
    scene: DEFAULT_SCENE,
    sceneShuffle: false,
    creatures: [newCreature(STARTER_KEY, now)],
    stats: { care: 0, pets: 0, feeds: 0, plays: 0, washes: 0, drys: 0, interactions: 0, stones: 0, dew: 0, returns8h: 0, visits: 0, digests: 0, snacksEarned: 0 },
    nightDays: [],
    visit: { n: 0, fed: [] },
    games: Object.fromEntries(GAMES.map((g) => [g, { plays: 0, best: 0, cleared: false }])),
    flags: {},
    journal: { lostFawn: { step: 0, day: 0 }, quietPines: { step: 0, day: 0 } },
    stonesDay: '', stonesFlipped: [],
    dewNextMs: now,
    redeemed: [],
    feed: [],
    newKeys: [],
    shown: [STARTER_KEY],
    theme: 'day',
    settings: { sound: true, reducedMotion: false, assist: false, motionInit: false, ambience: false, ambienceVol: 0.5, screensaver: true },
    tutorial: { done: false },
  };
}

/** Version-aware upgrade. Returns a raw object at SCHEMA_VERSION shape (still unsanitised). */
export function migrate(raw) {
  const o = obj(raw);
  const from = Number.isInteger(o.schemaVersion) ? o.schemaVersion : 0;
  if (from > SCHEMA_VERSION) return { raw: o, from, future: true };
  let cur = { ...o };
  if (from < 1) {
    // v0 = the handoff-era draft shape: creatures[].speciesId, unlockedCodes[], activityFeed[].
    if (!Array.isArray(cur.creatures) && Array.isArray(o.creatureInstances)) cur.creatures = o.creatureInstances;
    cur.creatures = arr(cur.creatures).map((c) => ({ ...obj(c), key: obj(c).key ?? obj(c).speciesId }));
    if (!cur.feed && Array.isArray(o.activityFeed)) cur.feed = o.activityFeed;
    if (!cur.redeemed && Array.isArray(o.unlockedCodes)) cur.redeemed = [];   // plaintext codes are not carried
    if (Number.isFinite(o.lastSimulatedTimestamp)) cur.lastSimMs = o.lastSimulatedTimestamp;
  }
  // v1 -> v2: days became a date list (days.js cleanDays reads the old {count,last});
  // creatures gained clean / snack timer / suds fields (defaults fill them in).
  cur.schemaVersion = SCHEMA_VERSION;
  return { raw: cur, from, future: false };
}

function cleanGuest(raw, now) {
  const o = obj(raw);
  if (!BASES.includes(o.base)) return null;
  const st = obj(o.stats);
  const g = {
    id: typeof o.id === 'string' && /^[a-z0-9]{4,24}$/.test(o.id) ? o.id : `g${Math.floor(Math.random() * 1e9).toString(36)}`,
    base: o.base,
    tint: TINTS.some((t) => t.id === o.tint) ? o.tint : 0,
    hat: HAT_IDS.includes(o.hat) ? o.hat : '',
    name: cleanName(o.name, 'Visitor'),
    from: cleanName(o.from, ''),
    code: typeof o.code === 'string' ? o.code.slice(0, 120) : '',
    addedMs: num(o.addedMs, now, 0),
    x: num(o.x, 0.5, 0.05, 0.95),
    y: num(o.y, 0.8, 0.6, 0.96),
    expr: EXPRESSIONS.includes(o.expr) ? o.expr : 'curious',
    snackReadyMs: num(o.snackReadyMs, 0, 0, now + 3600_000),
    contentUntilMs: num(o.contentUntilMs, 0, 0, now + 3600_000),
    sudsUntilMs: num(o.sudsUntilMs, 0, 0, now + 3600_000),
    lastCareMs: num(o.lastCareMs, 0, 0),
    stats: {
      happiness: num(st.happiness, 75, STAT_FLOOR, STAT_MAX),
      hunger: num(st.hunger, 75, STAT_FLOOR, STAT_MAX),
      energy: num(st.energy, 75, STAT_FLOOR, STAT_MAX),
      clean: num(st.clean, 75, STAT_FLOOR, STAT_MAX),
    },
  };
  return guestMatchesCode(g) ? g : null;
}

export function newGuest(spec, now) {
  return cleanGuest({ ...spec, addedMs: now, x: 0.3 + Math.random() * 0.4, y: 0.74 + Math.random() * 0.18 }, now);
}

function cleanCreature(c, now) {
  const o = obj(c);
  if (!isSpecies(o.key)) return null;
  const sp = BY_KEY[o.key];
  const st = obj(o.stats);
  const cm = obj(o.countedMs);
  return {
    key: sp.key,
    name: cleanName(o.name, sp.name),
    expr: EXPRESSIONS.includes(o.expr) ? o.expr : sp.rest,
    stats: {
      happiness: num(st.happiness, 70, STAT_FLOOR, STAT_MAX),
      hunger: num(st.hunger, 70, STAT_FLOOR, STAT_MAX),
      energy: num(st.energy, 70, STAT_FLOOR, STAT_MAX),
      clean: num(st.clean, 70, STAT_FLOOR, STAT_MAX),
    },
    x: num(o.x, 0.5, 0.05, 0.95),
    y: num(o.y, 0.7, 0.45, 0.92),
    unlockedMs: num(o.unlockedMs, now, 0),
    lastCareMs: num(o.lastCareMs, 0, 0),
    snackReadyMs: num(o.snackReadyMs, 0, 0, now + 3600_000),
    contentUntilMs: num(o.contentUntilMs, 0, 0, now + 3600_000),
    hat: HAT_IDS.includes(o.hat) ? o.hat : '',
    cares: int(o.cares, 0, 0, 100000),
    memento: bool(o.memento, false),
    sudsUntilMs: num(o.sudsUntilMs, 0, 0, now + 3600_000),
    countedMs: Object.fromEntries(CARE_KINDS.map((k) => [k, num(cm[k], 0, 0, now + 3600_000)])),
    ...(typeof o.code === 'string' && /^[0-9a-f]{64}$/.test(o.code) ? { code: o.code } : {}),
  };
}

function cleanFeedEvent(e) {
  const o = obj(e);
  const text = str(o.text, '', 400);
  if (!text) return null;
  return {
    id: str(o.id, '', 40) || 'e' + Math.random().toString(36).slice(2, 10),
    t: num(o.t, 0, 0),
    type: ['unlock', 'interaction', 'digest', 'care', 'discovery', 'game', 'journal', 'mood', 'memento', 'hat'].includes(o.type) ? o.type : 'interaction',
    keys: arr(o.keys).filter(isSpecies).slice(0, 4),
    text,
    lines: arr(o.lines).filter((l) => typeof l === 'string').map((l) => l.slice(0, 300)).slice(0, 4),
  };
}

/**
 * Load path: migrate → sanitise. Survives any input (null, arrays, hostile
 * objects, prototype-pollution payloads) and always returns a playable state.
 */
export function load(raw, now, seed, { codeTable = CODE_TABLE } = {}) {
  if (raw == null) {
    const s = createState(now, seed);
    s.loadedFrom = 'fresh';
    return s;
  }
  const m = migrate(raw);
  const base = createState(now, seed);
  const o = m.raw;
  const s = base;
  s.loadedFrom = m.from;
  s.futureSave = m.future;
  s.seed = (int(o.seed, base.seed, 1, 0xffffffff) >>> 0) || base.seed;
  s.createdMs = num(o.createdMs, now, 0);
  s.lastSimMs = num(o.lastSimMs, now, 0);
  s.lastSeenMs = num(o.lastSeenMs, now, 0);
  s.tickIndex = int(o.tickIndex, 0);
  s.days = cleanDays(o.days);
  s.returnDates = [...new Set(arr(o.returnDates).filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort().slice(-60);
  s.lastActionMs = num(o.lastActionMs, s.lastSeenMs, 0);
  const ct = obj(o.codeTries);
  s.codeTries = { fails: int(ct.fails, 0, 0, 1000), windowMs: num(ct.windowMs, 0, 0), restUntilMs: num(ct.restUntilMs, 0, 0, now + 3600_000) };
  s.integrity = ['ok', 'repaired', 'restored'].includes(o.integrity) ? o.integrity : 'ok';
  // v2 and older saves predate the snack bowl: fill it rather than leave a friend unfeedable
  s.snacks = int(o.snacks, m.from < 3 ? SNACK_START : 0, 0, SNACK_MAX);
  s.hats = [...new Set(arr(o.hats).filter((x) => HAT_IDS.includes(x)))];
  // Visitors made from share codes. Each one must still match the code it arrived with,
  // so an edited save cannot mint a visitor that no code describes.
  s.guests = arr(o.guests).map((raw) => cleanGuest(raw, now)).filter(Boolean).slice(0, GUEST_MAX);
  s.scene = SCENE_IDS.includes(o.scene) ? o.scene : DEFAULT_SCENE;
  s.sceneShuffle = bool(o.sceneShuffle, false);

  const seen = new Set();
  const creatures = [];
  const redeemedIn = new Set(arr(o.redeemed));
  for (const c of arr(o.creatures)) {
    const cc = cleanCreature(c, now);
    // a code-pack creature is only kept when it carries a redeemed code that maps to it
    if (cc && BY_KEY[cc.key].pack !== 'base'
      && !(cc.code && redeemedIn.has(cc.code) && codeTable[cc.code] === cc.key)) continue;
    if (cc && !seen.has(cc.key)) { seen.add(cc.key); creatures.push(cc); }
  }
  if (!seen.has(STARTER_KEY)) creatures.unshift(base.creatures[0]);
  s.creatures = creatures;

  const st = obj(o.stats);
  for (const k of Object.keys(base.stats)) s.stats[k] = int(st[k], 0);
  s.nightDays = [...new Set(arr(o.nightDays).filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)))].slice(-60);
  const v = obj(o.visit);
  s.visit = { n: int(v.n, 0), fed: [...new Set(arr(v.fed).filter(isSpecies))] };
  const g = obj(o.games);
  for (const name of Object.keys(base.games)) {
    const gg = obj(g[name]);
    s.games[name] = { plays: int(gg.plays, 0), best: int(gg.best, 0, 0, GAME_MAX[name]), cleared: bool(gg.cleared, false) };
  }
  const f = obj(o.flags);
  s.flags = {};
  for (const k of Object.keys(f)) if (/^[a-z0-9_]{1,40}$/i.test(k) && f[k] === true) s.flags[k] = true;
  const j = obj(o.journal);
  for (const q of Object.keys(base.journal)) {
    const jj = obj(j[q]);
    s.journal[q] = { step: int(jj.step, 0, 0, 10), day: int(jj.day, 0, 0, 100000) };
  }
  s.stonesDay = typeof o.stonesDay === 'string' ? o.stonesDay.slice(0, 10) : '';
  s.stonesFlipped = [...new Set(arr(o.stonesFlipped).filter((n) => Number.isInteger(n) && n >= 0 && n < 12))];
  s.dewNextMs = num(o.dewNextMs, now, 0);
  s.redeemed = [...new Set(arr(o.redeemed).filter((h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h)))];
  s.feed = arr(o.feed).map(cleanFeedEvent).filter(Boolean).slice(-FEED_CAP);
  const ownedKeys = new Set(s.creatures.map((c) => c.key));
  s.newKeys = [...new Set(arr(o.newKeys).filter((k) => ownedKeys.has(k)))];
  // arrivals already celebrated (owned friends only); an old save without the list treats every owned friend as shown
  s.shown = Array.isArray(o.shown) ? [...new Set([STARTER_KEY, ...o.shown.filter((k) => ownedKeys.has(k))])] : [...ownedKeys];
  s.theme = THEMES.includes(o.theme) ? o.theme : 'day';
  const se = obj(o.settings);
  s.settings = {
    sound: bool(se.sound, true),
    reducedMotion: bool(se.reducedMotion, false),
    assist: bool(se.assist, false),
    motionInit: bool(se.motionInit, false),
    ambience: bool(se.ambience, false),          // off until the player asks for it
    ambienceVol: num(se.ambienceVol, 0.5, 0, 1),
    screensaver: bool(se.screensaver, true),
  };
  s.tutorial = { done: bool(obj(o.tutorial).done, false) };
  return s;
}

export function owned(state, key) { return state.creatures.some((c) => c.key === key); }
export function ownedCount(state, pack = null) {
  return state.creatures.filter((c) => !pack || SPECIES.find((s) => s.key === c.key)?.pack === pack).length;
}

let _eid = 0;
export function pushFeed(state, ev) {
  const e = { id: `e${ev.t.toString(36)}-${(_eid++).toString(36)}`, lines: [], keys: [], ...ev };
  state.feed.push(e);
  if (state.feed.length > FEED_CAP) state.feed.splice(0, state.feed.length - FEED_CAP);
  return e;
}
