// Emberkeep — the portrait and the speech bubble.
//
// The in-world Ember is ~16px tall. At that size a face is a rumour: two dots and a hope.
// So the acting moved to a PORTRAIT in the corner — a bust big enough to carry a mouth, a
// brow, eyelids and a shoulder line, driven by the same expression blend as the sprite.
// The sprite stays small and readable; the portrait does the performing.

import { MANE, blit, ramp } from './sprites.js';

const MOUTHS = {
  content:    'M-7,7 Q0,12 7,7',
  joyful:     'M-9,4 Q0,17 9,4 Q0,9 -9,4',
  curious:    'o',
  determined: 'M-7,8 L7,8',
  worried:    'M-8,9 Q-4,5 0,9 Q4,13 8,8',
  guilty:     'M-7,11 Q0,4 7,11',
  flinch:     'grit',
  sleepy:     'o',
  guttering:  'M-6,10 Q-3,6 0,10 Q3,14 6,9',
};

// A bust, drawn at (x, y) = bottom-centre of the portrait. Body language first, face second.
export function drawPortrait(g, gc, x, y, expr, B, t, scale = 1) {
  g.save(); gc.save();
  g.translate(x, y); g.scale(scale, scale); g.translate(-x, -y);
  gc.translate(x, y); gc.scale(scale, scale); gc.translate(-x, -y);
  _bust(g, gc, x, y, expr, B, t);
  g.restore(); gc.restore();
}

// A framed corner panel, so the portrait reads as UI and not as a second creature in the room.
export function drawPortraitFrame(g, x, y, w, h) {
  g.save();
  g.fillStyle = 'rgba(14,13,11,.78)';
  g.strokeStyle = 'rgba(226,196,140,.16)';
  g.lineWidth = 1;
  round(g, x, y, w, h, 8);
  g.fill(); g.stroke();
  g.restore();
}

// tiny memo for the bust's linear gradients — they depend on one quantised value each, so a
// keyed cache turns three allocations a frame into three for the lifetime of the page.
const _linCache = new Map();
function _lin(g, id, key, build) {
  const k = id + ':' + key;
  let v = _linCache.get(k);
  if (!v) { v = build(); _linCache.set(k, v); if (_linCache.size > 64) _linCache.clear(); }
  return v;
}

function _bust(g, gc, x, y, expr, B, t) {
  const lean = B.lean * 6 + (expr === 'guilty' ? -3 : 0);
  const slump = B.squash * 10 + (expr === 'sleepy' ? 3 : 0);
  const breathe = Math.sin(t * 0.035) * 0.8;

  // ---- the mane, additive into the glow buffer so it matches the sprite's fire
  const hx = x + lean * 0.6, hy = y - 44 + slump * 0.4 + breathe;
  gc.globalCompositeOperation = 'lighter';
  const H = 96 * (0.7 + 0.45 * B.h);      // matches the sprite's proportion: mane ~2.5x the head
  for (let i = 0; i < 40; i++) {
    const u = i / 39;
    const sway = (Math.sin(t * 0.05 - i * 0.22) * 0.75 + Math.sin(t * 0.087 - i * 0.11) * 0.25) * (3 + 8 * B.agit) * Math.pow(u, 1.4);
    const px = hx + sway + B.lean * 9 * u, py = hy - 8 - u * H;
    const r = (17 * Math.pow(1 - u, 0.72) + 1.8);
    const hot = Math.pow(1 - u, 1.7);
    const a = (0.20 + 0.17 * hot) * (0.55 + 0.45 * B.warm) * Math.min(1, u / 0.13);
    blit(gc, ramp(MANE, hot), px, py, r, a);      // was 40 fresh gradients a frame, for a HUD element
  }
  gc.globalCompositeOperation = 'source-over';

  // ---- shoulders + head
  g.save();
  g.translate(x, y + breathe);

  // shoulder shading — a warm rim from the fire overhead and a dark underside.
  // Cached by rounded slump: the gradient only depends on that, and it moves in tiny steps.
  g.fillStyle = _lin(g, 'sh', Math.round(slump), () => {
    const q = g.createLinearGradient(0, -22 + slump, 0, 6);
    q.addColorStop(0, '#5b453b'); q.addColorStop(0.45, '#3d2e28'); q.addColorStop(1, '#241b17');
    return q;
  });
  g.beginPath();
  g.moveTo(-22 + lean * 0.3, 4);
  g.quadraticCurveTo(-16 + lean, -18 + slump, 0 + lean, -20 + slump);
  g.quadraticCurveTo(16 + lean, -18 + slump, 22 + lean * 0.3, 4);
  g.closePath(); g.fill();

  g.translate(lean, slump * 0.4);
  // the head is lit from above by his own fire: hot crown, cool jaw, and a soft terminator
  g.fillStyle = _lin(g, 'hd', Math.round(B.warm * 20), () => {
    const q = g.createLinearGradient(0, -66, 0, -22);
    q.addColorStop(0, `rgba(${Math.round(214 * B.warm)},${Math.round(168 * B.warm)},140,1)`);
    q.addColorStop(0.38, '#9c8f96');
    q.addColorStop(1, '#5f565e');
    return q;
  });
  g.beginPath(); g.ellipse(0, -44, 19, 22, 0, 0, 7); g.fill();
  // occlusion where the skull meets the shoulders
  g.fillStyle = _lin(g, 'oc', 0, () => {
    const q = g.createLinearGradient(0, -30, 0, -18);
    q.addColorStop(0, 'rgba(20,15,14,0)'); q.addColorStop(1, 'rgba(20,15,14,.55)');
    return q;
  });
  g.beginPath(); g.ellipse(0, -44, 19, 22, 0, 0, 7); g.fill();
  // ears — the clearest body-language channel he has
  const ear = B.ear;
  g.fillStyle = `rgba(${Math.round(196 * B.warm)},${Math.round(154 * B.warm)},132,1)`;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(side * 16, -54);
    g.lineTo(side * (19 + ear * 8), -74 + ear * 20);
    g.lineTo(side * 7, -60);
    g.closePath(); g.fill();
  }

  // ---- face
  const lid = B.lid;
  g.fillStyle = '#241b19';
  if (expr === 'flinch' || lid > 0.85) {
    for (const sx of [-7.5, 7.5]) { g.fillRect(sx - 4.5, -47, 9, 2.2); }
  } else {
    for (const sx of [-7.5, 7.5]) {
      const ry = 5.6 * (1 - lid * 0.85);
      g.beginPath(); g.ellipse(sx, -46, 4.2, Math.max(0.9, ry), 0, 0, 7); g.fill();
      if (ry > 2.5) {
        g.fillStyle = 'rgba(255,214,170,.85)';
        g.beginPath(); g.arc(sx - 1.3, -47.6, 1.25, 0, 7); g.fill();
        g.fillStyle = '#241b19';
      }
    }
  }

  // brow: driven by ear droop, which already encodes the mood
  g.strokeStyle = '#4a3c3a'; g.lineWidth = 2.1; g.lineCap = 'round';
  const bl = ear * 4;
  g.beginPath(); g.moveTo(-13, -55 + bl); g.lineTo(-3, -57 - bl * 0.4); g.stroke();
  g.beginPath(); g.moveTo(13, -55 + bl); g.lineTo(3, -57 - bl * 0.4); g.stroke();

  // mouth
  const m = MOUTHS[expr] || MOUTHS.content;
  g.save(); g.translate(0, -34);
  if (m === 'o') {
    g.fillStyle = '#241b19';
    g.beginPath(); g.ellipse(0, 7, 3.4, 4.4, 0, 0, 7); g.fill();
  } else if (m === 'grit') {
    g.strokeStyle = '#241b19'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-8, 6); g.lineTo(8, 6); g.stroke();
    for (const gx of [-6, -2, 2, 6]) { g.beginPath(); g.moveTo(gx, 6); g.lineTo(gx, 11); g.stroke(); }
  } else {
    g.strokeStyle = '#241b19'; g.lineWidth = 2.2; g.lineJoin = 'round';
    const p = new Path2D(m);
    if (expr === 'joyful') { g.fillStyle = '#241b19'; g.fill(p); }
    g.stroke(p);
  }
  g.restore();
  g.restore();
}

// ---- speech bubble --------------------------------------------------------
// Anchored to Ember and clamped inside the play area, so the words are where the eyes are.
// `avoid` is Ember's occupied rectangle INCLUDING his flame. The bubble tries above, then the
// two sides at head height, then below — and takes the first placement that clears him and fits
// on screen. It never simply overlaps: covering the character is covering the performance.
export function drawBubble(g, ax, ay, text, alpha, W = 960, H = 480, avoid = null) {
  if (!text || alpha <= 0.01) return;
  g.save();
  g.font = 'italic 400 14px ui-serif, Georgia, serif';

  const maxW = 240;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);

  const lh = 18, padX = 12, padY = 10;
  const bw = Math.min(maxW, Math.max(...lines.map(l => g.measureText(l).width))) + padX * 2;
  const bh = lines.length * lh + padY * 2;

  const hits = (x, y) => avoid && x < avoid.x1 + 6 && x + bw > avoid.x0 - 6 && y < avoid.y1 + 6 && y + bh > avoid.y0 - 6;
  const onScreen = (x, y) => x >= 6 && x + bw <= W - 6 && y >= 6 && y + bh <= H - 6;

  const cand = [
    { x: ax - bw / 2, y: (avoid ? avoid.y0 : ay) - bh - 14, tail: 'down' },
    { x: (avoid ? avoid.x1 : ax) + 16, y: ay - bh / 2, tail: 'left' },
    { x: (avoid ? avoid.x0 : ax) - bw - 16, y: ay - bh / 2, tail: 'right' },
    { x: ax - bw / 2, y: (avoid ? avoid.y1 : ay) + 16, tail: 'up' },
  ];
  let pick = null;
  for (const c of cand) {
    const x = Math.max(6, Math.min(W - bw - 6, c.x));
    if (onScreen(x, c.y) && !hits(x, c.y)) { pick = { ...c, x }; break; }
  }
  if (!pick) {   // nowhere clean: sit it in the top-left gutter rather than on top of him
    pick = { x: 12, y: 12, tail: 'none' };
  }
  const bx = pick.x, by = pick.y, flip = pick.tail === 'up';

  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(24,21,18,.90)';
  g.strokeStyle = 'rgba(226,196,140,.28)';
  g.lineWidth = 1;
  round(g, bx, by, bw, bh, 9);
  g.fill(); g.stroke();

  // tail, pointing back at whoever is talking
  g.fillStyle = 'rgba(24,21,18,.90)';
  g.beginPath();
  if (pick.tail === 'down') {
    const tx = Math.max(bx + 14, Math.min(bx + bw - 14, ax));
    g.moveTo(tx - 6, by + bh); g.lineTo(tx + 6, by + bh); g.lineTo(tx, by + bh + 10);
  } else if (pick.tail === 'up') {
    const tx = Math.max(bx + 14, Math.min(bx + bw - 14, ax));
    g.moveTo(tx - 6, by); g.lineTo(tx + 6, by); g.lineTo(tx, by - 10);
  } else if (pick.tail === 'left') {
    const ty = Math.max(by + 12, Math.min(by + bh - 12, ay));
    g.moveTo(bx, ty - 6); g.lineTo(bx, ty + 6); g.lineTo(bx - 10, ty);
  } else if (pick.tail === 'right') {
    const ty = Math.max(by + 12, Math.min(by + bh - 12, ay));
    g.moveTo(bx + bw, ty - 6); g.lineTo(bx + bw, ty + 6); g.lineTo(bx + bw + 10, ty);
  }
  g.closePath(); g.fill();

  g.fillStyle = '#e6dbc6';
  g.textAlign = 'left'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, bx + padX, by + padY + i * lh));
  g.textBaseline = 'alphabetic';
  g.globalAlpha = 1;
  g.restore();
}

function round(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- achievement toast ----------------------------------------------------
export function drawToast(g, name, hint, alpha, W = 800) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  const bw = 236, bh = 46, bx = W - bw - 14, by = 14;
  g.fillStyle = 'rgba(26,22,18,.93)';
  g.strokeStyle = 'rgba(255,170,70,.45)';
  g.lineWidth = 1;
  round(g, bx, by, bw, bh, 8); g.fill(); g.stroke();
  const gr = g.createRadialGradient(bx + 22, by + 23, 0, bx + 22, by + 23, 15);
  gr.addColorStop(0, 'rgba(255,214,150,.95)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(bx + 22, by + 23, 15, 0, 7); g.fill();
  g.textAlign = 'left';
  g.fillStyle = '#f0e4cd'; g.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  g.fillText(name, bx + 44, by + 21);
  g.fillStyle = '#a2988a'; g.font = '400 11px ui-sans-serif, system-ui, sans-serif';
  g.fillText(hint, bx + 44, by + 36);
  g.globalAlpha = 1;
  g.restore();
}
