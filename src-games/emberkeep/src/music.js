// Emberkeep — the score. Synthesised at runtime, no files, nothing licensed.
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
export const MOODS = {
  hollow:  { root: 55.00, pool: [0, 7, 12, 19], detune: 4,  density: 2.5, cut: 520,  beat: 0.25, decay: 5, shimmer: 0 },
  watched: { root: 36.71, pool: [0, 1, 7, 8, 13], detune: 9, density: 6,  cut: 780,  beat: 0.6,  decay: 6, shimmer: 0 },
  wrong:   { root: 51.91, pool: [0, 2, 4, 6, 8, 10], detune: 15, density: 10, cut: 1180, beat: 1.4, decay: 4, shimmer: 0.5 },
  bell:    { root: 65.41, pool: [0, 1, 3, 4, 6, 7, 9, 10], detune: 12, density: 13, cut: 1900, beat: 2.0, decay: 8, shimmer: 0.2 },
  collapse:{ root: 41.20, pool: [0, 1, 2, 13, 14], detune: 28, density: 22, cut: 2400, beat: 5.5, decay: 2, shimmer: 0.8 },
};

// index -> mood. Room 6 ("Still") is the breather and gets the calmest bed in the game; the
// final room gets hollow again, deliberately, so the last thing you hear is the first thing.
export const ROOM_MOOD = ['hollow','watched','watched','wrong','wrong','hollow','collapse','bell','wrong','collapse','hollow'];

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
