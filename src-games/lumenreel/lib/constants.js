// Lumenreel — Prism Crash
// EVERY tunable number lives here. Nothing else in lib/ may hardcode a balance constant.
// A constant defined here but never read, or read here but undefined, is a FAIL in
// sim/constants_test.js (the NaNundefined tripwire class).

export const VERSION = '0.9.0';

// ---------------------------------------------------------------------------
// TIME / ACCRUAL  (Lumens — the time currency. Only inflow: elapsed time.)
// ---------------------------------------------------------------------------
export const ACCRUAL = {
  // 1/sec, at Donnie's instruction. At 30/sec income outran the spin cadence from
  // the first minute: 30 L/s earned against 20 L per 1.5s spent is a 2.25x surplus
  // before a single upgrade, so Lumens just piled up. The whole point of a time
  // currency is that time is the constraint.
  baseRate: 1,              // Lumens/sec at a cold start
  offlineRate: 0.5,         // fraction of live rate granted while away
  offlineCapHours: 8,       // grant is clamped to this many hours per claim
  maxTickSeconds: 3600,     // any single elapsed window is clamped to this
  tickMs: 250,              // UI tick; accrual math never depends on it
};

// Generators ("Prism Cuts"). ADDITIVE production, EXPONENTIAL cost.
// Cost family MUST dominate benefit family — additive benefit vs 1.11^n cost is safe.
//
// UNLOCK IS BY OWNED CRITTERS, not by lifetime Lumens. That is the load-bearing
// structural decision of the whole build: it is what makes the three systems ONE
// loop (spin -> Facets -> critters -> next Prism Cut -> more Lumens -> bigger stake)
// instead of three parallel ones. The first version gated on lifetime Lumens and the
// horizon sim measured the entire generator ladder exhausted in 90 minutes, leaving
// hours 2-24 completely flat. Gating on the collection is what spreads it over a day.
export const GEN_COST_RATIO = 50;      // baseCost = prod * this, so every tier has
                                       // the same ceiling shape and none is a trap.
const GEN_DEFS = [
  ['facet',   'Facet Cutter',   1.2,   0],
  ['lens',    'Lens Grinder',   12,    10],
  ['beam',    'Beam Splitter',  120,   20],
  ['halo',    'Halo Forge',     1.2e3, 30],
  ['nova',    'Nova Kiln',      1.2e4, 40],
  ['eclipse', 'Eclipse Array',  1.2e5, 50],
  ['aurora',  'Aurora Loom',    1.2e6, 60],
  ['zenith',  'Zenith Column',  1.2e7, 70],
  ['spectra', 'Spectra Engine', 1.2e8, 80],
  ['axiom',   'Axiom Lattice',  1.2e9, 90],
];
export const GENERATORS = GEN_DEFS.map(([id, name, prod, unlockOwned]) => ({
  id, name, prod, unlockOwned, baseCost: prod * GEN_COST_RATIO,
}));
export const GEN_COST_GROWTH = 1.11;   // cost_n = baseCost * growth^owned
export const GEN_MAX_OWNED = 5000;     // sanity clamp, also a save-sanitize bound

// ---------------------------------------------------------------------------
// BETTING  (Lumens out. The reels are the ONLY Lumen sink.)
// ---------------------------------------------------------------------------
export const LINES = 20;                                   // fixed 20 paylines

// Stake ladder, generated rather than hand-tabled so the array and its unlock
// thresholds can never fall out of sync (a hand table did exactly that once).
//
// STAKES UNLOCK ON OWNED CRITTERS, not on lifetime Lumens. This is the pacing
// spine of the whole game and it was arrived at by measurement, not preference:
// with Lumen-gated stakes the horizon sim showed late-game income compounding ~10x
// every 47 minutes, so raising a critter price by 10x bought only 47 more minutes
// of play. No price schedule can pace an unbounded exponential. Bounding the BET
// bounds Facet inflow, which makes completion time a designed quantity instead of
// an emergent one. Lumens then decide whether you can sustain the stake you have
// unlocked — so the ladder is a floor on pacing and the economy is the variable.
function buildStakes(steps) {
  const base = [1, 2, 5];
  const out = [];
  for (let d = 0; out.length < steps; d++) {
    for (const b of base) { if (out.length < steps) out.push(b * Math.pow(10, d)); }
  }
  return out;
}
export const STAKES = buildStakes(60);
// One new stake tier every TWO critters, over 60 tiers. Measured on v0.3.0: a
// player earned 7.88e14 Lumens across a full run and could only ever spend 3.6%
// of them — by hour 4 income was 3.7e7/sec against a maximum unlocked bet of
// 4e6. The ladder has to outrun the faucet or the time currency stops meaning
// anything, so it now does, and a horizon band enforces it.
export const STAKE_GATE_PER = 2;

// ---------------------------------------------------------------------------
// PAYTABLE  (Facets out. Values are LINE UNITS; Facets = units * stake.)
// There is NO RTP here: you stake Lumens and are paid Facets. Nothing staked
// can return, so a losing spin pays exactly 0 and is shown as 0. See DARK_LAWS.
// ---------------------------------------------------------------------------
export const SYMBOLS = {
  q: { name: 'Quartz Chip',  tierClass: 'low' },
  c: { name: 'Citrine Chip', tierClass: 'low' },
  a: { name: 'Amethyst Chip',tierClass: 'low' },
  t: { name: 'Topaz Chip',   tierClass: 'low' },
  b: { name: 'Beryl Chip',   tierClass: 'low' },
  P: { name: 'Prism',        tierClass: 'high' },
  H: { name: 'Halo',         tierClass: 'high' },
  N: { name: 'Nova',         tierClass: 'high' },
  E: { name: 'Eclipse',      tierClass: 'high' },
  W: { name: 'Refraction',   tierClass: 'wild' },
  S: { name: 'Starburst',    tierClass: 'scatter' },
  O: { name: 'Lumen Core',   tierClass: 'coin' },
};

// [3-of-a-kind, 4, 5] in line units. Index 0 unused so length matches match count.
export const PAYTABLE = {
  q: [0, 0, 0, 1,  4,   12],
  c: [0, 0, 0, 1,  5,   15],
  a: [0, 0, 0, 2,  6,   20],
  t: [0, 0, 0, 2,  8,   26],
  b: [0, 0, 0, 2,  10,  32],
  P: [0, 0, 0, 3,  15,  55],
  H: [0, 0, 0, 4,  26,  110],
  N: [0, 0, 0, 6,  42,  220],
  E: [0, 0, 0, 10, 80,  450],
  W: [0, 0, 0, 2,  10,  45],
};
// Scatter pays on COUNT ANYWHERE, multiplied by TOTAL bet (stake * LINES).
export const SCATTER_PAY = { 3: 1, 4: 4, 5: 20 };
export const SCATTER_FREESPINS = { 3: 5, 4: 7, 5: 10 };
export const FREESPIN_RETRIGGER_CAP = 30;   // was 240 — a single round could run to 240 spins

// Hold-and-Spin ("Crystallize"): trigger on >= this many coins in one base spin.
// 5 = one Lumen Core on EVERY reel. Note this is not a free tuning knob: the
// interleaved layer of strips.js caps a 3-cell reel window at ONE coin from that
// layer, so a trigger above 5 was measured at 0.00 per 1000 spins. Coin density
// is now 8/reel, which is what makes this fire often enough to be a real feature.
export const HOLD_TRIGGER = 5;
export const HOLD_RESPINS = 3;
export const HOLD_COIN_VALUES = [0.2, 0.3, 0.5, 0.8, 1.5, 3];   // multiples of total bet
export const HOLD_JACKPOTS = { mini: 2, minor: 6, major: 20, grand: 90 }; // x total bet
export const HOLD_GRID_CELLS = 15;

// --- TURBO ------------------------------------------------------------------
// Turbo is a budget, not a toggle. 25 fast spins, then it rests. Certain critters
// are QUICKENED: owning one permanently shortens the rest and adds to the budget,
// which turns "who did I draw" into a mechanical decision rather than a cosmetic
// one. The floor stops the perk stacking into an infinite turbo.
// ARCADE TOKEN — a free arcade play won on the reels.
//
// Deliberately a FLAT per-spin roll rather than a symbol combination: an arcade play
// is worth a bounded number of bets, so tying it to a rare symbol pattern would make
// its value spike exactly when a player is already having a good spin. A flat roll
// keeps plays-per-hour a designed constant, which is the one arcade input the
// completion band depends on.
//
// 1 in 320 spins. At the measured ~2,400 spins/hour that is ~7.5 free plays an hour,
// but the bank caps at ARCADE.freeCap so they cannot be hoarded into a burst.
export const ARCADE_TOKEN_CHANCE = 1 / 320;

export const TURBO = {
  budget: 25,
  cooldownMs: 600_000,          // 10 minutes
  cooldownFloorMs: 90_000,      // however many Quickened you own
  wheelGrantChance: 0.35,       // a wheel spin may also hand back turbo spins
  wheelGrantSpins: 8,
  // Won spins ACCUMULATE above the refill budget. The bank ceiling exists only so a
  // player cannot hoard an unbounded stack and skip the pacing; at 4x the budget a
  // granted spin is effectively never wasted.
  bankMultiple: 4,
};

// Authored: the fast, twitchy, restless ones. id -> { spins, cooldownMs }
export const QUICKENED = {
  3:   { spins: 1, cut: 12_000 },   // Twinkid   — blinks out of sync on purpose
  5:   { spins: 1, cut: 10_000 },   // Blinker
  7:   { spins: 1, cut: 10_000 },   // Shimmy
  18:  { spins: 1, cut: 12_000 },   // Tumble
  22:  { spins: 1, cut: 10_000 },   // Rollick
  30:  { spins: 1, cut: 12_000 },   // Plink     — announces itself once, then stops
  35:  { spins: 2, cut: 18_000 },   // Flitter   — never lands on the same facet twice
  39:  { spins: 2, cut: 16_000 },   // Whirlet
  40:  { spins: 2, cut: 18_000 },   // Zephyrl   — arrives before the draft does
  42:  { spins: 1, cut: 14_000 },   // Scuttle   — one direction, no reverse
  49:  { spins: 2, cut: 16_000 },   // Ripplet
  51:  { spins: 2, cut: 18_000 },   // Glisser   — moves without appearing to
  65:  { spins: 2, cut: 20_000 },   // Torchlin
  68:  { spins: 2, cut: 20_000 },   // Threadle
  88:  { spins: 3, cut: 26_000 },   // Vulpra
  94:  { spins: 3, cut: 26_000 },   // Nocturne
  98:  { spins: 4, cut: 34_000 },   // Chromaeon — a different order every second
  100: { spins: 4, cut: 34_000 },   // Prismarch
  112: { spins: 2, cut: 20_000 },   // Dandelo   — half of it has already left
  123: { spins: 3, cut: 26_000 },   // Heliora
};

// --- REFRACTION SPLASH -----------------------------------------------------
// Two or more Refraction wilds anywhere in the base grid and they SPLASH: every
// reel holding a wild floods to full height, and each remaining reel catches a
// stray droplet with SPLASH_CATCH probability. Derived from the expanding/stacked
// wild pair in 5 Wild Buffalo, but made a base-game event rather than a free-spin
// one, because the base game is where a player spends 99% of their spins.
export const SPLASH_MIN_WILDS = 2;
export const SPLASH_CATCH = 0.34;
export const SPLASH_WILD_MULT = 1;   // the splash is spectacle; it does not also multiply

// --- PRISM THUNDER ---------------------------------------------------------
// A premium symbol landing as a FULL 3-high stack fuses into one giant symbol
// carrying a multiplier, and every line through that reel is multiplied.
// This is 5 Wild Buffalo's Buffalo Thunder ("any stacked Buffalo that lands fully
// in view merges into a single 4-high symbol with a multiplier up to 10X").
export const THUNDER_SYMBOLS = ['P', 'H', 'N', 'E'];
export const THUNDER_MULT_WEIGHTS = [
  { w: 58, v: 2 }, { w: 27, v: 3 }, { w: 11, v: 4 }, { w: 3, v: 6 }, { w: 1, v: 10 },
];

// Cascade multiplier ladder (resets each base spin). [UNWIRED SPEC — no caller;
// see lib/features.js cascadeMultiplier(). Delete both together or neither.]
// to the UI — declared here so features.js's consumer resolves.
export const CASCADE_MULTS = [1, 2, 3, 5, 8, 12];

// --- PRISM WHEEL (the five Fortunes) ---------------------------------------
// Every Lumen Core that lands feeds one of five growing prizes; filling the Prism
// Meter spins the wheel and pays one of them out, then resets that prize to base.
// This is 5 Wild Buffalo's Boosting Fortunes ladder (MINI/BIG/SUPER/MEGA/ULTRA).
export const WHEEL_PRIZES = [
  { id: 'mini',  name: 'Mini',  base: 0.4, growth: 0.02, w: 50 },
  { id: 'minor', name: 'Minor', base: 1.2, growth: 0.04, w: 29 },
  { id: 'major', name: 'Major', base: 3.5, growth: 0.07, w: 14 },
  { id: 'mega',  name: 'Mega',  base: 11,  growth: 0.13, w: 5.4 },
  { id: 'ultra', name: 'Ultra', base: 40,  growth: 0.24, w: 1.6 },
];
export const WHEEL_PRIZE_CAP = 6;   // a prize may grow to at most base x this

// MUST-HIT-BY. The two top prizes carry a published ceiling on how many wheel spins
// can pass without them landing; when the counter reaches zero the next wheel awards
// that prize outright, highest tier first.
//
// This is the one anticipation device a machine can run WITHOUT a near-miss: the
// countdown is real, printed on the ladder, and the player can watch it fall. Nothing
// about the reels changes and no outcome is nudged — the guarantee only ever fires in
// the player's favour, and only after the stated number of spins.
//
// Natural frequency measured over 40k awards: Mega 1 in 18, Ultra 1 in 62. The numbers
// below sit just inside those tails so the guarantee binds sometimes rather than being
// a promise about something that would have happened anyway (which is what
// FREESPIN_RETRIGGER_CAP turned out to be).
export const WHEEL_MUSTHIT = { mega: 34, ultra: 110 };

// Prism Meter: the only cross-spin memory in the base game.
export const METER_MAX = 300;
export const METER_PER_COIN = 3;
export const METER_PER_HIGH_WIN = 1;
export const METER_REWARD_SOURCE = 'wheel';   // the meter now spins the Prism Wheel

// ---------------------------------------------------------------------------
// COLLECTION  (Facets in. 100 critters, 5 tiers, duplicate-suppressed.)
// Suppression means a Draw NEVER returns an owned critter, so there is no
// coupon-collector tail and every critter has a printable maximum cost.
// ---------------------------------------------------------------------------
export const TIERS = [
  { id: 1, key: 'quartz',   name: 'Quartz',   count: 34, trickle: 1,     gateOwned: 0 },
  { id: 2, key: 'beryl',    name: 'Beryl',    count: 26, trickle: 20,    gateOwned: 0 },
  { id: 3, key: 'amethyst', name: 'Amethyst', count: 20, trickle: 500,   gateOwned: 0 },
  { id: 4, key: 'opal',     name: 'Opal',     count: 14, trickle: 5e5,   gateOwned: 0 },
  { id: 5, key: 'radiant',  name: 'Radiant',  count: 6,  trickle: 5e7,   gateOwned: 0 },
  // Tier 6 is BONUS content, not part of the 100.
  //
  // v0.9.0 — TWO MEASURED DEFECTS FIXED, and they were independent of each other.
  //
  // VALUE. At trickle 2e8 the 25-strong Grove produced 5.00e9/s against the whole
  // Radiant tier's 3.00e8/s — 16.67x the rest of the top of the collection, measured,
  // not estimated. Retuned to TIER-TOTAL PARITY with Radiant: 25 x 1.2e7 = 3.00e8/s.
  // Per-critter that is BELOW a Radiant, which is correct — the ask was the rarest
  // draw rate, and rarity is not payout.
  //
  // GATE. `theme` no longer locks the DRAW (see collection.js gachaTable); it still
  // marks the tier as non-core, which is what CORE_TIERS and coreOwned() read. The
  // Grove is now gated on OWNED COUNT alone — and gateOwned was, until v0.9.0, dead
  // data: gachaTable filtered on themeLocked and remaining and never once read it.
  { id: 6, key: 'verdant',  name: 'Verdant Grove', count: 25, trickle: 1.2e7, gateOwned: 40, theme: 'verdant' },
];
export const CORE_TIERS = TIERS.filter((t) => !t.theme);

// GACHA WEIGHTS — v0.6.0 replaced the tier GATE with a weighted roll.
//
// Before this, a tier was locked until you owned N critters overall, so "what do I
// get" was a menu choice and the only randomness was which critter inside a tier.
// Now one price buys one weighted roll across every tier that still has stock, and
// the rarity is real rather than scheduled.
//
// The weight for a tier is `remaining stock x RARITY_W[tier]`. Multiplying by REMAINING
// is what keeps the collection finishable: as a tier empties, it stops eating rolls,
// so the last few criters do not sit behind a wall of near-certain misses that
// duplicate suppression would then have to unwind.
//
// gateOwned survives on the TIERS rows for the Verdant theme gate only; the core
// tiers all read 0 now, and lib/collection.js ignores the field for core tiers.
// SS RARITY. RARITY_W is weight PER REMAINING CRITTER, so this map alone fixes the
// per-critter draw rate ranking. Verdant was 0.30 — third likeliest of six, ahead of
// Amethyst, Opal and Radiant. At 0.0035 it is the rarest per critter (below Radiant's
// 0.022) AND the lowest tier weight at full stock (25 x 0.0035 = 0.0875 < 6 x 0.022 =
// 0.132). Both are asserted in sim/gacha_test.js; changing this line fails that gate.
export const RARITY_W = { 1: 1, 2: 0.52, 3: 0.24, 4: 0.085, 5: 0.022, 6: 0.0035 };

// The ball-drop presentation. The OUTCOME is drawn first from RARITY_W and the ball
// is then animated into that bin — the same contract the Prism Wheel already runs
// under, and it is stated on the odds page. Bin widths are drawn proportional to the
// live weights, so what you see matches what was rolled.
export const GACHA = { pegRows: 9, dropMs: 2100 };

// VERDANT SHARE CAP — the fix for what MEASURED itself the moment the theme lock came
// off. Weight is `remaining x RARITY_W`, and multiplying by REMAINING is what keeps the
// CORE collection finishable. A 25-deep bonus tier sitting in the same roll inverts that
// in the tail: once the core is nearly collected its remaining weight collapses toward a
// couple of Radiants (2 x 0.022 = 0.044) while the Grove still carries 25 x 0.0035 =
// 0.0875, so the Grove becomes MORE likely than the critters you are actually chasing.
// Measured on the first run with the lock removed: 7 of 8 seeds DNF at 105 owned of a
// 100-critter target, and the completion band went 14.4/17.3/19.3h -> 27.5h — the
// coupon-collector tail this design exists to delete, reintroduced through the back door.
//
// So while the core is incomplete, the Grove's weight is capped at a share of the core's:
// it is always available, never dominant. Once the core is finished the cap has nothing
// to bind against and the Grove is the whole pool, which is the intended endgame.
export const VERDANT_SHARE_CAP = 0.05;   // <= 4.8% of draws while the core is unfinished

// The price of the NEXT critter depends on how many you already own, not on which
// tier it is. Flat per-tier pricing cannot work here: the stake ladder rises inside
// a tier, so a flat price would make the 30th Quartz trivially cheaper in real time
// than the 5th. One curve keeps dwell-time-per-critter under control end to end.
export const DRAW_COST_BASE = 402;   // 150 x 2.684, tracking the v0.2.0 phi rise 0.4618 -> 1.2396
// Retuned for the v0.6.0 gacha. Removing the tier gate lets a Radiant critter (5e7
// Lumens/sec) land in the first hour, which pulled measured completion from 17.90h
// down to 14.15h mean with a 11.74h floor — under the band. Raising the growth rate
// puts it back: 14.44 / 17.27 / 19.21h across 8 seeds, entirely inside 14-20h.
//
// This curve is a CLIFF and it is worth knowing why: the exponent runs over ~100
// draws, so 1.320 vs 1.310 is (1.32/1.31)^100 = 2.1x the final price. 1.320 measured
// 26.3h. Never nudge this by "a bit" — sweep it and re-measure.
export const DRAW_COST_GROWTH = 1.3130;
// Onboarding ramp: the first few are discounted so nobody stares at an empty dex.
// This is a real device, not a fudge — it moves total completion time by <1%.
// A RAMP, not a flat discount. At 1 Lumen/sec the first critter took up to 361s
// on a single flat 0.45 multiplier — six minutes of nothing happening, which is
// where a player decides whether the game is worth their afternoon. The ramp
// converges by the 6th critter and moves total completion time by well under 1%.
export const ONBOARD_RAMP = [0.10, 0.18, 0.30, 0.48, 0.70, 0.88];
export const ONBOARD_COUNT = ONBOARD_RAMP.length;
export function drawCostFor(ownedCount) {
  const n = Math.max(0, ownedCount);
  const c = DRAW_COST_BASE * Math.pow(DRAW_COST_GROWTH, n) * (n < ONBOARD_RAMP.length ? ONBOARD_RAMP[n] : 1);
  return Number.isFinite(c) ? c : Infinity;
}

// A starting handful, so the very first spin is not a 20-second wait at 1 L/s.
export const STARTING_LUMENS = 140;
// How many critters can be on stage in the Playground at once. 24 was already the hard
// slice the page took (`owned.slice(-24)`); v0.9.0 turns it from a silent truncation into
// a roster the player picks, so the number becomes a published cap rather than a surprise.
export const YARD_CAP = 24;

export const SPARK_MULTIPLIER = 4;   // pick an exact critter for 4x its tier draw cost
export const CRITTER_TOTAL = 100;        // the CORE collection; Verdant Grove is extra
export const VERDANT_TOTAL = 25;

// ---------------------------------------------------------------------------
// PACING TARGETS  — the acceptance bands the sim is held to. Not descriptive:
// a sim run outside these bands is a FAIL that retunes the constants above.
// ---------------------------------------------------------------------------
export const BANDS = {
  completionHoursMax: 24,      // HARD ceiling, stated by the user
  completionHoursMin: 9,       // below this the collection is decoration
  completionHoursTarget: [14, 20],
  // phi is a CONVERSION RATE between two invented currencies, not an RTP, so its
  // absolute value carries no meaning on its own — only its ratio to the cost
  // curve does. When the v0.2.0 feature rebuild pushed measured phi from 0.46 to
  // 1.24, the honest response was to widen this band and scale DRAW_COST_BASE by
  // the SAME factor (2.684), preserving completion time exactly, rather than
  // distorting a paytable that had finally reached a good channel split. The band
  // that actually constrains the game is completionHours, and it is unchanged.
  facetsPerLumenMin: 0.35,     // measured phi = E[Facets] / totalBet
  facetsPerLumenMax: 1.60,
  hitFrequencyMin: 0.26,       // fraction of base spins paying > 0
  hitFrequencyMax: 0.42,
  firstUnlockSeconds: 120,     // first critter owned within this
  offlineVsLiveRatio: 0.5,
  offlineVsLiveTolerance: 0.05,

  // FEATURE PREVALENCE. v0.1.0 shipped one free-spin round every 763 spins — a
  // 6.3% chance of ever seeing one in a 50-spin sitting. "The minigames never
  // happened" was a correct reading of the math, so the fix gets a band too.
  featuresPer100Min: 8,          // at least one feature every ~12 spins, all types
  freeSpinsPer1000Min: 8,        // <= 1 in 125
  holdPer1000Min: 12,            // <= 1 in 83
  splashPer1000Min: 60,          // <= 1 in 17 — the splash is meant to be common
  thunderPer1000Min: 25,         // <= 1 in 40
  wheelPer1000Min: 18,           // <= 1 in 56
  anyFeatureIn50SpinsMin: 0.97,  // P(a 50-spin session shows SOMETHING) >= 97%

  // SPENDABILITY. The fraction of all Lumens ever earned that the player never
  // gets to use. A time currency you cannot spend is just a number going up.
  unspentSurplusMax: 0.45,
};

// ---------------------------------------------------------------------------
// DESIGN LAWS enforced by gates, not by intent. Each is asserted by a test that
// was validated by being made to FAIL first.
// ---------------------------------------------------------------------------
export const DARK_LAWS = {
  // 1. No engineered near-miss: every reel carries identical premium + scatter density.
  equalPremiumDensity: ['E', 'S'],
  // 2. No loss-disguised-as-a-win: you stake Lumens, you are paid Facets. A spin
  //    paying 0 Facets renders as 0 with no win presentation. Structurally impossible
  //    to pay "less than you staked" because the currencies do not intersect.
  celebrationFloorFacets: 1,
  // 3. No false-hope reel stop: stop timing is a fixed constant per reel index,
  //    never a function of the outcome.
  reelStopMs: [0, 120, 240, 360, 480],
  // 4. Odds are published in-app, as text, from these same constants.
  ratesPageRequired: true,
};
