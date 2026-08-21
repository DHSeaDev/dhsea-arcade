// The 12 reel symbols, drawn as prism cuts. Same posture as the critters: no
// image files, everything procedural, one function per symbol so a tweak to one
// cut cannot silently change another.

const P = (pts) => `M${pts.map(([x, y]) => `${x},${y}`).join('L')}Z`;

/** Facet the polygon from a light point so every cut reads as a cut gem. */
function facet(pts, lx, ly, hue, extra = 0) {
  let out = '';
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const lit = (i + extra) % 2 === 0;
    out += `<path d="M${lx},${ly}L${a[0]},${a[1]}L${b[0]},${b[1]}Z"
      fill="hsl(${hue} ${lit ? 88 : 62}% ${lit ? 72 : 45}% / ${lit ? 0.62 : 0.5})"/>`;
  }
  return out;
}

const CUTS = {
  // round brilliant
  q: (h) => { const p = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; p.push([+(50 + Math.cos(a) * 28).toFixed(1), +(52 + Math.sin(a) * 28).toFixed(1)]); } return p; },
  // pear
  c: () => [[50, 20], [70, 44], [66, 72], [50, 84], [34, 72], [30, 44]],
  // marquise
  a: () => [[50, 18], [68, 52], [50, 86], [32, 52]],
  // emerald / step cut
  t: () => [[36, 22], [64, 22], [76, 40], [76, 64], [64, 82], [36, 82], [24, 64], [24, 40]],
  // trillion
  b: () => [[50, 20], [79, 72], [21, 72]],
};

function gem(key, hue, hue2) {
  const pts = CUTS[key](hue);
  return `<g>
    <path d="${P(pts)}" fill="url(#sg${key})" stroke="hsl(${hue2} 88% 84% / .7)" stroke-width="2" stroke-linejoin="round"/>
    ${facet(pts, 50, 52, hue)}
    <path d="${P(pts)}" fill="none" stroke="hsl(${hue2} 92% 90% / .5)" stroke-width="1.4" stroke-linejoin="round"/>
  </g>`;
}

const SPEC = {
  q: { hue: 190, hue2: 200, name: 'Quartz Chip' },
  c: { hue: 46,  hue2: 56,  name: 'Citrine Chip' },
  a: { hue: 276, hue2: 290, name: 'Amethyst Chip' },
  t: { hue: 24,  hue2: 40,  name: 'Topaz Chip' },
  b: { hue: 152, hue2: 165, name: 'Beryl Chip' },
  P: { hue: 210, hue2: 320, name: 'Prism' },
  H: { hue: 42,  hue2: 55,  name: 'Halo' },
  N: { hue: 330, hue2: 15,  name: 'Nova' },
  E: { hue: 258, hue2: 285, name: 'Eclipse' },
  W: { hue: 300, hue2: 190, name: 'Refraction (Wild)' },
  S: { hue: 50,  hue2: 190, name: 'Starburst (Scatter)' },
  O: { hue: 48,  hue2: 30,  name: 'Lumen Core' },
};

function special(key) {
  const { hue, hue2 } = SPEC[key];
  switch (key) {
    case 'P': { // a triangular prism splitting a beam into a spectrum
      const bands = [0, 45, 90, 150, 200, 260, 300];
      let sp = '';
      bands.forEach((b, i) => {
        const y = 44 + i * 5.2;
        sp += `<path d="M62,52 L92,${y - 4} L92,${y + 2} Z" fill="hsl(${b} 92% 66% / .8)"/>`;
      });
      return `<g><path d="M12,52 L46,50 L46,54 Z" fill="hsl(0 0% 100% / .85)"/>${sp}
        <path d="${P([[50, 18], [80, 74], [20, 74]])}" fill="url(#sgP)" stroke="hsl(${hue2} 90% 86% / .8)" stroke-width="2.4" stroke-linejoin="round"/>
        ${facet([[50, 18], [80, 74], [20, 74]], 50, 56, hue)}</g>`;
    }
    case 'H': { // halo ring
      let ticks = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ticks += `<line x1="${(50 + Math.cos(a) * 24).toFixed(1)}" y1="${(52 + Math.sin(a) * 24).toFixed(1)}"
          x2="${(50 + Math.cos(a) * 33).toFixed(1)}" y2="${(52 + Math.sin(a) * 33).toFixed(1)}"
          stroke="hsl(${hue2} 95% 76% / .85)" stroke-width="3" stroke-linecap="round"/>`;
      }
      return `<g>${ticks}<circle cx="50" cy="52" r="22" fill="none" stroke="url(#sgH)" stroke-width="9"/>
        <circle cx="50" cy="52" r="22" fill="none" stroke="hsl(${hue2} 98% 90% / .6)" stroke-width="2"/></g>`;
    }
    case 'N': { // nova burst
      let sp = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 2 ? 20 : 38;
        sp += `${(50 + Math.cos(a) * r).toFixed(1)},${(52 + Math.sin(a) * r).toFixed(1)} `;
      }
      return `<g><polygon points="${sp.trim()}" fill="url(#sgN)" stroke="hsl(${hue2} 95% 82% / .8)" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="50" cy="52" r="10" fill="hsl(${hue2} 100% 92% / .9)"/></g>`;
    }
    case 'E': { // eclipse — a dark disc with a bright rim
      return `<g><circle cx="50" cy="52" r="34" fill="none" stroke="url(#sgE)" stroke-width="5" opacity=".9"/>
        <circle cx="50" cy="52" r="27" fill="#0a0a16"/>
        <circle cx="50" cy="52" r="27" fill="none" stroke="hsl(${hue2} 96% 88%)" stroke-width="2.6"/>
        <path d="M50,25 A27,27 0 0 1 50,79" fill="none" stroke="hsl(${hue2} 100% 94%)" stroke-width="5" opacity=".85"/>
        <circle cx="50" cy="52" r="34" fill="url(#sgEa)" opacity=".55"/></g>`;
    }
    case 'W': { // refraction — the spectrum itself
      let bars = '';
      const hs = [0, 40, 80, 140, 190, 240, 290];
      hs.forEach((b, i) => {
        const x = 22 + i * 8.2;
        bars += `<path d="M${x},22 L${x + 7.4},22 L${x + 1.6},82 L${x - 5.8},82 Z" fill="hsl(${b} 92% 62%)" opacity=".92"/>`;
      });
      return `<g><clipPath id="sgWc"><path d="${P([[50, 14], [86, 52], [50, 90], [14, 52]])}"/></clipPath>
        <g clip-path="url(#sgWc)">${bars}</g>
        <path d="${P([[50, 14], [86, 52], [50, 90], [14, 52]])}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" opacity=".92"/></g>`;
    }
    case 'S': { // starburst scatter
      let rays = '';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        rays += `<path d="M50,52 L${(50 + Math.cos(a - 0.12) * 40).toFixed(1)},${(52 + Math.sin(a - 0.12) * 40).toFixed(1)}
          L${(50 + Math.cos(a + 0.12) * 40).toFixed(1)},${(52 + Math.sin(a + 0.12) * 40).toFixed(1)} Z"
          fill="url(#sgS)" opacity="${i % 2 ? 0.7 : 1}"/>`;
      }
      return `<g>${rays}<circle cx="50" cy="52" r="12" fill="hsl(${hue} 100% 84%)"/>
        <circle cx="50" cy="52" r="6" fill="#fff"/></g>`;
    }
    case 'O': { // lumen core — the coin
      return `<g><circle cx="50" cy="52" r="32" fill="url(#sgO)" stroke="hsl(${hue2} 80% 40%)" stroke-width="3"/>
        <circle cx="50" cy="52" r="25" fill="none" stroke="hsl(${hue} 96% 88% / .75)" stroke-width="2"/>
        <path d="${P([[50, 34], [64, 52], [50, 70], [36, 52]])}" fill="hsl(${hue} 100% 92%)" opacity=".95"/>
        <path d="M50,34 L64,52 L50,52 Z" fill="hsl(${hue2} 90% 62%)" opacity=".8"/></g>`;
    }
    default: return '';
  }
}

const VSPEC = {
  q: { hue: 104, hue2: 130 }, c: { hue: 44,  hue2: 56 },  a: { hue: 300, hue2: 320 },
  t: { hue: 32,  hue2: 44 },  b: { hue: 150, hue2: 168 },
  P: { hue: 336, hue2: 350 }, H: { hue: 48,  hue2: 60 },  N: { hue: 6,   hue2: 22 },
  E: { hue: 268, hue2: 288 }, W: { hue: 54,  hue2: 320 }, S: { hue: 52,  hue2: 96 },
  O: { hue: 42,  hue2: 28 },
};


const DEFS = Object.entries(SPEC).map(([k, v]) => `
  <linearGradient id="sg${k}" x1="15%" y1="0%" x2="85%" y2="100%">
    <stop offset="0%" stop-color="hsl(${v.hue2} 92% 80%)"/>
    <stop offset="50%" stop-color="hsl(${v.hue} 84% 58%)"/>
    <stop offset="100%" stop-color="hsl(${v.hue - 14} 70% 34%)"/>
  </linearGradient>`).join('')
  + `<radialGradient id="sgEa"><stop offset="60%" stop-color="hsl(285 96% 80% / 0)"/><stop offset="100%" stop-color="hsl(285 96% 80% / .9)"/></radialGradient>`;

/** One <defs> block shared by every symbol on the page. Emit it once. */
const VDEFS = Object.entries(VSPEC).map(([k, v]) => `
  <linearGradient id="vg${k}" x1="16%" y1="0%" x2="84%" y2="100%">
    <stop offset="0%" stop-color="hsl(${v.hue2} 78% 76%)"/>
    <stop offset="52%" stop-color="hsl(${v.hue} 68% 52%)"/>
    <stop offset="100%" stop-color="hsl(${v.hue - 12} 58% 30%)"/>
  </linearGradient>`).join('');

/** One shared <defs> for BOTH skins. Emit exactly once per document. */
export function symbolDefs() { return `<svg width="0" height="0" style="position:absolute"><defs>${DEFS}${VDEFS}</defs></svg>`; }

export function symbolName(key) { return SPEC[key]?.name ?? key; }
export function symbolHue(key) { return SPEC[key]?.hue ?? 200; }

// --- VERDANT symbol set -----------------------------------------------------
// The same 12 keys, drawn as growing things. Keys, weights and payouts are
// identical between skins — only the artwork and the names differ.
function leafShape(gid, hue, hue2, veins = 3) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, a = Math.PI * t; pts.push([50 + Math.sin(a) * 24, 18 + t * 68]); }
  for (let i = 12; i >= 0; i--) { const t = i / 12, a = Math.PI * t; pts.push([50 - Math.sin(a) * 24, 18 + t * 68]); }
  let v = '';
  for (let i = 1; i <= veins; i++) {
    const t = i / (veins + 1);
    v += `<path d="M50,${(18 + t * 60).toFixed(1)} L${(50 + 20 * (1 - t)).toFixed(1)},${(30 + t * 60).toFixed(1)}"
        stroke="hsl(${hue} 44% 26% / .45)" stroke-width="1.6" fill="none"/>
      <path d="M50,${(18 + t * 60).toFixed(1)} L${(50 - 20 * (1 - t)).toFixed(1)},${(30 + t * 60).toFixed(1)}"
        stroke="hsl(${hue} 44% 26% / .45)" stroke-width="1.6" fill="none"/>`;
  }
  return `<g><path d="${P(pts)}" fill="url(#${gid})" stroke="hsl(${hue2} 62% 78% / .7)" stroke-width="2" stroke-linejoin="round"/>
    <line x1="50" y1="18" x2="50" y2="88" stroke="hsl(${hue} 46% 28% / .6)" stroke-width="2.2"/>${v}</g>`;
}

function flowerShape(gid, hue, hue2, petals, centre = '#fde68a') {
  let out = '';
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const px = 50 + Math.cos(a) * 25, py = 52 + Math.sin(a) * 25;
    out += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="13" ry="20"
      transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"
      fill="url(#${gid})" stroke="hsl(${hue2} 74% 84% / .6)" stroke-width="1.4"/>`;
  }
  return `<g>${out}<circle cx="50" cy="52" r="12" fill="${centre}"/>
    <circle cx="50" cy="52" r="6.5" fill="hsl(${hue} 70% 42%)"/></g>`;
}

function verdant(key) {
  const { hue, hue2 } = VSPEC[key];
  const gid = `vg${key}`;
  const grad = '';   // gradients live in the shared defs block, see symbolDefs()
  let inner;
  switch (key) {
    case 'q': inner = leafShape(gid, hue, hue2, 3); break;                       // clover leaf
    case 'c': inner = flowerShape(gid, hue, hue2, 8, '#7c2d12'); break;          // marigold
    case 'a': inner = flowerShape(gid, hue, hue2, 5, '#f5d0fe'); break;          // foxglove
    case 't':                                                               // amber sap drop
      inner = `<g><path d="M50,12 C64,40 74,54 74,64 a24,24 0 0 1 -48,0 C26,54 36,40 50,12Z"
        fill="url(#${gid})" stroke="hsl(${hue2} 80% 82% / .7)" stroke-width="2"/>
        <ellipse cx="41" cy="58" rx="7" ry="10" fill="#fff" opacity=".3"/></g>`; break;
    case 'b': {                                                             // fern frond
      let f = `<path d="M50,90 C48,64 48,40 50,14" stroke="hsl(${hue} 50% 34%)" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < 7; i++) {
        const y = 22 + i * 9.6, len = 26 - i * 2.6;
        f += `<path d="M50,${y} q${len * 0.6},-5 ${len},4" stroke="hsl(${hue + i * 3} 58% ${44 + i * 3}%)" stroke-width="4.2" fill="none" stroke-linecap="round"/>
              <path d="M50,${y} q${-len * 0.6},-5 ${-len},4" stroke="hsl(${hue + i * 3} 58% ${44 + i * 3}%)" stroke-width="4.2" fill="none" stroke-linecap="round"/>`;
      }
      inner = `<g>${f}</g>`; break;
    }
    case 'P': inner = flowerShape(gid, hue, hue2, 6, '#fff7ed'); break;          // blossom
    case 'H': {                                                             // sun halo
      let rays = '';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        rays += `<line x1="${(50 + Math.cos(a) * 24).toFixed(1)}" y1="${(52 + Math.sin(a) * 24).toFixed(1)}"
          x2="${(50 + Math.cos(a) * (i % 2 ? 34 : 40)).toFixed(1)}" y2="${(52 + Math.sin(a) * (i % 2 ? 34 : 40)).toFixed(1)}"
          stroke="hsl(${hue2} 96% 68%)" stroke-width="3.4" stroke-linecap="round"/>`;
      }
      inner = `<g>${rays}<circle cx="50" cy="52" r="22" fill="url(#${gid})"/>
        <circle cx="50" cy="52" r="22" fill="none" stroke="hsl(${hue2} 98% 86% / .7)" stroke-width="2"/></g>`; break;
    }
    case 'N': inner = flowerShape(gid, hue, hue2, 4, '#111827'); break;          // wildfire poppy
    case 'E': {                                                             // nightshade berries
      let bs = '';
      const pos = [[50, 30], [36, 52], [64, 52], [43, 72], [58, 70]];
      for (const [x, y] of pos) {
        bs += `<circle cx="${x}" cy="${y}" r="12" fill="url(#${gid})" stroke="hsl(${hue2} 70% 78% / .55)" stroke-width="1.4"/>
               <circle cx="${x - 4}" cy="${y - 4}" r="3.4" fill="#fff" opacity=".35"/>`;
      }
      inner = `<g>${bs}</g>`; break;
    }
    case 'W': {                                                             // pollen burst
      let dots = '';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, d = i % 2 ? 24 : 36;
        dots += `<circle cx="${(50 + Math.cos(a) * d).toFixed(1)}" cy="${(52 + Math.sin(a) * d).toFixed(1)}"
          r="${(3.6 + (i % 3)).toFixed(1)}" fill="hsl(${(i * 26) % 360} 88% 66%)"/>`;
      }
      inner = `<g>${dots}<circle cx="50" cy="52" r="16" fill="#fde68a"/>
        <circle cx="50" cy="52" r="16" fill="none" stroke="#fff" stroke-width="2.6"/></g>`; break;
    }
    case 'S': {                                                             // dandelion clock
      let seeds = '';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, d = 34;
        const x = 50 + Math.cos(a) * d, y = 46 + Math.sin(a) * d;
        seeds += `<line x1="50" y1="46" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="hsl(${hue2} 30% 88% / .55)" stroke-width="1.2"/>
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#fefce8" opacity=".92"/>`;
      }
      inner = `<g>${seeds}<circle cx="50" cy="46" r="7" fill="hsl(${hue} 84% 62%)"/>
        <path d="M50,53 L50,92" stroke="hsl(110 44% 40%)" stroke-width="3" stroke-linecap="round"/></g>`; break;
    }
    case 'O':                                                               // golden seed
      inner = `<g><ellipse cx="50" cy="54" rx="26" ry="32" fill="url(#${gid})" stroke="hsl(${hue2} 68% 34%)" stroke-width="3"/>
        <path d="M50,22 C58,38 58,70 50,86 C42,70 42,38 50,22Z" fill="hsl(${hue} 96% 88% / .8)"/>
        <ellipse cx="41" cy="42" rx="6" ry="9" fill="#fff" opacity=".33"/>
        <path d="M62,20 q12,-6 14,4 q-10,6 -14,-4Z" fill="hsl(120 52% 44%)"/></g>`; break;
    default: inner = '';
  }
  return grad + inner;
}

export function renderSymbol(key, size = 72, theme = 'prism') {
  if (theme === 'verdant' && VSPEC[key]) {
    return `<svg viewBox="0 0 100 104" width="${size}" height="${size}" aria-label="${key}">${verdant(key)}</svg>`;
  }
  return renderSymbolPrism(key, size);
}

export function verdantHue(key) { return VSPEC[key]?.hue ?? 110; }

function renderSymbolPrism(key, size = 72) {
  const inner = CUTS[key] ? gem(key, SPEC[key].hue, SPEC[key].hue2) : special(key);
  return `<svg viewBox="0 0 100 104" width="${size}" height="${size}" aria-label="${symbolName(key)}">${inner}</svg>`;
}

export const SYMBOL_KEYS = Object.keys(SPEC);
