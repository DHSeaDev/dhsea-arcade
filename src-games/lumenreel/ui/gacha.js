// THE BALL DROP — the gacha presentation.
//
// HONESTY CONTRACT, and it is the same one the Prism Wheel runs under:
// the OUTCOME IS DECIDED FIRST by lib/collection.js drawGacha(), from the published
// weights, and the ball is then animated into that bin. The physics is choreography,
// not a simulation whose result we read off — a "real" bounce would produce a binomial
// distribution nobody chose, and quietly nudging pegs to steer it would be the exact
// rigged-animation dark pattern this project refuses. The odds page states this in
// plain words, and the bin widths below are drawn from the SAME live weights, so what
// you watch is a picture of the roll rather than a decoration next to it.

import { GACHA } from '../lib/constants.js';

const pct = (p) => (p * 100 >= 1 ? Math.round(p * 100) : (p * 100).toFixed(1)) + '%';

const TIER_COL = { 1: '#7dd3fc', 2: '#6ee7b7', 3: '#c4b5fd', 4: '#fda4af', 5: '#fcd34d', 6: '#86efac' };

/**
 * @param {HTMLElement} host
 * @param {{rows: Array, tier: object}} result  the decided roll + the live table
 * @param {{audio?: object, fx?: object}} opts
 * @returns {Promise<void>} resolves when the ball has landed
 */
export function ballDrop(host, result, opts = {}) {
  const { audio } = opts;
  const rows = result.table;
  const total = rows.reduce((a, r) => a + r.weight, 0) || 1;

  const W = 300, H = 250, TOP = 26, FLOOR = H - 34;
  // Bin x-ranges proportional to the live weights.
  let acc = 0;
  const bins = rows.map((r) => {
    const x0 = (acc / total) * W; acc += r.weight;
    const x1 = (acc / total) * W;
    return { ...r, x0, x1, mid: (x0 + x1) / 2 };
  });
  const target = bins.find((b) => b.tier.id === result.tier.id) || bins[0];

  // Pegs, purely decorative — the ball's path is authored to reach `target`.
  const pegs = [];
  for (let row = 0; row < GACHA.pegRows; row++) {
    const y = TOP + 18 + (row / GACHA.pegRows) * (FLOOR - TOP - 40);
    const n = 5 + (row % 2);
    for (let i = 0; i < n; i++) pegs.push({ x: ((i + (row % 2 ? 0.5 : 0)) / (n - (row % 2 ? 0 : 1))) * W, y });
  }

  host.innerHTML = `<div class="gacha">
    <svg viewBox="0 0 ${W} ${H}" class="gsvg">
      ${bins.map((b) => `<rect x="${b.x0.toFixed(1)}" y="${FLOOR}" width="${(b.x1 - b.x0).toFixed(1)}"
          height="${H - FLOOR}" fill="${TIER_COL[b.tier.id]}" opacity=".30" stroke="#0a0d18" stroke-width="1"/>`).join('')}
      ${pegs.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="#2f3b5e"/>`).join('')}
      <circle id="gball" cx="${(W / 2).toFixed(1)}" cy="${TOP}" r="6.5" fill="#fff"/>
      ${bins.map((b) => {
        // Same lesson as the wheel's Ultra slice: a label only goes inside a bin that
        // can hold it. A 0.9% bin is ~3px wide, so its percentage would land on top of
        // its neighbour's. Narrow bins carry their number in the key underneath instead.
        if ((b.x1 - b.x0) < 34) return '';
        return `<text x="${b.mid.toFixed(1)}" y="${H - 10}" text-anchor="middle"
          font-size="10" font-weight="800" fill="${TIER_COL[b.tier.id]}">${pct(b.p)}</text>`;
      }).join('')}
    </svg>
    <div class="gkey">${bins.map((b) => `<span style="color:${TIER_COL[b.tier.id]}">${b.tier.name} ${pct(b.p)}</span>`).join('')}</div>
  </div>`;

  const ball = host.querySelector('#gball');
  // Author a zig-zag from the top to the target bin. Each waypoint is a peg row.
  const steps = GACHA.pegRows;
  const path = [];
  const x0 = W / 2;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Ease toward the target while wobbling, so it reads as bouncing rather than aiming.
    const wobble = Math.sin(i * 2.1) * (W * 0.11) * (1 - t);
    path.push({
      x: x0 + (target.mid - x0) * (t * t) + wobble,
      y: TOP + (FLOOR - TOP - 8) * t,
    });
  }
  path.push({ x: target.mid, y: FLOOR - 4 });

  return new Promise((resolve) => {
    const per = GACHA.dropMs / path.length;
    let i = 0;
    const hop = () => {
      if (i >= path.length) {
        ball.setAttribute('cx', target.mid.toFixed(1));
        ball.setAttribute('cy', (FLOOR - 4).toFixed(1));
        ball.setAttribute('fill', TIER_COL[target.tier.id]);
        audio?.unlock?.(Math.min(5, target.tier.id));
        resolve();
        return;
      }
      const p = path[i++];
      ball.style.transition = `cx ${per}ms linear, cy ${per}ms cubic-bezier(.4,0,.9,.5)`;
      ball.setAttribute('cx', p.x.toFixed(1));
      ball.setAttribute('cy', p.y.toFixed(1));
      audio?.coin?.(i % 4);
      setTimeout(hop, per);
    };
    requestAnimationFrame(hop);
  });
}
