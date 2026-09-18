// Tiny synthesised sound kit. No media files, nothing fetched. The AudioContext is
// created lazily on the first user gesture (browsers refuse to start one otherwise).

let ctx = null;
let master = null;
let enabled = true;

function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSound(on) { enabled = !!on; try { if (!on && ctx) ctx.suspend().catch(() => {}); } catch { /* ignore */ } }

// Sound is decoration: a failing AudioContext (autoplay policy, no device) must never
// break a care action or a game round, so every call is wrapped.
function tone(...a) { try { toneRaw(...a); } catch { /* no sound this time */ } }
function toneRaw(freq, dur = 0.14, { type = 'sine', gain = 0.6, slide = 0, delay = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const BIRD_NOTES = [523.25, 587.33, 659.25, 783.99];   // C D E G (pentatonic, no clashes)

export const sfx = {
  pet: () => { tone(660, 0.12, { slide: 1.3 }); tone(880, 0.1, { delay: 0.07, gain: 0.35 }); },
  wash: () => { tone(1200, 0.05, { gain: 0.15, slide: 1.4 }); tone(1500, 0.05, { gain: 0.12, delay: 0.06 }); },
  dry: () => { tone(300, 0.12, { type: 'triangle', gain: 0.18, slide: 0.8 }); },
  feed: () => { tone(220, 0.06, { type: 'triangle' }); tone(260, 0.06, { type: 'triangle', delay: 0.08 }); },
  play: () => { tone(520, 0.08, { type: 'triangle', slide: 1.5 }); tone(780, 0.08, { type: 'triangle', delay: 0.09 }); },
  chime: () => { [0, 1, 2].forEach((i) => tone([659.25, 783.99, 1046.5][i], 0.35, { delay: i * 0.11, gain: 0.45 })); },
  catch: () => tone(1046.5, 0.08, { slide: 1.2, gain: 0.3 }),
  splash: () => tone(180, 0.18, { type: 'triangle', slide: 0.6, gain: 0.4 }),
  skip: () => tone(900, 0.04, { type: 'square', gain: 0.12 }),
  bird: (i) => tone(BIRD_NOTES[i % 4], 0.28, { type: 'sine', gain: 0.5 }),
  thud: () => tone(140, 0.1, { type: 'triangle', gain: 0.5 }),
  soft: () => tone(330, 0.12, { type: 'sine', gain: 0.25 }),
  flip: () => tone(420, 0.06, { type: 'triangle', gain: 0.25 }),
  dew: () => tone(1318.5, 0.16, { slide: 0.8, gain: 0.25 }),
};
