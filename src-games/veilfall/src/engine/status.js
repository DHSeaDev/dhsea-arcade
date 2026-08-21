/**
 * Status effects and registration.
 *
 * A status is never a boolean. It carries its source and its expiry, because
 * two sources can overlap and an expiry can land mid-day — neither of which a
 * boolean can express.
 */

import { ROLES, TEAM, TYPE } from './roles.js';

export const STATUS = {
  BLIGHTED: 'blighted',   // Blightbinder — information may be false
  WARDED: 'warded',       // Wardsmith — cannot be Unmade tonight
  MARKED: 'marked',       // on the block for Sealing
  BONDED: 'bonded',       // Bondservant's chosen master
};

/**
 * @param {object} seat
 * @param {string} kind
 * @param {{source?: number, expires?: string}} [meta]
 *   expires: 'nextDusk' | 'nextDawn' | 'endOfDay' | 'never'
 */
export function addStatus(seat, kind, meta = {}) {
  seat.statuses.push({ kind, source: meta.source ?? null, expires: meta.expires || 'nextDusk' });
}

export function hasStatus(seat, kind) {
  return seat.statuses.some((s) => s.kind === kind);
}

export function clearStatus(seat, kind) {
  seat.statuses = seat.statuses.filter((s) => s.kind !== kind);
}

/** Expire statuses at a boundary. 'never' survives every boundary. */
export function expireStatuses(state, boundary) {
  for (const seat of state.seats) {
    seat.statuses = seat.statuses.filter((s) => s.expires === 'never' || s.expires !== boundary);
  }
}

/**
 * Impaired = this soul's information cannot be trusted.
 * Two independent causes; both produce the same downstream behaviour.
 */
export function isImpaired(state, seatIdx) {
  const seat = state.seats[seatIdx];
  if (!seat) return false;
  if (seat.role === 'mistaken') return true;
  return hasStatus(seat, STATUS.BLIGHTED);
}

/**
 * What a soul REGISTERS as when something checks them.
 *
 * The Wraith-Touched and the Veilwalker may register falsely. The choice is the
 * Archivist's discretion, simulated with the seeded RNG, and it is made fresh
 * per check — so two different Wardens can legitimately get different answers
 * about the same soul.
 *
 * @param {object} state
 * @param {number} seatIdx
 * @param {'team'|'type'|'role'} question
 * @param {ReturnType<import('../engine/rng.js').createRng>} rng
 */
export function registersAs(state, seatIdx, question, rng) {
  const seat = state.seats[seatIdx];
  const trueRole = ROLES[seat.role];

  const flip = (() => {
    if (seat.role === 'wraithTouched') return rng.chance(0.5);
    if (seat.role === 'veilwalker') return rng.chance(0.5);
    return false;
  })();

  if (!flip) {
    return question === 'team' ? trueRole.team
      : question === 'type' ? trueRole.type
      : seat.role;
  }

  // Misregistration.
  if (seat.role === 'wraithTouched') {
    if (question === 'team') return TEAM.GLOAMING;
    if (question === 'type') return rng.chance(0.7) ? TYPE.SWORN : TYPE.HOLLOW;
    const evilRoles = Object.keys(ROLES).filter((id) => ROLES[id].team === TEAM.GLOAMING);
    return rng.pick(evilRoles);
  }
  // veilwalker
  if (question === 'team') return TEAM.LANTERN;
  if (question === 'type') return rng.chance(0.75) ? TYPE.WARDEN : TYPE.STRAY;
  const goodRoles = Object.keys(ROLES).filter(
    (id) => ROLES[id].team === TEAM.LANTERN && !ROLES[id].hidden
  );
  return rng.pick(goodRoles);
}

/**
 * Nearest living seat in each direction. Used by the Resonant, which reads
 * LIVING neighbours — so a death changes who your neighbours are.
 * Returns 0, 1 or 2 seat indices (fewer when the table is nearly empty).
 */
export function livingNeighbours(state, seatIdx) {
  const n = state.seats.length;
  const walk = (dir) => {
    for (let i = 1; i < n; i++) {
      const idx = (((seatIdx + dir * i) % n) + n) % n;
      if (idx === seatIdx) break;
      if (state.seats[idx].alive) return idx;
    }
    return null;
  };
  const left = walk(-1);
  const right = walk(1);
  const out = [];
  if (left !== null) out.push(left);
  if (right !== null && right !== left) out.push(right);
  return out;
}

/** Raw seat adjacency, ignoring life. Used by the Hearthkeeper on night one. */
export function seatNeighbours(state, seatIdx) {
  const n = state.seats.length;
  return [(seatIdx - 1 + n) % n, (seatIdx + 1) % n];
}

export const livingSeats = (state) => state.seats.filter((s) => s.alive);
export const livingCount = (state) => state.seats.filter((s) => s.alive).length;
