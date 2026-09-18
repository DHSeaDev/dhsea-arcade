// Hats: a shared wardrobe any friend can wear. Drawn from the head anchor kit.js records
// when a face is built, so one hat fits every body plan without a per-species table.
// Nothing here affects play — a hat is something you earned and chose, and that is all.

import { el, g, path, ell, circ } from './kit.js';

// Hats sit a little ABOVE the head circle so ears and horns read underneath them.
const top = (head, lift = 0) => ({ x: head.x, y: head.y - head.R - 2 - lift, r: head.R });

export const HATS = Object.freeze([
  { id: 'acorn', name: 'Acorn cap', note: 'From the Firefly Lantern.' },
  { id: 'leaf', name: 'Leaf hat', note: 'One good leaf, worn with pride.' },
  { id: 'flower', name: 'Flower crown', note: 'Woven in the meadow.' },
  { id: 'mushroom', name: 'Mushroom cap', note: 'Borrowed from the hollow.' },
  { id: 'pinecone', name: 'Pinecone hat', note: 'Heavier than it looks.' },
  { id: 'straw', name: 'Straw hat', note: 'For a long, bright afternoon.' },
  { id: 'bobble', name: 'Bobble hat', note: 'Knitted for cold mornings.' },
  { id: 'lantern', name: 'Lantern hat', note: 'A very small light.' },
  { id: 'feather', name: 'Feather band', note: 'A wren left it behind.' },
  { id: 'crown', name: 'Crown of twigs', note: 'For a camp that is complete.' },
]);
export const HAT_IDS = HATS.map((h) => h.id);
export const isHat = (id) => typeof id === 'string' && HAT_IDS.includes(id);

const DRAW = {
  acorn: (h) => {
    const t = top(h, -2);
    return [
      path(`M${t.x - t.r * 0.74},${t.y + 5} C${t.x - t.r * 0.72},${t.y - 10} ${t.x + t.r * 0.72},${t.y - 10} ${t.x + t.r * 0.74},${t.y + 5} Z`, { fill: '#6b4424', stroke: '#3e2614', 'stroke-width': 1.2 }),
      path(`M${t.x - t.r * 0.5},${t.y - 1} q${t.r * 0.5},3 ${t.r},0`, { fill: 'none', stroke: '#3e2614', 'stroke-width': 0.9 }),
      path(`M${t.x},${t.y - 7} l0,-4`, { stroke: '#3e2614', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    ];
  },
  leaf: (h) => {
    const t = top(h, 0);
    return [
      path(`M${t.x - t.r * 0.8},${t.y + 4} C${t.x - t.r * 0.5},${t.y - 12} ${t.x + t.r * 0.5},${t.y - 14} ${t.x + t.r * 0.85},${t.y - 2} C${t.x + t.r * 0.4},${t.y + 6} ${t.x - t.r * 0.3},${t.y + 7} ${t.x - t.r * 0.8},${t.y + 4} Z`, { fill: '#6fae4c', stroke: '#35602a', 'stroke-width': 1.1 }),
      path(`M${t.x - t.r * 0.7},${t.y + 3} L${t.x + t.r * 0.7},${t.y - 4}`, { stroke: '#35602a', 'stroke-width': 0.9 }),
    ];
  },
  flower: (h) => {
    const t = top(h, -1);
    const out = [path(`M${t.x - t.r * 0.85},${t.y + 5} C${t.x - t.r * 0.4},${t.y - 4} ${t.x + t.r * 0.4},${t.y - 4} ${t.x + t.r * 0.85},${t.y + 5}`, { fill: 'none', stroke: '#6fae4c', 'stroke-width': 2.2, 'stroke-linecap': 'round' })];
    const cols = ['#e8798f', '#f2c14e', '#9a7bd0'];
    for (let i = 0; i < 5; i++) {
      const x = t.x - t.r * 0.7 + (i * t.r * 1.4) / 4;
      const y = t.y + 3 - Math.sin((i / 4) * Math.PI) * 6;
      out.push(circ(x, y, 2.4, { fill: cols[i % 3], stroke: '#00000022', 'stroke-width': 0.4 }), circ(x, y, 0.9, { fill: '#fff8e0' }));
    }
    return out;
  },
  mushroom: (h) => {
    const t = top(h, -1);
    return [
      path(`M${t.x - t.r * 0.78},${t.y + 4} C${t.x - t.r * 0.7},${t.y - 12} ${t.x + t.r * 0.7},${t.y - 12} ${t.x + t.r * 0.78},${t.y + 4} Z`, { fill: '#d8483c', stroke: '#6b1f25', 'stroke-width': 1.2 }),
      circ(t.x - t.r * 0.3, t.y - 2, 2, { fill: '#fcf3e5' }), circ(t.x + t.r * 0.32, t.y - 4, 2.4, { fill: '#fcf3e5' }), circ(t.x + t.r * 0.02, t.y - 6.5, 1.6, { fill: '#fcf3e5' }),
    ];
  },
  pinecone: (h) => {
    const t = top(h, -2);
    const out = [ell(t.x, t.y - 2, t.r * 0.5, 8, { fill: '#8a5a2e', stroke: '#4a2c16', 'stroke-width': 1.1 })];
    for (let i = 0; i < 3; i++) out.push(path(`M${t.x - t.r * 0.42},${t.y - 6 + i * 4} q${t.r * 0.42},3 ${t.r * 0.84},0`, { fill: 'none', stroke: '#4a2c16', 'stroke-width': 0.9 }));
    return out;
  },
  straw: (h) => {
    const t = top(h, -1);
    return [
      ell(t.x, t.y + 4, t.r * 1.15, 4.5, { fill: '#e8cf8a', stroke: '#a3823c', 'stroke-width': 1.1 }),
      path(`M${t.x - t.r * 0.55},${t.y + 4} C${t.x - t.r * 0.5},${t.y - 8} ${t.x + t.r * 0.5},${t.y - 8} ${t.x + t.r * 0.55},${t.y + 4} Z`, { fill: '#f0dda6', stroke: '#a3823c', 'stroke-width': 1.1 }),
      path(`M${t.x - t.r * 0.52},${t.y + 1} q${t.r * 0.52},3 ${t.r * 1.04},0`, { fill: 'none', stroke: '#b8433f', 'stroke-width': 2 }),
    ];
  },
  bobble: (h) => {
    const t = top(h, -1);
    return [
      path(`M${t.x - t.r * 0.68},${t.y + 4} C${t.x - t.r * 0.62},${t.y - 10} ${t.x + t.r * 0.62},${t.y - 10} ${t.x + t.r * 0.68},${t.y + 4} Z`, { fill: '#5a7fb8', stroke: '#2f4d76', 'stroke-width': 1.1 }),
      path(`M${t.x - t.r * 0.74},${t.y + 2} q${t.r * 0.74},4 ${t.r * 1.48},0 l0,3 q${-t.r * 0.74},4 ${-t.r * 1.48},0 Z`, { fill: '#e9f0fa', stroke: '#2f4d76', 'stroke-width': 1 }),
      circ(t.x, t.y - 11, 3.2, { fill: '#e9f0fa', stroke: '#2f4d76', 'stroke-width': 1 }),
    ];
  },
  lantern: (h) => {
    const t = top(h, -3);
    return [
      path(`M${t.x - 6},${t.y - 2} L${t.x + 6},${t.y - 2} L${t.x + 7},${t.y + 9} L${t.x - 7},${t.y + 9} Z`, { fill: '#3a3a3a', stroke: '#1a1a1a', 'stroke-width': 1 }),
      path(`M${t.x - 3},${t.y + 1} L${t.x + 3},${t.y + 1} L${t.x + 3.6},${t.y + 6} L${t.x - 3.6},${t.y + 6} Z`, { fill: '#ffe7a3' }),
      path(`M${t.x - 4},${t.y - 2} Q${t.x},${t.y - 9} ${t.x + 4},${t.y - 2}`, { fill: 'none', stroke: '#1a1a1a', 'stroke-width': 1.2 }),
    ];
  },
  feather: (h) => {
    const t = top(h, -4);
    return [
      path(`M${t.x - t.r * 0.8},${t.y + 6} q${t.r * 0.8},4 ${t.r * 1.6},0`, { fill: 'none', stroke: '#8a5a2e', 'stroke-width': 3, 'stroke-linecap': 'round' }),
      path(`M${t.x + t.r * 0.4},${t.y + 5} C${t.x + t.r * 0.5},${t.y - 4} ${t.x + t.r * 0.9},${t.y - 8} ${t.x + t.r * 1.05},${t.y - 10} C${t.x + t.r * 0.95},${t.y - 2} ${t.x + t.r * 0.7},${t.y + 3} ${t.x + t.r * 0.4},${t.y + 5} Z`, { fill: '#e8d9c0', stroke: '#8a7458', 'stroke-width': 0.9 }),
    ];
  },
  crown: (h) => {
    const t = top(h, -1);
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const x = t.x - t.r * 0.8 + (i * t.r * 1.6) / 4;
      pts.push(`M${x},${t.y + 5} L${x + t.r * 0.2},${t.y - 4} L${x + t.r * 0.4},${t.y + 5}`);
    }
    return [
      path(pts.join(' '), { fill: 'none', stroke: '#a3823c', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
      path(`M${t.x - t.r * 0.85},${t.y + 5} q${t.r * 0.85},3 ${t.r * 1.7},0`, { fill: 'none', stroke: '#a3823c', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      circ(t.x, t.y - 1, 2, { fill: '#f2c14e', stroke: '#a3823c', 'stroke-width': 0.6 }),
    ];
  },
};

/** SVG for one hat on one head anchor, or '' when there is no hat or no anchor. */
export function renderHat(id, head) {
  if (!isHat(id) || !head || !Number.isFinite(head.x) || !Number.isFinite(head.R)) return '';
  return g({ class: `cc-hat cc-hat-${id}` }, DRAW[id](head).join(''));
}

/** A hat on its own, for the wardrobe buttons. */
export function hatIcon(id) {
  return el('svg', { viewBox: '0 0 40 30', class: 'hat-ico', 'aria-hidden': 'true', focusable: 'false' },
    g({ transform: 'translate(0,14)' }, renderHat(id, { x: 20, y: 12, R: 10 })));
}
