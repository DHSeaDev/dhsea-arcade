// SHARE CARDS — a 1200x630 PNG generated entirely on-device.
//
// Nothing is uploaded and no network call exists: the card is drawn to a canvas from
// the same renderers the game uses, then handed to the user as a Blob download and a
// clipboard image. preship check 9 (privacy egress) fails the bundle if this file ever
// grows a fetch, so "share" here means "you now have a file", never "we sent it".
//
// Four kinds, because four different things are worth showing: a payout, a milestone
// score, a new critter, and the playground. They share one frame so a feed of them
// reads as one game.

import { renderCritter } from '../art/critter.js';
import { themeOf } from '../lib/themes.js';

const W = 1200, H = 630;

const fmtN = (n) => {
  if (!Number.isFinite(n)) return '—';
  const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  let i = 0, v = Math.abs(n);
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return (v < 10 && i > 0 ? v.toFixed(2) : v < 100 && i > 0 ? v.toFixed(1) : Math.round(v).toString()) + u[i];
};

function svgToImage(svg, size) {
  return new Promise((resolve) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    // A card that silently omits its art is worse than a card that draws a gap: resolve
    // with null and let the caller lay out around it rather than hanging forever.
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.width = size; img.height = size;
    img.src = url;
  });
}

function frame(g, theme) {
  const t = themeOf(theme);
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, t.id === 'verdant' ? '#071009' : '#080c18');
  grad.addColorStop(1, t.id === 'verdant' ? '#0d1c12' : '#141033');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  const glow = g.createRadialGradient(W * 0.5, -60, 40, W * 0.5, -60, 760);
  glow.addColorStop(0, t.id === 'verdant' ? 'rgba(134,239,172,.22)' : 'rgba(139,233,253,.20)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 2;
  g.strokeRect(24, 24, W - 48, H - 48);

  g.font = '700 22px ui-sans-serif,system-ui,sans-serif';
  g.fillStyle = 'rgba(233,237,251,.62)';
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText('LUMENREEL · PRISM CRASH', 56, 74);
  g.font = '600 18px ui-sans-serif,system-ui,sans-serif';
  g.fillStyle = 'rgba(233,237,251,.34)';
  g.textAlign = 'right';
  g.fillText('time is the only currency · no money, ever', W - 56, 74);
  return t;
}

function bigText(g, lines) {
  g.textAlign = 'left';
  // Leading is driven by the NEXT line's size, not the current one's. Advancing by
  // 1.18x a 132px headline left a 156px hole above a 46px subhead, which reads as a
  // layout bug rather than emphasis.
  let y = 200;
  for (let i = 0; i < lines.length; i++) {
    const [text, size, colour, weight] = lines[i];
    g.font = `${weight || 800} ${size}px ui-sans-serif,system-ui,sans-serif`;
    g.fillStyle = colour;
    g.fillText(text, 56, y);
    const next = lines[i + 1];
    y += size * 0.34 + (next ? next[1] * 1.05 : 0);
  }
  return y;
}

/**
 * @param {'payout'|'score'|'critter'|'playground'} kind
 * @param {object} data
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function buildCard(kind, data) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const t = frame(g, data.theme);
  const FAC = t.id === 'verdant' ? '#86efac' : '#8be9fd';
  const LUM = '#ffd166';

  if (kind === 'payout') {
    bigText(g, [
      [`${fmtN(data.multiplier)}×`, 132, FAC],
      [`+${fmtN(data.facets)} ${t.featureNames.payout}`, 46, '#e9edfb'],
      [`from a ${fmtN(data.bet)} ${t.featureNames.currency} bet`, 26, 'rgba(233,237,251,.55)', 600],
    ]);
    if (data.features?.length) {
      g.font = '700 22px ui-sans-serif,system-ui,sans-serif';
      g.fillStyle = LUM;
      g.fillText(data.features.join('  ·  '), 56, 470);
    }
  } else if (kind === 'score') {
    bigText(g, [
      [data.title || 'Collection', 34, 'rgba(233,237,251,.55)', 700],
      [`${data.owned} / ${data.total}`, 122, FAC],
      [data.subtitle || '', 28, 'rgba(233,237,251,.55)', 600],
    ]);
    // A progress bar, because a fraction is easier to feel than to read.
    const bw = W - 112, bh = 16, by = 500;
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.fillRect(56, by, bw, bh);
    g.fillStyle = FAC;
    g.fillRect(56, by, bw * Math.max(0, Math.min(1, data.owned / data.total)), bh);
  } else if (kind === 'critter') {
    bigText(g, [
      ['NEW CRITTER', 26, 'rgba(233,237,251,.45)', 700],
      [data.species.name, 84, data.colour || FAC],
      [`${data.tierName} · ${data.species.set}`, 28, 'rgba(233,237,251,.6)', 600],
    ]);
    g.font = 'italic 600 26px ui-sans-serif,system-ui,sans-serif';
    g.fillStyle = 'rgba(233,237,251,.45)';
    g.fillText(`"${data.species.tag}"`, 56, 500);
    const img = await svgToImage(renderCritter(data.species, { size: 340 }), 340);
    if (img) g.drawImage(img, W - 400, H / 2 - 170, 340, 340);
  } else if (kind === 'playground') {
    bigText(g, [
      ['THE PLAYGROUND', 26, 'rgba(233,237,251,.45)', 700],
      [`${data.roster.length} of ${data.owned} collected`, 66, FAC],
      [data.line || '', 26, 'rgba(233,237,251,.55)', 600],
    ]);
    const n = Math.min(6, data.roster.length);
    const size = 150, gap = (W - 112 - n * size) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const img = await svgToImage(renderCritter(data.roster[i], { size }), size);
      if (img) g.drawImage(img, 56 + i * (size + gap), H - 250, size, size);
    }
  }
  return cv;
}

/** Hand the card to the user: a download, plus the clipboard where that is allowed. */
export async function shareCard(kind, data, filename) {
  const cv = await buildCard(kind, data);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  if (!blob) return { ok: false, copied: false };

  let copied = false;
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem === 'function') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      copied = true;
    }
  } catch { copied = false; }   // clipboard-image is permission-gated; the download still works

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `lumenreel-${kind}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, copied };
}


/**
 * A PNG of the Playground AS THE PLAYER SEES IT.
 *
 * Not a designed card — this is a screenshot the game takes of itself: same cast, same
 * positions, same facing, same names. It reads the live actor list rather than the save,
 * so what lands in the file is what was on screen when the button was pressed.
 *
 * Canvas taint: every image drawn here comes from a Blob URL built in this document from
 * markup this document generated. No external reference is fetched, so toBlob() is
 * allowed. If that ever stops being true the export fails loudly rather than silently
 * producing a blank file — see the explicit check below.
 */
export async function playgroundPng(actors, opts = {}) {
  const { theme = 'prism', title = 'The Playground', sub = '', scale = 2 } = opts;
  const w = Math.max(320, Math.round(opts.width || 1200));
  const h = Math.max(240, Math.round(opts.height || 700));
  const cv = document.createElement('canvas');
  cv.width = w * scale; cv.height = h * scale;
  const g = cv.getContext('2d');
  g.scale(scale, scale);

  const t = themeOf(theme);
  const verdant = t.id === 'verdant';
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, verdant ? '#0a1710' : '#0b1020');
  bg.addColorStop(1, verdant ? '#061009' : '#070a14');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w / 2, h * 1.15, 10, w / 2, h * 1.15, h * 1.1);
  glow.addColorStop(0, verdant ? 'rgba(163,230,53,.20)' : 'rgba(167,139,250,.20)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);

  // Decode every sprite first. A failed decode resolves null and is skipped rather than
  // hanging the export — the same contract svgToImage already uses for cards.
  const drawn = [];
  for (const a of actors) {
    const img = await svgToImage(renderCritter(a.sp, { size: a.size || 128, expression: a.expression }), a.size || 128);
    if (img) drawn.push({ ...a, img });
  }
  // Painter's algorithm on y, so a critter lower on the stage overlaps one behind it —
  // the same ordering the live stage uses for its z-index.
  drawn.sort((p, q) => (p.y || 0) - (q.y || 0));

  g.textAlign = 'center';
  for (const a of drawn) {
    const size = a.size || 128;
    const x = a.x + size / 2, y = a.y + size;
    g.save();
    g.globalAlpha = 0.30;
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(x, y - 6, size * 0.30, size * 0.09, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.save();
    g.translate(x, a.y);
    if (a.face === -1) g.scale(-1, 1);
    g.drawImage(a.img, -size / 2, 0, size, size);
    g.restore();
    if (a.name) {
      g.font = '600 13px Roboto, sans-serif';
      g.fillStyle = 'rgba(233,237,251,.62)';
      g.fillText(a.name, x, y + 14);
    }
  }

  g.textAlign = 'left';
  g.font = '800 22px Roboto, sans-serif';
  g.fillStyle = '#e9edfb';
  g.fillText(title, 26, 40);
  if (sub) {
    g.font = '600 14px Roboto, sans-serif';
    g.fillStyle = 'rgba(233,237,251,.55)';
    g.fillText(sub, 26, 62);
  }
  g.font = '700 12px Roboto, sans-serif';
  g.fillStyle = 'rgba(233,237,251,.40)';
  g.textAlign = 'right';
  g.fillText('LUMENREEL \u00b7 PRISM CRASH', w - 26, h - 22);

  const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
  if (!blob) throw new Error('the canvas refused to export (tainted or out of memory)');
  return blob;
}

/** Render the Playground and hand the player the file. */
export async function savePlaygroundPng(actors, opts = {}, filename = 'lumenreel-playground.png') {
  if (!actors.length) return false;
  const blob = await playgroundPng(actors, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
