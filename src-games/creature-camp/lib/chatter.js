// Authored camp chatter. Pattern after Lumenreel's chatter engine (a speaker's
// VOICE picks the register), re-authored for the woods: there is no slot, spin
// or payout vocabulary anywhere in this file, and the dark-pattern test scans
// every string here for countdown, near-miss and loss framing.
//
// Tokens: {a} = first creature's name, {b} = second creature's name.

import { mulberry32, pickIndex } from '../vendor/rng.js';

// Two-creature meetings, keyed by the INITIATOR's voice.
export const MEETINGS = {
  shy: [
    '{a} left a pinecone next to {b} and pretended not to have.',
    '{a} sat almost next to {b}. That counts.',
    '{a} and {b} watched the same cloud for a while.',
    '{a} whispered something to {b}. {b} nodded seriously.',
    '{a} hid behind {b}, which {b} was fine with.',
  ],
  cheerful: [
    '{a} taught {b} a song with no words and too many verses.',
    '{a} and {b} raced to the big rock. They both say they won.',
    '{a} gave {b} the second-best acorn. The best one is a secret.',
    '{a} told {b} a joke about moss. {b} is still thinking about it.',
    '{a} and {b} rolled down the little hill, then the little hill again.',
  ],
  smug: [
    '{a} explained the stars to {b}, mostly correctly.',
    '{a} let {b} win at staring. Allegedly.',
    '{a} showed {b} a better sitting spot. It was {b}\'s spot.',
    '{a} and {b} agreed the lantern looks best from over here.',
    '{a} gave {b} advice nobody asked for. It was good advice.',
  ],
  curious: [
    '{a} asked {b} what is under the fifth stone. Neither of them checked.',
    '{a} and {b} followed a beetle until the beetle got embarrassed.',
    '{a} sniffed {b}\'s ear. Research.',
    '{a} and {b} found a feather and built a theory about it.',
    '{a} asked {b} why the pines hum at night. {b} did not know either.',
  ],
  sleepy: [
    '{a} fell asleep leaning on {b}. {b} is being very still about it.',
    '{a} and {b} had a long, slow conversation about nothing.',
    '{a} yawned, and then {b} yawned, and that was the whole afternoon.',
    '{a} shared a warm patch of sun with {b}.',
  ],
  gruff: [
    '{a} fixed {b}\'s nest. It was not broken. It is fixed now.',
    '{a} grumbled at {b}, then shared a berry with {b}.',
    '{a} and {b} carried a stick together. Nobody knows where to.',
    '{a} told {b} to be careful near the creek, twice.',
  ],
  dreamy: [
    '{a} drifted past {b} and left a little breeze behind.',
    '{a} and {b} counted fireflies and got different numbers.',
    '{a} told {b} about a dream with a door in a tree.',
    '{a} hummed while {b} listened.',
  ],
  mysterious: [
    'The pines went quiet around {a} and {b}. Then the crickets started again.',
    '{a} looked at {b} for a long moment. {b} felt oddly understood.',
    '{a} showed {b} a path that was not there yesterday.',
  ],
};

export const CARE = {
  pet: {
    shy: ['{a} leaned into it, just a little.', '{a} closed its eyes, feeling safe.'],
    cheerful: ['{a} wiggled with its whole body.', '{a} did a small happy hop.'],
    smug: ['{a} allowed this.', '{a} accepted the attention as deserved.'],
    curious: ['{a} sniffed your hand thoroughly.', '{a} looked up to see what you would do next.'],
    sleepy: ['{a} sighed and got heavier.', '{a} purred something like a snore.'],
    gruff: ['{a} huffed. Then stayed right there.', '{a} pretended not to like it.'],
    dreamy: ['{a} swirled around your fingers.', '{a} brightened, briefly.'],
    mysterious: ['The air around {a} grew warm.', '{a} blinked, slowly, once.'],
  },
  feed: {
    shy: ['{a} took the berry and ate it facing away.'],
    cheerful: ['{a} ate it in one bite and looked for more.'],
    smug: ['{a} ate it as if it had chosen it.'],
    curious: ['{a} inspected the berry from every side first.'],
    sleepy: ['{a} ate it very, very slowly.'],
    gruff: ['{a} ate it. Said nothing. Ate a second one.'],
    dreamy: ['{a} tasted it like it was a memory.'],
    mysterious: ['The berry was gone. Nobody saw it go.'],
  },
  play: {
    shy: ['{a} batted the leaf, then checked if anyone saw.'],
    cheerful: ['{a} chased the leaf in six directions.'],
    smug: ['{a} caught the leaf on the first try, obviously.'],
    curious: ['{a} tried to find out where the leaf goes.'],
    sleepy: ['{a} played for a whole minute, then napped.'],
    gruff: ['{a} wrestled the leaf into submission.'],
    dreamy: ['{a} and the leaf floated together for a while.'],
    mysterious: ['{a} made the leaf spin without touching it.'],
  },
};

CARE.wash = {
  shy: ['{a} held very still while the bubbles did their work.'],
  cheerful: ['{a} tried to catch the soap bubbles.'],
  smug: ['{a} tolerated the bath with great dignity.'],
  curious: ['{a} sniffed a bubble and sneezed.'],
  sleepy: ['{a} nearly fell asleep mid-scrub.'],
  gruff: ['{a} grumbled all the way through the bath.'],
  dreamy: ['{a} floated a bubble up toward the pines.'],
  mysterious: ['The bubbles around {a} shimmered oddly.'],
};
CARE.dry = {
  shy: ['{a} peeked out from the cloth, all fluffy.'],
  cheerful: ['{a} shook off and did a fluffy little spin.'],
  smug: ['{a} looked extremely well groomed and knew it.'],
  curious: ['{a} investigated the cloth thoroughly.'],
  sleepy: ['{a} curled up in the warm cloth.'],
  gruff: ['{a} huffed, then leaned into the rub.'],
  dreamy: ['{a} felt as light as a breeze.'],
  mysterious: ['{a} was somehow already dry.'],
};

export const ARRIVALS = {
  ember: 'A small fox is watching the campfire. It looks up at you.',
  pip: 'A chipmunk tumbles out of the woodpile with a seed for everyone.',
  wicket: 'A firefly settles on the lantern and decides to stay.',
  clover: 'A rabbit kit hops in, one ear up, one ear listening elsewhere.',
  fen: 'A tree frog clears its throat and sings exactly one note.',
  thistle: 'All that commotion brought a hedgehog to see what the fuss was.',
  sage: 'The old stump by the path opens its eyes and smiles.',
  bramble: 'A raccoon wanders in, carrying something that is probably not its own.',
  tuck: 'A turtle has been waiting by the path. It seems glad you are back.',
  wren: 'A wren lands on a branch and fills the camp with song.',
  nib: 'Under the fifth stone: a small, surprised newt.',
  breeze: 'A little wind comes through the camp and decides to stay.',
  burr: 'A beaver arrives to fix a stick that was not broken.',
  lichen: 'A snail follows the trail of dew right into camp.',
  morrow: 'A moth drifts in from the dark and circles the lantern.',
  hollow: 'A bat unfolds from the rafters. It remembers every path.',
  ripple: 'An otter pops up from the creek holding its favourite pebble.',
  juniper: 'The lost fawn steps into the firelight, safe.',
  dapple: 'A mushroom sprite pops up where all the games were played.',
  hush: 'The pines fall quiet. Something old and kind has come to sit with the camp.',
  moss: 'A badger arrives with a satchel full of interesting things.',
  luna: 'An owl lands on the tallest pine and begins taking notes.',
  cove: 'A seal drifts up the creek, still half in a dream.',
  astra: 'A fox made of starlight steps down from the sky.',
  root: 'The ground stirs. Something very old is getting comfortable.',
};

export const DIGEST_HEADERS = [
  'While you were away, the camp kept itself company.',
  'The camp had a quiet, busy time while you were gone.',
  'Welcome back. Here is a little of what happened.',
];

// One pass, function replacer: a name containing "$&" or "{b}" is inserted literally
// and never substituted again (shard C).
function fill(text, a, b) {
  return text.replace(/\{([ab])\}/g, (_, t) => (t === 'a' ? a : (b ?? '')));
}

/** Deterministic meeting line for tick `n` of save `seed`. */
export function meetingLine(voice, aName, bName, seed, n) {
  const pool = MEETINGS[voice] || MEETINGS.curious;
  const r = mulberry32((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
  return fill(pool[pickIndex(r, pool.length)], aName, bName);
}

export function careLine(kind, voice, name, n) {
  const pool = (CARE[kind] && (CARE[kind][voice] || CARE[kind].curious)) || ['{a} seems pleased.'];
  return fill(pool[Math.abs(n) % pool.length], name);
}

export function allCopy() {
  const out = [];
  for (const v of Object.values(MEETINGS)) out.push(...v);
  for (const k of Object.values(CARE)) for (const v of Object.values(k)) out.push(...v);
  out.push(...Object.values(ARRIVALS), ...DIGEST_HEADERS);
  return out;
}

// Refusals are CREATURE STATES, never clocks: the player learns "he's happy right now,
// try someone else", which is also the behaviour the goals reward. No countdowns here.
export const REFUSE = {
  content: ['{n} is settled and happy after that last fuss.', '{n} has had plenty of fuss for the moment.', '{n} flops over, thoroughly content.'],
  tired: ['{n} is having a rest. A snack might be more welcome.', '{n} yawns. Not up for chasing anything right now.'],
  full: ['{n} is full right now.', '{n} pats a very round tummy.'],
  resting: ['{n} had a snack not long ago.', '{n} is still working on the last one.'],
  nosnacks: ['The snack bowl is empty. Win a round in Games to fill it.', 'No snacks left in the bowl — the games are where they come from.'],
};

/** One refusal line, stable per creature and reason so it does not flicker between clicks. */
export function refuseLine(reason, name) {
  const lines = Object.hasOwn(REFUSE, reason) ? REFUSE[reason] : null;
  if (!lines) return '';
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return lines[h % lines.length].replace('{n}', name);
}
