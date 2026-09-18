// Creature bodies, part B: winged, serpent/tail-chain, quadruped and wisp plans.

import { g, path, ell, circ, face, ink, L1, L2, L3, r2, spots, GROUND } from './kit.js';

const G = GROUND;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- WICKET (firefly, hovering)
export function wicket(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const shell = ctx.form('shell', p.hi, p.light, p.base);
  const lamp = ctx.form('lamp', p.glowA, p.glowB, p.glowC, { cx: '45%', cy: '40%' });
  const halo = ctx.glow('halo', p.glowB, 0.35 + 0.25 * Math.max(0, s + 0.4));
  const wing = (side) => g({ class: 'cc-flutter', 'transform-origin': `${60 + side * 4} 52` }, [
    path(`M${60 + side * 4},52 C${60 + side * 18},30 ${60 + side * 38},28 ${60 + side * 38},42 C${60 + side * 38},54 ${60 + side * 20},58 ${60 + side * 4},56 Z`, { fill: p.wing, opacity: 0.5, stroke: p.vein, 'stroke-width': L3 }),
    path(`M${60 + side * 6},54 C${60 + side * 16},44 ${60 + side * 26},40 ${60 + side * 34},40 M${60 + side * 10},55 C${60 + side * 18},52 ${60 + side * 26},50 ${60 + side * 32},48`, { fill: 'none', stroke: p.vein, 'stroke-width': 0.6 }),
  ]);
  const svg = [
    ell(60, 84, 34, 30, { fill: halo, class: 'cc-glow' }),
    wing(-1), wing(1),
    // glowing abdomen: the lantern it carries
    path('M44,78 C42,92 50,102 60,102 C70,102 78,92 76,78 C72,70 48,70 44,78 Z', { fill: lamp, ...ink(p, L2) }),
    path('M46,84 Q60,88 74,84 M47,91 Q60,95 73,91', { fill: 'none', stroke: p.glowC, 'stroke-width': L3, opacity: 0.6 }),
    // thorax with orange collar
    ell(60, 66, 16, 11, { fill: shell, ...ink(p) }),
    path('M46,60 Q60,54 74,60 L73,63 Q60,58 47,63 Z', { fill: p.collar, ...ink(p, L3) }),
    // tiny legs
    path('M50,74 L44,82 M56,76 L52,86 M64,76 L68,86 M70,74 L76,82', { stroke: p.line, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
  ];
  const head = [
    path('M52,40 C48,30 44,26 38,26 M68,40 C72,30 76,26 82,26', { fill: 'none', stroke: p.line, 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
    circ(37, 25.5, 2, { fill: p.glowB }), circ(83, 25.5, 2, { fill: p.glowB }),
    circ(60, 48, 14, { fill: shell, ...ink(p) }),
    face(ctx, { x: 60, y: 48, R: 14, gap: 6.4, eyeR: 4.2, mouthY: 55.5, cheeks: false, pal: { ...p, lid: p.light, brow: p.hi } }),
  ];
  return { svg: g({ class: 'cc-hover' }, svg.join('') + g({ class: 'cc-head', 'transform-origin': '60 60' }, head)), shadowRx: 18, lift: 14 };
}

// ---------------------------------------------------------------- WREN (winged, perching)
export function wren(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const feather = ctx.form('feather', p.hi, p.base, p.shadow);
  const cock = r2(-12 - s * 26);   // tail cocked up with cheer
  let bars = '';
  for (let i = 0; i < 4; i++) bars += path(`M${80 + i * 3},${58 - i * 4} l6,-2`, { stroke: p.bar, 'stroke-width': 1.1, 'stroke-linecap': 'round' });
  const svg = [
    ctx.sig > 0.3 ? g({ class: 'cc-float' }, [
      path('M22,36 L22,26 L28,24 L28,34', { fill: 'none', stroke: p.note, 'stroke-width': 1.2 }), ell(20.5, 36, 2.2, 1.6, { fill: p.note }), ell(26.5, 34, 2.2, 1.6, { fill: p.note }),
      path('M96,28 L96,20', { fill: 'none', stroke: p.note, 'stroke-width': 1.2 }), ell(94.5, 28, 2, 1.5, { fill: p.note }),
    ]) : '',
    // tail
    g({ transform: `rotate(${cock} 76 76)` }, [
      path('M72,78 C80,70 90,58 96,50 C100,54 98,60 84,82 Z', { fill: feather, ...ink(p) }),
      bars,
    ]),
    // thin legs, perched on the ground
    path('M54,94 L52,106 L47,108 M52,106 L56,108 M64,94 L66,106 L61,108 M66,106 L71,108', { fill: 'none', stroke: p.leg, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    // round body
    path('M36,78 C36,58 50,46 62,46 C78,46 86,60 84,78 C82,92 72,98 60,98 C46,98 36,92 36,78 Z', { fill: feather, ...ink(p) }),
    path('M44,84 C46,94 54,96 62,96 C72,96 78,90 78,84 C70,90 52,90 44,84 Z', { fill: p.belly }),
    // folded wing with barring
    path('M56,68 C66,62 80,66 82,78 C76,86 64,86 58,80 Z', { fill: p.shadow, ...ink(p, L2) }),
    path('M62,72 l10,-1 M63,76 l12,0 M65,80 l10,1', { stroke: p.bar, 'stroke-width': 1, 'stroke-linecap': 'round' }),
  ];
  const head = [
    // eyebrow stripe (wrens have one)
    path('M40,56 Q48,50 58,54', { fill: 'none', stroke: p.brow, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    face(ctx, { x: 48, y: 60, R: 14, gap: 5.4, eyeR: 3, cheeks: true, noMouth: true, noBrows: true }),
    // beak (open when singing)
    ctx.rig.mouth === 'grin' || ctx.rig.mouth === 'oh' || ctx.rig.mouth === 'gasp'
      ? path('M36,62 L24,60 L35,64 L25,68 L37,66 Z', { fill: p.beak, ...ink(p, L3) })
      : path('M36,62 L24,64 L37,66 Z', { fill: p.beak, ...ink(p, L3) }),
  ];
  return { svg: svg.join('') + g({ class: 'cc-head', 'transform-origin': '48 70' }, head), shadowRx: 22 };
}

// ---------------------------------------------------------------- MORROW (moth, hovering)
export function morrow(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const wingF = ctx.form('wing', p.light, p.base, p.shadow, { cx: '30%', cy: '30%' });
  const fuzz = ctx.form('fuzz', p.fuzzHi, p.body, p.bodyShade);
  const open = r2(lerp(0.55, 1.08, (s + 1) / 2));   // wing opening
  const wing = (side) => g({ transform: `translate(60 60) scale(${r2(side * open)} 1) translate(-60 -60)` }, g({ class: 'cc-flutter', 'transform-origin': '60 60' }, [
    path('M60,58 C66,36 88,22 104,30 C110,40 100,56 84,62 C74,64 64,62 60,60 Z', { fill: wingF, ...ink(p) }),
    path('M60,62 C70,64 90,70 94,84 C92,96 76,94 68,84 C64,78 61,70 60,64 Z', { fill: wingF, ...ink(p) }),
    circ(86, 40, 7, { fill: p.spot, ...ink(p, L3) }), circ(86, 40, 3.6, { fill: p.spotD }), circ(85, 39, 1.1, { fill: '#fff' }),
    circ(80, 80, 4, { fill: p.spot, ...ink(p, L3) }), circ(80, 80, 1.8, { fill: p.spotD }),
    path('M64,56 C74,46 86,38 98,34 M64,62 C74,60 84,58 96,52 M62,66 C70,72 80,80 88,88', { fill: 'none', stroke: p.shadow, 'stroke-width': 0.6, opacity: 0.7 }),
    path('M96,30 C100,32 103,36 102,40', { fill: 'none', stroke: p.hi, 'stroke-width': 1.2, opacity: 0.7 }),
  ]));
  const comb = (side) => {
    let d = `M${60 + side * 3},36 C${60 + side * 8},24 ${60 + side * 14},18 ${60 + side * 20},16`;
    let teeth = '';
    for (let i = 0; i < 6; i++) { const t = i / 6; const x = lerp(60 + side * 4, 60 + side * 19, t), y = lerp(33, 17, t); teeth += `M${r2(x)},${r2(y)} l${r2(side * 2.4)},${r2(-2.4)} `; }
    return path(d, { fill: 'none', stroke: p.fuzz, 'stroke-width': 1.3 }) + path(teeth, { stroke: p.fuzz, 'stroke-width': 0.8 });
  };
  const svg = [
    wing(-1), wing(1),
    path('M52,56 C50,70 54,92 60,98 C66,92 70,70 68,56 Z', { fill: fuzz, ...ink(p) }),
    path('M53,66 Q60,69 67,66 M54,74 Q60,77 66,74 M55,82 Q60,85 65,82', { fill: 'none', stroke: p.bodyShade, 'stroke-width': L3 }),
  ];
  const head = [
    comb(-1), comb(1),
    circ(60, 46, 12, { fill: fuzz, ...ink(p) }),
    path('M50,40 l-2,-2 M53,36 l-1,-3 M67,36 l1,-3 M70,40 l2,-2', { stroke: p.fuzz, 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
    face(ctx, { x: 60, y: 47, R: 12, gap: 5.4, eyeR: 3.8, mouthY: 53.5, cheeks: false }),
  ];
  return { svg: g({ class: 'cc-hover' }, svg.join('') + g({ class: 'cc-head', 'transform-origin': '60 58' }, head)), shadowRx: 22, lift: 12 };
}

// ---------------------------------------------------------------- HOLLOW (bat, hanging)
export function hollow(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.light, p.base, p.shadow);
  const memb = ctx.linear('memb', p.rim, p.membrane, { x2: '1', y2: '0.4' });
  // wrap: -1 wrapped tight (sleepy/shy), +1 wings open (alarmed)
  const open = lerp(0.2, 1, (s + 1) / 2);
  const wing = (side) => {
    const tipX = 60 + side * lerp(16, 46, open), tipY = lerp(70, 44, open);
    const midX = 60 + side * lerp(14, 36, open);
    return path(`M${60 + side * 8},34 L${r2(tipX)},${r2(tipY)} Q${r2(midX)},${r2(tipY + 10)} ${r2(lerp(60 + side * 16, 60 + side * 30, open))},${r2(lerp(76, 66, open))} Q${60 + side * 16},${r2(lerp(76, 70, open))} ${60 + side * 12},${r2(lerp(84, 78, open))} L${60 + side * 8},62 Z`, { fill: memb, ...ink(p, L2) })
      + path(`M${60 + side * 8},34 L${r2(tipX)},${r2(tipY)} M${60 + side * 8},40 L${r2(lerp(60 + side * 16, 60 + side * 30, open))},${r2(lerp(76, 66, open))}`, { fill: 'none', stroke: p.shadow, 'stroke-width': 0.8 });
  };
  const svg = [
    // the branch it hangs from
    path('M4,16 C30,12 70,20 116,14', { fill: 'none', stroke: p.branch, 'stroke-width': 5, 'stroke-linecap': 'round' }),
    path('M4,16 C30,12 70,20 116,14', { fill: 'none', stroke: p.branchD, 'stroke-width': 1, 'stroke-dasharray': '6 5' }),
    path('M92,16 C96,22 100,24 104,24', { fill: 'none', stroke: p.branch, 'stroke-width': 2 }),
    ell(104, 25, 4, 2.2, { fill: p.leaf, transform: 'rotate(20 104 25)' }),
    // feet gripping the branch
    path('M55,18 L55,26 M65,18 L65,26 M53,18 Q55,14 57,18 M63,18 Q65,14 67,18', { fill: 'none', stroke: p.line, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    g({ class: 'cc-sway', 'transform-origin': '60 18' }, [
      wing(-1), wing(1),
      path('M48,30 C46,46 48,64 60,70 C72,64 74,46 72,30 C66,24 54,24 48,30 Z', { fill: fur, ...ink(p) }),
      path('M54,36 Q60,40 66,36 M54,44 Q60,48 66,44', { fill: 'none', stroke: p.shadow, 'stroke-width': L3 }),
      // head below the body (upside down creature, face kept readable)
      g({ class: 'cc-head', 'transform-origin': '60 70' }, [
        path('M46,80 L40,94 L50,88 Z', { fill: fur, ...ink(p) }), path('M44,86 L42,91 L47,88 Z', { fill: p.earIn }),
        path('M74,80 L80,94 L70,88 Z', { fill: fur, ...ink(p) }), path('M76,86 L78,91 L73,88 Z', { fill: p.earIn }),
        path('M79,93 L77,90', { stroke: p.line, 'stroke-width': L3 }),
        circ(60, 80, 14, { fill: fur, ...ink(p) }),
        face(ctx, { x: 60, y: 80, R: 14, gap: 6, eyeR: 3.4, mouthY: 87 }),
        path('M57.8,84.6 L59,86.4 M62.2,84.6 L61,86.4', { stroke: '#ffffff', 'stroke-width': 0.8 }),
      ]),
    ]),
  ];
  return { svg: svg.join(''), shadowRx: 20, lift: 30 };
}

// ---------------------------------------------------------------- LUNA (owl, code pack)
export function luna(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const feather = ctx.form('feather', p.hi, p.base, p.shadow);
  const disc = ctx.form('disc', '#fffaf2', p.disc, p.discShade);
  const turn = r2(s * 14);   // head rotation
  let chevrons = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r % 2); c++) chevrons += path(`M${46 + c * 8 + (r % 2) * 4},${80 + r * 6} l3,2.4 l3,-2.4`, { fill: 'none', stroke: p.shadow, 'stroke-width': 0.9 });
  const svg = [
    path('M36,104 C30,84 34,58 60,56 C86,58 90,84 84,104 Z', { fill: feather, ...ink(p) }),
    path('M44,104 C42,90 46,74 60,72 C74,74 78,90 76,104 Z', { fill: p.disc, opacity: 0.7 }),
    chevrons,
    path('M36,70 C28,80 30,96 38,102 C42,94 42,80 40,70 Z', { fill: p.shadow, ...ink(p, L2) }),
    path('M84,70 C92,80 90,96 82,102 C78,94 78,80 80,70 Z', { fill: p.shadow, ...ink(p, L2) }),
    path('M50,104 l-2,4 M52,104 v4 M54,104 l2,4 M66,104 l-2,4 M68,104 v4 M70,104 l2,4', { stroke: p.feet, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    // a tiny notebook under the wing
    path('M86,88 L98,86 L99,98 L87,100 Z', { fill: p.note, ...ink(p, L3) }),
    path('M88,90 L96,89 M88,93 L97,92 M88,96 L95,95', { stroke: p.shadow, 'stroke-width': 0.5 }),
  ];
  const head = g({ class: 'cc-head', transform: `rotate(${turn} 60 60)`, 'transform-origin': '60 60' }, [
    path('M38,38 L34,20 L48,32 Z', { fill: p.tuft, ...ink(p) }), path('M82,38 L86,20 L72,32 Z', { fill: p.tuft, ...ink(p) }),
    path('M34,48 C34,32 46,26 60,26 C74,26 86,32 86,48 C86,62 74,70 60,70 C46,70 34,62 34,48 Z', { fill: feather, ...ink(p) }),
    ell(49, 49, 11, 12, { fill: disc, ...ink(p, L3) }), ell(71, 49, 11, 12, { fill: disc, ...ink(p, L3) }),
    face(ctx, { x: 60, y: 48, R: 22, gap: 11, eyeR: 6, cheeks: false, noMouth: true, pal: { ...p, lid: p.disc } }),
    path('M57,56 L60,64 L63,56 Q60,54 57,56 Z', { fill: p.beak, ...ink(p, L3) }),
  ]);
  return { svg: svg.join('') + head, shadowRx: 28 };
}

// ---------------------------------------------------------------- NIB (newt, tail chain)
export function nib(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const skin = ctx.form('skin', p.hi, p.base, p.shadow);
  // tail chain: follow-the-leader segments, relative angle limited to ±35°
  const curl = s * 0.35;
  const segs = [];
  let x = 78, y = 98, a = -0.1;
  for (let i = 0; i < 6; i++) {
    a += curl * (i < 3 ? 1 : -0.6);
    a = Math.max(-0.61, Math.min(0.61, a));
    const nx = x + Math.cos(a) * 6, ny = y - Math.sin(a) * 6;
    segs.push([nx, ny, 5 - i * 0.75]);
    x = nx; y = ny;
  }
  let tail = `M78,${r2(92)} `;
  for (const [sx, sy, w] of segs) tail += `L${r2(sx)},${r2(sy - w)} `;
  const last = segs[segs.length - 1];
  tail += `L${r2(last[0] + 3)},${r2(last[1])} `;
  for (const [sx, sy, w] of [...segs].reverse()) tail += `L${r2(sx)},${r2(sy + w)} `;
  tail += 'L78,104 Z';
  let spine = '';
  for (let i = 0; i < 5; i++) spine += circ(40 + i * 9, 88 - Math.sin(i) * 0.6, 1.5, { fill: p.spot, ...ink(p, 0.4) });
  const svg = [
    g({ class: 'cc-wag', 'transform-origin': '78 98' }, path(tail, { fill: skin, ...ink(p) })),
    // splayed legs
    path('M36,98 L28,106 M28,106 l-3,0 M28,106 l-1,2 M50,100 L46,107 M46,107 l-3,1 M70,100 L76,107 M76,107 l3,1', { fill: 'none', stroke: p.base, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    // long low body
    path('M24,94 C26,84 40,82 56,84 C70,84 80,88 80,96 C80,104 66,106 52,106 C36,106 22,102 24,94 Z', { fill: skin, ...ink(p) }),
    path('M30,100 C40,106 64,106 78,100 C74,104 60,107 50,107 C40,107 32,104 30,100 Z', { fill: p.belly }),
    spine,
  ];
  const head = [
    path('M8,92 C8,82 18,78 30,80 C38,82 40,90 36,96 C30,102 12,102 8,92 Z', { fill: skin, ...ink(p) }),
    path('M10,96 C18,100 30,100 36,96', { fill: 'none', stroke: p.bellyL, 'stroke-width': 1.4, opacity: 0.8 }),
    face(ctx, { x: 21, y: 86, R: 12, gap: 5.8, eyeR: 2.9, mouthY: 94, cheeks: true }),
  ];
  return { svg: svg.join('') + g({ class: 'cc-head', 'transform-origin': '36 96' }, head), shadowRx: 40 };
}

// ---------------------------------------------------------------- LICHEN (snail)
export function lichen(ctx) {
  const p = ctx.pal, s = ctx.sig, rand = ctx.rand;
  const shell = ctx.form('shell', p.hi, p.base, p.shadow);
  const foot = ctx.form('foot', p.footHi, p.foot, p.footShade);
  const ext = lerp(0.35, 1, (s + 1) / 2);   // eye stalk extension
  // golden-ratio spiral
  const phi = 1.618;
  let sp = '';
  const cx = 66, cy = 76;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60 * Math.PI * 3.4;
    const r = 1.4 * Math.pow(phi, t / (Math.PI / 2)) ;
    const x = cx + Math.cos(t + 2.2) * Math.min(r, 24), y = cy + Math.sin(t + 2.2) * Math.min(r, 24) * 0.95;
    sp += `${i ? 'L' : 'M'}${r2(x)},${r2(y)} `;
  }
  const stalk = (x0, side) => {
    const tx = x0 + side * 4 * ext, ty = 78 - 20 * ext;
    return path(`M${x0},82 Q${r2(x0 + side)},${r2((82 + ty) / 2)} ${r2(tx)},${r2(ty)}`, { fill: 'none', stroke: p.foot, 'stroke-width': 3, 'stroke-linecap': 'round' })
      + path(`M${x0},82 Q${r2(x0 + side)},${r2((82 + ty) / 2)} ${r2(tx)},${r2(ty)}`, { fill: 'none', stroke: p.footShade, 'stroke-width': 0.6, opacity: 0.8 });
  };
  const tipL = [24 - 4 * ext, 78 - 20 * ext], tipR = [36 + 4 * ext, 78 - 20 * ext];
  const svg = [
    // foot
    path('M14,100 C16,90 30,86 44,90 C60,94 88,96 104,100 C106,106 96,108 80,108 L24,108 C16,108 12,104 14,100 Z', { fill: foot, ...ink(p) }),
    path('M30,104 Q60,106 96,104', { fill: 'none', stroke: p.footShade, 'stroke-width': L3 }),
    // shell
    circ(66, 76, 26, { fill: shell, ...ink(p) }),
    path(sp, { fill: 'none', stroke: p.shadow, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    path(sp, { fill: 'none', stroke: p.hi, 'stroke-width': 0.6, opacity: 0.6, transform: 'translate(-0.8 -0.8)' }),
    // lichen growing on the shell
    path('M54,56 C58,52 64,54 64,58 C60,62 56,61 54,58 Z', { fill: p.lich, ...ink(p, 0.5) }),
    path('M80,86 C84,84 88,86 87,90 C84,92 80,91 80,88 Z', { fill: p.lich, ...ink(p, 0.5) }),
    spots(rand, 5, { x: 72, y: 60, w: 12, h: 8 }, 0.6, 1.3, { fill: p.lichD }),
    // dew drops (glass)
    ell(50, 66, 2.4, 3, { fill: p.dew, opacity: 0.7, stroke: p.shadow, 'stroke-width': 0.4 }), circ(49.4, 65, 0.7, { fill: '#fff' }),
    ell(84, 70, 1.8, 2.3, { fill: p.dew, opacity: 0.7, stroke: p.shadow, 'stroke-width': 0.4 }),
  ];
  const head = [
    stalk(26, -1), stalk(34, 1),
    path('M12,98 C10,86 18,78 30,78 C40,78 44,86 44,94 L40,100 Z', { fill: foot, ...ink(p) }),
    // eyes live on the stalk tips: draw the face there
    face(ctx, { x: (tipL[0] + tipR[0]) / 2, y: tipL[1], R: 10, gap: (tipR[0] - tipL[0]) / 2, eyeR: 3.6, cheeks: false, noMouth: true, noBrows: true, pal: { ...p, lid: p.foot } }),
    path(`M22,92 Q28,${r2(94 + ctx.rig.mouthH * 10)} 34,92`, { fill: 'none', stroke: p.line, 'stroke-width': L2 }),
    ell(20, 88, 2.4, 1.3, { fill: p.cheek, opacity: 0.6 }), ell(36, 88, 2.4, 1.3, { fill: p.cheek, opacity: 0.6 }),
  ];
  return { svg: svg.join('') + g({ class: 'cc-head', 'transform-origin': '30 98' }, head), shadowRx: 46 };
}

// ---------------------------------------------------------------- RIPPLE (otter, floating on back)
export function ripple(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.hi, p.base, p.shadow);
  const toss = r2(-Math.max(0, s) * 16);
  const svg = [
    // water ring
    ell(60, 100, 50, 9, { fill: p.water, opacity: 0.55 }),
    path('M14,100 Q24,96 34,100 T54,100 T74,100 T94,100 T108,100', { fill: 'none', stroke: p.waterD, 'stroke-width': 1.1, opacity: 0.8, class: 'cc-ripple' }),
    // tail
    path('M88,96 C98,94 108,88 112,82 C112,90 104,100 90,102 Z', { fill: fur, ...ink(p) }),
    // long body lying on its back
    path('M24,92 C26,78 46,72 64,74 C82,76 94,84 94,94 C94,102 76,104 58,104 C40,104 22,102 24,92 Z', { fill: fur, ...ink(p) }),
    path('M34,90 C40,82 62,80 80,86 C84,92 76,98 58,98 C44,98 34,96 34,90 Z', { fill: p.belly }),
    // feet up
    path('M86,84 C88,76 92,72 96,72 C98,76 94,82 90,86 Z', { fill: p.shadow, ...ink(p, L2) }),
    path('M78,82 C80,74 84,70 88,70 C90,74 86,80 82,84 Z', { fill: p.shadow, ...ink(p, L2) }),
    // paws holding the pebble up (toss height = signature)
    path('M52,82 C52,74 54,70 56,68 M66,82 C66,74 64,70 62,68', { fill: 'none', stroke: p.base, 'stroke-width': 4, 'stroke-linecap': 'round' }),
    g({ transform: `translate(0 ${toss})` }, g({ class: s > 0.3 ? 'cc-toss' : null }, [
      ell(59, 64, 6.4, 4.8, { fill: p.pebble, ...ink(p, L2) }),
      ell(57.4, 62.6, 2.4, 1.4, { fill: p.pebbleL }),
    ])),
    path('M28,84 Q40,78 52,78', { fill: 'none', stroke: p.hi, 'stroke-width': 1.3, opacity: 0.6, 'stroke-linecap': 'round' }),
  ];
  const head = [
    circ(20, 76, 3.4, { fill: fur, ...ink(p, L2) }),
    path('M6,88 C6,76 16,70 26,72 C36,74 40,82 38,90 C36,98 26,100 18,100 C10,100 6,96 6,88 Z', { fill: fur, ...ink(p) }),
    ell(22, 92, 9, 6, { fill: p.belly }),
    face(ctx, { x: 22, y: 84, R: 14, gap: 6, eyeR: 2.8, mouthY: 95 }),
    ell(22, 90.5, 2.6, 1.8, { fill: p.nose }),
    path('M14,92 L4,90 M14,94 L5,96 M30,92 L40,90 M30,94 L39,96', { fill: 'none', stroke: p.hi, 'stroke-width': 0.6 }),
  ];
  return { svg: svg.join('') + g({ class: 'cc-head', 'transform-origin': '30 96' }, head), shadowRx: 0 };
}

// ---------------------------------------------------------------- COVE (seal, code pack)
export function cove(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const skin = ctx.form('skin', p.hi, p.base, p.shadow);
  const svg = [
    s < -0.3 || ctx.expr === 'calm' ? g({ class: 'cc-float' }, [
      circ(78, 40, 5, { fill: p.bubble, opacity: 0.5, stroke: p.light, 'stroke-width': 0.6 }),
      circ(88, 28, 7, { fill: p.bubble, opacity: 0.45, stroke: p.light, 'stroke-width': 0.6 }),
      circ(72, 50, 3, { fill: p.bubble, opacity: 0.55, stroke: p.light, 'stroke-width': 0.6 }),
      path('M84,28 l2,-2 l2,2 l2,-2 l2,2', { fill: 'none', stroke: p.shadow, 'stroke-width': 0.6 }),
    ]) : '',
    // hind flippers
    path('M92,98 C100,92 110,94 112,100 C106,104 98,104 92,102 Z', { fill: p.shadow, ...ink(p, L2) }),
    path('M92,102 C100,104 108,108 110,108 C102,110 96,108 92,106 Z', { fill: p.shadow, ...ink(p, L2) }),
    // body
    path('M20,96 C18,78 32,62 50,64 C70,66 94,82 96,100 C96,106 80,108 60,108 C38,108 20,106 20,96 Z', { fill: skin, ...ink(p) }),
    path('M26,100 C40,106 72,106 90,102 C82,106 70,108 56,108 C40,108 30,106 26,100 Z', { fill: p.belly }),
    spots(ctx.rand, 9, { x: 50, y: 72, w: 34, h: 18 }, 0.9, 1.8, { fill: p.spot, opacity: 0.7 }),
    // front flipper
    path('M44,94 C42,100 44,106 50,106 C52,102 52,98 50,94 Z', { fill: p.shadow, ...ink(p, L2) }),
  ];
  const head = [
    path('M12,78 C12,64 22,56 34,58 C46,60 50,70 48,80 C46,90 36,94 26,94 C16,94 12,88 12,78 Z', { fill: skin, ...ink(p) }),
    ell(24, 84, 8, 5.6, { fill: p.belly, opacity: 0.9 }),
    face(ctx, { x: 28, y: 74, R: 16, gap: 7.4, eyeR: 4, mouthY: 88 }),
    ell(24, 82, 2.6, 1.8, { fill: p.nose }),
    path('M18,84 L6,82 M18,86 L7,88 M30,84 L40,80 M30,86 L41,86', { fill: 'none', stroke: p.whisker, 'stroke-width': 0.7 }),
  ];
  return { svg: svg.join('') + g({ class: 'cc-head', 'transform-origin': '40 92' }, head), shadowRx: 44 };
}

// ---------------------------------------------------------------- JUNIPER (fawn, quadruped)
// Joint table (body-plan-rig), facing -x (head on the left) so face = -1 and every
// stance sign is the MIRROR of the face=+1 table:
//   fore: shoulder > elbow > carpus > hoof   elbow cross > 0, carpus cross > 0
//   hind: hip > stifle > hock > hoof         stifle cross < 0, hock cross > 0
// Hooves are PLANTED; the lowest bone keeps its rest angle from the hoof, and the
// upper two bones are solved by two-bone IK to the posed (transformed) root. Legs are
// drawn OUTSIDE the body-language transform, so squash and tilt never stretch a bone.
export const JUNIPER_REST = {
  face: -1,
  foreNear: [[44, 72], [49, 83], [45, 94], [38, 106]],
  foreFar:  [[50, 72], [55, 83], [51, 94], [44, 106]],
  hindNear: [[80, 72], [76, 84], [82, 94], [80, 106]],
  hindFar:  [[74, 72], [70, 84], [76, 94], [74, 106]],
};
export const JUNIPER_BEND = { foreNear: 1, foreFar: 1, hindNear: -1, hindFar: -1 };   // sign of cross at the MIDDLE joint
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const cross3 = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);

export function solveLeg(rest, rootT, bend) {
  const [r0, r1, r2_, r3] = rest;
  const l1 = dist(r0, r1), l2 = dist(r1, r2_), l3 = dist(r2_, r3);
  const hoof = r3;
  const low = [r2_[0] + (hoof[0] - r3[0]), r2_[1] + (hoof[1] - r3[1])];   // lowest bone keeps its rest angle
  const dx = low[0] - rootT[0], dy = low[1] - rootT[1];
  const d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const off = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const cand = [a + off, a - off].map((t) => [rootT[0] + Math.cos(t) * l1, rootT[1] + Math.sin(t) * l1]);
  const mid = cand.find((m) => Math.sign(cross3(rootT, m, low)) === Math.sign(bend)) || cand[0];
  void l3;
  return [rootT, mid, low, hoof];
}

export function juniperPose(rig, bodyPoint) {
  const out = { face: -1 };
  for (const k of Object.keys(JUNIPER_BEND)) {
    const rest = JUNIPER_REST[k];
    out[k] = solveLeg(rest, bodyPoint(rest[0]), JUNIPER_BEND[k]);
  }
  return out;
}

export function juniper(ctx) {
  const p = ctx.pal, s = ctx.sig, rand = ctx.rand;
  const coat = ctx.form('coat', p.hi, p.base, p.shadow);
  const pose = juniperPose(ctx.rig, ctx.bodyPoint);
  ctx.joints = pose;
  const leg = (chain, far) => {
    const d = chain.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)},${r2(y)}`).join(' ');
    const hoof = chain[chain.length - 1];
    return path(d, { fill: 'none', stroke: p.line, 'stroke-width': 5.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      + path(d, { fill: 'none', stroke: far ? p.shadow : p.base, 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      + ell(hoof[0], hoof[1] - 0.6, 2.6, 1.8, { fill: p.hoof });
  };
  const earRot = r2(s * 24);
  const body = [
    path('M84,64 C90,60 92,64 90,68 C88,70 86,70 84,68 Z', { fill: '#fffaf2', ...ink(p, L3) }),
    path('M38,70 C38,60 52,56 68,58 C80,58 88,62 88,70 C88,78 80,80 66,80 C52,80 38,80 38,70 Z', { fill: coat, ...ink(p) }),
    path('M44,76 C54,80 72,80 84,76 C80,80 70,82 62,82 C52,82 46,80 44,76 Z', { fill: p.belly }),
    spots(rand, 9, { x: 50, y: 60, w: 30, h: 10 }, 0.9, 1.7, { fill: p.dapple }),
  ];
  const ear = (x, y, side) => g({ transform: `rotate(${r2(side * earRot - side * 30)} ${x} ${y})` }, [
    path(`M${x},${y} C${x + side * 4},${y - 12} ${x + side * 14},${y - 16} ${x + side * 16},${y - 12} C${x + side * 14},${y - 4} ${x + side * 6},${y} ${x},${y} Z`, { fill: coat, ...ink(p, L2) }),
    path(`M${x + side * 2},${y - 1} C${x + side * 5},${y - 9} ${x + side * 11},${y - 12} ${x + side * 13},${y - 11} C${x + side * 11},${y - 5} ${x + side * 6},${y - 2} ${x + side * 2},${y - 1} Z`, { fill: p.earIn }),
  ]);
  const head = [
    path('M40,66 C38,58 36,52 34,46 L44,44 C46,52 48,58 50,62 Z', { fill: coat, ...ink(p, L2) }),
    ear(36, 32, -1), ear(46, 32, 1),
    path('M24,40 C24,30 32,26 40,28 C48,30 50,36 48,44 C46,50 40,52 34,52 C28,52 24,48 24,40 Z', { fill: coat, ...ink(p) }),
    path('M20,46 C20,42 24,40 28,42 L30,50 C26,52 20,50 20,46 Z', { fill: coat, ...ink(p, L2) }),
    ell(20.6, 45.6, 1.8, 1.4, { fill: p.nose }),
    face(ctx, { x: 36, y: 38, R: 12, gap: 5.4, eyeR: 3.4, mouthY: 48, mouthScale: 0.7 }),
    circ(33, 32, 0.9, { fill: p.dapple }), circ(39, 31, 0.8, { fill: p.dapple }),
  ];
  return {
    groundBack: leg(pose.foreFar, true) + leg(pose.hindFar, true),
    svg: body.join('') + g({ class: 'cc-head', 'transform-origin': '40 60' }, head),
    groundFront: leg(pose.foreNear, false) + leg(pose.hindNear, false),
    shadowRx: 30,
  };
}

// ---------------------------------------------------------------- BREEZE (wind sprite, wisp)
export function breeze(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const glass = ctx.form('glass', p.hi, p.base, p.shadow);
  const spread = r2(lerp(0.75, 1.25, (s + 1) / 2));
  const ribbon = (d, color, w, cls) => path(d, { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', class: cls });
  const svg = [
    g({ transform: `translate(60 64) scale(${spread}) translate(-60 -64)` }, [
      ribbon('M18,70 C22,40 52,28 70,36 C86,42 90,58 80,66', p.ribA, 2.4, 'cc-dash'),
      ribbon('M100,52 C96,80 70,96 50,90 C34,86 30,70 40,62', p.ribC, 2, 'cc-dash'),
      ribbon('M26,92 C44,104 78,104 96,86', p.ribB, 1.6, 'cc-dash'),
      // leaves caught in the wind
      path('M20,64 C22,58 28,58 28,62 C26,66 22,66 20,64 Z', { fill: p.leafA, ...ink(p, 0.6), class: 'cc-spin' }),
      path('M98,48 C100,42 106,44 105,48 C103,52 99,51 98,48 Z', { fill: p.leafB, ...ink(p, 0.6), class: 'cc-spin' }),
      path('M88,94 C90,90 94,90 94,93 C92,96 89,96 88,94 Z', { fill: p.leafA, ...ink(p, 0.6) }),
    ]),
    // teardrop body with a bright rim (glass material)
    path('M60,34 C72,46 80,58 80,72 C80,86 70,94 60,94 C50,94 40,86 40,72 C40,58 48,46 60,34 Z', { fill: glass, opacity: 0.9, stroke: p.line, 'stroke-width': L2 }),
    path('M50,54 C48,60 46,66 46,72', { fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: 0.9 }),
    path('M60,34 C58,28 62,24 66,22', { fill: 'none', stroke: p.ribA, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    face(ctx, { x: 60, y: 72, R: 16, gap: 7, eyeR: 3, mouthY: 81, cheeks: true, pal: p }),
  ];
  return { svg: g({ class: 'cc-hover' }, svg.join('')), shadowRx: 14, lift: 16 };
}

// ---------------------------------------------------------------- HUSH (forest shade, legendary wisp)
export function hush(ctx) {
  const p = ctx.pal, s = ctx.sig, rand = ctx.rand;
  const fog = ctx.linear('fog', p.light, p.base);
  const veil = ctx.glow('veil', p.mist, 0.55, '100%');
  const rim = ctx.glow('rim', p.mote, 0.22);
  let needles = '';
  for (let i = 0; i < 9; i++) {
    const x = 30 + rand() * 60, y = 30 + rand() * 60, a = rand() * 180;
    needles += path(`M${r2(x)},${r2(y)} l6,0`, { stroke: p.needle, 'stroke-width': 0.9, 'stroke-linecap': 'round', transform: `rotate(${r2(a)} ${r2(x)} ${r2(y)})`, opacity: 0.8 });
  }
  const density = r2(lerp(0.65, 0.95, (s + 1) / 2));
  const svg = [
    // second light (rarity): a soft rim glow and three motes
    ell(60, 62, 56, 54, { fill: rim, class: 'cc-glow' }),
    g({ class: 'cc-float' }, [circ(20, 30, 1.6, { fill: p.mote }), circ(100, 40, 1.3, { fill: p.mote }), circ(92, 18, 1.8, { fill: p.mote })]),
    ell(60, 100, 50, 10, { fill: veil }),
    // pine silhouettes held inside the fog
    path('M22,106 L30,80 L26,82 L32,64 L28,66 L34,50 L40,66 L36,64 L42,82 L38,80 L46,106 Z', { fill: p.shadow, opacity: 0.35 }),
    path('M78,106 L86,84 L82,86 L88,70 L94,86 L90,84 L98,106 Z', { fill: p.shadow, opacity: 0.3 }),
    // the shade itself
    path('M28,106 C24,86 28,50 42,34 C50,24 70,24 78,34 C92,50 96,86 92,106 C86,100 82,108 76,102 C70,108 66,100 60,106 C54,100 50,108 44,102 C38,108 34,100 28,106 Z', { fill: fog, opacity: density, stroke: p.line, 'stroke-width': L2 }),
    path('M40,44 C44,36 52,32 58,32', { fill: 'none', stroke: p.hi, 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.7 }),
    g({ class: 'cc-drift' }, needles),
    face(ctx, { x: 60, y: 58, R: 22, gap: 11, eyeR: 4.6, eyeStyle: 'glow', cheeks: false, noMouth: ctx.rig.mouth !== 'oh', noBrows: true, mouthY: 72 }),
  ];
  return { svg: svg.join(''), shadowRx: 38 };
}

// ---------------------------------------------------------------- ASTRA (constellation fox, legendary wisp)
export function astra(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const night = ctx.form('night', p.hi, p.light, p.base);
  const halo = ctx.glow('halo', p.starGlow, 0.3);
  const starG = ctx.glow('star', p.starGlow, 0.9);
  // stars sit ON the sitting-fox silhouette: ear tips, crown, cheeks, chest, paws, tail
  const pts = [[44, 22], [48, 42], [60, 36], [72, 42], [76, 22], [38, 58], [82, 58], [60, 72], [46, 86], [74, 86], [50, 106], [70, 106], [96, 94], [104, 70], [96, 56]];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [3, 6], [5, 7], [6, 7], [7, 8], [7, 9], [8, 10], [9, 11], [9, 12], [12, 13], [13, 14]];
  const shine = r2(lerp(0.7, 1.3, (s + 1) / 2));
  const body = 'M38,104 C32,90 38,76 50,72 L42,68 C34,62 34,50 40,44 L42,20 L54,36 C58,35 62,35 66,36 L78,20 L80,44 C86,50 86,62 78,68 L70,72 C80,76 84,86 82,96 C90,98 98,94 100,86 C102,78 96,70 96,58 C104,62 110,74 106,88 C102,102 88,108 76,106 L38,106 Z';
  const svg = [
    ell(60, 66, 54, 50, { fill: halo, class: 'cc-glow' }),
    path(body, { fill: night, opacity: 0.88, stroke: p.line, 'stroke-width': L2 }),
    path('M50,50 C54,58 66,58 70,50 C70,62 64,68 60,68 C56,68 50,62 50,50 Z', { fill: p.hi, opacity: 0.35 }),
    links.map(([a, b]) => path(`M${pts[a][0]},${pts[a][1]} L${pts[b][0]},${pts[b][1]}`, { stroke: p.link, 'stroke-width': 0.7, opacity: 0.8 })).join(''),
    pts.map(([x, y], i) => (i % 3 === 0 ? circ(x, y, 3.6 * shine, { fill: starG }) : '') + circ(x, y, (i % 3 === 0 ? 1.7 : 1.1) * shine, { fill: p.star, class: i % 2 ? 'cc-twinkle' : null })).join(''),
    face(ctx, { x: 60, y: 52, R: 16, gap: 7, eyeR: 3, eyeStyle: 'glow', cheeks: false, noBrows: true, mouthY: 62, pal: { ...p, line: p.link } }),
  ];
  return { svg: svg.join(''), shadowRx: 34 };
}
