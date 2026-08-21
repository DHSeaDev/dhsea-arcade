/**
 * pel-web-enhance.js — web-only progressive enhancement.
 *
 * Everything here fixes something a review found that the extension shipped with
 * and that MATTERS MORE ON THE WEB. It is a separate file for one reason: the
 * whole port rests on not editing sidepanel.js (1,708 lines, ~80 getElementById
 * bindings), and none of this needs to.
 *
 * It runs after DOM ready, is idempotent, and no-ops on anything it does not
 * recognise. If it throws, the app still works — every block is guarded.
 */
(function () {
  "use strict";
  if (globalThis.__PEL_ENHANCED__) return;
  globalThis.__PEL_ENHANCED__ = true;

  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  ready(() => {
    /* ── 1. The tab strip was not keyboard-operable AT ALL ──────────────────
     * The tabs are <div class="tab"> with tabIndex -1, no role and no
     * aria-selected, so tab order ran: ← Arcade → theme → refresh → straight
     * into the panel. The five tabs were never focus stops.
     *
     * In a side panel that is bad. On the web it is a dead end: SETTINGS is the
     * ONLY place to enter an API key, so a keyboard-only or screen-reader user
     * could never make the app work at all. That is why this is fixed here
     * rather than filed.
     *
     * Implemented as the standard roving-tabindex tablist: exactly one tab is
     * focusable at a time, arrows move between them, Home/End jump. Activation
     * is delegated to .click() so whatever sidepanel.js already binds stays the
     * single source of truth — this adds a route to the existing behaviour, it
     * does not reimplement it.
     */
    try {
      const strip = document.querySelector(".tabs");
      const tabs = strip ? [...strip.querySelectorAll(".tab")] : [];
      if (tabs.length) {
        strip.setAttribute("role", "tablist");
        strip.setAttribute("aria-label", "Planet Express sections");

        const sync = () => {
          for (const t of tabs) {
            const on = t.classList.contains("active");
            t.setAttribute("role", "tab");
            t.setAttribute("aria-selected", on ? "true" : "false");
            // Roving tabindex: the selected tab is the strip's single tab stop.
            t.tabIndex = on ? 0 : -1;
            const panel = document.getElementById("panel-" + t.dataset.tab);
            if (panel) {
              if (!panel.id) return;
              t.setAttribute("aria-controls", panel.id);
              panel.setAttribute("role", "tabpanel");
              panel.setAttribute("aria-labelledby", t.id || (t.id = "tab-" + t.dataset.tab));
            }
          }
        };
        sync();

        // sidepanel.js moves `.active` itself; mirror it rather than duplicating
        // the switching logic, which would be a second source of truth.
        const mo = new MutationObserver(sync);
        for (const t of tabs) mo.observe(t, { attributes: true, attributeFilter: ["class"] });

        strip.addEventListener("keydown", (e) => {
          const i = tabs.indexOf(document.activeElement);
          if (i < 0) return;
          let next = null;
          switch (e.key) {
            case "ArrowRight": case "ArrowDown": next = tabs[(i + 1) % tabs.length]; break;
            case "ArrowLeft":  case "ArrowUp":   next = tabs[(i - 1 + tabs.length) % tabs.length]; break;
            case "Home":       next = tabs[0]; break;
            case "End":        next = tabs[tabs.length - 1]; break;
            case "Enter": case " ":
              e.preventDefault();
              tabs[i].click();
              return;
            default: return;
          }
          e.preventDefault();
          next.focus();
          next.click();        // follow-focus, the common tablist convention
        });
      }
    } catch (e) { console.warn("[pel-enhance] tablist:", e); }

    /* ── 2. 25 form controls with no accessible name ────────────────────────
     * Every toggle and slider in SETTINGS announced as a bare "checkbox" or
     * "slider". The visible label text is always present in the markup — it is
     * just never associated — so the name is derived from the DOM rather than
     * invented here. A control whose label cannot be found is LEFT ALONE:
     * a wrong accessible name is worse than a missing one.
     */
    try {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim().replace(/^[^\p{L}\p{N}]+/u, "");
      for (const el of document.querySelectorAll("input, select, textarea")) {
        if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") ||
            el.labels?.length || el.title || el.type === "hidden") continue;

        let name = "";
        /* a) a `.field` block holding a BARE <label> — no `for`, not wrapping the
         * control. Six of these carry the API-key inputs and the provider/model
         * selects: the visible caption is right there and simply never
         * associated, so a screen reader announced "edit text, blank" on the
         * field where the visitor pastes their API key. Wire the real elements
         * with for/id rather than copying the string into an aria-label, so one
         * label keeps one owner. */
        const field = el.closest(".field");
        const bare = field && [...field.querySelectorAll("label")]
          .find((l) => !l.getAttribute("for") && !l.contains(el));
        if (bare) {
          if (!el.id) el.id = "pel-ctl-" + Math.random().toString(36).slice(2, 8);
          bare.setAttribute("for", el.id);
          continue;                       // labels[] now resolves; nothing to invent
        }
        // b) a .pill-toggle / label wrapper whose row carries the caption
        const row = el.closest("label")?.parentElement || el.parentElement;
        if (row) {
          const span = [...row.querySelectorAll("span, div")]
            .find((s) => !s.contains(el) && clean(s.textContent).length > 2 && s.children.length === 0);
          if (span) name = clean(span.textContent);
        }
        // b) a slider preceded by a .speed-label caption block
        if (!name) {
          const cap = el.previousElementSibling?.querySelector?.(".speed-label")
                   || el.parentElement?.querySelector?.(".speed-label");
          if (cap) name = clean(cap.textContent);
        }
        if (name) el.setAttribute("aria-label", name);
      }
    } catch (e) { console.warn("[pel-enhance] labels:", e); }

    /* ── 3. Saving a key dropped the visitor into an empty black panel ──────
     * Connecting a key clears the demo transcript, and nothing replaces it: the
     * chat area became ~800px of nothing, with no confirmation the key was even
     * accepted. In the side panel that was a 380px gap and easy to miss; at
     * desktop width it reads as a broken page at the exact moment the visitor
     * has just handed over an API key.
     *
     * A class on the container, with the copy in CSS — so no message is ever
     * inserted into #chatlog, whose children sidepanel.js owns and iterates.
     */
    try {
      const log = document.getElementById("chatlog");
      if (log) {
        /* `childElementCount === 0` is NOT the test. After a key is connected the
         * log keeps ONE child that renders nothing (the hidden first-run card),
         * so the count says "not empty" while the visitor sees 800px of black.
         * The question is whether anything is DRAWN, so measure boxes. */
        const looksEmpty = () =>
          ![...log.children].some((c) => {
            const r = c.getBoundingClientRect();
            return r.height > 1 && r.width > 1;
          });
        const mark = () => log.classList.toggle("pel-empty", looksEmpty());
        mark();
        // childList catches turns arriving; attributes catch a child being
        // shown or hidden in place, which is how the first-run card behaves.
        new MutationObserver(mark).observe(log, {
          childList: true, subtree: true, attributes: true,
          attributeFilter: ["style", "class", "hidden"],
        });
        // A late layout pass (fonts, the panel becoming active) can change the
        // answer after the observer is installed.
        setTimeout(mark, 400);
        window.addEventListener("resize", mark);
      }
    } catch (e) { console.warn("[pel-enhance] empty state:", e); }
  });
})();
