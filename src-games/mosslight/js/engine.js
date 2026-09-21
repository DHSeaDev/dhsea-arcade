/* MOSSLIGHT — engine. No DOM, no timers, no window. The sim battery and the browser drive this same object. */
(function (ML) {
  'use strict';
  var C = ML.CURVES;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function num(v, d, lo, hi) { v = typeof v === 'number' && isFinite(v) ? v : d; return clamp(v, lo == null ? 0 : lo, hi == null ? 1e300 : hi); }
  function int(v, d, lo, hi) { return Math.floor(num(v, d, lo, hi)); }
  function hash32(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  ML.hash32 = hash32;
  ML.mulberry = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ---------- curve functions ---------- */
  ML.raiderResolve = function (L) { return C.advResolve0 * (1 + L * C.advResolveLin) * Math.pow(C.advResolveC, L); };
  ML.raiderAtk = function (L) { return C.advAtk0 * (1 + L * C.advAtkLin) * Math.pow(C.advAtkC, L); };
  ML.raiderExp = function (L) { return C.advExp0 * (1 + L * C.advExpLin) * Math.pow(C.advExpC, L); };
  ML.raiderGold = function (L) { return C.advGold0 * (1 + L * C.advGoldLin) * Math.pow(C.advGoldC, L); };
  ML.xpFor = function (l) { return Math.floor(C.xpBase * Math.pow(l, C.xpExp)); };
  ML.compXpFor = function (l) { return Math.floor(C.compXpBase * Math.pow(l, C.compXpExp)); };
  ML.bondFor = function (l) { return Math.floor(C.bondBase * Math.pow(l + 1, C.bondExp)); };
  ML.renownFor = function (l) { return Math.floor(C.renownBase * Math.pow(l, C.renownExp)); };
  ML.costAt = function (def, lvl) { return Math.ceil(def.cost0 * Math.pow(def.growth || 1, lvl)); };
  ML.rankOfTrust = function (t) { var r = 0; for (var i = 0; i < C.trustRanks.length; i++) if (t >= C.trustRanks[i]) r = i + 1; return r; };
  ML.groundCost = function (def, lvl) { return Math.ceil(11 * Math.pow(1.28, lvl) * (1 + (def.k != null ? def.k : ML.GROUNDS.indexOf(def)) * 0.35)); };
  // A ground level is priced as a POOLED total drawn from its region's three materials, largest stock first.
  // Walk-found defect: costs keyed to one named material let a single parked road drought a region (18,141 Alderwood beside 11 Dewglass).
  ML.allocPool = function (have, pool, total) {
    var order = pool.slice().sort(function (a, b) { return (have[b] || 0) - (have[a] || 0); }), out = {}, left = total;
    order.forEach(function (m) { if (left <= 0) return; var take = Math.min(Math.floor(have[m] || 0), left); if (take > 0) { out[m] = take; left -= take; } });
    if (left > 0) out[order[0]] = (out[order[0]] || 0) + left;   // the shortfall lands on one material so the cost panel can show what is missing
    return out;
  };

  /* ---------- fresh state ---------- */
  ML.newState = function (seed) {
    seed = (seed == null ? (Math.random() * 4294967296) : seed) >>> 0;
    var s = {
      v: 1, seed: seed, rng: seed || 1, createdAt: 0, lastSeen: 0, playTime: 0,
      healer: { level: 1, xp: 0, points: 1, stats: { grace: 0, spirit: 0, ward: 0, tempo: 0, fortune: 0 }, autoAllot: false, allotPlan: { grace: 3, spirit: 1, ward: 1, tempo: 1, fortune: 1 }, allotStep: 0 },
      gold: 0, motes: 0, insight: 0, keystones: 0,
      mats: {}, offerings: { plain: 0, red: 0, blue: 0, green: 0, yellow: 0, purple: 0 },
      skills: { mend: { rank: 1, casts: 0, auto: true } }, slots: ['mend'], skillSlots: 2,
      upgrades: {}, queue: [],
      companions: { mossling: { trust: C.trustRanks[0], level: 1, xp: 0, bond: 0, bondXp: 0 } }, line: ['mossling'], helpers: [],
      inv: [], equipped: { focus: null, vestment: null, charm1: null, charm2: null }, mastery: {}, charm2: false, gearSeq: 1, scrapBelow: 0, autoWear: 'off', keepUnmastered: true, favs: {},
      areaId: 'hollow1', opened: { hollow1: true }, areas: {}, autoAdvance: true, smartRetreat: true, shortResult: false, offerAuto: true,
      tabs: { quests: true, healer: true, world: true, ledger: true, settings: true }, seenTabs: { quests: true, healer: true, world: true, ledger: true, settings: true }, flags: {},
      quests: { global: {}, general: {}, titles: {}, daily: { date: '', list: [], done: 0 }, acceptMax: 3, generalClaimedCycle: 0 },
      ledger: {}, titleEff: {},
      renown: { level: 1, xp: 0, points: 0, abilities: {} },
      grounds: {}, sab: { count: 0, keys: {}, upgrades: {}, bestLevel: 1, totalInsight: 0, autoLevel: 50, auto: false, cycleStart: 0 }, store: {},
      stats: { healed: 0, overheal: 0, fledTotal: 0, fled: {}, gilded: 0, strays: 0, clears: 0, fails: 0, flawless: 0, casts: 0, downs: 0, missions: 0, goldWasted: 0, mastered: 0, matsSold: 0, fused: 0, reclaimed: 0 },
      settings: { bgm: 0.5, sfx: 0.6, ui: 0.5, mute: false, reduceMotion: null, numbers: true, focusId: null, notation: 'short', theme: 'heather', zen: false, textSize: 'm', hiCon: false, ailMark: true }
    };
    return s;
  };

  /* ---------- save sanitiser: the save is attacker-controlled. Whitelist, coerce, clamp. ---------- */
  function idMap(src, valid, fn) { var out = {}; if (src && typeof src === 'object') Object.keys(src).forEach(function (k) { if (Object.prototype.hasOwnProperty.call(valid, k) && k !== '__proto__') { var v = fn(src[k] || {}, k); if (v !== undefined) out[k] = v; } }); return out; }
  function boolMap(src, valid) { return idMap(src, valid, function (v) { return v === true ? true : undefined; }); }
  ML.sanitizeSave = function (raw) {
    var d = ML.newState(1);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
    var s = d, r = raw, h = r.healer || {};
    s.seed = int(r.seed, 1, 0, 4294967295); s.rng = int(r.rng, s.seed || 1, 0, 4294967295) || 1;
    s.createdAt = num(r.createdAt, 0); s.lastSeen = num(r.lastSeen, 0); s.playTime = num(r.playTime, 0);
    s.healer.level = int(h.level, 1, 1, 100000); s.healer.xp = num(h.xp, 0);
    var spent = 0; ML.STATS.forEach(function (st) { var v = int((h.stats || {})[st.id], 0, 0, 1e7); s.healer.stats[st.id] = v; spent += v; });
    s.healer.points = int(h.points, 0, 0, 1e7);
    s.healer.autoAllot = h.autoAllot === true; s.healer.allotStep = int(h.allotStep, 0, 0, 1e9);
    ML.STATS.forEach(function (st) { s.healer.allotPlan[st.id] = int((h.allotPlan || {})[st.id], s.healer.allotPlan[st.id], 0, 9); });
    s.gold = num(r.gold, 0); s.motes = int(r.motes, 0); s.insight = int(r.insight, 0); s.keystones = int(r.keystones, 0);
    s.mats = idMap(r.mats, ML.MATS, function (v) { return num(v, 0); });
    ML.COLORS.forEach(function (c) { s.offerings[c] = int((r.offerings || {})[c], 0); });
    s.skills = idMap(r.skills, ML.SKILL_BY_ID, function (v) { return { rank: int(v.rank, 1, 1, ML.SKILL_MAX_RANK), casts: int(v.casts, 0), auto: v.auto !== false }; });
    if (!s.skills.mend) s.skills.mend = { rank: 1, casts: 0, auto: true };
    s.skillSlots = int(r.skillSlots, 2, 2, 6);
    s.slots = uniq(arr(r.slots).filter(function (id) { return s.skills[id]; })).slice(0, s.skillSlots); if (!s.slots.length) s.slots = ['mend'];
    s.upgrades = idMap(r.upgrades, ML.UPGRADE_BY_ID, function (v, k) { return int(v, 0, 0, ML.UPGRADE_BY_ID[k].max); });
    s.queue = arr(r.queue).filter(function (id) { return ML.UPGRADE_BY_ID[id]; }).slice(0, 40);
    s.companions = idMap(r.companions, ML.SPECIES_BY_ID, function (v) { return { trust: num(v.trust, 0), level: int(v.level, 1, 1, 60), xp: num(v.xp, 0), bond: int(v.bond, 0, 0, 200), bondXp: num(v.bondXp, 0) }; });
    if (!s.companions.mossling) s.companions.mossling = { trust: C.trustRanks[0], level: 1, xp: 0, bond: 0, bondXp: 0 };   // judge-found: the old fallback read the object it had just overwritten
    s.line = uniq(arr(r.line).filter(function (id) { return s.companions[id] && ML.rankOfTrust(s.companions[id].trust) >= 1; })).slice(0, 3); if (!s.line.length) s.line = ['mossling'];
    s.helpers = uniq(arr(r.helpers).filter(function (id) { var sp = ML.SPECIES_BY_ID[id]; return sp && sp.active && s.companions[id] && ML.rankOfTrust(s.companions[id].trust) >= sp.active.rank; })).slice(0, 3);
    s.gearSeq = int(r.gearSeq, 1, 1, 1e12);
    var seen = {};
    function item(v) { if (!v || typeof v !== 'object' || !ML.GEAR_BY_ID[v.t]) return null; var id = int(v.id, 0, 1, 1e12); if (seen[id]) return null; seen[id] = 1; return { id: id, t: v.t, r: int(v.r, 0, 0, 4), lv: int(v.lv, 0, 0, C.gearMaxLevel), p: num(v.p, 0) }; }
    s.inv = arr(r.inv).map(item).filter(Boolean).slice(0, 200);
    s.charm2 = r.charm2 === true;
    ML.GEAR_SLOTS.forEach(function (sl) { var it = item((r.equipped || {})[sl.id]); if (it) { var want = sl.id.indexOf('charm') === 0 ? 'charm' : sl.id; if (ML.GEAR_BY_ID[it.t].slot === want && (sl.id !== 'charm2' || s.charm2)) s.equipped[sl.id] = it; else s.inv.push(it); } });
    s.mastery = boolMap(r.mastery, ML.GEAR_BY_ID); s.scrapBelow = int(r.scrapBelow, 0, 0, 4);
    s.autoWear = r.autoWear === 'mastery' || r.autoWear === 'power' ? r.autoWear : 'off';
    s.keepUnmastered = r.keepUnmastered !== false;
    s.favs = {}; if (r.favs && typeof r.favs === 'object') s.inv.forEach(function (it) { if (r.favs[it.id]) s.favs[it.id] = true; });   // only ids that survived the inventory sanitiser
    var claimedOpen = boolMap(r.opened, ML.AREA_BY_ID), wantArea = r.areaId;
    s.areas = idMap(r.areas, ML.AREA_BY_ID, function (v) { return { clears: int(v.clears, 0), fails: int(v.fails, 0), best: num(v.best, 0), emaT: num(v.emaT, 0), emaGold: num(v.emaGold, 0), emaExp: num(v.emaExp, 0), emaMat: num(v.emaMat, 0), emaFled: num(v.emaFled, 0), emaTrust: num(v.emaTrust, 0), emaBase: num(v.emaBase, 0, 0, 10), emaHeal: num(v.emaHeal, 0), emaOk: num(v.emaOk, 0, 0, 1), feats: [!!arr(v.feats)[0], !!arr(v.feats)[1], !!arr(v.feats)[2]], streak: int(v.streak, 0) }; });
    s.autoAdvance = r.autoAdvance !== false; s.smartRetreat = r.smartRetreat !== false; s.shortResult = r.shortResult === true; s.offerAuto = r.offerAuto !== false;
    var tabIds = {}; ML.TABS.forEach(function (t) { tabIds[t.id] = 1; });
    var tb = boolMap(r.tabs, tabIds); Object.keys(tb).forEach(function (k) { s.tabs[k] = true; }); s.seenTabs = boolMap(r.seenTabs, tabIds);
    s.flags = boolMap(r.flags, { autoAllot: 1, firstLoss: 1, intro: 1, offlineSeen: 1, firstGift: 1 });
    var q = r.quests || {}, gq = {}; ML.GLOBAL_QUESTS.forEach(function (g) { gq[g.id] = 1; });
    s.quests.global = idMap(q.global, gq, function (v) { return v === 'done' || v === 'ready' ? v : undefined; });
    var tq = {}; ML.TITLE_QUESTS.forEach(function (g) { tq[g.id] = 1; }); s.quests.titles = boolMap(q.titles, tq);
    s.quests.acceptMax = int(q.acceptMax, 3, 3, 9); s.quests.generalClaimedCycle = int(q.generalClaimedCycle, 0);
    var gen = {}; if (q.general && typeof q.general === 'object') Object.keys(ML.GENERAL_KEYS).forEach(function (k) { if (own(q.general, k)) { var v = q.general[k] || {}; gen[k] = { tier: int(v.tier, 0, 0, 3), active: v.active === true, prog: num(v.prog, 0) }; } });
    s.quests.general = gen;
    var dq = q.daily || {}; s.quests.daily = { date: typeof dq.date === 'string' ? dq.date.slice(0, 10) : '', done: int(dq.done, 0), list: arr(dq.list).slice(0, 6).map(function (v) { v = v || {}; return { key: ['rout', 'clear', 'tend', 'heal'].indexOf(v.key) >= 0 ? v.key : 'rout', need: num(v.need, 1, 1), prog: num(v.prog, 0), rar: int(v.rar, 0, 0, 4), claimed: v.claimed === true }; }) };
    var lg = {}; ML.LEDGER.forEach(function (g) { lg[g.id] = 1; }); s.ledger = boolMap(r.ledger, lg);
    var rn = r.renown || {}; s.renown = { level: int(rn.level, 1, 1, 100000), xp: num(rn.xp, 0), points: int(rn.points, 0), abilities: {} };
    var ab = {}; ML.RENOWN.forEach(function (a) { ab[a.id] = a; }); s.renown.abilities = idMap(rn.abilities, ab, function (v, k) { return int(v, 0, 0, ab[k].max); });
    var spentR = 0; Object.keys(s.renown.abilities).forEach(function (k) { spentR += s.renown.abilities[k]; });
    if (spentR + s.renown.points > s.renown.level - 1) { s.renown.points = Math.max(0, s.renown.level - 1 - spentR); if (spentR > s.renown.level - 1) { s.renown.abilities = {}; s.renown.points = s.renown.level - 1; } }
    var gd = {}; ML.GROUNDS.forEach(function (a) { gd[a.id] = a; }); s.grounds = idMap(r.grounds, gd, function (v) { var rank = int(v.rank, 0, 0, ML.GROUND_MAX_RANK); return { level: int(v.level, 0, 0, ML.GROUND_BASE_CAP + rank * ML.GROUND_RANK_CAP), rank: rank }; });
    // an area is open only if play could have opened it: its region's Waystone gate is met and the road before it has been held
    var wlv = (s.grounds.waystone || {}).level || 0; s.opened = { hollow1: true };
    ML.AREAS.forEach(function (a) { if (wlv < ML.REGIONS[a.region].waystone) return; if (a.index === 0) { s.opened[a.id] = true; return; } var prev = ML.AREAS[a.order - 1]; if (own(claimedOpen, a.id) && s.opened[prev.id] && (s.areas[prev.id] || {}).clears > 0) s.opened[a.id] = true; });
    s.areaId = own(ML.AREA_BY_ID, wantArea) && own(s.opened, wantArea) ? wantArea : 'hollow1';
    var sb = r.sab || {}, iu = {}; ML.INSIGHT.forEach(function (a) { iu[a.id] = a; });
    s.sab = { count: int(sb.count, 0), keys: boolMap(sb.keys, ML.AREA_BY_ID), upgrades: idMap(sb.upgrades, iu, function (v, k) { return int(v, 0, 0, iu[k].max); }), bestLevel: int(sb.bestLevel, 1, 1), totalInsight: int(sb.totalInsight, 0), autoLevel: int(sb.autoLevel, 50, C.sabbaticalLevel, 9999), auto: sb.auto === true, cycleStart: num(sb.cycleStart, 0) };
    var st = {}; ML.STORE.forEach(function (a) { st[a.id] = a; }); s.store = idMap(r.store, st, function (v, k) { return int(v, 0, 0, st[k].max); });
    // stat points can never exceed what levels + Gifted grant
    var maxPts = s.healer.level + (s.sab.upgrades.gifted || 0) * 3;
    if (spent + s.healer.points > maxPts) { ML.STATS.forEach(function (x) { s.healer.stats[x.id] = 0; }); s.healer.points = maxPts; }
    Object.keys(d.stats).forEach(function (k) { if (k !== 'fled') s.stats[k] = num((r.stats || {})[k], 0); });
    s.stats.fled = idMap((r.stats || {}).fled, ML.RAIDER_BY_ID, function (v) { return int(v, 0); });
    var se = r.settings || {}; ['bgm', 'sfx', 'ui'].forEach(function (k) { s.settings[k] = num(se[k], d.settings[k], 0, 1); });
    s.settings.mute = se.mute === true; s.settings.reduceMotion = se.reduceMotion === true ? true : se.reduceMotion === false ? false : null; s.settings.numbers = se.numbers !== false;
    s.settings.focusId = ML.SPECIES_BY_ID[se.focusId] ? se.focusId : null; s.settings.notation = se.notation === 'sci' ? 'sci' : 'short'; s.settings.theme = se.theme === 'lantern' ? 'lantern' : 'heather'; s.settings.zen = se.zen === true;
    s.settings.textSize = ['s', 'm', 'l', 'xl'].indexOf(se.textSize) >= 0 ? se.textSize : 'm';
    s.settings.hiCon = se.hiCon === true; s.settings.ailMark = se.ailMark !== false;
    return s;
  };
  function arr(v) { return Array.isArray(v) ? v : []; }
  function own(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }   // ids arrive from the DOM and from saves: 'constructor' must never pass a lookup
  function posInt(n, max) { return typeof n === 'number' && isFinite(n) && n >= 1 && n <= (max || 1e6) && Math.floor(n) === n; }
  function uniq(a) { var o = {}, out = []; a.forEach(function (x) { if (typeof x === 'string' && !o[x]) { o[x] = 1; out.push(x); } }); return out; }

  /* ---------- Game ---------- */
  ML.Game = function (state, opts) {
    opts = opts || {};
    var G = this;
    G.S = state; G.clock = opts.clock || function () { return Date.now(); };
    G.mute = !!opts.mute; G.events = []; G.eff = {}; G.F = null; G.cd = {}; G.gcd = 0; G.mana = 0; G.recalcT = 0; G.checkT = 0; G.uid = 1;
    if (!state.createdAt) { state.createdAt = G.clock(); state.lastSeen = G.clock(); state.sab.cycleStart = 0; }
    G.recalc(); G.mana = G.D.manaMax; G.ensureDaily(); G.refreshGeneral(); G.startArea();
  };
  var P = ML.Game.prototype;

  P.rand = function () { var S = this.S; S.rng = (S.rng + 0x6D2B79F5) >>> 0; var t = S.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  P.ev = function (type, data) { if (this.mute) return; var e = data || {}; e.type = type; this.events.push(e); if (this.events.length > 400) this.events.splice(0, 100); };

  /* ---------- derived numbers ---------- */
  P.recalc = function () {
    var G = this, S = G.S, e = {};
    function add(k, v) { if (v) e[k] = (e[k] || 0) + v; }
    ML.UPGRADES.forEach(function (u) { add(u.eff, (S.upgrades[u.id] || 0) * u.per); });
    ML.SKILLS.forEach(function (sk) { var st = S.skills[sk.id]; if (!st) return; sk.passives.forEach(function (p) { if (st.casts >= p.at) Object.keys(p.eff).forEach(function (k) { add(k, p.eff[k]); }); }); });
    ML.SPECIES.forEach(function (sp) { var c = S.companions[sp.id]; if (!c) return; var r = ML.rankOfTrust(c.trust); if (r > 0) add(sp.passive.eff, sp.passive.per * r); });
    ML.GEAR_SLOTS.forEach(function (sl) { var it = S.equipped[sl.id]; if (!it) return; var def = ML.GEAR_BY_ID[it.t], m = ML.RARITY_MULT[it.r] * (1 + C.gearPerLevel * it.lv); Object.keys(def.eff).forEach(function (k) { add(k, def.eff[k] * m); }); });
    Object.keys(S.mastery).forEach(function (t) { var def = ML.GEAR_BY_ID[t]; if (def) Object.keys(def.mastery).forEach(function (k) { add(k, def.mastery[k]); }); });
    ML.RENOWN.forEach(function (a) { add(a.eff, (S.renown.abilities[a.id] || 0) * a.per); });
    ML.GROUNDS.forEach(function (g) { var st = S.grounds[g.id]; if (st) add(g.eff, st.level * g.per); });
    ML.INSIGHT.forEach(function (a) { add(a.eff, (S.sab.upgrades[a.id] || 0) * a.per); });
    Object.keys(S.titleEff).forEach(function (k) { add(k, S.titleEff[k]); });
    add('offlinePct', (S.store.nightwatch || 0) * 0.1);
    if (G.helperOn('lamplight')) add('offlinePct', 0.1);
    if (G.helperOn('fetch')) add('matPct', 0.2);
    G.eff = e;
    var st = S.healer.stats, tempo = st.tempo + (e.tempoFlat || 0);
    G.D = {
      heal: (C.healBase + st.grace * C.healPerGrace + S.healer.level * C.healPerLevel) * (1 + (e.healPct || 0)),
      manaMax: C.manaBase + st.spirit * C.manaPerSpirit + (e.manaFlat || 0),
      manaRegen: (C.manaRegenBase + st.spirit * C.manaRegenPerSpirit) * (1 + (e.manaRegenPct || 0)),
      cdMult: 1 / (1 + C.tempoK * tempo),
      crit: Math.min(C.critCap, C.critBase + st.fortune * C.critPerFortune + (e.critPct || 0)),
      shieldMult: (1 + st.ward * 0.04) * (1 + (e.shieldPct || 0)),
      defAura: st.ward * C.wardDefAura,
      drop: (1 + st.fortune * 0.01) * (1 + (e.dropPct || 0)),
      goldCap: C.goldCap0 * Math.pow(ML.COFFER_BASE, S.upgrades.coffer || 0) * (1 + (e.goldCapPct || 0)),   // compounding, base above the coffer's own cost growth, so the cap can always be raised
      vigorCap: C.vigorCapFrac + (e.vigorCap || 0),
      lineSlots: 1 + ((S.grounds.burrows || {}).level >= 1 ? 1 : 0) + ((S.grounds.burrows || {}).level >= 8 ? 1 : 0),
      helperSlots: 2 + ((S.grounds.burrows || {}).level >= 10 ? 1 : 0),
      invSize: C.invSize + (S.store.satchels || 0) * 6,
      queueSize: 3 + (S.store.queue || 0) * 2,
      dailyCount: 3 + (S.store.extradaily || 0),
      offlineEff: C.offlineEff * (1 + (e.offlinePct || 0)),
      offlineCap: (C.offlineCapH + (S.store.nightwatch || 0) * 2) * 3600
    };
    if (G.F) G.F.comps.forEach(function (c) { G.statComp(c, false); });
  };
  P.helperOn = function (id) { var S = this.S; return S.helpers.some(function (h) { var sp = ML.SPECIES_BY_ID[h]; return sp && sp.active && sp.active.id === id; }); };
  P.compStats = function (id) {
    var S = this.S, sp = ML.SPECIES_BY_ID[id], c = S.companions[id], e = this.eff, r = Math.max(1, ML.rankOfTrust(c.trust));
    var m = (1 + C.compRankMult * (r - 1)) * (1 + C.compBondMult * c.bond);
    var k = ML.KLASS[sp.klass] ? sp.klass : 'striker';
    return {
      hp: sp.hp * (1 + C.compLvHp * (c.level - 1)) * m * (1 + (e.compHpPct || 0)),
      atk: sp.atk * (1 + C.compLvAtk * (c.level - 1)) * m * (1 + (e.compAtkPct || 0)) * (k === 'striker' ? 1.25 : 1),
      def: (sp.def * (1 + 0.08 * (c.level - 1)) + this.D.defAura) * (1 + (e.compDefPct || 0)),
      aspd: sp.aspd, rank: r, klass: k
    };
  };
  P.statComp = function (u, full) { var st = this.compStats(u.id), ratio = u.maxHp ? u.hp / u.maxHp : 1; u.maxHp = st.hp; u.atk = st.atk; u.def = st.def; u.aspd = st.aspd; u.klass = st.klass; u.hp = full ? st.hp : Math.min(st.hp, ratio * st.hp); };

  /* ---------- field ---------- */
  P.area = function () { return ML.AREA_BY_ID[this.S.areaId]; };
  P.areaStat = function (id) { var S = this.S; id = id || S.areaId; return S.areas[id] || (S.areas[id] = { clears: 0, fails: 0, best: 0, emaT: 0, emaGold: 0, emaExp: 0, emaMat: 0, emaFled: 0, emaTrust: 0, emaBase: 0, emaHeal: 0, emaOk: 0, feats: [false, false, false], streak: 0 }); };
  P.startArea = function () {
    var G = this, S = G.S;
    S.line = S.line.filter(function (id) { return S.companions[id]; }).slice(0, G.D.lineSlots); if (!S.line.length) S.line = ['mossling'];
    var comps = S.line.map(function (id, i) { var u = { id: id, slot: i, hp: 1, maxHp: 0, vigor: 0, shield: 0, atkT: 0.4 + i * 0.2, hot: null, ail: {}, down: false, fx: 0 }; G.statComp(u, true); return u; });
    G.F = { comps: comps, raiders: [], stray: null, drops: [], wave: 0, phase: 'between', t: 0.8, time: 0, gold: 0, exp: 0, mats: 0, fled: 0, trust: 0, strays: 0, heal: 0, downs: 0, rally: 0, result: null, gear: 0 };
    G.ev('area', { id: S.areaId });
  };
  P.spawnWave = function () {
    var G = this, F = G.F, a = G.area(), L = a.level; F.wave++;
    var w = F.wave, scale = 1 + 0.05 * (w - 1), size = clamp(1 + Math.floor(G.rand() * a.partyMax * (0.35 + 0.65 * w / 10)), 1, a.partyMax), boss = w === 10;
    for (var i = 0; i < size; i++) {
      var cls = ML.RAIDER_BY_ID[a.raiders[Math.floor(G.rand() * a.raiders.length)]], cap = boss && i === 0, gilded = !boss && G.rand() < C.gildedChance;
      var hp = ML.raiderResolve(L) * cls.hp * scale * (cap ? C.captainResolve : 1) * (gilded ? 3 : 1);
      F.raiders.push({ uid: G.uid++, cls: cls.id, hp: hp, maxHp: hp, atk: ML.raiderAtk(L) * cls.atk * scale * (cap ? C.captainAtk : 1) * (gilded ? 0.2 : 1), aspd: cls.aspd, atkT: 0.6 + G.rand() * 0.6, x: 104 + i * 7, stopX: cls.range === 'melee' ? 50 + i * 4 : 62 + i * 4, captain: cap, gilded: gilded, linger: gilded ? C.gildedLinger : 0, fx: 0, flee: 0 });
    }
    F.phase = 'fight'; G.ev('wave', { n: w, boss: boss });
    if (w % C.strayEvery === 0 && !F.stray && w < 10) { var wound = C.strayWound0 * (1 + L * C.strayWoundLin) * Math.pow(1.03, L) * 2; F.stray = { id: a.stray, wound: wound, max: wound, t: 40, fx: 0 }; G.ev('stray', { id: a.stray }); }
  };
  P.alive = function () { return this.F.comps.filter(function (c) { return !c.down; }); };

  P.tick = function (dt) {
    var G = this, S = G.S, F = G.F, D = G.D;
    if (!(dt > 0 && dt <= 1)) dt = C.tick; S.playTime += dt;
    G.recalcT -= dt; if (G.recalcT <= 0) { G.recalcT = 1; G.recalc(); D = G.D; }
    G.mana = Math.min(D.manaMax, G.mana + D.manaRegen * dt);
    Object.keys(G.cd).forEach(function (k) { if (G.cd[k] > 0) G.cd[k] -= dt; }); if (G.gcd > 0) G.gcd -= dt;
    if (F.phase === 'result') { F.t -= dt; if (F.t <= 0) G.afterResult(); return; }
    F.time += dt;
    if (F.phase === 'between') { F.t -= dt; if (F.t <= 0) G.spawnWave(); }
    if (F.rally > 0) F.rally -= dt;
    var alive = G.alive();
    // raiders
    for (var i = F.raiders.length - 1; i >= 0; i--) {
      var r = F.raiders[i];
      if (r.flee > 0) { r.flee -= dt; r.x += 46 * dt; if (r.flee <= 0) F.raiders.splice(i, 1); continue; }
      if (r.x > r.stopX) { r.x = Math.max(r.stopX, r.x - 22 * dt); continue; }
      if (r.gilded) { r.linger -= dt; if (r.linger <= 0) { r.flee = 1.2; r.hp = 0; G.ev('gildedgone', {}); continue; } }
      r.atkT -= dt;
      if (r.atkT <= 0 && alive.length) { r.atkT += 1 / r.aspd; G.raiderHit(r, alive); alive = G.alive(); }
    }
    // companions
    F.comps.forEach(function (c) {
      if (c.down) return;
      var ail = c.ail, dot = 0;
      if (ail.burn) { dot += ail.burn.p; ail.burn.t -= dt; if (ail.burn.t <= 0) delete ail.burn; }
      if (ail.poison) { dot += ail.poison.p * ail.poison.n; ail.poison.t -= dt; if (ail.poison.t <= 0) delete ail.poison; }
      ['chill', 'shock', 'curse'].forEach(function (k) { if (ail[k]) { ail[k].t -= dt; if (ail[k].t <= 0) delete ail[k]; } });
      if (dot) G.hurt(c, dot * dt, true);
      if (c.down) return;
      if (c.hot) { G.healUnit(c, c.hot.per * dt, true, true);   // judge-found: Dew's healing used to count for nothing (no Bond, no dailies, no Titles)
         c.hot.t -= dt; if (c.hot.t <= 0) c.hot = null; }
      if (c.vigor > 0) c.vigor = Math.max(0, c.vigor - c.maxHp * C.vigorDecay * dt);
      if (c.shield > 0) c.shield = Math.max(0, c.shield - c.maxHp * 0.005 * dt);
      var tgt = null, best = 1e9; F.raiders.forEach(function (r) { if (!r.flee && r.x <= 78 && r.x < best) { best = r.x; tgt = r; } });
      if (!tgt) return;
      c.atkT -= dt * (ail.chill ? 0.7 : 1);
      if (c.atkT <= 0) {
        c.atkT += 1 / c.aspd;
        var dmg = c.atk * (1 + C.vigorAtkK * c.vigor / c.maxHp) * (F.rally > 0 ? 1 + F.rallyPow : 1);
        if (c.klass === 'mender') { dmg *= 0.6; var low = G.lowest(); if (low && low.hp < low.maxHp) G.healUnit(low, c.atk * 0.45, false, true); }
        tgt.hp -= dmg; tgt.fx = 0.18; c.fx = 0.22; G.ev('strike', { from: c.slot, to: tgt.uid, dmg: dmg });
        if (tgt.hp <= 0) G.raiderFlees(tgt);
      }
    });
    if (F.stray) { F.stray.t -= dt; if (F.stray.t <= 0) { F.stray = null; G.ev('straygone', {}); } }
    G.healerAI();
    if (F.phase === 'fight') {
      if (!G.alive().length) return G.endArea(false);
      if (!F.raiders.some(function (r) { return !r.flee; })) { if (F.wave >= 10) return G.endArea(true); F.phase = 'between'; F.t = 1.2; }
    }
    G.checkT -= dt; if (G.checkT <= 0) { G.checkT = 1; G.periodic(); }
  };

  P.lowest = function (skip) { var best = null, b = 2; this.F.comps.forEach(function (c) { if (c.down || c === skip) return; var p = c.hp / c.maxHp; if (p < b) { b = p; best = c; } }); return best; };
  P.frontTarget = function (alive, mode) {
    if (mode === 'back') return alive[alive.length - 1];
    for (var i = 0; i < alive.length; i++) if (alive[i].klass === 'bulwark') return alive[i];
    return alive[0];
  };
  P.raiderHit = function (r, alive) {
    var G = this, cls = ML.RAIDER_BY_ID[r.cls], targets = cls.target === 'all' ? alive.slice() : [G.frontTarget(alive, cls.target)];
    targets.forEach(function (c) {
      var dmg = r.atk * 50 / (50 + c.def) * (c.klass === 'bulwark' ? 0.8 : 1) * (c.ail.shock ? 1.2 : 1);
      G.hurt(c, dmg, false); r.fx = 0.2; G.ev('hit', { to: c.slot, from: r.uid, dmg: dmg, color: cls.color });
      var a = ML.AILMENT_OF[cls.color];
      if (a && !c.down && G.rand() < 0.35) {
        var dur = (a === 'poison' || a === 'curse' ? 5 : 4) * (1 + (G.eff.ailmentDur || 0));
        if (a === 'burn') c.ail.burn = { t: dur, p: r.atk * 0.35 };
        else if (a === 'poison') c.ail.poison = { t: dur, p: r.atk * 0.2, n: Math.min(3, ((c.ail.poison || {}).n || 0) + 1) };
        else c.ail[a] = { t: dur };
      }
    });
  };
  P.hurt = function (c, dmg, dot) {
    if (c.shield > 0) { var s = Math.min(c.shield, dmg); c.shield -= s; dmg -= s; }
    c.hp -= dmg; if (!dot) c.fx = -0.2;
    if (c.hp <= 0) { c.hp = 0; c.down = true; c.vigor = 0; c.hot = null; c.ail = {}; this.F.downs++; this.S.stats.downs++; this.ev('down', { slot: c.slot, id: c.id }); }
  };
  P.healUnit = function (c, amt, fromHealer, quiet) {
    var G = this, S = G.S;
    if (c.ail && c.ail.curse) amt *= 0.6;
    var room = c.maxHp - c.hp, eff = Math.min(room, amt), over = amt - eff;
    c.hp += eff;
    var cap = c.maxHp * G.D.vigorCap, conv = Math.max(0, Math.min(over, cap - c.vigor)); c.vigor += conv;
    if (fromHealer) {
      S.stats.healed += eff; S.stats.overheal += conv; G.F.heal += eff + conv; G.dailyProg('heal', eff + conv);
      var cs = S.companions[c.id]; cs.bondXp += (eff + conv) * (1 + (G.eff.bondPct || 0));
      while (cs.bond < 200 && cs.bondXp >= ML.bondFor(cs.bond) * G.bondScale(c.id)) { cs.bondXp -= ML.bondFor(cs.bond) * G.bondScale(c.id); cs.bond++; G.statComp(c, false); G.ev('bond', { id: c.id, n: cs.bond }); }
    }
    if (!quiet) G.ev('heal', { to: c.slot, amt: eff, over: conv });
    return eff + conv;
  };
  P.bondScale = function (id) { return Math.max(1, ML.SPECIES_BY_ID[id].hp / 30); };

  /* ---------- healer ---------- */
  P.skillPower = function (id) { var st = this.S.skills[id]; return 1 + ML.SKILL_RANK_BONUS * ((st ? st.rank : 1) - 1); };
  P.healerAI = function () {
    var G = this, S = G.S, F = G.F; if (G.gcd > 0) return;
    for (var i = 0; i < S.slots.length; i++) {
      var id = S.slots[i], sk = ML.SKILL_BY_ID[id], st = S.skills[id];
      if (!sk || !st || !st.auto || (G.cd[id] || 0) > 0 || G.mana < sk.mana) continue;
      if (G.tryCast(sk)) return;
    }
  };
  P.tryCast = function (sk, manual) {
    var G = this, S = G.S, F = G.F, D = G.D, alive = G.alive(); if (!alive.length || F.phase === 'result') return false;
    var low = G.lowest(), lowP = low ? low.hp / low.maxHp : 1, flush = G.mana > D.manaMax * 0.85, fighting = F.raiders.some(function (r) { return !r.flee; });
    var focus = S.settings.focusId && alive.filter(function (c) { return c.id === S.settings.focusId; })[0];
    var pow = D.heal * G.skillPower(sk.id), crit = G.rand() < D.crit, mult = crit ? C.critMult : 1, tgt = null, did = false;
    if (sk.kind === 'heal') {
      if (F.stray && lowP >= 0.7) { G.tendStray(pow * sk.power * mult); did = true; tgt = 'stray'; }
      else {
        tgt = focus && focus.hp / focus.maxHp < 0.9 ? focus : lowP < 0.999 ? low : null;
        if (!tgt) { var bv = 2; alive.forEach(function (c) { var v = c.vigor / c.maxHp - (c.klass === 'striker' ? 0.2 : 0); if (v < bv) { bv = v; tgt = c; } }); }
        G.healUnit(tgt, pow * sk.power * mult, true); did = true;
      }
    } else if (sk.kind === 'aoe') {
      var hurtN = alive.filter(function (c) { return c.hp / c.maxHp < 0.78; }).length;
      if (manual || hurtN >= 2 || (alive.length === 1 && lowP < 0.6) || (flush && fighting)) { alive.forEach(function (c) { G.healUnit(c, pow * sk.power * mult, true); if (G.eff.bloomShield) c.shield = Math.max(c.shield, c.maxHp * G.eff.bloomShield); }); did = true; }
    } else if (sk.kind === 'hot') {
      var cand = alive.filter(function (c) { return !c.hot; }).sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0];
      if (cand && (manual || cand.hp / cand.maxHp < 0.92 || flush) && fighting) { var dur = sk.dur + (G.eff.dewDur || 0); cand.hot = { t: dur, per: pow * sk.power * (1 + (G.eff.hotPct || 0)) }; tgt = cand; did = true; G.ev('hot', { to: cand.slot }); }
    } else if (sk.kind === 'shield') {
      var fr = low && lowP < 0.65 ? low : G.frontTarget(alive, 'front');   // audit finding: shielding only the tank was a dead skill — the back line is what falls
      if (fighting && fr && fr.shield < fr.maxHp * 0.05) { var sv = pow * sk.power * D.shieldMult; fr.shield = sv; if (G.eff.barkTwo && alive[1] && alive[1] !== fr) alive[1].shield = Math.max(alive[1].shield, sv * 0.6); tgt = fr; did = true; G.ev('shield', { to: fr.slot }); }
    } else if (sk.kind === 'cleanse') {
      var sick = alive.filter(function (c) { return Object.keys(c.ail).length; }).sort(function (a, b) { return Object.keys(b.ail).length - Object.keys(a.ail).length; })[0];
      if (sick) { (G.eff.purifyAll ? alive : [sick]).forEach(function (c) { c.ail = {}; }); G.healUnit(sick, pow * sk.power * mult, true); tgt = sick; did = true; G.ev('cleanse', { to: sick.slot }); }
    } else if (sk.kind === 'rally') {
      var heavy = F.raiders.filter(function (r) { return !r.flee; });
      if (heavy.length && (manual || heavy.length >= 3 || heavy.some(function (r) { return r.captain || r.gilded; }) || flush)) { F.rally = sk.dur + (G.eff.rallyDur || 0); F.rallyPow = sk.power * G.skillPower(sk.id); did = true; G.ev('rally', {}); }
    }
    if (!did) return false;
    G.mana -= sk.mana; G.cd[sk.id] = sk.cd * D.cdMult; G.gcd = 0.25 * D.cdMult;
    var st = S.skills[sk.id]; st.casts++; S.stats.casts++;
    G.ev('cast', { id: sk.id, crit: crit, to: tgt === 'stray' ? 'stray' : tgt ? tgt.slot : -1 });
    return true;
  };
  P.manualCast = function (id) { var G = this; if (!own(ML.SKILL_BY_ID, id) || !own(G.S.skills, id)) return false; var sk = ML.SKILL_BY_ID[id]; if ( G.S.slots.indexOf(id) < 0 || (G.cd[id] || 0) > 0 || G.mana < sk.mana) return false; return G.tryCast(sk, true); };
  P.tendStray = function (amt) {
    var G = this, S = G.S, F = G.F, s = F.stray; if (!s) return;
    s.wound -= amt; s.fx = 0.3; G.ev('heal', { to: 'stray', amt: amt, over: 0 }); S.stats.healed += amt; G.dailyProg('heal', amt);
    if (s.wound <= 0) {
      var sp = ML.SPECIES_BY_ID[s.id], has = S.offerAuto !== false && S.offerings[sp.color] > 0, gain = (has ? ML.OFFERING_MULT : 1) * (1 + (G.eff.trustPct || 0));
      if (has) S.offerings[sp.color]--;
      G.addTrust(s.id, gain); F.trust += gain; F.strays++; S.stats.strays++; G.questProg('tend', null, 1); G.dailyProg('tend', 1);
      G.ev('tended', { id: s.id, trust: gain, offering: has }); F.stray = null;
    }
  };
  P.addTrust = function (id, n) {
    var S = this.S, c = S.companions[id] || (S.companions[id] = { trust: 0, level: 1, xp: 0, bond: 0, bondXp: 0 }), before = ML.rankOfTrust(c.trust);
    c.trust += n; var after = ML.rankOfTrust(c.trust);
    if (after > before) { this.ev('rank', { id: id, rank: after, first: before === 0 }); this.recalc(); }
  };

  /* ---------- rewards ---------- */
  P.raiderFlees = function (r) {
    var G = this, S = G.S, F = G.F, a = G.area(), L = a.level, e = G.eff;
    r.flee = 1.4; r.hp = 0;
    var forager = G.alive().some(function (c) { return c.klass === 'forager'; }) ? 1.15 : 1;
    var mult = (r.captain ? C.captainReward : 1) * (r.gilded ? C.gildedReward : 1);
    var gold = ML.raiderGold(L) * mult * (1 + (e.goldPct || 0)) * forager, exp = ML.raiderExp(L) * mult * (1 + (e.expPct || 0));
    G.addGold(gold); G.addExp(exp); F.gold += gold; F.exp += exp; F.fled++;
    S.stats.fledTotal++; S.stats.fled[r.cls] = (S.stats.fled[r.cls] || 0) + 1; if (r.gilded) S.stats.gilded++;
    G.questProg('rout', r.cls, 1); G.dailyProg('rout', 1);
    S.line.forEach(function (id) { G.addCompExp(id, exp * 0.5); });
    var matN = (r.captain ? 5 : G.rand() < 0.5 ? 1 : 0) * (1 + 0.35 * a.index) * (1 + (e.matPct || 0)) * forager;   // deeper areas pay more: farming the easiest area must never be optimal
    if (matN > 0) {
      var sibs = ML.REGIONS[a.region].mats.filter(function (m) { return m !== a.mat; }), split = C.matSplit;
      G.drop({ kind: 'mat', mat: a.mat, n: matN * (1 - split), x: r.x });
      if (sibs.length) G.drop({ kind: 'mat', mat: sibs[Math.floor(G.rand() * sibs.length)], n: matN * split, x: r.x });   // one sibling per flee, evenly over time: a parked road can no longer drought its region
    }
    var ch = (r.captain ? C.gearDropCaptain : C.gearDrop) * G.D.drop * forager * (r.gilded ? 10 : 1);
    if (!S.flags.firstGift && r.captain && a.order >= 1) ch = 1;
    if (G.rand() < ch) { S.flags.firstGift = true; G.drop({ kind: 'gear', item: G.rollGear(a.region), x: r.x }); }
    G.ev('flee', { uid: r.uid, cls: r.cls, gold: gold, exp: exp, captain: r.captain, gilded: r.gilded, x: r.x });
  };
  P.rollGear = function (region) {
    var G = this, pool = ML.GEAR.filter(function (g) { return g.region === region; }), def = pool[Math.floor(G.rand() * pool.length)];
    var tot = 0; ML.RARITY_WEIGHT.forEach(function (w) { tot += w; }); var roll = G.rand() * tot, r = 0;
    for (var i = 0; i < ML.RARITY_WEIGHT.length; i++) { roll -= ML.RARITY_WEIGHT[i]; if (roll <= 0) { r = i; break; } }
    return { id: G.S.gearSeq++, t: def.id, r: r, lv: 0, p: 0 };
  };
  P.drop = function (d) {
    var G = this, F = G.F;
    if (G.helperOn('fetch')) return G.collectDrop(d);
    if (d.kind === 'mat') { var m = F.drops.filter(function (x) { return x.kind === 'mat' && x.mat === d.mat; })[0]; if (m) { m.n += d.n; m.pulse = 0.3; return; } }
    d.uid = G.uid++; d.x = clamp((d.x || 60) + (G.rand() - 0.5) * 12, 30, 92); d.y = G.rand(); F.drops.push(d);
    if (F.drops.filter(function (x) { return x.kind === 'gear'; }).length > C.groundCap) { for (var i = 0; i < F.drops.length; i++) if (F.drops[i].kind === 'gear') { G.collectDrop(F.drops.splice(i, 1)[0]); break; } }
    G.ev('drop', { kind: d.kind });
  };
  P.collect = function (uid) { var F = this.F; for (var i = 0; i < F.drops.length; i++) if (F.drops[i].uid === uid) { this.collectDrop(F.drops.splice(i, 1)[0]); return true; } return false; };
  P.collectAll = function () { var F = this.F, d; while ((d = F.drops.pop())) this.collectDrop(d); };
  // A gift is protected from automatic unpicking if you starred it, or if its type is one you have not mastered yet
  // and you asked to keep those. Worn gifts are never in the satchel, so they cannot be reached by any of this.
  P.scrapProtected = function (it) { var S = this.S; return !!(S.favs[it.id] || (S.keepUnmastered && !S.mastery[it.t] && it.lv < C.gearMaxLevel)); };
  // Walk-found defect: at 24/24 every new drop was unpicked on arrival, Mythics included. Now the WORST unprotected
  // gift in the satchel makes way, and only if the arriving gift is actually better than it.
  P.makeRoom = function (item) {
    var G = this, S = G.S; if (S.inv.length < G.D.invSize) return true;
    var worst = null, worstScore = Infinity;
    S.inv.forEach(function (it) { if (G.scrapProtected(it)) return; var v = G.gearScore(it); if (v < worstScore) { worst = it; worstScore = v; } });
    if (!worst || worstScore >= G.gearScore(item)) return false;
    G.scrap(worst.id); return true;
  };
  P.collectDrop = function (d) {
    var G = this, S = G.S;
    if (d.kind === 'mat') { S.mats[d.mat] = (S.mats[d.mat] || 0) + d.n; G.F.mats += d.n; G.ev('pickup', { kind: 'mat', mat: d.mat, n: d.n }); }
    else {
      G.F.gear++; S.tabs.gear = true;
      var tidy = S.store.autoscrap && d.item.r < S.scrapBelow && !G.scrapProtected(d.item);
      if (tidy || !G.makeRoom(d.item)) { G.scrapValue(d.item, true); G.ev('pickup', { kind: 'scrap', item: d.item, full: !tidy }); }
      else { S.inv.push(d.item); G.ev('pickup', { kind: 'gear', item: d.item }); if (S.autoWear !== 'off') G.wearBest(S.autoWear); }
    }
  };
  P.addGold = function (n) {
    var S = this.S, cap = this.D.goldCap, room = Math.max(0, cap - S.gold), got = Math.min(room, n), lost = n - got;
    S.gold += got; S.stats.goldWasted += lost;
    if (lost > 0.01 && !S.flags.capSeen) { S.flags.capSeen = true; this.ev('capped', { cap: cap }); }   // colour-only warning was the whole signal before this
    this.runQueue(); return got;
  };
  P.addExp = function (n) {
    var G = this, S = G.S, h = S.healer; h.xp += n;
    var guard = 0; while (h.xp >= ML.xpFor(h.level) && guard++ < 500) { h.xp -= ML.xpFor(h.level); h.level++; h.points++; if (h.level > S.sab.bestLevel) S.sab.bestLevel = h.level; G.onLevel(); }
    var rn = S.renown; rn.xp += n * 0.6 * (1 + (G.eff.renownPct || 0)); guard = 0;
    while (rn.xp >= ML.renownFor(rn.level) && guard++ < 500) { rn.xp -= ML.renownFor(rn.level); rn.level++; rn.points++; G.ev('renown', { level: rn.level }); }
  };
  P.onLevel = function () {
    var G = this, S = G.S, h = S.healer;
    ML.SKILLS.forEach(function (sk) { if (h.level >= sk.level && !S.skills[sk.id]) { S.skills[sk.id] = { rank: 1, casts: 0, auto: true }; if (S.slots.length < S.skillSlots) S.slots.push(sk.id); G.ev('skill', { id: sk.id }); } });
    if (h.autoAllot && S.flags.autoAllot) G.autoAllot();
    G.recalc(); G.ev('level', { level: h.level });
  };
  P.autoAllot = function () {
    var S = this.S, h = S.healer, order = []; ML.STATS.forEach(function (st) { for (var i = 0; i < (h.allotPlan[st.id] || 0); i++) order.push(st.id); });
    if (!order.length) return; var guard = 0;
    while (h.points > 0 && guard++ < 100000) { h.stats[order[h.allotStep % order.length]]++; h.allotStep++; h.points--; }
  };
  P.addCompExp = function (id, n) {
    var G = this, c = G.S.companions[id]; if (!c) return; var cap = Math.max(1, ML.rankOfTrust(c.trust)) * 10; if (c.level >= cap) { c.xp = 0; return; }
    c.xp += n / G.bondScale(id) * 1; var guard = 0;
    while (c.level < cap && c.xp >= ML.compXpFor(c.level) && guard++ < 200) { c.xp -= ML.compXpFor(c.level); c.level++; var u = G.F && G.F.comps.filter(function (x) { return x.id === id; })[0]; if (u) G.statComp(u, false); G.ev('complevel', { id: id, level: c.level }); }
  };

  /* ---------- area end ---------- */
  P.endArea = function (ok) {
    var G = this, S = G.S, F = G.F, a = G.area(), st = G.areaStat(), k = st.emaT ? 0.3 : 1;
    G.collectAll();
    var total = F.time + (S.shortResult ? 0.8 : 2.6);
    function ema(key, v) { st[key] = st[key] * (1 - k) + v * k; }
    ema('emaT', total); ema('emaGold', F.gold); ema('emaExp', F.exp); ema('emaMat', F.mats); ema('emaFled', F.fled); ema('emaTrust', F.trust); ema('emaBase', F.strays); ema('emaHeal', F.heal); ema('emaOk', ok ? 1 : 0);
    var feats = [];
    if (ok) {
      st.clears++; S.stats.clears++; st.streak = 0; if (!st.best || F.time < st.best) st.best = F.time;
      if (!F.downs) S.stats.flawless++;
      G.questProg('clear', a.id, 1); G.dailyProg('clear', 1);
      [F.downs === 0, F.time <= a.timeGoal, st.clears >= 25].forEach(function (v, i) { if (v && !st.feats[i]) { st.feats[i] = true; S.motes += 10; S.stats.missions++; feats.push(i); } });
      var next = ML.AREAS[a.order + 1];
      if (next && next.region === a.region && !S.opened[next.id]) { S.opened[next.id] = true; G.ev('opened', { id: next.id }); }
      if (a.index === 7 && !S.sab.keys[a.id]) { S.sab.keys[a.id] = true; S.keystones++; G.ev('keystone', {}); }   // one per region finale per Sabbatical cycle: prestige renews the supply
    } else { st.fails++; S.stats.fails++; st.streak++; S.flags.firstLoss = true; }
    F.phase = 'result'; F.t = S.shortResult ? 0.8 : 2.6; F.result = { ok: ok, time: F.time, gold: F.gold, exp: F.exp, mats: F.mats, mat: a.mat, fled: F.fled, wave: F.wave, downs: F.downs, feats: feats, gear: F.gear };
    G.ev('result', F.result);
  };
  P.afterResult = function () {
    var G = this, S = G.S, F = G.F, a = G.area(), st = G.areaStat();
    if (F.result.ok) {
      if (G.retreatHold > 0) G.retreatHold--;
      else if (S.autoAdvance && !F.result.downs) { var next = ML.AREAS[a.order + 1]; if (next && S.opened[next.id]) S.areaId = next.id; }
    } else if (S.smartRetreat && st.streak >= 3 && a.order > 0) {
      var prev = ML.AREAS[a.order - 1];
      if (S.opened[prev.id]) { st.streak = 0; S.areaId = prev.id; G.retreatHold = 5; G.ev('retreat', { id: prev.id }); }
    }
    G.startArea();
  };
  P.travel = function (id) { var S = this.S; if (!own(ML.AREA_BY_ID, id) || !own(S.opened, id)) return false; this.collectAll(); S.areaId = id; this.retreatHold = 0; this.startArea(); return true; };

  /* ---------- quests ---------- */
  P.deepestOpenRegion = function () { for (var i = ML.REGIONS.length - 1; i > 0; i--) if (this.regionOpen(i)) return i; return 0; };
  P.regionOpen = function (ri) { var S = this.S; if (ri === 0) return true; return ((S.grounds.waystone || {}).level || 0) >= ML.REGIONS[ri].waystone; };
  P.refreshGeneral = function () {
    var G = this, S = G.S;
    ML.REGIONS.forEach(function (r, ri) {
      if (!G.regionOpen(ri)) return;
      var keys = [r.id + ':tend:any', r.id + ':clear:' + r.id + '4', r.id + ':clear:' + r.id + '8']; r.raiders.slice(0, 3).forEach(function (c) { keys.push(r.id + ':rout:' + c); });
      keys.forEach(function (k) { if (!S.quests.general[k]) S.quests.general[k] = { tier: 0, active: false, prog: 0 }; });
      var first = ML.AREA_BY_ID[r.id + '1']; if (!S.opened[first.id]) { S.opened[first.id] = true; G.ev('opened', { id: first.id }); }
    });
  };
  P.generalInfo = function (key) {
    var S = this.S, q = S.quests.general[key], p = key.split(':'), ri = 0; ML.REGIONS.forEach(function (r, i) { if (r.id === p[0]) ri = i; });
    var tpl = ML.GENERAL_TEMPLATES.filter(function (t) { return t.key === p[1]; })[0], tier = Math.min(q.tier, 2), need = Math.ceil(tpl.n[tier] * (this.helperOn('courier') ? 0.75 : 1));
    var who = p[1] === 'rout' ? ML.RAIDER_BY_ID[p[2]].name + 's' : p[1] === 'clear' ? ML.AREA_BY_ID[p[2]].name : '';
    var L = ML.REGIONS[ri].levels[3], scale = (tier + 1) * (tier + 1);
    return { key: key, region: ri, need: need, text: tpl.text(need, who), done: q.tier >= 3, tier: q.tier, active: q.active, prog: q.prog, gold: Math.ceil(ML.raiderGold(L) * 40 * scale), exp: Math.ceil(ML.raiderExp(L) * 30 * scale), target: p[2], kind: p[1] };
  };
  P.activeGeneral = function () { var q = this.S.quests.general; return Object.keys(q).filter(function (k) { return q[k].active; }); };
  P.acceptGeneral = function (key) { var S = this.S; if (!own(S.quests.general, key)) return false; var q = S.quests.general[key]; if (q.active || q.tier >= 3 || this.activeGeneral().length >= S.quests.acceptMax) return false; q.active = true; q.prog = 0; return true; };
  P.abandonGeneral = function (key) { if (!own(this.S.quests.general, key)) return false; var q = this.S.quests.general[key]; if (!q.active) return false; q.active = false; q.prog = 0; return true; };
  P.claimGeneral = function (key) {
    var G = this, S = G.S; if (!own(S.quests.general, key)) return false; var q = S.quests.general[key]; if (!q.active) return false; var info = G.generalInfo(key); if (q.prog < info.need) return false;
    q.active = false; q.prog = 0; q.tier++; S.quests.generalClaimedCycle++; G.addGold(info.gold); G.addExp(info.exp); G.ev('claim', { text: info.text, gold: info.gold, exp: info.exp }); return true;
  };
  P.questProg = function (kind, target, n) {
    var S = this.S, q = S.quests.general, region = ML.REGIONS[this.area().region].id;
    Object.keys(q).forEach(function (k) { if (!q[k].active) return; var p = k.split(':'); if (p[1] !== kind) return; if (kind === 'rout' && (p[2] !== target || p[0] !== region)) return; if (kind === 'clear' && p[2] !== target) return; if (kind === 'tend' && p[0] !== region) return; q[k].prog += n; });
  };
  P.todayStr = function () { var d = new Date(this.clock()); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  P.ensureDaily = function () {
    var G = this, S = G.S, today = G.todayStr(), dq = S.quests.daily; if (dq.date === today && dq.list.length >= G.D.dailyCount) return;
    var rng = ML.mulberry(hash32(today + ':' + S.seed)), L = G.bestAreaLevel(), list = dq.date === today ? dq.list : [];
    while (list.length < G.D.dailyCount) {
      var t = ML.DAILY_TEMPLATES[Math.floor(rng() * ML.DAILY_TEMPLATES.length)], roll = rng() * 100, rar = 0, acc = 0;
      for (var i = 0; i < ML.DAILY_RARITY.length; i++) { acc += ML.DAILY_RARITY[i].w; if (roll < acc) { rar = i; break; } }
      var need = t.key === 'heal' ? Math.ceil(G.D.heal * 900 * ML.DAILY_RARITY[rar].mult) : Math.ceil(t.base * ML.DAILY_RARITY[rar].mult * (t.key === 'rout' ? 1 + L * 0.02 : 1));
      list.push({ key: t.key, need: need, prog: 0, rar: rar, claimed: false });
    }
    dq.date = today; dq.list = list;
  };
  P.bestAreaLevel = function () { var S = this.S, b = 1; Object.keys(S.opened).forEach(function (k) { if (ML.AREA_BY_ID[k]) b = Math.max(b, ML.AREA_BY_ID[k].level); }); return b; };
  P.dailyProg = function (key, n) { this.S.quests.daily.list.forEach(function (d) { if (d.key === key && !d.claimed) d.prog += n; }); };
  P.claimDaily = function (i) { var S = this.S; if (typeof i !== 'number' || Math.floor(i) !== i || i < 0 || i >= S.quests.daily.list.length) return false; var d = S.quests.daily.list[i]; if (d.claimed || d.prog < d.need) return false; d.claimed = true; var m = ML.DAILY_RARITY[d.rar].motes; S.motes += m; S.quests.daily.done++; this.ev('claim', { text: 'Daily round', motes: m }); return true; };

  P.testCond = function (t) {
    var G = this, S = G.S;
    if (t.always) return true;
    if (t.stat) return S.healer.stats[t.stat] >= t.n || S.sab.count > 0;
    if (t.clears != null) return S.stats.clears >= t.clears;
    if (t.skillRank) return (S.skills[t.skillRank[0]] || {}).rank >= t.skillRank[1];
    if (t.anyUpgrade) return Object.keys(S.upgrades).some(function (k) { return S.upgrades[k] > 0; });
    if (t.strays != null) return S.stats.strays >= t.strays;
    if (t.equipped) return ML.GEAR_SLOTS.some(function (sl) { return S.equipped[sl.id]; }) || S.stats.mastered > 0;
    if (t.befriended) return G.befriended().length >= t.befriended;
    if (t.renown) return S.renown.level >= t.renown;
    if (t.ground) return ((S.grounds[t.ground[0]] || {}).level || 0) >= t.ground[1];
    if (t.dailies) return S.quests.daily.done >= t.dailies;
    if (t.level) return S.sab.bestLevel >= t.level || S.sab.count > 0;
    if (t.sabbaticals) return S.sab.count >= t.sabbaticals;
    if (t.healed) return S.stats.healed >= t.healed;
    if (t.overheal) return S.stats.overheal >= t.overheal;
    if (t.regionRank) return ML.SPECIES.filter(function (sp) { return sp.region === t.regionRank[0]; }).every(function (sp) { return S.companions[sp.id] && ML.rankOfTrust(S.companions[sp.id].trust) >= t.regionRank[1]; });
    if (t.flawless) return S.stats.flawless >= t.flawless;
    if (t.fledTotal) return S.stats.fledTotal >= t.fledTotal;
    if (t.gilded) return S.stats.gilded >= t.gilded;
    if (t.mastered) return Object.keys(S.mastery).length >= t.mastered;
    if (t.areaOpen) return !!S.opened[t.areaOpen];
    if (t.areaClear) return (S.areas[t.areaClear] || {}).clears > 0;
    if (t.anyRank) return Object.keys(S.companions).some(function (k) { return ML.rankOfTrust(S.companions[k].trust) >= t.anyRank; });
    if (t.missions) return S.stats.missions >= t.missions;
    if (t.region != null) return G.regionOpen(t.region);
    if (t.line) return S.line.length >= t.line;
    return false;
  };
  P.befriended = function () { var S = this.S; return Object.keys(S.companions).filter(function (k) { return ML.rankOfTrust(S.companions[k].trust) >= 1; }); };
  P.currentGlobal = function () { var S = this.S; for (var i = 0; i < ML.GLOBAL_QUESTS.length; i++) if (S.quests.global[ML.GLOBAL_QUESTS[i].id] !== 'done') return ML.GLOBAL_QUESTS[i]; return null; };
  P.claimGlobal = function (id) {
    var G = this, S = G.S, q = G.currentGlobal(); if (!q || q.id !== id || !G.testCond(q.test)) return false;
    S.quests.global[id] = 'done'; var r = q.reward;
    if (r.exp) G.addExp(r.exp); if (r.gold) G.addGold(r.gold); if (r.motes) S.motes += r.motes; if (r.tab) S.tabs[r.tab] = true;
    if (r.flag) { S.flags[r.flag] = true; if (r.flag === 'autoAllot') S.healer.autoAllot = true; }
    if (r.upgrade && own(ML.UPGRADE_BY_ID, r.upgrade[0])) S.upgrades[r.upgrade[0]] = Math.max(S.upgrades[r.upgrade[0]] || 0, r.upgrade[1]);
    if (r.offering) S.offerings[r.offering[0]] += r.offering[1];
    if (r.mats) ML.REGIONS[0].mats.forEach(function (m) { S.mats[m] = (S.mats[m] || 0) + r.mats; });
    G.ev('global', { id: id, why: q.why, name: q.name }); G.recalc(); return true;
  };
  P.periodic = function () {
    var G = this, S = G.S;
    ML.LEDGER.forEach(function (l) { if (!S.ledger[l.id] && G.testCond(l.test)) { S.ledger[l.id] = true; S.motes += l.motes; G.ev('ledger', { id: l.id, why: l.why, motes: l.motes, cond: l.cond }); } });
    ML.TITLE_QUESTS.forEach(function (t) {
      if (S.quests.titles[t.id] || !G.testCond(t.test)) return; S.quests.titles[t.id] = true; var r = t.reward;
      if (r.slot) S.skillSlots = Math.min(5, S.skillSlots + r.slot); if (r.accept) S.quests.acceptMax += r.accept; if (r.charm2) S.charm2 = true;
      if (r.eff) Object.keys(r.eff).forEach(function (k) { S.titleEff[k] = (S.titleEff[k] || 0) + r.eff[k]; });
      if (r.slot) ML.SKILLS.forEach(function (sk) { if (S.skills[sk.id] && S.slots.indexOf(sk.id) < 0 && S.slots.length < S.skillSlots) S.slots.push(sk.id); });
      G.ev('title', { id: t.id, name: t.name, text: t.text }); G.recalc();
    });
    if (S.tabs.gear !== true && S.inv.length) S.tabs.gear = true;
    G.ensureDaily(); G.refreshGeneral();
    if (S.autoWear !== 'off') G.wearBest(S.autoWear);
    if (S.store.favorites) G.autoQuests();
    G.gearTick(1);
    if (S.sab.auto && S.store.autosab && S.healer.level >= S.sab.autoLevel && G.canSabbatical()) G.sabbatical();
    S.lastSeen = G.clock();
  };
  P.autoQuests = function () {
    var G = this, S = G.S, q = S.quests.general;
    Object.keys(q).forEach(function (k) { if (q[k].active && q[k].prog >= G.generalInfo(k).need) G.claimGeneral(k); });
    var region = ML.REGIONS[G.area().region].id;
    Object.keys(q).sort(function (a, b) { return (b.indexOf(region) === 0) - (a.indexOf(region) === 0); }).forEach(function (k) { if (!q[k].active && q[k].tier < 3) G.acceptGeneral(k); });
    S.quests.daily.list.forEach(function (d, i) { if (!d.claimed && d.prog >= d.need) G.claimDaily(i); });
    if (S.store.favorites) { var g = G.currentGlobal(); if (g && S.sab.count > 0 && G.testCond(g.test)) G.claimGlobal(g.id); }
  };
  // titleEff is derived from claimed titles on load
  P.afterLoad = function () {
    var G = this, S = G.S;
    ML.TITLE_QUESTS.forEach(function (t) { if (S.quests.titles[t.id] && !G.testCond(t.test)) delete S.quests.titles[t.id]; });   // a title the stats cannot justify is not a title
    G.rebuildTitles(); G.recalc();
    S.helpers = S.helpers.slice(0, G.D.helperSlots); S.line = S.line.slice(0, G.D.lineSlots); S.queue = S.queue.slice(0, G.D.queueSize);
    var act = G.activeGeneral(); act.slice(S.quests.acceptMax).forEach(function (k) { S.quests.general[k].active = false; S.quests.general[k].prog = 0; });
    Object.keys(S.quests.general).forEach(function (k) { var q = S.quests.general[k]; q.prog = Math.min(q.prog, 1e9); });
    S.gold = Math.min(S.gold, G.D.goldCap); G.recalc(); G.startArea();
  };
  P.rebuildTitles = function () {
    var S = this.S; S.titleEff = {}; S.skillSlots = 2; S.quests.acceptMax = 3; S.charm2 = false;
    ML.TITLE_QUESTS.forEach(function (t) {
      if (!S.quests.titles[t.id]) return; var r = t.reward;
      if (r.eff) Object.keys(r.eff).forEach(function (k) { S.titleEff[k] = (S.titleEff[k] || 0) + r.eff[k]; });
      if (r.slot) S.skillSlots += r.slot; if (r.accept) S.quests.acceptMax += r.accept; if (r.charm2) S.charm2 = true;
    });
    S.slots = S.slots.slice(0, S.skillSlots);
    if (!S.charm2 && S.equipped.charm2) { S.inv.push(S.equipped.charm2); S.equipped.charm2 = null; }
  };

  /* ---------- actions ---------- */
  P.allot = function (stat, n) { var h = this.S.healer; if (n == null) n = 1; if (!posInt(n) || !own(h.stats, stat)) return false; n = Math.min(n, h.points); if (n < 1) return false; h.stats[stat] += n; h.points -= n; this.recalc(); return true; };
  P.respec = function () { var h = this.S.healer, t = 0; ML.STATS.forEach(function (s) { t += h.stats[s.id]; h.stats[s.id] = 0; }); h.points += t; this.recalc(); return true; };
  P.skillCost = function (id) { if (!own(ML.SKILL_BY_ID, id) || !own(this.S.skills, id)) return Infinity; return ML.costAt(ML.SKILL_BY_ID[id], this.S.skills[id].rank - 1); };
  P.buySkillRank = function (id) { var S = this.S; if (!own(S.skills, id) || !own(ML.SKILL_BY_ID, id)) return false; var st = S.skills[id]; if (st.rank >= ML.SKILL_MAX_RANK) return false; var c = this.skillCost(id); if (S.gold < c) return false; S.gold -= c; st.rank++; return true; };
  P.toggleSlot = function (id) { var S = this.S, i = S.slots.indexOf(id); if (!own(S.skills, id) || !own(ML.SKILL_BY_ID, id)) return false; if (i >= 0) { if (S.slots.length <= 1) return false; S.slots.splice(i, 1); } else { if (S.slots.length >= S.skillSlots) return false; S.slots.push(id); } return true; };
  P.toggleAuto = function (id) { if (!own(this.S.skills, id)) return false; var st = this.S.skills[id]; st.auto = !st.auto; return true; };
  P.upgradeCost = function (id) { if (!own(ML.UPGRADE_BY_ID, id)) return Infinity; return ML.costAt(ML.UPGRADE_BY_ID[id], this.S.upgrades[id] || 0); };
  P.buyUpgrade = function (id) { var S = this.S; if (!own(ML.UPGRADE_BY_ID, id)) return false; var u = ML.UPGRADE_BY_ID[id]; var lv = S.upgrades[id] || 0; if (lv >= u.max) return false; var c = this.upgradeCost(id); if (S.gold < c) return false; S.gold -= c; S.upgrades[id] = lv + 1; this.recalc(); return true; };
  P.queueUpgrade = function (id) { var S = this.S; if (!own(ML.UPGRADE_BY_ID, id) || S.queue.length >= this.D.queueSize) return false; S.queue.push(id); this.runQueue(); return true; };
  P.unqueue = function (id) { var S = this.S, i = S.queue.lastIndexOf(id); if (i < 0) return false; S.queue.splice(i, 1); return true; };
  P.runQueue = function () { var S = this.S, guard = 0; while (S.queue.length && guard++ < 50) { var id = S.queue[0]; if (!own(ML.UPGRADE_BY_ID, id) || (S.upgrades[id] || 0) >= ML.UPGRADE_BY_ID[id].max) { S.queue.shift(); continue; } if (S.gold >= this.upgradeCost(id)) { this.buyUpgrade(id); S.queue.shift(); this.ev('queued', { id: id }); } else break; } };
  P.setLine = function (ids) { var G = this, S = G.S; ids = uniq(arr(ids)).filter(function (id) { return own(S.companions, id) && own(ML.SPECIES_BY_ID, id) && ML.rankOfTrust(S.companions[id].trust) >= 1; }).slice(0, G.D.lineSlots); if (!ids.length) return false; S.line = ids; G.startArea(); return true; };
  P.toggleLine = function (id) { if (!own(ML.SPECIES_BY_ID, id)) return false; var S = this.S, l = S.line.slice(), i = l.indexOf(id); if (i >= 0) { if (l.length <= 1) return false; l.splice(i, 1); } else { if (l.length >= this.D.lineSlots) return false; l.push(id); } return this.setLine(l); };
  P.moveLine = function (id, dir) { var l = this.S.line.slice(), i = l.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= l.length) return false; var t = l[i]; l[i] = l[j]; l[j] = t; return this.setLine(l); };
  P.toggleHelper = function (id) { var S = this.S; if (!own(ML.SPECIES_BY_ID, id) || !own(S.companions, id)) return false; var sp = ML.SPECIES_BY_ID[id], c = S.companions[id]; if (!sp.active || ML.rankOfTrust(c.trust) < sp.active.rank) return false; var i = S.helpers.indexOf(id); if (i >= 0) S.helpers.splice(i, 1); else { if (S.helpers.length >= this.D.helperSlots) return false; S.helpers.push(id); } this.recalc(); return true; };
  // surplus materials -> coin. Never sells past the coin cap, so nothing is wasted and the cap still bounds it.
  ML.matValue = function (m) { var a = ML.AREAS.filter(function (x) { return x.mat === m; })[0]; return a ? Math.max(1, Math.ceil(ML.raiderGold(ML.REGIONS[a.region].levels[0]) * 0.5)) : 0; };
  P.sellMats = function (m, n) { var S = this.S; if (!own(ML.MATS, m) || !posInt(n, 1e9)) return 0; var v = ML.matValue(m), have = Math.floor(S.mats[m] || 0), room = Math.max(0, this.D.goldCap - S.gold), k = Math.min(n, have, Math.floor(room / v)); if (!(k >= 1)) return 0; S.mats[m] -= k; this.addGold(k * v); S.stats.matsSold += k; return k; };
  P.buyOffering = function (color, n) { var S = this.S; if (!own(ML.OFFERING_COST, color) || !posInt(n, 1000)) return false; var c = ML.OFFERING_COST[color] * n; if (S.gold < c) return false; S.gold -= c; S.offerings[color] += n; return true; };
  P.renownSpend = function (id) { var S = this.S, a = ML.RENOWN.filter(function (x) { return x.id === id; })[0]; if (!a || S.renown.points < 1 || (S.renown.abilities[id] || 0) >= a.max) return false; S.renown.points--; S.renown.abilities[id] = (S.renown.abilities[id] || 0) + 1; this.recalc(); return true; };
  P.groundInfo = function (id) {
    var S = this.S, def = ML.GROUNDS.filter(function (x) { return x.id === id; })[0]; if (!def) return { def: null, locked: true, atCap: true, canRank: false, cost: {}, level: 0, rank: 0, cap: 0 };
    var st = S.grounds[id] || { level: 0, rank: 0 }, cap = ML.GROUND_BASE_CAP + st.rank * ML.GROUND_RANK_CAP;
    // sim-found friction: gates used to demand the PREVIOUS region's materials, sending players back to farm roads they had outgrown.
    // walk-found deadlock (0.1.0): the level tier could also run AHEAD of the deepest region the player can reach, so Lantern 5 demanded
    // Cinder materials that were locked behind a Waystone the same shortage was blocking. The tier is clamped to what is actually open.
    var tier = Math.min(st.level < 5 ? 0 : st.level < 11 ? 1 : 2, this.deepestOpenRegion()),
       reg = ML.REGIONS[tier], n = ML.groundCost(def, st.level), cost = ML.allocPool(S.mats, reg.mats, n * def.mats.length);
    return { def: def, level: st.level, rank: st.rank, cap: cap, cost: cost, locked: S.renown.level < def.renown, atCap: st.level >= cap, canRank: st.level >= cap && st.rank < ML.GROUND_MAX_RANK };
  };
  P.buildGround = function (id) { var S = this.S, g = this.groundInfo(id); if (!g.def || g.locked || g.atCap) return false; var ok = Object.keys(g.cost).every(function (m) { return (S.mats[m] || 0) >= g.cost[m]; }); if (!ok) return false; Object.keys(g.cost).forEach(function (m) { S.mats[m] -= g.cost[m]; }); S.grounds[id] = { level: g.level + 1, rank: g.rank }; this.recalc(); this.refreshGeneral(); return true; };
  P.rankGround = function (id) { var S = this.S, g = this.groundInfo(id); if (!g.canRank || S.keystones < ML.KEYSTONES_PER_RANK) return false; S.keystones -= ML.KEYSTONES_PER_RANK; S.grounds[id].rank++; return true; };
  P.storeCost = function (id) { var d = ML.STORE.filter(function (x) { return x.id === id; })[0]; return Math.ceil(d.cost * Math.pow(d.growth || 1, this.S.store[id] || 0)); };
  P.buyStore = function (id) { var S = this.S, d = ML.STORE.filter(function (x) { return x.id === id; })[0]; if (!d || (S.store[id] || 0) >= d.max) return false; var c = this.storeCost(id); if (S.motes < c) return false; S.motes -= c; S.store[id] = (S.store[id] || 0) + 1; this.recalc(); return true; };

  /* ---------- gear ---------- */
  P.gearTick = function (dt) {
    var G = this, S = G.S, mult = (1 + (G.eff.profPct || 0)) * (1 + G.area().level * 0.04);
    ML.GEAR_SLOTS.forEach(function (sl) {
      var it = S.equipped[sl.id]; if (!it || it.lv >= C.gearMaxLevel) return; it.p += dt * mult;
      var need = C.gearProfBase * Math.pow(C.gearProfGrowth, it.lv);
      while (it.lv < C.gearMaxLevel && it.p >= need) { it.p -= need; it.lv++; need = C.gearProfBase * Math.pow(C.gearProfGrowth, it.lv); if (it.lv >= C.gearMaxLevel && !S.mastery[it.t]) { S.mastery[it.t] = true; S.stats.mastered++; G.ev('mastery', { t: it.t }); } G.recalc(); }
    });
  };
  P.equip = function (itemId, slotId) {
    var S = this.S, i = -1; S.inv.forEach(function (it, k) { if (it.id === itemId) i = k; }); if (i < 0) return false;
    var it = S.inv[i], kind = ML.GEAR_BY_ID[it.t].slot; if (!slotId) slotId = kind === 'charm' ? (!S.equipped.charm1 ? 'charm1' : S.charm2 && !S.equipped.charm2 ? 'charm2' : 'charm1') : kind;
    if (typeof slotId !== 'string' || !ML.GEAR_SLOTS.some(function (sl) { return sl.id === slotId; })) return false;
    if ((kind === 'charm') !== (slotId.indexOf('charm') === 0) || (kind !== 'charm' && kind !== slotId) || (slotId === 'charm2' && !S.charm2)) return false;
    S.inv.splice(i, 1); if (S.equipped[slotId]) S.inv.push(S.equipped[slotId]); S.equipped[slotId] = it; this.recalc(); return true;
  };
  // Ranking only. Two definitions of "better", because in this game the strongest gift is often NOT the right one:
  // mastery is permanent and shared by every healer, so levelling an unmastered type is usually worth more than a bigger number today.
  P.gearScore = function (it) {
    var def = ML.GEAR_BY_ID[it.t]; if (!def) return 0;
    var m = ML.RARITY_MULT[it.r] * (1 + C.gearPerLevel * it.lv), t = 0;
    Object.keys(def.eff).forEach(function (k) { t += def.eff[k] * m * (ML.EFF_SCORE[k] || 50); });
    return t;
  };
  P.wearBest = function (mode) {
    var G = this, S = G.S, changed = 0, mastery = mode !== 'power';
    ML.GEAR_SLOTS.forEach(function (sl) {
      if (sl.id === 'charm2' && !S.charm2) return;
      var want = sl.id.indexOf('charm') === 0 ? 'charm' : sl.id;
      var pool = S.inv.filter(function (it) { return ML.GEAR_BY_ID[it.t] && ML.GEAR_BY_ID[it.t].slot === want; });
      var cur = S.equipped[sl.id]; if (cur) pool = pool.concat([cur]);
      if (!pool.length) return;
      var best = pool[0], bestScore = G.gearScore(best);
      pool.forEach(function (it) { var v = G.gearScore(it); if (v > bestScore) { best = it; bestScore = v; } });
      if (mastery) {
        var floor = bestScore * ML.MASTERY_FLOOR, pick = null, pickScore = -1;
        pool.forEach(function (it) {
          if (S.mastery[it.t] || it.lv >= C.gearMaxLevel) return;   // already permanent: nothing left to earn from wearing it
          var v = G.gearScore(it); if (v >= floor && v > pickScore) { pick = it; pickScore = v; }
        });
        if (pick) best = pick;
      }
      if (cur && best.id === cur.id) return;
      if (G.equip(best.id, sl.id)) changed++;
    });
    if (changed) G.recalc();
    return changed;
  };
  P.unequip = function (slotId) { var S = this.S; if (!own(S.equipped, slotId) || !S.equipped[slotId] || S.inv.length >= this.D.invSize) return false; S.inv.push(S.equipped[slotId]); S.equipped[slotId] = null; this.recalc(); return true; };
  // Unpicking a gift returns its region's materials as well as coin. Deliberately small: a gift is a rare drop, so this
  // can never out-earn farming the road that pays that material — it exists so a surplus region cannot starve a scarce one.
  ML.reclaimMat = function (t) { var def = ML.GEAR_BY_ID[t]; return ML.REGIONS[def.region].mats[ML.hash32(def.id) % 3]; };
  P.reclaimValue = function (it) { return Math.max(1, Math.ceil(2 * ML.RARITY_MULT[it.r] * (1 + 0.15 * it.lv))); };
  // Two gifts of one type and rarity become one of the next rarity, keeping the better proficiency.
  // At the top rarity they merge levels instead, so a duplicate is never dead weight.
  P.fusePartner = function (it) { var S = this.S; return S.inv.filter(function (x) { return x.id !== it.id && x.t === it.t && x.r === it.r; })[0] || null; };
  P.fuse = function (itemId) {
    var G = this, S = G.S, a = S.inv.filter(function (x) { return x.id === itemId; })[0]; if (!a) return null;
    var b = G.fusePartner(a); if (!b) return null;
    var top = a.r >= ML.RARITY.length - 1, keep = !!(S.favs[a.id] || S.favs[b.id]);
    var out = { id: S.gearSeq++, t: a.t, r: top ? a.r : a.r + 1, lv: top ? Math.min(C.gearMaxLevel, a.lv + b.lv) : Math.max(a.lv, b.lv), p: Math.max(a.p, b.p) };
    S.inv = S.inv.filter(function (x) { return x.id !== a.id && x.id !== b.id; });
    delete S.favs[a.id]; delete S.favs[b.id]; if (keep) S.favs[out.id] = true;
    S.inv.push(out); S.stats.fused++;
    if (out.lv >= C.gearMaxLevel && !S.mastery[out.t]) { S.mastery[out.t] = true; S.stats.mastered++; G.ev('mastery', { t: out.t }); }
    G.recalc(); return out;
  };
  P.fuseAll = function () { var G = this, k = 0, guard = 0; while (guard++ < 400) { var a = G.S.inv.filter(function (x) { return G.fusePartner(x); })[0]; if (!a || !G.fuse(a.id)) break; k++; } if (k && G.S.autoWear !== 'off') G.wearBest(G.S.autoWear); return k; };
  P.scrapValue = function (it, apply) { var v = Math.ceil(ML.raiderGold(ML.REGIONS[ML.GEAR_BY_ID[it.t].region].levels[3]) * 25 * ML.RARITY_MULT[it.r] * (1 + it.lv * 0.2)); if (apply) this.addGold(v); return v; };
  P.scrap = function (itemId) {
    var G = this, S = G.S;
    for (var i = 0; i < S.inv.length; i++) if (S.inv[i].id === itemId) {
      var it = S.inv.splice(i, 1)[0]; delete S.favs[itemId];
      G.scrapValue(it, true);
      var m = ML.reclaimMat(it.t), v = G.reclaimValue(it); S.mats[m] = (S.mats[m] || 0) + v; S.stats.reclaimed += v;
      G.lastReclaim = { mat: m, n: v };
      return true;
    }
    return false;
  };
  P.toggleFav = function (itemId) { var S = this.S; if (S.favs[itemId]) delete S.favs[itemId]; else if (S.inv.some(function (it) { return it.id === itemId; })) S.favs[itemId] = true; else return false; return true; };

  /* ---------- sabbatical ---------- */
  P.canSabbatical = function () { return this.S.healer.level >= C.sabbaticalLevel; };
  P.insightGain = function () { var S = this.S, l = S.healer.level; if (l < C.sabbaticalLevel) return 0; return Math.floor((Math.pow(l / 10, 2) + S.quests.generalClaimedCycle * 0.5) * (1 + (this.eff.insightPct || 0))); };
  P.sabbatical = function () {
    var G = this, S = G.S; if (!G.canSabbatical()) return false;
    var gain = G.insightGain(); S.insight += gain; S.sab.totalInsight += gain; S.sab.count++; S.sab.lastDuration = S.playTime - S.sab.cycleStart; S.sab.cycleStart = S.playTime;
    G.applyCycleStart();
    S.quests.general = {}; S.quests.generalClaimedCycle = 0; S.sab.keys = {};
    ML.GEAR_SLOTS.forEach(function (sl) { var it = S.equipped[sl.id]; if (it && it.lv < C.gearMaxLevel) { it.lv = 0; it.p = 0; } });
    S.inv.forEach(function (it) { if (it.lv < C.gearMaxLevel) { it.lv = 0; it.p = 0; } });
    S.areaId = 'hollow1'; G.retreatHold = 0; G.refreshGeneral(); G.recalc(); G.mana = G.D.manaMax; G.startArea(); G.ev('sabbatical', { gain: gain, count: S.sab.count }); return true;
  };
  P.applyCycleStart = function () { var S = this.S, h = S.healer, start = 1 + (S.sab.upgrades.headstart || 0) * 4; h.level = start; h.xp = 0; ML.STATS.forEach(function (s) { h.stats[s.id] = 0; }); h.points = start + (S.sab.upgrades.gifted || 0) * 3; h.allotStep = 0; if (h.autoAllot && S.flags.autoAllot) this.autoAllot(); };
  P.insightCost = function (id) { var d = ML.INSIGHT.filter(function (x) { return x.id === id; })[0]; return ML.costAt(d, this.S.sab.upgrades[id] || 0); };
  P.buyInsight = function (id) { var S = this.S, d = ML.INSIGHT.filter(function (x) { return x.id === id; })[0]; if (!d || (S.sab.upgrades[id] || 0) >= d.max) return false; var c = this.insightCost(id); if (S.insight < c) return false; S.insight -= c; S.sab.upgrades[id] = (S.sab.upgrades[id] || 0) + 1; if (id === 'gifted') S.healer.points += 3; this.recalc(); return true; };

  /* ---------- offline: analytic, consumed exactly once ---------- */
  P.offlinePreview = function (elapsedS) {
    var G = this, S = G.S, src = S.areaId, st = S.areas[src];
    // walk-found defect: leaving right after advancing to a brand-new road (no finished run there yet) used to grant NOTHING for the whole absence.
    // Fall back to the deepest road at or before this one that has a record — the line goes where it knows it can hold.
    if (!st || !st.emaT) { for (var i = ML.AREA_BY_ID[src].order - 1; i >= 0; i--) { var a2 = ML.AREAS[i]; if (S.areas[a2.id] && S.areas[a2.id].emaT) { src = a2.id; st = S.areas[src]; break; } } }
    if (!st || !st.emaT || !(elapsedS >= C.offlineMinS)) return null;
    var t = Math.min(elapsedS, G.D.offlineCap), cycles = t * G.D.offlineEff / st.emaT;
    return { seconds: t, raw: elapsedS, capped: elapsedS > G.D.offlineCap, cycles: cycles, gold: st.emaGold * cycles, exp: st.emaExp * cycles, mats: st.emaMat * cycles, mat: ML.AREA_BY_ID[src].mat, fled: st.emaFled * cycles, trust: (st.emaBase || 0) * cycles * (1 + (G.eff.trustPct || 0)),   // strays tended per run, WITHOUT the offering multiplier: nobody is there to hand out offerings
       heal: st.emaHeal * cycles, clears: cycles * st.emaOk, area: src, fellBack: src !== S.areaId, eff: G.D.offlineEff };
  };
  P.applyOffline = function (now) {
    var G = this, S = G.S; if (typeof now !== 'number' || !isFinite(now)) return null;
    var elapsed = (now - S.lastSeen) / 1000; S.lastSeen = now;   // window closed BEFORE granting: a second call grants nothing
    var p = G.offlinePreview(elapsed); if (!p) return null;
    var a = ML.AREA_BY_ID[p.area], gained = 0;
    for (var i = 0; i < 20; i++) gained += G.addGold(p.gold / 20);
    p.goldKept = gained; var lv0 = S.healer.level; G.addExp(p.exp); p.levels = S.healer.level - lv0;
    var sibs = ML.REGIONS[a.region].mats.filter(function (m) { return m !== a.mat; }), split = C.matSplit;
    S.mats[a.mat] = (S.mats[a.mat] || 0) + p.mats * (1 - split);
    p.side = {}; sibs.forEach(function (m) { var v = p.mats * split / sibs.length; S.mats[m] = (S.mats[m] || 0) + v; p.side[m] = v; });
    S.line.forEach(function (id) { G.addCompExp(id, p.exp * 0.5); var c = S.companions[id]; c.bondXp += p.heal / S.line.length * (1 + (G.eff.bondPct || 0)); var g = 0; while (c.bond < 200 && c.bondXp >= ML.bondFor(c.bond) * G.bondScale(id) && g++ < 300) { c.bondXp -= ML.bondFor(c.bond) * G.bondScale(id); c.bond++; } });
    if (p.trust > 0) G.addTrust(a.stray, p.trust);
    var fled = Math.floor(p.fled), clears = Math.floor(p.clears);
    S.stats.fledTotal += fled; S.stats.clears += clears; S.stats.healed += p.heal; G.areaStat(a.id).clears += clears;
    G.dailyProg('rout', fled); G.dailyProg('clear', clears); G.dailyProg('heal', p.heal);
    var q = S.quests.general, region = ML.REGIONS[a.region].id; Object.keys(q).forEach(function (k) { if (!q[k].active) return; var pp = k.split(':'); if (pp[1] === 'clear' && pp[2] === a.id) q[k].prog += clears; if (pp[1] === 'rout' && pp[0] === region && a.raiders.indexOf(pp[2]) >= 0) q[k].prog += Math.floor(fled / a.raiders.length); });
    G.gearTick(p.seconds * G.D.offlineEff); G.recalc(); G.startArea();
    return p;
  };

  /* ---------- persistence helpers (string in, string out — storage itself is the UI's job) ---------- */
  ML.serialize = function (S) { return JSON.stringify(S); };
  ML.exportString = function (S) { var json = ML.serialize(S); var b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64'); return 'MOSS1:' + b; };
  ML.importString = function (str) {
    if (typeof str !== 'string') return null; str = str.trim(); if (str.indexOf('MOSS1:') !== 0 || str.length > 4e6) return null;
    try { var b = str.slice(6), json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, 'base64').toString('utf8'); return ML.sanitizeSave(JSON.parse(json)); } catch (e) { return null; }
  };
  ML.loadGame = function (json, opts) { var S; try { S = ML.sanitizeSave(JSON.parse(json)); } catch (e) { S = null; } if (!S) return null; var G; try { G = new ML.Game(S, opts); G.afterLoad(); } catch (e) { return null; } return G; };
})(globalThis.ML = globalThis.ML || {});
