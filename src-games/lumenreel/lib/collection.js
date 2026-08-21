// The 100-critter collection. Facets in, critters out.
//
// DUPLICATE SUPPRESSION is the whole design: a Draw at tier T never returns a
// critter you already own. There are therefore no duplicates, no coupon-collector
// tail (~519 expected pulls for 100 uniform items, with the last five eating 30%
// of it), and a printable MAXIMUM cost for every single critter.
//
// Every probability shown to the player is computed from this file and constants.js
// by ui/rates.js. There is no second, hidden table.

import { TIERS, SPARK_MULTIPLIER, CRITTER_TOTAL, drawCostFor, RARITY_W, VERDANT_SHARE_CAP } from './constants.js';
import { SPECIES, ALL_SPECIES } from './species.js';
import { pickIndex } from './rng.js';

export function tierOf(id) {
  return TIERS.find((t) => t.id === id);
}

export function speciesOfTier(tierId) {
  return ALL_SPECIES.filter((s) => s.tier === tierId);
}

/**
 * A tier is drawable once enough critters are owned overall AND it has stock left.
 *
 * v0.9.0 — the THEME LOCK IS RETIRED. A themed tier used to be undrawable unless that
 * theme was the active skin, which made a cosmetic toggle a gameplay gate; `theme` now
 * only marks a tier as non-core (CORE_TIERS, coreOwned). The owned-count gate takes
 * over, and it is enforced for the first time: `gated` was computed here but gachaTable
 * filtered on `themeLocked` alone, so gateOwned: 40 never once stopped a draw.
 */
export function tierState(state, tierId) {
  const t = tierOf(tierId);
  const owned = state.ownedByTier[tierId] || 0;
  const totalOwned = state.owned.length;
  const drawCost = drawCostFor(coreOwned(state));
  return {
    tier: t,
    owned,
    remaining: t.count - owned,
    offTheme: !!t.theme && state.theme !== t.theme,   // cosmetic association only
    gateOwned: t.gateOwned || 0,
    gated: totalOwned < (t.gateOwned || 0),
    gateLeft: Math.max(0, (t.gateOwned || 0) - totalOwned),
    complete: owned >= t.count,
    drawCost,
    sparkCost: drawCost * SPARK_MULTIPLIER,
  };
}

/**
 * The live gacha table: every tier that can still yield something, with its weight
 * and probability. This is the ONLY place the odds exist — the ball-drop bins, the
 * odds page and the roll all read it, so the picture cannot drift from the maths.
 */
export function gachaTable(state) {
  const rows = [];
  for (const t of TIERS) {
    const st = tierState(state, t.id);
    if (st.gated || st.remaining <= 0) continue;
    const w = st.remaining * (RARITY_W[t.id] ?? 0);
    if (w > 0) rows.push({ tier: t, remaining: st.remaining, weight: w, bonus: !!t.theme });
  }
  // The bonus tier is capped against the CORE weight while any core critter is still
  // missing — see VERDANT_SHARE_CAP. Without this a 25-deep bonus pool out-weighs the
  // handful of core critters left at the end and the collection stops converging.
  const coreW = rows.filter((r) => !r.bonus).reduce((a, r) => a + r.weight, 0);
  if (coreW > 0) {
    for (const r of rows) {
      if (!r.bonus) continue;
      r.uncapped = r.weight;
      r.weight = Math.min(r.weight, coreW * VERDANT_SHARE_CAP);
      r.capped = r.weight < r.uncapped;
    }
  }
  const total = rows.reduce((a, r) => a + r.weight, 0);
  for (const r of rows) r.p = total > 0 ? r.weight / total : 0;
  return { rows, total };
}

/**
 * One weighted roll across every drawable tier, then duplicate-suppressed inside it.
 * Replaces the old "pick a tier from a menu once it unlocks" flow.
 * Returns null if nothing is drawable or the price is not covered — the caller must
 * not spend on a null.
 */
export function drawGacha(state, rand) {
  const cost = drawCostFor(coreOwned(state));
  if (!Number.isFinite(cost) || state.facets < cost) return null;
  const { rows, total } = gachaTable(state);
  if (!rows.length || total <= 0) return null;

  let r = rand() * total;
  let hit = rows[rows.length - 1];
  for (const row of rows) { r -= row.weight; if (r <= 0) { hit = row; break; } }

  const ownedSet = new Set(state.owned);
  const pool = speciesOfTier(hit.tier.id).filter((sp) => !ownedSet.has(sp.id));
  if (!pool.length) return null;          // cannot happen while remaining > 0, but never spend on a null
  const pick = pool[pickIndex(rand, pool.length)];
  return { species: pick, cost, poolSize: pool.length, tier: hit.tier, table: rows };
}

export function canDraw(state, tierId) {
  const s = tierState(state, tierId);
  return !s.gated && !s.complete && state.facets >= s.drawCost;
}

/**
 * Draw one critter from a tier. Suppression: the pool is exactly the UNOWNED
 * species of that tier, so the result is always new. Returns null if not allowed —
 * the caller must not spend on a null.
 */
export function draw(state, tierId, rand) {
  if (!canDraw(state, tierId)) return null;
  const s = tierState(state, tierId);
  const ownedSet = new Set(state.owned);
  const pool = speciesOfTier(tierId).filter((sp) => !ownedSet.has(sp.id));
  if (pool.length === 0) return null;
  const pick = pool[pickIndex(rand, pool.length)];
  return { species: pick, cost: s.drawCost, poolSize: pool.length };
}

/** Buy one exact critter. This is the bound that makes completion quotable. */
export function spark(state, speciesId) {
  const sp = ALL_SPECIES.find((x) => x.id === speciesId);
  if (!sp) return null;
  if (state.owned.includes(speciesId)) return null;
  const s = tierState(state, sp.tier);
  if (s.gated) return null;
  if (state.facets < s.sparkCost) return null;
  return { species: sp, cost: s.sparkCost };
}

export function applyAcquire(state, species, cost) {
  state.facets -= cost;
  state.owned.push(species.id);
  state.ownedByTier[species.tier] = (state.ownedByTier[species.tier] || 0) + 1;
  state.stats.critterSpend += cost;
  return state;
}

/** Cost floor to finish from here, assuming the cheapest legal path (all draws). */
export function remainingDrawCost(state) {
  let total = 0;
  for (let n = coreOwned(state); n < CRITTER_TOTAL; n++) total += drawCostFor(n);
  return total;
}

/** Core-100 progress, which is what "the collection" means and what the 24h band measured. */
/**
 * PRICE BASIS. The draw cost curve was swept and tuned against a 100-critter CORE, so
 * the price must count core critters only. Before v0.9.0 it read `state.owned.length`,
 * which was harmless while the 25 bonus critters were behind a skin lock and nobody
 * could hold one without opting in. With the lock gone, every Grove pull permanently
 * raised the price of every remaining CORE pull — a compounding tax that pushed the
 * measured completion band to 26.8h against a 24h ceiling. Counting core owned only
 * makes the Grove cost Facets without also moving the curve underneath the collection.
 */
export function coreOwned(state) {
  let n = 0;
  for (const t of TIERS) if (!t.theme) n += state.ownedByTier[t.id] || 0;
  return n;
}

export function totalDrawCost() {
  let total = 0;
  for (let n = 0; n < CRITTER_TOTAL; n++) total += drawCostFor(n);
  return total;
}

/** Set bonuses — themed sub-collections, the strongest pacing device at this size. */
export function setProgress(state) {
  const ownedSet = new Set(state.owned);
  const bySet = new Map();
  for (const sp of ALL_SPECIES) {
    if (!bySet.has(sp.set)) bySet.set(sp.set, { name: sp.set, total: 0, owned: 0, members: [] });
    const e = bySet.get(sp.set);
    e.total++;
    e.members.push(sp.id);
    if (ownedSet.has(sp.id)) e.owned++;
  }
  return [...bySet.values()].map((e) => ({ ...e, complete: e.owned >= e.total }));
}

export const MILESTONES = [10, 25, 50, 75, 90, 95, 98, 100];

export function milestonesReached(count) {
  return MILESTONES.filter((m) => count >= m);
}

export { CRITTER_TOTAL };
