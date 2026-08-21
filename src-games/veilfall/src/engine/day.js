/**
 * The Reading (day): recap, the Naming, the Tally, and Sealing.
 *
 * The vote structure here is the part most often got wrong. It is NOT a single
 * ballot. Each Naming gets its own vote, resolved in order, against a running
 * high-water mark:
 *
 *   - To become Marked, a Naming needs votes >= ceil(living / 2)
 *     AND strictly more than the current leader.
 *   - Equalling the current leader CLEARS the Mark — nobody is Sealed.
 *   - At most one soul is Sealed per day, at day's end.
 */

import { ROLES, TYPE, TEAM } from './roles.js';
import { STATUS, hasStatus, expireStatuses, livingCount } from './status.js';
import { killSeat, checkWin, CAUSE } from './deaths.js';

export function beginDay(state) {
  const n = state.phase.number;
  expireStatuses(state, 'dawn');

  const deaths = (state.night?.deaths || []).map((d) => ({
    seat: d.seat, cause: d.cause, name: state.seats[d.seat].name,
  }));

  state.phase = { kind: 'day', number: n };
  state.day = {
    number: n,
    recap: { deaths },
    namings: [],
    hasNamed: [],       // seats that have used their Naming today
    hasBeenNamed: [],   // seats that have been Named today
    current: null,      // the Naming currently being voted
    marked: null,       // seat currently on the block
    highest: 0,         // high-water vote count
    hexbreakerUsed: state.day?.hexbreakerUsed || false,
    ended: false,
    transcript: [],     // public speech, appended by the AI layer
  };
  state.log.push({ t: 'phase', kind: 'day', n });
  return state;
}

export const voteThreshold = (state) => Math.ceil(livingCount(state) / 2);

/** Can this seat open a Naming right now? */
export function canName(state, seatIdx) {
  const s = state.seats[seatIdx];
  if (!s.alive) return { ok: false, why: 'echoes-cannot-name' };
  if (state.day.hasNamed.includes(seatIdx)) return { ok: false, why: 'already-named-today' };
  if (state.day.current) return { ok: false, why: 'tally-in-progress' };
  return { ok: true };
}

export function canBeNamed(state, seatIdx) {
  if (state.day.hasBeenNamed.includes(seatIdx)) return { ok: false, why: 'already-named-today' };
  if (!state.seats[seatIdx].alive) return { ok: false, why: 'already-an-echo' };
  return { ok: true };
}

/** Can this seat cast a vote in the current Tally? */
export function canVote(state, seatIdx) {
  const s = state.seats[seatIdx];
  if (s.alive) {
    // Bondservant may only raise a hand if their master does.
    const bond = s.statuses.find((x) => x.kind === STATUS.BONDED);
    if (bond && !ROLES[s.role].hidden) {
      const masterVoting = state.day.current?.votes?.[bond.source] === true;
      if (!masterVoting) return { ok: false, why: 'bound-to-master', master: bond.source };
    }
    return { ok: true };
  }
  if (s.finalWordSpent) return { ok: false, why: 'final-word-spent' };
  return { ok: true, final: true };
}

/**
 * Open a Naming. Resolves the Oathbound trigger before the Tally begins.
 */
export function openNaming(state, rng, nominator, nominee) {
  const a = canName(state, nominator);
  if (!a.ok) throw new Error(`Illegal Naming: ${a.why}`);
  const b = canBeNamed(state, nominee);
  if (!b.ok) throw new Error(`Illegal Naming: ${b.why}`);

  state.day.hasNamed.push(nominator);
  state.day.hasBeenNamed.push(nominee);

  const naming = {
    nominator, nominee, votes: {}, order: [], tally: 0,
    resolved: false, outcome: null, oathboundFired: false,
  };
  state.day.current = naming;
  state.day.namings.push(naming);
  state.log.push({ t: 'naming', nominator, nominee, day: state.day.number });

  // ── Oathbound: the first Warden to Name them is Sealed on the spot.
  const target = state.seats[nominee];
  if (target.role === 'oathbound' && !target.usedOnce) {
    const nomRole = ROLES[state.seats[nominator].role];
    // The Mistaken believes they are a Warden but is a Stray — the oath knows.
    if (nomRole.type === TYPE.WARDEN) {
      target.usedOnce = true;
      naming.oathboundFired = true;
      const res = killSeat(state, nominator, CAUSE.OATHBOUND, rng);
      if (res.died) {
        state.day.recap.deaths.push({ seat: nominator, cause: CAUSE.OATHBOUND, name: state.seats[nominator].name });
      }
      const win = checkWin(state);
      if (win) { state.result = win; state.phase = { kind: 'ended', number: state.phase.number }; }
    }
  }

  return naming;
}

/** Seats that still owe a vote in the current Tally, in seating order from the nominee. */
export function pendingVoters(state) {
  const n = state.seats.length;
  const cur = state.day.current;
  if (!cur) return [];
  const out = [];
  for (let i = 1; i <= n; i++) {
    const idx = (cur.nominee + i) % n;
    const s = state.seats[idx];
    if (cur.votes[idx] !== undefined) continue;
    if (!s.alive && s.finalWordSpent) continue;
    out.push(idx);
  }
  return out;
}

export function castVote(state, seatIdx, inFavour) {
  const cur = state.day.current;
  if (!cur) throw new Error('No Tally in progress');
  if (cur.votes[seatIdx] !== undefined) throw new Error('Already voted in this Tally');

  const seat = state.seats[seatIdx];
  const check = canVote(state, seatIdx);
  if (!check.ok && inFavour) {
    // Blocked votes are recorded as abstentions, not errors — the Bondservant
    // is a real constraint, not a UI bug.
    cur.votes[seatIdx] = false;
    cur.order.push({ seat: seatIdx, vote: false, blocked: check.why });
    return { counted: false, blocked: check.why };
  }

  cur.votes[seatIdx] = !!inFavour;
  cur.order.push({ seat: seatIdx, vote: !!inFavour });

  if (inFavour) {
    cur.tally++;
    if (!seat.alive) seat.finalWordSpent = true;
  }
  return { counted: !!inFavour, tally: cur.tally };
}

/** Close the current Tally and update the Mark. */
export function closeTally(state) {
  const cur = state.day.current;
  if (!cur) throw new Error('No Tally in progress');
  const threshold = voteThreshold(state);
  cur.resolved = true;
  cur.threshold = threshold;

  if (cur.tally < threshold) {
    cur.outcome = 'insufficient';
  } else if (cur.tally > state.day.highest) {
    state.day.marked = cur.nominee;
    state.day.highest = cur.tally;
    cur.outcome = 'marked';
  } else if (cur.tally === state.day.highest) {
    state.day.marked = null;       // a tie clears the Mark
    cur.outcome = 'tied-cleared';
  } else {
    cur.outcome = 'below-leader';
  }

  state.log.push({
    t: 'tally', nominee: cur.nominee, votes: cur.tally,
    threshold, outcome: cur.outcome, day: state.day.number,
  });
  state.day.current = null;
  return cur;
}

/** Hexbreaker: once per game, publicly, during the Reading. */
export function useHexbreaker(state, rng, seatIdx, target) {
  const s = state.seats[seatIdx];
  const acting = s.role === 'mistaken' ? s.perceivedRole : s.role;
  if (acting !== 'hexbreaker') throw new Error('Not the Hexbreaker');
  if (s.usedOnce || state.day.hexbreakerUsed) throw new Error('Hexbreaker is spent');
  if (!s.alive) throw new Error('Echoes cannot act');

  s.usedOnce = true;
  state.day.hexbreakerUsed = true;

  // A Blighted or Mistaken Hexbreaker simply misses.
  const impaired = s.role === 'mistaken' || hasStatus(s, STATUS.BLIGHTED);
  const isHollow = ROLES[state.seats[target].role].type === TYPE.HOLLOW;
  const hit = isHollow && !impaired;

  state.log.push({ t: 'hexbreaker', by: seatIdx, target, hit, day: state.day.number });

  if (hit) {
    killSeat(state, target, CAUSE.HEXBREAKER, rng);
    const win = checkWin(state);
    if (win) { state.result = win; state.phase = { kind: 'ended', number: state.phase.number }; }
    return { hit: true, win };
  }
  return { hit: false, win: null };
}

/** End the day: Seal the Marked soul, if any, then check the win. */
export function endDay(state, rng) {
  if (state.day.current) closeTally(state);
  const marked = state.day.marked;
  let sealed = null;

  if (marked != null && state.seats[marked].alive) {
    const res = killSeat(state, marked, CAUSE.SEALED, rng);
    if (res.died) sealed = marked;
  }

  state.lastSealed = sealed;
  state.day.ended = true;
  state.day.sealed = sealed;
  state.log.push({ t: 'sealing', seat: sealed, day: state.day.number });

  const win = checkWin(state, { sealedSeat: sealed, dayEnded: true });
  if (win) {
    state.result = win;
    state.phase = { kind: 'ended', number: state.phase.number };
  }
  return { sealed, win };
}

export { TEAM, TYPE };
