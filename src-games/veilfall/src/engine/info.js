/**
 * Information generation — including all FALSE information.
 *
 * This is the mechanic the whole game rests on, and it is fully deterministic.
 * A model is never asked what a Blighted soul learns; the engine decides, using
 * the seeded RNG, and records BOTH the true value and the delivered value so the
 * post-game replay can show the player exactly where they were led astray.
 *
 * Falsehood policy: near-miss, never nonsense.
 *   - The false answer is drawn from the same space as the true one.
 *   - Numbers land one or two off, never wild.
 *   - Named roles are real callings; named souls are real souls.
 * A lie the player can dismiss on sight teaches them nothing.
 */

import { ROLES, ROLE_IDS, TEAM, TYPE, rolesOfType } from './roles.js';
import { isImpaired, registersAs, livingNeighbours, seatNeighbours } from './status.js';

const other = (rng, pool, not) => {
  const opts = pool.filter((x) => x !== not);
  return opts.length ? rng.pick(opts) : not;
};

/** A near-miss integer within [lo,hi], never equal to `truth`. */
function nearMiss(rng, truth, lo, hi) {
  const cands = [];
  for (let d = 1; d <= 2; d++) {
    if (truth - d >= lo) cands.push(truth - d);
    if (truth + d <= hi) cands.push(truth + d);
  }
  if (!cands.length) return truth === lo ? hi : lo;
  // Weight ±1 more heavily than ±2.
  const weighted = cands.flatMap((c) => (Math.abs(c - truth) === 1 ? [c, c, c] : [c]));
  return rng.pick(weighted);
}

/** Two seats, one of which is `target`; the other drawn from the rest. */
function pairWith(state, rng, targetSeat, excludeSeat) {
  const pool = state.seats
    .map((s) => s.seat)
    .filter((i) => i !== targetSeat && i !== excludeSeat);
  const decoy = rng.pick(pool);
  return rng.shuffle([targetSeat, decoy]);
}

// ─────────────────────────────────────────────────────────────────────────────

const GENERATORS = {
  /** One of these two souls holds this Warden calling. */
  threadreader(state, seatIdx, rng) {
    const wardens = state.seats.filter(
      (s) => s.seat !== seatIdx && ROLES[s.role].type === TYPE.WARDEN
    );
    if (!wardens.length) return null;
    const pick = rng.pick(wardens);
    const truth = { seats: pairWith(state, rng, pick.seat, seatIdx), role: pick.role };

    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };

    // Impaired: name a real Warden calling that neither shown soul actually holds.
    const inPlay = new Set(state.seats.map((s) => s.role));
    const candidates = rolesOfType(TYPE.WARDEN).filter((id) => id !== pick.role);
    const fakeRole = rng.pick(candidates.length ? candidates : rolesOfType(TYPE.WARDEN));
    const pool = state.seats.map((s) => s.seat).filter((i) => i !== seatIdx);
    let seats = rng.sample(pool, 2);
    // Keep it a lie: neither shown soul may actually hold the named calling.
    if (seats.some((i) => state.seats[i].role === fakeRole)) {
      seats = seats.map((i) =>
        state.seats[i].role === fakeRole ? other(rng, pool, i) : i
      );
    }
    void inPlay;
    return { truth, delivered: { seats, role: fakeRole } };
  },

  /** One of these two souls holds this Stray calling — or no Stray walks here. */
  cataloguer(state, seatIdx, rng) {
    const strays = state.seats.filter(
      (s) => s.seat !== seatIdx && ROLES[s.role].type === TYPE.STRAY
    );
    const truth = strays.length
      ? (() => {
          const pick = rng.pick(strays);
          // The Mistaken registers as the Warden they believe they are, so the
          // Cataloguer cannot see them as a Stray. That is the point of the role.
          const shownRole = pick.role === 'mistaken' ? pick.role : pick.role;
          return { seats: pairWith(state, rng, pick.seat, seatIdx), role: shownRole };
        })()
      : { none: true };

    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };

    if (truth.none) {
      const pool = state.seats.map((s) => s.seat).filter((i) => i !== seatIdx);
      return {
        truth,
        delivered: { seats: rng.sample(pool, 2), role: rng.pick(rolesOfType(TYPE.STRAY)) },
      };
    }
    return rng.chance(0.35)
      ? { truth, delivered: { none: true } }
      : (() => {
          const pool = state.seats.map((s) => s.seat).filter((i) => i !== seatIdx);
          const fakeRole = other(rng, rolesOfType(TYPE.STRAY), truth.role);
          let seats = rng.sample(pool, 2);
          if (seats.some((i) => state.seats[i].role === fakeRole)) {
            seats = seats.map((i) => (state.seats[i].role === fakeRole ? other(rng, pool, i) : i));
          }
          return { truth, delivered: { seats, role: fakeRole } };
        })();
  },

  /** One of these two souls holds this Sworn calling. */
  inquisitor(state, seatIdx, rng) {
    const sworn = state.seats.filter(
      (s) => s.seat !== seatIdx && ROLES[s.role].type === TYPE.SWORN
    );
    if (!sworn.length) return null;
    const pick = rng.pick(sworn);
    const truth = { seats: pairWith(state, rng, pick.seat, seatIdx), role: pick.role };

    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };

    const pool = state.seats.map((s) => s.seat).filter((i) => i !== seatIdx);
    const fakeRole = other(rng, rolesOfType(TYPE.SWORN), pick.role);
    let seats = rng.sample(pool, 2);
    if (seats.some((i) => state.seats[i].role === fakeRole)) {
      seats = seats.map((i) => (state.seats[i].role === fakeRole ? other(rng, pool, i) : i));
    }
    return { truth, delivered: { seats, role: fakeRole } };
  },

  /** How many pairs of neighbouring souls are both Gloaming. */
  hearthkeeper(state, seatIdx, rng) {
    let count = 0;
    const n = state.seats.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = registersAs(state, i, 'team', rng);
      const b = registersAs(state, j, 'team', rng);
      if (a === TEAM.GLOAMING && b === TEAM.GLOAMING) count++;
    }
    const truth = { count };
    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };
    return { truth, delivered: { count: nearMiss(rng, count, 0, Math.floor(n / 2)) } };
  },

  /** How many of your two LIVING neighbours are Gloaming. */
  resonant(state, seatIdx, rng) {
    const nbrs = livingNeighbours(state, seatIdx);
    const count = nbrs.filter((i) => registersAs(state, i, 'team', rng) === TEAM.GLOAMING).length;
    const truth = { count, neighbours: nbrs };
    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };
    return { truth, delivered: { count: nearMiss(rng, count, 0, nbrs.length), neighbours: nbrs } };
  },

  /** Is either of these two souls the Hollow? */
  glassreader(state, seatIdx, rng, params = {}) {
    const chosen = params.targets || [];
    if (chosen.length !== 2) return null;
    const mirage = state.registry.mirageSeat;
    const hit = chosen.some((i) => {
      if (i === mirage) return true;
      return registersAs(state, i, 'type', rng) === TYPE.HOLLOW;
    });
    const truth = { targets: chosen, yes: hit };
    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };
    return { truth, delivered: { targets: chosen, yes: !hit } };
  },

  /** The calling of the soul Sealed today. */
  ashReader(state, seatIdx, rng, params = {}) {
    const sealed = params.sealedSeat;
    if (sealed == null) return null;
    const shown = registersAs(state, sealed, 'role', rng);
    const truth = { seat: sealed, role: shown };
    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };
    return {
      truth,
      delivered: { seat: sealed, role: other(rng, plausibleRoles(state), shown) },
    };
  },

  /** Dying, you learn one soul's calling. */
  beastcaller(state, seatIdx, rng, params = {}) {
    const target = params.targets?.[0];
    if (target == null) return null;
    const shown = registersAs(state, target, 'role', rng);
    const truth = { seat: target, role: shown };
    if (!isImpaired(state, seatIdx)) return { truth, delivered: truth };
    return {
      truth,
      delivered: { seat: target, role: other(rng, plausibleRoles(state), shown) },
    };
  },
};

/** Roles a false answer may name: everything in play plus a few that are not. */
function plausibleRoles(state) {
  const inPlay = state.seats.map((s) => s.role);
  const extras = ROLE_IDS.filter((id) => !ROLES[id].hidden);
  return Array.from(new Set([...inPlay, ...extras]));
}

/**
 * Generate information for a soul's calling.
 * Returns null when the role produces no information this night.
 *
 * @returns {{truth: any, delivered: any, impaired: boolean, roleId: string}|null}
 */
export function generateInfo(state, seatIdx, rng, params = {}) {
  const seat = state.seats[seatIdx];
  // The Mistaken acts as the calling they BELIEVE they hold.
  const actingRole = seat.role === 'mistaken' ? seat.perceivedRole : seat.role;
  const gen = GENERATORS[actingRole];
  if (!gen) return null;
  const res = gen(state, seatIdx, rng, params);
  if (!res) return null;
  return { ...res, impaired: isImpaired(state, seatIdx), roleId: actingRole };
}

export { nearMiss, plausibleRoles };
