// The 100 critters. AUTHORED, not seeded — every row is a design decision.
// The renderer (art/critter.js) is deterministic, so a row here is a complete
// specification of a sprite: nothing is licensed, nothing is fetched, nothing
// is random at display time.
//
// Fields
//   id     stable numeric key (never reorder — saves reference it)
//   name   display name
//   tier   1..5  (Quartz / Beryl / Amethyst / Opal / Radiant)
//   set    themed sub-collection; completing a set grants a bonus
//   body   renderer shape family
//   hue    base hue 0..359
//   hue2   accent hue
//   f      facet count (silhouette complexity)
//   limbs  0..6
//   eyes   1..4
//   aura   none | glow | sparkle | corona | fracture
//   mood   resting expression + body language: calm happy curious sleepy alarmed
//          proud shy smug awe. AUTHORED per row to match the tag, not derived
//          from tier or set -- personality is the whole point of a 100-item dex.
//   tag    one-line flavour, shown in the dex

import { VERDANT } from './species_verdant.js';

const S = (id, name, tier, set, body, hue, hue2, f, limbs, eyes, aura, mood, tag) =>
  ({ id, name, tier, set, body, hue, hue2, f, limbs, eyes, aura, mood, tag });

export const SPECIES = [
  // ---- TIER 1 · QUARTZ · 34 -----------------------------------------------
  // Motes (8) — the smallest things that hold light.
  S(1,  'Glimmit',   1, 'Motes', 'orb',    48,  60,  5, 0, 2, 'glow', 'calm',    'Hums when the tab is quiet.'),
  S(2,  'Fleckle',   1, 'Motes', 'orb',    196, 210, 4, 0, 2, 'sparkle', 'shy', 'Too small to cast a shadow.'),
  S(3,  'Twinkid',   1, 'Motes', 'orb',    312, 330, 6, 0, 3, 'sparkle', 'smug', 'Blinks out of sync on purpose.'),
  S(4,  'Motelet',   1, 'Motes', 'orb',    88,  100, 5, 0, 1, 'glow', 'curious',    'Drifts toward whoever is watching.'),
  S(5,  'Blinker',   1, 'Motes', 'orb',    16,  36,  4, 0, 2, 'glow', 'sleepy',    'One eye, and it is always the left.'),
  S(6,  'Speckle',   1, 'Motes', 'orb',    268, 284, 6, 0, 3, 'sparkle', 'happy', 'Comes in threes. Nobody knows why.'),
  S(7,  'Shimmy',    1, 'Motes', 'orb',    148, 168, 5, 0, 2, 'glow', 'happy',    'Vibrates at exactly one note.'),
  S(8,  'Dustling',  1, 'Motes', 'orb',    36,  22,  4, 0, 2, 'none', 'calm',    'Settles on everything you own.'),
  // Chips (7) — broken off something larger.
  S(9,  'Chippet',   1, 'Chips', 'shard',  204, 190, 3, 0, 2, 'none', 'calm',    'Still fits the gap it came from.'),
  S(10, 'Quartzel',  1, 'Chips', 'shard',  0,   20,  4, 0, 2, 'glow', 'proud',    'Sharper than it needs to be.'),
  S(11, 'Nickle',    1, 'Chips', 'shard',  52,  40,  3, 2, 2, 'none', 'curious',    'Two legs, no plan.'),
  S(12, 'Snapper',   1, 'Chips', 'shard',  128, 110, 4, 2, 2, 'none', 'smug',    'Clicks when it disagrees.'),
  S(13, 'Flakelet',  1, 'Chips', 'shard',  180, 200, 5, 0, 1, 'sparkle', 'shy', 'Thinner than a promise.'),
  S(14, 'Grit',      1, 'Chips', 'shard',  28,  14,  3, 0, 2, 'none', 'smug',    'Gets everywhere. Regrets nothing.'),
  S(15, 'Crumb',     1, 'Chips', 'shard',  40,  56,  3, 2, 1, 'none', 'curious',    'Follows the biggest critter it can find.'),
  // Pebbles (7) — worn smooth.
  S(16, 'Pebblin',   1, 'Pebbles', 'orb',  212, 224, 8, 2, 2, 'none', 'smug',    'Refuses to roll downhill.'),
  S(17, 'Roundling', 1, 'Pebbles', 'orb',  164, 150, 8, 2, 2, 'glow', 'proud',    'Perfectly circular and smug about it.'),
  S(18, 'Tumble',    1, 'Pebbles', 'orb',  32,  46,  7, 4, 2, 'none', 'happy',    'Four legs, all of them optional.'),
  S(19, 'Cobble',    1, 'Pebbles', 'orb',  248, 232, 8, 4, 2, 'none', 'sleepy',    'Was a road once.'),
  S(20, 'Gravlet',   1, 'Pebbles', 'orb',  20,  8,   7, 2, 3, 'none', 'happy',    'Arrives with several friends.'),
  S(21, 'Smoothy',   1, 'Pebbles', 'orb',  188, 176, 8, 0, 2, 'glow', 'proud',    'Nothing has ever scratched it.'),
  S(22, 'Rollick',   1, 'Pebbles', 'orb',  96,  112, 7, 4, 2, 'sparkle', 'shy', 'Only moves when unobserved.'),
  // Sprouts (6) — crystal that decided to grow.
  S(23, 'Sprig',     1, 'Sprouts', 'spire', 104, 88,  4, 0, 2, 'glow', 'calm',    'Grows one facet a day.'),
  S(24, 'Budling',   1, 'Sprouts', 'spire', 120, 140, 5, 0, 2, 'glow', 'sleepy',    'Has not opened yet. Will not be rushed.'),
  S(25, 'Frondle',   1, 'Sprouts', 'spire', 84,  100, 6, 2, 2, 'none', 'curious',    'Leans toward the brightest window.'),
  S(26, 'Curlip',    1, 'Sprouts', 'spire', 140, 156, 5, 2, 2, 'sparkle', 'shy', 'Curls up when spoken about.'),
  S(27, 'Tendral',   1, 'Sprouts', 'spire', 72,  92,  6, 4, 1, 'none', 'curious',    'Holds on to the last thing it touched.'),
  S(28, 'Seedra',    1, 'Sprouts', 'spire', 156, 172, 4, 0, 3, 'glow', 'alarmed',    'Contains a smaller, angrier Seedra.'),
  // Drips (6) — liquid light that never quite falls.
  S(29, 'Dewlet',    1, 'Drips', 'wisp',   192, 204, 4, 0, 2, 'glow', 'sleepy',    'Hangs on well past reason.'),
  S(30, 'Plink',     1, 'Drips', 'wisp',   208, 220, 3, 0, 1, 'sparkle', 'alarmed', 'Announces itself once, then stops.'),
  S(31, 'Trickle',   1, 'Drips', 'wisp',   224, 236, 5, 0, 2, 'glow', 'calm',    'Takes the longest route available.'),
  S(32, 'Rivulin',   1, 'Drips', 'wisp',   176, 188, 5, 0, 2, 'none', 'calm',    'Braided out of three smaller ones.'),
  S(33, 'Beadle',    1, 'Drips', 'wisp',   240, 252, 4, 0, 3, 'sparkle', 'smug', 'Collects other Beadles. Never shares.'),
  S(34, 'Puddlin',   1, 'Drips', 'wisp',   200, 184, 6, 0, 2, 'glow', 'happy',    'Wider than it is deep, and content.'),

  // ---- TIER 2 · BERYL · 26 -------------------------------------------------
  // Wings (7)
  S(35, 'Flitter',   2, 'Wings', 'moth',   300, 320, 6, 2, 2, 'sparkle', 'happy', 'Never lands on the same facet twice.'),
  S(36, 'Gossamir',  2, 'Wings', 'moth',   276, 292, 7, 2, 2, 'glow', 'shy',    'You can read text through its wings.'),
  S(37, 'Veilwing',  2, 'Wings', 'moth',   256, 240, 7, 2, 3, 'glow', 'calm',    'Dims the room slightly, politely.'),
  S(38, 'Papillo',   2, 'Wings', 'moth',   340, 12,  8, 2, 2, 'sparkle', 'happy', 'Opens and closes on a four-second count.'),
  S(39, 'Whirlet',   2, 'Wings', 'moth',   44,  28,  6, 2, 2, 'none', 'proud',    'Flies in a perfect circle and calls it progress.'),
  S(40, 'Zephyrl',   2, 'Wings', 'moth',   184, 200, 7, 2, 2, 'glow', 'curious',    'Arrives before the draft does.'),
  S(41, 'Glidewing', 2, 'Wings', 'moth',   204, 216, 8, 2, 1, 'corona', 'calm',  'Has not flapped since it was found.'),
  // Crawlers (7)
  S(42, 'Scuttle',   2, 'Crawlers', 'beetle', 24,  8,   6, 6, 2, 'none', 'alarmed',   'Six legs, one direction, no reverse.'),
  S(43, 'Chitterin', 2, 'Crawlers', 'beetle', 56,  40,  7, 6, 3, 'none', 'happy',   'Talks constantly. About facets.'),
  S(44, 'Manteel',   2, 'Crawlers', 'beetle', 100, 84,  7, 4, 2, 'glow', 'calm',   'Holds very still, for reasons of its own.'),
  S(45, 'Carapax',   2, 'Crawlers', 'beetle', 12,  356, 8, 6, 2, 'fracture', 'proud','Its shell is a repaired shell.'),
  S(46, 'Pinchit',   2, 'Crawlers', 'beetle', 344, 328, 6, 4, 2, 'none', 'curious',   'Grabs the nearest bright thing.'),
  S(47, 'Trundle',   2, 'Crawlers', 'beetle', 32,  48,  8, 6, 2, 'none', 'sleepy',   'Slow, and entirely unhurried about it.'),
  S(48, 'Nibbler',   2, 'Crawlers', 'beetle', 68,  52,  6, 6, 3, 'sparkle', 'shy','Files down its own edges at night.'),
  // Swimmers (6)
  S(49, 'Ripplet',   2, 'Swimmers', 'serpent', 196, 212, 6, 0, 2, 'glow', 'calm',   'Leaves a wake in dry air.'),
  S(50, 'Finlet',    2, 'Swimmers', 'serpent', 172, 188, 6, 2, 2, 'none', 'curious',   'Steers with a fin it does not have.'),
  S(51, 'Glisser',   2, 'Swimmers', 'serpent', 208, 224, 7, 0, 2, 'sparkle', 'sleepy','Moves without appearing to.'),
  S(52, 'Nautilin',  2, 'Swimmers', 'cluster', 220, 236, 8, 0, 2, 'glow', 'proud',   'Its spiral has one facet too many.'),
  S(53, 'Coralin',   2, 'Swimmers', 'cluster', 344, 4,   8, 0, 3, 'glow', 'happy',   'Grew in a shape nobody planned.'),
  S(54, 'Tidewisp',  2, 'Swimmers', 'wisp',    188, 204, 5, 0, 2, 'corona', 'calm', 'Comes twice a day. Never says when.'),
  // Burrowers (6)
  S(55, 'Delvin',    2, 'Burrowers', 'beetle', 28,  16,  6, 4, 2, 'none', 'shy',   'Only surfaces to be counted.'),
  S(56, 'Gnawlet',   2, 'Burrowers', 'beetle', 44,  32,  6, 4, 2, 'none', 'smug',   'Has opinions about bedrock.'),
  S(57, 'Tunnelin',  2, 'Burrowers', 'serpent', 20, 36,  7, 0, 1, 'none', 'curious',   'Is longer than the space it is in.'),
  S(58, 'Molewisp',  2, 'Burrowers', 'wisp',    276, 260, 5, 2, 1, 'glow', 'alarmed',  'Navigates entirely by echo.'),
  S(59, 'Rootgrub',  2, 'Burrowers', 'serpent', 88,  72,  6, 0, 2, 'none', 'curious',  'Mistakes every cable for a root.'),
  S(60, 'Shalefang', 2, 'Burrowers', 'shard',   200, 216, 5, 4, 2, 'fracture', 'proud','Chipped a tooth on something important.'),

  // ---- TIER 3 · AMETHYST · 20 ---------------------------------------------
  // Lanterns (5)
  S(61, 'Lanternel', 3, 'Lanterns', 'orb',    40,  56,  9, 2, 2, 'corona', 'calm', 'Carries its own weather.'),
  S(62, 'Wickle',    3, 'Lanterns', 'spire',  24,  44,  8, 0, 2, 'corona', 'happy', 'Burns nothing and is warm anyway.'),
  S(63, 'Beaconel',  3, 'Lanterns', 'spire',  200, 220, 9, 0, 3, 'corona', 'awe', 'Points at something over the horizon.'),
  S(64, 'Gleamherd', 3, 'Lanterns', 'cluster',52,  68,  10,4, 3, 'glow', 'proud',   'Motes follow it. It has not noticed.'),
  S(65, 'Torchlin',  3, 'Lanterns', 'moth',   16,  36,  8, 2, 2, 'corona', 'alarmed', 'Trails light it cannot afford.'),
  // Weavers (5)
  S(66, 'Silkspan',  3, 'Weavers', 'cluster', 288, 304, 9, 6, 3, 'sparkle', 'proud','Spans a gap in a single night.'),
  S(67, 'Loomwing',  3, 'Weavers', 'moth',    264, 280, 10,2, 2, 'glow', 'calm',   'Its pattern repeats every 61 beats.'),
  S(68, 'Threadle',  3, 'Weavers', 'serpent', 312, 328, 8, 0, 2, 'sparkle', 'curious','Pulls at a loose edge of the room.'),
  S(69, 'Spindril',  3, 'Weavers', 'cluster', 252, 268, 10,6, 2, 'glow', 'smug',   'Spins clockwise. Always. Check.'),
  S(70, 'Warpling',  3, 'Weavers', 'shard',   296, 312, 9, 4, 3, 'fracture', 'alarmed','Bends the grid it stands on.'),
  // Wardens (5)
  S(71, 'Bulwark',   3, 'Wardens', 'construct', 208, 192, 10, 4, 2, 'glow', 'calm',  'Stands where a door used to be.'),
  S(72, 'Sentrix',   3, 'Wardens', 'construct', 180, 164, 11, 4, 4, 'corona', 'alarmed','Four eyes, one blind spot, well hidden.'),
  S(73, 'Gatekith',  3, 'Wardens', 'construct', 232, 216, 10, 2, 2, 'glow', 'curious',  'Asks a question you already answered.'),
  S(74, 'Bastian',   3, 'Wardens', 'construct', 12,  356, 11, 4, 2, 'fracture', 'proud','Cracked, load-bearing, unbothered.'),
  S(75, 'Vigilis',   3, 'Wardens', 'spire',     220, 236, 10, 0, 3, 'corona', 'alarmed','Has not blinked since you installed this.'),
  // Echoes (5)
  S(76, 'Reverb',    3, 'Echoes', 'wisp',    268, 252, 8, 0, 2, 'corona', 'sleepy', 'Answers a second after you stop.'),
  S(77, 'Chimeling', 3, 'Echoes', 'cluster', 188, 204, 9, 0, 3, 'sparkle', 'happy','Rings when a set completes.'),
  S(78, 'Resonel',   3, 'Echoes', 'orb',     160, 176, 10,0, 2, 'corona', 'calm', 'Matches the pitch of the room.'),
  S(79, 'Hollowtone',3, 'Echoes', 'spire',   244, 228, 9, 0, 2, 'glow', 'sleepy',   'Empty in a way that sounds full.'),
  S(80, 'Knell',     3, 'Echoes', 'construct',256, 240, 10,2, 1, 'fracture', 'alarmed','Counts something down. Will not say what.'),

  // ---- TIER 4 · OPAL · 14 --------------------------------------------------
  // Constructs (5)
  S(81, 'Automara',  4, 'Constructs', 'construct', 196, 176, 12, 6, 4, 'corona', 'alarmed', 'Built to sort light. Sorts everything now.'),
  S(82, 'Cogitor',   4, 'Constructs', 'construct', 216, 240, 13, 4, 3, 'glow', 'curious',   'Thinks in facets per second.'),
  S(83, 'Latticeon', 4, 'Constructs', 'cluster',   172, 200, 14, 6, 2, 'sparkle', 'calm','Is mostly the space between itself.'),
  S(84, 'Girdrix',   4, 'Constructs', 'construct', 28,  8,   12, 6, 2, 'fracture', 'proud','Holds a shape that stopped existing.'),
  S(85, 'Obelian',   4, 'Constructs', 'spire',     260, 284, 13, 0, 3, 'corona', 'awe', 'Older than the collection it is in.'),
  // Beasts (5)
  S(86, 'Grimshard', 4, 'Beasts', 'beetle',  348, 328, 12, 6, 4, 'fracture', 'proud','Every plate is a repaired break.'),
  S(87, 'Ursalith',  4, 'Beasts', 'construct', 32, 12,  13, 4, 2, 'corona', 'calm', 'Slow, immense, and entirely gentle.'),
  S(88, 'Vulpra',    4, 'Beasts', 'moth',    16,  40,  12, 4, 2, 'glow', 'smug',   'Nine tails, eight of them refraction.'),
  S(89, 'Cervain',   4, 'Beasts', 'spire',   84,  104, 13, 4, 2, 'corona', 'shy', 'Antlers grow one branch per set you finish.'),
  S(90, 'Sauridon',  4, 'Beasts', 'serpent', 128, 148, 14, 4, 3, 'glow', 'sleepy',   'Remembers being much larger.'),
  // Spirits (4)
  S(91, 'Wispera',   4, 'Spirits', 'wisp',    204, 232, 11, 0, 2, 'corona', 'shy', 'Only fully visible out of the corner of the eye.'),
  S(92, 'Umbrel',    4, 'Spirits', 'wisp',    272, 248, 12, 0, 3, 'fracture', 'smug','Casts light instead of shadow. Inverted.'),
  S(93, 'Aetheline', 4, 'Spirits', 'orb',     176, 200, 13, 0, 2, 'corona', 'awe', 'Weighs nothing and bends the floor.'),
  S(94, 'Nocturne',  4, 'Spirits', 'moth',    244, 268, 12, 2, 4, 'corona', 'curious', 'Arrives when the meter is nearly full.'),

  // ---- TIER 5 · RADIANT · 6 ------------------------------------------------
  S(95,  'Zenithra',  5, 'Archetypes', 'construct', 48,  200, 16, 6, 4, 'corona', 'proud',  'The high point. Everything below is the climb.'),
  S(96,  'Umbraxis',  5, 'Archetypes', 'wisp',      264, 300, 16, 0, 3, 'fracture', 'smug','The dark a prism makes on the other side.'),
  S(97,  'Solvane',   5, 'Archetypes', 'orb',       36,  56,  16, 4, 2, 'corona', 'awe',  'One colour, held so hard it became all of them.'),
  S(98,  'Chromaeon', 5, 'Archetypes', 'serpent',   0,   340, 17, 4, 4, 'corona', 'happy',  'Every facet a different hue, every second a different order.'),
  S(99,  'Vitrimor',  5, 'Archetypes', 'cluster',   196, 220, 17, 6, 3, 'fracture', 'calm','Broken on purpose. That is the whole design.'),
  S(100, 'Prismarch', 5, 'Archetypes', 'spire',     220, 40,  18, 4, 4, 'corona', 'awe',  'The first cut. Every critter here is a piece of it.'),
];

// Core 100 are theme 'prism'; the Verdant Grove is appended as a sixth tier that
// only becomes drawable in Nature mode. ALL_SPECIES is what the dex renders;
// SPECIES stays the core 100 so every existing consumer (and the measured
// completion band) is unaffected.
for (const s of SPECIES) s.theme = 'prism';

export const ALL_SPECIES = [...SPECIES, ...VERDANT];
export const SPECIES_BY_ID = new Map(ALL_SPECIES.map((s) => [s.id, s]));

export const SETS = [...new Set(ALL_SPECIES.map((s) => s.set))];
export { VERDANT };
