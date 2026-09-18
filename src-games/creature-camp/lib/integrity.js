// Save integrity: sealed saves, and the repair applied when a seal does not match.
//
// A local-only game cannot be made cheat-proof — the key that seals a save ships in
// the package, so a determined player with devtools can recompute it. What this does:
//   * an edited save (storage tweak, forged backup) no longer loads as-is;
//   * the last good sealed copy is restored when one exists;
//   * otherwise the save is REPAIRED: every friend and counter must be backed by the
//     progress that earns it, or it is set aside.
// PURE except for crypto.subtle (HMAC-SHA-256), which exists in Chrome and Node 22.

import { BY_KEY, BASE, STARTER_KEY } from './species.js';
import { UNLOCKS, conditionMet } from './unlocks.js';
import { activeDay } from './days.js';

export const TRANSIENT = ['loadedFrom', 'futureSave', 'seal'];

export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(secret, text) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

function body(obj) {
  const out = {};
  for (const k of Object.keys(obj)) if (!TRANSIENT.includes(k)) out[k] = obj[k];
  return out;
}

/** The object to store: a plain JSON copy of the state plus its seal. */
export async function sealSave(state, secret) {
  const plain = JSON.parse(JSON.stringify(body(state)));
  return { ...plain, seal: await hmac(secret, canonical(plain)) };
}

/** 'ok' | 'bad' | 'unsealed' */
export async function verifySave(raw, secret) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'bad';
  if (typeof raw.seal !== 'string') return 'unsealed';
  const want = await hmac(secret, canonical(JSON.parse(JSON.stringify(body(raw)))));
  return want === raw.seal ? 'ok' : 'bad';
}

/**
 * Repair a loaded state whose seal failed. Returns the list of things set aside.
 * Counters are clamped to what the recorded actions can explain; friends whose
 * arrival condition is not met are set aside (the starter always stays).
 */
export function repairEarned(state) {
  const notes = [];
  const d = state.days;
  if (d.base > 0) { notes.push(`days ${d.count} -> ${d.dates.length}`); d.base = 0; d.count = d.dates.length; }
  const st = state.stats;
  const careMax = st.pets + st.feeds + st.plays + st.washes + st.drys;
  if (st.care > careMax) { notes.push(`care ${st.care} -> ${careMax}`); st.care = careMax; }
  if (st.interactions > state.tickIndex) { notes.push(`meetings ${st.interactions} -> ${state.tickIndex}`); st.interactions = state.tickIndex; }
  if (st.returns8h !== state.returnDates.length) { notes.push('long rests recounted'); st.returns8h = state.returnDates.length; }
  const day = activeDay(state);
  for (const [q, j] of Object.entries(state.journal)) {
    if (j.day > day || (j.step > 0 && j.day < 1)) { notes.push(`journal ${q} reset`); j.step = 0; j.day = 0; }
  }
  // set aside friends that nothing earned, iterating because the final friend depends on the others
  for (let changed = true; changed;) {
    changed = false;
    for (const c of [...state.creatures]) {
      const sp = BY_KEY[c.key];
      if (c.key === STARTER_KEY || sp.pack !== 'base') continue;
      const u = UNLOCKS[c.key];
      const others = state.creatures.filter((x) => x !== c);
      const probe = { ...state, creatures: others };
      if (day < u.minDay || !conditionMet(probe, c.key)) {
        state.creatures = others;
        notes.push(`set aside ${c.key}`);
        changed = true;
      }
    }
  }
  const have = new Set(state.creatures.map((c) => c.key));
  state.newKeys = state.newKeys.filter((k) => have.has(k));
  state.shown = state.shown.filter((k) => have.has(k));
  state.integrity = 'repaired';
  void BASE;
  return notes;
}
