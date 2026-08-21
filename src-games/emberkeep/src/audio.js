// Emberkeep — sound. Every voice here is SYNTHESISED at runtime: no files, no fetch, nothing
// licensed, nothing to ship. That is not a purity stance, it is the same constraint the rest of
// the build runs under — the extension makes no network requests and carries no third-party
// assets, and a folder of .ogg files would break both.
//
// Autoplay: browsers refuse to start an AudioContext without a gesture, so the context is
// created lazily on the first key press and everything before that is silently skipped.

const NOTE = { c3: 130.81, e3: 164.81, g3: 196.00, a3: 220.00, c4: 261.63, e4: 329.63, g4: 392.00, a4: 440.00, c5: 523.25, e5: 659.25 };

import { Music, ROOM_MOOD } from './music.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.music = null;
    this._pendingRoom = null;
    this.started = false;
    this.fireLevel = 0;      // 0..1, how much of the room is alight
    this._crackleAt = 0;
  }

  // Called from the first real key press.
  start() {
    if (this.started) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.started = true;

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    // a gentle ceiling so a burst of simultaneous events can never spike
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.ratio.value = 12;
    this.limiter.connect(this.master);

    this._noiseBuf = this._makeNoise(2.0);
    this._ambient();

    // v2.2: the SCORE. The fixed drone above stays as the room's air; this is the music on top
    // of it, and unlike the drone it is different in every room.
    this.music = new Music();
    this.music.attach(this.ctx, this.limiter);
    this.music.setEnabled(!this.muted);
    if (this._pendingRoom != null) this.setRoom(this._pendingRoom);
  }

  // Called on every room load. Before the context exists (no user gesture yet) it is remembered
  // and applied at start, rather than silently dropped — which is how a room would otherwise end
  // up with no music at all purely because it happened to be the first one.
  setRoom(i) {
    this._pendingRoom = i;
    if (!this.music) return;
    this.music.setMood(ROOM_MOOD[i % ROOM_MOOD.length], i * 2654435761 + 17);
  }

  setTension(k) { if (this.music) this.music.setTension(Math.max(0, Math.min(1, k))); }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
    if (this.music) this.music.setEnabled(!m);
  }

  _makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _noise(dur, { type = 'bandpass', freq = 900, q = 1, gain = 0.2, sweep = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.limiter);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _tone(freq, dur, { type = 'sine', gain = 0.16, glide = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.limiter);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ---- ambient bed: a low drone that drifts, plus filtered air. No melody, no loop point,
  // nothing that resolves — this is a room tone, not a soundtrack.
  _ambient() {
    const t = this.ctx.currentTime;
    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0.10;
    this.amb.connect(this.master);

    for (const [f, det] of [[NOTE.c3 / 2, 0], [NOTE.g3 / 2, 3.5], [NOTE.c3, -2.5]]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
      const g = this.ctx.createGain(); g.gain.value = 0.30;
      // very slow amplitude drift so it never sits still
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.031 + Math.random() * 0.04;
      const lg = this.ctx.createGain(); lg.gain.value = 0.16;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(t);
      o.connect(lp); lp.connect(g); g.connect(this.amb);
      o.start(t);
    }

    // cave air
    const air = this.ctx.createBufferSource();
    air.buffer = this._noiseBuf; air.loop = true;
    const af = this.ctx.createBiquadFilter();
    af.type = 'lowpass'; af.frequency.value = 240;
    const ag = this.ctx.createGain(); ag.gain.value = 0.05;
    const alfo = this.ctx.createOscillator(); alfo.frequency.value = 0.017;
    const alg = this.ctx.createGain(); alg.gain.value = 0.022;
    alfo.connect(alg); alg.connect(ag.gain); alfo.start(t);
    air.connect(af); af.connect(ag); ag.connect(this.amb);
    air.start(t);
  }

  // ---- per-frame: fire crackle scales with how much is actually burning
  tick(t, burningTiles, inDraft) {
    if (!this.ctx || this.muted) return;
    this.fireLevel += ((burningTiles > 0 ? Math.min(1, burningTiles / 12) : 0) - this.fireLevel) * 0.04;
    if (this.fireLevel > 0.02 && t - this._crackleAt > 4 && Math.random() < 0.08 + this.fireLevel * 0.35) {
      this._crackleAt = t;
      this._noise(0.05 + Math.random() * 0.09, {
        freq: 700 + Math.random() * 2200, q: 3 + Math.random() * 6,
        gain: 0.035 + this.fireLevel * 0.10, sweep: 300,
      });
    }
    if (inDraft && Math.random() < 0.22) {
      this._noise(0.20, { type: 'bandpass', freq: 420 + Math.random() * 260, q: 0.8, gain: 0.05, sweep: 180 });
    }
  }

  // ---- one-shots
  step()      { this._noise(0.035, { freq: 260 + Math.random() * 120, q: 1.2, gain: 0.035, sweep: 130 }); }
  jump()      { this._tone(300, 0.13, { type: 'triangle', gain: 0.09, glide: 520 }); }
  land()      { this._noise(0.07, { freq: 190, q: 1, gain: 0.07, sweep: 90 }); }
  shot()      { this._noise(0.16, { freq: 2400, q: 2, gain: 0.11, sweep: 380 });
                this._tone(720, 0.14, { type: 'sawtooth', gain: 0.05, glide: 240 }); }
  fizzle()    { this._noise(0.10, { freq: 1500, q: 4, gain: 0.05, sweep: 500 }); }
  ignite()    { this._noise(0.40, { freq: 380, q: 0.7, gain: 0.16, sweep: 1500 });
                this._tone(90, 0.34, { type: 'sine', gain: 0.10, glide: 150 }); }
  collapse()  { this._noise(0.55, { type: 'lowpass', freq: 420, q: 0.5, gain: 0.16, sweep: 70 });
                this._tone(64, 0.5, { type: 'sine', gain: 0.12, glide: 38 }); }
  shard()     { this._tone(NOTE.e5, 0.30, { gain: 0.10 });
                this._tone(NOTE.g4, 0.38, { gain: 0.07, delay: 0.05 }); }
  cache()     { [NOTE.c4, NOTE.e4, NOTE.g4, NOTE.c5].forEach((f, i) =>
                  this._tone(f, 0.62, { gain: 0.085, delay: i * 0.075 })); }
  drop()      { this._tone(NOTE.a4, 0.24, { gain: 0.09 }); this._tone(NOTE.c5, 0.30, { gain: 0.06, delay: 0.04 }); }
  startle()   { this._tone(196, 0.20, { type: 'square', gain: 0.09, glide: 120 });
                this._noise(0.18, { freq: 1400, q: 2, gain: 0.07, sweep: 300 }); }
  crumble()   { this._noise(0.30, { freq: 620, q: 1.4, gain: 0.07, sweep: 200 }); }
  guttering() { this._tone(NOTE.a3, 1.1, { type: 'triangle', gain: 0.10, glide: NOTE.a3 * 0.6 }); }
  relit()     { this._tone(NOTE.c4, 0.35, { gain: 0.10, glide: NOTE.g4 }); }
  out()       { [NOTE.g3, NOTE.e3, NOTE.c3].forEach((f, i) =>
                  this._tone(f, 1.0, { type: 'triangle', gain: 0.11, delay: i * 0.18 }));
                this._noise(0.9, { type: 'lowpass', freq: 300, gain: 0.09, sweep: 50 }); }
  clear(clean) {
    const chord = clean ? [NOTE.c4, NOTE.e4, NOTE.g4, NOTE.c5] : [NOTE.c4, NOTE.e4, NOTE.a4];
    chord.forEach((f, i) => this._tone(f, 1.3, { gain: 0.10, delay: i * 0.09 }));
  }
  goal()      { [NOTE.g4, NOTE.c5, NOTE.e5].forEach((f, i) => this._tone(f, 0.7, { gain: 0.09, delay: i * 0.07 })); }
}
