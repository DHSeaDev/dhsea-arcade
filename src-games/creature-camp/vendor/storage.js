// VENDORED from lumenreel-0.9.0 (zip sha256 f510fd18c092cb7b...) path ui/storage.js
// Modifications: (1) storage key names renamed to creaturecamp_* and probe key renamed;
// (2) creature-camp round 2: a TRANSIENT write failure (quota, I/O) keeps the storage mode
//     instead of dropping to memory for the rest of the session; only an invalidated
//     extension context degrades. save() now returns whether the last write landed;
//     public get()/set() for the shadow and meta keys. Shard C finding 5.
// The single impure boundary. Everything else in lib/ is pure, which is what
// lets the whole game be fast-forwarded headlessly.
//
// Runs unchanged on three surfaces: a Chrome MV3 extension (chrome.storage.local),
// a plain web page (localStorage), and a sandboxed iframe where localStorage
// throws (in-memory, degraded but alive — an itch.io build hits exactly this).
//
// Two hard-won rules are encoded here:
//  * SEPARATE busy flags per operation. One module-scoped _busy shared between
//    save and lease made a save-in-flight cause the lease holder to demote
//    itself, reproduced 20/20 headless on a prior build.
//  * lastTickMs is written by engine.tick BEFORE anything else and persisted
//    immediately, so a second open surface cannot re-grant the same window.

const KEY = 'creaturecamp_save_v1';
const PROFILE_KEY = 'creaturecamp_profiles_v1';
const LEASE_KEY = 'creaturecamp_lease_v1';
const LEASE_TTL_MS = 6000;
const LEASE_RENEW_MS = 2000;

function detect() {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) return 'chrome';
  try {
    const k = '__cc_probe__';
    globalThis.localStorage.setItem(k, '1');
    globalThis.localStorage.removeItem(k);
    return 'local';
  } catch { return 'memory'; }
}

export class Storage {
  constructor() {
    this.mode = detect();
    this._mem = new Map();
    this._saveBusy = false;
    this._leaseBusy = false;
    this._pending = null;
    this._healthy = true;
    this._error = null;
    this._fatal = false;
    this.id = 'srf-' + Math.floor(Math.random() * 1e9).toString(36);
    this.hasLease = false;
    this._leaseTimer = null;
  }

  health() { return { ok: this._healthy, fatal: !!this._fatal, mode: this.mode, error: this._error }; }

  async _get(key) {
    try {
      if (this.mode === 'chrome') {
        const o = await chrome.storage.local.get(key);
        return o?.[key] ?? null;
      }
      if (this.mode === 'local') {
        const raw = globalThis.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
      return this._mem.get(key) ?? null;
    } catch (e) { this._fail(e); return null; }
  }

  async _set(key, value) {
    try {
      if (this.mode === 'chrome') { await chrome.storage.local.set({ [key]: value }); return true; }
      if (this.mode === 'local') { globalThis.localStorage.setItem(key, JSON.stringify(value)); return true; }
      this._mem.set(key, value); return true;
    } catch (e) { this._fail(e); return false; }
  }

  _fail(e) {
    // An extension reload invalidates chrome.* for every open page. Every call
    // rejects, and without this the player keeps building an unsaved game with
    // no warning. Degrade to memory and surface it instead of throwing.
    // Any other failure (quota, a busy disk) is transient: keep the mode, report it,
    // and let the next successful write clear the warning.
    this._healthy = false;
    this._error = String(e?.message || e);
    this._fatal = /context invalidated|Extension context/i.test(this._error) || typeof chrome !== 'undefined' && this.mode === 'chrome' && !chrome?.runtime?.id;
    if (this._fatal && this.mode !== 'memory') this.mode = 'memory';
  }

  _ok() { if (!this._fatal) { this._healthy = true; this._error = null; } }

  load() { return this._get(KEY); }
  get(key) { return this._get(key); }
  async set(key, value) { const ok = await this._set(key, value); if (ok) this._ok(); return ok; }

  // --- PROFILES ------------------------------------------------------------
  //
  // Named save slots. The ACTIVE profile still lives at KEY, exactly as before, so
  // an existing save keeps working untouched and nothing in the engine or the UI
  // has to know profiles exist. A slot is a parked copy of that same shape.
  //
  // Switching is deliberately explicit: park the live save into its slot, then load
  // the target. There is no background sync — a profile the player is not in must
  // never be written to, or "switch away and come back" silently loses progress.

  async profiles() {
    const raw = await this._get(PROFILE_KEY);
    const p = raw && typeof raw === 'object' ? raw : {};
    return {
      active: typeof p.active === 'string' ? p.active : 'main',
      slots: p.slots && typeof p.slots === 'object' ? p.slots : {},
    };
  }

  async _writeProfiles(p) { await this._set(PROFILE_KEY, p); }

  /** Park `state` into the named slot without making it active. */
  async parkProfile(name, state, meta) {
    const p = await this.profiles();
    p.slots[name] = { state, meta: { ...meta, savedAt: Date.now() } };
    await this._writeProfiles(p);
    return p;
  }

  /**
   * Switch profiles: park the live save into the outgoing slot, then promote the
   * target's parked copy to the live save. Returns the state to load, or null for a
   * brand-new profile (the caller starts a fresh game).
   */
  async switchProfile(toName, liveState, meta) {
    const p = await this.profiles();
    if (liveState) p.slots[p.active] = { state: liveState, meta: { ...meta, savedAt: Date.now() } };
    const target = p.slots[toName] || null;
    p.active = toName;
    await this._writeProfiles(p);
    if (target?.state) { await this._set(KEY, target.state); return target.state; }
    // New profile: clear the live save so the caller boots a fresh game into it.
    await this._set(KEY, null);
    return null;
  }

  async deleteProfile(name) {
    const p = await this.profiles();
    if (name === p.active) return false;      // never delete the one you are in
    delete p.slots[name];
    await this._writeProfiles(p);
    return true;
  }

  /**
   * IMPORT a profile from a file another player exported. Stored as a parked slot,
   * never auto-activated — importing must not overwrite the game you are in.
   */
  async importProfile(name, state, meta) {
    const p = await this.profiles();
    let n = name, i = 2;
    while (p.slots[n]) n = `${name} (${i++})`;   // never silently overwrite a slot
    p.slots[n] = { state, meta: { ...meta, importedAt: Date.now() } };
    await this._writeProfiles(p);
    return n;
  }

  /**
   * Debounced save with a re-entrancy guard. A save requested while one is in
   * flight is coalesced into a single trailing write rather than dropped — the
   * second call carries newer data, so a bare busy flag would lose it.
   */
  async save(state) {
    this._pending = state;
    if (this._saveBusy) return false;
    this._saveBusy = true;
    try {
      let ok = true;
      while (this._pending) {
        const s = this._pending;
        this._pending = null;
        ok = await this._set(KEY, s);
      }
      if (ok) this._ok();
      return ok;
    } finally {
      this._saveBusy = false;
    }
  }

  // --- writer lease --------------------------------------------------------
  // Exactly one surface may advance time and spend currency. Others render.
  async acquireLease(now, { force = false } = {}) {
    if (this._leaseBusy) return null;          // null = HOLD PREVIOUS, never demote
    this._leaseBusy = true;
    try {
      const cur = await this._get(LEASE_KEY);
      const stale = !cur || !Number.isFinite(cur.t) || now - cur.t > LEASE_TTL_MS;
      if (force || stale || cur.id === this.id) {
        await this._set(LEASE_KEY, { id: this.id, t: now });
        this.hasLease = true;
        return true;
      }
      this.hasLease = false;
      return false;
    } finally {
      this._leaseBusy = false;
    }
  }

  async releaseLease() {
    if (!this.hasLease) return;
    this.hasLease = false;
    const cur = await this._get(LEASE_KEY);
    if (cur?.id === this.id) await this._set(LEASE_KEY, { id: null, t: 0 });
  }

  startLeaseLoop(nowFn) {
    if (this._leaseTimer) return;
    this._leaseTimer = setInterval(() => { this.acquireLease(nowFn()); }, LEASE_RENEW_MS);
  }

  stopLeaseLoop() { clearInterval(this._leaseTimer); this._leaseTimer = null; }
}

