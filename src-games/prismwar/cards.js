/* Prismwar card set — "Refraction" proof-of-concept set. 60 colored cards (10/color) + 6 Wellsprings + 2 Relics. All names/text original. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.PrismwarCards = factory(root.Prismwar);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P) {
  'use strict';
  const U = (id, name, color, cost, pips, v, r, rarity, kw, flavor) => ({ id, name, color, type: 'Unit', cost, pips, v, r, rarity, kw: kw || {}, flavor });
  const S = (id, name, color, type, cost, pips, effect, n, rarity, flavor) => ({ id, name, color, type, cost, pips, effect, n, rarity, flavor });
  const CARDS = [
    // ---- WHITE — The Order ----
    U('w01', 'Sunward Sentinel', 'W', 1, 1, 2, 2, 'C', { rally: 1 }),
    U('w02', 'Dawn Vestal', 'W', 0, 1, 1, 2, 'C', { guard: 1 }),
    U('w03', 'Chapel Warden', 'W', 2, 1, 2, 3, 'C', { bulwark: 1 }),
    U('w04', 'Banner Marshal', 'W', 2, 2, 3, 3, 'U', { rally: 1, guard: 1 }),
    U('w05', 'Halo Kestrel', 'W', 2, 1, 2, 1, 'C', { drift: 1, rally: 1 }),
    U('w06', 'Oathbound Colossus', 'W', 4, 2, 5, 5, 'R', { bulwark: 1, guard: 1 }),
    U('w07', 'Litany Choir', 'W', 3, 1, 2, 4, 'U', { toll: 1, bulwark: 1 }, 'They sing so the walls remember.'),
    S('w08', 'Absolving Light', 'W', 'Action', 2, 1, 'exileTapped', 0, 'U'),
    S('w09', 'Mending Vow', 'W', 'Action', 1, 1, 'heal', 5, 'C'),
    S('w10', 'Shieldwall Hymn', 'W', 'Bond', 1, 1, 'aura', 2, 'C'),
    // ---- BLUE — The Current ----
    U('u01', 'Tidecaller Adept', 'U', 2, 1, 2, 3, 'C', { drift: 1, foresee: 1 }),
    U('u02', 'Riptide Skimmer', 'U', 1, 1, 2, 1, 'C', { drift: 1 }),
    U('u03', 'Archivist of Depths', 'U', 3, 1, 2, 3, 'U', { foresee: 2 }),
    U('u04', 'Mist Leviathan', 'U', 5, 2, 5, 6, 'R', { drift: 1 }),
    U('u05', 'Current Weaver', 'U', 2, 2, 2, 2, 'U', { foresee: 1, drift: 1 }),
    U('u06', 'Glass Sentry', 'U', 1, 1, 0, 4, 'C', { bulwark: 1 }),
    S('u07', 'Undertow Pull', 'U', 'Reaction', 1, 1, 'bounce', 0, 'C'),
    S('u08', 'Deep Reading', 'U', 'Action', 2, 1, 'draw', 2, 'C'),
    S('u09', 'Tidal Surge', 'U', 'Action', 3, 2, 'draw', 3, 'U'),
    S('u10', 'Veil of Fog', 'U', 'Reaction', 0, 1, 'pump', 2, 'C'),
    // ---- BLACK — The Ledger ----
    U('b01', 'Ashen Collector', 'B', 1, 1, 2, 1, 'C', { reclaim: 1 }),
    U('b02', 'Debt Wraith', 'B', 2, 1, 3, 1, 'C', { wither: 1 }),
    U('b03', 'Ledger Clerk', 'B', 1, 1, 1, 2, 'C', { toll: 1 }),
    U('b04', 'Gravemarch Brute', 'B', 3, 2, 4, 3, 'U', { wither: 1 }),
    U('b05', 'Tithe Reaper', 'B', 4, 2, 4, 4, 'R', { toll: 1, reclaim: 1 }),
    U('b06', 'Bone Auditor', 'B', 2, 2, 2, 2, 'U', { glimpse: 1 }),
    S('b07', 'Debt Called', 'B', 'Action', 1, 2, 'destroy', 0, 'U'),
    S('b08', 'Ledger Rot', 'B', 'Action', 1, 1, 'discard', 2, 'C'),
    S('b09', 'Final Notice', 'B', 'Action', 2, 1, 'damage', 3, 'C'),
    S('b10', 'Pact of Ash', 'B', 'Bond', 2, 1, 'aura', 3, 'U'),
    // ---- RED — The Spark ----
    U('r01', 'Cinder Whelp', 'R', 0, 1, 1, 1, 'C', { swift: 1, reckless: 1 }),
    U('r02', 'Spark Runner', 'R', 1, 1, 2, 1, 'C', { swift: 1 }),
    U('r03', 'Powderkeg Ogre', 'R', 3, 1, 4, 2, 'C', { ignite: 1 }),
    U('r04', 'Gambler\'s Drake', 'R', 2, 2, 2, 2, 'U', { drift: 1, gambit: 1 }),
    U('r05', 'Kiln Titan', 'R', 4, 2, 6, 3, 'R', { trample: 1, ignite: 2 }),
    U('r06', 'Ember Hound', 'R', 1, 2, 3, 1, 'U', { swift: 1, reckless: 1 }),
    S('r07', 'Wildfire Gambit', 'R', 'Reaction', 1, 1, 'damage', 3, 'C'),
    S('r08', 'Scorchline', 'R', 'Action', 0, 1, 'damage', 2, 'C'),
    S('r09', 'Blast Furnace', 'R', 'Action', 3, 2, 'damage', 5, 'U'),
    S('r10', 'Forge Crown', 'R', 'Relic', 3, 0, 'anthem', 1, 'R'),
    // ---- GREEN — The Root ----
    U('g01', 'Sapling Warden', 'G', 0, 1, 1, 1, 'C', { grow: 1 }),
    U('g02', 'Mossback Bear', 'G', 2, 1, 3, 3, 'C', {}),
    U('g03', 'Thornhide Boar', 'G', 2, 2, 4, 2, 'U', { trample: 1 }),
    U('g04', 'Grove Tender', 'G', 1, 1, 1, 1, 'C', { bloom: 1 }),
    U('g05', 'Rootbound Colossus', 'G', 4, 2, 6, 6, 'R', { trample: 1, bloom: 1 }),
    U('g06', 'Canopy Stalker', 'G', 3, 1, 3, 4, 'U', { overrun: 1 }),
    S('g07', 'Wild Overrun', 'G', 'Action', 2, 1, 'fight', 0, 'C'),
    S('g08', 'Deep Roots', 'G', 'Action', 1, 1, 'wellspring', 0, 'C'),
    S('g09', 'Verdant Surge', 'G', 'Action', 2, 1, 'counterGrow', 2, 'C'),
    S('g10', 'Heartwood Idol', 'G', 'Relic', 2, 0, 'regen', 1, 'U'),
    // ---- PURPLE — The Undertow ----
    U('p01', 'Mindthief Wraith', 'P', 3, 1, 2, 2, 'R', { ensnare: 2 }, 'What you hold, it holds now.'),
    U('p02', 'Hush Adept', 'P', 1, 1, 2, 2, 'C', { glimpse: 1 }),
    U('p03', 'Ambush Eel', 'P', 1, 1, 2, 2, 'C', { foretell: 1 }),
    U('p04', 'Twin Lanternfish', 'P', 2, 1, 2, 1, 'C', { bond: 1, drift: 1 }),
    U('p05', 'Undertow Warden', 'P', 2, 2, 2, 3, 'U', { bond: 1, foretell: 1 }),
    U('p06', 'Sovereign of Silt', 'P', 5, 2, 4, 4, 'R', { ensnare: 3, bond: 1 }),
    S('p07', 'Foretold Ruin', 'P', 'Action', 1, 1, 'discard', 1, 'C'),
    S('p08', 'Deep Claim', 'P', 'Action', 3, 2, 'steal', 3, 'U'),
    S('p09', 'Glimpse Beyond', 'P', 'Action', 1, 1, 'draw', 1, 'C'),
    S('p10', 'Silt Shroud', 'P', 'Bond', 1, 1, 'aura', 1, 'C'),
  ];
  // ---------- Generated expansion: 30 more cards per color (deterministic — ids/names/stats never drift) ----------
  const NAMES = {
    W: { adj: ['Sunward', 'Dawnlit', 'Vowkeeper', 'Gilded', 'Steadfast', 'Hallowed', 'Radiant', 'Sworn', 'Bright', 'Lantern', 'Anvil', 'Marble', 'Choral', 'Ivory', 'Pilgrim'], noun: ['Sentinel', 'Warden', 'Herald', 'Paladin', 'Sister', 'Griffin', 'Lancer', 'Abbot', 'Falcon', 'Shieldmaid', 'Cantor', 'Templar', 'Ward', 'Squire', 'Beacon'], spell: ['Vow of Dawn', 'Cleansing Ray', 'Sanctuary Bell', 'Oath of Iron', 'Shining Rebuke', 'Litany of Walls', 'Morning Tithe', 'Aegis Hymn', 'Blessed Rest', 'Rally Call', 'Vigil Lantern', 'Bastion Seal'] },
    U: { adj: ['Tidal', 'Glass', 'Fathom', 'Mistbound', 'Scholar', 'Drifting', 'Brine', 'Ripple', 'Lunar', 'Silt', 'Foam', 'Kelp', 'Archive', 'Undertide', 'Pale'], noun: ['Skimmer', 'Adept', 'Cartographer', 'Serpent', 'Eel', 'Sprite', 'Manta', 'Oracle', 'Diver', 'Squall', 'Lamprey', 'Watcher', 'Chronicler', 'Wisp', 'Kraken'], spell: ['Deep Reading', 'Ebb and Flow', 'Mirror Tide', 'Fog Bank', 'Salt Memory', 'Undertow Lesson', 'Clear Sight', 'Cold Current', 'Ink Veil', 'Lantern Depths', 'Recede', 'Chart the Dark'] },
    B: { adj: ['Ashen', 'Debt', 'Tithe', 'Grave', 'Hollow', 'Ledger', 'Pallid', 'Carrion', 'Bone', 'Toll', 'Rusted', 'Widow', 'Ossuary', 'Bleak', 'Notary'], noun: ['Collector', 'Wraith', 'Clerk', 'Auditor', 'Reaper', 'Ghoul', 'Broker', 'Vulture', 'Bailiff', 'Shade', 'Usurer', 'Marrow', 'Creditor', 'Rat', 'Executor'], spell: ['Final Notice', 'Interest Due', 'Rot Contract', 'Pale Bargain', 'Repossession', 'Marrow Draught', 'Ledger Fire', 'Cold Ledger', 'Unpaid Debt', 'Grave Clause', 'Ash Tithe', 'Last Reckoning'] },
    R: { adj: ['Cinder', 'Spark', 'Kiln', 'Ember', 'Powder', 'Blast', 'Scorch', 'Molten', 'Wild', 'Flint', 'Slag', 'Furnace', 'Rowdy', 'Brimstone', 'Crackling'], noun: ['Whelp', 'Runner', 'Ogre', 'Hound', 'Drake', 'Brawler', 'Imp', 'Raider', 'Salamander', 'Firebrand', 'Wyrmling', 'Pyre', 'Berserker', 'Goblin', 'Charger'], spell: ['Scorchline', 'Powder Flash', 'Kiln Burst', 'Reckless Charge', 'Spark Shower', 'Cinder Toss', 'Ember Rush', 'Furnace Roar', 'Wildfire Lane', 'Flint Strike', 'Slag Rain', 'Brimstone Bet'] },
    G: { adj: ['Rootbound', 'Mossback', 'Thornhide', 'Canopy', 'Sapling', 'Grove', 'Bramble', 'Elder', 'Verdant', 'Loam', 'Fern', 'Timber', 'Heartwood', 'Burrow', 'Wildgrown'], noun: ['Colossus', 'Bear', 'Boar', 'Stalker', 'Warden', 'Tender', 'Elk', 'Treant', 'Wolf', 'Titan', 'Beetle', 'Stag', 'Ent', 'Mantis', 'Aurochs'], spell: ['Deep Roots', 'Verdant Surge', 'Wild Overrun', 'Canopy Growth', 'Bramble Wall', 'Season of Plenty', 'Feral Hunt', 'Loam Blessing', 'Elder Bloom', 'Timberfall', 'Burrow Home', 'Heartwood Vigor'] },
    P: { adj: ['Mindthief', 'Hush', 'Ambush', 'Lantern', 'Undertow', 'Silt', 'Veiled', 'Sovereign', 'Whisper', 'Dusk', 'Covet', 'Riptide', 'Umbral', 'Deepwater', 'Hidden'], noun: ['Wraith', 'Adept', 'Eel', 'Lanternfish', 'Warden', 'Sovereign', 'Anglerfish', 'Siren', 'Thief', 'Octopus', 'Mimic', 'Leech', 'Puppeteer', 'Shadow', 'Nautilus'], spell: ['Foretold Ruin', 'Deep Claim', 'Glimpse Beyond', 'Silt Shroud', 'Covetous Whisper', 'Undertow Grasp', 'Stolen Hour', 'Dusk Bargain', 'Veil of Silt', 'Mind Ledger', 'Hidden Tithe', 'Pull Under'] },
  };
  const KWS = { W: ['guard', 'rally', 'bulwark', 'drift', 'toll'], U: ['drift', 'foresee', 'bulwark', 'glimpse'], B: ['wither', 'reclaim', 'toll', 'glimpse'], R: ['swift', 'reckless', 'ignite', 'gambit', 'trample'], G: ['grow', 'bloom', 'trample', 'overrun'], P: ['ensnare', 'glimpse', 'foretell', 'bond', 'drift'] };
  const SPELLS = { W: [['Action', 'heal', 3, 6], ['Action', 'exileTapped', 0, 0], ['Bond', 'aura', 1, 3], ['Reaction', 'pump', 1, 3], ['Relic', 'regen', 1, 2]], U: [['Action', 'draw', 1, 3], ['Reaction', 'bounce', 0, 0], ['Reaction', 'pump', 1, 3], ['Action', 'discard', 1, 1]], B: [['Action', 'destroy', 0, 0], ['Action', 'discard', 1, 2], ['Action', 'damage', 2, 4], ['Bond', 'aura', 2, 3]], R: [['Action', 'damage', 1, 5], ['Reaction', 'damage', 2, 3], ['Relic', 'anthem', 1, 1], ['Reaction', 'pump', 2, 3]], G: [['Action', 'fight', 0, 0], ['Action', 'wellspring', 0, 0], ['Action', 'counterGrow', 1, 3], ['Relic', 'regen', 1, 2], ['Bond', 'aura', 2, 3]], P: [['Action', 'discard', 1, 2], ['Action', 'steal', 2, 3], ['Action', 'draw', 1, 2], ['Bond', 'aura', 1, 2], ['Reaction', 'bounce', 0, 0]] };
  const KW_COST = { drift: 1, swift: 1, trample: 1, guard: 0.5, rally: 0.5, bulwark: 1, reckless: -1, bond: 0.5, ignite: 1, gambit: 0.5, grow: 1.5, bloom: 0.5, toll: 0.5, foresee: 1, glimpse: 1, reclaim: 1, wither: 0.5, overrun: 1.5, ensnare: 2, foretell: 0.5 };
  const SPELL_SPEND = { damage: n => n * 1.2 + 0.5, draw: n => n * 1.6, pump: n => n * 0.8 + 0.3, heal: n => n * 0.5, discard: n => n * 1.6, steal: n => 4 + n * 1.5, counterGrow: n => n * 1.2, aura: n => n * 1.6 + 0.5, anthem: n => 5 + n * 2, regen: n => 3 + n * 1.5, exileTapped: () => 4, destroy: () => 6.5, bounce: () => 3.5, fight: () => 5, wellspring: () => 3 };
  function gprng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const RARITY_SEQ = 'CCUCCUCRCCUCCUCRCCUCCUCRCCUCSU'; // 30 slots: 16 C, 9 U, 4 R, 1 S (per color)
  const SPLIT = { W: 0.5, U: 0.4, B: 0.55, R: 0.62, G: 0.45, P: 0.48 }; // share of the stat budget that goes to Vigor
  const usedNames = new Set(CARDS.map(c => c.name));
  for (const col of Object.keys(P.COLORS)) {
    const r = gprng(0x5eed + col.charCodeAt(0) * 7919); const nm = NAMES[col]; let spellIdx = 0;
    for (let i = 0; i < 30; i++) {
      const id = col.toLowerCase() + String(11 + i).padStart(2, '0'); const rarity = RARITY_SEQ[i]; const isUnit = i % 3 !== 2; // 20 units, 10 spells per color
      if (isUnit) {
        let name; do { name = nm.adj[Math.floor(r() * nm.adj.length)] + ' ' + nm.noun[Math.floor(r() * nm.noun.length)]; } while (usedNames.has(name)); usedNames.add(name);
        let mana = 1 + Math.floor(r() * (rarity === 'S' ? 3 : 6)) + (rarity === 'S' ? 4 : rarity === 'R' ? 1 : 0);
        const nk = rarity === 'C' ? (r() < 0.6 ? 1 : 0) : rarity === 'U' ? 1 : 2; const kw = {}; const pool = KWS[col].slice(); for (let k = 0; k < nk && pool.length; k++) { const kk = pool.splice(Math.floor(r() * pool.length), 1)[0]; kw[kk] = ['ignite', 'foresee', 'ensnare'].includes(kk) ? (rarity === 'C' ? 1 : 2) : 1; }
        let kwc = 0; for (const [k, n] of Object.entries(kw)) { kwc += KW_COST[k]; if (['ignite', 'foresee', 'ensnare'].includes(k)) kwc += (n - 1) * 1.5; }
        while (mana * 2 + 1.5 - (rarity === 'C' ? 0.5 : 0) - kwc < 2) mana++; // keywords must leave room for a body
        const pips = mana >= 4 && r() < 0.5 ? 2 : 1; const cost = Math.max(0, mana - pips);
        const budget = mana * 2 + 1.5 - (rarity === 'C' ? 0.5 : 0); let stats = Math.max(2, Math.floor(budget - kwc)); let v = Math.max(0, Math.round(stats * SPLIT[col])); let rr = Math.max(1, stats - v); if (v > 9) v = 9; if (rr > 9) rr = 9;
        CARDS.push({ id, name, color: col, type: 'Unit', cost, pips, v, r: rr, rarity, kw, gen: true });
      } else {
        const t = SPELLS[col][spellIdx % SPELLS[col].length]; spellIdx++; const [type, effect, lo, hi] = t; const n = lo + Math.floor(r() * (hi - lo + 1));
        let name; do { name = nm.spell[Math.floor(r() * nm.spell.length)] + (r() < 0.5 ? '' : ' ' + ['II', 'of Old', 'Unbound', 'Renewed'][Math.floor(r() * 4)]); } while (usedNames.has(name)); usedNames.add(name);
        const spend = SPELL_SPEND[effect](n); let mana = Math.max(type === 'Relic' ? 2 : 1, Math.ceil((spend - 1.5) / 2)); const pips = type === 'Relic' ? 0 : (mana >= 3 && r() < 0.4 ? 2 : 1); const cost = Math.max(0, mana - pips);
        CARDS.push({ id, name, color: col, type, cost, pips, effect, n, rarity, gen: true });
      }
    }
  }
  // ---------- Ascendants — 10 locked legendaries, unlockable only by owner-signed redeem codes ----------
  const ASC = (id, name, color, cost, pips, loyalty, plus, minus, static_, flavor) => ({ id, name, color, type: 'Ascendant', cost, pips, loyalty, plus, minus, static: static_, rarity: 'L', flavor });
  const ASCENDANTS = [
    ASC('a01', 'Seraphel, the Unbroken', 'W', 4, 2, 5, { effect: 'heal', n: 3 }, { cost: 3, effect: 'exileTapped', n: 0 }, { anthem: 1 }, 'The walls held because she did.'),
    ASC('a02', 'Marshal Oren Dawnvow', 'W', 3, 2, 4, { effect: 'pump', n: 2 }, { cost: 4, effect: 'counterGrow', n: 3 }, null, 'Every banner he raised is still flying.'),
    ASC('a03', 'Ysolde of the Fathoms', 'U', 4, 2, 5, { effect: 'draw', n: 1 }, { cost: 4, effect: 'bounce', n: 0 }, null, 'She read the tide before it turned.'),
    ASC('a04', 'The Drowned Archivist', 'U', 5, 2, 6, { effect: 'draw', n: 2 }, { cost: 5, effect: 'discard', n: 2 }, null, 'Every page it kept, someone lost.'),
    ASC('a05', 'Auditor-Prime Vexmoor', 'B', 4, 2, 5, { effect: 'discard', n: 1 }, { cost: 3, effect: 'destroy', n: 0 }, null, 'The ledger balances. It always balances.'),
    ASC('a06', 'Kalder, Kiln-Emperor', 'R', 5, 2, 5, { effect: 'damage', n: 2 }, { cost: 5, effect: 'damage', n: 6 }, { anthem: 1 }, 'He does not forge. He unmakes.'),
    ASC('a07', 'Brannoch the Wildfire', 'R', 3, 2, 4, { effect: 'pump', n: 3 }, { cost: 2, effect: 'damage', n: 3 }, null, 'Run with him, or run from him.'),
    ASC('a08', 'Old Heartwood, Awakened', 'G', 5, 2, 7, { effect: 'wellspring', n: 0 }, { cost: 3, effect: 'fight', n: 0 }, { regen: 1 }, 'The forest remembers every axe.'),
    ASC('a09', 'The Sovereign Below', 'P', 5, 2, 5, { effect: 'discard', n: 1 }, { cost: 4, effect: 'steal', n: 4 }, null, 'It does not take. It collects.'),
    ASC('a10', 'Nyx Halloway, Tidebinder', 'P', 4, 2, 5, { effect: 'draw', n: 1 }, { cost: 3, effect: 'steal', n: 2 }, null, 'Yours, until she says otherwise.'),
  ];
  for (const a of ASCENDANTS) CARDS.push(a);
  // Signature (mythic-analog) tier — upgrade one card per color
  for (const id of ['w06', 'u04', 'b05', 'r05', 'g05', 'p06']) CARDS.find(c => c.id === id).rarity = 'S';
  const WELLSPRINGS = Object.keys(P.COLORS).map(c => ({ id: 'ws_' + c, name: P.COLORS[c] + ' Wellspring', color: c, type: 'Wellspring', cost: 0, pips: 0, rarity: 'C' }));
  // ---------- Flavor text — hand-written for the core cards, pooled per color for the expansion (deterministic by id) ----------
  const FLAVOR = {
    W: ['The wall is people. It always was.', 'She counted the dawns; the dawns counted her back.', 'Oaths do not rust.', 'A bell rung once is a promise kept.', 'Stand close. Stand longer.', 'Light does not argue.', 'Every banner is a debt to the ones beneath it.', 'The choir sings so the masons can sleep.', 'Small hands, held together, are a gate.', 'Marble remembers the chisel.', 'Rest is a formation too.', 'The morning does not ask permission.'],
    U: ['The tide keeps every receipt.', 'Read the current before it reads you.', 'Fog is a door for those who know its hinges.', 'What sinks is not lost; it is filed.', 'Salt teaches patience to stone.', 'The depths do not hurry, and they are never late.', 'A chart is a rumor with confidence.', 'Ink dries. Water does not.', 'Every wave is a question the shore must answer.', 'Cold makes the mind honest.', 'The archive is deeper than the sea.', 'Listen: the undertow is counting.'],
    B: ['Interest accrues in the dark.', 'The ledger balances. It always balances.', 'Death is a late fee.', 'Nothing is free; some things are simply unpaid.', 'He signed with a bone.', 'The vultures keep better books than the bankers.', 'Every debt finds its debtor.', 'Marrow is a currency too.', 'The clerk never sleeps; the clerk never forgets.', 'Ash is what remains when the bill is settled.', 'Grief, compounded quarterly.', 'A contract outlives its hands.'],
    R: ['Run with it, or run from it.', 'Ask forgiveness from the ashes.', 'The kiln does not negotiate.', 'Flint remembers every strike.', 'Louder. Faster. Hotter. Again.', 'A spark has no plan and needs none.', 'Slag is just gold that lost the argument.', 'Heat is honesty with the volume up.', 'Bet everything; the coin is already spinning.', 'The furnace roars so the smith need not.', 'Wildfire does not read the map.', 'Some doors only open once, and loudly.'],
    G: ['The forest remembers every axe.', 'Roots argue slowly and always win.', 'Moss keeps what stone forgets.', 'Grow toward the light, or become it.', 'The oldest law is hunger.', 'Thorns are how the garden says no.', 'Season by season, the mountain kneels.', 'Bloom first. Ask later.', 'The canopy hides more than it shades.', 'Loam is patient; loam is winning.', 'Antlers are a promise made to spring.', 'Every seed is a siege engine.'],
    P: ['What you hold, it holds now.', 'Yours, until she says otherwise.', 'The undertow does not take. It collects.', 'A secret weighs exactly one breath.', 'It knew your hand before you drew it.', 'Whisper it twice and it belongs to someone else.', 'The lanterns lie about the depth.', 'Ambush is just patience with teeth.', 'Silt settles on everything eventually, even names.', 'Covet quietly. Take loudly.', 'Below the below, something is listening.', 'The tide came in and left with the keys.'],
  };
  const FLAVOR_CORE = { w01: 'First at the wall, last to sit.', w02: 'Her lantern is the shape of a vow.', w06: 'The keep is a rumor; he is the fact.', u02: 'It rides the wave it is.', u04: 'Ships have prayed to it by mistake.', b01: 'Everything is worth something to someone dead.', b02: 'It was owed. It is owed. It collects.', b05: 'The tithe is due. The tithe is always due.', r01: 'Small. Angry. Correct.', r05: 'The kiln walked. Nobody said no.', g01: 'Give it a year and a name.', g05: 'Older than the road it is standing on.', p01: 'Your thought. Its hand.', p03: 'You will not see it. That is the point.', p06: 'The court beneath the court.' };
  function fhash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  for (const c of CARDS) if (!c.flavor) c.flavor = FLAVOR_CORE[c.id] || (FLAVOR[c.color] ? FLAVOR[c.color][fhash(c.id + c.name) % FLAVOR[c.color].length] : '');

  const ALL = CARDS.concat(WELLSPRINGS);
  for (const c of ALL) c.text = cardText(c);
  P.registerCards(ALL);

  function cardText(c) {
    if (c.type === 'Wellspring') return `Tap: add one ${c.color} mana.`;
    if (c.type === 'Ascendant') { const st = c.static ? Object.entries(c.static).map(([k, n]) => (k === 'anthem' ? `Your units get +${n}/+0.` : `Start of your turn: gain ${n} life.`)).join(' ') + ' ' : ''; return `${st}Loyalty ${c.loyalty}. +1: ${P.EFFECTS[c.plus.effect].desc.replace('N', c.plus.n)} −${c.minus.cost}: ${P.EFFECTS[c.minus.effect].desc.replace('N', c.minus.n)} Loses 1 loyalty whenever you take combat damage.`; }
    if (c.type === 'Unit') return Object.entries(c.kw).map(([k, n]) => cap(k) + (['ignite', 'foresee', 'ensnare'].includes(k) ? ' ' + n : '') + ' — ' + P.KEYWORDS[k].replace('N', n)).join(' ');
    const e = P.EFFECTS[c.effect]; return e ? e.desc.replace('N', c.n) : '';
  }
  function cap(s) { return s[0].toUpperCase() + s.slice(1); }

  // ---------- STARTERS — 8 decks, COMMONS ONLY, 40 cards (24 spells as 12 unique ×2 + 16 Wellsprings). The Rival plays these too. ----------
  const commons = col => CARDS.filter(c => c.color === col && c.rarity === 'C' && c.type !== 'Wellspring' && c.type !== 'Ascendant').sort((a, b) => a.id.localeCompare(b.id));
  const cost = c => (c.cost || 0) + (c.pips || 0);
  /* plan.curve = wanted unit count per mana cost 1..6; plan.spells = wanted non-unit cards; a unit/spell is used at ×2. */
  function buildStarter(name, colors, blurb, plan) {
    const pool = colors.flatMap(commons); const units = pool.filter(c => c.type === 'Unit'); const spells = pool.filter(c => c.type !== 'Unit');
    const picked = []; const takeFrom = (arr, n) => { for (const c of arr) { if (n <= 0) break; if (!picked.includes(c)) { picked.push(c); n--; } } };
    plan.curve.forEach((n, i) => takeFrom(units.filter(c => cost(c) === i + 1).sort((a, b) => (plan.prefer ? (plan.prefer(b) - plan.prefer(a)) : 0) || a.id.localeCompare(b.id)), n));
    takeFrom(spells.sort((a, b) => (plan.prefer ? (plan.prefer(b) - plan.prefer(a)) : 0) || a.id.localeCompare(b.id)), plan.spells);
    while (picked.length < 12) takeFrom(units.sort((a, b) => cost(a) - cost(b)), 1); // backfill if a curve slot was empty
    const deck = picked.slice(0, 12).flatMap(c => [c.id, c.id]); const ws = 40 - deck.length; for (let i = 0; i < ws; i++) deck.push('ws_' + colors[i % colors.length]);
    return { colors, deck, blurb, color: colors[0], archetype: plan.arch };
  }
  const has = (c, k) => c.kw && c.kw[k] !== undefined ? 1 : 0;
  const STARTERS = {
    'Order Vanguard': buildStarter('Order Vanguard', ['W'], 'Go wide and hold the line. Rally buffs the swarm, Guard keeps your blockers standing.', { arch: 'Aggro-wide', curve: [3, 3, 2, 1, 0, 0], spells: 3, prefer: c => has(c, 'rally') * 2 + has(c, 'guard') }),
    'Current Tempo': buildStarter('Current Tempo', ['U'], 'Fliers and card draw. Chip in with Drift while you out-draw the Rival.', { arch: 'Tempo', curve: [1, 3, 2, 2, 1, 0], spells: 3, prefer: c => has(c, 'drift') * 2 + has(c, 'foresee') + (c.effect === 'draw' ? 2 : 0) }),
    'Ledger Attrition': buildStarter('Ledger Attrition', ['B'], 'Trade everything. Wither punishes blocks, Reclaim brings the bodies back.', { arch: 'Grind', curve: [2, 3, 2, 1, 1, 0], spells: 3, prefer: c => has(c, 'wither') * 2 + has(c, 'reclaim') + (c.effect === 'destroy' || c.effect === 'discard' ? 1 : 0) }),
    'Spark Rush': buildStarter('Spark Rush', ['R'], 'Swift attackers and burn to the face. Win before turn eight or not at all.', { arch: 'Aggro-burn', curve: [3, 2, 2, 2, 0, 0], spells: 3, prefer: c => has(c, 'swift') * 2 + has(c, 'ignite') + (c.effect === 'damage' ? 2 : 0) }),
    'Root Ramp': buildStarter('Root Ramp', ['G'], 'Bloom into extra Wellsprings and drop the biggest bodies in the set.', { arch: 'Ramp', curve: [1, 2, 2, 2, 1, 1], spells: 3, prefer: c => has(c, 'bloom') * 2 + has(c, 'grow') + has(c, 'trample') }),
    'Undertow Thieves': buildStarter('Undertow Thieves', ['P'], 'Glimpse their hand, ambush with Foretell, and take what is theirs with Ensnare.', { arch: 'Disruption', curve: [1, 3, 2, 2, 1, 0], spells: 3, prefer: c => has(c, 'ensnare') * 3 + has(c, 'foretell') + has(c, 'glimpse') + (c.effect === 'steal' ? 3 : 0) }),
    'Dawnfire Rush': buildStarter('Dawnfire Rush', ['W', 'R'], 'Order bodies with Spark speed. Rally and Swift end games early.', { arch: 'Aggro (two-color)', curve: [3, 3, 2, 1, 0, 0], spells: 3, prefer: c => has(c, 'swift') * 2 + has(c, 'rally') * 2 + (c.effect === 'damage' ? 1 : 0) }),
    'Tidegrove': buildStarter('Tidegrove', ['G', 'U'], 'Root muscle, Current brains. Ramp into fat units and keep the cards flowing.', { arch: 'Midrange (two-color)', curve: [1, 2, 2, 2, 1, 1], spells: 3, prefer: c => has(c, 'bloom') + has(c, 'trample') + has(c, 'drift') + (c.effect === 'draw' ? 2 : 0) }),
  };
  const PRECONS = STARTERS; // the Rival plays the same commons-only decks the player can start with
  const SET = CARDS.filter(c => c.type !== 'Ascendant'); // the collectible pool (packs, craft)
  return { CARDS, SET, ASCENDANTS, WELLSPRINGS, ALL, PRECONS, STARTERS, cardText, FLAVOR };
});
