// Emberkeep - Mountain — what there is to find, and what finding it means.
//
// BORROWED FROM SKY: CHILDREN OF THE LIGHT, deliberately and with the reasoning intact.
// Sky's strongest idea is that light is simultaneously the RESOURCE, the CAPABILITY and the
// THEME — you gather Winged Light, it becomes flight, and the story is that you are rebuilt out
// of light other people left behind. Nothing is a number on a HUD; your progress is visible on
// your own body and in the sky above you.
//
// That maps onto a fire spirit almost without translation, with one change that matters: Sky's
// light is a METER that depletes, and this game has no fail state. So here light only ever GROWS.
// A mote found in chapter II makes Ember brighter for the rest of the mountain and forever after.
// A capability that cannot be lost is not a resource — it is a memory of where you have been.
//
// THE PROOF IS UNAFFECTED, and this is checked rather than asserted: motes and wisps live in
// their own lists, never in world.cells, exactly like the platformer's scenery. Nothing here can
// change a jump envelope because there is no code path from it to one.

export const BASE_LIGHT = 5.5;
export const PER_MOTE = 0.42;          // 30 motes -> +12.6, roughly tripling what he can see
export const MAX_LIGHT = BASE_LIGHT + 30 * PER_MOTE;

// Ember's reach, from what he has found. Monotone non-decreasing in the number of motes, which is
// the property the completability proof relies on: more light can only ever ADD walkable surface
// (a `lit` face appears) or REMOVE an obstacle (a crow retreats). It can never take a route away.
// Proving every chapter at the MINIMUM radius therefore proves it at every radius — and the
// solver checks the maximum too rather than trusting the argument.
export function lightRadius(motes) {
  return BASE_LIGHT + Math.min(30, motes) * PER_MOTE;
}

// ---------------------------------------------------------------------------
// WISPS — the collectible that carries the story.
// Sky frees Ancestor Spirits by reliving their memory; each becomes a star in your constellation
// and teaches you an emote. Ours are fires that went out. Ember relights them, they rise, and
// they become stars. The theme of the whole project is a fire that would rather not burn things
// down; the thing it CAN do, that nothing else can, is give its light away without losing any.
export const WISPS = [
  { id: 'w1',  name: 'The One Who Waited',    expr: 'wonder',  line: 'It had been out for a long time. It did not seem to mind.' },
  { id: 'w2',  name: 'The Gardener',          expr: 'pleased', line: 'Something grew here once. It remembers being useful.' },
  { id: 'w3',  name: 'The Bridgewright',      expr: 'proud',   line: 'It built the thing it is standing on. Then it went out.' },
  { id: 'w4',  name: 'The One Who Fell',      expr: 'careful', line: 'It is not hurt. It has simply been down there a while.' },
  { id: 'w5',  name: 'The Watcher',           expr: 'shy',     line: 'It has been watching the birds. It is not afraid of them.' },
  { id: 'w6',  name: 'The Small One',         expr: 'kind',    line: 'It is smaller than me. I did not think that was allowed.' },
  { id: 'w7',  name: 'The One In The Dark',   expr: 'brave',   line: 'It could not see either. It stayed anyway.' },
  { id: 'w8',  name: 'The Folded One',        expr: 'puzzled', line: 'It went in one door and has been coming out of another ever since.' },
  { id: 'w9',  name: 'The Patient Two',       expr: 'calm',    line: 'Two of them. They have been waiting for each other.' },
  { id: 'w10', name: 'The First Fire',        expr: 'joy',     line: 'Oh. It was here before the mountain was.' },
];

// EXPRESSIONS AS COLLECTIBLES, which is Sky's other transferable idea. A faceless Sky Kid is
// expressive because expressiveness itself is the reward — you unlock emotes, and then LEVELS of
// the same emote, so the vocabulary grows rather than the stats. Ember has a face, so his
// expressions do double duty: they are how he reacts on his own, AND a thing you collect.
export const EXPRESSIONS = ['calm', 'walking', 'wonder', 'pleased', 'puzzled', 'sleepy',
                            'proud', 'careful', 'shy', 'kind', 'brave', 'joy'];

export class Progress {
  constructor(saved = {}) {
    // A SAVE IS UNTRUSTED INPUT. `new Set(42)` throws "number 42 is not iterable" and the throw
    // happens inside the bootstrap, before anything is drawn — so one corrupt field costs the
    // whole page, permanently, with no way for the player to clear it from inside the game.
    // The stress harness fed this exact shape ({motes:'x', wisps:42, lit:null, clean:{}}) and the
    // page went blank. Anything that is not an array of primitives is now simply an empty set:
    // losing progress we cannot read is strictly better than refusing to start.
    const setOf = (v) => new Set(Array.isArray(v) ? v.filter(e => typeof e === 'string' || typeof e === 'number') : []);
    this.motes = setOf(saved && saved.motes);       // "chapter:id"
    this.wisps = setOf(saved && saved.wisps);       // wisp id
    this.lit = setOf(saved && saved.lit);           // chapter index, as a string
    this.clean = setOf(saved && saved.clean);       // lit with every mote in that chapter
  }
  toJSON() {
    return { motes: [...this.motes], wisps: [...this.wisps], lit: [...this.lit], clean: [...this.clean] };
  }
  get moteCount() { return this.motes.size; }
  get radius() { return lightRadius(this.moteCount); }
  knows(expr) {
    if (expr === 'calm' || expr === 'walking' || expr === 'wonder' || expr === 'pleased'
        || expr === 'puzzled' || expr === 'sleepy') return true;     // he came with these
    return WISPS.some(w => w.expr === expr && this.wisps.has(w.id));
  }
  learned() { return EXPRESSIONS.filter(e => this.knows(e)); }
}

// ---------------------------------------------------------------------------
// THE CONSTELLATION — recognition without a number.
// Sky shows completion as a night sky filling with stars, and the achievement is displayed on the
// avatar and in the sky, never as a score. That is worth copying exactly: a checklist with ticks
// says "you have done 7 of 10 chores", and a sky says "look what you brought back".
//
// Each star is a real thing that happened. Position is derived from the id so a given star is
// always in the same place — a constellation that reshuffles is a progress bar in disguise.
// FIRST VERSION USED A PURE HASH SCATTER AND THE SUITE REJECTED IT: two beacon stars landed 3.6px
// apart, which makes the hover ambiguous and the sky look like a smudge rather than a shape. The
// fix is a jittered grid — each band gets an even spacing with a deterministic wobble, so the
// positions still look unplanned but a minimum separation is guaranteed by construction.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
// FNV-1a ALONE IS NOT ENOUGH HERE and the first version shipped without noticing.
// For keys that differ only in their last character, FNV's final state differs by exactly one
// multiply by the prime — so wobble('beacony0') and wobble('beacony1') came out 0.0039 apart, and
// all ten "randomly scattered" stars landed on a line 0.001 of the screen tall. It looked like a
// deliberate row. The overlap test could not catch it because the x spacing is even by design and
// dominated the distance. Fixed with a murmur3 finalizer, which is what avalanches single-bit
// input changes across the whole output.
function wobble(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822519);
  h ^= h >>> 13; h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) - 0.5;               // -0.5 .. 0.5
}

export function stars(prog) {
  const out = [];
  const band = (kind, i, n, y0, y1, jx, r, on, label, line) => ({
    kind, id: kind[0] + i, on, label, line, r,
    x: 0.075 + (i + 0.5) * (0.85 / n) + wobble(kind + i) * jx,
    y: y0 + (wobble(kind + 'y' + i) + 0.5) * (y1 - y0),
  });
  // The bands are WIDE and the jitter is large, because narrow bands produce three tidy rows of
  // evenly spaced dots — which is a progress bar wearing a constellation's costume, and the exact
  // thing this screen exists instead of. Even x-spacing is kept only because it guarantees the
  // minimum separation a hover needs; every other axis is allowed to be untidy.
  for (let i = 0; i < 10; i++) {
    out.push(band('beacon', i, 10, 0.11, 0.35, 0.030, 2.6, prog.lit.has(String(i)),
                  `Chapter ${ROMAN[i]} — the beacon`));
  }
  WISPS.forEach((w, i) => {
    const st = band('wisp', i, 10, 0.37, 0.63, 0.030, 3.4, prog.wisps.has(w.id), w.name, w.line);
    st.id = w.id;
    out.push(st);
  });
  for (let i = 0; i < 10; i++) {
    out.push(band('clean', i, 10, 0.65, 0.88, 0.026, 2.0, prog.clean.has(String(i)),
                  `Chapter ${ROMAN[i]} — every mote`));
  }
  return out;
}
