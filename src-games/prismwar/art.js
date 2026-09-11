/* Prismwar art v2 — deterministic procedural card art as inline SVG. No assets, no network, CSP-safe.
   Pixel-art discipline (after Derek Yu's "Pixel Art Tutorial"): a readable SILHOUETTE first (form templates chosen from the
   card's keywords), one light source (top-left) with hue-shifted shadow and highlight tones, a 1px dark outline, no noise —
   every cell belongs to a mass. Units: bilateral cell creatures. Spells: effect-specific sigils. Bonds: linked rings.
   Relics: faceted gems. Wellsprings: feTurbulence terrain. Ascendants: crowned sigils. Seed = FNV(id|name). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrismwarArt = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // [shadow, base, light, highlight, outline] — shadows shift toward blue/purple, highlights toward warm, per pixel-art convention
  const PAL = {
    W: ['#8c7a4a', '#d9c37a', '#f3e9c2', '#fffbe6', '#3a2f14'], U: ['#1f4f8f', '#2f7fd1', '#7cc3ff', '#d6ecff', '#0b1f3d'],
    B: ['#4a4d66', '#6b6f88', '#b8bccf', '#e6e8f2', '#15161f'], R: ['#8c2a12', '#e4522a', '#ff9a6e', '#ffd9c7', '#3d0f06'],
    G: ['#245c33', '#3f9c58', '#8fe0a0', '#dcffe4', '#0f2e18'], P: ['#4a2a86', '#8a4fd6', '#c9a0ff', '#efe0ff', '#1e0d3d'],
  };
  const W = 120, H = 70;
  function hash32(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function prng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const f1 = n => Math.round(n * 10) / 10;

  // ---------- Units: silhouette-first cell creatures ----------
  // Form templates: half-width masks (mirrored), rows top→bottom. 1 = must fill, 2 = may fill, 0 = never. Width 8 → 15 cells mirrored.
  const FORMS = {
    beast:    ['00000022', '00002211', '00022111', '00221111', '02211111', '02211111', '00221111', '00022110', '00002020', '00002020'],
    humanoid: ['00000211', '00000211', '00000011', '00002111', '00022111', '00022111', '00002111', '00000211', '00000211', '00000210'],
    flyer:    ['22000000', '22200011', '02220111', '00222111', '00022111', '00002211', '00002111', '00000210', '00000200', '00000000'],
    serpent:  ['00000000', '00000000', '22222211', '22222211', '00000211', '00000211', '00002211', '22222211', '22222220', '00000000'],
    colossus: ['00002211', '00221111', '02211111', '22111111', '22111111', '22111111', '02211111', '00221111', '00211122', '00211122'],
    wisp:     ['00000000', '00000221', '00002211', '00022111', '00022111', '00002211', '00000221', '00000022', '00000002', '00000000'],
  };
  function formFor(c) { const k = c.kw || {}; if (k.drift !== undefined) return 'flyer'; if (k.foretell !== undefined || k.glimpse !== undefined) return 'serpent'; if (k.trample !== undefined || k.bulwark !== undefined || (c.v + c.r) >= 9) return 'colossus'; if (k.swift !== undefined || k.reckless !== undefined) return 'beast'; if (k.foresee !== undefined || k.toll !== undefined || k.wither !== undefined) return 'wisp'; return 'humanoid'; }
  function creature(r, pal, c) {
    const form = FORMS[formFor(c)]; const rows = form.length, half = 8, cols = half * 2 - 1;
    const cell = 5, ox = Math.round((W - cols * cell) / 2), oy = Math.round((H - rows * cell) / 2) + 1;
    // 1) mask: certain cells + 60% of optional cells, then remove islands so every cell touches the body
    const g = form.map(row => row.split('').map(ch => ch === '1' ? 1 : (ch === '2' && r() < 0.6 ? 1 : 0)));
    for (let y = 0; y < rows; y++) for (let x = 0; x < half; x++) if (g[y][x]) { const nb = (g[y - 1] && g[y - 1][x]) || (g[y + 1] && g[y + 1][x]) || g[y][x - 1] || (x + 1 < half ? g[y][x + 1] : 1); if (!nb) g[y][x] = 0; }
    const full = []; for (let y = 0; y < rows; y++) { full.push([]); for (let x = 0; x < cols; x++) { const hx = x < half ? x : cols - 1 - x; full[y].push(g[y][hx]); } }
    const at = (x, y) => (full[y] && full[y][x]) || 0;
    // 2) shading from the top-left: exposed top/left edges → highlight, bottom/right edges → shadow, interior → base
    let out = '';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (at(x, y)) {
      const top = !at(x, y - 1), left = !at(x - 1, y), bottom = !at(x, y + 1), right = !at(x + 1, y);
      const tone = (top || left) && !(bottom && right) ? 2 : (bottom || right) ? 0 : 1;
      out += `<rect x="${ox + x * cell}" y="${oy + y * cell}" width="${cell}" height="${cell}" fill="${pal[tone]}"/>`;
    }
    // 3) 1px outline around the silhouette (drawn as thin rects on empty neighbours)
    let ol = '';
    for (let y = -1; y <= rows; y++) for (let x = -1; x <= cols; x++) if (!at(x, y) && (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1))) ol += `<rect x="${ox + x * cell}" y="${oy + y * cell}" width="${cell}" height="${cell}" fill="${pal[4]}" opacity=".85"/>`;
    // 4) eyes on the upper third, mirrored, with a specular pixel
    let ey = -1, ex = -1; for (let y = 1; y < rows / 2 && ey < 0; y++) for (let x = half - 3; x < half; x++) if (at(x, y) && at(x, y + 1)) { ey = y; ex = x; break; }
    if (ey >= 0) { const mx = cols - 1 - ex; const eyeC = c.color === 'B' || c.color === 'P' ? pal[3] : pal[4]; out += `<rect x="${ox + ex * cell + 1}" y="${oy + ey * cell + 1}" width="3" height="3" fill="${eyeC}"/><rect x="${ox + mx * cell + 1}" y="${oy + ey * cell + 1}" width="3" height="3" fill="${eyeC}"/><rect x="${ox + ex * cell + 1}" y="${oy + ey * cell + 1}" width="1" height="1" fill="#fff"/><rect x="${ox + mx * cell + 1}" y="${oy + ey * cell + 1}" width="1" height="1" fill="#fff"/>`; }
    // 5) keyword accents: horns (trample/reckless), glow (ignite/gambit), wing membranes (drift), spines (wither)
    const k = c.kw || {}; const cx = ox + (half - 0.5) * cell;
    if (k.trample !== undefined || k.reckless !== undefined) out += `<polygon points="${cx - 14},${oy + 8} ${cx - 20},${oy - 4} ${cx - 8},${oy + 4}" fill="${pal[2]}" stroke="${pal[4]}" stroke-width="1"/><polygon points="${cx + 14},${oy + 8} ${cx + 20},${oy - 4} ${cx + 8},${oy + 4}" fill="${pal[2]}" stroke="${pal[4]}" stroke-width="1"/>`;
    if (k.ignite !== undefined || k.gambit !== undefined) out = `<ellipse cx="${cx}" cy="${H / 2}" rx="34" ry="24" fill="${pal[2]}" opacity=".18"/>` + out;
    if (k.wither !== undefined || k.reclaim !== undefined) for (let i = 0; i < 4; i++) out += `<rect x="${cx - 9 + i * 6}" y="${oy - 2 - (i % 2) * 3}" width="2" height="6" fill="${pal[0]}"/>`;
    return ol + out;
  }
  // ---------- Spells: effect-specific sigils ----------
  function sigil(r, pal, c) {
    const cx = W / 2, cy = H / 2; const e = c.effect; let out = '';
    const rays = (n, R, wob, fill) => { let s = ''; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.2, len = R * (0.6 + r() * wob), wd = 3 + r() * 4; const x = cx + Math.cos(a) * len, y = cy + Math.sin(a) * len * 0.9; const px = Math.cos(a + Math.PI / 2) * wd, py = Math.sin(a + Math.PI / 2) * wd; s += `<polygon points="${f1(cx + px)},${f1(cy + py)} ${f1(x)},${f1(y)} ${f1(cx - px)},${f1(cy - py)}" fill="${fill || (i % 2 ? pal[1] : pal[2])}" stroke="${pal[4]}" stroke-width=".6"/>`; } return s; };
    if (e === 'damage') { out += rays(6 + Math.floor(r() * 4), 30, 0.5); const z = `${cx - 6},${cy - 26} ${cx + 4},${cy - 4} ${cx - 2},${cy - 4} ${cx + 8},${cy + 24} ${cx - 6},${cy + 2} ${cx + 1},${cy + 2}`; out += `<polygon points="${z}" fill="${pal[3]}" stroke="${pal[4]}" stroke-width="1"/>`; }
    else if (e === 'draw' || e === 'wellspring') { for (let i = 0; i < 4; i++) { const y = cy - 18 + i * 12 + r() * 4; out += `<path d="M10 ${y} q 20 -10 40 0 t 40 0 t 20 0" stroke="${i % 2 ? pal[2] : pal[3]}" stroke-width="${2 + r() * 2}" fill="none" opacity=".9"/>`; } out += `<circle cx="${cx + (r() - 0.5) * 30}" cy="${cy - 8}" r="${5 + r() * 4}" fill="${pal[3]}"/>`; }
    else if (e === 'destroy' || e === 'discard') { out += `<circle cx="${cx}" cy="${cy - 4}" r="18" fill="${pal[2]}" stroke="${pal[4]}" stroke-width="1.5"/><rect x="${cx - 12}" y="${cy + 8}" width="24" height="12" fill="${pal[2]}" stroke="${pal[4]}" stroke-width="1.5"/><circle cx="${cx - 7}" cy="${cy - 6}" r="4" fill="${pal[4]}"/><circle cx="${cx + 7}" cy="${cy - 6}" r="4" fill="${pal[4]}"/><path d="M${cx - 3} ${cy + 2} l3 5 l3 -5z" fill="${pal[4]}"/>`; for (let i = 0; i < 3 + Math.floor(r() * 3); i++) out += `<rect x="${cx - 40 + r() * 80}" y="${cy - 30 + r() * 60}" width="3" height="3" fill="${pal[0]}"/>`; }
    else if (e === 'bounce' || e === 'steal') { const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const R = 8 + i * 7; out += `<path d="M${cx - R} ${cy} a${R} ${R} 0 1 1 ${R * 2} 0" stroke="${i % 2 ? pal[2] : pal[3]}" stroke-width="2.5" fill="none"/>`; } out += `<polygon points="${cx + 20},${cy - 4} ${cx + 30},${cy + 4} ${cx + 16},${cy + 6}" fill="${pal[3]}"/>`; }
    else if (e === 'heal' || e === 'pump' || e === 'counterGrow') { out += rays(8 + Math.floor(r() * 4), 26, 0.3, pal[2]); out += `<rect x="${cx - 4}" y="${cy - 16}" width="8" height="32" fill="${pal[3]}" stroke="${pal[4]}" stroke-width="1"/><rect x="${cx - 16}" y="${cy - 4}" width="32" height="8" fill="${pal[3]}" stroke="${pal[4]}" stroke-width="1"/>`; }
    else if (e === 'fight') { out += `<path d="M${cx - 28} ${cy + 20} L${cx + 6} ${cy - 14}" stroke="${pal[3]}" stroke-width="5" stroke-linecap="round"/><path d="M${cx + 28} ${cy + 20} L${cx - 6} ${cy - 14}" stroke="${pal[2]}" stroke-width="5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy - 8}" r="6" fill="${pal[3]}"/>`; }
    else if (e === 'exileTapped') { out += `<circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="${pal[3]}" stroke-width="4"/><path d="M${cx - 17} ${cy - 17} L${cx + 17} ${cy + 17}" stroke="${pal[3]}" stroke-width="4"/>`; }
    else out += rays(8, 28, 0.4);
    if (c.type === 'Reaction') out += `<path d="M6 ${H - 6} L${W - 6} 6" stroke="${pal[3]}" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"/>`;
    // seeded pose + satellites so two cards sharing an effect never share a picture
    const rot = f1((r() - 0.5) * 40); let sat = ''; for (let i = 0; i < 3; i++) sat += `<circle cx="${f1(12 + r() * (W - 24))}" cy="${f1(8 + r() * (H - 16))}" r="${f1(1.5 + r() * 2.5)}" fill="${pal[3]}" opacity=".8"/>`;
    return `<g transform="rotate(${rot} ${cx} ${cy})">${out}</g>${sat}`;
  }
  function rings(r, pal) { const n = 2 + Math.floor(r() * 3), tilt = (r() - 0.5) * 0.8; let out = ''; for (let i = 0; i < n; i++) { const cx = 28 + (W - 56) * (n === 1 ? 0.5 : i / (n - 1)), cy = H / 2 + Math.sin(i + tilt) * 8; const R = 11 + r() * 8; out += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(R)}" ry="${f1(R * (0.7 + r() * 0.3))}" transform="rotate(${f1(tilt * 40 + i * 15)} ${f1(cx)} ${f1(cy)})" fill="none" stroke="${i % 2 ? pal[2] : pal[3]}" stroke-width="${3 + r() * 2}"/>`; } for (let i = 0; i < 3; i++) out += `<circle cx="${f1(10 + r() * (W - 20))}" cy="${f1(8 + r() * (H - 16))}" r="${f1(1.5 + r() * 2)}" fill="${pal[3]}"/>`; return out; }
  function gem(r, pal, crown) { const cx = W / 2, cy = H / 2; const n = 5 + Math.floor(r() * 4); const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2, rad = 20 + r() * 12; pts.push([f1(cx + Math.cos(a) * rad), f1(cy + Math.sin(a) * rad * 0.8)]); } let out = `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${pal[1]}" stroke="${pal[4]}" stroke-width="1.5"/>`; for (const p of pts) out += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="${pal[2]}" stroke-width="1"/>`; out += `<circle cx="${cx - 5}" cy="${cy - 6}" r="${3 + r() * 3}" fill="${pal[3]}" opacity=".9"/>`; if (crown) { const k = 3 + Math.floor(r() * 3); let c = ''; for (let i = 0; i <= k; i++) c += `${f1(cx - 24 + (48 / k) * i)},${i % 2 ? cy - 34 : cy - 24} `; out += `<polyline points="${c}${cx + 24},${cy - 14} ${cx - 24},${cy - 14} ${cx - 24},${cy - 24}" fill="#ffd36a" stroke="${pal[4]}" stroke-width="1"/>`; } return out; }
  function terrain(seed, pal) { return `<rect width="${W}" height="${H}" fill="${pal[1]}" filter="url(#t${seed})"/><ellipse cx="${W / 2}" cy="${H - 8}" rx="${W * 0.42}" ry="10" fill="${pal[2]}" opacity=".6"/>`; }

  function body(card, r) { const pal = PAL[card.color] || PAL.P; if (card.type === 'Unit') return creature(r, pal, card); if (card.type === 'Action' || card.type === 'Reaction') return sigil(r, pal, card); if (card.type === 'Bond') return rings(r, pal); if (card.type === 'Ascendant') return gem(r, pal, true); if (card.type === 'Relic') return gem(r, pal, false); return ''; }
  function svg(card) {
    const pal = PAL[card.color] || PAL.P; const seed = hash32(card.id + '|' + card.name); const r = prng(seed); const id = 'a' + seed.toString(36);
    let defs = `<linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal[4]}"/><stop offset="1" stop-color="${pal[0]}" stop-opacity=".7"/></linearGradient>`;
    let b;
    if (card.type === 'Wellspring') { defs += `<filter id="t${seed}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${seed % 1000}"/><feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.3  0 0 0 0.9 0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter>`; b = terrain(seed, pal); }
    else b = body(card, r);
    const stars = Array.from({ length: 5 }, () => `<circle cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(0.5 + r())}" fill="${pal[3]}" opacity=".45"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="url(#g${id})"/>${stars}${b}</svg>`;
  }
  /** Geometry-only fingerprint (colors stripped) — the uniqueness gate compares these, so two cards with the same shapes in
   *  different palettes still count as the same art. */
  function geometry(card) { const seed = hash32(card.id + '|' + card.name); return body(card, prng(seed)).replace(/#[0-9a-f]{3,6}/gi, '#').replace(/opacity="[^"]*"/g, ''); }
  function dataUri(card) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg(card)); }
  return { svg, dataUri, geometry, hash32, PAL, W, H, formFor };
});
