// Deterministic PRNG. mulberry32 — same generator as TabCritters, so critter art
// and reel outcomes are both reproducible from a seed (required by the sim, and by
// the ghost/replay style tests).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickIndex(rand, length) {
  return Math.min(length - 1, Math.floor(rand() * length));
}

/** Weighted pick over [{w:number, ...}]. Returns the entry, never undefined. */
export function weightedPick(rand, entries) {
  let total = 0;
  for (const e of entries) total += e.w;
  if (!(total > 0)) return entries[0];
  let r = rand() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}
