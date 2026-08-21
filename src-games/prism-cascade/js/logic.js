/* Prism Cascade — pure game logic (no DOM). Node-testable.
   Crafted by dhseadev. v2.0.0 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PCLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Seeded RNG (mulberry32) ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MAX_LEVEL = 100;
  // Bubble ascent, shared by the engine AND the simulator so the two cannot drift.
  // v1.3.0 rose at ~59px/s over a ~615px climb: a bubble took TEN SECONDS to reach the beam,
  // so a 30-second round only ever banked two waves and most of the pool never counted. The
  // first cut of the v2.0.0 calibration assumed 2.6s and set targets against a yield the game
  // could not produce. Both halves now read these numbers.
  const BUBBLE = {
    riseBase: 205,      // px/s at 1x buoyancy, measured against an 860px-tall viewport
    riseJitter: 70,
    travelFrac: 0.715,  // waterY (0.80H) up to beamY (0.085H)
    refHeight: 860,
  };
  function bubbleRiseSeconds(mult, viewportH) {
    const h = (viewportH || BUBBLE.refHeight) * BUBBLE.travelFrac;
    return h / (BUBBLE.riseBase * (mult || 1));
  }
  const STARDROP_RATE = 0.24;   // v2.0.0: 0.35 -> 0.24. Drops are scarcer so upgrades are decisions.
  const ROUND_SECONDS = 30;

  // ---------- Level generation (deterministic per level) ----------
  const LAYOUTS = ['towers', 'arc', 'rings', 'stairs', 'diamond', 'cavern'];
  function genLevel(level) {
    const l = Math.max(1, Math.min(MAX_LEVEL, level | 0));
    const rng = mulberry32(0xC0FFEE ^ (l * 2654435761));
    const layout = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
    const count = Math.min(18, 3 + Math.floor(l * 0.45) + Math.floor(rng() * 2));
    const hp = 1 + Math.floor(l / 8);
    const crystals = [];
    // Positions in normalized play space x:[0.18,0.78] y:[0.10,0.62] (cascade at right, pool below)
    for (let i = 0; i < count; i++) {
      let x, y;
      const f = count <= 1 ? 0 : i / (count - 1);
      if (layout === 'towers') {
        const col = i % 4, row = Math.floor(i / 4);
        x = 0.30 + col * 0.14 + (rng() - 0.5) * 0.02;
        y = 0.58 - row * 0.11;
      } else if (layout === 'arc') {
        x = 0.22 + f * 0.52;
        y = 0.50 - Math.sin(f * Math.PI) * 0.30;
      } else if (layout === 'rings') {
        const ang = f * Math.PI * 2, r = 0.16 + (i % 2) * 0.07;
        x = 0.48 + Math.cos(ang) * r * 0.9;
        y = 0.36 + Math.sin(ang) * r;
      } else if (layout === 'stairs') {
        x = 0.22 + f * 0.52; y = 0.60 - f * 0.40;
      } else if (layout === 'diamond') {
        const ang = f * Math.PI * 2;
        x = 0.48 + Math.cos(ang) * 0.20;
        y = 0.36 + Math.sin(ang) * 0.24 * (0.6 + 0.4 * Math.abs(Math.cos(ang)));
      } else { // cavern: random clusters
        x = 0.22 + rng() * 0.50; y = 0.14 + rng() * 0.44;
      }
      const big = rng() < Math.min(0.35, 0.08 + l * 0.004);
      crystals.push({
        x: Math.min(0.78, Math.max(0.18, x)),
        y: Math.min(0.62, Math.max(0.10, y)),
        hp: big ? hp + 1 : hp,
        size: big ? 1.5 : 1,
        hue: Math.floor(rng() * 360),
      });
    }
    return { level: l, layout, crystals };
  }

  // ---------- Skill tree ----------
  // 3 branches x 4 nodes. v2.0.0: costs steepened (2.35^rank), effects buffed.
  // Rationale: an upgrade must be a saved-for purchase, and must visibly change a round.
  const TREE = [
    { id: 'power',     branch: 'shatter', name: 'Prism Power',   desc: '+1 orb damage per rank',                base: 4200,  max: 5, icon: '⚔' },
    { id: 'multishot', branch: 'shatter', name: 'Triple Throw',  desc: '+1 orb per volley per rank',            base: 5600,  max: 3, icon: '✵' },
    { id: 'heavy',     branch: 'shatter', name: 'Comet Mass',    desc: 'Bigger splash impulse (+30%/rank)',     base: 2400,  max: 5, icon: '☄' },
    { id: 'shock',     branch: 'shatter', name: 'Chain Shatter', desc: 'Breaks chain to neighbors (16%/rank)',  base: 6400,  max: 4, icon: '⚡' },
    { id: 'splash',    branch: 'flow',    name: 'Grand Splash',  desc: '+22% bubbles per splash per rank',      base: 2600,  max: 5, icon: '\u{1F30A}' },
    { id: 'buoyancy',  branch: 'flow',    name: 'Buoyancy',      desc: 'Bubbles rise +18% faster per rank',     base: 2200,  max: 5, icon: '\u{1F388}' },
    { id: 'shell',     branch: 'flow',    name: 'Pearl Shell',   desc: 'Bubbles survive +1 hit per rank',       base: 5200,  max: 2, icon: '\u{1FAA7}' },
    { id: 'calm',      branch: 'flow',    name: 'Calm Waters',   desc: 'Debris pops bubbles -22% per rank',     base: 3100,  max: 4, icon: '\u{1F54A}' },
    { id: 'gild',      branch: 'fortune', name: 'Gilding',       desc: '+16% bubble value per rank',            base: 3000,  max: 5, icon: '✨' },
    { id: 'overtime',  branch: 'fortune', name: 'Overflow',      desc: '+1s round time per rank',               base: 5000,  max: 5, icon: '⏳' },
    { id: 'lucky',     branch: 'fortune', name: 'Lucky Drops',   desc: '6%/rank chance of x5 golden bubble',    base: 4600,  max: 5, icon: '\u{1F340}' },
    { id: 'starglow',  branch: 'fortune', name: 'Starglow',      desc: 'Combo multiplier grows +12%/rank',      base: 6800,  max: 4, icon: '\u{1F31F}' },
  ];

  function nodeById(id) { return TREE.find(n => n.id === id) || null; }

  function upgradeCost(id, currentRank) {
    const n = nodeById(id);
    if (!n || currentRank >= n.max) return Infinity;
    return Math.round(n.base * Math.pow(2.35, currentRank) / 10) * 10;
  }

  function canBuy(save, id) {
    const n = nodeById(id);
    if (!n) return false;
    const rank = (save.tree && save.tree[id]) | 0;
    return rank < n.max && save.wallet >= upgradeCost(id, rank);
  }

  function buy(save, id) {
    if (!canBuy(save, id)) return false;
    const rank = (save.tree[id] = ((save.tree[id] | 0) + 1));
    save.wallet -= upgradeCost(id, rank - 1);
    return true;
  }

  // total stardrops sunk into the tree at a given rank map (achievements read this)
  function treeInvestment(tree) {
    let sum = 0;
    for (const n of TREE) {
      const r = (tree && tree[n.id]) | 0;
      for (let i = 0; i < r; i++) sum += upgradeCost(n.id, i);
    }
    return sum;
  }

  // ---------- Endowments (milestone-unlocked boons; exactly ONE equipped) ----------
  const ENDOWMENTS = [
    { id: 'tide',    name: 'Tide Blessing', unlock: 5,  icon: '\u{1F30A}', desc: '+12% bubble value',        effect: { bubbleValueMult: 1.12 } },
    { id: 'comet',   name: 'Comet Heart',   unlock: 15, icon: '☄',    desc: '+1 orb damage',            effect: { orbDamageAdd: 1 } },
    { id: 'moon',    name: 'Moonlight',     unlock: 30, icon: '\u{1F319}', desc: '+18% bubbles per splash',  effect: { bubbleCountMult: 1.18 } },
    { id: 'auric',   name: 'Auric Tide',    unlock: 50, icon: '\u{1FA99}', desc: 'Stardrop rate 24% to 34%', effect: { stardropRate: 0.34 } },
    { id: 'phoenix', name: 'Phoenix Plume', unlock: 75, icon: '\u{1FAB6}', desc: '+4s round time',           effect: { roundBonusAdd: 4 } },
  ];
  function endowmentById(id) { return ENDOWMENTS.find(e => e.id === id) || null; }
  function unlockedEndowments(level) { return ENDOWMENTS.filter(e => (level | 0) >= e.unlock); }
  function canEquip(save, id) { const e = endowmentById(id); return !!e && (save.level | 0) >= e.unlock; }
  function equip(save, id) {
    if (id === null || id === '') { save.endow = ''; return true; }
    if (!canEquip(save, id)) return false;
    save.endow = id; return true;
  }
  function stardropRate(save) {
    const e = endowmentById(save && save.endow);
    return (e && e.effect.stardropRate) || STARDROP_RATE;
  }

  // ---------- Consumables (bought with stardrops, spent inside a round) ----------
  // A second sink that competes with the tree, so stardrops stay scarce and powerups
  // stay worth choosing between.
  const CONSUMABLES = [
    { id: 'storm',  name: 'Prism Storm',   icon: '\u{1F329}', cost: 900,  desc: 'Next 3 volleys fire double orbs' },
    { id: 'still',  name: 'Still Water',   icon: '\u{1FAB7}', cost: 750,  desc: '6s where nothing can pop a bubble' },
    { id: 'golden', name: 'Golden Tide',   icon: '\u{1FA99}', cost: 1400, desc: 'Next 2 splashes are all-golden' },
    { id: 'dilate', name: 'Time Dilation', icon: '⏱',    cost: 1200, desc: '+8s to the round clock, once' },
  ];
  function consumableById(id) { return CONSUMABLES.find(c => c.id === id) || null; }
  function buyConsumable(save, id, qty) {
    const c = consumableById(id);
    const n = Math.max(1, qty | 0 || 1);
    if (!c) return false;
    const total = c.cost * n;
    if (save.wallet < total) return false;
    save.wallet -= total;
    save.items[id] = (save.items[id] | 0) + n;
    return true;
  }
  function useConsumable(save, id) {
    if (!consumableById(id)) return false;
    if ((save.items[id] | 0) <= 0) return false;
    save.items[id]--;
    if (save.items[id] <= 0) delete save.items[id];
    save.c.itemsUsed++;
    return true;
  }

  // Derived gameplay stats from tree ranks (+ optional equipped endowment)
  function derivedStats(tree, endowId) {
    const r = id => (tree && tree[id]) | 0;
    const e = endowmentById(endowId);
    const fx = (e && e.effect) || {};
    return {
      orbDamage: 1 + r('power') + (fx.orbDamageAdd || 0),
      orbsPerShot: 1 + r('multishot'),
      splashImpulse: 1 + 0.30 * r('heavy'),
      chainChance: 0.16 * r('shock'),
      bubbleCountMult: (1 + 0.22 * r('splash')) * (fx.bubbleCountMult || 1),
      bubbleRiseMult: 1 + 0.18 * r('buoyancy'),
      bubbleHP: 1 + r('shell'),
      debrisPopMult: Math.max(0.2, 1 - 0.22 * r('calm')),
      bubbleValueMult: (1 + 0.16 * r('gild')) * (fx.bubbleValueMult || 1),
      roundBonusSec: r('overtime') + (fx.roundBonusAdd || 0),
      goldenChance: 0.06 * r('lucky'),
      comboGrowth: 1 + 0.12 * r('starglow'),
    };
  }

  // ---------- Scoring primitives ----------
  function bubblesForSplash(energy, stats, rand, forceGolden) {
    const rnd = rand || Math.random;
    const n = Math.max(1, Math.round((1 + energy * 2.2) * stats.bubbleCountMult));
    const out = [];
    for (let i = 0; i < Math.min(n, 14); i++) {
      const golden = forceGolden ? true : rnd() < stats.goldenChance;
      const val = Math.max(5, Math.round((8 + energy * 22) * stats.bubbleValueMult / 5) * 5) * (golden ? 5 : 1);
      out.push({ value: val, golden, hp: stats.bubbleHP });
    }
    return out;
  }

  function comboMultiplier(combo, stats) {
    return 1 + Math.min(4, combo * 0.08 * stats.comboGrowth);
  }

  // ---------- Par model -> star bands ----------
  // v2.0.0: thresholds are DERIVED from what a level can actually yield, not from a flat
  // multiplier off one curve. The old system used t / 1.55t / 2.3t at every level, which
  // made three stars a formality once the tree was half-bought.
  //
  // par = the score a clean round yields with era-appropriate upgrades. Two bounds:
  //   content-bound - every crystal shattered, its debris splashed, its bubbles banked
  //   time-bound    - how much damage a player can physically deliver inside the clock
  // par is the lower of the two. Star bands sit at fractions of par, and the three-star
  // band tightens with level so late levels demand better-than-par play.

  // The upgrade profile a player is EXPECTED to hold at a given level.
  function eraStats(level) {
    const l = Math.max(1, Math.min(MAX_LEVEL, level | 0));
    const p = (l - 1) / (MAX_LEVEL - 1); // 0..1
    const rank = (max, bias) => Math.min(max, Math.floor(p * max * bias + 0.0001));
    const tree = {
      power: rank(5, 1.0), multishot: rank(3, 0.9), heavy: rank(5, 1.0), shock: rank(4, 0.7),
      splash: rank(5, 1.0), buoyancy: rank(5, 0.9), shell: rank(2, 0.8), calm: rank(4, 0.8),
      gild: rank(5, 1.0), overtime: rank(5, 0.7), lucky: rank(5, 0.6), starglow: rank(4, 0.7),
    };
    const endow = l >= 75 ? 'phoenix' : l >= 50 ? 'auric' : l >= 30 ? 'moon' : l >= 15 ? 'comet' : l >= 5 ? 'tide' : '';
    return derivedStats(tree, endow);
  }

  const PAR = {
    shardsPerCrystal: 6.0,   // 5 + rand(0..2); +3 for a big crystal, added per-crystal below
    splashRate: 0.72,        // fraction of shards that reach the pool and splash
    energy: 0.95,            // mean splash energy at impulse 1.0
    bankRate: 0.70,          // fraction of bubbles that survive the rise
    comboMean: 1.42,         // mean combo multiplier across a clean round
    shotsPerSecond: 1.55,    // charged play: about 0.65s per aimed shot
    hitRate: 0.72,           // fraction of orbs that connect
  };

  function parScore(level, stats) {
    const def = genLevel(level);
    const st = stats || eraStats(level);
    const duration = ROUND_SECONDS + st.roundBonusSec;

    // --- content bound ---
    let shards = 0, totalHp = 0;
    for (const c of def.crystals) {
      shards += PAR.shardsPerCrystal + (c.size > 1 ? 3 : 0);
      totalHp += c.hp;
    }
    const energy = Math.min(3.2, PAR.energy * st.splashImpulse);
    const bubblesPerSplash = Math.min(14, Math.max(1, (1 + energy * 2.2) * st.bubbleCountMult));
    const baseVal = Math.max(5, Math.round((8 + energy * 22) * st.bubbleValueMult / 5) * 5);
    const meanVal = baseVal * (1 + 4 * st.goldenChance);
    const perSplash = bubblesPerSplash * meanVal * PAR.bankRate * PAR.comboMean;
    const contentBound = shards * PAR.splashRate * perSplash;

    // --- time bound ---
    const dmgPerShot = st.orbDamage * st.orbsPerShot * PAR.hitRate;
    const shotsAvailable = duration * PAR.shotsPerSecond;
    const chainRelief = 1 + st.chainChance * 1.2;
    const hpDeliverable = shotsAvailable * dmgPerShot * chainRelief;
    const fracClearable = Math.min(1, hpDeliverable / Math.max(1, totalHp));
    // bubbles also need time to rise; the last stretch of clock banks nothing new
    const timeBound = contentBound * fracClearable * 0.88;

    return Math.max(200, Math.round(Math.min(contentBound, timeBound) / 10) * 10);
  }

  // ---------- Calibrated level benchmark ----------
  // CAL[level-1] is the score a strong player with era-appropriate upgrades actually lands
  // on that level, measured by test/sim.js (trimmed mean of 301 simulated rounds, then
  // 3-point smoothed). Star bands are fractions of it.
  //
  // Why a table and not the analytic model below: parScore() estimates yield from level
  // content and clock, and it drifts badly past level 60 — it read level 100 as worth about
  // the same as a strong player's ACTUAL median there, which put the three-star bar above
  // anything reachable. parScore is kept as the independent cross-check the harness runs
  // against this table; disagreement between the two is a signal, not noise.
  //
  // The steps in this table are real: the expected upgrade profile levels up at discrete
  // points, so the bar jumps when the player's power does. The raw measurements are then run
  // through an isotonic (pool-adjacent-violators) fit so the bar never DROPS as you advance —
  // a level being intrinsically easier than the one before it is fine, a target that falls
  // when you progress is not. The flat stretches that produces are honest: those levels are
  // worth about the same.
  const CAL = [
    3970, 3970, 4260, 4680, 5530, 6340, 6530, 6870, 7680, 8220,
    8590, 9110, 9350, 9370, 9640, 10370, 10940, 11300, 11790, 15490,
    21710, 25010, 26910, 29800, 31750, 32780, 34630, 36430, 38740, 42560,
    45550, 46450, 48260, 48640, 48640, 48640, 48640, 48640, 48640, 48640,
    53250, 56380, 56610, 57860, 61590, 63740, 65350, 67820, 67820, 67820,
    67820, 67820, 68000, 68000, 68050, 68050, 68050, 68050, 68050, 73730,
    82510, 94380, 116850, 125650, 125650, 125650, 125650, 125650, 125650, 125650,
    125650, 125650, 125650, 125650, 125650, 125650, 125650, 125650, 125650, 125650,
    125650, 125650, 125650, 125650, 125650, 125650, 125650, 125650, 127480, 132240,
    132900, 132900, 132900, 133400, 133400, 133400, 133400, 134870, 147590, 170620
  ];
  function calibrated(level) {
    const l = Math.max(1, Math.min(MAX_LEVEL, level | 0));
    return CAL[l - 1];
  }

  // Star bands as fractions of the calibrated benchmark. Three tightens with level.
  function starBands(level) {
    const l = Math.max(1, Math.min(MAX_LEVEL, level | 0));
    const p = (l - 1) / (MAX_LEVEL - 1);
    return {
      one: 0.34,                // a competent round
      two: 0.60,                // a good round
      three: 0.82 + 0.10 * p,   // 0.82 -> 0.92 of a strong player's own median. Tightens.
    };
  }

  function starThresholds(level, mode) {
    const par = calibrated(level);
    const b = starBands(level);
    const m = challengeById(mode);
    const sm = m ? m.starMult : 1;
    const r10 = v => Math.round(v / 10) * 10;
    return {
      one: r10(par * b.one * sm),
      two: r10(par * b.two * sm),
      three: r10(par * b.three * sm),
      par: par,
    };
  }

  // The HUD target bar is the one-star line.
  function levelTarget(level, mode) { return starThresholds(level, mode).one; }

  // ---------- Challenge modes ----------
  // Unlocked per level once that level is three-starred in standard play.
  // `scoreMult` is the reward for taking the mode. `starMult` is how much higher the star
  // bar sits, and it ALREADY CONTAINS that reward: starMult = scoreMult x (measured relative
  // performance in this mode) x 1.10, where the 1.10 is the design margin that makes the mode
  // strictly harder than standard play. Values came out of the simulator, not out of taste.
  //
  // Two earlier cuts of this got it wrong and the battery caught both: the first ignored
  // scoreMult entirely, so a 1.6x reward cleared a bar that had never heard of it; the second
  // divided by the margin instead of multiplying, making every mode 10% EASIER than intended.
  const CHALLENGES = [
    { id: 'gale',       name: 'Gale',        icon: '\u{1F32C}', starMult: 1.28, scoreMult: 1.15,
      desc: 'A crosswind drags every orb, and chops at the pool.', rules: { wind: 1, timeDelta: -4, debrisPopMult: 1.25 } },
    { id: 'fogbank',    name: 'Fogbank',     icon: '\u{1F32B}', starMult: 1.42, scoreMult: 1.25,
      desc: 'Crystals hide in the mist until you strike them.', rules: { fog: 1 } },
    { id: 'brittle',    name: 'Brittle',     icon: '\u{1FAE7}', starMult: 1.25, scoreMult: 1.35,
      desc: 'Bubbles are paper-thin. One touch and the points are gone.', rules: { bubbleHP: 1, debrisPopMult: 1.6 } },
    { id: 'rationed',   name: 'Rationed',    icon: '\u{1F3AF}', starMult: 1.49, scoreMult: 1.45,
      desc: 'A counted quiver. Every wasted orb is a lost star.', rules: { shotBudget: 1 } },
    { id: 'stillmirror',name: 'Still Mirror',icon: '\u{1F6AB}', starMult: 1.39, scoreMult: 1.30,
      desc: 'The cascade stops reflecting. No bank shots.', rules: { noMirror: 1 } },
    { id: 'tempest',    name: 'Tempest',     icon: '⛈',    starMult: 1.71, scoreMult: 1.60,
      desc: 'Everything moves faster, including what you lose.', rules: { speed: 1.35, timeDelta: -4, debrisPopMult: 1.3 } },
  ];
  function challengeById(id) { return CHALLENGES.find(c => c.id === id) || null; }
  function challengeUnlocked(save, level, id) {
    if (!challengeById(id)) return false;
    return ((save.stars && save.stars[level]) | 0) >= 3;
  }
  // Shot budget for 'rationed': enough to clear with era damage, plus a thin margin.
  function shotBudget(level) {
    const def = genLevel(level);
    let hp = 0;
    for (const c of def.crystals) hp += c.hp;
    const st = eraStats(level);
    // No miss allowance on purpose: the budget is measured against PERFECT accuracy, so an
    // accurate player still feels it. Allowing for PAR.hitRate made the quiver non-binding.
    const per = Math.max(1, st.orbDamage * st.orbsPerShot);
    return Math.max(6, Math.ceil((hp / per) * 1.10));
  }

  function roundRules(level, mode, stats) {
    const m = challengeById(mode);
    const st = stats || derivedStats({});
    const base = {
      duration: ROUND_SECONDS + st.roundBonusSec,
      wind: 0, fog: 0, noMirror: 0, speed: 1,
      bubbleHP: st.bubbleHP, debrisPopMult: st.debrisPopMult,
      shots: Infinity, scoreMult: 1, mode: '',
    };
    if (!m) return base;
    const r = m.rules;
    base.mode = m.id;
    base.scoreMult = m.scoreMult;
    if (r.timeDelta) base.duration = Math.max(12, base.duration + r.timeDelta);
    if (r.wind) base.wind = 1;
    if (r.fog) base.fog = 1;
    if (r.noMirror) base.noMirror = 1;
    if (r.speed) base.speed = r.speed;
    if (r.bubbleHP) base.bubbleHP = r.bubbleHP;
    if (r.debrisPopMult) base.debrisPopMult = st.debrisPopMult * r.debrisPopMult;
    if (r.shotBudget) base.shots = shotBudget(level);
    return base;
  }

  function starsFor(score, thresholds) {
    return score >= thresholds.three ? 3 : score >= thresholds.two ? 2 : score >= thresholds.one ? 1 : 0;
  }

  // ---------- Save / persistence (storage-agnostic pure ops) ----------
  const SAVE_KEY = 'pc_save_v1'; // key retained so v1 progress is FOUND; payload is v2
  const SAVE_VERSION = 2;

  function newSave() {
    return {
      v: SAVE_VERSION,
      level: 1, wallet: 0, lifetime: 0, bestRound: 0,
      stars: {},    // level -> 0..3 standard
      cstars: {},   // "level:mode" -> 0..3 challenge
      tree: {}, items: {}, ach: {},
      name: '', endow: '',
      c: {
        rounds: 0, shattered: 0, banked: 0, popped: 0, bestCombo: 0, goldens: 0,
        splashes: 0, shots: 0, perfectRounds: 0, giveUps: 0, sharks: 0,
        challengeClears: 0, threeStars: 0, itemsUsed: 0, secondsPlayed: 0, leaps: 0,
        mirrorShots: 0, cleanSweeps: 0, maxCharge: 0, bestRoundMode: '',
      },
      settings: { music: true, sfx: true },
    };
  }

  function clampInt(v, lo, hi) { const n = Math.floor(+v || 0); return Math.max(lo, Math.min(hi, n)); }

  // Accepts a v1 OR v2 payload. v1 progress is MIGRATED, never wiped: level, wallet,
  // lifetime, bestRound, stars, tree, name and endowment all carry over. The v1
  // leaderboard is dropped (the feature no longer exists).
  function validateSave(s) {
    const d = newSave();
    if (!s || typeof s !== 'object') return d;
    d.level = clampInt(s.level, 1, MAX_LEVEL) || 1;
    d.wallet = Math.max(0, Math.floor(+s.wallet || 0));
    d.lifetime = Math.max(0, Math.floor(+s.lifetime || 0));
    d.bestRound = Math.max(0, Math.floor(+s.bestRound || 0));
    d.name = typeof s.name === 'string' ? Array.from(s.name).slice(0, 14).join('') : '';
    if (s.stars && typeof s.stars === 'object' && !Array.isArray(s.stars)) {
      for (const k of Object.keys(s.stars)) {
        const lv = clampInt(k, 1, MAX_LEVEL);
        const st = clampInt(s.stars[k], 0, 3);
        if (lv && st) d.stars[lv] = st;
      }
    }
    if (s.cstars && typeof s.cstars === 'object' && !Array.isArray(s.cstars)) {
      for (const k of Object.keys(s.cstars)) {
        const parts = String(k).split(':');
        if (!challengeById(parts[1])) continue;
        const n = clampInt(parts[0], 1, MAX_LEVEL);
        const st = clampInt(s.cstars[k], 0, 3);
        if (n && st) d.cstars[n + ':' + parts[1]] = st;
      }
    }
    if (s.tree && typeof s.tree === 'object' && !Array.isArray(s.tree)) {
      for (const n of TREE) {
        const r = s.tree[n.id] | 0;
        if (r > 0) d.tree[n.id] = Math.min(n.max, r);
      }
    }
    if (s.items && typeof s.items === 'object' && !Array.isArray(s.items)) {
      for (const c of CONSUMABLES) {
        const q = clampInt(s.items[c.id], 0, 99);
        if (q > 0) d.items[c.id] = q;
      }
    }
    if (s.ach && typeof s.ach === 'object' && !Array.isArray(s.ach)) {
      for (const k of Object.keys(s.ach)) {
        if (typeof k === 'string' && k.length < 40 && s.ach[k]) d.ach[k] = 1;
      }
    }
    if (s.c && typeof s.c === 'object' && !Array.isArray(s.c)) {
      for (const k of Object.keys(d.c)) {
        if (typeof d.c[k] === 'number') d.c[k] = Math.max(0, Math.floor(+s.c[k] || 0));
        else if (typeof s.c[k] === 'string') d.c[k] = String(s.c[k]).slice(0, 20);
      }
    }
    if (s.settings && typeof s.settings === 'object') {
      d.settings.music = s.settings.music !== false;
      d.settings.sfx = s.settings.sfx !== false;
    }
    const e = endowmentById(typeof s.endow === 'string' ? s.endow : '');
    d.endow = (e && d.level >= e.unlock) ? e.id : '';
    // v1 payloads carry no counters; seed only what can be honestly inferred.
    if ((s.v | 0) < 2) {
      d.c.threeStars = Object.keys(d.stars).filter(k => d.stars[k] >= 3).length;
      d.c.rounds = Math.max(d.c.rounds, Object.keys(d.stars).length);
    }
    return d;
  }

  function endRound(save, roundScore, level, starsEarned, mode) {
    const s = Math.max(0, Math.floor(roundScore));
    const drops = Math.round(s * stardropRate(save));
    save.wallet += drops;
    save.lifetime += s;
    if (s > save.bestRound) { save.bestRound = s; save.c.bestRoundMode = mode || ''; }
    let advanced = false;
    if (mode) {
      const key = level + ':' + mode;
      const prev = save.cstars[key] | 0;
      if (starsEarned > prev) save.cstars[key] = starsEarned;
      if (starsEarned >= 1 && prev < 1) save.c.challengeClears++;
    } else {
      const prev = save.stars[level] | 0;
      if (starsEarned > prev) save.stars[level] = starsEarned;
      if (starsEarned >= 3 && prev < 3) save.c.threeStars++;
      if (starsEarned >= 1 && level >= save.level && save.level < MAX_LEVEL) {
        save.level = level + 1;
        advanced = true;
      }
    }
    save.c.rounds++;
    return { advanced, banked: s, drops };
  }

  function totalStars(save) {
    let n = 0;
    for (const k of Object.keys(save.stars || {})) n += save.stars[k] | 0;
    return n;
  }
  function totalChallengeStars(save) {
    let n = 0;
    for (const k of Object.keys(save.cstars || {})) n += save.cstars[k] | 0;
    return n;
  }

  return {
    mulberry32, MAX_LEVEL, STARDROP_RATE, ROUND_SECONDS, SAVE_VERSION, PAR, BUBBLE, bubbleRiseSeconds,
    genLevel, eraStats, parScore, calibrated, CAL, starBands, starThresholds, levelTarget, starsFor,
    TREE, nodeById, upgradeCost, canBuy, buy, treeInvestment, derivedStats,
    ENDOWMENTS, endowmentById, unlockedEndowments, canEquip, equip, stardropRate,
    CONSUMABLES, consumableById, buyConsumable, useConsumable,
    CHALLENGES, challengeById, challengeUnlocked, shotBudget, roundRules,
    bubblesForSplash, comboMultiplier,
    SAVE_KEY, newSave, validateSave, endRound, totalStars, totalChallengeStars,
  };
});
