// The camp engine. PURE: every function takes `now` and mutates only `state`.
//
// Time model (Lumenreel pattern, sw.js holds no state): elapsed time is computed
// from state.lastSimMs whenever the panel is open. Time away and time watching
// run through the SAME tick() — there is no separate offline path to get wrong.
//
// Catch-up rules:
//   * lastSimMs advances by exactly the ticks simulated (remainder carried), so a
//     second tick() call over the same window simulates nothing.
//   * A gap larger than the cap simulates MAX_CATCHUP ticks and drops the rest of
//     the debt (lastSimMs = now). A 30-day absence is 10 ticks, not 28,800.
//   * A clock set backwards simulates nothing. A small rollback (< 6 h: DST, NTP) keeps
//     the anchor, so the same window can never be simulated twice. A large rollback (a
//     wrong future clock being corrected) re-anchors; the worst case is ONE capped batch
//     replayed — the same as an honest 15-minute wait, stated rather than hidden.
//   * A large batch is written as ONE digest event, not a wall of lines.

import { SPECIES, BY_KEY, STARTER_KEY } from './species.js';
import { mulberry32, pickIndex } from '../vendor/rng.js';
import { markActiveDetail, activeDay, localDate } from './days.js';
import { STAT_FLOOR, STAT_MAX, newCreature, pushFeed, owned, cleanName, GAMES, GAME_MAX, CARE_KINDS, SNACK_MAX } from './state.js';
import { pendingUnlocks, UNLOCKS, gameOpen, STONES_OPEN_DAY, LOST_FAWN_DAY, QUIET_PINES_DAY } from './unlocks.js';
import { grantHats, mementoReady, mementoFor } from './cosmetics.js';
import { meetingLine, careLine, ARRIVALS, DIGEST_HEADERS } from './chatter.js';

export const TICK_MS = 90_000;
export const MAX_CATCHUP = 10;
export const DIGEST_MIN = 4;
export const RETURN_GAP_MS = 8 * 3600_000;
export const DEW_EVERY_MS = 60_000;
export const STONE_COUNT = 6;
export const REANCHOR_MS = 6 * 3600_000;
export const SNACK_COOLDOWN_MS = 10 * 60_000;   // one snack per creature per 10 minutes
export const FULL_AT = 95;                      // a full creature politely declines
export const COUNT_EVERY_MS = 30_000;           // care counts toward goals at most this often, per creature per kind
export const SUDS_MS = 10 * 60_000;
export const CONTENT_MS = 60_000;            // a petted friend is content for a minute
export const PLAY_MIN_ENERGY = 30;           // a tired friend would rather rest than chase a ball
export const SNACK_PER_ROUND = 1;            // snacks are WON, never conjured
export const SNACK_PER_BEST = 1;
export const SNACK_PER_FIRST_CLEAR = 2;

const DECAY = { hunger: 0.6, happiness: 0.3, clean: 0.25 };
const clampStat = (v) => Math.min(STAT_MAX, Math.max(STAT_FLOOR, v));

/** Drop date-stamped progress that a corrected clock revoked (days.js). */
function revokeDates(state, today) {
  state.nightDays = state.nightDays.filter((d) => d <= today);
  state.returnDates = state.returnDates.filter((d) => d <= today);
  state.stats.returns8h = state.returnDates.length;
}

/**
 * A "long rest" is 8 h with no player action (panel closed OR left open and idle),
 * recorded once per calendar date so a clock pushed forward and back gains nothing
 * that survives the correction.
 */
function noteReturn(state, now) {
  if (now < state.lastActionMs) { state.lastActionMs = now; return false; }
  const rested = now - state.lastActionMs >= RETURN_GAP_MS && state.days.count > 0;
  state.lastActionMs = now;
  if (!rested) return false;
  const today = localDate(now);
  if (!today || state.returnDates.includes(today)) return false;
  state.returnDates.push(today);
  if (state.returnDates.length > 60) state.returnDates.splice(0, state.returnDates.length - 60);
  state.stats.returns8h = state.returnDates.length;
  return true;
}

/** Any player action: counts a new active day, notes a long rest, revokes future-dated progress. */
function act(state, now) {
  const r = markActiveDetail(state, now);
  if (r.revoked.length) revokeDates(state, localDate(now));
  const returned = noteReturn(state, now);
  return { newDay: r.counted, returned };
}
const voiceOf = (key) => BY_KEY[key]?.voice || 'curious';

function restingExpr(c) {
  const sp = BY_KEY[c.key];
  if (c.stats.energy < 32) return 'sleepy';
  if (c.stats.happiness > 88) return 'happy';
  return sp.rest;
}

/** Start of a panel visit. Counts active days, long returns, resets visit scope. */
export function beginVisit(state, now) {
  if (state.futureSave) return { newDay: false, returned: false };
  const out = act(state, now);
  state.stats.visits += 1;
  state.visit = { n: state.visit.n + 1, fed: [] };
  if (state.theme === 'night') noteNight(state, now);
  refreshStones(state, now);
  return out;
}

/** Advance simulated time. Returns {ticks, digest, events}. */
export function tick(state, now) {
  const res = { ticks: 0, digest: null, events: [], unlocked: [] };
  if (state.futureSave || !Number.isFinite(now)) return res;
  if (now < state.lastSimMs) {
    if (state.lastSimMs - now > REANCHOR_MS) state.lastSimMs = now;
    return res;
  }
  const elapsed = now - state.lastSimMs;
  let n = Math.floor(elapsed / TICK_MS);
  if (n <= 0) { state.lastSeenMs = now; return res; }
  if (n > MAX_CATCHUP) { n = MAX_CATCHUP; state.lastSimMs = now; }
  else state.lastSimMs += n * TICK_MS;
  state.lastSeenMs = now;

  const lines = [];
  const meetKeys = new Set();
  for (let i = 0; i < n; i++) {
    const idx = state.tickIndex++;
    for (const c of state.creatures) {
      for (const k of Object.keys(DECAY)) c.stats[k] = clampStat(c.stats[k] - DECAY[k]);
      // energy is not a one-way drain: a tired creature naps and recovers
      c.stats.energy = clampStat(c.stats.energy + (c.stats.energy < 45 ? 1.5 : -0.4));
    }
    if (state.creatures.length >= 2) {
      const r = mulberry32((state.seed ^ Math.imul(idx + 7, 0x85ebca6b)) >>> 0);
      const ai = pickIndex(r, state.creatures.length);
      let bi = pickIndex(r, state.creatures.length - 1);
      if (bi >= ai) bi += 1;
      const a = state.creatures[ai], b = state.creatures[bi];
      a.stats.happiness = clampStat(a.stats.happiness + 2);
      b.stats.happiness = clampStat(b.stats.happiness + 2);
      state.stats.interactions += 1;
      meetKeys.add(a.key); meetKeys.add(b.key);
      lines.push({ text: meetingLine(voiceOf(a.key), a.name, b.name, state.seed, idx), keys: [a.key, b.key] });
    }
  }
  for (const c of state.creatures) c.expr = restingExpr(c);
  res.ticks = n;

  if (lines.length >= DIGEST_MIN) {
    const hdr = DIGEST_HEADERS[state.stats.digests % DIGEST_HEADERS.length];
    state.stats.digests += 1;
    const picks = [lines[0], lines[Math.floor(lines.length / 2)], lines[lines.length - 1]];
    const uniq = [...new Set(picks.map((l) => l.text))];
    res.digest = pushFeed(state, {
      t: now, type: 'digest', keys: [...meetKeys].slice(0, 4),
      text: `${hdr} (${lines.length} meetings)`, lines: uniq,
    });
  } else {
    for (const l of lines) res.events.push(pushFeed(state, { t: now, type: 'interaction', keys: l.keys, text: l.text }));
  }
  res.unlocked = applyUnlocks(state, now);
  return res;
}

/** Grant every ready unlock. Returns the keys granted. */
export function applyUnlocks(state, now) {
  const newHats = grantHats(state);
  for (const id of newHats) pushFeed(state, { t: now, type: 'hat', keys: [], text: `A new hat for the wardrobe: ${id === 'crown' ? 'a crown of twigs' : id === 'acorn' ? 'an acorn cap' : `a ${id} hat`}.` });
  const got = [];
  if (state.futureSave) return got;
  for (const key of pendingUnlocks(state)) {
    grant(state, key, now);
    got.push(key);
  }
  return got;
}

function grant(state, key, now) {
  // spread arrivals along the camp floor (golden-ratio stepping never stacks two friends)
  const i = state.creatures.length;
  const x = 0.14 + ((i * 0.618034) % 1) * 0.72;
  const y = 0.72 + ((i * 0.381966) % 1) * 0.2;
  state.creatures.push(newCreature(key, now, x, y));
  if (!state.newKeys.includes(key)) state.newKeys.push(key);
  state.shown = state.shown.filter((k) => k !== key);   // every arrival is celebrated exactly once
  pushFeed(state, { t: now, type: 'unlock', keys: [key], text: ARRIVALS[key] || `${BY_KEY[key].name} has joined the camp.` });
}

/** Snack timer and suds for one creature (for the UI; pure). */
/** A friend or a visitor, by key ('ember') or guest key ('g:<id>'). */
export function beingOf(state, key) {
  if (typeof key === 'string' && key.startsWith('g:')) return (state.guests || []).find((g) => `g:${g.id}` === key) || null;
  return state.creatures.find((x) => x.key === key) || null;
}
export const isGuestKey = (key) => typeof key === 'string' && key.startsWith('g:');

export function careStatus(state, key, now) {
  const c = beingOf(state, key);
  if (!c) return null;
  const readyIn = Math.max(0, Math.min(SNACK_COOLDOWN_MS, c.snackReadyMs - now));
  return {
    snackReadyInMs: readyIn,
    full: c.stats.hunger >= FULL_AT,
    suds: now < c.sudsUntilMs,
    content: now < c.contentUntilMs,
    tired: c.stats.energy < PLAY_MIN_ENERGY,
    snacks: state.snacks,
  };
}

/**
 * Care with a tool: 'pet' (hand) | 'feed' (snack) | 'play' (ball) | 'wash' (soap) | 'dry' (cloth).
 * Returns { ok, line, counted } or { ok:false, reason: 'readonly'|'invalid'|'resting'|'full', readyInMs }.
 * Snacks are on a per-creature timer. Every kind counts toward goals at most once per
 * COUNT_EVERY_MS per creature, so an auto-clicker cannot farm "care" milestones.
 */
export function care(state, key, kind, now) {
  if (state.futureSave) return { ok: false, reason: 'readonly' };
  const c = beingOf(state, key);
  const guest = isGuestKey(key);
  if (!c || !CARE_KINDS.includes(kind) || !Number.isFinite(now)) return { ok: false, reason: 'invalid' };
  act(state, now);   // the player is here even when the friend says no: time and revocation still run
  if (kind === 'feed') {
    if (c.snackReadyMs > now + SNACK_COOLDOWN_MS) c.snackReadyMs = now + SNACK_COOLDOWN_MS;   // clock set back
    if (state.snacks <= 0) return { ok: false, reason: 'nosnacks' };
    if (now < c.snackReadyMs) return { ok: false, reason: 'resting', readyInMs: c.snackReadyMs - now };
    if (c.stats.hunger >= FULL_AT) return { ok: false, reason: 'full' };
  }
  if (kind === 'pet') {
    if (c.contentUntilMs > now + CONTENT_MS) c.contentUntilMs = now + CONTENT_MS;             // clock set back
    if (now < c.contentUntilMs) return { ok: false, reason: 'content' };
  }
  if (kind === 'play' && c.stats.energy < PLAY_MIN_ENERGY) return { ok: false, reason: 'tired' };
  const s = c.stats;
  const suds = now < c.sudsUntilMs;
  if (kind === 'pet') { s.happiness = clampStat(s.happiness + 8); c.contentUntilMs = now + CONTENT_MS; }
  if (kind === 'feed') { s.hunger = clampStat(s.hunger + 30); s.happiness = clampStat(s.happiness + 3); s.energy = clampStat(s.energy + 4); c.snackReadyMs = now + SNACK_COOLDOWN_MS; state.snacks = Math.max(0, state.snacks - 1); }
  if (kind === 'play') { s.happiness = clampStat(s.happiness + 10); s.energy = clampStat(s.energy - 4); }
  if (kind === 'wash') { s.clean = clampStat(s.clean + 10); s.happiness = clampStat(s.happiness + 2); c.sudsUntilMs = now + SUDS_MS; }
  if (kind === 'dry') {
    if (suds) { s.clean = clampStat(s.clean + 40); s.happiness = clampStat(s.happiness + 8); c.sudsUntilMs = 0; }
    else { s.clean = clampStat(s.clean + 5); s.happiness = clampStat(s.happiness + 4); }
  }
  c.lastCareMs = now;
  if (guest) {
    // A visitor is someone else's creation: it can be looked after, and it earns nothing.
    // Goals, mementos and the roster all read state.creatures, which guests are never in.
    c.expr = kind === 'play' ? 'happy' : kind === 'wash' ? 'alarmed' : 'curious';
    const gline = careLine(kind, 'curious', c.name, 1);
    return { ok: true, line: gline, counted: false, guest: true, suds: now < c.sudsUntilMs, memento: null };
  }
  const last = c.countedMs[kind] || 0;
  if (last > now) c.countedMs[kind] = now;                      // clock set back: no free count
  const counted = last <= now && now - last >= COUNT_EVERY_MS;
  if (counted) {
    c.countedMs[kind] = now;
    c.cares = (c.cares || 0) + 1;
    state.stats.care += 1;
    const statKey = { pet: 'pets', feed: 'feeds', play: 'plays', wash: 'washes', dry: 'drys' }[kind];
    state.stats[statKey] += 1;
  }
  c.expr = kind === 'play' ? 'happy' : kind === 'pet' ? (BY_KEY[key].voice === 'smug' ? 'smug' : 'happy') : kind === 'wash' ? 'alarmed' : 'proud';
  if (key === STARTER_KEY) {
    if (kind === 'pet') state.flags.pet_starter = true;
    if (kind === 'feed') state.flags.fed_starter = true;
  }
  if (kind === 'feed' && !state.visit.fed.includes(key)) {
    state.visit.fed.push(key);
    if (state.visit.fed.length >= 3) state.flags.midnight_snack = true;
  }
  const line = careLine(kind, voiceOf(key), c.name, state.stats.care + (suds ? 1 : 0));
  if (counted) pushFeed(state, { t: now, type: 'care', keys: [key], text: line });
  // a friend you have looked after for a while brings you something of its own
  let memento = null;
  if (counted && mementoReady(c)) {
    c.memento = true;
    memento = mementoFor(key);
    if (memento) pushFeed(state, { t: now, type: 'memento', keys: [key], text: memento.line });
  }
  applyUnlocks(state, now);
  return { ok: true, line, counted, suds: now < c.sudsUntilMs, memento };
}

export function rename(state, key, raw, now) {
  if (state.futureSave) return false;
  const c = state.creatures.find((x) => x.key === key);
  if (!c) return false;
  c.name = cleanName(raw, BY_KEY[key].name);
  if (key === STARTER_KEY) state.flags.named_starter = true;
  applyUnlocks(state, now);
  return true;
}

/**
 * Plausibility rules for a finished round. `receipt` comes from the game UI:
 * { elapsedMs, units } where units = catches | throws | drops | turns (notes for birdsong).
 * A round that is faster than a person can play, or scores more than its own
 * actions allow, is not recorded at all (anti-automation; shard A forged 11-high
 * acorn stacks in 68 ms and 1e9 scores before this existed).
 */
export const ROUND_RULES = {
  firefly: (r, score, cleared) => score === r.units && r.units <= 12 && (!cleared || r.units === 12) && r.elapsedMs >= r.units * 150,
  pondskip: (r, score, cleared) => !cleared && r.units >= 1 && r.units <= 5 && score <= 8 && r.elapsedMs >= (r.units - 1) * 600 + 250,
  birdsong: (r, score, cleared) => !cleared && score <= 40 && r.elapsedMs >= ((score * (score + 1)) / 2) * 300,
  acorn: (r, score, cleared) => !cleared && score <= r.units && r.elapsedMs >= r.units * 250,
  trail: (r, score, cleared) => score <= 8 && r.units >= score && (!cleared || (score === 8 && r.units >= 8)) && r.elapsedMs >= r.units * 400,
};

export function roundPlausible(name, score, cleared, receipt) {
  const rule = Object.hasOwn(ROUND_RULES, name) ? ROUND_RULES[name] : null;
  const r = receipt && typeof receipt === 'object' ? receipt : null;
  if (!rule || !r || !Number.isFinite(r.elapsedMs) || r.elapsedMs < 0 || !Number.isInteger(r.units) || r.units < 0) return false;
  if (!Number.isInteger(score) || score < 0 || score > GAME_MAX[name]) return false;
  return rule(r, score, !!cleared);
}

/** Record a finished minigame round. Scores are fixed thresholds — no reward roll. */
export function recordGame(state, name, score, cleared, now, receipt) {
  const out = { recorded: false, rejected: false, unlocked: [], snacks: 0 };
  if (state.futureSave || !GAMES.includes(name) || !gameOpen(state, name)) return out;
  if (!roundPlausible(name, score, cleared, receipt)) { out.rejected = true; return out; }
  act(state, now);
  const g = state.games[name];
  g.plays += 1;
  const best = score > g.best;
  if (best) g.best = score;
  const firstClear = cleared && !g.cleared;
  if (cleared) g.cleared = true;
  // only news reaches the camp feed: a new best or a first clear (spam cannot bury the diary)
  if (best || firstClear) pushFeed(state, { t: now, type: 'game', keys: [], text: gameLine(name, score, firstClear, best) });
  // snacks are the games' reward: a friend can only be fed with something that was won
  const won = Math.min(SNACK_MAX - state.snacks, SNACK_PER_ROUND + (best ? SNACK_PER_BEST : 0) + (firstClear ? SNACK_PER_FIRST_CLEAR : 0));
  if (won > 0) { state.snacks += won; state.stats.snacksEarned += won; }
  out.snacks = won;
  out.recorded = true;
  out.unlocked = applyUnlocks(state, now);
  return out;
}

function gameLine(name, s, cleared, best) {
  const label = { firefly: 'Firefly Lantern', pondskip: 'Pond Skip', birdsong: 'Birdsong Echo', acorn: 'Acorn Stack', trail: 'Trail Memory' }[name];
  if (cleared) return `${label}: cleared. The camp cheered.`;
  return `${label}: ${s}.${best ? ' A new personal best.' : ''}`;
}

// --- stones (Nib) ----------------------------------------------------------
export function refreshStones(state, now) {
  const today = localDate(now);
  if (state.stonesDay !== today) { state.stonesDay = today; state.stonesFlipped = []; }
}
export function stonesOpen(state) { return activeDay(state) >= STONES_OPEN_DAY; }
export function flipStone(state, i, now) {
  if (state.futureSave || !stonesOpen(state) || !Number.isInteger(i) || i < 0 || i >= STONE_COUNT) return false;
  act(state, now);
  refreshStones(state, now);
  if (state.stonesFlipped.includes(i)) return false;
  state.stonesFlipped.push(i);
  state.stats.stones += 1;
  applyUnlocks(state, now);
  return true;
}

// --- dew (Lichen) ------------------------------------------------------------
export function dewReady(state, now) {
  // a dew timer set by a wrong future clock must not freeze dew once the clock is fixed
  if (!Number.isFinite(now)) return false;
  if (state.dewNextMs > now + DEW_EVERY_MS) state.dewNextMs = now + DEW_EVERY_MS;
  return now >= state.dewNextMs;
}
export function collectDew(state, now) {
  if (state.futureSave || !dewReady(state, now)) return false;
  act(state, now);
  state.stats.dew += 1;
  state.dewNextMs = now + DEW_EVERY_MS;
  applyUnlocks(state, now);
  return true;
}

// --- night (Morrow) ----------------------------------------------------------
export function noteNight(state, now) {
  const d = localDate(now);
  if (!d) return;
  if (!state.nightDays.includes(d)) state.nightDays.push(d);
  if (state.nightDays.length > 60) state.nightDays.splice(0, state.nightDays.length - 60);
}
export function setTheme(state, theme, now) {
  if (state.futureSave || !['day', 'night'].includes(theme)) return;
  state.theme = theme;
  if (theme === 'night' && !state.futureSave) { noteNight(state, now); applyUnlocks(state, now); }
}

// --- journal -----------------------------------------------------------------
export const JOURNAL = {
  lostFawn: {
    title: 'The Lost Fawn',
    opensDay: LOST_FAWN_DAY,
    steps: [
      { text: 'Small hoofprints lead from the creek into the ferns. Something young passed through, alone.', action: 'Follow the hoofprints' },
      { text: 'The prints stop at a clearing. A clover left here might say: this is a safe place.', action: 'Leave a clover in the clearing' },
      { text: 'The clover is gone. Nearby, the ferns are pressed flat, as if something slept there.', action: 'Wait quietly by the clearing' },
    ],
    done: 'The fawn followed the clover trail home. She has a name now: Juniper.',
  },
  quietPines: {
    title: 'The Quiet in the Pines',
    opensDay: QUIET_PINES_DAY,
    steps: [
      { text: 'Some evenings the whole camp goes silent at once. Every creature turns toward the tall pines.', action: 'Listen at the edge of the pines' },
      { text: 'You heard it: not a sound, but the space where one should be. It feels like being welcomed.', action: 'Turn the lantern low and wait' },
    ],
    done: 'Everyone is here. The quiet between the pines has come to sit with you.',
  },
};

/** One step per ACTIVE day, never two in the same day. */
export function journalCanAdvance(state, q) {
  if (!Object.hasOwn(JOURNAL, q)) return false;
  const j = state.journal[q];
  const def = JOURNAL[q];
  if (j.step >= def.steps.length) return false;
  const day = activeDay(state);
  if (day < def.opensDay + j.step) return false;
  return j.step === 0 || day > j.day;
}

export function journalAdvance(state, q, now) {
  if (state.futureSave || !journalCanAdvance(state, q)) return false;
  const j = state.journal[q];
  j.step += 1;
  j.day = activeDay(state);
  const def = JOURNAL[q];
  pushFeed(state, { t: now, type: 'journal', keys: [], text: `Journal, ${def.title}: ${def.steps[j.step - 1].action.toLowerCase()}.` });
  applyUnlocks(state, now);
  return true;
}

export function finishTutorial(state) { if (!state.futureSave) state.tutorial.done = true; }

export { owned, SPECIES, UNLOCKS };
