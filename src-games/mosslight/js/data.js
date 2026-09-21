/* MOSSLIGHT — data tables. Pure data, no DOM, no timers. All names original. */
(function (ML) {
  'use strict';

  ML.VERSION = '0.3.0';
  ML.SAVE_KEY = 'mosslight.save.v1';
  ML.COLORS = ['plain', 'red', 'blue', 'green', 'yellow', 'purple'];
  ML.COLOR_LABEL = { plain: 'Plain', red: 'Ember', blue: 'Frost', green: 'Thorn', yellow: 'Storm', purple: 'Hex' };
  ML.AILMENT_OF = { red: 'burn', blue: 'chill', green: 'poison', yellow: 'shock', purple: 'curse' };
  ML.AILMENT_LABEL = { burn: 'Burn', chill: 'Chill', poison: 'Poison', shock: 'Shock', curse: 'Curse' };
  ML.RARITY = ['Common', 'Uncommon', 'Rare', 'Superb', 'Mythic'];
  ML.RARITY_MULT = [1, 1.3, 1.7, 2.3, 3.2];
  ML.RARITY_WEIGHT = [640, 240, 90, 25, 5];

  /* ---------- Curves: every tunable number lives here (game-dev:economy owns the families) ---------- */
  ML.CURVES = {
    tick: 0.1,
    // adventurers: linear-plus-mild-compound hybrid (L = area level)
    advResolve0: 11, advResolveLin: 0.34, advResolveC: 1.06,
    advAtk0: 1.55, advAtkLin: 0.3, advAtkC: 1.06,
    advExp0: 8, advExpLin: 0.24, advExpC: 1.03,
    advGold0: 1.8, advGoldLin: 0.2, advGoldC: 1.028,
    captainResolve: 5.5, captainAtk: 1.45, captainReward: 6,
    gildedChance: 1 / 140, gildedReward: 60, gildedLinger: 9,
    // healer
    xpBase: 39, xpExp: 1.62,
    healBase: 1.5, healPerGrace: 0.85, healPerLevel: 0.22,
    manaBase: 20, manaPerSpirit: 3, manaRegenBase: 1.4, manaRegenPerSpirit: 0.11,
    tempoK: 0.012, critBase: 0.05, critPerFortune: 0.004, critCap: 0.6, critMult: 1.8,
    wardDefAura: 0.45,
    // vigor (overheal -> attack)
    vigorCapFrac: 0.5, vigorAtkK: 2.0, vigorDecay: 0.035,
    // companions
    compLvHp: 0.13, compLvAtk: 0.11, compRankMult: 0.28, compBondMult: 0.04,
    compXpBase: 30, compXpExp: 1.5,
    bondBase: 400, bondExp: 1.55,
    trustRanks: [4, 24, 110, 420, 1500, 5200],
    downRecover: 0.35,
    // renown (guild analogue)
    renownBase: 320, renownExp: 1.72,
    // gear
    gearDrop: 0.011, gearDropCaptain: 0.12, gearProfBase: 45, gearProfGrowth: 1.5, gearMaxLevel: 10, gearPerLevel: 0.1,
    invSize: 24, groundCap: 30,
    // offline
    offlineEff: 0.5, offlineCapH: 12, offlineMinS: 60,
    // sabbatical
    sabbaticalLevel: 50, goldCap0: 25000,
    matSplit: 0.25,   // share of a road's material payout that is spread over the region's OTHER two materials, so one road can never drought a region
    strayEvery: 3, strayWound0: 14, strayWoundLin: 0.3
  };

  /* ---------- Healer stats ---------- */
  ML.STATS = [
    { id: 'grace', name: 'Grace', blurb: 'Heal power. Every mend lands harder; overheal becomes Vigor sooner.' },
    { id: 'spirit', name: 'Spirit', blurb: 'Mana pool and mana regeneration. More songs per fight.' },
    { id: 'ward', name: 'Ward', blurb: 'Shield strength, plus a defence aura for every companion on the line.' },
    { id: 'tempo', name: 'Tempo', blurb: 'Shortens every cooldown.' },
    { id: 'fortune', name: 'Fortune', blurb: 'Critical mends (chance tops out at 60%) and better odds that raiders drop gifts.' }
  ];

  /* ---------- Skills (class: Hedge Warden) ---------- */
  ML.SKILLS = [
    { id: 'mend', name: 'Mend', level: 1, cd: 1.3, mana: 0, kind: 'heal', power: 1.0, cost0: 30, growth: 1.22,
      blurb: 'Heal the companion who needs it most. Free. Heals past full become Vigor.',
      passives: [{ at: 150, text: '+4% heal power (all skills)', eff: { healPct: 0.04 } }, { at: 1500, text: '+6% heal power', eff: { healPct: 0.06 } }, { at: 9000, text: '+10% Vigor cap', eff: { vigorCap: 0.1 } }] },
    { id: 'bloomwave', name: 'Bloomwave', level: 5, cd: 6, mana: 8, kind: 'aoe', power: 1.1, cost0: 120, growth: 1.24,
      blurb: 'A ring of petals heals the whole line.',
      passives: [{ at: 60, text: '+10% mana regeneration', eff: { manaRegenPct: 0.1 } }, { at: 600, text: '+5% heal power', eff: { healPct: 0.05 } }, { at: 3500, text: 'Bloomwave also grants 5% shield', eff: { bloomShield: 0.05 } }] },
    { id: 'dew', name: 'Renewing Dew', level: 10, cd: 8, mana: 6, kind: 'hot', power: 0.6, dur: 8, cost0: 300, growth: 1.24,
      blurb: 'Heals a little every second for 8 seconds.',
      passives: [{ at: 60, text: '+8 max mana', eff: { manaFlat: 8 } }, { at: 600, text: 'Dew lasts 3 seconds longer', eff: { dewDur: 3 } }, { at: 3500, text: '+8% heal power', eff: { healPct: 0.08 } }] },
    { id: 'barkskin', name: 'Barkskin', level: 16, cd: 11, mana: 10, kind: 'shield', power: 4.0, cost0: 800, growth: 1.25,
      blurb: 'Wraps whoever is in most danger in bark that soaks damage — the front of the line when everyone is healthy.',
      passives: [{ at: 50, text: '+6% companion defence', eff: { compDefPct: 0.06 } }, { at: 500, text: '+15% shield strength', eff: { shieldPct: 0.15 } }, { at: 3000, text: 'Barkskin also covers the second in line', eff: { barkTwo: 1 } }] },
    { id: 'purify', name: 'Purify', level: 24, cd: 5, mana: 5, kind: 'cleanse', power: 0.5, cost0: 2200, growth: 1.25,
      blurb: 'Lifts Burn, Chill, Poison, Shock and Curse, with a small heal.',
      passives: [{ at: 50, text: 'Ailments on your line last 15% less', eff: { ailmentDur: -0.15 } }, { at: 500, text: '+5% heal power', eff: { healPct: 0.05 } }, { at: 3000, text: 'Purify cleanses the whole line', eff: { purifyAll: 1 } }] },
    { id: 'rally', name: 'Rally Hymn', level: 32, cd: 22, mana: 15, kind: 'rally', power: 0.5, dur: 7, cost0: 6000, growth: 1.26,
      blurb: 'Every companion strikes harder for 7 seconds.',
      passives: [{ at: 30, text: '+5% companion attack', eff: { compAtkPct: 0.05 } }, { at: 300, text: 'Rally lasts 3 seconds longer', eff: { rallyDur: 3 } }, { at: 2000, text: '+10% companion attack', eff: { compAtkPct: 0.1 } }] }
  ];
  ML.COFFER_BASE = 1.5;
  ML.SKILL_RANK_BONUS = 0.08;   // linear benefit per rank vs exponential cost -> cost family dominates
  ML.SKILL_MAX_RANK = 60;

  /* ---------- Gold upgrades (Provisions) — exponential cost, linear benefit ---------- */
  ML.UPGRADES = [
    { id: 'poultice', name: 'Better Poultices', eff: 'healPct', per: 0.03, cost0: 25, growth: 1.19, max: 150, blurb: '+3% heal power per level.' },
    { id: 'feed', name: 'Hearty Feed', eff: 'compHpPct', per: 0.03, cost0: 40, growth: 1.2, max: 150, blurb: '+3% companion health per level.' },
    { id: 'claws', name: 'Whetted Claws', eff: 'compAtkPct', per: 0.03, cost0: 60, growth: 1.2, max: 150, blurb: '+3% companion attack per level.' },
    { id: 'satchel', name: 'Deeper Satchel', eff: 'goldPct', per: 0.04, cost0: 80, growth: 1.22, max: 120, blurb: '+4% coin from fleeing raiders per level.' },
    { id: 'journal', name: 'Field Journal', eff: 'expPct', per: 0.03, cost0: 100, growth: 1.23, max: 120, blurb: '+3% experience per level.' },
    { id: 'coffer', name: 'Iron Coffer', eff: 'cofferLevels', per: 1, cost0: 400, growth: 1.45, max: 60, blurb: 'Coin cap ×1.5 per level, compounding — it always outgrows its own price.' },
    { id: 'wellspring', name: 'Wellspring', eff: 'manaRegenPct', per: 0.04, cost0: 250, growth: 1.24, max: 100, blurb: '+4% mana regeneration per level.' }
  ];

  /* ---------- Companions (befriended monsters). klass = the "pet class" system ---------- */
  ML.KLASS = {
    bulwark: { name: 'Bulwark', blurb: 'Draws single-target attacks wherever it stands, and takes 20% less damage.' },
    striker: { name: 'Striker', blurb: 'Hits 25% harder. Loves Vigor.' },
    mender: { name: 'Mender', blurb: 'Every attack also mends the most hurt ally, but hits 40% softer.' },
    forager: { name: 'Forager', blurb: 'Frail, but raiders drop 15% more while it is on the line.' }
  };
  ML.SPECIES = [
    { id: 'mossling', name: 'Mossling', region: 0, color: 'plain', klass: 'bulwark', form: 'blob', hp: 30, atk: 2.1, aspd: 0.8, def: 1,
      passive: { eff: 'goldPct', per: 0.03, text: 'coin' }, flavor: 'A patient lump of moss that hums when it rains.' },
    { id: 'pebblit', name: 'Pebblit', region: 0, color: 'plain', klass: 'forager', form: 'crab', hp: 22, atk: 1.6, aspd: 1.0, def: 2,
      passive: { eff: 'dropPct', per: 0.04, text: 'gift drop chance' }, active: { id: 'fetch', rank: 2, name: 'Fetch', text: 'Gathers every drop the moment it lands and digs up 20% more materials.' }, flavor: 'Collects shiny things. Returns most of them.' },
    { id: 'thistlehog', name: 'Thistlehog', region: 0, color: 'green', klass: 'striker', form: 'beast', hp: 26, atk: 3.0, aspd: 1.1, def: 0.5,
      passive: { eff: 'compAtkPct', per: 0.025, text: 'companion attack' }, flavor: 'All bristle, no malice. Mostly.' },
    { id: 'glowmoth', name: 'Glowmoth', region: 0, color: 'yellow', klass: 'mender', form: 'flyer', hp: 20, atk: 1.8, aspd: 1.2, def: 0.3,
      passive: { eff: 'manaRegenPct', per: 0.03, text: 'mana regeneration' }, active: { id: 'lamplight', rank: 2, name: 'Lamplight', text: 'Keeps watch while you are away: +10% offline gains.' }, flavor: 'Its wings hold the last light of the evening.' },
    { id: 'emberpup', name: 'Emberpup', region: 1, color: 'red', klass: 'striker', form: 'beast', hp: 120, atk: 13, aspd: 1.15, def: 3,
      passive: { eff: 'critPct', per: 0.01, text: 'critical mend chance' }, flavor: 'Warm to the touch. Do not let it on the bedding.' },
    { id: 'slagback', name: 'Slagback', region: 1, color: 'red', klass: 'bulwark', form: 'tortoise', hp: 210, atk: 8, aspd: 0.7, def: 8,
      passive: { eff: 'compHpPct', per: 0.03, text: 'companion health' }, flavor: 'Carries a cooled lava flow on its back, and a grudge.' },
    { id: 'sootwisp', name: 'Sootwisp', region: 1, color: 'purple', klass: 'mender', form: 'wisp', hp: 95, atk: 9, aspd: 1.2, def: 2,
      passive: { eff: 'healPct', per: 0.025, text: 'heal power' }, flavor: 'A breath of chimney smoke that learned to care.' },
    { id: 'cindermole', name: 'Cindermole', region: 1, color: 'yellow', klass: 'forager', form: 'mole', hp: 100, atk: 8, aspd: 1.0, def: 5,
      passive: { eff: 'matPct', per: 0.05, text: 'building materials' }, active: { id: 'prospect', rank: 2, name: 'Prospect', text: 'Surveys every ward: shows coin, experience and clear time per area.' }, flavor: 'Knows where everything is buried. Will not say why.' },
    { id: 'frostfinch', name: 'Frostfinch', region: 2, color: 'blue', klass: 'striker', form: 'flyer', hp: 420, atk: 52, aspd: 1.3, def: 8,
      passive: { eff: 'tempoFlat', per: 2, text: 'Tempo' }, active: { id: 'courier', rank: 2, name: 'Courier', text: 'Runs errands for the villagers: every villager request needs 25% less.' }, flavor: 'Sings one note. It is a very good note.' },
    { id: 'glimmereel', name: 'Glimmereel', region: 2, color: 'blue', klass: 'mender', form: 'serpent', hp: 380, atk: 36, aspd: 1.1, def: 10,
      passive: { eff: 'hotPct', per: 0.05, text: 'Renewing Dew strength' }, flavor: 'Swims through mist as if it were water.' },
    { id: 'prismstag', name: 'Prismstag', region: 2, color: 'purple', klass: 'bulwark', form: 'stag', hp: 780, atk: 34, aspd: 0.75, def: 26,
      passive: { eff: 'shieldPct', per: 0.05, text: 'shield strength' }, flavor: 'Its antlers split the dawn into six colours.' },
    { id: 'dewsprite', name: 'Dewsprite', region: 2, color: 'green', klass: 'forager', form: 'wisp', hp: 330, atk: 30, aspd: 1.1, def: 9,
      passive: { eff: 'expPct', per: 0.03, text: 'experience' }, flavor: 'Rides a single drop of water everywhere it goes.' }
  ];

  /* ---------- Raiders (adventurers). They never die: at 0 Resolve they flee. ---------- */
  ML.RAIDERS = [
    { id: 'squire', name: 'Squire', color: 'plain', hp: 1.0, atk: 1.0, aspd: 0.9, range: 'melee', target: 'front', blurb: 'Honest sword, honest nerves.' },
    { id: 'pyro', name: 'Pyre Adept', color: 'red', hp: 0.8, atk: 0.85, aspd: 0.7, range: 'ranged', target: 'front', blurb: 'Leaves Burn: damage over time.' },
    { id: 'frostarcher', name: 'Rime Archer', color: 'blue', hp: 0.75, atk: 0.9, aspd: 0.85, range: 'ranged', target: 'back', blurb: 'Always shoots whoever stands last in your line. Chill slows attacks.' },
    { id: 'cutpurse', name: 'Cutpurse', color: 'green', hp: 0.7, atk: 0.7, aspd: 1.5, range: 'melee', target: 'front', blurb: 'Fast blades. Poison stacks three times.' },
    { id: 'stormcaller', name: 'Stormcaller', color: 'yellow', hp: 0.9, atk: 0.55, aspd: 0.55, range: 'ranged', target: 'all', blurb: 'Strikes the whole line. Shock: +20% damage taken.' },
    { id: 'hexer', name: 'Hexer', color: 'purple', hp: 0.85, atk: 0.8, aspd: 0.65, range: 'ranged', target: 'front', blurb: 'Curse: healing received is cut by 40%.' }
  ];

  /* ---------- Regions and areas ---------- */
  ML.REGIONS = [
    { id: 'hollow', name: 'Mossbell Hollow', mats: ['fieldstone', 'alderwood', 'dewglass'], raiders: ['squire', 'cutpurse', 'pyro'], levels: [1, 2, 3, 4, 5, 6, 7, 9], waystone: 0,
      blurb: 'A quiet dell of bell-shaped moss. Raiders come for bounties on its gentle folk.' },
    { id: 'cinder', name: 'Cinder Steps', mats: ['basalt', 'charwood', 'emberglass'], raiders: ['squire', 'pyro', 'stormcaller', 'cutpurse', 'hexer'], levels: [11, 13, 16, 19, 22, 25, 28, 32], waystone: 5,
      blurb: 'Terraces of warm black rock. Guild parties hunt here for ember pelts.' },
    { id: 'glassmere', name: 'Glassmere', mats: ['icestone', 'silverbirch', 'mirrorglass'], raiders: ['frostarcher', 'hexer', 'stormcaller', 'squire', 'pyro', 'cutpurse'], levels: [38, 43, 49, 55, 62, 69, 77, 86], waystone: 11,
      blurb: 'A frozen lake that remembers every face. Veteran companies only.' }
  ];
  ML.MATS = {
    fieldstone: 'Fieldstone', alderwood: 'Alderwood', dewglass: 'Dewglass', basalt: 'Basalt', charwood: 'Charwood', emberglass: 'Emberglass',
    icestone: 'Icestone', silverbirch: 'Silverbirch', mirrorglass: 'Mirrorglass'
  };
  ML.AREA_NAMES = [
    ['Bellmoss Gate', 'Snailbridge', 'The Old Stump', 'Fernwalk', 'Puddle Court', 'Thistle Rise', 'Lantern Root', 'Heart of the Hollow'],
    ['First Step', 'Ashen Stair', 'Kiln Terrace', 'Smoulder Walk', 'The Warm Shelf', 'Slag Garden', 'Cinder Crown', 'The Forge Mouth'],
    ['Thin Ice', 'Mirror Shallows', 'Hoarfrost Reeds', 'The Still Eye', 'Pale Causeway', 'Echo Floe', 'Starlit Sheet', 'The Deep Glass']
  ];
  ML.AREAS = [];
  ML.REGIONS.forEach(function (r, ri) {
    r.levels.forEach(function (lv, ai) {
      var native = ML.SPECIES.filter(function (s) { return s.region === ri; });
      ML.AREAS.push({
        id: r.id + (ai + 1), region: ri, index: ai, name: ML.AREA_NAMES[ri][ai], level: lv,
        mat: r.mats[ai % 3], stray: native[ai % native.length].id,
        raiders: r.raiders.slice(0, Math.min(r.raiders.length, 1 + Math.ceil((ai + 1) / 2) + (ri > 0 ? 1 : 0))),
        partyMax: Math.min(4, 1 + Math.floor((ai + 2) / 3) + (ri > 0 ? 1 : 0)),
        timeGoal: 75 + ai * 6 + ri * 20
      });
    });
  });
  ML.AREA_BY_ID = {}; ML.AREAS.forEach(function (a, i) { a.order = i; ML.AREA_BY_ID[a.id] = a; });
  ML.SPECIES_BY_ID = {}; ML.SPECIES.forEach(function (s) { ML.SPECIES_BY_ID[s.id] = s; });
  ML.RAIDER_BY_ID = {}; ML.RAIDERS.forEach(function (s) { ML.RAIDER_BY_ID[s.id] = s; });
  ML.SKILL_BY_ID = {}; ML.SKILLS.forEach(function (s) { ML.SKILL_BY_ID[s.id] = s; });
  ML.UPGRADE_BY_ID = {}; ML.UPGRADES.forEach(function (s) { ML.UPGRADE_BY_ID[s.id] = s; });

  /* ---------- Gear (gifts). Mastery is ACCOUNT-WIDE by design (player feedback on the original) ---------- */
  ML.GEAR_SLOTS = [{ id: 'focus', name: 'Focus' }, { id: 'vestment', name: 'Vestment' }, { id: 'charm1', name: 'Charm' }, { id: 'charm2', name: 'Charm' }];
  ML.GEAR = [
    { id: 'hazelwand', name: 'Hazel Wand', slot: 'focus', region: 0, eff: { healPct: 0.08 }, mastery: { healPct: 0.02 } },
    { id: 'bellstaff', name: 'Bellmoss Staff', slot: 'focus', region: 0, eff: { healPct: 0.05, manaFlat: 6 }, mastery: { manaFlat: 3 } },
    { id: 'wovencloak', name: 'Woven Cloak', slot: 'vestment', region: 0, eff: { manaFlat: 10 }, mastery: { manaFlat: 3 } },
    { id: 'gardenapron', name: 'Garden Apron', slot: 'vestment', region: 0, eff: { compHpPct: 0.08 }, mastery: { compHpPct: 0.02 } },
    { id: 'acorncharm', name: 'Acorn Charm', slot: 'charm', region: 0, eff: { goldPct: 0.1 }, mastery: { goldPct: 0.03 } },
    { id: 'snailshell', name: 'Spiral Shell', slot: 'charm', region: 0, eff: { expPct: 0.08 }, mastery: { expPct: 0.02 } },
    { id: 'emberrod', name: 'Ember Rod', slot: 'focus', region: 1, eff: { healPct: 0.16, critPct: 0.03 }, mastery: { healPct: 0.03 } },
    { id: 'kilnstaff', name: 'Kiln Staff', slot: 'focus', region: 1, eff: { healPct: 0.1, compAtkPct: 0.1 }, mastery: { compAtkPct: 0.03 } },
    { id: 'ashmantle', name: 'Ash Mantle', slot: 'vestment', region: 1, eff: { manaFlat: 20, manaRegenPct: 0.1 }, mastery: { manaRegenPct: 0.03 } },
    { id: 'slagplate', name: 'Slag Tabard', slot: 'vestment', region: 1, eff: { compHpPct: 0.16, shieldPct: 0.1 }, mastery: { compHpPct: 0.03 } },
    { id: 'coalheart', name: 'Coalheart Locket', slot: 'charm', region: 1, eff: { compAtkPct: 0.14 }, mastery: { compAtkPct: 0.03 } },
    { id: 'sootbead', name: 'Soot Beads', slot: 'charm', region: 1, eff: { tempoFlat: 8 }, mastery: { tempoFlat: 2 } },
    { id: 'rimesceptre', name: 'Rime Sceptre', slot: 'focus', region: 2, eff: { healPct: 0.3, critPct: 0.05 }, mastery: { healPct: 0.04 } },
    { id: 'mirrorcrook', name: 'Mirror Crook', slot: 'focus', region: 2, eff: { healPct: 0.2, hotPct: 0.25 }, mastery: { hotPct: 0.05 } },
    { id: 'hoarcoat', name: 'Hoarfrost Coat', slot: 'vestment', region: 2, eff: { manaFlat: 40, shieldPct: 0.2 }, mastery: { shieldPct: 0.04 } },
    { id: 'reedwrap', name: 'Reedwoven Wrap', slot: 'vestment', region: 2, eff: { compHpPct: 0.28 }, mastery: { compHpPct: 0.04 } },
    { id: 'starsliver', name: 'Star Sliver', slot: 'charm', region: 2, eff: { expPct: 0.2, goldPct: 0.2 }, mastery: { expPct: 0.03 } },
    { id: 'echopearl', name: 'Echo Pearl', slot: 'charm', region: 2, eff: { dropPct: 0.25, critPct: 0.04 }, mastery: { dropPct: 0.05 } }
  ];
  ML.GEAR_BY_ID = {}; ML.GEAR.forEach(function (g) { ML.GEAR_BY_ID[g.id] = g; });

  ML.EFF_LABEL = {
    healPct: ['heal power', '%'], compHpPct: ['companion health', '%'], compAtkPct: ['companion attack', '%'], compDefPct: ['companion defence', '%'],
    goldPct: ['coin', '%'], expPct: ['experience', '%'], goldCapPct: ['coin cap', '%'], manaRegenPct: ['mana regeneration', '%'], manaFlat: ['max mana', ''],
    critPct: ['critical mend chance', '%'], dropPct: ['gift drop chance', '%'], matPct: ['building materials', '%'], tempoFlat: ['Tempo', ''],
    hotPct: ['Renewing Dew strength', '%'], shieldPct: ['shield strength', '%'], trustPct: ['Trust gained', '%'], insightPct: ['Insight gained', '%'],
    offlinePct: ['offline gains', '%'], vigorCap: ['Vigor cap', '%'], renownPct: ['Renown gained', '%'], startLevel: ['starting level', ''], bonusPoints: ['bonus stat points', ''],
    bondPct: ['Bond gained', '%'], profPct: ['gift proficiency', '%']
  };

  // Weight per unit of effect, used ONLY to rank gifts for "Wear best". Percent effects are weighted per 1.0 (i.e. per 100%),
  // flats per point. These are ranking weights, never game numbers — nothing reads them during a fight.
  ML.EFF_SCORE = {
    healPct: 120, compHpPct: 70, compAtkPct: 80, compDefPct: 45, goldPct: 55, expPct: 65, goldCapPct: 15, manaRegenPct: 50,
    manaFlat: 1.2, critPct: 95, dropPct: 40, matPct: 40, tempoFlat: 8, hotPct: 45, shieldPct: 45, trustPct: 40, insightPct: 40,
    offlinePct: 35, vigorCap: 55, renownPct: 30, bondPct: 25, profPct: 30
  };
  ML.MASTERY_FLOOR = 0.5;   // an unmastered gift is only preferred while it is worth at least half the strongest option: mastery is permanent, a wipe of your line is not

  /* ---------- Shop (coin): offerings by colour raise Trust from tended strays ---------- */
  ML.OFFERING_COST = { plain: 20, green: 60, yellow: 60, red: 400, purple: 500, blue: 2500 };
  ML.OFFERING_NAME = { plain: 'Oat Cake', green: 'Clover Bundle', yellow: 'Honey Drop', red: 'Warm Coal', purple: 'Dusk Berry', blue: 'Snow Plum' };
  ML.OFFERING_MULT = 4;

  /* ---------- Renown abilities (guild analogue) ---------- */
  ML.RENOWN = [
    { id: 'wellread', name: 'Well Read', eff: 'expPct', per: 0.05, max: 20, blurb: '+5% experience per point.' },
    { id: 'bounty', name: 'Grateful Villagers', eff: 'goldPct', per: 0.06, max: 20, blurb: '+6% coin per point.' },
    { id: 'kinship', name: 'Kinship', eff: 'trustPct', per: 0.1, max: 20, blurb: '+10% Trust from tended strays per point.' },
    { id: 'herbal', name: 'Herbal Lore', eff: 'healPct', per: 0.04, max: 25, blurb: '+4% heal power per point.' },
    { id: 'stonework', name: 'Stonework', eff: 'matPct', per: 0.08, max: 20, blurb: '+8% building materials per point.' },
    { id: 'fame', name: 'Spreading Word', eff: 'renownPct', per: 0.05, max: 20, blurb: '+5% Renown gained per point.' }
  ];

  /* ---------- Sanctuary grounds (town analogue): level costs materials; rank raises the cap by 10 ---------- */
  ML.GROUNDS = [
    { id: 'lantern', name: 'Lantern Post', renown: 3, mats: [0, 1], eff: 'expPct', per: 0.04, blurb: 'A light the lost can walk toward. +4% experience per level.' },
    { id: 'waystone', name: 'Waystone', renown: 4, mats: [0, 2], eff: 'goldPct', per: 0.03, blurb: 'Marks safe roads. +3% coin per level. Level 5 opens Cinder Steps; level 11 opens Glassmere — past the cap of 10, so it needs two Keystones: hold the finales of the Hollow and the Steps.' },
    { id: 'burrows', name: 'The Burrows', renown: 5, mats: [1, 2], eff: 'trustPct', per: 0.05, blurb: 'Warm dens for friends. +5% Trust per level. Level 1: second line slot. Level 8: third. Level 10: third helper slot.' },
    { id: 'garden', name: 'Herb Garden', renown: 7, mats: [0, 1], eff: 'manaRegenPct', per: 0.03, blurb: '+3% mana regeneration per level.' },
    { id: 'chapel', name: 'Wayside Chapel', renown: 10, mats: [1, 2], eff: 'insightPct', per: 0.05, blurb: 'A place to think. +5% Insight from Sabbaticals per level.' },
    { id: 'strongroom', name: 'Strongroom', renown: 6, mats: [0, 2], eff: 'goldCapPct', per: 0.35, k: 2,
      blurb: 'Coin cap +35% per level. Built from materials, not coin — the one cap lever you can raise while your purse is already full.' }
  ];
  ML.GROUND_BASE_CAP = 10; ML.GROUND_RANK_CAP = 10; ML.GROUND_MAX_RANK = 3; ML.KEYSTONES_PER_RANK = 2;

  /* ---------- Sabbatical (prestige T1) upgrades, bought with Insight ---------- */
  ML.INSIGHT = [
    { id: 'study', name: 'Deep Study', eff: 'expPct', per: 0.25, cost0: 2, growth: 1.6, max: 25, blurb: '+25% experience per level.' },
    { id: 'hands', name: 'Practised Hands', eff: 'healPct', per: 0.15, cost0: 2, growth: 1.6, max: 25, blurb: '+15% heal power per level.' },
    { id: 'purse', name: 'Open Purse', eff: 'goldPct', per: 0.2, cost0: 2, growth: 1.6, max: 25, blurb: '+20% coin per level.' },
    { id: 'headstart', name: 'Head Start', eff: 'startLevel', per: 4, cost0: 4, growth: 1.8, max: 8, blurb: 'Begin each Sabbatical 4 levels higher per level.' },
    { id: 'gifted', name: 'Gifted', eff: 'bonusPoints', per: 3, cost0: 5, growth: 1.9, max: 10, blurb: '+3 stat points at the start of every cycle per level.' },
    { id: 'closefriends', name: 'Close Friends', eff: 'bondPct', per: 0.3, cost0: 3, growth: 1.7, max: 15, blurb: '+30% Bond gained per level.' },
    { id: 'deeppockets', name: 'Deep Pockets', eff: 'goldCapPct', per: 0.5, cost0: 3, growth: 1.7, max: 12,
      blurb: 'Coin cap +50% per level. Permanent, and it survives every Sabbatical.' },
    { id: 'attuned', name: 'Attuned Gifts', eff: 'profPct', per: 0.3, cost0: 3, growth: 1.7, max: 15, blurb: '+30% gift proficiency per level.' }
  ];
  ML.SABBATICAL_KEEP = ['Coin, materials, offerings and Keystones (and every region finale yields a fresh Keystone each cycle)', 'Every companion: Trust rank, level and Bond', 'Skill ranks, proficiency and passives', 'Gift mastery (shared by every healer, forever)', 'Provisions, Renown, Sanctuary grounds', 'Lantern Motes, store purchases, Titles and the Ledger', 'Areas you have opened'];
  ML.SABBATICAL_LOSE = ['Healer level and spent stat points (you re-spend them)', 'Gift proficiency levels that have not reached mastery', 'Villager requests (they reset so you can earn them again)'];

  /* ---------- Lantern Mote store (earned only — there is no purchase path) ---------- */
  ML.STORE = [
    { id: 'favorites', name: 'Standing Requests', cost: 300, max: 1, blurb: 'Villager requests and daily rounds are accepted and claimed for you.' },
    { id: 'autosab', name: 'Auto-Sabbatical', cost: 900, max: 1, blurb: 'Take a Sabbatical automatically at a level you choose.' },
    { id: 'queue', name: 'Longer Queue', cost: 120, growth: 1.6, max: 8, blurb: '+2 slots in the Provisions queue.' },
    { id: 'satchels', name: 'Gift Satchel', cost: 150, growth: 1.5, max: 8, blurb: '+6 gift inventory slots.' },
    { id: 'nightwatch', name: 'Night Watch', cost: 250, growth: 1.7, max: 5, blurb: '+10% offline gains and +2 hours offline cap.' },
    { id: 'extradaily', name: 'Busy Noticeboard', cost: 400, growth: 2, max: 2, blurb: '+1 daily round.' },
    { id: 'autoscrap', name: 'Tidy Satchel', cost: 200, max: 1, blurb: 'Automatically unpick gifts below a rarity you choose.' }
  ];

  /* ---------- Quests ---------- */
  // Global chain = the tutorial. Each entry: what, why (one line, shown on unlock), test, reward, reveals tab.
  ML.GLOBAL_QUESTS = [
    { id: 'g1', name: 'First Light', client: 'Old Tansy', text: 'Your Mossling is taking a beating out there. Put 1 stat point into Grace so your mends land harder. You gain a point every level.', cond: 'Put 1 point into Grace', test: { stat: 'grace', n: 1 }, reward: { exp: 130 }, why: 'Grace is heal power — the one number that decides whether your line holds.' },
    { id: 'g2', name: 'Hold the Line', client: 'Old Tansy', text: 'Raiders come in ten waves. Outlast them all and the path is safe for a while. They flee when their Resolve runs out — nobody here gets killed.', cond: 'Clear Bellmoss Gate once', test: { clears: 1 }, reward: { gold: 60, tab: 'skills' }, why: 'Clearing an area opens the next one and pays coin, experience and materials.' },
    { id: 'g3', name: 'A Second Verse', client: 'Old Tansy', text: 'Practise Mend until it is second nature. Coin buys ranks; every cast earns proficiency toward permanent passives.', cond: 'Raise Mend to rank 2', test: { skillRank: ['mend', 2] }, reward: { exp: 200, tab: 'upgrades' }, why: 'Skill ranks are the cheapest early power. Proficiency passives stay forever.' },
    { id: 'g4', name: 'Small Comforts', client: 'Bram the Carter', text: 'Provisions are bought with coin and last through every Sabbatical. Right-click one to queue it and it buys itself when you can afford it.', cond: 'Buy any Provision', test: { anyUpgrade: 1 }, reward: { gold: 120, flag: 'autoAllot', upgrade: ['coffer', 1] }, why: 'Reward: Auto-allot and your first Iron Coffer level. Your stat points can spend themselves from now on.' },
    { id: 'g5', name: 'The Stray', client: 'Pip', text: 'Hurt creatures crawl in between waves. When your line is safe you tend them on your own. Tending a stray earns its Trust.', cond: 'Tend 1 stray', test: { strays: 1 }, reward: { offering: ['plain', 6], tab: 'companions' }, why: 'Trust becomes Rank. Rank 1 means a new friend who can stand on your line.' },
    { id: 'g6', name: 'Gifts Left Behind', client: 'Bram the Carter', text: 'Raiders drop things when they run. Wear what they leave: gifts grow with use, and at level 10 their mastery bonus is yours forever, for every healer.', cond: 'Equip a gift', test: { equipped: 1 }, reward: { gold: 200, tab: 'shop' }, why: 'Mastery is shared and permanent. You never level the same gift twice.' },
    { id: 'g7', name: 'A New Friend', client: 'Pip', text: 'Offerings from the shop multiply the Trust a stray gives. Match the offering to the creature’s colour.', cond: 'Befriend a second species', test: { befriended: 2 }, reward: { exp: 900 }, why: 'Every befriended species adds a passive bonus even while it rests at home.' },
    { id: 'g8', name: 'Word Gets Around', client: 'Reeve Marlow', text: 'The villages are talking about the healer in the Hollow. Renown rises with everything you do, and each level gives a point to spend until every ability is full.', cond: 'Reach Renown 3', test: { renown: 3 }, reward: { mats: 25, tab: 'sanctuary' }, why: 'Renown gates the Sanctuary’s buildings.' },
    { id: 'g9', name: 'A Light to Walk Toward', client: 'Reeve Marlow', text: 'Build the Lantern Post. Buildings cost materials, which drop in the area named on each area’s card.', cond: 'Lantern Post level 1', test: { ground: ['lantern', 1] }, reward: { motes: 100 }, why: 'Buildings last through every Sabbatical.' },
    { id: 'g10', name: 'Two Abreast', client: 'Pip', text: 'Dig the Burrows and a second friend can stand beside the first.', cond: 'The Burrows level 1', test: { ground: ['burrows', 1] }, reward: { exp: 2500 }, why: 'A second companion doubles your damage and gives you someone to triage.' },
    { id: 'g11', name: 'Daily Rounds', client: 'Reeve Marlow', text: 'The noticeboard changes each morning. Rounds pay Lantern Motes — the only way to get them. There is nothing to buy with real money here.', cond: 'Finish a daily round', test: { dailies: 1 }, reward: { motes: 150, tab: 'store' }, why: 'Motes buy automation. Standing Requests (villager requests accept and claim themselves) is a good first choice.' },
    { id: 'g12', name: 'Past the Hollow', client: 'Reeve Marlow', text: 'Raise the Waystone to level 5 and the road to Cinder Steps opens. Expect fire — and Burn. Purify arrives at level 24.', cond: 'Waystone level 5', test: { ground: ['waystone', 5] }, reward: { motes: 200 }, why: 'New regions mean new companions, gifts and materials.' },
    { id: 'g13', name: 'Know When to Rest', client: 'Old Tansy', text: 'At level 50 you may take a Sabbatical. You start over at level 1, but wiser: Insight buys permanent growth. The Sabbatical tab lists exactly what you keep and lose.', cond: 'Reach healer level 50', test: { level: 50 }, reward: { motes: 200, tab: 'sabbatical' }, why: 'The second climb is much faster than the first.' },
    { id: 'g14', name: 'Sabbatical', client: 'Old Tansy', text: 'Go on. The Hollow will keep.', cond: 'Take your first Sabbatical', test: { sabbaticals: 1 }, reward: { motes: 500 }, why: 'Insight upgrades multiply everything.' },
    { id: 'g15', name: 'The Frozen Road', client: 'Reeve Marlow', text: 'Glassmere lies beyond the Steps. Rime Archers always shoot whoever stands last, so keep an eye on the back of the line.', cond: 'Waystone level 11', test: { ground: ['waystone', 11] }, reward: { motes: 300 }, why: 'Glassmere companions are an order of magnitude stronger.' }
  ];

  ML.TITLE_QUESTS = [
    { id: 't_hands1', name: 'Steady Hands', cond: 'Heal 5,000 health in total', test: { healed: 5000 }, reward: { slot: 1 }, text: '+1 skill slot' },
    { id: 'thands2', name: 'Steadier Hands', cond: 'Heal 250,000 health in total', test: { healed: 250000 }, reward: { slot: 1 }, text: '+1 skill slot' },
    { id: 'thands3', name: 'Unshakeable Hands', cond: 'Heal 10,000,000 health in total', test: { healed: 1e7 }, reward: { slot: 1 }, text: '+1 skill slot' },
    { id: 'tfriend', name: 'Friend of the Hollow', cond: 'All four Hollow species at Rank 2', test: { regionRank: [0, 2] }, reward: { eff: { trustPct: 0.25 } }, text: '+25% Trust gained' },
    { id: 'tfriend2', name: 'Friend of the Steps', cond: 'All four Cinder species at Rank 2', test: { regionRank: [1, 2] }, reward: { eff: { compAtkPct: 0.15 } }, text: '+15% companion attack' },
    { id: 'tunbroken', name: 'Unbroken', cond: 'Clear 40 areas with no companion downed', test: { flawless: 40 }, reward: { eff: { compHpPct: 0.1 } }, text: '+10% companion health' },
    { id: 'trouter', name: 'Rout Master', cond: 'Send 2,500 raiders home', test: { fledTotal: 2500 }, reward: { accept: 2 }, text: '+2 requests at once' },
    { id: 'tgilded', name: 'Gilded Eye', cond: 'Send 5 Gilded raiders home', test: { gilded: 5 }, reward: { eff: { goldPct: 0.2 } }, text: '+20% coin' },
    { id: 'tmaster', name: 'Keeper of Gifts', cond: 'Master 6 different gifts', test: { mastered: 6 }, reward: { charm2: 1 }, text: 'Second Charm slot' },
    { id: 'tverse', name: 'Overflowing', cond: 'Turn 50,000 overheal into Vigor', test: { overheal: 50000 }, reward: { eff: { vigorCap: 0.15 } }, text: '+15% Vigor cap' }
  ];

  // General (villager requests): generated per region, reset each Sabbatical.
  ML.GENERAL_TEMPLATES = [
    { key: 'rout', n: [25, 120, 500], text: function (n, who) { return 'Send ' + n + ' ' + who + ' home'; } },
    { key: 'tend', n: [3, 12, 40], text: function (n) { return 'Tend ' + n + ' strays'; } },
    { key: 'clear', n: [5, 20, 60], text: function (n, where) { return 'Clear ' + where + ' ' + n + ' times'; } }
  ];

  ML.GENERAL_KEYS = {}; ML.REGIONS.forEach(function (r) { [r.id + ':tend:any', r.id + ':clear:' + r.id + '4', r.id + ':clear:' + r.id + '8'].concat(r.raiders.slice(0, 3).map(function (c) { return r.id + ':rout:' + c; })).forEach(function (k) { ML.GENERAL_KEYS[k] = true; }); });

  ML.DAILY_TEMPLATES = [
    { key: 'rout', base: 120, text: function (n) { return 'Send ' + n + ' raiders home'; } },
    { key: 'clear', base: 12, text: function (n) { return 'Clear any area ' + n + ' times'; } },
    { key: 'tend', base: 5, text: function (n) { return 'Tend ' + n + ' strays'; } },
    { key: 'heal', base: 1, text: function (n) { return 'Heal ' + ML.fmt(n) + ' health'; } }
  ];
  ML.DAILY_RARITY = [{ name: 'Common', w: 60, motes: 20, mult: 1 }, { name: 'Uncommon', w: 20, motes: 30, mult: 1.5 }, { name: 'Rare', w: 15, motes: 40, mult: 2 }, { name: 'Superb', w: 4, motes: 60, mult: 3 }, { name: 'Mythic', w: 1, motes: 100, mult: 4 }];

  /* ---------- The Warden's Ledger: visible progression spine. Each entry pays Motes and says WHY it matters. ---------- */
  ML.LEDGER = [
    { id: 'l_start', cond: 'Begin', motes: 100, test: { always: 1 }, why: 'Welcome. The fight runs by itself. Your job is everything else. The first fight usually goes badly, and that is fine — follow the Story request.' },
    { id: 'l_area2', cond: 'Open Snailbridge', motes: 50, test: { areaOpen: 'hollow2' }, why: 'Each area names the material it drops. You will want all three kinds for buildings.' },
    { id: 'l_lv10', cond: 'Reach healer level 10', motes: 50, test: { level: 10 }, why: 'Renewing Dew unlocks here: one cast keeps healing for 8 seconds, and every drop of it counts toward Bond, Titles and daily rounds.' },
    { id: 'l_vigor', cond: 'Turn 500 overheal into Vigor', motes: 50, test: { overheal: 500 }, why: 'Healing a full-health companion is never wasted: it becomes Vigor — up to +100% attack at first, more once you raise the Vigor cap. Strong heals clear areas faster.' },
    { id: 'l_friend', cond: 'Befriend a second species', motes: 80, test: { befriended: 2 }, why: 'Three tracks per friend: Trust sets Rank (and the level cap, 10 per rank), fighting raises Level, your heals raise Bond.' },
    { id: 'l_gear', cond: 'Equip your first gift', motes: 50, test: { equipped: 1 }, why: 'Two copies of a gift? Unpick the worse one for coin. Mastery only needs to happen once per gift type.' },
    { id: 'l_master', cond: 'Master a gift', motes: 100, test: { mastered: 1 }, why: 'Mastery bonuses are permanent and shared. After mastery, swap in something new.' },
    { id: 'l_renown5', cond: 'Reach Renown 5', motes: 60, test: { renown: 5 }, why: 'The Burrows opens. A second line slot is the biggest single jump in the early game.' },
    { id: 'l_helper', cond: 'Bring a friend to Rank 2', motes: 80, test: { anyRank: 2 }, why: 'Some friends learn a Helper at Rank 2 — automation like gathering drops or claiming requests. Helpers work from home.' },
    { id: 'l_mission', cond: 'Finish 5 area feats', motes: 60, test: { missions: 5 }, why: 'Each area has three feats: flawless, fast, and faithful (25 clears). They pay Motes.' },
    { id: 'l_renown10', cond: 'Reach Renown 10', motes: 80, test: { renown: 10 }, why: 'The Wayside Chapel opens. It multiplies Insight from every Sabbatical — build it before your first.' },
    { id: 'l_cinder', cond: 'Open Cinder Steps', motes: 120, test: { region: 1 }, why: 'Raiders here carry ailments. The coloured pip above a companion shows what it suffers; Purify lifts it.' },
    { id: 'l_gilded', cond: 'Send a Gilded raider home', motes: 80, test: { gilded: 1 }, why: 'Gilded raiders are rare, barely fight, and leave a fortune — but they wander off if you are slow.' },
    { id: 'l_lv32', cond: 'Reach healer level 32', motes: 80, test: { level: 32 }, why: 'Rally Hymn completes your songbook. You have more skills than slots now: Titles grant more slots.' },
    { id: 'l_three', cond: 'Field three companions', motes: 120, test: { line: 3 }, why: 'A Bulwark draws single-target attacks from anywhere on the line. Rime Archers always shoot whoever stands last, and Stormcallers hit everyone. Foragers trade safety for income.' },
    { id: 'l_sab1', cond: 'Take a Sabbatical', motes: 200, test: { sabbaticals: 1 }, why: 'Spend Insight on Deep Study first. Your second climb to 50 should take a fraction of the time.' },
    { id: 'l_sab3', cond: 'Take 3 Sabbaticals', motes: 200, test: { sabbaticals: 3 }, why: 'Auto-Sabbatical in the Mote store can run this loop for you while the game is open (it does not run while you are away).' },
    { id: 'l_glass', cond: 'Open Glassmere', motes: 200, test: { region: 2 }, why: 'Rime Archers shoot whoever stands last, Bulwark or not. Put something sturdy there, or keep Dew on it.' },
    { id: 'l_rank4', cond: 'Bring a friend to Rank 4', motes: 150, test: { anyRank: 4 }, why: 'Rank multiplies everything about a companion, and its home passive too.' },
    { id: 'l_all', cond: 'Befriend all twelve species', motes: 400, test: { befriended: 12 }, why: 'Every species, even at home, lends its passive. A full bestiary is the best long-term investment you can make.' },
    { id: 'l_deep', cond: 'Clear The Deep Glass', motes: 500, test: { areaClear: 'glassmere8' }, why: 'You have seen every road this build offers. Feats, Titles, mastery and deeper Sabbaticals remain.' }
  ];

  /* ---------- Tabs (left column). `lock` text is what the padlock tooltip says. ---------- */
  ML.TABS = [
    { id: 'quests', name: 'Requests', lock: '' },
    { id: 'healer', name: 'Healer', lock: '' },
    { id: 'skills', name: 'Songbook', lock: 'Clear Bellmoss Gate' },
    { id: 'upgrades', name: 'Provisions', lock: 'Raise Mend to rank 2' },
    { id: 'gear', name: 'Gifts', lock: 'A raider has to drop one first' },
    { id: 'companions', name: 'Friends', lock: 'Tend a stray' },
    { id: 'shop', name: 'Shop', lock: 'Equip a gift' },
    { id: 'sanctuary', name: 'Sanctuary', lock: 'Reach Renown 3' },
    { id: 'world', name: 'Roads', lock: '' },
    { id: 'sabbatical', name: 'Sabbatical', lock: 'Reach healer level 50' },
    { id: 'store', name: 'Mote Store', lock: 'Finish a daily round' },
    { id: 'ledger', name: 'Ledger', lock: '' },
    { id: 'settings', name: 'Settings', lock: '' }
  ];

  /* ---------- Number formatting ---------- */
  var SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  ML.fmt = function (n, dp) {
    if (typeof n !== 'number' || !isFinite(n)) return '0';
    var neg = n < 0; n = Math.abs(n);
    var out;
    if (ML.NOTATION === 'sci' && n >= 1e6) out = n.toExponential(2).replace('+', '');
    else if (n < 1000) { out = (dp != null ? n.toFixed(dp) : (n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n)))); }
    else {
      var e = Math.floor(Math.log10(n) / 3);
      if (e < SUF.length) { var m = n / Math.pow(1000, e); out = (m < 100 ? m.toFixed(2) : m.toFixed(1)) + SUF[e]; }
      else out = n.toExponential(2).replace('+', '');
    }
    return (neg ? '-' : '') + out;
  };
  ML.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
    return h ? h + 'h ' + m + 'm' : m ? m + 'm ' + r + 's' : r + 's';
  };
  ML.fmtEff = function (key, v) {
    var l = ML.EFF_LABEL[key] || [key, ''];
    return '+' + (l[1] === '%' ? ML.fmt(v * 100, (v * 100) % 1 ? 1 : 0) + '%' : ML.fmt(v)) + ' ' + l[0];
  };
})(globalThis.ML = globalThis.ML || {});
