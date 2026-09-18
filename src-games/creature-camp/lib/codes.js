// Code redemption. Codes ship INSIDE the package (no network, ever), stored only
// as salted PBKDF2-SHA-256 hashes (120k rounds) so the plaintext is not in the source
// and guessing is slow. Five wrong codes in ten minutes asks for a one-minute rest.
// The salt is public: this slows a determined player, it does not stop one.
//
// The table is unlimited and many-to-one: any number of codes may point at the
// same creature, and each individual code can be redeemed once per save.

import { BY_KEY, isSpecies } from './species.js';
import { owned, pushFeed, newCreature } from './state.js';
import { applyUnlocks } from './engine.js';
import { ARRIVALS } from './chatter.js';

export const SALT = 'creature-camp:v1:';
export const CODE_MAX = 40;
export const PBKDF2_ROUNDS = 120_000;      // ~40-60 ms per try: fine once, ruinous for brute force
export const TRIES_PER_WINDOW = 5;
export const TRY_WINDOW_MS = 10 * 60_000;
export const REST_MS = 60_000;

export function normalizeCode(raw) {
  return String(raw ?? '').toUpperCase().replace(/[\s\-_]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, CODE_MAX);
}

export async function hashCode(raw) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(normalizeCode(raw)), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(SALT), iterations: PBKDF2_ROUNDS, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ms until another code may be tried (0 = now). A clock set back never shortens a rest. */
export function codeRestMs(state, now) {
  const t = state.codeTries;
  if (t.restUntilMs > now + REST_MS) t.restUntilMs = now + REST_MS;
  return Math.max(0, t.restUntilMs - now);
}

function noteFailure(state, now) {
  const t = state.codeTries;
  if (now - t.windowMs > TRY_WINDOW_MS || now < t.windowMs) { t.windowMs = now; t.fails = 0; }
  t.fails += 1;
  if (t.fails >= TRIES_PER_WINDOW) { t.restUntilMs = now + REST_MS; t.fails = 0; t.windowMs = now; }
}

/**
 * @param table  { [pbkdf2hex]: speciesKey }
 * @returns {ok:true,key} | {ok:false, reason:'empty'|'unknown'|'used'|'owned'|'readonly'|'rest', restMs}
 */
export async function redeem(state, raw, table, now) {
  if (state.futureSave) return { ok: false, reason: 'readonly' };
  const rest = codeRestMs(state, now);
  if (rest > 0) return { ok: false, reason: 'rest', restMs: rest };
  const norm = normalizeCode(raw);
  if (norm.length < 4) return { ok: false, reason: 'empty' };
  const h = await hashCode(norm);
  const key = Object.hasOwn(table, h) ? table[h] : null;
  // codes only ever grant code-pack creatures; the base roster is earned in play
  if (!isSpecies(key) || BY_KEY[key].pack === 'base') { noteFailure(state, now); return { ok: false, reason: 'unknown' }; }
  if (state.redeemed.includes(h)) return { ok: false, reason: 'used' };
  if (owned(state, key)) return { ok: false, reason: 'owned', key };
  state.redeemed.push(h);
  state.creatures.push({ ...newCreature(key, now, 0.5, 0.75), code: h });
  if (!state.newKeys.includes(key)) state.newKeys.push(key);
  state.shown = state.shown.filter((k) => k !== key);
  pushFeed(state, { t: now, type: 'unlock', keys: [key], text: ARRIVALS[key] });
  applyUnlocks(state, now);
  return { ok: true, key };
}
