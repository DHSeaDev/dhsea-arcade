// Emberkeep — pre-rendered sprite cache.
//
// MEASURED PROBLEM: the renderer allocated ~200 CanvasGradient objects EVERY FRAME — one per
// particle, one per mane blob, one per glowing tile. createRadialGradient is not free and 200 of
// them per frame is both CPU and sustained GC pressure. Frame time was 48ms.
//
// FIX: a radial gradient that only ever differs by size and tint does not need to be an object at
// all. Bake a handful of them into offscreen canvases once, then drawImage with a scale and an
// alpha. drawImage of a cached bitmap is the cheapest thing Canvas2D does.
//
// Everything here is built at module load, costs a few hundred KB of canvas, and is immutable.

// Built LAZILY on first blit. The suite and the solver import this module transitively and run
// in Node, where `document` does not exist — a module that allocates canvases at import time
// makes the whole physics layer un-testable outside a browser.
let built = false;

function make(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, col] of stops) g.addColorStop(at, col);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

const S = 64;

export const FLAME = [];      // warm -> dark red, 10 steps: well under visible banding
export const CINDER = [];     // small, bright, near-white core
export const MANE = [];       // wider and softer; the rig alone used to cost 76 gradients a frame
export const GLOW = {};       // fixed-colour cases: drop, brazier, shard, spark, ember
export let SMOKE = null, MANE_CORE = null;

export function buildSprites() {
  if (built || typeof document === 'undefined') return built;
  for (let i = 0; i < 10; i++) {
    const k = 1 - i / 9;
    const gr = Math.round(60 + 165 * k), b = Math.round(10 + 60 * k * k);
    FLAME.push(make(S, [
      [0, `rgba(255,${Math.min(255, gr + 70)},${b + 90},1)`],
      [0.45, `rgba(255,${gr},${b},0.75)`],
      [1, `rgba(${Math.round(150 * k)},${Math.round(30 * k)},0,0)`],
    ]));
  }
  for (let i = 0; i < 6; i++) {
    const k = 1 - i / 5;
    CINDER.push(make(32, [
      [0, `rgba(255,${Math.round(150 + 90 * k)},${Math.round(60 + 60 * k)},1)`],
      [0.6, `rgba(255,${Math.round(120 + 60 * k)},40,0.5)`],
      [1, 'rgba(255,90,20,0)'],
    ]));
  }
  for (let i = 0; i < 12; i++) {
    const hot = 1 - i / 11;
    const gr = Math.round(110 + 145 * hot), b = Math.round(20 + 150 * hot * hot);
    MANE.push(make(S, [
      [0, `rgba(255,${Math.min(255, gr + 60)},${Math.min(255, b + 70)},1)`],
      [0.55, `rgba(255,${gr},${b},0.55)`],
      [1, 'rgba(170,40,0,0)'],
    ]));
  }
  SMOKE = make(64, [[0, 'rgba(38,33,30,1)'], [1, 'rgba(30,26,24,0)']]);
  MANE_CORE = make(S, [[0, 'rgba(255,244,214,1)'], [1, 'rgba(255,200,120,0)']]);
  Object.assign(GLOW, {
    warm:  make(S, [[0, 'rgba(255,238,190,1)'], [0.4, 'rgba(255,178,80,0.55)'], [1, 'rgba(255,140,40,0)']]),
    hot:   make(S, [[0, 'rgba(255,226,160,1)'], [0.5, 'rgba(255,140,40,0.6)'], [1, 'rgba(255,90,10,0)']]),
    cold:  make(S, [[0, 'rgba(180,214,255,1)'], [1, 'rgba(110,160,255,0)']]),
    shard: make(S, [[0, 'rgba(214,236,255,1)'], [0.45, 'rgba(140,190,255,0.5)'], [1, 'rgba(90,140,255,0)']]),
    spark: make(S, [[0, 'rgba(255,246,215,1)'], [0.35, 'rgba(255,170,60,0.8)'], [1, 'rgba(255,110,20,0)']]),
    ember: make(S, [[0, 'rgba(255,190,110,1)'], [1, 'rgba(255,120,30,0)']]),
  });
  built = true;
  return true;
}

// Draw a cached sprite centred at (x, y) with radius r. One drawImage, no allocation.
export function blit(ctx, sprite, x, y, r, alpha) {
  if (!sprite || alpha <= 0.004 || r <= 0.15) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export function ramp(arr, k) {
  if (!arr.length) return null;
  return arr[Math.min(arr.length - 1, Math.max(0, Math.round((1 - k) * (arr.length - 1))))];
}
