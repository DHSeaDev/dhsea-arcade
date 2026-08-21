/**
 * Seeded deterministic RNG. Every non-deterministic choice the engine makes —
 * bag shuffling, Archivist discretion, misinformation selection, registration
 * flips — draws from here so a game is exactly reproducible from its seed.
 *
 * Math.random() is never called anywhere in the engine.
 */

/** @param {string} str @returns {number} */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

/**
 * mulberry32. Small, fast, good enough for a game; fully deterministic.
 * @param {number|string} seed
 */
export function createRng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  if (a === 0) a = 1;

  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** float in [0,1) */
    next,
    /** integer in [0, n) */
    int: (n) => Math.floor(next() * n),
    /** integer in [min, max] inclusive */
    range: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** true with probability p */
    chance: (p) => next() < p,
    /** uniform pick */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** n uniform picks without replacement */
    sample: (arr, n) => {
      const copy = arr.slice();
      const out = [];
      for (let i = 0; i < n && copy.length; i++) {
        out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      }
      return out;
    },
    /** Fisher-Yates, returns a new array */
    shuffle: (arr) => {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    /**
     * Current internal state, for checkpointing mid-game.
     * Normalised to unsigned so a snapshot compares equal to a restore — the
     * internal representation is int32 and would otherwise round-trip as a
     * different number for the same state.
     */
    getState: () => a >>> 0,
    setState: (s) => {
      a = s | 0;
    },
  };
}

/** Human-friendly seed string, e.g. "VEIL-8F2A-31C7" */
export function makeSeedPhrase(rng) {
  const hex = () => rng.int(65536).toString(16).toUpperCase().padStart(4, '0');
  return `VEIL-${hex()}-${hex()}`;
}
