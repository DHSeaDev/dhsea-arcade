
/* =====================================================================
   BLOOM RUSH — core.js  (DOM-free deterministic game core)
   Runs identically in browser and Node (behavioral sim harness).
   ===================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BloomCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- RNG
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------- CONFIG
  const W = 960, H = 600;
  const CFG = {
    W, H,
    heroSpeed: 290,          // px/s (upgrade: +70)
    carryCap: 2,             // (upgrade: 3)
    prepTime: 6.0,           // mix counter seconds (upgrade: 4.5)
    prepSlots: 2,
    washTime: 6.0,           // per pot (upgrade: 4.2)
    washSlots: 2,
    readingTime: 4.0,        // plant decides its mix
    absorbTime: 8.0,
    specialChance: 0.22,     // mid-absorb mist request
    serenadeCooldown: 10,    // per plant
    serenadeHearts: 2,
    heartsMax: 5,
    queueDrain: 0.05,        // hearts/s while waiting in entry queue (~100s tolerance)
    basePay: 22,
    colorMatchPay: 1.30,     // ×
    colorMatchHearts: 1,
    actionPoints: 10,
    serenadeMax: 2,          // B1: serenades per plant PER VISIT. A cooldown cannot bound this:
                             // stopping the cactus case (0.045 h/s) would need a ~44s cooldown.
    // Measured, not chosen: mix-prep throughput caps a delivery run at 4 actions, so a cap
    // of 5 sat permanently out of reach and made both the cap and Shop Radio inert. The cap
    // is now the reachable ceiling; Radio's decay-instead-of-reset is what gets you to 5.
    chainCap: 4,
    angryLossPoints: 30,
    maxQueue: 6,             // entry queue capacity; overflow = instant angry leave
    taskQueueMax: 6,
  };

  // Action categories for chain bonus
  const ACT = { SEAT: 'seat', ORDER: 'order', DELIVER: 'deliver', CHECKOUT: 'checkout', WASH: 'wash', SERENADE: 'serenade', MIST: 'mist' };

  // ---------------------------------------------------------- ARCHETYPES
  const ARCH = {
    scout:   { key: 'scout',   name: 'Sprout Scout',   drain: 0.130, pay: 1.0, read: 4.0, absorb: 8.0,  desc: 'Cheerful starter seedling. Standard everything.' },
    fern:    { key: 'fern',    name: 'Fern Friend',    drain: 0.120, pay: 1.1, read: 4.0, absorb: 8.0,  desc: 'Easygoing regular. Reliable tipper.' },
    // Cactus pay was 0.8 against a 23s service time: 1.00 coins per bench-second versus the
    // orchid's 4.35, so the "safe" customer was a 4.3x-worse use of a bench with no upside.
    // It is still the lowest rate in the game - that is its identity - but no longer a trap.
    cactus:  { key: 'cactus',  name: 'Cactus Elder',   drain: 0.060, pay: 1.25, read: 7.0, absorb: 10.0, desc: 'Endlessly patient, decides slowly, tips modestly.' },
    // Orchid: the high-risk pole never actually carried risk (0 losses across 40 served).
    // Shorter fuse, slightly smaller purse.
    orchid:  { key: 'orchid',  name: 'Orchid Diva',    drain: 0.290, pay: 2.0, read: 2.5, absorb: 6.0,  desc: 'Zero patience, enormous tips. Handle with speed.' },
    monstera:{ key: 'monstera',name: 'Monstera Star',  drain: 0.150, pay: 1.6, read: 3.5, absorb: 8.0,  desc: 'A happy checkout cheers every seated neighbor (+1 heart).' },
    venus:   { key: 'venus',   name: 'Venus Chomper',  drain: 0.120, pay: 1.3, read: 4.0, absorb: 8.0,  desc: 'Noisy chomping drains neighbors’ hearts faster.' },
    twins:   { key: 'twins',   name: 'Succulent Twins',drain: 0.120, pay: 2.0, read: 4.5, absorb: 9.0,  desc: 'Two rosettes, one pot, double pay.' },
  };

  // ------------------------------------------------------------- SPECIES
  // Album entries. Each maps to an archetype and a draw style + palette.
  const SPECIES = [
    { id: 'sprout',    name: 'Bitty Sprout',      arch: 'scout',    flavor: 'Two leaves and infinite ambition.' },
    { id: 'basil',     name: 'Brave Basil',       arch: 'scout',    flavor: 'Smells like pesto and possibility.' },
    { id: 'fern',      name: 'Boston Fern',       arch: 'fern',     flavor: 'Unfurls drama in slow motion.' },
    { id: 'maiden',    name: 'Maidenhair Fern',   arch: 'fern',     flavor: 'Delicate. Judges your misting technique.' },
    { id: 'saguaro',   name: 'Saguaro Sam',       arch: 'cactus',   flavor: 'Has waited 40 years. Can wait 4 more minutes.' },
    { id: 'barrel',    name: 'Barrel Bea',        arch: 'cactus',   flavor: 'Round, ribbed, remarkably unbothered.' },
    { id: 'orchid',    name: 'Phalaenopsis Diva', arch: 'orchid',   flavor: 'Demands filtered light and immediate attention.' },
    { id: 'vanda',     name: 'Vanda Violette',    arch: 'orchid',   flavor: 'Roots refuse pots on principle. Pays double for the outrage.' },
    { id: 'monstera',  name: 'Monstera Marlowe',  arch: 'monstera', flavor: 'Every new leaf is a red-carpet event.' },
    { id: 'venus',     name: 'Chompy',            arch: 'venus',    flavor: 'Please stop feeding it crickets. It is full.' },
    { id: 'echeveria', name: 'The Echeveria Twins', arch: 'twins',  flavor: 'Finish each other’s photosynthesis.' },
    { id: 'string',    name: 'String-of-Pearls Pair', arch: 'twins',flavor: 'Two strands, endlessly tangled, split the bill.' },
  ];
  const SPECIES_BY_ARCH = {};
  SPECIES.forEach(s => { (SPECIES_BY_ARCH[s.arch] = SPECIES_BY_ARCH[s.arch] || []).push(s); });

  // Pot colors (colorblind-safe hues + shape glyphs painted by renderer)
  const POT_COLORS = [
    { id: 'terra',  name: 'Terracotta', hex: '#c8622f', glyph: 'triangle' },
    { id: 'blue',   name: 'Lake Blue',  hex: '#3d7dc8', glyph: 'circle' },
    { id: 'cream',  name: 'Cream',      hex: '#e8dcc0', glyph: 'square' },
    { id: 'plum',   name: 'Plum',       hex: '#8c4f8c', glyph: 'diamond' },
    { id: 'moss',   name: 'Moss Green', hex: '#5f7d3a', glyph: 'star' },
  ];

  // -------------------------------------------------------------- VENUES
  const VENUES = [
    { id: 0, name: 'Windowsill Start', sub: 'Gran’s apartment sill', benches: 4, colors: 3, time: 'morning' },
    { id: 1, name: 'Backyard Greenhouse', sub: 'Rain on the glass', benches: 4, colors: 3, time: 'rain' },
    { id: 2, name: 'Leaf & Ladle', sub: 'Boutique on Bramble St.', benches: 5, colors: 4, time: 'evening' },
    { id: 3, name: 'The Old Conservatory', sub: 'Moonlight & fireflies', benches: 5, colors: 4, time: 'night' },
    { id: 4, name: 'Grand Botanical Atrium', sub: 'Golden-hour glasswork', benches: 6, colors: 5, time: 'golden' },
  ];

  // Archetype availability ramps across career
  const ARCH_UNLOCK = [
    ['scout', 'fern'],                    // venue 0
    ['scout', 'fern', 'cactus'],
    ['scout', 'fern', 'cactus', 'orchid'],
    ['scout', 'fern', 'cactus', 'orchid', 'venus', 'twins'],
    ['scout', 'fern', 'cactus', 'orchid', 'venus', 'twins', 'monstera'],
  ];

  // --------------------------------------------------------- LEVEL BUILD
  // Deterministic spawn schedules. Difficulty knobs per career level 0..19.
  function buildLevel(levelIndex, seed) {
    const venue = VENUES[Math.floor(levelIndex / 4)];
    const sub = levelIndex % 4;                     // 0..3 within venue
    const rng = mulberry32((seed || 1000) + levelIndex * 7919);
    const t = levelIndex / 19;                      // 0..1 career progress
    // `sub` was removed from gapBase but left here, which relocated the venue sawtooth into
    // the customer count instead of eliminating it (spawns/bench fell 3.50 -> 2.20 at L7->L8).
    // Monotonic in levelIndex, like the gap.
    const count = Math.min(20, 6 + Math.round(levelIndex * 0.75)); // customers
    // B2/B4 - the arrival curve. Old: 13.0 - 3.2*t - sub*0.40, independent of bench count.
    // Two consequences: 4 benches at a 13s gap ran ~35% occupied so nothing was ever under
    // pressure; and plants never reached the same state together, so same-category actions
    // could not be batched and the chain system was unreachable in real play.
    // New: the gap derives from bench count, so pressure = service/(gap*benches) is what ramps.
    // `sub` is dropped: it reset every 4 levels while benches rose, making every venue
    // upgrade a 37% difficulty DROP. `t` alone is monotonic by construction.
    const gapBase = (34.0 / venue.benches) * (1.00 - 0.22 * t);   // seconds between arrivals
    const pool = ARCH_UNLOCK[venue.id];
    // weights: newest archetype slightly emphasized, divas capped
    const spawns = [];
    let tm = 3.0;
    for (let i = 0; i < count; i++) {
      let arch;
      const r = rng();
      if (venue.id >= 2 && r > 0.86) arch = 'orchid';
      else if (venue.id >= 4 && r > 0.76) arch = 'monstera';
      else arch = pool[Math.floor(rng() * pool.length)];
      // never two divas back-to-back (fairness)
      if (arch === 'orchid' && spawns.length && spawns[spawns.length - 1].arch === 'orchid') arch = 'fern';
      const sp = SPECIES_BY_ARCH[arch][Math.floor(rng() * SPECIES_BY_ARCH[arch].length)];
      spawns.push({ t: tm, arch, species: sp.id, color: Math.floor(rng() * venue.colors) });
      // closing-time mercy: the last quarter of arrivals spaces out 25% wider
      const lateMul = i >= count * 0.75 ? 1.25 : 1.0;
      tm += gapBase * lateMul * (0.75 + rng() * 0.5);
    }
    return {
      index: levelIndex, venue: venue.id, sub, seed: (seed || 1000) + levelIndex * 7919,
      benches: venue.benches, colors: venue.colors, spawns,
      // goals filled by calibrate() coefficients (validated by sim harness)
      goals: null,
    };
  }

  // Goal coefficients — fractions of the level's theoretical ceiling.
  // Ceiling = perfect hearts, all color-matched, healthy chains.
  const GOAL_COEF = { one: 0.34, two: 0.52, three: 0.70, expert: 0.82 };
  function theoreticalCeiling(level) {
    let total = 0;
    for (const s of level.spawns) {
      const a = ARCH[s.arch];
      const pay = CFG.basePay * a.pay * CFG.colorMatchPay;
      total += pay;                     // checkout coins→points
      // B3 - measured, not assumed. The old line claimed 6 actions/plant at an average chain
      // of 2.4 (144 pts). Real scoring actions per plant are seat 10 + order 10 + pickup 10
      // + deliver 10 + wash 8 + mist 10*specialChance = ~50 at chain 1. This is only the
      // fallback for un-calibrated levels, but it was wrong by 3x and nothing could tell.
      const perPlant = 4 * CFG.actionPoints + 8 + CFG.actionPoints * CFG.specialChance;
      total += perPlant * 1.6;
    }
    return total;
  }
  function goalsFor(level) {
    const ceil = theoreticalCeiling(level);
    const r10 = v => Math.max(10, Math.round(v / 10) * 10);
    return { one: r10(ceil * GOAL_COEF.one), two: r10(ceil * GOAL_COEF.two), three: r10(ceil * GOAL_COEF.three), expert: r10(ceil * GOAL_COEF.expert) };
  }

  // Sim-calibrated goals (see sim/harness.js --calibrate; baked from bot play, not theory).
  // null entries fall back to the theoretical formula until calibration is run.
  let CALIBRATED_GOALS = [{"one":500,"two":570,"three":630,"expert":690},{"one":540,"two":620,"three":690,"expert":760},{"one":630,"two":730,"three":800,"expert":880},{"one":630,"two":730,"three":800,"expert":880},{"one":680,"two":790,"three":870,"expert":950},{"one":750,"two":870,"three":950,"expert":1050},{"one":890,"two":1030,"three":1140,"expert":1250},{"one":970,"two":1120,"three":1230,"expert":1350},{"one":970,"two":1120,"three":1280,"expert":1550},{"one":970,"two":1120,"three":1290,"expert":1820},{"one":970,"two":1120,"three":1460,"expert":2360},{"one":970,"two":1120,"three":1460,"expert":2360},{"one":990,"two":1150,"three":1880,"expert":2360},{"one":990,"two":1150,"three":1880,"expert":2650},{"one":1070,"two":1240,"three":1880,"expert":2650},{"one":1070,"two":1240,"three":1880,"expert":2790},{"one":1070,"two":1240,"three":1880,"expert":2870},{"one":1070,"two":1240,"three":1880,"expert":3310},{"one":1070,"two":1240,"three":2040,"expert":4160},{"one":1070,"two":1240,"three":2070,"expert":4160}]; // sim-calibrated 2026-08-20 (sim/harness.js --calibrate) - derived from measured bot play, not theory

  const LEVELS = [];
  for (let i = 0; i < 20; i++) { const L = buildLevel(i, 1000); L.goals = goalsFor(L); LEVELS.push(L); }
  function applyCalibratedGoals(table) {
    CALIBRATED_GOALS = table;
    for (let i = 0; i < 20; i++) if (table && table[i]) LEVELS[i].goals = table[i];
  }
  if (CALIBRATED_GOALS) applyCalibratedGoals(CALIBRATED_GOALS);

  // ------------------------------------------------------------- LAYOUT
  // Station coordinates (shared by logic + renderer).
  function layoutFor(benchCount) {
    const benches = [];
    const cols = benchCount <= 4 ? 2 : 3;
    const rows = Math.ceil(benchCount / cols);
    const x0 = 330, x1 = 800, y0 = 300, y1 = 468;
    for (let i = 0; i < benchCount; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      benches.push({
        x: cols === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * (c / (cols - 1)),
        y: rows === 1 ? (y0 + y1) / 2 : y0 + (y1 - y0) * (r / (rows - 1)),
      });
    }
    return {
      benches,
      entry: { x: 96, y: 400 },      // queue front
      counter: { x: 190, y: 130 },   // mix counter (visual)
      counterStand: { x: 190, y: 208 }, // where the hero stands to grab mixes
      wash: { x: 862, y: 132 },      // wash rack (visual)
      washStand: { x: 862, y: 214 },
      heroHome: { x: 480, y: 360 },
    };
  }

  // ============================================================== LEVEL
  class Level {
    constructor(cfg, opts) {
      opts = opts || {};
      this.cfg = cfg;
      this.up = Object.assign({ speed: 0, carry: 0, patience: 0, radio: 0, quickmix: 0, fastwash: 0, decor: 0,
                                apron: 0, bell: 0, greenhouse: 0 }, opts.upgrades || {});
      this.rng = mulberry32(cfg.seed ^ 0x9e3779b9);
      this.endless = !!opts.endless;
      this.layout = layoutFor(cfg.benches);
      this.time = 0;
      this.score = 0; this.coins = 0; this.debt = 0;
      this.chain = { cat: null, n: 0, grace: true };
      this.events = [];            // drained by renderer / harness
      this.plants = [];            // all plant entities
      this.queue = [];             // plant ids waiting at entry
      this.benches = this.layout.benches.map((p, i) => ({
        id: i, x: p.x, y: p.y,
        color: Math.floor(this.rng() * cfg.colors),
        plant: null,               // plant id
        dirty: false,              // dirty pot waiting for pickup
        needsPot: false,           // pot lifted; bench is out of service until one is washed
      }));
      this.counter = { queue: [], ready: [] };   // orders prepping / ready mixes {plantId, t}
      this.prepSlots = cfg.venue >= 3 ? 3 : CFG.prepSlots;   // grander venues: better mixing bar
      this.washSlots = (cfg.venue >= 4 ? 3 : CFG.washSlots) + (this.up.fastwash ? 1 : 0);
      this.wash = [];              // washing slots [{t, benchColorNew}]
      this.washPending = 0;        // pots carried into rack but waiting for a slot
      this.hero = {
        x: this.layout.heroHome.x, y: this.layout.heroHome.y,
        tasks: [],                 // [{kind, ...}] FIFO
        carry: [],                 // [{type:'mix',plantId}|{type:'pot',color}]
        busyT: 0,                  // action animation lock
        seating: null,             // plant id currently being carried to seat (drag model)
      };
      this._uid = 0;            // per-Level ids: replays are byte-identical
      this.spawnIdx = 0;
      this.endlessRate = 11.0;     // s between endless arrivals (accelerates)
      this.nextEndless = 2.0;
      this.angryLeaves = 0;
      this.served = 0;
      this.stats = { servedBySpecies: {}, servedByArch: {}, maxChain: 0, colorMatches: 0, serenades: 0, angry: 0, mists: 0, washed: 0 };
      this.over = false; this.result = null;
    }

    // ---- helpers
    emit(ev) { this.events.push(ev); }
    plantById(id) { return this.plants.find(p => p.id === id); }
    benchOf(plant) { return plant.bench == null ? null : this.benches[plant.bench]; }
    heroSpeed() { return (CFG.heroSpeed + (this.up.speed ? 70 : 0)) * (this.up.apron ? 1.12 : 1); }
    carryCap() { return CFG.carryCap + (this.up.carry ? 1 : 0) + (this.up.apron ? 1 : 0); }
    actionMul() { return this.up.carry ? 0.70 : 1; }   // how long the hero is locked per action
    prepTime() { return this.up.quickmix ? 4.5 : CFG.prepTime; }
    washTime() { return this.up.fastwash ? 4.2 : CFG.washTime; }
    patienceMul() { return 1 - (this.up.patience ? 0.18 : 0) - (this.up.decor ? 0.07 : 0) - (this.up.greenhouse ? 0.15 : 0); }
    chainCap() { return CFG.chainCap + (this.up.radio ? 1 : 0); }

    // ---- spawning
    spawnPlant(spec) {
      const a = ARCH[spec.arch];
      const p = {
        id: ++this._uid, arch: spec.arch, species: spec.species, color: spec.color,
        state: 'queue',            // queue|seating|reading|ready_order|waiting_mix|absorbing|special|billing|leaving|gone
        hearts: CFG.heartsMax, bench: null,
        t: 0,                      // state timer
        serenadeCd: 0, serenadesLeft: CFG.serenadeMax, absorbT: 0, warned: false,
        matched: false, special: null, specialDone: false,
        pos: null,                 // renderer-owned
      };
      this.plants.push(p);
      if (this.queue.length >= CFG.maxQueue) {
        // overflow: instant angry walk-away
        p.state = 'gone'; this.angryLeave(p, true);
      } else {
        this.queue.push(p.id);
        this.emit({ type: 'arrive', id: p.id });
      }
      return p;
    }

    angryLeave(p, overflow) {
      p.state = 'leaving'; p.angry = true; p.t = 0;
      const b = this.benchOf(p);
      if (b && b.plant === p.id) { b.plant = null; b.dirty = true; }
      p.bench = null;
      const qi = this.queue.indexOf(p.id); if (qi >= 0) this.queue.splice(qi, 1);
      // drop any prepping/ready mixes for it
      this.counter.queue = this.counter.queue.filter(o => o.plantId !== p.id);
      this.counter.ready = this.counter.ready.filter(o => o.plantId !== p.id);
      this.hero.carry = this.hero.carry.filter(c => !(c.type === 'mix' && c.plantId === p.id));
      this.hero.tasks = this.hero.tasks.filter(t => t.plantId !== p.id);
      if (this.hero.seating === p.id) this.hero.seating = null;
      // The penalty used to clamp at 0, making walk-outs free for a player sitting on no score.
      // Unpayable penalty becomes debt and is taken out of the next points earned.
      const paid = Math.min(this.score, CFG.angryLossPoints);
      this.score -= paid; this.debt += CFG.angryLossPoints - paid;
      this.chain = { cat: null, n: 0, grace: true };
      this.angryLeaves++; this.stats.angry++;
      this.emit({ type: 'angry', id: p.id, overflow: !!overflow });
    }

    // ---- chain / scoring
    scoreAction(cat, pts) {
      // Shop Radio used to do one thing - raise the cap - and the cap almost never bound, so
      // it measured as a zero-value purchase (identical score with and without it). It now
      // also carries your rhythm through ONE change of task: the first category switch in a
      // chain keeps its value instead of collapsing to 1. That is what makes the x5 ceiling
      // reachable in real play, where you cannot batch one action type indefinitely.
      if (this.chain.cat === cat) {
        this.chain.n = Math.min(this.chain.n + 1, this.chainCap());
      } else if (this.up.radio && this.chain.grace && this.chain.n >= 2) {
        this.chain = { cat, n: this.chain.n, grace: false };
      } else {
        this.chain = { cat, n: 1, grace: true };
      }
      this.stats.maxChain = Math.max(this.stats.maxChain, this.chain.n);
      let gained = (pts == null ? CFG.actionPoints : pts) * this.chain.n;
      if (this.debt > 0) { const pay = Math.min(this.debt, gained); this.debt -= pay; gained -= pay; }
      this.score += gained;
      this.emit({ type: 'points', cat, gained, chain: this.chain.n });
      return gained;
    }

    // ================================================== PLAYER COMMANDS
    // Every command validates, then enqueues a hero task. Returns true if accepted.
    cmd(kind, arg) {
      const h = this.hero;
      arg = arg || {};                 // B6: every case below reads arg.*; a bare cmd() must reject, not throw
      if (this.over) return false;
      if (h.tasks.length >= CFG.taskQueueMax) return false;
      // A rescue jumps the line. Without this, the FIFO queue punished the player for
      // being attentive: the sixth command issued was executed sixth, by which time the
      // plant it was meant to save had already walked out.
      const urgent = (t) => {
        const q = this.plantById(t.plantId);
        if (q && q.hearts < 1.3 && q.bench != null) { h.tasks.unshift(t); return true; }
        h.tasks.push(t); return false;
      };
      switch (kind) {
        case 'seat': { // arg {plantId, benchId}
          const p = this.plantById(arg.plantId), b = this.benches[arg.benchId];
          if (!p || !b || p.state !== 'queue' || b.plant != null || b.dirty || b.needsPot) return false;
          if (this.hero.tasks.some(t => (t.kind === 'seat' || t.kind === '_place') && (t.plantId === p.id || t.benchId === b.id))) return false;
          if (this.hero.seating === p.id) return false;
          h.tasks.push({ kind: 'seat', plantId: p.id, benchId: b.id });
          return true;
        }
        case 'order': { // take order at bench
          const p = this.plantById(arg.plantId);
          if (!p || p.state !== 'ready_order') return false;
          if (h.tasks.some(t => t.kind === 'order' && t.plantId === p.id)) return false;
          urgent({ kind: 'order', plantId: p.id });
          return true;
        }
        case 'pickup': { // pick ready mix (auto-delivers)
          const o = this.counter.ready.find(o => o.plantId === arg.plantId);
          if (!o) return false;
          // hands full and holding pots: pots can only be freed at the wash rack —
          // accepting would consume the task as a no-op loop. Reject; wash first.
          if (h.carry.length >= this.carryCap() && h.carry.some(c => c.type === 'pot')) return false;
          if (h.tasks.some(t => (t.kind === 'pickup' || t.kind === 'deliver') && t.plantId === arg.plantId)) return false;
          h.tasks.push({ kind: 'pickup', plantId: arg.plantId });
          return true;
        }
        case 'mist': {
          const p = this.plantById(arg.plantId);
          if (!p || p.state !== 'special') return false;
          if (h.tasks.some(t => t.kind === 'mist' && t.plantId === p.id)) return false;
          urgent({ kind: 'mist', plantId: p.id });
          return true;
        }
        case 'checkout': {
          const p = this.plantById(arg.plantId);
          if (!p || p.state !== 'billing') return false;
          if (h.tasks.some(t => t.kind === 'checkout' && t.plantId === p.id)) return false;
          urgent({ kind: 'checkout', plantId: p.id });
          return true;
        }
        case 'serenade': {
          const p = this.plantById(arg.plantId);
          if (!p || p.bench == null || p.serenadeCd > 0 || p.state === 'leaving' || p.state === 'gone') return false;
          if (p.serenadesLeft <= 0) return false;                    // B1: per-visit budget spent
          if (h.tasks.some(t => t.kind === 'serenade' && t.plantId === p.id)) return false;
          h.tasks.push({ kind: 'serenade', plantId: p.id });
          return true;
        }
        case 'pot': { // pick dirty pot from bench
          const b = this.benches[arg.benchId];
          if (!b || !b.dirty) return false;
          // never strip the last workable bench while the rack is empty
          const workable = this.benches.filter(x => !x.needsPot && x.id !== b.id).length;
          if (workable === 0 && this.wash.length === 0 && this.washPending === 0) return false;
          if (h.tasks.some(t => t.kind === 'pot' && t.benchId === b.id)) return false;
          h.tasks.push({ kind: 'pot', benchId: b.id });
          return true;
        }
        case 'wash': { // go deposit carried pots
          if (!h.carry.some(c => c.type === 'pot') && !h.tasks.some(t => t.kind === 'pot')) return false;
          if (h.tasks.some(t => t.kind === 'wash')) return false;
          h.tasks.push({ kind: 'wash' });
          return true;
        }
      }
      return false;
    }

    // Task target position
    taskPos(t) {
      const L = this.layout;
      switch (t.kind) {
        case 'seat': return L.entry;
        case '_place': { const b = this.benches[t.benchId]; return b ? b : L.heroHome; }
        case 'order': case 'mist': case 'checkout': case 'serenade': {
          const p = this.plantById(t.plantId); const b = p && this.benchOf(p);
          return b ? b : L.heroHome;
        }
        case 'pickup': return L.counterStand;
        case 'pot': return this.benches[t.benchId];
        case 'wash': return L.washStand;
      }
      return L.heroHome;
    }

    // Execute task when hero arrives (returns action lock seconds)
    execTask(t) {
      const h = this.hero;
      switch (t.kind) {
        case 'seat': {
          const p = this.plantById(t.plantId), b = this.benches[t.benchId];
          if (!p || p.state !== 'queue' || !b || b.plant != null || b.dirty || b.needsPot) return 0;
          // phase 1: pick up plant at entry, phase 2 handled via seating flag
          const qi = this.queue.indexOf(p.id); if (qi >= 0) this.queue.splice(qi, 1);
          p.state = 'seating'; h.seating = p.id;
          h.tasks.unshift({ kind: '_place', plantId: p.id, benchId: b.id });
          return 0.15;
        }
        case '_place': {
          const p = this.plantById(t.plantId), b = this.benches[t.benchId];
          if (!p || !b) { h.seating = null; return 0; }
          if (b.plant != null || b.dirty || b.needsPot) { // bench got blocked: re-queue plant
            p.state = 'queue'; this.queue.unshift(p.id); h.seating = null; return 0;
          }
          b.plant = p.id; p.bench = b.id; h.seating = null;
          p.state = 'reading'; p.t = 0;
          p.matched = (p.color === b.color);
          if (p.matched) { p.hearts = Math.min(CFG.heartsMax, p.hearts + CFG.colorMatchHearts); this.stats.colorMatches++; }
          this.scoreAction(ACT.SEAT);
          this.emit({ type: 'seated', id: p.id, bench: b.id, matched: p.matched });
          return 0.25;
        }
        case 'order': {
          const p = this.plantById(t.plantId);
          if (!p || p.state !== 'ready_order') return 0;
          p.state = 'waiting_mix'; p.t = 0;
          this.counter.queue.push({ plantId: p.id, t: 0 });
          this.scoreAction(ACT.ORDER);
          this.emit({ type: 'ordered', id: p.id });
          return 0.5;
        }
        case 'pickup': {
          const idx = this.counter.ready.findIndex(o => o.plantId === t.plantId);
          if (idx < 0) return 0;
          if (h.carry.length >= this.carryCap()) return 0;
          this.counter.ready.splice(idx, 1);
          h.carry.push({ type: 'mix', plantId: t.plantId });
          h.tasks.unshift({ kind: 'deliver', plantId: t.plantId });
          this.scoreAction(ACT.DELIVER);
          this.emit({ type: 'pickup', id: t.plantId });
          return 0.15;
        }
        case 'deliver': {
          const p = this.plantById(t.plantId);
          const ci = h.carry.findIndex(c => c.type === 'mix' && c.plantId === t.plantId);
          if (!p || ci < 0 || p.state !== 'waiting_mix') { if (ci >= 0) h.carry.splice(ci, 1); return 0; }
          h.carry.splice(ci, 1);
          p.state = 'absorbing'; p.t = 0;
          this.scoreAction(ACT.DELIVER);
          this.emit({ type: 'delivered', id: p.id });
          return 0.35;
        }
        case 'mist': {
          const p = this.plantById(t.plantId);
          if (!p || p.state !== 'special') return 0;
          p.state = 'absorbing'; p.specialDone = true; p.t = p.absorbT || 0;   // B5: resume, don't restart
          p.hearts = Math.min(CFG.heartsMax, p.hearts + 1);
          this.stats.mists++;
          this.scoreAction(ACT.MIST);
          this.emit({ type: 'misted', id: p.id });
          return 0.5;
        }
        case 'checkout': {
          const p = this.plantById(t.plantId);
          if (!p || p.state !== 'billing') return 0;
          const a = ARCH[p.arch];
          const heartFrac = 0.4 + 0.6 * (p.hearts / CFG.heartsMax);
          let pay = CFG.basePay * a.pay * heartFrac * (p.matched ? CFG.colorMatchPay : 1);
          pay = Math.round(pay);
          this.coins += pay;
          this.scoreAction(ACT.CHECKOUT, pay);
          this.served++; this.stats.servedBySpecies[p.species] = (this.stats.servedBySpecies[p.species] || 0) + 1;
          this.stats.servedByArch[p.arch] = (this.stats.servedByArch[p.arch] || 0) + 1;
          // monstera aura: happy checkout cheers all seated plants
          if (p.arch === 'monstera' && p.hearts >= 3) {
            for (const q of this.plants) if (q.bench != null && q.id !== p.id && q.state !== 'leaving' && q.state !== 'gone')
              q.hearts = Math.min(CFG.heartsMax, q.hearts + 1);
            this.emit({ type: 'aura', id: p.id });
          }
          const b = this.benchOf(p);
          if (b) { b.plant = null; b.dirty = true; }
          p.bench = null; p.state = 'leaving'; p.happy = p.hearts >= 3; p.t = 0;
          this.emit({ type: 'paid', id: p.id, pay, hearts: p.hearts });
          return 0.4;
        }
        case 'serenade': {
          const p = this.plantById(t.plantId);
          if (!p || p.bench == null || p.serenadeCd > 0 || p.serenadesLeft <= 0) return 0;
          p.serenadesLeft--;
          p.hearts = Math.min(CFG.heartsMax, p.hearts + CFG.serenadeHearts);
          p.serenadeCd = CFG.serenadeCooldown;
          this.stats.serenades++;
          this.scoreAction(ACT.SERENADE, 6);
          this.emit({ type: 'serenade', id: p.id });
          return 0.7;
        }
        case 'pot': {
          const b = this.benches[t.benchId];
          if (!b || !b.dirty) return 0;
          if (h.carry.length >= this.carryCap()) return 0;
          b.dirty = false; b.needsPot = true;   // out of service until a clean pot returns
          h.carry.push({ type: 'pot' });
          this.emit({ type: 'potpick', bench: b.id });
          // auto-head to wash if no wash task queued and carry full
          return 0.15;
        }
        case 'wash': {
          let n = 0;
          h.carry = h.carry.filter(c => { if (c.type === 'pot') { n++; return false; } return true; });
          if (!n) return 0;
          this.washPending += n;
          for (let k = 0; k < n; k++) this.scoreAction(ACT.WASH, 8);
          this.emit({ type: 'washload', n });
          return 0.3;
        }
      }
      return 0;
    }

    // ================================================== SIM STEP
    update(dt) {
      if (this.over) return;
      // A non-finite or negative dt permanently bricks the sim: time becomes NaN, every
      // comparison against it is false, and nothing can ever terminate. Reject at the door.
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 0.25) dt = 0.25;
      this.time += dt;
      const h = this.hero;

      // spawns
      if (!this.endless) {
        while (this.spawnIdx < this.cfg.spawns.length && this.cfg.spawns[this.spawnIdx].t <= this.time) {
          this.spawnPlant(this.cfg.spawns[this.spawnIdx]); this.spawnIdx++;
        }
      } else {
        if (this.time >= this.nextEndless) {
          // weighted pool: bread-and-butter plants carry the shift; divas stay a spice
          const bag = ['scout','scout','scout','fern','fern','fern','twins','twins','cactus','orchid','venus','monstera'];
          let arch = bag[Math.floor(this.rng() * bag.length)];
          if (arch === 'orchid' && this.lastEndlessArch === 'orchid') arch = 'fern';
          this.lastEndlessArch = arch;
          const sp = SPECIES_BY_ARCH[arch][Math.floor(this.rng() * SPECIES_BY_ARCH[arch].length)];
          this.spawnPlant({ arch, species: sp.id, color: Math.floor(this.rng() * this.cfg.colors) });
          // Old decay needed 90 spawns to reach the floor; runs end at ~65, so the hardest
          // fifth of the curve could never be played. Reaches the floor in ~24 spawns now.
          this.endlessRate = Math.max(6.0, this.endlessRate * 0.975);
          this.nextEndless = this.time + this.endlessRate * (0.75 + this.rng() * 0.5);
        }
      }

      // hero: action lock, then movement toward current task
      if (h.busyT > 0) { h.busyT -= dt; }
      else if (h.tasks.length) {
        const t = h.tasks[0];
        const pos = this.taskPos(t);
        const dx = pos.x - h.x, dy = pos.y - h.y;
        const d = Math.hypot(dx, dy);
        const step = this.heroSpeed() * dt;
        if (d <= Math.max(step, 14)) {
          h.x = pos.x; h.y = pos.y;
          h.tasks.shift();
          h.busyT = this.execTask(t) * this.actionMul();
        } else { h.x += dx / d * step; h.y += dy / d * step; }
      }

      // counter prep
      let active = 0;
      for (const o of this.counter.queue) {
        if (active < this.prepSlots) { o.t += dt; active++; }
        }
      while (this.counter.queue.length && this.counter.queue[0].t >= this.prepTime()) {
        const o = this.counter.queue.shift();
        this.counter.ready.push(o);
        this.emit({ type: 'mixready', id: o.plantId });
      }

      // wash slots
      while (this.washPending > 0 && this.wash.length < this.washSlots) { this.washPending--; this.wash.push({ t: 0 }); }
      for (let i = this.wash.length - 1; i >= 0; i--) {
        this.wash[i].t += dt;
        if (this.wash[i].t >= this.washTime()) {
          this.wash.splice(i, 1); this.stats.washed++;
          // A clean pot goes back to whichever bench has been waiting longest for one; only
          // if none is waiting does it become a spare and re-colour an idle bench.
          const waiting = this.benches.filter(b => b.needsPot);
          const target = waiting.length ? waiting[0]
            : this.benches.filter(b => b.plant == null && !b.dirty)[0];
          if (target) {
            target.needsPot = false;
            target.color = Math.floor(this.rng() * this.cfg.colors);
            this.emit({ type: 'recolor', bench: target.id, color: target.color });
          }
          this.emit({ type: 'washdone' });
        }
      }

      // plants
      const pm = this.patienceMul();
      for (const p of this.plants) {
        if (p.state === 'gone') continue;
        if (p.serenadeCd > 0) p.serenadeCd -= dt;
        const a = ARCH[p.arch];
        // neighbor debuff from venus
        let drainMul = 1;
        if (p.bench != null && p.state !== 'leaving') {
          // B7: non-stacking; applies to every OTHER seated plant, Venus Chompers included
          const anyVenus = this.plants.some(q => q.arch === 'venus' && q.id !== p.id && q.bench != null && q.state !== 'leaving' && q.state !== 'gone');
          if (anyVenus) drainMul = 1.25;
        }
        switch (p.state) {
          case 'queue': {
            p.hearts = Math.min(CFG.heartsMax, p.hearts - CFG.queueDrain * pm * (this.up.bell ? 0.5 : 1) * dt);
            if (p.hearts <= 0) { this.angryLeave(p); }
            break;
          }
          case 'reading': {
            p.t += dt;
            if (p.t >= a.read) { p.state = 'ready_order'; p.t = 0; this.emit({ type: 'wants', id: p.id }); }
            break;
          }
          case 'ready_order': case 'waiting_mix': case 'special': case 'billing': {
            // waiting on player (or kitchen) — hearts drain
            const stateMul = p.state === 'waiting_mix' ? 0.55 : (p.state === 'special' ? 0.6 : 1);
            p.hearts = Math.min(CFG.heartsMax, p.hearts - a.drain * pm * drainMul * dt * stateMul);
            p.t += dt;
            if (p.state === 'special' && p.t > 12) {
              // ignored mist request: plant sighs and resumes absorbing (no bonus, no death spiral)
              // B5: an ignored request must COST something. The first attempt capped p.t at
              // half the absorb duration, which could never bind: the special only rolls just
              // past 0.4 * absorb, so the cap sat above the stashed value for every archetype
              // and ignoring restored full progress - identical to fulfilling it.
              p.state = 'absorbing'; p.specialDone = true;
              p.t = Math.max(0, (p.absorbT || 0) - a.absorb * 0.30);
              this.emit({ type: 'specialmiss', id: p.id });
              break;
            }
            if (p.hearts > 0 && p.hearts < 1.4 && !p.warned) { p.warned = true; this.emit({ type: 'fading', id: p.id }); }
            if (p.hearts <= 0) { this.angryLeave(p); }
            break;
          }
          case 'absorbing': {
            p.t += dt;
            const dur = a.absorb;
            if (!p.specialDone && p.special == null && p.t > dur * 0.4) {
              // roll special once
              p.special = (this.rng() < CFG.specialChance);
              // B5: entering 'special' used to discard absorb progress (p.t = 0). Stash it so
              // fulfilling the request resumes where the plant left off.
              if (p.special) { p.absorbT = p.t; p.state = 'special'; p.t = 0; this.emit({ type: 'special', id: p.id }); break; }
            }
            if (p.t >= dur) { p.state = 'billing'; p.t = 0; this.emit({ type: 'bill', id: p.id }); }
            break;
          }
          case 'leaving': {
            p.t += dt;
            if (p.t > 1.2) p.state = 'gone';
            break;
          }
        }
      }

      // Retire finished plants. 'gone' records were never removed, so plantById (a linear
      // find, called several times per frame) and the per-plant Venus scan both grew without
      // bound in endless. Keep the served counter; drop the record.
      if (this.plants.length > 24) {
        const live = this.plants.filter(p => p.state !== 'gone');
        if (live.length !== this.plants.length) this.plants = live;
      }

      // end conditions
      if (!this.endless) {
        const allSpawned = this.spawnIdx >= this.cfg.spawns.length;
        const allGone = this.plants.every(p => p.state === 'gone') && this.queue.length === 0;
        if (allSpawned && allGone && this.hero.tasks.length === 0) this.finish();
      } else {
        if (this.angryLeaves >= 5) this.finish();
      }
    }

    finish() {
      if (this.over) return;
      this.over = true;
      const g = this.cfg.goals || { one: 0, two: 0, three: 0, expert: 0 };
      let stars = 0;
      if (!this.endless) {
        if (this.score >= g.one) stars = 1;
        if (this.score >= g.two) stars = 2;
        if (this.score >= g.three) stars = 3;
      }
      this.result = {
        score: this.score, coins: this.coins, stars,
        expert: !this.endless && this.score >= g.expert,
        served: this.served, angry: this.stats.angry, maxChain: this.stats.maxChain,
        colorMatches: this.stats.colorMatches, time: this.time,
        stats: this.stats, endless: this.endless,
      };
      this.emit({ type: 'finish', result: this.result });
    }
  }

  // ------------------------------------------------------------- UPGRADES
  const UPGRADES = [
    { id: 'speed',    name: 'Speedy Clogs',      cost: 160, venue: 0, desc: '+25% walking speed.' },
    { id: 'patience', name: 'Moss Cushions',     cost: 220, venue: 0, desc: 'Plants wilt 18% slower.' },
    { id: 'carry',    name: 'Third Arm Trellis', cost: 300, venue: 1, desc: 'Carry a third item, and work 30% faster at each stop.' },
    { id: 'quickmix', name: 'Quick-Mix Blender', cost: 340, venue: 1, desc: 'Mixes prep 25% faster.' },
    { id: 'radio',    name: 'Shop Radio',        cost: 420, venue: 2, desc: 'Chain cap +1, and chains decay instead of breaking.' },
    { id: 'fastwash', name: 'Pressure Rinser',   cost: 280, venue: 2, desc: 'Pots wash 30% faster, and one more basin.' },
    { id: 'decor',    name: 'Prize Terrarium',   cost: 520, venue: 3, desc: 'Décor centerpiece. Wilt 7% slower.' },
    // The ladder used to end at venue 3, leaving ~3,200 coins with nothing to buy across the
    // last seven levels. These three extend the sink and each one feeds a mechanic that the
    // late game actually leans on.
    // Each of these must measurably move a run, or it is the same dead purchase Shop Radio
    // used to be. A fourth carry slot and a fourth prep slot each measured at ~0 alone
    // (the bottleneck is elsewhere), so both carry a second effect that does bind.
    { id: 'apron',    name: 'Deep-Pocket Apron', cost: 620, venue: 3, desc: 'Carry a fourth item, and move 12% quicker.' },
    { id: 'bell',     name: 'Welcome Bell',      cost: 700, venue: 4, desc: 'Plants in the queue wilt half as fast.' },
    { id: 'greenhouse',name:'Ceiling Sprinkler',  cost: 900, venue: 4, desc: 'A fine mist over every bench. Seated plants wilt 15% slower.' },
  ];

  // ---------------------------------------------------------- ACHIEVEMENTS
  const ACHIEVEMENTS = [
    { id: 'first_sprout',  name: 'First Sprout',        desc: 'Serve your first plant.',                   check: s => s.totalServed >= 1 },
    { id: 'ten_green',     name: 'Ten Green Thumbs',    desc: 'Serve 10 plants.',                          check: s => s.totalServed >= 10 },
    { id: 'fifty_fronds',  name: 'Fifty Fronds',        desc: 'Serve 50 plants.',                          check: s => s.totalServed >= 50 },
    { id: 'century_bloom', name: 'Century Bloom',       desc: 'Serve 100 plants.',                         check: s => s.totalServed >= 100 },
    { id: 'chain_3',       name: 'Combo Cutting',       desc: 'Hit a 3-chain.',                            check: s => s.bestChain >= 3 },
    { id: 'chain_5',       name: 'Photosynthesizer',    desc: 'Hit a 4-chain.',                            check: s => s.bestChain >= 4 },
    { id: 'chain_6',       name: 'Radio Star',          desc: 'Hit a 5-chain (Shop Radio).',               check: s => s.bestChain >= 5 },
    { id: 'match_10',      name: 'Coordinated',         desc: '10 pot color matches.',                     check: s => s.colorMatches >= 10 },
    { id: 'match_50',      name: 'Interior Designer',   desc: '50 pot color matches.',                     check: s => s.colorMatches >= 50 },
    { id: 'sing_20',       name: 'Greenhouse Serenade', desc: 'Serenade plants 20 times.',                 check: s => s.serenades >= 20 },
    { id: 'mist_15',       name: 'Mist Opportunity',    desc: 'Fulfill 15 mist requests.',                 check: s => s.mists >= 15 },
    { id: 'wash_40',       name: 'Spotless Pots',       desc: 'Wash 40 pots.',                             check: s => s.washed >= 40 },
    { id: 'no_angry',      name: 'Nobody Wilts',        desc: 'Finish a level with zero angry leaves.',    check: s => s.flags.perfectLevel },
    { id: 'expert_1',      name: 'Master Propagator',   desc: 'Beat any level’s expert score.',       check: s => s.expertCount >= 1 },
    { id: 'expert_5',      name: 'Legendary Green',     desc: 'Beat 5 expert scores.',                     check: s => s.expertCount >= 5 },
    { id: 'stars_12',      name: 'Constellation',       desc: 'Collect 12 stars.',                         check: s => s.totalStars >= 12 },
    { id: 'stars_36',      name: 'Star Garden',         desc: 'Collect 36 stars.',                         check: s => s.totalStars >= 36 },
    { id: 'stars_60',      name: 'Perfect Canopy',      desc: 'All 60 career stars.',                      check: s => s.totalStars >= 60 },
    { id: 'venue_2',       name: 'Glass Ceiling',       desc: 'Reach the Greenhouse.',                     check: s => s.venueReached >= 1 },
    { id: 'venue_5',       name: 'Atrium at Last',      desc: 'Reach the Grand Atrium.',                   check: s => s.venueReached >= 4 },
    { id: 'career_done',   name: 'Family Business',     desc: 'Finish the career.',                        check: s => s.careerDone },
    { id: 'dex_6',         name: 'Budding Botanist',    desc: 'Meet 6 species.',                           check: s => s.speciesMet >= 6 },
    { id: 'dex_12',        name: 'Complete Plantdex',   desc: 'Meet all 12 species.',                      check: s => s.speciesMet >= 12 },
    { id: 'endless_20',    name: 'Evergreen Shift',     desc: 'Serve 20 plants in one Endless run.',       check: s => s.bestEndlessServed >= 20 },
  ];

  // -------------------------------------------------------------- QUESTS
  const QUESTS = [
    { id: 'q_orchids',  name: 'Diva Management',   desc: 'Serve 8 Orchid Divas.',      target: 8,  stat: st => st.servedByArchTotal.orchid || 0 },
    { id: 'q_cactus',   name: 'Elder Care',        desc: 'Serve 12 Cactus Elders.',    target: 12, stat: st => st.servedByArchTotal.cactus || 0 },
    { id: 'q_chain5',   name: 'Rhythm of Repotting', desc: 'Hit a 4-chain.',           target: 1,  stat: st => st.bestChain >= 4 ? 1 : 0 },
    { id: 'q_match25',  name: 'Palette Perfect',   desc: '25 color matches.',          target: 25, stat: st => st.colorMatches },
    { id: 'q_serve60',  name: 'Open For Business', desc: 'Serve 60 plants total.',     target: 60, stat: st => st.totalServed },
    { id: 'q_wash25',   name: 'Rinse & Repeat',    desc: 'Wash 25 pots.',              target: 25, stat: st => st.washed },
  ];

  return {
    CFG, ACT, ARCH, SPECIES, POT_COLORS, VENUES, LEVELS, UPGRADES, ACHIEVEMENTS, QUESTS,
    ARCH_UNLOCK, Level, buildLevel, goalsFor, layoutFor, mulberry32, theoreticalCeiling,
    applyCalibratedGoals,
  };
});
