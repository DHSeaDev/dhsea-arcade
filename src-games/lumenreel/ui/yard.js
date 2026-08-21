// THE PLAYGROUND — a full surface where you handle the critters instead of
// watching them. Pet, wash, poke, chat, or pick one up and put it somewhere else.
//
// The machine keeps running behind this. It is pulled back into view only when
// something genuinely worth watching happens (a massive payout or a minigame),
// which the controller decides — this file never reaches into the reels.

import { renderCritter } from '../art/critter.js';
import { speak, interact } from '../lib/chatter.js';

// The Playground is a full page, not the strip under the reels — at 76px the
// critters read as icons scattered on an empty field. 128 fills the same stage
// without crowding it at 24 actors, which is the cap.
const YD_SIZE = 128;
// Every bound below is derived from YD_SIZE. They were hardcoded for the old 76px
// actor, so raising the art size alone let critters walk off the right edge and
// spawn on top of each other — the sprite grew, the box it lives in did not.
const YD_PAD_X = YD_SIZE + 8;    // right edge: art width plus a little air
const YD_PAD_Y = YD_SIZE + 24;   // bottom edge: art plus the name label
const STEP_MS = 1000 / 60;
const POSE_HZ = 12;
const BUBBLE_MS = 5200;

export const TOOLS = [
  { id: 'move', name: 'Move',  hint: 'Pick one up and put it down somewhere else.', icon: '✥' },
  { id: 'pet',  name: 'Pet',   hint: 'They like this more than they admit.',        icon: '♥' },
  { id: 'wash', name: 'Wash',  hint: 'Dust settles on everything you own.',          icon: '≈' },
  { id: 'poke', name: 'Poke',  hint: 'Do not overdo it.',                            icon: '☞' },
];
// 'chat' was removed in v0.6.0 at Donnie's request. Nothing was lost: every remaining
// tool already routes through _say(), and the idle loop keeps them talking on its own —
// the button was a second door to a room they were already standing in.

export class Yard {
  constructor(stage, opts = {}) {
    this.stage = stage;
    this.onLine = opts.onLine || (() => {});
    this.onAct = opts.onAct || (() => {});
    this.fx = opts.fx || null;
    this.audio = opts.audio || null;
    this.tool = 'move';
    this.actors = [];
    this.running = false;
    this.acc = 0; this.last = 0; this.poseAcc = 0;
    this.drag = null;
    this.reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.w = 900; this.h = 460;
    this._bind();
  }

  _bind() {
    const down = (e) => {
      const a = this.hit(e.clientX, e.clientY);
      if (!a) return;
      e.preventDefault();
      if (this.tool === 'move') {
        const r = this.stage.getBoundingClientRect();
        this.drag = { a, dx: e.clientX - (r.left + a.x), dy: e.clientY - (r.top + a.y) };
        a.el.classList.add('held');
        a.state = 'held';
        this.audio?.click?.();
      } else {
        this.act(a, this.tool);
      }
    };
    const move = (e) => {
      if (!this.drag) return;
      const r = this.stage.getBoundingClientRect();
      const a = this.drag.a;
      a.x = Math.max(4, Math.min(this.w - YD_PAD_X, e.clientX - r.left - this.drag.dx));
      a.y = Math.max(4, Math.min(this.h - YD_PAD_Y, e.clientY - r.top - this.drag.dy));
      this._place(a);
    };
    const up = () => {
      if (!this.drag) return;
      const a = this.drag.a;
      a.el.classList.remove('held');
      a.state = 'idle'; a.hold = 700;
      a.vy = 0;
      this.drag = null;
      this.audio?.coin?.(1);
    };
    this.stage.addEventListener('pointerdown', down);
    globalThis.addEventListener('pointermove', move);
    globalThis.addEventListener('pointerup', up);
    this._teardown = () => {
      this.stage.removeEventListener('pointerdown', down);
      globalThis.removeEventListener('pointermove', move);
      globalThis.removeEventListener('pointerup', up);
    };
  }

  measure() {
    const r = this.stage.getBoundingClientRect();
    if (r.width > 60) { this.w = r.width; this.h = r.height; }
  }

  setRoster(species) {
    for (const a of this.actors) a.el.remove();
    this.actors = [];
    this.measure();
    for (const sp of species) {
      const el = document.createElement('div');
      el.className = 'yd-actor';
      el.innerHTML = `<div class="yd-bub"></div><div class="yd-fx"></div><div class="yd-art">${renderCritter(sp, { size: YD_SIZE })}</div>
        <div class="yd-name">${sp.name}</div>`;
      this.stage.appendChild(el);
      const a = {
        sp, el,
        bub: el.querySelector('.yd-bub'),
        art: el.querySelector('.yd-art'),
        spark: el.querySelector('.yd-fx'),
        x: 20 + Math.random() * Math.max(50, this.w - (YD_PAD_X + 36)),
        y: 40 + Math.random() * Math.max(40, this.h - (YD_PAD_Y + 54)),
        vx: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 18),
        vy: 0, face: 1, phase: Math.random() * 6.28,
        state: 'walk', hold: 800 + Math.random() * 2400,
        clean: 0.55 + Math.random() * 0.45, joy: 0.5,
        expr: null, exprUntil: 0, bubbleUntil: 0,
      };
      this.actors.push(a);
      this._place(a);
      this._dust(a);
    }
    this._separate();
    for (const a of this.actors) this._place(a);
    this.stage.classList.toggle('empty', this.actors.length === 0);
  }

  /**
   * Uniform random placement puts pairs on top of each other often enough to be
   * the first thing you notice at 24 actors — the birthday problem, not bad luck.
   * A few relaxation passes push overlapping pairs apart before the first paint.
   */
  _separate(passes = 14) {
    const minX = YD_SIZE * 0.78, minY = YD_SIZE * 0.62;
    for (let k = 0; k < passes; k++) {
      let moved = 0;
      for (let i = 0; i < this.actors.length; i++) {
        for (let j = i + 1; j < this.actors.length; j++) {
          const a = this.actors[i], b = this.actors[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) >= minX || Math.abs(dy) >= minY) continue;
          const push = (minX - Math.abs(dx)) / 2 + 1;
          const s = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
          a.x = Math.max(4, Math.min(this.w - YD_PAD_X, a.x - s * push));
          b.x = Math.max(4, Math.min(this.w - YD_PAD_X, b.x + s * push));
          moved++;
        }
      }
      if (!moved) break;
    }
  }

  setTool(id) { this.tool = id; this.stage.dataset.tool = id; }

  hit(cx, cy) {
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const r = this.actors[i].el.getBoundingClientRect();
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return this.actors[i];
    }
    return null;
  }

  /** Apply a tool. Every branch reports back so the controller can count it. */
  act(a, tool) {
    const others = this.actors.filter((x) => x !== a);
    const other = others.length ? others[Math.floor(Math.random() * others.length)] : null;
    if (tool === 'pet') {
      a.joy = Math.min(1, a.joy + 0.22);
      this._expr(a, a.joy > 0.8 ? 'happy' : 'calm', 2600);
      this._burst(a, '♥', '#f472b6', 6);
      this.audio?.coin?.(0);
      this._say(a, a.joy > 0.85 ? 'win' : 'idle', other);
      this.onAct('pet', a.sp);
    } else if (tool === 'wash') {
      a.clean = 1;
      this._expr(a, 'awe', 2400);
      this._burst(a, '○', '#8be9fd', 9);
      this._dust(a);
      this.audio?.droplet?.(2);
      this._say(a, 'idle', other);
      this.onAct('wash', a.sp);
    } else if (tool === 'poke') {
      a.joy = Math.max(0, a.joy - 0.08);
      this._expr(a, 'alarmed', 1800);
      this._burst(a, '!', '#fbbf24', 4);
      a.vx = (Math.random() < 0.5 ? -1 : 1) * 70;
      a.state = 'walk'; a.hold = 900;
      this.audio?.deny?.();
      this._say(a, 'alarmed', other);
      this.onAct('poke', a.sp);
    }
  }

  _say(a, event, other) {
    const text = event === '__interact' && other ? interact(a.sp, other.sp) : speak(a.sp, event === 'alarmed' ? 'idle' : event, { other: other?.sp });
    a.bub.textContent = text;
    a.bub.classList.add('on');
    this._fitBubble(a);
    a.bubbleUntil = performance.now() + BUBBLE_MS;
    this.onLine({ name: a.sp.name, tier: a.sp.tier, text });
  }

  /**
   * Keep a bubble inside the stage — same rule as the Grove strip. The Playground is
   * roomier, so this only ever bites for a critter dragged against an edge or into the
   * top strip, which is exactly where a player puts them.
   */
  _fitBubble(a) {
    const w = a.bub.offsetWidth || 0, h = a.bub.offsetHeight || 0;
    if (!h || !w) return;
    const HALF = YD_SIZE / 2, PAD = 8;
    const maxBottom = a.y - PAD - h + YD_SIZE;    // a.y is the actor's top in stage coords
    a.bub.style.bottom = `${Math.max(10, Math.min(80, maxBottom))}px`;
    const cx = a.x + HALF;
    const want = Math.max(PAD + w / 2, Math.min(cx, Math.max(PAD + w / 2, this.w - PAD - w / 2)));
    const left = HALF + (want - cx);
    a.bub.style.left = `${Math.round(left)}px`;
    a.bub.style.setProperty('--tail', `${Math.round(HALF - left + w / 2)}px`);
  }

  _expr(a, expr, ms) {
    if (a.expr === expr) { a.exprUntil = performance.now() + ms; return; }
    a.expr = expr;
    a.exprUntil = performance.now() + ms;
    a.art.innerHTML = renderCritter(a.sp, { size: YD_SIZE, expression: expr });
  }

  _dust(a) { a.el.style.setProperty('--dust', String((1 - a.clean).toFixed(2))); }

  _burst(a, glyph, colour, n) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'yd-pop';
      s.textContent = glyph;
      s.style.color = colour;
      s.style.left = `${20 + Math.random() * 40}px`;
      s.style.animationDelay = `${i * 55}ms`;
      a.spark.appendChild(s);
      setTimeout(() => s.remove(), 1100 + i * 55);
    }
  }

  start() { if (!this.running) { this.running = true; this.last = 0; requestAnimationFrame((t) => this._frame(t)); } }
  stop() { this.running = false; }
  destroy() { this.stop(); this._teardown?.(); for (const a of this.actors) a.el.remove(); this.actors = []; }

  _frame(t) {
    if (!this.running) return;
    if (!this.last) this.last = t;
    let dt = t - this.last; this.last = t;
    if (dt > 250) dt = 250;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP_MS && n < 6) { this._step(STEP_MS / 1000); this.acc -= STEP_MS; n++; }
    this.poseAcc += dt;
    if (this.poseAcc >= 1000 / POSE_HZ) { this.poseAcc = 0; this._draw(); }
    requestAnimationFrame((t2) => this._frame(t2));
  }

  _step(dt) {
    const now = performance.now();
    for (const a of this.actors) {
      if (a.bubbleUntil && now > a.bubbleUntil) { a.bub.classList.remove('on'); a.bubbleUntil = 0; }
      if (a.exprUntil && now > a.exprUntil) { a.exprUntil = 0; a.expr = null; a.art.innerHTML = renderCritter(a.sp, { size: YD_SIZE }); }
      // Dust returns slowly, so washing is a thing you do again rather than once.
      a.clean = Math.max(0, a.clean - dt * 0.004);
      if (Math.random() < dt * 0.4) this._dust(a);
      if (a.state === 'held') continue;

      a.hold -= dt * 1000;
      if (a.hold <= 0) {
        if (a.state === 'walk') { a.state = 'idle'; a.hold = 700 + Math.random() * 2600; }
        else {
          a.state = 'walk'; a.hold = 1100 + Math.random() * 3400;
          a.vx = (Math.random() < 0.5 ? -1 : 1) * (11 + Math.random() * 22);
          a.vy = (Math.random() - 0.5) * 14;
        }
      }
      if (a.state === 'walk' && !this.reduced) {
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (a.x < 6) { a.x = 6; a.vx = Math.abs(a.vx); }
        if (a.x > this.w - YD_PAD_X) { a.x = this.w - YD_PAD_X; a.vx = -Math.abs(a.vx); }
        if (a.y < 6) { a.y = 6; a.vy = Math.abs(a.vy); }
        if (a.y > this.h - YD_PAD_Y) { a.y = this.h - YD_PAD_Y; a.vy = -Math.abs(a.vy); }
        a.face = a.vx < 0 ? -1 : 1;
      }
      a.phase += dt * (a.state === 'walk' ? 7 : 2);
    }
  }

  _place(a) { a.el.style.transform = `translate(${Math.round(a.x)}px, ${Math.round(a.y)}px)`; }

  _draw() {
    for (const a of this.actors) {
      const bob = a.state === 'held' ? 0 : Math.round(Math.sin(a.phase) * (a.state === 'walk' ? 3 : 1.4));
      a.el.style.transform = `translate(${Math.round(a.x)}px, ${Math.round(a.y) - bob}px)`;
      a.el.style.zIndex = String(100 + Math.round(a.y));
      const lean = a.state === 'walk' ? Math.round(Math.sin(a.phase) * 4) : 0;
      a.art.style.transform = `scaleX(${a.face}) rotate(${lean * a.face}deg)`;
    }
  }
}
