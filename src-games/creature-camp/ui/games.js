// The five camp games. Every reward is a FIXED threshold on a skill score — no
// round ever rolls for a prize. Layouts may vary (seeded), outcomes never do.
// Every game is keyboard-playable and has a Gentle mode (slower, wider targets).
// No round has a countdown: nothing here pressures the player with a clock.
//
// Anti-cheat (round 2): every handler ignores synthetic events (isTrusted === false),
// every finished round carries a receipt { elapsedMs, units } that lib/engine.js
// checks for plausibility, and seeds include a per-session nonce so a layout cannot
// be computed from the save.

import { h, $, art, announce } from './dom.js';
import { el, path, circ, ell } from '../art/kit.js';
import { mulberry32 } from '../vendor/rng.js';
import { renderCreature } from '../art/creature.js';
import { sfx } from './audio.js';

export const GAME_INFO = {
  firefly: { title: 'Firefly Lantern', goal: 'Catch all 12 fireflies to fill the lantern.', how: 'Click or press Enter on a firefly. There is no timer.' },
  pondskip: { title: 'Pond Skip', goal: 'Skip a stone 5 times in one throw.', how: 'Five throws a round. Press Throw (or Space) when the marker is inside the green zone.' },
  birdsong: { title: 'Birdsong Echo', goal: 'Echo a 6-note song.', how: 'Listen, then repeat the birds in order. Keys 1 to 4 work too.' },
  acorn: { title: 'Acorn Stack', goal: 'Stack 10 acorns.', how: 'Press Drop (or Space) when the moving acorn is over the stack.' },
  trail: { title: 'Trail Memory', goal: 'Clear the large board.', how: 'Turn over two tiles at a time and find matching pairs.' },
};

// ---------- pure scoring (unit-tested) ----------
/** Pond Skip: marker position 0..1, zone centre 0.5. Returns skips 0..8. */
export function pondSkips(pos, gentle) {
  const half = gentle ? 0.16 : 0.09;
  const err = Math.abs(pos - 0.5);
  if (err <= half) return 8 - Math.round((err / half) * 3);          // 5..8 inside the zone
  return Math.max(0, 4 - Math.round(((err - half) / (0.5 - half)) * 4)); // 0..4 outside
}
/** Acorn Stack: does a drop at offset `dx` (in acorn widths) land? */
export function acornLands(dx, gentle) { return Math.abs(dx) <= (gentle ? 0.62 : 0.45); }
export function birdSong(seed, len) {
  const r = mulberry32(seed >>> 0);
  return Array.from({ length: len }, () => Math.floor(r() * 4));
}
export function trailDeck(seed, pairs, keys) {
  const r = mulberry32(seed >>> 0);
  const chosen = keys.slice(0, pairs);
  const deck = [...chosen, ...chosen];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

// ---------- woodland tokens (Trail Memory padding; never a creature spoiler) ----------
const tok = (kids) => el('svg', { viewBox: '0 0 40 40', class: 'token', 'aria-hidden': 'true' }, kids);
const TOKENS = {
  acorn: () => tok([ell(20, 24, 9, 11, { fill: '#c98a4a', stroke: '#5e3b22', 'stroke-width': 1.4 }), path('M10,18 Q20,6 30,18 Z', { fill: '#6b4424', stroke: '#3e2614', 'stroke-width': 1.2 }), path('M20,9 L21,5', { stroke: '#3e2614', 'stroke-width': 1.6 })]),
  leaf: () => tok([path('M8,32 C8,14 20,6 34,6 C34,22 26,32 8,32 Z', { fill: '#6fae4c', stroke: '#35602a', 'stroke-width': 1.4 }), path('M8,32 L28,12', { stroke: '#35602a', 'stroke-width': 1.2 })]),
  feather: () => tok([path('M10,34 C12,20 22,8 32,6 C30,18 22,28 10,34 Z', { fill: '#e8d9c0', stroke: '#8a7458', 'stroke-width': 1.2 }), path('M10,34 L30,8', { stroke: '#8a7458', 'stroke-width': 1 })]),
  pinecone: () => tok([ell(20, 21, 9, 13, { fill: '#8a5a2e', stroke: '#4a2c16', 'stroke-width': 1.4 }), path('M12,16 Q20,20 28,16 M11,22 Q20,26 29,22 M13,28 Q20,31 27,28', { fill: 'none', stroke: '#4a2c16', 'stroke-width': 1.1 })]),
  mushroom: () => tok([path('M16,34 L16,22 L24,22 L24,34 Z', { fill: '#efe2c8', stroke: '#8a7458', 'stroke-width': 1.2 }), path('M6,22 C6,10 34,10 34,22 Z', { fill: '#d8483c', stroke: '#6b1f25', 'stroke-width': 1.4 }), circ(14, 16, 2, { fill: '#fcf3e5' }), circ(24, 14, 2.4, { fill: '#fcf3e5' })]),
  berry: () => tok([circ(15, 24, 6, { fill: '#5a4aa8', stroke: '#2e2560', 'stroke-width': 1.2 }), circ(25, 24, 6, { fill: '#5a4aa8', stroke: '#2e2560', 'stroke-width': 1.2 }), path('M20,18 C18,12 14,10 12,10 M20,18 C22,12 26,10 28,10', { fill: 'none', stroke: '#35602a', 'stroke-width': 1.6 })]),
  shell: () => tok([path('M8,28 C8,12 32,12 32,28 Z', { fill: '#f0c9a8', stroke: '#9a6a4a', 'stroke-width': 1.4 }), path('M20,28 L20,15 M14,28 L16,16 M26,28 L24,16', { stroke: '#9a6a4a', 'stroke-width': 1 })]),
  lantern: () => tok([path('M14,12 L26,12 L28,32 L12,32 Z', { fill: '#3a3a3a', stroke: '#1a1a1a', 'stroke-width': 1.2 }), path('M16,15 L24,15 L25,29 L15,29 Z', { fill: '#ffe7a3' }), path('M16,12 Q20,5 24,12', { fill: 'none', stroke: '#1a1a1a', 'stroke-width': 1.4 })]),
};

// ---------- UI ----------
/** Wrap a handler so script-made events (el.click(), dispatchEvent) do nothing. */
export const real = (fn) => (e, ...rest) => { if (e && e.isTrusted === false) return undefined; return fn(e, ...rest); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const AGAIN_DELAY_MS = 600;

export function mountGame(name, host, env) {
  const info = GAME_INFO[name];
  host.replaceChildren();
  const status = h('p', { class: 'game-status', role: 'status' });
  const board = h('div', { class: 'game-board' });
  const controls = h('div', { class: 'game-controls' });
  const back = h('button', { type: 'button', class: 'btn ghost', onclick: real(() => { cleanup(); env.onExit(); }) }, 'Back to games');
  host.append(
    h('div', { class: 'game-top' }, h('h2', { tabindex: '-1', id: 'game-title' }, info.title), back),
    h('p', { class: 'muted' }, info.how),
    h('p', { class: 'goal-line' }, `Goal: ${info.goal}`),
    board, status, controls,
  );
  let stop = () => {};
  let stopped = false;
  const cleanup = () => { if (stopped) return; stopped = true; try { stop(); } catch { /* already stopped */ } env.setLive?.(false); };
  let t0 = performance.now();
  const again = h('button', { type: 'button', class: 'btn', hidden: true, onclick: real(() => { cleanup(); env.onReplay(); }) }, 'Play again');
  const receipt = (units) => ({ elapsedMs: Math.round(performance.now() - t0), units });
  /** Record a finished round, then offer a clear way on: Play again or Back. */
  const finish = (score, cleared, { end = true, units = score } = {}) => {
    const r = env.onFinish(name, score, cleared, receipt(units));
    if (r?.rejected) status.textContent = `${status.textContent} (That round went by too quickly to count.)`;
    if (!end) return r;
    cleanup();
    for (const b of controls.querySelectorAll('button')) b.hidden = true;
    for (const b of board.querySelectorAll('button')) b.disabled = true;
    // a short pause so a held or doubled key cannot skip straight past the result
    again.hidden = false; again.disabled = true;
    controls.append(again);
    host.querySelector('#game-title')?.focus();
    setTimeout(() => { if (!host.isConnected) return; again.disabled = false; again.focus(); }, AGAIN_DELAY_MS);
    return r;
  };
  const finishSilently = (score, units = score) => env.onFinish(name, score, false, receipt(units));
  const restart = () => { t0 = performance.now(); };
  const ctx = { board, status, controls, finish, finishSilently, restart, gentle: env.gentle, reduced: env.reduced, seed: env.seed, keys: env.keys, names: env.names };
  env.setLive?.(true);
  stop = GAMES[name](ctx) || (() => {});
  $('#game-title', host).focus();
  return cleanup;
}

const GAMES = {
  firefly(c) {
    const TOTAL = 12;
    let caught = 0, over = false;
    const jar = h('div', { class: 'jar', 'aria-hidden': 'true' }, h('i', { style: null }));
    const fill = jar.firstChild;
    fill.style.height = '0%';
    c.board.append(jar);
    const r = mulberry32(c.seed);
    const flies = [];
    for (let i = 0; i < TOTAL; i++) {
      const b = h('button', { type: 'button', class: `firefly${c.gentle ? ' gentle' : ''}`, 'aria-label': `Firefly ${i + 1}` });
      b.style.left = `${10 + r() * 70}%`; b.style.top = `${12 + r() * 70}%`;
      b.addEventListener('click', real(() => {
        if (over || b.classList.contains('caught')) return;
        b.classList.add('caught'); b.disabled = true;
        caught++; sfx.catch();
        fill.style.height = `${Math.round((caught / TOTAL) * 100)}%`;
        c.status.textContent = `${caught} of ${TOTAL} fireflies in the lantern.`;
        const next = flies.find((f) => !f.disabled);
        if (next && caught < TOTAL) next.focus();
        if (caught === TOTAL) {
          over = true;
          c.status.textContent = 'The lantern is full and glowing. Cleared!';
          sfx.chime();
          c.finish(caught, true, { units: caught });
        }
      }));
      flies.push(b);
      c.board.append(b);
    }
    c.status.textContent = `0 of ${TOTAL} fireflies in the lantern.`;
    const drift = c.reduced ? null : setInterval(() => {
      for (const f of flies) if (!f.disabled) { f.style.left = `${10 + r() * 70}%`; f.style.top = `${12 + r() * 70}%`; }
    }, c.gentle ? 2800 : 1400);
    c.controls.append(h('button', { type: 'button', class: 'btn ghost', onclick: real(() => {
      if (over || caught >= TOTAL) return;
      over = true;
      c.status.textContent = `You caught ${caught}. The fireflies will be here next time.`;
      c.finish(caught, false, { units: caught });
    }) }, 'Stop here'));
    return () => clearInterval(drift);
  },

  pondskip(c) {
    const THROWS = 5, COOLDOWN_MS = 700;
    const pond = h('div', { class: 'pond' });
    c.board.append(pond);
    const zoneHalf = c.gentle ? 0.16 : 0.09;
    const meter = h('div', { class: 'meter', role: 'meter', 'aria-label': 'Throw meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
      h('span', { class: 'zone' }), h('span', { class: 'needle' }));
    meter.firstChild.style.left = `${(0.5 - zoneHalf) * 100}%`;
    meter.firstChild.style.width = `${zoneHalf * 200}%`;
    const needle = meter.lastChild;
    c.board.before(meter);
    let pos = 0, dir = 1, raf = 0, last = 0, busy = false, throws = 0, best = 0, over = false, lastThrow = -Infinity;
    const speed = c.gentle ? 0.35 : 0.7;   // meter widths per second
    let inZone = false, lastAria = 0;
    const step = (t) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      pos += dir * speed * dt;
      if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
      needle.style.left = `${pos * 100}%`;
      // non-visual timing cue: a soft tone as the marker ENTERS the green zone
      const nowIn = Math.abs(pos - 0.5) <= zoneHalf;
      if (nowIn && !inZone) sfx.bird(2);
      inZone = nowIn;
      if (t - lastAria > 250) { lastAria = t; meter.setAttribute('aria-valuenow', String(Math.round(pos * 100))); meter.setAttribute('aria-valuetext', nowIn ? 'in the green zone' : 'outside the zone'); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const tally = () => `Throw ${Math.min(throws, THROWS)} of ${THROWS} · best ${best}`;
    const endRound = (why) => {
      if (over || !throws) return;
      over = true;
      c.status.textContent = `${why} Best throw: ${best} skip${best === 1 ? '' : 's'}.${best >= 5 ? ' Goal reached!' : ''}`;
      c.finish(best, false, { units: throws });
    };
    const throwIt = async () => {
      const t = performance.now();
      if (busy || over || t - lastThrow < COOLDOWN_MS) return;
      busy = true; lastThrow = t; btn.disabled = true;
      try {
        const n = pondSkips(pos, c.gentle);
        throws++; best = Math.max(best, n);
        for (const el of [...c.board.querySelectorAll('.ring, .skip-stone')]) el.remove();
        for (let i = 0; i < n; i++) {
          const x = 10 + i * 10, y = 70 - (i % 2) * 3;
          const ring = h('span', { class: 'ring' }); ring.style.left = `${x}%`; ring.style.top = `${y}%`;
          c.board.append(ring);
          sfx.skip();
          if (!c.reduced) await wait(60);
        }
        if (n === 0) sfx.splash();
        c.status.textContent = `${n === 0 ? 'Plop. The pond says hello.' : `${n} skip${n === 1 ? '' : 's'}!`} ${tally()}`;
        if (n >= 5 && best === n) announce('Five skips or more. Goal reached!');
        if (throws >= THROWS) endRound('Round over.');
        else { const left = COOLDOWN_MS - (performance.now() - lastThrow); if (left > 0) await wait(left); }
      } finally {
        busy = false; btn.disabled = over;
      }
    };
    const btn = h('button', { type: 'button', class: 'btn', onclick: real(throwIt) }, 'Throw');
    const stopBtn = h('button', { type: 'button', class: 'btn ghost', onclick: real(() => endRound('Round ended.')) }, 'End round');
    // Space throws from anywhere EXCEPT a focused control (a focused button handles Space itself)
    const key = real((e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'SUMMARY') return;
      e.preventDefault(); throwIt();
    });
    document.addEventListener('keydown', key);
    c.controls.append(btn, stopBtn);
    c.status.textContent = `Watch the marker. A soft chime plays as it enters the green zone. ${THROWS} throws this round.`;
    return () => {
      cancelAnimationFrame(raf); document.removeEventListener('keydown', key);
      if (!over && throws) { over = true; c.finishSilently(best, throws); }   // leaving mid-round keeps the throws already made
    };
  },

  birdsong(c) {
    const wrap = h('div', { class: 'birds' });
    const birdKeys = ['wren', 'pip', 'clover', 'fen'];
    const names = ['Wren note', 'Pip note', 'Clover note', 'Fen note'];
    const song = birdSong(c.seed, 20);
    // phase: 'idle' before Start | 'listen' while the song plays | 'echo' while the player answers | 'over'
    let phase = 'idle', len = 1, input = 0, best = 0, recorded = true, pending = 0;
    const queue = [];
    let draining = false;
    const holdMs = c.gentle ? 700 : 420;
    const birds = birdKeys.map((k, i) => {
      const b = h('button', { type: 'button', class: 'bird', 'aria-label': `${names[i]} (key ${i + 1})` });
      const pic = h('span', { 'aria-hidden': 'true', class: 'bird-art' });
      art(pic, renderCreature(k, { uid: `bs${i}` }));
      b.append(pic, h('span', { 'aria-hidden': 'true' }, String(i + 1)));
      b.addEventListener('click', real(() => press(i)));
      wrap.append(b);
      return b;
    });
    c.board.append(wrap);
    const record = (msg) => { if (recorded || !best) return false; recorded = true; c.status.textContent = msg; c.finish(best, false, { units: best }); return true; };
    const light = async (i, hold = holdMs) => {
      birds[i].classList.add('lit'); sfx.bird(i);
      await wait(hold);
      birds[i].classList.remove('lit');
    };
    const playSong = async () => {
      pending = 0;
      if (phase === 'over') return;
      phase = 'listen';
      c.status.textContent = `Listen… (${len} note${len === 1 ? '' : 's'})`;
      await wait(500);
      for (let i = 0; i < len; i++) {
        if (phase !== 'listen') return;          // finished or left while the song played
        await light(song[i]);
        await wait(c.gentle ? 260 : 150);
      }
      if (phase !== 'listen') return;
      input = 0; queue.length = 0; phase = 'echo';
      c.status.textContent = 'Your turn.';
      announce(`Your turn: repeat ${len} notes.`);
    };
    // Taps are QUEUED while the previous tap is still lighting up, so a quick
    // player's notes are never dropped (shard B), and are judged in order.
    const press = (i) => {
      if (phase !== 'echo') return;
      queue.push(i);
      if (!draining) drain();
    };
    const drain = async () => {
      draining = true;
      try {
        while (queue.length && phase === 'echo') {
          const i = queue.shift();
          const lit = light(i, Math.min(holdMs, 260));
          if (i !== song[input]) {
            phase = 'over'; queue.length = 0;
            if (!record(`The song was a little different. Your longest echo: ${best}.`)) {
              c.status.textContent = 'The song was a little different. Try again any time.';
              c.finish(0, false, { units: 0 });
            }
            await lit;
            return;
          }
          input++;
          if (input === len) {
            best = len; recorded = false;
            if (len >= 6 && len % 6 === 0) sfx.chime();
            len++;
            phase = 'listen'; queue.length = 0;
            await lit;
            pending = setTimeout(playSong, 450);
            return;
          }
          await lit;
        }
      } finally { draining = false; }
    };
    const key = real((e) => { const n = Number(e.key); if (!e.repeat && n >= 1 && n <= 4) { e.preventDefault(); press(n - 1); } });
    document.addEventListener('keydown', key);
    const start = h('button', { type: 'button', class: 'btn', onclick: real(() => { if (phase !== 'idle') return; start.hidden = true; c.restart(); playSong(); }) }, 'Start the song');
    const done = h('button', { type: 'button', class: 'btn ghost', onclick: real(() => {
      if (phase === 'over') return;
      phase = 'over'; clearTimeout(pending);
      if (!record(`Nicely sung. Longest echo: ${best}.`)) { c.status.textContent = 'Finished. The birds will sing again any time.'; c.finish(0, false, { units: 0 }); }
    }) }, 'Finish here');
    c.controls.append(start, done);
    c.status.textContent = 'Press Start to hear the first note.';
    // leaving mid-song still records the longest echo already sung
    return () => {
      phase = 'over'; clearTimeout(pending); queue.length = 0;
      document.removeEventListener('keydown', key);
      if (!recorded && best) { recorded = true; c.finishSilently(best, best); }
    };
  },

  acorn(c) {
    const GOAL = 10, COOLDOWN_MS = 300;
    const area = h('div', { class: 'acorn-board' });
    c.board.append(area);
    const W = 16;          // acorn width, % of board
    const H = 7;           // acorn height, % of board
    let height = 0, raf = 0, last = 0, x = 10, dir = 1, over = false, drops = 0, lastDrop = -Infinity;
    let base = 50;
    let speed = c.gentle ? 18 : 30;   // % per second
    const mover = h('span', { class: 'acorn' });
    mover.style.width = `${W}%`;
    area.append(mover);
    const place = () => {
      const a = h('span', { class: 'acorn' });
      a.style.width = `${W}%`; a.style.left = `${base}%`;
      a.style.top = `${92 - (height + 1) * H}%`;
      area.append(a);
    };
    place();
    const frame = (t) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      x += dir * speed * dt;
      if (x > 90) { x = 90; dir = -1; } else if (x < 10) { x = 10; dir = 1; }
      mover.style.left = `${x}%`;
      mover.style.top = `${Math.max(2, 92 - (Math.min(height, 10) + 3) * H)}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const drop = () => {
      const t = performance.now();
      if (over || t - lastDrop < COOLDOWN_MS) return;
      lastDrop = t;
      drops++;
      const dx = (x - base) / W;
      if (acornLands(dx, c.gentle)) {
        height++;
        base = base + (x - base) * 0.5;
        if (height <= 10) place();
        sfx.thud();
        speed *= 1.05;
        // the next acorn starts from the far edge: mashing Drop cannot stack in place (shard A/B)
        x = base < 50 ? 90 : 10; dir = x === 90 ? -1 : 1;
        c.status.textContent = `${height} acorn${height === 1 ? '' : 's'} stacked.${height >= GOAL ? ' Goal reached!' : ` Goal: ${GOAL}.`}`;
        if (height === GOAL) { sfx.chime(); announce('Ten acorns! A mighty stack. Goal reached.'); }
      } else {
        over = true;
        sfx.soft();
        c.status.textContent = `The acorn rolled away. Your stack: ${height}.${height >= GOAL ? ' Goal reached!' : ''}`;
        c.finish(height, false, { units: drops });
      }
    };
    const btn = h('button', { type: 'button', class: 'btn', onclick: real(drop) }, 'Drop');
    const keep = h('button', { type: 'button', class: 'btn ghost', onclick: real(() => { if (!over && height > 0) { over = true; c.status.textContent = `Stack kept at ${height}.${height >= GOAL ? ' Goal reached!' : ''}`; c.finish(height, false, { units: drops }); } }) }, 'Keep this stack');
    const key = real((e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'SUMMARY') return;
      e.preventDefault(); drop();
    });
    document.addEventListener('keydown', key);
    c.controls.append(btn, keep);
    c.status.textContent = `Drop the acorn onto the stack. Goal: ${GOAL}.`;
    return () => {
      cancelAnimationFrame(raf); document.removeEventListener('keydown', key);
      if (!over && height > 0) { over = true; c.finishSilently(height, drops); }
    };
  },

  trail(c) {
    c.board.classList.add('square');
    let size = 'large';
    let gen = 0;
    const faceOf = (k, i) => {
      if (k.startsWith('token:')) return { svg: TOKENS[k.slice(6)](), label: k.slice(6) };
      return { svg: renderCreature(k, { uid: `tr${i}` }), label: c.names?.[k] || k };
    };
    const build = () => {
      const my = ++gen;
      c.restart();
      c.board.replaceChildren();
      const pairs = size === 'large' ? 8 : 6;
      const pool = [...c.keys, ...Object.keys(TOKENS).map((t) => `token:${t}`)];
      const deck = trailDeck(c.seed + (size === 'large' ? 7 : 3), pairs, pool);
      const grid = h('div', { class: 'tiles', role: 'group', 'aria-label': `${size} board, ${pairs} pairs` });
      grid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
      c.board.append(grid);
      let open = [], matched = 0, busy = false, turns = 0, done = false;
      const down = (x, i) => { x.replaceChildren(h('span', { class: 'back', 'aria-hidden': 'true' })); x.setAttribute('aria-pressed', 'false'); x.setAttribute('aria-label', `Tile ${i + 1}, face down`); };
      const tiles = deck.map((k, i) => {
        const t = h('button', { type: 'button', class: 'tile' });
        down(t, i);
        t.addEventListener('click', real(async () => {
          if (done || busy || my !== gen || t.classList.contains('matched') || open.includes(t)) return;
          const f = faceOf(k, i);
          t.innerHTML = f.svg;
          t.setAttribute('aria-pressed', 'true'); t.setAttribute('aria-label', `Tile ${i + 1}, ${f.label}`);
          sfx.flip();
          open.push(t);
          if (open.length < 2) return;
          turns++;
          const [a, b] = open;
          if (deck[tiles.indexOf(a)] === deck[tiles.indexOf(b)]) {
            a.classList.add('matched'); b.classList.add('matched');
            matched++; open = [];
            c.status.textContent = `${matched} of ${pairs} pairs found.`;
            if (matched === pairs) {
              done = true;
              sfx.chime();
              c.status.textContent = `Every pair found in ${turns} turns.${size === 'large' ? ' Cleared!' : ' Try the large board next.'}`;
              c.finish(matched, size === 'large', { units: turns });
            }
          } else {
            busy = true;
            await wait(c.gentle ? 1400 : 800);
            if (my !== gen) return;
            down(a, tiles.indexOf(a)); down(b, tiles.indexOf(b));
            open = []; busy = false;
          }
        }));
        grid.append(t);
        return t;
      });
      c.status.textContent = `Find ${pairs} pairs.`;
    };
    build();
    c.controls.append(
      h('button', { type: 'button', class: 'btn ghost', onclick: real(() => { size = 'small'; build(); }) }, 'Small board (practice)'),
      h('button', { type: 'button', class: 'btn ghost', onclick: real(() => { size = 'large'; build(); }) }, 'Large board'),
    );
    return () => { gen++; };
  },
};
