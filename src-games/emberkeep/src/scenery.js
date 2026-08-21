// Emberkeep — the scenery layer.
//
// Everything in here is NON-SOLID and NON-FLAMMABLE by construction: decor lives in room.decor,
// not in room.grid, and neither the physics nor the solver ever reads room.decor. A decorative
// urn cannot change a jump envelope because there is no code path from it to one.
//
// The job of this layer is to give the keep things the light can FALL ON. A room made only of
// floor tiles has nothing to catch a highlight, so the light has nothing to describe and the
// scene reads flat no matter how good the lighting maths is. Arches, pillars, benches and
// hanging chains exist to be surfaces.
//
// Secondary motion (chains, banners, cobwebs, drips) is a per-object PHASE OFFSET on one shared
// clock. The phase offset is the whole trick: without it every chain in the room swings in
// lockstep, which reads as a screensaver rather than as a draught.

import { GLOW, blit } from './sprites.js';

const T = 24;

// A surface is only interesting if it is lit unevenly. `lit` is the light field's shade at this
// point: amt is how much light reaches it, nx/ny is which way the light is coming from.
function face(g, x, y, w, h, base, lit, warm) {
  const a = lit.amt;
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  if (a <= 0.02) return;
  // the lit edge: whichever face points at the light
  const k = Math.min(0.55, a * 0.75);
  g.fillStyle = `rgba(${255},${196 + warm * 30 | 0},${140 + warm * 40 | 0},${k * 0.5})`;
  if (lit.ny < -0.25) g.fillRect(x, y, w, Math.max(1, h * 0.18));
  if (lit.ny > 0.25) g.fillRect(x, y + h - Math.max(1, h * 0.18), w, Math.max(1, h * 0.18));
  if (lit.nx < -0.25) g.fillRect(x, y, Math.max(1, w * 0.18), h);
  if (lit.nx > 0.25) g.fillRect(x + w - Math.max(1, w * 0.18), y, Math.max(1, w * 0.18), h);
  // and the shaded edge opposite it
  g.fillStyle = `rgba(0,0,0,${k * 0.42})`;
  if (lit.ny < -0.25) g.fillRect(x, y + h - Math.max(1, h * 0.16), w, Math.max(1, h * 0.16));
  if (lit.ny > 0.25) g.fillRect(x, y, w, Math.max(1, h * 0.16));
}

// The sconces are LIGHTS, so the render pass alone cannot place them — the light field has to
// know about them before anything is drawn. This is called during the lighting pass.
export function sconceLights(room, field, t, flick) {
  if (!room.decor) return;
  for (const d of room.decor) {
    if (d.k !== 'sconce') continue;
    const ph = d.r * 0.061;
    const w = Math.sin(t * 0.031 + ph) * 0.5 + Math.sin(t * 0.0117 + ph * 2.3) * 0.5;
    const gain = 1 + w * 0.16 + flick * 0.12;
    field.add(d.x * T + 12 + w * 2, d.y * T + 6, 205 * gain, 255, 176, 92, 0.78 * gain);
  }
}

// BACKGROUND decor: drawn before the tiles, so geometry occludes it and the room gains a behind.
export function drawBack(g, room, field, t) {
  if (!room.decor) return;
  for (const d of room.decor) {
    const px = d.x * T, py = d.y * T, ph = d.r * 0.0628;
    switch (d.k) {
      case 'arch': {
        const lit = field.shadeAt(px + 12, py + 12);
        const a = 0.42 + lit.amt * 0.55;
        g.strokeStyle = `rgba(${58 + lit.amt * 90 | 0},${54 + lit.amt * 76 | 0},${46 + lit.amt * 56 | 0},${a})`;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(px - 34, py + 96); g.quadraticCurveTo(px + 12, py - 30, px + 58, py + 96);
        g.stroke();
        g.lineWidth = 1;
        break;
      }
      case 'pillar': {
        const lit = field.shadeAt(px + 12, py - 30);
        const h = 96 * d.s;
        face(g, px + 4, py - h + 20, 16, h, `rgba(52,49,42,${0.42 + lit.amt * 0.4})`, lit, 0.2);
        g.fillStyle = `rgba(64,60,50,${0.4 + lit.amt * 0.45})`;
        g.fillRect(px, py - h + 16, 24, 6);
        break;
      }
      case 'root': {
        const lit = field.shadeAt(px + 12, py + 20);
        g.strokeStyle = `rgba(${44 + lit.amt * 60 | 0},${40 + lit.amt * 48 | 0},${32 + lit.amt * 30 | 0},${0.35 + lit.amt * 0.4})`;
        g.lineWidth = 3.5;
        g.beginPath(); g.moveTo(px + 12, py - 20);
        g.bezierCurveTo(px + 2, py + 20, px + 26, py + 44, px + 10, py + 78);
        g.stroke(); g.lineWidth = 1;
        break;
      }
      case 'banner': {
        const lit = field.shadeAt(px + 12, py + 30);
        const sway = Math.sin(t * 0.017 + ph) * 5 + Math.sin(t * 0.0071 + ph * 1.7) * 3;
        g.fillStyle = `rgba(${72 + lit.amt * 70 | 0},${44 + lit.amt * 40 | 0},${38 + lit.amt * 26 | 0},${0.34 + lit.amt * 0.42})`;
        g.beginPath();
        g.moveTo(px, py); g.lineTo(px + 20, py);
        g.lineTo(px + 20 + sway, py + 62); g.lineTo(px + sway, py + 62);
        g.closePath(); g.fill();
        break;
      }
    }
  }
}

// FOREGROUND decor: drawn after Ember, so things pass in FRONT of him. A scene where nothing
// ever occludes the player is exactly two planes deep no matter how many background layers it
// has — this is the cheapest depth cue available and the game had none of it.
export function drawFront(g, gg, room, field, t) {
  if (!room.decor) return;
  for (const d of room.decor) {
    const px = d.x * T, py = d.y * T, ph = d.r * 0.0628;
    switch (d.k) {
      case 'sconce': {
        const w = Math.sin(t * 0.031 + ph) * 0.5 + Math.sin(t * 0.0117 + ph * 2.3) * 0.5;
        g.fillStyle = '#33302a'; g.fillRect(px + 6, py + 8, 12, 9);
        g.fillStyle = '#413c33'; g.fillRect(px + 4, py + 6, 16, 3);
        g.fillStyle = '#2a2722'; g.fillRect(px + 10, py + 17, 4, 7);
        gg.globalCompositeOperation = 'lighter';
        blit(gg, GLOW.hot, px + 12 + w * 1.5, py + 2 - w, 17 + w * 3, 0.85);
        blit(gg, GLOW.warm, px + 12, py + 4, 9, 0.9);
        gg.globalCompositeOperation = 'source-over';
        break;
      }
      case 'chain': {
        const lit = field.shadeAt(px + 12, py + 40);
        const links = 7 + (d.r % 5);
        const a = 0.24 + lit.amt * 0.55;
        g.strokeStyle = `rgba(${86 + lit.amt * 90 | 0},${82 + lit.amt * 80 | 0},${72 + lit.amt * 60 | 0},${a})`;
        g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i <= links; i++) {
          const yy = py + i * 11;
          const xx = px + 12 + Math.sin(t * 0.019 + ph + i * 0.22) * (1.2 + i * 0.42);
          i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
        }
        g.stroke(); g.lineWidth = 1;
        break;
      }
      case 'cobweb': {
        const lit = field.shadeAt(px + 12, py + 12);
        const a = 0.10 + lit.amt * 0.42;
        g.strokeStyle = `rgba(196,190,176,${a})`;
        g.lineWidth = 0.9;
        const br = Math.sin(t * 0.013 + ph) * 1.6;
        for (let i = 0; i < 4; i++) {
          g.beginPath(); g.moveTo(px, py);
          g.lineTo(px + 6 + i * 9 + br, py + 30 - i * 5);
          g.stroke();
        }
        for (let r = 1; r <= 3; r++) {
          g.beginPath(); g.moveTo(px, py);
          g.quadraticCurveTo(px + r * 8 + br, py + r * 5, px + r * 6 + br, py + r * 10);
          g.stroke();
        }
        g.lineWidth = 1;
        break;
      }
      case 'drip': {
        const lit = field.shadeAt(px + 12, py + 12);
        const period = 150 + (d.r % 60);
        const u = ((t + d.r * 3) % period) / period;
        const yy = py + 8 + u * u * 150;
        g.fillStyle = `rgba(${150 + lit.amt * 90 | 0},${176 + lit.amt * 60 | 0},${200 + lit.amt * 40 | 0},${0.20 + lit.amt * 0.55})`;
        g.beginPath(); g.ellipse(px + 12, yy, 1.4, 3.2, 0, 0, 7); g.fill();
        break;
      }
    }
  }
}

// MIDGROUND decor: furniture, drawn with the tiles so it sits on the floor at the right depth.
export function drawMid(g, room, field, t) {
  if (!room.decor) return;
  for (const d of room.decor) {
    const px = d.x * T, py = d.y * T;
    switch (d.k) {
      case 'bench': {
        const lit = field.shadeAt(px + 12, py + 10);
        face(g, px + 1, py + 10, 22, 5, `rgba(60,56,47,${0.5 + lit.amt * 0.4})`, lit, 0.15);
        g.fillStyle = `rgba(40,37,31,${0.5 + lit.amt * 0.35})`;
        g.fillRect(px + 3, py + 15, 4, 9); g.fillRect(px + 17, py + 15, 4, 9);
        break;
      }
      case 'shelf': {
        const lit = field.shadeAt(px + 12, py + 6);
        face(g, px, py + 4, 24, 4, `rgba(56,52,44,${0.5 + lit.amt * 0.4})`, lit, 0.15);
        for (let i = 0; i < 3; i++) {
          const s = 4 + (i % 2) * 1.6;
          g.fillStyle = `rgba(${74 + lit.amt * 70 | 0},${66 + lit.amt * 56 | 0},${54 + lit.amt * 40 | 0},${0.45 + lit.amt * 0.4})`;
          g.beginPath(); g.ellipse(px + 5 + i * 7, py + 1, s * 0.6, s, 0, 0, 7); g.fill();
        }
        break;
      }
      case 'bones': {
        const lit = field.shadeAt(px + 12, py + 20);
        g.fillStyle = `rgba(${146 + lit.amt * 70 | 0},${140 + lit.amt * 60 | 0},${124 + lit.amt * 44 | 0},${0.18 + lit.amt * 0.42})`;
        g.fillRect(px + 3, py + 20, 11, 2);
        g.fillRect(px + 8, py + 17, 9, 2);
        g.beginPath(); g.ellipse(px + 17, py + 20, 3.4, 3, 0, 0, 7); g.fill();
        break;
      }
      case 'grate': {
        const lit = field.shadeAt(px + 12, py + 4);
        g.fillStyle = `rgba(10,9,9,${0.5 + lit.amt * 0.3})`;
        g.fillRect(px + 2, py + 2, 20, 8);
        g.fillStyle = `rgba(${88 + lit.amt * 80 | 0},${82 + lit.amt * 66 | 0},${70 + lit.amt * 48 | 0},${0.30 + lit.amt * 0.5})`;
        for (let i = 0; i < 4; i++) g.fillRect(px + 3 + i * 5, py + 2, 2, 8);
        break;
      }
    }
  }
}
