/* Popup: a quick read on where you are, then into the tab. by dhseadev — v2.0.0 */
(function () {
  'use strict';
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(n | 0);
  }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // The launcher deliberately does NOT import logic.js or achievements.js: it reads the raw
  // save and reports only what is directly in it. Pulling the whole rule set into a popup to
  // render four numbers is the kind of coupling that breaks quietly when the schema moves.
  const RANKS = [
    [0, 'Pebble Skipper'], [15, 'Bubble Tender'], [40, 'Prism Apprentice'], [80, 'Cascade Rider'],
    [140, 'Shardwright'], [210, 'Tide Caller'], [300, 'Stormbreaker'], [400, 'Prism Sovereign'],
  ];
  const ACH_TOTAL = 83; // display only — the count of record lives in achievements.js

  async function loadStats() {
    let save = null;
    try {
      if (hasChrome) save = (await chrome.storage.local.get('pc_save_v1')).pc_save_v1;
      else save = JSON.parse(localStorage.getItem('pc_save_v1') || 'null');
    } catch (e) { save = null; }

    const level = save ? Math.max(1, save.level | 0) : 1;
    set('p-level', level);
    set('p-best', save ? fmt(save.bestRound | 0) : 0);
    set('p-drops', save ? fmt(save.wallet | 0) : 0);

    let stars = 0;
    if (save && save.stars && typeof save.stars === 'object') {
      for (const k of Object.keys(save.stars)) stars += save.stars[k] | 0;
    }
    set('p-stars', stars + ' / 300');

    const got = (save && save.ach && typeof save.ach === 'object') ? Object.keys(save.ach).length : 0;
    set('p-ach', got + ' / ' + ACH_TOTAL + ' 🏅');
    const fill = document.getElementById('p-achfill');
    if (fill) fill.style.width = Math.min(100, (got / ACH_TOTAL) * 100) + '%';

    // rank is estimated from the unlock count here; the game computes it from tier weights
    let rank = RANKS[0][1];
    for (const [p, n] of RANKS) if (got * 4 >= p) rank = n;
    set('p-rank', rank);

    set('p-sub', save ? 'Level ' + level : 'Start at level 1');
    const pt = document.querySelector('.pt');
    if (pt && !save) pt.textContent = 'Play';
  }

  let opening = false; // re-entrancy guard: tab creation is async
  document.getElementById('play').addEventListener('click', async () => {
    if (opening) return; opening = true;
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        await chrome.tabs.create({ url: chrome.runtime.getURL('game.html') });
        window.close();
      } else {
        window.location.href = 'game.html'; // file:// test fallback
      }
    } finally { opening = false; }
  });

  loadStats();
})();
