/**
 * Procedural rune sigils — original vector art, generated per calling.
 *
 * Deliberately not illustration: concentric rune circles and contract seals are
 * genre-generic furniture owned by nobody, they cost no download, they scale
 * cleanly at 380px, and they carry zero IP surface. The geometry is derived
 * from a hash of the calling's id, so a given calling always draws the same
 * sigil and no two are alike.
 */

import { hashSeed, createRng } from '../engine/rng.js';

const NS = 'http://www.w3.org/2000/svg';

const TINT = {
  warden: { ring: '#e8c37a', ink: '#f0dcb4', glow: 'rgba(232,195,122,.30)' },
  stray: { ring: '#4fd1c5', ink: '#a9ece5', glow: 'rgba(79,209,197,.26)' },
  sworn: { ring: '#d9455f', ink: '#f0879a', glow: 'rgba(217,69,95,.28)' },
  hollow: { ring: '#a78bfa', ink: '#cbb8ff', glow: 'rgba(167,139,250,.32)' },
};

function svg(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

/**
 * @param {string} roleId
 * @param {number} [size]
 */
export function makeSigil(roleId, size = 74) {
  // Imported lazily to avoid a cycle: roles.js does not import this module.
  const type = SIGIL_TYPE[roleId] || 'warden';
  const t = TINT[type] || TINT.warden;
  const rng = createRng(hashSeed(`sigil:${roleId}`));

  const root = svg('svg', {
    class: 'sigil', width: size, height: size, viewBox: '0 0 100 100',
    role: 'img', 'aria-label': `Sigil of the ${roleId}`,
  });

  // Outer ring
  root.append(svg('circle', { cx: 50, cy: 50, r: 44, fill: 'none', stroke: t.ring, 'stroke-opacity': .28, 'stroke-width': 1 }));
  // Inner ring, dashed, rotated by hash
  const dash = 2 + rng.int(5);
  const inner = svg('circle', {
    cx: 50, cy: 50, r: 36, fill: 'none', stroke: t.ring, 'stroke-opacity': .55,
    'stroke-width': 1.2, 'stroke-dasharray': `${dash} ${dash + 2}`,
    transform: `rotate(${rng.int(360)} 50 50)`,
  });
  root.append(inner);

  // Rune spokes — n points on the inner circle, joined into a star polygon.
  const points = 5 + rng.int(4);           // 5..8
  const skip = 2 + rng.int(Math.max(1, Math.floor(points / 2) - 1));
  const R = 28;
  const at = (i) => {
    const a = (-90 + (360 / points) * i) * (Math.PI / 180);
    return [50 + R * Math.cos(a), 50 + R * Math.sin(a)];
  };
  let d = '';
  for (let i = 0, k = 0; i < points; i++) {
    const [x, y] = at(k);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    k = (k + skip) % points;
  }
  d += 'Z';
  root.append(svg('path', { d, fill: 'none', stroke: t.ink, 'stroke-opacity': .85, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }));

  // Seal blot at the centre
  root.append(svg('circle', { cx: 50, cy: 50, r: 6 + rng.int(4), fill: t.glow, stroke: t.ring, 'stroke-width': .8 }));

  // Tick marks around the outer ring
  const ticks = 8 + rng.int(9);
  for (let i = 0; i < ticks; i++) {
    const a = ((360 / ticks) * i) * (Math.PI / 180);
    const r1 = 44, r2 = 44 - (2 + rng.int(4));
    root.append(svg('line', {
      x1: (50 + r1 * Math.cos(a)).toFixed(2), y1: (50 + r1 * Math.sin(a)).toFixed(2),
      x2: (50 + r2 * Math.cos(a)).toFixed(2), y2: (50 + r2 * Math.sin(a)).toFixed(2),
      stroke: t.ring, 'stroke-opacity': .45, 'stroke-width': 1,
    }));
  }
  return root;
}

/** roleId -> tint family. Kept here so roles.js stays presentation-free. */
const SIGIL_TYPE = {
  threadreader: 'warden', cataloguer: 'warden', inquisitor: 'warden', hearthkeeper: 'warden',
  resonant: 'warden', glassreader: 'warden', ashReader: 'warden', wardsmith: 'warden',
  beastcaller: 'warden', oathbound: 'warden', hexbreaker: 'warden', bulwark: 'warden',
  chancellor: 'warden',
  bondservant: 'stray', mistaken: 'stray', wraithTouched: 'stray', sanctified: 'stray',
  blightbinder: 'sworn', veilwalker: 'sworn', successor: 'sworn', riftwarden: 'sworn',
  hollowOne: 'hollow',
};

export { SIGIL_TYPE };
