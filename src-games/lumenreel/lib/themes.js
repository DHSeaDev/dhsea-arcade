// Two skins over one game. A theme changes PALETTE, SYMBOL SET, PARTICLE COLOUR,
// AMBIENT MOTION and NAMING — never a rule, a probability or a payout. That
// separation is deliberate: if a reskin could touch the maths, every band in
// constants.js would have to be re-measured per theme, and the dark-law gate
// would have to prove parity twice. It cannot, so it doesn't.

export const THEMES = {
  prism: {
    id: 'prism',
    name: 'Prism',
    tagline: 'Cut light, held still.',
    // Symbol keys are shared; only their names and hues change.
    symbolNames: {
      q: 'Quartz Chip', c: 'Citrine Chip', a: 'Amethyst Chip', t: 'Topaz Chip', b: 'Beryl Chip',
      P: 'Prism', H: 'Halo', N: 'Nova', E: 'Eclipse',
      W: 'Refraction (Wild)', S: 'Starburst (Scatter)', O: 'Lumen Core',
    },
    featureNames: {
      splash: 'Refraction Splash', thunder: 'Prism Thunder', wheel: 'Prism Wheel',
      hold: 'Crystallize', meter: 'Prism Meter', currency: 'Lumens', payout: 'Facets',
      generator: 'Prism', collection: 'Critters',
    },
    particleHues: [190, 220, 280, 320],
    moteShape: 'shard',
  },
  verdant: {
    id: 'verdant',
    name: 'Verdant',
    tagline: 'Light, but growing.',
    symbolNames: {
      q: 'Clover Leaf', c: 'Marigold', a: 'Foxglove', t: 'Amber Sap', b: 'Fern Frond',
      P: 'Blossom', H: 'Sun Halo', N: 'Wildfire Poppy', E: 'Nightshade',
      W: 'Pollen Burst (Wild)', S: 'Dandelion (Scatter)', O: 'Golden Seed',
    },
    featureNames: {
      splash: 'Pollen Burst', thunder: 'Deep Root', wheel: 'Harvest Wheel',
      hold: 'Take Root', meter: 'Growth Meter', currency: 'Sunlight', payout: 'Seeds',
      generator: 'Garden', collection: 'Critters',
    },
    particleHues: [95, 130, 45, 340],
    moteShape: 'petal',
  },
};

export const THEME_IDS = Object.keys(THEMES);
export function themeOf(id) { return THEMES[id] || THEMES.prism; }
export function nextTheme(id) {
  const i = THEME_IDS.indexOf(id);
  return THEME_IDS[(i + 1) % THEME_IDS.length];
}
