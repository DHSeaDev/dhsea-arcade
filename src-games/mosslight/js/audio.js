/* MOSSLIGHT — synthesised audio. No files, no fetch, no <audio>. Three buses (music / fight / interface), each with its own slider,
   because the most repeated audio complaint about the game this one learns from is one slider for everything and a beep you cannot mute. */
(function (ML) {
  'use strict';
  var Au = ML.Audio = { ctx: null, ready: false, last: {}, vol: { bgm: 0.5, sfx: 0.6, ui: 0.5, mute: false }, intensity: 0, style: 0, lite: false, dropped: 0, voices: 0, lost: 0 };
  var VOICE_CAP = 18, LITE_CAP = 9;   // a wave-10 burst on a slow machine used to queue dozens of oscillators; the cap protects a phone and a tired laptop alike
  function budget() { return Au.lite ? LITE_CAP : VOICE_CAP; }
  function take(b) { if (b === 'bgm') return true; if (Au.voices >= budget()) { Au.dropped++; return false; } Au.voices++; return true; }
  function give(b, t, dur) { if (b === 'bgm') return; setTimeout(function () { Au.voices = Math.max(0, Au.voices - 1); }, Math.max(0, (t - (ctx ? ctx.currentTime : 0) + dur) * 1000) + 60); }
  var ctx, master, bus = {}, send = {}, wet, analyser, timer = null, nextBar = 0, bar = 0;
  function mk() {
    var AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false;
    ctx = Au.ctx = new AC(); master = ctx.createGain(); analyser = Au.analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    // generated impulse response: 2 s of decaying stereo noise — makes an oscillator sound like an instrument in a room
    var len = Math.floor(ctx.sampleRate * 2), ir = ctx.createBuffer(2, len, ctx.sampleRate), rng = ML.mulberry(1877);
    for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    var conv = ctx.createConvolver(); conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.9; wet.connect(conv); conv.connect(master);
    // judge-found: the reverb send used to bypass the bus faders, so a slider at 0 still leaked a third of the level. Each bus now owns its send.
    ['bgm', 'sfx', 'ui'].forEach(function (k) { bus[k] = ctx.createGain(); bus[k].connect(master); send[k] = ctx.createGain(); send[k].connect(wet); });
    if (typeof ctx.addEventListener === 'function') ctx.addEventListener('statechange', function () { if (ctx.state !== 'running' && !document.hidden) Au.revive(); });
    Au.ready = true; Au.apply(); return true;
  }
  Au.apply = function () { if (!Au.ready) return; var v = Au.vol, t = ctx.currentTime; master.gain.setTargetAtTime(v.mute ? 0 : 0.9, t, 0.03); [['bgm', 0.5], ['sfx', 0.8], ['ui', 0.7]].forEach(function (x) { bus[x[0]].gain.setTargetAtTime(v[x[0]] * x[1], t, 0.03); send[x[0]].gain.setTargetAtTime(v[x[0]] * x[1], t, 0.03); }); };
  Au.setVolumes = function (s) { Au.vol = { bgm: s.bgm, sfx: s.sfx, ui: s.ui, mute: !!s.mute }; Au.apply(); };
  // gesture gate: before the first pointerdown/keydown every call is a quiet no-op
  Au.unlock = function () { if (Au.ready) { Au.revive(); return true; } if (!mk()) return false; Au.startMusic(); Au.signature(); return true; };
  // 'interrupted' is a real AudioContext state on iOS and it does not clear itself; 'suspended' can also survive a long sleep.
  // Either way the cure is the same and it is safe everywhere: ask to resume, and count the failures so Settings can say so.
  Au.revive = function () { if (!Au.ready) return false; if (ctx.state === 'running') return true;
    try { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () { Au.lost++; }); } catch (e) { Au.lost++; return false; }
    return true; };
  Au.suspend = function (hidden) { if (!Au.ready) return; if (hidden) { try { ctx.suspend(); } catch (e) { } } else Au.revive(); };
  Au.quality = function (lite) { Au.lite = !!lite; };
  Au.stateInfo = function () { return { ready: Au.ready, state: Au.ready ? ctx.state : 'not started', lite: Au.lite, dropped: Au.dropped, lost: Au.lost }; };
  Au.rms = function () { if (!Au.ready) return 0; var b = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(b); var s = 0; for (var i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); };

  function voice(o) {   // one enveloped oscillator: attack, exponential decay to silence, then stop — never a gain parked at 0.001
    if (!take(o.bus)) return;
    var t = o.t || ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain(), dur = o.dur || 0.2, peak = (o.gain || 0.2) * (0.9 + Math.random() * 0.2);
    give(o.bus, t, dur);
    osc.type = o.type || 'sine'; var f0 = o.f * (o.vary === 0 ? 1 : 0.97 + Math.random() * 0.06); osc.frequency.setValueAtTime(f0, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + (o.att || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var node = osc; if (o.lp) { var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); osc.connect(fl); node = fl; }
    node.connect(g); g.connect(bus[o.bus || 'sfx']); if (o.wet && !Au.lite) { var w = ctx.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(send[o.bus || 'sfx']); }
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  var noiseBuf = null;
  function noise(o) {
    if (!take(o.bus)) return;
    var t = o.t || ctx.currentTime, dur = o.dur || 0.12; give(o.bus, t, dur); if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = noiseBuf.getChannelData(0), r = ML.mulberry(99); for (var i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    var src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = noiseBuf; src.loop = true; fl.type = o.hp ? 'highpass' : 'lowpass'; fl.frequency.setValueAtTime(o.f || 1200, t); if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((o.gain || 0.15) * (0.9 + Math.random() * 0.2), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(bus[o.bus || 'sfx']); if (o.wet && !Au.lite) { var w = ctx.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(send[o.bus || 'sfx']); }
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  var MIN = { strike: 0.11, hit: 0.13, heal: 0.16, pickup: 0.08, flee: 0.1, cast: 0.1 };
  var SFX = {
    click: function () { voice({ f: 880, to: 660, dur: 0.045, type: 'triangle', gain: 0.16, bus: 'ui' }); },
    deny: function () { voice({ f: 220, to: 170, dur: 0.12, type: 'triangle', gain: 0.14, bus: 'ui' }); },
    buy: function () { voice({ f: 660, dur: 0.09, type: 'triangle', gain: 0.15, bus: 'ui' }); voice({ f: 990, dur: 0.14, type: 'sine', gain: 0.12, bus: 'ui', t: ctx.currentTime + 0.06, wet: 0.2 }); },
    heal: function (crit) { voice({ f: 784, dur: 0.22, type: 'sine', gain: 0.1, wet: 0.3 }); voice({ f: 1175, dur: 0.3, type: 'triangle', gain: 0.05, wet: 0.35, t: ctx.currentTime + 0.03 }); if (crit) voice({ f: 1568, dur: 0.4, type: 'sine', gain: 0.07, wet: 0.5, t: ctx.currentTime + 0.07 }); },
    bloom: function () { [523, 659, 784].forEach(function (f, i) { voice({ f: f, dur: 0.5, type: 'sine', gain: 0.07, wet: 0.45, t: ctx.currentTime + i * 0.035, att: 0.03 }); }); noise({ f: 600, to: 3200, dur: 0.35, gain: 0.04, wet: 0.3 }); },
    hot: function () { voice({ f: 988, to: 1318, dur: 0.35, type: 'sine', gain: 0.07, wet: 0.5, att: 0.04 }); },
    shield: function () { voice({ f: 180, to: 120, dur: 0.16, type: 'triangle', gain: 0.2, wet: 0.2 }); noise({ f: 900, to: 300, dur: 0.1, gain: 0.08 }); },
    cleanse: function () { voice({ f: 1760, dur: 0.5, type: 'sine', gain: 0.07, wet: 0.6 }); voice({ f: 2637, dur: 0.4, type: 'sine', gain: 0.04, wet: 0.6, t: ctx.currentTime + 0.05 }); },
    rally: function () { [196, 294, 392].forEach(function (f, i) { voice({ f: f, dur: 0.7, type: 'sawtooth', lp: 900, lpTo: 2200, gain: 0.07, wet: 0.35, t: ctx.currentTime + i * 0.08, att: 0.05 }); }); },
    strike: function () { noise({ f: 1400, to: 300, dur: 0.07, gain: 0.05 }); },
    hit: function () { noise({ f: 1000, to: 200, dur: 0.1, gain: 0.07 }); voice({ f: 95, to: 45, dur: 0.11, type: 'sine', gain: 0.12 }); },
    flee: function () { voice({ f: 520, to: 260, dur: 0.16, type: 'triangle', gain: 0.07 }); },
    captain: function () { voice({ f: 110, dur: 0.6, type: 'sawtooth', lp: 500, gain: 0.12, wet: 0.4, att: 0.04 }); voice({ f: 165, dur: 0.6, type: 'sawtooth', lp: 500, gain: 0.08, wet: 0.4, att: 0.04 }); },
    down: function () { [392, 330, 262].forEach(function (f, i) { voice({ f: f, dur: 0.22, type: 'triangle', gain: 0.1, wet: 0.3, t: ctx.currentTime + i * 0.13 }); }); },
    pickup: function () { voice({ f: 1320, dur: 0.07, type: 'triangle', gain: 0.07 }); voice({ f: 1760, dur: 0.1, type: 'sine', gain: 0.05, t: ctx.currentTime + 0.04 }); },
    gift: function () { [1, 1.25, 1.5, 2, 2.5].forEach(function (k, i) { voice({ f: 660 * k, dur: 0.9, type: 'sine', gain: 0.05, wet: 0.6, t: ctx.currentTime + i * 0.03 }); }); },
    level: function () { [523, 659, 784, 1047].forEach(function (f, i) { voice({ f: f, dur: 0.22, type: 'triangle', gain: 0.1, wet: 0.35, t: ctx.currentTime + i * 0.085 }); }); },
    clear: function () { [392, 494, 587, 784].forEach(function (f, i) { voice({ f: f, dur: 0.2, type: 'triangle', gain: 0.1, wet: 0.35, t: ctx.currentTime + i * 0.09 }); }); voice({ f: 392, dur: 1.2, type: 'sine', gain: 0.06, wet: 0.6, t: ctx.currentTime + 0.36, att: 0.1 }); },
    fail: function () { [330, 277, 220].forEach(function (f, i) { voice({ f: f, dur: 0.3, type: 'triangle', lp: 1200, lpTo: 400, gain: 0.1, wet: 0.35, t: ctx.currentTime + i * 0.16 }); }); },
    stray: function () { voice({ f: 440, to: 660, dur: 0.25, type: 'sine', gain: 0.07, wet: 0.5 }); },
    tended: function () { [659, 880, 1109].forEach(function (f, i) { voice({ f: f, dur: 0.35, type: 'sine', gain: 0.08, wet: 0.5, t: ctx.currentTime + i * 0.07 }); }); },
    claim: function () { [784, 988, 1175].forEach(function (f, i) { voice({ f: f, dur: 0.3, type: 'triangle', gain: 0.09, wet: 0.4, t: ctx.currentTime + i * 0.06, bus: 'ui' }); }); }
  };
  Au.sfx = function (name, arg) { if (!Au.ready || ctx.state !== 'running' || !SFX[name]) return; var now = ctx.currentTime, min = MIN[name] || 0; if (min && now - (Au.last[name] || -9) < min) return; Au.last[name] = now; SFX[name](arg); };
  // the one sonic signature: four lantern-bell notes on the Hollow's own scale (D dorian), < 1.5 s. Start-up, Ledger entries, Sabbatical. Nothing else melodic recurs.
  Au.signature = function () { if (!Au.ready) return; [587.3, 880, 698.5, 1174.7].forEach(function (f, i) { voice({ f: f, vary: 0, dur: 0.9 - i * 0.05, type: 'sine', gain: 0.11, wet: 0.7, t: ctx.currentTime + 0.05 + i * 0.17, bus: 'ui' }); voice({ f: f * 2.01, vary: 0, dur: 0.4, type: 'sine', gain: 0.025, wet: 0.7, t: ctx.currentTime + 0.05 + i * 0.17, bus: 'ui' }); }); };

  /* ---------- music: look-ahead scheduler, styles as data, intensity gates layers (never tempo) ---------- */
  var STYLES = [
    { bpm: 66, root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], bell: 0.5 },    // Hollow: D dorian
    { bpm: 72, root: 110, scale: [0, 2, 3, 5, 7, 8, 10], chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], bell: 0.3 },        // Cinder: A minor
    { bpm: 60, root: 174.61, scale: [0, 2, 4, 6, 7, 9, 11], chords: [[0, 2, 4], [1, 3, 5], [4, 6, 1], [0, 2, 4]], bell: 0.7 }      // Glassmere: F lydian
  ];
  function deg(st, d, oct) { var n = st.scale.length, o = Math.floor(d / n); return st.root * Math.pow(2, (st.scale[((d % n) + n) % n] + 12 * (o + (oct || 0))) / 12); }
  function scheduleBar(t) {
    var st = STYLES[Au.style] || STYLES[0], beat = 60 / st.bpm, ch = st.chords[bar % st.chords.length], I = Au.intensity, rng = ML.mulberry(bar * 7919 + Au.style);
    ch.forEach(function (d) { voice({ f: deg(st, d, 0), vary: 0, dur: beat * 4.2, type: 'triangle', lp: 700, gain: 0.05, wet: 0.5, t: t, att: beat * 0.8, bus: 'bgm' }); });
    for (var b = 0; b < 4; b++) if (rng() < st.bell) voice({ f: deg(st, ch[Math.floor(rng() * 3)] + (rng() < 0.4 ? 2 : 0), 2), vary: 0, dur: beat * 1.6, type: 'sine', gain: 0.035, wet: 0.7, t: t + b * beat + (rng() < 0.3 ? beat / 2 : 0), bus: 'bgm' });
    if (I >= 0.3) for (b = 0; b < 4; b += 2) voice({ f: deg(st, ch[0], -1), vary: 0, dur: beat * 1.8, type: 'sawtooth', lp: 260, gain: 0.07, t: t + b * beat, att: 0.02, bus: 'bgm' });
    if (I >= 0.6) for (b = 0; b < 8; b++) noise({ f: 5000, hp: 1, dur: 0.04, gain: b % 2 ? 0.012 : 0.02, t: t + b * beat / 2, bus: 'bgm' });
    bar++; return beat * 4;
  }
  Au.startMusic = function () { if (!Au.ready || timer) return; nextBar = ctx.currentTime + 0.1; timer = setInterval(function () { if (!Au.ready || ctx.state !== 'running') return; if (Au.vol.bgm <= 0 || Au.vol.mute) { nextBar = ctx.currentTime + 0.1; return; } while (nextBar < ctx.currentTime + 0.25) nextBar += scheduleBar(nextBar); }, 60); };
})(globalThis.ML = globalThis.ML || {});
