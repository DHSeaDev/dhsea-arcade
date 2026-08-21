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

  /* Idempotency guard. A second execution of this file — a duplicated script
   * tag, a hand-written copy beside a build-injected one — would seat a second
   * engine: two message listeners double-charging every spend, two tickers, two
   * boot settles. It happened once, from exactly that cause. Running twice must
   * be a no-op, not a doubling. */
  if (globalThis.__PE_DM__) return;

  const chrome = globalThis.chrome;

  // ── Constants (lifted from background.js) ───────────────────────────────────
  const DM_FOCUS_MIN = 1;
  const DM_FOCUS_MAX = 7;
  const DM_MAX       = 9_999_999;
  const TICK_MS      = 60_000;

  // Web-port additions
  const LAST_TICK_KEY  = "dmLastTick";

  /* CAP: 90 minutes, not the 8 hours an idle game would use.
   * `/idle-economy-balance` §5 puts a generic cap at 6–12h, and 8h was taken
   * from that band without checking it against THIS app's sinks. All the content
   * costs ~400 DM (ten inventions at 25, plus one Mega at 150); an 8h cap paid
   * ~1920 per return, roughly five times everything there is to buy, which makes
   * the Lab's only two decisions free forever. 90 minutes pays ~360 — about one
   * meaningful purchase per return, which is the shape the sinks actually want.
   * Size a cap to the sinks, not to a band borrowed from a different genre. */
  const OFFLINE_CAP_MIN = 90;

  /* FIRST-VISIT SEED. In the extension the alarm ticked all day in the
   * background, so Dark Matter existed before the panel was ever opened. On the
   * web a first load is 0, the cheapest thing in the Lab costs 25, and the tick
   * pays ~4/min — so a brand-new visitor stares at an inert
   * "GENERATE INVENTION (25 ⚛)" for six minutes. The Lab is the second thing
   * anyone clicks. Seeding one invention's worth is not generosity; it is the
   * background accrual the web has no way to have done. */
  const FIRST_VISIT_SEED = 30;

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
  /* Read from the document rather than hardcoded. scripts/build.mjs injects an
   * SEO <title> ("Planet Express Lounge — an AI sitcom engine in your browser")
   * and a hardcoded constant here silently replaced it before first paint,
   * losing it for the tab label, bookmarks and anything reading the live DOM.
   * A second copy of ENTRIES[].name is also free to drift from the table. */
  const BASE_TITLE = (document.title || "Planet Express Lounge").trim();
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
  /* Busy flag set BEFORE the first await and cleared in `finally`. There are
   * three await points between reading dmLastTick and writing it, so two
   * overlapping calls — boot racing a visibilitychange, which is the ordinary
   * case for a tab opened in the background — both read the same `last`, both
   * roll rewards, and the gap is paid twice. The second call is redundant
   * rather than carrying unique data, so a flag is correct here and a queue
   * would be overkill. */
  let _settling = false;
  async function settleOfflineAccrual() {
    if (_settling) return 0;
    _settling = true;
    try {
      return await _settle();
    } finally {
      _settling = false;
    }
  }

  async function _settle() {
    const s    = await chrome.storage.local.get([LAST_TICK_KEY]);
    const now  = Date.now();
    const last = parseInt(s[LAST_TICK_KEY]) || 0;

    if (!last) {
      // First ever load: start the clock and seed, so the Lab is usable at once.
      // Keyed on the tick timestamp rather than on a zero balance — a returning
      // visitor who has legitimately spent down to 0 must NOT be re-seeded.
      await chrome.storage.local.set({ [LAST_TICK_KEY]: now });
      if (await getDarkMatter() === 0) {
        await addDarkMatter(FIRST_VISIT_SEED, "Welcome aboard");
        return FIRST_VISIT_SEED;
      }
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

    /* When the absence EXCEEDS the cap, the remainder is forfeited and the
     * clock jumps to now.
     *
     * An earlier version advanced only by the ticks paid, on the reasoning that
     * carrying the remainder forward was more honest than burning it. That made
     * the "cap" a per-settlement rate limit rather than a cap, and this function
     * re-runs on every visibilitychange — so a 30-day absence could be drained
     * by alt-tabbing ~90 times, thousands of DM in under a minute, trivially
     * clearing the 150 DM Mega-Invention. Found by review, not by a gate.
     *
     * Under the cap the exact arithmetic is kept, so a normal session never
     * loses the sub-minute remainder. */
    const capped = elapsedMin > OFFLINE_CAP_MIN;
    await chrome.storage.local.set({ [LAST_TICK_KEY]: capped ? now : last + ticks * TICK_MS });
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
