// Local-only picture export: SVG → canvas → PNG → a download link. No network,
// no hosted link, no permission beyond what an extension page already has.

import { renderCreature } from '../art/creature.js';
import { BY_KEY } from '../lib/species.js';

export async function snapshotBlob(creature, size = 512) {
  const svg = renderCreature(creature.key, { expr: creature.expr, uid: 'snap' });
  const src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = size; c.height = Math.round(size * 1.18);
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#f7d9b5'); bg.addColorStop(0.62, '#cfe3e8'); bg.addColorStop(0.62, '#9cbf6f'); bg.addColorStop(1, '#6f9b52');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, size * 0.08, size * 0.02, size * 0.84, size * 0.84);
    g.fillStyle = 'rgba(255,250,240,0.92)';
    g.fillRect(0, size * 0.9, size, c.height - size * 0.9);
    g.fillStyle = '#2b241f';
    g.textAlign = 'center';
    g.font = `700 ${Math.round(size * 0.075)}px system-ui, sans-serif`;
    g.fillText(creature.name, size / 2, size * 1.0);
    g.font = `${Math.round(size * 0.04)}px system-ui, sans-serif`;
    g.fillStyle = '#5f5347';
    g.fillText(`${BY_KEY[creature.key].kind} at Creature Camp`, size / 2, size * 1.06);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFileName(name) {
  return (String(name).replace(/[^a-z0-9 _-]/gi, '').trim().replace(/\s+/g, '-') || 'creature').slice(0, 32);
}
