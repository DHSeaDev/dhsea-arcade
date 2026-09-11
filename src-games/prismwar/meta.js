/* Prismwar meta — collection, gacha (pity + duplicate protection + shards), quests, achievements, owner-signed redeem codes, ledger card, backup, storage. v0.2.0 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./cards.js'));
  else root.PrismwarMeta = factory(root.Prismwar, root.PrismwarCards);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, C) {
  'use strict';
  const NS = 'prismwar:';
  const MAX_COPIES = 3, DECK_SIZE = 40;
  const RARITY_W = { C: 62, U: 27, R: 9, S: 2 };   // per-slot weights, slot 5 is guaranteed Rare+
  const PITY_S = 12;                                  // Signature guaranteed within 12 packs
  const SHARD_DUST = { C: 5, U: 20, R: 60, S: 200 }; // dust from a 4th+ copy (~25% of craft, Hearthstone-shaped)
  const CRAFT = { C: 20, U: 80, R: 240, S: 800 };

  // ---------- Storage (chrome.storage.local if present, else localStorage, else memory) ----------
  const mem = {};
  const store = {
    async get(k) { const key = NS + k; try { if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) { const r = await chrome.storage.local.get(key); return r[key]; } if (typeof localStorage !== 'undefined') { const v = localStorage.getItem(key); return v == null ? undefined : JSON.parse(v); } } catch (e) { } return mem[key]; },
    async set(k, v) { const key = NS + k; try { if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) { await chrome.storage.local.set({ [key]: v }); return; } if (typeof localStorage !== 'undefined') { localStorage.setItem(key, JSON.stringify(v)); return; } } catch (e) { } mem[key] = v; },
  };
  let writeChain = Promise.resolve(); // serialize profile writes (read-modify-write race guard)
  function serialized(fn) { const p = writeChain.then(fn, fn); writeChain = p.catch(() => { }); return p; }

  // ---------- Profile ----------
  function hash32(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function b36(n) { return (n >>> 0).toString(36); }
  function newProfile(name) {
    const seed = hash32(name + ':' + Date.now() + ':' + Math.random());
    const pr = { v: 2, name: name || 'Player', seed, created: Date.now(), starter: null, tutorialDone: false, settings: { motion: true, sound: true, music: true, musicStyle: 'ambient', shake: true, difficulty: 'normal' }, collection: {}, streak: 0, lastWinDay: '', firstWinBonuses: 0, legends: {}, redeemed: {}, dust: 0, packs: 0, packsOpened: 0, sinceS: 0, wins: 0, losses: 0, games: 0, quests: {}, questDay: '', achievements: {}, decks: {}, stats: { damage: 0, castByColor: {}, wonWith: {} }, log: [], integrity: 'ok' };
    return pr;
  }
  // First run: the player picks ONE of the six mono-color starters; its cards are granted x3 (x1 for R/S) plus 3 packs.
  function chooseStarter(pr, name) { const s = C.STARTERS[name]; if (!s) throw new Error('unknown starter'); if (pr.starter) throw new Error('starter already chosen'); const cnt = {}; for (const id of s.deck) if (!id.startsWith('ws_')) cnt[id] = (cnt[id] || 0) + 1; for (const [id, n] of Object.entries(cnt)) pr.collection[id] = Math.min(MAX_COPIES, Math.max(pr.collection[id] || 0, n)); pr.decks[name] = s.deck.slice(); pr.starter = name; pr.packs += 3; pr.log.push('Starter chosen: ' + name + ' (+3 packs)'); return s; }
  function sanitizeProfile(raw) { // attacker-controlled storage → whitelist + clamp
    const pr = newProfile('Player'); if (!raw || typeof raw !== 'object') return pr;
    const num = (x, lo, hi, d) => (typeof x === 'number' && isFinite(x)) ? Math.max(lo, Math.min(hi, Math.floor(x))) : d;
    pr.name = typeof raw.name === 'string' ? (clipName(raw.name) || pr.name) : pr.name; pr.seed = num(raw.seed, 0, 4294967295, pr.seed); pr.created = num(raw.created, 0, 4e12, pr.created);
    pr.collection = {}; if (raw.collection && typeof raw.collection === 'object') for (const [k, v] of Object.entries(raw.collection)) if (ownableIds().includes(k)) pr.collection[k] = num(v, 0, MAX_COPIES, 0);
    pr.redeemed = {}; if (raw.redeemed && typeof raw.redeemed === 'object') for (const [k, v] of Object.entries(raw.redeemed)) if (/^[\w.-]{1,64}$/.test(k) && Object.keys(pr.redeemed).length < 500) pr.redeemed[k] = num(v, 0, 4e12, 0);
    // an Ascendant is owned ONLY if a redeemed code record grants it — a bare legends entry with no matching redeem is dropped
    pr.legends = {}; if (raw.legends && typeof raw.legends === 'object') for (const k of Object.keys(raw.legends)) if (C.ASCENDANTS.some(a => a.id === k) && typeof raw.legends[k] === 'string' && /^PWR1\.[\w-]+\.[\w-]+$/.test(raw.legends[k]) && raw.legends[k].length < 600) pr.legends[k] = raw.legends[k]; // value = the signed code itself; re-verified in loadProfile/importProfile
    for (const k of ['dust', 'packs', 'packsOpened', 'sinceS', 'wins', 'losses', 'games']) pr[k] = num(raw[k], 0, 1e6, 0);
    pr.sinceS = Math.min(pr.sinceS, PITY_S); pr.questDay = typeof raw.questDay === 'string' ? raw.questDay.slice(0, 10) : '';
    pr.quests = {}; if (raw.quests && typeof raw.quests === 'object') for (const q of QUESTS) if (raw.quests[q.id] && typeof raw.quests[q.id] === 'object') pr.quests[q.id] = { p: num(raw.quests[q.id].p, 0, q.n, 0), done: !!raw.quests[q.id].done };
    pr.achievements = {}; if (raw.achievements && typeof raw.achievements === 'object') for (const a of ACHIEVEMENTS) if (raw.achievements[a.id]) pr.achievements[a.id] = true;
    pr.decks = {}; if (raw.decks && typeof raw.decks === 'object') for (const [k, v] of Object.entries(raw.decks)) if (typeof k === 'string' && Array.isArray(v) && Object.keys(pr.decks).length < 20) pr.decks[k.slice(0, 30)] = v.filter(id => typeof id === 'string' && isKnown(id)).slice(0, DECK_SIZE);
    pr.stats = { damage: num(raw.stats && raw.stats.damage, 0, 1e9, 0), castByColor: {}, wonWith: {} };
    if (raw.stats && raw.stats.castByColor) for (const c of Object.keys(P.COLORS)) pr.stats.castByColor[c] = num(raw.stats.castByColor[c], 0, 1e9, 0);
    if (raw.stats && raw.stats.wonWith) for (const c of Object.keys(P.COLORS)) pr.stats.wonWith[c] = num(raw.stats.wonWith[c], 0, 1e9, 0);
    pr.log = Array.isArray(raw.log) ? raw.log.filter(x => typeof x === 'string').slice(-30) : [];
    pr.starter = typeof raw.starter === 'string' && C.STARTERS[raw.starter] ? raw.starter : null; pr.tutorialDone = !!raw.tutorialDone; pr.crafted = !!raw.crafted;
    const st = raw.settings && typeof raw.settings === 'object' ? raw.settings : {}; pr.settings = { motion: st.motion !== false, sound: st.sound !== false, music: st.music !== false, musicStyle: ['ambient', 'chiptune', 'synthwave'].includes(st.musicStyle) ? st.musicStyle : 'ambient', shake: st.shake !== false, difficulty: st.difficulty === 'easy' ? 'easy' : 'normal' };
    pr.streak = num(raw.streak, 0, 1e6, 0); pr.lastWinDay = typeof raw.lastWinDay === 'string' ? raw.lastWinDay.slice(0, 10) : ''; pr.firstWinBonuses = num(raw.firstWinBonuses, 0, 1e6, 0);
    // integrity: a save written by the game carries sig(profile sans sig); a mismatch marks the profile as edited outside the game (shown on the ledger card)
    pr.integrity = typeof raw.sig === 'string' && raw.sig === signProfile(raw) ? 'ok' : (raw.sig === undefined && !raw.v ? 'ok' : 'modified');
    return pr;
  }
  function signProfile(pr) { const o = Object.assign({}, pr); delete o.sig; delete o.integrity; return 'PWS1-' + b36(hash32(stableStringify(o) + '|' + (pr.seed >>> 0) + '|refraction')); }
  function stableStringify(v) { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'; return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'; }
  function isKnown(id) { try { P.card(id); return true; } catch (e) { return false; } }
  function ownableIds() { return C.SET.map(c => c.id); }
  async function loadProfile() { const raw = await store.get('profile'); const pr = sanitizeProfile(raw); await reverifyLegends(pr); return pr; }
  async function reverifyLegends(pr) { for (const [id, code] of Object.entries(pr.legends)) { const v = await verifyCode(code); if (!v.ok || v.payload.t !== 'legend' || v.payload.v !== id) { delete pr.legends[id]; pr.integrity = 'modified'; } } }
  async function saveProfile(pr) { return serialized(() => { pr.sig = signProfile(pr); return store.set('profile', pr); }); }
  // ---------- Backup / restore ----------
  function exportProfile(pr) { pr.sig = signProfile(pr); return JSON.stringify({ prismwar: 1, exported: new Date().toISOString(), profile: pr }, null, 1); }
  async function importProfile(text) { let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'Not a JSON backup.' }; } if (!o || o.prismwar !== 1 || !o.profile || typeof o.profile !== 'object') return { ok: false, error: 'Not a Prismwar backup file.' }; if (JSON.stringify(o).length > 200000) return { ok: false, error: 'Backup too large.' }; const pr = sanitizeProfile(o.profile); await reverifyLegends(pr); return { ok: true, profile: pr, integrity: pr.integrity }; }

  // ---------- Gacha ----------
  function packRng(pr, idx) { return { seed: (pr.seed ^ Math.imul(idx + 1, 0x9E3779B1)) | 0 }; }
  const PACK_ODDS = (() => { const tot = Object.values(RARITY_W).reduce((a, b) => a + b, 0); const pct = k => Math.round(RARITY_W[k] / tot * 1000) / 10; const rt = RARITY_W.R + RARITY_W.S; return { slots: 'Slots 1–3: any rarity · slot 4: Uncommon or better · slot 5: Rare or better', C: pct('C'), U: pct('U'), R: pct('R'), S: pct('S'), slot5R: Math.round(RARITY_W.R / rt * 1000) / 10, slot5S: Math.round(RARITY_W.S / rt * 1000) / 10 }; })();
  function rollRarity(r, minRare) { let w = Object.assign({}, RARITY_W); if (minRare) { w.C = 0; w.U = 0; } const tot = Object.values(w).reduce((a, b) => a + b, 0); let x = P.rng(r) * tot; for (const k of P.RARITIES) { x -= w[k]; if (x < 0) return k; } return 'C'; }
  function pool(rarity) { return C.SET.filter(c => c.rarity === rarity); }
  function openPack(pr) {
    if (pr.packs <= 0) throw new Error('no packs');
    pr.packs--; const idx = pr.packsOpened++; const r = packRng(pr, idx); const out = [];
    let gotS = false;
    for (let slot = 0; slot < 5; slot++) {
      let rar = rollRarity(r, slot === 4); if (slot === 3 && rar === 'C') rar = 'U'; // slot 4 is at least Uncommon
      if (slot === 4 && pr.sinceS >= PITY_S - 1 && !gotS) rar = 'S';
      // duplicate protection: prefer cards you own < MAX_COPIES within the rarity; fall through only when the rarity is complete
      let cands = pool(rar).filter(c => (pr.collection[c.id] || 0) < MAX_COPIES); let dup = false;
      if (!cands.length) { cands = pool(rar); dup = true; }
      const c = cands[P.rint(r, cands.length)];
      if (dup) { pr.dust += SHARD_DUST[rar]; out.push({ id: c.id, rarity: rar, dust: SHARD_DUST[rar] }); }
      else { pr.collection[c.id] = (pr.collection[c.id] || 0) + 1; out.push({ id: c.id, rarity: rar, isNew: pr.collection[c.id] === 1 }); }
      if (rar === 'S') gotS = true;
    }
    pr.sinceS = gotS ? 0 : pr.sinceS + 1;
    return out;
  }
  function craft(pr, id) { const c = P.card(id); if (!ownableIds().includes(id)) throw new Error('not craftable'); if ((pr.collection[id] || 0) >= MAX_COPIES) throw new Error('already at max'); if (pr.dust < CRAFT[c.rarity]) throw new Error('not enough dust'); pr.dust -= CRAFT[c.rarity]; pr.collection[id] = (pr.collection[id] || 0) + 1; }

  // ---------- Quests & achievements ----------
  const QUESTS = [
    { id: 'q_win', text: 'Win a match against the Rival', n: 1, reward: { packs: 1 }, on: (ev, d) => ev === 'win' ? 1 : 0 },
    { id: 'q_dmg', text: 'Deal 25 damage to the Rival across matches', n: 25, reward: { packs: 1 }, on: (ev, d) => ev === 'game' ? d.damage : 0 },
    { id: 'q_purple', text: 'Cast 6 Undertow (Purple) cards', n: 6, reward: { dust: 40 }, on: (ev, d) => ev === 'game' ? (d.castByColor.P || 0) : 0 },
    { id: 'q_ws', text: 'Play 7 Wellsprings in a single match', n: 1, reward: { dust: 30 }, on: (ev, d) => ev === 'game' && d.wellsprings >= 7 ? 1 : 0 },
    { id: 'q_healthy', text: 'Win a match with 15 or more life', n: 1, reward: { packs: 1 }, on: (ev, d) => ev === 'win' && d.life >= 15 ? 1 : 0 },
    { id: 'q_three', text: 'Play 3 matches', n: 3, reward: { packs: 1 }, on: (ev, d) => ev === 'game' ? 1 : 0 },
  ];
  const ACHIEVEMENTS = [
    { id: 'a_tutorial', text: 'Initiate — finish the tutorial', reward: { packs: 1 }, test: pr => !!pr.tutorialDone },
    { id: 'a_first', text: 'First Light — win your first match', reward: { packs: 2 }, test: pr => pr.wins >= 1 },
    { id: 'a_five', text: 'Refracted — win 5 matches', reward: { packs: 2 }, test: pr => pr.wins >= 5 },
    { id: 'a_twenty', text: 'Full Spectrum — win 20 matches', reward: { packs: 5 }, test: pr => pr.wins >= 20 },
    { id: 'a_collect30', text: 'Cabinet — own 60 different cards', reward: { packs: 1 }, test: pr => uniqueOwned(pr) >= 60 },
    { id: 'a_collect120', text: 'Half-Spectrum — own 120 different cards', reward: { packs: 3 }, test: pr => uniqueOwned(pr) >= 120 },
    { id: 'a_collect60', text: 'Complete Refraction — own all 240 set cards', reward: { dust: 1000 }, test: pr => uniqueOwned(pr) >= 240 },
    { id: 'a_craft', text: 'Prismsmith — craft a card', reward: { packs: 1 }, test: pr => !!pr.crafted },
    { id: 'a_redeem', text: 'Keybearer — redeem a code', reward: { packs: 1 }, test: pr => Object.keys(pr.redeemed).length >= 1 },
    { id: 'a_ascend', text: 'Ascendant — unlock a legendary Ascendant', reward: { dust: 200 }, test: pr => Object.keys(pr.legends).length >= 1 },
    { id: 'a_deck', text: 'Architect — save a deck of your own', reward: { packs: 1 }, test: pr => Object.keys(pr.decks).length >= 2 },
    { id: 'a_purplewin', text: 'Undertow Rising — win with a Purple deck', reward: { packs: 2 }, test: pr => (pr.stats.wonWith.P || 0) >= 1 },
    { id: 'a_packs10', text: 'Ten Refractions — open 10 packs', reward: { dust: 100 }, test: pr => pr.packsOpened >= 10 },
    { id: 'a_streak5', text: 'Unbroken — win 5 in a row', reward: { packs: 2 }, test: pr => pr.streak >= 5 },
    { id: 'a_daily7', text: 'Regular — claim 7 first-win-of-the-day bonuses', reward: { packs: 2 }, test: pr => pr.firstWinBonuses >= 7 },
  ];
  function uniqueOwned(pr) { return Object.values(pr.collection).filter(n => n > 0).length; }
  function dayKey(d) { d = d || new Date(); return d.toISOString().slice(0, 10); }
  function rotateQuests(pr, date) { const k = dayKey(date); if (pr.questDay === k) return false; pr.questDay = k; pr.quests = {}; const r = { seed: hash32(k + pr.seed) | 0 }; const ids = P.shuffle(r, QUESTS.map(q => q.id)).slice(0, 3); for (const id of ids) pr.quests[id] = { p: 0, done: false }; return true; }
  function activeQuests(pr) { return Object.keys(pr.quests).map(id => Object.assign({}, QUESTS.find(q => q.id === id), pr.quests[id])); }
  function grant(pr, reward, why) { if (reward.packs) pr.packs += reward.packs; if (reward.dust) pr.dust += reward.dust; pr.log.push(`${why}: +${reward.packs ? reward.packs + ' pack(s)' : ''}${reward.dust ? reward.dust + ' dust' : ''}`); if (pr.log.length > 30) pr.log.shift(); }
  function applyEvent(pr, ev, d) { // ev: 'game' (every finished game) | 'win'
    const got = [];
    for (const q of QUESTS) { const s = pr.quests[q.id]; if (!s || s.done) continue; s.p = Math.min(q.n, s.p + q.on(ev, d)); if (s.p >= q.n) { s.done = true; grant(pr, q.reward, 'Quest: ' + q.text); got.push(q); } }
    return got;
  }
  function checkAchievements(pr) { const got = []; for (const a of ACHIEVEMENTS) { if (!pr.achievements[a.id] && a.test(pr)) { pr.achievements[a.id] = true; grant(pr, a.reward, 'Achievement: ' + a.text); got.push(a); } } return got; }
  function recordGame(pr, g, humanPi, deckColors) { // called once per finished game
    const me = g.players[humanPi]; const won = g.winner === humanPi; pr.games++; if (won) pr.wins++; else if (g.winner !== 'draw') pr.losses++;
    pr.stats.damage += me.damageDealt; for (const [c, n] of Object.entries(me.castByColor)) pr.stats.castByColor[c] = (pr.stats.castByColor[c] || 0) + n;
    if (won) for (const c of deckColors || []) pr.stats.wonWith[c] = (pr.stats.wonWith[c] || 0) + 1;
    const d = { damage: me.damageDealt, castByColor: me.castByColor, wellsprings: me.wellspringsPlayed, life: me.life };
    const bonus = [];
    pr.dust += 5; bonus.push('+5 dust for playing'); // participation: every finished match pays a little
    if (won) { pr.streak++; const day = dayKey(); if (pr.lastWinDay !== day) { pr.lastWinDay = day; pr.packs += 1; pr.firstWinBonuses++; bonus.push('First win of the day: +1 pack'); } if (pr.streak % 3 === 0) { pr.dust += 50; bonus.push(`${pr.streak}-win streak: +50 dust`); } }
    else if (g.winner !== 'draw') pr.streak = 0;
    for (const b of bonus) { pr.log.push(b); if (pr.log.length > 30) pr.log.shift(); }
    const q = applyEvent(pr, 'game', d).concat(won ? applyEvent(pr, 'win', d) : []); const a = checkAchievements(pr);
    return { quests: q, achievements: a, bonus };
  }

  // ---------- Deck rules ----------
  function validateDeck(pr, deck) {
    const errs = []; if (deck.length !== DECK_SIZE) errs.push(`Deck must be exactly ${DECK_SIZE} cards (has ${deck.length}).`);
    const counts = {}; for (const id of deck) counts[id] = (counts[id] || 0) + 1;
    for (const [id, n] of Object.entries(counts)) { if (!isKnown(id)) { errs.push(`Unknown card ${id}.`); continue; } const c = P.card(id); if (c.type === 'Wellspring') continue; if (c.type === 'Ascendant') { if (!pr.legends[id]) errs.push(`${c.name}: not unlocked.`); if (n > 1) errs.push(`${c.name}: Ascendants are one per deck.`); continue; } if (n > MAX_COPIES) errs.push(`${c.name}: max ${MAX_COPIES} copies.`); const owned = pr.collection[id] || 0; if (n > owned) errs.push(`${c.name}: you own ${owned}.`); }
    const ws = deck.filter(id => P.card(id).type === 'Wellspring').length; if (ws < 12) errs.push(`At least 12 Wellsprings recommended (has ${ws}).`);
    return errs;
  }
  function deckColors(deck) { const s = new Set(); for (const id of deck) { const c = P.card(id); if (c.type !== 'Wellspring') s.add(c.color); } return [...s]; }

  // Balance budget (used by the set generator's sanity test): a card may spend 2 points per mana + 1.5
  const KW_COST = { drift: 1, swift: 1, trample: 1, guard: 0.5, rally: 0.5, bulwark: 1, reckless: -1, bond: 0.5, ignite: 1, gambit: 0.5, grow: 1.5, bloom: 0.5, toll: 0.5, foresee: 1, glimpse: 1, reclaim: 1, wither: 0.5, overrun: 1.5, ensnare: 2, foretell: 0.5 };
  function budgetOf(c) { return P.costTotal(c) * 2 + 1.5; }
  function spendOf(c) {
    if (c.type === 'Unit') { let s = c.v + c.r; for (const [k, n] of Object.entries(c.kw)) { s += KW_COST[k] || 0; if (['ignite', 'foresee', 'ensnare'].includes(k)) s += (n - 1) * 1.5; } return s; }
    const n = c.n || 0; switch (c.effect) { case 'damage': return n * 1.2 + 0.5; case 'draw': return n * 1.6; case 'pump': return n * 0.8 + 0.3; case 'heal': return n * 0.5; case 'discard': return n * 1.6; case 'steal': return 4 + n * 1.5; case 'counterGrow': return n * 1.2; case 'aura': return n * 1.6 + 0.5; case 'anthem': return 5 + n * 2; case 'regen': return 3 + n * 1.5; case 'exileTapped': return 4; case 'destroy': return 6.5; case 'bounce': return 3.5; case 'fight': return 5; case 'wellspring': return 3; default: return 99; }
  }
  // ---------- Owner-signed redeem codes (ECDSA P-256; only the PUBLIC key ships) ----------
  const PUBLIC_JWK = { kty: 'EC', crv: 'P-256', x: 'jDBDwH3GWNxy40g4MscNV-vb4KBIgZb2B4n3wcSE92s', y: 'kxryqk5lNG0iiTVeUiBcCu0bfxZWFkblDoMyydQ_S7E' };
  let pubKey = null;
  function b64uToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  async function verifyCode(code) {
    try {
      if (typeof code !== 'string' || code.length > 600) return { ok: false, error: 'That is not a Prismwar code.' };
      const parts = code.trim().split('.'); if (parts.length !== 3 || parts[0] !== 'PWR1') return { ok: false, error: 'That is not a Prismwar code.' };
      const subtle = (globalThis.crypto || {}).subtle; if (!subtle) return { ok: false, error: 'This browser cannot verify codes.' };
      pubKey = pubKey || await subtle.importKey('jwk', PUBLIC_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const body = b64uToBytes(parts[1]), sig = b64uToBytes(parts[2]);
      const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, sig, body); if (!valid) return { ok: false, error: 'Invalid code — the signature does not match.' };
      const p = JSON.parse(new TextDecoder().decode(body)); if (!p || typeof p.c !== 'string' || !/^[\w.-]{1,64}$/.test(p.c)) return { ok: false, error: 'Malformed code.' };
      if (p.exp && new Date(p.exp + 'T23:59:59Z') < new Date()) return { ok: false, error: 'This code has expired.' };
      if (!['legend', 'pack', 'dust', 'card'].includes(p.t)) return { ok: false, error: 'Unknown reward type.' };
      return { ok: true, payload: p };
    } catch (e) { return { ok: false, error: 'Could not read that code.' }; }
  }
  async function redeemCode(pr, code) {
    const v = await verifyCode(code); if (!v.ok) return v; const p = v.payload;
    if (pr.redeemed[p.c] !== undefined) return { ok: false, error: 'You already redeemed this code.' };
    let msg;
    if (p.t === 'legend') { const a = C.ASCENDANTS.find(x => x.id === p.v); if (!a) return { ok: false, error: 'Unknown Ascendant.' }; if (pr.legends[a.id]) return { ok: false, error: `${a.name} is already unlocked.` }; pr.legends[a.id] = code.trim(); msg = `Ascendant unlocked: ${a.name}`; }
    else if (p.t === 'pack') { const n = Math.max(1, Math.min(50, Math.floor(+p.v || 0))); pr.packs += n; msg = `+${n} pack${n > 1 ? 's' : ''}`; }
    else if (p.t === 'dust') { const n = Math.max(1, Math.min(5000, Math.floor(+p.v || 0))); pr.dust += n; msg = `+${n} dust`; }
    else { if (!ownableIds().includes(p.v)) return { ok: false, error: 'Unknown card.' }; const c = P.card(p.v); if ((pr.collection[c.id] || 0) >= MAX_COPIES) { pr.dust += SHARD_DUST[c.rarity]; msg = `${c.name} (already at max) → +${SHARD_DUST[c.rarity]} dust`; } else { pr.collection[c.id] = (pr.collection[c.id] || 0) + 1; msg = `Card: ${c.name}`; } }
    pr.redeemed[p.c] = Date.now(); pr.log.push('Code redeemed: ' + msg); if (pr.log.length > 30) pr.log.shift();
    return { ok: true, message: msg, payload: p };
  }
  // Deck codes — share a DECK (not a card) as one line: PWD1|name|id,id,... (no signature needed; a deck is only playable with cards you own)
  function encodeDeck(name, deck) { return `PWD1|${String(name).replace(/[|]/g, ' ').slice(0, 30)}|${deck.join(',')}`; }
  function decodeDeck(s) { if (typeof s !== 'string') return { ok: false, error: 'Not a deck code.' }; const parts = s.trim().split('|'); if (parts.length !== 3 || parts[0] !== 'PWD1') return { ok: false, error: 'Not a deck code.' }; const ids = parts[2].split(',').filter(Boolean); if (ids.length > DECK_SIZE || !ids.every(isKnown)) return { ok: false, error: 'Deck code contains unknown cards.' }; return { ok: true, name: parts[1].slice(0, 30) || 'Imported deck', deck: ids }; }

  // ---------- Ledger card (signed progress block for the dhseadev.online ledger page) ----------
  // Player names ride on the ledger card's first line and into a URL. Strip control characters (a newline would split the card) and never cut an emoji in half (a lone surrogate makes encodeURIComponent throw).
  function clipName(s) { return String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 24).replace(/[\uD800-\uDBFF]$/, '').trim(); }
  const LEDGER_DECKS = 6;   // the wall rejects cards over 1200 chars; 20 saved decks with 30-char names listed in full is ~900 on the Decks line alone
  function ledgerCard(pr, date) {
    const d = date || new Date(); const uniq = uniqueOwned(pr); const total = C.SET.length; const ach = Object.keys(pr.achievements).length; const leg = Object.keys(pr.legends).length;
    const names = Object.keys(pr.decks); const extra = names.length - LEDGER_DECKS;
    const decks = names.slice(0, LEDGER_DECKS).map(n => `${n} (${deckColors(pr.decks[n]).join('/')})`).concat(extra > 0 ? [`+${extra} more`] : []).join(', ') || '—';
    const lines = [
      `PRISMWAR LEDGER · ${pr.name} · ${dayKey(d)}`,
      `Collection ${uniq}/${total} (${Math.round(uniq / total * 100)}%) · Packs opened ${pr.packsOpened} · Dust ${pr.dust}`,
      `Record ${pr.wins}W-${pr.losses}L · Achievements ${ach}/${ACHIEVEMENTS.length} · Ascendants ${leg}/${C.ASCENDANTS.length}`,
      `Decks: ${decks}`,
    ].concat(pr.integrity === 'modified' ? ['Save was modified outside the game'] : []);
    const sig = b36(hash32(lines.join('\n') + '|' + pr.seed)).padStart(7, '0');
    return lines.concat([`Sig PWL1-${pr.integrity === 'modified' ? 'X' : ''}${sig}`]).join('\n');
  }

  return { PACK_ODDS, chooseStarter, signProfile, exportProfile, importProfile, verifyCode, redeemCode, encodeDeck, decodeDeck, PUBLIC_JWK, NS, MAX_COPIES, DECK_SIZE, RARITY_W, PITY_S, SHARD_DUST, CRAFT, QUESTS, ACHIEVEMENTS, store, newProfile, sanitizeProfile, loadProfile, saveProfile, openPack, craft, rotateQuests, activeQuests, applyEvent, checkAchievements, recordGame, validateDeck, deckColors, uniqueOwned, ledgerCard, clipName, hash32, budgetOf, spendOf };
});
