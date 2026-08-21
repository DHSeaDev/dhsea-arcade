// Reel strips — the real control surface. Payout is tuned by editing COUNTS and
// STACKS here, never by editing the paytable.
//
// TWO layers per reel:
//   1. an interleaved pool, which guarantees no two identical symbols are adjacent
//   2. authored STACK BANDS, which deliberately break that guarantee for premiums
//
// Layer 2 exists because layer 1 made two features mathematically UNREACHABLE.
// A 3-cell reel window over a perfectly interleaved strip can never show two of
// the same symbol, so "6 coins in view" measured 0.00 triggers per 1000 spins and
// a stacked-premium merge could never fire at all. That is not rare, it is
// impossible — and the strip builder, not the trigger, was the cause both times.
//
// DARK-LAW 1 (no engineered near-miss): E and S must appear an identical number of
// times on EVERY reel once stacks are included. sim/darklaw_test.js counts the
// BUILT STRIP, not this declaration, so a stack band cannot smuggle in a bias.

function interleave(counts) {
  const buckets = new Map();
  for (const [sym, n] of Object.entries(counts)) if (n > 0) buckets.set(sym, n);
  const keys = [...buckets.keys()].sort();
  const out = [];
  let remaining = [...buckets.values()].reduce((a, b) => a + b, 0);
  while (remaining > 0) {
    for (const k of keys) {
      if (buckets.get(k) > 0) { out.push(k); buckets.set(k, buckets.get(k) - 1); remaining--; }
    }
  }
  return out;
}

/** Insert stack bands at evenly spaced positions so they cannot cluster. */
function buildStrip(counts, stacks) {
  const base = interleave(counts);
  if (!stacks || !stacks.length) return base;
  const out = base.slice();
  const gap = Math.floor(out.length / (stacks.length + 1));
  // Insert from the end so earlier indices stay valid.
  for (let i = stacks.length - 1; i >= 0; i--) {
    const [sym, h] = stacks[i];
    out.splice(gap * (i + 1), 0, ...Array(h).fill(sym));
  }
  return out;
}

// --- BASE GAME -------------------------------------------------------------
// Scatter and coin density are both up sharply from v0.1.0: measured feature
// frequency there was one free-spin round every 763 spins, i.e. a 6% chance of
// ever seeing one in a 50-spin sitting.
const BASE_COUNTS = [
  { q: 9, c: 8, a: 7, t: 7, b: 6, P: 5, H: 4, N: 3, E: 1, W: 2, S: 4, O: 11 },
  { q: 9, c: 8, a: 7, t: 6, b: 6, P: 5, H: 4, N: 3, E: 1, W: 4, S: 4, O: 11 },
  { q: 9, c: 8, a: 7, t: 6, b: 5, P: 5, H: 4, N: 3, E: 1, W: 5, S: 4, O: 11 },
  { q: 9, c: 8, a: 7, t: 6, b: 6, P: 5, H: 4, N: 3, E: 1, W: 4, S: 4, O: 11 },
  { q: 9, c: 8, a: 7, t: 7, b: 6, P: 5, H: 4, N: 3, E: 1, W: 2, S: 4, O: 11 },
];
// One E stack + one N stack + one H stack per reel: identical on all five, so the
// premium density stays flat across the row and Prism Thunder is reachable.
const BASE_STACKS = [
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
];

// --- FREE SPINS ------------------------------------------------------------
// Fewer lows, more premiums and wilds, and premium stacks on every reel so
// Thunder is a headline of the round rather than a rarity.
const FREE_COUNTS = [
  { q: 9, c: 8, a: 7, t: 7, b: 6, P: 5, H: 4, N: 3, E: 1, W: 3, S: 2, O: 11 },
  { q: 9, c: 8, a: 7, t: 6, b: 6, P: 5, H: 4, N: 3, E: 1, W: 5, S: 2, O: 11 },
  { q: 9, c: 8, a: 7, t: 6, b: 5, P: 5, H: 4, N: 3, E: 1, W: 6, S: 2, O: 11 },
  { q: 9, c: 8, a: 7, t: 6, b: 6, P: 5, H: 4, N: 3, E: 1, W: 5, S: 2, O: 11 },
  { q: 9, c: 8, a: 7, t: 7, b: 6, P: 5, H: 4, N: 3, E: 1, W: 3, S: 2, O: 11 },
];
const FREE_STACKS = [
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
  [['E', 3], ['N', 3], ['H', 3]],
];

export const BASE_STRIP_COUNTS = BASE_COUNTS;
export const FREE_STRIP_COUNTS = FREE_COUNTS;
export const BASE_STRIPS = BASE_COUNTS.map((c, i) => buildStrip(c, BASE_STACKS[i]));
export const FREE_STRIPS = FREE_COUNTS.map((c, i) => buildStrip(c, FREE_STACKS[i]));

/** Count a symbol in a BUILT strip. The dark-law gate reads this, not the counts. */
export function symbolCountIn(strip, sym) {
  return strip.reduce((n, s) => n + (s === sym ? 1 : 0), 0);
}
