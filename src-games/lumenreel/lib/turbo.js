// Turbo budget maths. Pure, so the UI can render a countdown from the same
// numbers the engine spends.

import { TURBO, QUICKENED } from './constants.js';

/** Extra budget and cooldown reduction from the Quickened critters you own. */
export function turboPerks(state) {
  let spins = 0, cut = 0;
  const names = [];
  for (const id of state.owned) {
    const q = QUICKENED[id];
    if (!q) continue;
    spins += q.spins; cut += q.cut; names.push(id);
  }
  return { spins, cut, count: names.length };
}

export function turboBudget(state) {
  return TURBO.budget + turboPerks(state).spins;
}

export function turboCooldownMs(state) {
  return Math.max(TURBO.cooldownFloorMs, TURBO.cooldownMs - turboPerks(state).cut);
}

/** Live view: how many fast spins are left, and how long until the budget returns. */
/**
 * Absolute ceiling on BANKED spins.
 *
 * The budget is what a rest refills you to; banked spins WON from the wheel stack on
 * top of it and are not clipped back down. Before this, grantTurbo clamped to the
 * budget, so winning turbo spins while near-full silently threw them away — the
 * reward existed and did nothing. There is still a ceiling, because an unbounded
 * bank would let a player hoard a thousand fast spins and skip the pacing entirely;
 * it is just far enough above the budget that a granted spin is always worth having.
 */
export function turboBank(state) {
  return turboBudget(state) * TURBO.bankMultiple;
}

export function turboState(state, nowMs) {
  const t = state.turbo || { left: null, restUntil: 0 };
  const budget = turboBudget(state);
  const bank = turboBank(state);
  const resting = t.restUntil > nowMs;
  // Clamped to the BANK, not the budget — banked spins above the budget survive.
  const left = resting ? 0 : (t.left === null || t.left === undefined ? budget : Math.min(t.left, bank));
  return {
    budget, bank, left, resting,
    // Above the refill budget, the meter reads full rather than overflowing its bar.
    fill: Math.max(0, Math.min(1, left / budget)),
    banked: Math.max(0, left - budget),
    restMs: resting ? t.restUntil - nowMs : 0,
    cooldownMs: turboCooldownMs(state),
    perks: turboPerks(state),
  };
}

/** Spend one fast spin. Returns the new view; starts the rest when it hits zero. */
export function spendTurbo(state, nowMs) {
  if (!state.turbo) state.turbo = { left: turboBudget(state), restUntil: 0 };
  const view = turboState(state, nowMs);
  if (view.resting) return view;
  state.turbo.left = Math.max(0, view.left - 1);
  if (state.turbo.left === 0) state.turbo.restUntil = nowMs + view.cooldownMs;
  return turboState(state, nowMs);
}

/**
 * Hand back turbo spins (wheel reward). They ACCUMULATE — a grant is added to
 * whatever is already banked and is only capped at the far-off bank ceiling, so
 * winning spins you did not immediately need is never a wasted reward. Still
 * cancels a rest, because being handed spins while resting and not being able to
 * use them is the same wasted-reward problem wearing a different hat.
 */
export function grantTurbo(state, spins, nowMs) {
  if (!state.turbo) state.turbo = { left: turboBudget(state), restUntil: 0 };
  const bank = turboBank(state);
  const before = Math.max(0, state.turbo.left ?? turboBudget(state));
  state.turbo.restUntil = 0;
  state.turbo.left = Math.min(bank, before + spins);
  return turboState(state, nowMs);
}

/** Refill when the rest has elapsed. Called from the tick. */
/**
 * A finished rest refills TO the budget — it never reduces a bank that is already
 * larger. `Math.max` is the whole point: resting must not confiscate won spins.
 */
export function refreshTurbo(state, nowMs) {
  if (!state.turbo) { state.turbo = { left: turboBudget(state), restUntil: 0 }; return; }
  if (state.turbo.restUntil && nowMs >= state.turbo.restUntil) {
    state.turbo.restUntil = 0;
    state.turbo.left = Math.max(turboBudget(state), Math.max(0, state.turbo.left ?? 0));
  }
}

export { TURBO };
