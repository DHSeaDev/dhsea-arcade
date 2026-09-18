// Hats and mementos: the two things that outlive completing the roster.
//
// A hat is EARNED by something you did and then CHOSEN by you; it never changes play.
// A memento is what one friend eventually brings you, once you have looked after it for
// a while — it belongs to that friend, and it is the reason a finished camp still has
// something only it can give. Neither expires, neither can be missed, and neither needs
// you to come back on any particular day.

import { HAT_IDS } from '../art/hats.js';
import { BY_KEY, BASE } from './species.js';
import { activeDay } from './days.js';

export const MEMENTO_CARES = 12;          // counted care actions with ONE friend

/** How each hat is earned. `test` is pure and reads only saved progress. */
export const HAT_RULES = Object.freeze([
  { id: 'acorn', how: 'Clear Firefly Lantern', test: (s) => s.games.firefly.cleared },
  { id: 'leaf', how: 'Play Pond Skip five times', test: (s) => s.games.pondskip.plays >= 5 },
  { id: 'feather', how: 'Echo six notes in Birdsong', test: (s) => s.games.birdsong.best >= 6 },
  { id: 'pinecone', how: 'Stack ten acorns', test: (s) => s.games.acorn.best >= 10 },
  { id: 'mushroom', how: 'Clear the large Trail Memory board', test: (s) => s.games.trail.cleared },
  { id: 'straw', how: 'Reach camp day 5', test: (s) => activeDay(s) >= 5 },
  { id: 'bobble', how: 'Reach camp day 12', test: (s) => activeDay(s) >= 12 },
  { id: 'lantern', how: 'Turn over 12 stones', test: (s) => s.stats.stones >= 12 },
  { id: 'flower', how: 'Gather 20 dew drops', test: (s) => s.stats.dew >= 20 },
  { id: 'crown', how: 'Bring every camp friend home', test: (s) => s.creatures.filter((c) => BY_KEY[c.key]?.pack === 'base').length >= BASE.length },
]);

export function hatRule(id) { return HAT_RULES.find((r) => r.id === id) || null; }

/** Unlock any hats whose condition is now met. Returns the newly earned ids. */
export function grantHats(state) {
  const out = [];
  for (const r of HAT_RULES) {
    if (state.hats.includes(r.id)) continue;
    let met = false;
    try { met = !!r.test(state); } catch { met = false; }
    if (met) { state.hats.push(r.id); out.push(r.id); }
  }
  return out;
}

/** What each friend eventually brings you. One line, one keepsake, theirs alone. */
export const MEMENTOS = Object.freeze({
  ember: { item: 'a scorched pinecone', line: 'Ember nudges over a pinecone from the very first fire.' },
  pip: { item: 'a seed, finally remembered', line: 'Pip found the seed it had been saving. For you, apparently.' },
  wicket: { item: 'a spare lantern wick', line: 'Wicket leaves a spare wick where you will find it.' },
  clover: { item: 'a four-leaf clover', line: 'Clover puts a four-leaf clover by your boot and pretends not to.' },
  fen: { item: 'a perfectly round pebble', line: 'Fen presents one pebble, sings one note, and sits down.' },
  thistle: { item: 'a dropped quill', line: 'Thistle leaves a single quill, which is a great deal from a hedgehog.' },
  sage: { item: 'a sapling in a knot of bark', line: 'Sage grows you a sapling. It will take a while.' },
  bramble: { item: 'a button it definitely found', line: 'Bramble returns a button. You never lost a button.' },
  tuck: { item: 'a smooth shell fragment', line: 'Tuck has been polishing this piece of shell for some time.' },
  wren: { item: 'a tail feather', line: 'Wren drops a tail feather mid-song and carries on singing.' },
  nib: { item: 'the fifth stone, turned', line: 'Nib shows you what was under the fifth stone all along.' },
  breeze: { item: 'a ribbon of still air', line: 'Breeze leaves something you can only feel. It stays.' },
  burr: { item: 'a very well-fixed stick', line: 'Burr gives you the stick. It is, at last, fixed.' },
  lichen: { item: 'a dew drop that never dries', line: 'Lichen parts with one dew drop from the collection.' },
  morrow: { item: 'a page read by lantern', line: 'Morrow leaves a page it liked, with a wing-print in the corner.' },
  hollow: { item: 'a map drawn upside down', line: 'Hollow sketches the woods for you. It is upside down. It is correct.' },
  ripple: { item: 'the favourite pebble', line: 'Ripple gives you the favourite pebble. This is enormous.' },
  juniper: { item: 'a hoofprint cast in clay', line: 'Juniper presses a hoofprint into the clay by the creek, for keeping.' },
  dapple: { item: 'a cap that keeps its colour', line: 'Dapple leaves a mushroom cap that has not faded since.' },
  hush: { item: 'a held breath of quiet', line: 'Hush gives you the quiet between the pines. You can keep it.' },
  moss: { item: 'an interesting stone', line: 'Moss opens the satchel and hands over the most interesting thing in it.' },
  luna: { item: 'a page of unreadable notes', line: 'Luna leaves a page of sky-notes. Nobody can read them. They are important.' },
  cove: { item: 'a bubble that did not pop', line: 'Cove brings back a bubble from a dream. It is still round.' },
  astra: { item: 'a line between two stars', line: 'Astra leaves a line of light connecting two stars you like.' },
  root: { item: 'a ring of old wood', line: 'Root offers a ring of wood older than the woods.' },
});

export function mementoFor(key) { return MEMENTOS[key] || null; }

/** Has this friend reached the point of bringing you something? Pure. */
export function mementoReady(creature) {
  return !creature.memento && (creature.cares || 0) >= MEMENTO_CARES;
}

export const isKnownHat = (id) => HAT_IDS.includes(id);
