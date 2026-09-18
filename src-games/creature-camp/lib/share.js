// Share codes: a creature someone made, written down as text a person can retype.
//
// Shape:  CC1-<payload base32>-<check>
// The payload carries ONLY enumerated ids (which silhouette, which colourway, which hat)
// plus a short name the sender typed. There is no free-form geometry, no URL, no script —
// a decoded code can only ever select from lists this build already ships.
//
// The name is the one open field, so it is treated as hostile input on arrival: control
// characters and bidi overrides are stripped, the length is capped in CODE POINTS, and the
// recipient can rename the visitor at any time. Nothing is fetched and nothing is executed.

import { cleanName } from './state.js';
import { BASE } from './species.js';
import { HAT_IDS } from '../art/hats.js';

export const CODE_VERSION = 1;
export const NAME_MAX = 16;
export const TINTS = Object.freeze([
  { id: 0, name: 'As found', hue: 0, sat: 1 },
  { id: 1, name: 'Ember red', hue: -18, sat: 1.25 },
  { id: 2, name: 'Marigold', hue: 24, sat: 1.2 },
  { id: 3, name: 'Meadow', hue: 78, sat: 1.1 },
  { id: 4, name: 'Pine', hue: 122, sat: 0.95 },
  { id: 5, name: 'Creek', hue: 168, sat: 1.05 },
  { id: 6, name: 'Dusk', hue: 210, sat: 1 },
  { id: 7, name: 'Iris', hue: 250, sat: 1.05 },
  { id: 8, name: 'Berry', hue: 292, sat: 1.1 },
  { id: 9, name: 'Rose', hue: 330, sat: 1.05 },
  { id: 10, name: 'Moonlight', hue: 0, sat: 0.25 },
  { id: 11, name: 'Ink', hue: 0, sat: 0.55 },
]);
export const BASES = BASE.map((s) => s.key);          // silhouettes anyone can build from
export const HATS_ALLOWED = ['', ...HAT_IDS];

// Crockford base32 without I, L, O, U: no letter pairs a person can mistype into each other.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VALUE = new Map([...ALPHABET].map((c, i) => [c, i]));

function toBase32(bytes) {
  let bits = 0, acc = 0, out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(acc >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}
function fromBase32(text) {
  let bits = 0, acc = 0;
  const out = [];
  for (const ch of text) {
    const v = VALUE.get(ch);
    if (v === undefined) return null;
    acc = (acc << 5) | v; bits += 5;
    if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; }
  }
  return out;
}
/** Small, stable checksum. It catches typos; it is not a signature and is not claimed to be. */
function check(bytes) {
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return ALPHABET[(h >>> 3) & 31] + ALPHABET[(h >>> 11) & 31];
}

export function normalizeShareCode(raw) {
  return String(raw ?? '').toUpperCase().replace(/[\s]/g, '')
    .replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V')    // common mistypes, Crockford-style
    .slice(0, 120);
}

/** spec -> code. Returns '' when the spec names something this build does not have. */
export function encodeCreature(spec) {
  const base = BASES.indexOf(spec.base);
  const tint = TINTS.findIndex((t) => t.id === spec.tint);
  const hat = HATS_ALLOWED.indexOf(spec.hat || '');
  if (base < 0 || tint < 0 || hat < 0) return '';
  const name = cleanName(spec.name, 'Visitor').slice(0, 64);
  const nameBytes = [...new TextEncoder().encode(name)].slice(0, 48);
  const bytes = [CODE_VERSION, base, tint, hat, nameBytes.length, ...nameBytes];
  return `CC${CODE_VERSION}-${toBase32(bytes)}-${check(bytes)}`;
}

/**
 * code -> spec, or { error }. Every field is validated against this build's own lists;
 * an unknown id is a refusal, never a fallback that silently changes what the sender made.
 */
export function decodeCreature(raw) {
  const text = normalizeShareCode(raw);
  const m = /^CC(\d)-([0-9A-Z]+)-([0-9A-Z]{2})$/.exec(text);
  if (!m) return { error: 'shape' };
  if (Number(m[1]) !== CODE_VERSION) return { error: 'version' };
  const bytes = fromBase32(m[2]);
  if (!bytes || bytes.length < 5) return { error: 'shape' };
  const nameLen = bytes[4];
  const body = bytes.slice(0, 5 + nameLen);
  if (body.length !== 5 + nameLen) return { error: 'shape' };
  if (check(body) !== m[3]) return { error: 'typo' };
  const [v, base, tint, hat] = body;
  if (v !== CODE_VERSION) return { error: 'version' };
  if (base >= BASES.length || tint >= TINTS.length || hat >= HATS_ALLOWED.length) return { error: 'unknown' };
  let name = 'Visitor';
  try { name = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(body.slice(5))); } catch { name = 'Visitor'; }
  return {
    base: BASES[base],
    tint: TINTS[tint].id,
    hat: HATS_ALLOWED[hat],
    name: cleanName(name, 'Visitor'),          // the sender's words, stripped of anything that is not text
    code: text,
  };
}

/** True when a stored guest still matches the code it arrived with (tamper check). */
export function guestMatchesCode(guest) {
  const spec = decodeCreature(guest.code || '');
  return !spec.error && spec.base === guest.base && spec.tint === guest.tint && spec.hat === (guest.hat || '');
}
