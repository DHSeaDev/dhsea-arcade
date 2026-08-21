// Bonus rounds. All pure: (rand, stake) -> a fully-described transcript the UI
// replays and the sim measures. No timers, no DOM.

import { spin } from './reels.js';
import { weightedPick } from './rng.js';
import {
  LINES, HOLD_RESPINS, HOLD_COIN_VALUES, HOLD_JACKPOTS, HOLD_GRID_CELLS,
  FREESPIN_RETRIGGER_CAP, CASCADE_MULTS, WHEEL_PRIZES, WHEEL_PRIZE_CAP, WHEEL_MUSTHIT,
} from './constants.js';

// --- Crystallize (hold & spin) ---------------------------------------------
// Coins lock. Three respins. Every NEW coin resets the counter to 3. Fill the
// whole 15-cell grid for the Grand. The resetting counter is the whole feel.
const COIN_WEIGHTS = [
  { w: 40, v: HOLD_COIN_VALUES[0] },
  { w: 25, v: HOLD_COIN_VALUES[1] },
  { w: 18, v: HOLD_COIN_VALUES[2] },
  { w: 10, v: HOLD_COIN_VALUES[3] },
  { w: 5,  v: HOLD_COIN_VALUES[4] },
  { w: 2,  v: HOLD_COIN_VALUES[5] },
];
const JACKPOT_WEIGHTS = [
  { w: 960, k: null },
  { w: 30,  k: 'mini' },
  { w: 8,   k: 'minor' },
  { w: 2,   k: 'major' },
];
const RESPIN_HIT_CHANCE = 0.07;   // per empty cell, per respin

export function runHoldAndSpin(rand, stake, seedCells) {
  const totalBet = stake * LINES;
  const locked = new Map();               // cellIndex -> {value, jackpot}
  const steps = [];

  const put = (idx) => {
    const jp = weightedPick(rand, JACKPOT_WEIGHTS).k;
    const val = jp ? HOLD_JACKPOTS[jp] : weightedPick(rand, COIN_WEIGHTS).v;
    locked.set(idx, { value: val, jackpot: jp });
  };

  for (const [reel, row] of seedCells) put(reel * 3 + row);
  steps.push({ kind: 'seed', locked: [...locked.keys()], respinsLeft: HOLD_RESPINS });

  let respins = HOLD_RESPINS;
  while (respins > 0 && locked.size < HOLD_GRID_CELLS) {
    respins--;
    const landed = [];
    for (let i = 0; i < HOLD_GRID_CELLS; i++) {
      if (locked.has(i)) continue;
      if (rand() < RESPIN_HIT_CHANCE) { put(i); landed.push(i); }
    }
    if (landed.length > 0) respins = HOLD_RESPINS;
    steps.push({ kind: 'respin', landed, respinsLeft: respins, total: locked.size });
  }

  const gridFull = locked.size >= HOLD_GRID_CELLS;
  let units = 0;
  for (const c of locked.values()) units += c.value;
  if (gridFull) units += HOLD_JACKPOTS.grand;

  return {
    kind: 'hold',
    steps,
    cells: [...locked.entries()].map(([i, c]) => ({ cell: i, ...c })),
    gridFull,
    facets: units * totalBet,
  };
}

// --- Free spins -------------------------------------------------------------
// Richer strip set, expanding wilds on reels 2-4, x2 on any wild-assisted line.
// Retrigger adds spins, capped. Cap is stated, never silent.
export function runFreeSpins(rand, stake, awarded) {
  let remaining = awarded;
  let granted = awarded;
  let facets = 0;
  const spins = [];
  let guard = 0;

  while (remaining > 0 && guard++ < FREESPIN_RETRIGGER_CAP + 50) {
    remaining--;
    const out = spin(rand, stake, 'free');
    if (out.freeSpinsAwarded > 0 && granted < FREESPIN_RETRIGGER_CAP) {
      const add = Math.min(out.freeSpinsAwarded, FREESPIN_RETRIGGER_CAP - granted);
      remaining += add;
      granted += add;
      out.retriggered = add;
    }
    facets += out.facets;
    spins.push(out);
  }
  return {
    kind: 'free', granted, spins, facets,
    cappedAt: granted >= FREESPIN_RETRIGGER_CAP ? FREESPIN_RETRIGGER_CAP : null,
  };
}

// --- Cascade [UNWIRED SPEC — no caller] --------------------------------------
// Kept deliberately, not dead code: cascading reels are a specified-but-unbuilt
// feature carried since v0.2.0. Nothing calls this. If cascades are cut for good,
// delete this block AND CASCADE_MULTS in constants.js together.
// --- Cascade ----------------------------------------------------------------
// Winning cells clear, the column falls, new symbols drop in, re-evaluate. The
// multiplier climbs per cascade and resets every base spin.
export function cascadeMultiplier(step) {
  return CASCADE_MULTS[Math.min(step, CASCADE_MULTS.length - 1)];
}

// --- The Prism Wheel (five Fortunes) ---------------------------------------
// 5 Wild Buffalo's Boosting Fortunes, restated in this economy: every Lumen Core
// that lands feeds one of five prizes, and filling the Prism Meter spins the
// wheel to pay one out. The prizes are stored as MULTIPLIERS of the total bet, so
// a prize grown at stake 1 is still worth something at stake 10,000 — otherwise
// the ladder would be worthless the moment the player levelled up.

export function freshPrizes() {
  const p = {};
  for (const w of WHEEL_PRIZES) p[w.id] = w.base;
  return p;
}

/** Feed the ladder. Low tiers grow faster; every prize is capped. */
export function growPrizes(prizes, coins, rand) {
  const grown = [];
  for (let i = 0; i < coins; i++) {
    const pick = weightedPick(rand, WHEEL_PRIZES.map((w) => ({ w: w.w, id: w.id, growth: w.growth })));
    const def = WHEEL_PRIZES.find((w) => w.id === pick.id);
    const cap = def.base * WHEEL_PRIZE_CAP;
    const next = Math.min(cap, (prizes[pick.id] ?? def.base) + pick.growth);
    if (next !== prizes[pick.id]) grown.push(pick.id);
    prizes[pick.id] = next;
  }
  return grown;
}

/** Spin the wheel. Returns the winning prize and resets it to base. */
/**
 * How many wheel spins remain before each must-hit prize is guaranteed.
 * `since` counts spins since that prize last landed.
 */
/**
 * How much earlier than its published ceiling a prize must be forced, because a
 * HIGHER-ranked must-hit prize can preempt it on the very spin it came due.
 *
 * Ultra outranks Mega, so with `n - 1` alone Mega's deadline could slip by one spin
 * every time both were due together — measured max gap 35 against a published 34.
 * Each prize therefore reserves one spin of slack per prize that can jump ahead of it.
 */
function mustHitSlack(id) {
  const rank = (x) => WHEEL_PRIZES.findIndex((w) => w.id === x);
  return Object.keys(WHEEL_MUSTHIT).filter((o) => rank(o) > rank(id)).length;
}

export function mustHitLeft(since = {}) {
  const out = {};
  // n - 1, matching the trigger below. The published sentence is "lands at least once
  // every N wheel spins", which is a claim about the GAP BETWEEN HITS, not about the
  // run of misses — and those differ by exactly one. Forcing at `since >= n` allowed a
  // gap of n+1 and made the printed promise false by one spin. Two of this project's
  // own harnesses disagreed about it, which is what surfaced it.
  for (const [id, n] of Object.entries(WHEEL_MUSTHIT)) out[id] = Math.max(0, (n - 1 - mustHitSlack(id)) - (since[id] || 0));
  return out;
}

/**
 * @param {object} prizes  live ladder values
 * @param {number} stake
 * @param {function} rand
 * @param {object} since   spins since each must-hit prize last landed (mutated)
 */
export function spinWheel(prizes, stake, rand, since = {}) {
  // MUST-HIT-BY resolves BEFORE the random pick, highest tier first. It can only ever
  // upgrade the result, and it fires on a published counter the player has been
  // watching fall — this is a guarantee, not a nudge.
  let forced = null;
  for (const id of Object.keys(WHEEL_MUSTHIT).sort(
    (a, b) => WHEEL_PRIZES.findIndex((w) => w.id === b) - WHEEL_PRIZES.findIndex((w) => w.id === a))) {
    if ((since[id] || 0) >= WHEEL_MUSTHIT[id] - 1 - mustHitSlack(id)) { forced = id; break; }
  }
  const pick = forced ? { id: forced } : weightedPick(rand, WHEEL_PRIZES.map((w) => ({ w: w.w, id: w.id })));

  // Every must-hit counter advances; the one that landed resets.
  for (const id of Object.keys(WHEEL_MUSTHIT)) since[id] = (since[id] || 0) + 1;
  if (Object.prototype.hasOwnProperty.call(WHEEL_MUSTHIT, pick.id)) since[pick.id] = 0;

  const def = WHEEL_PRIZES.find((w) => w.id === pick.id);
  const value = prizes[pick.id] ?? def.base;
  prizes[pick.id] = def.base;
  return {
    kind: 'wheel',
    id: def.id,
    name: def.name,
    multiplier: value,
    facets: value * stake * LINES,
    mustHit: !!forced,
    // The full ladder as it stood when the wheel was spun, so the UI can show
    // what was on the board and not just what was won.
    board: WHEEL_PRIZES.map((w) => ({ id: w.id, name: w.name, value: prizes[w.id] ?? w.base })),
  };
}
