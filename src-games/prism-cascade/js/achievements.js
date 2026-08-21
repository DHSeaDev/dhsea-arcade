/* Prism Cascade — achievements. Pure, no DOM, Node-testable.
   Crafted by dhseadev. v2.0.0

   Every entry is a pure predicate over { save, round } where `round` is the summary of
   the round that just ended (or null when evaluating outside a round). Tiers:
     bronze  — you will get these by playing
     silver  — you will get these by playing well
     gold    — you will get these on purpose
     mythic  — you will get these once, and you will remember it
*/
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(
    typeof require !== 'undefined' ? require('./logic.js') : null);
  else root.PCAch = factory(root.PCLogic);
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';

  const TIERS = {
    bronze: { name: 'Bronze', color: '#d99a5b', weight: 1 },
    silver: { name: 'Silver', color: '#c8d4ea', weight: 3 },
    gold:   { name: 'Gold',   color: '#ffd257', weight: 8 },
    mythic: { name: 'Mythic', color: '#c08bff', weight: 25 },
  };

  // helpers — every one tolerates a missing round or missing counter
  const c = (s, k) => (s && s.c && s.c[k]) | 0;
  const r = (rd, k) => (rd && typeof rd[k] === 'number') ? rd[k] : 0;
  const rb = (rd, k) => !!(rd && rd[k]);
  const stars3 = s => c(s, 'threeStars');
  const cstarCount = s => {
    let n = 0;
    for (const k of Object.keys((s && s.cstars) || {})) if ((s.cstars[k] | 0) >= 3) n++;
    return n;
  };
  const modesCleared = s => {
    const set = {};
    for (const k of Object.keys((s && s.cstars) || {})) {
      if ((s.cstars[k] | 0) >= 1) set[String(k).split(':')[1]] = 1;
    }
    return Object.keys(set).length;
  };
  const modesThreeStarred = s => {
    const set = {};
    for (const k of Object.keys((s && s.cstars) || {})) {
      if ((s.cstars[k] | 0) >= 3) set[String(k).split(':')[1]] = 1;
    }
    return Object.keys(set).length;
  };
  const maxedNodes = s => {
    if (!L) return 0;
    let n = 0;
    for (const node of L.TREE) if (((s.tree && s.tree[node.id]) | 0) >= node.max) n++;
    return n;
  };

  const A = [
    // ---------------- progression (bronze) ----------------
    { id: 'first_splash',  tier: 'bronze', icon: '💧', name: 'First Splash',      desc: 'Bank your first bubble.',                    test: (s) => c(s, 'banked') >= 1 },
    { id: 'first_star',    tier: 'bronze', icon: '⭐', name: 'A Star Is Born',     desc: 'Earn your first star.',                      test: (s) => L.totalStars(s) >= 1 },
    { id: 'lv5',           tier: 'bronze', icon: '🌊', name: 'Tide Blessed',       desc: 'Reach level 5.',                             test: (s) => s.level >= 5 },
    { id: 'lv15',          tier: 'bronze', icon: '☄',  name: 'Comet Hearted',      desc: 'Reach level 15.',                            test: (s) => s.level >= 15 },
    { id: 'lv30',          tier: 'silver', icon: '🌙', name: 'Moonlit',            desc: 'Reach level 30.',                            test: (s) => s.level >= 30 },
    { id: 'lv50',          tier: 'silver', icon: '🪙', name: 'Auric',              desc: 'Reach level 50.',                            test: (s) => s.level >= 50 },
    { id: 'lv75',          tier: 'gold',   icon: '🪶', name: 'Plumed',             desc: 'Reach level 75.',                            test: (s) => s.level >= 75 },
    { id: 'lv100',         tier: 'gold',   icon: '🏔', name: 'Summit',             desc: 'Reach level 100.',                           test: (s) => s.level >= 100 },
    { id: 'ten_rounds',    tier: 'bronze', icon: '🔁', name: 'Warmed Up',          desc: 'Play 10 rounds.',                            test: (s) => c(s, 'rounds') >= 10 },
    { id: 'hundred_rounds',tier: 'silver', icon: '♾',  name: 'Devoted',            desc: 'Play 100 rounds.',                           test: (s) => c(s, 'rounds') >= 100 },
    { id: 'five_hundred',  tier: 'gold',   icon: '🕰', name: 'Time Well Spent',    desc: 'Play 500 rounds.',                           test: (s) => c(s, 'rounds') >= 500 },

    // ---------------- shattering ----------------
    { id: 'shatter_100',   tier: 'bronze', icon: '💎', name: 'Glasswork',          desc: 'Shatter 100 crystals.',                      test: (s) => c(s, 'shattered') >= 100 },
    { id: 'shatter_1000',  tier: 'silver', icon: '🔨', name: 'Prismbreaker',       desc: 'Shatter 1,000 crystals.',                    test: (s) => c(s, 'shattered') >= 1000 },
    { id: 'shatter_10000', tier: 'gold',   icon: '⛏',  name: 'Quarryman',          desc: 'Shatter 10,000 crystals.',                   test: (s) => c(s, 'shattered') >= 10000 },
    { id: 'clean_sweep',   tier: 'bronze', icon: '🧹', name: 'Clean Sweep',        desc: 'Clear every crystal in a round.',            test: (s, rd) => rb(rd, 'cleared') },
    { id: 'sweep_10',      tier: 'silver', icon: '🧼', name: 'Spotless',           desc: 'Clear every crystal 10 rounds running.',     test: (s) => c(s, 'cleanSweeps') >= 10 },
    { id: 'chain_5',       tier: 'silver', icon: '⚡', name: 'Chain Reaction',      desc: 'Chain-shatter 5 crystals from one hit.',     test: (s, rd) => r(rd, 'bestChain') >= 5 },
    { id: 'chain_8',       tier: 'gold',   icon: '🌩', name: 'Cascade Failure',    desc: 'Chain-shatter 8 crystals from one hit.',     test: (s, rd) => r(rd, 'bestChain') >= 8 },

    // ---------------- bubbles & combo ----------------
    { id: 'combo_10',      tier: 'bronze', icon: '🫧', name: 'Bubbly',             desc: 'Reach a 10 combo.',                          test: (s) => c(s, 'bestCombo') >= 10 },
    { id: 'combo_25',      tier: 'silver', icon: '🌀', name: 'In The Flow',        desc: 'Reach a 25 combo.',                          test: (s) => c(s, 'bestCombo') >= 25 },
    { id: 'combo_50',      tier: 'gold',   icon: '🎐', name: 'Unbroken',           desc: 'Reach a 50 combo.',                          test: (s) => c(s, 'bestCombo') >= 50 },
    { id: 'combo_100',     tier: 'mythic', icon: '🕊', name: 'Serenity',           desc: 'Reach a 100 combo. Nothing popped. Nothing rushed.', test: (s) => c(s, 'bestCombo') >= 100 },
    { id: 'bank_1k',       tier: 'bronze', icon: '🧺', name: 'Collector',          desc: 'Bank 1,000 bubbles.',                        test: (s) => c(s, 'banked') >= 1000 },
    { id: 'bank_25k',      tier: 'silver', icon: '🏺', name: 'Curator',            desc: 'Bank 25,000 bubbles.',                       test: (s) => c(s, 'banked') >= 25000 },
    { id: 'bank_100k',     tier: 'gold',   icon: '🏛', name: 'Archivist',          desc: 'Bank 100,000 bubbles.',                      test: (s) => c(s, 'banked') >= 100000 },
    { id: 'golden_1',      tier: 'bronze', icon: '🍀', name: 'Lucky',              desc: 'Bank a golden bubble.',                      test: (s) => c(s, 'goldens') >= 1 },
    { id: 'golden_100',    tier: 'silver', icon: '🥇', name: 'Gilded',             desc: 'Bank 100 golden bubbles.',                   test: (s) => c(s, 'goldens') >= 100 },
    { id: 'golden_10_rd',  tier: 'gold',   icon: '👑', name: 'Midas Round',        desc: 'Bank 10 golden bubbles in one round.',       test: (s, rd) => r(rd, 'goldens') >= 10 },
    { id: 'no_pop',        tier: 'silver', icon: '🪷', name: 'Gentle Hands',       desc: 'Finish a round without popping one bubble.', test: (s, rd) => rd && rd.score > 0 && r(rd, 'popped') === 0 },
    { id: 'no_pop_3star',  tier: 'gold',   icon: '🌸', name: 'Immaculate',         desc: 'Three-star a level without popping one bubble.', test: (s, rd) => rd && r(rd, 'stars') >= 3 && r(rd, 'popped') === 0 },

    // ---------------- stars & mastery ----------------
    { id: 'three_first',   tier: 'bronze', icon: '✨', name: 'Perfectionist',      desc: 'Three-star any level.',                      test: (s) => stars3(s) >= 1 },
    { id: 'three_10',      tier: 'silver', icon: '💫', name: 'Constellation',      desc: 'Three-star 10 levels.',                      test: (s) => stars3(s) >= 10 },
    { id: 'three_25',      tier: 'silver', icon: '🌟', name: 'Star Chart',         desc: 'Three-star 25 levels.',                      test: (s) => stars3(s) >= 25 },
    { id: 'three_50',      tier: 'gold',   icon: '🌠', name: 'Half The Sky',       desc: 'Three-star 50 levels.',                      test: (s) => stars3(s) >= 50 },
    { id: 'three_100',     tier: 'mythic', icon: '🪐', name: 'Prism Sovereign',    desc: 'Three-star all 100 levels.',                 test: (s) => stars3(s) >= 100 },
    { id: 'stars_100',     tier: 'silver', icon: '⭐', name: 'Century of Light',   desc: 'Collect 100 stars.',                         test: (s) => L.totalStars(s) >= 100 },
    { id: 'stars_200',     tier: 'gold',   icon: '🌌', name: 'Skyful',             desc: 'Collect 200 stars.',                         test: (s) => L.totalStars(s) >= 200 },
    { id: 'par_beat',      tier: 'silver', icon: '📈', name: 'Above Par',          desc: 'Beat a level’s par score.',             test: (s, rd) => rd && rd.par > 0 && rd.score >= rd.par },
    { id: 'par_150',       tier: 'gold',   icon: '🚀', name: 'Overachiever',       desc: 'Score 150% of par in one round.',            test: (s, rd) => rd && rd.par > 0 && rd.score >= rd.par * 1.5 },
    { id: 'par_200',       tier: 'mythic', icon: '☄',  name: 'Impossible Round',   desc: 'Score double par in one round.',             test: (s, rd) => rd && rd.par > 0 && rd.score >= rd.par * 2 },

    // ---------------- precision & style ----------------
    { id: 'mirror_1',      tier: 'bronze', icon: '🪞', name: 'Bank Shot',          desc: 'Shatter a crystal off the cascade mirror.',  test: (s) => c(s, 'mirrorShots') >= 1 },
    { id: 'mirror_100',    tier: 'silver', icon: '🎱', name: 'Trick Shooter',      desc: 'Land 100 mirror shots.',                     test: (s) => c(s, 'mirrorShots') >= 100 },
    { id: 'full_charge',   tier: 'bronze', icon: '🔋', name: 'Fully Wound',        desc: 'Fire a fully charged volley.',               test: (s) => c(s, 'maxCharge') >= 1 },
    { id: 'charge_only',   tier: 'gold',   icon: '🎯', name: 'Measured',           desc: 'Three-star a level firing only full-charge volleys.', test: (s, rd) => rd && r(rd, 'stars') >= 3 && r(rd, 'shots') > 0 && r(rd, 'chargeShots') === r(rd, 'shots') },
    { id: 'ten_shots',     tier: 'gold',   icon: '🏹', name: 'Ten Arrows',         desc: 'Clear a level in 10 volleys or fewer.',      test: (s, rd) => rb(rd, 'cleared') && r(rd, 'shots') <= 10 },
    { id: 'five_shots',    tier: 'mythic', icon: '🗡', name: 'Surgeon',            desc: 'Clear a level in 5 volleys or fewer.',       test: (s, rd) => rb(rd, 'cleared') && r(rd, 'shots') <= 5 },
    { id: 'no_water',      tier: 'silver', icon: '🚱', name: 'Not A Drop Wasted',  desc: 'Finish a round with no orb landing in the pool.', test: (s, rd) => rd && r(rd, 'shots') >= 8 && r(rd, 'wastedOrbs') === 0 },
    { id: 'speedrun',      tier: 'gold',   icon: '⚡', name: 'Blink',              desc: 'Clear every crystal with 20+ seconds left.', test: (s, rd) => rb(rd, 'cleared') && r(rd, 'timeLeft') >= 20 },

    // ---------------- economy ----------------
    { id: 'first_buy',     tier: 'bronze', icon: '🛒', name: 'Investor',           desc: 'Buy your first upgrade.',                    test: (s) => L.treeInvestment(s.tree) > 0 },
    { id: 'branch_max',    tier: 'silver', icon: '🌿', name: 'Specialist',         desc: 'Max out any ability.',                       test: (s) => maxedNodes(s) >= 1 },
    { id: 'six_max',       tier: 'gold',   icon: '🌳', name: 'Deep Roots',         desc: 'Max out 6 abilities.',                       test: (s) => maxedNodes(s) >= 6 },
    { id: 'all_max',       tier: 'mythic', icon: '🌲', name: 'Nothing Left To Buy',desc: 'Max out every ability in the tree.',         test: (s) => maxedNodes(s) >= (L ? L.TREE.length : 12) },
    { id: 'lifetime_1m',   tier: 'silver', icon: '💰', name: 'Millionaire',        desc: 'Earn 1,000,000 lifetime points.',            test: (s) => s.lifetime >= 1e6 },
    { id: 'lifetime_10m',  tier: 'gold',   icon: '🏦', name: 'Treasury',           desc: 'Earn 10,000,000 lifetime points.',           test: (s) => s.lifetime >= 1e7 },
    { id: 'hoarder',       tier: 'silver', icon: '🧊', name: 'Hoarder',            desc: 'Hold 50,000 stardrops at once.',             test: (s) => s.wallet >= 50000 },
    { id: 'item_first',    tier: 'bronze', icon: '🎁', name: 'Come Prepared',      desc: 'Use a consumable in a round.',               test: (s) => c(s, 'itemsUsed') >= 1 },
    { id: 'item_50',       tier: 'silver', icon: '📦', name: 'Quartermaster',      desc: 'Use 50 consumables.',                        test: (s) => c(s, 'itemsUsed') >= 50 },
    { id: 'purist',        tier: 'gold',   icon: '🧘', name: 'Purist',             desc: 'Three-star a level 40+ using no consumables.', test: (s, rd) => rd && r(rd, 'stars') >= 3 && r(rd, 'level') >= 40 && r(rd, 'itemsUsed') === 0 },

    // ---------------- challenge modes ----------------
    { id: 'ch_first',      tier: 'bronze', icon: '🎲', name: 'Brave',              desc: 'Clear any challenge mode.',                  test: (s) => c(s, 'challengeClears') >= 1 },
    { id: 'ch_gale',       tier: 'silver', icon: '🌬', name: 'Windbreaker',        desc: 'Three-star a Gale run.',                     test: (s) => hasModeStar(s, 'gale', 3) },
    { id: 'ch_fog',        tier: 'silver', icon: '🌫', name: 'Blind Faith',        desc: 'Three-star a Fogbank run.',                  test: (s) => hasModeStar(s, 'fogbank', 3) },
    { id: 'ch_brittle',    tier: 'gold',   icon: '🫧', name: 'Feather Touch',      desc: 'Three-star a Brittle run.',                  test: (s) => hasModeStar(s, 'brittle', 3) },
    { id: 'ch_rationed',   tier: 'gold',   icon: '🎯', name: 'Every Orb Counts',   desc: 'Three-star a Rationed run.',                 test: (s) => hasModeStar(s, 'rationed', 3) },
    { id: 'ch_mirror',     tier: 'gold',   icon: '🚫', name: 'Straight Lines',     desc: 'Three-star a Still Mirror run.',             test: (s) => hasModeStar(s, 'stillmirror', 3) },
    { id: 'ch_tempest',    tier: 'mythic', icon: '⛈',  name: 'Eye Of The Storm',   desc: 'Three-star a Tempest run.',                  test: (s) => hasModeStar(s, 'tempest', 3) },
    { id: 'ch_all_clear',  tier: 'gold',   icon: '🗂', name: 'Tourist',            desc: 'Clear all six challenge modes at least once.', test: (s) => modesCleared(s) >= 6 },
    { id: 'ch_all_three',  tier: 'mythic', icon: '🏆', name: 'Six Seals',          desc: 'Three-star every challenge mode.',           test: (s) => modesThreeStarred(s) >= 6 },
    { id: 'ch_25',         tier: 'gold',   icon: '🧗', name: 'Glutton',            desc: 'Three-star 25 challenge runs.',              test: (s) => cstarCount(s) >= 25 },
    { id: 'ch_late',       tier: 'mythic', icon: '👁', name: 'Nothing Left To Prove', desc: 'Three-star a challenge run at level 90 or above.', test: (s) => hasModeStarAtOrAbove(s, 90, 3) },

    // ---------------- whimsy & scenery ----------------
    { id: 'shark_seen',    tier: 'bronze', icon: '🦈', name: 'Fin!',               desc: 'Meet the shark. Everyone got away.',         test: (s) => c(s, 'sharks') >= 1 },
    { id: 'shark_25',      tier: 'silver', icon: '🐠', name: 'Old Friends',        desc: 'Meet the shark 25 times.',                   test: (s) => c(s, 'sharks') >= 25 },
    { id: 'leap_seen',     tier: 'bronze', icon: '🐟', name: 'Leapfrog',           desc: 'Watch a fish leap.',                         test: (s) => c(s, 'leaps') >= 1 },
    { id: 'night_owl',     tier: 'bronze', icon: '🌙', name: 'Night Owl',          desc: 'Finish a round under a night sky.',          test: (s, rd) => rd && rd.tod === 'night' },
    { id: 'stormchaser',   tier: 'silver', icon: '🌧', name: 'Stormchaser',        desc: 'Three-star a level in the rain.',            test: (s, rd) => rd && r(rd, 'stars') >= 3 && rd.weather === 'rain' },
    { id: 'four_skies',    tier: 'silver', icon: '🎨', name: 'Four Skies',         desc: 'Three-star a level at dawn, day, dusk and night.', test: (s) => c(s, 'skySet') >= 15 },
    { id: 'give_up',       tier: 'bronze', icon: '🏳', name: 'Strategic Retreat',  desc: 'Give up on a round. It happens.',            test: (s) => c(s, 'giveUps') >= 1 },
    { id: 'comeback',      tier: 'silver', icon: '🔥', name: 'Comeback',           desc: 'Three-star a level you previously gave up on.', test: (s, rd) => rd && r(rd, 'stars') >= 3 && rb(rd, 'wasAbandoned') },
    { id: 'patient',       tier: 'gold',   icon: '⏳', name: 'Patient',            desc: 'Spend 10 hours in the cascade.',             test: (s) => c(s, 'secondsPlayed') >= 36000 },

    // ---------------- extreme ----------------
    { id: 'flawless_run',  tier: 'mythic', icon: '💠', name: 'Flawless',           desc: 'Three-star a level 50+ with zero pops and every crystal cleared.', test: (s, rd) => rd && r(rd, 'stars') >= 3 && r(rd, 'level') >= 50 && r(rd, 'popped') === 0 && rb(rd, 'cleared') },
    { id: 'no_upgrade_50', tier: 'mythic', icon: '🪨', name: 'Bare Hands',         desc: 'Three-star level 50 or higher with no ability above rank 1.', test: (s, rd) => rd && r(rd, 'stars') >= 3 && r(rd, 'level') >= 50 && lowTree(s) },
    { id: 'tempest_100',   tier: 'mythic', icon: '🌪', name: 'The Last Storm',     desc: 'Three-star Tempest on level 100.',           test: (s) => ((s.cstars || {})['100:tempest'] | 0) >= 3 },
    { id: 'centurion',     tier: 'mythic', icon: '🎖', name: 'Centurion',          desc: 'Three-star 100 challenge runs.',             test: (s) => cstarCount(s) >= 100 },
    { id: 'completionist', tier: 'mythic', icon: '🔮', name: 'Prism Cascade',      desc: 'Unlock every other achievement.',            test: (s) => countUnlocked(s) >= (A.length - 1), last: true },
  ];

  function hasModeStar(s, mode, n) {
    for (const k of Object.keys((s && s.cstars) || {})) {
      if (String(k).split(':')[1] === mode && (s.cstars[k] | 0) >= n) return true;
    }
    return false;
  }
  function hasModeStarAtOrAbove(s, level, n) {
    for (const k of Object.keys((s && s.cstars) || {})) {
      const p = String(k).split(':');
      if ((p[0] | 0) >= level && (s.cstars[k] | 0) >= n) return true;
    }
    return false;
  }
  function lowTree(s) {
    if (!L) return false;
    for (const node of L.TREE) if (((s.tree && s.tree[node.id]) | 0) > 1) return false;
    return true;
  }
  function countUnlocked(s) {
    let n = 0;
    for (const a of A) if (!a.last && (s.ach && s.ach[a.id])) n++;
    return n;
  }

  function byId(id) { return A.find(a => a.id === id) || null; }

  // Evaluate every locked achievement against the current save (+ optional round summary).
  // Returns the list newly unlocked and MUTATES save.ach. Order matters: the completionist
  // entry is tested last so it can see this round's unlocks.
  function evaluate(save, round) {
    if (!save.ach) save.ach = {};
    const won = [];
    for (const a of A) {
      if (save.ach[a.id]) continue;
      let ok = false;
      try { ok = !!a.test(save, round || null); } catch (e) { ok = false; }
      if (ok) { save.ach[a.id] = 1; won.push(a); }
    }
    return won;
  }

  function progress(save) {
    const total = A.length;
    let got = 0, points = 0, maxPoints = 0;
    const byTier = {};
    for (const t of Object.keys(TIERS)) byTier[t] = { got: 0, total: 0 };
    for (const a of A) {
      byTier[a.tier].total++;
      maxPoints += TIERS[a.tier].weight;
      if (save.ach && save.ach[a.id]) {
        got++; points += TIERS[a.tier].weight; byTier[a.tier].got++;
      }
    }
    return { got, total, points, maxPoints, byTier, pct: total ? got / total : 0 };
  }

  // Player rank title, derived from achievement points. Purely cosmetic, used on share cards.
  const RANKS = [
    [0, 'Pebble Skipper'], [15, 'Bubble Tender'], [40, 'Prism Apprentice'], [80, 'Cascade Rider'],
    [140, 'Shardwright'], [210, 'Tide Caller'], [300, 'Stormbreaker'], [400, 'Prism Sovereign'],
  ];
  function rankFor(points) {
    let name = RANKS[0][1];
    for (const [p, n] of RANKS) if (points >= p) name = n;
    return name;
  }

  return { ALL: A, TIERS, RANKS, byId, evaluate, progress, rankFor, countUnlocked };
});
