/* Prismwar UI v0.3 — DOM only, no inline handlers, no innerHTML, no eval. Same file serves the arcade page and the extension tab. */
(function () {
  'use strict';
  const P = window.Prismwar, C = window.PrismwarCards, M = window.PrismwarMeta, A = window.PrismwarArt;
  const $ = (s, el) => (el || document).querySelector(s);
  const h = (tag, attrs, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'style') { for (const d of String(v).split(';')) { const i = d.indexOf(':'); if (i > 0) el.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim()); } } else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k)); return el; };
  const LEDGER_URL = 'https://dhseadev.online/prismwar-ledger/', WALL_URL = 'https://play.dhseadev.online/games/prismwar/ledger/';
  const TABS = [['play', 'Play'], ['decks', 'Decks'], ['collection', 'Collection'], ['packs', 'Packs'], ['quests', 'Quests'], ['redeem', 'Redeem'], ['ledger', 'Ledger'], ['rules', 'How to play'], ['settings', 'Settings']];
  const HUMAN = 0, AI = 1;
  let pr, tab = 'play', game = null, busy = false, aiBusy = false, tutorial = null, prevSnap = null, saveFailed = false;
  let sel = freshSel(), curDeck = null, deckName = '', playDeck = null, rivalName = null, lastPack = null, confirmConcede = false;
  const filt = { col: '', type: '', q: '', owned: false, rar: '' };
  function freshSel() { return { attackers: new Set(), pending: null, blockFrom: null, blocks: {} }; } // pending: {kind:'card',hi} | {kind:'abil',u,which}

  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms || 2600); }
  async function save() { try { await M.saveProfile(pr); saveFailed = false; } catch (e) { saveFailed = true; toast('Could not save your profile — storage is unavailable. Export a backup from Settings.', 5000); } wallet(); }
  function wallet() { $('#wallet').textContent = `${pr.name} · ${pr.starter ? M.uniqueOwned(pr) + '/' + C.SET.length + ' cards · ' : ''}${pr.packs} pack${pr.packs === 1 ? '' : 's'} · ${pr.dust} dust · ${pr.wins}W-${pr.losses}L${saveFailed ? ' · NOT SAVING' : ''}`; }
  function setTitle(s) { document.title = (s ? s + ' — ' : '') + 'Prismwar'; }

  // ---------- Card element ----------
  const RAR = { C: 'COMMON', U: 'UNCOMMON', R: 'RARE', S: 'SIGNATURE', L: 'ASCENDANT' };
  function cardEl(c, opts) {
    opts = opts || {}; const act = !!opts.onclick; const flip = !act && !opts.noFlip;
    const el = h('div', { class: `card ${c.color}${opts.mini ? ' mini' : ''}${c.type === 'Wellspring' ? ' ws' : ''}${c.type === 'Ascendant' ? ' asc' : ''}${opts.cls ? ' ' + opts.cls : ''}`, role: act || flip ? 'button' : undefined, tabindex: act || flip ? 0 : undefined, 'aria-label': ariaCard(c, opts) + (flip ? ' Activate to flip; shift-activate to enlarge.' : act ? ' Shift-activate to enlarge.' : ''), 'data-key': opts.key });
    const front = h('div', { class: 'cf front' }), back = h('div', { class: 'cf back' });
    if (c.type === 'Wellspring') front.append(h('img', { class: 'art', src: A.dataUri(c), alt: '', width: 120, height: 70, draggable: 'false' }), h('div', { class: 'name', text: c.name }));
    else {
      front.append(h('div', { class: 'head' }, h('div', { class: 'name', text: c.name }), h('div', { class: 'cost', text: costStr(c) })), h('img', { class: 'art', src: A.dataUri(c), alt: '', width: 120, height: 70, draggable: 'false' }), h('div', { class: 'type', text: `${c.type} · ${P.COLORS[c.color]}` }), h('div', { class: 'text', text: c.text || '' }),
        h('div', { class: 'foot' }, h('span', { class: 'rar', title: RAR[c.rarity] || '', text: opts.mini ? (c.rarity || '') : (RAR[c.rarity] || '') }), opts.count !== undefined ? h('span', { class: 'cnt', text: opts.count }) : h('span'), c.type === 'Unit' ? h('span', { class: 'vr', text: opts.vr || `${c.v}/${c.r}` }) : c.type === 'Ascendant' ? h('span', { class: 'vr loy', text: '◈' + (opts.loyalty !== undefined ? opts.loyalty : c.loyalty) }) : h('span')));
      back.append(h('div', { class: 'head' }, h('div', { class: 'name', text: c.name }), h('div', { class: 'cost', text: costStr(c) })), h('div', { class: 'type', text: `${c.type} · ${P.COLORS[c.color]} · ${RAR[c.rarity] || ''}` }), h('div', { class: 'btext' }, c.text || ''), h('div', { class: 'gloss' }, keywordLines(c)), c.flavor ? h('div', { class: 'flavor', text: c.flavor }) : null, h('div', { class: 'foot' }, h('span', { class: 'rar', text: howToGet(c) })));
      if (!opts.mini) front.append(h('button', { class: 'info', type: 'button', 'aria-label': 'Inspect ' + c.name, title: 'Inspect (flip / enlarge)', text: 'ⓘ', onclick: e => { e.stopPropagation(); openModal(c, opts); } }));
    }
    if (c.type === 'Wellspring' && opts.count !== undefined) front.append(h('div', { class: 'cnt', text: opts.count }));
    el.append(front, back);
    const activate = e => { if (e && e.shiftKey) { e.preventDefault(); openModal(c, opts); return; } if (act) opts.onclick(e); else if (flip && c.type !== 'Wellspring') el.classList.toggle('flipped'); };
    if (act || flip) { el.addEventListener('click', activate); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e); } }); }
    return el;
  }
  function keywordLines(c) { const out = []; if (c.type === 'Unit') for (const k of Object.keys(c.kw || {})) out.push(h('div', {}, h('b', { text: k[0].toUpperCase() + k.slice(1) + ': ' }), P.KEYWORDS[k])); else if (c.type === 'Ascendant') { out.push(h('div', {}, h('b', { text: 'Loyalty: ' }), 'starts at ' + c.loyalty + '; −1 whenever you take combat damage; falls at 0.')); if (c.static) out.push(h('div', {}, h('b', { text: 'Static: ' }), Object.entries(c.static).map(([k, n]) => k === 'anthem' ? `your units get +${n}/+0` : `gain ${n} life at the start of your turn`).join(', '))); } else if (c.effect && P.EFFECTS[c.effect]) out.push(h('div', {}, h('b', { text: c.type + ': ' }), c.type === 'Reaction' ? 'playable on your turn or as an ambush while the Rival attacks.' : c.type === 'Bond' ? 'attaches to one of your units and stays.' : c.type === 'Relic' ? 'a permanent with a standing effect.' : 'one-shot, your turn only.')); return out; }
  function howToGet(c) { if (c.type === 'Ascendant') return 'Unlock: code from DHSeaDev'; if (c.type === 'Wellspring') return 'Always available'; return `Packs · craft ${M.CRAFT[c.rarity]} dust`; }
  // ---------- Modal (shift-click / ⓘ): enlarged card with a flip control ----------
  function openModal(c, opts) {
    closeModal(); const big = cardEl(c, { vr: opts && opts.vr, loyalty: opts && opts.loyalty, noFlip: true, cls: 'big' }); big.removeAttribute('data-key');
    const m = h('div', { id: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.name, onclick: e => { if (e.target === m) closeModal(); } }, h('div', { class: 'modal-inner' }, big, h('div', { class: 'row' }, h('button', { class: 'btn primary', 'data-key': 'mflip', text: 'Flip', onclick: () => big.classList.toggle('flipped') }), h('button', { class: 'btn', text: 'Close (Esc)', onclick: closeModal }))));
    document.body.append(m); m.querySelector('[data-key="mflip"]').focus();
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }
  function costStr(c) { return ((c.cost ? c.cost : '') + (c.pips ? c.color.repeat(c.pips) : '')) || '0'; }
  function ariaCard(c, o) { return `${c.name}, ${c.type}, cost ${costStr(c)}${c.type === 'Unit' ? `, ${o.vr || c.v + '/' + c.r}` : c.type === 'Ascendant' ? `, loyalty ${o.loyalty !== undefined ? o.loyalty : c.loyalty}` : ''}. ${c.text || ''}${o.state ? ' ' + o.state : ''}`; }

  // ---------- Render with focus restoration + error boundary ----------
  function render() {
    const focusKey = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-key');
    try {
      document.body.classList.toggle('no-motion', !pr.settings.motion);
      const v = $('#view'); v.replaceChildren();
      if (!pr.starter) { $('#tabs').replaceChildren(); wallet(); setTitle('Choose a starter'); renderStarterPick(v); return; }
      renderTabs(); wallet(); v.setAttribute('role', 'tabpanel'); v.setAttribute('aria-labelledby', 'tab-' + tab);
      ({ play: renderPlay, decks: renderDecks, collection: renderCollection, packs: renderPacks, quests: renderQuests, redeem: renderRedeem, ledger: renderLedger, rules: renderRules, settings: renderSettings })[tab](v);
      if (tab !== 'play') setTitle(TABS.find(t => t[0] === tab)[1]);
    } catch (e) {
      const v = $('#view'); v.replaceChildren(h('section', { class: 'panel' }, h('h2', { text: 'Something went wrong on this screen' }), h('p', { class: 'small mute', text: String(e && e.message || e) }), h('div', { class: 'row' }, h('button', { class: 'btn primary', text: 'Back to lobby', onclick: () => { game = null; tutorial = null; sel = freshSel(); tab = 'play'; render(); } }), h('button', { class: 'btn', text: 'Export backup', onclick: exportBackup }))));
    }
    if (focusKey) { const el = document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`); if (el) el.focus({ preventScroll: true }); }
  }
  function renderTabs() { const n = $('#tabs'); n.replaceChildren(...TABS.map(([id, label]) => h('button', { role: 'tab', id: 'tab-' + id, 'aria-selected': tab === id ? 'true' : 'false', 'aria-controls': 'view', 'data-key': 'tab-' + id, text: label, onclick: () => { tab = id; render(); } }))); }

  // ---------- FIRST RUN: pick a starter ----------
  function renderStarterPick(v) {
    v.append(h('section', { class: 'panel' }, h('h2', { text: 'Choose your starter' }), h('p', { class: 'mute', text: 'Eight ready-to-play decks built from commons — six single-color, two two-color. You get the full 40-card deck, 3 packs, and a guided first match. Every card in the set can be collected later through quests, packs and crafting.' }),
      h('div', { class: 'starters' }, Object.entries(C.STARTERS).map(([name, st]) => { const face = P.card(st.deck.find(id => !id.startsWith('ws_') && P.card(id).type === 'Unit') || st.deck[0]); return h('div', { class: 'starter ' + st.color }, cardEl(face, { noFlip: true }), h('div', { class: 'grow' }, h('h3', { text: name }), h('p', { class: 'small mute', text: `${st.archetype} · ${st.colors.map(c => P.COLORS[c]).join(' + ')}` }), h('p', { class: 'small', text: st.blurb }), h('button', { class: 'btn primary', 'data-key': 'starter-' + name, text: `Start with ${name}`, onclick: async () => { M.chooseStarter(pr, name); M.rotateQuests(pr); await save(); sfx('win'); tab = 'play'; render(); toast(`${name} is yours. The guided tutorial is the best first match.`, 4500); } }))); }))));
  }

  // ---------- Animations (board diff) + SFX ----------
  function snapshot(g) { const s = { life: [g.players[0].life, g.players[1].life], units: {} }; for (const p of g.players) for (const b of p.board) s.units[b.u] = b.damage || 0; return s; }
  function animClass(b) { if (!prevSnap || !pr.settings.motion) return ''; if (!(b.u in prevSnap.units)) return ' enter'; if ((b.damage || 0) > prevSnap.units[b.u]) return ' hit'; return ''; }
  function lifePop(pi, lifeEl) { if (!prevSnap || !game || !lifeEl) return; const d = game.players[pi].life - prevSnap.life[pi]; if (!d) return; lifeEl.append(h('span', { class: 'pop ' + (d < 0 ? 'neg' : 'pos'), text: (d > 0 ? '+' : '') + d, 'aria-hidden': 'true' })); if (d < 0) { sfx('hit'); shake(pi === HUMAN && d <= -4 ? 'm' : 's'); } }
  const AU = window.PrismwarAudio;
  function sfx(kind) { if (!pr || !pr.settings.sound || !AU) return; AU.sfx(kind); }
  function musicSync() { if (!AU || !pr) return; if (pr.settings.music) { if (!AU.isRunning()) AU.start(pr.settings.musicStyle); else AU.setStyle(pr.settings.musicStyle); } else AU.stop(); }
  let gestured = false; for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { if (gestured) return; gestured = true; musicSync(); }, { passive: true });
  function shake(kind) { if (!pr.settings.motion || !pr.settings.shake) return; document.body.classList.remove('shake-s', 'shake-m'); void document.body.offsetWidth; document.body.classList.add(kind === 'm' ? 'shake-m' : 'shake-s'); setTimeout(() => document.body.classList.remove('shake-s', 'shake-m'), 450); }
  function burst(el, color) { if (!pr.settings.motion || !el) return; const r = el.getBoundingClientRect(); const wrap = h('div', { class: 'burst', 'aria-hidden': 'true' }); for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70; wrap.append(h('i', { style: `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;background:var(--${color || 'P'})` })); } document.body.append(wrap); setTimeout(() => wrap.remove(), 900); }
  // ---------- PLAY ----------
  function rivals() { return Object.assign({}, C.PRECONS, C.STARTERS); }
  function renderPlay(v) {
    if (!game) {
      setTitle('Lobby'); const deckNames = Object.keys(pr.decks); if (!deckNames.includes(playDeck)) playDeck = deckNames[0]; const rv = rivals(); if (!rv[rivalName]) rivalName = Object.keys(rv)[0];
      const errs = playDeck ? M.validateDeck(pr, pr.decks[playDeck]) : ['No deck.'];
      v.append(h('section', { class: 'panel' }, h('h2', { text: 'Challenge the Rival' }),
        h('div', { class: 'row' }, h('label', {}, 'Your deck ', h('select', { 'data-key': 'deck-sel', onchange: e => { playDeck = e.target.value; render(); } }, deckNames.map(n => h('option', { value: n, selected: n === playDeck, text: `${n} (${M.deckColors(pr.decks[n]).join('/')})` })))),
          h('label', {}, 'Rival deck ', h('select', { 'data-key': 'rival-sel', onchange: e => { rivalName = e.target.value; } }, Object.keys(rv).map(n => h('option', { value: n, selected: n === rivalName, text: `${n} (${rv[n].colors.join('/')})` })))),
          h('span', { class: 'pill', text: 'Difficulty: ' + pr.settings.difficulty })),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', 'data-key': 'start', disabled: errs.length > 0, text: 'Start match', onclick: () => startGame(false) }), h('button', { class: 'btn', 'data-key': 'tut', text: pr.tutorialDone ? 'Replay the tutorial' : 'Tutorial — guided first match', onclick: () => startGame(true) }), h('button', { class: 'btn', text: 'Copy deck code', onclick: () => copyText(M.encodeDeck(playDeck, pr.decks[playDeck]), 'Deck code copied.') })),
        errs.length ? h('p', { class: 'small warn', text: 'Fix your deck first: ' + errs.join(' ') }) : h('p', { class: 'mute small', text: 'You go first. Play a Wellspring every turn, cast units, attack. Reactions and Foretell units can ambush during the Rival\'s attack.' })));
      if (pr.log.length) v.append(h('section', { class: 'panel' }, h('h3', { text: 'Recent rewards' }), h('ul', { class: 'small' }, pr.log.slice(-6).reverse().map(l => h('li', { text: l })))));
      return;
    }
    const g = game, me = g.players[HUMAN], op = g.players[AI]; const myTurn = g.active === HUMAN; const blocking = g.phase === 'block' && g.active === AI;
    const pl = (myTurn && (g.phase === 'main' || g.phase === 'main2')) || blocking ? P.playable(g, HUMAN) : []; const plMap = new Map(pl.map(x => [x.hi, x.targets]));
    const acts = myTurn ? P.activations(g, HUMAN) : [];
    const targeting = pendingTargets();
    const status = g.winner !== null ? (g.winner === HUMAN ? 'You win!' : g.winner === AI ? 'The Rival wins.' : 'Draw.') : blocking ? 'The Rival attacks — assign blockers (click an attacker, then your blocker), play ambush cards, then Confirm.' : aiBusy ? 'Rival is thinking…' : myTurn ? (g.phase === 'main' ? 'Your turn — play cards, then choose attackers or end the turn.' : 'Second main phase — play more cards, then End turn.') : 'Rival is thinking…';
    setTitle(g.winner !== null ? 'Match over' : blocking ? 'Block!' : myTurn ? 'Your turn' : 'Rival\'s turn');
    const face = t => h('span', { class: 'face' + (targeting && targeting.includes('face') ? ' targetable' : ''), role: targeting && targeting.includes('face') ? 'button' : undefined, tabindex: targeting && targeting.includes('face') ? 0 : undefined, 'data-key': 'face', text: t, onclick: () => { if (targeting && targeting.includes('face')) resolvePending('face'); } });
    const board = h('div', { class: 'board' });
    board.append(h('section', { class: 'side rival', 'aria-label': 'Rival' },
      h('div', { class: 'status' }, h('span', { class: 'life', text: `Rival ${Math.max(0, op.life)}` }), h('span', { class: 'pill', text: `Hand ${op.hand.length}` }), h('span', { class: 'pill', text: `Deck ${op.deck.length}` }), h('span', { class: 'pill', text: `Grave ${op.grave.length}` }), face('Rival (face)')),
      h('div', { class: 'fan' }, op.board.filter(b => P.card(b.id).type === 'Wellspring').map(b => cardEl(P.card(b.id), { cls: b.tapped ? 'tapped' : '', key: 'u' + b.u }))),
      h('div', { class: 'fan' }, op.board.filter(b => P.card(b.id).type !== 'Wellspring').map(b => unitEl(b, AI, acts)))));
    board.append(h('section', { class: 'side me', 'aria-label': 'You' },
      h('div', { class: 'fan' }, me.board.filter(b => P.card(b.id).type !== 'Wellspring').map(b => unitEl(b, HUMAN, acts))),
      h('div', { class: 'fan' }, me.board.filter(b => P.card(b.id).type === 'Wellspring').map(b => cardEl(P.card(b.id), { cls: b.tapped ? 'tapped' : '', key: 'u' + b.u }))),
      h('div', { class: 'status' }, h('span', { class: 'life', text: `You ${Math.max(0, me.life)}` }), h('span', { class: 'pill', text: `Mana ${P.manaAvail(g, HUMAN).total}` }), h('span', { class: 'pill', text: `Deck ${me.deck.length}` }), h('span', { class: 'pill', text: `Grave ${me.grave.length}` }), h('span', { class: 'pill', text: `Turn ${g.turn}` }), me.hand.length >= 8 ? h('span', { class: 'pill warn', text: 'Hand full — extras are discarded at end of turn' }) : null),
      h('div', { class: 'fan', 'aria-label': 'Your hand' }, me.hand.map((c, hi) => { const cd = P.card(c.id); const ok = plMap.has(hi); return cardEl(cd, { key: 'h' + c.u, cls: (ok ? 'playable' : 'dim') + (sel.pending && sel.pending.kind === 'card' && sel.pending.hi === hi ? ' sel' : ''), state: ok ? 'Playable.' : 'Not playable now.', onclick: () => onHand(hi) }); }))));
    const controls = h('div', { class: 'row' }); const unused = P.manaAvail(g, HUMAN).total;
    if (g.winner !== null) controls.append(h('button', { class: 'btn primary', 'data-key': 'lobby', text: 'Back to lobby', onclick: () => { game = null; tutorial = null; render(); } }));
    else if (blocking) controls.append(h('button', { class: 'btn primary', 'data-key': 'confirm', text: 'Confirm blocks', onclick: confirmBlocks }), h('button', { class: 'btn', text: 'Clear blocks', onclick: () => { sel.blocks = {}; sel.blockFrom = null; render(); } }));
    else if (myTurn && g.phase === 'main' && !aiBusy) controls.append(h('button', { class: 'btn primary', 'data-key': 'attack', text: sel.attackers.size ? `Attack with ${sel.attackers.size}` : `End turn (no attack)${unused && pl.length ? ' · ' + unused + ' mana unused' : ''}`, onclick: doAttack }), h('button', { class: 'btn', 'data-key': 'selall', text: 'Select all attackers', onclick: () => { for (const u of P.units(g, HUMAN)) if (P.canAttack(g, HUMAN, u)) sel.attackers.add(u.u); render(); } }));
    else if (myTurn && g.phase === 'main2' && !aiBusy) controls.append(h('button', { class: 'btn primary', 'data-key': 'end', text: `End turn${unused && pl.length ? ' · ' + unused + ' mana unused' : ''}`, onclick: () => { P.endTurn(g); afterHuman(); } }));
    if (sel.pending) controls.append(h('button', { class: 'btn', 'data-key': 'cancel', text: 'Cancel target (Esc)', onclick: () => { sel.pending = null; render(); } }));
    if (g.winner === null) controls.append(h('button', { class: 'btn', 'data-key': 'concede', text: confirmConcede ? 'Really concede?' : 'Concede', onclick: () => { if (!confirmConcede) { confirmConcede = true; render(); setTimeout(() => { confirmConcede = false; if (game) render(); }, 3000); return; } confirmConcede = false; g.players[HUMAN].life = 0; g.winner = AI; g.phase = 'over'; finishGame(); } }));
    if (tutorial) v.append(coachPanel(g));
    v.append(h('section', { class: 'panel' }, h('p', { role: 'status', 'aria-live': 'polite', text: status }), controls), board);
    if (g.winner !== null) v.append(summaryPanel(g));
    v.append(h('section', { class: 'panel' }, h('h3', { text: 'Log' }), h('div', { class: 'log' }, g.log.slice(-40).reverse().map(l => h('div', { text: l })))));
    lifePop(AI, $('.side.rival .life')); lifePop(HUMAN, $('.side.me .life')); prevSnap = snapshot(g);
    if (AU) AU.setIntensity(Math.min(1, 0.25 + (20 - Math.min(me.life, op.life)) / 20 * 0.6 + (g.turn / 30) * 0.2));
  }
  function summaryPanel(g) { const me = g.players[HUMAN]; return h('section', { class: 'panel' }, h('h3', { text: 'Match summary' }), h('p', { text: `${g.turn} turns · you dealt ${me.damageDealt} damage · ${me.wellspringsPlayed} Wellsprings · ${Object.entries(me.castByColor).map(([c, n]) => n + ' ' + P.COLORS[c]).join(', ') || 'no spells'} cast · finished at ${Math.max(0, me.life)} life.` }), h('div', { class: 'row' }, h('button', { class: 'btn', 'data-key': 'toledger', text: 'Update the Ledger ↗', onclick: () => { tab = 'ledger'; render(); toast('Your ledger card reflects this match. Post it to the wall or download the picture.'); } }))); }
  function pendingTargets() { if (!sel.pending) return null; const g = game; if (sel.pending.kind === 'card') return (P.playable(g, HUMAN).find(x => x.hi === sel.pending.hi) || { targets: [] }).targets; return (P.activations(g, HUMAN).find(a => a.u === sel.pending.u && a.which === sel.pending.which) || { targets: [] }).targets; }
  function unitEl(b, pi, acts) {
    const g = game; const c = P.card(b.id); const isU = c.type === 'Unit'; const targeting = pendingTargets();
    let cls = (b.tapped ? 'tapped' : '') + animClass(b); let state = b.tapped ? 'Tapped.' : '';
    if (targeting && targeting.includes(b.u)) { cls += ' targetable'; state += ' Valid target.'; }
    if (pi === HUMAN && sel.attackers.has(b.u)) { cls += ' attacker'; state += ' Attacking.'; }
    if (g.phase === 'block' && g.pending && g.pending.attackers.includes(b.u)) { cls += ' attacker'; state += ' Attacking you.'; if (sel.blockFrom === b.u) cls += ' sel'; }
    if (pi === HUMAN && Object.values(sel.blocks).includes(b.u)) { cls += ' blocking'; state += ' Blocking.'; }
    const vr = isU ? `${P.power(g, pi, b)}/${P.toughness(g, pi, b) - (b.damage || 0)}` : undefined;
    const el = cardEl(c, { cls, vr, state, key: 'u' + b.u, loyalty: b.loyalty, onclick: () => onUnit(b, pi) });
    if (c.type === 'Ascendant' && pi === HUMAN) { const mine = acts.filter(a => a.u === b.u); if (mine.length) el.append(h('div', { class: 'abil' }, mine.map(a => h('button', { class: 'btn tiny', 'data-key': 'ab' + b.u + a.which, text: a.which === 'plus' ? '+1' : '−' + c.minus.cost, title: P.EFFECTS[c[a.which].effect].desc.replace('N', c[a.which].n), onclick: e => { e.stopPropagation(); if (a.targets.length) { sel.pending = { kind: 'abil', u: b.u, which: a.which }; toast('Choose a target.'); render(); } else doActivate(b.u, a.which); } })))); else if (b.used) el.append(h('div', { class: 'abil mute small', text: 'used this turn' })); }
    return el;
  }
  function onHand(hi) { const g = game; const pl = P.playable(g, HUMAN).find(x => x.hi === hi); if (!pl) { toast('That card cannot be played right now.'); return; } const c = P.card(g.players[HUMAN].hand[hi].id); if (P.needsTarget(c)) { sel.pending = { kind: 'card', hi }; toast(`Choose a target for ${c.name}.`); render(); return; } doPlay(hi, undefined); }
  function resolvePending(target) { const p = sel.pending; if (!p) return; if (p.kind === 'card') doPlay(p.hi, target); else doActivate(p.u, p.which, target); }
  function doPlay(hi, target) { const g = game; const c = P.card(g.players[HUMAN].hand[hi].id); const srcEl = document.querySelector(`[data-key="h${g.players[HUMAN].hand[hi].u}"]`); try { P.play(g, HUMAN, hi, target); sfx(c.type === 'Ascendant' ? 'legend' : 'play'); burst(srcEl, c.color); if (c.type === 'Ascendant') shake('m'); tutMark(c.type === 'Wellspring' ? 'ws' : c.type === 'Unit' ? 'unit' : 'spell'); if (target !== undefined) tutMark('target'); if (g.phase === 'block') tutMark('ambush'); } catch (e) { toast(e.message); } sel.pending = null; if (g.winner !== null) finishGame(); else render(); }
  function doActivate(u, which, target) { const g = game; try { P.activate(g, HUMAN, u, which, target); sfx('legend'); } catch (e) { toast(e.message); } sel.pending = null; if (g.winner !== null) finishGame(); else render(); }
  function onUnit(b, pi) {
    const g = game;
    if (sel.pending) { const t = pendingTargets(); if (t.includes(b.u)) resolvePending(b.u); else toast('Not a valid target.'); return; }
    if (g.phase === 'block' && g.active === AI) {
      if (pi === AI && g.pending.attackers.includes(b.u)) { sel.blockFrom = b.u; toast('Now click one of your untapped units to block with.'); render(); return; }
      if (pi === HUMAN && sel.blockFrom !== null) { if (b.tapped) { toast('Tapped units cannot block.'); return; } if (P.card(b.id).type !== 'Unit') { toast('Only units can block.'); return; } const att = P.findUnit(g, sel.blockFrom).unit; if (P.card(att.id).kw.drift !== undefined && P.card(b.id).kw.drift === undefined) { toast('Only Drift units can block a Drift attacker.'); return; } for (const k of Object.keys(sel.blocks)) if (sel.blocks[k] === b.u) delete sel.blocks[k]; sel.blocks[sel.blockFrom] = b.u; sel.blockFrom = null; render(); return; }
      return;
    }
    if (pi === HUMAN && g.active === HUMAN && g.phase === 'main' && P.card(b.id).type === 'Unit') { if (!P.canAttack(g, HUMAN, b)) { toast(b.summoned ? 'That unit just arrived — it needs Swift to attack now.' : 'That unit is tapped.'); return; } if (sel.attackers.has(b.u)) sel.attackers.delete(b.u); else sel.attackers.add(b.u); render(); }
  }
  function doAttack() { const g = game; const a = [...sel.attackers]; sel.attackers.clear(); try { P.declareAttack(g, HUMAN, a); if (a.length) { tutMark('attack'); sfx('attack'); } } catch (e) { toast(e.message); render(); return; } if (g.phase === 'block') P.aiDefend(g, AI); if (g.winner !== null) { finishGame(); return; } if (g.phase === 'main' && g.active === AI) { afterHuman(); return; } render(); }
  function confirmBlocks() { const g = game; try { P.declareBlocks(g, HUMAN, sel.blocks); if (Object.keys(sel.blocks).length) { tutMark('block'); sfx('block'); } } catch (e) { toast(e.message); return; } sel.blocks = {}; sel.blockFrom = null; if (g.winner !== null) { finishGame(); return; } P.aiFinish(g, AI); if (g.winner !== null) { finishGame(); return; } render(); }
  function afterHuman() { const g = game; aiBusy = true; render(); if (g.winner !== null) { aiBusy = false; finishGame(); return; } setTimeout(() => { try { if (g.active === AI && g.phase === 'main') P.aiTurn(g, AI); if (g.winner === null && g.active === AI && g.phase === 'main2') P.aiFinish(g, AI); } catch (e) { toast('Rival error: ' + e.message); } aiBusy = false; if (g.winner !== null) { finishGame(); return; } render(); }, pr.settings.motion ? 450 : 80); }
  function startGame(tut) { if (busy) return; const rv = rivals(); const seed = tut ? 20260910 : (Date.now() ^ pr.seed) | 0; const rivalDeck = tut ? C.STARTERS['Order Vanguard'].deck : rv[rivalName].deck; tutorial = tut ? { done: new Set() } : null; const myDeck = tut ? (pr.decks[pr.starter] || pr.decks[playDeck]) : pr.decks[playDeck]; game = P.newGame(myDeck, rivalDeck, seed, { nameA: pr.name, nameB: 'Rival', difficulty: tut ? 'easy' : pr.settings.difficulty }); prevSnap = null; sel = freshSel(); confirmConcede = false; render(); }
  async function finishGame() { if (busy) { render(); return; } busy = true; try { const g = game; sfx(g.winner === HUMAN ? 'win' : 'lose'); if (tutorial) { tutorial.done.add('finish'); pr.tutorialDone = true; } const deck = tutorial ? (pr.decks[pr.starter] || pr.decks[playDeck]) : pr.decks[playDeck]; const res = M.recordGame(pr, g, HUMAN, M.deckColors(deck)); M.rotateQuests(pr); await save(); const msgs = res.quests.map(q => 'Quest complete: ' + q.text).concat(res.achievements.map(a => 'Achievement: ' + a.text)); toast((g.winner === HUMAN ? 'Victory! ' : g.winner === AI ? 'Defeat. ' : 'Draw. ') + (msgs.length ? msgs.join(' · ') : ''), 5000); } finally { busy = false; } render(); }

  // ---------- Tutorial: objectives + state-derived coaching ----------
  const OBJ = [['ws', 'Play a Wellspring'], ['unit', 'Cast a Unit'], ['attack', 'Attack with a unit'], ['block', 'Block an attacker'], ['target', 'Play a card that needs a target'], ['finish', 'Finish the match']];
  function tutMark(k) { if (tutorial) tutorial.done.add(k); }
  function coachPanel(g) {
    const hint = coachHint(g); const done = tutorial.done;
    return h('section', { class: 'panel coach', role: 'region', 'aria-label': 'Tutorial coach' }, h('div', { class: 'row' }, h('h3', { class: 'grow', text: `Tutorial · ${[...done].filter(k => OBJ.some(o => o[0] === k)).length}/${OBJ.length} objectives` }), h('button', { class: 'btn tiny', text: 'Leave tutorial', onclick: () => { tutorial = null; render(); } })),
      h('ul', { class: 'objs' }, OBJ.map(([k, t]) => h('li', { class: done.has(k) ? 'done' : '', text: (done.has(k) ? '✓ ' : '○ ') + t }))), h('p', { class: 'hint', text: hint }));
  }
  function coachHint(g) {
    const me = g.players[HUMAN]; const myTurn = g.active === HUMAN; const blocking = g.phase === 'block' && g.active === AI; const pl = P.playable(g, HUMAN);
    const hasWs = pl.some(x => P.card(me.hand[x.hi].id).type === 'Wellspring'); const spells = pl.filter(x => P.card(me.hand[x.hi].id).type !== 'Wellspring'); const canAtk = P.units(g, HUMAN).some(u => P.canAttack(g, HUMAN, u)); const targeted = spells.find(x => P.needsTarget(P.card(me.hand[x.hi].id)));
    if (g.winner !== null) return g.winner === HUMAN ? 'You won. Open the Packs tab — your first packs are waiting, and quests refresh daily.' : 'The Rival took this one; it still counts toward quests and the tutorial. Try again on Easy, or open a pack first.';
    if (blocking) return 'Incoming attack. Click a red-outlined attacker, then one of your untapped units to block it. A blocker that survives is a free trade; unblocked attackers hit your life. Reactions and Foretell units can be played right now as an ambush. Press Confirm blocks when ready — leaving everything unblocked is allowed.';
    if (!myTurn) return 'The Rival is taking its turn.';
    if (hasWs) return g.turn <= 1 ? 'Turn 1: play a Wellspring — it is your mana. One per turn, never skip it. Click the glowing Wellspring in your hand.' : 'Play your Wellspring for the turn first (the glowing land card).';
    if (targeted && !tutorial.done.has('target')) return `${P.card(me.hand[targeted.hi].id).name} needs a target: click it, then click a highlighted unit (or the Rival\'s face).`;
    if (spells.length) return 'Cast something — glowing cards are affordable. Units need a turn before they can attack unless they have Swift. Unused mana is wasted, so spend it.';
    if (g.phase === 'main' && canAtk) return 'Attack: click your untapped units to select them (red outline), then press Attack. The Rival chooses blocks. Units with Guard stay untapped afterwards.';
    if (g.phase === 'main') return 'Nothing to cast and nothing that can attack — press End turn.';
    return 'Second main phase: cast anything you can still afford, then End turn.';
  }

  // ---------- DECKS ----------
  function renderDecks(v) {
    const names = Object.keys(pr.decks);
    if (curDeck === null) {
      v.append(h('section', { class: 'panel' }, h('h2', { text: 'Your decks' }), h('div', { class: 'row' }, names.map(n => { const errs = M.validateDeck(pr, pr.decks[n]); return h('button', { class: 'btn', 'data-key': 'deck-' + n, text: `${n} (${M.deckColors(pr.decks[n]).join('/')})${errs.length ? ' ⚠' : ''}`, onclick: () => { curDeck = pr.decks[n].slice(); deckName = n; render(); } }); }), h('button', { class: 'btn primary', text: '+ New deck', onclick: () => { curDeck = []; deckName = 'New deck ' + (names.length + 1); render(); } })),
        h('h3', { text: 'Import a deck code' }), h('div', { class: 'row' }, h('input', { id: 'deckCode', 'aria-label': 'Deck code', placeholder: 'PWD1|name|ids…', style: 'min-width:260px' }), h('button', { class: 'btn', text: 'Import', onclick: () => { const r = M.decodeDeck($('#deckCode').value); if (!r.ok) { toast(r.error); return; } curDeck = r.deck; deckName = r.name; render(); toast('Deck loaded into the editor — save it when it is legal for your collection.'); } }))));
      return;
    }
    const counts = {}; for (const id of curDeck) counts[id] = (counts[id] || 0) + 1;
    const errs = M.validateDeck(pr, curDeck); const owned = C.SET.filter(c => (pr.collection[c.id] || 0) > 0).concat(C.ASCENDANTS.filter(a => pr.legends[a.id]));
    const maxOf = c => c.type === 'Wellspring' ? 99 : c.type === 'Ascendant' ? 1 : Math.min(M.MAX_COPIES, pr.collection[c.id] || 0);
    const add = id => { const c = P.card(id); if ((counts[id] || 0) >= maxOf(c)) { toast('At the limit for that card.'); return; } if (curDeck.length >= M.DECK_SIZE) { toast('Deck is full (40).'); return; } curDeck.push(id); render(); };
    const rem = id => { const i = curDeck.indexOf(id); if (i >= 0) curDeck.splice(i, 1); render(); };
    const curve = [0, 0, 0, 0, 0, 0, 0]; for (const id of curDeck) { const c = P.card(id); if (c.type !== 'Wellspring') curve[Math.min(6, P.costTotal(c))]++; }
    const visible = owned.filter(c => (!filt.col || c.color === filt.col) && (!filt.type || c.type === filt.type) && (!filt.q || c.name.toLowerCase().includes(filt.q.toLowerCase()))).sort((a, b) => a.color.localeCompare(b.color) || P.costTotal(a) - P.costTotal(b) || a.name.localeCompare(b.name));
    v.append(h('section', { class: 'panel' }, h('div', { class: 'row' }, h('label', {}, 'Deck name ', h('input', { 'data-key': 'deckname', value: deckName, maxlength: 30, oninput: e => { deckName = e.target.value; } })), h('span', { class: 'pill', text: `${curDeck.length}/${M.DECK_SIZE}` }),
      h('button', { class: 'btn primary', 'data-key': 'savedeck', text: 'Save deck', onclick: async () => { const e2 = M.validateDeck(pr, curDeck); if (e2.length) { toast(e2[0]); return; } const nm = deckName.trim() || 'Deck'; if (Object.keys(pr.decks).length >= 20 && !pr.decks[nm]) { toast('Deck limit (20) reached.'); return; } pr.decks[nm] = curDeck.slice(); M.checkAchievements(pr); await save(); toast('Deck saved.'); curDeck = null; render(); } }),
      h('button', { class: 'btn', text: 'Copy deck code', onclick: () => copyText(M.encodeDeck(deckName, curDeck), 'Deck code copied.') }),
      h('button', { class: 'btn', text: 'Delete', onclick: async () => { if (Object.keys(pr.decks).length <= 1 && pr.decks[deckName]) { toast('Keep at least one deck.'); return; } delete pr.decks[deckName]; await save(); curDeck = null; render(); } }), h('button', { class: 'btn', text: 'Back', onclick: () => { curDeck = null; render(); } })),
      errs.length ? h('p', { class: 'small warn' }, errs.join(' ')) : h('p', { class: 'small mute', text: 'Deck is legal.' }),
      h('div', { class: 'row small mute' }, 'Curve: ', curve.map((n, i) => h('span', { class: 'pill', text: `${i}${i === 6 ? '+' : ''}: ${n}` })), h('span', { class: 'pill', text: `Wellsprings: ${curDeck.filter(id => id.startsWith('ws_')).length}` })),
      h('h3', { text: 'Wellsprings' }), h('div', { class: 'row' }, Object.keys(P.COLORS).map(c => h('button', { class: 'btn', 'data-key': 'ws' + c, text: `+ ${P.COLORS[c]} (${counts['ws_' + c] || 0})`, onclick: () => add('ws_' + c) }))),
      h('h3', { text: 'In deck (click to remove)' }), h('div', { class: 'fan' }, Object.keys(counts).filter(id => !id.startsWith('ws_')).sort((a, b) => P.costTotal(P.card(a)) - P.costTotal(P.card(b))).map(id => cardEl(P.card(id), { mini: true, key: 'd' + id, count: '×' + counts[id], onclick: () => rem(id) })))));
    v.append(h('section', { class: 'panel' }, h('h3', { text: 'Your collection (click to add)' }), filterBar(['type']), h('div', { class: 'fan' }, visible.map(c => cardEl(c, { mini: true, key: 'c' + c.id, count: `${counts[c.id] || 0}/${maxOf(c)}`, onclick: () => add(c.id) })))));
  }
  function filterBar(extra) {
    return h('div', { class: 'row filters' }, h('input', { 'data-key': 'q', 'aria-label': 'Search cards', placeholder: 'Search…', value: filt.q, oninput: e => { filt.q = e.target.value; render(); } }),
      h('select', { 'data-key': 'fcol', 'aria-label': 'Color', onchange: e => { filt.col = e.target.value; render(); } }, [h('option', { value: '', text: 'All colors' })].concat(Object.entries(P.COLORS).map(([k, n]) => h('option', { value: k, selected: filt.col === k, text: n })))),
      extra.includes('type') ? h('select', { 'data-key': 'ftype', 'aria-label': 'Type', onchange: e => { filt.type = e.target.value; render(); } }, [h('option', { value: '', text: 'All types' })].concat(P.TYPES.filter(t => t !== 'Wellspring').map(t => h('option', { value: t, selected: filt.type === t, text: t })))) : null,
      extra.includes('rar') ? h('select', { 'data-key': 'frar', 'aria-label': 'Rarity', onchange: e => { filt.rar = e.target.value; render(); } }, [h('option', { value: '', text: 'All rarities' })].concat(['C', 'U', 'R', 'S'].map(t => h('option', { value: t, selected: filt.rar === t, text: RAR[t] })))) : null,
      extra.includes('owned') ? h('label', { class: 'small' }, h('input', { type: 'checkbox', 'data-key': 'fown', checked: filt.owned, onchange: e => { filt.owned = e.target.checked; render(); } }), ' owned only') : null);
  }
  function copyText(txt, msg) { if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast(msg), () => toast('Clipboard blocked — select and copy manually.')); else toast('Clipboard unavailable.'); }

  // ---------- COLLECTION ----------
  function renderCollection(v) {
    const uniq = M.uniqueOwned(pr);
    v.append(h('section', { class: 'panel' }, h('h2', { text: `Refraction set — ${uniq}/${C.SET.length} cards owned` }), h('p', { class: 'small mute', text: `Dust ${pr.dust}. Craft: Common ${M.CRAFT.C} · Uncommon ${M.CRAFT.U} · Rare ${M.CRAFT.R} · Signature ${M.CRAFT.S}. Click a card to flip it (rules, keywords, flavor); shift-click or ⓘ to enlarge; craft buttons sit under each rarity group.` }),
      h('div', { class: 'row small' }, Object.keys(P.COLORS).map(col => { const all = C.SET.filter(c => c.color === col && c.type !== 'Wellspring'); const own = all.filter(c => pr.collection[c.id]).length; return h('span', { class: 'pill ' + col, text: `${P.COLORS[col]} ${own}/${all.length}` }); })), filterBar(['type', 'rar', 'owned'])));
    for (const col of Object.keys(P.COLORS)) {
      if (filt.col && filt.col !== col) continue;
      const cards = C.SET.filter(c => c.color === col && c.type !== 'Wellspring' && (!filt.type || c.type === filt.type) && (!filt.rar || c.rarity === filt.rar) && (!filt.owned || pr.collection[c.id]) && (!filt.q || c.name.toLowerCase().includes(filt.q.toLowerCase()))).sort((a, b) => P.costTotal(a) - P.costTotal(b) || a.name.localeCompare(b.name));
      if (!cards.length) continue;
      v.append(h('h3', { text: `${P.COLORS[col]} (${col})` }));
      for (const rar of ['S', 'R', 'U', 'C']) { const grp = cards.filter(c => c.rarity === rar); if (!grp.length) continue; v.append(h('h4', { class: 'rarhead ' + rar, text: `${RAR[rar]} · ${grp.filter(c => pr.collection[c.id]).length}/${grp.length}` }), h('div', { class: 'grid' }, grp.map(c => { const n = pr.collection[c.id] || 0; return cardEl(c, { key: 'c' + c.id, cls: n ? '' : 'dim', count: `${n}/${M.MAX_COPIES}`, state: n ? `You own ${n}.` : 'Not owned.' }); })), h('div', { class: 'craftrow' }, grp.map(c => { const n = pr.collection[c.id] || 0; return n >= M.MAX_COPIES ? null : h('button', { class: 'btn tiny', 'data-key': 'craft' + c.id, text: `Craft ${c.name} (${M.CRAFT[c.rarity]})`, disabled: pr.dust < M.CRAFT[c.rarity], onclick: async () => { try { M.craft(pr, c.id); pr.crafted = true; M.checkAchievements(pr); await save(); sfx('pack'); toast(`Crafted ${c.name}.`); render(); } catch (e) { toast(e.message); } } }); }))); }
    }
    v.append(h('h3', { text: `Ascendants — ${Object.keys(pr.legends).length}/${C.ASCENDANTS.length} unlocked` }), h('p', { class: 'small mute', text: 'Legendary permanents a cut above the set: loyalty, two abilities, and a static power. Never in packs — unlocked only with codes from DHSeaDev. One per deck.' }), h('div', { class: 'grid' }, C.ASCENDANTS.filter(a => !filt.col || a.color === filt.col).map(a => cardEl(a, { key: 'c' + a.id, cls: pr.legends[a.id] ? '' : 'dim locked', count: pr.legends[a.id] ? 'UNLOCKED' : 'LOCKED', state: pr.legends[a.id] ? 'Unlocked.' : 'Locked — needs a code.' }))));
  }

  // ---------- PACKS ----------
  function renderPacks(v) {
    const open = async n => { try { lastPack = []; for (let i = 0; i < n && pr.packs > 0; i++) lastPack = lastPack.concat(M.openPack(pr)); M.checkAchievements(pr); await save(); sfx(lastPack.some(x => x.rarity === 'S') ? 'legend' : 'pack'); render(); } catch (e) { toast(e.message); } };
    v.append(h('section', { class: 'panel' }, h('h2', { text: `Refraction packs — you have ${pr.packs}` }),
      h('p', { class: 'small mute', text: `5 cards per pack. ${M.PACK_ODDS.slots}. Per-slot odds: Common ${M.PACK_ODDS.C}% · Uncommon ${M.PACK_ODDS.U}% · Rare ${M.PACK_ODDS.R}% · Signature ${M.PACK_ODDS.S}% (slot 5: Rare ${M.PACK_ODDS.slot5R}% / Signature ${M.PACK_ODDS.slot5S}%). A Signature is guaranteed within ${M.PITY_S} packs (${Math.max(0, M.PITY_S - pr.sinceS)} to go); you never pull a 4th copy while any card of that rarity is missing. Packs come from quests, achievements, first win of the day, and codes — nothing is for sale.` }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', 'data-key': 'open1', disabled: pr.packs <= 0, text: 'Open a pack', onclick: () => open(1) }), h('button', { class: 'btn', 'data-key': 'open5', disabled: pr.packs < 2, text: `Open ${Math.min(5, pr.packs)}`, onclick: () => open(Math.min(5, pr.packs)) }))));
    if (lastPack && lastPack.length) v.append(h('section', { class: 'panel pack-reveal' }, h('h3', { text: 'You pulled' }), h('div', { class: 'fan' }, lastPack.map((x, i) => { const c = P.card(x.id); return cardEl(c, { key: 'p' + i, cls: x.rarity === 'S' ? 'shine' : '', count: x.dust ? `dust +${x.dust}` : x.isNew ? 'NEW' : 'copy', state: x.dust ? 'Converted to dust.' : x.isNew ? 'New card.' : 'Extra copy.' }); }))));
  }

  // ---------- QUESTS ----------
  function renderQuests(v) {
    M.rotateQuests(pr);
    v.append(h('section', { class: 'panel' }, h('h2', { text: `Today's quests` }), h('p', { class: 'small mute', text: 'Three quests rotate every day at midnight UTC. Progress carries across matches within the day.' }), h('div', {}, M.activeQuests(pr).map(q => h('div', { class: 'quest' }, h('div', { class: 'row' }, h('span', { class: 'grow', text: (q.done ? '✓ ' : '') + q.text }), h('span', { class: 'pill', text: `${q.p}/${q.n} · ${q.reward.packs ? q.reward.packs + ' pack' : q.reward.dust + ' dust'}` })), h('div', { class: 'prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': q.n, 'aria-valuenow': q.p }, h('i', { style: `width:${Math.round(q.p / q.n * 100)}%` })))))));
    v.append(h('section', { class: 'panel' }, h('h2', { text: `Achievements ${Object.keys(pr.achievements).length}/${M.ACHIEVEMENTS.length}` }), h('ul', {}, M.ACHIEVEMENTS.map(a => h('li', { class: pr.achievements[a.id] ? 'done' : 'mute', text: `${pr.achievements[a.id] ? '✓' : '○'} ${a.text} — ${a.reward.packs ? a.reward.packs + ' pack(s)' : a.reward.dust + ' dust'}` })))));
  }

  // ---------- REDEEM ----------
  function renderRedeem(v) {
    v.append(h('section', { class: 'panel' }, h('h2', { text: 'Redeem a code' }), h('p', { class: 'small mute', text: 'Codes are issued by DHSeaDev — on dhseadev.online, in devlogs, or as event rewards. Each is signed; the game checks the signature and only real codes unlock anything. A code works once per profile.' }),
      h('div', { class: 'row' }, h('input', { id: 'redeemIn', 'data-key': 'redeem', 'aria-label': 'Code', placeholder: 'PWR1.…', style: 'min-width:300px', onkeydown: e => { if (e.key === 'Enter') $('#redeemBtn').click(); } }), h('button', { id: 'redeemBtn', class: 'btn primary', text: 'Redeem', onclick: async () => { const r = await M.redeemCode(pr, $('#redeemIn').value); if (!r.ok) { toast(r.error); return; } M.checkAchievements(pr); await save(); sfx(r.payload.t === 'legend' ? 'legend' : 'pack'); toast(r.message, 5000); $('#redeemIn').value = ''; render(); } }))));
    const got = Object.keys(pr.legends);
    v.append(h('section', { class: 'panel' }, h('h3', { text: `Ascendants unlocked ${got.length}/${C.ASCENDANTS.length}` }), h('div', { class: 'fan' }, C.ASCENDANTS.map(a => cardEl(a, { mini: true, key: 'r' + a.id, cls: pr.legends[a.id] ? '' : 'dim locked', count: pr.legends[a.id] ? 'UNLOCKED' : 'LOCKED' })))));
    if (Object.keys(pr.redeemed).length) v.append(h('section', { class: 'panel' }, h('h3', { text: 'Redeemed' }), h('ul', { class: 'small mute' }, Object.entries(pr.redeemed).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([c, t]) => h('li', { text: `${c} · ${new Date(t).toLocaleDateString()}` })))));
  }

  // ---------- LEDGER: signed text card + stylized PNG + the wall ----------
  function ledgerPng(txt) {
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 400; const x = cv.getContext('2d'); if (!x) return null;
    const grad = x.createLinearGradient(0, 0, 720, 400); grad.addColorStop(0, '#161a23'); grad.addColorStop(1, '#2a1f3d'); x.fillStyle = grad; x.fillRect(0, 0, 720, 400);
    const cols = ['#e8dcae', '#5fa8e6', '#8a8fa8', '#ef6f4c', '#5fbf7a', '#a066e0']; cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(24 + i * 112, 24, 100, 8); });
    x.fillStyle = '#c084fc'; x.font = 'bold 30px system-ui, sans-serif'; x.fillText('PRISMWAR LEDGER', 24, 80);
    x.fillStyle = '#e8e9ef'; x.font = '20px system-ui, sans-serif'; txt.split('\n').slice(1).forEach((line, i) => x.fillText(line.length > 70 ? line.slice(0, 67) + '…' : line, 24, 130 + i * 40));
    x.fillStyle = '#9aa3b5'; x.font = '15px system-ui, sans-serif'; x.fillText(txt.split('\n')[0].replace('PRISMWAR LEDGER · ', ''), 24, 372); x.fillText('play.dhseadev.online', 520, 372);
    return cv;
  }
  function renderLedger(v) {
    const txt = M.ledgerCard(pr); const cv = ledgerPng(txt);
    v.append(h('section', { class: 'panel' }, h('h2', { text: 'Your Ledger Card' }), h('p', { class: 'small mute', text: 'Post it to the Prismwar Ledger wall, share the picture, or paste the text anywhere. The Sig line fingerprints the numbers; a profile modified outside the game is flagged on the card.' }),
      pr.name === 'Player' ? h('p', { class: 'small mute', text: 'Tip: set a player name in Settings first — every unnamed card on the wall reads "Player".' }) : null,
      cv ? h('div', { class: 'ledgerpic' }, cv) : null,
      h('textarea', { readonly: true, 'aria-label': 'Ledger card text', style: 'min-height:120px' }, txt),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', 'data-key': 'wall', href: WALL_URL + '#post=' + btoa(String.fromCharCode(...new TextEncoder().encode(txt))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), target: '_blank', rel: 'noopener', text: 'Post to the Ledger wall ↗' }),
        h('button', { class: 'btn', 'data-key': 'copyledger', text: 'Copy text', onclick: () => copyText(txt, 'Copied.') }),
        cv ? h('button', { class: 'btn', text: 'Download picture (.png)', onclick: () => { cv.toBlob(b => { if (!b) return; const a = h('a', { href: URL.createObjectURL(b), download: 'prismwar-ledger.png' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }); } }) : null,
        navigator.share ? h('button', { class: 'btn', text: 'Share…', onclick: () => navigator.share({ title: 'Prismwar Ledger', text: txt }).catch(() => { }) }) : null,
        h('a', { class: 'btn', href: LEDGER_URL, target: '_blank', rel: 'noopener', text: 'About the Ledger ↗' }))));
  }

  // ---------- RULES ----------
  function renderRules(v) {
    v.append(h('section', { class: 'panel' }, h('h2', { text: 'How to play Prismwar' }),
      h('p', {}, 'Two players, 20 life each, 40-card decks. Reduce the Rival to 0 life. Each turn: untap, draw, play one Wellspring (your mana), cast cards, attack, and end. Units can attack the turn after they arrive unless they have Swift. Blockers are assigned by the defender; damage is dealt at the same time. Reactions and Foretell units can also be played while the Rival is attacking you — an ambush. Opening hands are smoothed: always 2–4 Wellsprings and something cheap to play.'),
      h('h3', { text: 'The six colors' }), h('ul', {}, Object.entries(P.COLORS).map(([k, n]) => h('li', { text: `${n} (${k}) — ` + { W: 'small efficient units, protection, lifegain.', U: 'card draw, evasion (Drift), tempo.', B: 'removal at a price, recursion, drain.', R: 'direct damage, haste, risk.', G: 'ramp, the biggest bodies, fight-based removal.', P: 'the Undertow: permanent theft, hand disruption, and ambush.' }[k] }))),
      h('h3', { text: 'Ascendants' }), h('p', {}, 'Ten legendary permanents, one per deck, unlocked only with codes from DHSeaDev. An Ascendant arrives with loyalty and rests the turn it enters. Each of your turns you may use one ability: +1 (small effect, gains loyalty) or the big −N ability that spends it. Whenever you take combat damage, each of your Ascendants loses 1 loyalty; at 0 it falls. Some also carry a static power while in play.'),
      h('h3', { text: 'Keywords' }), h('ul', {}, Object.entries(P.KEYWORDS).map(([k, d]) => h('li', {}, h('b', { text: k[0].toUpperCase() + k.slice(1) + ' — ' }), d))),
      h('h3', { text: 'Collection' }), h('p', {}, `You start with one color's starter deck and 3 packs. Quests rotate daily; achievements and codes pay out packs and dust; dust crafts any of the ${C.SET.length} set cards. Deck codes (Decks tab) share a list; Redeem codes (Redeem tab) grant rewards.`)));
  }

  // ---------- SETTINGS ----------
  function exportBackup() { const txt = M.exportProfile(pr); const blob = new Blob([txt], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: `prismwar-backup-${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function renderSettings(v) {
    const chk = (label, key) => h('label', { class: 'row' }, h('input', { type: 'checkbox', 'data-key': 'set-' + key, checked: !!pr.settings[key], onchange: async e => { pr.settings[key] = e.target.checked; await save(); musicSync(); render(); } }), label);
    v.append(h('section', { class: 'panel' }, h('h2', { text: 'Settings' }),
      h('div', { class: 'row' }, h('label', {}, 'Player name ', h('input', { 'data-key': 'name', value: pr.name, maxlength: 24, onchange: async e => { pr.name = M.clipName(e.target.value) || 'Player'; await save(); render(); } }))),
      chk('Animations and effects (your system reduce-motion setting is also respected)', 'motion'), chk('Screen shake', 'shake'), chk('Sound effects', 'sound'), chk('Music', 'music'),
      h('label', { class: 'row' }, 'Music style ', h('select', { 'data-key': 'mstyle', onchange: async e => { pr.settings.musicStyle = e.target.value; await save(); musicSync(); render(); } }, [['ambient', 'Ambient — slow pads and bells'], ['chiptune', 'Chiptune — square-wave arpeggios'], ['synthwave', 'Synthwave — driving bass and pads']].map(([val, l]) => h('option', { value: val, selected: pr.settings.musicStyle === val, text: l })))),
      h('label', { class: 'row' }, 'Rival difficulty ', h('select', { 'data-key': 'diff', onchange: async e => { pr.settings.difficulty = e.target.value; await save(); render(); } }, [['easy', 'Easy — makes mistakes, never ambushes'], ['normal', 'Normal — trades, blocks lethal, ambushes']].map(([val, l]) => h('option', { value: val, selected: pr.settings.difficulty === val, text: l }))))));
    v.append(h('section', { class: 'panel' }, h('h3', { text: 'Backup and restore' }), h('p', { class: 'small mute', text: 'Your profile lives only in this browser (or this extension). Export a backup file to keep it or move it. A backup edited outside the game still imports, but is marked as modified on your Ledger Card, and Ascendants without a valid code are dropped.' }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', 'data-key': 'export', text: 'Export backup (.json)', onclick: exportBackup }),
        h('label', { class: 'btn' }, 'Import backup… ', h('input', { type: 'file', accept: 'application/json,.json', class: 'sr', onchange: e => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 250000) { toast('Backup too large.'); return; } const rd = new FileReader(); rd.onload = async () => { const r = await M.importProfile(String(rd.result)); if (!r.ok) { toast(r.error); return; } pr = r.profile; M.rotateQuests(pr); await save(); game = null; toast(r.integrity === 'ok' ? 'Backup restored.' : 'Backup restored — it was modified outside the game and is marked as such.', 4500); render(); }; rd.readAsText(f); } })),
        h('button', { class: 'btn', text: 'Copy backup to clipboard', onclick: () => copyText(M.exportProfile(pr), 'Backup copied.') }))));
    v.append(h('section', { class: 'panel' }, h('h3', { text: 'Danger zone' }), h('button', { class: 'btn', 'data-key': 'reset', text: confirmConcede ? 'Really reset? (click again)' : 'Reset profile (keeps nothing)', onclick: async () => { if (!confirmConcede) { confirmConcede = true; render(); setTimeout(() => { confirmConcede = false; if (tab === 'settings') render(); }, 3000); return; } confirmConcede = false; pr = M.newProfile(pr.name); await save(); game = null; toast('Profile reset — pick a starter.'); render(); } })));
    v.append(h('section', { class: 'panel' }, h('h3', { text: 'Credits' }), h('p', {}, 'Prismwar is an original game by ', h('a', { href: 'https://dhseadev.online', target: '_blank', rel: 'noopener', text: 'DHSeaDev' }), ' (Donnie Harding). Engine, the 250-card Refraction set, procedural art, and the rival AI are all original work; no third-party assets or libraries. Version ' + P.VERSION + '.'), h('p', { class: 'small mute', text: 'Privacy: the game makes no network requests. Your profile is stored locally; the only things that ever leave are a Ledger Card or deck code you choose to copy or post.' })));
  }

  // ---------- Boot ----------
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#modal')) { closeModal(); return; } if (sel.pending) { sel.pending = null; render(); } } });
  (async function boot() { try { pr = await M.loadProfile(); } catch (e) { pr = M.newProfile('Player'); } if (pr.starter && M.rotateQuests(pr)) await save(); render(); })();
})();
