// Pure state machine. No DOM, no chrome.*, no Date.now(). Every mutation takes an
// explicit elapsed/now argument so the whole game can be fast-forwarded headlessly.
// storage.js is the single impure boundary (Singularity Tower architecture).

import {
  ACCRUAL, GENERATORS, GEN_MAX_OWNED, LINES, STAKES, TIERS,
  METER_MAX, VERSION, WHEEL_PRIZES, WHEEL_PRIZE_CAP, STARTING_LUMENS, ARCADE_TOKEN_CHANCE, WHEEL_MUSTHIT,
  YARD_CAP,
} from './constants.js';
import { spin } from './reels.js';
import { runHoldAndSpin, runFreeSpins, freshPrizes, growPrizes, spinWheel } from './features.js';
import {
  accrue, lumenRate, generatorCost, maxAffordable, bulkCost,
  unlockedStakes, unlockedGenerators,
} from './economy.js';
import { draw, drawGacha, spark, applyAcquire, tierState, setProgress, milestonesReached, coreOwned } from './collection.js';
import { SPECIES, ALL_SPECIES } from './species.js';
import { ARCADE, arcadeReward, markPlayed, grantFreePlay, freePlays } from './arcade.js';
import { ACHIEVEMENTS, resolveReward } from './achievements.js';
import { turboBudget, refreshTurbo } from './turbo.js';
import { QUICKENED } from './constants.js';

export function createState() {
  const ownedByTier = {};
  for (const t of TIERS) ownedByTier[t.id] = 0;
  const generators = {};
  for (const g of GENERATORS) generators[g.id] = 0;
  return {
    version: VERSION,
    // The version the save was LOADED from, so a later migration can tell what it is
    // looking at and a bug report can say which shape produced it. Never persisted as
    // authoritative — `version` above is what the next save stamps.
    loadedFrom: null,
    lumens: STARTING_LUMENS,
    facets: 0,
    lifetimeLumens: 0,
    lifetimeFacets: 0,
    generators,
    stake: STAKES[0],
    meter: 0,
    musicStyle: 'ambient',
    theme: 'prism',
    arcade: {},
    arcadeFree: 0,
    seenTutorial: false,
    achievements: [],
    turbo: { left: null, restUntil: 0 },
    prizes: freshPrizes(),
    wheelSince: {},          // spins since each must-hit prize last landed
    owned: [],
    // The Playground roster. `yardAuto` true = the newest YARD_CAP owned, which is the
    // pre-v0.9.0 behaviour, so an existing save opens to the cast it always did and
    // nothing needs migrating. Once the player chooses, yardAuto goes false and yardOut
    // is authoritative — INCLUDING when it is empty, which is "all put away". A sentinel
    // id would not have survived sanitize, since sanitize drops any id you do not own.
    yardAuto: true,
    yardOut: [],
    ownedByTier,
    sets: [],
    milestones: [],
    lastTickMs: null,          // null = never ticked. NOT 0 — the first-claim bug class.
    createdMs: null,
    stats: {
      spins: 0, wins: 0, freeRounds: 0, holdRounds: 0, meterFills: 0,
      betSpend: 0, facetEarn: 0, critterSpend: 0, playMs: 0,
      splashes: 0, thunders: 0, wheels: 0, arcadeRuns: 0, arcadeFacets: 0, arcadeTokens: 0,
      shakes: 0, pets: 0, washes: 0, pokes: 0, lines: 0, skinsSeen: 1, quickened: 0,
      achievementLumens: 0, achievementFacets: 0,
    },
  };
}

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** Coerce a loaded save into a structurally valid state. A broken import must not brick. */
/**
 * SAVE MIGRATION SEAM.
 *
 * sanitize() rebuilds state from createState() and stamps the CURRENT version on the
 * result, so a renamed or restructured field is silently replaced by its default with
 * no error and no trace. That is fine while the shape never changes and catastrophic
 * the first time it does — the player loses one field and nothing anywhere notices.
 *
 * This runs BEFORE sanitize and is the only place allowed to read the saved version.
 * It is deliberately a no-op today: the seam has to exist before it is needed, because
 * the migration you cannot write is the one for the save you already overwrote.
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { raw, from: null, steps: [] };
  const from = typeof raw.version === 'string' ? raw.version : null;
  const steps = [];
  let out = raw;

  // A save with no version predates the stamp (<= 0.6.0). Nothing to move yet.
  if (from === null) steps.push('unversioned save adopted as-is');

  // Future migrations go here, oldest first, each one narrow and named:
  //   if (lt(from, '0.7.0')) { out = { ...out, newField: derive(out) }; steps.push('0.6->0.7 newField'); }

  return { raw: out, from, steps };
}

/** Semver-ish compare, sufficient for this project's x.y.z stamps. */
export function versionLt(a, b) {
  const pa = String(a || '0.0.0').split('.').map(Number);
  const pb = String(b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}

export function sanitize(rawIn) {
  const s = createState();
  // Run the migration seam first, and record what shape the save arrived in.
  const { raw, from } = migrate(rawIn);
  s.loadedFrom = from;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  s.lumens = Math.max(0, num(raw.lumens));
  s.facets = Math.max(0, num(raw.facets));
  s.lifetimeLumens = Math.max(0, num(raw.lifetimeLumens));
  s.lifetimeFacets = Math.max(0, num(raw.lifetimeFacets));
  s.meter = Math.min(METER_MAX, Math.max(0, num(raw.meter)));
  // Prize ladder: coerce every tier, clamp to [base, base * cap]. A hand-edited
  // save must not be able to plant an Ultra worth a million times the bet.
  s.prizes = freshPrizes();
  for (const w of WHEEL_PRIZES) {
    const v = num(raw.prizes?.[w.id], w.base);
    s.prizes[w.id] = Math.min(w.base * WHEEL_PRIZE_CAP, Math.max(w.base, v));
  }
  s.stake = STAKES.includes(raw.stake) ? raw.stake : STAKES[0];
  s.musicStyle = ['ambient', 'pop', 'rock', 'off'].includes(raw.musicStyle) ? raw.musicStyle : 'ambient';
  s.theme = ['prism', 'verdant'].includes(raw.theme) ? raw.theme : 'prism';
  s.seenTutorial = raw.seenTutorial === true;
  const valid_a = new Set(ACHIEVEMENTS.map((a) => a.id));
  s.achievements = Array.isArray(raw.achievements) ? [...new Set(raw.achievements.filter((x) => valid_a.has(x)))] : [];
  const rawT = raw.turbo && typeof raw.turbo === 'object' ? raw.turbo : {};
  s.turbo = {
    left: Number.isFinite(rawT.left) ? Math.max(0, Math.floor(rawT.left)) : null,
    restUntil: Number.isFinite(rawT.restUntil) && rawT.restUntil > 0 ? rawT.restUntil : 0,
  };
  s.wheelSince = {};
  if (raw.wheelSince && typeof raw.wheelSince === 'object') {
    for (const id of Object.keys(WHEEL_MUSTHIT)) {
      const v = Math.floor(num(raw.wheelSince[id], 0));
      // Clamped to the published ceiling: a hand-edited save must not be able to bank
      // a thousand spins of must-hit credit and force an Ultra on demand.
      s.wheelSince[id] = Math.max(0, Math.min(WHEEL_MUSTHIT[id], v));
    }
  }
  s.arcadeFree = Math.max(0, Math.min(ARCADE.freeCap, Math.floor(num(raw.arcadeFree, 0))));
  s.arcade = {};
  if (raw.arcade && typeof raw.arcade === 'object') {
    for (const g of ARCADE.games) {
      const v = num(raw.arcade[g.id], 0);
      s.arcade[g.id] = v > 0 ? v : 0;
    }
  }
  for (const g of GENERATORS) {
    s.generators[g.id] = Math.min(GEN_MAX_OWNED, Math.max(0, Math.floor(num(raw.generators?.[g.id]))));
  }
  const valid = new Set(ALL_SPECIES.map((x) => x.id));
  const owned = Array.isArray(raw.owned) ? [...new Set(raw.owned.filter((i) => valid.has(i)))] : [];
  s.owned = owned;
  for (const t of TIERS) s.ownedByTier[t.id] = 0;
  for (const id of owned) {
    const sp = ALL_SPECIES.find((x) => x.id === id);
    if (sp) s.ownedByTier[sp.tier]++;
  }
  // The chosen Playground roster. Sanitised AFTER owned so an id the save no longer
  // holds cannot survive: a hand-edited or downgraded save must not be able to put a
  // critter on stage that the collection does not contain.
  {
    const ownedSet = new Set(s.owned);
    const seen = new Set();
    const out = [];
    if (Array.isArray(raw.yardOut)) {
      for (const v of raw.yardOut) {
        const id = Math.floor(num(v, -1));
        if (!ownedSet.has(id) || seen.has(id)) continue;
        seen.add(id); out.push(id);
        if (out.length >= YARD_CAP) break;
      }
    }
    s.yardOut = out;
    s.yardAuto = raw.yardAuto !== false;   // absent (an older save) = auto
  }
  s.lastTickMs = Number.isFinite(raw.lastTickMs) && raw.lastTickMs > 0 ? raw.lastTickMs : null;
  s.createdMs = Number.isFinite(raw.createdMs) && raw.createdMs > 0 ? raw.createdMs : null;
  if (raw.stats && typeof raw.stats === 'object') {
    for (const k of Object.keys(s.stats)) s.stats[k] = Math.max(0, num(raw.stats[k]));
  }
  s.milestones = Array.isArray(raw.milestones) ? raw.milestones.filter(Number.isFinite) : [];
  s.sets = Array.isArray(raw.sets) ? raw.sets.filter((x) => typeof x === 'string') : [];
  return s;
}

/**
 * Advance time. `nowMs` is supplied by the caller (storage.js in the app, the sim
 * in tests) — this function never reads a clock. Offline and online are the SAME
 * path; `offline` only changes the rate and the cap.
 *
 * Returns { granted, elapsedMs, clamped }. The caller MUST write lastTickMs from
 * the returned nowMs before doing anything else, or a second surface re-grants
 * the same window (the multi-surface double-count class).
 */
export function tick(state, nowMs, offline = false) {
  if (!Number.isFinite(nowMs)) return { granted: 0, elapsedMs: 0, clamped: false, rewound: false };
  if (state.lastTickMs === null) {
    state.lastTickMs = nowMs;
    state.createdMs = state.createdMs ?? nowMs;
    return { granted: 0, elapsedMs: 0, clamped: false, rewound: false };
  }
  const elapsedMs = nowMs - state.lastTickMs;
  if (elapsedMs < 0) {
    // Clock rewound. Refuse to grant, re-anchor, record it. Never mint on a rewind.
    state.lastTickMs = nowMs;
    return { granted: 0, elapsedMs, clamped: false, rewound: true };
  }
  const capMs = (offline ? ACCRUAL.offlineCapHours * 3600 : ACCRUAL.maxTickSeconds) * 1000;
  const clamped = elapsedMs > capMs;
  const granted = accrue(state, elapsedMs, offline);
  state.lastTickMs = nowMs;
  state.lumens += granted;
  state.lifetimeLumens += granted;
  state.stats.playMs += Math.min(elapsedMs, capMs);
  return { granted, elapsedMs, clamped, rewound: false };
}

export function currentBet(state) {
  return state.stake * LINES;
}

export function canSpin(state) {
  return state.lumens >= currentBet(state);
}

/**
 * One complete spin including every feature it triggers. Returns a transcript.
 * Facets are credited here; Lumens are debited here. Nothing else moves money.
 */
export function doSpin(state, rand) {
  const bet = currentBet(state);
  if (state.lumens < bet) return null;
  state.lumens -= bet;
  state.stats.betSpend += bet;
  state.stats.spins++;

  const base = spin(rand, state.stake, 'base');
  let facets = base.facets;
  const features = [];

  if (base.holdTriggered) {
    const hold = runHoldAndSpin(rand, state.stake, base.coinCells);
    facets += hold.facets;
    features.push(hold);
    state.stats.holdRounds++;
  }
  if (base.freeSpinsAwarded > 0) {
    const free = runFreeSpins(rand, state.stake, base.freeSpinsAwarded);
    facets += free.facets;
    features.push(free);
    state.stats.freeRounds++;
  }

  if (base.splash) state.stats.splashes++;
  if (base.thunder.length) state.stats.thunders++;

  // Prism Meter feeds the five Fortunes; filling it spins the Prism Wheel.
  growPrizes(state.prizes, base.coinCount, rand);
  state.meter += base.meterGain;
  let wheel = null;
  if (state.meter >= METER_MAX) {
    state.meter -= METER_MAX;
    wheel = spinWheel(state.prizes, state.stake, rand, state.wheelSince);
    facets += wheel.facets;
    features.push(wheel);
    state.stats.meterFills++;
    state.stats.wheels++;
  }

  // A free arcade play. Rolled AFTER the payout maths and added to nothing — it is a
  // permission, not a Facet amount, so it cannot distort phi or the outcome buckets.
  let arcadeToken = null;
  if (rand() < ARCADE_TOKEN_CHANCE) {
    const got = grantFreePlay(state, 1);
    state.stats.arcadeTokens = (state.stats.arcadeTokens || 0) + 1;
    arcadeToken = { granted: got, banked: freePlays(state) };
  }

  if (facets > 0) state.stats.wins++;
  state.facets += facets;
  state.lifetimeFacets += facets;
  state.stats.facetEarn += facets;

  return { base, features, wheel, facets, bet, arcadeToken, isWin: facets > 0 };
}

/**
 * Credit an arcade run. The ONLY path by which Facets enter the game outside the
 * reels, and it is bounded, cooldown-gated and recorded separately so its share
 * of total income can always be measured rather than assumed.
 */
export function grantArcade(state, gameId, score01, nowMs) {
  if (!ARCADE.games.some((g) => g.id === gameId)) return null;
  const facets = arcadeReward(state, score01);
  if (!(facets > 0)) return null;
  state.facets += facets;
  state.lifetimeFacets += facets;
  state.stats.arcadeRuns++;
  state.stats.arcadeFacets += facets;
  markPlayed(state, gameId, nowMs);
  return { gameId, facets, score01 };
}

export function buyGenerator(state, genId, count = 1) {
  const owned = state.generators[genId] ?? 0;
  const n = Math.min(count, GEN_MAX_OWNED - owned);
  if (n <= 0) return null;
  const cost = bulkCost(genId, owned, n);
  if (!Number.isFinite(cost) || cost > state.lumens) return null;
  state.lumens -= cost;
  state.generators[genId] = owned + n;
  return { genId, count: n, cost };
}

export function drawCritter(state, tierId, rand) {
  const d = draw(state, tierId, rand);
  if (!d) return null;
  applyAcquire(state, d.species, d.cost);
  refreshUnlocks(state);
  return d;
}

/** One paid gacha roll: weighted tier, then a new critter inside it. */
export function drawCritterGacha(state, rand) {
  const d = drawGacha(state, rand);
  if (!d) return null;
  applyAcquire(state, d.species, d.cost);
  refreshUnlocks(state);
  return d;
}

export function sparkCritter(state, speciesId) {
  const s = spark(state, speciesId);
  if (!s) return null;
  applyAcquire(state, s.species, s.cost);
  refreshUnlocks(state);
  return s;
}

function refreshUnlocks(state) {
  const sets = setProgress(state).filter((x) => x.complete).map((x) => x.name);
  state.sets = sets;
  state.milestones = milestonesReached(state.owned.length);
  state.stats.quickened = state.owned.filter((id) => QUICKENED[id]).length;
  // A new Quickened critter can raise the budget above what is currently banked.
  if (state.turbo && state.turbo.left !== null) {
    state.turbo.left = Math.min(turboBudget(state), state.turbo.left);
  }
}

/**
 * Evaluate every achievement and pay out the ones that just came true. Rewards
 * are relative to CURRENT production, so this is safe to call as often as we like.
 * Returns the newly earned rows for the UI to announce.
 */
export function checkAchievements(state) {
  const have = new Set(state.achievements);
  const rate = lumenRate(state);
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    let ok = false;
    try { ok = !!a.check(state); } catch { ok = false; }
    if (!ok) continue;
    const r = resolveReward(a.reward, state, rate);
    state.achievements.push(a.id);
    if (r.lumens > 0) { state.lumens += r.lumens; state.lifetimeLumens += r.lumens; state.stats.achievementLumens += r.lumens; }
    if (r.facets > 0) { state.facets += r.facets; state.lifetimeFacets += r.facets; state.stats.achievementFacets += r.facets; }
    earned.push({ ...a, granted: r });
  }
  return earned;
}

export { refreshTurbo };

export function snapshot(state) {
  return {
    lumens: state.lumens,
    facets: state.facets,
    rate: lumenRate(state),
    bet: currentBet(state),
    owned: state.owned.length,
    meter: state.meter,
    stakes: unlockedStakes(state.owned.length),
    generators: unlockedGenerators(state.owned.length).map((g) => ({
      ...g,
      owned: state.generators[g.id] ?? 0,
      cost: generatorCost(g.id, state.generators[g.id] ?? 0),
      max: maxAffordable(g.id, state.generators[g.id] ?? 0, state.lumens),
    })),
    tiers: TIERS.map((t) => tierState(state, t.id)),
    sets: setProgress(state),
    coreOwned: coreOwned(state),
    complete: coreOwned(state) >= 100,
  };
}

export { lumenRate, generatorCost, maxAffordable, bulkCost, unlockedStakes };
