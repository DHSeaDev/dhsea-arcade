// The Verdant Grove — 25 plant critters, a SIXTH tier that exists only in Nature
// mode. Kept as a separate bonus track rather than folded into the 100 on purpose:
// the core collection's 24-hour completion band was measured against exactly 100
// entries, and quietly making it 125 would have invalidated that proof.
//
// Same row shape as lib/species.js so one renderer and one dex handle both.

const V = (id, name, set, body, hue, hue2, f, limbs, eyes, aura, mood, tag) =>
  ({ id, name, tier: 6, set, body, hue, hue2, f, limbs, eyes, aura, mood, tag, theme: 'verdant' });

export const VERDANT = [
  // Seedlings (6) — the first things up after rain.
  V(101, 'Sprouten',   'Seedlings', 'leaf',   104, 88,  5, 0, 2, 'glow',    'curious', 'Two leaves and an opinion.'),
  V(102, 'Cotyl',      'Seedlings', 'leaf',   118, 100, 5, 2, 2, 'none',    'shy',     'Has not decided which way is up.'),
  V(103, 'Radicle',    'Seedlings', 'vine',   86,  70,  4, 0, 1, 'none',    'calm',    'Goes down before it goes anywhere.'),
  V(104, 'Peepgreen',  'Seedlings', 'leaf',   132, 148, 6, 0, 3, 'sparkle', 'happy',   'Watches the window all day.'),
  V(105, 'Tendrilo',   'Seedlings', 'vine',   96,  112, 5, 4, 2, 'none',    'curious', 'Grabs the nearest anything.'),
  V(106, 'Mossling',   'Seedlings', 'bloom',  140, 120, 7, 0, 2, 'glow',    'sleepy',  'Softer than it has any need to be.'),
  // Bloomers (6) — the loud ones.
  V(107, 'Petalis',    'Bloomers',  'bloom',  330, 350, 8, 0, 2, 'sparkle', 'proud',   'Opens at nine, closes at five.'),
  V(108, 'Marigolde',  'Bloomers',  'bloom',  38,  52,  8, 2, 2, 'corona',  'happy',   'Smells like a summer nobody had.'),
  V(109, 'Foxbell',    'Bloomers',  'bloom',  292, 310, 7, 0, 3, 'glow',    'smug',    'Rings, but only for bees.'),
  V(110, 'Poppyre',    'Bloomers',  'bloom',  6,   20,  7, 0, 2, 'corona',  'alarmed', 'Bright red and entirely unbothered.'),
  V(111, 'Lupinel',    'Bloomers',  'spire',  266, 285, 9, 2, 2, 'glow',    'calm',    'Stacked like a staircase for insects.'),
  V(112, 'Dandelo',    'Bloomers',  'wisp',   52,  60,  6, 0, 2, 'sparkle', 'awe',     'Half of it has already left.'),
  // Understory (6) — the ones under everything else.
  V(113, 'Shroomlet',  'Understory','shroom', 18,  340, 7, 2, 2, 'glow',    'shy',     'Appeared overnight. Says nothing.'),
  V(114, 'Capwick',    'Understory','shroom', 282, 300, 8, 2, 3, 'corona',  'curious', 'Glows just enough to be followed.'),
  V(115, 'Mycelin',    'Understory','vine',   32,  16,  8, 6, 1, 'none',    'calm',    'Is much larger than the part you can see.'),
  V(116, 'Truffet',    'Understory','pod',    24,  10,  6, 4, 2, 'none',    'smug',    'Worth more than it looks. Knows it.'),
  V(117, 'Lichenor',   'Understory','bramble',160, 140, 9, 0, 2, 'none',    'sleepy',  'Two things pretending to be one.'),
  V(118, 'Rootmite',   'Understory','pod',    72,  56,  6, 6, 2, 'none',    'happy',   'Tidies the soil. Unpaid.'),
  // Canopy (4) — high up, slow, old.
  V(119, 'Boughan',    'Canopy',    'bramble',36,  22,  11, 4, 2, 'corona', 'proud',   'Remembers the fence being new.'),
  V(120, 'Willowyn',   'Canopy',    'vine',   150, 168, 10, 0, 2, 'glow',   'sleepy',  'Leans over water it cannot reach.'),
  V(121, 'Cedrix',     'Canopy',    'spire',  128, 106, 11, 2, 3, 'corona', 'calm',    'Smells like a room you liked.'),
  V(122, 'Amberoot',   'Canopy',    'pod',    30,  46,  10, 4, 2, 'fracture','awe',    'Carries something older than itself.'),
  // Solstice (3) — the top of the Grove.
  V(123, 'Heliora',    'Solstice',  'bloom',  46,  200, 15, 4, 4, 'corona', 'awe',     'Turns to follow whoever is kindest.'),
  V(124, 'Nyctara',    'Solstice',  'shroom', 258, 290, 15, 2, 3, 'fracture','smug',   'Only opens when nobody is counting.'),
  V(125, 'Everbloom',  'Solstice',  'bloom',  118, 340, 17, 4, 4, 'corona', 'happy',   'The last thing to close, every single year.'),
];

export const VERDANT_COUNT = VERDANT.length;
