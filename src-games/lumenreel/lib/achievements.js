// Achievements. Every reward is expressed RELATIVE to the player's current state —
// N seconds of their own production, or N times their own bet — so an achievement
// earned in hour one and the same achievement earned in hour ten are both worth
// noticing and neither one distorts the curve. A flat number would be a jackpot
// early and a rounding error late.

import { TIERS, CRITTER_TOTAL, LINES } from './constants.js';

const A = (id, name, hint, check, reward) => ({ id, name, hint, check, reward });
const S = (n) => ({ kind: 'lumensSeconds', n });   // n seconds of current production
const F = (n) => ({ kind: 'facetsBets', n });      // n x current total bet, in Facets

export const ACHIEVEMENTS = [
  // --- first steps ---------------------------------------------------------
  A('firstspin', 'Pull the Lever', 'Spin once.', (s) => s.stats.spins >= 1, S(60)),
  A('firstwin', 'It Paid', 'Win anything at all.', (s) => s.stats.wins >= 1, S(90)),
  A('firstcritter', 'Something Moved In', 'Collect your first critter.', (s) => s.owned.length >= 1, S(120)),
  A('firstgen', 'Cut the First Facet', 'Buy any generator.', (s) => Object.values(s.generators).some((v) => v > 0), S(90)),

  // --- volume --------------------------------------------------------------
  A('spin100', 'Hundred Deep', 'Spin 100 times.', (s) => s.stats.spins >= 100, S(180)),
  A('spin1k', 'Four Figures of Nothing', 'Spin 1,000 times.', (s) => s.stats.spins >= 1000, S(400)),
  A('spin10k', 'Ten Thousand', 'Spin 10,000 times.', (s) => s.stats.spins >= 10000, F(90)),
  A('spin50k', 'Statistically Inevitable', 'Spin 50,000 times.', (s) => s.stats.spins >= 50000, F(220)),

  // --- features ------------------------------------------------------------
  A('splash1', 'Soaked', 'Trigger a splash.', (s) => s.stats.splashes >= 1, S(120)),
  A('splash250', 'Permanently Damp', 'Trigger 250 splashes.', (s) => s.stats.splashes >= 250, F(50)),
  A('thunder1', 'It Fused', 'Land a full premium stack.', (s) => s.stats.thunders >= 1, S(120)),
  A('thunder500', 'Structural', 'Land 500 fused stacks.', (s) => s.stats.thunders >= 500, F(70)),
  A('hold1', 'Everything Locks', 'Trigger the hold feature.', (s) => s.stats.holdRounds >= 1, S(180)),
  A('hold50', 'Locksmith', 'Trigger it 50 times.', (s) => s.stats.holdRounds >= 50, F(60)),
  A('free1', 'The Only Free Thing', 'Trigger free spins.', (s) => s.stats.freeRounds >= 1, S(180)),
  A('free100', 'Retriggered', 'Trigger free spins 100 times.', (s) => s.stats.freeRounds >= 100, F(80)),
  A('wheel1', 'Round It Goes', 'Spin the wheel once.', (s) => s.stats.wheels >= 1, S(150)),
  A('wheel100', 'The Wheel Owes Me Nothing', 'Spin it 100 times.', (s) => s.stats.wheels >= 100, F(70)),

  // --- collection ----------------------------------------------------------
  ...[10, 25, 50, 75, 90, 100].map((n) => A(
    `dex${n}`, `${n} Collected`, `Own ${n} critters.`,
    (s) => s.owned.length >= n, n >= 90 ? F(140) : S(240 + n * 6))),
  A('dex125', 'Every Last One', `Own all ${CRITTER_TOTAL + 25}, Grove included.`,
    (s) => s.owned.length >= CRITTER_TOTAL + 25, F(400)),
  ...TIERS.map((t) => A(
    `tier${t.id}`, `${t.name} Complete`, `Own every ${t.name} critter.`,
    (s) => (s.ownedByTier[t.id] || 0) >= t.count, t.id >= 4 ? F(120) : S(300))),
  A('sets3', 'Three Sets', 'Complete three themed sets.', (s) => (s.sets?.length || 0) >= 3, S(300)),
  A('sets10', 'Ten Sets', 'Complete ten themed sets.', (s) => (s.sets?.length || 0) >= 10, F(60)),
  A('allsets', 'Every Set', 'Complete every themed set.', (s) => (s.sets?.length || 0) >= 21, F(200)),

  // --- economy -------------------------------------------------------------
  A('stake10', 'Ten Rungs Up', 'Unlock ten stake tiers.', (s) => s.owned.length >= 20, S(200)),
  A('rich', 'Photon Rich', 'Bank a million of the time currency.', (s) => s.lumens >= 1e6, S(150)),
  A('richer', 'Absurdly Lit', 'Bank a billion.', (s) => s.lumens >= 1e9, F(45)),
  A('gen100', 'A Hundred Cuts', 'Own 100 generators in total.',
    (s) => Object.values(s.generators).reduce((a, b) => a + b, 0) >= 100, S(260)),
  A('gen1000', 'Industrial', 'Own 1,000 generators in total.',
    (s) => Object.values(s.generators).reduce((a, b) => a + b, 0) >= 1000, F(90)),

  // --- arcade + odds and ends ---------------------------------------------
  A('arcade1', 'Coin-Op', 'Play an arcade game.', (s) => s.stats.arcadeRuns >= 1, S(150)),
  A('arcade25', 'Regular', 'Play 25 arcade games.', (s) => s.stats.arcadeRuns >= 25, F(60)),
  A('bothskins', 'Two Gardens', 'Play in both skins.', (s) => s.stats.skinsSeen >= 2, S(200)),
  A('shaken', 'Superstitious', 'Shake the machine 50 times. It does nothing.',
    (s) => (s.stats.shakes || 0) >= 50, S(120)),
  A('shaken500', 'Deeply Superstitious', 'Shake it 500 times. It still does nothing.',
    (s) => (s.stats.shakes || 0) >= 500, F(40)),
  A('petted', 'Good Critter', 'Pet a critter 25 times.', (s) => (s.stats.pets || 0) >= 25, S(180)),
  A('washed', 'Spotless', 'Wash 25 critters.', (s) => (s.stats.washes || 0) >= 25, S(180)),
  A('poked', 'Stop That', 'Poke 50 critters.', (s) => (s.stats.pokes || 0) >= 50, S(150)),
  A('chatted', 'Good Listener', 'Hear 200 lines of commentary.', (s) => (s.stats.lines || 0) >= 200, F(35)),
  A('quick', 'Quickened', 'Own five of the Quickened critters.', (s) => (s.stats.quickened || 0) >= 5, S(240)),
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

/** Resolve a relative reward into concrete numbers for the state it fires in. */
export function resolveReward(reward, state, rate) {
  if (!reward) return { lumens: 0, facets: 0 };
  if (reward.kind === 'lumensSeconds') return { lumens: Math.max(1, rate * reward.n), facets: 0 };
  if (reward.kind === 'facetsBets') return { lumens: 0, facets: Math.max(1, state.stake * LINES * reward.n) };
  return { lumens: 0, facets: 0 };
}

export function describeReward(reward) {
  if (!reward) return '';
  if (reward.kind === 'lumensSeconds') return `${reward.n}s of production`;
  return `${reward.n}× your bet`;
}
