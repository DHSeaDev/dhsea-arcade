// Pure spin resolution. No DOM, no storage, no Date. Given (rand, stake, mode)
// it returns a fully-described outcome the UI animates and the sim measures.
//
// Order of operations, fixed and tested:
//   stops -> grid -> expansions/conversions -> line evaluation -> wild multipliers
//   -> scatter pays -> feature triggers

import { PAYLINES } from './paylines.js';
import { BASE_STRIPS, FREE_STRIPS } from './strips.js';
import {
  LINES, PAYTABLE, SCATTER_PAY, SCATTER_FREESPINS,
  HOLD_TRIGGER, METER_PER_COIN, METER_PER_HIGH_WIN, DARK_LAWS,
  SPLASH_MIN_WILDS, SPLASH_CATCH, SPLASH_WILD_MULT,
  THUNDER_SYMBOLS, THUNDER_MULT_WEIGHTS,
} from './constants.js';
import { weightedPick } from './rng.js';

const HIGH = new Set(['P', 'H', 'N', 'E']);

/** Draw 5 stop indices and build the 5x3 visible grid. grid[reel][row]. */
export function spinGrid(rand, strips) {
  const stops = [];
  const grid = [];
  for (let r = 0; r < 5; r++) {
    const strip = strips[r];
    const stop = Math.floor(rand() * strip.length) % strip.length;
    stops.push(stop);
    const col = [];
    for (let row = 0; row < 3; row++) col.push(strip[(stop + row) % strip.length]);
    grid.push(col);
  }
  return { stops, grid };
}

/**
 * REFRACTION SPLASH. Two or more wilds anywhere in the grid and the whole thing
 * gets wet: every reel already holding a wild floods to full height, and each dry
 * reel catches a stray droplet with SPLASH_CATCH probability. Mutates `grid` and
 * returns the description the UI animates.
 */
export function applySplash(grid, rand) {
  let wilds = 0;
  const sources = [];
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) if (grid[r][row] === 'W') { wilds++; sources.push([r, row]); }
  }
  if (wilds < SPLASH_MIN_WILDS) return null;

  // Droplets spray to OTHER reels — never a full-column flood. The first version
  // flooded every wild-bearing reel and paid a 5-of-a-kind wild on most of the 20
  // lines at a 14% trigger rate; measured, that was over half the total payout of
  // the whole game. Spectacle belongs in the animation, not in the paytable.
  const sourceReels = new Set(sources.map((c) => c[0]));
  const droplets = [];
  for (let r = 0; r < 5; r++) {
    if (sourceReels.has(r)) continue;
    if (rand() >= SPLASH_CATCH) continue;
    const row = Math.min(2, Math.floor(rand() * 3));
    // A droplet never overwrites a scatter: the scatter count is decided by the
    // stop, and changing a trigger after the fact is the same class of dishonesty
    // as a false-hope reel stop.
    if (grid[r][row] === 'S') continue;
    grid[r][row] = 'W';
    droplets.push([r, row]);
  }
  return {
    sources, droplets, wilds,
    reels: [...new Set([...sourceReels, ...droplets.map((d) => d[0])])].sort(),
  };
}

/**
 * PRISM THUNDER. A premium landing as a full 3-high stack fuses into one giant
 * symbol carrying a multiplier; every line crossing that reel is multiplied.
 * Returns a per-reel multiplier array (1 where nothing fused).
 */
export function applyThunder(grid, rand) {
  const mults = [1, 1, 1, 1, 1];
  const syms = [null, null, null, null, null];
  const fused = [];
  for (let r = 0; r < 5; r++) {
    const [a, b, c] = grid[r];
    if (a === b && b === c && THUNDER_SYMBOLS.includes(a)) {
      const m = weightedPick(rand, THUNDER_MULT_WEIGHTS).v;
      mults[r] = m;
      syms[r] = a;
      fused.push({ reel: r, symbol: a, mult: m });
    }
  }
  return { mults, syms, fused };
}

/** Free-spin mode only: a wild anywhere on reels 2-4 expands to fill its column. */
export function applyExpandingWilds(grid) {
  const expanded = [];
  for (let r = 1; r <= 3; r++) {
    if (grid[r].includes('W')) {
      grid[r] = ['W', 'W', 'W'];
      expanded.push(r);
    }
  }
  return expanded;
}

/**
 * Evaluate the 20 lines. Highest win per line only; a 5-of-a-kind does not also
 * pay the contained 3-of-a-kind. Wild substitutes for any paying symbol but never
 * for S or O. If the natural run is all-wild, take max(wild pay, substituted pay).
 */
export function evaluateLines(grid, stake, wildMultiplier = 1, reelMults = [1, 1, 1, 1, 1], reelSyms = []) {
  const wins = [];
  for (let li = 0; li < PAYLINES.length && li < LINES; li++) {
    const line = PAYLINES[li];
    const syms = line.map((row, reel) => grid[reel][row]);
    const first = syms[0];
    if (first === 'S' || first === 'O') continue;

    // The candidate symbol is the first non-wild on the line; all-wild lines pay as W.
    let target = first;
    if (target === 'W') {
      target = syms.find((s) => s !== 'W' && s !== 'S' && s !== 'O') || 'W';
    }
    if (!PAYTABLE[target]) continue;

    let run = 0;
    let usedWild = false;
    for (let r = 0; r < 5; r++) {
      const s = syms[r];
      if (s === target) { run++; }
      else if (s === 'W') { run++; usedWild = true; }
      else break;
    }
    if (run < 3) continue;

    let units = PAYTABLE[target][run] || 0;
    // All-wild run: honour whichever pays more.
    if (syms.slice(0, run).every((s) => s === 'W')) {
      units = Math.max(units, PAYTABLE.W[run] || 0);
      usedWild = true;
    }
    if (units <= 0) continue;

    // Thunder boosts wins OF THE FUSED SYMBOL, not every line that happens to
    // cross the fused reel — that is what "boosting top-symbol wins" means, and
    // the unrestricted version was multiplying low-pay lines it had nothing to do
    // with. Combined by MAX, never by product: two fused reels on one line would
    // otherwise pay 100x and blow the whole variance budget on a single spin.
    let thunder = 1;
    for (let r = 0; r < run; r++) {
      if (reelSyms && reelSyms[r] === target) thunder = Math.max(thunder, reelMults[r] || 1);
    }
    const mult = (usedWild ? wildMultiplier : 1) * thunder;
    wins.push({
      line: li,
      symbol: target,
      count: run,
      units,
      multiplier: mult,
      thunder,
      facets: units * stake * mult,
      cells: line.slice(0, run).map((row, reel) => [reel, row]),
    });
  }
  return wins;
}

/**
 * DARK-LAW 3 (no false-hope reel stop). Stop timing is a function of the REEL INDEX
 * and nothing else. It cannot see the grid, the outcome, or whether a scatter is
 * pending, so it is structurally incapable of the "teasing last reel" that
 * commercial machines use to fabricate suspense over an already-resolved result.
 * sim/darklaw_test.js asserts this signature and was validated by being made to
 * fail against a version that took the outcome as a second argument.
 */
export function stopDelayMs(reelIndex) {
  return DARK_LAWS.reelStopMs[Math.max(0, Math.min(4, reelIndex))];
}

export function countSymbol(grid, sym) {
  let n = 0;
  const cells = [];
  for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) {
    if (grid[r][row] === sym) { n++; cells.push([r, row]); }
  }
  return { n, cells };
}

/**
 * One spin.
 * @param {function} rand  0..1 PRNG
 * @param {number} stake   Lumens per line
 * @param {'base'|'free'} mode
 * @returns outcome object — pure data, no side effects
 */
export function spin(rand, stake, mode = 'base') {
  const strips = mode === 'free' ? FREE_STRIPS : BASE_STRIPS;
  const totalBet = stake * LINES;
  const { stops, grid } = spinGrid(rand, strips);

  // Order is fixed and tested: stops -> splash -> expand -> thunder -> lines.
  // Splash runs BEFORE the free-spin column expansion so a splashed reel is
  // already full and the expansion is a no-op on it, rather than the two
  // features fighting over the same column.
  const splash = applySplash(grid, rand);
  const expanded = mode === 'free' ? applyExpandingWilds(grid) : [];
  const thunder = applyThunder(grid, rand);

  const wildMultiplier = SPLASH_WILD_MULT;   // free spins earn their keep via richer strips, not a blanket x2
  const lineWins = evaluateLines(grid, stake, wildMultiplier, thunder.mults, thunder.syms);
  const lineFacets = lineWins.reduce((a, w) => a + w.facets, 0);

  const scatter = countSymbol(grid, 'S');
  const scatterFacets = (SCATTER_PAY[scatter.n] || 0) * totalBet;
  const freeSpinsAwarded = SCATTER_FREESPINS[scatter.n] || 0;

  const coin = countSymbol(grid, 'O');
  const holdTriggered = mode === 'base' && coin.n >= HOLD_TRIGGER;

  const highWin = lineWins.some((w) => HIGH.has(w.symbol));
  const meterGain = coin.n * METER_PER_COIN + (highWin ? METER_PER_HIGH_WIN : 0);

  const facets = lineFacets + scatterFacets;

  return {
    mode, stake, totalBet, stops, grid, expanded,
    splash, thunder: thunder.fused, thunderMults: thunder.mults,
    lineWins, lineFacets, scatterCount: scatter.n, scatterCells: scatter.cells,
    scatterFacets, freeSpinsAwarded,
    coinCount: coin.n, coinCells: coin.cells, holdTriggered,
    meterGain, facets,
    // DARK-LAW 2: a spin paying 0 Facets is a zero. There is no "win" presentation
    // for it and there cannot be, because nothing staked is ever returned.
    isWin: facets > 0,
  };
}
