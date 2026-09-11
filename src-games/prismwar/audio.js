/* Prismwar audio — procedural music (3 styles) + SFX, Web Audio only, no asset files. Starts only after a user gesture. */
(function () {
  'use strict';
  let ctx = null, master = null, musicBus = null, sfxBus = null, verb = null, running = false, style = 'ambient', intensity = 0.3, timer = null, nextBeat = 0, beat = 0, seedState = 1;
  const rnd = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.35; sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; musicBus.connect(master); sfxBus.connect(master);
    // small synthetic reverb: exponentially decaying noise impulse
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); } verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.25; verb.connect(vg); vg.connect(master);
    return ctx;
  }
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  function noise(dur, type) { const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate); const d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } const s = ctx.createBufferSource(); s.buffer = b; return s; }
  function env(g, t, a, d, s, r, peak) { peak = peak == null ? 1 : peak; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r); }
  function tone(freq, t, dur, type, out, opts) { opts = opts || {}; const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t + dur); const g = ctx.createGain(); let node = o; if (opts.cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(opts.cutoff, t); if (opts.cutoffEnd) f.frequency.exponentialRampToValueAtTime(opts.cutoffEnd, t + dur); f.Q.value = opts.q || 1; o.connect(f); node = f; } node.connect(g); g.connect(out); if (opts.verb && verb) g.connect(verb); env(g, t, opts.a || 0.01, opts.d || dur * 0.3, opts.s == null ? 0.4 : opts.s, opts.r || dur * 0.5, opts.peak || 0.25); o.start(t); o.stop(t + dur + (opts.r || dur * 0.5) + 0.05); return o; }

  // ---------- SFX ----------
  const SFX = {
    play(t) { tone(523, t, 0.18, 'triangle', sfxBus, { glide: 784, peak: 0.25, verb: true }); tone(1046, t + 0.03, 0.12, 'sine', sfxBus, { peak: 0.08 }); },
    hit(t) { const n = noise(0.25, 'brown'); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.22); const g = ctx.createGain(); n.connect(f); f.connect(g); g.connect(sfxBus); env(g, t, 0.005, 0.08, 0.3, 0.15, 0.9); n.start(t); tone(140, t, 0.2, 'sine', sfxBus, { glide: 45, peak: 0.6 }); },
    attack(t) { const n = noise(0.35); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.3); f.Q.value = 2; const g = ctx.createGain(); n.connect(f); f.connect(g); g.connect(sfxBus); env(g, t, 0.02, 0.15, 0.4, 0.15, 0.5); n.start(t); },
    block(t) { tone(110, t, 0.25, 'square', sfxBus, { cutoff: 600, cutoffEnd: 150, peak: 0.35 }); const n = noise(0.1, 'brown'); const g = ctx.createGain(); n.connect(g); g.connect(sfxBus); env(g, t, 0.003, 0.05, 0.2, 0.05, 0.5); n.start(t); },
    win(t) { [60, 64, 67, 72, 76].forEach((n, i) => tone(NOTE(n), t + i * 0.09, 0.5, 'triangle', sfxBus, { peak: 0.25, verb: true })); tone(NOTE(84), t + 0.5, 1.2, 'sine', sfxBus, { peak: 0.15, verb: true }); },
    lose(t) { [67, 63, 60, 55].forEach((n, i) => tone(NOTE(n), t + i * 0.22, 0.6, 'sawtooth', sfxBus, { cutoff: 900, cutoffEnd: 200, peak: 0.2, verb: true })); },
    pack(t) { for (let i = 0; i < 8; i++) tone(NOTE(72 + [0, 4, 7, 11, 12, 16, 19, 24][i]), t + i * 0.05, 0.25, 'sine', sfxBus, { peak: 0.14, verb: true }); const n = noise(0.4); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000; const g = ctx.createGain(); n.connect(f); f.connect(g); g.connect(sfxBus); env(g, t, 0.05, 0.2, 0.3, 0.2, 0.25); n.start(t); },
    legend(t) { [48, 55, 60, 64, 67, 72].forEach((n, i) => tone(NOTE(n), t + i * 0.04, 2.2, 'sawtooth', sfxBus, { cutoff: 400, cutoffEnd: 3000, peak: 0.12, a: 0.3, s: 0.6, r: 1.2, verb: true })); tone(NOTE(84), t + 0.6, 1.5, 'sine', sfxBus, { peak: 0.12, verb: true }); },
    click(t) { tone(1800, t, 0.03, 'square', sfxBus, { peak: 0.08 }); },
  };
  function sfx(name) { if (!ensure()) return; const f = SFX[name]; if (f) f(ctx.currentTime + 0.005); }

  // ---------- Music: a scheduler feeding style generators one beat at a time ----------
  const SCALES = { minorPent: [0, 3, 5, 7, 10], majorPent: [0, 2, 4, 7, 9], dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10] };
  const STYLES = {
    ambient: { bpm: 56, scale: 'dorian', root: 50, gen(t, b, spb) {
      if (b % 8 === 0) { const chord = [0, 3, 7, 10, 14].map(x => x + STYLES.ambient.root + (b % 32 === 16 ? -2 : 0)); for (const n of chord) for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300 + intensity * 900, t); f.frequency.linearRampToValueAtTime(600 + intensity * 1600, t + spb * 4); f.frequency.linearRampToValueAtTime(300, t + spb * 8); const g = ctx.createGain(); o.connect(f); f.connect(g); g.connect(musicBus); g.connect(verb); env(g, t, spb * 2, spb * 2, 0.7, spb * 3, 0.05); o.start(t); o.stop(t + spb * 8.5); } }
      if (rnd() < 0.35 + intensity * 0.3) { const sc = SCALES.dorian; const n = STYLES.ambient.root + 24 + sc[Math.floor(rnd() * sc.length)] + (rnd() < 0.3 ? 12 : 0); tone(NOTE(n), t + rnd() * spb * 0.5, spb * 1.5, 'sine', musicBus, { peak: 0.12, a: 0.02, d: spb, s: 0.2, r: spb, verb: true }); tone(NOTE(n) * 2.01, t, spb * 0.4, 'sine', musicBus, { peak: 0.03 }); }
    } },
    chiptune: { bpm: 138, scale: 'majorPent', root: 57, gen(t, b, spb) {
      const sc = SCALES.majorPent; const bar = Math.floor(b / 4) % 4; const rootN = STYLES.chiptune.root + [0, -3, 5, 7][bar];
      tone(NOTE(rootN - 12), t, spb * 0.9, 'square', musicBus, { cutoff: 900, peak: 0.12, a: 0.005, d: spb * 0.4, s: 0.3, r: 0.05 }); // bass pulse
      for (let k = 0; k < 4; k++) { const n = rootN + 12 + sc[(b * 4 + k + Math.floor(rnd() * 2)) % sc.length] + (k === 3 && rnd() < 0.5 ? 12 : 0); tone(NOTE(n), t + k * spb / 4, spb / 4 * 0.9, 'square', musicBus, { peak: 0.07, a: 0.003, d: 0.04, s: 0.5, r: 0.03 }); } // 16th arpeggio
      if (b % 2 === 1 || intensity > 0.6) { const n = noise(0.06); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); n.connect(f); f.connect(g); g.connect(musicBus); env(g, t + spb / 2, 0.002, 0.03, 0.1, 0.02, 0.18); n.start(t + spb / 2); } // hat
      if (b % 2 === 0) tone(90, t, 0.12, 'sine', musicBus, { glide: 40, peak: 0.35 }); // kick
    } },
    synthwave: { bpm: 108, scale: 'aeolian', root: 45, gen(t, b, spb) {
      const sc = SCALES.aeolian; const bar = Math.floor(b / 4) % 4; const rootN = STYLES.synthwave.root + [0, 8, 3, 10][bar];
      for (let k = 0; k < 2; k++) tone(NOTE(rootN), t + k * spb / 2, spb / 2 * 0.85, 'sawtooth', musicBus, { cutoff: 250 + intensity * 700, q: 6, peak: 0.16, a: 0.005, d: spb * 0.2, s: 0.5, r: 0.04 }); // driving bass
      if (b % 4 === 0) for (const iv of [0, 3, 7, 12]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(rootN + 12 + iv); o.detune.value = 8; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200 + intensity * 2000; const g = ctx.createGain(); o.connect(f); f.connect(g); g.connect(musicBus); g.connect(verb); env(g, t, spb * 0.4, spb * 2, 0.5, spb * 1.5, 0.05); o.start(t); o.stop(t + spb * 4.2); } // pad
      for (let k = 0; k < 4; k++) if (rnd() < 0.5 + intensity * 0.4) tone(NOTE(rootN + 24 + sc[(k * 2 + b) % sc.length]), t + k * spb / 4, spb / 4 * 0.8, 'square', musicBus, { cutoff: 1500 + intensity * 3000, peak: 0.05, a: 0.003, d: 0.05, s: 0.3, r: 0.05, verb: true }); // arp
      if (b % 2 === 0) tone(110, t, 0.15, 'sine', musicBus, { glide: 38, peak: 0.45 }); else { const n = noise(0.16); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8; const g = ctx.createGain(); n.connect(f); f.connect(g); g.connect(musicBus); g.connect(verb); env(g, t, 0.002, 0.08, 0.2, 0.06, 0.35); n.start(t); } // kick / snare
    } },
  };
  function tick() { if (!running || !ctx) return; const st = STYLES[style] || STYLES.ambient; const spb = 60 / st.bpm; while (nextBeat < ctx.currentTime + 0.25) { st.gen(nextBeat, beat, spb); nextBeat += spb; beat++; } timer = setTimeout(tick, 60); }
  function start(st) { if (!ensure()) return false; style = STYLES[st] ? st : 'ambient'; if (running) return true; running = true; beat = 0; nextBeat = ctx.currentTime + 0.05; seedState = 7 + (style.length * 31); tick(); return true; }
  function stop() { running = false; clearTimeout(timer); }
  function setStyle(st) { if (!STYLES[st]) return; const was = running; stop(); style = st; if (was) start(st); }
  function setIntensity(x) { intensity = Math.max(0, Math.min(1, x)); }
  function duck(ms) { if (!musicBus) return; const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(0.12, t); musicBus.gain.linearRampToValueAtTime(0.35, t + (ms || 600) / 1000); }
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (running) ctx.resume(); });
  window.PrismwarAudio = { sfx, start, stop, setStyle, setIntensity, duck, styles: Object.keys(STYLES), isRunning: () => running };
})();
