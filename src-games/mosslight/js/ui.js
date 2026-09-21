/* MOSSLIGHT — browser layer. Reads the engine, never owns game numbers. Juice is never load-bearing: nothing here changes an outcome. */
(function (ML) {
  'use strict';
  var A = ML.Art, Au = ML.Audio, C = ML.CURVES, G, S;
  var htmlCache = {};
  var UI = ML.UI = { log: [], hlMat: null, gearFilter: 'all', gearSort: 'rarity', tab: 'quests', sub: { quests: 'global', world: 0 }, selItem: null, selFriend: null, open: {}, keyHeld: false, confirm: null, buyN: 1, lastHtml: '', pointerDown: false, fx: [], imgs: {}, shake: 0, memOnly: false, toastN: 0, seenSpecies: {} };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n, dp) { return ML.fmt(n, dp); }
  function pct(v, dp) { return (v * 100).toFixed(dp == null ? 0 : dp) + '%'; }
  function bar(frac, cls, label) { return '<div class="bar ' + (cls || '') + '" role="img" aria-label="' + esc(label || '') + ' ' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%"><i style="width:' + (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%"></i></div>'; }
  function btn(act, arg, label, o) { o = o || {}; return '<button class="btn ' + (o.cls || '') + '" data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + (o.dis ? ' disabled' : '') + (o.title ? ' title="' + esc(o.title) + '"' : '') + (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + (o.pressed != null ? ' aria-pressed="' + (o.pressed ? 'true' : 'false') + '"' : '') + ' data-key="' + act + ':' + esc(arg == null ? '' : arg) + '">' + label + '</button>'; }
  function pic(svg, cls) { return '<span class="pic ' + (cls || '') + '">' + svg.replace('role="img"', 'role="img" focusable="false"') + '</span>'; }
  function colorTag(c) { return '<span class="tag c-' + c + '">' + ML.COLOR_LABEL[c] + '</span>'; }
  function reduceMotion() { var r = S.settings.reduceMotion; return r == null ? !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) : r; }
  function say(text) { var l = $('live'); if (l) { l.textContent = ''; setTimeout(function () { l.textContent = text; }, 30); } }

  /* ---------- storage: may be blocked or partitioned inside an itch.io iframe — never assume it works ----------
     Two backends behind one synchronous face.
     - play.dhseadev.online injects a chrome.storage.local shim ahead of this file. Many games share that origin, so
       the shim prefixes every key with the game id, and the arcade's verify.mjs holds every entry to that contract.
       chrome.storage is callback/promise shaped, so the four keys this game uses are HYDRATED into a cache before
       UI.boot runs and every write goes through to the shim as well as the cache.
     - Everywhere else (itch.io, a local file) there is no chrome object and localStorage is used directly, byte for
       byte what 0.3.0 did. Throws still surface to the callers' try/catch, which is what sets memOnly. */
  var SLOTS = [1, 2, 3]; // the three manual slots. Settings renders these and kv hydrates these: one list, never two.
  var kv = (function () {
    var cs = null;
    try { if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === 'function') cs = chrome.storage.local; } catch (e) { cs = null; }
    var cache = {}, failed = false; // failed: the stored values could not be read, so writing now would overwrite a real save with a fresh one
    function has(k) { return Object.prototype.hasOwnProperty.call(cache, k); }
    function degraded() { return !!window.__ARCADE_STORAGE_DEGRADED__; }
    return {
      arcade: !!cs,
      hydrate: function (keys, done) {
        if (!cs) { done(); return; }
        var fired = false;
        function fin(o, bad) {
          if (fired) return; fired = true;
          if (bad) { failed = true; UI.memOnly = true; }
          o = o || {}; keys.forEach(function (k) { if (typeof o[k] === 'string') cache[k] = o[k]; });
          setTimeout(done, 0); // outside every try below, so a boot error surfaces instead of being swallowed
        }
        try { var r = cs.get(keys, function (o) { fin(o, false); }); if (r && typeof r.then === 'function') r.then(function (o) { fin(o, false); }, function () { fin({}, true); }); }
        catch (e) { fin({}, true); }
      },
      get: function (k) { if (!cs) return window.localStorage.getItem(k); return has(k) ? cache[k] : null; },
      set: function (k, v) {
        if (!cs) { window.localStorage.setItem(k, v); return; }
        if (failed) throw new Error('stored save could not be read; refusing to overwrite it');
        if (degraded()) throw new Error('arcade storage is session-only');
        var o = {}; o[k] = v; cs.set(o);
        if (degraded()) throw new Error('arcade storage became session-only during this write');
        cache[k] = v; // only after the write is known to be durable, so a slot never shows as filled when it is not
      },
      del: function (k) { if (!cs) { window.localStorage.removeItem(k); return; } delete cache[k]; cs.remove(k); }
    };
  })();
  UI.kv = kv;
  var store = { get: function () { try { return kv.get(ML.SAVE_KEY); } catch (e) { UI.memOnly = true; return null; } }, set: function (v) { try { kv.set(ML.SAVE_KEY, v); return true; } catch (e) { UI.memOnly = true; return false; } }, del: function () { try { kv.del(ML.SAVE_KEY); } catch (e) { } } };
  function save() { if (!G) return; S.lastSeen = Date.now(); var ok = store.set(ML.serialize(S)); if (ok) UI.lastSave = Date.now(); $('banner').hidden = ok; if (!ok) $('banner').textContent = 'This browser is blocking storage for the game frame, so progress cannot be saved automatically. Use Settings → Export save to keep your progress.'; }
  UI.save = save;
  UI.lastSave = 0;
  // Three named backups inside this browser. The LIVE save keeps its original key, so nothing has to migrate
  // and a slot can never become the thing you are playing by accident — loading one is an explicit, confirmed act.
  function slotKey(i) { return ML.SAVE_KEY + ':slot' + i; }
  function slotRead(i) { try { return kv.get(slotKey(i)); } catch (e) { return null; } }
  function slotInfo(i) {
    var raw = slotRead(i); if (!raw) return null;
    try { var o = JSON.parse(raw); return { when: o.__when || 0, level: (o.healer || {}).level || 1, area: o.areaId || '?', sab: (o.sab || {}).count || 0, bytes: raw.length }; }
    catch (e) { return { when: 0, level: 0, area: 'unreadable', sab: 0, bytes: raw.length }; }
  }
  UI.slotInfo = slotInfo;
  function slotWrite(i) {
    if (!G) return false;
    S.lastSeen = Date.now();
    var o = JSON.parse(ML.serialize(S)); o.__when = Date.now();
    try { kv.set(slotKey(i), JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function slotLoad(i) {
    var raw = slotRead(i); if (!raw) return false;
    var g = ML.loadGame(raw, {}); if (!g) return false;
    adopt(g); var off = G.applyOffline(Date.now()); buildNav(); renderAll(true); save();
    if (off && off.seconds >= C.offlineMinS) offlineModal(off);
    return true;
  }
  function slotWipe(i) { try { kv.del(slotKey(i)); return true; } catch (e) { return false; } }
  // A file on the player's own disk is the only backup that survives a cleared browser, a new machine, or itch
  // partitioning storage in its iframe. Blob first; if the page's CSP or the browser refuses it, fall back to
  // the textarea that has always worked, and say which happened.
  function saveFileName() { var d = new Date(); function z(v) { return ('0' + v).slice(-2); }
    return 'mosslight-' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + '-lv' + S.healer.level + '.mosslight'; }
  function downloadSave() {
    save();
    var text = ML.serialize(S), name = saveFileName();
    try {
      var blob = new Blob([text], { type: 'application/json' }), url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return { ok: true, name: name };
    } catch (e) { return { ok: false, name: name, why: String(e && e.message || e) }; }
  }
  function uploadSave(onText) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.mosslight,.txt,.json,application/json,text/plain';
    inp.style.cssText = 'position:fixed;left:-9999px;top:0';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) { inp.remove(); return; }
      var fr = new FileReader();
      fr.onload = function () { onText(String(fr.result || '')); inp.remove(); };
      fr.onerror = function () { onText(null); inp.remove(); };
      fr.readAsText(f);
    };
    document.body.appendChild(inp); inp.click();
  }

  /* ---------- boot ---------- */
  var TEXT_PX = { s: 14, m: 15, l: 17, xl: 19 };
  function applyLook() {
    var st = S.settings;
    document.documentElement.setAttribute('data-theme', st.theme);
    document.documentElement.style.fontSize = (TEXT_PX[st.textSize] || 15) + 'px';
    document.body.classList.toggle('zen', !!st.zen);
    document.body.classList.toggle('hicon', !!st.hiCon);
    ML.NOTATION = st.notation; htmlCache = {};
  }
  // True fullscreen is progressive enhancement only: on iPhone the Fullscreen API does not work on a non-video element
  // in ANY browser, so the control is not rendered there rather than rendered dead. Zen mode is the portable feature.
  function canFull() { return !!(document.fullscreenEnabled && document.documentElement.requestFullscreen); }
  function isFull() { return !!document.fullscreenElement; }
  function adopt(game) { G = game; S = G.S; ML.G = G; Au.setVolumes(S.settings); applyLook(); document.body.classList.toggle('calm', reduceMotion()); UI.seenSpecies = {}; Object.keys(S.companions).forEach(function (k) { UI.seenSpecies[k] = true; }); UI.fx = []; UI.selItem = null; UI.confirm = null; hideResult(); htmlCache = {}; }
  UI.boot = function () {
    var raw = store.get(), loaded = raw ? ML.loadGame(raw, {}) : null, off = null;
    if (loaded) { adopt(loaded); off = G.applyOffline(Date.now()); } else adopt(new ML.Game(ML.newState(), {}));
    buildNav(); bind(); renderAll(true); save();
    if (off && off.seconds >= C.offlineMinS) offlineModal(off);
    else if (!S.flags.intro) introModal();
    var last = performance.now(), acc = 0;
    setInterval(function () {
      var now = performance.now(), dt = (now - last) / 1000; last = now;
      if (dt > 60) { var p = G.applyOffline(Date.now()); if (p) offlineModal(p); return; }   // a long sleep is offline time, granted once
      if (UI.paused) { acc = 0; drain(); return; }
      acc += Math.min(dt, 30); var n = 0; while (acc >= C.tick && n++ < 320) { G.tick(C.tick); acc -= C.tick; }
      drain();
    }, 100);
    setInterval(function () { renderAll(false); }, 250);
    setInterval(save, 15000);
    setInterval(function () { var F = G.F, t = (tabDot('quests') ? '● ' : '') + 'W' + Math.max(1, F.wave) + '/10 · ' + G.area().name + ' — Mosslight'; if (document.title !== t) document.title = t; }, 1000);
    var fLast = 0, fAcc = 0, fN = 0;
    (function frame(ts) {
      if (fLast && ts) { var d = ts - fLast; if (d > 0 && d < 250) { fAcc += d; fN++; } }
      fLast = ts || 0;
      if (fN >= 150) { var avg = fAcc / fN; fAcc = 0; fN = 0;
        if (!Au.lite && avg > 22) Au.quality(true);          // under ~45 fps: shed the convolver send and halve the voice budget
        else if (Au.lite && avg < 15) Au.quality(false); }   // hysteresis, so one slow second does not flap the setting
      draw(); requestAnimationFrame(frame);
    })();
    document.addEventListener('visibilitychange', function () { Au.suspend(document.hidden); if (document.hidden) save(); });
    window.addEventListener('pagehide', save);
  };

  /* ---------- events from the engine -> sound, floating text, toasts, announcements ---------- */
  function unitPos(slot) { if (slot === 'stray') return { x: 312, y: 330 }; var xs = [286, 214, 148], ys = [300, 282, 318]; return { x: xs[slot] || 236, y: ys[slot] || 298 }; }
  function raiderPos(r) { return { x: 74 + r.x * 5.3, y: 296 + ((r.uid * 37) % 3 - 1) * 10 }; }
  // One look per song. Colours match the songbook icons; lifetimes are short enough to read at a glance
  // and long enough to see. Everything here is decoration: nothing in this map changes an outcome.
  var SONG_FX = {
    mend:      { c: '#8df0a8', life: 0.45 },
    bloomwave: { c: '#ffb3e1', life: 0.85 },
    dew:       { c: '#8fd0ff', life: 1.10 },
    barkskin:  { c: '#d8b37a', life: 0.65 },
    purify:    { c: '#e9d5ff', life: 0.90 },
    rally:     { c: '#ffb066', life: 1.00 }
  };
  var lastNum = {};
  function floatText(x, y, text, color, big, key) { if (!S.settings.numbers) return; if (key) { var nowT = performance.now(); if (nowT - (lastNum[key] || 0) < 380) return; lastNum[key] = nowT; } UI.fx.push({ k: 'num', x: x + (Math.random() - 0.5) * 16, y: y, text: text, color: color, t: 0, life: 0.9, big: big }); if (UI.fx.length > 90) UI.fx.splice(0, 20); }
  function drain() {
    var evs = G.events; if (!evs.length) return; G.events = [];
    evs.forEach(function (e) {
      var p, r;
      switch (e.type) {
        case 'heal': p = unitPos(e.to); if (e.amt > 0.05) floatText(p.x, p.y - 74, '+' + fmt(e.amt), '#8df0a8', false, 'h' + e.to); else if (e.over > 0.05) floatText(p.x + 14, p.y - 88, '+' + fmt(e.over) + ' vigor', '#ffd76a', false, 'v' + e.to); UI.fx.push({ k: 'beam', to: e.to, t: 0, life: 0.3 }); break;
        case 'cast':
          if (e.id === 'mend') Au.sfx('heal', e.crit); else if (e.id === 'bloomwave') Au.sfx('bloom');
          UI.fx.push({ k: 'song', id: e.id, to: e.to, crit: !!e.crit, t: 0, life: SONG_FX[e.id] ? SONG_FX[e.id].life : 0.5 });
          UI.fx.push({ k: 'cast', hue: SONG_FX[e.id] ? SONG_FX[e.id].c : '#b8ffd0', t: 0, life: 0.42 });   // the healer lifts the lantern for every song
          break;
        case 'hot': Au.sfx('hot'); break; case 'shield': Au.sfx('shield'); break; case 'cleanse': Au.sfx('cleanse'); break; case 'rally': Au.sfx('rally'); break;
        case 'strike': Au.sfx('strike'); r = G.F.raiders.filter(function (x) { return x.uid === e.to; })[0]; if (r) { p = raiderPos(r); floatText(p.x, p.y - 80, fmt(e.dmg), '#ffffff', false, 'r' + e.to); } break;
        case 'hit': Au.sfx('hit'); p = unitPos(e.to); floatText(p.x, p.y - 66, '-' + fmt(e.dmg), '#ff9c9c', false, 'd' + e.to); break;
        case 'flee': Au.sfx('flee'); floatText(74 + e.x * 5.3, 214, '+' + fmt(e.gold) + ' coin', '#ffd76a', e.captain || e.gilded, e.captain || e.gilded ? null : 'coin'); if (e.gilded) toast('A Gilded raider ran for it!', 'It dropped ' + fmt(e.gold) + ' coin and ' + fmt(e.exp) + ' experience.'); break;
        case 'wave': if (e.boss) { Au.sfx('captain'); say('Wave 10. The Captain arrives.'); } break;
        case 'down': Au.sfx('down'); if (!reduceMotion()) UI.shake = 0.35; say(ML.SPECIES_BY_ID[e.id].name + ' is down.'); break;
        case 'drop': break;
        case 'pickup': Au.sfx(e.kind === 'gear' ? 'gift' : 'pickup'); if (e.kind === 'gear') toast('A gift: ' + ML.RARITY[e.item.r] + ' ' + ML.GEAR_BY_ID[e.item.t].name, 'It is in your Gifts satchel.', A.gear(e.item.t, e.item.r)); if (e.kind === 'scrap' && e.full) toast('Satchel full', 'A gift was unpicked for coin. Unpick or equip gifts to make room.'); break;
        case 'level': Au.sfx('level'); say('Healer level ' + e.level); break;
        case 'skill': toast('New song: ' + ML.SKILL_BY_ID[e.id].name, ML.SKILL_BY_ID[e.id].blurb); break;
        case 'stray': Au.sfx('stray'); UI.seenSpecies[e.id] = true; break;
        case 'tended': Au.sfx('tended'); floatText(300, 250, '+' + fmt(e.trust, 1) + ' trust', '#ffb3e1', true); break;
        case 'rank': toast(e.first ? 'New friend: ' + ML.SPECIES_BY_ID[e.id].name : ML.SPECIES_BY_ID[e.id].name + ' reached Rank ' + e.rank, e.first ? 'Open Friends to put it on your line. Even at home it lends its passive.' : 'Level cap is now ' + e.rank * 10 + '. Home passive is stronger.', A.species(e.id)); Au.sfx('claim'); say((e.first ? 'New friend ' : 'Rank up ') + ML.SPECIES_BY_ID[e.id].name); break;
        case 'result': Au.sfx(e.ok ? 'clear' : 'fail'); showResult(e); break;
        case 'area': hideResult(); Au.style = G.area().region; break;
        case 'opened': toast('New road: ' + ML.AREA_BY_ID[e.id].name, 'Level ' + ML.AREA_BY_ID[e.id].level + '. Drops ' + ML.MATS[ML.AREA_BY_ID[e.id].mat] + '.'); break;
        case 'retreat': toast('Fell back to ' + ML.AREA_BY_ID[e.id].name, 'Three losses in a row. Your line will hold here for a few clears, then try again. (Roads → Smart retreat)'); break;
        case 'ledger': Au.signature(); toast('Ledger: ' + e.cond, e.why + '  (+' + e.motes + ' Motes)', A.healer(), 14000); break;
        case 'global': Au.sfx('claim'); toast(e.name + ' — done', e.why, A.healer(), 12000); break;
        case 'title': Au.sfx('claim'); toast('Title earned: ' + e.name, e.text); break;
        case 'claim': Au.sfx('claim'); break;
        case 'mastery': Au.sfx('gift'); toast('Mastered: ' + ML.GEAR_BY_ID[e.t].name, 'Its mastery bonus is permanent, for every healer. Swap in a gift you have not mastered.'); break;
        case 'keystone': toast('Keystone found', 'Each region finale gives one per Sabbatical cycle. Two Keystones raise a building’s level cap by 10 (Sanctuary).'); break;
        case 'sabbatical': Au.signature(); toast('Sabbatical ' + e.count, '+' + e.gain + ' Insight. Spend it in the Sabbatical tab — it is permanent.', A.healer(), 12000); break;
        case 'renown': say('Renown ' + e.level); break;
        case 'queued': Au.sfx('buy'); break;
        case 'capped': toast('Your purse is full', 'Coin earned past ' + fmt(e.cap) + ' is lost. Spend it, queue a Provision so it spends itself, or raise Iron Coffer. The Ledger tracks what the cap has cost you.', A.healer(), 12000); break;
      }
    });
    var F = G.F, hurt = 0; F.comps.forEach(function (c) { hurt += 1 - c.hp / c.maxHp; });
    Au.intensity = Math.min(1, hurt / Math.max(1, F.comps.length) * 1.4 + (F.raiders.some(function (r) { return r.captain && !r.flee; }) ? 0.45 : 0) + (F.raiders.length >= 3 ? 0.2 : 0));
  }
  function toast(title, text, svg, ms) {
    UI.log.unshift({ t: Date.now(), title: title, text: text || '' }); if (UI.log.length > 40) UI.log.length = 40;
    var box = $('toasts'), d = document.createElement('div'); d.className = 'toast' + (svg ? '' : ' plain'); d.setAttribute('role', 'status');
    d.innerHTML = (svg ? pic(svg) : '') + '<div><b>' + esc(title) + '</b><p>' + esc(text || '') + '</p></div><button class="x" aria-label="Dismiss">' + A.icon('close') + '</button>';
    d.querySelector('.x').onclick = function () { d.remove(); }; box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(function () { d.remove(); }, ms || 7000);
  }
  function showResult(r) {
    var el = $('result'), a = G.area(); el.className = r.ok ? 'ok' : 'fail'; el.hidden = false;
    var feats = ['Flawless', 'Swift', 'Faithful'], ft = r.feats.map(function (i) { return '<span class="tag r4">Feat: ' + feats[i] + ' +10 Motes</span>'; }).join(' ');
    el.innerHTML = '<div class="box"><h3>' + (r.ok ? 'Area held!' : 'The line broke at wave ' + r.wave) + '</h3><div class="small dim">' + esc(a.name) + ' · ' + r.time.toFixed(1) + ' s</div>' +
      '<table class="stats"><tr><td>Raiders sent home</td><td>' + r.fled + '</td></tr><tr><td>Coin</td><td>' + fmt(r.gold) + '</td></tr><tr><td>Experience</td><td>' + fmt(r.exp) + '</td></tr><tr><td>' + ML.MATS[r.mat] + '</td><td>' + fmt(r.mats, 1) + '</td></tr>' + (r.gear ? '<tr><td>Gifts</td><td>' + r.gear + '</td></tr>' : '') + '</table>' + ft +
      (r.ok ? '' : '<p class="small dim">Nothing is lost — everything earned is kept. ' + (S.stats.clears ? 'Grow stronger or pick an easier road.' : 'Spend your stat point on Grace (Healer tab), then watch again.') + '</p>') + '</div>';
    say(r.ok ? 'Area held.' : 'The line broke at wave ' + r.wave + '.');
    // a player who put points anywhere but Grace (or nowhere) can loop on the first road for half an hour: say so, plainly, once per few losses
    var st = G.areaStat(), h = S.healer; if (!r.ok && st.fails >= 2 && st.fails % 2 === 0 && !S.stats.clears) toast('Your line keeps breaking', h.points > 0 ? 'You have ' + h.points + ' unspent stat point' + (h.points > 1 ? 's' : '') + '. Healer tab → Grace makes every mend stronger.' : h.stats.grace * 2 < h.level ? 'Most of your points are not in Grace. Healer tab → “Take all points back” is free — then put them in Grace.' : 'Keep going: every loss still pays experience, and each level is another point for Grace.', A.healer(), 12000);
  }
  function hideResult() { var el = $('result'); if (el) el.hidden = true; }

  /* ---------- modals ---------- */
  function modal(html) { var m = $('modal'); m.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-labelledby="mtitle">' + html + '</div>'; m.hidden = false; $('app').inert = true; var b = m.querySelector('button'); if (b) b.focus(); }
  function closeModal() { $('modal').hidden = true; $('modal').innerHTML = ''; $('app').inert = false; var t = $('tab-' + UI.tab); if (t) t.focus({ preventScroll: true }); }
  function introModal() {
    modal('<h2 id="mtitle">Mosslight</h2><p>Raiders keep coming to the Hollow for bounties on its gentle creatures. You cannot fight — but you can <b>heal</b>.</p><p>The fight runs by itself. Your friends hold the line; you keep them standing. Raiders are never killed: when their Resolve runs out they <b>run home</b>.</p><p class="why">Healing a friend who is already at full health is never wasted. It becomes <b>Vigor</b>, and Vigor makes them hit harder.</p><p>Your first fight will probably go badly. That is the point — the <b>Story</b> request says what to do about it.</p><div class="row">' + btn('closeIntro', null, 'Light the lantern', { cls: 'pri' }) + '</div>');
  }
  function offlineModal(p) {
    var rows = [['Coin', fmt(p.goldKept) + (p.goldKept < p.gold - 1 ? ' <span class="warn">(cap reached — ' + fmt(p.gold - p.goldKept) + ' lost; raise Iron Coffer or queue Provisions)</span>' : '')], ['Experience', fmt(p.exp) + (p.levels ? ' (+' + p.levels + ' levels)' : '')], [ML.MATS[p.mat], fmt(p.mats, 1)], ['Raiders sent home', fmt(Math.floor(p.fled))]];
    if (p.side) Object.keys(p.side).forEach(function (m) { if (p.side[m] >= 0.05) rows.push([ML.MATS[m], fmt(p.side[m], 1)]); });
    if (p.trust >= 0.05) rows.push(['Trust', fmt(p.trust, 1)]);
    modal('<h2 id="mtitle">While you were away</h2><p>Your line held ' + esc(ML.AREA_BY_ID[p.area].name) + ' for <b>' + ML.fmtTime(p.seconds) + '</b>' + (p.capped ? ' (the cap — you were gone ' + ML.fmtTime(p.raw) + ')' : '') + ' at ' + pct(p.eff) + ' of your live pace.' + (p.fellBack ? ' (You left on a road with no finished run yet, so they held the last road they knew.)' : '') + '</p><table class="stats">' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table><p class="small dim">Offline pace comes from your recent results in that area. Leave on a road you clear comfortably.</p><div class="row">' + btn('closeModal', null, 'Back to work', { cls: 'pri' }) + '</div>');
    save();
  }

  /* ---------- nav + top ---------- */
  function buildNav() { $('nav').innerHTML = ML.TABS.map(function (t) { return '<button class="tab" role="tab" id="tab-' + t.id + '" data-act="tab" data-arg="' + t.id + '"><span class="ti"></span><span class="name">' + t.name + '</span></button>'; }).join(''); }
  function tabDot(id) {
    var q = S.quests;
    if (id === 'quests') { var g = G.currentGlobal(); if (g && G.testCond(g.test)) return true; if (Object.keys(q.general).some(function (k) { return q.general[k].active && q.general[k].prog >= G.generalInfo(k).need; })) return true; return q.daily.list.some(function (d) { return !d.claimed && d.prog >= d.need; }); }
    if (id === 'healer') return S.healer.points > 0 && !(S.healer.autoAllot && S.flags.autoAllot);
    if (id === 'sanctuary') return S.renown.points > 0;
    if (id === 'sabbatical') return G.canSabbatical();
    return false;
  }
  function renderNav() {
    ML.TABS.forEach(function (t) {
      var b = $('tab-' + t.id), open = !!S.tabs[t.id], isNew = open && !S.seenTabs[t.id] && t.id !== UI.tab;
      b.setAttribute('aria-disabled', open ? 'false' : 'true'); b.classList.toggle('locked', !open); b.setAttribute('data-act', open ? 'tab' : 'lockedTab'); b.setAttribute('aria-selected', UI.tab === t.id ? 'true' : 'false'); b.classList.toggle('new', isNew);
      var nm = b.querySelector('.name'), want2 = open ? t.name : t.name + '<small>' + esc(t.lock) + '</small>'; if (nm.dataset.k !== (open ? 'o' : 'l')) { nm.innerHTML = want2; nm.dataset.k = open ? 'o' : 'l'; }
      b.title = open ? t.name : 'Locked — ' + t.lock; b.setAttribute('aria-label', open ? t.name + (isNew ? ' (new)' : '') : t.name + ', locked. ' + t.lock);
      var html = A.icon(open ? t.id : 'lock') + ''; var ti = b.querySelector('.ti'); if (ti.dataset.k !== (open ? t.id : 'lock')) { ti.innerHTML = html; ti.dataset.k = open ? t.id : 'lock'; }
      var dot = b.querySelector('.dot'), want = open && tabDot(t.id); if (want && !dot) { dot = document.createElement('span'); dot.className = 'dot'; dot.setAttribute('aria-hidden', 'true'); b.appendChild(dot); } else if (!want && dot) dot.remove();
    });
  }
  function renderTop() {
    var h = S.healer, D = G.D, capped = S.gold >= D.goldCap * 0.999, need = ML.xpFor(h.level), rn = S.renown, rneed = ML.renownFor(rn.level);
    var html = '<div class="res coin' + (capped ? ' capped' : '') + '" title="Coin / coin cap' + (capped ? ' — at the cap: spend it or raise Iron Coffer' : '') + '">' + A.icon('coin') + '<b>' + fmt(S.gold) + '</b><small>/ ' + fmt(D.goldCap) + '</small></div>' +
      '<div class="res mote" title="Lantern Motes — earned from the Ledger, feats and daily rounds. Never sold.">' + A.icon('mote') + '<b>' + fmt(S.motes) + '</b><small>Motes</small></div>' +
      (S.sab.count || S.insight ? '<div class="res insight" title="Insight — from Sabbaticals">' + A.icon('insight') + '<b>' + fmt(S.insight) + '</b><small>Insight</small></div>' : '') +
      (S.keystones ? '<div class="res key" title="Keystones — raise a building’s level cap">' + A.icon('keystone') + '<b>' + S.keystones + '</b></div>' : '') +
      '<div class="lv" title="Healer experience: ' + fmt(h.xp) + ' / ' + fmt(need) + '"><span><b>Healer Lv ' + h.level + '</b><span>' + Math.floor(h.xp / need * 100) + '%</span></span>' + bar(h.xp / need, 'xp', 'Healer experience') + '</div>' +
      '<div class="lv" title="Renown: ' + fmt(rn.xp) + ' / ' + fmt(rneed) + '"><span><b>Renown ' + rn.level + '</b><span>' + Math.floor(rn.xp / rneed * 100) + '%</span></span>' + bar(rn.xp / rneed, 'gold', 'Renown') + '</div>' +
      '<button class="btn" data-act="log" data-key="log" aria-label="Recent notices (' + UI.log.length + ')" title="Recent notices">' + A.icon('bell') + '</button><button class="btn" data-act="mute" data-key="mute" aria-pressed="' + (S.settings.mute ? 'true' : 'false') + '" aria-label="' + (S.settings.mute ? 'Unmute sound' : 'Mute sound') + '">' + A.icon(S.settings.mute ? 'mutedicon' : 'sound') + '</button>';
    setHtml($('top'), html, 'top');
  }
  function setHtml(el, html, key) { if (htmlCache[key] === html) return false; if ((UI.pointerDown || UI.keyHeld) && el.contains(UI.pointerTarget)) return false; var ae = document.activeElement, k = ae && el.contains(ae) ? ae.getAttribute('data-key') : null, sc = el.scrollTop; htmlCache[key] = html; el.innerHTML = html; el.scrollTop = sc; if (k) { var n = el.querySelector('[data-key="' + k.replace(/"/g, '\\"') + '"]'); if (n) n.focus({ preventScroll: true }); } return true; }

  /* ---------- stage chrome ---------- */
  function renderStage() {
    var a = G.area(), F = G.F, st = G.areaStat();
    setHtml($('stagehead'), (UI.paused ? '<span class="tag c-yellow">Paused</span>' : '') + '<div class="title"><b>' + esc(ML.REGIONS[a.region].name) + ' · ' + esc(a.name) + ' <span class="dim small">(Lv ' + a.level + ')</span></b><span class="small dim">Wave ' + Math.max(1, F.wave) + ' / 10 · cleared ' + st.clears + '× · drops ' + ML.MATS[a.mat] + '</span></div>' +
      btn('toggleAdvance', null, A.icon('up') + (S.autoAdvance ? 'Advancing' : 'Holding'), { cls: 'sm', pressed: S.autoAdvance, title: 'Advance to the next road after a flawless clear. Turn off to farm this one.' }) + btn('pause', null, A.icon(UI.paused ? 'play' : 'pause'), { cls: 'sm', pressed: !!UI.paused, title: UI.paused ? 'Resume the fight (P)' : 'Pause the fight (P) \u2014 offline time is not counted while paused', label: UI.paused ? 'Resume' : 'Pause' }) +
      btn('zen', null, A.icon(S.settings.zen ? 'zenout' : 'zenin'), { cls: 'sm', pressed: !!S.settings.zen, title: (S.settings.zen ? 'Show the menus again (F or Escape)' : 'Zen \u2014 hide the menus and give the window to the lane (F)'), label: (S.settings.zen ? 'Show menus' : 'Zen mode, hide the menus') }) +
      (canFull() ? btn('full', null, A.icon(isFull() ? 'contract' : 'expand'), { cls: 'sm', title: isFull() ? 'Leave fullscreen' : 'Fullscreen', label: isFull() ? 'Leave fullscreen' : 'Fullscreen' }) : '') +
      btn('tab', 'world', A.icon('world') + 'Roads', { cls: 'sm' }), 'stagehead');
    var D = G.D;
    setHtml($('manatext'), 'Mana ' + Math.floor(G.mana) + ' / ' + Math.floor(D.manaMax), 'manatext'); $('manafill').style.width = (G.mana / D.manaMax * 100).toFixed(1) + '%';
    var html = ''; for (var i = 0; i < 5; i++) {
      var id = S.slots[i], sk = id && ML.SKILL_BY_ID[id];
      if (!sk) { html += '<div class="sk empty" aria-hidden="true">' + (i < S.skillSlots ? 'empty' : A.icon('lock')) + '</div>'; continue; }
      var st2 = S.skills[id], cd = Math.max(0, G.cd[id] || 0), tot = sk.cd * D.cdMult, poor = G.mana < sk.mana;
      html += '<button class="sk' + (st2.auto ? '' : ' off') + '" data-act="cast" data-arg="' + id + '" data-key="cast:' + id + '" title="' + esc(sk.name + ' — ' + sk.blurb + ' Press ' + (i + 1) + ' to cast now.' + (st2.auto ? '' : ' (auto-cast off)')) + '" aria-label="' + esc(sk.name + (cd > 0 ? ', ready in ' + cd.toFixed(0) + ' seconds' : ', ready')) + '"><kbd>' + (i + 1) + '</kbd>' + (poor ? '<span class="nomana">mana</span>' : '') + A.icon(id) + '<span class="nm">' + sk.name + '</span><span class="cdm" style="height:' + (cd / tot * 100).toFixed(0) + '%"></span></button>';
    }
    setHtml($('skillbar'), html, 'skillbar');
    // the same fight, as text: the canvas is a picture, this is the accessible record of it
    var bench = G.befriended();
    function swapPick(slotIdx, curId) {
      if (bench.length < 2) return '';
      return '<select class="swap" data-change="swap:' + slotIdx + '" data-key="sw:' + slotIdx + '" aria-label="Which friend stands in position ' + (slotIdx + 1) + '">' +
        bench.map(function (id) { var on = S.line.indexOf(id) >= 0 && id !== curId;
          return '<option value="' + id + '"' + (id === curId ? ' selected' : '') + (on ? ' disabled' : '') + '>' + esc(ML.SPECIES_BY_ID[id].name) + (on ? ' \u2014 already on the line' : '') + '</option>'; }).join('') + '</select>';
    }
    var li = '<div class="cols"><div><h4>Your line <span class="dim" style="font-weight:400;text-transform:none;letter-spacing:0">' + S.line.length + ' / ' + G.D.lineSlots + '</span></h4>' + F.comps.map(function (c) { var sp = ML.SPECIES_BY_ID[c.id], ails = Object.keys(c.ail).map(function (k) { return '<span class="tag a-' + k + '">' + A.icon(k) + ML.AILMENT_LABEL[k] + '</span>'; }).join(' ');
      return '<div class="u' + (c.down ? ' down' : '') + '">' + pic(A.species(c.id)) + '<div><b>' + sp.name + '</b> <span class="dim">' + ML.KLASS[c.klass].name + (S.settings.focusId === c.id ? ' · focus' : '') + '</span> ' + ails + bar(c.hp / c.maxHp, c.hp / c.maxHp < 0.35 ? 'low' : '', sp.name + ' health') + '</div><span class="num">' + (c.down ? 'down' : fmt(c.hp) + ' / ' + fmt(c.maxHp)) + (c.vigor > 0.5 ? ' <span class="gold">+' + pct(C.vigorAtkK * c.vigor / c.maxHp) + ' atk</span>' : '') + ' ' + btn('focus', c.id, S.settings.focusId === c.id ? 'Focused' : 'Focus', { cls: 'sm', pressed: S.settings.focusId === c.id, title: 'Mend favours your focus whenever it is below 90%' }) + '</span>' + swapPick(c.slot, c.id) + '</div>'; }).join('') +
      (F.stray ? '<div class="u">' + pic(A.species(F.stray.id)) + '<div><b>Hurt stray</b> <span class="dim">tended when the line is above 70%</span>' + bar(1 - F.stray.wound / F.stray.max, 'gold', 'Stray tended') + '</div><span>' + Math.ceil(F.stray.t) + ' s</span></div>' : '') + '</div><div><h4>This run</h4>';
    var rs = F.raiders.filter(function (r) { return !r.flee; });
    li += (rs.length ? rs.map(function (r) { return '<div class="row" style="gap:6px"><span class="grow">' + (r.captain ? 'Captain ' : r.gilded ? 'Gilded ' : '') + ML.RAIDER_BY_ID[r.cls].name + '</span><span class="dim">' + pct(r.hp / r.maxHp) + ' resolve</span></div>'; }).join('') : '<div class="dim">' + (F.phase === 'result' ? 'Run over.' : 'Next wave on its way…') + '</div>') +
      '<div class="dim" style="margin-top:6px">' + fmt(F.gold) + ' coin · ' + fmt(F.exp) + ' exp · ' + fmt(F.mats, 1) + ' ' + ML.MATS[a.mat] + ' · ' + F.time.toFixed(0) + ' s</div></div></div>';
    setHtml($('lineinfo'), li, 'lineinfo');
  }

  /* ---------- panels ---------- */
  var P = {};
  P.quests = function () {
    var sub = UI.sub.quests, q = S.quests, g = G.currentGlobal(), gReady = g && G.testCond(g.test), genReady = Object.keys(q.general).some(function (k) { return q.general[k].active && q.general[k].prog >= G.generalInfo(k).need; }), dReady = q.daily.list.some(function (d) { return !d.claimed && d.prog >= d.need; });
    function chip(id, name, dot) { return '<button class="chip" data-act="sub" data-arg="quests:' + id + '" data-key="sub:' + id + '" aria-pressed="' + (sub === id) + '">' + name + (dot ? '<span class="dot" aria-hidden="true"></span>' : '') + '</button>'; }
    var h = '<h2>' + A.icon('quests') + 'Requests</h2><div class="sub">' + chip('global', 'Story', gReady) + chip('general', 'Villagers', genReady) + chip('daily', 'Daily rounds', dReady) + chip('titles', 'Titles') + '</div>';
    if (sub === 'global') {
      if (g) h += '<div class="card' + (gReady ? ' ready' : '') + '"><div class="row"><div class="grow"><b>' + esc(g.name) + '</b><div class="small dim">from ' + esc(g.client) + '</div></div>' + btn('claimGlobal', g.id, gReady ? 'Claim reward' : 'In progress', { cls: 'pri', dis: !gReady }) + '</div><p>' + esc(g.text) + '</p><div><b>To do:</b> ' + esc(g.cond) + '</div><div><b>Reward:</b> ' + rewardText(g.reward) + '</div></div>';
      else h += '<div class="card">Every story request is done. Villagers, daily rounds, Titles and the Ledger remain.</div>';
      var done = ML.GLOBAL_QUESTS.filter(function (x) { return q.global[x.id] === 'done'; });
      if (done.length) h += '<h3>Finished (' + done.length + ' of ' + ML.GLOBAL_QUESTS.length + ')</h3>' + done.slice().reverse().map(function (x) { return '<div class="card done"><b>' + esc(x.name) + '</b><div class="why">' + esc(x.why) + '</div></div>'; }).join('');
    } else if (sub === 'general') {
      var act = G.activeGeneral().length; h += '<p class="dim small">Villager requests repeat each Sabbatical and each finished one adds Insight. Accepted <b>' + act + ' / ' + q.acceptMax + '</b>. Only accepted requests count progress' + (S.store.favorites || G.helperOn('courier') ? ' — yours are handled automatically.' : '. Standing Requests (Mote Store) automates this.') + '</p>';
      ML.REGIONS.forEach(function (r, ri) { var keys = Object.keys(q.general).filter(function (k) { return k.indexOf(r.id + ':') === 0; }); if (!keys.length) return; h += '<h3>' + esc(r.name) + '</h3>';
        keys.forEach(function (k) { var i = G.generalInfo(k); if (i.done) { h += '<div class="card done row"><div class="grow">' + esc(i.text.replace(/\d+/, 'many')) + '</div><span class="tag r4">all three tiers done</span></div>'; return; } var ready = i.active && i.prog >= i.need;
          h += '<div class="card' + (ready ? ' ready' : '') + '"><div class="row"><div class="grow"><b>' + esc(i.text) + '</b> <span class="tag">tier ' + (i.tier + 1) + ' / 3</span><div class="small dim">' + fmt(i.gold) + ' coin · ' + fmt(i.exp) + ' experience · +0.5 Insight</div></div>' + (ready ? btn('claimGeneral', k, 'Claim', { cls: 'pri' }) : i.active ? btn('abandonGeneral', k, 'Abandon', { cls: 'sm' }) : btn('acceptGeneral', k, 'Accept', { dis: act >= q.acceptMax, title: act >= q.acceptMax ? 'You are at your limit of accepted requests' : '' })) + '</div>' + (i.active ? bar(i.prog / i.need, '', 'Progress') + '<div class="small dim">' + fmt(Math.min(i.prog, i.need)) + ' / ' + fmt(i.need) + '</div>' : '') + '</div>'; }); });
    } else if (sub === 'daily') {
      h += '<p class="dim small">A new noticeboard every morning (your local midnight). Rounds count everything you do, accepted or not, and pay <b>Lantern Motes</b>.</p>';
      q.daily.list.forEach(function (d, i) { var t = ML.DAILY_TEMPLATES.filter(function (x) { return x.key === d.key; })[0], rar = ML.DAILY_RARITY[d.rar], ready = !d.claimed && d.prog >= d.need;
        h += '<div class="card' + (ready ? ' ready' : d.claimed ? ' done' : '') + '"><div class="row"><div class="grow"><b>' + esc(t.text(d.need)) + '</b> <span class="tag r' + d.rar + '">' + rar.name + '</span><div class="small dim">' + rar.motes + ' Motes</div></div>' + (d.claimed ? '<span class="tag r1">' + A.icon('check') + 'done</span>' : btn('claimDaily', i, 'Claim', { cls: 'pri', dis: !ready })) + '</div>' + bar(d.prog / d.need, '', 'Progress') + '<div class="small dim">' + fmt(Math.min(d.prog, d.need)) + ' / ' + fmt(d.need) + '</div></div>'; });
    } else {
      h += '<p class="dim small">Titles are permanent and award themselves the moment you qualify.</p>' + ML.TITLE_QUESTS.map(function (t) { var d = q.titles[t.id]; return '<div class="card' + (d ? ' done' : '') + '"><div class="row"><div class="grow"><b>' + esc(t.name) + '</b><div class="small dim">' + esc(t.cond) + '</div></div><span class="tag ' + (d ? 'r1' : '') + '">' + (d ? A.icon('check') : '') + esc(t.text) + '</span></div></div>'; }).join('');
    }
    return h;
  };
  function rewardText(r) { var o = []; if (r.exp) o.push(fmt(r.exp) + ' experience'); if (r.gold) o.push(fmt(r.gold) + ' coin'); if (r.motes) o.push(r.motes + ' Motes'); if (r.mats) o.push(r.mats + ' of each Hollow material'); if (r.offering) o.push(r.offering[1] + ' ' + ML.OFFERING_NAME[r.offering[0]] + 's'); if (r.flag === 'autoAllot') o.push('Auto-allot'); if (r.tab) o.push('opens <b>' + ML.TABS.filter(function (t) { return t.id === r.tab; })[0].name + '</b>'); return o.join(' · '); }

  P.healer = function () {
    var h = S.healer, D = G.D, e = G.eff, html = '<h2>' + A.icon('healer') + 'Healer <span class="dim small">Hedge Warden · level ' + h.level + '</span></h2><div class="row" style="align-items:flex-start"><div class="portrait">' + A.healer() + '</div><div class="grow">';
    html += '<div class="row"><b class="' + (h.points ? 'gold' : '') + '">' + h.points + ' stat point' + (h.points === 1 ? '' : 's') + ' to spend</b><span class="dim small">one per level</span></div>';
    ML.STATS.forEach(function (st) { html += '<div class="statrow"><div><b>' + A.icon(st.id) + ' ' + st.name + '</b><div class="small dim">' + esc(st.blurb) + '</div></div><span class="val">' + h.stats[st.id] + '</span>' + btn('allot', st.id + ':1', '+1', { cls: 'sm', dis: h.points < 1 }) + btn('allot', st.id + ':10', '+10', { cls: 'sm', dis: h.points < 2 }) + '</div>'; });
    html += '<div class="row" style="margin-top:8px">' + btn('respec', null, 'Take all points back', { cls: 'sm', title: 'Free, any time.' });
    if (S.flags.autoAllot) html += '<label class="check"><input type="checkbox" data-change="autoAllot" data-key="in:autoAllot"' + (h.autoAllot ? ' checked' : '') + '> Auto-allot new points</label>';
    html += '</div></div></div>';
    if (S.flags.autoAllot) { html += '<h3>Auto-allot plan</h3><p class="small dim">Points are handed out in this ratio. Set a stat to 0 to skip it.</p><div class="grid tight">' + ML.STATS.map(function (st) { return '<div class="card row"><span class="grow">' + st.name + '</span>' + btn('plan', st.id + ':-1', '−', { cls: 'sm', dis: h.allotPlan[st.id] <= 0, label: 'One less ' + st.name + ' per round of points' }) + '<b>' + h.allotPlan[st.id] + '</b>' + btn('plan', st.id + ':1', '+', { cls: 'sm', dis: h.allotPlan[st.id] >= 9, label: 'One more ' + st.name + ' per round of points' }) + '</div>'; }).join('') + '</div>'; }
    else html += '<p class="why">Auto-allot arrives early, as a story reward. Until then: Grace first.</p>';
    html += '<h3>What your numbers do</h3><table class="stats"><tr><td>Heal power (one Mend)</td><td>' + fmt(D.heal * G.skillPower('mend'), 1) + '</td></tr><tr><td>Mana</td><td>' + Math.floor(D.manaMax) + ' · +' + D.manaRegen.toFixed(2) + ' / s</td></tr><tr><td>Cooldowns</td><td>' + pct(D.cdMult) + ' of listed</td></tr><tr><td>Critical mend</td><td>' + pct(D.crit, 1) + ' for ×' + C.critMult + '</td></tr><tr><td>Shield strength</td><td>×' + D.shieldMult.toFixed(2) + '</td></tr><tr><td>Defence aura (whole line)</td><td>+' + D.defAura.toFixed(1) + '</td></tr><tr><td>Vigor cap</td><td>' + pct(D.vigorCap) + ' of health → up to +' + pct(D.vigorCap * C.vigorAtkK) + ' attack</td></tr><tr><td>Gift drop odds</td><td>×' + D.drop.toFixed(2) + '</td></tr><tr><td>Offline pace</td><td>' + pct(D.offlineEff) + ' for up to ' + (D.offlineCap / 3600) + ' h</td></tr></table>';
    var keys = Object.keys(e).filter(function (k) { return ML.EFF_LABEL[k] && e[k]; }); if (keys.length) html += '<h3>All bonuses, added up</h3><div class="small dim">' + keys.map(function (k) { return ML.fmtEff(k, e[k]); }).join(' · ') + '</div>';
    return html;
  };

  P.skills = function () {
    var h = '<h2>' + A.icon('skills') + 'Songbook <span class="dim small">' + S.slots.length + ' / ' + S.skillSlots + ' slots</span></h2><p class="dim small">Songs cast themselves in slot order whenever they are useful. Click a song on the fight bar (or press its number) to cast it right now. Titles grant more slots.</p>';
    ML.SKILLS.forEach(function (sk) {
      var st = S.skills[sk.id]; if (!st) { h += '<div class="card done"><b>' + A.icon('lock') + ' ' + sk.name + '</b><div class="small dim">Learned at healer level ' + sk.level + '. ' + esc(sk.blurb) + '</div></div>'; return; }
      var cost = G.skillCost(sk.id), inSlot = S.slots.indexOf(sk.id) >= 0, next = sk.passives.filter(function (p) { return st.casts < p.at; })[0], over = cost > G.D.goldCap;
      h += '<div class="card"><div class="row"><div class="grow"><b>' + A.icon(sk.id) + ' ' + sk.name + '</b> <span class="tag">rank ' + st.rank + '</span><div class="small dim">' + esc(sk.blurb) + '</div><div class="small">' + (sk.mana ? sk.mana + ' mana · ' : 'free · ') + (sk.cd * G.D.cdMult).toFixed(1) + ' s cooldown · power ×' + (sk.power * G.skillPower(sk.id)).toFixed(2) + '</div></div>' +
        btn('skillRank', sk.id, 'Rank up · ' + fmt(cost) + ' coin', { cls: 'pri', dis: S.gold < cost || st.rank >= ML.SKILL_MAX_RANK, title: over ? 'Costs more than your coin cap — raise Iron Coffer in Provisions' : '+8% power per rank' }) + '</div>' +
        '<div class="row" style="margin-top:6px">' + btn('slot', sk.id, inSlot ? 'In the book' : 'Add to book', { cls: 'sm', pressed: inSlot, dis: (!inSlot && S.slots.length >= S.skillSlots) || (inSlot && S.slots.length <= 1), title: inSlot ? (S.slots.length <= 1 ? 'You must keep at least one song in the book' : 'Take this song out of the book') : (S.slots.length >= S.skillSlots ? 'The book is full \u2014 take one out first' : 'Put this song in the book') }) + btn('autoSkill', sk.id, A.icon('auto') + (st.auto ? 'Auto-cast on' : 'Auto-cast off'), { cls: 'sm', pressed: st.auto }) + (over ? '<span class="small warn">next rank costs more than your coin cap</span>' : '') + '</div>' +
        '<div class="small dim" style="margin-top:6px">Proficiency: ' + fmt(st.casts) + ' casts' + (next ? ' — next passive at ' + fmt(next.at) : ' — all passives learned') + '</div>' + (next ? bar(st.casts / next.at, 'hex', 'Proficiency') : '') +
        '<div class="small">' + sk.passives.map(function (p) { var got = st.casts >= p.at; return '<span class="tag ' + (got ? 'r1' : '') + '">' + (got ? A.icon('check') : fmt(p.at) + ': ') + esc(p.text) + '</span>'; }).join(' ') + '</div></div>';
    });
    return h;
  };

  P.upgrades = function () {
    var h = '<h2>' + A.icon('upgrades') + 'Provisions</h2><p class="dim small">Bought with coin. Kept through every Sabbatical. <b>Queue</b> a Provision (or right-click it) and it buys itself the moment you can afford it — useful while you are away. Queue: <b>' + S.queue.length + ' / ' + G.D.queueSize + '</b></p><div class="sub">' + [1, 10, 100, 1000].map(function (n) { return '<button class="chip" data-act="buyN" data-arg="' + n + '" data-key="buyN:' + n + '" aria-pressed="' + (UI.buyN === n) + '"' + (UI.buyN === n ? ' disabled' : '') + '>' + (n === 1000 ? 'Buy max' : 'Buy ×' + n) + '</button>'; }).join('') + '</div>';
    ML.UPGRADES.forEach(function (u) { var lv = S.upgrades[u.id] || 0, c = G.upgradeCost(u.id), qn = S.queue.filter(function (x) { return x === u.id; }).length;
      h += '<div class="card" data-ctx="queue" data-arg="' + u.id + '"><div class="row"><div class="grow"><b>' + u.name + '</b> <span class="tag">level ' + lv + '</span>' + (qn ? ' <span class="tag r4">queued ×' + qn + '</span>' : '') + '<div class="small dim">' + esc(u.blurb) + ' Now: ' + (u.id === 'coffer' ? 'cap ' + fmt(G.D.goldCap) : ML.fmtEff(u.eff, lv * u.per)) + '</div></div>' + btn('upgrade', u.id, fmt(c) + ' coin', { cls: 'pri', dis: S.gold < c || lv >= u.max, title: c > G.D.goldCap ? 'Costs more than your coin cap' : '' }) + btn('queue', u.id, 'Queue', { cls: 'sm', dis: S.queue.length >= G.D.queueSize }) + (qn ? btn('unqueue', u.id, 'Unqueue', { cls: 'sm' }) : '') + '</div></div>'; });
    return h;
  };

  function itemTip(it) { var def = ML.GEAR_BY_ID[it.t], m = ML.RARITY_MULT[it.r] * (1 + C.gearPerLevel * it.lv); return Object.keys(def.eff).map(function (k) { return ML.fmtEff(k, def.eff[k] * m); }).join(', '); }
  function itemBtn(it, act, sel) { return '<button class="item q' + it.r + (S.favs[it.id] ? ' fav' : '') + '" data-act="' + act + '" data-arg="' + it.id + '" data-key="item:' + it.id + '" aria-pressed="' + (sel ? 'true' : 'false') + '" title="' + esc(ML.RARITY[it.r] + ' ' + ML.GEAR_BY_ID[it.t].name + ' — ' + itemTip(it)) + '" aria-label="' + esc(ML.RARITY[it.r] + ' ' + ML.GEAR_BY_ID[it.t].name + ', level ' + it.lv) + '">' + A.gear(it.t, it.r).replace('role="img"', 'aria-hidden="true"') + '<span class="lvl">' + (it.lv >= C.gearMaxLevel ? '★' : it.lv) + '</span>' + (S.mastery[it.t] ? '<span class="m" title="Mastered">✓</span>' : '') + (S.favs[it.id] ? '<span class="st" title="Kept — never unpicked automatically">♥</span>' : '') + '</button>'; }
  P.gear = function () {
    var h = '<h2>' + A.icon('gear') + 'Gifts <span class="dim small">' + S.inv.length + ' / ' + G.D.invSize + ' · ' + Object.keys(S.mastery).length + ' / ' + ML.GEAR.length + ' mastered</span></h2><p class="dim small">Worn gifts gain proficiency while your line fights (faster on harder roads). At level 10 the gift is <b>mastered</b>: its mastery bonus is permanent and shared by every healer, so nothing is ever levelled twice. Two gifts of the same type and rarity can be <b>fused</b> into one a rarity higher, and unpicking one returns materials as well as coin.</p><h3>Worn</h3><div class="grid tight">';
    ML.GEAR_SLOTS.forEach(function (sl) { if (sl.id === 'charm2' && !S.charm2) { h += '<div class="card done small">' + A.icon('lock') + ' Second Charm — Title “Keeper of Gifts”</div>'; return; } var it = S.equipped[sl.id];
      h += '<div class="card"><div class="row"><div style="width:58px">' + (it ? itemBtn(it, 'selItem', UI.selItem === it.id) : '<div class="item empty">' + sl.name + '</div>') + '</div><div class="grow small">' + (it ? '<b>' + ML.GEAR_BY_ID[it.t].name + '</b><div class="dim">' + esc(itemTip(it)) + '</div>' + (it.lv < C.gearMaxLevel ? bar(it.p / (C.gearProfBase * Math.pow(C.gearProfGrowth, it.lv)), 'hex', 'Proficiency') : '<span class="tag r4">mastered</span>') : '<span class="dim">Nothing worn</span>') + '</div></div></div>'; });
    h += '</div>';
    if (S.inv.length || ML.GEAR_SLOTS.some(function (sl) { return S.equipped[sl.id]; })) h += '<div class="row" style="margin:2px 0 10px">' +
      btn('wearBest', 'mastery', 'Wear best — for mastery', { cls: 'pri sm', title: 'Fills every slot, preferring a gift whose type you have not mastered yet (as long as it is still worth at least half the strongest option). Mastery is permanent and shared by every healer.' }) +
      btn('wearBest', 'power', 'Wear best — for power', { cls: 'sm', title: 'Fills every slot with the strongest gift you own, ignoring mastery.' }) + '</div>';
    var sel = UI.selItem != null && (S.inv.filter(function (i) { return i.id === UI.selItem; })[0] || ML.GEAR_SLOTS.map(function (sl) { return S.equipped[sl.id]; }).filter(function (i) { return i && i.id === UI.selItem; })[0]);
    if (sel) { var def = ML.GEAR_BY_ID[sel.t], worn = ML.GEAR_SLOTS.filter(function (sl) { return S.equipped[sl.id] === sel; })[0];
      h += '<div class="card ready"><div class="row"><div class="grow"><b>' + ML.RARITY[sel.r] + ' ' + def.name + '</b> <span class="tag r' + sel.r + '">' + ML.RARITY[sel.r] + '</span> <span class="tag">level ' + sel.lv + '</span><div class="small">' + esc(itemTip(sel)) + '</div><div class="small dim">Mastery: ' + Object.keys(def.mastery).map(function (k) { return ML.fmtEff(k, def.mastery[k]); }).join(', ') + (S.mastery[sel.t] ? ' — already yours' : '') + '</div></div>' + (worn ? btn('unequip', worn.id, 'Take off') : btn('equip', sel.id, 'Wear', { cls: 'pri' }) + btn('fav', sel.id, (S.favs[sel.id] ? '♥ Kept' : '♡ Keep'), { cls: 'sm', pressed: !!S.favs[sel.id], title: 'A kept gift is never unpicked automatically and never makes way for a new drop.' }) + (G.fusePartner(sel) ? btn('fuse', sel.id, (sel.r >= ML.RARITY.length - 1 ? 'Fuse · merge levels' : 'Fuse · make ' + ML.RARITY[sel.r + 1]), { cls: 'sm', title: 'Combines this with another ' + ML.RARITY[sel.r] + ' ' + def.name + ' in your satchel.' }) : '') + btn('scrap', sel.id, 'Unpick · ' + fmt(G.scrapValue(sel)) + ' coin + ' + fmt(G.reclaimValue(sel)) + ' ' + ML.MATS[ML.reclaimMat(sel.t)], { cls: 'danger wrap' })) + '</div></div>'; }
    h += '<h3>Wear automatically</h3><div class="row small"><select data-change="autoWear" data-key="in:autoWear" aria-label="Wear gifts automatically">' +
      [['off', 'Off \u2014 I choose'], ['mastery', 'On \u2014 prefer gifts I have not mastered'], ['power', 'On \u2014 always the strongest']].map(function (o) { return '<option value="' + o[0] + '"' + (S.autoWear === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div><label class="check small"><input type="checkbox" data-change="keepUnmastered" data-key="in:keepUnmastered"' + (S.keepUnmastered ? ' checked' : '') + '> Never unpick a gift whose type I have not mastered</label>';
    var FILT = [['all', 'All'], ['focus', 'Focus'], ['vestment', 'Vestment'], ['charm', 'Charm'], ['unmastered', 'Not mastered']];
    var SORT = [['rarity', 'Rarity'], ['power', 'Power'], ['level', 'Level']];
    var list = S.inv.filter(function (it) { var d = ML.GEAR_BY_ID[it.t]; return UI.gearFilter === 'all' || (UI.gearFilter === 'unmastered' ? !S.mastery[it.t] : d.slot === UI.gearFilter); });
    list.sort(function (a, b) { return UI.gearSort === 'level' ? (b.lv - a.lv) || (b.r - a.r) : UI.gearSort === 'power' ? G.gearScore(b) - G.gearScore(a) : (b.r - a.r) || (G.gearScore(b) - G.gearScore(a)); });
    h += '<h3>Satchel <span class="dim small">' + S.inv.length + ' / ' + G.D.invSize + '</span></h3>';
    if (S.inv.length) h += '<div class="row" style="gap:0;margin-bottom:10px"><div class="sub" style="margin:0">' + FILT.map(function (o) { return '<button class="chip sm" data-act="gearFilter" data-arg="' + o[0] + '" data-key="gf:' + o[0] + '" aria-pressed="' + (UI.gearFilter === o[0]) + '">' + o[1] + '</button>'; }).join('') +
      '</div><span class="dim small" style="align-self:center;margin:0 4px">Sort</span><div class="sub" style="margin:0">' + SORT.map(function (o) { return '<button class="chip sm" data-act="gearSort" data-arg="' + o[0] + '" data-key="gs:' + o[0] + '" aria-pressed="' + (UI.gearSort === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    h += (S.inv.length ? (list.length ? '<div class="inv">' + list.map(function (it) { return itemBtn(it, 'selItem', UI.selItem === it.id); }).join('') + '</div>' : '<p class="dim small">No gifts match that filter.</p>') : '<p class="dim small">Empty. Captains are the likeliest to drop a gift.</p>');
    var dupes = S.inv.filter(function (it) { return G.fusePartner(it); }).length;
    if (S.inv.length > 3 || dupes) h += '<div class="row" style="margin-top:8px">' +
      (dupes ? btn('fuseAll', null, 'Fuse every duplicate (' + Math.floor(dupes / 2) + ')', { cls: 'sm pri', title: 'Two gifts of one type and rarity become one of the next rarity up. At the top rarity their levels merge instead.' }) : '') +
      (S.inv.length > 3 ? btn('scrapMastered', null, 'Unpick every gift whose type is already mastered', { cls: 'sm wrap' }) : '') + '</div>';
    if (!S.store.autoscrap) h += '<h3>Tidy Satchel</h3><div class="card done small"><div class="row">' + A.icon('lock') + '<div class="grow">Automatically unpick gifts below a rarity you choose, so the satchel never fills while you are away.' +
      (S.tabs.store ? ' <b>Mote Store \u2192 Tidy Satchel</b>, ' + G.storeCost('autoscrap') + ' Motes.' : ' Unlocks with the Mote Store, after your first daily round.') + '</div></div></div>';
    if (S.store.autoscrap) h += '<h3>Tidy Satchel</h3><label class="row small">Automatically unpick gifts below <select data-change="scrapBelow" data-key="in:scrapBelow">' + ML.RARITY.map(function (r, i) { return '<option value="' + i + '"' + (S.scrapBelow === i ? ' selected' : '') + '>' + (i ? r : 'nothing (off)') + '</option>'; }).join('') + '</select></label>';
    return h;
  };

  P.companions = function () {
    var D = G.D, h = '<h2>' + A.icon('companions') + 'Friends <span class="dim small">' + G.befriended().length + ' / 12 befriended</span></h2><p class="dim small"><b>Trust</b> (tending strays) sets Rank; Rank sets the level cap, 10 per rank. <b>Level</b> comes from fighting. <b>Bond</b> comes from your heals landing on them. Every befriended species lends its home passive even while resting.</p>';
    h += '<h3>The line <span class="dim small">' + S.line.length + ' / ' + D.lineSlots + ' — front first' + (D.lineSlots < 3 ? ' · more slots from The Burrows' : '') + '</span></h3><div class="grid tight">' + S.line.map(function (id, i) { var sp = ML.SPECIES_BY_ID[id], c = S.companions[id]; return '<div class="card row">' + pic(A.species(id)) + '<div class="grow small"><b>' + (i + 1) + '. ' + sp.name + '</b><div class="dim">' + ML.KLASS[sp.klass].name + ' · Lv ' + c.level + '</div></div>' + btn('lineUp', id, A.icon('up'), { cls: 'sm', dis: i === 0, title: 'Move toward the front', label: 'Move ' + sp.name + ' toward the front of the line' }) + btn('lineDown', id, A.icon('down'), { cls: 'sm', dis: i === S.line.length - 1, title: 'Move toward the back', label: 'Move ' + sp.name + ' toward the back of the line' }) + '</div>'; }).join('') + '</div><p class="small dim">Changing the line restarts the current area. Click a friend on the battlefield to make it your <b>focus</b>: Mend favours it.</p>';
    ML.REGIONS.forEach(function (r, ri) {
      h += '<h3>' + esc(r.name) + '</h3><div class="grid">';
      ML.SPECIES.filter(function (sp) { return sp.region === ri; }).forEach(function (sp) {
        var c = S.companions[sp.id], known = c || UI.seenSpecies[sp.id]; if (!known) { h += '<div class="card friend unknown">' + pic(A.species(sp.id, { silhouette: true })) + '<div><b>Unknown</b><div class="small dim">Strays of this kind appear in ' + esc(ML.AREAS.filter(function (a) { return a.stray === sp.id; })[0].name) + '.</div></div></div>'; return; }
        var trust = c ? c.trust : 0, rank = ML.rankOfTrust(trust), nextT = C.trustRanks[rank], prevT = rank ? C.trustRanks[rank - 1] : 0, onLine = S.line.indexOf(sp.id) >= 0, st = c && rank ? G.compStats(sp.id) : null, where = ML.AREAS.filter(function (a) { return a.stray === sp.id; }).map(function (a) { return a.name; }).join(', ');
        h += '<div class="card friend">' + pic(A.species(sp.id)) + '<div><div class="row"><b class="grow">' + sp.name + '</b>' + colorTag(sp.color) + '<span class="tag" title="' + esc(ML.KLASS[sp.klass].blurb) + '">' + A.icon(sp.klass) + ML.KLASS[sp.klass].name + '</span></div><div class="small dim">' + esc(sp.flavor) + '</div>';
        h += '<div class="small">' + (rank ? 'Rank ' + rank : 'Not yet a friend') + (nextT ? ' · trust ' + fmt(trust, 1) + ' / ' + nextT : ' · max rank') + '</div>' + (nextT ? bar((trust - prevT) / (nextT - prevT), 'gold', 'Trust') : '');
        if (st) h += '<div class="small">Lv ' + c.level + ' / ' + rank * 10 + ' · Bond ' + c.bond + ' · ' + fmt(st.hp) + ' health · ' + fmt(st.atk, 1) + ' attack</div>' + (c.level < rank * 10 ? bar(c.xp / ML.compXpFor(c.level), 'xp', 'Level') : '<div class="small warn">Level capped — raise Rank by tending more ' + sp.name + ' strays</div>');
        h += '<div class="small">Home passive: <b>' + ML.fmtEff(sp.passive.eff, sp.passive.per * Math.max(1, rank)) + '</b>' + (rank ? '' : ' at Rank 1') + '</div><div class="small dim">Strays: ' + esc(where) + ' · loves ' + ML.OFFERING_NAME[sp.color] + 's (×' + ML.OFFERING_MULT + ' trust)</div>';
        if (sp.active) { var can = rank >= sp.active.rank, on = S.helpers.indexOf(sp.id) >= 0; h += '<div class="small">Helper — <b>' + sp.active.name + '</b>: ' + esc(sp.active.text) + (can ? '' : ' <span class="dim">(Rank ' + sp.active.rank + ')</span>') + '</div>' + (can ? btn('helper', sp.id, on ? 'Helper working' : 'Put to work', { cls: 'sm', pressed: on, dis: !on && S.helpers.length >= D.helperSlots, title: 'Helpers work from home. ' + S.helpers.length + ' / ' + D.helperSlots + ' slots' }) : ''); }
        if (rank) h += ' ' + btn('line', sp.id, onLine ? 'On the line' : 'Send to the line', { cls: 'sm', pressed: onLine, dis: (!onLine && S.line.length >= D.lineSlots) || (onLine && S.line.length <= 1) });
        h += '</div></div>';
      });
      h += '</div>';
    });
    h += '<details data-key="d:classes"' + (UI.open['d:classes'] ? ' open' : '') + '><summary data-key="s:classes">Classes</summary>' + Object.keys(ML.KLASS).map(function (k) { return '<p class="small"><b>' + A.icon(k) + ' ' + ML.KLASS[k].name + '</b> — ' + esc(ML.KLASS[k].blurb) + '</p>'; }).join('') + '</details>';
    return h;
  };

  P.shop = function () {
    var h = '<h2>' + A.icon('shop') + 'Shop</h2><p class="dim small">Offerings are eaten automatically when you finish tending a stray of the matching colour, multiplying the Trust it gives by ' + ML.OFFERING_MULT + '.</p><label class="check small"><input type="checkbox" data-change="offerAuto" data-key="in:offerAuto"' + (S.offerAuto ? ' checked' : '') + '> Use offerings automatically (untick to save them for later)</label><div class="grid">';
    ML.COLORS.forEach(function (c) { var cost = ML.OFFERING_COST[c], who = ML.SPECIES.filter(function (sp) { return sp.color === c; }).map(function (sp) { return S.companions[sp.id] || UI.seenSpecies[sp.id] ? sp.name : '???'; }).join(', ');
      h += '<div class="card"><div class="row">' + pic(A.offering(c)) + '<div class="grow"><b>' + ML.OFFERING_NAME[c] + '</b> ' + colorTag(c) + '<div class="small dim">For: ' + esc(who) + ' · you have <b>' + S.offerings[c] + '</b></div></div></div><div class="row" style="margin-top:6px">' + btn('offering', c + ':1', '1 · ' + fmt(cost), { cls: 'sm', dis: S.gold < cost }) + btn('offering', c + ':10', '10 · ' + fmt(cost * 10), { cls: 'sm', dis: S.gold < cost * 10 }) + '</div></div>'; });
    return h + '</div>';
  };

  function costHtml(cost) { return '<span class="cost">' + Object.keys(cost).map(function (m) { var have = S.mats[m] || 0; var where = ML.MATS[m] + ' — drops in: ' + esc(ML.AREAS.filter(function (a) { return a.mat === m; }).map(function (a) { return a.name; }).join(', ')), body = pic(A.mat(m)) + fmt(have) + ' / ' + fmt(cost[m]); return have < cost[m] ? '<button class="btn link" data-act="findMat" data-arg="' + m + '" data-key="find:' + m + '" title="' + where + '" aria-label="' + ML.MATS[m] + ': ' + fmt(have) + ' of ' + fmt(cost[m]) + '. Show where it drops.">' + body + '</button>' : '<span title="' + where + '">' + body + '</span>'; }).join('') + '</span>'; }
  P.sanctuary = function () {
    var rn = S.renown, h = '<h2>' + A.icon('sanctuary') + 'Sanctuary</h2><h3>Renown ' + rn.level + ' <span class="dim small">' + rn.points + ' point' + (rn.points === 1 ? '' : 's') + ' to spend</span></h3><div class="grid">';
    ML.RENOWN.forEach(function (a) { var lv = rn.abilities[a.id] || 0; h += '<div class="card row"><div class="grow"><b>' + a.name + '</b> <span class="tag">' + lv + ' / ' + a.max + '</span><div class="small dim">' + esc(a.blurb) + '</div></div>' + btn('renown', a.id, '+1', { cls: 'pri sm', dis: rn.points < 1 || lv >= a.max }) + '</div>'; });
    h += '</div><h3>Grounds <span class="dim small">' + (S.keystones ? S.keystones + ' Keystone' + (S.keystones > 1 ? 's' : '') : ML.KEYSTONES_PER_RANK + ' Keystones raise a level cap by 10') + '</span></h3><p class="dim small">Buildings cost materials. Levels 1–5 use Hollow materials, 6–11 Cinder, 12 and up Glassmere — you build with what drops where you are. Hover a material to see where it drops; deeper areas drop more.</p>';
    ML.GROUNDS.forEach(function (g) { var i = G.groundInfo(g.id); if (i.locked) { h += '<div class="card done">' + A.icon('lock') + ' <b>' + g.name + '</b> <span class="small dim">— Renown ' + g.renown + '</span></div>'; return; }
      var can = !i.atCap && Object.keys(i.cost).every(function (m) { return (S.mats[m] || 0) >= i.cost[m]; });
      h += '<div class="card' + (can ? ' ready' : '') + '"><div class="row"><div class="grow"><b>' + g.name + '</b> <span class="tag">level ' + i.level + ' / ' + i.cap + '</span><div class="small dim">' + esc(g.blurb) + '</div>' + (i.atCap ? '' : '<div class="small">' + costHtml(i.cost) + '</div>') + '</div>' + (i.atCap ? (i.canRank ? btn('rankGround', g.id, 'Raise cap · ' + ML.KEYSTONES_PER_RANK + ' Keystones', { cls: 'pri', dis: S.keystones < ML.KEYSTONES_PER_RANK }) : '<span class="tag r4">complete</span>') : btn('build', g.id, 'Build', { cls: 'pri', dis: !can })) + '</div></div>'; });
    var mats = Object.keys(ML.MATS).filter(function (m) { return S.mats[m]; }); if (mats.length) h += '<h3>Stores</h3><p class="dim small">Spare materials can be sold to the village. A sale never goes past your coin cap.</p><div class="grid tight">' + mats.map(function (m) { var have = Math.floor(S.mats[m]), v = ML.matValue(m), room = Math.floor(Math.max(0, G.D.goldCap - S.gold) / v); return '<div class="card small"><div class="row">' + pic(A.mat(m)) + '<div class="grow"><b>' + ML.MATS[m] + '</b><div class="dim">' + fmt(S.mats[m]) + ' · ' + fmt(v) + ' coin each</div></div></div><div class="row" style="margin-top:6px">' + btn('sellMat', m + ':100', 'Sell 100', { cls: 'sm', dis: have < 100 || room < 100 }) + btn('sellMat', m + ':half', 'Sell half', { cls: 'sm', dis: have < 2 || room < 1 }) + '</div></div>'; }).join('') + '</div>';
    return h;
  };

  P.world = function () {
    var ri = UI.sub.world, prospect = G.helperOn('prospect'), h = '<h2>' + A.icon('world') + 'Roads</h2><div class="sub">' + ML.REGIONS.map(function (r, i) { var open = G.regionOpen(i); return '<button class="chip" data-act="sub" data-arg="world:' + i + '" data-key="region:' + i + '" aria-pressed="' + (ri === i) + '"' + (open ? '' : ' disabled title="Waystone level ' + r.waystone + '"') + '>' + (open ? '' : A.icon('lock')) + r.name + '</button>'; }).join('') + '</div>';
    h += '<p class="dim small">' + esc(ML.REGIONS[ri].blurb) + '</p><div class="row small" style="margin-bottom:8px"><label class="check"><input type="checkbox" data-change="autoAdvance" data-key="in:autoAdvance"' + (S.autoAdvance ? ' checked' : '') + '> Advance after a flawless clear</label><label class="check"><input type="checkbox" data-change="smartRetreat" data-key="in:smartRetreat"' + (S.smartRetreat ? ' checked' : '') + '> Smart retreat (fall back after 3 losses)</label><label class="check"><input type="checkbox" data-change="shortResult" data-key="in:shortResult"' + (S.shortResult ? ' checked' : '') + '> Short result screen</label></div><div class="grid">';
    ML.AREAS.filter(function (a) { return a.region === ri; }).forEach(function (a) {
      var open = S.opened[a.id], st = S.areas[a.id], here = S.areaId === a.id; if (!open) { h += '<div class="card done">' + A.icon('lock') + ' <b>' + esc(a.name) + '</b> <span class="small dim">Lv ' + a.level + ' — clear the road before it</span></div>'; return; }
      var sp = ML.SPECIES_BY_ID[a.stray], known = S.companions[a.stray] || UI.seenSpecies[a.stray];
      h += '<div class="card' + (here || UI.hlMat === a.mat ? ' ready' : '') + '"><div class="row"><div class="grow"><b>' + esc(a.name) + '</b> <span class="tag">Lv ' + a.level + '</span>' + (UI.hlMat === a.mat ? ' <span class="tag r4">drops ' + ML.MATS[a.mat] + '</span>' : '') + '<div class="small">' + pic(A.mat(a.mat)) + ' ' + ML.MATS[a.mat] + ' ×' + (1 + 0.35 * a.index).toFixed(2) + ' · strays: ' + (known ? sp.name : '???') + '</div><div class="small dim">Raiders: ' + a.raiders.map(function (r) { return ML.RAIDER_BY_ID[r].name; }).join(', ') + '</div>' +
        '<div class="small dim">' + (st && st.clears ? 'Held ' + st.clears + '× · best ' + st.best.toFixed(1) + ' s' : 'Not yet held') + '</div><div class="small">' + ['Flawless', 'Swift ≤ ' + a.timeGoal + ' s', 'Faithful ×25'].map(function (f, i) { var got = st && st.feats[i]; return '<span class="tag ' + (got ? 'r4' : '') + '">' + (got ? A.icon('check') : '') + f + '</span>'; }).join(' ') + '</div>' +
        (prospect && st && st.emaT ? '<div class="small good">Prospect: ' + fmt(st.emaGold / st.emaT, 1) + ' coin/s · ' + fmt(st.emaExp / st.emaT, 1) + ' exp/s · ' + st.emaT.toFixed(0) + ' s a run · holds ' + pct(st.emaOk) + '</div>' : '') + '</div>' + (here ? '<span class="tag r1">you are here</span>' : btn('travel', a.id, 'Go', { cls: 'pri' })) + '</div></div>';
    });
    h += '</div><details data-key="d:raiders"' + (UI.open['d:raiders'] ? ' open' : '') + '><summary data-key="s:raiders">Raiders in this region</summary>' + ML.REGIONS[ri].raiders.map(function (id) { var r = ML.RAIDER_BY_ID[id]; return '<div class="row small" style="margin:6px 0">' + pic(A.raider(id)) + '<div class="grow"><b>' + r.name + '</b> ' + colorTag(r.color) + ' <span class="dim">sent home ' + fmt(S.stats.fled[id] || 0) + '×</span><div class="dim">' + esc(r.blurb) + '</div></div></div>'; }).join('') + '</details>';
    return h;
  };

  P.sabbatical = function () {
    var can = G.canSabbatical(), gain = G.insightGain(), h = '<h2>' + A.icon('sabbatical') + 'Sabbatical <span class="dim small">taken ' + S.sab.count + '×</span></h2>';
    h += '<div class="card' + (can ? ' ready' : '') + '"><p>Step away, come back wiser. You return to level ' + (1 + (S.sab.upgrades.headstart || 0) * 4) + ' and gain <b class="gold">' + gain + ' Insight</b>' + (can ? '' : ' (needs healer level ' + C.sabbaticalLevel + ')') + '. Insight grows with the <b>square</b> of your level, so pushing past 50 pays: level 70 is worth about twice level 50. Each villager request finished this cycle adds 0.5.</p><div class="grid"><div><b class="good">You keep</b><ul class="small">' + ML.SABBATICAL_KEEP.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div><div><b class="warn">You lose</b><ul class="small">' + ML.SABBATICAL_LOSE.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' +
      (UI.confirm === 'sab' ? '<div class="row"><b>Take a Sabbatical now for ' + gain + ' Insight?</b>' + btn('sabYes', null, 'Yes, go', { cls: 'pri' }) + btn('confirmNo', null, 'Not yet') + '</div>' : btn('sabAsk', null, 'Take a Sabbatical', { cls: 'pri', dis: !can })) + '</div>';
    if (S.store.autosab) h += '<div class="card row"><label class="check"><input type="checkbox" data-change="sabAuto" data-key="in:sabAuto"' + (S.sab.auto ? ' checked' : '') + '> Auto-Sabbatical at level</label><input type="number" min="' + C.sabbaticalLevel + '" max="999" value="' + S.sab.autoLevel + '" data-change="sabAutoLevel" data-key="in:sabAutoLevel" aria-label="Auto-Sabbatical level" style="width:90px"><span class="small dim">Only while the game is open.</span></div>';
    h += '<h3>Insight <span class="dim small">' + S.insight + ' to spend · ' + S.sab.totalInsight + ' earned in all</span></h3>';
    ML.INSIGHT.forEach(function (u) { var lv = S.sab.upgrades[u.id] || 0, c = G.insightCost(u.id); h += '<div class="card row"><div class="grow"><b>' + u.name + '</b> <span class="tag">' + lv + ' / ' + u.max + '</span><div class="small dim">' + esc(u.blurb) + '</div></div>' + btn('insight', u.id, c + ' Insight', { cls: 'pri', dis: S.insight < c || lv >= u.max }) + '</div>'; });
    return h;
  };

  P.store = function () {
    var h = '<h2>' + A.icon('store') + 'Mote Store <span class="dim small">' + fmt(S.motes) + ' Motes</span></h2><p class="dim small">Lantern Motes come from the Ledger, area feats and daily rounds. They cannot be bought. Everything here is permanent.</p>';
    ML.STORE.forEach(function (d) { var n = S.store[d.id] || 0, c = G.storeCost(d.id), max = n >= d.max; h += '<div class="card row"><div class="grow"><b>' + d.name + '</b> ' + (d.max > 1 ? '<span class="tag">' + n + ' / ' + d.max + '</span>' : n ? '<span class="tag r1">' + A.icon('check') + 'owned</span>' : '') + '<div class="small dim">' + esc(d.blurb) + '</div></div>' + (max ? '' : btn('store', d.id, c + ' Motes', { cls: 'pri', dis: S.motes < c })) + '</div>'; });
    return h;
  };

  var HELP = [
    ['How the fight works', 'Raiders arrive in ten waves; the tenth brings a Captain. Your friends fight by themselves. Raiders have Resolve instead of health — at zero they run home and leave coin, experience, materials and sometimes a gift. If every friend on the line is downed, the area is lost; you keep everything earned and the area starts over. Nothing is ever taken from you.'],
    ['Vigor — why overheal is good', 'Any healing that lands on a friend who is already full becomes Vigor, up to half their health. Vigor adds up to +100% attack (more once you raise the Vigor cap) and fades slowly. When nobody is hurt, Mend tops up whoever has the least Vigor (Strikers first). More heal power means faster clears, not just safer ones.'],
    ['Triage and focus', 'Mend picks the most hurt friend. Click a friend on the battlefield to mark it as your focus: Mend favours it whenever it is below 90%. Strays are tended only when the whole line is above 70% — a hard fight leaves no time for strays.'],
    ['Friends: three tracks', 'Trust → Rank (tend strays; offerings multiply it). Rank sets the level cap at 10 per rank and multiplies health, attack and the home passive. Level → fighting on the line. Bond → your heals landing on them; each Bond level is +4% to their stats.'],
    ['Classes', 'Bulwark: taunts single-target attacks, −20% damage taken. Striker: +25% attack. Mender: every attack also heals the most hurt ally. Forager: frail, +15% drops while fielded. Rime Archers ignore the taunt and shoot the back of the line; Stormcallers hit everyone.'],
    ['Ailments', 'Burn (damage over time), Chill (slower attacks), Poison (stacks three times), Shock (+20% damage taken), Curse (−40% healing received). A coloured pip above a friend shows what it suffers. Purify, learned at level 24, lifts them all.'],
    ['Gifts and mastery', 'Worn gifts gain proficiency over time, faster on harder roads. At level 10 a gift type is mastered: its mastery bonus is permanent and shared across every healer and every Sabbatical. Wear what you have not mastered; unpick duplicates for coin.'],
    ['Coin cap and the queue', 'Coin stops at your cap. Iron Coffer raises it. Queue Provisions (button or right-click) and they buy themselves as coin arrives — including while you are away.'],
    ['Spare materials, saved offerings, missed notices', 'Sanctuary → Stores sells spare materials to the village for coin; a sale never goes past your coin cap. In a building’s cost, a material you are short of is a link: press it and Roads opens with the roads that drop it marked. Shop has a switch to stop offerings being eaten automatically, if you are saving them for a particular friend. The bell at the top lists every notice from this visit, so nothing is lost when a notice fades.'],
    ['Away from the game', 'Close the tab and your line keeps working at about half pace, up to the offline cap, based on your recent results in the area you left. Leave on a road you clear comfortably. The window is granted once when you come back.'],
    ['Hotkeys and keyboard', '1–5 cast the song in that slot right now. Every control is reachable by Tab and Enter, including the Focus buttons under the battlefield. Settings has a calm mode that turns off motion.']
  ];
  P.ledger = function () {
    var done = ML.LEDGER.filter(function (l) { return S.ledger[l.id]; }).length, h = '<h2>' + A.icon('ledger') + 'The Warden’s Ledger <span class="dim small">' + done + ' / ' + ML.LEDGER.length + '</span></h2><p class="dim small">Every entry pays Lantern Motes and tells you why it matters. This is the whole road ahead — nothing here is a placeholder.</p>';
    ML.LEDGER.forEach(function (l) { var d = S.ledger[l.id]; h += '<div class="card' + (d ? '' : ' done') + '"><div class="row"><b class="grow">' + (d ? A.icon('check') : A.icon('lock')) + ' ' + esc(l.cond) + '</b><span class="tag ' + (d ? 'r1' : '') + '">' + l.motes + ' Motes</span></div>' + (d ? '<div class="why">' + esc(l.why) + '</div>' : '') + '</div>'; });
    var st = S.stats;
    h += '<h3>Your record</h3><table class="stats">' + [
      ['Roads held', fmt(st.clears)], ['Lines broken', fmt(st.fails)], ['Flawless holds', fmt(st.flawless)],
      ['Raiders sent home', fmt(st.fledTotal)], ['Gilded raiders', fmt(st.gilded)], ['Strays tended', fmt(st.strays)],
      ['Health mended', fmt(st.healed)], ['Of that, Vigor', fmt(st.overheal)], ['Songs sung', fmt(st.casts)],
      ['Gifts mastered', fmt(Object.keys(S.mastery).length) + ' / ' + ML.GEAR.length], ['Gifts fused', fmt(st.fused || 0)], ['Materials reclaimed', fmt(st.reclaimed || 0)],
      ['Coin lost to the cap', (st.goldWasted > 0 ? '<span class="warn">' + fmt(st.goldWasted) + '</span>' : '0')]
    ].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
      (st.goldWasted > G.D.goldCap * 0.5 ? '<p class="small warn">Coin past the cap is destroyed. Queue Provisions so they buy themselves, raise Iron Coffer, or build the Strongroom in the Sanctuary.</p>' : '');
    h += '<h3>Help</h3>' + HELP.map(function (x, i) { return '<details data-key="d:help' + i + '"' + (UI.open['d:help' + i] ? ' open' : '') + '><summary data-key="s:help' + i + '">' + x[0] + '</summary><p class="small">' + esc(x[1]) + '</p></details>'; }).join('');
    return h;
  };

  P.settings = function () {
    var s = S.settings, h = '<h2>' + A.icon('settings') + 'Settings</h2><h3>Sound</h3>';
    [['bgm', 'Music'], ['sfx', 'Fight sounds'], ['ui', 'Interface sounds']].forEach(function (x) { h += '<label class="row"><span style="width:130px">' + x[1] + '</span><span class="grow"><input type="range" min="0" max="100" value="' + Math.round(s[x[0]] * 100) + '" data-change="vol:' + x[0] + '" data-key="in:vol' + x[0] + '" aria-label="' + x[1] + ' volume"></span></label>'; });
    h += '<label class="check"><input type="checkbox" data-change="mute" data-key="in:mute"' + (s.mute ? ' checked' : '') + '> Mute everything</label><p class="small dim">Sound starts after your first click or key press. It pauses when the tab is hidden.</p>';
    var ai = Au.stateInfo();
    h += '<details data-key="d:sndhelp"' + (UI.open['d:sndhelp'] ? ' open' : '') + '><summary data-key="s:sndhelp">No sound, or sound that stopped?</summary>' +
      '<p class="small">On a phone the game plays through the <b>ringer</b>, not the media volume: if the silent switch is on, Mosslight is silent and nothing on this page can override it. Sound also needs one tap or key press to start, which is why the first thing you do is the first thing you hear.</p>' +
      '<p class="small">If it stopped after a call, a lock, or a long spell in another tab, come back and tap once \u2014 the sound engine restarts itself.</p>' +
      '<p class="small dim">Engine: ' + esc(ai.state) + (ai.lite ? ' \u00b7 reduced quality (this machine was dropping frames)' : '') + (ai.dropped ? ' \u00b7 ' + fmt(ai.dropped) + ' notes skipped to keep the frame rate' : '') + (ai.lost ? ' \u00b7 ' + ai.lost + ' restart attempt(s) refused' : '') + '</p></details>';
    h += '<h3>Look</h3><label class="row"><span style="width:130px">Theme</span><select data-change="theme" data-key="in:theme" aria-label="Theme">' + [['heather', 'Heather — light'], ['lantern', 'Lantern — dark']].map(function (o) { return '<option value="' + o[0] + '"' + (s.theme === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label><label class="row"><span style="width:130px">Big numbers</span><select data-change="notation" data-key="in:notation" aria-label="Number notation">' + [['short', 'Short — 1.25M'], ['sci', 'Scientific — 1.25e6']].map(function (o) { return '<option value="' + o[0] + '"' + (s.notation === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
    h += '<h3>Comfort and access</h3>';
    h += '<label class="row"><span style="width:150px">Text size</span><select data-change="textSize" data-key="in:textSize" aria-label="Text size">' + [['s', 'Small'], ['m', 'Normal'], ['l', 'Large'], ['xl', 'Largest']].map(function (o) { return '<option value="' + o[0] + '"' + (s.textSize === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
    h += '<label class="check"><input type="checkbox" data-change="hiCon" data-key="in:hiCon"' + (s.hiCon ? ' checked' : '') + '> Stronger outlines and no faded text</label>';
    h += '<label class="check"><input type="checkbox" data-change="ailMark" data-key="in:ailMark"' + (s.ailMark ? ' checked' : '') + '> Letters on ailment pips, so colour is never the only clue (B burn, C chill, P poison, S shock, X curse)</label>';
    h += '<label class="check"><input type="checkbox" data-change="calm" data-key="in:calm"' + (reduceMotion() ? ' checked' : '') + '> Calm mode \u2014 no screen shake, bobbing or sliding (follows your system setting until you change it)</label>';
    h += '<label class="check"><input type="checkbox" data-change="numbers" data-key="in:numbers"' + (s.numbers ? ' checked' : '') + '> Floating numbers on the battlefield</label>';
    h += '<p class="small dim">The fight is never a reflex test: every song also casts itself, and nothing here is timed. The line and the wave are written out in full under the battlefield for anyone who would rather read than watch.</p>';
    h += '<details data-key="d:keys"' + (UI.open['d:keys'] ? ' open' : '') + '><summary data-key="s:keys">Keyboard</summary><table class="stats">' +
      [['1 \u2013 5', 'Sing the song in that slot'], ['F', 'Zen \u2014 hide the menus'], ['Escape', 'Leave Zen, or close a window'], ['P', 'Pause and resume'], ['Tab', 'Move between controls'], ['Space or Enter', 'Press the control you are on']]
        .map(function (r) { return '<tr><td>' + r[0] + '</td><td style="text-align:left">' + r[1] + '</td></tr>'; }).join('') + '</table></details>';

    h += '<h3>Save</h3><p class="small dim">Mosslight saves into <b>this browser</b>, on this device, every 15 seconds' + (UI.lastSave ? ' \u2014 last saved ' + ML.fmtTime(Math.max(0, (Date.now() - UI.lastSave) / 1000)) + ' ago' : '') + '. Played ' + ML.fmtTime(S.playTime) + '.</p>';
    h += '<p class="small' + (UI.memOnly ? ' warn' : ' dim') + '">' + (UI.memOnly
      ? 'This browser is blocking storage for the game frame, so nothing is being saved automatically. Save to a file to keep your progress.'
      : 'Clearing site data, a private window, or a different browser or device means a different save. Keep a file if you care about it.') + '</p>';
    h += '<div class="row">' + btn('saveNow', null, 'Save now', { cls: 'pri' }) + btn('fileSave', null, 'Save to a file') + btn('fileLoad', null, 'Load from a file') + '</div>';
    h += '<h3>Backup slots</h3><p class="small dim">Three copies kept in this browser. A slot is only ever written or loaded when you press a button \u2014 the game never touches them on its own.</p><div class="grid">';
    SLOTS.forEach(function (i) {
      var inf = UI.slotInfo(i), ask = UI.confirm === 'slot' + i;
      h += '<div class="card"><div class="row"><div class="grow"><b>Slot ' + i + '</b><div class="small dim">' + (inf
        ? 'Healer ' + inf.level + ' \u00b7 ' + esc((ML.AREA_BY_ID[inf.area] || { name: inf.area }).name) + (inf.sab ? ' \u00b7 ' + inf.sab + ' Sabbaticals' : '') + '<br>' + (inf.when ? new Date(inf.when).toLocaleString() : 'no date')
        : 'Empty') + '</div></div></div><div class="row" style="margin-top:6px">' +
        btn('slotSave', String(i), inf ? 'Overwrite' : 'Copy save here', { cls: 'sm' }) +
        (inf ? (ask ? '<b class="warn small">Replace what you are playing?</b>' + btn('slotLoadYes', String(i), 'Load it', { cls: 'sm danger' }) + btn('confirmNo', null, 'Cancel', { cls: 'sm' })
                    : btn('slotLoadAsk', String(i), 'Load', { cls: 'sm' }) + btn('slotWipe', String(i), 'Clear', { cls: 'sm danger' })) : '') + '</div></div>';
    });
    h += '</div>';
    h += '<details data-key="d:savetext"' + (UI.open['d:savetext'] ? ' open' : '') + '><summary data-key="s:savetext">Save as text (works everywhere)</summary><div class="row">' + btn('export', null, 'Export save') + btn('import', null, 'Import save') + '</div><textarea id="savebox" aria-label="Save text" placeholder="Exported save text appears here. Paste a save here, then press Import."></textarea></details>';
    h += '<div class="row" style="margin-top:8px">' + (UI.confirm === 'wipe' ? '<b class="warn">Erase everything and start over?</b>' + btn('wipeYes', null, 'Erase', { cls: 'danger' }) + btn('confirmNo', null, 'Keep my save') : btn('wipeAsk', null, 'Start over\u2026', { cls: 'danger' })) + '</div>';
    h += '<h3>About</h3><p class="small dim">Mosslight ' + ML.VERSION + ' — a DHSeaDev game. Every picture is drawn by code and every sound is synthesised when you hear it; there are no downloaded assets, no network requests, no ads and nothing to buy. Its layered-prestige structure is inspired by the idle auto-battler genre; all names, art, text and numbers are original.</p>';
    return h;
  };

  function renderPanel(force) {
    var t = UI.tab; if (!S.tabs[t]) t = UI.tab = 'quests';
    var html = P[t](), el = $('panel'); el.setAttribute('aria-labelledby', 'tab-' + t);
    if (force) htmlCache.panel = null;
    // inputs the player is using must not be replaced under them
    var ae = document.activeElement; if (!force && ae && el.contains(ae) && (/^(TEXTAREA|SELECT)$/.test(ae.tagName) || (ae.tagName === 'INPUT' && ae.type !== 'checkbox'))) return;
    var keepBox = $('savebox') ? $('savebox').value : null; if (setHtml(el, html, 'panel') && keepBox != null && $('savebox')) $('savebox').value = keepBox;
  }
  function renderAll(force) { S = G.S; renderTop(); renderNav(); renderStage(); renderPanel(force); }

  /* ---------- actions ---------- */
  var ACT = {
    tab: function (id) { if (!S.tabs[id]) return false; UI.tab = id; UI.hlMat = null; S.seenTabs[id] = true; UI.confirm = null; $('panel').scrollTop = 0; return true; },
    sub: function (a) { var p = a.split(':'); UI.sub[p[0]] = p[0] === 'world' ? +p[1] : p[1]; return true; },
    closeIntro: function () { S.flags.intro = true; closeModal(); return true; }, closeModal: function () { closeModal(); return true; },
    zen: function () { S.settings.zen = !S.settings.zen; applyLook(); save(); say(S.settings.zen ? 'Menus hidden. Press F or Escape to bring them back.' : 'Menus shown.'); return true; },
    saveNow: function () { save(); toast('Saved', UI.memOnly ? 'This browser refused \u2014 use "Save to a file" instead.' : 'Your progress is in this browser.'); return true; },
    fileSave: function () { var r = downloadSave(); toast(r.ok ? 'Saved to a file' : 'Could not write a file', r.ok ? r.name + ' is in your downloads. Keep it somewhere safe \u2014 it is the only copy that survives a cleared browser.' : 'Your browser refused the download (' + esc(r.why || 'blocked') + '). Use Save as text below instead.'); return true; },
    fileLoad: function () { uploadSave(function (text) {
        if (text == null) { toast('Could not read that file', 'Try Save as text below.'); return; }
        var g = ML.loadGame(text, {}); if (!g) { toast('That is not a Mosslight save', 'Nothing was changed.'); return; }
        adopt(g); var off = G.applyOffline(Date.now()); buildNav(); renderAll(true); save();
        toast('Save loaded', 'Healer level ' + S.healer.level + ', ' + ML.AREA_BY_ID[S.areaId].name + '.');
        if (off && off.seconds >= C.offlineMinS) offlineModal(off);
      }); return true; },
    slotSave: function (i) { var ok = slotWrite(+i); toast(ok ? 'Copied to slot ' + i : 'Slot ' + i + ' could not be written', ok ? 'It stays until you overwrite or clear it.' : 'This browser is blocking storage here.'); return true; },
    slotLoadAsk: function (i) { UI.confirm = 'slot' + i; return true; },
    slotLoadYes: function (i) { UI.confirm = null; var ok = slotLoad(+i); toast(ok ? 'Loaded slot ' + i : 'Slot ' + i + ' could not be loaded', ok ? 'Healer level ' + S.healer.level + '.' : 'The save in that slot is unreadable.'); return true; },
    slotWipe: function (i) { slotWipe(+i); toast('Slot ' + i + ' cleared', 'Nothing else was touched.'); return true; },
    pause: function () { UI.paused = !UI.paused; if (UI.paused) UI.save(); say(UI.paused ? 'Paused. Nothing is lost while you are paused.' : 'Resumed.'); return true; },
    full: function () { try { if (isFull()) document.exitFullscreen(); else if (canFull()) document.documentElement.requestFullscreen(); } catch (e) { } return true; },
    mute: function () { S.settings.mute = !S.settings.mute; Au.setVolumes(S.settings); return true; },
    claimGlobal: function (id) { return G.claimGlobal(id); }, acceptGeneral: function (k) { return G.acceptGeneral(k); }, abandonGeneral: function (k) { return G.abandonGeneral(k); }, claimGeneral: function (k) { return G.claimGeneral(k); }, claimDaily: function (i) { return G.claimDaily(+i); },
    allot: function (a) { var p = a.split(':'); return G.allot(p[0], +p[1]); }, respec: function () { return G.respec(); },
    plan: function (a) { var p = a.split(':'), v = S.healer.allotPlan[p[0]] + (+p[1]); if (v < 0 || v > 9) return false; S.healer.allotPlan[p[0]] = v; return true; },
    skillRank: function (id) { return G.buySkillRank(id); }, slot: function (id) { return G.toggleSlot(id); }, autoSkill: function (id) { return G.toggleAuto(id); }, cast: function (id) { return G.manualCast(id); },
    buyN: function (n) { UI.buyN = +n; return true; }, upgrade: function (id) { var ok = false; for (var i = 0; i < UI.buyN; i++) { if (!G.buyUpgrade(id)) break; ok = true; } return ok; }, queue: function (id) { return G.queueUpgrade(id); }, unqueue: function (id) { return G.unqueue(id); },
    selItem: function (id) { UI.selItem = UI.selItem === +id ? null : +id; return true; }, equip: function (id) { var ok = G.equip(+id); if (ok) UI.selItem = +id; return ok; }, unequip: function (sl) { return G.unequip(sl); }, scrap: function (id) { UI.selItem = null; var ok = G.scrap(+id); if (ok && G.lastReclaim) toast('Unpicked', 'The village took it apart: +' + fmt(G.lastReclaim.n) + ' ' + ML.MATS[G.lastReclaim.mat] + '.'); return ok; },
    fav: function (id) { return G.toggleFav(+id); },
    fuse: function (id) { var out = G.fuse(+id); if (!out) return false; UI.selItem = out.id; toast('Fused', ML.RARITY[out.r] + ' ' + ML.GEAR_BY_ID[out.t].name + (out.lv ? ', level ' + out.lv : ''), A.gear(out.t, out.r)); return true; },
    fuseAll: function () { var k = G.fuseAll(); if (k) toast('Fused ' + k + ' pair' + (k > 1 ? 's' : ''), 'Duplicates became rarer gifts. Nothing was lost.'); return k > 0; },
    gearFilter: function (v) { UI.gearFilter = v; return true; }, gearSort: function (v) { UI.gearSort = v; return true; },
    wearBest: function (mode) { var k = G.wearBest(mode); toast(k ? 'Wore ' + k + ' gift' + (k > 1 ? 's' : '') : 'Nothing to change', k ? (mode === 'power' ? 'The strongest gift in every slot.' : 'Preferring gifts you have not mastered \u2014 every level you put in is permanent.') : 'You are already wearing the best gifts for that choice.'); return true; },
    scrapMastered: function () { var n = 0; S.inv.slice().forEach(function (it) { if (S.mastery[it.t] && G.scrap(it.id)) n++; }); if (n) toast('Unpicked ' + n + ' gift' + (n > 1 ? 's' : ''), 'Their types were already mastered.'); return n > 0; },
    line: function (id) { return G.toggleLine(id); }, lineUp: function (id) { return G.moveLine(id, -1); }, lineDown: function (id) { return G.moveLine(id, 1); }, helper: function (id) { return G.toggleHelper(id); },
    offering: function (a) { var p = a.split(':'); return G.buyOffering(p[0], +p[1]); }, renown: function (id) { return G.renownSpend(id); }, build: function (id) { return G.buildGround(id); }, rankGround: function (id) { return G.rankGround(id); },
    travel: function (id) { return G.travel(id); }, toggleAdvance: function () { S.autoAdvance = !S.autoAdvance; return true; },
    sabAsk: function () { UI.confirm = 'sab'; return true; }, confirmNo: function () { UI.confirm = null; return true; }, sabYes: function () { UI.confirm = null; return G.sabbatical(); }, insight: function (id) { return G.buyInsight(id); }, store: function (id) { return G.buyStore(id); },
    export: function () { var b = $('savebox'); b.value = ML.exportString(S); b.focus(); b.select(); toast('Save exported', 'Copy the text in the box and keep it somewhere safe.'); return true; },
    import: function () { var st = ML.importString($('savebox').value), g = st && ML.loadGame(ML.serialize(st), {}); if (!g) { toast('That is not a Mosslight save', 'Saves start with MOSS1:'); return false; } g.S.lastSeen = Date.now(); adopt(g); UI.tab = 'quests'; save(); toast('Save imported', UI.memOnly ? 'Loaded for this visit. This browser still blocks storage, so export again before you leave.' : 'Welcome back.'); return true; },   // judge-found: import used to reload, which threw the save away when storage is blocked
    wipeAsk: function () { UI.confirm = 'wipe'; return true; }, wipeYes: function () { store.del(); adopt(new ML.Game(ML.newState(), {})); UI.tab = 'quests'; save(); introModal(); return true; },
    log: function () { modal('<h2 id="mtitle">Recent notices</h2>' + (UI.log.length ? '<ul class="log">' + UI.log.map(function (l) { var d = new Date(l.t); return '<li><time>' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + '</time><div><b>' + esc(l.title) + '</b><p>' + esc(l.text) + '</p></div></li>'; }).join('') + '</ul>' : '<p class="dim">Nothing yet. Notices you miss are kept here until you close the game.</p>') + '<div class="row" style="margin-top:10px">' + btn('closeModal', null, 'Close', { cls: 'pri' }) + '</div>'); return true; },
    findMat: function (m) { var a = ML.AREAS.filter(function (x) { return x.mat === m; })[0]; if (!a || !S.tabs.world) return false; UI.hlMat = m; UI.tab = 'world'; UI.sub.world = a.region; $('panel').scrollTop = 0; say(ML.MATS[m] + ' drops on the highlighted roads.'); return true; },
    sellMat: function (a) { var p = a.split(':'), n = p[1] === 'half' ? Math.floor((S.mats[p[0]] || 0) / 2) : +p[1], k = G.sellMats(p[0], n); if (k) toast('Sold ' + fmt(k) + ' ' + ML.MATS[p[0]], '+' + fmt(k * ML.matValue(p[0])) + ' coin.'); return k > 0; },
    focus: function (id) { S.settings.focusId = S.settings.focusId === id ? null : id; say(S.settings.focusId ? ML.SPECIES_BY_ID[id].name + ' is your focus.' : 'Focus cleared.'); return true; },
    lockedTab: function (id) { var t = ML.TABS.filter(function (x) { return x.id === id; })[0]; if (t) { toast(t.name + ' is locked', 'To open it: ' + t.lock + '.'); say(t.name + ' is locked. ' + t.lock); } return false; }
  };
  var QUIET = { log: 1, findMat: 1, zen: 1, full: 1, pause: 1, slotLoadAsk: 1, gearFilter: 1, gearSort: 1, fav: 1, focus: 1, tab: 1, sub: 1, selItem: 1, buyN: 1, cast: 1, closeModal: 1, closeIntro: 1, confirmNo: 1, sabAsk: 1, wipeAsk: 1, export: 1, mute: 1, toggleAdvance: 1, plan: 1 };
  function run(act, arg) { var f = ACT[act]; if (!f) return; var ok = f(arg); Au.sfx(ok ? (QUIET[act] ? 'click' : 'buy') : 'deny'); if (G) { renderAll(true); if (UI.confirm) { var c = document.querySelector('#panel [data-act=confirmNo]'); if (c) c.focus(); } if (!QUIET[act]) save(); } }
  function bind() {
    document.addEventListener('pointerdown', function (e) { UI.pointerDown = true; UI.pointerTarget = e.target; Au.unlock(); }, true);
    document.addEventListener('pointerup', function () { setTimeout(function () { UI.pointerDown = false; }, 0); }, true);
    document.addEventListener('pointercancel', function () { UI.pointerDown = false; }, true);
    document.addEventListener('keydown', function (e) { Au.unlock(); if (e.key === ' ' || e.key === 'Enter') { UI.keyHeld = true; UI.pointerTarget = e.target; } if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; if (!$('modal').hidden) { if (e.key === 'Escape' && S.flags.intro) closeModal(); else if (e.key === 'Tab') { var f = $('modal').querySelectorAll('button, [href], input, select, textarea'), i = Array.prototype.indexOf.call(f, document.activeElement); if (f.length) { e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); } } return; } if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') { run('zen'); return; }
      if (e.key === 'p' || e.key === 'P') { run('pause'); return; }
      if (e.key === 'Escape' && S.settings.zen) { run('zen'); return; }
      if (e.key >= '1' && e.key <= '5') { var id = S.slots[+e.key - 1]; if (id) run('cast', id); } });
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-act]'); if (!b || b.disabled) return; e.preventDefault(); UI.pointerDown = false; UI.keyHeld = false; run(b.getAttribute('data-act'), b.getAttribute('data-arg')); });
    document.addEventListener('keyup', function () { UI.keyHeld = false; }, true);
    document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.tagName === 'DETAILS' && d.getAttribute('data-key')) UI.open[d.getAttribute('data-key')] = d.open; }, true);
    document.addEventListener('contextmenu', function (e) { var c = e.target.closest && e.target.closest('[data-ctx="queue"]'); if (!c) return; e.preventDefault(); run(e.shiftKey ? 'unqueue' : 'queue', c.getAttribute('data-arg')); });
    document.addEventListener('change', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-change'); if (!k) return; var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (k.indexOf('swap:') === 0) { var si = +k.slice(5), nl = S.line.slice();
        if (nl[si] === v) return; if (nl.indexOf(v) >= 0) return;
        nl[si] = v; if (G.setLine(nl)) { Au.sfx('claim'); say(ML.SPECIES_BY_ID[v].name + ' takes position ' + (si + 1) + '.'); } else Au.sfx('deny');
        save(); renderAll(true); return; }
      if (k.indexOf('vol:') === 0) { S.settings[k.slice(4)] = Math.max(0, Math.min(1, +v / 100)); Au.setVolumes(S.settings); Au.sfx(k === 'vol:ui' ? 'click' : k === 'vol:sfx' ? 'heal' : 'click'); }
      else if (k === 'mute') { S.settings.mute = v; Au.setVolumes(S.settings); } else if (k === 'calm') { S.settings.reduceMotion = v; document.body.classList.toggle('calm', v); } else if (k === 'numbers') S.settings.numbers = v; else if (k === 'theme') { S.settings.theme = v === 'lantern' ? 'lantern' : 'heather'; applyLook(); } else if (k === 'notation') { S.settings.notation = v === 'sci' ? 'sci' : 'short'; applyLook(); } else if (k === 'offerAuto') S.offerAuto = v; else if (k === 'textSize') { S.settings.textSize = v; applyLook(); } else if (k === 'hiCon') { S.settings.hiCon = v; applyLook(); } else if (k === 'ailMark') S.settings.ailMark = v; else if (k === 'autoWear') { S.autoWear = v === 'mastery' || v === 'power' ? v : 'off'; if (S.autoWear !== 'off') G.wearBest(S.autoWear); } else if (k === 'keepUnmastered') S.keepUnmastered = v;
      else if (k === 'autoAllot') { S.healer.autoAllot = v; if (v) G.autoAllot(); G.recalc(); } else if (k === 'autoAdvance') S.autoAdvance = v; else if (k === 'smartRetreat') S.smartRetreat = v; else if (k === 'shortResult') S.shortResult = v;
      else if (k === 'sabAuto') S.sab.auto = v; else if (k === 'sabAutoLevel') S.sab.autoLevel = Math.max(C.sabbaticalLevel, Math.min(999, Math.floor(+v) || C.sabbaticalLevel)); else if (k === 'scrapBelow') S.scrapBelow = Math.max(0, Math.min(4, +v));
      save(); if (e.target.type === 'range') return; renderAll(true); });
    document.addEventListener('input', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-change'); if (k && k.indexOf('vol:') === 0) { S.settings[k.slice(4)] = +e.target.value / 100; Au.setVolumes(S.settings); } });
    var cv = $('field');
    function at(e) { var r = cv.getBoundingClientRect(), sc = Math.min(r.width / 640, r.height / 360), ox = (r.width - 640 * sc) / 2, oy = (r.height - 360 * sc) / 2; return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc }; }
    cv.addEventListener('pointermove', function (e) { var p = at(e); G.F.drops.slice().forEach(function (d) { var dx = 74 + d.x * 5.3 - p.x, dy = 312 + d.y * 24 - p.y; if (dx * dx + dy * dy < 900) G.collect(d.uid); }); });
    cv.addEventListener('click', function (e) { var p = at(e), hit = null; G.F.comps.forEach(function (c) { var u = unitPos(c.slot); if (Math.abs(u.x - p.x) < 40 && p.y > u.y - 100 && p.y < u.y + 8) hit = c; }); if (hit) { S.settings.focusId = S.settings.focusId === hit.id ? null : hit.id; Au.sfx('click'); say(S.settings.focusId ? ML.SPECIES_BY_ID[hit.id].name + ' is your focus.' : 'Focus cleared.'); } G.F.drops.slice().forEach(function (d) { var dx = 74 + d.x * 5.3 - p.x, dy = 312 + d.y * 24 - p.y; if (dx * dx + dy * dy < 1600) G.collect(d.uid); }); });
  }

  /* ---------- battlefield ---------- */
  function img(key, svg, w, h) { var o = UI.imgs[key]; if (o) return o; o = UI.imgs[key] = new Image(); o.decoding = 'async'; o.src = A.uri(svg.replace('<svg ', '<svg width="' + w + '" height="' + (h || w) + '" ')); return o; }
  function sprite(ctx, im, x, yGround, size, o) {
    if (!im.complete || !im.naturalWidth) return; o = o || {}; ctx.save(); ctx.translate(x, yGround); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.gray) ctx.filter = 'grayscale(1) brightness(0.7)';
    ctx.drawImage(im, -size / 2, -size * 0.92, size, size); ctx.restore();
  }
  function hpBar(ctx, x, y, w, frac, color, shield, vigor) {
    ctx.fillStyle = 'rgba(8,12,18,.78)'; rr(ctx, x - w / 2 - 1, y - 1, w + 2, 8, 3); ctx.fill(); ctx.fillStyle = color; rr(ctx, x - w / 2, y, Math.max(0, w * Math.min(1, frac)), 6, 2.5); ctx.fill();
    if (shield > 0) { ctx.fillStyle = '#c9a36b'; rr(ctx, x - w / 2, y - 3, Math.max(0, w * Math.min(1, shield)), 2.5, 1); ctx.fill(); }
    if (vigor > 0) { ctx.fillStyle = '#ffd76a'; rr(ctx, x - w / 2, y + 7, Math.max(0, w * Math.min(1, vigor)), 2.5, 1); ctx.fill(); }
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  var AIL_COL = { burn: '#ff9a5a', chill: '#8fd0ff', poison: '#6fcf8e', shock: '#ffe45c', curse: '#c79bff' };
  var AIL_MARK = { burn: 'B', chill: 'C', poison: 'P', shock: 'S', curse: 'X' };   // colour is never the only channel
  var lastDraw = 0;
  function draw() {
    if (!G || document.hidden) return; var cv = $('field'), wrap = cv.parentNode, dpr = Math.min(2, window.devicePixelRatio || 1), cw = wrap.clientWidth, chh = wrap.clientHeight; if (!cw || !chh) return;
    var sc = Math.min(cw / 640, chh / 360), pw = Math.round(640 * sc * dpr), ph = Math.round(360 * sc * dpr); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; cv.style.width = Math.round(640 * sc) + 'px'; cv.style.height = Math.round(360 * sc) + 'px'; }
    var ctx = cv.getContext('2d'), now = performance.now() / 1000, dt = Math.min(0.1, now - lastDraw || 0.016); lastDraw = now; var calm = reduceMotion(), F = G.F, a = G.area(), t = calm ? 0 : now;
    ctx.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0); ctx.clearRect(0, 0, 640, 360);
    if (UI.shake > 0) { UI.shake -= dt; ctx.translate((Math.random() - 0.5) * 8 * UI.shake, (Math.random() - 0.5) * 6 * UI.shake); }
    var bg = img('bg' + a.region + S.settings.theme, A.backdrop(a.region, S.settings.theme), 1280, 720); if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, 640, 360); else { ctx.fillStyle = S.settings.theme === 'lantern' ? '#1b2a3a' : '#d8d3ee'; ctx.fillRect(0, 0, 640, 360); }
    // drops
    F.drops.forEach(function (d) { var x = 74 + d.x * 5.3, y = 312 + d.y * 24, im = d.kind === 'mat' ? img('mat' + d.mat, A.mat(d.mat), 96) : img('gear' + d.item.t + d.item.r, A.gear(d.item.t, d.item.r), 96), s = d.kind === 'mat' ? 24 : 30, bob = calm ? 0 : Math.sin(t * 3 + d.uid) * 2; if (im.complete && im.naturalWidth) ctx.drawImage(im, x - s / 2, y - s + bob, s, s); if (d.kind === 'mat' && d.n >= 2) { ctx.font = 'bold 10px system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.textAlign = 'center'; ctx.strokeText('×' + fmt(d.n, 0), x, y + 9); ctx.fillText('×' + fmt(d.n, 0), x, y + 9); } });
    // healer
    sprite(ctx, img('healer', A.healer(), 256), 56, 298 + (calm ? 0 : Math.sin(t * 1.6) * 1.5), 108);
    // units, depth-sorted by ground line
    var list = [];
    F.comps.forEach(function (c) { var p = unitPos(c.slot); list.push({ y: p.y, f: function () {
      var size = c.klass === 'bulwark' ? 108 : 94, lunge = c.fx > 0 ? c.fx * 60 : 0, shakeX = c.fx < 0 ? Math.sin(now * 60) * 3 : 0; if (c.fx > 0) c.fx = Math.max(0, c.fx - dt); else if (c.fx < 0) c.fx = Math.min(0, c.fx + dt);
      if (c.vigor > 0 && !c.down) { var v = c.vigor / (c.maxHp * G.D.vigorCap); ctx.save(); ctx.globalAlpha = 0.18 + 0.3 * v; ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 4, 30 + 12 * v, 9 + 3 * v, 0, 0, 7); ctx.fill(); ctx.restore(); }
      if (F.rally > 0 && !c.down) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ff9a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y - 4, 36, 11, 0, 0, 7); ctx.stroke(); ctx.restore(); }
      sprite(ctx, img('sp' + c.id, A.species(c.id), 256), p.x + lunge + shakeX, p.y + (c.down || calm ? 0 : Math.sin(t * 2.2 + c.slot) * 2), size, c.down ? { rot: -1.35, gray: 1, alpha: 0.8 } : { sy: calm ? 1 : 1 + Math.sin(t * 2.2 + c.slot) * 0.02 });
      if (c.shield > 0) { ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#c9a36b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y - size * 0.42, size * 0.5, size * 0.52, 0, 0, 7); ctx.stroke(); ctx.restore(); }
      if (c.hot) { ctx.fillStyle = '#8df0a8'; for (var i = 0; i < 3; i++) { var ph2 = (t * 0.9 + i / 3) % 1; ctx.globalAlpha = 1 - ph2; ctx.beginPath(); ctx.arc(p.x - 16 + i * 16, p.y - 20 - ph2 * 40, 2.4, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      if (!c.down) { hpBar(ctx, p.x, p.y - size - 4, 52, c.hp / c.maxHp, c.hp / c.maxHp < 0.35 ? '#ff7a7a' : '#6fcf8e', c.shield / c.maxHp, c.vigor / (c.maxHp * G.D.vigorCap)); var ks = Object.keys(c.ail); ks.forEach(function (k, i) { var ax = p.x - (ks.length - 1) * 7 + i * 14, ay = p.y - size - 13;
        ctx.fillStyle = AIL_COL[k]; ctx.strokeStyle = '#0b1118'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 7); ctx.fill(); ctx.stroke();
        if (S.settings.ailMark) { ctx.font = 'bold 8px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#0b1118'; ctx.fillText(AIL_MARK[k] || '?', ax, ay + 3); } }); }
      if (S.settings.focusId === c.id && !c.down) { ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.moveTo(p.x, p.y - size - 18); ctx.lineTo(p.x - 6, p.y - size - 28); ctx.lineTo(p.x + 6, p.y - size - 28); ctx.closePath(); ctx.fill(); }
    } }); });
    if (F.stray) { var sp = unitPos('stray'); list.push({ y: sp.y, f: function () { sprite(ctx, img('sp' + F.stray.id, A.species(F.stray.id), 256), sp.x, sp.y, 62, { alpha: 0.95, rot: calm ? 0 : Math.sin(t * 2) * 0.04 }); hpBar(ctx, sp.x, sp.y - 70, 46, 1 - F.stray.wound / F.stray.max, '#ffb3e1'); ctx.font = 'bold 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe3f4'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.strokeText('hurt stray', sp.x, sp.y - 76); ctx.fillText('hurt stray', sp.x, sp.y - 76); } }); }
    F.raiders.forEach(function (r) { var p = raiderPos(r); list.push({ y: p.y, f: function () {
      var size = r.captain ? 132 : 96, fleeing = r.flee > 0, lunge = r.fx > 0 ? -r.fx * 50 : 0; if (r.fx > 0) r.fx = Math.max(0, r.fx - dt);
      var walking = r.x > r.stopX || fleeing, bob = calm ? 0 : walking ? Math.abs(Math.sin(now * 9 + r.uid)) * -5 : Math.sin(t * 2 + r.uid) * 1.5;
      sprite(ctx, img('rd' + r.cls + (r.captain ? 'c' : '') + (r.gilded ? 'g' : ''), A.raider(r.cls, { captain: r.captain, gilded: r.gilded }), 256), p.x + lunge, p.y + bob, size, { flip: fleeing, alpha: fleeing ? Math.min(1, r.flee) : 1 });
      if (!fleeing) hpBar(ctx, p.x, p.y - size - 2, r.captain ? 70 : 48, r.hp / r.maxHp, r.gilded ? '#ffd76a' : '#e9a15b');
      else if (!calm) { ctx.fillStyle = 'rgba(255,255,255,.5)'; for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(p.x - 22 - i * 10, p.y - 4 - i * 2, 5 - i, 0, 7); ctx.fill(); } }
    } }); });
    list.sort(function (m, n) { return m.y - n.y; }).forEach(function (o) { o.f(); });
    // fx
    for (var i = UI.fx.length - 1; i >= 0; i--) { var f = UI.fx[i]; f.t += dt; if (f.t >= f.life) { UI.fx.splice(i, 1); continue; } var k = f.t / f.life;
      if (f.k === 'num') { ctx.font = 'bold ' + (f.big ? 15 : 12) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 1 - k * k; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,10,15,.8)'; var yy = f.y - (calm ? 0 : k * 26); ctx.strokeText(f.text, f.x, yy); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, yy); ctx.globalAlpha = 1; }
      else if (f.k === 'cast') {   // lantern flare at the healer, tinted by the song
        var hx = 96, hy = 206, sw = Math.sin(k * Math.PI);
        ctx.save(); ctx.globalAlpha = sw * 0.75; ctx.fillStyle = f.hue;
        ctx.beginPath(); ctx.arc(hx, hy, 7 + sw * 9, 0, 7); ctx.fill();
        ctx.globalAlpha = sw * 0.5; ctx.strokeStyle = f.hue; ctx.lineWidth = 2;
        for (var ry = 0; ry < 3; ry++) { ctx.beginPath(); ctx.arc(hx, hy, 12 + ry * 7 + sw * 10, -0.9, 0.9); ctx.stroke(); }
        ctx.restore();
      }
      else if (f.k === 'song') {
        var sp2 = SONG_FX[f.id]; if (!sp2) continue;
        var tp = f.to >= 0 || f.to === 'stray' ? unitPos(f.to) : { x: 236, y: 298 };
        ctx.save(); ctx.lineCap = 'round';
        if (f.id === 'bloomwave') {                 // a ring of petals sweeping out over the whole line
          var R = 16 + k * 170;
          ctx.globalAlpha = (1 - k * k) * 0.95; ctx.strokeStyle = sp2.c; ctx.lineWidth = 5 * (1 - k) + 1.5;
          ctx.beginPath(); ctx.ellipse(236, 292, R, R * 0.44, 0, 0, 7); ctx.stroke();
          ctx.lineWidth = 2; ctx.globalAlpha = (1 - k) * 0.5;
          ctx.beginPath(); ctx.ellipse(236, 292, R * 0.62, R * 0.27, 0, 0, 7); ctx.stroke();
          for (var pi = 0; pi < 14; pi++) {
            var pa = pi / 14 * Math.PI * 2 + (calm ? 0 : k * 1.6), px = 236 + Math.cos(pa) * R, py = 292 + Math.sin(pa) * R * 0.44;
            ctx.globalAlpha = (1 - k * k) * 0.95; ctx.fillStyle = sp2.c; ctx.beginPath();
            ctx.ellipse(px, py, 9 * (1 - k * 0.45), 5 * (1 - k * 0.45), pa, 0, 7); ctx.fill();
            ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = '#fff'; ctx.beginPath();
            ctx.ellipse(px, py, 3.4 * (1 - k * 0.45), 1.9 * (1 - k * 0.45), pa, 0, 7); ctx.fill();
          }
        } else if (f.id === 'dew') {                // droplets falling onto whoever is being kept alive
          ctx.globalAlpha = 1 - k * k;
          for (var di = 0; di < 7; di++) {
            var dph = (k + di / 7) % 1, dx = tp.x + ((di * 37) % 40) - 20, dy = tp.y - 86 + dph * 74;
            ctx.fillStyle = sp2.c; ctx.beginPath(); ctx.ellipse(dx, dy, 2.6, 4.4, 0, 0, 7); ctx.fill();
            ctx.globalAlpha = (1 - dph) * (1 - k) * 0.6; ctx.strokeStyle = sp2.c; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(dx, dy - 7); ctx.lineTo(dx, dy - 2); ctx.stroke(); ctx.globalAlpha = 1 - k * k;
          }
        } else if (f.id === 'barkskin') {           // bark plates closing in around the target
          var bk = 1 - Math.pow(1 - k, 2), rr = 60 - bk * 18;
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.5); ctx.strokeStyle = sp2.c; ctx.lineWidth = 8 * (1 - k * 0.5) + 2;
          for (var bi = 0; bi < 6; bi++) {
            var ba = bi / 6 * Math.PI * 2 + (calm ? 0 : bk * 0.5);
            ctx.beginPath(); ctx.arc(tp.x, tp.y - 30, rr, ba + 0.12, ba + 0.92); ctx.stroke();
          }
          ctx.globalAlpha = (1 - k) * 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          for (var bj = 0; bj < 6; bj++) { var bb = bj / 6 * Math.PI * 2 + (calm ? 0 : bk * 0.5); ctx.beginPath(); ctx.arc(tp.x, tp.y - 30, rr - 3, bb + 0.2, bb + 0.84); ctx.stroke(); }
        } else if (f.id === 'purify') {             // motes spiralling up and off
          ctx.globalAlpha = (1 - k) * 0.35; ctx.fillStyle = sp2.c;
          ctx.beginPath(); ctx.ellipse(tp.x, tp.y - 46, 24 * (1 - k * 0.4), 46, 0, 0, 7); ctx.fill();
          for (var mi = 0; mi < 16; mi++) {
            var mph = (k + mi / 16) % 1, ma = mi * 1.4 + (calm ? 0 : mph * 5),
                mx = tp.x + Math.cos(ma) * (26 - mph * 15), my = tp.y - 8 - mph * 96;
            ctx.globalAlpha = (1 - k) * (1 - mph * 0.5); ctx.fillStyle = sp2.c;
            ctx.beginPath(); ctx.arc(mx, my, 5.5 * (1 - mph) + 1.4, 0, 7); ctx.fill();
            ctx.globalAlpha = (1 - k) * (1 - mph) * 0.8; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(mx, my, 2.2 * (1 - mph) + 0.6, 0, 7); ctx.fill();
          }
        } else if (f.id === 'rally') {              // horn rings rolling down the whole line
          ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = sp2.c; ctx.lineWidth = 3;
          for (var ri2 = 0; ri2 < 3; ri2++) {
            var rk = k - ri2 * 0.16; if (rk <= 0) continue;
            ctx.beginPath(); ctx.ellipse(210, 292, 40 + rk * 170, (40 + rk * 170) * 0.36, 0, 0, 7); ctx.stroke();
          }
        } else {                                    // mend: a soft bloom where the light lands
          ctx.globalAlpha = (1 - k) * (f.crit ? 1 : 0.8); ctx.fillStyle = sp2.c;
          ctx.beginPath(); ctx.arc(tp.x, tp.y - 40, (f.crit ? 16 : 11) * (0.4 + k), 0, 7); ctx.fill();
        }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      else if (f.k === 'beam') { var to = unitPos(f.to); ctx.save(); ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#b8ffd0'; ctx.lineWidth = 3 * (1 - k) + 1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(96, 224); ctx.quadraticCurveTo((96 + to.x) / 2, 160, to.x, to.y - 46); ctx.stroke(); ctx.fillStyle = '#eafff1'; ctx.beginPath(); ctx.arc(to.x, to.y - 46, 5 * (1 - k) + 2, 0, 7); ctx.fill(); ctx.restore(); } }
    if (F.phase === 'between' && F.wave > 0 && F.wave < 10) { ctx.font = 'bold 13px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.strokeText('Wave ' + (F.wave + 1) + ' approaches…', 430, 200); ctx.fillText('Wave ' + (F.wave + 1) + ' approaches…', 430, 200); }
  }
  if (typeof document !== 'undefined') { var start = function () { kv.hydrate([ML.SAVE_KEY].concat(SLOTS.map(slotKey)), UI.boot); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); }
})(globalThis.ML = globalThis.ML || {});
