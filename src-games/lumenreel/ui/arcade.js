// The three minigames. Each renders into the modal, runs on its own rAF loop,
// resolves with a normalised score, and cleans up after itself — a game that
// leaves a loop running behind a closed modal is a slow leak that presents as
// "the app got sluggish after a while".

import { ARCADE } from '../lib/arcade.js';
import { renderCritter } from '../art/critter.js';
import { renderSymbol } from '../art/symbols.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// A tiny shared particle pool for the games. Kept local rather than reusing the
// reel layer: these live and die inside a modal that is torn down, and a leaked
// emitter behind a closed dialog is the classic "it got sluggish after a while".
function makeFx() {
  const p = [];
  return {
    burst(x, y, hue, n = 14, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 190) * power;
        p.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.4 + Math.random() * 0.5,
          age: 0, r: 1.6 + Math.random() * 3.4, hue: hue + (Math.random() - 0.5) * 40, rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 12 });
      }
    },
    ring(x, y, hue) { p.push({ ring: true, x, y, r: 4, vr: 300, life: 0.45, age: 0, hue }); },
    step(dt, ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = p.length - 1; i >= 0; i--) {
        const o = p[i]; o.age += dt;
        if (o.age >= o.life) { p.splice(i, 1); continue; }
        const f = 1 - o.age / o.life;
        ctx.globalAlpha = f;
        if (o.ring) {
          o.r += o.vr * dt;
          ctx.strokeStyle = `hsl(${o.hue} 92% 74%)`; ctx.lineWidth = 3 * f + 0.6;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.stroke();
        } else {
          o.vy += 620 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
          ctx.fillStyle = `hsl(${o.hue} 92% 66%)`;
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
          const r = o.r * (0.4 + f * 0.6);
          ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r * 1.6); ctx.lineTo(-r * 0.7, 0);
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
      ctx.restore();
    },
    get count() { return p.length; },
    clear() { p.length = 0; },
  };
}

/* -------------------------------------------------------------- BRICK ATTACK */
export function brickAttack(host, { seconds = 10, theme = 'prism', audio } = {}) {
  return new Promise((resolve) => {
    host.innerHTML = `<div class="mg">
      <div class="mg-hud"><span id="mg-t">${seconds}.0s</span><span id="mg-s">0 broken</span></div>
      <canvas id="mg-cv" width="620" height="360"></canvas>
      <p class="note">Move with the mouse or the arrow keys. Ten seconds.</p></div>`;
    const cv = host.querySelector('#mg-cv');
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const COLS = 10, ROWS = 4, BW = W / COLS, BH = 22;
    const hues = theme === 'verdant' ? [95, 45, 130, 340] : [190, 280, 320, 45];
    const bricks = [];
    for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) bricks.push({ x: i * BW, y: 40 + r * BH, alive: true, hue: hues[r % hues.length] });
    const total = bricks.length;
    let broken = 0;
    const pad = { x: W / 2 - 46, w: 92, h: 11 };
    const ball = { x: W / 2, y: H - 46, vx: 195, vy: -290, r: 7 };
    let left = false, right = false, done = false, raf = 0;
    let t0 = 0, last = 0, shake = 0, combo = 0, comboT = 0;
    const efx = makeFx();
    const trail = [];

    const onMove = (e) => { const r = cv.getBoundingClientRect(); pad.x = ((e.clientX - r.left) / r.width) * W - pad.w / 2; };
    const onKey = (e, v) => { if (e.key === 'ArrowLeft') left = v; if (e.key === 'ArrowRight') right = v; };
    const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
    cv.addEventListener('mousemove', onMove);
    globalThis.addEventListener('keydown', kd); globalThis.addEventListener('keyup', ku);

    const cleanup = () => {
      done = true; cancelAnimationFrame(raf);
      cv.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('keydown', kd); globalThis.removeEventListener('keyup', ku);
    };

    const frame = (t) => {
      if (done) return;
      if (!t0) { t0 = t; last = t; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const elapsed = (t - t0) / 1000;
      if (elapsed >= seconds) { efx.clear(); cleanup(); return resolve({ score01: clamp01(broken / total), detail: `${broken}/${total} bricks` }); }

      if (left) pad.x -= 460 * dt;
      if (right) pad.x += 460 * dt;
      pad.x = Math.max(0, Math.min(W - pad.w, pad.x));

      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      // The floor bounces. Losing the ball in a 10-second game is a punishment
      // out of all proportion to the mistake.
      if (ball.y > H - ball.r) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); }
      if (ball.y > H - 46 - ball.r && ball.vy > 0 && ball.x > pad.x && ball.x < pad.x + pad.w) {
        ball.vy = -Math.abs(ball.vy);
        ball.vx += ((ball.x - (pad.x + pad.w / 2)) / (pad.w / 2)) * 130;
        ball.vx = Math.max(-340, Math.min(340, ball.vx));
        audio?.click?.();
      }
      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x > b.x && ball.x < b.x + BW && ball.y > b.y && ball.y < b.y + BH) {
          b.alive = false; broken++; ball.vy = -ball.vy;
          efx.burst(b.x + BW / 2, b.y + BH / 2, b.hue, 16, 1.1);
          efx.ring(b.x + BW / 2, b.y + BH / 2, b.hue);
          combo++; comboT = 0.9; shake = Math.min(9, 3 + combo * 0.8);
          audio?.coin?.(broken % 4); break;
        }
      }

      comboT -= dt; if (comboT <= 0) combo = 0;
      shake *= 0.86;
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 14) trail.shift();

      c.clearRect(0, 0, W, H);
      c.save();
      if (shake > 0.4) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      // ball trail
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < trail.length; i++) {
        const f = i / trail.length;
        c.globalAlpha = f * 0.5;
        c.fillStyle = `hsl(${hues[0]} 92% 72%)`;
        c.beginPath(); c.arc(trail[i].x, trail[i].y, ball.r * f, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      for (const b of bricks) {
        if (!b.alive) continue;
        c.fillStyle = `hsl(${b.hue} 74% 58%)`;
        c.fillRect(b.x + 2, b.y + 2, BW - 4, BH - 4);
        c.fillStyle = `hsl(${b.hue} 86% 74% / .5)`;
        c.fillRect(b.x + 2, b.y + 2, BW - 4, 5);
      }
      c.fillStyle = '#e9edfb';
      c.beginPath();
      if (c.roundRect) c.roundRect(pad.x, H - 40, pad.w, pad.h, 6); else c.rect(pad.x, H - 40, pad.w, pad.h);
      c.fill();
      c.shadowColor = `hsl(${hues[0]} 92% 70%)`; c.shadowBlur = 14;
      c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      efx.step(dt, c);
      if (combo >= 3) {
        c.fillStyle = `hsl(${hues[1]} 94% 74%)`;
        c.font = '800 26px ui-sans-serif,system-ui'; c.textAlign = 'center';
        c.globalAlpha = Math.min(1, comboT);
        c.fillText(`${combo}× COMBO`, W / 2, 26);
        c.globalAlpha = 1;
      }
      c.restore();

      host.querySelector('#mg-t').textContent = `${Math.max(0, seconds - elapsed).toFixed(1)}s`;
      host.querySelector('#mg-s').textContent = `${broken} broken`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

/* -------------------------------------------------------------- MEMORY MATCH */
export function memoryMatch(host, { seconds = 40, species = [], theme = 'prism', audio } = {}) {
  return new Promise((resolve) => {
    const faces = [];
    const pool = species.length >= 6 ? species.slice(0, 6) : null;
    for (let i = 0; i < 6; i++) {
      faces.push(pool
        ? { key: 'sp' + pool[i].id, art: renderCritter(pool[i], { size: 56 }) }
        : { key: 'sy' + i, art: renderSymbol(['q', 'c', 'a', 't', 'b', 'P'][i], 46, theme) });
    }
    const deck = [...faces, ...faces]
      .map((f) => ({ ...f, id: Math.random() }))
      .sort(() => Math.random() - 0.5);

    host.innerHTML = `<div class="mg">
      <div class="mg-hud"><span id="mg-t">${seconds}.0s</span><span id="mg-s">0/6 pairs · 0 flips</span></div>
      <div class="mm-grid">${deck.map((d, i) => `<button class="mm-card" data-i="${i}"><span class="mm-face">${d.art}</span></button>`).join('')}</div>
      <p class="note">Find all six pairs. Fewer flips scores higher.</p></div>`;

    const cards = [...host.querySelectorAll('.mm-card')];
    let open = [], matched = 0, flips = 0, busy = false, done = false, t0 = performance.now();

    const tick = setInterval(() => {
      const left = seconds - (performance.now() - t0) / 1000;
      const el = host.querySelector('#mg-t');
      if (el) el.textContent = `${Math.max(0, left).toFixed(1)}s`;
      if (left <= 0) finish();
    }, 100);

    const finish = () => {
      if (done) return;
      done = true; clearInterval(tick);
      // Pairs found is the main term; flip efficiency is a bonus, floored so a
      // slow-but-complete run still scores well.
      const pairScore = matched / 6;
      const eff = flips > 0 ? Math.min(1, 12 / flips) : 0;
      resolve({ score01: clamp01(pairScore * 0.75 + pairScore * eff * 0.25), detail: `${matched}/6 pairs in ${flips} flips` });
    };

    host.querySelector('.mm-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.mm-card');
      if (!btn || busy || done || btn.classList.contains('done') || btn.classList.contains('up')) return;
      audio?.click?.();
      btn.classList.add('up'); open.push(btn); flips++;
      host.querySelector('#mg-s').textContent = `${matched}/6 pairs · ${flips} flips`;
      if (open.length < 2) return;
      busy = true;
      const [a, b] = open;
      const same = deck[+a.dataset.i].key === deck[+b.dataset.i].key;
      setTimeout(() => {
        if (same) {
          a.classList.add('done'); b.classList.add('done'); matched++; audio?.coin?.(matched);
          for (const el of [a, b]) {
            const pop = document.createElement('span');
            pop.className = 'mm-pop'; pop.textContent = '✦';
            el.appendChild(pop); setTimeout(() => pop.remove(), 900);
          }
        }
        else { a.classList.remove('up'); b.classList.remove('up'); }
        open = []; busy = false;
        host.querySelector('#mg-s').textContent = `${matched}/6 pairs · ${flips} flips`;
        if (matched === 6) finish();
      }, same ? 260 : 520);
    });
  });
}

/* ---------------------------------------------------------------- REVOLUTION */
export function revolution(host, { rounds = 7, theme = 'prism', audio } = {}) {
  return new Promise((resolve) => {
    host.innerHTML = `<div class="mg">
      <div class="mg-hud"><span id="mg-t">Round 1/${rounds}</span><span id="mg-s">0 hits</span></div>
      <canvas id="mg-cv" width="360" height="360"></canvas>
      <p class="note">Click, tap or press Space when the marker is in the lit arc. It gets thinner.</p></div>`;
    const cv = host.querySelector('#mg-cv');
    const c = cv.getContext('2d');
    const R = 132, CX = 180, CY = 180;
    const accent = theme === 'verdant' ? '163,230,53' : '167,139,250';
    let round = 0, hits = 0, angle = 0, speed = 1.55, arc = 0.9, target = 1.2;
    let done = false, raf = 0, last = 0, flash = 0;
    const efx = makeFx();
    const trail = [];

    const nextRound = () => {
      round++;
      if (round > rounds) { cleanup(); return resolve({ score01: clamp01(hits / rounds), detail: `${hits}/${rounds} hits` }); }
      arc = Math.max(0.16, 0.9 - (round - 1) * 0.11);
      speed = 1.55 + (round - 1) * 0.3;
      target = Math.random() * Math.PI * 2;
      host.querySelector('#mg-t').textContent = `Round ${round}/${rounds}`;
    };

    const attempt = () => {
      if (done) return;
      let d = Math.abs(((angle - target + Math.PI) % (Math.PI * 2)) - Math.PI);
      const hit = d <= arc / 2;
      const mx = CX + Math.cos(angle) * R, my = CY + Math.sin(angle) * R;
      if (hit) {
        hits++; audio?.coin?.(hits); flash = 1;
        efx.burst(mx, my, theme === 'verdant' ? 95 : 280, 22, 1.3);
        efx.ring(CX, CY, theme === 'verdant' ? 95 : 280);
      } else { audio?.deny?.(); flash = -1; efx.burst(mx, my, 350, 10, 0.7); }
      host.querySelector('#mg-s').textContent = `${hits} hits`;
      nextRound();
    };

    const onClick = () => attempt();
    const onKey = (e) => { if (e.code === 'Space') { e.preventDefault(); attempt(); } };
    cv.addEventListener('click', onClick);
    globalThis.addEventListener('keydown', onKey);
    const cleanup = () => { done = true; efx.clear(); cancelAnimationFrame(raf); cv.removeEventListener('click', onClick); globalThis.removeEventListener('keydown', onKey); };

    const frame = (t) => {
      if (done) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      angle = (angle + speed * dt * Math.PI * 2) % (Math.PI * 2);
      flash *= 0.9;

      c.clearRect(0, 0, 360, 360);
      c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 20;
      c.beginPath(); c.arc(CX, CY, R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = `rgba(${accent},${0.55 + Math.max(0, flash) * 0.4})`; c.lineWidth = 20;
      c.beginPath(); c.arc(CX, CY, R, target - arc / 2, target + arc / 2); c.stroke();
      c.strokeStyle = flash < -0.05 ? '#fb7185' : '#fff'; c.lineWidth = 5;
      c.beginPath();
      c.moveTo(CX + Math.cos(angle) * (R - 18), CY + Math.sin(angle) * (R - 18));
      c.lineTo(CX + Math.cos(angle) * (R + 18), CY + Math.sin(angle) * (R + 18));
      c.stroke();
      // marker trail
      trail.push(angle); if (trail.length > 12) trail.shift();
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < trail.length; i++) {
        const f = i / trail.length;
        c.globalAlpha = f * 0.35;
        c.strokeStyle = '#fff'; c.lineWidth = 4 * f;
        c.beginPath();
        c.moveTo(CX + Math.cos(trail[i]) * (R - 12), CY + Math.sin(trail[i]) * (R - 12));
        c.lineTo(CX + Math.cos(trail[i]) * (R + 12), CY + Math.sin(trail[i]) * (R + 12));
        c.stroke();
      }
      c.restore();
      efx.step(dt, c);
      c.fillStyle = flash < -0.05 ? '#fb7185' : 'rgba(255,255,255,.9)';
      c.font = '800 30px ui-sans-serif,system-ui';
      c.textAlign = 'center'; c.fillText(`${hits}`, CX, CY + 10);
      c.fillStyle = 'rgba(255,255,255,.4)'; c.font = '600 11px ui-sans-serif,system-ui';
      c.fillText('HITS', CX, CY + 28);
      raf = requestAnimationFrame(frame);
    };
    nextRound();
    raf = requestAnimationFrame(frame);
  });
}

export const RUNNERS = { brick: brickAttack, memory: memoryMatch, revolution };
export { ARCADE };
