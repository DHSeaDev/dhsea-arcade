/**
 * Vespers (night) resolution.
 *
 * Modelled as a pausable queue rather than one atomic function, because the
 * human's own action sits in the middle of the order and the panel may close
 * between any two steps. Every step advance is a persistable state transition.
 */

import { ROLES, TYPE, TEAM, FIRST_NIGHT_STEPS, OTHER_NIGHT_STEPS } from './roles.js';
import { STATUS, addStatus, expireStatuses, isImpaired } from './status.js';
import { generateInfo } from './info.js';
import { killSeat, promoteSuccessor, checkWin, CAUSE } from './deaths.js';

/** Which seat, if any, currently holds this calling and is awake to use it. */
function actorFor(state, roleId) {
  return state.seats.find((s) => {
    if (!s.alive) return false;
    // The Mistaken is woken as the calling they believe they hold.
    const acting = s.role === 'mistaken' ? s.perceivedRole : s.role;
    return acting === roleId;
  }) || null;
}

/** Legal targets for a night action. */
export function legalTargets(state, seatIdx, roleId) {
  const alive = state.seats.filter((s) => s.alive).map((s) => s.seat);
  switch (roleId) {
    case 'wardsmith':
      return alive.filter((i) => i !== seatIdx);
    case 'bondservant':
      return alive.filter((i) => i !== seatIdx);
    case 'blightbinder':
      return alive;
    case 'hollowOne':
      return alive; // self-choice is legal and triggers succession
    case 'glassreader':
      return alive.filter((i) => i !== seatIdx);
    case 'beastcaller':
      return state.seats.map((s) => s.seat).filter((i) => i !== seatIdx);
    default:
      return [];
  }
}

export function beginNight(state) {
  const n = (state.phase.kind === 'setup' ? 0 : state.phase.number) + 1;
  const first = n === 1;

  expireStatuses(state, 'dusk');

  state.phase = { kind: 'night', number: n };
  state.night = {
    number: n,
    first,
    queue: (first ? FIRST_NIGHT_STEPS : OTHER_NIGHT_STEPS).map((s) => ({ ...s })),
    index: 0,
    awaiting: null,
    deaths: [],
    reveals: {},   // seatIdx -> delivered info
    truths: {},    // seatIdx -> true info (Registry only; never shown mid-game)
  };
  state.log.push({ t: 'phase', kind: 'night', n });
  return state;
}

/**
 * Advance the night until it needs the human, or until it ends.
 *
 * @param {object} state
 * @param {*} rng
 * @param {(ctx:{state:object,seat:number,roleId:string,targets:number[]}) => number[]} aiChoose
 * @returns {{status:'awaiting'|'complete', awaiting?:object, result?:object}}
 */
export function advanceNight(state, rng, aiChoose) {
  const N = state.night;

  while (N.index < N.queue.length) {
    const step = N.queue[N.index];

    // A step that is awaiting human input blocks here until submitted.
    if (N.awaiting) {
      return { status: 'awaiting', awaiting: N.awaiting };
    }

    const done = () => { N.index++; };

    if (step.kind === 'setup') { done(); continue; }

    if (step.kind === 'info' && step.id === 'swornMeet') {
      const sworn = state.seats.filter((s) => ROLES[s.role].type === TYPE.SWORN);
      const hollow = state.seats.find((s) => ROLES[s.role].type === TYPE.HOLLOW);
      for (const s of sworn) {
        N.reveals[s.seat] = {
          roleId: s.role, kind: 'swornMeet',
          delivered: {
            fellows: sworn.filter((x) => x.seat !== s.seat).map((x) => x.seat),
            hollow: hollow ? hollow.seat : null,
          },
          impaired: false,
        };
      }
      done(); continue;
    }

    if (step.kind === 'info' && step.id === 'hollowMeet') {
      const hollow = state.seats.find((s) => ROLES[s.role].type === TYPE.HOLLOW);
      if (hollow) {
        N.reveals[hollow.seat] = {
          roleId: hollow.role, kind: 'hollowMeet',
          delivered: {
            sworn: state.seats.filter((s) => ROLES[s.role].type === TYPE.SWORN).map((s) => s.seat),
            bluffs: state.registry.bluffs,
          },
          impaired: false,
        };
      }
      done(); continue;
    }

    // ── Role steps
    const roleId = step.id;
    const actor = actorFor(state, roleId);

    // Beastcaller only wakes if it was Unmade tonight.
    if (roleId === 'beastcaller') {
      const bc = state.seats.find((s) => s.role === 'beastcaller');
      const diedTonight = bc && N.deaths.some((d) => d.seat === bc.seat);
      if (!bc || !diedTonight) { done(); continue; }
      const targets = legalTargets(state, bc.seat, 'beastcaller');
      if (targets.length < 1) { done(); continue; }
      if (bc.isHuman) {
        N.awaiting = { seat: bc.seat, roleId, targets, count: 1, reactive: true };
        return { status: 'awaiting', awaiting: N.awaiting };
      }
      const chosen = aiChoose({ state, seat: bc.seat, roleId, targets });
      applyNightAction(state, rng, bc.seat, roleId, chosen);
      done(); continue;
    }

    if (!actor) { done(); continue; }

    const meta = ROLES[roleId];
    const count = meta.targets || 0;

    if (count > 0) {
      const targets = legalTargets(state, actor.seat, roleId);
      // A calling that cannot be legally used tonight simply does not fire.
      // The Glassreader needs TWO distinct living souls; late in a game there
      // may only be one, and the ability lapses rather than half-resolving.
      if (targets.length < count) { done(); continue; }
      if (actor.isHuman) {
        N.awaiting = { seat: actor.seat, roleId, targets, count };
        return { status: 'awaiting', awaiting: N.awaiting };
      }
      const chosen = aiChoose({ state, seat: actor.seat, roleId, targets });
      applyNightAction(state, rng, actor.seat, roleId, chosen);
      done(); continue;
    }

    // Information-only step.
    applyNightAction(state, rng, actor.seat, roleId, []);
    done();
  }

  return { status: 'complete', result: endNight(state, rng) };
}

/** The human (or AI) has chosen. Resolve and unblock the queue. */
export function submitNightChoice(state, rng, targets) {
  const N = state.night;
  if (!N?.awaiting) throw new Error('No night action is awaiting input');
  const { seat, roleId } = N.awaiting;
  const legal = new Set(N.awaiting.targets);
  const chosen = (targets || []).filter((t) => legal.has(t)).slice(0, N.awaiting.count);
  if (chosen.length !== N.awaiting.count) {
    throw new Error(`${roleId} requires ${N.awaiting.count} legal target(s)`);
  }
  N.awaiting = null;
  applyNightAction(state, rng, seat, roleId, chosen);
  N.index++;
  return state;
}

/** Resolve a single night action. Pure engine — no model involvement. */
export function applyNightAction(state, rng, seatIdx, roleId, targets) {
  const N = state.night;
  const seat = state.seats[seatIdx];

  switch (roleId) {
    case 'blightbinder': {
      const t = targets[0];
      if (t != null) {
        addStatus(state.seats[t], STATUS.BLIGHTED, { source: seatIdx, expires: 'dusk' });
        N.reveals[seatIdx] = { roleId, kind: 'action', delivered: { target: t }, impaired: false };
      }
      break;
    }
    case 'wardsmith': {
      const t = targets[0];
      if (t != null) {
        // A Blighted Wardsmith's ward silently fails.
        if (!isImpaired(state, seatIdx)) {
          addStatus(state.seats[t], STATUS.WARDED, { source: seatIdx, expires: 'dawn' });
        }
        N.reveals[seatIdx] = { roleId, kind: 'action', delivered: { target: t }, impaired: isImpaired(state, seatIdx) };
      }
      break;
    }
    case 'bondservant': {
      const t = targets[0];
      if (t != null) {
        addStatus(seat, STATUS.BONDED, { source: t, expires: 'dusk' });
        N.reveals[seatIdx] = { roleId, kind: 'action', delivered: { master: t }, impaired: false };
      }
      break;
    }
    case 'veilwalker': {
      N.reveals[seatIdx] = {
        roleId, kind: 'registry', impaired: false,
        delivered: { registry: state.seats.map((s) => ({ seat: s.seat, role: s.role })) },
      };
      break;
    }
    case 'hollowOne': {
      const t = targets[0];
      if (t == null) break;
      if (t === seatIdx) {
        // Self-choice: the Hollow dies and a Sworn rises.
        seat.alive = false;
        state.log.push({ t: 'death', seat: seatIdx, role: seat.role, cause: CAUSE.STARPASS, phase: 'night', n: N.number });
        N.deaths.push({ seat: seatIdx, cause: CAUSE.STARPASS });
        const succ = promoteSuccessor(state, rng, true);
        N.reveals[seatIdx] = { roleId, kind: 'action', delivered: { target: t, starpass: true, heir: succ?.seat ?? null }, impaired: false };
      } else {
        const res = killSeat(state, t, CAUSE.UNMADE, rng);
        if (res.died) N.deaths.push({ seat: res.redirected ?? t, cause: CAUSE.UNMADE });
        N.reveals[seatIdx] = { roleId, kind: 'action', delivered: { target: t, blocked: res.blocked || null }, impaired: false };
      }
      break;
    }
    case 'ashReader': {
      const info = generateInfo(state, seatIdx, rng, { sealedSeat: state.lastSealed ?? null });
      if (info) { N.reveals[seatIdx] = { ...info, kind: 'info' }; N.truths[seatIdx] = info.truth; }
      break;
    }
    case 'beastcaller': {
      const info = generateInfo(state, seatIdx, rng, { targets });
      if (info) { N.reveals[seatIdx] = { ...info, kind: 'info' }; N.truths[seatIdx] = info.truth; }
      break;
    }
    default: {
      const info = generateInfo(state, seatIdx, rng, { targets });
      if (info) { N.reveals[seatIdx] = { ...info, kind: 'info' }; N.truths[seatIdx] = info.truth; }
      break;
    }
  }

  state.log.push({ t: 'night-action', seat: seatIdx, roleId, targets, n: N.number });
}

function endNight(state, rng) {
  const N = state.night;
  const win = checkWin(state);
  if (win) {
    state.result = win;
    state.phase = { kind: 'ended', number: N.number };
    return { deaths: N.deaths, win };
  }
  return { deaths: N.deaths, win: null };
}
