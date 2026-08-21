// Every sound in Lumenreel is SYNTHESISED at runtime through Web Audio.
// No media files ship, nothing is licensed, nothing is fetched, and the bundle
// stays tiny. preship check "no media" fails the build if an .mp3/.ogg/.wav or a
// decodeAudioData call ever appears — the same gate that protects Emberkeep.
//
// An AudioContext cannot start without a user gesture, so everything here is
// lazily constructed on the first real interaction and is a no-op until then.

const A4 = 440;
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
/** Scientific pitch name -> Hz. 'A4' -> 440. */
export function hz(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return A4;
  return A4 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12 - 9) / 12);
}

// Pentatonic-minor over D — warm, never sour, and safe to play in any order,
// which is what lets the ambient layer improvise without ever clashing.
const SCALE = ['D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'];
const PADS = [
  ['D3', 'A3', 'F4'],   // i
  ['A#2', 'F3', 'D4'],  // VI
  ['F3', 'C4', 'A4'],   // III
  ['G3', 'D4', 'A#4'],  // iv
];

// Three styles, all synthesised — same D-minor material, three completely
// different energies. Cycled by the player; the choice persists in the save.
// One place for the balance, so a future tweak cannot make one bus drift.
// Effects are transient and music is sustained, so parity on the bus still reads
// as "the effects drown it out". These are deliberately well under 1:1.
export const SFX_LEVEL = 0.26;
export const MUSIC_LEVELS = { ambient: 0.46, pop: 0.42, rock: 0.40 };

export const MUSIC_STYLES = ['ambient', 'pop', 'rock'];
export const MUSIC_LABELS = { ambient: 'Ambient', pop: 'Pop', rock: 'Rock' };

// Root of each bar, shared by every style so switching mid-session stays in key.
const PROG = ['D2', 'A#1', 'F2', 'C2'];
// 16-step patterns. 1 = hit. Written out rather than generated so each style has
// a real groove instead of an algorithm's idea of one.
const POP = {
  bpm: 118,
  kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
  snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
  hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1],
  bass:  [1,0,1,0, 0,1,0,0, 1,0,1,0, 0,1,0,0],
  lead:  [0,0,0,1, 0,1,0,0, 0,0,1,0, 1,0,0,0],
  leadOct: 1,
};
const ROCK = {
  bpm: 142,
  kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,0,0],
  snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
  hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  chord: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0],
  lead:  [0,0,1,0, 0,1,0,0, 0,0,0,1, 0,0,1,0],
  leadOct: 0,
};

export class PrismAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.musicOn = true;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this._noise = null;
    this._padTimer = null;
    this._arpTimer = null;
    this._seqTimer = null;
    this._step = 0;
    this._nextNoteAt = 0;
    this._chord = 0;
    this.style = 'ambient';
    this._drive = null;
    this._reelHeat = 0;   // rises through a spin so the 5 stops climb in pitch
  }

  /** Call from ANY user gesture. Idempotent and cheap after the first time. */
  start() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    // Mix: effects sit UNDER the bed. At 0.85 against a 0.24 music bus the SFX
    // buried the music completely — reported, and correct. The music bus is also
    // louder now, so the balance comes from both sides rather than from one.
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_LEVEL;

    // A gentle bus compressor keeps a 12-coin cascade from clipping while a
    // single click still reads at full weight.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 22;
    comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.sfxBus.connect(comp); comp.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? this._styleGain() : 0;
    this.musicBus.connect(this.master);

    this._noise = this._makeNoise(ctx);

    // Soft-clip curve, used by the rock style's guitar bus.
    this._drive = ctx.createWaveShaper();
    const cur = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; cur[i] = Math.tanh(x * 3.4); }
    this._drive.curve = cur; this._drive.oversample = '2x';

    this.ready = true;
    this._startMusic();
  }

  setMuted(v) {
    this.muted = !!v;
    if (this.sfxBus) this._ramp(this.sfxBus.gain, this.muted ? 0 : SFX_LEVEL, 0.12);
  }
  setMusic(v) {
    this.musicOn = !!v;
    if (this.musicBus) this._ramp(this.musicBus.gain, this.musicOn ? this._styleGain() : 0, 0.4);
  }

  _styleGain() { return MUSIC_LEVELS[this.style] ?? MUSIC_LEVELS.ambient; }

  /** Cycle Ambient -> Pop -> Rock. Returns the new style id. */
  cycleMusic() {
    const i = MUSIC_STYLES.indexOf(this.style);
    return this.setStyle(MUSIC_STYLES[(i + 1) % MUSIC_STYLES.length]);
  }

  setStyle(style) {
    if (!MUSIC_STYLES.includes(style)) style = 'ambient';
    this.style = style;
    this._stopMusic();
    if (this.ready) {
      if (this.musicBus) this.musicBus.gain.value = this.musicOn ? this._styleGain() : 0;
      this._startMusic();
    }
    return this.style;
  }

  _ramp(param, to, t) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + t);
  }

  /** 2s of white noise, reused as a buffer source for every transient. */
  _makeNoise(ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 1;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823 - 1; }
    return buf;
  }

  // --- primitives ----------------------------------------------------------
  _tone({ freq, type = 'sine', dur = 0.2, gain = 0.3, attack = 0.005, decay, detune = 0, bus, slideTo, delay = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay ?? dur));
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  _burst({ dur = 0.08, gain = 0.25, hp = 800, lp = 9000, delay = 0, sweepTo }) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.playbackRate.value = 1;
    const hpF = ctx.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = hp;
    const lpF = ctx.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.setValueAtTime(lp, t0);
    if (sweepTo) lpF.frequency.exponentialRampToValueAtTime(Math.max(120, sweepTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(this.sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  /** A struck crystal: inharmonic partials, fast attack, long shimmer tail. */
  _bell(freq, { gain = 0.22, dur = 1.5, delay = 0 } = {}) {
    const partials = [1, 2.01, 3.02, 4.16, 5.43];
    const amps = [1, 0.55, 0.32, 0.18, 0.1];
    partials.forEach((p, i) => this._tone({
      freq: freq * p, type: 'sine', dur: dur * (1 - i * 0.13),
      gain: gain * amps[i], attack: 0.002, delay,
    }));
  }

  // --- the casino layer ----------------------------------------------------
  click()      { this._burst({ dur: 0.035, gain: 0.16, hp: 1800, lp: 7000 }); }
  deny()       { this._tone({ freq: hz('F3'), type: 'square', dur: 0.14, gain: 0.1, slideTo: hz('C3') }); }

  /** Lever pull: an air whoosh under a rising glass tone. */
  spinStart() {
    this._reelHeat = 0;
    this._burst({ dur: 0.5, gain: 0.14, hp: 300, lp: 1200, sweepTo: 5200 });
    this._tone({ freq: hz('D3'), type: 'triangle', dur: 0.42, gain: 0.11, slideTo: hz('A3') });
  }

  /** One reel landing. Pitch climbs per reel — a real mechanical cadence, and it
   *  is a function of the REEL INDEX only, never of the outcome (dark-law 3). */
  reelStop(i) {
    const f = hz(['D4', 'F4', 'G4', 'A4', 'C5'][Math.min(4, i)]);
    this._burst({ dur: 0.05, gain: 0.2, hp: 2200, lp: 11000 });
    this._tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.14, attack: 0.002 });
    this._tone({ freq: f / 2, type: 'sine', dur: 0.22, gain: 0.09 });
  }

  /** Payout ladder. Celebration scales to the NET result — dark-law 2 means a
   *  zero-Facet spin gets silence here, not a fanfare. */
  win(level) {
    if (level <= 0) return;
    const runs = {
      1: ['D5', 'A5'],
      2: ['D5', 'F5', 'A5'],
      3: ['D5', 'F5', 'A5', 'D6'],
      4: ['D5', 'F5', 'A5', 'D6', 'F6', 'A6'],
    };
    const notes = runs[Math.min(4, level)];
    notes.forEach((n, i) => this._bell(hz(n), { gain: 0.13 + level * 0.02, dur: 0.9 + level * 0.25, delay: i * (0.075 - level * 0.006) }));
    if (level >= 3) this._burst({ dur: 0.7, gain: 0.09, hp: 3000, lp: 14000, sweepTo: 6000 });
  }

  /** Coin into the tray. Deliberately dry and metallic. */
  coin(i = 0) {
    const f = hz(['A5', 'C6', 'D6', 'F6'][i % 4]);
    this._bell(f, { gain: 0.13, dur: 0.42 });
    this._burst({ dur: 0.03, gain: 0.12, hp: 4000, lp: 15000 });
  }

  scatter() {
    ['D5', 'G5', 'C6'].forEach((n, i) => this._bell(hz(n), { gain: 0.17, dur: 1.6, delay: i * 0.11 }));
  }

  /** Prism Meter filling: a rising sweep that resolves rather than just stopping. */
  meter() {
    this._tone({ freq: hz('D4'), type: 'sawtooth', dur: 0.85, gain: 0.09, slideTo: hz('D6') });
    this._burst({ dur: 0.85, gain: 0.07, hp: 600, lp: 1200, sweepTo: 12000 });
    ['D5', 'A5', 'D6'].forEach((n, i) => this._bell(hz(n), { gain: 0.16, dur: 1.8, delay: 0.72 + i * 0.06 }));
  }

  holdTrigger() {
    ['D3', 'A3', 'D4', 'F4', 'A4'].forEach((n, i) =>
      this._tone({ freq: hz(n), type: 'sawtooth', dur: 1.1, gain: 0.07, attack: 0.02, delay: i * 0.05 }));
    this._burst({ dur: 1.0, gain: 0.1, hp: 200, lp: 900, sweepTo: 9000 });
  }

  /** A critter joins the dex. The single warmest sound in the game. */
  unlock(tier = 1) {
    const runs = [
      ['D5', 'F5', 'A5'],
      ['D5', 'F5', 'A5', 'C6'],
      ['D5', 'F5', 'A5', 'D6', 'F6'],
      ['D5', 'A5', 'D6', 'F6', 'A6'],
      ['D4', 'A4', 'D5', 'F5', 'A5', 'D6', 'F6', 'A6'],
    ][Math.max(0, Math.min(4, tier - 1))];
    runs.forEach((n, i) => this._bell(hz(n), { gain: 0.15, dur: 2.2, delay: i * 0.07 }));
    this._tone({ freq: hz('D2'), type: 'sine', dur: 1.4, gain: 0.1, attack: 0.05 });
  }

  /** Shake: a dry mechanical rattle. Deliberately unrewarding. */
  shake() {
    for (let i = 0; i < 5; i++) {
      this._burst({ dur: 0.045, gain: 0.12, hp: 900 + i * 400, lp: 6000, delay: i * 0.045 });
    }
    this._tone({ freq: hz('D2'), type: 'triangle', dur: 0.22, gain: 0.08, slideTo: hz('A1') });
  }

  buy() { this._bell(hz('A4'), { gain: 0.11, dur: 0.5 }); this._burst({ dur: 0.04, gain: 0.1, hp: 2500 }); }

  /** The splash wave: a wet, wide sweep with a rising body under it. */
  splash() {
    this._burst({ dur: 0.55, gain: 0.16, hp: 200, lp: 900, sweepTo: 8500 });
    this._tone({ freq: hz('D3'), type: 'triangle', dur: 0.5, gain: 0.1, slideTo: hz('D4') });
    this._tone({ freq: hz('A3'), type: 'sine', dur: 0.45, gain: 0.07, slideTo: hz('A4'), delay: 0.06 });
  }

  /** One droplet landing. Pitch climbs per droplet so a five-reel spray reads as
   *  a run travelling across the machine rather than five identical plops. */
  droplet(i = 0) {
    const f = hz(['A4', 'C5', 'D5', 'F5', 'A5', 'C6'][Math.min(5, i)]);
    this._bell(f, { gain: 0.12, dur: 0.5 });
    this._burst({ dur: 0.05, gain: 0.13, hp: 1400, lp: 9000, sweepTo: 2600 });
  }

  /** Thunder: a low fused strike, deeper the more reels fused. */
  thunder(n = 1) {
    const root = hz('D2');
    this._tone({ freq: root, type: 'sawtooth', dur: 1.1, gain: 0.11, attack: 0.004 });
    this._tone({ freq: root * 1.5, type: 'sawtooth', dur: 0.9, gain: 0.07, delay: 0.03 });
    this._burst({ dur: 0.9, gain: 0.13, hp: 90, lp: 5200, sweepTo: 260 });
    for (let i = 0; i < n; i++) this._bell(hz('D5') * (1 + i * 0.26), { gain: 0.12, dur: 1.2, delay: 0.1 + i * 0.13 });
  }

  /** Wheel: a ratcheting run of clicks that decelerates, then resolves. */
  wheelSpin() {
    let t = 0;
    for (let i = 0; i < 42; i++) {
      this._burst({ dur: 0.03, gain: 0.1, hp: 2600, lp: 12000, delay: t });
      t += 0.035 + Math.pow(i / 42, 2.4) * 0.24;
    }
    this._tone({ freq: hz('D4'), type: 'triangle', dur: t, gain: 0.05, slideTo: hz('D3') });
  }

  // --- drum kit (synthesised, no samples) ----------------------------------
  _kick(t, gain = 0.5) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(132, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + 0.34);
    // click transient so it reads on small speakers
    const c = ctx.createOscillator(); c.type = 'triangle'; c.frequency.value = 900;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(gain * 0.3, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    c.connect(cg); cg.connect(this.musicBus); c.start(t); c.stop(t + 0.03);
  }

  _snare(t, gain = 0.34) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this._noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    n.connect(bp); bp.connect(g); g.connect(this.musicBus);
    n.start(t); n.stop(t + 0.2);
    const b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = 185;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(gain * 0.5, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    b.connect(bg); bg.connect(this.musicBus); b.start(t); b.stop(t + 0.12);
  }

  _hat(t, gain = 0.13, open = false) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this._noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.19 : 0.045));
    n.connect(hp); hp.connect(g); g.connect(this.musicBus);
    n.start(t); n.stop(t + 0.22);
  }

  _bass(t, freq, dur, gain = 0.2) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(240, t + dur * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** Power chord (root + fifth + octave) through the soft-clip bus. */
  _power(t, freq, dur, gain = 0.13) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this._drive);
    for (const [mult, det] of [[1, -6], [1.4983, 5], [2, 0]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = freq * mult; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 0.03);
    }
    if (!this._driveWired) { this._drive.connect(this.musicBus); this._driveWired = true; }
  }

  _lead(t, freq, dur, gain = 0.1, type = 'square') {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3400; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // --- the ambient bed -----------------------------------------------------
  // Three detuned pad voices through a slow filter, plus a sparse bell arpeggio.
  // Deliberately without a loop point: there is no bar you can hear repeat, so it
  // reads as room tone for a hall of glass rather than as a soundtrack.
  _startMusic() {
    if (this.style === 'pop') return this._startSequencer(POP, 'pop');
    if (this.style === 'rock') return this._startSequencer(ROCK, 'rock');
    return this._startAmbient();
  }

  _stopMusic() {
    clearTimeout(this._padTimer); clearTimeout(this._arpTimer); clearInterval(this._seqTimer);
    this._padTimer = this._arpTimer = this._seqTimer = null;
    this._step = 0; this._nextNoteAt = 0;
  }

  /**
   * Lookahead step sequencer. setInterval alone is far too jittery to hold a
   * groove; the timer only *schedules* — every note lands on a sample-accurate
   * AudioContext time computed from the step index.
   */
  _startSequencer(kit, kind) {
    if (this._seqTimer) return;
    const stepDur = 60 / kit.bpm / 4;    // 16th notes
    this._nextNoteAt = this.ctx.currentTime + 0.08;
    this._step = 0;
    this._seqTimer = setInterval(() => {
      if (!this.ready) return;
      const horizon = this.ctx.currentTime + 0.12;
      while (this._nextNoteAt < horizon) {
        const t = this._nextNoteAt;
        const i = this._step % 16;
        const bar = Math.floor(this._step / 16) % PROG.length;
        const root = hz(PROG[bar]);

        if (kit.kick[i]) this._kick(t, kind === 'rock' ? 0.55 : 0.46);
        if (kit.snare[i]) this._snare(t, kind === 'rock' ? 0.4 : 0.3);
        if (kit.hat[i]) this._hat(t, kind === 'rock' ? 0.11 : 0.14, i === 15);

        if (kind === 'pop') {
          if (kit.bass[i]) this._bass(t, root, stepDur * 1.8, 0.22);
          if (kit.lead[i]) {
            const n = SCALE[(this._step * 3 + bar * 2) % SCALE.length];
            this._lead(t, hz(n) * 2, stepDur * 2.2, 0.075, 'square');
          }
          if (i === 0) this._lead(t, root * 4, stepDur * 3, 0.05, 'triangle');
        } else {
          if (kit.chord[i]) this._power(t, root, stepDur * (i === 0 ? 3.2 : 1.6), 0.12);
          if (kit.lead[i]) {
            const n = SCALE[(this._step * 5 + bar) % SCALE.length];
            this._lead(t, hz(n) * 2, stepDur * 1.6, 0.07, 'sawtooth');
          }
          if (i === 0 && bar === 0) this._hat(t, 0.16, true);
        }

        this._nextNoteAt += stepDur;
        this._step++;
      }
    }, 25);
  }

  _startAmbient() {
    if (this._padTimer) return;
    const step = () => {
      if (!this.ready) return;
      const chord = PADS[this._chord % PADS.length];
      this._chord++;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const DUR = 8.5;
      for (const n of chord) {
        for (const det of [-7, 4]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.Q.value = 3;
          f.frequency.setValueAtTime(320, t0);
          f.frequency.linearRampToValueAtTime(900 + Math.abs(det) * 40, t0 + DUR * 0.45);
          f.frequency.linearRampToValueAtTime(280, t0 + DUR);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.055, t0 + 2.6);
          g.gain.linearRampToValueAtTime(0.0001, t0 + DUR);
          o.connect(f); f.connect(g); g.connect(this.musicBus);
          o.start(t0); o.stop(t0 + DUR + 0.1);
        }
      }
      this._padTimer = setTimeout(step, (DUR - 1.6) * 1000);
    };
    step();

    // Sparse arpeggio. Interval is irregular on purpose — an even grid turns the
    // bed into a metronome, which is the opposite of elegant.
    let k = 0;
    const arp = () => {
      if (!this.ready) return;
      if (this.musicOn && !this.muted) {
        const n = SCALE[(k * 5 + ((k * 7) % 3)) % SCALE.length];
        k++;
        const g = this.ctx.createGain();
        g.gain.value = 0.5;
        g.connect(this.musicBus);
        this._bell(hz(n), { gain: 0.035, dur: 3.4 });
      }
      this._arpTimer = setTimeout(arp, 1400 + ((k * 977) % 2600));
    };
    this._arpTimer = setTimeout(arp, 2400);
  }

  stop() {
    this._stopMusic();
    if (this.ctx) this.ctx.suspend();
  }
}

export const audio = new PrismAudio();
