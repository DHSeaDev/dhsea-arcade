/**
 * Death routing, succession, and win checks.
 *
 * Every death in the game funnels through `killSeat` regardless of cause —
 * Sealing, Unmaking, Hexbreaker, the Oathbound, or the Hollow's self-choice —
 * so succession and the win check can never be skipped by a path that forgot
 * to call them.
 */

import { ROLES, TEAM, TYPE } from './roles.js';
import { STATUS, hasStatus, livingCount } from './status.js';

export const CAUSE = {
  UNMADE: 'unmade',
  SEALED: 'sealed',
  HEXBREAKER: 'hexbreaker',
  OATHBOUND: 'oathbound',
  STARPASS: 'starpass',
};

/**
 * @returns {{died: boolean, seat: number, cause: string, blocked?: string, redirected?: number}}
 */
export function killSeat(state, seatIdx, cause, rng, opts = {}) {
  const seat = state.seats[seatIdx];
  if (!seat || !seat.alive) return { died: false, seat: seatIdx, cause, blocked: 'already-dead' };

  // ── Protections apply only to the Hollow's night Unmaking.
  if (cause === CAUSE.UNMADE) {
    if (seat.role === 'bulwark') {
      return { died: false, seat: seatIdx, cause, blocked: 'bulwark' };
    }
    if (hasStatus(seat, STATUS.WARDED)) {
      return { died: false, seat: seatIdx, cause, blocked: 'warded' };
    }
    // Chancellor: the Archivist may take another soul instead.
    if (seat.role === 'chancellor' && rng.chance(0.5)) {
      const others = state.seats.filter((s) => s.alive && s.seat !== seatIdx && s.role !== 'chancellor');
      if (others.length) {
        const victim = rng.pick(others);
        const r = killSeat(state, victim.seat, cause, rng, { ...opts, viaChancellor: true });
        return { ...r, redirected: victim.seat, cause };
      }
    }
  }

  seat.alive = false;
  state.log.push({
    t: 'death', seat: seatIdx, role: seat.role, cause,
    phase: state.phase.kind, n: state.phase.number,
  });

  // ── Succession: the Hollow dying is not the end if a Successor stands ready.
  let succession = null;
  if (ROLES[seat.role].type === TYPE.HOLLOW) {
    succession = promoteSuccessor(state, rng);
  }

  return { died: true, seat: seatIdx, cause, succession };
}

/**
 * If the Hollow died with five or more souls alive, the Successor rises.
 * The Hollow's self-choice (starpass) promotes a Sworn regardless of count.
 */
export function promoteSuccessor(state, rng, force = false) {
  const alive = livingCount(state);
  const successor = state.seats.find((s) => s.alive && s.role === 'successor');
  if (successor && (force || alive >= 5)) {
    successor.role = 'hollowOne';
    successor.perceivedRole = 'hollowOne';
    state.log.push({ t: 'succession', seat: successor.seat, via: 'successor' });
    return { seat: successor.seat, via: 'successor' };
  }
  if (force) {
    const sworn = state.seats.filter((s) => s.alive && ROLES[s.role].type === TYPE.SWORN);
    if (sworn.length) {
      const heir = rng.pick(sworn);
      heir.role = 'hollowOne';
      heir.perceivedRole = 'hollowOne';
      state.log.push({ t: 'succession', seat: heir.seat, via: 'starpass' });
      return { seat: heir.seat, via: 'starpass' };
    }
  }
  return null;
}

/**
 * Evaluate the win condition. Called after EVERY death and at every day's end.
 * @returns {{winner:'lantern'|'gloaming', reason:string}|null}
 */
export function checkWin(state, ctx = {}) {
  const alive = state.seats.filter((s) => s.alive);
  const hollowAlive = alive.some((s) => ROLES[s.role].type === TYPE.HOLLOW);

  // Gloaming: the Sanctified was Sealed.
  if (ctx.sealedSeat != null && state.seats[ctx.sealedSeat].role === 'sanctified') {
    return { winner: TEAM.GLOAMING, reason: 'sanctified-sealed' };
  }

  // Lantern: the Hollow is gone and nothing rose in its place.
  if (!hollowAlive) {
    return { winner: TEAM.LANTERN, reason: 'hollow-destroyed' };
  }

  // Gloaming: two souls left and one of them is the Hollow.
  if (alive.length <= 2) {
    return { winner: TEAM.GLOAMING, reason: 'ward-broken' };
  }

  // Lantern: the Chancellor stands at three, and no one was Sealed today.
  if (ctx.dayEnded && alive.length === 3 && ctx.sealedSeat == null) {
    const chancellor = alive.find((s) => s.role === 'chancellor');
    if (chancellor) return { winner: TEAM.LANTERN, reason: 'chancellor-holds' };
  }

  return null;
}

export const teamOf = (state, seatIdx) => ROLES[state.seats[seatIdx].role].team;
export const typeOf = (state, seatIdx) => ROLES[state.seats[seatIdx].role].type;
export { TYPE, TEAM };
