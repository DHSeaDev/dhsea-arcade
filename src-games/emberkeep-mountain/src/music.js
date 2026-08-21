// Emberkeep - Mountain — the score. Synthesised at runtime, no files, nothing licensed.
//
// The register is DIFFERENT from the platformer's, deliberately. That game was a dark keep and
// wanted dread; this one has no threat in it at all, so dread would be a lie the music tells about
// the game. Monument Valley's audio is sparse and meditative because it must not compete with
// contemplation, and — the part worth stealing — it is REACTIVE: turning a crank plays an
// arpeggio, so the player is playing the instrument rather than triggering a sound effect. That
// is `arpeggio()` at the bottom of this file, and it is the single most Monument-Valley thing in
// the whole build.
//
// v2.1.2 had ONE ambient drone, identical in all eleven rooms, forever. This replaces it with a
// generative score whose mood is a PARAMETER VECTOR rather than eleven authored tracks — the
// shape every published adaptive game score converges on (No Man's Sky's Pulse varies playback
// parameters over instrument sets; Rain World keys ~10 variations per area to threat; the
// VAT framework quantises valence/arousal/tension to a handful of levels each). Authoring eleven
// tracks would be eleven times the work and would still not respond to what is happening.
//
// The axes: root (register), pool (which intervals are allowed), detune (cents), density
// (events/min), cutoff (Hz), beat (Hz), decay (reverb seconds).
//
// WHY THESE INTERVALS. A tritone is 600 cents, exactly half an octave, and resists being heard
// as belonging to any key. A minor 2nd at 100 cents sits near the roughness peak — and roughness
// peaks at about a quarter of a critical band, which WIDENS toward an octave in the bass, so the
// same semitone that is merely tense at C5 is physiologically nastier as a low cluster. That is
// why the ugly intervals here live in the bottom two octaves. Detune reads as warmth below about
// 7 cents (near the ~5-cent JND), as unsettled from 8 to 20, and as a broken instrument past 25.
//
// SCHEDULING. setTimeout skews by tens of milliseconds under GC; the standard fix is a lookahead
// scheduler — wake every 25ms, schedule everything falling inside the next 100ms — so the audio
// clock, not the JS clock, decides when a note starts.
const LOOKAHEAD_MS = 25, SCHEDULE_WINDOW = 0.1;

// Eleven rooms, five moods. Each room points at a mood and gets its own PRNG seed, so a room
// always sounds like itself without being identical twice.
// Five moods, all consonant. The intervals are the open ones — fifths, fourths, ninths, the
// pentatonic — because nothing in this game is threatening the player and the score should not
// pretend otherwise. Detune stays under 8 cents, which reads as warmth rather than as unease
// (the just-noticeable difference is around 5, and 25+ reads as a broken instrument).
export const MOODS = {
  dawn:   { root: 65.41, pool: [0, 7, 12, 14, 19], detune: 4, density: 2.5, cut: 900,  beat: 0.22, decay: 6, shimmer: 0.1 },
  stone:  { root: 55.00, pool: [0, 5, 7, 12, 17], detune: 5, density: 4,   cut: 760,  beat: 0.30, decay: 7, shimmer: 0 },
  high:   { root: 82.41, pool: [0, 2, 7, 9, 14], detune: 6, density: 6,   cut: 1500, beat: 0.45, decay: 5, shimmer: 0.35 },
  hollow: { root: 49.00, pool: [0, 7, 12, 19, 24], detune: 3, density: 2,   cut: 620,  beat: 0.18, decay: 9, shimmer: 0 },
  summit: { root: 73.42, pool: [0, 4, 7, 11, 14, 16], detune: 5, density: 8, cut: 2000, beat: 0.55, decay: 8, shimmer: 0.5 },
};

// index -> mood. Room 6 ("Still") is the breather and gets the calmest bed in the game; the
// final room gets hollow again, deliberately, so the last thing you hear is the first thing.
// Ten chapters. The last is `summit` and the first is `dawn`; chapter VII, the dark stair, is the
// only one that goes quiet and low, because it is the only one that asks the player to trust
// something they cannot see.
export const ROOM_MOOD = ['dawn','stone','stone','high','stone','high','hollow','high','stone','summit'];

const cents = (c) => Math.pow(2, c / 1200);
const semi = (n) => Math.pow(2, n / 12);

export class Music {
  constructor() {
    this.ctx = null; this.on = false; this.mood = null; this.moodName = null;
    this.timer = null; this.next = 0; this.rnd = 1;
    this.voices = [];   // the sustained bed: things that must be torn down on a room change
    this.master = null; this.send = null; this.filter = null;
  }

  _r() { this.rnd = (this.rnd * 1664525 + 1013904223) >>> 0; return this.rnd / 4294967296; }

  attach(ctx, out) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    // ONE shared convolver on a send bus. A ConvolverNode runs FFTs per 128-frame render quantum
    // and its cost scales with impulse length; one per voice is the single most reliable way to
    // make Web Audio stutter. Everything that wants reverb sends to this.
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(ctx, 5.0);
    this.send = ctx.createGain(); this.send.gain.value = 0.55;
    this.send.connect(this.verb); this.verb.connect(this.master);
    this.master.connect(out);
  }

  // A procedural impulse response: exponentially decaying noise, with the tail low-passed by
  // hand so distance reads as loss of high end rather than only as loss of level. No IR files,
  // which the no-network rule requires anyway.
  _impulse(ctx, secs) {
    const n = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const env = Math.pow(1 - i / n, 2.4);
        lp += ((Math.random() * 2 - 1) - lp) * (0.55 - 0.45 * (i / n));
        d[i] = lp * env;
      }
    }
    return buf;
  }

  _noiseBuf(ctx, secs, kind) {
    const n = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'pink') {
        b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759; b2=.969*b2+w*.153852;
        b3=.8665*b3+w*.3104856; b4=.55*b4+w*.5329522; b5=-.7616*b5-w*.016898;
        d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*0.11; b6=w*.115926;
      } else if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5;
      } else d[i] = w;
    }
    // crossfade the last 200ms into the head so the loop point has no click in it
    const x = Math.min(n >> 2, (ctx.sampleRate * 0.2) | 0);
    for (let i = 0; i < x; i++) {
      const u = i / x;
      d[i] = d[i] * u + d[n - x + i] * (1 - u);
    }
    return buf;
  }

  // Never assign .value on a sounding node and never exponentially ramp to 0 — it cannot reach
  // zero. setTargetAtTime with a 15ms constant can, and does not click.
  _ramp(param, to, when, tc = 0.015) { param.setTargetAtTime(to, when, tc); }

  setMood(name, seed) {
    if (!this.ctx) return;
    const M = MOODS[name] || MOODS.hollow;
    this.mood = M; this.moodName = MOODS[name] ? name : 'hollow';
    this.rnd = (seed >>> 0) || 1;
    this.verb.buffer = this._impulse(this.ctx, M.decay);
    this._teardown();
    this._bed(M);
    if (!this.timer) {
      this.next = this.ctx.currentTime + 0.2;
      this.timer = setInterval(() => this._pump(), LOOKAHEAD_MS);
    }
  }

  _teardown() {
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      this._ramp(v.g.gain, 0.0001, t, 0.25);
      setTimeout(() => { try { v.stop(); } catch {} }, 1200);
    }
    this.voices = [];
  }

  // The sustained bed: a detuned drone pair that BEATS, plus a filtered noise wind whose filter
  // breathes on a 7-20s LFO — the period of a slow human breath, which is not an accident.
  _bed(M) {
    const ctx = this.ctx, t = ctx.currentTime;
    const mk = (freq, detCents, type, gain) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.value = freq; o.detune.value = detCents;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = M.cut; f.Q.value = 0.8;
      o.connect(f); f.connect(g); g.connect(this.master); g.connect(this.send);
      o.start();
      this._ramp(g.gain, gain, t + 0.05, 1.6);
      const v = { o, g, f, stop: () => { o.stop(); } };
      this.voices.push(v);
      return v;
    };
    // the beating pair. Two sines Δ apart beat at exactly Δ Hz; M.beat IS the pulse rate you hear.
    const beatCents = 1200 * Math.log2((M.root + M.beat) / M.root);
    mk(M.root, 0, 'sine', 0.16);
    mk(M.root, beatCents, 'sine', 0.14);
    mk(M.root * 2, M.detune, 'triangle', 0.055);
    mk(M.root * semi(M.pool[Math.min(2, M.pool.length - 1)]), -M.detune, 'triangle', 0.040);

    // wind bed
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 4, M.shimmer > 0.4 ? 'white' : 'pink');
    src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 200 + M.cut * 0.2; bp.Q.value = 3.5;
    const wg = ctx.createGain(); wg.gain.value = 0.0001;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + this._r() * 0.10;  // 10-20s
    const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(bp.frequency);
    src.connect(bp); bp.connect(wg); wg.connect(this.master); wg.connect(this.send);
    src.start(); lfo.start();
    this._ramp(wg.gain, 0.055 + M.shimmer * 0.05, t + 0.1, 2.2);
    this.voices.push({ o: src, g: wg, stop: () => { src.stop(); lfo.stop(); } });
  }

  // The lookahead scheduler. Wake often, schedule ahead, let the audio clock be the clock.
  _pump() {
    if (!this.ctx || !this.on || !this.mood) return;
    const ctx = this.ctx, M = this.mood;
    while (this.next < ctx.currentTime + SCHEDULE_WINDOW) {
      this._event(M, this.next);
      // Poisson-ish spacing with heavy jitter. Grid-aligned sparse events read as a metronome,
      // which is the one thing a dread bed must never do.
      const mean = 60 / Math.max(0.5, M.density);
      this.next += mean * (0.35 + this._r() * 1.6);
    }
  }

  _event(M, when) {
    const roll = this._r();
    if (roll < 0.42) this._drip(M, when);
    else if (roll < 0.72) this._bellNote(M, when);
    else if (roll < 0.90) this._swell(M, when);
    else this._sub(M, when);
  }

  // a click or a drip: bandpassed noise burst, 1-5ms attack, 30-120ms decay
  _drip(M, when) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 0.25, 'white');
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 800 + this._r() * 3200; bp.Q.value = 8 + this._r() * 12;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.05 + this._r() * 0.05, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03 + this._r() * 0.09);
    src.connect(bp); bp.connect(g); g.connect(this.master); g.connect(this.send);
    src.start(when); src.stop(when + 0.4);
  }

  // an FM bell. Non-integer carrier:modulator ratios give inharmonic partials, which is what
  // makes a struck-metal tone rather than an organ note. 2:5 is the classic bell ratio.
  _bellNote(M, when) {
    const ctx = this.ctx;
    const step = M.pool[(this._r() * M.pool.length) | 0];
    const oct = this._r() < 0.5 ? 4 : 8;
    const f = M.root * semi(step) * oct * cents((this._r() - 0.5) * 2 * M.detune);
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 2.5;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 3, when);
    mg.gain.exponentialRampToValueAtTime(f * 0.02, when + 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.030, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 2.6 + this._r() * 3);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = M.cut * 1.6;
    car.connect(lp); lp.connect(g); g.connect(this.master); g.connect(this.send);
    car.start(when); mod.start(when);
    car.stop(when + 6.5); mod.stop(when + 6.5);
  }

  // a slow swell that stops dead. The cut is the effect: contrast, not volume.
  _swell(M, when) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 5, 'brown'); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(180, when);
    bp.frequency.exponentialRampToValueAtTime(400 + M.cut, when + 3.2);
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    const dur = 2.6 + this._r() * 4;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.045 + M.shimmer * 0.03, when + dur);
    g.gain.setValueAtTime(0.045 + M.shimmer * 0.03, when + dur);
    g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.02);   // the hard cut, 20ms
    src.connect(bp); bp.connect(g); g.connect(this.master); g.connect(this.send);
    src.start(when); src.stop(when + dur + 0.3);
  }

  _sub(M, when) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = M.root * 0.5 * cents((this._r() - 0.5) * 2 * M.detune);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.075, when + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, when + 4.5);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + 5);
  }

  // REACTIVE AUDIO: the player turns a handle and the mountain answers with an arpeggio in the
  // level's own mode. Monument Valley's cogs do exactly this, and it is why turning a crank there
  // feels like an action rather than an input.
  arpeggio(dirUp = true) {
    if (!this.ctx || !this.on || !this.mood) return;
    const M = this.mood, ctx = this.ctx;
    const n = 4 + (this._r() * 3 | 0);
    const t0 = ctx.currentTime + 0.01;
    for (let i = 0; i < n; i++) {
      const step = M.pool[(dirUp ? i : n - 1 - i) % M.pool.length];
      const f = M.root * 8 * Math.pow(2, step / 12) * cents((this._r() - 0.5) * 2 * M.detune);
      const when = t0 + i * 0.062;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.055, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
      o.connect(g); g.connect(this.master); g.connect(this.send);
      o.start(when); o.stop(when + 0.5);
    }
  }

  // one soft note when he arrives somewhere, pitched from the pool. Footsteps are almost
  // subliminal in the genre; this is the only movement sound there is.
  stepNote() {
    if (!this.ctx || !this.on || !this.mood) return;
    const M = this.mood, ctx = this.ctx, when = ctx.currentTime + 0.005;
    const f = M.root * 4 * Math.pow(2, M.pool[(this._r() * M.pool.length) | 0] / 12);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.020, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.20);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + 0.26);
  }

  // the beacon lighting: the one moment the score is allowed to be pleased about something
  chime() {
    if (!this.ctx || !this.on || !this.mood) return;
    const M = this.mood, ctx = this.ctx;
    [0, 7, 12, 19].forEach((st, i) => {
      const when = ctx.currentTime + 0.02 + i * 0.11;
      const f = M.root * 8 * Math.pow(2, st / 12);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.07, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 2.4);
      o.connect(g); g.connect(this.master); g.connect(this.send);
      o.start(when); o.stop(when + 2.6);
    });
  }

  setEnabled(v) {
    this.on = v;
    if (!this.ctx) return;
    this._ramp(this.master.gain, v ? 0.34 : 0.0001, this.ctx.currentTime, 0.4);
  }

  // Tension rides on top of the mood without changing it: brighter and busier as things burn.
  setTension(k) {
    if (!this.ctx || !this.mood) return;
    for (const v of this.voices) if (v.f) {
      this._ramp(v.f.frequency, this.mood.cut * (1 + k * 1.3), this.ctx.currentTime, 0.9);
    }
  }
}
