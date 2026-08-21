/**
 * Game setup: team composition, bag draw, setup modifiers, and the
 * per-game secrets (the Mistaken's false calling, the Glassreader's Mirage,
 * the Hollow's bluffs).
 *
 * All of this is deterministic given a seed. Nothing here calls a model.
 */

import { ROLES, ROLE_IDS, TYPE, TEAM, rolesOfType } from './roles.js';

/**
 * Canonical team composition. Index by total player count.
 * [wardens, strays, sworn, hollow]
 */
export const COMPOSITION = {
  5:  [3, 0, 1, 1],
  6:  [3, 1, 1, 1],
  7:  [5, 0, 1, 1],
  8:  [5, 1, 1, 1],
  9:  [5, 2, 1, 1],
  10: [7, 0, 2, 1],
  11: [7, 1, 2, 1],
  12: [7, 2, 2, 1],
  13: [9, 0, 3, 1],
  14: [9, 1, 3, 1],
  15: [9, 2, 3, 1],
};

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;
export const SUPPORTED_MVP = { min: 7, max: 12 };

/** @param {number} n */
export function compositionFor(n) {
  const c = COMPOSITION[n];
  if (!c) throw new Error(`Unsupported player count: ${n} (supported ${MIN_PLAYERS}-${MAX_PLAYERS})`);
  return { wardens: c[0], strays: c[1], sworn: c[2], hollow: c[3] };
}

export const NAME_POOL = [
  'Rei', 'Kaede', 'Sora', 'Ilva', 'Tobren', 'Mira', 'Ashen', 'Calla',
  'Danne', 'Eiko', 'Fen', 'Gale', 'Hana', 'Ivor', 'Juno', 'Kite',
  'Lys', 'Moth', 'Nima', 'Orin', 'Pell', 'Quill', 'Rue', 'Sable',
  'Tam', 'Umbra', 'Vale', 'Wren', 'Yara', 'Zell',
];

/**
 * Compose the bag of callings for a game.
 *
 * Setup modifiers (the Riftwarden) are resolved BEFORE the remaining slots are
 * filled — drawing them afterwards would silently over- or under-fill the bag.
 *
 * @param {number} playerCount
 * @param {ReturnType<import('./rng.js').createRng>} rng
 * @param {{forceRoles?: string[], excludeRoles?: string[]}} [opts]
 */
export function composeBag(playerCount, rng, opts = {}) {
  const force = opts.forceRoles || [];
  const exclude = new Set(opts.excludeRoles || []);
  let { wardens, strays, sworn, hollow } = compositionFor(playerCount);

  const avail = (type) =>
    rolesOfType(type).filter((id) => !exclude.has(id) && !force.includes(id));

  const chosen = { warden: [], stray: [], sworn: [], hollow: [] };

  // Forced roles are seated first and count against their own budget.
  for (const id of force) {
    const r = ROLES[id];
    if (!r) throw new Error(`Cannot force unknown role: ${id}`);
    chosen[r.type].push(id);
  }

  // 1. Draw evil first — the Hollow and the Sworn — because a Sworn may modify setup.
  while (chosen.hollow.length < hollow) chosen.hollow.push(rng.pick(avail(TYPE.HOLLOW)));
  while (chosen.sworn.length < sworn) {
    const pool = avail(TYPE.SWORN).filter((id) => !chosen.sworn.includes(id));
    if (!pool.length) break;
    chosen.sworn.push(rng.pick(pool));
  }

  // 2. Apply setup modifiers now, before good roles are drawn.
  const modifiers = [];
  for (const id of [...chosen.sworn, ...chosen.hollow]) {
    if (ROLES[id].setupModifier) {
      if (id === 'riftwarden') {
        const shift = Math.min(2, wardens);
        // Cannot create more strays than there are stray callings available.
        const room = rolesOfType(TYPE.STRAY).filter((s) => !exclude.has(s)).length - strays;
        const applied = Math.min(shift, Math.max(0, room));
        wardens -= applied;
        strays += applied;
        modifiers.push({ by: id, wardens: -applied, strays: +applied });
      }
    }
  }

  // 3. Fill good.
  while (chosen.stray.length < strays) {
    const pool = avail(TYPE.STRAY).filter((id) => !chosen.stray.includes(id));
    if (!pool.length) break;
    chosen.stray.push(rng.pick(pool));
  }
  while (chosen.warden.length < wardens) {
    const pool = avail(TYPE.WARDEN).filter((id) => !chosen.warden.includes(id));
    if (!pool.length) break;
    chosen.warden.push(rng.pick(pool));
  }

  const bag = [...chosen.warden, ...chosen.stray, ...chosen.sworn, ...chosen.hollow];
  if (bag.length !== playerCount) {
    throw new Error(`Bag composition failed: ${bag.length} callings for ${playerCount} souls`);
  }
  return { bag, modifiers, counts: { wardens, strays, sworn, hollow } };
}

/**
 * Build the full initial game state.
 *
 * @param {object} cfg
 * @param {number} cfg.playerCount
 * @param {ReturnType<import('./rng.js').createRng>} cfg.rng
 * @param {string} [cfg.seedPhrase]
 * @param {string[]} [cfg.names]
 * @param {string} [cfg.playerName]
 * @param {string} [cfg.forcePlayerRole] - dev/replay: pin the human's calling
 */
export function createGame(cfg) {
  const { playerCount, rng } = cfg;
  const { bag, modifiers, counts } = composeBag(playerCount, rng, {
    forceRoles: cfg.forcePlayerRole ? [cfg.forcePlayerRole] : [],
  });

  const shuffled = rng.shuffle(bag);
  const names = cfg.names && cfg.names.length >= playerCount
    ? cfg.names.slice(0, playerCount)
    : rng.sample(NAME_POOL, playerCount);

  // The human occupies a random seat. Lantern-only for this build.
  const lanternSeats = shuffled
    .map((id, i) => ({ id, i }))
    .filter(({ id }) => ROLES[id].team === TEAM.LANTERN)
    .map(({ i }) => i);
  const humanSeat = cfg.forcePlayerRole
    ? shuffled.indexOf(cfg.forcePlayerRole)
    : rng.pick(lanternSeats);

  const seats = shuffled.map((roleId, i) => ({
    seat: i,
    name: i === humanSeat ? (cfg.playerName || 'You') : names[i],
    isHuman: i === humanSeat,
    role: roleId,          // TRUE calling — never rendered for the Mistaken
    perceivedRole: roleId, // what this soul believes; diverges for the Mistaken
    alive: true,
    finalWordSpent: false,
    statuses: [],
    usedOnce: false,       // Hexbreaker, Oathbound trigger
  }));

  // ── The Mistaken: believes they hold a Warden calling not otherwise in play.
  const mistakenSeat = seats.find((s) => s.role === 'mistaken');
  if (mistakenSeat) {
    const inPlay = new Set(shuffled);
    const pool = rolesOfType(TYPE.WARDEN).filter((id) => !inPlay.has(id) && !ROLES[id].hidden);
    mistakenSeat.perceivedRole = pool.length ? rng.pick(pool) : 'resonant';
  }

  // ── The Mirage: one Lantern soul always reads true to the Glassreader.
  let mirageSeat = null;
  if (shuffled.includes('glassreader')) {
    const candidates = seats.filter((s) => ROLES[s.role].team === TEAM.LANTERN);
    mirageSeat = rng.pick(candidates).seat;
  }

  // ── The Hollow's bluffs: three callings not in play.
  const inPlay = new Set(shuffled);
  const bluffPool = ROLE_IDS.filter(
    (id) => !inPlay.has(id) && ROLES[id].team === TEAM.LANTERN && !ROLES[id].hidden
  );
  const bluffs = rng.sample(bluffPool, 3);

  return {
    version: 1,
    seed: cfg.seedPhrase || 'unseeded',
    rngState: rng.getState(),
    codex: 'quiet-ward',
    playerCount,
    humanSeat,
    seats,
    phase: { kind: 'setup', number: 0 },
    day: null,
    registry: { mirageSeat, bluffs, modifiers, counts },
    log: [],
    result: null,
    pendingDeaths: [],
  };
}
