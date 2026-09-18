// Creature bodies, part A: the chibi plan (stub limbs, no visible knees) and Sage.
// Each drawer returns { svg, shadowRx, lift }. Draw order is back → front.
// ctx.sig in [-1, 1] drives the species' signature body-language channel.

import { g, path, ell, circ, face, ink, L1, L2, L3, r2, spots, GROUND } from './kit.js';

const G = GROUND;
const lerp = (a, b, t) => a + (b - a) * t;

/** Stub foot pair planted on the ground. */
function feet(pal, xs, w = 7, h = 4.2, fill = pal.shadow) {
  return xs.map((x) => ell(x, G - h * 0.55, w, h, { fill, ...ink(pal, L2) })).join('');
}

// ---------------------------------------------------------------- EMBER (fox kit)
export function ember(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.light, p.base, p.shadow);
  const cream = ctx.form('cream', '#fffaf2', p.cream, p.creamShade);
  const tipGlow = ctx.glow('tipglow', p.tip, 0.75);
  // tail: big brush curling up behind the right hip, cream tip that glows faintly
  const tail = g({ class: 'cc-wag', 'transform-origin': '74 96' }, [
    path('M72,98 C92,102 106,88 102,68 C99,54 88,48 84,56 C92,62 94,76 86,84 C80,90 74,90 70,90 Z', { fill: fur, ...ink(p) }),
    path('M86,56 C88,48 98,48 101,58 C103,64 102,70 100,74 C96,66 92,60 86,56 Z', { fill: cream, ...ink(p, L2) }),
    ell(95, 56, 9, 9, { fill: tipGlow, class: 'cc-glow' }),
    path('M89,60 Q94,58 97,63 M91,66 Q95,65 98,69', { fill: 'none', stroke: p.creamShade, 'stroke-width': L3 }),
  ]);
  const body = [
    path('M42,104 C36,90 42,74 60,72 C78,74 84,90 78,104 Z', { fill: fur, ...ink(p) }),
    path('M52,104 C49,92 53,80 60,79 C67,80 71,92 68,104 Z', { fill: cream }),
    // chest ruff tufts
    path('M53,82 L56,86 L58,82 L61,87 L63,82 L66,86', { fill: 'none', stroke: p.creamShade, 'stroke-width': L3 }),
    feet(p, [48, 72], 7.5, 4.4, p.sock),
    // front paws (socks)
    path('M50,94 C49,100 50,104 54,104 C57,104 57,99 56,94 Z', { fill: p.sock, ...ink(p, L2) }),
    path('M70,94 C71,100 70,104 66,104 C63,104 63,99 64,94 Z', { fill: p.sock, ...ink(p, L2) }),
  ];
  // ears: angle follows the signature channel (flat back = shy, forward = curious/alarmed)
  const earRot = r2(-8 + s * 16);
  const ear = (x, side) => g({ transform: `rotate(${r2(side * earRot)} ${x} 42)` }, [
    path(`M${x - 9 * side},44 L${x - 2 * side},20 L${x + 9 * side},40 Z`, { fill: fur, ...ink(p) }),
    path(`M${x - 5 * side},41 L${x - 2 * side},27 L${x + 4 * side},39 Z`, { fill: p.earIn }),
    path(`M${x - 2 * side},20 L${x - 4 * side},26 L${x + 1 * side},25 Z`, { fill: p.sock }),
  ]);
  const head = [
    ear(46, 1), ear(74, -1),
    // head with cheek ruffs
    path('M37,56 C36,42 46,34 60,34 C74,34 84,42 83,56 L88,62 L80,64 L83,68 L72,72 C66,75 54,75 48,72 L37,68 L40,64 L32,62 Z', { fill: fur, ...ink(p) }),
    // cream muzzle mask
    path('M44,60 C48,55 54,56 60,62 C66,56 72,55 76,60 C78,68 70,74 60,74 C50,74 42,68 44,60 Z', { fill: cream }),
    // forehead blaze
    path('M57,36 C58,42 59,46 60,50 C61,46 62,42 63,36 C61,35 59,35 57,36 Z', { fill: p.hi, opacity: 0.55 }),
    face(ctx, { x: 60, y: 54, R: 22, gap: 9.5, eyeR: 4.2, mouthY: 68 }),
    path('M57.2,62.4 Q60,60.6 62.8,62.4 Q61.6,65 60,65 Q58.4,65 57.2,62.4 Z', { fill: p.nose }),
    circ(59, 62.4, 0.7, { fill: '#fff', opacity: 0.8 }),
  ];
  return { svg: tail + body.join('') + g({ class: 'cc-head', 'transform-origin': '60 72' }, head), shadowRx: 30 };
}

// ---------------------------------------------------------------- PIP (chipmunk)
export function pip(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.light, p.base, p.shadow);
  const belly = ctx.form('belly', '#fffaf0', p.belly, p.bellyShade);
  const puff = 1 + Math.max(0, s) * 0.28;
  const tail = g({ class: 'cc-wag', 'transform-origin': '70 100' }, [
    path('M70,100 C86,100 92,86 88,70 C85,58 90,46 98,44 C104,50 104,64 98,74 C94,82 96,94 86,104 Z', { fill: fur, ...ink(p) }),
    path('M92,52 C96,50 99,56 97,64', { fill: 'none', stroke: p.stripeL, 'stroke-width': L2 }),
    path('M88,62 C92,60 95,66 93,74', { fill: 'none', stroke: p.stripeD, 'stroke-width': L2 }),
  ]);
  const body = [
    path('M44,104 C40,90 46,76 60,75 C74,76 80,90 76,104 Z', { fill: fur, ...ink(p) }),
    path('M52,104 C50,94 54,84 60,83 C66,84 70,94 68,104 Z', { fill: belly }),
    // back stripes
    path('M44,90 C46,84 50,80 54,78', { fill: 'none', stroke: p.stripeD, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
    path('M46,94 C48,88 51,85 55,83', { fill: 'none', stroke: p.stripeL, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    feet(p, [50, 70], 6.5, 3.8, p.shadow),
    // hands holding a seed
    ell(60, 90, 5, 6.2, { fill: p.seed, ...ink(p, L2) }),
    path('M55.4,86.6 Q60,82.5 64.6,86.6 L64,88.4 Q60,86.4 56,88.4 Z', { fill: p.seedCap }),
    ell(54.5, 91, 3.2, 2.6, { fill: p.light, ...ink(p, L3) }),
    ell(65.5, 91, 3.2, 2.6, { fill: p.light, ...ink(p, L3) }),
  ];
  const head = [
    circ(45, 40, 5.5, { fill: fur, ...ink(p, L2) }), circ(45, 40, 2.6, { fill: p.blush, opacity: 0.6 }),
    circ(75, 40, 5.5, { fill: fur, ...ink(p, L2) }), circ(75, 40, 2.6, { fill: p.blush, opacity: 0.6 }),
    path('M40,58 C38,44 47,36 60,36 C73,36 82,44 80,58 C79,70 70,76 60,76 C50,76 41,70 40,58 Z', { fill: fur, ...ink(p) }),
    // cheek pouches: the signature channel
    ell(45, 64, 8 * puff, 6.5 * puff, { fill: belly, ...ink(p, L2) }),
    ell(75, 64, 8 * puff, 6.5 * puff, { fill: belly, ...ink(p, L2) }),
    // face stripes
    path('M52,38 C54,44 54,48 52,52', { fill: 'none', stroke: p.stripeD, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    path('M68,38 C66,44 66,48 68,52', { fill: 'none', stroke: p.stripeD, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    path('M56,37 C58,40 62,40 64,37', { fill: 'none', stroke: p.stripeD, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    face(ctx, { x: 60, y: 54, R: 20, gap: 8.5, eyeR: 3.9, mouthY: 67 }),
    ell(60, 62.5, 2.2, 1.6, { fill: p.nose }),
    path('M40,62 L33,60 M40,65 L33,66 M80,62 L87,60 M80,65 L87,66', { fill: 'none', stroke: p.line, 'stroke-width': 0.6, opacity: 0.6 }),
  ];
  return { svg: tail + body.join('') + g({ class: 'cc-head', 'transform-origin': '60 76' }, head), shadowRx: 26 };
}

// ---------------------------------------------------------------- CLOVER (rabbit kit)
export function clover(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.hi, p.base, p.shadow);
  const flopLift = r2(lerp(0, -70, Math.max(0, (s + 0.2) / 1.2)));   // the flopped ear rises with interest
  const body = [
    circ(80, 96, 7.5, { fill: p.tail, ...ink(p, L2) }),
    path('M42,104 C37,88 45,74 60,74 C75,74 83,88 78,104 Z', { fill: fur, ...ink(p) }),
    path('M52,104 C51,94 55,86 60,86 C65,86 69,94 68,104 Z', { fill: '#fffaf2', opacity: 0.8 }),
    // big hind feet
    ell(46, G - 2.6, 10, 4.2, { fill: fur, ...ink(p, L2) }),
    ell(74, G - 2.6, 10, 4.2, { fill: fur, ...ink(p, L2) }),
    path('M40,105 L41,103 M43,106 L44,104', { fill: 'none', stroke: p.line, 'stroke-width': L3 }),
    ell(53, 95, 4, 5, { fill: fur, ...ink(p, L3) }), ell(67, 95, 4, 5, { fill: fur, ...ink(p, L3) }),
  ];
  const upEar = g({ class: 'cc-twitch', 'transform-origin': '52 38' }, [
    path('M47,40 C42,26 42,10 49,6 C56,10 57,26 55,40 Z', { fill: fur, ...ink(p) }),
    path('M48.5,36 C46,26 46,15 49.5,11 C53,15 53.5,26 52.5,36 Z', { fill: p.earIn }),
  ]);
  const flopEar = g({ transform: `rotate(${flopLift} 67 38)` }, [
    path('M64,40 C72,34 88,34 94,40 C92,46 78,48 66,44 Z', { fill: fur, ...ink(p) }),
    path('M68,41 C75,38 86,38 90,41 C87,44 77,45 69,43 Z', { fill: p.earIn }),
    // clover sprig tucked at the ear base
    path('M66,36 L70,28', { stroke: p.leafD, 'stroke-width': 1.2, fill: 'none' }),
    circ(68, 26, 3, { fill: p.leaf, ...ink(p, L3) }), circ(72.5, 27.5, 3, { fill: p.leaf, ...ink(p, L3) }), circ(70, 23, 3, { fill: p.leaf, ...ink(p, L3) }),
    circ(70.2, 26, 1, { fill: p.leafD }),
  ]);
  const head = [
    upEar, flopEar,
    path('M40,58 C39,44 48,37 60,37 C72,37 81,44 80,58 C79,70 70,76 60,76 C50,76 41,70 40,58 Z', { fill: fur, ...ink(p) }),
    ell(60, 66, 9, 6.5, { fill: '#fffaf2', opacity: 0.85 }),
    face(ctx, { x: 60, y: 55, R: 20, gap: 9, eyeR: 4.3, mouthY: 68 }),
    path('M57.6,63 Q60,61.4 62.4,63 Q60,65.6 57.6,63 Z', { fill: p.nose, class: 'cc-twitch', 'transform-origin': '60 63' }),
    path('M50,64 L41,62 M50,66 L42,68 M70,64 L79,62 M70,66 L78,68', { fill: 'none', stroke: p.line, 'stroke-width': 0.6, opacity: 0.5 }),
  ];
  return { svg: body.join('') + g({ class: 'cc-head', 'transform-origin': '60 76' }, head), shadowRx: 30 };
}

// ---------------------------------------------------------------- FEN (tree frog)
export function fen(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const skin = ctx.form('skin', p.light, p.base, p.shadow, { cy: '22%' });
  const belly = ctx.form('belly', p.bellyHi, p.belly, p.bellyShade);
  const sac = 0.4 + Math.max(0, s) * 0.9;   // throat sac inflates with pride
  const toe = (x, y, dir) => g({}, [0, 1, 2].map((i) => {
    const a = (-0.5 + i * 0.5) * dir;
    const tx = x + Math.sin(a) * 6 * dir, ty = y + 1 + Math.cos(a) * 1.5;
    return path(`M${x},${y} L${r2(tx)},${r2(ty)}`, { stroke: p.base, 'stroke-width': 1.8, 'stroke-linecap': 'round' }) + circ(tx, ty, 1.7, { fill: p.pad, ...ink(p, 0.6) });
  }));
  const body = [
    // hind legs folded at the sides
    path('M34,104 C24,100 24,84 36,82 C44,82 46,94 44,104 Z', { fill: skin, ...ink(p) }),
    path('M86,104 C96,100 96,84 84,82 C76,82 74,94 76,104 Z', { fill: skin, ...ink(p) }),
    toe(34, 105, -1), toe(86, 105, 1),
    // round seated body
    path('M36,98 C32,76 42,56 60,56 C78,56 88,76 84,98 C80,106 40,106 36,98 Z', { fill: skin, ...ink(p) }),
    path('M46,100 C44,86 50,74 60,74 C70,74 76,86 74,100 C68,104 52,104 46,100 Z', { fill: belly }),
    ell(60, 76, 11 * sac, 7 * sac, { fill: p.sac, ...ink(p, L3), opacity: 0.95 }),
    spots(ctx.rand, 7, { x: 40, y: 62, w: 12, h: 26 }, 1.2, 2.4, { fill: p.spot, opacity: 0.8 }),
    spots(ctx.rand, 7, { x: 70, y: 62, w: 12, h: 26 }, 1.2, 2.4, { fill: p.spot, opacity: 0.8 }),
    // front hands
    toe(48, 104, -1), toe(72, 104, 1),
    path('M46,90 C46,98 48,102 48,104 M74,90 C74,98 72,102 72,104', { fill: 'none', stroke: p.base, 'stroke-width': 4, 'stroke-linecap': 'round' }),
    // hard specular (glossy material)
    path('M44,64 Q48,58 54,58', { fill: 'none', stroke: '#ffffff', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.85 }),
  ];
  const head = [
    // eye domes on top of the head
    circ(46, 50, 10, { fill: skin, ...ink(p) }), circ(74, 50, 10, { fill: skin, ...ink(p) }),
    face(ctx, { x: 60, y: 50, R: 26, gap: 14, eyeR: 6.4, mouthY: 64, mouthScale: 1.5, cheeks: false }),
    // the wide frog smile underlay
    path('M40,62 Q60,70 80,62', { fill: 'none', stroke: p.line, 'stroke-width': L3, opacity: 0.55 }),
    circ(56.5, 58, 0.8, { fill: p.line }), circ(63.5, 58, 0.8, { fill: p.line }),
  ];
  return { svg: body.join('') + g({ class: 'cc-head', 'transform-origin': '60 70' }, head), shadowRx: 32 };
}

// ---------------------------------------------------------------- THISTLE (hedgehog)
export function thistle(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const quill = ctx.form('quill', p.light, p.base, p.shadow);
  const faceFill = ctx.form('face', p.faceHi, p.face, p.faceShade);
  // quills: bristle with alarm (+), lie flat when sleepy (-)
  const len = 12 + s * 5;
  const spread = 1 + s * 0.12;
  let spikes = '';
  const cx = 64, cy = 84, R = 26;
  for (let i = 0; i < 17; i++) {
    const a = lerp(-2.7, 0.35, i / 16) * spread;
    const bx = cx + Math.cos(a) * R, by = cy + Math.sin(a) * R * 0.95;
    const tx = cx + Math.cos(a - 0.12) * (R + len + (i % 2) * 3), ty = cy + Math.sin(a - 0.12) * (R + len + (i % 2) * 3);
    const px = cx + Math.cos(a + 0.2) * R, py = cy + Math.sin(a + 0.2) * R * 0.95;
    spikes += path(`M${r2(bx)},${r2(by)} L${r2(tx)},${r2(ty)} L${r2(px)},${r2(py)} Z`, { fill: quill, ...ink(p, L3) });
    spikes += path(`M${r2(lerp(bx, tx, 0.62))},${r2(lerp(by, ty, 0.62))} L${r2(tx)},${r2(ty)}`, { stroke: p.quillTip, 'stroke-width': 1.3, 'stroke-linecap': 'round' });
  }
  const body = [
    g({ class: 'cc-bristle', 'transform-origin': '64 84' }, spikes),
    path('M38,104 C34,86 42,64 64,62 C86,64 92,86 88,104 Z', { fill: quill, ...ink(p) }),
    // a fallen leaf stuck in the quills — Thistle's story
    path('M78,62 C84,56 92,58 92,64 C86,68 80,67 78,62 Z', { fill: p.leaf, ...ink(p, L3) }),
    path('M79,62 L90,62', { stroke: p.line, 'stroke-width': 0.6, opacity: 0.6 }),
    feet(p, [48, 74], 6, 3.6, p.faceShade),
  ];
  const head = [
    path('M28,84 C26,74 34,66 46,66 C54,66 60,74 60,84 C60,96 52,102 44,102 C36,102 30,96 28,84 Z', { fill: faceFill, ...ink(p) }),
    // pointy snout
    path('M30,86 C24,86 20,88 18,90 C22,93 28,93 32,92 Z', { fill: faceFill, ...ink(p, L2) }),
    circ(18.5, 90, 2.4, { fill: p.nose }),
    circ(18, 89.2, 0.7, { fill: '#fff', opacity: 0.8 }),
    face(ctx, { x: 42, y: 82, R: 14, gap: 6, eyeR: 3.1, mouthY: 93, pal: { ...p, lid: p.face } }),
    ell(50, 70, 4, 3, { fill: faceFill, ...ink(p, L3) }),
  ];
  return { svg: body.join('') + g({ class: 'cc-head', 'transform-origin': '44 102' }, head), shadowRx: 34 };
}

// ---------------------------------------------------------------- SAGE (stump spirit, colossus plan)
export function sage(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const bark = ctx.linear('bark', p.light, p.shadow, { x2: '1', y2: '0.2' });
  const rings = ctx.form('rings', p.ringHi, p.ring, p.ringD, { cx: '50%', cy: '50%', r: '60%' });
  const glowE = ctx.glow('eyeglow', p.eyeGlow, 0.5);
  const droop = r2(-s * 22);   // sapling droops when sleepy, lifts when proud
  let grain = '';
  for (let i = 0; i < 6; i++) {
    const x = 36 + i * 9 + (ctx.rand() - 0.5) * 3;
    grain += path(`M${r2(x)},46 C${r2(x - 2)},60 ${r2(x + 2)},78 ${r2(x - 1)},96`, { fill: 'none', stroke: p.shadow, 'stroke-width': L3, opacity: 0.55 });
  }
  const svg = [
    // roots, planted
    path('M28,108 C32,100 36,98 40,96 L44,104 C38,104 34,106 28,108 Z', { fill: p.shadow, ...ink(p, L2) }),
    path('M92,108 C88,100 84,98 80,96 L76,104 C82,104 86,106 92,108 Z', { fill: p.shadow, ...ink(p, L2) }),
    path('M52,108 L54,100 L60,100 L58,108 Z', { fill: p.shadow, ...ink(p, L3) }),
    // trunk
    path('M34,104 C34,84 32,60 34,46 L86,46 C88,60 86,84 86,104 C74,108 46,108 34,104 Z', { fill: bark, ...ink(p) }),
    grain,
    // branch arms
    path('M34,70 C26,68 20,62 18,54 M22,58 L16,56', { fill: 'none', stroke: p.base, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    path('M86,72 C94,70 100,64 102,56 M98,60 L104,58', { fill: 'none', stroke: p.base, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    ell(15, 53, 4, 2.4, { fill: p.leaf, ...ink(p, L3), transform: 'rotate(-30 15 53)' }),
    ell(104, 55, 4, 2.4, { fill: p.leaf, ...ink(p, L3), transform: 'rotate(30 104 55)' }),
    // cut top with growth rings
    ell(60, 46, 26, 7, { fill: rings, ...ink(p) }),
    ell(60, 46, 17, 4.5, { fill: 'none', stroke: p.ringD, 'stroke-width': L3 }),
    ell(60, 46, 9, 2.4, { fill: 'none', stroke: p.ringD, 'stroke-width': L3 }),
    ell(60, 46, 3, 0.9, { fill: p.ringD }),
    // moss patches
    path('M34,62 C38,58 44,60 44,66 C40,70 36,68 34,66 Z', { fill: p.moss }),
    path('M78,90 C82,86 88,88 87,94 C83,96 79,95 78,92 Z', { fill: p.moss }),
    spots(ctx.rand, 6, { x: 35, y: 60, w: 9, h: 7 }, 0.6, 1.2, { fill: p.mossL }),
    // carved hollows the face lives in
    ell(49, 66, 8, 7, { fill: p.shadow, opacity: 0.55 }), ell(71, 66, 8, 7, { fill: p.shadow, opacity: 0.55 }),
    ell(60, 70, 22, 14, { fill: glowE, opacity: 0.5 }),
    face(ctx, { x: 60, y: 66, R: 24, gap: 11, eyeR: 4.2, mouthY: 82, cheeks: false, pal: { ...p, lid: p.shadow, brow: p.shadow } }),
    // sapling on top: the signature channel
    g({ transform: `rotate(${droop} 60 44)` }, [
      path('M60,44 C60,36 61,30 60,24', { fill: 'none', stroke: p.stem, 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
      path('M60,30 C54,26 50,28 49,31 C53,33 57,32 60,30 Z', { fill: p.leaf, ...ink(p, L3) }),
      path('M60,25 C66,20 71,22 72,25 C68,28 63,27 60,25 Z', { fill: p.leaf, ...ink(p, L3) }),
    ]),
    // mushrooms at the base
    path('M88,106 L88,100', { stroke: p.shroom, 'stroke-width': 2 }),
    path('M84,101 Q88,94 92,101 Z', { fill: p.shroomCap, ...ink(p, L3) }),
    path('M94,107 L94,103', { stroke: p.shroom, 'stroke-width': 1.6 }),
    path('M91.5,104 Q94,99 96.5,104 Z', { fill: p.shroomCap, ...ink(p, L3) }),
  ];
  return { svg: svg.join(''), shadowRx: 40 };
}

// ---------------------------------------------------------------- BRAMBLE (raccoon)
export function bramble(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.hi, p.base, p.shadow);
  const flick = r2(-10 + s * 22);
  let rings = '';
  const tailPath = 'M72,100 C90,104 102,92 100,76 C99,68 94,64 90,66 C94,74 92,86 82,90 C78,92 74,92 70,92 Z';
  const tclip = ctx.clip('tail', path(tailPath));
  for (let i = 0; i < 4; i++) rings += path(`M${80 + i * 5},${60} L${86 + i * 5},${110}`, { stroke: p.ring, 'stroke-width': 3.2 });
  const tail = g({ transform: `rotate(${flick} 72 96)` }, g({ class: 'cc-wag', 'transform-origin': '72 96' }, [
    path(tailPath, { fill: fur }), g({ 'clip-path': tclip }, rings), path(tailPath, { fill: 'none', ...ink(p) }),
  ]));
  const body = [
    // bindle of borrowed things
    path('M26,76 L40,98', { stroke: p.sackD, 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
    path('M16,72 C14,62 26,58 32,66 C36,72 30,80 22,80 C18,80 16,76 16,72 Z', { fill: p.sack, ...ink(p, L2) }),
    path('M18,68 Q24,66 30,70', { fill: 'none', stroke: p.sackD, 'stroke-width': L3 }),
    path('M23,63 L21,55', { stroke: p.spoon, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    ell(20.6, 53, 2.2, 3, { fill: p.spoon, ...ink(p, L3) }),
    path('M42,104 C38,88 44,74 60,74 C76,74 82,88 78,104 Z', { fill: fur, ...ink(p) }),
    path('M52,104 C51,94 55,86 60,86 C65,86 69,94 68,104 Z', { fill: p.white, opacity: 0.55 }),
    feet(p, [49, 71], 7, 4, p.mask),
    // little dark hands rubbing together
    path('M52,90 C54,86 58,86 60,89 C62,86 66,86 68,90 C66,95 54,95 52,90 Z', { fill: p.mask, ...ink(p, L2), class: 'cc-twitch', 'transform-origin': '60 90' }),
  ];
  const head = [
    path('M40,44 L44,28 L54,38 Z', { fill: fur, ...ink(p) }), path('M44,40 L45,32 L50,38 Z', { fill: p.mask }),
    path('M80,44 L76,28 L66,38 Z', { fill: fur, ...ink(p) }), path('M76,40 L75,32 L70,38 Z', { fill: p.mask }),
    path('M36,58 C36,44 46,36 60,36 C74,36 84,44 84,58 L90,62 L80,66 C74,74 46,74 40,66 L30,62 Z', { fill: fur, ...ink(p) }),
    path('M40,54 C46,46 54,48 60,52 C66,48 74,46 80,54 C78,60 70,62 66,60 L60,58 L54,60 C50,62 42,60 40,54 Z', { fill: p.mask }),
    path('M50,44 C54,40 58,40 60,42 C62,40 66,40 70,44 C66,46 62,46 60,46 C58,46 54,46 50,44 Z', { fill: p.white, opacity: 0.9 }),
    path('M50,66 C54,60 66,60 70,66 C66,72 54,72 50,66 Z', { fill: p.white }),
    face(ctx, { x: 60, y: 54, R: 22, gap: 9.5, eyeR: 3.9, mouthY: 68, pal: { ...p, lid: p.mask, brow: p.white } }),
    ell(60, 63.5, 2.6, 1.8, { fill: p.nose }),
  ];
  return { svg: tail + body.join('') + g({ class: 'cc-head', 'transform-origin': '60 74' }, head), shadowRx: 32 };
}

// ---------------------------------------------------------------- TUCK (box turtle)
export function tuck(ctx) {
  const p = ctx.pal, s = ctx.sig, rand = ctx.rand;
  const skin = ctx.form('skin', p.hi, p.base, p.shadow);
  const shell = ctx.form('shell', p.shellL, p.shell, p.shellD, { cy: '20%' });
  const out = lerp(0.3, 1, (s + 1) / 2);   // how far the head is out of the shell
  const hx = lerp(92, 104, out), hy = lerp(96, 80, out);
  let plates = '';
  const cells = [[56, 68], [42, 76], [70, 76], [48, 88], [64, 88], [34, 90], [78, 90]];
  for (const [x, y] of cells) plates += path(`M${x - 6},${y} L${x - 3},${y - 5} L${x + 3},${y - 5} L${x + 6},${y} L${x + 3},${y + 5} L${x - 3},${y + 5} Z`, { fill: p.shellL, opacity: 0.45, stroke: p.plate, 'stroke-width': L3 });
  const headG = g({ class: 'cc-head', 'transform-origin': `${r2(hx)} ${r2(hy + 6)}` }, [
    path(`M${r2(hx - 11)},${r2(hy)} C${r2(hx - 11)},${r2(hy - 12)} ${r2(hx + 11)},${r2(hy - 12)} ${r2(hx + 12)},${r2(hy)} C${r2(hx + 12)},${r2(hy + 8)} ${r2(hx - 11)},${r2(hy + 8)} ${r2(hx - 11)},${r2(hy)} Z`, { fill: skin, ...ink(p) }),
    spots(rand, 4, { x: hx - 8, y: hy - 9, w: 16, h: 4 }, 0.6, 1.1, { fill: p.shellL, opacity: 0.8 }),
    face(ctx, { x: hx + 1, y: hy - 2, R: 11, gap: 5.2, eyeR: 2.7, mouthY: hy + 3.5, cheeks: false, pal: { ...p, lid: p.base } }),
  ]);
  const svg = [
    // far legs, tail
    ell(30, 104, 7, 4.5, { fill: p.shadow, ...ink(p, L2) }),
    path('M16,96 C10,98 10,101 16,101 Z', { fill: skin, ...ink(p, L3) }),
    // neck (behind the shell rim)
    path(`M80,98 C${r2(hx - 8)},${r2(hy + 10)} ${r2(hx - 8)},${r2(hy + 4)} ${r2(hx - 3)},${r2(hy + 2)} L${r2(hx + 3)},${r2(hy + 8)} C${r2(hx)},${r2(hy + 14)} 88,102 84,104 Z`, { fill: skin, ...ink(p, L2) }),
    // shell
    path('M16,98 C16,70 34,54 54,54 C74,54 92,70 92,98 Z', { fill: shell, ...ink(p) }),
    plates,
    path('M14,98 L94,98 L92,104 L16,104 Z', { fill: p.shellD, ...ink(p, L2) }),
    // moss patch on the shell
    path('M44,58 C48,52 58,52 62,56 C60,60 54,61 48,61 C46,61 44,60 44,58 Z', { fill: p.moss, ...ink(p, L3) }),
    path('M52,54 L52,48 M52,50 C49,47 47,48 47,49 C49,51 51,51 52,50 M52,49 C55,45 57,46 57,48 C55,50 53,50 52,49', { fill: p.mossL, stroke: p.sproutLine, 'stroke-width': 0.7 }),
    path('M28,70 Q34,62 42,60', { fill: 'none', stroke: p.gloss, 'stroke-width': 1.6, opacity: 0.6, 'stroke-linecap': 'round' }),
    // near legs
    ell(26, 106, 7.5, 4, { fill: skin, ...ink(p, L2) }), ell(76, 106, 7.5, 4, { fill: skin, ...ink(p, L2) }),
    path('M20,106 L19,104 M23,108 L22,106 M71,108 L70,106', { stroke: p.line, 'stroke-width': L3 }),
    headG,
  ];
  return { svg: svg.join(''), shadowRx: 44 };
}

// ---------------------------------------------------------------- BURR (beaver)
export function burr(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.hi, p.base, p.shadow);
  const slap = r2(-s * 20);
  let hatch = '';
  for (let i = 0; i < 6; i++) hatch += path(`M${76 + i * 5},92 L${86 + i * 5},108`, { stroke: p.tailL, 'stroke-width': 0.8 });
  for (let i = 0; i < 4; i++) hatch += path(`M78,${96 + i * 3.5} L104,${92 + i * 3.5}`, { stroke: p.tailL, 'stroke-width': 0.8 });
  const tailD = 'M70,100 C80,92 98,88 106,94 C110,100 104,108 92,108 C82,108 74,106 70,104 Z';
  const tclip = ctx.clip('tail', path(tailD));
  const svg = [
    g({ transform: `rotate(${slap} 72 102)`, class: 'cc-slap' }, [path(tailD, { fill: p.tail }), g({ 'clip-path': tclip }, hatch), path(tailD, { fill: 'none', ...ink(p) })]),
    path('M40,104 C34,86 42,70 60,70 C78,70 86,86 80,104 Z', { fill: fur, ...ink(p) }),
    ell(60, 94, 12, 10, { fill: p.muzzle, opacity: 0.6 }),
    feet(p, [47, 73], 8, 4, p.tail),
    // the stick being fixed
    path('M34,94 L88,82', { stroke: p.stick, 'stroke-width': 3.4, 'stroke-linecap': 'round' }),
    path('M34,94 L88,82', { stroke: p.stickD, 'stroke-width': 0.8, 'stroke-dasharray': '3 4' }),
    path('M78,84 C80,78 86,76 88,78 C86,82 82,84 78,84 Z', { fill: p.leaf, ...ink(p, L3) }),
    ell(48, 91, 4.2, 3.4, { fill: p.light, ...ink(p, L3) }), ell(72, 86, 4.2, 3.4, { fill: p.light, ...ink(p, L3) }),
  ];
  const head = [
    circ(44, 40, 4.5, { fill: fur, ...ink(p, L2) }), circ(76, 40, 4.5, { fill: fur, ...ink(p, L2) }),
    path('M38,56 C38,42 48,34 60,34 C72,34 82,42 82,56 C82,68 72,74 60,74 C48,74 38,68 38,56 Z', { fill: fur, ...ink(p) }),
    ell(60, 63, 11, 8, { fill: p.muzzle, ...ink(p, L3) }),
    face(ctx, { x: 60, y: 51, R: 22, gap: 9, eyeR: 3.8, mouthY: 64, mouthScale: 0.6 }),
    path('M56,60 Q60,57 64,60 Q62,62.6 60,62.6 Q58,62.6 56,60 Z', { fill: p.nose }),
    // buck teeth
    path('M57.2,66 L57.2,71 L59.8,71 L59.8,66 Z M60.2,66 L60.2,71 L62.8,71 L62.8,66 Z', { fill: p.teeth, ...ink(p, L3) }),
    path('M46,62 L38,60 M46,64 L39,66 M74,62 L82,60 M74,64 L81,66', { fill: 'none', stroke: p.line, 'stroke-width': 0.6, opacity: 0.5 }),
  ];
  return { svg: svg.join('') + g({ class: 'cc-head', 'transform-origin': '60 74' }, head), shadowRx: 34 };
}

// ---------------------------------------------------------------- DAPPLE (mushroom sprite)
export function dapple(ctx) {
  const p = ctx.pal, s = ctx.sig, rand = ctx.rand;
  const cap = ctx.form('cap', p.hi, p.base, p.shadow, { cy: '18%' });
  const stalk = ctx.form('stalk', '#fffaf0', p.stalk, p.stalkShade);
  const tilt = r2(-6 + s * 14);
  let dots = '';
  for (const [x, y, r] of [[42, 40, 4.5], [58, 30, 5.5], [76, 38, 4], [88, 50, 3.2], [30, 52, 3], [66, 44, 2.6], [50, 48, 2.4]]) dots += ell(x, y, r, r * 0.8, { fill: p.spot, ...ink(p, 0.5) });
  let gills = '';
  for (let i = 0; i < 11; i++) gills += path(`M${r2(34 + i * 5.2)},58 L${r2(46 + i * 2.8)},64`, { stroke: p.gill, 'stroke-width': 0.8 });
  const svg = [
    // spores float up when happy (orphan decoration)
    ctx.sig > 0.3 ? g({ class: 'cc-float' }, [circ(28, 36, 1.4, { fill: p.spore }), circ(94, 30, 1.1, { fill: p.spore }), circ(86, 20, 1.6, { fill: p.spore })]) : '',
    path('M44,104 C42,92 44,72 48,62 L72,62 C76,72 78,92 76,104 Z', { fill: stalk, ...ink(p) }),
    feet(p, [50, 70], 6, 3.4, p.stalkShade),
    // stubby arms
    path('M46,78 C40,80 38,86 40,88', { fill: 'none', stroke: p.stalkShade, 'stroke-width': 4, 'stroke-linecap': 'round' }),
    path('M74,78 C80,80 82,86 80,88', { fill: 'none', stroke: p.stalkShade, 'stroke-width': 4, 'stroke-linecap': 'round' }),
    // ring (annulus)
    path('M46,70 Q60,76 74,70 L74,73 Q60,79 46,73 Z', { fill: '#fffaf0', ...ink(p, L3) }),
    face(ctx, { x: 60, y: 84, R: 16, gap: 7, eyeR: 3.4, mouthY: 94 }),
    g({ transform: `rotate(${tilt} 60 62)`, class: 'cc-bob' }, [
      path('M24,60 C22,36 40,20 60,20 C80,20 98,36 96,60 C84,66 36,66 24,60 Z', { fill: cap, ...ink(p) }),
      path('M30,60 C44,64 76,64 90,60 L88,62 C74,66 46,66 32,62 Z', { fill: p.gill }),
      gills,
      dots,
      path('M36,38 Q44,28 56,26', { fill: 'none', stroke: p.gloss, 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.55 }),
    ]),
  ];
  void rand;
  return { svg: svg.join(''), shadowRx: 26 };
}

// ---------------------------------------------------------------- MOSS (badger, code pack)
export function moss(ctx) {
  const p = ctx.pal, s = ctx.sig;
  const fur = ctx.form('fur', p.light, p.base, p.shadow);
  const svg = [
    path('M28,104 C24,86 36,72 60,72 C84,72 96,86 92,104 Z', { fill: fur, ...ink(p) }),
    path('M40,104 C38,94 46,86 60,86 C74,86 82,94 80,104 Z', { fill: p.dark, opacity: 0.45 }),
    feet(p, [40, 80], 9, 4.2, p.dark),
    path('M34,98 L32,105 M38,99 L37,106 M82,99 L83,106 M86,98 L88,105', { stroke: p.stripe, 'stroke-width': 0.8 }),
    // satchel strap + pouch: the signature (it rattles with interest)
    path('M40,78 L80,100', { stroke: p.strap, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    g({ transform: `rotate(${r2(s * 8)} 80 96)` }, g({ class: 'cc-twitch', 'transform-origin': '80 96' }, [
      path('M72,94 C72,88 90,88 90,94 L89,106 C84,108 76,108 73,106 Z', { fill: p.pouch, ...ink(p, L2) }),
      path('M72,94 C76,98 86,98 90,94 L90,98 C86,101 76,101 72,98 Z', { fill: p.pouchD }),
      circ(81, 98.5, 1.4, { fill: p.button, ...ink(p, 0.5) }),
      path('M84,90 L86,84 M87,91 L91,86', { stroke: p.bristle, 'stroke-width': 1, 'stroke-linecap': 'round' }),
    ])),
  ];
  const head = [
    ell(42, 44, 5, 4, { fill: p.dark, ...ink(p, L2) }), ell(78, 44, 5, 4, { fill: p.dark, ...ink(p, L2) }),
    path('M36,60 C34,46 46,38 60,38 C74,38 86,46 84,60 C82,70 72,78 60,80 C48,78 38,70 36,60 Z', { fill: p.stripe, ...ink(p) }),
    path('M40,50 C44,44 50,44 52,50 L54,70 C48,70 42,62 40,50 Z', { fill: p.dark }),
    path('M80,50 C76,44 70,44 68,50 L66,70 C72,70 78,62 80,50 Z', { fill: p.dark }),
    path('M56,38 L60,74 L64,38 Z', { fill: '#ffffff', opacity: 0.5 }),
    face(ctx, { x: 60, y: 57, R: 22, gap: 10.5, eyeR: 3.6, mouthY: 73, pal: { ...p, lid: p.dark, brow: p.stripe } }),
    ell(60, 68, 3.4, 2.4, { fill: p.nose }),
  ];
  return { svg: svg.join('') + g({ class: 'cc-head', 'transform-origin': '60 80' }, head), shadowRx: 40 };
}

// ---------------------------------------------------------------- ROOT (ancient burrower, colossus)
export function root(ctx) {
  const p = ctx.pal, s = ctx.sig, rand = ctx.rand;
  const hide = ctx.form('hide', p.hi, p.base, p.shadow);
  const spread = 1 + s * 0.18;
  const antler = (side) => {
    const k = side;
    return g({ transform: `translate(60 40) scale(${r2(k * spread)} ${r2(spread)}) translate(-60 -40)` }, [
      path('M52,42 C46,32 44,22 38,16 M44,24 C38,24 34,20 32,14 M40,18 C42,12 40,8 36,4 M46,30 C52,26 52,20 50,14', { fill: 'none', stroke: p.antler, 'stroke-width': 3, 'stroke-linecap': 'round' }),
      path('M52,42 C46,32 44,22 38,16', { fill: 'none', stroke: p.antlerL, 'stroke-width': 1, 'stroke-linecap': 'round' }),
      ell(35, 10, 2.6, 1.6, { fill: p.moss, transform: 'rotate(-40 35 10)' }),
    ]);
  };
  const svg = [
    antler(1), antler(-1),
    path('M16,106 C14,76 30,44 60,42 C90,44 106,76 104,106 Z', { fill: hide, ...ink(p) }),
    // embedded stones
    ...[[34, 84, 6], [84, 90, 5], [70, 60, 3.4], [28, 100, 4]].map(([x, y, r]) => ell(x, y, r, r * 0.75, { fill: p.stone, ...ink(p, L3) }) + ell(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.25, { fill: p.stoneL })),
    path('M40,56 C46,50 54,50 56,54 C52,58 44,60 40,56 Z', { fill: p.moss, opacity: 0.9 }),
    spots(rand, 5, { x: 42, y: 52, w: 12, h: 4 }, 0.5, 1, { fill: p.mossL }),
    // big digging claws
    path('M22,104 L20,96 M28,106 L27,97 M34,106 L34,98 M86,106 L86,98 M92,106 L93,97 M98,104 L100,96', { stroke: p.claw, 'stroke-width': 2, 'stroke-linecap': 'round' }),
    ell(28, 104, 12, 5, { fill: p.shadow, ...ink(p, L2) }), ell(92, 104, 12, 5, { fill: p.shadow, ...ink(p, L2) }),
    ell(60, 70, 22, 15, { fill: p.hi, opacity: 0.45 }),
    face(ctx, { x: 60, y: 66, R: 24, gap: 11, eyeR: 3.6, mouthY: 86, cheeks: false, pal: { ...p, lid: p.light, brow: p.hi } }),
    // star-nose snout
    ...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return ell(60 + Math.cos(a) * 4.6, 77 + Math.sin(a) * 3.6, 2.2, 1.3, { fill: p.snout, ...ink(p, 0.5), transform: `rotate(${r2(a * 57.3)} ${r2(60 + Math.cos(a) * 4.6)} ${r2(77 + Math.sin(a) * 3.6)})` }); }),
    circ(60, 77, 2.4, { fill: p.snoutD }),
  ];
  return { svg: svg.join(''), shadowRx: 46 };
}
