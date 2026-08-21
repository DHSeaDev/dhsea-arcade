// Wiring. Owns the DOM, the tick loop, the spin animation and the audio/particle
// cues. All game rules live in lib/ (pure); all persistence lives in storage.js
// (the one impure boundary). This file must contain no balance constants.

import {
  createState, sanitize, tick, doSpin, buyGenerator, drawCritterGacha, sparkCritter,
  snapshot, currentBet, lumenRate,
} from '../lib/engine.js';
import {
  ACCRUAL, STAKES, TIERS, LINES, METER_MAX, PAYTABLE, SCATTER_PAY, SCATTER_FREESPINS,
  HOLD_TRIGGER, DARK_LAWS, SYMBOLS, VERSION, drawCostFor, SPARK_MULTIPLIER, ONBOARD_COUNT, CRITTER_TOTAL,
  WHEEL_PRIZES, WHEEL_MUSTHIT, SPLASH_MIN_WILDS, THUNDER_SYMBOLS, THUNDER_MULT_WEIGHTS, SPLASH_CATCH, YARD_CAP,
} from '../lib/constants.js';
import { mustHitLeft } from '../lib/features.js';
import { unlockedStakes } from '../lib/economy.js';
import { grantArcade, checkAchievements, refreshTurbo } from '../lib/engine.js';
import { turboState, spendTurbo, grantTurbo, TURBO } from '../lib/turbo.js';
import { setProgress, tierState, gachaTable, coreOwned } from '../lib/collection.js';
import { ACHIEVEMENTS, describeReward } from '../lib/achievements.js';
import { SPECIES, ALL_SPECIES, SPECIES_BY_ID } from '../lib/species.js';
import { mulberry32 } from '../lib/rng.js';
import { stopDelayMs, spinGrid } from '../lib/reels.js';
import { PAYLINES } from '../lib/paylines.js';
import { BASE_STRIPS } from '../lib/strips.js';
import { renderCritter } from '../art/critter.js';
import { renderSymbol as rawSymbol, symbolDefs, symbolName as baseSymbolName, symbolHue as prismHue, verdantHue } from '../art/symbols.js';
import { themeOf, nextTheme } from '../lib/themes.js';
import { Particles } from './particles.js';
import { Playground, MIN_ROSTER, MAX_ROSTER } from './playground.js';
import { RUNNERS } from './arcade.js';
import { Yard, TOOLS } from './yard.js';
import { ARCADE, cooldownLeft, canPlay, freePlays, usesFreePlay } from '../lib/arcade.js';
import { ballDrop } from './gacha.js';
import { shareCard, savePlaygroundPng as buildPlaygroundPng } from './sharecard.js';
import { audio, MUSIC_STYLES, MUSIC_LABELS } from './audio.js';
import { Storage } from './storage.js';

const $ = (s) => document.querySelector(s);
const now = () => Date.now();
const TIER_COLOR = { 1: 'var(--t1)', 2: 'var(--t2)', 3: 'var(--t3)', 4: 'var(--t4)', 5: 'var(--t5)', 6: '#a3e635' };

// Symbol and feature NAMES come from the active theme; the symbol keys, their
// probabilities and their payouts do not change between skins.
const symbolName = (k) => themeOf(state.theme).symbolNames[k] || baseSymbolName(k);
// One call site for symbol art, so a skin can never be half-applied.
const renderSymbol = (k, size = 72) => rawSymbol(k, size, state.theme);
const symbolHue = (k) => (state.theme === 'verdant' ? verdantHue(k) : prismHue(k));
const featName = (k) => themeOf(state.theme).featureNames[k] || k;

// A cryptographically-seeded stream. Reel outcomes are drawn from here and from
// nowhere else, so there is no path by which the UI can influence a result.
const rand = (() => {
  const a = new Uint32Array(1);
  (globalThis.crypto || {}).getRandomValues?.(a);
  return mulberry32(a[0] || (Date.now() & 0xffffffff));
})();

function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1000) return n < 10 ? n.toFixed(n < 1 && n > 0 ? 2 : 0) : Math.floor(n).toString();
  const U = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  let i = 0, v = n;
  while (v >= 1000 && i < U.length - 1) { v /= 1000; i++; }
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + U[i];
}

// ---------------------------------------------------------------------------
const store = new Storage();
let state = createState();
let fx = null;
let busy = false;              // re-entrancy guard: spin is async and mutates state
let auto = false, turbo = false;
let sfxOn = true;
let musicMode = 'ambient';   // ambient | pop | rock | off
let yardOpen = false;
let yardPngBusy = false;   // the PNG awaits an image decode per actor — never re-enter
let yard = null;
// A payout this big, or any minigame, stops autospin and pulls the player back
// from the playground. Something worth watching just happened.
const BIG_WIN_X = 50;
let grid = Array.from({ length: 5 }, () => ['q', 'c', 'a']);
let pane = 'history';   // must match the .tab.on in app.html
let grove = null;
let ticker = [];             // last commentary lines, newest first
// Comfortable reading pace for a single-line marquee. Lower = slower.
const TICKER_PX_PER_SEC = 46;
// Re-entrancy guard: runGacha awaits a ~2s animation and then MUTATES state, so a
// second entry while the ball is falling would spend twice against one visible drop.
// It is read by renderPane too: render() rebuilds the pane every 250ms, so disabling
// the live button is not enough — the replacement would come back enabled.
let gachaBusy = false;
// Declared here, with the other module state, because reviewSpin() (far above the
// roll-up code) cancels an in-flight count-up. Left beside rollUp() it sat in the
// temporal dead zone for every caller earlier in the file — legal only because
// nothing runs before module evaluation finishes, which is not a guarantee worth
// depending on.
let rollToken = 0;
let reviewing = -1;   // index into history while a past spin is on the reels
let rosterSig = '';
// The Grove roster is STICKY once chosen. render() runs every 250ms and used to call
// refreshGrove() with force=false, which recomputed the deterministic "newest + rarest"
// pick and overwrote whatever Shuffle had just produced — so a shuffle survived about a
// quarter of a second and read as a dead button. Twice reported. The roster now only
// changes when it is explicitly reshuffled, or when a member is no longer owned, or when
// the target size changes because the collection grew.
let rosterIds = null;
let history = [];            // newest first, capped; session-scoped by design
const HISTORY_MAX = 40;
let dirty = false;

// ---------------------------------------------------------------------------
function buildReels() {
  const host = $('#reels');
  host.innerHTML = '';
  for (let r = 0; r < 5; r++) {
    const reel = document.createElement('div');
    reel.className = 'reel'; reel.dataset.reel = String(r);
    for (let row = 0; row < 3; row++) {
      const w = document.createElement('div');
      w.className = 'cellwrap'; w.dataset.r = String(r); w.dataset.row = String(row);
      w.innerHTML = `<div class="cell"></div>`;
      reel.appendChild(w);
    }
    host.appendChild(reel);
  }
  paintGrid(grid);
}

function cellEl(r, row) { return $(`.cellwrap[data-r="${r}"][data-row="${row}"]`); }

function paintGrid(g) {
  for (const reel of document.querySelectorAll('.reel')) {
    reel.classList.remove('thunder');
    for (const b of reel.querySelectorAll('.thunderfuse')) b.remove();
  }
  for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) {
    const w = cellEl(r, row);
    if (!w) continue;
    w.className = 'cellwrap';
    w.querySelector('.cell').innerHTML = renderSymbol(g[r][row]);
  }
}

const FACE_KEYS = ['q', 'c', 'a', 't', 'b', 'P', 'H', 'N', 'E', 'W', 'S', 'O'];
/** One random symbol for the blur-up scramble. Cosmetic only — never an outcome. */
function randomSym() { return FACE_KEYS[Math.floor(Math.random() * FACE_KEYS.length)]; }
function randomFace() {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => randomSym()));
}

// ---------------------------------------------------------------------------
function render() {
  const snap = snapshot(state);
  $('#lumens').textContent = fmt(snap.lumens);
  $('#rate').textContent = '+' + fmt(snap.rate) + ' / sec';
  $('#facets').textContent = fmt(snap.facets);
  $('#owned').textContent = `${snap.coreOwned}/100`;
  const nextCost = drawCostFor(snap.coreOwned);
  const th = themeOf(state.theme);
  $('#nextcost').textContent = snap.coreOwned >= 100 && snap.owned >= 125 ? 'collection complete' : `next critter ${fmt(nextCost)}`;
  const done = snap.sets.filter((s) => s.complete).length;
  $('#setline').textContent = done ? `${done} set${done > 1 ? 's' : ''} complete` : 'no sets complete';

  $('#betval').textContent = fmt(currentBet(state));
  const pct = Math.min(100, (state.meter / METER_MAX) * 100);
  $('#meterfill').style.width = pct + '%';
  $('#metertxt').textContent = `${Math.floor(state.meter)} / ${METER_MAX}`;

  const canSpin = state.lumens >= currentBet(state);
  const sp = $('#spin');
  sp.disabled = busy || !canSpin;
  sp.classList.toggle('busy', busy);
  sp.textContent = busy ? 'Spinning' : canSpin ? 'Spin' : 'Charging…';

  const h = store.health();
  const b = $('#banner');
  b.classList.toggle('on', !h.ok);
  if (!h.ok) b.textContent = `Saving stopped (${h.error}). Reload this page — progress since the last save may be lost.`;

  renderLadder();
  renderHistory();
  refreshGrove();
  renderPane();
}

// The five Fortunes. Rendered every frame so a prize ticking up is visible the
// moment a Lumen Core lands, which is the whole point of the ladder.
function renderLadder() {
  const host = $('#ladder');
  if (!host) return;
  const cur = host.dataset.sig;
  const left = mustHitLeft(state.wheelSince);
  const sig = WHEEL_PRIZES.map((w) => (state.prizes?.[w.id] ?? w.base).toFixed(2)).join('|')
    + '|' + Object.values(left).join(',');
  if (cur === sig) return;
  host.dataset.sig = sig;
  host.innerHTML = WHEEL_PRIZES.map((w) => {
    const v = state.prizes?.[w.id] ?? w.base;
    // The must-hit countdown is printed, not hinted. It is the whole point: an
    // anticipation device that is a published fact rather than a suggestion.
    const mh = left[w.id];
    const soon = mh !== undefined && mh <= 8;
    return `<div class="prize${soon ? ' soon' : ''}" data-p="${w.id}"><div class="k">${w.name}</div>
      <div class="v">${v < 10 ? v.toFixed(2) : v.toFixed(1)}×</div>
      ${mh !== undefined ? `<div class="mh">${mh === 0 ? 'DUE NOW' : `within ${mh}`}</div>` : ''}</div>`;
  }).join('');
}

const FEATURE_TAG = { splash: ['SP', 'fSP'], thunder: ['TH', 'fTH'], wheel: ['WH', 'fWH'], hold: ['CR', 'fCR'], free: ['FS', 'fFS'] };

function renderHistory(force = false) {
  const row = $('#hrow');
  if (!row) return;
  if (force) row.dataset.sig = '';
  // Signature guard. Without it this repaints on every render tick and the entry
  // animation restarts before it can finish, leaving every row invisible.
  const sig = history.length + ':' + history.map((h) => `${h.bet}/${h.facets}/${h.features.join('')}`).join(',');
  if (row.dataset.sig === sig) return;
  row.dataset.sig = sig;
  if (!history.length) {
    row.innerHTML = '<div class="hempty">Your last 40 spins will appear here.</div>';
    $('#hstats').textContent = '';
    return;
  }
  row.innerHTML = history.map((h, i) => {
    const x = h.bet > 0 ? h.facets / h.bet : 0;
    const cls = h.facets <= 0 ? 'zero' : x >= 20 ? 'w4' : x >= 5 ? 'w3' : x >= 1 ? 'w2' : 'w1';
    const chips = h.features.map((f) => {
      const [t, c] = FEATURE_TAG[f] || [f.slice(0, 2).toUpperCase(), ''];
      return `<i class="${c}">${t}</i>`;
    }).join('');
    return `<div class="hcell ${cls}" data-i="${i}" tabindex="0" role="button"
      title="Click to put this spin back on the reels">
      <div class="hx">${h.facets <= 0 ? '—' : (x >= 100 ? Math.round(x) : x.toFixed(x < 10 ? 2 : 1)) + '×'}</div>
      <div class="hb">${fmt(h.bet)} bet</div>
      <div class="hf">${chips}</div></div>`;
  }).join('');
  if (reviewing >= 0) document.querySelector(`.hcell[data-i="${reviewing}"]`)?.classList.add('sel');

  // Session stats are computed from the history rows themselves, so the panel can
  // never disagree with the list sitting next to it.
  const n = history.length;
  const wins = history.filter((h) => h.facets > 0).length;
  const staked = history.reduce((a, h) => a + h.bet, 0);
  const paid = history.reduce((a, h) => a + h.facets, 0);
  const best = history.reduce((a, h) => Math.max(a, h.bet ? h.facets / h.bet : 0), 0);
  $('#hstats').textContent =
    `last ${n} · ${wins} paid (${Math.round((wins / n) * 100)}%) · ${fmt(paid)} ${featName('payout')} from ${fmt(staked)} staked · best ${best >= 10 ? best.toFixed(0) : best.toFixed(1)}×`;
}

function pushHistory(out) {
  const features = [];
  if (out.base.splash) features.push('splash');
  if (out.base.thunder.length) features.push('thunder');
  for (const f of out.features) if (f.kind) features.push(f.kind);
  // The whole outcome is retained, not just its total, so a history row can put the
  // spin back on the reels. 40 entries x one 5x3 grid is a few KB and never persisted.
  history.unshift({ bet: out.bet, facets: out.facets, features, out });
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
}

/**
 * Put a past spin back on the reels. Read-only: it paints the grid and the winning
 * cells and shows that spin's explainer, and the next real spin overwrites it. It
 * never touches state, so reviewing a win cannot pay you twice.
 */
function reviewSpin(i) {
  const h = history[i];
  if (!h || !h.out) return;
  // Cancel any in-flight win roll-up. It owns #winline for up to 2.6s and repaints
  // it every frame, so without this a review clicked during a count-up is silently
  // overwritten — the row highlights, the reels change, and the line still reads as
  // the live spin.
  rollToken++;
  reviewing = i;
  const base = h.out.base;
  paintGrid(base.grid);
  const touched = new Set();
  for (const w of base.lineWins) for (const [r, row] of w.cells) touched.add(r + ':' + row);
  if (touched.size) {
    for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) {
      const el = cellEl(r, row);
      if (!el) continue;
      el.classList.add(touched.has(r + ':' + row) ? 'win' : 'dim');
    }
  }
  for (const [r, row] of (base.scatterCells || [])) cellEl(r, row)?.classList.add('win');
  renderWinDetail(h.out);
  const wl = $('#winline');
  if (wl) {
    wl.dataset.spun = '1';
    wl.className = h.facets > 0 ? 'winline' : 'winline zero';
    wl.innerHTML = h.facets > 0
      ? `<b>+${fmt(h.facets)}</b> ${featName('payout')} · reviewing spin ${i + 1} of the last ${history.length}`
      : `No pay this spin · reviewing spin ${i + 1} of the last ${history.length}`;
  }
  for (const el of document.querySelectorAll('.hcell.sel')) el.classList.remove('sel');
  document.querySelector(`.hcell[data-i="${i}"]`)?.classList.add('sel');
  audio.click();
}

// ---------------------------------------------------------------------------
/**
 * Signature for the pane. Anything that changes what the pane LOOKS like has to
 * appear here — including affordability booleans, because a Draw button greying
 * in and out is a visual change even though `owned` did not move. Raw Facets are
 * deliberately NOT in the signature: they tick continuously and would defeat it.
 */
function paneSignature(snap) {
  const parts = [pane, snap.owned, state.owned.length];
  for (const t of snap.tiers) parts.push(`${t.tier.id}:${t.owned}:${t.gated ? 1 : 0}:${t.complete ? 1 : 0}:${state.facets >= t.drawCost ? 1 : 0}`);
  for (const g of snap.generators) parts.push(`${g.id}:${g.owned}:${state.lumens >= g.cost ? 1 : 0}:${g.max}`);
  if (pane === 'goals') { for (const x of snap.sets) parts.push(`${x.name}:${x.owned}`); parts.push('a' + state.achievements.length); }
  if (pane === 'history') parts.push('h' + history.length + ':' + (history[0] ? history[0].facets : 0));
  // Cooldowns tick, so the arcade pane refreshes on a coarse 1-second bucket
  // rather than never (signature) or every frame (no signature).
  if (pane === 'dex') parts.push(gachaBusy ? 'g1' : 'g0');
  if (pane === 'arcade') { parts.push('f' + freePlays(state)); for (const g of ARCADE.games) parts.push(`${g.id}:${Math.ceil(cooldownLeft(state, g.id, now()) / 1000)}`); }
  if (pane === 'rates') parts.push(Math.round(drawCostFor(snap.coreOwned)));
  return parts.join('|');
}

function renderPane(force = false) {
  const host = $('#pane');
  const snap = snapshot(state);
  const sig = paneSignature(snap);
  if (!force && host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  if (pane === 'history') {
    host.innerHTML = `<div class="hhead" style="border:0;padding:0 0 10px">
        <span class="lbl">Win history</span>
        <span class="hstats" id="hstats"></span>
        <button class="tbtn" id="hshare" style="padding:4px 9px;font-size:10.5px">Share</button>
        <button class="tbtn" id="hclear" style="padding:4px 9px;font-size:10.5px">Clear</button>
      </div>
      <div class="windetail" id="windetail"></div>
      <div class="hcol" id="hrow"><div class="hempty">Your last 40 spins will appear here.</div></div>`;
    $('#hclear').onclick = () => {
      audio.start(); audio.click();
      history = []; reviewing = -1;
      $('#windetail').innerHTML = '';
      renderHistory();
    };
    // Shares whatever spin is currently being shown — the reviewed one, else the last.
    $('#hshare').onclick = (e) => {
      const h = reviewing >= 0 ? history[reviewing] : history[0];
      if (!h) { audio.deny(); return; }
      const names = { splash: featName('splash'), thunder: featName('thunder'), wheel: featName('wheel'),
        hold: featName('hold'), free: 'Free spins' };
      doShare('payout', {
        facets: h.facets, bet: h.bet, multiplier: h.bet > 0 ? h.facets / h.bet : 0,
        features: h.features.map((f) => names[f] || f),
      }, 'lumenreel-payout.png', e.currentTarget);
    };

    // Click a row to put that spin back on the reels. Delegated, so it survives the
    // list being rebuilt by the signature guard.
    $('#hrow').onclick = (e) => {
      const cell = e.target.closest('.hcell[data-i]');
      if (cell) { audio.start(); reviewSpin(Number(cell.dataset.i)); }
    };
    $('#hrow').onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const cell = e.target.closest('.hcell[data-i]');
      if (cell) { e.preventDefault(); audio.start(); reviewSpin(Number(cell.dataset.i)); }
    };
    // The explainer lives in this pane now, so rebuild it for whatever is selected —
    // otherwise switching tabs mid-session shows an empty card strip beside a full list.
    const show = reviewing >= 0 ? history[reviewing] : history[0];
    if (show && show.out) renderWinDetail(show.out);
    renderHistory(true);
  } else if (pane === 'goals') {
    let out = `<p class="note" style="margin:0 0 12px">Themed sets are short goals inside the long one.
      Awards pay ${featName('currency')} or ${featName('payout')} scaled to where you are, so an early
      one is worth as much as a late one.</p>`;
    for (const x of snap.sets) {
      out += `<div class="setrow ${x.complete ? 'done' : ''}">
        <span style="min-width:88px">${x.name}</span>
        <div class="setbar"><i style="width:${(x.owned / x.total) * 100}%"></i></div>
        <span class="mono">${x.owned}/${x.total}</span></div>`;
    }
    const have = new Set(state.achievements);
    out += `<h4 class="ahead">Awards · ${have.size}/${ACHIEVEMENTS.length}
      <button class="tbtn" id="gshare" style="padding:4px 9px;font-size:10.5px;float:right">Share</button></h4>`;
    const sorted = [...ACHIEVEMENTS].sort((a, b) => (have.has(b.id) ? 1 : 0) - (have.has(a.id) ? 1 : 0));
    for (const a of sorted) {
      const got = have.has(a.id);
      out += `<div class="ach ${got ? 'got' : ''}">
        <span class="tick">${got ? '✦' : ''}</span>
        <div class="grow"><div class="nm">${a.name}</div><div class="sub">${a.hint}</div></div>
        <span class="rew">${describeReward(a.reward)}</span></div>`;
    }
    host.innerHTML = out;
    $('#gshare').onclick = (e) => doShare('score', {
      title: 'Collection', owned: snap.coreOwned, total: CRITTER_TOTAL,
      subtitle: `${state.achievements.length}/${ACHIEVEMENTS.length} awards · ${fmt(state.stats.spins)} spins · ${snap.sets.filter((x) => x.complete).length} sets complete`,
    }, 'lumenreel-collection.png', e.currentTarget);
  } else if (pane === 'dex') {
    const ownedSet = new Set(state.owned);
    const table = gachaTable(state);
    const cost = drawCostFor(coreOwned(state));
    // ONE price, ONE weighted roll. The per-tier Draw buttons are gone: which tier you
    // get is the gamble now, not a menu you unlock by grinding the tier below it.
    let out = `<div class="drawbar">
      <div class="grow">
        <div class="nm">Draw a critter</div>
        <div class="sub">${table.rows.length
          ? table.rows.map((r) => `<i style="color:${TIER_COLOR[r.tier.id]}">${r.tier.name} ${(r.p * 100) >= 1 ? Math.round(r.p * 100) : (r.p * 100).toFixed(1)}%</i>`).join('')
          : 'every critter in this skin is collected'}</div>
      </div>
      <button class="buy big" id="draw-go" ${!table.rows.length || state.facets < cost || gachaBusy ? 'disabled' : ''}
        >${!table.rows.length ? 'Complete' : gachaBusy ? 'Dropping…' : `Drop · ${fmt(cost)}`}</button>
    </div>
    <p class="note" style="margin:0 0 14px">Odds shift as tiers empty — a tier that is fully
    collected stops taking rolls, so the last few are never behind a wall of near-misses.
    You can also <b>Spark</b> any single critter — click it and buy that exact one outright for
    ${SPARK_MULTIPLIER}× this price. That is the most any one critter can ever cost you.</p>`;
    for (const t of TIERS) {
      const ts = tierState(state, t.id);
      const row = table.rows.find((r) => r.tier.id === t.id);
      out += `<div class="row"><div class="grow">
          <div class="nm" style="color:${TIER_COLOR[t.id]}">${t.name}</div>
          <div class="sub">${ts.gated ? ` · unlocks at ${ts.gateOwned} owned · ${ts.gateLeft} to go`
            : ts.complete ? ' · complete' : row ? ` · ${(row.p * 100) >= 1 ? Math.round(row.p * 100) : (row.p * 100).toFixed(1)}% of each drop` : ''}</div>
        </div>
        <span class="sub mono" style="opacity:.8">+${fmt(t.trickle)}/s each</span></div>`;
      out += '<div class="dexgrid" style="margin:0 0 14px">';
      for (const s of ALL_SPECIES.filter((x) => x.tier === t.id)) {
        out += ownedSet.has(s.id)
          ? `<div class="dexcell" data-t="${t.id}" data-sp="${s.id}" title="${s.name}">${renderCritter(s, { size: 70 })}</div>`
          : `<div class="dexcell locked" data-t="${t.id}" data-sp="${s.id}" title="Not yet found — click to Spark it">
               <div class="sil">${renderCritter(s, { size: 70 })}</div></div>`;
      }
      out += '</div>';
    }
    host.innerHTML = out;
  } else if (pane === 'cuts') {
    let out = `<p class="note" style="margin:0 0 12px">${featName('generator')} raise your ${featName('currency')} per second. New cuts unlock as the collection grows — the dex is the tech tree.</p>`;
    for (const g of snap.generators) {
      const afford = state.lumens >= g.cost;
      out += `<div class="row"><div class="grow">
        <div class="nm">${g.name} <span class="sub">×${g.owned}</span></div>
        <div class="sub">+${fmt(g.prod)} / sec each · payback ${fmt(g.cost / g.prod)}s</div>
      </div>
      <button class="buy" data-buy="${g.id}" data-n="1" ${afford ? '' : 'disabled'}>${fmt(g.cost)}</button>
      <button class="buy" data-buy="${g.id}" data-n="max" ${g.max > 0 ? '' : 'disabled'}>×${g.max}</button></div>`;
    }
    const locked = TIERS.length && snap.owned;
    out += `<p class="note" style="margin-top:10px">Locked cuts appear at 10 / 20 / 30 / 40 / 50 / 60 / 70 / 80 / 90 critters owned. You have ${snap.owned}.</p>`;
    void locked;
    host.innerHTML = out;
  } else if (pane === 'arcade') {
    const t = now();
    const fp = freePlays(state);
    let out = `<p class="note" style="margin:0 0 12px">Three short games. Each pays ${featName('payout')}
      up to ${ARCADE.capBets}× your current bet and then rests for
      ${Math.round(ARCADE.cooldownMs / 60000)} minutes. They are a bonus, never a shortcut —
      the collection's pacing is measured for a player who never opens this tab.</p>
      <div class="fpbank${fp ? ' on' : ''}">
        <b>${fp}</b> free play${fp === 1 ? '' : 's'} banked
        <span>won on the reels · a free play skips the rest, and spending one does not
        restart it</span></div>`;
    for (const g of ARCADE.games) {
      const cd = cooldownLeft(state, g.id, t);
      const free = usesFreePlay(state, g.id, t);
      out += `<div class="ag-row"><div class="grow">
        <div class="nm">${g.name}</div><div class="sub">${g.blurb}</div></div>
        ${cd > 0 && !free ? `<span class="ag-cd">${Math.ceil(cd / 1000)}s</span>` : ''}
        <button class="buy${free ? ' freeplay' : ''}" data-play="${g.id}" ${cd > 0 && !free ? 'disabled' : ''}
        >${free ? 'Free play' : cd > 0 ? 'Resting' : 'Play'}</button></div>`;
    }
    host.innerHTML = out;
  } else if (pane === 'rates') {
    host.innerHTML = ratesHtml();
    // Three bullets are the commitment; the essay behind them is for whoever wants it.
    // It used to be ~320 words of manifesto in 11.5px grey, and it was the third place
    // the same pitch was made — tutorial, About, then here.
    $('#why-more').onclick = (e) => {
      audio.click();
      const d = $('#why-detail');
      d.hidden = !d.hidden;
      e.currentTarget.textContent = d.hidden ? 'Why, in detail' : 'Hide the detail';
    };
  } else {
    host.innerHTML = aboutHtml();
    renderProfiles();
  }
}

/**
 * PROFILES — named save slots, plus export/import so a save can travel between
 * browsers or between people.
 *
 * Switching parks the live save into the outgoing slot first, so nothing is lost;
 * an imported file is always parked as a NEW slot rather than activated, because
 * importing must never overwrite the game you are currently in.
 */
async function renderProfiles() {
  const host = $('#profiles-host');
  if (!host) return;
  const p = await store.profiles();
  const names = [...new Set([p.active, ...Object.keys(p.slots)])];
  const when = (t) => {
    if (!t) return 'not yet parked';
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 1 ? 'seconds ago' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
  };
  host.innerHTML = `<h4 class="ahead" style="margin-top:0">Profiles</h4>
    <p class="note" style="margin:0 0 10px">Separate saves on this browser. Switching parks the
      one you are in first, so nothing is lost. Export writes a file you can load anywhere —
      or hand to someone else.</p>
    <div class="proflist">
      ${names.map((n) => {
        const meta = p.slots[n]?.meta || {};
        const live = n === p.active;
        return `<div class="profrow${live ? ' on' : ''}">
          <div class="grow"><div class="nm">${n}${live ? ' <i>playing</i>' : ''}</div>
            <div class="sub">${live ? `${snapshot(state).coreOwned}/100 critters · live`
              : `${meta.owned ?? '?'}/100 critters · parked ${when(meta.savedAt || meta.importedAt)}`}</div></div>
          ${live ? '' : `<button class="buy" data-prof-load="${n}">Play</button>`}
          ${live ? '' : `<button class="tbtn" data-prof-del="${n}" style="padding:6px 10px;font-size:10.5px">Delete</button>`}
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="tbtn" id="prof-new" style="padding:7px 13px;font-size:11.5px">New profile</button>
      <button class="tbtn" id="prof-export" style="padding:7px 13px;font-size:11.5px">Export this one</button>
      <button class="tbtn" id="prof-import" style="padding:7px 13px;font-size:11.5px">Import a file</button>
      <input id="prof-file" type="file" accept="application/json,.json" hidden>
    </div>`;

  host.onclick = async (e) => {
    const load = e.target.closest('[data-prof-load]');
    if (load) { await switchProfile(load.dataset.profLoad); return; }
    const del = e.target.closest('[data-prof-del]');
    if (del) {
      audio.click();
      if (await store.deleteProfile(del.dataset.profDel)) { toast(`Deleted "${del.dataset.profDel}"`); renderProfiles(); }
      else audio.deny();
    }
  };
  // renderProfiles is async: it awaits storage, and by the time that resolves the
  // pane may have been rebuilt by the 250ms render tick or the player may have
  // switched tabs entirely. Bail if this host is no longer the one on screen —
  // otherwise every assignment below is `null.onclick`, which is exactly the class
  // that killed wire() in v0.5.0.
  if (!host.isConnected || $('#profiles-host') !== host) return;
  const on = (sel, fn, ev = 'onclick') => { const el = $(sel); if (el) el[ev] = fn; };

  on('#prof-new', async () => {
    audio.click();
    const p2 = await store.profiles();
    let n = 'Profile 2', i = 2;
    while (p2.slots[n] || n === p2.active) n = `Profile ${++i}`;
    await switchProfile(n);
  });
  on('#prof-export', () => exportProfile());
  on('#prof-import', () => { audio.click(); $('#prof-file')?.click(); });
  on('#prof-file', (e) => importProfileFile(e.target.files?.[0]), 'onchange');
}

// Re-entrancy guard: switching awaits two storage round-trips and then REPLACES
// state. A second entry mid-switch would park the wrong save into the wrong slot.
let profBusy = false;

async function switchProfile(name) {
  if (profBusy) { audio.deny(); return; }
  profBusy = true;
  try {
    audio.click();
    if (auto) { auto = false; $('#btn-auto')?.classList.remove('on'); }
    if (yardOpen) closeYard();
    flush();
    const live = JSON.parse(JSON.stringify(state));
    const loaded = await store.switchProfile(name, live, { owned: snapshot(state).coreOwned });
    state = sanitize(loaded || undefined);
    if (!loaded) { tick(state, now()); state.seenTutorial = true; }
    else tick(state, now());
    history = []; reviewing = -1; rosterIds = null; ticker.length = 0;
    const tt = $('#tick-track'); if (tt) tt.innerHTML = '';
    applyTheme(); paintTurbo(); refreshGrove(true); render(); renderPane(true);
    toast(loaded ? `Now playing "${name}"` : `Started a fresh profile: "${name}"`, 3600);
    scheduleSave();
  } catch (err) {
    console.error('[profile]', err);
    toast('Could not switch profile', 3200);
  } finally {
    profBusy = false;
    renderProfiles();
  }
}

async function exportProfile() {
  audio.click();
  const p = await store.profiles();
  const payload = {
    app: 'lumenreel-prism-crash', version: VERSION, exportedAt: Date.now(),
    profile: p.active, state: JSON.parse(JSON.stringify(state)),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lumenreel-${p.active.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Profile exported to your downloads', 3400);
}

async function importProfileFile(file) {
  if (!file) return;
  try {
    const txt = await file.text();
    const data = JSON.parse(txt);
    // Validate the shape before trusting it. sanitize() would survive anything, but
    // silently importing a random JSON file as a "profile" is worse than refusing.
    if (!data || data.app !== 'lumenreel-prism-crash' || typeof data.state !== 'object') {
      toast('That is not a Lumenreel profile file', 3600); audio.deny(); return;
    }
    const clean = sanitize(data.state);
    const name = await store.importProfile(data.profile || 'Imported',
      clean, { owned: snapshot(clean).coreOwned, from: data.version || 'unknown' });
    toast(`Imported "${name}" — press Play to switch to it`, 4600);
    audio.unlock(2);
    renderProfiles();
  } catch (err) {
    console.error('[import]', err);
    toast('Could not read that file', 3200);
  }
}

// The odds page is generated FROM the same constants the game runs on. There is
// no second table, so it cannot drift from what actually happens.
function ratesHtml() {
  let pay = '<table class="rates"><tr><th>Symbol</th><th class="n">3</th><th class="n">4</th><th class="n">5</th></tr>';
  for (const [k, v] of Object.entries(PAYTABLE)) {
    pay += `<tr><td>${renderSymbol(k, 22)} ${symbolName(k)}</td><td class="n">${v[3] || '—'}</td><td class="n">${v[4] || '—'}</td><td class="n">${v[5] || '—'}</td></tr>`;
  }
  pay += '</table>';

  let tiers = '<table class="rates"><tr><th>Tier</th><th class="n">Members</th><th class="n">Chance per draw</th><th class="n">Trickle each</th></tr>';
  for (const t of TIERS) {
    const ts = tierState(state, t.id);
    const remaining = t.count - ts.owned;
    tiers += `<tr><td style="color:${TIER_COLOR[t.id]}">${t.name}</td><td class="n">${t.count}</td>
      <td class="n">${ts.gated ? 'locked' : ts.complete ? 'complete' : `1 in ${remaining}`}</td>
      <td class="n">+${fmt(t.trickle)}/s</td></tr>`;
  }
  tiers += '</table>';

  return `
  <h3 style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink2);margin-bottom:8px">Paytable · per line, × stake</h3>
  ${pay}
  <h3 style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink2);margin:16px 0 8px">Features</h3>
  <p class="note" style="margin:0 0 12px">
    <b>${featName('splash')}</b> — ${SPLASH_MIN_WILDS}+ Refraction wilds anywhere and they spray: every
    other reel catches a droplet with a ${Math.round(SPLASH_CATCH * 100)}% chance. A droplet never
    lands on a Starburst, so a splash can never create or destroy a free-spin trigger.<br>
    <b>${featName('thunder')}</b> — ${THUNDER_SYMBOLS.join(', ')} landing as a full 3-high stack fuses into one
    giant symbol carrying ${THUNDER_MULT_WEIGHTS.map((t) => '×' + t.v).join(' / ')}. It boosts wins
    <i>of that symbol</i> only, and two fused reels on one line take the higher multiplier, never the product.<br>
    <b>${featName('wheel')}</b> — every ${symbolName('O')} feeds one of the five Fortunes. Filling the ${featName('meter')}
    spins the wheel, pays one prize, and resets that prize to its base.
    <b>Must-hit-by:</b> ${Object.entries(WHEEL_MUSTHIT).map(([id, n]) =>
      `${WHEEL_PRIZES.find((w) => w.id === id).name} lands at least once every ${n} wheel spins`).join(', ')} —
    the countdown is printed on the ladder and the guarantee only ever pays you more.<br>
    <b>${featName('hold')}</b> — ${HOLD_TRIGGER} ${symbolName('O')}s (one per reel). Coins lock, three respins, and
    every new coin resets the count to three.<br>
    <b>Free spins</b> — richer wilds on every reel. Retriggers are capped at 30 spins per round,
    and the cap is stated rather than silently applied.</p>
  <p class="note" style="margin:12px 0">Scatter pays on count anywhere, × total bet:
    ${Object.entries(SCATTER_PAY).map(([n, v]) => `<b>${n} → ${v}×</b>`).join(' · ')}.
    ${Object.entries(SCATTER_FREESPINS).map(([n, v]) => `${n} scatters → ${v} free spins`).join(' · ')}.
    </p>

  <h3 style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink2);margin:16px 0 8px">Collection odds</h3>
  ${tiers}
  <p class="note" style="margin-top:12px">
    <b>Duplicate suppression:</b> a draw never returns a critter you already own, so the pool shrinks
    as you fill a tier and there is no long tail chasing the last one.<br>
    <b>Maximum cost, guaranteed:</b> any specific critter can be bought outright with Spark for
    ${SPARK_MULTIPLIER}× the current draw price. That is a hard ceiling on what any single critter can cost you.<br>
    <b>Price:</b> the next critter costs ${fmt(drawCostFor(coreOwned(state)))} ${featName('payout')}. The first
    ${ONBOARD_COUNT} were discounted.<br>
    <b>Drop odds, live:</b> ${gachaTable(state).rows.map((r) =>
      `${r.tier.name} <b>${(r.p * 100) >= 1 ? Math.round(r.p * 100) : (r.p * 100).toFixed(1)}%</b>`).join(' · ') || 'collection complete'}.
    A tier's share is its remaining stock times a fixed rarity weight, so the numbers move as you
    collect and a finished tier stops taking rolls entirely.</p>

  <h3 style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink2);margin:16px 0 8px">What we will not do</h3>
  <ul class="willnot">
    <li><b>No near-miss engineering.</b> Every reel carries identical premium and scatter counts.</li>
    <li><b>No losses dressed as wins.</b> You stake ${featName('currency')}; the reels pay ${featName('payout')}. A zero shows a zero.</li>
    <li><b>No teasing reel stops.</b> Fixed at ${DARK_LAWS.reelStopMs.join(' / ')} ms by reel index, whatever the outcome.</li>
  </ul>
  <button class="tbtn" id="why-more" style="padding:5px 11px;font-size:10.5px;margin-top:2px">Why, in detail</button>
  <div id="why-detail" hidden><p class="note">
    <b>No near-miss engineering.</b> Every reel carries an identical number of Eclipse and Starburst
    symbols. Starving the last reel of the top symbol is how machines manufacture "so close"; a test
    fails the build if the strips ever stop matching.<br>
    <b>No losses dressed as wins.</b> You stake ${featName('currency')} and are paid ${featName('payout')} — nothing you stake can
    come back, so a spin that pays less than you bet is not representable. A zero pays zero and shows zero.<br>
    <b>No teasing reel stops.</b> Stop timing is fixed at ${DARK_LAWS.reelStopMs.join(' / ')} ms by reel
    position and cannot see the outcome.<br>
    <b>No money.</b> Nothing here is purchasable, tradeable or redeemable. The only currency is time.<br>
    <b>The ball drop does not decide anything.</b> The tier is rolled first from the weights
    printed above, and the ball is then animated into that bin — exactly like the wheel. A real
    bouncing simulation would produce a distribution nobody chose, and nudging the pegs to steer
    it would be the rigged-animation trick this whole page exists to refuse. The bin widths are
    drawn from the same live weights, so the picture is the odds, not decoration beside them.<br>
    <b>The Shake button does nothing.</b> Not "almost nothing" — nothing. It does not touch the reels,
    the odds, the meter or the wheel. It shakes the cabinet and counts how many times you did it,
    because superstition is fun and a button that secretly nudged the outcome would be the most
    dishonest thing in here.<br>
    <b>Turbo is a budget, not a boost.</b> ${TURBO.budget} fast spins, then it rests. It changes how
    fast the reels animate and nothing else — outcomes are drawn identically at any speed.</p></div>`;
}

function aboutHtml() {
  return `<div id="profiles-host"></div><p class="note">
    <b>Lumenreel · Prism Crash</b> v${VERSION}<br><br>
    <b>${featName('currency')}</b> accrue at ${fmt(ACCRUAL.baseRate)}/sec from the start and rise with ${featName('generator')} and with every
    critter you own. They are the only thing you stake.<br><br>
    <b>${featName('payout')}</b> come only from the reels. They are the only thing that buys critters.<br><br>
    <b>Away from the game</b> you earn ${Math.round(ACCRUAL.offlineRate * 100)}% of your rate, up to
    ${ACCRUAL.offlineCapHours} hours per return. Closing the tab is not punished.<br><br>
    <b>Full collection</b> is tuned to land between 15 and 18 hours of accrual, measured across eight
    simulated playthroughs against this exact build.<br><br>
    Every sprite, symbol and sound in this game is generated by code at runtime — no images, no audio
    files, no network requests of any kind.<br><br>
    <b>Music</b> comes in three synthesised styles — Ambient, Pop and Rock. Cycle them with the
    Music button in the top bar.</p>
  <p class="note" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
    <b>Built by <a href="https://dhseadev.online" target="_blank" rel="noopener"
      style="color:var(--fac);text-decoration:none;border-bottom:1px solid rgba(139,233,253,.4)">dhseadev</a></b><br>
    <span style="color:var(--ink3)">dhseadev.online</span></p>`;
}

// ---------------------------------------------------------------------------
// WIN EXPLAINER. Every payout gets a card that SHOWS its shape: the payline drawn
// across a 5x3 mini-grid with the contributing symbols on it, and the arithmetic
// spelled out. "2 lines" tells you nothing about which two.
function miniGrid(cells, symbols, opts = {}) {
  const W = 15, H = 13, GAP = 2.4;
  const cx = (r) => r * (W + GAP) + W / 2;
  const cy = (row) => row * (H + GAP) + H / 2;
  let out = '';
  for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) {
    const on = cells.some(([a, b]) => a === r && b === row);
    out += `<rect x="${(r * (W + GAP)).toFixed(1)}" y="${(row * (H + GAP)).toFixed(1)}" width="${W}" height="${H}" rx="3"
      fill="${on ? 'rgba(167,139,250,.22)' : 'rgba(255,255,255,.05)'}"
      stroke="${on ? '#a78bfa' : 'rgba(255,255,255,.09)'}" stroke-width="${on ? 1.1 : 0.7}"/>`;
  }
  if (cells.length > 1 && opts.path !== false) {
    out += `<polyline points="${cells.map(([r, row]) => `${cx(r).toFixed(1)},${cy(row).toFixed(1)}`).join(' ')}"
      fill="none" stroke="#f472b6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>`;
  }
  for (let i = 0; i < cells.length; i++) {
    const [r, row] = cells[i];
    const sym = symbols[i] || symbols[0];
    if (!sym) continue;
    out += `<g transform="translate(${(cx(r) - 5.6).toFixed(1)} ${(cy(row) - 5.8).toFixed(1)}) scale(0.112)">${renderSymbol(sym, 100)}</g>`;
  }
  const w = 5 * W + 4 * GAP, h = 3 * H + 2 * GAP;
  return `<svg viewBox="0 0 ${w} ${h}" width="${(w * 1.35).toFixed(0)}" height="${(h * 1.35).toFixed(0)}" aria-hidden="true">${out}</svg>`;
}

/** A small pictogram for a feature that has no payline of its own. */
function featureIcon(kind) {
  const box = (inner, tint) => `<svg viewBox="0 0 46 40" width="62" height="54" aria-hidden="true">
    <rect width="46" height="40" rx="7" fill="${tint}" stroke="rgba(255,255,255,.14)"/>${inner}</svg>`;
  if (kind === 'splash') return box(
    `<circle cx="13" cy="20" r="5.5" fill="#f472b6"/>
     ${[24, 31, 38].map((x, i) => `<path d="M${x},${14 + i * 2} l3.4,5.6 -3.4,5.6 -3.4,-5.6 Z" fill="#38bdf8" opacity="${0.95 - i * 0.18}"/>`).join('')}
     <path d="M18,20 Q26,10 40,14" stroke="#38bdf8" stroke-width="1.2" fill="none" opacity=".6"/>`, 'rgba(244,114,182,.16)');
  if (kind === 'thunder') return box(
    `<rect x="8" y="6" width="12" height="28" rx="3" fill="rgba(252,211,77,.3)" stroke="#fcd34d"/>
     <path d="M28,7 l-6,13 h6 l-4,13 10,-16 h-6 z" fill="#fcd34d"/>`, 'rgba(252,211,77,.14)');
  if (kind === 'wheel') return box(
    `<circle cx="23" cy="21" r="12.5" fill="none" stroke="#c084fc" stroke-width="2.4"/>
     ${[0, 72, 144, 216, 288].map((a) => `<line x1="23" y1="21" x2="${(23 + 12 * Math.cos(a * Math.PI / 180)).toFixed(1)}" y2="${(21 + 12 * Math.sin(a * Math.PI / 180)).toFixed(1)}" stroke="#c084fc" stroke-width="1.2"/>`).join('')}
     <path d="M23,4 l3,5 h-6 z" fill="#fff"/>`, 'rgba(192,132,252,.14)');
  if (kind === 'hold') return box(
    `${[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${4 + c * 8}" y="${7 + r * 9}" width="6.4" height="7" rx="1.6" fill="${(r + c) % 3 ? 'rgba(255,255,255,.1)' : '#fbbf24'}"/>`).join('')).join('')}`,
    'rgba(56,189,248,.14)');
  if (kind === 'free') return box(
    `<path d="M23,5 l3.4,7.6 8.2,.9 -6.1,5.6 1.7,8.1 -7.2,-4.1 -7.2,4.1 1.7,-8.1 -6.1,-5.6 8.2,-.9 z" fill="#6ee7b7"/>
     <text x="23" y="36" text-anchor="middle" font-size="8" font-weight="800" fill="#a7f3d0">FS</text>`, 'rgba(110,231,183,.14)');
  return box('', 'rgba(255,255,255,.06)');
}

function renderWinDetail(out) {
  const host = $('#windetail');
  if (!host) return;
  if (out.facets <= 0) { host.innerHTML = ''; return; }
  const cards = [];
  const base = out.base;

  const lines = [...base.lineWins].sort((a, b) => b.facets - a.facets);
  for (const w of lines.slice(0, 3)) {
    const syms = w.cells.map(([r, row]) => base.grid[r][row]);
    cards.push(`<div class="wcard">${miniGrid(w.cells, syms)}
      <div class="wtxt">
        <span class="wt">Line ${w.line + 1} · <b>${w.count}× ${symbolName(w.symbol)}</b></span>
        <span class="wt">${w.units} × ${fmt(w.stakeShown ?? state.stake)} stake${w.multiplier > 1 ? ` × ${w.multiplier}` : ''}</span>
        <span class="wv">+${fmt(w.facets)}</span>
      </div></div>`);
  }
  if (lines.length > 3) cards.push(`<div class="wcard more">+${lines.length - 3} more line${lines.length - 3 > 1 ? 's' : ''}</div>`);

  if (base.scatterCount >= 3) {
    cards.push(`<div class="wcard feat">${miniGrid(base.scatterCells, base.scatterCells.map(() => 'S'), { path: false })}
      <div class="wtxt"><span class="wt"><b>${base.scatterCount} Starburst</b> anywhere</span>
      <span class="wt">pays × total bet${base.freeSpinsAwarded ? ` · ${base.freeSpinsAwarded} free spins` : ''}</span>
      <span class="wv">+${fmt(base.scatterFacets)}</span></div></div>`);
  }
  if (base.splash) {
    cards.push(`<div class="wcard feat">${featureIcon('splash')}
      <div class="wtxt"><span class="wt"><b>${featName('splash')}</b></span>
      <span class="wt">${base.splash.wilds} wild${base.splash.wilds > 1 ? 's' : ''} sprayed ${base.splash.droplets.length} droplet${base.splash.droplets.length === 1 ? '' : 's'}</span>
      <span class="wt">across reels ${base.splash.reels.map((r) => r + 1).join(', ')}</span></div></div>`);
  }
  for (const t of base.thunder) {
    cards.push(`<div class="wcard feat">${featureIcon('thunder')}
      <div class="wtxt"><span class="wt"><b>${featName('thunder')}</b> · reel ${t.reel + 1}</span>
      <span class="wt">3 stacked ${symbolName(t.symbol)} fused</span>
      <span class="wv">×${t.mult} on ${symbolName(t.symbol)} wins</span></div></div>`);
  }
  for (const f of out.features) {
    if (f.kind === 'hold') {
      cards.push(`<div class="wcard feat">${featureIcon('hold')}
        <div class="wtxt"><span class="wt"><b>${featName('hold')}</b></span>
        <span class="wt">${f.cells.length}/15 cells locked${f.gridFull ? ' · FULL GRID' : ''}</span>
        <span class="wv">+${fmt(f.facets)}</span></div></div>`);
    } else if (f.kind === 'free') {
      cards.push(`<div class="wcard feat">${featureIcon('free')}
        <div class="wtxt"><span class="wt"><b>Free spins</b></span>
        <span class="wt">${f.granted} spins played${f.cappedAt ? ` · capped at ${f.cappedAt}` : ''}</span>
        <span class="wv">+${fmt(f.facets)}</span></div></div>`);
    } else if (f.kind === 'wheel') {
      cards.push(`<div class="wcard feat">${featureIcon('wheel')}
        <div class="wtxt"><span class="wt"><b>${featName('wheel')}</b> · ${f.name}</span>
        <span class="wt">${f.multiplier.toFixed(2)} × total bet</span>
        <span class="wv">+${fmt(f.facets)}</span></div></div>`);
    }
  }
  host.innerHTML = cards.join('');
}

// THE GROVE — roster, ticker, and the hook that lets the reels talk to it.
const TICKER_MAX = 12;

const tickItem = (l) =>
  `<span class="tick-item"><b>${l.name}</b> \u00b7 ${l.text.replace(/\n/g, ' \u2014 ')}</span>`;

/**
 * Pick the next line to re-queue at the tail, skipping one identical to the item already
 * there. With a short history the round-robin printed the same sentence three times in a
 * row, which reads as a stuck ticker rather than a quiet one. Bounded scan: if every line
 * in the buffer is the same, it gives up and prints it — a repeat is better than a gap.
 */
function nextTickLine(track, cursor) {
  const lastText = track.lastElementChild?.textContent || '';
  for (let i = 0; i < ticker.length; i++) {
    const l = ticker[(cursor + i) % ticker.length];
    const text = `${l.name} \u00b7 ${l.text.replace(/\n/g, ' \u2014 ')}`;
    if (text !== lastText) return { line: l, next: cursor + i + 1 };
  }
  return { line: ticker[cursor % ticker.length], next: cursor + 1 };
}

/**
 * Append a line to the commentary ticker WITHOUT restarting the scroll.
 *
 * The old version rebuilt innerHTML and then deliberately reflowed to restart the
 * CSS animation, so every time a critter spoke the ticker jumped back to the start
 * and the line you were mid-way through reading vanished. Critters speak roughly
 * once a spin, so in practice the marquee almost never finished a pass.
 *
 * Now it is a JS-driven transform: one offset advanced by elapsed time, and content
 * appended to the tail while it runs. Nothing resets, ever — the scroll is
 * continuous for the life of the page and new lines simply arrive at the end.
 */
function pushTicker(line) {
  ticker.push(line);
  if (ticker.length > TICKER_MAX) ticker.shift();
  const track = $('#tick-track');
  if (!track) return;
  track.insertAdjacentHTML('beforeend', tickItem(line));
  // Drop items that have fully scrolled past the left edge, so the track cannot
  // grow without bound over a seventeen-hour session.
  while (track.children.length > TICKER_MAX * 2) track.removeChild(track.firstElementChild);
  startTicker();
}

let tickRAF = 0, tickX = 0, tickLast = 0;

function startTicker() {
  if (tickRAF) return;
  const step = (t) => {
    const track = $('#tick-track');
    const box = track?.parentElement;
    if (!track || !box) { tickRAF = 0; return; }
    if (!tickLast) tickLast = t;
    const dt = Math.min(0.25, (t - tickLast) / 1000);   // clamp: a backgrounded tab
    tickLast = t;                                       // must not teleport the track
    if (!tickPaused) tickX -= TICKER_PX_PER_SEC * dt;

    // Recycle: once the leading item is entirely off the left edge, drop it and
    // add its width back to the offset. The visible content never moves when this
    // happens, which is what makes the scroll seamless without a restart.
    let guard = 0;
    while (track.firstElementChild && guard++ < 40) {
      const w = track.firstElementChild.getBoundingClientRect().width
        + parseFloat(getComputedStyle(track).gap || 0);
      if (tickX + w < 0 && track.children.length > 1) {
        track.removeChild(track.firstElementChild);
        tickX += w;
      } else break;
    }
    // Keep the tail populated so there is never a gap: re-queue older lines.
    if (track.scrollWidth + tickX < box.clientWidth + 400 && ticker.length) {
      const nx = nextTickLine(track, tickQueue);
      tickQueue = nx.next;
      track.insertAdjacentHTML('beforeend', tickItem(nx.line));
    }
    track.style.transform = `translateX(${tickX}px)`;
    tickRAF = requestAnimationFrame(step);
  };
  tickRAF = requestAnimationFrame(step);
}
let tickQueue = 0;
let tickPaused = false;

/**
 * The Playground page's own ticker.
 *
 * Deliberately a SECOND instance rather than a refactor of the one above: that one works,
 * it is bound to #tick-track by id throughout, and generalising it to drive two tracks
 * would have put a working feature at risk for no gain. This shares the same `ticker`
 * line buffer — the two are never out of sync — and owns only its own transform state.
 */
let ydTickRAF = 0, ydTickX = 0, ydTickLast = 0, ydTickQueue = 0;

function ydTickPush(line) {
  const track = $('#yd-tick-track');
  if (!track) return;
  track.insertAdjacentHTML('beforeend', tickItem(line));
  while (track.children.length > TICKER_MAX * 2) track.removeChild(track.firstElementChild);
  ydTickStart();
}

function ydTickStart() {
  if (ydTickRAF || !yardOpen) return;
  const step = (t) => {
    const track = $('#yd-tick-track');
    const box = track?.parentElement;
    if (!track || !box || !yardOpen) { ydTickRAF = 0; return; }
    if (!ydTickLast) ydTickLast = t;
    const dt = Math.min(0.25, (t - ydTickLast) / 1000);
    ydTickLast = t;
    ydTickX -= TICKER_PX_PER_SEC * dt;
    let guard = 0;
    while (track.firstElementChild && guard++ < 40) {
      const w = track.firstElementChild.getBoundingClientRect().width
        + parseFloat(getComputedStyle(track).gap || 0);
      if (ydTickX + w < 0 && track.children.length > 1) { track.removeChild(track.firstElementChild); ydTickX += w; }
      else break;
    }
    if (track.scrollWidth + ydTickX < box.clientWidth + 400 && ticker.length) {
      const nx = nextTickLine(track, ydTickQueue);
      ydTickQueue = nx.next;
      track.insertAdjacentHTML('beforeend', tickItem(nx.line));
    }
    track.style.transform = `translateX(${ydTickX}px)`;
    ydTickRAF = requestAnimationFrame(step);
  };
  ydTickRAF = requestAnimationFrame(step);
}

function ydTickReset() {
  const track = $('#yd-tick-track');
  if (track) track.innerHTML = '';
  ydTickX = 0; ydTickLast = 0; ydTickQueue = 0;
  if (ydTickRAF) { cancelAnimationFrame(ydTickRAF); ydTickRAF = 0; }
  for (const l of ticker.slice(-TICKER_MAX)) ydTickPush(l);
  ydTickStart();
}

/** Pick who is hanging out: the rarest you own, plus your most recent draws. */
function rosterSize(ownedCount) {
  return Math.max(MIN_ROSTER, Math.min(MAX_ROSTER, 3 + Math.floor(ownedCount / 14)));
}

function grovePick(shuffle = false) {
  const owned = state.owned.map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  if (!owned.length) { rosterIds = null; return []; }
  const n = rosterSize(owned.length);

  if (shuffle) {
    const pool = [...owned];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    // A reshuffle that returns the same faces is indistinguishable from a broken
    // button. When there are more critters than seats, force at least one change.
    let out = pool.slice(0, n);
    if (rosterIds && owned.length > n && out.every((sp) => rosterIds.includes(sp.id))) {
      const fresh = pool.find((sp) => !rosterIds.includes(sp.id));
      if (fresh) out[Math.floor(Math.random() * out.length)] = fresh;
    }
    rosterIds = out.map((sp) => sp.id);
    return out;
  }

  // Keep the current roster if it is still valid — this is what makes Shuffle stick.
  if (rosterIds && rosterIds.length === n) {
    const kept = rosterIds.map((id) => SPECIES_BY_ID.get(id)).filter((sp) => sp && state.owned.includes(sp.id));
    if (kept.length === n) return kept;
  }

  const byRarity = [...owned].sort((a, b) => b.tier - a.tier);
  const recent = owned.slice(-Math.ceil(n / 2)).reverse();
  const out = [];
  for (const sp of [...recent, ...byRarity]) {
    if (!out.some((x) => x.id === sp.id)) out.push(sp);
    if (out.length >= n) break;
  }
  rosterIds = out.map((sp) => sp.id);
  return out;
}

function refreshGrove(force = false) {
  if (!grove) return;
  const roster = grovePick(force);
  const sig = roster.map((sp) => sp.id).join(',');
  if (!force && sig === rosterSig) return;
  rosterSig = sig;
  grove.setRoster(roster);
  const st = $('#grovestats');
  if (st) st.textContent = roster.length ? `${roster.length} of your ${state.owned.length} \u00b7 click one` : '';
}

function toast(msg, ms = 2600) {
  const d = document.createElement('div');
  d.textContent = msg;
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), ms);
}

function showModal(html) { $('#modal').innerHTML = html; $('#veil').classList.add('on'); }
function hideModal() { $('#veil').classList.remove('on'); }
$('#veil')?.addEventListener('click', (e) => { if (e.target.id === 'veil') hideModal(); });

function revealCritter(sp, costLabel) {
  showModal(`<div class="reveal">
    <div class="art">${renderCritter(sp, { size: 210, expression: 'happy', animate: true })}</div>
    <div class="nm">${sp.name}</div>
    <div class="set">${sp.set}</div>
    <div class="tier" style="color:${TIER_COLOR[sp.tier]}">${TIERS[sp.tier - 1].name}</div>
    <div class="tag">"${sp.tag}"</div>
    <p class="note" style="margin-top:14px">${costLabel} · +${fmt(TIERS[sp.tier - 1].trickle)} ${featName('currency')}/sec, permanently</p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
      <button class="tbtn" style="padding:9px 22px" id="rv-ok">Welcome it</button>
      <button class="tbtn" style="padding:9px 16px" id="rv-share">Share card</button>
    </div>
  </div>`);
  $('#rv-ok').onclick = () => { audio.click(); hideModal(); };
  $('#rv-share').onclick = (e) => doShare('critter', {
    species: sp, tierName: TIERS[sp.tier - 1].name, colour: TIER_COLOR[sp.tier],
  }, `lumenreel-${sp.name.toLowerCase()}.png`, e.currentTarget);
  audio.unlock(sp.tier);
  fx?.rain(30 + sp.tier * 22, symbolHue('W'));
}

// ---------------------------------------------------------------------------
// The spin. One re-entrancy guard, cleared in finally, with the control disabled
// for its whole duration — a second click must not stake a second bet.
async function spin() {
  if (busy) return;
  if (state.lumens < currentBet(state)) { audio.deny(); return; }
  busy = true;
  render();
  // Declared OUTSIDE the try so `finally` can always clear it. It used to be cleared
  // on the happy path only, so a throw anywhere in the reel loop or in settle() leaked
  // a 70ms interval for the life of the page — one more per failed spin.
  let spinUp = null;
  try {
    const out = doSpin(state, rand);
    if (!out) return;
    dirty = true;
    audio.spinStart();
    // A live spin ends any history review — the reels are about to be the present again.
    reviewing = -1;
    for (const el of document.querySelectorAll('.hcell.sel')) el.classList.remove('sel');
    const wd = $('#windetail'); if (wd) wd.innerHTML = '';

    const g = out.base.grid;
    grid = g;                       // so a theme switch can repaint the live face
    const reels = [...document.querySelectorAll('.reel')];
    reels.forEach((r) => r.classList.add('spinning'));

    if (turbo) {
      const t = spendTurbo(state, now());
      if (t.resting || t.left <= 0) { turbo = false; }
      paintTurbo();
    }
    const scale = turbo ? 0.34 : 1;
    spinUp = setInterval(() => { if (busy) paintGrid(randomFace()); }, 70);

    // Reel stops. The delay comes from stopDelayMs(reelIndex) — dark-law 3 means
    // it cannot be a function of the outcome, so this loop never sees `out`.
    for (let r = 0; r < 5; r++) {
      await sleep((r === 0 ? 320 : stopDelayMs(r) - stopDelayMs(r - 1)) * scale);
      for (let row = 0; row < 3; row++) {
        const w = cellEl(r, row);
        w.querySelector('.cell').innerHTML = renderSymbol(g[r][row]);
      }
      reels[r].classList.remove('spinning');
      audio.reelStop(r);
    }
    clearInterval(spinUp); spinUp = null;

    await settle(out);
  } finally {
    if (spinUp !== null) clearInterval(spinUp);
    busy = false;
    awardCheck();
    render();
    scheduleSave();
    if (auto && state.lumens >= currentBet(state)) setTimeout(spin, turbo ? 120 : 520);
    else if (auto) { auto = false; $('#btn-auto').classList.remove('on'); }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ceremony has a BUDGET. A round is 5 spins on average but a retriggered free round
// or a long hold chain can run to dozens of steps, and a fixed per-step pace turns the
// best moment in the game into a wait. Three rules:
//   - turbo means the player asked for speed, so the round is quick
//   - AUTO means they are not watching every spin either
//   - and whatever the pace, a whole round is capped, so a 40-step chain speeds up
//     rather than running for half a minute
const ROUND_BUDGET_MS = 9000;
function roundPace(steps, base) {
  const p = turbo ? base * 0.34 : auto ? base * 0.55 : base;
  return Math.max(70, Math.min(p, ROUND_BUDGET_MS / Math.max(1, steps)));
}

/**
 * Animate the reels down onto a KNOWN grid: scramble, then stop left to right.
 *
 * Presentation only — the grid is handed in already decided, exactly like the base
 * game's reel-stop loop, which cannot see the outcome either. `budget` is the whole
 * time available for this one spin, so a fast round still animates rather than
 * being skipped: the scramble and the five stops are scaled to fit whatever they get.
 */
async function spinReelsTo(g, budget) {
  const reels = [...document.querySelectorAll('.reel')];
  const stopSpan = Math.max(120, Math.min(budget * 0.72, 560));
  const scramble = Math.max(60, Math.min(budget * 0.26, 260));
  const per = stopSpan / 5;

  for (const r of reels) r.classList.add('spinning');
  const t0 = performance.now();
  // Scramble every reel that has not stopped yet.
  let stopped = 0;
  const scr = setInterval(() => {
    for (let r = stopped; r < 5; r++) {
      for (let row = 0; row < 3; row++) {
        const w = cellEl(r, row);
        if (w) w.querySelector('.cell').innerHTML = renderSymbol(randomSym());
      }
    }
  }, 62);
  await sleep(scramble);
  void t0;

  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      const w = cellEl(r, row);
      if (!w) continue;
      w.className = 'cellwrap';
      w.querySelector('.cell').innerHTML = renderSymbol(g[r][row]);
    }
    stopped = r + 1;
    reels[r]?.classList.remove('spinning');
    audio.reelStop(r);
    if (r < 4) await sleep(per);
  }
  clearInterval(scr);
}

/**
 * Replay a resolved free-spin round, one spin at a time, on the real reels.
 * Reads f.spins[] and nothing else.
 */
async function playFree(f) {
  const host = $('.reelbox');
  const hud = document.createElement('div');
  hud.className = 'roundhud free';
  host.appendChild(hud);
  const pace = roundPace(f.spins.length, 620);
  let total = 0;
  const paint = (i, left) => {
    hud.innerHTML = `<span class="rh-title">Free spins</span>
      <span class="rh-n">${i} / ${f.granted}</span>
      <span class="rh-tot">+${fmt(total)} ${featName('payout')}</span>
      ${left ? `<span class="rh-left">${left} to go</span>` : ''}`;
  };
  paint(0, f.granted);
  await sleep(pace);

  for (let i = 0; i < f.spins.length; i++) {
    const sp = f.spins[i];
    // SPIN the reels down, don't flash the result. paintGrid() alone made a free
    // round read as a slideshow of finished grids — the round is the one place the
    // machine should look most like a machine. Same mechanism the base game uses:
    // a blur-up scramble, then reels stopping left to right on the real face.
    await spinReelsTo(sp.grid, pace);
    audio.reelStop(4);
    const touched = new Set();
    for (const w of sp.lineWins) for (const [r, row] of w.cells) touched.add(r + ':' + row);
    for (const [r, row] of (sp.scatterCells || [])) touched.add(r + ':' + row);
    for (const key of touched) {
      const [r, row] = key.split(':').map(Number);
      cellEl(r, row)?.classList.add('win');
    }
    if (sp.facets > 0) {
      total += sp.facets;
      audio.win(2);
      for (const key of touched) {
        const [r, row] = key.split(':').map(Number);
        const b = cellEl(r, row)?.getBoundingClientRect();
        const box = $('#fx').getBoundingClientRect();
        if (b) fx?.shards(b.left - box.left + b.width / 2, b.top - box.top + b.height / 2, 285, 10, 1);
      }
    }
    if (sp.retriggered) {
      audio.scatter();
      hud.classList.add('retrig');
      toast(`+${sp.retriggered} free spins`, 1800);
      setTimeout(() => hud.classList.remove('retrig'), 900);
    }
    paint(i + 1, f.spins.length - i - 1);
    await sleep(pace);
  }

  hud.classList.add('done');
  hud.innerHTML = `<span class="rh-title">Free spins complete</span>
    <span class="rh-tot big">+${fmt(f.facets)} ${featName('payout')}</span>`;
  audio.unlock(4);
  fx?.rain(60, 285);
  await sleep(turbo ? 420 : auto ? 800 : 1300);
  hud.remove();
}

/**
 * Replay a resolved hold-and-spin round. Reads f.steps[] and f.cells[] only.
 */
async function playHold(f, base) {
  const host = $('.reelbox');
  const hud = document.createElement('div');
  hud.className = 'roundhud hold';
  host.appendChild(hud);
  const pace = roundPace(f.steps.length, 560);
  const val = new Map(f.cells.map((c) => [c.cell, c]));
  const shown = new Set();
  const box = $('#fx').getBoundingClientRect();

  const paintLocked = () => {
    for (const i of shown) {
      const r = Math.floor(i / 3), row = i % 3;
      const w = cellEl(r, row);
      if (!w) continue;
      const c = val.get(i);
      w.classList.add('held');
      w.querySelector('.cell').innerHTML =
        `<div class="heldval${c.jackpot ? ' jp' : ''}">${c.jackpot ? c.jackpot.toUpperCase() : fmt(c.value)}</div>`;
    }
  };
  const paintHud = (respins, note) => {
    hud.innerHTML = `<span class="rh-title">${featName('hold')}</span>
      <span class="rh-n">${shown.size} / 15 locked</span>
      <span class="rh-tot">${respins} respin${respins === 1 ? '' : 's'}</span>
      ${note ? `<span class="rh-left">${note}</span>` : ''}`;
  };

  for (const st of f.steps) {
    if (st.kind === 'seed') {
      for (const i of st.locked) shown.add(i);
      audio.holdTrigger();
    } else {
      for (const i of st.landed) {
        shown.add(i);
        const r = Math.floor(i / 3), row = i % 3;
        const b = cellEl(r, row)?.getBoundingClientRect();
        if (b) fx?.sparks(b.left - box.left + b.width / 2, b.top - box.top + b.height / 2, 46, 14);
        audio.coin(shown.size % 6);
      }
      if (!st.landed.length) audio.reelStop(4);
    }
    paintLocked();
    paintHud(st.respinsLeft, st.kind === 'respin' && st.landed.length ? 'respins reset' : '');
    await sleep(pace);
  }

  hud.classList.add('done');
  hud.innerHTML = `<span class="rh-title">${f.gridFull ? 'FULL GRID' : featName('hold') + ' complete'}</span>
    <span class="rh-tot big">+${fmt(f.facets)} ${featName('payout')}</span>`;
  audio.unlock(f.gridFull ? 5 : 4);
  fx?.rain(f.gridFull ? 120 : 50, 46);
  await sleep(turbo ? 420 : auto ? 800 : 1400);
  hud.remove();
  paintGrid(base.grid);
}

// Win tiers for the roll-up. The multiple of the total bet, not an absolute Facet
// amount, so the ceremony means the same thing at stake 1 and at stake 2e9.
const WIN_TIERS = [
  { x: 0,   label: '',            cls: '' },
  { x: 4,   label: 'Nice win',    cls: 'w2' },
  { x: 15,  label: 'Big win',     cls: 'w3' },
  { x: 60,  label: 'Huge win',    cls: 'w4' },
  { x: 250, label: 'MASSIVE WIN', cls: 'w5' },
];


/**
 * Count the win up instead of printing it.
 *
 * A slot's celebration IS the count-up: 4x and 1900x used to arrive in the same
 * instant as a finished number, so the only thing separating them was a particle
 * count. This escalates through the tiers above as the counter passes them, ticks
 * a rising pitch, and finishes on the exact figure the engine paid — the number is
 * never invented, only revealed over time.
 *
 * Duration scales with size and collapses to nothing in turbo, because a player who
 * asked for fast spins did not ask for a longer ceremony.
 */
function rollUp(el, facets, bits, bet) {
  const token = ++rollToken;
  const tail = bits.length ? ' · ' + bits.join(' · ') : '';
  const ratio = bet > 0 ? facets / bet : 0;
  const top = WIN_TIERS.reduce((a, t) => (ratio >= t.x ? t : a), WIN_TIERS[0]);
  const paint = (v, cls, label) => {
    el.className = 'winline' + (cls ? ' ' + cls : '');
    el.innerHTML = `${label ? `<i class="wtag">${label}</i> ` : ''}<b>+${fmt(v)}</b> ${featName('payout')}${tail}`;
  };

  // Small wins and turbo get the number immediately — a roll-up on a 0.4x win is
  // ceremony spent on nothing, which is the same budget error as celebrating a zero.
  if (turbo || ratio < WIN_TIERS[1].x || fx?.reduced) { paint(facets, top.cls, top.label); return; }

  const dur = Math.min(2600, 620 + Math.log10(1 + ratio) * 900);
  const t0 = performance.now();
  let lastTier = -1;
  const step = () => {
    if (token !== rollToken) return;              // a newer spin owns the line now
    const p = Math.min(1, (performance.now() - t0) / dur);
    // Ease out: fast at first, then settling — the shape a mechanical counter has.
    const e = 1 - Math.pow(1 - p, 2.2);
    const v = facets * e;
    const tier = WIN_TIERS.reduce((a, t, i) => ((v / (bet || 1)) >= t.x ? i : a), 0);
    if (tier !== lastTier) {
      lastTier = tier;
      if (tier > 0) { audio.coin(Math.min(3, tier)); fx?.rain(12 + tier * 10, 285); }
    }
    paint(v, WIN_TIERS[tier].cls, WIN_TIERS[tier].label);
    if (p < 1) requestAnimationFrame(step);
    else paint(facets, top.cls, top.label);       // land on the exact paid figure
  };
  requestAnimationFrame(step);
}

async function settle(out) {
  const base = out.base;
  const box = $('#fx').getBoundingClientRect();
  const cellCentre = (r, row) => {
    const b = cellEl(r, row).getBoundingClientRect();
    return [b.left - box.left + b.width / 2, b.top - box.top + b.height / 2];
  };

  pushHistory(out);

  if (out.arcadeToken) {
    if (out.arcadeToken.granted > 0) {
      audio.unlock(3);
      fx?.rain(34, 195);
      toast(`✦ Free arcade play won — ${out.arcadeToken.banked} banked · no cooldown`, 4200);
      grove?.event('bigwin');
    } else {
      // The bank is full. Say so rather than silently discarding it.
      toast(`Arcade token dropped, but your ${ARCADE.freeCap} free plays are already banked`, 3600);
    }
  }

  // --- REFRACTION SPLASH: the wave, then the droplets landing one by one -----
  if (base.splash) {
    const wave = document.createElement('div');
    wave.className = 'splashwave';
    $('.reelbox').appendChild(wave);
    requestAnimationFrame(() => wave.classList.add('go'));
    setTimeout(() => wave.remove(), 800);
    audio.splash();

    for (const [r, row] of base.splash.sources) {
      cellEl(r, row).classList.add('wildsrc');
      const [x, y] = cellCentre(r, row);
      fx?.ring(x, y, 320);
      fx?.sparks(x, y, 320, 16);
    }
    // Droplets land in reel order so the eye reads it travelling across the five
    // reels, which is the effect being asked for — not five things appearing.
    for (let i = 0; i < base.splash.droplets.length; i++) {
      const [r, row] = base.splash.droplets[i];
      await sleep((turbo ? 34 : 105));
      const w = cellEl(r, row);
      w.querySelector('.cell').innerHTML = renderSymbol('W');
      w.classList.add('droplet', 'splashed');
      const [x, y] = cellCentre(r, row);
      fx?.shards(x, y, 200 + i * 26, 16, 1.15);
      fx?.ring(x, y, 200);
      audio.droplet(i);
    }
  }

  // --- PRISM THUNDER: the stack fuses into one giant symbol ------------------
  if (base.thunder.length) {
    audio.thunder(base.thunder.length);
    for (const t of base.thunder) {
      const reel = document.querySelector(`.reel[data-reel="${t.reel}"]`);
      reel.classList.add('thunder');
      const fuse = document.createElement('div');
      fuse.className = 'thunderfuse';
      fuse.innerHTML = renderSymbol(t.symbol, 220) + `<span class="thunderbadge">×${t.mult}</span>`;
      reel.appendChild(fuse);
      const [x, y] = cellCentre(t.reel, 1);
      fx?.shards(x, y, symbolHue(t.symbol), 26, 1.6);
      fx?.ring(x, y, symbolHue(t.symbol));
      await sleep(turbo ? 40 : 170);
    }
  }

  for (const [r, row] of base.coinCells) cellEl(r, row).classList.add('coin');
  for (const [r, row] of base.scatterCells) cellEl(r, row).classList.add('scat');

  if (base.lineWins.length) {
    const touched = new Set();
    for (const w of base.lineWins) for (const [r, row] of w.cells) touched.add(r + ':' + row);
    for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) {
      if (!touched.has(r + ':' + row)) cellEl(r, row).classList.add('dim');
    }
    for (const w of base.lineWins) {
      for (const [r, row] of w.cells) {
        cellEl(r, row).classList.add('win');
        const [x, y] = cellCentre(r, row);
        fx?.shards(x, y, symbolHue(w.symbol), 12, Math.min(2, 0.6 + w.units / 40));
      }
    }
  }

  if (base.scatterCount >= 3) {
    audio.scatter();
    for (const [r, row] of base.scatterCells) { const [x, y] = cellCentre(r, row); fx?.sparks(x, y, 50, 22); }
  }
  if (base.holdTriggered) {
    audio.holdTrigger();
    fx?.sweep(46);
    toast(`${featName('hold')} — a ${symbolName('O')} on every reel`);
  }

  // --- FEATURE ROUNDS, PLAYED OUT -------------------------------------------
  // These two channels are 63% of everything the game pays and both used to arrive as
  // a summary card while the 10% channel got the only full-screen ceremony. They are
  // played out now, step by step, on the real grid.
  //
  // PRESENTATION ONLY, and that is load-bearing: the engine already resolved the whole
  // round and handed back `spins[]` / `steps[]`. Nothing below rolls a die, reads a
  // constant or touches state — it replays a decided result. A gate asserts that.
  for (const f of out.features) {
    if (f.kind === 'hold') { interrupt(null); await playHold(f, base); }
    else if (f.kind === 'free') { interrupt(null); await playFree(f); }
  }

  // --- PRISM WHEEL ----------------------------------------------------------
  if (out.wheel) interrupt(null);
  if (out.wheel) {
    // The wheel may also hand back turbo spins — the one reward that is not
    // Facets, so it never touches the measured payout maths.
    let turboGift = 0;
    if (Math.random() < TURBO.wheelGrantChance) {
      turboGift = TURBO.wheelGrantSpins;
      grantTurbo(state, turboGift, now());
      paintTurbo();
    }
    await showWheel(out.wheel, turboGift);
  }

  if (out.facets > 0) {
    const fb = $('#facets').getBoundingClientRect();
    const tx = fb.left - box.left + fb.width / 2, ty = fb.top - box.top + fb.height / 2;
    const n = Math.min(26, 4 + Math.floor(Math.log10(1 + out.facets / Math.max(1, out.bet)) * 12));
    for (let i = 0; i < n; i++) {
      const [x, y] = cellCentre(Math.floor(Math.random() * 5), Math.floor(Math.random() * 3));
      fx?.coin(x, y, tx, ty);
      if (i < 8) setTimeout(() => audio.coin(i), i * 55);
    }
    const ratio = out.facets / Math.max(1, out.bet);
    if (ratio >= BIG_WIN_X) interrupt(`${Math.round(ratio)}× — autospin paused so you can watch it`);
    const level = ratio >= 60 ? 4 : ratio >= 15 ? 3 : ratio >= 4 ? 2 : 1;
    audio.win(level);
    if (level >= 3) fx?.rain(40 + level * 24, 285);
    const bits = [];
    if (base.lineWins.length) bits.push(`${base.lineWins.length} line${base.lineWins.length > 1 ? 's' : ''}`);
    if (base.splash) bits.push(`${featName('splash')} ×${base.splash.droplets.length + base.splash.wilds}`);
    if (base.thunder.length) bits.push(`${featName('thunder')} ×${Math.max(...base.thunder.map((t) => t.mult))}`);
    if (out.features.some((f) => f.kind === 'free')) bits.push('free spins');
    if (out.features.some((f) => f.kind === 'hold')) bits.push(featName('hold'));
    if (out.wheel) bits.push(`${out.wheel.name} wheel`);
    const wl = $('#winline');
    wl.dataset.spun = '1';
    wl.className = 'winline';
    rollUp(wl, out.facets, bits, out.bet);
  } else {
    // DARK-LAW 2 in the UI layer: a zero is shown as a zero. No sound, no shards,
    // no "nice try" framing. There is nothing to celebrate and we do not pretend.
    const wl = $('#winline');
    wl.dataset.spun = '1';
    wl.className = 'winline zero';
    // The message is deliberately INVARIANT. An earlier version read "Features
    // landed, but no line paid" when a splash or thunder had fired — accurate, but
    // it dresses a zero as eventful, which is the loss-disguised-as-a-win
    // aesthetic with the currency lie removed and nothing else changed. A zero
    // reads the same every time, however pretty the spin was.
    wl.textContent = 'No pay this spin.';
  }

  // The Grove reacts. One line per spin at most, weighted to the loudest thing
  // that happened, so it comments rather than narrates.
  if (grove) {
    const ratio = out.facets / Math.max(1, out.bet);
    if (out.wheel) grove.event('wheel');
    else if (out.features.some((f) => f.kind === 'hold')) grove.event('hold');
    else if (out.features.some((f) => f.kind === 'free')) grove.event('free');
    else if (ratio >= 25) grove.event('bigwin');
    else if (base.thunder.length && Math.random() < 0.5) grove.event('thunder');
    else if (base.splash && Math.random() < 0.4) grove.event('splash');
    else if (out.facets <= 0 && Math.random() < 0.22) grove.event('nopay');
    else if (out.facets > 0 && Math.random() < 0.18) grove.event('win');
  }

  renderWinDetail(out);
  renderHistory();
  await sleep(turbo ? 90 : 460);
  for (const el of document.querySelectorAll('.cellwrap')) el.classList.remove('dim');
}

/** The Prism Wheel. Five weighted segments, a real spin, then the payout. */
function showWheel(wheel, turboGift = 0) {
  return new Promise((resolve) => {
    const total = WHEEL_PRIZES.reduce((a, w) => a + w.w, 0);
    let acc = 0;
    const segs = WHEEL_PRIZES.map((w) => {
      const a0 = (acc / total) * 360; acc += w.w;
      const a1 = (acc / total) * 360;
      return { ...w, a0, a1, mid: (a0 + a1) / 2 };
    });
    const COL = { mini: '#7dd3fc', minor: '#6ee7b7', major: '#c4b5fd', mega: '#fda4af', ultra: '#fcd34d' };
    const arc = (a0, a1) => {
      const p = (a) => [50 + 44 * Math.cos((a - 90) * Math.PI / 180), 50 + 44 * Math.sin((a - 90) * Math.PI / 180)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      return `M50,50 L${x0.toFixed(2)},${y0.toFixed(2)} A44,44 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
    };
    // Slices too narrow to hold their own label, in wheel order — each gets its own ring.
    const external = segs.filter((sg) => (sg.a1 - sg.a0) < 26).map((sg) => sg.id);
    const win = segs.find((x) => x.id === wheel.id);
    // 4 full turns then land the winning segment under the pointer at the top.
    const target = 360 * 4 + (360 - win.mid);

    showModal(`<div class="hd"><h2>${featName('wheel')}</h2></div><div class="bd wheelwrap">
      <svg viewBox="-34 -34 168 176" aria-label="${featName('wheel')}">
        <g id="wh" class="wheelspin" style="transform-origin:50px 50px">
          ${segs.map((sg) => `<path d="${arc(sg.a0, sg.a1)}" fill="${COL[sg.id]}" opacity=".82" stroke="#0a0d18" stroke-width="1"/>`).join('')}
          ${segs.map((sg) => {
            // A label only fits INSIDE its slice if the slice is wide enough to hold it.
            // Ultra is 1.6% of the wheel = 5.8 degrees = about 3px of arc at r=30, so its
            // rotated label ran straight through Mega's. Narrow slices get an external
            // label with a leader line instead of being crammed into 3px.
            const wide = (sg.a1 - sg.a0) >= 26;
            const a = (sg.mid - 90) * Math.PI / 180;
            const cos = Math.cos(a), sin = Math.sin(a);
            if (wide) {
              const rr = 29;
              return `<text x="${(50 + rr * cos).toFixed(1)}" y="${(50 + rr * sin).toFixed(1)}"
                text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="800"
                fill="#0a0d18">${sg.name}</text>`;
            }
            // The thin slices are ADJACENT (Mega 19.4 deg, then Ultra 5.8 deg), so moving both
            // outside at one radius only relocates the collision. Each external label gets its
            // own ring, in wheel order, and its leader line grows to reach it.
            const rank = external.indexOf(sg.id);
            const rTip = 46 + rank * 14, rTxt = rTip + 3;
            const right = cos >= 0;
            return `<line x1="${(50 + 42 * cos).toFixed(1)}" y1="${(50 + 42 * sin).toFixed(1)}"
                x2="${(50 + rTip * cos).toFixed(1)}" y2="${(50 + rTip * sin).toFixed(1)}"
                stroke="${COL[sg.id]}" stroke-width="1.2" opacity=".9"/>
              <text x="${(50 + rTxt * cos).toFixed(1)}" y="${(50 + rTxt * sin).toFixed(1)}"
                text-anchor="${right ? 'start' : 'end'}" dominant-baseline="middle"
                font-size="7" font-weight="800" fill="${COL[sg.id]}">${sg.name}</text>`;
          }).join('')}
        </g>
        <circle cx="50" cy="50" r="11" fill="#0e1424" stroke="#2f3b5e" stroke-width="1.5"/>
        <path class="wheelptr" d="M50,2 L55,13 L45,13 Z" fill="#fff"/>
      </svg>
      <div id="wh-out" style="min-height:64px;margin-top:8px"></div>
    </div>`);

    const g = document.getElementById('wh');
    audio.wheelSpin();
    requestAnimationFrame(() => { g.style.transform = `rotate(${target}deg)`; });
    setTimeout(() => {
      audio.unlock(Math.min(5, 1 + WHEEL_PRIZES.findIndex((w) => w.id === wheel.id)));
      fx?.rain(70, 46);
      document.getElementById('wh-out').innerHTML =
        `<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)">${wheel.name}</div>
         <div style="font-size:30px;font-weight:800;color:${COL[wheel.id]}">+${fmt(wheel.facets)}</div>
         <div class="note">${wheel.multiplier.toFixed(2)}× your ${fmt(currentBet(state))} bet · that prize resets to base</div>
         ${turboGift ? `<div class="note" style="color:var(--meter);margin-top:6px">+${turboGift} turbo spins</div>` : ''}
         <button class="tbtn" id="wh-ok" style="margin-top:12px;padding:8px 22px">Collect</button>`;
      const ok = document.getElementById('wh-ok');
      const done = () => { audio.click(); hideModal(); resolve(); };
      ok.onclick = done;
      setTimeout(() => { if ($('#veil').classList.contains('on')) done(); }, turbo ? 500 : 4200);
    }, turbo ? 700 : 3700);
  });
}

// ---------------------------------------------------------------------------
function applyTheme() {
  const t = themeOf(state.theme);
  document.body.className = 'theme-' + t.id;
  // Copy is part of the skin. Leaving "Prism Meter" and "Facets" on screen in
  // Nature mode is exactly the half-applied reskin this single call site exists
  // to prevent.
  const setTxt = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  setTxt('#lbl-lum', t.featureNames.currency);
  setTxt('#lbl-fac', t.featureNames.payout);
  setTxt('#lbl-meter', t.featureNames.meter);
  setTxt('#tab-cuts', t.featureNames.generator);
  // The idle winline ships with Prism wording in app.html. Until the first spin
  // replaces it, a Verdant player is reading Prism copy — the same half-applied
  // reskin, just on the one line that is hardest to notice because it never moves.
  const wl0 = $('#winline');
  if (wl0 && wl0.dataset.spun !== '1') {
    wl0.textContent = `Stake ${t.featureNames.currency}. The reels pay ${t.featureNames.payout}. Nothing you stake comes back.`;
  }
  const btn = $('#btn-theme');
  if (btn) { btn.textContent = t.name; btn.classList.toggle('on', t.id !== 'prism'); }
  if (fx) fx.setHues(t.particleHues);
  // Repaint the CURRENT face in the new art. Without this the reels keep the old
  // skin until the next spin, which is the most visible surface in the game.
  if (document.querySelector('.cellwrap')) paintGrid(grid);
  // Force a rebuild: symbol names and the Verdant tier's lock state both change.
  const host = $('#pane'); if (host) host.dataset.sig = '';
  const lad = $('#ladder'); if (lad) lad.dataset.sig = '';
}

/** Turbo button face: budget bar, remaining count, or the countdown while resting. */
/**
 * Something happened that deserves attention: stop autospin and, if the player
 * has wandered off to the playground, bring them back to the machine.
 */
function openYard() {
  if (!yard) {
    yard = new Yard($('#yd-stage'), {
      fx, audio,
      onLine: (l) => { state.stats.lines = (state.stats.lines || 0) + 1; pushTicker(l); ydSay(l); },
      onAct: (kind) => {
        const key = kind === 'pet' ? 'pets' : kind === 'wash' ? 'washes' : kind === 'poke' ? 'pokes' : 'chats';
        state.stats[key] = (state.stats[key] || 0) + 1;
        dirty = true; awardCheck(); scheduleSave();
      },
    });
    $('#yd-tools').innerHTML = TOOLS.map((t, i) =>
      `<button class="yd-tool ${i === 0 ? 'on' : ''}" data-tool="${t.id}"><i>${t.icon}</i>${t.name}</button>`).join('');
    $('#yd-tools').onclick = (e) => {
      const b = e.target.closest('[data-tool]');
      if (!b) return;
      audio.click();
      yard.setTool(b.dataset.tool);
      for (const x of document.querySelectorAll('.yd-tool')) x.classList.toggle('on', x === b);
      $('#yd-hint').textContent = TOOLS.find((t) => t.id === b.dataset.tool)?.hint || '';
    };
    $('#yd-close').onclick = () => { audio.click(); closeYard(); };

    // Roster drawer. The cells are rebuilt on every change, so the click is delegated
    // to the static container rather than bound per cell.
    const drawer = $('#yd-drawer');
    $('#yd-pick').onclick = () => {
      audio.click();
      drawer.hidden = !drawer.hidden;
      if (!drawer.hidden) renderYardPick();
    };
    $('#yd-pick-done').onclick = () => { audio.click(); drawer.hidden = true; };
    $('#yd-picker').onclick = (e) => {
      const cell = e.target.closest('[data-sp]');
      if (!cell) return;
      audio.click();
      toggleYardOut(Number(cell.dataset.sp));
    };
    $('#yd-pick-none').onclick = () => {
      audio.click();
      state.yardAuto = false;      // an EMPTY explicit list is "all put away"
      state.yardOut = [];
      applyYardCast();
    };
    $('#yd-pick-newest').onclick = () => {
      audio.click();
      state.yardAuto = false;
      state.yardOut = state.owned.slice(-YARD_CAP);
      applyYardCast();
    };
    $('#yd-pick-rarest').onclick = () => {
      audio.click();
      const owned = state.owned.map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
      owned.sort((a, b) => b.tier - a.tier || b.id - a.id);
      state.yardAuto = false;
      state.yardOut = owned.slice(0, YARD_CAP).map((sp) => sp.id);
      applyYardCast();
    };

    // PNG of the stage EXACTLY as it stands — same cast, same positions, same tool
    // state. Guarded because it awaits image decodes for every actor on stage.
    $('#yd-png').onclick = async (e) => {
      if (yardPngBusy) return;
      yardPngBusy = true;
      const btn = e.currentTarget;
      btn.disabled = true;
      const was = btn.textContent;
      btn.textContent = 'Rendering…';
      try {
        const ok = await savePlaygroundPng();
        toast(ok ? 'Playground saved as a PNG.' : 'Nothing on stage to save.');
      } catch (err) {
        toast(`Could not save the PNG: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = was;
        yardPngBusy = false;
      }
    };
    $('#yd-share').onclick = (e) => {
      const roster = (yard?.actors || []).map((a) => a.sp).filter(Boolean);
      if (!roster.length) { audio.deny(); return; }
      doShare('playground', {
        roster, owned: state.owned.length,
        line: roster[0] ? `"${roster[0].tag}"` : '',
      }, 'lumenreel-playground.png', e.currentTarget);
    };
  }
  yardOpen = true;
  $('#yard').hidden = false;
  // ONE playground. The Grove strip under the reels is the same cast doing the same
  // thing; leaving it running behind the full page meant two copies simulating at
  // once, and its speech bubbles (z-index 400 against the yard's 55) painted straight
  // through the overlay. Stop it and hide it while the page is open.
  grove?.stop();
  const gv = $('#grove'); if (gv) gv.style.visibility = 'hidden';
  yard.measure();
  yard.setRoster(yardCast());
  yard.start();
  ydSay(null, true);
  ydTickReset();
  paintYardCount();
  $('#yd-hint').textContent = TOOLS[0].hint;
  $('#yd-auto').textContent = auto ? 'the reels are still spinning' : '';
}

/**
 * Who is actually on stage. An empty `yardOut` means AUTO — the newest YARD_CAP owned,
 * which is exactly what the page did before there was a chooser, so an existing save
 * opens to the same cast it always did.
 */
function yardCast() {
  const owned = state.owned.map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  if (state.yardAuto) return owned.slice(-YARD_CAP);
  const pick = state.yardOut.map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  return pick.slice(0, YARD_CAP);
}

function paintYardCount() {
  const owned = state.owned.length;
  const outN = yardCast().length;
  const el = $('#yd-count');
  if (el) el.textContent = `${outN} out of your ${owned}${state.yardAuto ? ' · auto' : ''} · drag them anywhere`;
}

/** Rebuild the stage from the current roster without closing the page. */
function applyYardCast() {
  if (!yard) return;
  yard.measure();
  yard.setRoster(yardCast());
  paintYardCount();
  renderYardPick();
  flush();
}

function renderYardPick() {
  const host = $('#yd-picker');
  if (!host || $('#yd-drawer')?.hidden) return;
  const owned = state.owned.map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  const outSet = new Set(yardCast().map((sp) => sp.id));
  const full = outSet.size >= YARD_CAP;
  $('#yd-pick-count').textContent = `${outSet.size} / ${YARD_CAP} out · ${owned.length} collected`;
  host.innerHTML = owned.map((sp) => {
    const out = outSet.has(sp.id);
    return `<div class="yd-pick-cell${out ? ' out' : ''}${full ? ' full' : ''}" data-sp="${sp.id}" title="${sp.name}">
      <span class="dot"></span>${renderCritter(sp, { size: 56 })}<div class="nm">${sp.name}</div></div>`;
  }).join('');
}

/** Toggle one critter in or out. Explicit list from here on — auto is no longer implied. */
function toggleYardOut(id) {
  if (!state.owned.includes(id)) return;
  if (state.yardAuto) { state.yardOut = yardCast().map((sp) => sp.id); state.yardAuto = false; }
  const i = state.yardOut.indexOf(id);
  if (i >= 0) state.yardOut.splice(i, 1);
  else if (state.yardOut.length < YARD_CAP) state.yardOut.push(id);
  else { toast(`${YARD_CAP} is the most that fit. Put one away first.`); return; }
  applyYardCast();
}

/**
 * Snapshot the stage. Reads the LIVE actor list — position, facing, expression and size
 * exactly as rendered — so the file matches what the player was looking at rather than a
 * fresh layout of the same cast.
 */
async function savePlaygroundPng() {
  const actors = (yard?.actors || []).filter((a) => a.sp);
  if (!actors.length) return false;
  const box = $('#yd-stage')?.getBoundingClientRect();
  const cast = actors.map((a) => ({
    sp: a.sp, name: a.sp.name,
    x: Math.round(a.x), y: Math.round(a.y),
    face: a.face === -1 ? -1 : 1,
    expression: a.expr || a.sp.mood,
    size: 128,
  }));
  return buildPlaygroundPng(cast, {
    theme: state.theme,
    width: Math.max(640, Math.round(box?.width || 1200)),
    height: Math.max(360, Math.round(box?.height || 700)),
    title: 'The Playground',
    sub: `${cast.length} of ${state.owned.length} critters \u00b7 ${themeOf(state.theme).name} mode`,
  }, `lumenreel-playground-${cast.length}.png`);
}

function closeYard() {
  yardOpen = false;
  yard?.stop();
  if (ydTickRAF) { cancelAnimationFrame(ydTickRAF); ydTickRAF = 0; }
  const dr = $('#yd-drawer'); if (dr) dr.hidden = true;
  const el = $('#yard');
  if (el) el.hidden = true;
  // Hand the cast back to the Grove strip.
  const gv = $('#grove'); if (gv) gv.style.visibility = '';
  grove?.start();
  refreshGrove(true);
}

/**
 * The Playground page's own commentary feed. The Grove strip has a ticker above the
 * reels; the full page had nothing, so the critters were silent exactly where the
 * player is looking straight at them. Lines come from the same Yard callback that
 * feeds the reel ticker, so nothing is duplicated or invented here.
 */
function ydSay(line, reset = false) {
  const host = $('#yd-feed');
  if (!host) return;
  if (reset) { host.innerHTML = ''; ydFeed.length = 0; }
  if (line) {
    ydFeed.unshift(line);
    if (ydFeed.length > YD_FEED_MAX) ydFeed.length = YD_FEED_MAX;
    ydTickPush(line);
  }
  host.innerHTML = ydFeed.length
    ? ydFeed.map((l, i) => `<div class="yd-line${i === 0 ? ' fresh' : ''}">
        <b>${l.name}</b><span>${l.text.replace(/\n/g, ' \u2014 ')}</span></div>`).join('')
    : '<div class="yd-line quiet"><span>Pet one. It will have something to say about it.</span></div>';
}
const ydFeed = [];
const YD_FEED_MAX = 3;   // the chatlog holds three; the ticker holds the history

function interrupt(reason) {
  if (auto) { auto = false; $('#btn-auto')?.classList.remove('on'); }
  if (yardOpen) closeYard();
  if (reason) toast(reason, 3400);
}

/** One paid gacha roll, shown as a ball drop, then the reveal. */
async function runGacha() {
  if (gachaBusy) { audio.deny(); return; }
  const preview = gachaTable(state);
  if (!preview.rows.length) { audio.deny(); return; }
  gachaBusy = true;
  renderPane(true);   // paint the disabled state now, not on the next 250ms tick
  try {
    // The roll happens FIRST. The animation is choreography that lands on it.
    const d = drawCritterGacha(state, rand);
    if (!d) { audio.deny(); return; }
    dirty = true;
    showModal(`<div class="hd"><h2>${d.tier ? 'Drop' : 'Draw'}</h2></div><div class="bd" id="gacha-host"></div>`);
    await ballDrop($('#gacha-host'), d, { audio });
    hideModal();
    revealCritter(d.species, `Dropped for ${fmt(d.cost)} ${featName('payout')} · ${d.tier.name}`);
    awardCheck(); render(); refreshGrove(true);
    grove?.event('unlock', state.owned.length);
    scheduleSave();
  } finally {
    gachaBusy = false;
    renderPane(true);
  }
}

/** Build and hand over a share card. Guarded: canvas encode is async and the button
 *  is disabled while it runs, so a double-click cannot queue two downloads. */
let shareBusy = false;
async function doShare(kind, data, filename, btn) {
  if (shareBusy) return;
  shareBusy = true;
  if (btn) btn.disabled = true;
  try {
    audio.click();
    const r = await shareCard(kind, { theme: state.theme, ...data }, filename);
    toast(r.ok ? (r.copied ? 'Card saved and copied to your clipboard' : 'Card saved to your downloads')
      : 'Could not build that card', 3600);
  } catch (err) {
    console.error('[share]', err);
    toast('Could not build that card', 3200);
  } finally {
    shareBusy = false;
    if (btn) btn.disabled = false;
  }
}

/** Announce anything just earned. One toast per award, newest last. */
function awardCheck() {
  const earned = checkAchievements(state);
  if (!earned.length) return;
  dirty = true;
  for (let i = 0; i < earned.length; i++) {
    const a = earned[i];
    const bits = [];
    if (a.granted.lumens > 0) bits.push(`+${fmt(a.granted.lumens)} ${featName('currency')}`);
    if (a.granted.facets > 0) bits.push(`+${fmt(a.granted.facets)} ${featName('payout')}`);
    setTimeout(() => {
      toast(`✦ ${a.name} — ${bits.join(' · ')}`, 4200);
      audio.unlock(2);
      fx?.rain(26, 285);
    }, i * 520);
  }
  grove?.event('bigwin');
}

function paintTurbo() {
  const btn = $('#btn-turbo');
  if (!btn) return;
  const t = turboState(state, now());
  if (t.resting) {
    if (turbo) turbo = false;
    btn.classList.remove('on');
    btn.classList.add('resting');
    btn.textContent = `Turbo · rests ${Math.ceil(t.restMs / 1000)}s`;
  } else {
    btn.classList.remove('resting');
    btn.classList.toggle('on', turbo);
    // "Turbo 38" against a tooltip reading "25 fast spins" is two different claims on
    // one control. The number is what is left; say so.
    btn.textContent = `Turbo · ${t.left} left`;
  }
  let bar = btn.querySelector('.turbometer');
  if (!bar) { bar = document.createElement('i'); bar.className = 'turbometer'; btn.appendChild(bar); }
  bar.style.width = `${t.resting ? 100 - (t.restMs / t.cooldownMs) * 100 : (t.left / t.budget) * 100}%`;
}

function applyMusicMode() {
  const btn = $('#btn-music');
  if (musicMode === 'off') { audio.setMusic(false); btn.classList.remove('on'); btn.textContent = 'Music · Off'; return; }
  audio.setStyle(musicMode);
  audio.setMusic(true);
  btn.classList.add('on');
  btn.textContent = 'Music · ' + MUSIC_LABELS[musicMode];
}

// HOW TO PLAY. Shown once on first launch, reachable forever from the top bar.
// Written from the real constants, so it cannot drift from the game.
function tutorialHtml() {
  const t = themeOf(state.theme);
  const F = t.featureNames;
  const payRow = (k) => `<tr><td>${renderSymbol(k, 20)} ${symbolName(k)}</td>
    <td>${PAYTABLE[k][3]} / ${PAYTABLE[k][4]} / ${PAYTABLE[k][5]}</td></tr>`;
  return `<div class="hd"><h2>How to play</h2></div><div class="bd tut">
    <h3>The one idea</h3>
    <div class="steps">
      <div class="step"><span class="num">1</span><div>
        <b>${F.currency}</b> arrive on their own \u2014 ${fmt(ACCRUAL.baseRate)} per second to start, faster as you go.
        Time is the only thing you ever spend. There is no money in this game and no way to add any.</div></div>
      <div class="step"><span class="num">2</span><div>
        Spinning stakes ${F.currency}. The reels pay <b>${F.payout}</b>, a completely separate currency.
        Nothing you stake can come back, so a spin either pays ${F.payout} or pays nothing \u2014 and we say so plainly.</div></div>
      <div class="step"><span class="num">3</span><div>
        ${F.payout} buy <b>critters</b>. A draw never gives you one you already own, so there is no endless
        chase for the last few. Any specific critter can be bought outright for ${SPARK_MULTIPLIER}\u00d7 the
        draw price \u2014 that is the most it can ever cost you.</div></div>
      <div class="step"><span class="num">4</span><div>
        Every critter you own permanently raises your ${F.currency} per second, and owning more unlocks
        bigger bets and new ${F.generator}. <b>The collection is the progression.</b></div></div>
    </div>

    <div class="cta" style="margin:18px 0 4px">
      <button class="tbtn on" id="tut-ok" style="padding:10px 26px;font-size:13px">Start spinning</button>
      <button class="tbtn" id="tut-more" style="padding:9px 16px">Paytable and features</button>
      <button class="tbtn" id="tut-odds" style="padding:9px 16px">Full odds</button>
    </div>

    <div id="tut-detail" hidden>
    <h3>Paytable \u00b7 per line, \u00d7 your stake</h3>
    <table class="paytab">
      <tr><td style="color:var(--ink3)">Symbol</td><td style="color:var(--ink3);text-align:right">3 / 4 / 5</td></tr>
      ${['E', 'N', 'H', 'P', 'b', 't', 'a', 'c', 'q', 'W'].map(payRow).join('')}
    </table>
    <p class="note" style="margin-top:8px">${symbolName('S')} pays on count anywhere and awards free spins.
      ${HOLD_TRIGGER} \u00d7 ${symbolName('O')}, one on every reel, starts ${F.hold}.</p>

    <h3>Features</h3>
    <p class="note">
      <b>${F.splash}</b> \u2014 ${SPLASH_MIN_WILDS}+ wilds spray droplets across the other reels.<br>
      <b>${F.thunder}</b> \u2014 a full 3-high stack of one premium fuses into a giant symbol with a multiplier.<br>
      <b>${F.wheel}</b> \u2014 every ${symbolName('O')} grows one of five prizes; filling the ${F.meter} spins for one.<br>
      <b>${F.hold}</b> \u2014 coins lock, three respins, and every new coin resets the count.<br>
      <b>Free spins</b> \u2014 a wilder reel set, capped at 30 spins per round.<br>
      <b>Arcade</b> \u2014 three short games on the rail, each paying up to ${ARCADE.capBets}\u00d7 your bet.</p>

    <h3>What we will not do</h3>
    <p class="note">No near-miss engineering, no losses dressed as wins, no teasing reel stops, and nothing
      purchasable. The full odds are on the <b>Odds</b> tab, generated from the same numbers the game runs on.</p>

    </div></div>`;
}

function showTutorial() {
  showModal(tutorialHtml());
  $('#tut-ok').onclick = () => { audio.start(); audio.click(); hideModal(); state.seenTutorial = true; scheduleSave(); };
  // The four steps ARE the tutorial. The paytable and feature list are reference, not
  // onboarding — handing someone ten paytable rows before their first spin is how a good
  // explanation gets skipped along with everything after it.
  $('#tut-more').onclick = (e) => {
    audio.click();
    const d = $('#tut-detail');
    d.hidden = !d.hidden;
    e.currentTarget.textContent = d.hidden ? 'Paytable and features' : 'Hide the details';
    if (!d.hidden) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#tut-odds').onclick = () => {
    audio.start(); audio.click(); hideModal(); state.seenTutorial = true;
    pane = 'rates';
    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x.dataset.pane === 'rates');
    renderPane(true); scheduleSave();
  };
}

// Re-entrancy guard. startArcade awaits a runner that owns the modal and pays out
// on resolve; a second entry would start a second runner against the same host and
// grant twice from one cooldown. The veil makes that hard to click, not impossible —
// keyboard activation and a double-fire on a slow frame both reach it.
let arcadeBusy = false;

async function startArcade(id) {
  if (arcadeBusy) { audio.deny(); return; }
  const g = ARCADE.games.find((x) => x.id === id);
  if (!g || !canPlay(state, id, now())) { audio.deny(); return; }
  const run = RUNNERS[id];
  if (!run) return;
  arcadeBusy = true;
  interrupt(null);
  showModal(`<div class="hd"><h2>${g.name}</h2></div><div class="bd" id="mg-host"></div>`);
  const host = $('#mg-host');
  const owned = state.owned.map((x) => SPECIES_BY_ID.get(x)).filter(Boolean);
  let res = null;
  try {
    res = await run(host, { seconds: g.seconds, theme: state.theme, audio, species: owned });
  } catch (err) {
    console.error('[arcade]', err);
  } finally {
    arcadeBusy = false;
  }
  if (!res) { hideModal(); return; }
  const grant = grantArcade(state, id, res.score01, now());
  dirty = true;
  audio.win(res.score01 >= 0.85 ? 4 : res.score01 >= 0.55 ? 3 : res.score01 >= 0.25 ? 2 : 1);
  fx?.rain(30 + Math.round(res.score01 * 70), 285);
  grove?.event(res.score01 >= 0.7 ? 'bigwin' : 'win');
  host.innerHTML = `<div class="reveal">
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)">${g.name}</div>
    <div style="font-size:30px;font-weight:800;color:var(--fac)">+${fmt(grant ? grant.facets : 0)}</div>
    <p class="note">${res.detail} \u00b7 ${Math.round(res.score01 * 100)}% \u00b7 rests for ${Math.round(ARCADE.cooldownMs / 60000)} min</p>
    <button class="tbtn" id="mg-ok" style="margin-top:14px;padding:9px 22px">Collect</button></div>`;
  awardCheck();
  $('#mg-ok').onclick = () => { audio.click(); hideModal(); render(); scheduleSave(); };
  render(); scheduleSave();
}

function bumpStake(dir) {
  // The bet is deducted at spin start and the explainer reads state.stake at settle
  // time, so changing it mid-spin makes the card describe a bet that was never placed.
  if (busy) { audio.deny(); return; }
  const avail = unlockedStakes(state.owned.length);
  const i = avail.indexOf(state.stake);
  const j = Math.max(0, Math.min(avail.length - 1, (i < 0 ? 0 : i) + dir));
  if (avail[j] === state.stake) { audio.deny(); return; }
  state.stake = avail[j];
  audio.click(); render(); scheduleSave();
}

function wire() {
  $('#spin').onclick = () => { audio.start(); spin(); };
  $('#stake-up').onclick = () => { audio.start(); bumpStake(1); };
  $('#stake-down').onclick = () => { audio.start(); bumpStake(-1); };
  $('#btn-max').onclick = () => {
    audio.start();
    if (busy) { audio.deny(); return; }
    const avail = unlockedStakes(state.owned.length);
    state.stake = avail[avail.length - 1];
    audio.click(); render(); scheduleSave();
  };
  $('#btn-auto').onclick = (e) => {
    audio.start(); auto = !auto; e.target.classList.toggle('on', auto);
    if (auto && !busy) spin();
  };
  $('#btn-turbo').onclick = () => {
    audio.start();
    const t = turboState(state, now());
    if (t.resting) { audio.deny(); toast(`Turbo is resting — ${Math.ceil(t.restMs / 1000)}s left`); return; }
    if (t.left <= 0) { audio.deny(); return; }
    turbo = !turbo; audio.click(); paintTurbo();
  };
  $('#btn-sfx').onclick = (e) => { audio.start(); sfxOn = !sfxOn; audio.setMuted(!sfxOn); e.target.classList.toggle('on', sfxOn); };
  // One button cycles Ambient -> Pop -> Rock -> Off. Three styles was the ask;
  // folding the mute into the same control keeps it to one button.
  $('#btn-music').onclick = (e) => {
    audio.start();
    const order = [...MUSIC_STYLES, 'off'];
    const i = order.indexOf(musicMode);
    musicMode = order[(i + 1) % order.length];
    applyMusicMode();
    state.musicStyle = musicMode;
    scheduleSave();
  };

  // SHAKE. It does nothing. It is documented as doing nothing, on the odds page,
  // in the tooltip and here. A superstition button that secretly nudged the
  // outcome would be the single most dishonest thing in this codebase; one that
  // visibly does nothing and says so is just a joke you are in on.
  $('#btn-shake').onclick = () => {
    audio.start();
    state.stats.shakes = (state.stats.shakes || 0) + 1;
    dirty = true;
    const m = document.querySelector('.machine');
    m.classList.remove('shaking'); void m.offsetWidth; m.classList.add('shaking');
    setTimeout(() => m.classList.remove('shaking'), 520);
    audio.shake();
    const box = $('#fx').getBoundingClientRect();
    for (let i = 0; i < 14; i++) fx?.sparks(Math.random() * box.width, Math.random() * box.height, 46, 4);
    if (state.stats.shakes % 25 === 0) toast(`${state.stats.shakes} shakes. Still no effect on the reels.`);
    awardCheck(); scheduleSave();
  };

  $('#btn-yard').onclick = () => { audio.start(); audio.click(); yardOpen ? closeYard() : openYard(); };

  $('#btn-help').onclick = () => { audio.start(); audio.click(); showTutorial(); };

  $('#btn-arcade').onclick = () => {
    audio.start(); audio.click();
    if (yardOpen) closeYard();
    pane = 'arcade';
    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x.dataset.pane === 'arcade');
    renderPane(true);
    $('#pane')?.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  $('#pg-stage').onclick = (e) => {
    audio.start();
    const a = grove?.hitTest(e.clientX, e.clientY);
    if (a) { audio.click(); grove.say(a, 'idle', grove.actors.find((x) => x !== a) || null); }
  };
  $('#grove-shuffle').onclick = () => { audio.start(); audio.click(); refreshGrove(true); };

  $('#btn-theme').onclick = () => {
    audio.start();
    // A reskin mid-spin repaints the grid under the reel-stop loop, which then writes
    // the old theme's symbols back over it one reel at a time.
    if (busy) { audio.deny(); return; }
    audio.click();
    state.theme = nextTheme(state.theme);
    applyTheme(); render(); scheduleSave();
    toast(`${themeOf(state.theme).name} mode — ${themeOf(state.theme).tagline}`);
  };

  // NOTE: #hclear is NOT wired here. It lives inside the history pane, which is
  // built by renderPane() long after wire() runs, so a boot-time $('#hclear') is
  // null and throws — silently killing every handler wired after it. It is wired
  // in renderPane's history branch instead.

  $('#tabs').onclick = (e) => {
    const t = e.target.closest('.tab'); if (!t) return;
    audio.start(); audio.click();
    pane = t.dataset.pane;
    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === t);
    renderPane(true);
  };

  $('#pane').onclick = (e) => {
    audio.start();
    if (e.target.closest('#draw-go')) { runGacha(); return; }
    const play = e.target.closest('[data-play]');
    if (play) { startArcade(play.dataset.play); return; }
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      const id = buy.dataset.buy;
      const snap = snapshot(state);
      const g = snap.generators.find((x) => x.id === id);
      const n = buy.dataset.n === 'max' ? Math.max(1, g?.max ?? 1) : 1;
      if (buyGenerator(state, id, n)) { dirty = true; audio.buy(); render(); scheduleSave(); }
      else audio.deny();
      return;
    }
    const cell = e.target.closest('[data-sp]');
    if (cell) {
      const sp = SPECIES_BY_ID.get(Number(cell.dataset.sp));
      if (!sp) return;
      const ownedIt = state.owned.includes(sp.id);
      const ts = tierState(state, sp.tier);
      if (ownedIt) {
        audio.click();
        showModal(`<div class="reveal">
          <div class="art">${renderCritter(sp, { size: 210, animate: true })}</div>
          <div class="nm">${sp.name}</div><div class="set">${sp.set}</div>
          <div class="tier" style="color:${TIER_COLOR[sp.tier]}">${TIERS[sp.tier - 1].name} · ${sp.mood}</div>
          <div class="tag">"${sp.tag}"</div>
          <p class="note" style="margin-top:12px">+${fmt(TIERS[sp.tier - 1].trickle)} ${featName('currency')}/sec</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
            <button class="tbtn" id="rv-close" style="padding:9px 22px">Close</button>
            <button class="tbtn" id="rv-share2" style="padding:9px 16px">Share card</button>
          </div>
        </div>`);
        $('#rv-close').onclick = () => { audio.click(); hideModal(); };
        $('#rv-share2').onclick = (ev) => doShare('critter', {
          species: sp, tierName: TIERS[sp.tier - 1].name, colour: TIER_COLOR[sp.tier],
        }, `lumenreel-${sp.name.toLowerCase()}.png`, ev.currentTarget);
      } else if (!ts.gated) {
        const cost = ts.sparkCost;
        audio.click();
        showModal(`<div class="reveal">
          <div class="art" style="opacity:.25;filter:grayscale(1)">${renderCritter(sp, { size: 210 })}</div>
          <div class="nm">???</div><div class="set">${sp.set}</div>
          <p class="note" style="margin-top:12px">Spark this exact critter for <b>${fmt(cost)}</b> ${featName('payout')} —
          ${SPARK_MULTIPLIER}× the draw price. This is the most it can ever cost you.</p>
          <button class="tbtn" id="sp-go" style="margin-top:14px;padding:9px 22px" ${state.facets < cost ? 'disabled' : ''}>
            ${state.facets < cost ? `Need ${fmt(cost - state.facets)} more` : `Spark · ${fmt(cost)}`}</button>
          <button class="tbtn" id="sp-close" style="margin-top:14px;padding:9px 16px">Not yet</button>
        </div>`);
        $('#sp-close').onclick = () => { audio.click(); hideModal(); };
        const go = $('#sp-go');
        if (go) go.onclick = () => {
          const r = sparkCritter(state, sp.id);
          if (r) {
            dirty = true; revealCritter(r.species, `Sparked for ${fmt(r.cost)} ${featName('payout')}`);
            awardCheck(); render(); refreshGrove(true); grove?.event('unlock', state.owned.length); scheduleSave();
          }
          else audio.deny();
        };
      } else {
        toast(`${TIERS[sp.tier - 1].name} unlocks at ${TIERS[sp.tier - 1].gateOwned} critters owned`);
      }
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); audio.start(); if (!busy) spin(); }
    if (e.key === 'a') $('#btn-auto').click();
    if (e.key === 't') $('#btn-turbo').click();
    if (e.key === 'm') $('#btn-sfx').click();
    if (e.key === 'Escape') { if (yardOpen) closeYard(); else hideModal(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flush(); store.releaseLease(); }
    else store.acquireLease(now(), { force: true });
  });
  globalThis.addEventListener('beforeunload', flush);
}

// ---------------------------------------------------------------------------
let saveTimer = null;
function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}
function flush() {
  if (!dirty) return;
  dirty = false;
  store.save(JSON.parse(JSON.stringify(state)));
}

// The tick. lastTickMs is advanced inside engine.tick BEFORE anything else, and
// persisted right after, so a second open surface cannot re-grant the same window.
function startLoop() {
  let lastRender = 0;
  setInterval(() => {
    if (!store.hasLease) return;
    const t = now();
    refreshTurbo(state, t);
    paintTurbo();
    const r = tick(state, t);
    if (r.granted > 0) dirty = true;
    if (r.rewound) toast(`Clock moved backwards — no ${featName('currency')} granted for that gap.`);
    if (t - lastRender > 240) { lastRender = t; render(); }
  }, ACCRUAL.tickMs);
  setInterval(flush, 5000);
}

// ---------------------------------------------------------------------------
async function boot() {
  document.getElementById('symdefs').innerHTML = symbolDefs();
  // Boot showing a REAL reel face, not a placeholder. It is display-only: nothing
  // is staked and nothing is paid, it just means the machine never looks fake.
  grid = spinGrid(rand, BASE_STRIPS).grid;
  buildReels();
  fx = new Particles(document.getElementById('fx'));
  fx.start();
  grove = new Playground(document.getElementById('pg-stage'), { onLine: pushTicker });
  grove.start();
  wire();

  const raw = await store.load();
  state = sanitize(raw);

  const t = now();
  if (state.lastTickMs === null) {
    tick(state, t);                       // first ever launch: anchor, grant nothing
  } else {
    const away = t - state.lastTickMs;
    const r = tick(state, t, true);       // offline path — same code, reduced rate
    if (r.granted > 0 && away > 60000) {
      const hrs = Math.min(ACCRUAL.offlineCapHours, away / 3600000);
      toast(`Welcome back — ${fmt(r.granted)} ${featName('currency')} from ${hrs < 1 ? Math.round(hrs * 60) + ' min' : hrs.toFixed(1) + ' h'} away`, 5200);
    }
  }
  musicMode = state.musicStyle || 'ambient';
  applyMusicMode();
  applyTheme();

  await store.acquireLease(t, { force: true });
  store.startLeaseLoop(now);
  flush();

  refreshGrove(true);
  render();
  startLoop();
  // First launch: explain the game before the player stares at it.
  if (!state.seenTutorial) setTimeout(showTutorial, 500);
  if (state.owned.length) setTimeout(() => grove.event('offline'), 1400);
  console.log(`[Lumenreel] v${VERSION} booted · storage ${store.mode} · ${SPECIES.length} species · ${Object.keys(SYMBOLS).length} symbols · ${LINES} lines`);
}

boot();

// ---------------------------------------------------------------------------
// Test hook for the real-Chromium suite (sim/browser_test.cjs). Deliberately
// read/write: the suite has to seed a mid-game save to exercise late-game paths,
// and jsdom-green is not browser-green — this build is verified in Chromium or
// it is not verified. It exposes nothing a player could not reach by editing
// their own local save, and there is no server, score board or economy to cheat.
globalThis.__LUMENREEL__ = {
  get state() { return state; },
  seed(patch) { state = sanitize({ ...state, ...patch }); render(); },
  render, spin, pushTicker,
  get fx() { return fx; },
  get busy() { return busy; },
  audio, store, VERSION,
};
