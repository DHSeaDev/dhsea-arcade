// Ambient camp sound, synthesised — no files, no licence surface, nothing fetched.
//
// Four layers, mixed per scene and per time of day:
//   wind    filtered noise, slowly breathing
//   water   narrow-band noise, for the creek and the shore
//   insects night crickets / day bird ticks, scheduled sparsely
//   melody  a few pentatonic notes with long decay, minutes apart
//
// Rules this module keeps: it never starts without a user gesture (browsers refuse anyway),
// it stops when the tab is hidden, it is off by default, and every scheduling loop is
// bounded so a forgotten timer cannot pile up. Sound is decoration: nothing waits on it.

let ctx = null;
let master = null;
let layers = null;
let timer = 0;
let running = false;
let settings = { on: false, volume: 0.5, scene: 'camp', night: false };

const NOTES = [523.25, 587.33, 659.25, 783.99, 880];      // C D E G A — no clashes

function noiseBuffer(c, seconds = 3) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;                   // brown-ish: soft, not hissy
    d[i] = last * 3.5;
  }
  return buf;
}

function makeLoop(c, buf, { type, freq, q, gain }) {
  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter); filter.connect(g);
  src.start();
  // `node` is the GainNode (things connect to it); `gain` is its AudioParam (things schedule
  // on it). Keeping both named stops the one from being used as the other.
  return { src, filter, node: g, gain: g.gain };
}

function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const buf = noiseBuffer(ctx);
    layers = {
      wind: makeLoop(ctx, buf, { type: 'lowpass', freq: 420, q: 0.7, gain: 0.5 }),
      water: makeLoop(ctx, buf, { type: 'bandpass', freq: 1100, q: 1.4, gain: 0 }),
    };
    layers.wind.node.connect(master);
    layers.water.node.connect(master);
  } catch { ctx = null; }
  return ctx;
}

function chirp(c, when, night) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = night ? 'triangle' : 'sine';
  const base = night ? 2400 + Math.random() * 600 : 3200 + Math.random() * 900;
  o.frequency.setValueAtTime(base, when);
  o.frequency.exponentialRampToValueAtTime(base * (night ? 1.02 : 1.35), when + 0.06);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(night ? 0.05 : 0.035, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + (night ? 0.12 : 0.09));
  o.connect(g); g.connect(master);
  o.start(when); o.stop(when + 0.2);
}

function note(c, when) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = NOTES[Math.floor(Math.random() * NOTES.length)] / 2;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.06, when + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 2.6);
  o.connect(g); g.connect(master);
  o.start(when); o.stop(when + 2.8);
}

/** One scheduling step: a few chirps, occasionally a note. Bounded work, then reschedule. */
function step() {
  if (!running || !ctx) return;
  const now = ctx.currentTime;
  const night = settings.night;
  const insects = night ? 3 : 1;
  for (let i = 0; i < insects; i++) if (Math.random() < 0.7) chirp(ctx, now + Math.random() * 3.5, night);
  if (Math.random() < 0.18) note(ctx, now + Math.random() * 3);
  // wind breathes
  const w = layers.wind.gain;
  w.cancelScheduledValues(now);
  w.linearRampToValueAtTime(0.25 + Math.random() * 0.45, now + 3.5);
  timer = setTimeout(step, 3500 + Math.random() * 2500);
}

const WATER = { camp: 0.18, creek: 0.5, hollow: 0.05, meadow: 0.02, shore: 0.42 };

function applyMix() {
  if (!ctx) return;
  const vol = Math.max(0, Math.min(1, settings.volume));
  master.gain.setTargetAtTime(settings.on && running ? 0.22 * vol : 0, ctx.currentTime, 0.4);
  layers.water.gain.setTargetAtTime((WATER[settings.scene] ?? 0.1) * (settings.on ? 1 : 0), ctx.currentTime, 0.6);
  layers.wind.filter.frequency.setTargetAtTime(settings.night ? 320 : 480, ctx.currentTime, 0.6);
}

/** Update what the ambience should sound like. Safe to call on every render. */
export function setAmbience(next) {
  const was = { ...settings };
  settings = { ...settings, ...next };
  if (!settings.on) { stopAmbience(); return; }
  if (!running) return;                    // waiting for a gesture; start() will apply the mix
  if (was.scene !== settings.scene || was.night !== settings.night || was.volume !== settings.volume) applyMix();
}

/** Start after a real user gesture. Returns false when audio is unavailable. */
export function startAmbience() {
  if (running || !settings.on) return running;
  const c = ensure();
  if (!c) return false;
  try { if (c.state === 'suspended') c.resume(); } catch { /* ignore */ }
  running = true;
  applyMix();
  clearTimeout(timer);
  step();
  return true;
}

export function stopAmbience() {
  running = false;
  clearTimeout(timer);
  if (ctx) { try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.3); } catch { /* ignore */ } }
}

export const ambienceRunning = () => running;
