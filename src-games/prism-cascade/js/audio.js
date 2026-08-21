/* Prism Cascade — procedural audio. No sample files: everything here is synthesised in
   WebAudio at runtime, so the extension ships no audio bytes and the music can be different
   in every match. Crafted by dhseadev. v2.0.0

   Two halves:
     MUSIC — a generative ambient bed whose key, mode, tempo and instrumentation are seeded
             from the level, and whose layers are chosen by the scene's weather + time of day.
     SFX   — impact sounds derived from the physics that caused them (mass, speed, energy),
             instead of one fixed tone per event.
*/
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PCAudio = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let ctx = null, master = null, musicBus = null, sfxBus = null, verb = null;
  let musicOn = true, sfxOn = true, started = false;

  function ac() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
        // a cheap plate: two delays into a lowpass, fed by a send bus
        verb = ctx.createGain(); verb.gain.value = 0.32;
        const d1 = ctx.createDelay(1), d2 = ctx.createDelay(1);
        d1.delayTime.value = 0.107; d2.delayTime.value = 0.191;
        const fb1 = ctx.createGain(), fb2 = ctx.createGain();
        fb1.gain.value = 0.42; fb2.gain.value = 0.38;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        verb.connect(d1); verb.connect(d2);
        d1.connect(fb1); fb1.connect(d1); d2.connect(fb2); fb2.connect(d2);
        d1.connect(lp); d2.connect(lp); lp.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.0;
        sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
        musicBus.connect(master); sfxBus.connect(master);
        const mSend = ctx.createGain(); mSend.gain.value = 0.5; musicBus.connect(mSend); mSend.connect(verb);
        const sSend = ctx.createGain(); sSend.gain.value = 0.22; sfxBus.connect(sSend); sSend.connect(verb);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // ---------------- small synth helpers ----------------
  function env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function tone(bus, freq, dur, type, peak, slide, t0, detune) {
    const c = ac(); if (!c) return null;
    const o = c.createOscillator(), g = c.createGain();
    const t = t0 || c.currentTime;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    env(g, t, Math.min(0.05, dur * 0.2), dur, peak);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.08);
    return o;
  }
  let noiseBuf = null;
  function noiseBuffer(c) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function noise(bus, dur, peak, lp, hp, sweepTo, t0) {
    const c = ac(); if (!c) return;
    const t = t0 || c.currentTime;
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c);
    n.loop = true;
    n.playbackRate.value = 0.8 + Math.random() * 0.5;
    let chain = n;
    if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; chain.connect(f); chain = f; }
    const f2 = c.createBiquadFilter(); f2.type = 'lowpass';
    f2.frequency.setValueAtTime(lp || 900, t);
    if (sweepTo) f2.frequency.exponentialRampToValueAtTime(Math.max(80, sweepTo), t + dur);
    const g = c.createGain(); env(g, t, 0.006, dur, peak || 0.10);
    chain.connect(f2).connect(g).connect(bus);
    n.start(t); n.stop(t + dur + 0.1);
  }

  // ---------------- MUSIC ----------------
  // Modes as semitone sets. Weather and time of day choose the palette; the level seeds the key.
  const MODES = {
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    ionian:     [0, 2, 4, 5, 7, 9, 11],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    aeolian:    [0, 2, 3, 5, 7, 8, 10],
    pentaMinor: [0, 3, 5, 7, 10],
    pentaMajor: [0, 2, 4, 7, 9],
  };
  // weather -> character. rain is slower and darker; clear day is open and bright.
  const WEATHER_VOICE = {
    clear:  { modes: ['lydian', 'ionian', 'pentaMajor'], bpm: [56, 68], padType: 'triangle', bell: 'sine',     cut: 2100, rainBed: 0,    windBed: 0.05 },
    cloudy: { modes: ['dorian', 'ionian', 'pentaMinor'], bpm: [48, 60], padType: 'sawtooth', bell: 'triangle', cut: 1400, rainBed: 0,    windBed: 0.12 },
    rain:   { modes: ['aeolian', 'dorian', 'pentaMinor'],bpm: [42, 52], padType: 'sawtooth', bell: 'sine',     cut: 1000, rainBed: 0.14, windBed: 0.16 },
  };
  const TOD_SHIFT = { dawn: 2, day: 0, dusk: -3, night: -5 }; // key centre moves with the light

  const music = {
    playing: false, timer: 0, step: 0, bpm: 60, mode: MODES.ionian, root: 220,
    voice: WEATHER_VOICE.clear, nodes: [], seed: 1, nextNote: 0, phrase: 0, intensity: 0,
  };

  function stopMusic(fade) {
    const c = ctx;
    music.playing = false;
    if (music.timer) { clearInterval(music.timer); music.timer = 0; }
    if (!c) { music.nodes = []; return; }
    const t = c.currentTime;
    if (musicBus) {
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.6));
    }
    const dying = music.nodes.slice();
    music.nodes = [];
    setTimeout(() => { for (const n of dying) { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} } }, (fade || 0.6) * 1000 + 120);
  }

  // Start a fresh generative bed. Called on every level load, so the music rotates with matches.
  function startMusic(scene, level) {
    const c = ac(); if (!c) return;
    stopMusic(0.35);
    if (!musicOn) return;
    const rnd = seeded(0x9E3779B1 ^ ((level | 0) * 2654435761));
    const v = WEATHER_VOICE[(scene && scene.weather) || 'clear'] || WEATHER_VOICE.clear;
    music.voice = v;
    music.bpm = v.bpm[0] + rnd() * (v.bpm[1] - v.bpm[0]);
    music.mode = MODES[v.modes[Math.floor(rnd() * v.modes.length)]];
    const shift = TOD_SHIFT[(scene && scene.tod) || 'day'] || 0;
    const rootSemi = Math.floor(rnd() * 12) + shift;
    music.root = 110 * Math.pow(2, rootSemi / 12);
    music.step = 0; music.phrase = 0; music.playing = true;

    const t = c.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(0.0001, t);
    musicBus.gain.linearRampToValueAtTime(0.5, t + 2.2);

    // --- drone pad: three detuned saws through a slowly breathing lowpass ---
    const padGain = c.createGain(); padGain.gain.value = 0.0001;
    padGain.gain.linearRampToValueAtTime(0.10, t + 3);
    const padFilter = c.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = v.cut; padFilter.Q.value = 3;
    const lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.frequency.value = 0.035 + rnd() * 0.05; lfoG.gain.value = v.cut * 0.42;
    lfo.connect(lfoG).connect(padFilter.frequency); lfo.start(t);
    padGain.connect(padFilter).connect(musicBus);
    for (const [mult, det] of [[1, -7], [1, 6], [1.5, 3], [2, -4]]) {
      const o = c.createOscillator();
      o.type = v.padType; o.frequency.value = music.root * mult; o.detune.value = det;
      const g = c.createGain(); g.gain.value = mult === 1 ? 0.5 : 0.22;
      o.connect(g).connect(padGain); o.start(t);
      music.nodes.push(o);
    }
    music.nodes.push(lfo);

    // --- weather beds ---
    if (v.rainBed) {
      const n = c.createBufferSource(); n.buffer = noiseBuffer(c); n.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.6;
      const g = c.createGain(); g.gain.value = 0.0001;
      g.gain.linearRampToValueAtTime(v.rainBed, t + 3.5);
      n.connect(f).connect(g).connect(musicBus); n.start(t);
      music.nodes.push(n);
    }
    if (v.windBed) {
      const n = c.createBufferSource(); n.buffer = noiseBuffer(c); n.loop = true;
      n.playbackRate.value = 0.25;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = c.createGain(); g.gain.value = 0.0001;
      g.gain.linearRampToValueAtTime(v.windBed, t + 4);
      const wl = c.createOscillator(), wg = c.createGain();
      wl.frequency.value = 0.06; wg.gain.value = v.windBed * 0.6;
      wl.connect(wg).connect(g.gain); wl.start(t);
      n.connect(f).connect(g).connect(musicBus); n.start(t);
      music.nodes.push(n, wl);
    }

    // --- melodic voice: sparse, phrase-based, never on the beat twice the same way ---
    const stepMs = (60 / music.bpm) * 1000 / 2;
    music.timer = setInterval(() => {
      if (!music.playing || !musicOn) return;
      const c2 = ctx; if (!c2) return;
      const s = music.step++;
      const r = seeded(music.seed = (music.seed * 1664525 + 1013904223 + s) >>> 0);
      const deg = music.mode[Math.floor(r() * music.mode.length)];
      const oct = r() < 0.22 ? 2 : 1;
      const f = music.root * 2 * oct * Math.pow(2, deg / 12);
      // density follows round intensity: a calm round stays sparse, a busy one fills in
      const density = 0.16 + music.intensity * 0.30;
      if (r() < density) {
        const dur = 1.2 + r() * 2.2;
        tone(musicBus, f, dur, v.bell, 0.045 + r() * 0.03, 1.0, c2.currentTime + r() * 0.08);
      }
      // bass movement every 8 steps
      if (s % 8 === 0) {
        const bdeg = music.mode[Math.floor(r() * 3)];
        tone(musicBus, music.root * Math.pow(2, bdeg / 12) / 2, 3.4, 'sine', 0.09, 1.0);
      }
      // an occasional high shimmer, rarer than it feels
      if (r() < 0.05) tone(musicBus, f * 4, 2.6, 'sine', 0.018, 1.0);
    }, stepMs);
  }

  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 0..1 — how busy the round is. Drives melodic density, so the music follows the play.
  function setIntensity(v) { music.intensity = Math.max(0, Math.min(1, v || 0)); }

  // duck the music under a big moment
  function duck(amount, seconds) {
    const c = ctx; if (!c || !musicBus) return;
    const t = c.currentTime;
    const cur = musicBus.gain.value;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(cur, t);
    musicBus.gain.linearRampToValueAtTime(cur * (1 - amount), t + 0.12);
    musicBus.gain.linearRampToValueAtTime(musicOn ? 0.5 : 0.0001, t + (seconds || 1.4));
  }

  // ---------------- SFX ----------------
  // Every one takes physics, not a preset. A heavy crystal breaking slowly sounds nothing
  // like a small one clipped at speed, and that difference is the point.
  const SFX = {
    // charge: a rising hum while the volley winds up. Returns a handle to release.
    charge() {
      const c = ac(); if (!c || !sfxOn) return null;
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 4;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(90, c.currentTime);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.25);
      o.connect(f).connect(g).connect(sfxBus); o.start();
      return {
        update(p) { // p = 0..1 charge
          const t = ctx.currentTime;
          o.frequency.setTargetAtTime(90 + p * 340, t, 0.05);
          f.frequency.setTargetAtTime(300 + p * 1500, t, 0.05);
          g.gain.setTargetAtTime(0.03 + p * 0.05, t, 0.08);
        },
        stop() {
          const t = ctx.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          o.stop(t + 0.18);
        },
      };
    },
    // release: brightness and pitch both scale with charge
    shoot(power) {
      if (!sfxOn) return;
      const p = Math.max(0, Math.min(1, power || 0));
      tone(sfxBus, 380 + p * 420, 0.10 + p * 0.06, 'triangle', 0.05 + p * 0.05, 0.45);
      noise(sfxBus, 0.06 + p * 0.05, 0.03 + p * 0.04, 1800 + p * 3200, 400, 600);
    },
    // an orb striking a crystal: mass sets the body pitch, speed sets the transient
    hit(mass, speed, hue) {
      if (!sfxOn) return;
      const m = Math.max(0.5, mass || 1);
      const v = Math.max(0, Math.min(1, (speed || 600) / 1400));
      const body = 520 / Math.pow(m, 0.7);
      tone(sfxBus, body, 0.05 + 0.05 * v, 'square', 0.025 + 0.03 * v, 0.85);
      tone(sfxBus, body * 2.76, 0.04, 'sine', 0.012 + 0.02 * v, 0.9);
      noise(sfxBus, 0.035, 0.02 + 0.035 * v, 5200, 1400, 2200);
    },
    // shatter: an inharmonic glass cluster. Bigger crystal = lower, longer, more partials.
    shatter(mass, speed, hue) {
      if (!sfxOn) return;
      const c = ac(); if (!c) return;
      const m = Math.max(0.5, mass || 1);
      const v = Math.max(0.15, Math.min(1, (speed || 700) / 1300));
      const base = (900 / Math.pow(m, 0.62)) * (0.92 + ((hue || 0) % 60) / 300);
      const partials = [1, 2.41, 3.87, 5.13, 6.72].slice(0, 3 + Math.round(m));
      const t0 = c.currentTime;
      partials.forEach((p, i) => {
        tone(sfxBus, base * p, (0.30 + 0.22 * m) / (1 + i * 0.5), 'triangle',
          (0.07 * v) / (1 + i * 0.9), 0.55, t0 + i * 0.006);
      });
      // the debris scatter that follows the break
      noise(sfxBus, 0.20 + 0.18 * m, 0.05 * v, 6000, 900, 1200, t0 + 0.01);
      noise(sfxBus, 0.5 + 0.3 * m, 0.02 * v, 2400, 300, 500, t0 + 0.05);
    },
    // splash: energy sets depth, volume and how many droplet plinks follow
    splash(energy, wasted) {
      if (!sfxOn) return;
      const c = ac(); if (!c) return;
      const e = Math.max(0.05, Math.min(3.2, energy || 1));
      const t0 = c.currentTime;
      if (wasted) { // an orb fizzling into the pool — small, dull, unrewarding
        noise(sfxBus, 0.16, 0.05, 520, 120, 220, t0);
        tone(sfxBus, 190, 0.10, 'sine', 0.03, 0.6, t0);
        return;
      }
      noise(sfxBus, 0.10 + e * 0.05, 0.05 + e * 0.035, 900 + e * 900, 200, 260, t0);
      noise(sfxBus, 0.34 + e * 0.14, 0.03 + e * 0.02, 2600 + e * 800, 700, 400, t0 + 0.03);
      tone(sfxBus, 150 + e * 40, 0.22, 'sine', 0.03 + e * 0.015, 0.55, t0);
      const drops = Math.min(6, Math.round(1 + e * 2));
      for (let i = 0; i < drops; i++) {
        tone(sfxBus, 1100 + Math.random() * 1400, 0.05, 'sine', 0.016, 1.6, t0 + 0.12 + Math.random() * 0.35);
      }
    },
    // banking a bubble: the combo climbs the mode, so a long chain becomes a melody
    bank(combo, golden, value) {
      if (!sfxOn) return;
      const deg = music.mode[Math.min(music.mode.length - 1, (combo | 0) % music.mode.length)];
      const oct = Math.min(3, 1 + Math.floor((combo | 0) / music.mode.length));
      const f = music.root * 2 * oct * Math.pow(2, deg / 12);
      tone(sfxBus, f, golden ? 0.5 : 0.26, golden ? 'triangle' : 'sine', golden ? 0.08 : 0.05, 1.0);
      tone(sfxBus, f * 2, 0.16, 'sine', golden ? 0.03 : 0.018, 1.0);
      if (golden) {
        for (let i = 1; i <= 3; i++) tone(sfxBus, f * (1 + i * 0.5), 0.4, 'sine', 0.02, 1.0, ctx.currentTime + i * 0.05);
      }
    },
    // a bubble lost: size sets the pitch, and it falls
    pop(size, value) {
      if (!sfxOn) return;
      const s = Math.max(4, size || 10);
      tone(sfxBus, 900 / Math.pow(s / 10, 0.8), 0.12, 'sine', 0.05, 0.35);
      noise(sfxBus, 0.07, 0.03, 1800, 500, 400);
    },
    mirror() { if (sfxOn) { tone(sfxBus, 1350, 0.09, 'sine', 0.045, 1.35); tone(sfxBus, 2020, 0.06, 'sine', 0.02, 1.3); } },
    buyOk() { if (sfxOn) { tone(sfxBus, 620, 0.14, 'sine', 0.07, 1.5); tone(sfxBus, 930, 0.24, 'sine', 0.05, 1.25); } },
    deny()  { if (sfxOn) { tone(sfxBus, 180, 0.16, 'square', 0.05, 0.7); } },
    item()  { if (sfxOn) { tone(sfxBus, 300, 0.5, 'triangle', 0.06, 3.2); noise(sfxBus, 0.4, 0.03, 4000, 800, 1600); } },
    tick(urgency) {
      if (!sfxOn) return;
      const u = Math.max(0, Math.min(1, urgency || 0));
      tone(sfxBus, 900 + u * 500, 0.04, 'sine', 0.03 + u * 0.03, 1);
    },
    shark() { // a low swell, curious rather than menacing
      if (!sfxOn) return;
      const c = ac(); if (!c) return;
      tone(sfxBus, 62, 1.6, 'sine', 0.06, 1.25);
      tone(sfxBus, 93, 1.2, 'triangle', 0.025, 1.2, c.currentTime + 0.15);
      noise(sfxBus, 1.4, 0.025, 320, 60, 180);
      duck(0.35, 1.8);
    },
    achievement(tier) {
      if (!sfxOn) return;
      const c = ac(); if (!c) return;
      duck(0.45, 2.2);
      const set = tier === 'mythic' ? [523, 659, 784, 1047, 1319]
        : tier === 'gold' ? [523, 659, 784, 1047]
        : tier === 'silver' ? [587, 740, 880] : [523, 659];
      set.forEach((f, i) => tone(sfxBus, f, 0.45, 'triangle', 0.075, 1.01, c.currentTime + i * 0.09));
      noise(sfxBus, 0.6, 0.03, 5000, 1200, 2000, c.currentTime + set.length * 0.09);
    },
    fanfare(stars) {
      if (!sfxOn) return;
      const c = ac(); if (!c) return;
      duck(0.5, 2.6);
      const n = Math.max(1, stars || 1);
      const notes = [523, 659, 784, 1047, 1319, 1568].slice(0, 2 + n);
      notes.forEach((f, i) => tone(sfxBus, f, 0.42, 'triangle', 0.085, 1.01, c.currentTime + i * 0.1));
      noise(sfxBus, 0.7, 0.035, 4200, 900, 1800, c.currentTime + notes.length * 0.1);
    },
    giveUp() {
      if (!sfxOn) return;
      const c = ac(); if (!c) return;
      [392, 349, 294].forEach((f, i) => tone(sfxBus, f, 0.5, 'sine', 0.05, 0.98, c.currentTime + i * 0.14));
    },
  };

  // Read-only view of the current bed. Exists so a test can prove the music actually rotates
  // per match rather than restarting the same four bars, which is otherwise unobservable.
  function nowPlaying() {
    return {
      playing: music.playing,
      bpm: Math.round(music.bpm * 10) / 10,
      root: Math.round(music.root * 100) / 100,
      mode: music.mode.join(','),
      voice: music.voice === WEATHER_VOICE.rain ? 'rain' : music.voice === WEATHER_VOICE.cloudy ? 'cloudy' : 'clear',
      intensity: Math.round(music.intensity * 100) / 100,
    };
  }

  return {
    nowPlaying,
    unlock() { ac(); started = true; },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    setMusic(on) {
      musicOn = !!on;
      if (!musicOn) stopMusic(0.5);
      else if (ctx && musicBus) musicBus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);
      return musicOn;
    },
    setSfx(on) { sfxOn = !!on; return sfxOn; },
    startMusic, stopMusic, setIntensity, duck,
    sfx: SFX,
  };
});
