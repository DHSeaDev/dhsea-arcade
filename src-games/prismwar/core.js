/* Prismwar core — rules engine + AI. Pure data state, deterministic PRNG. No DOM, no chrome.*  v0.1.0 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Prismwar = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.3.0';
  const COLORS = { W: 'Order', U: 'Current', B: 'Ledger', R: 'Spark', G: 'Root', P: 'Undertow' };
  const KEYWORDS = {
    // static combat
    drift: 'Can only be blocked by units with Drift.',
    swift: 'Can attack the turn it arrives.',
    trample: 'Excess combat damage over a blocker carries to the opponent.',
    guard: 'Does not tap when attacking.',
    rally: '+1/+0 while attacking alongside another unit.',
    bulwark: 'Takes 1 less damage from each source.',
    reckless: 'Must attack each turn if able.',
    bond: '+1/+1 while you control another Purple unit.',
    // triggers (N = value)
    ignite: 'Arrives: deal N damage to the opponent.',
    gambit: 'Arrives: flip a coin — heads, it gets +2/+2.',
    grow: 'Start of your turn: +1/+1 counter.',
    bloom: 'Arrives: you may play an extra Wellspring this turn.',
    toll: 'Arrives: lose 2 life, draw a card.',
    foresee: 'Arrives: draw N, then discard down by 1.',
    glimpse: 'Arrives: opponent discards a random card.',
    reclaim: 'Dies: return a random Unit from your graveyard to hand.',
    wither: 'Dies: deal damage equal to its Vigor to the opponent.',
    overrun: 'Arrives: fights target enemy unit.',
    ensnare: 'Arrives: gain control of target enemy unit with Vigor ≤ N.',
    foretell: 'Ambush: may be played during the opponent\'s attack.',
  };
  // Effects for Actions / Reactions / Bonds / Relics — engine primitives only (custom codes can only use these)
  const EFFECTS = {
    damage: { desc: 'Deal N damage to target unit or opponent.', target: 'any' },
    exileTapped: { desc: 'Exile target tapped unit.', target: 'enemyUnitTapped' },
    destroy: { desc: 'Destroy target unit; its controller loses life equal to its Resolve.', target: 'enemyUnit' },
    bounce: { desc: 'Return target enemy unit to its owner\'s hand.', target: 'enemyUnit' },
    fight: { desc: 'Target your unit fights target enemy unit (your unit picked automatically: strongest).', target: 'enemyUnit' },
    draw: { desc: 'Draw N cards.', target: 'none' },
    pump: { desc: 'Target your unit gets +N/+N this turn.', target: 'ownUnit' },
    heal: { desc: 'Gain N life.', target: 'none' },
    discard: { desc: 'Opponent discards N random cards.', target: 'none' },
    steal: { desc: 'Gain control of target enemy unit with Vigor ≤ N.', target: 'enemyUnit' },
    counterGrow: { desc: 'Put N +1/+1 counters on target your unit.', target: 'ownUnit' },
    wellspring: { desc: 'Put a Wellspring of this card\'s color into play.', target: 'none' },
    // Bond (aura) statics
    aura: { desc: 'Attached unit gets +N/+N.', target: 'ownUnit' },
    // Relic statics
    anthem: { desc: 'Your units get +N/+0.', target: 'none' },
    regen: { desc: 'Start of your turn: gain N life.', target: 'none' },
  };
  const TYPES = ['Unit', 'Action', 'Reaction', 'Bond', 'Relic', 'Wellspring', 'Ascendant'];
  const RARITIES = ['C', 'U', 'R', 'S']; // 'L' = Ascendant (locked; never in packs)

  // ---------- PRNG (mulberry32) ----------
  function rng(state) { state.seed = (state.seed + 0x6D2B79F5) | 0; let t = state.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function rint(state, n) { return Math.floor(rng(state) * n); }
  function shuffle(state, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rint(state, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  // ---------- Card DB ----------
  let DB = {};
  function registerCards(list) { for (const c of list) { if (c.kw) Object.freeze(c.kw); DB[c.id] = Object.freeze(c); } }
  function card(id) { const c = DB[id]; if (!c) throw new Error('unknown card ' + id); return c; }
  function allCards() { return Object.values(DB); }
  function costTotal(c) { return (c.cost || 0) + (c.pips || 0); }

  // ---------- Game setup ----------
  function newGame(deckA, deckB, seed, opts) {
    opts = opts || {};
    const g = { v: VERSION, seed: seed | 0, turn: 0, active: 0, phase: 'main', winner: null, log: [], uid: 1, pending: null, names: [opts.nameA || 'You', opts.nameB || 'Rival'], difficulty: opts.difficulty || 'normal', players: [] };
    for (const [i, d] of [deckA, deckB].entries()) {
      const p = { life: 20, deck: shuffle(g, d.map(id => ({ id, u: g.uid++ }))), hand: [], board: [], grave: [], exile: [], wellspringDrops: 1, playedWellspring: 0, mana: {}, damageDealt: 0, castByColor: {}, wellspringsPlayed: 0 };
      g.players.push(p);
      for (let k = 0; k < 7; k++) drawCard(g, i);
    }
    // Smoothed opening hands: 2–4 Wellsprings AND at least one non-Wellspring costing ≤ 2. Redraw up to 3 times, then repair by swapping with the deck.
    for (const [i, p] of g.players.entries()) {
      const good = () => { const ws = p.hand.filter(c => card(c.id).type === 'Wellspring').length; const cheap = p.hand.some(c => { const cc = card(c.id); return cc.type !== 'Wellspring' && costTotal(cc) <= 2; }); return ws >= 2 && ws <= 4 && cheap; };
      for (let tries = 0; tries < 3 && !good(); tries++) { p.deck = shuffle(g, p.deck.concat(p.hand)); p.hand = []; for (let k = 0; k < 7; k++) drawCard(g, i); }
      if (!good()) repairHand(g, p);
    }
    startTurn(g, 0, true);
    return g;
  }
  function repairHand(g, p) {
    const isWs = c => card(c.id).type === 'Wellspring'; const swap = (handIdx, pred) => { const di = p.deck.findIndex(pred); if (di < 0 || handIdx < 0) return false; const h = p.hand[handIdx]; p.hand[handIdx] = p.deck[di]; p.deck[di] = h; return true; };
    let ws = p.hand.filter(isWs).length;
    while (ws < 2 && swap(p.hand.findIndex(c => !isWs(c) && costTotal(card(c.id)) > 2), c => isWs(c))) ws++;
    while (ws > 4 && swap(p.hand.findIndex(isWs), c => !isWs(c))) ws--;
    if (!p.hand.some(c => !isWs(c) && costTotal(card(c.id)) <= 2)) swap(p.hand.findIndex(c => !isWs(c)), c => !isWs(c) && costTotal(card(c.id)) <= 2);
    shuffle(g, p.deck);
  }
  function drawCard(g, pi) { const p = g.players[pi]; if (!p.deck.length) { p.life -= 2; log(g, `${g.names[pi]} has no cards to draw and loses 2 life`); checkWin(g); return null; } const c = p.deck.pop(); p.hand.push(c); return c; }
  function log(g, s) { g.log.push(`T${g.turn}: ${s}`); if (g.log.length > 400) g.log.shift(); }
  function opp(pi) { return 1 - pi; }
  function findUnit(g, u) { for (const [pi, p] of g.players.entries()) { const i = p.board.findIndex(x => x.u === u); if (i >= 0) return { pi, i, unit: p.board[i] }; } return null; }

  // ---------- Stats ----------
  function kw(unit, k) { const c = card(unit.id); const v = c.kw && c.kw[k]; if (v !== undefined) return v; if (unit.tempKw && unit.tempKw[k] !== undefined) return unit.tempKw[k]; return undefined; }
  function power(g, pi, unit, attacking) {
    const c = card(unit.id); let v = c.v + (unit.counters || 0) + (unit.tempPow || 0) + (unit.auraPow || 0);
    for (const r of g.players[pi].board) { const rc = card(r.id); if (rc.type === 'Relic' && rc.effect === 'anthem') v += rc.n; if (rc.type === 'Ascendant' && rc.static && rc.static.anthem) v += rc.static.anthem; }
    if (kw(unit, 'bond') !== undefined && g.players[pi].board.some(x => x.u !== unit.u && card(x.id).type === 'Unit' && card(x.id).color === 'P')) v += 1;
    if (attacking && kw(unit, 'rally') !== undefined) v += 1;
    return Math.max(0, v);
  }
  function toughness(g, pi, unit) {
    const c = card(unit.id); let r = c.r + (unit.counters || 0) + (unit.tempTou || 0) + (unit.auraTou || 0);
    if (kw(unit, 'bond') !== undefined && g.players[pi].board.some(x => x.u !== unit.u && card(x.id).type === 'Unit' && card(x.id).color === 'P')) r += 1;
    return r;
  }
  function isUnit(x) { return card(x.id).type === 'Unit'; }
  function units(g, pi) { return g.players[pi].board.filter(isUnit); }

  // ---------- Mana ----------
  function manaAvail(g, pi) { const p = g.players[pi]; const pool = {}; let total = 0; for (const b of p.board) { const c = card(b.id); if (c.type === 'Wellspring' && !b.tapped) { pool[c.color] = (pool[c.color] || 0) + 1; total++; } } return { pool, total }; }
  function canPay(g, pi, c) { const m = manaAvail(g, pi); if (c.type === 'Wellspring') return false; const need = costTotal(c); if (m.total < need) return false; if (c.pips && (m.pool[c.color] || 0) < c.pips) return false; return true; }
  function pay(g, pi, c) {
    const p = g.players[pi]; let pips = c.pips || 0, generic = c.cost || 0;
    const ws = p.board.filter(b => card(b.id).type === 'Wellspring' && !b.tapped);
    for (const b of ws) if (pips > 0 && card(b.id).color === c.color) { b.tapped = true; pips--; }
    // pay generic with off-color first
    const rest = ws.filter(b => !b.tapped).sort((a, b) => (card(a.id).color === c.color ? 1 : 0) - (card(b.id).color === c.color ? 1 : 0));
    for (const b of rest) if (generic > 0) { b.tapped = true; generic--; }
    if (pips > 0 || generic > 0) throw new Error('pay failed');
  }

  // ---------- Legality ----------
  function targetsFor(g, pi, c) {
    const o = opp(pi); const kind = c.type === 'Unit' ? (c.kw && c.kw.overrun !== undefined ? 'enemyUnit' : c.kw && c.kw.ensnare !== undefined ? 'enemyUnit' : 'none') : (EFFECTS[c.effect] || {}).target || 'none';
    const enemy = units(g, o).map(u => u.u), own = units(g, pi).map(u => u.u);
    switch (kind) {
      case 'any': return enemy.concat(['face']);
      case 'enemyUnit': { if (c.type === 'Unit' && c.kw.ensnare !== undefined) return units(g, o).filter(u => power(g, o, u) <= c.kw.ensnare).map(u => u.u); if (c.effect === 'steal') return units(g, o).filter(u => power(g, o, u) <= c.n).map(u => u.u); if (c.effect === 'fight' && !own.length) return []; return enemy; }
      case 'enemyUnitTapped': return units(g, o).filter(u => u.tapped).map(u => u.u);
      case 'ownUnit': return own;
      default: return [];
    }
  }
  function needsTarget(c) { const t = c.type === 'Unit' ? (c.kw && (c.kw.overrun !== undefined || c.kw.ensnare !== undefined)) : (EFFECTS[c.effect] || {}).target !== 'none' && c.effect; return !!t; }
  function playable(g, pi) {
    const p = g.players[pi]; const out = [];
    const myTurn = g.active === pi && (g.phase === 'main' || g.phase === 'main2');
    const ambush = g.phase === 'block' && g.active !== pi; // defender's reaction window
    for (const [hi, h] of p.hand.entries()) {
      const c = card(h.id);
      if (c.type === 'Wellspring') { if (myTurn && p.playedWellspring < p.wellspringDrops) out.push({ hi, targets: [] }); continue; }
      const instant = c.type === 'Reaction' || (c.type === 'Unit' && c.kw && c.kw.foretell !== undefined);
      if (!(myTurn || (ambush && instant))) continue;
      if (!canPay(g, pi, c)) continue;
      const t = targetsFor(g, pi, c);
      if (needsTarget(c) && !t.length) continue;
      out.push({ hi, targets: t });
    }
    return out;
  }

  // ---------- Playing cards ----------
  function play(g, pi, hi, target) {
    const p = g.players[pi]; const h = p.hand[hi]; if (!h) throw new Error('no card at ' + hi); const c = card(h.id);
    const legal = playable(g, pi).find(x => x.hi === hi); if (!legal) throw new Error('illegal play ' + c.name);
    if (needsTarget(c)) { if (target === undefined || !legal.targets.includes(target)) throw new Error('bad target for ' + c.name); }
    p.hand.splice(hi, 1);
    if (c.type === 'Wellspring') { p.board.push({ id: h.id, u: h.u, tapped: false }); p.playedWellspring++; p.wellspringsPlayed++; log(g, `${g.names[pi]} plays ${c.name}`); return; }
    pay(g, pi, c); p.castByColor[c.color] = (p.castByColor[c.color] || 0) + 1;
    log(g, `${g.names[pi]} casts ${c.name}${target !== undefined && target !== 'face' ? ' → ' + unitName(g, target) : target === 'face' ? ' → face' : ''}`);
    if (c.type === 'Unit') { const unit = { id: h.id, u: h.u, tapped: false, summoned: true, counters: 0 }; p.board.push(unit); arrive(g, pi, unit, target); }
    else if (c.type === 'Relic') { p.board.push({ id: h.id, u: h.u }); }
    else if (c.type === 'Ascendant') { p.board.push({ id: h.id, u: h.u, loyalty: c.loyalty, used: true }); } // arrives spent; first activation next turn
    else if (c.type === 'Bond') { const t = findUnit(g, target); if (!t) throw new Error('bond target gone'); t.unit.auraPow = (t.unit.auraPow || 0) + c.n; t.unit.auraTou = (t.unit.auraTou || 0) + c.n; t.unit.bonds = (t.unit.bonds || []).concat([h]); }
    else { resolveEffect(g, pi, c, target); p.grave.push(h); }
    checkWin(g);
  }
  function unitName(g, u) { const f = findUnit(g, u); return f ? card(f.unit.id).name : '?'; }
  function arrive(g, pi, unit, target) {
    const c = card(unit.id); const k = c.kw || {}; const o = opp(pi);
    if (k.ignite !== undefined) dealToFace(g, o, k.ignite, pi);
    if (k.gambit !== undefined) { if (rng(g) < 0.5) { unit.counters += 2; log(g, `${c.name}: heads! +2/+2`); } else log(g, `${c.name}: tails.`); }
    if (k.bloom !== undefined) g.players[pi].wellspringDrops++;
    if (k.toll !== undefined) { g.players[pi].life -= 2; drawCard(g, pi); }
    if (k.foresee !== undefined) { for (let i = 0; i < k.foresee; i++) drawCard(g, pi); discardWorst(g, pi); }
    if (k.glimpse !== undefined) discardRandom(g, o, 1);
    if (k.overrun !== undefined) fight(g, pi, unit.u, target);
    if (k.ensnare !== undefined) steal(g, pi, target);
  }
  function discardWorst(g, pi) { const p = g.players[pi]; if (!p.hand.length) return; let wi = 0, wv = 1e9; for (const [i, h] of p.hand.entries()) { const v = handValue(g, pi, card(h.id)); if (v < wv) { wv = v; wi = i; } } const [d] = p.hand.splice(wi, 1); p.grave.push(d); }
  function discardRandom(g, pi, n) { const p = g.players[pi]; for (let i = 0; i < n && p.hand.length; i++) { const [d] = p.hand.splice(rint(g, p.hand.length), 1); p.grave.push(d); log(g, `${g.names[pi]} discards ${card(d.id).name}`); } }
  function resolveEffect(g, pi, c, target) {
    const o = opp(pi); const n = c.n || 0;
    switch (c.effect) {
      case 'damage': if (target === 'face') dealToFace(g, o, n, pi); else damageUnit(g, target, n, pi); break;
      case 'exileTapped': { const t = findUnit(g, target); if (t) { g.players[t.pi].board.splice(t.i, 1); g.players[t.pi].exile.push({ id: t.unit.id, u: t.unit.u }); log(g, `${card(t.unit.id).name} is exiled`); } break; }
      case 'destroy': { const t = findUnit(g, target); if (t) { g.players[t.pi].life -= toughness(g, t.pi, t.unit); die(g, target, pi); } break; }
      case 'bounce': { const t = findUnit(g, target); if (t) { g.players[t.pi].board.splice(t.i, 1); g.players[t.pi].hand.push({ id: t.unit.id, u: t.unit.u }); log(g, `${card(t.unit.id).name} returns to hand`); } break; }
      case 'fight': { const mine = units(g, pi).sort((a, b) => power(g, pi, b) - power(g, pi, a))[0]; if (mine) fight(g, pi, mine.u, target); break; }
      case 'draw': for (let i = 0; i < n; i++) drawCard(g, pi); break;
      case 'pump': { const t = findUnit(g, target); if (t) { t.unit.tempPow = (t.unit.tempPow || 0) + n; t.unit.tempTou = (t.unit.tempTou || 0) + n; } break; }
      case 'heal': g.players[pi].life += n; break;
      case 'discard': discardRandom(g, o, n); break;
      case 'steal': steal(g, pi, target); break;
      case 'counterGrow': { const t = findUnit(g, target); if (t) t.unit.counters += n; break; }
      case 'wellspring': { g.players[pi].board.push({ id: 'ws_' + c.color, u: g.uid++, tapped: false }); g.players[pi].wellspringsPlayed++; break; }
      default: throw new Error('unknown effect ' + c.effect);
    }
  }
  function steal(g, pi, u) { const t = findUnit(g, u); if (!t || t.pi === pi) return; g.players[t.pi].board.splice(t.i, 1); t.unit.tapped = true; t.unit.summoned = true; g.players[pi].board.push(t.unit); log(g, `${g.names[pi]} ensnares ${card(t.unit.id).name}`); }
  function fight(g, pi, myU, theirU) { const a = findUnit(g, myU), b = findUnit(g, theirU); if (!a || !b) return; const pa = power(g, a.pi, a.unit), pb = power(g, b.pi, b.unit); damageUnit(g, theirU, pa, pi); damageUnit(g, myU, pb, opp(pi)); }
  function dealToFace(g, pi, n, src) { if (n <= 0) return; g.players[pi].life -= n; if (src !== undefined) g.players[src].damageDealt += n; log(g, `${g.names[pi]} takes ${n}`); checkWin(g); }
  function damageUnit(g, u, n, src) { const t = findUnit(g, u); if (!t) return; if (kw(t.unit, 'bulwark') !== undefined) n = Math.max(0, n - 1); if (n <= 0) return; t.unit.damage = (t.unit.damage || 0) + n; if (t.unit.damage >= toughness(g, t.pi, t.unit)) die(g, u, src); }
  function die(g, u, src) {
    const t = findUnit(g, u); if (!t) return; const p = g.players[t.pi]; p.board.splice(t.i, 1); const c = card(t.unit.id);
    p.grave.push({ id: t.unit.id, u: t.unit.u }); for (const b of (t.unit.bonds || [])) p.grave.push(b);
    log(g, `${c.name} dies`);
    if (c.kw && c.kw.wither !== undefined) dealToFace(g, opp(t.pi), power(g, t.pi, t.unit), t.pi);
    if (c.kw && c.kw.reclaim !== undefined) { const us = p.grave.filter(x => x.u !== t.unit.u && card(x.id).type === 'Unit'); if (us.length) { const pick = us[rint(g, us.length)]; p.grave.splice(p.grave.indexOf(pick), 1); p.hand.push(pick); log(g, `${c.name} reclaims ${card(pick.id).name}`); } }
    checkWin(g);
  }
  function checkWin(g) { if (g.winner !== null) return; const a = g.players[0].life <= 0, b = g.players[1].life <= 0; if (a && b) g.winner = 'draw'; else if (a) g.winner = 1; else if (b) g.winner = 0; if (g.winner !== null) { g.phase = 'over'; log(g, `Game over — ${g.winner === 'draw' ? 'draw' : g.names[g.winner] + ' wins'}`); } }

  // ---------- Turn structure ----------
  function startTurn(g, pi, first) {
    g.turn++; g.active = pi; g.phase = 'main'; g.pending = null; const p = g.players[pi];
    for (const b of p.board) { b.tapped = false; b.summoned = false; b.damage = 0; b.tempPow = 0; b.tempTou = 0; if (isUnit(b) && kw(b, 'grow') !== undefined) b.counters += 1; }
    for (const b of p.board) { const c = card(b.id); if (c.type === 'Relic' && c.effect === 'regen') p.life += c.n; if (c.type === 'Ascendant') { b.used = false; if (c.static && c.static.regen) p.life += c.static.regen; } }
    p.playedWellspring = 0; p.wellspringDrops = 1;
    if (!first) drawCard(g, pi);
    log(g, `— ${g.names[pi]}'s turn ${g.turn} —`);
  }
  function canAttack(g, pi, u) { return isUnit(u) && !u.tapped && !u.summoned || (isUnit(u) && !u.tapped && u.summoned && kw(u, 'swift') !== undefined); }
  function declareAttack(g, pi, attackers) {
    if (g.active !== pi || g.phase !== 'main') throw new Error('not your main phase');
    const legal = units(g, pi).filter(u => canAttack(g, pi, u)).map(u => u.u);
    for (const a of attackers) if (!legal.includes(a)) throw new Error('illegal attacker ' + a);
    for (const u of units(g, pi)) if (kw(u, 'reckless') !== undefined && legal.includes(u.u) && !attackers.includes(u.u)) { g.players[pi].life -= 1; log(g, `${card(u.id).name} is Reckless — its controller loses 1 for holding it back`); }
    if (!attackers.length) { g.phase = 'end'; endTurn(g); return; }
    for (const a of attackers) { const u = findUnit(g, a).unit; if (kw(u, 'guard') === undefined) u.tapped = true; }
    g.phase = 'block'; g.pending = { attackers: attackers.slice(), blocks: {} };
    log(g, `${g.names[pi]} attacks with ${attackers.map(a => unitName(g, a)).join(', ')}`);
    checkWin(g);
  }
  function declareBlocks(g, pi, blocks) { // blocks: {attackerU: blockerU}
    if (g.phase !== 'block' || g.active === pi) throw new Error('not blocking');
    const att = g.pending.attackers.filter(a => findUnit(g, a)); const used = new Set();
    for (const [a, b] of Object.entries(blocks)) {
      const au = +a; if (!att.includes(au)) throw new Error('not an attacker'); const bf = findUnit(g, b); if (!bf || bf.pi !== pi || bf.unit.tapped || !isUnit(bf.unit)) throw new Error('illegal blocker');
      if (used.has(b)) throw new Error('blocker used twice'); used.add(b);
      const au2 = findUnit(g, au).unit; if (kw(au2, 'drift') !== undefined && kw(bf.unit, 'drift') === undefined) throw new Error('cannot block Drift');
    }
    g.pending.blocks = Object.assign({}, blocks); resolveCombat(g);
  }
  function resolveCombat(g) {
    const pi = g.active, o = opp(pi); const { attackers, blocks } = g.pending; const attacking = attackers.length > 1;
    const dmg = []; // collect then apply (simultaneous)
    for (const a of attackers) {
      const af = findUnit(g, a); if (!af || af.pi !== pi) continue; const ap = power(g, pi, af.unit, attacking);
      const b = blocks[a]; const bf = b !== undefined ? findUnit(g, b) : null;
      if (bf && bf.pi === o) {
        const bt = toughness(g, o, bf.unit) - (bf.unit.damage || 0); const bp = power(g, o, bf.unit);
        let toUnit = ap, over = 0; if (kw(af.unit, 'trample') !== undefined && ap > bt) { over = ap - bt; toUnit = bt; }
        dmg.push({ unit: b, n: toUnit, src: pi }); if (over) dmg.push({ face: o, n: over, src: pi }); dmg.push({ unit: a, n: bp, src: o });
      } else dmg.push({ face: o, n: ap, src: pi });
    }
    const hurt = new Set(); for (const d of dmg) { if (d.face !== undefined) { dealToFace(g, d.face, d.n, d.src); if (d.n > 0) hurt.add(d.face); } else damageUnit(g, d.unit, d.n, d.src); }
    for (const hp of hurt) for (const b of g.players[hp].board.slice()) if (card(b.id).type === 'Ascendant') { b.loyalty -= 1; log(g, `${card(b.id).name} loses 1 loyalty`); if (b.loyalty <= 0) { g.players[hp].board.splice(g.players[hp].board.indexOf(b), 1); g.players[hp].grave.push({ id: b.id, u: b.u }); log(g, `${card(b.id).name} falls`); } }
    g.pending = null; if (g.winner === null) { g.phase = 'main2'; }
  }
  function endTurn(g) { if (g.winner !== null) return; const p = g.players[g.active]; while (p.hand.length > 8) discardWorst(g, g.active); startTurn(g, opp(g.active)); }
  function pass(g, pi) { if (g.active !== pi || g.phase === 'block' || g.phase === 'over') throw new Error('cannot pass'); if (g.phase === 'main') { declareAttack(g, pi, []); return; } endTurn(g); }

  // ---------- Ascendant activations ----------
  function abilityCard(c, which) { const ab = which === 'plus' ? c.plus : c.minus; return { type: 'Action', color: c.color, effect: ab.effect, n: ab.n, name: c.name }; }
  function activations(g, pi) { // [{u, which, targets}] available right now
    if (g.active !== pi || (g.phase !== 'main' && g.phase !== 'main2')) return []; const out = [];
    for (const b of g.players[pi].board) { const c = card(b.id); if (c.type !== 'Ascendant' || b.used) continue; for (const which of ['plus', 'minus']) { if (which === 'minus' && b.loyalty < c.minus.cost) continue; const ac = abilityCard(c, which); const t = targetsFor(g, pi, ac); if (needsTarget(ac) && !t.length) continue; out.push({ u: b.u, which, targets: t }); } }
    return out;
  }
  function activate(g, pi, u, which, target) {
    const ok = activations(g, pi).find(a => a.u === u && a.which === which); if (!ok) throw new Error('cannot activate');
    const f = findUnit(g, u); const c = card(f.unit.id); const ac = abilityCard(c, which); if (needsTarget(ac) && !ok.targets.includes(target)) throw new Error('bad target');
    f.unit.used = true; if (which === 'plus') f.unit.loyalty += 1; else f.unit.loyalty -= c.minus.cost;
    log(g, `${g.names[pi]} activates ${c.name} (${which === 'plus' ? '+1' : '−' + c.minus.cost})${target !== undefined && target !== 'face' ? ' → ' + unitName(g, target) : target === 'face' ? ' → face' : ''}`);
    resolveEffect(g, pi, ac, target);
    if (f.unit.loyalty <= 0) { const p = g.players[pi]; const i = p.board.indexOf(f.unit); if (i >= 0) { p.board.splice(i, 1); p.grave.push({ id: f.unit.id, u: f.unit.u }); log(g, `${c.name} falls`); } }
    checkWin(g);
  }
  // ---------- Evaluation (LOCM-style linear) ----------
  function unitValue(g, pi, u) { const c = card(u.id); let v = power(g, pi, u) * 1.0 + toughness(g, pi, u) * 0.8 - (u.damage || 0) * 0.5; const k = c.kw || {}; if (k.drift !== undefined) v += 1; if (k.trample !== undefined) v += 0.5; if (k.guard !== undefined) v += 0.5; if (k.grow !== undefined) v += 1.2; if (k.wither !== undefined) v += 0.5; if (k.reclaim !== undefined) v += 0.7; if (k.bulwark !== undefined) v += 0.7; return v; }
  function handValue(g, pi, c) { if (c.type === 'Wellspring') return 1.5; return 1 + costTotal(c) * 0.4; }
  function evaluate(g, pi) {
    if (g.winner === pi) return 1e6; if (g.winner === opp(pi)) return -1e6; if (g.winner === 'draw') return 0;
    const me = g.players[pi], op = g.players[opp(pi)]; let s = 0;
    s += (Math.min(me.life, 30) - Math.min(op.life, 30)) * 1.0;
    if (op.life <= 5) s += 6; if (me.life <= 5) s -= 6;
    for (const u of units(g, pi)) s += unitValue(g, pi, u) * 1.5; for (const u of units(g, opp(pi))) s -= unitValue(g, opp(pi), u) * 1.5;
    for (const b of me.board) { const c = card(b.id); if (c.type === 'Relic') s += 2; if (c.type === 'Wellspring') s += 0.6; if (c.type === 'Ascendant') s += 3 + b.loyalty * 0.6; }
    for (const b of op.board) { const c = card(b.id); if (c.type === 'Wellspring') s -= 0.6; if (c.type === 'Ascendant') s -= 3 + b.loyalty * 0.6; }
    s += me.hand.length * 0.5 - op.hand.length * 0.5;
    return s;
  }
  function clone(g) { return JSON.parse(JSON.stringify(g)); }

  // ---------- AI ----------
  function aiMain(g, pi) {
    let guard = 0;
    while (g.winner === null && guard++ < 30) {
      const opts = playable(g, pi); const acts = activations(g, pi); if (!opts.length && !acts.length) break;
      const base = evaluate(g, pi); let best = null, bestV = base + 0.05;
      for (const a of acts) { const tl = a.targets.length ? a.targets : [undefined]; for (const t of tl) { const s = clone(g); try { activate(s, pi, a.u, a.which, t); } catch (e) { continue; } const v = evaluate(s, pi) + (a.which === 'plus' ? 0.3 : 0); if (v > bestV) { bestV = v; best = { act: a, t }; } } }
      for (const o of opts) {
        const c = card(g.players[pi].hand[o.hi].id);
        if (c.type === 'Wellspring') { best = { hi: o.hi }; bestV = 1e5; break; } // always drop a wellspring first
        const tl = needsTarget(c) ? o.targets : [undefined];
        for (const t of tl) { const s = clone(g); try { play(s, pi, o.hi, t); } catch (e) { continue; } const v = evaluate(s, pi) - (c.type === 'Reaction' ? 1.5 : 0); if (v > bestV) { bestV = v; best = { hi: o.hi, t }; } }
      }
      if (!best) break;
      if (best.act) { activate(g, pi, best.act.u, best.act.which, best.t); continue; }
      if (easy(g) && bestV < 1e5 && rng(g) < 0.5) { const o = opts[rint(g, opts.length)]; const cc = card(g.players[pi].hand[o.hi].id); const t = needsTarget(cc) ? o.targets[rint(g, o.targets.length)] : undefined; try { play(g, pi, o.hi, t); continue; } catch (e) { } } // easy: half the time, a random legal play instead of the best one
      play(g, pi, best.hi, best.t);
    }
  }
  function aiAttack(g, pi) {
    const o = opp(pi); const mine = units(g, pi).filter(u => canAttack(g, pi, u)); const theirs = units(g, o).filter(u => !u.tapped);
    const opLife = g.players[o].life; const attackers = [];
    const total = mine.reduce((a, u) => a + power(g, pi, u, mine.length > 1), 0);
    const blockable = theirs.length;
    if (!easy(g) && total >= opLife + 2 && mine.length > blockable) { return mine.map(u => u.u); } // alpha strike when they cannot block enough
    for (const u of mine) {
      const ap = power(g, pi, u, true), at = toughness(g, pi, u);
      const drift = kw(u, 'drift') !== undefined;
      const killers = theirs.filter(b => (!drift || kw(b, 'drift') !== undefined) && power(g, o, b) >= at);
      const survivorsThatKill = killers.filter(b => toughness(g, o, b) > ap - (kw(b, 'bulwark') !== undefined ? 1 : 0));
      const aggressive = g.players[pi].life > opLife + 4 || opLife <= 8;
      if (kw(u, 'reckless') !== undefined) attackers.push(u.u);
      else if (!killers.length) attackers.push(u.u);
      else if (!survivorsThatKill.length && (aggressive || unitValue(g, pi, u) <= 3)) attackers.push(u.u); // trade acceptable
      else if (kw(u, 'guard') !== undefined && !killers.length) attackers.push(u.u);
    }
    return attackers;
  }
  function aiBlock(g, pi) {
    const o = opp(pi); const atts = g.pending.attackers.map(a => findUnit(g, a)).filter(f => f && f.pi === o).map(f => f.unit);
    const mine = units(g, pi).filter(u => !u.tapped); const blocks = {}; const used = new Set();
    const incoming = atts.reduce((a, u) => a + power(g, o, u, atts.length > 1), 0); const lethal = incoming >= g.players[pi].life;
    // sort attackers by power desc
    const order = atts.slice().sort((a, b) => power(g, o, b, true) - power(g, o, a, true));
    for (const a of order) {
      const ap = power(g, o, a, atts.length > 1), at = toughness(g, o, a) - (a.damage || 0); const drift = kw(a, 'drift') !== undefined;
      const cands = mine.filter(b => !used.has(b.u) && (!drift || kw(b, 'drift') !== undefined));
      // 1. block that kills and survives
      let pick = cands.find(b => power(g, pi, b) >= at && toughness(g, pi, b) - Math.max(0, ap - (kw(b, 'bulwark') !== undefined ? 1 : 0)) > 0);
      // 2. trade if attacker worth more
      if (!pick) pick = cands.find(b => power(g, pi, b) >= at && unitValue(g, pi, b) <= unitValue(g, o, a));
      // 3. chump only if lethal
      if (!pick && lethal) pick = cands.sort((x, y) => unitValue(g, pi, x) - unitValue(g, pi, y))[0];
      if (pick) { blocks[a.u] = pick.u; used.add(pick.u); }
    }
    return blocks;
  }
  function aiReact(g, pi) { // defender's ambush window: play foretell units / reactions if they improve position
    const opts = playable(g, pi); if (!opts.length) return; const base = evaluate(g, pi); let best = null, bestV = base + 1.0;
    for (const o of opts) { const c = card(g.players[pi].hand[o.hi].id); const tl = needsTarget(c) ? o.targets : [undefined]; for (const t of tl) { const s = clone(g); try { play(s, pi, o.hi, t); } catch (e) { continue; } const v = evaluate(s, pi); if (v > bestV) { bestV = v; best = { hi: o.hi, t }; } } }
    if (best) play(g, pi, best.hi, best.t);
  }
  function easy(g) { return g.difficulty === 'easy'; }
  function aiTurn(g, pi) { // full AI turn: main → attack → (opponent block handled by caller if human) → main2 → end
    if (g.active !== pi || g.phase !== 'main') return;
    aiMain(g, pi); if (g.winner !== null) return;
    const atk = aiAttack(g, pi); declareAttack(g, pi, atk);
  }
  function aiFinish(g, pi) { if (g.phase === 'main2' && g.active === pi) { aiMain(g, pi); if (g.winner === null) endTurn(g); } }
  function aiDefend(g, pi) { if (g.phase !== 'block' || g.active === pi) return; if (!easy(g)) aiReact(g, pi); if (g.winner !== null) return; if (g.phase !== 'block') return; declareBlocks(g, pi, easy(g) ? aiBlockEasy(g, pi) : aiBlock(g, pi)); }
  function aiBlockEasy(g, pi) { // easy: only chump-blocks when lethal, with the weakest unit
    const o = opp(pi); const atts = g.pending.attackers.map(a => findUnit(g, a)).filter(f => f && f.pi === o).map(f => f.unit); const mine = units(g, pi).filter(u => !u.tapped); const blocks = {}; const incoming = atts.reduce((a, u) => a + power(g, o, u, atts.length > 1), 0);
    if (incoming < g.players[pi].life) return blocks; const used = new Set();
    for (const a of atts.slice().sort((x, y) => power(g, o, y, true) - power(g, o, x, true))) { const b = mine.filter(u => !used.has(u.u) && (kw(a, 'drift') === undefined || kw(u, 'drift') !== undefined)).sort((x, y) => unitValue(g, pi, x) - unitValue(g, pi, y))[0]; if (b) { blocks[a.u] = b.u; used.add(b.u); } }
    return blocks; }
  // AI vs AI runner (for sim / tests)
  function simulate(deckA, deckB, seed, maxTurns) {
    const g = newGame(deckA, deckB, seed, { nameA: 'A', nameB: 'B' }); let guard = 0;
    while (g.winner === null && guard++ < (maxTurns || 60) * 4) {
      const pi = g.active;
      if (g.phase === 'main') aiTurn(g, pi);
      if (g.phase === 'block') aiDefend(g, opp(pi));
      if (g.phase === 'main2') aiFinish(g, pi);
      if (g.phase === 'end') endTurn(g);
    }
    if (g.winner === null) g.winner = 'draw';
    return g;
  }

  return { activations, activate, abilityCard, VERSION, COLORS, KEYWORDS, EFFECTS, TYPES, RARITIES, registerCards, card, allCards, costTotal, newGame, play, playable, targetsFor, needsTarget, declareAttack, declareBlocks, endTurn, pass, canAttack, power, toughness, units, manaAvail, evaluate, aiTurn, aiFinish, aiDefend, aiMain, aiAttack, aiBlock, simulate, clone, rng, rint, shuffle, findUnit, opp };
});
