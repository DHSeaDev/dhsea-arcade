/**
 * Persistence.
 *
 * Two hazards this module exists to handle, both named in the plan:
 *
 * 1. READ-MODIFY-WRITE RACES. Rapid state updates arriving from several places
 *    at once will interleave against chrome.storage. Every write goes through
 *    ONE serialized queue. A busy flag would be wrong here — a second save
 *    carries different data, so it must be queued, not dropped. The queue
 *    collapses only consecutive saves of the SAME key, keeping the last.
 *
 * 2. UNVERIFIED PANEL LIFETIME. Official docs describe side-panel visibility,
 *    not document lifetime, so we do not know whether the JS context survives a
 *    tab switch. The design assumes it does NOT: every phase transition is
 *    persisted, and startup always resumes from storage.
 *
 * Falls back to an in-memory store outside the extension (tests, dev pages).
 */

const KEY_GAME = 'veilfall:game';
const KEY_SETTINGS = 'veilfall:settings';
const KEY_STATS = 'veilfall:stats';
const KEY_NOTES = 'veilfall:notes';

export const SCHEMA_VERSION = 1;

const hasChrome = typeof chrome !== 'undefined' && chrome?.storage?.local;

const memory = new Map();

const raw = {
  async get(keys) {
    if (hasChrome) return chrome.storage.local.get(keys);
    const out = {};
    for (const k of [].concat(keys)) if (memory.has(k)) out[k] = memory.get(k);
    return out;
  },
  async set(obj) {
    if (hasChrome) return chrome.storage.local.set(obj);
    for (const [k, v] of Object.entries(obj)) memory.set(k, v);
  },
  async remove(keys) {
    if (hasChrome) return chrome.storage.local.remove(keys);
    for (const k of [].concat(keys)) memory.delete(k);
  },
};

// ── Serialized write queue ───────────────────────────────────────────────────

/** @type {Array<{key:string, value:any, resolve:Function, reject:Function}>} */
let queue = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      // Collapse consecutive writes to the same key — only the last one matters,
      // and the intermediate values are already superseded in memory.
      const job = queue.shift();
      while (queue.length && queue[0].key === job.key) {
        const skipped = queue.shift();
        skipped.resolve({ collapsed: true });
        job.value = skipped.value;
      }
      try {
        await raw.set({ [job.key]: job.value });
        job.resolve({ ok: true });
      } catch (e) {
        job.reject(e);
      }
    }
  } finally {
    draining = false;
  }
}

function enqueue(key, value) {
  return new Promise((resolve, reject) => {
    queue.push({ key, value, resolve, reject });
    drain();
  });
}

/** Await every pending write. Call before anything that must see a settled disk. */
export async function flush() {
  while (queue.length || draining) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

// ── Migrations ───────────────────────────────────────────────────────────────

/**
 * Saves outlive schemas. Each migration takes vN to vN+1 and is pure.
 * Never delete a migration; a save from any prior version must still open.
 */
const MIGRATIONS = {
  // 0 -> 1: pre-versioned saves. Stamp them and backfill fields added since.
  0: (s) => ({
    ...s,
    version: 1,
    pendingDeaths: s.pendingDeaths || [],
    seats: (s.seats || []).map((seat) => ({
      finalWordSpent: false,
      statuses: [],
      usedOnce: false,
      perceivedRole: seat.role,
      ...seat,
    })),
  }),
};

export function migrate(snapshot) {
  if (!snapshot) return null;
  let s = snapshot;
  let v = s.version ?? 0;
  const applied = [];
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from schema v${v} — save cannot be opened`);
    s = m(s);
    applied.push(`${v}->${v + 1}`);
    v = s.version ?? v + 1;
  }
  if (applied.length) s.__migrated = applied;
  return s;
}

// ── Public API ───────────────────────────────────────────────────────────────

export const store = {
  async loadGame() {
    const got = await raw.get(KEY_GAME);
    const snap = got[KEY_GAME];
    if (!snap) return null;
    try {
      return migrate(snap);
    } catch (e) {
      console.error('[veilfall] unopenable save, discarding', e);
      await raw.remove(KEY_GAME);
      return null;
    }
  },

  /** Persist the game. Serialized; safe to call on every phase transition. */
  saveGame(snapshot) {
    return enqueue(KEY_GAME, { ...snapshot, version: SCHEMA_VERSION });
  },

  async clearGame() {
    await flush();
    return raw.remove(KEY_GAME);
  },

  async loadSettings() {
    const got = await raw.get(KEY_SETTINGS);
    return {
      tier: 'warded',              // 'warded' (scripted) | 'kindled' (model-written)
      // Audio is a SEPARATE feature from model-written dialogue. Conflating the
      // two under the word "voices" made players expect sound from a text
      // feature — reported directly, and it was a naming defect, not a gap.
      readAloud: 'off',            // off | narration | all
      groqKey: '',
      model: 'openai/gpt-oss-20b', // production as of 2026-08-12; see ai/llm.js
      seatLayout: 'ring',          // ring | list
      seatSize: 1,
      reduceMotion: false,
      narrationSpeed: 'normal',    // instant | fast | normal
      difficulty: { claimQuality: 2, deduction: 2, coordination: 2 },
      // Guidance. Procedural suggestions are ON by default because opacity is
      // the most repeated criticism of every comparable in this genre;
      // strategic nudges are OFF-by-pull, never pushed.
      showSuggestions: true,
      showNudges: true,
      introSeen: false,
      tutorialSeen: [],
      ...(got[KEY_SETTINGS] || {}),
    };
  },
  saveSettings(s) { return enqueue(KEY_SETTINGS, s); },

  async loadStats() {
    const got = await raw.get(KEY_STATS);
    return got[KEY_STATS] || { games: 0, wins: 0, byRole: {}, readAccuracy: [] };
  },
  saveStats(s) { return enqueue(KEY_STATS, s); },

  async loadNotes(gameId) {
    const got = await raw.get(KEY_NOTES);
    const all = got[KEY_NOTES] || {};
    return all[gameId] || {};
  },
  async saveNotes(gameId, notes) {
    const got = await raw.get(KEY_NOTES);
    const all = got[KEY_NOTES] || {};
    all[gameId] = notes;
    // Keep only the most recent handful of games' notes — 10MB is generous but
    // not infinite, and stale notebooks are never read again.
    const keys = Object.keys(all);
    if (keys.length > 8) delete all[keys[0]];
    return enqueue(KEY_NOTES, all);
  },
};

export const __testing = { enqueue, flush, MIGRATIONS, raw, KEY_GAME };
