/**
 * tts.js  —  Planet Express Lounge v4.01
 *
 * Sentence-Buffered TTS Queue Manager
 *
 * Architecture:
 *  ┌─ token stream ─────────────────────────────────────────────────────────┐
 *  │  push(chunk, agent)                                                     │
 *  │   → appends to per-agent text buffer                                    │
 *  │   → regex splits on sentence boundaries                                 │
 *  │   → complete sentences → sanitize → _enqueue()                         │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *  ┌─ playback engine ───────────────────────────────────────────────────────┐
 *  │  _isSpeaking flag (set SYNCHRONOUSLY before any await)                 │
 *  │  chrome.tts lifecycle events: 'end'|'interrupted'|'error'|'cancelled'  │
 *  │   → sequential drain — no timers, no polling                           │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 * Voice philosophy:
 *   Pitch HARD LIMIT: 0.85–1.15 (safe zone — outside = metallic artifacts)
 *   Rate carries personality: slow = gravitas/age, fast = youth/anxiety
 *   OS voices prioritised over Chrome remote voices (richer timbre)
 *   Chrome voice override toggle available in Settings for users without OS voices
 *
 *   Voice priority (when an ElevenLabs key is configured):
 *     1. ElevenLabs (BYOK premium tier — expressive, high-quality voices,
 *        one voice ID per character category, defaults provided,
 *        user-customizable in Settings)
 *     2. Local OS voices (richer timbre, no network)
 *     3. Chrome built-in/remote voices (always available fallback)
 */

import { speakElevenLabs, stopElevenLabs, hasElevenLabsKey, setElevenLabsKey } from "./elevenlabs.js";
export { setElevenLabsKey };

// ─────────────────────────────────────────────────────────────────────────────
// CAST PROFILES
// ─────────────────────────────────────────────────────────────────────────────
//
// voiceTarget: the sonic CHARACTER category we want.
//   "warm-male"    → mid-range US male (Mark/Alex) — not deep, not bright
//   "deep-male"    → lower register male (David/Fred/Daniel)
//   "uk-male"      → British male (Daniel/Arthur/George) — formal, theatrical
//   "bright-female"→ US female, brighter register (Zira/Samantha/Ava)
//   "warm-female"  → US female, warmer/calmer (Susan/Victoria/Karen)
//   "uk-female"    → British female (Hazel/Kate/Serena)
//
// FRY FIX: was "neutral-male" at pitch 1.05 — sounded too young/thin.
//   Fix: "warm-male" at pitch 1.00, rate reduced slightly. The warmth of
//   Mark/Alex over the thin Google US voice makes Fry sound like a real
//   human rather than a teenager. Brightness stays at unity — the rate
//   and cadence carry the "not-the-sharpest-tool" energy.
//
// MOM FIX: was "high-female" — was resolving to same voice as Linda/Amy,
//   sounding indistinct or grabbing a male fallback voice. Fix: dedicated
//   "warm-female" target with Hazel/Susan preference — warmer, more mature
//   US female that switches instantly to vicious at Mom's rate.
//
// PITCH SAFE RANGE: 0.85–1.15 HARD. No exceptions.
// Outside this band Chrome frequency-shifts the audio buffer rather than
// re-synthesising — produces the metallic crunch.
//
// PER-CHARACTER ELEVENLABS OVERRIDES (optional elevenLabsVoiceId field):
// At OS/Chrome tiers, characters sharing a voiceTarget category share the
// SAME resolved voice — pitch/rate are the only differentiators, and OS
// voice pools are small (Alex/Fred/David/Mark cover most male categories
// regardless of how categories are split). ElevenLabs has effectively
// unlimited distinct voices, so the most crowded categories (deep-male: 6
// characters with pitch span 0.02; bright-female: 2 characters with pitch
// span 0.01) get a few characters a DIFFERENT premade ElevenLabs voice
// here, layered on top of the category default. Resolution order in
// _resolveElevenLabsVoice(): user's category override (Settings) > this
// per-character default > category default. A user who customizes a
// category in Settings still overrides everything in that category,
// including these defaults.

const CAST_PROFILES = {
  // ── Tier 1: Central Leads ────────────────────────────────────────────────
  FRY: {
    pitch:      1.00,   // unity — warmth comes from voice selection, not pitch
    rate:       1.05,   // slightly eager but not hyper
    voiceTarget:"warm-male",
    notes: "Warm US male at unity pitch. Rate is 'just slightly too keen'. Not bright, not deep — the middle, like Fry himself.",
  },
  LEELA: {
    pitch:      0.95,   // slight depth — authority, no-nonsense
    rate:       1.05,
    voiceTarget:"warm-female",
    notes: "Professional US female, slightly deeper than neutral. Crisp and efficient.",
  },
  BENDER: {
    pitch:      0.88,   // lower register — metallic self-satisfaction
    rate:       0.90,   // cynical drawl
    voiceTarget:"deep-male",
    elevenLabsVoiceId: "TxGEqnHWrfWFTfGW9XjX", // "Josh" — distinct from deep-male default (Adam); deep-male is the most crowded category (6 chars)
    notes: "Low-register US male + slow rate = arrogant patience. Bender never rushes.",
  },

  // ── Tier 2: Core Supporting ──────────────────────────────────────────────
  PROF: {
    pitch:      1.05,   // slight brightness for aged squeak
    rate:       0.76,   // very slow — senile, trails off mid-thought
    voiceTarget:"warm-male",
    notes: "Slow rate carries senile pacing. Prefix lines with 'Oh, goodness me' in preprocessor.",
  },
  AMY: {
    pitch:      1.12,   // bright — upper safe range
    rate:       1.28,   // valley girl hyperactive
    voiceTarget:"bright-female",
    notes: "Brightest safe pitch + fast rate = 'like, oh my god'.",
  },
  ZOIDBERG: {
    pitch:      1.08,   // slightly bright for nervous warble
    rate:       1.10,   // faster rate makes speech sound frantic/nasal naturally
    voiceTarget:"warm-male",
    notes: "Faster rate = frantic energy. Skittishness through pace, not chipmunk pitch.",
  },
  HERMES: {
    pitch:      0.96,
    rate:       1.12,   // brisk bureaucratic stamping
    voiceTarget:"uk-male",
    notes: "UK male for rhythmic Caribbean cadence. Rate = stamping forms with satisfaction.",
  },

  // ── Tier 3: Frequent Co-Stars ────────────────────────────────────────────
  ZAPP: {
    pitch:      0.88,   // velvet self-importance at safe floor
    rate:       0.80,
    voiceTarget:"deep-male",
    notes: "Deep + very slow = theatrical self-gift to the universe.",
  },
  KIF: {
    pitch:      1.08,   // reedy/thin without artifacts
    rate:       0.86,   // sighing hesitation
    voiceTarget:"uk-male",
    notes: "UK male slightly bright + slow. Weariness through pace.",
  },
  MOM: {
    pitch:      1.05,   // mature female brightness — not chipmunk
    rate:       1.08,   // quick pivots from sweet to vicious
    voiceTarget:"warm-female",
    notes: "FIXED: was resolving to same voice as Amy/Linda. warm-female (Susan/Hazel/Victoria) gives mature US female timbre that sounds sharp and corporate, not girlish.",
  },

  // ── Tier 4: Guests & Cameos ──────────────────────────────────────────────
  MORBO: {
    pitch:      0.87,   // booming alien anchor at safe floor
    rate:       0.76,
    voiceTarget:"deep-male",
    elevenLabsVoiceId: "2EiwWnXFnvU5JabPnv8n", // "Clyde" — gruff/intense, distinct from deep-male default
    notes: "Safe low floor + very slow = room-filling alien menace.",
  },
  LINDA: {
    pitch:      1.13,   // perky brightness — safe upper range
    rate:       1.15,
    voiceTarget:"bright-female",
    elevenLabsVoiceId: "AZnzlk1XvdvUeBnXmlld", // "Domi" — strong/confident anchor energy, distinct from Amy's category default (Rachel)
    notes: "Bright + fast = unshakeable morning-anchor cheerfulness.",
  },
  LABARBARA: {
    pitch:      0.96,
    rate:       0.97,
    voiceTarget:"warm-female",
    notes: "Near-baseline warm female. Steadiness IS the character.",
  },
  NIXON: {
    pitch:      0.87,   // gravelly safe floor
    rate:       0.93,
    voiceTarget:"deep-male",
    elevenLabsVoiceId: "ODq5zmih8GrVes37Dizd", // "Patrick" — shouty/agitated, distinct from deep-male default
    notes: "Deep + slightly slow = jowly paranoid president.",
  },
  CALCULON: {
    pitch:      0.92,   // theatrical baritone
    rate:       0.72,   // absurdly slow — every syllable is a performance
    voiceTarget:"uk-male",
    notes: "UK male + slowest safe rate = over-acted soap opera pauses.",
  },
  ROBOTSANTA: {
    pitch:      0.87,   // deep mechanical floor
    rate:       0.78,
    voiceTarget:"deep-male",
    elevenLabsVoiceId: "VR6AewLTigWG4xSOukaG", // "Arnold" — crisp deep, distinct from deep-male default
    notes: "Deep + slow = inevitable mechanical doom.",
  },
  HEDONISMBOT: {
    pitch:      0.90,   // smooth pampered baritone
    rate:       0.74,   // decadent crawl
    voiceTarget:"uk-male",
    elevenLabsVoiceId: "JBFqnCBsd6RMkjVDRZzb", // "George" — warm British, posh decadence, distinct from Calculon's uk-male default (Daniel)
    notes: "UK male + slowest rate = languid aristocratic indulgence.",
  },
  LRRR: {
    pitch:      0.86,   // deep alien at safe floor
    rate:       0.80,
    voiceTarget:"deep-male",
    elevenLabsVoiceId: "flq6f7yk4E4fJM5XTYuZ", // "Michael" — orotund/resonant, distinct from deep-male default
    notes: "Deep floor + slow = alien ruler gravitas.",
  },
  NARRATOR: {
    pitch:      0.98,
    rate:       0.93,
    voiceTarget:"uk-male",
    notes: "UK male near-baseline. Warm, formal announcer.",
  },
  USER: {
    pitch:      1.00,
    rate:       1.00,
    voiceTarget:"warm-male",
  },
};

const DEFAULT_PROFILE = { pitch: 1.00, rate: 1.00, voiceTarget: "warm-male" };


// ─────────────────────────────────────────────────────────────────────────────
// OS VOICE FINGERPRINT TABLE
// ─────────────────────────────────────────────────────────────────────────────
//
// Chrome's TTS API exposes OS voices when they exist.
// We prioritise local OS voices (remote:false) over Chrome cloud voices
// for richer timbre and zero streaming latency.
//
// STRATEGY: Match by name substring, not exact string, because OS voice names
// vary across OS versions (e.g. "Microsoft David" vs "Microsoft David - English").
// Each entry: { pattern: RegExp, os: "win"|"mac"|"any", target: voiceTarget[] }
//
// Windows voices (SAPI5 / Microsoft Speech Platform):
//   David   — warm male, reliable deep register on Win 10/11
//   Mark    — neutral male, clear articulation
//   Zira    — bright female, the default Windows female
//   Hazel   — UK female, calm and measured
//   George  — UK male, formal
//   Susan   — warm US female, calmer than Zira
//
// macOS voices (AVSpeechSynthesizer):
//   Alex    — warm male, good for neutral/deep (deprecated in Ventura but present)
//   Fred    — older, distinctly synthetic deep male — good for robots/aliens
//   Samantha— bright US female, the macOS default
//   Victoria— older, calmer US female — good for mature female characters
//   Susan   — warm US female (Siri voice on some versions)
//   Daniel  — UK male, the best cross-platform UK voice
//   Arthur  — UK male, newer macOS UK voice (Monterey+)
//   Kate    — UK female
//   Moira   — Irish female (warm, distinctive)
//   Karen   — Australian female (warm neutral)
//   Ava     — bright US female (newer macOS)
//   Tessa   — South African female (neutral fallback)
//
// ChromeOS / Chrome browser voices:
//   "Google US English"        — neutral US male (remote:false on ChromeOS, remote:true on others)
//   "Google UK English Male"   — UK male
//   "Google UK English Female" — UK female
//   "Google US English Female" — bright US female

// Voice target → ordered preference lists
// Entries are matched by voiceName.includes(pattern) (case-insensitive)
// First match wins. Chrome voices are at the END as fallbacks.
const VOICE_TARGETS = {

  "warm-male": {
    // Warm, clear US male — natural middle register, not deep, not thin
    // Perfect for Fry (earnest warmth), Prof (aged friendliness), Zoidberg (hapless)
    local: [
      { match: /\bAlex\b/i,              os: "mac" },   // macOS: warm classic male
      { match: /Microsoft Mark/i,        os: "win" },   // Windows: clear neutral male
      { match: /\bFred\b/i,              os: "mac" },   // macOS fallback: aged quality
      { match: /Microsoft David/i,       os: "win" },   // Windows fallback: trustworthy
      { match: /\bTom\b/i,               os: "mac" },   // macOS Tom: cleaner alt
      { match: /Google US English(?!.*Female)/i, os: "any" },
    ],
    lang: "en-US",
    elevenLabsVoiceId: "ErXwobaYiN019PkySvjV", // "Antoni" — warm, well-rounded US male (user-customizable in Settings)
  },

  "deep-male": {
    // Lower-register male — used for Bender, Morbo, Zapp, Nixon, Lrrr, Robot Santa
    // We want Fred (Mac) and David (Win) — both have natural lower resonance
    local: [
      { match: /\bFred\b/i,              os: "mac" },   // macOS Fred: distinctly deep, slightly robotic — perfect for Bender/robots
      { match: /Microsoft David/i,       os: "win" },   // Windows David: warm deep male
      { match: /\bAlex\b/i,              os: "mac" },   // macOS Alex: good depth at rate 0.80
      { match: /Microsoft Mark/i,        os: "win" },   // Windows Mark: slight lower alt
      { match: /Google UK English Male/i, os: "any" },  // Chrome UK male: deeper than US
      { match: /Google US English(?!.*Female)/i, os: "any" },
    ],
    lang: "en-US",
    elevenLabsVoiceId: "pNInz6obpgDQGcFmaJgB", // "Adam" — deep US male (user-customizable in Settings)
  },

  "uk-male": {
    // British male — theatrical, formal, rhythmic
    // Used for Hermes, Kif, Zapp, Calculon, Hedonismbot, Narrator
    local: [
      { match: /\bDaniel\b/i,            os: "mac" },   // macOS Daniel: best cross-platform UK male
      { match: /\bArthur\b/i,            os: "mac" },   // macOS Arthur: newer, very clear RP
      { match: /Microsoft George/i,      os: "win" },   // Windows George: formal UK male
      { match: /\bOliver\b/i,            os: "mac" },   // macOS Oliver: UK male alt
      { match: /Google UK English Male/i, os: "any" },  // Chrome UK male fallback
      { match: /\bAlex\b/i,              os: "mac" },   // US male last resort
      { match: /Microsoft Mark/i,        os: "win" },
    ],
    lang: "en-GB",
    elevenLabsVoiceId: "onwK4e9ZLuTAKqWW03F9", // "Daniel" — authoritative British male (user-customizable in Settings)
  },

  "bright-female": {
    // Bright, higher-register US female — Amy, Linda
    // We want voices with natural brightness, not synthesised pitch increase
    local: [
      { match: /\bAva\b/i,               os: "mac" },   // macOS Ava: naturally bright, clear
      { match: /\bSamantha\b/i,          os: "mac" },   // macOS Samantha: bright US female classic
      { match: /Microsoft Zira/i,        os: "win" },   // Windows Zira: bright default female
      { match: /\bAlison\b/i,            os: "mac" },   // macOS Allison: cheerful quality
      { match: /Google US English Female/i, os: "any" },
    ],
    lang: "en-US",
    elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM", // "Rachel" — clear, bright US female (user-customizable in Settings)
  },
  "warm-female": {
    // Mature, warmer US female — Leela, Mom, LaBarbara
    // KEY FIX FOR MOM: Must NOT resolve to Zira/Samantha (too bright/girlish)
    // Victoria (Mac) and Susan/Hazel (Win) have the adult authority Mom needs
    local: [
      { match: /\bVictoria\b/i,          os: "mac" },   // macOS Victoria: calm, mature, measured — perfect for Mom's cold authority
      { match: /\bSusan\b/i,             os: "mac" },   // macOS Susan: warm adult female
      { match: /\bKaren\b/i,             os: "mac" },   // macOS Karen: warm Australian neutral
      { match: /Microsoft Hazel/i,       os: "win" },   // Windows Hazel: UK female, calm and measured
      { match: /Microsoft Zira/i,        os: "win" },   // Windows Zira: fallback (less ideal for Mom)
      { match: /\bSamantha\b/i,          os: "mac" },   // macOS Samantha: last resort
      { match: /Google US English Female/i, os: "any" },
    ],
    lang: "en-US",
    elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL", // "Sarah" — warm, soft US female (user-customizable in Settings)
  },

  "uk-female": {
    // British female — not currently used by main cast but available
    local: [
      { match: /\bSerena\b/i,            os: "mac" },   // macOS Serena: calm UK female
      { match: /\bKate\b/i,              os: "mac" },   // macOS Kate: UK female
      { match: /Microsoft Hazel/i,       os: "win" },   // Windows Hazel: UK female
      { match: /Google UK English Female/i, os: "any" },
      { match: /\bSamantha\b/i,          os: "mac" },
    ],
    lang: "en-GB",
    elevenLabsVoiceId: "XB0fDUnXU5powFXDhCwa", // "Charlotte" — British/European female (user-customizable in Settings)
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// VOICE CACHE & OS FINGERPRINTING
// ─────────────────────────────────────────────────────────────────────────────

let _voiceCache       = null;   // { local: Voice[], remote: Voice[], byName: Map, os: "mac"|"win"|"other" }
let _voiceCacheWaiters= [];
let _chromeOverride   = false;  // when true: skip OS voices, use Chrome voices only

/**
 * Detect OS from available voice names.
 * Called once when voices load.
 */
function _detectOS(voices) {
  const names = voices.map(v => v.voiceName || "").join(" ");
  if (/microsoft/i.test(names))          return "win";
  if (/\b(Alex|Samantha|Daniel)\b/i.test(names)) return "mac";
  return "other";
}

/**
 * Populate the voice cache. Separates local vs remote voices.
 * Prioritises local OS voices per the strategy brief.
 */
function _populateVoiceCache() {
  chrome.tts.getVoices(voices => {
    if (!voices || voices.length === 0) return;

    const byName = new Map();
    const local  = [];
    const remote = [];

    for (const v of voices) {
      if (v.voiceName) byName.set(v.voiceName.toLowerCase(), v);
      // chrome.tts uses `remote` boolean (true = cloud voice)
      if (v.remote === true) {
        remote.push(v);
      } else {
        local.push(v);
      }
    }

    _voiceCache = {
      byName,
      local,
      remote,
      os: _detectOS(voices),
    };

    const waiters = _voiceCacheWaiters.splice(0);
    for (const r of waiters) r(_voiceCache);
  });
}

function _getVoiceCache() {
  if (_voiceCache) return Promise.resolve(_voiceCache);
  return new Promise(resolve => {
    _voiceCacheWaiters.push(resolve);
    chrome.tts.getVoices(voices => {
      if (voices && voices.length > 0) _populateVoiceCache();
    });
  });
}

// Pre-load on startup and again after 1.5s (slow systems / ChromeOS)
setTimeout(_populateVoiceCache, 200);
setTimeout(_populateVoiceCache, 1500);

/**
 * Set Chrome-override mode.
 * When true, OS voices are skipped and Chrome built-in voices used directly.
 * Persisted in chrome.storage.local by the settings toggle.
 */
export function setChromeVoiceOverride(enabled) {
  _chromeOverride = !!enabled;
}

/**
 * Snapshot of the built-in default voice IDs, captured at module load
 * before any user overrides are applied. Used by _resolveElevenLabsVoice()
 * as the final fallback tier, and by setElevenLabsVoiceIds() so clearing
 * a field in Settings restores the shipped default category voice.
 */
const _DEFAULT_ELEVENLABS_VOICE_IDS = Object.fromEntries(
  Object.entries(VOICE_TARGETS).map(([category, spec]) => [category, spec.elevenLabsVoiceId])
);

/**
 * Set the user's per-category ElevenLabs voice ID overrides.
 * `map` keys must match VOICE_TARGETS category names:
 *   "warm-male" | "deep-male" | "uk-male" |
 *   "bright-female" | "warm-female" | "uk-female"
 * Stored separately from the shipped defaults (spec.elevenLabsVoiceId) so
 * _resolveElevenLabsVoice() can apply the correct 3-tier priority. An
 * empty string for a category means "not customized" — that category's
 * characters use their per-character default (if any) or the shipped
 * category default.
 */
export function setElevenLabsVoiceIds(map = {}) {
  for (const [category, spec] of Object.entries(VOICE_TARGETS)) {
    spec.userElevenLabsVoiceId = (map[category] || "").trim();
  }
}

/**
 * Resolve { voiceId } for a character's ElevenLabs voice.
 *
 * Priority order:
 *   1. User's category override from Settings (always wins — explicit
 *      user choice applies to every character in that category, even
 *      ones with a per-character default below)
 *   2. Per-character shipped default (CAST_PROFILES[agent].elevenLabsVoiceId)
 *      — gives the most-crowded categories (deep-male: 6 characters;
 *      bright-female: 2 characters with near-identical pitch) distinct
 *      voices out of the box
 *   3. Category shipped default
 *
 * Returns null only if none of the above resolve (shouldn't happen — all
 * 6 categories ship with a default).
 */
function _resolveElevenLabsVoice(agent) {
  const profile = CAST_PROFILES[agent] || DEFAULT_PROFILE;
  const target  = profile.voiceTarget || "warm-male";
  const spec    = VOICE_TARGETS[target];
  if (!spec) return null;

  const voiceId = spec.userElevenLabsVoiceId
                || profile.elevenLabsVoiceId
                || _DEFAULT_ELEVENLABS_VOICE_IDS[target];

  return voiceId ? { voiceId } : null;
}

/**
 * Resolve the best voiceName for a character (OS/Chrome path).
 *
 * Priority order:
 *   1. Local OS voices matching the character's voiceTarget (unless _chromeOverride)
 *   2. Chrome remote voices matching the voiceTarget
 *   3. Language-code fallback from the voiceTarget
 *   4. undefined (Chrome picks its default)
 *
 * Note: this is the OS/Chrome fallback tier. When an ElevenLabs key is
 * configured, _drain() tries ElevenLabs first via _resolveElevenLabsVoice()
 * (which always returns a voice — defaults or user-set) and only falls
 * back to this function on error or when no key is set.
 */
async function _resolveVoice(agent) {
  const profile = CAST_PROFILES[agent] || DEFAULT_PROFILE;
  const target  = profile.voiceTarget || "warm-male";
  const spec    = VOICE_TARGETS[target];
  if (!spec) return undefined;

  const cache = await _getVoiceCache();

  if (!_chromeOverride) {
    // ── Pass 1: local OS voices ───────────────────────────────────────────
    for (const pref of spec.local) {
      // Skip entries that don't match the current OS (if OS-specific)
      if (pref.os !== "any" && pref.os !== cache.os) continue;
      // Find first local voice whose name matches the pattern
      const match = cache.local.find(v => pref.match.test(v.voiceName || ""));
      if (match) return match.voiceName;
    }

    // ── Pass 2: local OS voices, OS-agnostic pass (catches cross-platform)
    for (const pref of spec.local) {
      const match = cache.local.find(v => pref.match.test(v.voiceName || ""));
      if (match) return match.voiceName;
    }
  }

  // ── Pass 3: Chrome/remote voices matching patterns ────────────────────
  const allVoices = _chromeOverride ? [...cache.local, ...cache.remote] : cache.remote;
  for (const pref of spec.local) {
    const match = allVoices.find(v => pref.match.test(v.voiceName || ""));
    if (match) return match.voiceName;
  }

  // ── Pass 4: language code fallback ────────────────────────────────────
  if (spec.lang) {
    const langLower = spec.lang.toLowerCase();
    // Prefer local lang voice
    const localLang = cache.local.find(v =>
      (v.lang || "").toLowerCase().replace("_", "-").startsWith(langLower.substring(0, 5))
    );
    if (localLang) return localLang.voiceName;
    // Then remote
    const remoteLang = cache.remote.find(v =>
      (v.lang || "").toLowerCase().replace("_", "-").startsWith(langLower.substring(0, 5))
    );
    if (remoteLang) return remoteLang.voiceName;
  }

  return undefined; // Chrome picks its default
}


// ─────────────────────────────────────────────────────────────────────────────
// SENTENCE BOUNDARY & SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

const SENTENCE_BOUNDARY = /([.?!…]+[\s\n]+)/;

const SANITIZE_RULES = [
  [/<[^>]*>/g,                  ""],
  [/\*{1,3}|_{1,2}|~{2}/g,     ""],
  [/^\s*#{1,6}\s*/gm,           ""],
  [/`{1,3}[^`]*`{1,3}/g,       ""],
  [/\[[^\]]{0,60}\]/g,          ""],
  [/\(([a-zA-Z][^)]{0,50})\)/g, ""],
  [/[ \t]{2,}/g,                " "],
  [/\n+/g,                      " "],
];

function sanitize(raw) {
  let s = raw;
  for (const [p, r] of SANITIZE_RULES) s = s.replace(p, r);
  return s.trim();
}


// ─────────────────────────────────────────────────────────────────────────────
// TTS QUEUE MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export class TTSQueueManager {
  constructor() {
    this._queue        = [];
    this._isSpeaking   = false;
    this._pendingDrain = false;
    this._buffers      = new Map();
    this._rate         = 1.00;
    this._volume       = 1.00;
    this._muted        = new Set();

    this._onTTSEvent = this._onTTSEvent.bind(this);
    _populateVoiceCache();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  push(chunk, agent) {
    if (this._muted.has(agent)) return;
    const current = (this._buffers.get(agent) || "") + chunk;
    const parts   = current.split(SENTENCE_BOUNDARY);
    for (let i = 0; i < parts.length - 1; i += 2) {
      const sentence = (parts[i] + (parts[i + 1] || "")).trim();
      const clean    = sentence ? sanitize(sentence) : "";
      if (clean.length > 1) this._enqueue(clean, agent);
    }
    this._buffers.set(agent, parts[parts.length - 1]);
  }

  flush(agent) {
    if (this._muted.has(agent)) { this._buffers.delete(agent); return; }
    const remaining = (this._buffers.get(agent) || "").trim();
    this._buffers.delete(agent);
    if (remaining.length > 1) {
      const clean = sanitize(remaining);
      if (clean.length > 1) this._enqueue(clean, agent);
    }
  }

  stop() {
    this._queue      = [];
    this._buffers    = new Map();
    this._isSpeaking = false;
    try { chrome.tts.stop(); } catch {}
    stopElevenLabs();
  }

  setRate(rate)    { this._rate   = rate; }
  setVolume(vol)   { this._volume = Math.min(Math.max(vol, 0.0), 1.0); }

  mute(agent)      { this._muted.add(agent); }
  unmute(agent)    { this._muted.delete(agent); }
  setMuted(agents) { this._muted = agents instanceof Set ? agents : new Set(agents); }

  get queueLength() { return this._queue.length; }

  /**
   * Speak a pre-formed string directly (used by demo mode).
   * Bypasses sentence-buffering but runs through voice resolution.
   */
  speak(text, agent) {
    const clean = sanitize(text);
    if (clean.length > 1 && !this._muted.has(agent)) this._enqueue(clean, agent);
  }

  waitForIdle() {
    return new Promise(resolve => {
      const check = () => {
        if (!this._isSpeaking && !this._pendingDrain && this._queue.length === 0) resolve();
        else setTimeout(check, 60);
      };
      check();
    });
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _enqueue(text, agent) {
    this._queue.push({ text, agent });
    if (!this._isSpeaking) {
      this._pendingDrain = true;
      this._drain();
    }
  }

  async _drain() {
    this._pendingDrain = false;
    if (this._isSpeaking || this._queue.length === 0) return;

    const { text, agent } = this._queue.shift();

    if (this._muted.has(agent)) {
      this._isSpeaking = false;
      this._drain();
      return;
    }

    // SET isSpeaking BEFORE await — closes the async race window
    this._isSpeaking = true;

    const profile = CAST_PROFILES[agent] || DEFAULT_PROFILE;

    // ── Tier 1: ElevenLabs (BYOK premium, optional) ───────────────────────
    if (hasElevenLabsKey()) {
      const e = _resolveElevenLabsVoice(agent);
      if (e) {
        try {
          await speakElevenLabs(text, e.voiceId, {
            rate: Math.min(Math.max(profile.rate * this._rate, 0.1), 3.0),
            // No pitch param — ElevenLabs voice character comes from the
            // chosen voice ID itself, not a runtime pitch adjustment.
          });
          this._isSpeaking = false;
          this._drain();
          return;
        } catch (err) {
          // ElevenLabs failed (bad key, invalid voice, quota, network) —
          // fall through to OS/Chrome for this utterance rather than
          // dropping it silently.
          console.warn("ElevenLabs TTS failed, falling back to OS/Chrome voice:", err.message);
        }
      }
    }

    // ── Tier 2/3: OS voices, then Chrome voices ───────────────────────────
    const voiceName = await _resolveVoice(agent);

    const opts = {
      rate:    Math.min(Math.max(profile.rate * this._rate, 0.1), 3.0),
      pitch:   Math.min(Math.max(profile.pitch, 0.85), 1.15), // hard safe clamp
      volume:  this._volume,
      enqueue: false,
      onEvent: this._onTTSEvent,
    };
    if (voiceName) opts.voiceName = voiceName;

    chrome.tts.speak(text, opts);
  }

  _onTTSEvent(event) {
    if (["end", "interrupted", "error", "cancelled"].includes(event.type)) {
      this._isSpeaking = false;
      this._drain();
    }
  }
}

// Singleton
export const tts = new TTSQueueManager();
