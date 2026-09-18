// The camp backdrop: a layered-depth scene (svg-graphics §1). Five planes back to
// front; contrast and saturation rise toward the viewer; far pines lean toward the
// sky hue. Colours come from CSS custom properties so Day and Night are one drawing.

import { el, g, path, ell, circ } from './kit.js';

const pine = (x, base, h, w, cls) => {
  const t = base - h;
  const d = `M${x},${t} L${x - w * 0.5},${t + h * 0.36} L${x - w * 0.28},${t + h * 0.34} L${x - w * 0.72},${t + h * 0.7} L${x - w * 0.38},${t + h * 0.68} L${x - w},${base} L${x + w},${base} L${x + w * 0.38},${t + h * 0.68} L${x + w * 0.72},${t + h * 0.7} L${x + w * 0.28},${t + h * 0.34} L${x + w * 0.5},${t + h * 0.36} Z`;
  return path(d, { class: cls });
};

export const STONE_SPOTS = [[60, 214], [118, 236], [196, 222], [258, 240], [318, 216], [352, 244]];

/** viewBox 0 0 400 260. The playground floor spans y 150..252 in EVERY scene, so the
 * creatures, the stones and the dew all sit correctly whichever backdrop is chosen. */
export const GROUND_D = 'M0,146 C80,138 160,150 240,144 C300,140 360,146 400,142 L400,260 L0,260 Z';

export const SCENES = Object.freeze([
  { id: 'camp', name: 'Camp clearing', note: 'The tent, the fire and the little creek.' },
  { id: 'creek', name: 'Creek bend', note: 'Stepping stones and cold, clear water.' },
  { id: 'hollow', name: 'Pine hollow', note: 'A fallen log, moss and mushrooms.' },
  { id: 'meadow', name: 'Meadow', name2: '', note: 'Open grass, far hills and slow butterflies.' },
  { id: 'shore', name: 'Quiet shore', note: 'A still lake that holds the sky.' },
]);
export const SCENE_IDS = SCENES.map((s) => s.id);
export const DEFAULT_SCENE = 'camp';

const defs = () => el('defs', {}, [
  el('linearGradient', { id: 'sc-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: '0%', class: 'sc-sky-top' }), el('stop', { offset: '100%', class: 'sc-sky-bot' })]),
  el('radialGradient', { id: 'sc-fireglow' }, [el('stop', { offset: '0%', class: 'sc-glow-in' }), el('stop', { offset: '100%', class: 'sc-glow-out' })]),
  el('radialGradient', { id: 'sc-lampglow' }, [el('stop', { offset: '0%', class: 'sc-glow-in' }), el('stop', { offset: '100%', class: 'sc-glow-out' })]),
  el('linearGradient', { id: 'sc-ground', x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: '0%', class: 'sc-ground-top' }), el('stop', { offset: '100%', class: 'sc-ground-bot' })]),
  el('linearGradient', { id: 'sc-water', x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: '0%', class: 'sc-creek-top' }), el('stop', { offset: '100%', class: 'sc-creek-bot' })]),
]);

const stars = () => {
  let out = '';
  for (let i = 0; i < 26; i++) out += circ((i * 61) % 400, (i * 37) % 90 + 4, (i % 3) * 0.35 + 0.5, { class: 'sc-star' });
  return out;
};
// Two pine bands that DRIFT at different speeds: the parallax is two transform
// animations on two groups, not motion on every tree — the stress shard measured the
// per-element style-recalc cost, and this keeps the recalc count flat.
const farBand = (n = 14, y = 132) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(pine(8 + i * 30, y, 54 + (i * 37) % 26, 15, 'sc-pine-far'));
  return g({ class: 'sc-drift-far' }, out);
};
const midBand = (n = 9, y = 150) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(pine(20 + i * 47 + (i % 2) * 9, y, 70 + (i * 23) % 30, 20, 'sc-pine-mid'));
  return g({ class: 'sc-drift-mid' }, out);
};
const nearPines = () => g({}, [pine(-6, 262, 170, 40, 'sc-pine-near'), pine(408, 262, 190, 44, 'sc-pine-near')]);
const ferns = () => g({ class: 'sc-fern' }, [
  path('M8,258 C18,232 30,222 44,218 M20,238 l-8,-4 M26,230 l-6,-6 M32,226 l-2,-8 M24,240 l8,-2 M30,232 l8,-1', { class: 'sc-fern-line' }),
  path('M392,258 C380,236 372,228 360,224 M380,242 l8,-4 M374,234 l6,-6 M368,228 l2,-8', { class: 'sc-fern-line' }),
]);
const motes = (n = 7) => g({ class: 'sc-motes' }, Array.from({ length: n }, (_, i) => circ(40 + i * 48, 120 + (i * 29) % 60, 1.6 + (i % 3) * 0.5, { class: `sc-mote sc-mote-${i % 4}` })).join(''));
const tent = () => g({ class: 'sc-tent' }, [
  path('M40,160 L78,110 L116,160 Z', { class: 'sc-tent-body' }),
  path('M78,110 L70,160 L86,160 Z', { class: 'sc-tent-door' }),
  path('M78,110 L78,104 M74,106 L82,106', { class: 'sc-line' }),
]);
const lantern = (x = 160) => g({ class: 'sc-lantern' }, [
  ell(x, 108, 36, 36, { fill: 'url(#sc-lampglow)', class: 'sc-lampglow' }),
  path(`M${x},150 L${x},112 M${x},112 L${x + 10},112`, { class: 'sc-post' }),
  path(`M${x + 6},112 L${x + 14},112 L${x + 16},126 L${x + 4},126 Z`, { class: 'sc-lamp' }),
  path(`M${x + 8},116 L${x + 12},116 L${x + 13},123 L${x + 7},123 Z`, { class: 'sc-lamp-light' }),
]);
const fire = (x = 222) => g({ class: 'sc-fire' }, [
  ell(x, 150, 60, 34, { fill: 'url(#sc-fireglow)', class: 'sc-fireglow' }),
  path(`M${x - 18},158 L${x + 18},150 M${x - 16},150 L${x + 18},158`, { class: 'sc-log' }),
  path(`M${x - 8},152 C${x - 10},140 ${x - 2},136 ${x - 4},126 C${x + 4},134 ${x + 10},140 ${x + 6},152 Z`, { class: 'sc-flame sc-flame-a' }),
  path(`M${x - 4},152 C${x - 4},144 ${x},142 ${x},136 C${x + 4},142 ${x + 6},146 ${x + 4},152 Z`, { class: 'sc-flame sc-flame-b' }),
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ell(x - 18 + i * 6, 157 + (i % 2), 3.4, 2.2, { class: 'sc-rock' })),
]);
const reeds = (xs) => g({ class: 'sc-reeds' }, xs.map((x) => path(`M${x},250 C${x - 3},232 ${x + 2},224 ${x - 1},214 M${x + 6},252 C${x + 4},238 ${x + 9},230 ${x + 6},222`, { class: 'sc-fern-line' })).join(''));
const flowers = (seedxs) => g({ class: 'sc-flowers' }, seedxs.map(([x, y, c]) => g({}, [
  path(`M${x},${y + 7} L${x},${y + 1}`, { class: 'sc-fern-line' }),
  circ(x, y, 2.3, { class: `sc-flower sc-flower-${c}` }),
  circ(x, y, 0.9, { class: 'sc-flower-eye' }),
]).toString()).join(''));

const SCENE_ART = {
  camp: () => [
    g({}, farBand()), g({}, midBand()),
    path(GROUND_D, { fill: 'url(#sc-ground)' }),
    path('M300,146 C312,170 290,196 330,214 C360,228 380,236 400,236 L400,256 C370,254 344,246 318,232 C282,212 298,178 288,146 Z', { class: 'sc-creek' }),
    path('M306,170 q8,4 4,10 M322,208 q10,4 20,4', { class: 'sc-creek-line' }),
    tent(), lantern(), fire(), motes(), ferns(), nearPines(),
  ],
  creek: () => [
    g({}, farBand(15, 128)), g({}, midBand(8, 148)),
    path(GROUND_D, { fill: 'url(#sc-ground)' }),
    // a wide bend across the whole floor, with stepping stones over it
    path('M0,196 C60,180 120,208 190,196 C250,186 320,212 400,198 L400,236 C320,250 250,226 190,236 C120,248 60,222 0,236 Z', { fill: 'url(#sc-water)', class: 'sc-creek' }),
    path('M20,210 q18,6 36,0 M120,222 q22,7 44,0 M250,210 q20,6 40,0 M330,224 q18,5 36,0', { class: 'sc-creek-line' }),
    ...[[54, 214], [116, 222], [186, 216], [252, 220], [318, 214]].map(([x, y], i) => ell(x, y, 13 - (i % 2) * 2, 5.5, { class: 'sc-rock' })),
    reeds([16, 44, 350, 382]), lantern(92), motes(5), ferns(), nearPines(),
  ],
  hollow: () => [
    g({}, farBand(16, 126)), g({}, midBand(11, 150)),
    path(GROUND_D, { fill: 'url(#sc-ground)' }),
    // a big fallen log across the back, mossy rocks and mushrooms
    // a fallen log lying ACROSS the hollow: tapered, tilted, with its cut end toward us
    g({ class: 'sc-loghollow' }, [
      path('M26,196 C120,176 250,170 388,158 C392,166 392,170 390,176 C250,188 122,196 34,214 Z', { class: 'sc-logbody' }),
      ell(30, 205, 13, 11, { class: 'sc-logend' }),
      ell(30, 205, 6.5, 5.5, { class: 'sc-logring' }),
      ell(30, 205, 2.5, 2, { class: 'sc-logring' }),
      path('M70,192 q34,-6 66,-9 M180,180 q40,-5 78,-7 M300,170 q30,-4 58,-5', { class: 'sc-logmoss' }),
      ...[[96, 186], [212, 176], [330, 166]].map(([x, y]) => ell(x, y, 5, 2, { class: 'sc-logring' })),
    ]),
    ...[[64, 214], [286, 220], [338, 208]].map(([x, y]) => ell(x, y, 15, 7, { class: 'sc-rock' })),
    ...[[104, 226, 7], [120, 232, 5], [300, 236, 6], [288, 230, 4]].map(([x, y, r]) => g({ class: 'sc-mush' }, [
      path(`M${x - 2},${y + 6} L${x - 2},${y} L${x + 2},${y} L${x + 2},${y + 6} Z`, { class: 'sc-mush-stem' }),
      path(`M${x - r},${y} C${x - r},${y - r} ${x + r},${y - r} ${x + r},${y} Z`, { class: 'sc-mush-cap' }),
    ]).toString()),
    motes(9), ferns(), nearPines(),
  ],
  meadow: () => [
    // distant hills instead of a pine wall: the open, bright scene
    path('M0,126 C60,100 130,120 190,108 C250,96 310,118 400,100 L400,152 L0,152 Z', { class: 'sc-hill-far' }),
    path('M0,142 C70,120 140,144 220,130 C290,118 340,138 400,126 L400,160 L0,160 Z', { class: 'sc-hill-near' }),
    g({}, midBand(4, 150)),
    path(GROUND_D, { fill: 'url(#sc-ground)' }),
    flowers([[38, 206, 'a'], [76, 226, 'b'], [132, 212, 'c'], [176, 236, 'a'], [228, 210, 'b'], [286, 232, 'c'], [338, 214, 'a'], [372, 234, 'b']]),
    g({ class: 'sc-flutter-band' }, [
      path('M120,120 c4,-6 10,-6 8,2 c6,-6 12,-2 6,4 z', { class: 'sc-butterfly sc-bf-1' }),
      path('M300,104 c4,-6 10,-6 8,2 c6,-6 12,-2 6,4 z', { class: 'sc-butterfly sc-bf-2' }),
    ]),
    lantern(250), motes(6), ferns(),
  ],
  shore: () => [
    g({}, farBand(12, 116)),
    // A still lake in the MIDDLE distance, holding the sky and the moon. The walkable
    // floor is the shared ground curve, exactly as in every other scene — a scene with its
    // own ground line would have put the creatures on the water (caught by the art gate).
    path('M0,116 L400,116 L400,152 L0,152 Z', { fill: 'url(#sc-water)', class: 'sc-lake' }),
    ell(330, 132, 15, 5, { class: 'sc-moon-ref' }),
    path('M20,126 q30,4 60,0 M140,138 q40,5 80,0 M250,132 q36,4 72,0 M60,144 q30,4 60,0', { class: 'sc-creek-line' }),
    path(GROUND_D, { fill: 'url(#sc-ground)' }),
    ...[[40, 226], [352, 232]].map(([x, y]) => ell(x, y, 17, 6, { class: 'sc-rock' })),
    g({ class: 'sc-drift' }, [path('M150,236 C180,230 230,232 262,238 C230,244 180,244 150,236 Z', { class: 'sc-driftwood' })]),
    reeds([12, 30, 370, 392]), fire(96), motes(4), nearPines(),
  ],
};

/** Render a backdrop. Unknown ids fall back to the camp clearing. */
export function renderScene(sceneId = DEFAULT_SCENE) {
  const id = Object.hasOwn(SCENE_ART, sceneId) ? sceneId : DEFAULT_SCENE;
  const art = SCENE_ART[id];
  return el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 400 260', preserveAspectRatio: 'xMidYMid slice', class: `scene scene-${id}`, 'aria-hidden': 'true', focusable: 'false' }, [
    defs(),
    el('rect', { x: 0, y: 0, width: 400, height: 260, fill: 'url(#sc-sky)' }),
    g({ class: 'sc-stars' }, stars()),
    circ(330, 40, 16, { class: 'sc-moon' }),
    ...art(),
  ]);
}

/** A stone at a fixed spot; flipped stones show what was underneath. */
export function renderStone(i, flipped) {
  const under = ['a beetle', 'a curled leaf', 'a round pebble', 'a sleepy worm', 'an acorn cap', 'a tiny key'][i % 6];
  const art = flipped
    ? el('svg', { viewBox: '0 0 40 24', 'aria-hidden': 'true' }, [
      ell(20, 16, 16, 7, { class: 'st-hole' }),
      i % 6 === 0 ? ell(20, 14, 4, 3, { class: 'st-bug' }) : i % 6 === 5 ? path('M16,15 h6 m0,0 v3 m-2,-3 v2', { class: 'st-key' }) : circ(20, 14, 3, { class: 'st-thing' }),
    ])
    : el('svg', { viewBox: '0 0 40 24', 'aria-hidden': 'true' }, [
      path('M4,18 C4,8 14,4 22,5 C32,6 38,12 36,18 C30,22 10,22 4,18 Z', { class: 'st-stone' }),
      path('M10,11 Q16,7 22,8', { class: 'st-shine' }),
    ]);
  return { art, under };
}
