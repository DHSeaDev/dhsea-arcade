// The Grove — a strip where a few of your critters loiter, wander and talk.
//
// Two performance rules, both learned the hard way in this project:
//  1. Sprites are built ONCE and moved with transforms. Nothing re-parses an SVG
//     per frame; the dex lag was exactly that mistake at 100x.
//  2. Motion is a fixed-timestep simulation with a STEPPED pose rate. Smooth
//     procedural walking at 60fps reads floaty; holding a pose reads handcrafted.

import { renderCritter } from '../art/critter.js';
import { speak, interact } from '../lib/chatter.js';

const POSE_HZ = 10;          // pose updates per second — deliberately low
const STEP_MS = 1000 / 60;
const BUBBLE_MS = 5200;
const TALK_EVERY = [4200, 9000];
const MIN_ROSTER = 3;
const MAX_ROSTER = 7;
const MINGLE_RANGE = 96;     // how close counts as "together"
const MINGLE_CHANCE = 0.55;  // odds an idle beat becomes a walk-over instead of a remark

export class Playground {
  constructor(stage, opts = {}) {
    this.stage = stage;
    this.onLine = opts.onLine || (() => {});
    this.actors = [];
    this.running = false;
    this.acc = 0;
    this.last = 0;
    this.poseAcc = 0;
    this.nextTalk = 2200;
    this.reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.w = 600; this.h = 170;
    this._measure();
    globalThis.addEventListener?.('resize', () => this._measure());
  }

  _measure() {
    const r = this.stage.getBoundingClientRect();
    if (r.width > 40) { this.w = r.width; this.h = r.height; }
    for (const a of this.actors) a.x = Math.min(a.x, this.w - 60);
  }

  /**
   * Set who is hanging out. Called whenever the collection changes; keeps the
   * actors that are still in the roster so nobody teleports on every draw.
   */
  setRoster(species) {
    const want = species.slice(0, MAX_ROSTER);
    const wantIds = new Set(want.map((s) => s.id));
    for (const a of this.actors.filter((a) => !wantIds.has(a.sp.id))) a.el.remove();
    this.actors = this.actors.filter((a) => wantIds.has(a.sp.id));
    const have = new Set(this.actors.map((a) => a.sp.id));
    for (const sp of want) {
      if (have.has(sp.id)) continue;
      this.actors.push(this._make(sp));
    }
    this.stage.classList.toggle('empty', this.actors.length === 0);
    this._measure();
  }

  _make(sp) {
    const el = document.createElement('div');
    el.className = 'pg-actor';
    el.dataset.sp = String(sp.id);
    el.innerHTML = `<div class="pg-bub"></div><div class="pg-art">${renderCritter(sp, { size: 72 })}</div>`;
    this.stage.appendChild(el);
    const x = 20 + Math.random() * Math.max(40, this.w - 110);
    return {
      sp, el,
      bub: el.querySelector('.pg-bub'),
      art: el.querySelector('.pg-art'),
      x, y: 0, vx: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16),
      face: 1, phase: Math.random() * 6.28,
      state: 'walk', hold: 600 + Math.random() * 2600,
      bubbleUntil: 0,
      seek: null,          // a partner this actor is walking over to
      seekUntil: 0,        // give up rather than chase forever
    };
  }

  start() { if (!this.running) { this.running = true; this.last = 0; requestAnimationFrame((t) => this._frame(t)); } }
  stop() { this.running = false; }

  /**
   * Keep a bubble inside the stage. A four-line interaction is roughly twice the height
   * of a one-liner, and at the old fixed `bottom: 78px` the tall ones ran straight out of
   * the top of the strip — which is what the player was seeing. The preferred offset is
   * still 78px; this only pulls it down when the measured height would not otherwise fit.
   */
  _fitBubble(a) {
    const h = a.bub.offsetHeight || 0;
    const w = a.bub.offsetWidth || 0;
    if (!h) return;
    const ACTOR_BOTTOM = 16, PAD = 6, HALF = 36;   // .pg-actor is 72px wide
    // Vertical: never out of the top of the strip.
    const maxBottom = this.h - ACTOR_BOTTOM - PAD - h;
    a.bub.style.bottom = `${Math.max(8, Math.min(78, maxBottom))}px`;
    // Horizontal: a wide bubble on a critter standing near an edge would otherwise be
    // clipped by the stage's overflow:hidden. Slide it back inside and move the tail so
    // it still points at whoever is speaking.
    if (w) {
      const cx = a.x + HALF;
      const want = Math.max(PAD + w / 2, Math.min(cx, Math.max(PAD + w / 2, this.w - PAD - w / 2)));
      const left = HALF + (want - cx);
      a.bub.style.left = `${Math.round(left)}px`;
      a.bub.style.setProperty('--tail', `${Math.round(HALF - left + w / 2)}px`);
    }
  }

  /** Make a specific critter speak now (used on click and on game events). */
  say(actor, event, other, n) {
    const text = event === '__interact' && other
      ? interact(actor.sp, other.sp)
      : speak(actor.sp, event, { other: other?.sp, n });
    actor.bub.textContent = text;
    actor.bub.classList.add('on');
    this._fitBubble(actor);
    actor.bubbleUntil = performance.now() + BUBBLE_MS + text.length * 14;
    actor.state = 'talk';
    actor.hold = 900;
    this.onLine({ name: actor.sp.name, tier: actor.sp.tier, text });
    return text;
  }

  /** Fire a line about something that just happened on the reels. */
  event(kind, n = 0) {
    if (!this.actors.length) return;
    const a = this.actors[Math.floor(Math.random() * this.actors.length)];
    const others = this.actors.filter((x) => x !== a);
    const other = others.length ? others[Math.floor(Math.random() * others.length)] : null;
    this.say(a, kind, other, n);
    this.nextTalk = TALK_EVERY[0] + Math.random() * (TALK_EVERY[1] - TALK_EVERY[0]);
  }

  _frame(t) {
    if (!this.running) return;
    if (!this.last) this.last = t;
    let dt = t - this.last;
    this.last = t;
    if (dt > 250) dt = 250;                 // tab was hidden; do not spiral
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < 6) { this._step(STEP_MS / 1000); this.acc -= STEP_MS; steps++; }

    this.poseAcc += dt;
    if (this.poseAcc >= 1000 / POSE_HZ) { this.poseAcc = 0; this._draw(); }
    requestAnimationFrame((t2) => this._frame(t2));
  }

  _step(dt) {
    const now = performance.now();
    this.nextTalk -= dt * 1000;
    if (this.nextTalk <= 0 && this.actors.length) {
      const a = this.actors[Math.floor(Math.random() * this.actors.length)];
      const near = this.actors.find((x) => x !== a && Math.abs(x.x - a.x) < MINGLE_RANGE);
      if (near) {
        // Already together — talk to each other by name.
        this.say(a, '__interact', near);
      } else if (this.actors.length > 1 && Math.random() < MINGLE_CHANCE) {
        // Otherwise WALK OVER to someone first. The pairing is the point: two critters
        // crossing the strip to stand together reads as a cast, and a remark delivered on
        // arrival lands better than one shouted across an empty stage.
        const partner = this.actors[Math.floor(Math.random() * this.actors.length)];
        if (partner !== a) { a.seek = partner; a.seekUntil = now + 6000; a.state = 'walk'; a.hold = 6000; }
        this.nextTalk = 1400;      // check back soon — the line fires on arrival
        return;
      } else {
        this.say(a, 'idle', near || null);
      }
      this.nextTalk = TALK_EVERY[0] + Math.random() * (TALK_EVERY[1] - TALK_EVERY[0]);
    }

    for (const a of this.actors) {
      if (a.bubbleUntil && now > a.bubbleUntil) { a.bub.classList.remove('on'); a.bubbleUntil = 0; }
      a.hold -= dt * 1000;
      if (a.hold <= 0) {
        // Wander: walk a while, stand a while, occasionally turn around.
        if (a.state === 'walk') { a.state = 'idle'; a.hold = 700 + Math.random() * 2400; }
        else { a.state = 'walk'; a.hold = 1200 + Math.random() * 3200; a.vx = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 20); }
      }
      // Seeking overrides the wander: steer toward the partner, and on arrival say the
      // line that needed two of them. A seek that cannot close is abandoned, not retried.
      if (a.seek) {
        const gone = !this.actors.includes(a.seek);
        const gap = gone ? Infinity : a.seek.x - a.x;
        if (gone || now > a.seekUntil) { a.seek = null; a.hold = 0; }
        else if (Math.abs(gap) < MINGLE_RANGE * 0.55) {
          const partner = a.seek;
          a.seek = null;
          a.hold = 900;
          this.say(a, '__interact', partner);
        } else if (!this.reduced) {
          a.vx = Math.sign(gap) * 26;
          a.x += a.vx * dt;
          a.face = a.vx < 0 ? -1 : 1;
        } else { a.seek = null; }
      } else if (a.state === 'walk' && !this.reduced) {
        a.x += a.vx * dt;
        if (a.x < 8) { a.x = 8; a.vx = Math.abs(a.vx); }
        if (a.x > this.w - 78) { a.x = this.w - 78; a.vx = -Math.abs(a.vx); }
        a.face = a.vx < 0 ? -1 : 1;
      }
      a.x = Math.max(8, Math.min(a.x, Math.max(8, this.w - 78)));
      a.phase += dt * (a.state === 'walk' ? 7.5 : 2.2);
    }
  }

  _draw() {
    for (const a of this.actors) {
      // Stepped bob + a slight lean into the walk. Quantised so it reads as a
      // held pose rather than a smooth slide.
      const bob = a.state === 'walk' ? Math.round(Math.sin(a.phase) * 3) : Math.round(Math.sin(a.phase) * 1.4);
      const lean = a.state === 'walk' ? Math.round(Math.sin(a.phase) * 4) : 0;
      a.el.style.transform = `translate(${Math.round(a.x)}px, ${-bob}px)`;
      a.art.style.transform = `scaleX(${a.face}) rotate(${lean * a.face}deg)`;
      a.el.style.zIndex = String(100 + Math.round(a.x / 10));
    }
  }

  hitTest(clientX, clientY) {
    for (const a of this.actors) {
      const r = a.el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return a;
    }
    return null;
  }
}

export { MIN_ROSTER, MAX_ROSTER };
