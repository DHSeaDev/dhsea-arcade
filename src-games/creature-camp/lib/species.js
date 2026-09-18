// The 25 Creature Camp species. AUTHORED rows — every field is a design decision.
//
//   id          stable numeric id (display order). Saves reference `key`, never `id`.
//   key         stable string key used by art, chatter and unlock data
//   name        default display name (the player may rename owned creatures)
//   kind        what it is, shown in the Bestiary
//   plan        body plan (body-plan-rig): chibi | winged | serpent | quadruped | colossus | wisp
//   rarity      common | uncommon | rare | legendary — a LABEL only. No draw rates exist anywhere.
//   voice       personality register for chatter
//   rest        authored resting expression (vendor/expression.js EXPRESSIONS)
//   pack        'base' (in the default roster) | 'code1' (released later via codes)
//   sig         what the signature body-language channel physically is
//   lore        one line, shown in the Bestiary once owned

export const VOICES = ['shy', 'cheerful', 'smug', 'curious', 'sleepy', 'gruff', 'dreamy', 'mysterious'];
export const PLANS = ['chibi', 'winged', 'serpent', 'quadruped', 'colossus', 'wisp'];
export const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

const S = (id, key, name, kind, plan, rarity, voice, rest, pack, sig, lore) =>
  Object.freeze({ id, key, name, kind, plan, rarity, voice, rest, pack, sig, lore });

export const SPECIES = Object.freeze([
  S(0,  'ember',   'Ember',   'fox kit',          'chibi',     'common',    'shy',        'shy',     'base', 'ears',     'A small fox who watched the campfire begin, and never quite stopped watching it.'),
  S(1,  'pip',     'Pip',     'chipmunk',         'chibi',     'common',    'cheerful',   'happy',   'base', 'cheeks',   'Keeps a seed for everyone. Has never once remembered where.'),
  S(2,  'wicket',  'Wicket',  'firefly',          'winged',    'common',    'curious',    'curious', 'base', 'glow',     'Carries a lantern it did not ask for and will not put down.'),
  S(3,  'clover',  'Clover',  'rabbit kit',       'chibi',     'common',    'cheerful',   'calm',    'base', 'earflop',  'One ear listens to the camp. The other listens to something else.'),
  S(4,  'fen',     'Fen',     'tree frog',        'chibi',     'uncommon',  'smug',       'smug',    'base', 'throat',   'Sings exactly one note, beautifully, at length.'),
  S(5,  'thistle', 'Thistle', 'hedgehog',         'chibi',     'rare',      'curious',    'curious', 'base', 'quills',   'Appears after enough commotion. Wants to know what all the fuss was.'),
  S(6,  'sage',    'Sage',    'stump spirit',     'colossus',  'uncommon',  'smug',       'proud',   'base', 'sapling',  'Older than the path. Amused by anyone who thinks the path is old.'),
  S(7,  'bramble', 'Bramble', 'raccoon',          'chibi',     'uncommon',  'gruff',      'smug',    'base', 'tailring', 'Borrows things. Returns them. Usually. Eventually.'),
  S(8,  'tuck',    'Tuck',    'box turtle',       'chibi',     'uncommon',  'sleepy',     'sleepy',  'base', 'shellhead','Waits. Is good at it. Glad you came back.'),
  S(9,  'wren',    'Wren',    'wren',             'winged',    'uncommon',  'cheerful',   'happy',   'base', 'tailcock', 'A very large song in a very small bird.'),
  S(10, 'nib',     'Nib',     'newt',             'serpent',   'common',    'shy',        'shy',     'base', 'tailcurl', 'Lives under the fifth stone. You checked the other four first.'),
  S(11, 'breeze',  'Breeze',  'wind sprite',      'wisp',      'rare',      'dreamy',     'calm',    'base', 'ribbons',  'A sprite of wind and wandering. Never in the same place twice.'),
  S(12, 'burr',    'Burr',    'beaver',           'chibi',     'uncommon',  'gruff',      'proud',   'base', 'tailslap', 'Is fixing the stick. The stick was fine. The stick is being fixed.'),
  S(13, 'lichen',  'Lichen',  'snail',            'serpent',   'common',    'sleepy',     'sleepy',  'base', 'stalks',   'Collects dew. Is in no hurry to tell you how much.'),
  S(14, 'morrow',  'Morrow',  'moth',             'winged',    'rare',      'dreamy',     'awe',     'base', 'wings',    'Circles the lantern at night, reading by it.'),
  S(15, 'hollow',  'Hollow',  'bat',              'winged',    'rare',      'shy',        'shy',     'base', 'wrap',     'Remembers every path through the woods, upside down.'),
  S(16, 'ripple',  'Ripple',  'river otter',      'serpent',   'uncommon',  'cheerful',   'happy',   'base', 'pebble',   'Has one favourite pebble. You will be shown it.'),
  S(17, 'juniper', 'Juniper', 'fawn',             'quadruped', 'rare',      'curious',    'curious', 'base', 'earswivel','Was lost for three days. Was never scared. Mostly.'),
  S(18, 'dapple',  'Dapple',  'mushroom sprite',  'chibi',     'uncommon',  'cheerful',   'happy',   'base', 'cap',      'Pops up wherever a game was played. Nobody knows how.'),
  S(19, 'hush',    'Hush',    'forest shade',     'wisp',      'legendary', 'mysterious', 'calm',    'base', 'eyeglow',  'The quiet between the pines. It was here before the camp, and it approves.'),
  // Code pack 1 — released later. Redeemable only by codes the author ships in an update.
  S(20, 'moss',    'Moss',    'badger',           'chibi',     'uncommon',  'gruff',      'calm',    'code1', 'satchel',  'Collects interesting things. Everything is interesting.'),
  S(21, 'luna',    'Luna',    'owl',              'winged',    'rare',      'curious',    'curious', 'code1', 'headturn', 'Studies the sky. Takes notes nobody can read.'),
  S(22, 'cove',    'Cove',    'seal',             'serpent',   'rare',      'sleepy',     'sleepy',  'code1', 'bubbles',  'Drifts in and out of dreams, and brings a few back.'),
  S(23, 'astra',   'Astra',   'constellation fox','wisp',      'legendary', 'mysterious', 'awe',     'code1', 'stars',    'Made of the light between stars, and the lines between them.'),
  S(24, 'root',    'Root',    'ancient burrower', 'colossus',  'legendary', 'sleepy',     'sleepy',  'code1', 'antlers',  'Older than the camp. Older than the woods. Still getting comfortable.'),
]);

// Lookup maps have NO prototype: a save naming "toString" or "constructor" must not
// resolve to an inherited function (shard A: that crashed the panel on start-up).
const nullMap = (pairs) => Object.freeze(Object.assign(Object.create(null), Object.fromEntries(pairs)));
export const BY_KEY = nullMap(SPECIES.map((s) => [s.key, s]));
export const BY_ID = nullMap(SPECIES.map((s) => [s.id, s]));
export const isSpecies = (k) => typeof k === 'string' && Object.hasOwn(BY_KEY, k);
export const BASE = Object.freeze(SPECIES.filter((s) => s.pack === 'base'));
export const STARTER_KEY = 'ember';
export const FINAL_KEY = 'hush';

export function speciesOf(key) { return BY_KEY[key] || null; }
