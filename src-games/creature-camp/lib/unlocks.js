// Unlock conditions as DATA. Every condition is a fixed, knowable threshold —
// nothing here consults a random number, and no creature is ever awarded by chance.
//
// `minDay` is the pacing floor (full roster lands on active day 10 and never
// earlier). A condition met before its floor waits, visibly, for the floor.
//
// Progress is always shown for count / day / game conditions. Code creatures show
// no progress at all — there is nothing to progress toward until a code exists.

import { BASE, BY_KEY, FINAL_KEY } from './species.js';
import { activeDay } from './days.js';
import { GAMES, owned } from './state.js';

export const GAME_OPENS = { firefly: 1, pondskip: 2, birdsong: 3, acorn: 4, trail: 6 };
export const STONES_OPEN_DAY = 3;
export const LOST_FAWN_DAY = 6;
export const QUIET_PINES_DAY = 9;

const stat = (name, n, label) => ({ kind: 'stat', name, n, label });
const game = (name, metric, n, label) => ({ kind: 'game', name, metric, n, label });

export const UNLOCKS = Object.freeze({
  pip:     { type: 'quest',       minDay: 1,  cond: { kind: 'flags', flags: ['named_starter', 'pet_starter', 'fed_starter'], label: 'First Light: name, pet and snack your first friend' } },
  wicket:  { type: 'minigame',    minDay: 1,  cond: game('firefly', 'cleared', 1, 'Fill the lantern in Firefly Lantern') },
  clover:  { type: 'achievement', minDay: 1,  cond: stat('care', 10, 'Care for your friends 10 times') },
  fen:     { type: 'minigame',    minDay: 2,  cond: game('pondskip', 'best', 5, 'Skip a stone 5 times in Pond Skip') },
  thistle: { type: 'achievement', minDay: 2,  cond: stat('interactions', 20, 'Enough commotion: 20 friend meetings') },
  bramble: { type: 'quest',       minDay: 2,  cond: { kind: 'flags', flags: ['midnight_snack'], label: 'Midnight Snack: snack 3 different friends in one visit' } },
  sage:    { type: 'quest',       minDay: 3,  cond: { kind: 'day', n: 3, label: 'Return to the grove on your 3rd camp day' } },
  nib:     { type: 'quest',       minDay: 3,  cond: stat('stones', 5, 'Turn over 5 stones in the camp') },
  wren:    { type: 'minigame',    minDay: 3,  cond: game('birdsong', 'best', 6, 'Echo a 6-note song in Birdsong Echo') },
  burr:    { type: 'minigame',    minDay: 4,  cond: game('acorn', 'best', 10, 'Stack 10 acorns in Acorn Stack') },
  tuck:    { type: 'achievement', minDay: 4,  cond: stat('returns8h', 2, 'Come back to camp after a long rest, twice') },
  lichen:  { type: 'achievement', minDay: 4,  cond: stat('dew', 30, 'Gather 30 dew drops') },
  breeze:  { type: 'quest',       minDay: 5,  cond: { kind: 'day', n: 5, label: 'A wind arrives on your 5th camp day' } },
  morrow:  { type: 'quest',       minDay: 5,  cond: { kind: 'nights', n: 2, label: 'Night Camp: visit in Night mode on 2 camp days' } },
  hollow:  { type: 'minigame',    minDay: 6,  cond: game('trail', 'cleared', 1, 'Clear the large board in Trail Memory') },
  dapple:  { type: 'achievement', minDay: 6,  cond: { kind: 'allGames', label: 'Play every camp game at least once' } },
  juniper: { type: 'quest',       minDay: 6,  cond: { kind: 'journal', q: 'lostFawn', n: 3, label: 'Journal: The Lost Fawn (3 parts)' } },
  ripple:  { type: 'achievement', minDay: 7,  cond: stat('interactions', 100, 'A lively camp: 100 friend meetings') },
  hush:    { type: 'quest',       minDay: 10, cond: { kind: 'final', q: 'quietPines', n: 2, label: 'Journal: The Quiet in the Pines, with every other friend at camp' } },
  // code pack
  moss:  { type: 'code', minDay: 1, cond: { kind: 'code', label: 'Arrives with a special code' } },
  luna:  { type: 'code', minDay: 1, cond: { kind: 'code', label: 'Arrives with a special code' } },
  cove:  { type: 'code', minDay: 1, cond: { kind: 'code', label: 'Arrives with a special code' } },
  astra: { type: 'code', minDay: 1, cond: { kind: 'code', label: 'Arrives with a special code' } },
  root:  { type: 'code', minDay: 1, cond: { kind: 'code', label: 'Arrives with a special code' } },
});

/** {current, target} for a condition, or null when progress is not shown (codes). */
export function progressOf(state, key) {
  const u = UNLOCKS[key];
  if (!u) return null;
  const c = u.cond;
  switch (c.kind) {
    case 'stat':  return { current: Math.min(c.n, state.stats[c.name] || 0), target: c.n };
    case 'game': {
      const g = state.games[c.name];
      const v = c.metric === 'cleared' ? (g.cleared ? 1 : 0) : g.best;
      return { current: Math.min(c.n, v), target: c.n };
    }
    case 'flags': return { current: c.flags.filter((f) => state.flags[f]).length, target: c.flags.length };
    case 'day':   return { current: Math.min(c.n, activeDay(state)), target: c.n };
    case 'nights':return { current: Math.min(c.n, state.nightDays.length), target: c.n };
    case 'allGames': return { current: GAMES.filter((g) => state.games[g].plays > 0).length, target: GAMES.length };
    case 'journal': return { current: Math.min(c.n, state.journal[c.q].step), target: c.n };
    case 'final': {
      const others = BASE.filter((s) => s.key !== FINAL_KEY).length;
      const have = BASE.filter((s) => s.key !== FINAL_KEY && owned(state, s.key)).length;
      return { current: Math.min(c.n, state.journal[c.q].step) + have, target: c.n + others };
    }
    default: return null;
  }
}

export function conditionMet(state, key) {
  const p = progressOf(state, key);
  return !!p && p.current >= p.target;
}

/** True when the condition is met AND the pacing floor is reached. */
export function ready(state, key) {
  const u = UNLOCKS[key];
  if (!u || u.type === 'code' || owned(state, key)) return false;
  return activeDay(state) >= u.minDay && conditionMet(state, key);
}

/** Keys that should unlock now, in roster order. Pure. */
export function pendingUnlocks(state) {
  return BASE.map((s) => s.key).filter((k) => ready(state, k));
}

export function gameOpen(state, name) {
  return activeDay(state) >= (GAME_OPENS[name] ?? 99);
}

export function hintFor(state, key) {
  const u = UNLOCKS[key];
  if (!u) return '';
  const p = progressOf(state, key);
  const day = activeDay(state);
  if (u.type === 'code') return 'Arrives with a special code.';
  if (p && p.current >= p.target && day < u.minDay) return `Done! This friend arrives on camp day ${u.minDay}.`;
  return u.cond.label;
}

export function speciesUnlockable(key) { return !!UNLOCKS[key] && !!BY_KEY[key]; }
