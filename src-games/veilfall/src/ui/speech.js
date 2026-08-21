/**
 * Read aloud — actual audio, using the browser's built-in speech synthesis.
 *
 * WHY NOT A TTS API. Groq does offer text-to-speech
 * (`canopylabs/orpheus-v1-english` at /openai/v1/audio/speech), and it would
 * sound better than this. It is still the wrong tool here: every spoken line
 * would cost a network round-trip against a free tier already measured at
 * ~15 requests a minute, add latency to a panel whose whole appeal is that it
 * is instant, and make audio depend on a key. The Web Speech API is free,
 * offline, needs no key, has no rate limit, and is already installed. If a
 * higher-quality voice is ever wanted, this module is the seam to swap.
 *
 * WHY EACH SOUL SOUNDS DIFFERENT. A single flat voice reading eight characters
 * is worse than no audio at all — you lose track of who is speaking, which is
 * the one thing a deduction game cannot afford. Each seat gets a stable voice,
 * pitch and rate derived from the persona the AI layer already generated, so
 * the paranoid one sounds paranoid every time.
 *
 * HONEST LIMIT: available voices are supplied by the operating system, so what
 * you hear depends on the machine. On a system with no installed voices this
 * degrades to silence and says so, rather than pretending to work.
 */

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : null);

export const isSupported = () => !!synth() && typeof SpeechSynthesisUtterance !== 'undefined';

let cachedVoices = [];

/**
 * Voices load asynchronously in Chrome and `getVoices()` returns [] on the
 * first call. Waiting for `voiceschanged` once is the documented workaround.
 */
export function loadVoices(timeoutMs = 1200) {
  const s = synth();
  if (!s) return Promise.resolve([]);
  const now = s.getVoices();
  if (now.length) { cachedVoices = now; return Promise.resolve(now); }
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cachedVoices = s.getVoices();
      resolve(cachedVoices);
    };
    s.addEventListener?.('voiceschanged', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

export const availableVoices = () => cachedVoices;

/** Stable small hash, so a seat's voice never changes mid-game. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

/**
 * A stable voice profile for one soul.
 * @param {{name:string, seat:number}} seat
 * @param {object} [persona] the AI layer's axes, if this seat has one
 */
export function profileFor(seat, persona) {
  const pool = cachedVoices.length
    ? cachedVoices.filter((v) => /^en(-|$)/i.test(v.lang)) .length
      ? cachedVoices.filter((v) => /^en(-|$)/i.test(v.lang))
      : cachedVoices
    : [];
  const h = hash(`${seat.seat}:${seat.name}`);
  const voice = pool.length ? pool[h % pool.length] : null;

  const p = persona || {};
  // Axes → delivery. Kept in a narrow band: exaggerated pitch reads as comic,
  // and this game is not comic.
  const pitch = 1 + ((p.assertive ?? 0.5) - 0.5) * -0.34 + ((h % 7) - 3) * 0.02;
  const rate = 1 + ((p.talkative ?? 0.5) - 0.5) * 0.22 - ((p.precise ?? 0.5) - 0.5) * 0.1;
  return {
    voice,
    pitch: Math.max(0.6, Math.min(1.5, Number(pitch.toFixed(2)))),
    rate: Math.max(0.7, Math.min(1.35, Number(rate.toFixed(2)))),
  };
}

/** The Archivist's narration voice — deliberately slower and lower than any soul. */
export function narratorProfile() {
  const pool = cachedVoices.filter((v) => /^en(-|$)/i.test(v.lang));
  return { voice: pool[0] || cachedVoices[0] || null, pitch: 0.82, rate: 0.92 };
}

// ── Queue ────────────────────────────────────────────────────────────────────
// Speaking lines on top of each other is unlistenable, and the panel can render
// several at once. One queue, cancellable, and it never blocks the game.

let queue = [];
let speaking = false;

function pump() {
  const s = synth();
  if (!s || speaking) return;
  const next = queue.shift();
  if (!next) return;

  const u = new SpeechSynthesisUtterance(next.text);
  if (next.profile.voice) u.voice = next.profile.voice;
  u.pitch = next.profile.pitch;
  u.rate = next.profile.rate;
  u.onend = () => { speaking = false; pump(); };
  u.onerror = () => { speaking = false; pump(); };
  speaking = true;
  try { s.speak(u); } catch { speaking = false; }
}

/**
 * @param {string} text
 * @param {{voice:any,pitch:number,rate:number}} profile
 * @param {{prefix?:string}} [opts] a spoken name, so you know who is talking
 */
export function say(text, profile, opts = {}) {
  if (!isSupported() || !text) return false;
  const line = opts.prefix ? `${opts.prefix}. ${text}` : text;
  // Cap length: a runaway utterance cannot be interrupted gracefully on all
  // platforms, and nothing in this game legitimately speaks for a minute.
  queue.push({ text: String(line).slice(0, 400), profile });
  if (queue.length > 12) queue = queue.slice(-12);
  pump();
  return true;
}

export function stop() {
  queue = [];
  speaking = false;
  try { synth()?.cancel(); } catch { /* nothing to cancel */ }
}

export const isSpeaking = () => speaking || queue.length > 0;
export const pending = () => queue.length;

/** For diagnostics in Settings — tells the player what their machine actually has. */
export function status() {
  if (!isSupported()) return { ok: false, reason: 'This browser has no speech synthesis.' };
  if (!cachedVoices.length) {
    return { ok: false, reason: 'No speech voices are installed on this system, so there is nothing to read with.' };
  }
  const en = cachedVoices.filter((v) => /^en(-|$)/i.test(v.lang));
  return { ok: true, total: cachedVoices.length, english: en.length, sample: (en[0] || cachedVoices[0])?.name };
}
