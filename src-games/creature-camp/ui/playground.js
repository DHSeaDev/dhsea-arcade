// Full-screen playground: the camp stage fills the tab and the player picks a TOOL
// (hand, snack, ball, soap, cloth) and uses it on a friend. Tap tools act on a click
// or on Enter/Space with a friend focused; soap and cloth act on a SCRUB (pointer
// drag across the friend, one use per ~160 px) or once per Enter/Space.
// Every use goes through lib/engine.js care(): snacks are on a per-friend timer and
// goal credit is rate-limited there, so a fast scrub or an auto-clicker earns nothing extra.

import { $, $$, h, announce } from './dom.js';
import { el, path, circ, ell } from '../art/kit.js';
import { real } from './games.js';
import * as E from '../lib/engine.js';

export const SCRUB_PX = 160;
export const TOOLS = Object.freeze([
  { id: 'pet', kind: 'pet', label: 'Hand', mode: 'tap', fx: 'heart', hint: 'Tap a friend to pet it.' },
  { id: 'snack', kind: 'feed', label: 'Snack', mode: 'tap', fx: 'crumb', hint: 'Tap a friend to share a snack from the bowl. Snacks are won in the games.' },
  { id: 'ball', kind: 'play', label: 'Ball', mode: 'tap', fx: 'spark', hint: 'Tap a friend to toss the ball.' },
  { id: 'soap', kind: 'wash', label: 'Soap', mode: 'scrub', fx: 'bubble', hint: 'Hold and scrub across a friend to lather it up.' },
  { id: 'cloth', kind: 'dry', label: 'Cloth', mode: 'scrub', fx: 'spark', hint: 'Hold and rub a sudsy friend to dry it off.' },
]);
const BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

const ico = (kids) => el('svg', { viewBox: '0 0 40 40', class: 'tool-ico', 'aria-hidden': 'true', focusable: 'false' }, kids);
const ICONS = {
  pet: () => ico([
    path('M12,34 C8,28 8,20 10,16 L10,10 C10,8 13,8 13,10 L13,17 L14,7 C14,5 17,5 17,7 L17,17 L18,6 C18,4 21,4 21,6 L21,17 L22,8 C22,6 25,6 25,8 L25,20 L28,15 C29,13 32,14 31,16 L27,27 C25,32 22,34 18,34 Z', { fill: '#f2cfae', stroke: '#6b4424', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
  ]),
  snack: () => ico([
    circ(15, 25, 7, { fill: '#b8323a', stroke: '#5c1418', 'stroke-width': 1.4 }),
    circ(25, 25, 7, { fill: '#c9434a', stroke: '#5c1418', 'stroke-width': 1.4 }),
    circ(13, 23, 1.6, { fill: '#ffd9d9' }), circ(23, 23, 1.6, { fill: '#ffd9d9' }),
    path('M20,18 C18,11 13,9 10,9 C13,13 16,16 20,18 C22,12 27,9 31,10', { fill: '#6fae4c', stroke: '#35602a', 'stroke-width': 1.3 }),
  ]),
  ball: () => ico([
    circ(20, 21, 13, { fill: '#f3c77a', stroke: '#6b4424', 'stroke-width': 1.6 }),
    path('M8,17 C15,22 25,22 32,17', { fill: 'none', stroke: '#d8483c', 'stroke-width': 3 }),
    path('M9,26 C16,30 25,30 31,26', { fill: 'none', stroke: '#3a6e9a', 'stroke-width': 3 }),
  ]),
  soap: () => ico([
    path('M7,20 C7,16 9,15 13,15 L29,15 C32,15 34,17 34,20 L34,27 C34,30 32,31 29,31 L12,31 C9,31 7,30 7,27 Z', { fill: '#9fd3e6', stroke: '#2f5a78', 'stroke-width': 1.6 }),
    path('M11,20 L24,20', { stroke: '#e8f6fa', 'stroke-width': 2, 'stroke-linecap': 'round' }),
    circ(12, 10, 3.2, { fill: '#fff', stroke: '#7cc3e0', 'stroke-width': 1 }), circ(20, 7, 2.2, { fill: '#fff', stroke: '#7cc3e0', 'stroke-width': 1 }), circ(27, 10, 2.8, { fill: '#fff', stroke: '#7cc3e0', 'stroke-width': 1 }),
  ]),
  cloth: () => ico([
    path('M6,12 C11,9 15,15 20,12 C25,9 29,15 34,12 L34,30 C29,33 25,27 20,30 C15,33 11,27 6,30 Z', { fill: '#e6a0b8', stroke: '#7a3550', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
    path('M10,18 C14,16 16,20 20,18 M20,24 C24,22 26,26 30,24', { fill: 'none', stroke: '#fff4f8', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    ell(20, 21, 2, 2, { fill: '#7a3550', opacity: 0.25 }),
  ]),
};
export const toolIcon = (id) => (ICONS[id] || ICONS.pet)();

const mins = (ms) => Math.max(1, Math.ceil(ms / 60_000));
/** Player-facing snack line (no countdown wording; an approximate "about N min"). */
export function snackText(name, st) {
  if (!st) return '';
  if (st.snackReadyInMs > 0) return `${name} had a snack not long ago. Another snack in about ${mins(st.snackReadyInMs)} min.`;
  if (st.full) return `${name} is full right now.`;
  return `${name} would enjoy a snack.`;
}

export function mountPlayground(env) {
  const stage = $('#stage');
  const fx = $('#fx');
  const cursor = $('#pg-cursor');
  const dock = $('#pg-dock');
  const info = $('#pg-info');
  let tool = TOOLS[0];

  // ---- dock: a radio group (arrow keys move, 1-5 pick from anywhere)
  dock.replaceChildren(...TOOLS.map((t, i) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'tool', dataset: { tool: t.id }, 'aria-checked': String(i === 0), tabindex: i === 0 ? '0' : '-1', title: `${t.label} (key ${i + 1})` });
    b.innerHTML = toolIcon(t.id);
    b.append(h('span', { class: 'tool-label' }, t.label), h('kbd', { 'aria-hidden': 'true' }, String(i + 1)));
    if (t.id === 'snack') b.append(h('span', { class: 'tool-count', id: 'tool-snacks' }, ''));
    b.addEventListener('click', real(() => pick(t.id, true)));
    return b;
  }));
  const pick = (id, focus = false) => {
    tool = BY_ID[id] || TOOLS[0];
    for (const b of $$('[data-tool]', dock)) {
      const on = b.dataset.tool === tool.id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    stage.dataset.activeTool = tool.id;
    cursor.innerHTML = toolIcon(tool.id);
    render();
    announce(`${tool.label} selected. ${tool.hint}`);
  };
  dock.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = TOOLS.indexOf(tool);
    pick(TOOLS[(i + d + TOOLS.length) % TOOLS.length].id, true);
  });
  document.addEventListener('keydown', real((e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= TOOLS.length) { e.preventDefault(); pick(TOOLS[n - 1].id); }
  }));

  // the ball lives in the same layer as the particles, so it is declared before them
  // The ball is POSITIONED by its own transform and must never also be rotated: an individual
  // `rotate` on the same element composes with that translate instead of spinning in place,
  // and the ball orbits the stage. Measured on the live build: with `.rolling` the ball's
  // on-screen position swung 1023px horizontally and 1027px vertically; with the class
  // removed it held perfectly still (0px), and re-adding it brought the swing straight back.
  // The spin now lives on an inner skin, which carries no positioning of its own.
  const ballEl = h('span', { class: 'fx-ball', 'aria-hidden': 'true', hidden: true });
  const ballSkin = h('span', { class: 'fx-ball-skin', 'aria-hidden': 'true' });
  ballEl.append(ballSkin);

  // ---- particles
  const spawn = (x, y, type, n = 4) => {
    const reduced = env.reduced();
    for (let i = 0; i < (reduced ? 1 : n); i++) {
      // the cap evicts PARTICLES only — the ball lives in this layer too, and evicting it
      // made a thrown ball vanish mid-chase during a busy moment (found by the ball probe)
      while (fx.childElementCount >= 41) {
        const doomed = [...fx.children].find((c) => c !== ballEl);
        if (!doomed) break;
        doomed.remove();
      }
      const p = h('span', { class: `fx-p fx-${type}`, 'aria-hidden': 'true' });
      p.style.transform = `translate(${(x + (Math.random() - 0.5) * 30).toFixed(0)}px, ${(y + (Math.random() - 0.5) * 20).toFixed(0)}px)`;
      p.style.setProperty('--dx', `${((Math.random() - 0.5) * 50).toFixed(0)}px`);
      p.style.setProperty('--dy', `${(-20 - Math.random() * 40).toFixed(0)}px`);
      fx.append(p);
      setTimeout(() => p.remove(), reduced ? 500 : 950);
    }
  };
  const spotOf = (key) => {
    const m = env.motion.get(key);
    return m ? [m.px ?? m.x * env.stageBox.w, (m.py ?? m.y * env.stageBox.h) - env.stageBox.w * 0.09] : [env.stageBox.w / 2, env.stageBox.h / 2];
  };
  const apply = (key, at) => {
    if (env.readOnly) return;
    const r = env.care(key, tool.kind);
    const [x, y] = at || spotOf(key);
    if (r.ok) {
      env.react?.(key, tool.kind);                 // the friend itself reacts, not just the particles
      spawn(x, y, tool.fx, tool.mode === 'scrub' ? 3 : 5);
      if (tool.kind === 'play') throwBall(key);
      if (tool.kind === 'dry') droplets(key);
    }
    render();
  };

  // ---- the ball: thrown, chased, and brought back -----------------------------
  // The chase drives the camp's own motion map, so the friend walks at its own speed and
  // the wander loop keeps drawing it. Nothing waits on the chase: it cleans itself up, and
  // a friend interrupted mid-chase simply goes back to wandering.
  let chase = null;
  fx.append(ballEl);
  function throwBall(key) {
    const m = env.motion.get(key);
    if (!m || env.reduced()) return;
    if (chase) endChase();
    const home = { x: m.x, y: m.y };
    const dir = m.x > 0.5 ? -1 : 1;
    const bx = Math.min(0.9, Math.max(0.1, m.x + dir * (0.22 + Math.random() * 0.18)));
    const by = Math.min(0.94, Math.max(0.68, m.y + (Math.random() - 0.5) * 0.12));
    chase = { key, home, bx, by, phase: 'out', t: performance.now() };
    m.hold = false; m.tx = bx; m.ty = by; m.wait = 0;
    ballEl.hidden = false;
    ballSkin.classList.add('rolling');
    ballEl.style.transform = `translate(${(bx * env.stageBox.w).toFixed(0)}px, ${(by * env.stageBox.h).toFixed(0)}px)`;
  }
  function endChase() {
    ballEl.hidden = true;
    ballSkin.classList.remove('rolling');
    ballEl.classList.remove('carried');
    chase = null;
  }
  setInterval(() => {
    if (!chase) return;
    const m = env.motion.get(chase.key);
    if (!m || document.hidden) { endChase(); return; }
    if (chase.phase === 'out' && Math.hypot(m.x - chase.bx, m.y - chase.by) < 0.06) {
      chase.phase = 'back';
      chase.t = performance.now();
      ballEl.classList.add('carried');
      m.tx = chase.home.x; m.ty = chase.home.y; m.wait = 0;
      const [sx, sy] = spotOf(chase.key);
      spawn(sx, sy, 'spark', 3);
    }
    if (chase.phase === 'back') {
      ballEl.style.transform = `translate(${(m.px ?? m.x * env.stageBox.w).toFixed(0)}px, ${((m.py ?? m.y * env.stageBox.h) - 10).toFixed(0)}px)`;
      if (Math.hypot(m.x - chase.home.x, m.y - chase.home.y) < 0.05) {
        const [sx, sy] = spotOf(chase.key);
        spawn(sx, sy, 'spark', 4);
        endChase();
        return;                                               // chase is null now: nothing left to read
      }
    }
    if (chase && performance.now() - chase.t > 12_000) endChase();   // never leave a ball on the grass
  }, 140);

  /** Water flying off a friend that shakes itself dry. */
  function droplets(key) {
    const [x, y] = spotOf(key);
    for (let i = 0; i < (env.reduced() ? 1 : 7); i++) spawn(x, y + 6, 'drop', 1);
  }

  // ---- tap tools (and keyboard use of every tool)
  // Keyboard and tap-tool route. A mouse press with a SCRUB tool never arrives here at all:
  // the stage's pointerdown calls preventDefault(), which suppresses the compatibility click,
  // so the tap fallback for those lives in endScrub() below.
  const useOn = (key) => { apply(key); };

  // ---- scrub tools
  let scrub = null;
  const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  stage.addEventListener('pointerdown', real((e) => {
    if (tool.mode !== 'scrub' || env.readOnly || e.button !== 0) return;
    const actor = e.target.closest?.('.actor');
    if (!actor) return;
    const key = actor.dataset.key;
    env.select(key);
    const m = env.motion.get(key);
    if (m) m.hold = true;
    scrub = { key, id: e.pointerId, last: local(e), dist: 0, target: actor, applied: false };
    try { stage.setPointerCapture(e.pointerId); } catch { /* capture is a nicety */ }
    e.preventDefault();
  }));
  stage.addEventListener('pointermove', real((e) => {
    const [x, y] = local(e);
    if (e.pointerType !== 'touch') { cursor.hidden = false; cursor.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`; }
    if (!scrub || e.pointerId !== scrub.id) return;
    // only movement over the friend being scrubbed counts
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.actor');
    const d = Math.hypot(x - scrub.last[0], y - scrub.last[1]);
    scrub.last = [x, y];
    if (under !== scrub.target) return;
    scrub.dist += Math.min(d, 60);          // a teleporting pointer cannot fake a long scrub
    if (tool.fx === 'bubble' && Math.random() < 0.3) spawn(x, y, 'bubble', 1);
    if (scrub.dist >= SCRUB_PX) { scrub.dist -= SCRUB_PX; scrub.applied = true; apply(scrub.key, [x, y]); }
  }));
  const endScrub = (e) => {
    // pointer capture keeps the pointer "inside" the stage, so pointerleave alone never
    // fired and the tool cursor stayed painted after the player let go (stress shard)
    cursor.hidden = true;
    if (!scrub || (e && e.pointerId !== scrub.id)) return;
    // A press that never travelled far enough is a TAP. It used to do nothing whatsoever:
    // pointerdown calls preventDefault(), which suppresses the click that would have reached
    // useOn(), so clicking a friend with Soap or Cloth produced no lather, no bubbles and no
    // feedback of any kind — while the same tool worked by keyboard and by dragging. One tap
    // is now the smallest unit of a scrub; holding and scrubbing still lathers faster.
    if (!scrub.applied) apply(scrub.key, scrub.last);
    const m = env.motion.get(scrub.key);
    if (m) m.hold = false;
    scrub = null;
  };
  stage.addEventListener('pointerup', endScrub);
  stage.addEventListener('pointercancel', endScrub);
  // a capture revoked by the browser must still release the friend it was holding still
  stage.addEventListener('lostpointercapture', endScrub);
  stage.addEventListener('pointerleave', () => { cursor.hidden = true; });

  // sudsy friends shed a bubble now and then
  setInterval(() => {
    if (document.hidden || env.reduced()) return;
    const t = env.now();
    for (const c of env.state.creatures) if (E.careStatus(env.state, c.key, t)?.suds) { const [x, y] = spotOf(c.key); spawn(x, y, 'bubble', 1); }
  }, 900);

  // ---- bar: full screen + close
  const full = $('#pg-full');
  const syncFull = () => { full.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; };
  full.addEventListener('click', real(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { announce('Full screen is not available here. The playground still fills this tab.'); }
    syncFull();
  }));
  document.addEventListener('fullscreenchange', syncFull);
  syncFull();
  const inWindow = document.body.classList.contains('full');
  if (inWindow) $('#pg-close').textContent = 'Back to camp';
  $('#pg-close').addEventListener('click', real(() => {
    if (document.body.classList.contains('full')) { document.getElementById('tab-camp')?.click(); return; }
    window.close();
    setTimeout(() => { announce('You can close this tab now. Your camp is saved.'); $('#pg-close').textContent = 'Close this tab to return'; }, 300);
  }));

  // ---- info card
  let infoSig = '';
  function render() {
    const s = env.state;
    if (!s) return;
    const c = s.creatures.find((x) => x.key === env.selected) || s.creatures[0];
    const st = E.careStatus(s, c.key, env.now());
    const pct = (v) => `${Math.round(v)}%`;
    const bowl = $('#tool-snacks');
    if (bowl) {
      bowl.textContent = String(s.snacks);
      bowl.classList.toggle('empty', s.snacks === 0);
      $('[data-tool="snack"]').title = s.snacks ? `Snack (key 2) — ${s.snacks} in the bowl` : 'Snack (key 2) — bowl empty, win a round in Games';
    }
    const lines = [
      `${c.name}: happiness ${pct(c.stats.happiness)}, fullness ${pct(c.stats.hunger)}, clean ${pct(c.stats.clean)}${st?.suds ? ', sudsy' : ''}${st?.content ? ', content' : ''}.`,
      s.snacks === 0 ? 'The snack bowl is empty — win a round in Games to fill it.' : `Snack bowl: ${s.snacks}. ${snackText(c.name, st)}`,
      `${tool.label}: ${tool.hint}`,
    ];
    const sig = lines.join('|');
    if (sig === infoSig) return;
    infoSig = sig;
    info.replaceChildren(h('strong', {}, c.name), ...lines.map((l, i) => h('p', { class: i === 2 ? 'muted' : '' }, i === 0 ? l.slice(c.name.length + 2) : l)));
  }

  // read-only test hook: the browser suite asserts the ball is chased AND brought back
  Object.defineProperty(globalThis, '__pg', { configurable: true, value: Object.freeze({ get chase() { return chase ? { ...chase } : null; } }) });

  pick(TOOLS[0].id);
  return { render, useOn, release: () => { endScrub(); }, pick };
}
