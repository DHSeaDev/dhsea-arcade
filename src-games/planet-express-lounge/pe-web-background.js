/**
 * pe-web-background.js — the ported service worker.
 *
 * background.js is a launcher file and is not shipped, but unlike the seven
 * arcade games PEL keeps REAL STATE in its service worker: the whole Dark
 * Matter economy lives there, and lab.js reaches it over the message bus. Drop
 * the file and the currency has no home — the Patent Office, Mega-Invention
 * (150 DM) and scrap recycling all read zero forever.
 *
 * So the engine is lifted verbatim where it can be and re-based where it
 * cannot. Two things could not survive the move:
 *
 *   chrome.alarms  the 60s focus tick. A page is not a service worker: it
 *                  stops existing when the tab closes. setInterval alone would
 *                  mean a closed tab accrues nothing, which is not what the
 *                  alarm did. Accrual is therefore TIMESTAMP-DELTA on load,
 *                  plus a live interval while the tab is open.
 *
 *   chrome.action  the toolbar badge. There is no toolbar. It becomes the
 *                  document title, which is the web's equivalent surface.
 *
 * Classic script. Loads after pe-web-shim.js, before the app modules.
 *
 * DECLARED PATCH — offline accrual. In the extension the tick fired while the
 * user browsed; the reward is named "focus". On the web the app is open far
 * less often, so a pure open-tab tick starves the economy and 150 DM becomes
 * unreachable. Time away therefore accrues, capped at OFFLINE_CAP_MIN. This is
 * a deliberate, declared balance change, not a port artefact — it belongs in
 * PATCHES.md and it is the one number here that wants /idle-economy-balance
 * before ship.
 */
(function () {
  "use strict";

  const chrome = globalThis.chrome;

  // ── Constants (lifted from background.js) ───────────────────────────────────
  const DM_FOCUS_MIN = 1;
  const DM_FOCUS_MAX = 7;
  const DM_MAX       = 9_999_999;
  const TICK_MS      = 60_000;

  // Web-port additions
  const LAST_TICK_KEY  = "dmLastTick";
  const OFFLINE_CAP_MIN = 480;        // 8h of away-time accrues; beyond that, nothing

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // ── State access (lifted) ───────────────────────────────────────────────────
  async function getDarkMatter() {
    const s = await chrome.storage.local.get(["darkMatter"]);
    return Math.min(Math.max(parseInt(s.darkMatter) || 0, 0), DM_MAX);
  }

  async function addDarkMatter(amount, source) {
    const current = await getDarkMatter();
    const next    = Math.min(current + amount, DM_MAX);
    await chrome.storage.local.set({ darkMatter: next });
    broadcast(next, { amount, label: source === "focus-tick" ? "Focus" : source });
    updateTitle(next);
    return next;
  }

  async function spendDarkMatter(amount, label = "") {
    const current = await getDarkMatter();
    if (current < amount) return false;
    const next = current - amount;
    await chrome.storage.local.set({ darkMatter: next });
    broadcast(next, { spent: amount, label });
    updateTitle(next);
    return true;
  }

  // ── Broadcast ───────────────────────────────────────────────────────────────
  // lab.js listens for dm_update to flash the counter and push history rows.
  // In the extension this crossed a process boundary; here it is the same page,
  // so it is dispatched directly onto the shim bus rather than round-tripping.
  function broadcast(value, meta = {}) {
    try {
      globalThis.__PE_SHIM__?.dispatch({ type: "dm_update", darkMatter: value, ...meta });
    } catch { /* a dead listener must never break an award */ }
  }

  // ── Badge → document title ──────────────────────────────────────────────────
  const BASE_TITLE = "Planet Express Lounge";
  let _stateTag = "";

  function compact(value) {
    if (value >= 1_000_000) return `${Math.floor(value / 100_000) / 10}M`;
    if (value >= 1_000)     return `${Math.floor(value / 1000)}K`;
    return String(value);
  }

  function updateTitle(dm) {
    const bits = [];
    if (_stateTag) bits.push(_stateTag);
    if (dm > 0)    bits.push(`⚛ ${compact(dm)}`);
    document.title = bits.length ? `${bits.join(" · ")} — ${BASE_TITLE}` : BASE_TITLE;
  }

  async function setStateTag(tag) {
    _stateTag = tag;
    updateTitle(await getDarkMatter());
  }

  // ── Focus tick: timestamp-delta + live interval ─────────────────────────────
  async function settleOfflineAccrual() {
    const s    = await chrome.storage.local.get([LAST_TICK_KEY]);
    const now  = Date.now();
    const last = parseInt(s[LAST_TICK_KEY]) || 0;

    if (!last) {                                   // first ever load — start the clock
      await chrome.storage.local.set({ [LAST_TICK_KEY]: now });
      updateTitle(await getDarkMatter());
      return 0;
    }

    const elapsedMin = Math.floor((now - last) / TICK_MS);
    if (elapsedMin <= 0) { updateTitle(await getDarkMatter()); return 0; }

    const ticks = Math.min(elapsedMin, OFFLINE_CAP_MIN);
    let total = 0;
    // Rolled per tick, not ticks × average — the reward is chaotic by design
    // and collapsing it to a mean removes the property the design is built on.
    for (let i = 0; i < ticks; i++) total += randInt(DM_FOCUS_MIN, DM_FOCUS_MAX);

    // Advance the clock by the ticks actually PAID, not to `now`. Paying to
    // `now` after a cap silently burns the remainder; advancing by what was
    // paid keeps the ledger honest across a long absence.
    await chrome.storage.local.set({ [LAST_TICK_KEY]: last + ticks * TICK_MS });
    if (total > 0) await addDarkMatter(total, ticks === 1 ? "focus-tick" : "Offline focus");
    return total;
  }

  let _timer = null;
  function startLiveTick() {
    if (_timer) return;
    _timer = setInterval(async () => {
      if (document.hidden) return;               // a background tab is not focus
      await addDarkMatter(randInt(DM_FOCUS_MIN, DM_FOCUS_MAX), "focus-tick");
      await chrome.storage.local.set({ [LAST_TICK_KEY]: Date.now() });
    }, TICK_MS);
  }

  // Returning to a tab left open for hours must settle the gap too — the
  // interval does not fire reliably in a throttled background tab, so the
  // delta is re-settled on every visibility change rather than trusted.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) settleOfflineAccrual();
  });

  // ── Message bus (lifted from background.js's switch) ────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (typeof msg?.type !== "string") return false;

    switch (msg.type) {
      // Crew-state badges → title tag
      case "autopilot_started": setStateTag("AP");  break;
      case "autopilot_stopped": setStateTag("");    break;
      case "crew_responding":   setStateTag("…");   break;
      case "crew_done":         setStateTag("");    break;

      case "dm_get":
        getDarkMatter().then((dm) => sendResponse({ darkMatter: dm }));
        return true;

      case "dm_earn":
        addDarkMatter(msg.amount || 0, msg.label || "Scrap").then(() => sendResponse({ ok: true }));
        return true;

      case "dm_spend":
        spendDarkMatter(msg.amount || 0, msg.label || "").then((ok) => sendResponse({ ok }));
        return true;
    }
    return false;
  });

  // ── Boot ────────────────────────────────────────────────────────────────────
  settleOfflineAccrual().then(startLiveTick);

  // Exposed for the gate suite only.
  globalThis.__PE_DM__ = { getDarkMatter, settleOfflineAccrual, OFFLINE_CAP_MIN, TICK_MS };
})();
