// Emberkeep — the light field.
//
// WHAT THIS REPLACES, and why it was the root of "it offers little excitement":
// v2.1.2 had ONE baked radial sprite drawn over the whole scene as a darkness mask. Stone at the
// edge of the radius and stone under Ember's feet were filled with the IDENTICAL rgb before that
// mask went down. Nothing in the game was ever lit — things were only less dark. A hole in a black
// sheet is not lighting, and no amount of bloom on top of it makes a surface show form.
//
// WHAT THIS IS INSTEAD: a real multi-light lightmap, at quarter resolution, composited with
// 'multiply'. Quarter-res + bilinear upscale is the single biggest perf lever available in
// Canvas2D (redblobgames recommends exactly this to cut fill rate); the browser's own smoothing
// does the interpolation in native code, for free. Because it is a FIELD and not one sprite,
// braziers, burning tiles and hearths are light sources too, which is what makes a room read as
// a place with things in it rather than a torch in a void.
//
// Falloff is WINDOWED inverse-square. Pure 1/d^2 is the physically right shape but it diverges at
// d->0 and never actually reaches zero, so it is clamped near the centre and forced to 0 at the
// radius. Linear reads flat; smoothstep reads foggy; this reads like a flame.

const AMBIENT = [34, 33, 41];       // never pure black — an unlit area still has a cold floor
const LUT = 96;

let built = false;
let LIGHT_SPRITE = null;            // white, windowed inverse-square, tinted at blit time
const TINTED = new Map();           // colour key -> pre-tinted copy, so blits never allocate

function makeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  // THE CURVE, and why it is not literally 1/d^2.
  // Inverse-square is physically correct for a point light and it is WRONG here, measurably so:
  // at a 300px radius it puts ~85% of the light inside the inner fifth and the rest of the room
  // sits at a few percent. The first build of this file used it verbatim and the result was a
  // 100px pool in a 960px room — darker than the darkness mask it replaced. What a 2D light at
  // this scale needs is a perceptual curve: near-flat core, long readable shoulder, true zero at
  // the radius so the sprite tiles against the ambient without a seam.
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    const core = Math.max(0, 1 - Math.pow(u / 0.16, 2)) * 0.18;   // small flat-ish hot centre
    const a = Math.min(1, Math.pow(1 - u, 1.8) + core);
    gr.addColorStop(u, `rgba(255,255,255,${a.toFixed(4)})`);
  }
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  return c;
}

function tinted(r, gch, b) {
  const key = (r << 16) | (gch << 8) | b;
  let c = TINTED.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.drawImage(LIGHT_SPRITE, 0, 0);
  x.globalCompositeOperation = 'source-in';    // keep the falloff's alpha, replace its colour
  x.fillStyle = `rgb(${r},${gch},${b})`;
  x.fillRect(0, 0, 128, 128);
  TINTED.set(key, c);
  return c;
}

// 1/f FLICKER.
// Measured flame luminance has a flat low-frequency spectrum falling off as 1/f^n with
// n = 2.12 +/- 0.7 (Cornell). White noise is flat at EVERY frequency and has no temporal
// correlation, which is precisely why a per-frame Math.random() reads as electrical noise rather
// than as fire: it has no slow wander. A first-order low-pass over uniform noise gives slope 2.0,
// inside the measured band, in three lines and one multiply per tick.
export class Flicker {
  constructor(seed, k = 0.34) { this.n = (seed >>> 0) || 1; this.v = 0; this.acc = 0; this.k = k; }
  _r() { this.n = (this.n * 1664525 + 1013904223) >>> 0; return this.n / 4294967296; }
  // ticked at 64ms (~15.6Hz), the rate the source model uses. Frame rate does not change the noise.
  step(dtMs) {
    this.acc += Math.min(200, dtMs);
    while (this.acc >= 64) { this.acc -= 64; this.v += ((this._r() - 0.5) - this.v) * this.k; }
    return this.v;
  }
}

// A fire that only changes BRIGHTNESS reads as a dimmer switch. Three independent channels —
// intensity, origin position, colour temperature — is what reads as a flame in a draught.
export class FireFlicker {
  constructor(seed) {
    this.i = new Flicker(seed * 2654435761 + 1, 0.30);
    this.x = new Flicker(seed * 40503 + 7, 0.22);
    this.y = new Flicker(seed * 22695477 + 13, 0.22);
    this.t = new Flicker(seed * 69069 + 29, 0.12);
  }
  step(dtMs) {
    this.i.step(dtMs); this.x.step(dtMs); this.y.step(dtMs); this.t.step(dtMs);
  }
  get gain() { return 1 + this.i.v * 0.30; }          // intensity
  get ox() { return this.x.v * 5.0; }                 // origin wander, px
  get oy() { return this.y.v * 3.4; }
  get warm() { return this.t.v; }                     // -0.5 cool .. +0.5 warm
}

export class LightField {
  constructor(w, h, scale = 4) {
    this.scale = scale;
    this.w = w; this.h = h;
    this.lights = [];
    if (typeof document === 'undefined') return;
    this.cv = document.createElement('canvas');
    this.cv.width = Math.ceil(w / scale); this.cv.height = Math.ceil(h / scale);
    this.g = this.cv.getContext('2d');
    if (!built) { LIGHT_SPRITE = makeSprite(); built = true; }
  }

  begin() { this.lights.length = 0; }

  // r,gch,b is the light's own colour. Warm firelight is not white and a white light is the
  // fastest way to make a hand-tuned palette look like a programmer drew it.
  add(x, y, radius, r, gch, b, intensity) {
    if (radius <= 1 || intensity <= 0.01) return;
    this.lights.push({ x, y, radius, r, g: gch, b, i: intensity });
  }

  // Bake the field. One additive blit per light at quarter res: a 900px light costs 225px here.
  // ox/oy is the camera offset: lights are stored in WORLD coordinates (so shadeAt can be asked
  // about a tile without the caller doing coordinate maths) and converted to screen here, once.
  bake(ox = 0, oy = 0) {
    const s = this.scale, g = this.g;
    if (!g) return;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgb(${AMBIENT[0]},${AMBIENT[1]},${AMBIENT[2]})`;
    g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.globalCompositeOperation = 'lighter';
    for (const L of this.lights) {
      const spr = tinted(L.r, L.g, L.b);
      const R = L.radius / s;
      g.globalAlpha = Math.min(1, L.i);
      g.drawImage(spr, (L.x - ox) / s - R, (L.y - oy) / s - R, R * 2, R * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  // Multiply the scene by the field. Everything drawn BEFORE this is unlit surface colour;
  // everything drawn after (the glow buffer, bloom) is emissive and must not be darkened.
  apply(ctx, w, h) {
    if (!this.g) return;
    ctx.imageSmoothingEnabled = true;               // the free bilinear upscale
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.cv, 0, 0, w, h);
    // ...and then a low additive pass of the SAME map. Multiply alone can only ever darken, so a
    // lit surface tops out at its own unlit albedo and the brightest thing in the room still
    // looks like grey stone. The additive lift is what lets a surface actually glow under a
    // flame held against it, which is the whole reason there is a flame.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(this.cv, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- per-surface FORM -------------------------------------------------
  // Per-PIXEL normals on a 960x480 field is ~460k px/frame of JS and will not hold 60fps in
  // Canvas2D. Per-TILE is 800 dot products, which is nothing. This returns the dominant light's
  // direction and strength at a point, and the tile renderer uses it to put a highlight on the
  // face pointing at the light and a shade on the face pointing away. That difference — a
  // highlight EDGE and a shadow EDGE rather than uniform brightness — is what makes a flat
  // rectangle read as a solid object.
  shadeAt(x, y) {
    let bx = 0, by = 0, best = 0;
    for (let i = 0; i < this.lights.length; i++) {
      const L = this.lights[i];
      const dx = L.x - x, dy = L.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > L.radius) continue;
      const u = d / L.radius;
      const amt = L.i * (1 - u) * (1 - u);
      if (amt > best) { best = amt; bx = d < 0.001 ? 0 : dx / d; by = d < 0.001 ? -1 : dy / d; }
    }
    return { nx: bx, ny: by, amt: Math.min(1, best) };
  }
}
