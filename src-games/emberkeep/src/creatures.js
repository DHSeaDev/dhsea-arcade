// Emberkeep — the things in the dark.
//
// NOTHING HERE CAN KILL EMBER. A creature startles him: he loses footing, loses fuel, and
// says something about it. That is the whole punishment, because the never-dies law is not
// negotiable. They are a pressure on your light budget, not a threat to your life.
//
// Bats are drawn TO the light — the brighter Ember burns, the further they notice him. That
// is the tension the fuel economy needed: being bright is how you see, and being bright is
// how you get found.
//
// Creatures live outside physics.js and outside the solvability proof. They can never make a
// room impassable: they do not block, they reposition. Webs DO block, and webs are geometry —
// the solver treats every web as permanently solid, so a room proved solvable is solvable
// even if you never burn a single web.

import { T, EW, EH, FUEL_MAX, startle, lightRadius } from './physics.js';

export class Creatures {
  constructor(room, rnd = Math.random) {
    this.rnd = rnd;
    this.list = [];
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        const c = room.grid[y][x];
        if (c === 'b') this.list.push({
          kind: 'bat', x: x * T + 10, y: y * T + 10, hx: x * T + 10, hy: y * T + 10,
          vx: 0, vy: 0, ph: rnd() * 6.28, flee: 0, state: 'idle', wing: 0,
        });
        if (c === 'r') this.list.push({
          kind: 'rat', x: x * T + 12, y: y * T + 16, hx: x * T + 12, hy: y * T + 16,
          vx: 0, dir: rnd() < 0.5 ? -1 : 1, ph: rnd() * 6.28, flee: 0, state: 'idle', squeak: 0,
          bold: rnd() < 0.34, met: false,
        });
        if (c === 'c') this.list.push({
          kind: 'crow', x: x * T + 12, y: y * T + 12, hx: x * T + 12, hy: y * T + 12,
          vx: 0, vy: 0, ph: rnd() * 6.28, flee: 0, dive: 0, done: false, state: 'perch', wing: 0,
        });
        if (c === 'p') this.list.push({
          kind: 'spider', x: x * T + 10, y: y * T + 10, hx: x * T + 10, hy: y * T + 10,
          drop: 0, flee: 0, gone: false, state: 'idle',
        });
      }
    }
  }

  update(s, room, vfx) {
    const ex = s.x + EW / 2, ey = s.y + EH / 2;
    const rad = lightRadius(s);
    const bright = s.fuel / FUEL_MAX;

    for (const c of this.list) {
      if (c.gone) continue;
      if (c.flee > 0) c.flee--;

      if (c.kind === 'bat') {
        c.wing += 0.42;
        const d = Math.hypot(ex - c.x, ey - c.y);
        // notice range scales with how brightly he is burning
        const notice = 60 + rad * 0.95 * (0.45 + 0.55 * bright);
        if (c.flee > 0) {
          c.state = 'flee';
          c.vx += (c.hx - c.x) * 0.006 + (c.x < ex ? -0.18 : 0.18);
          c.vy += (c.hy - c.y) * 0.006 - 0.05;
        } else if (d < notice) {
          c.state = 'seek';
          c.vx += ((ex - c.x) / (d || 1)) * 0.15;
          c.vy += ((ey - c.y) / (d || 1)) * 0.13 + Math.sin(c.ph + s.t * 0.09) * 0.07;
        } else {
          c.state = 'idle';
          c.vx += ((c.hx - c.x) * 0.010) + Math.sin(s.t * 0.031 + c.ph) * 0.075;
          c.vy += ((c.hy - c.y) * 0.010) + Math.cos(s.t * 0.043 + c.ph) * 0.065;
        }
        c.vx = Math.max(-2.4, Math.min(2.4, c.vx * 0.955));
        c.vy = Math.max(-2.0, Math.min(2.0, c.vy * 0.955));
        c.x += c.vx; c.y += c.vy;
        if (d < 13) { if (startle(s, c.x)) { c.flee = 150; vfx?.emitBurst(ex, ey, 12, this.rnd); } }

      } else if (c.kind === 'rat') {
        // Rats are pure comic relief. They cannot hurt him and they cannot be hurt.
        //
        // Most of them want nothing except to be somewhere Ember is not, and he finds this
        // insulting. But about a third are BOLD: if he holds still, they stop running, think
        // about it, and edge toward the warm thing. That is the better joke — everything in
        // this game is afraid of him, so the one animal that isn't lands harder than the
        // dozen that are. Move, and it bolts like the rest.
        const d = Math.hypot(ex - c.x, ey - c.y);
        const stillish = Math.abs(s.vx) < 0.2 && s.onGround;

        if (c.bold && stillish && d < 118 && c.flee <= 0) {
          c.state = 'approach';
          c.dir = (c.x < ex) ? 1 : -1;
          if (d > 30) c.vx += c.dir * 0.09;          // slow. It is thinking about it.
          else c.vx *= 0.72;
          if (!c.met && d < 44) { c.met = true; s.events.push({ k: 'rat_bold' }); }
        } else if (c.bold && d < 118 && !stillish && c.state === 'approach') {
          c.state = 'scatter';                        // he moved. Of course it bolts.
          c.flee = 90;
          c.dir = (c.x < ex) ? -1 : 1;
          c.vx += c.dir * 0.42;
        } else if (d < 96 && !(c.bold && stillish)) {
          c.state = 'scatter';
          c.dir = (c.x < ex) ? -1 : 1;
          c.vx += c.dir * 0.34;
          if (c.squeak <= 0) { c.squeak = 80; s.events.push({ k: 'rat' }); }
        } else {
          c.state = 'idle';
          c.vx += Math.sin(s.t * 0.021 + c.ph) * 0.05 + (c.hx - c.x) * 0.0035;
        }
        if (c.squeak > 0) c.squeak--;
        c.vx = Math.max(-3.1, Math.min(3.1, c.vx * 0.90));
        c.x += c.vx;
        if (c.x < 8 || c.x > room.w * T - 8) c.vx *= -0.4;
        const settled = c.state === 'approach' && Math.abs(c.vx) < 0.12;
        c.y = c.hy + (settled ? Math.sin(s.t * 0.06 + c.ph) * 0.5
                              : Math.abs(Math.sin(s.t * 0.35 + c.ph)) * (Math.abs(c.vx) > 0.4 ? 1.6 : 0.3));

      } else if (c.kind === 'crow') {
        // Crows perch and watch. Burn brightly enough for long enough and exactly one of them
        // will make a point about it, then go back to watching.
        c.wing += 0.30;
        const d = Math.hypot(ex - c.x, ey - c.y);
        if (c.flee > 0) {
          c.state = 'flee';
          c.vx += (c.hx - c.x) * 0.004; c.vy += (c.hy - c.y) * 0.004 - 0.06;
        } else if (!c.done && bright > 0.55 && d < 190) {
          c.state = 'dive';
          c.dive++;
          c.vx += ((ex - c.x) / (d || 1)) * 0.20;
          c.vy += ((ey - c.y) / (d || 1)) * 0.18;
          if (c.dive > 150) { c.done = true; c.flee = 200; }
        } else {
          c.state = 'perch';
          c.vx += (c.hx - c.x) * 0.02; c.vy += (c.hy - c.y) * 0.02;
          if (Math.abs(c.x - c.hx) < 2) c.vx *= 0.5;
        }
        c.vx = Math.max(-3.0, Math.min(3.0, c.vx * 0.94));
        c.vy = Math.max(-2.6, Math.min(2.6, c.vy * 0.94));
        c.x += c.vx; c.y += c.vy;
        if (d < 15 && c.state === 'dive') {
          if (startle(s, c.x)) { c.flee = 220; c.done = true; vfx?.emitBurst(ex, ey, 12, this.rnd); }
        }

      } else {
        // spider: anchored, drops on a thread when Ember passes under it
        const dx = Math.abs(ex - c.hx), dy = ey - c.hy;
        const want = (c.flee === 0 && dx < 34 && dy > 0 && dy < 120) ? Math.min(dy - 8, 96) : 0;
        c.drop += (want - c.drop) * (want > c.drop ? 0.10 : 0.045);
        c.x = c.hx; c.y = c.hy + c.drop;
        c.state = c.flee > 0 ? 'flee' : (want > 0 ? 'drop' : 'idle');
        if (Math.hypot(ex - c.x, ey - c.y) < 13) {
          if (startle(s, c.x)) { c.flee = 200; vfx?.emitBurst(ex, ey, 12, this.rnd); }
        }
      }
    }

    // a spark shot scares them off — the gun repels, it does not kill
    for (const p of s.shots) {
      for (const c of this.list) {
        if (c.gone) continue;
        if (Math.hypot(p.x - c.x, p.y - c.y) < 15) {
          c.flee = c.kind === 'bat' ? 260 : 320;
          vfx?.emitBurst(c.x, c.y, 8, this.rnd);
        }
      }
    }

    // a spider whose web is burning leaves for good
    for (const c of this.list) {
      if (c.kind !== 'spider' || c.gone) continue;
      const tx = Math.floor(c.hx / T), ty = Math.floor(c.hy / T);
      for (let yy = ty - 2; yy <= ty + 3; yy++) for (let xx = tx - 2; xx <= tx + 2; xx++) {
        if (yy < 0 || xx < 0 || yy >= room.h || xx >= room.w) continue;
        const id = yy * room.w + xx;
        if (room.grid[yy][xx] === 'w' && (s.burning.has(id) || s.burned.has(id))) c.gone = true;
      }
    }
  }

  draw(g, s, t) {
    for (const c of this.list) {
      if (c.gone) continue;
      if (c.kind === 'rat') {
        const run = Math.abs(c.vx) > 0.4;
        g.save(); g.translate(c.x, c.y); g.scale(c.dir < 0 ? -1 : 1, 1);
        g.fillStyle = '#2f2724';
        g.beginPath(); g.ellipse(0, 0, 6.4, 3.6, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(6.0, -0.8, 3.0, 2.6, 0, 0, 7); g.fill();     // head
        g.beginPath(); g.ellipse(4.6, -3.2, 1.5, 1.5, 0, 0, 7); g.fill();     // ear
        g.strokeStyle = '#2f2724'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(-6, 0);
        g.quadraticCurveTo(-12, Math.sin(t * 0.3 + c.ph) * 3 - 1, -15, 2); g.stroke();
        for (const lx of [-2.5, 2.5]) {                                      // scurrying feet
          g.beginPath(); g.moveTo(lx, 3);
          g.lineTo(lx + (run ? Math.sin(t * 0.9 + lx) * 2 : 0), 6); g.stroke();
        }
        g.fillStyle = c.state === 'approach' ? 'rgba(255,210,170,.95)' : 'rgba(255,190,160,.9)';
        g.fillRect(7.0, -1.6, 1.1, 1.1);
        if (c.state === 'approach' && Math.abs(c.vx) < 0.12) {
          g.fillStyle = 'rgba(255,150,70,.10)';       // sitting in his light, taking some of it
          g.beginPath(); g.ellipse(0, 1, 11, 6, 0, 0, 7); g.fill();
        }
        g.restore();

      } else if (c.kind === 'crow') {
        const flap = c.state === 'perch' ? Math.sin(t * 0.03) * 0.12 : Math.sin(c.wing) * 1.0;
        g.save(); g.translate(c.x, c.y);
        g.fillStyle = '#181518';
        g.beginPath(); g.ellipse(0, 0, 6.0, 4.4, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(4.4, -3.4, 3.0, 2.6, -0.3, 0, 7); g.fill();
        g.beginPath(); g.moveTo(6.6, -3.6); g.lineTo(12, -2.6); g.lineTo(6.6, -1.6);
        g.closePath(); g.fill();                                             // beak
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(side * 2, -1);
          g.quadraticCurveTo(side * 11, -3 + flap * 5, side * 17, 2 + flap * 6);
          g.quadraticCurveTo(side * 10, 3 + flap * 2, side * 2, 3);
          g.closePath(); g.fill();
        }
        if (c.state === 'perch') { g.strokeStyle = '#181518'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(-1, 4); g.lineTo(-1, 8); g.moveTo(2, 4); g.lineTo(2, 8); g.stroke(); }
        g.fillStyle = c.state === 'dive' ? 'rgba(255,180,120,.95)' : 'rgba(200,180,160,.7)';
        g.fillRect(4.6, -4.2, 1.4, 1.4);
        g.restore();

      } else if (c.kind === 'bat') {
        const flap = Math.sin(c.wing) * 0.9;
        g.save(); g.translate(c.x, c.y);
        g.fillStyle = c.flee > 0 ? '#2e2429' : '#241d22';
        g.beginPath(); g.ellipse(0, 0, 3.4, 4.2, 0, 0, 7); g.fill();
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(side * 2.4, -1);
          g.quadraticCurveTo(side * 10, -4 + flap * 4, side * 15, 1 + flap * 5);
          g.quadraticCurveTo(side * 9, 2 + flap * 2, side * 2.4, 3);
          g.closePath(); g.fill();
        }
        // eyeshine — the only part of them that catches Ember's light
        g.fillStyle = c.state === 'seek' ? 'rgba(255,150,110,.95)' : 'rgba(210,170,150,.6)';
        g.fillRect(-2.2, -1.6, 1.5, 1.5); g.fillRect(0.8, -1.6, 1.5, 1.5);
        g.restore();
      } else {
        g.strokeStyle = 'rgba(150,140,130,.30)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(c.hx, c.hy - 8); g.lineTo(c.x, c.y); g.stroke();
        g.save(); g.translate(c.x, c.y);
        g.strokeStyle = c.flee > 0 ? '#3a2f2b' : '#2a2320'; g.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          const a = 0.5 + i * 0.42, k = Math.sin(t * 0.07 + i) * 1.2;
          for (const side of [-1, 1]) {
            g.beginPath(); g.moveTo(0, 0);
            g.lineTo(side * Math.cos(a) * 6, Math.sin(a) * 4 - 3 + k);
            g.lineTo(side * Math.cos(a) * 9, Math.sin(a) * 7 + 1 + k);
            g.stroke();
          }
        }
        g.fillStyle = '#241d1a';
        g.beginPath(); g.ellipse(0, 0, 4.2, 3.4, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,170,130,.75)';
        g.fillRect(-1.8, -1.2, 1.2, 1.2); g.fillRect(0.7, -1.2, 1.2, 1.2);
        g.restore();
      }
    }
  }

  count() { return this.list.filter(c => !c.gone).length; }
}
