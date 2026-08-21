// The Arcade. Three short skill games that pay Facets.
//
// The reward is deliberately BOUNDED and cooldown-gated. The completion band was
// measured for a player who never touches these, so the arcade may only ever make
// the game faster — never slower, and never by an unbounded amount. At the
// constants below, playing all three perfectly on cooldown adds roughly a fifth
// of a spinning player's Facet income, which is a bonus rather than a bypass.

import { LINES } from './constants.js';

export const ARCADE = {
  cooldownMs: 180_000,          // per game
  capBets: 12,                  // max payout = this many total-bets, in Facets
  // A FREE PLAY won on the reels ignores the cooldown entirely. It is a spin reward,
  // so its frequency is set on the reel side (ARCADE_TOKEN in constants.js) and its
  // payout is the same bounded arcadeReward — a free play changes WHEN you can play,
  // never how much a play is worth. That keeps the completion band's only arcade input
  // (plays per hour) measurable rather than open-ended.
  freeCap: 5,                   // unplayed free plays you can bank
  games: [
    { id: 'brick',  name: 'Brick Attack',  seconds: 10, blurb: 'Ten seconds. Break what you can.' },
    { id: 'memory', name: 'Memory Match',  seconds: 40, blurb: 'Six pairs. Fewer flips is better.' },
    { id: 'revolution', name: 'Revolution', seconds: 30, blurb: 'Stop the ring in the light. It gets thinner.' },
  ],
};

export function cooldownLeft(state, id, nowMs) {
  const last = state.arcade?.[id] ?? 0;
  return Math.max(0, ARCADE.cooldownMs - (nowMs - last));
}

export function freePlays(state) { return Math.max(0, Math.min(ARCADE.freeCap, state.arcadeFree | 0)); }

/** A free play beats the cooldown. Nothing else does. */
export function canPlay(state, id, nowMs) {
  return cooldownLeft(state, id, nowMs) <= 0 || freePlays(state) > 0;
}

/** True when this play will consume a banked free play rather than the cooldown. */
export function usesFreePlay(state, id, nowMs) {
  return cooldownLeft(state, id, nowMs) > 0 && freePlays(state) > 0;
}

/**
 * Payout for a finished run.
 * @param {number} score01  normalised performance, clamped to [0,1]
 * @returns {number} Facets
 */
export function arcadeReward(state, score01) {
  const s = Math.max(0, Math.min(1, Number.isFinite(score01) ? score01 : 0));
  const bet = state.stake * LINES;
  // Slight curve so a poor run still pays something and a great run is worth
  // chasing, without a cliff at the top.
  const curved = 0.18 + 0.82 * Math.pow(s, 1.35);
  const out = ARCADE.capBets * bet * curved;
  return Number.isFinite(out) && out > 0 ? out : 0;
}

export function markPlayed(state, id, nowMs) {
  if (!state.arcade) state.arcade = {};
  // Spending a free play must NOT reset the cooldown clock — otherwise a free play
  // silently costs you the next scheduled play, which is a worse deal than not
  // winning one at all.
  if (usesFreePlay(state, id, nowMs)) { state.arcadeFree = freePlays(state) - 1; return 'free'; }
  state.arcade[id] = nowMs;
  return 'cooldown';
}

export function grantFreePlay(state, n = 1) {
  const before = freePlays(state);
  state.arcadeFree = Math.min(ARCADE.freeCap, before + n);
  return state.arcadeFree - before;
}
