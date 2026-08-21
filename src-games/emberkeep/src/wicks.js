// Emberkeep — wicks. A different fire is a different RULE, never a different colour scheme.
//
// The rejected version of this feature was costumes. It fails for a specific reason: Ember's
// colour IS his state readout — warm and tall means healthy, dim and blue-edged means guttering.
// Let the player paint him purple and you have traded a working diegetic health bar for a
// wardrobe. A collectible has to do a job; these change what the game is.
//
// Each wick is a lens on all eleven existing rooms rather than eleven more rooms.
//
// SOLVABILITY: any wick that alters gravity or jump alters the jump envelope, which means the
// no-burn proof does NOT transfer. tools/solver.js runs every room against every movement-
// altering wick. Lower gravity is not assumed to be strictly easier — it raises the ceiling but
// also slows the fall, which can break a route that drops through a gap.

export const WICKS = {
  ember: {
    id: 'ember', name: 'Ember', blurb: 'Himself. Whatever that is worth.',
    canIgnite: true, light: 1.00, drain: 1.00, grav: 1.00, jump: 1.00,
    spreadFast: false, found: true,
    tint: [255, 150, 45],
  },
  coldfire: {
    id: 'coldfire', name: 'Coldfire', blurb: 'Cannot set anything alight. Not even on purpose.',
    // The ability is a RESTRICTION, and that is the point: it takes the choice away and makes
    // the whole keep the pacifist puzzle by force. It is also the only wick that can never
    // fail the theme.
    canIgnite: false, light: 0.58, drain: 0.72, grav: 1.00, jump: 1.00,
    spreadFast: false, found: false,
    tint: [120, 190, 255],
  },
  deepfire: {
    id: 'deepfire', name: 'Deepfire', blurb: 'Burns hot, burns fast, sees everything.',
    canIgnite: true, light: 1.52, drain: 2.05, grav: 1.00, jump: 1.00,
    spreadFast: true, found: false,
    tint: [255, 92, 30],
  },
  wisp: {
    id: 'wisp', name: 'Wisp', blurb: 'Barely here. Falls like a thought.',
    canIgnite: true, light: 0.82, drain: 0.88, grav: 0.55, jump: 0.92,
    spreadFast: false, found: false,
    tint: [214, 226, 255],
  },
};

export const WICK_IDS = Object.keys(WICKS);

// Only these change how far he can jump, so only these need their own proof run.
export const MOVEMENT_WICKS = WICK_IDS.filter(id => WICKS[id].grav !== 1 || WICKS[id].jump !== 1);

export function wick(id) { return WICKS[id] || WICKS.ember; }

// Where each wick is hidden. Found, not chosen from a menu — the first person to pick one up
// should feel like they broke something, which a difficulty select cannot do.
export const WICK_CACHES = {
  'Trust': 'coldfire',
  'It Spreads': 'deepfire',
  'The Rookery': 'wisp',
};
