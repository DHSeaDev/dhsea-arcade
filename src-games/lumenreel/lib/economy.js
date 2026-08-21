// Lumen accrual and generators. PURE — takes explicit elapsed milliseconds, never
// reads a clock. That is what makes the sim able to fast-forward 24h in ms, and it
// makes offline accrual and online accrual literally the same code path.

import {
  ACCRUAL, GENERATORS, GEN_COST_GROWTH, GEN_MAX_OWNED,
  TIERS, STAKES, STAKE_GATE_PER,
} from './constants.js';

export function generatorCost(genId, owned) {
  const g = GENERATORS.find((x) => x.id === genId);
  if (!g) return Infinity;
  const c = g.baseCost * Math.pow(GEN_COST_GROWTH, owned);
  return Number.isFinite(c) ? c : Infinity;
}

/** Closed-form cost of buying `n` more, starting from `owned`. */
export function bulkCost(genId, owned, n) {
  const g = GENERATORS.find((x) => x.id === genId);
  if (!g || n <= 0) return Infinity;
  const r = GEN_COST_GROWTH;
  const c = g.baseCost * Math.pow(r, owned) * (Math.pow(r, n) - 1) / (r - 1);
  return Number.isFinite(c) ? c : Infinity;
}

/** How many can be afforded with `lumens`. Closed form, no loop. */
export function maxAffordable(genId, owned, lumens) {
  const g = GENERATORS.find((x) => x.id === genId);
  if (!g || !(lumens > 0)) return 0;
  const r = GEN_COST_GROWTH;
  const base = g.baseCost * Math.pow(r, owned);
  const n = Math.floor(Math.log(1 + (lumens * (r - 1)) / base) / Math.log(r));
  return Math.max(0, Math.min(n, GEN_MAX_OWNED - owned));
}

/** Lumens/sec from generators + owned critters + base. */
export function lumenRate(state) {
  let rate = ACCRUAL.baseRate;
  for (const g of GENERATORS) rate += (state.generators[g.id] || 0) * g.prod;
  for (const t of TIERS) rate += (state.ownedByTier[t.id] || 0) * t.trickle;
  return Number.isFinite(rate) ? rate : ACCRUAL.baseRate;
}

/**
 * Grant accrual for an elapsed window. `offline` halves it and clamps to the cap.
 * Returns the granted amount; the caller writes lastTickMs BEFORE anything else.
 */
export function accrue(state, elapsedMs, offline = false) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  let seconds = elapsedMs / 1000;
  if (offline) {
    seconds = Math.min(seconds, ACCRUAL.offlineCapHours * 3600);
  }
  seconds = Math.min(seconds, ACCRUAL.maxTickSeconds);
  const rate = lumenRate(state);
  const gained = rate * seconds * (offline ? ACCRUAL.offlineRate : 1);
  return Number.isFinite(gained) && gained > 0 ? gained : 0;
}

/** Stakes unlock on OWNED CRITTER COUNT — see the note in constants.js. */
export function unlockedStakes(ownedCount) {
  const n = Math.min(STAKES.length - 1, Math.floor(Math.max(0, ownedCount) / STAKE_GATE_PER));
  return STAKES.slice(0, n + 1);
}

/** Generators unlock on OWNED CRITTER COUNT — see the note in constants.js. */
export function unlockedGenerators(ownedCount) {
  return GENERATORS.filter((g) => ownedCount >= g.unlockOwned);
}
