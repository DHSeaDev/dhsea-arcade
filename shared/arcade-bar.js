/**
 * Injects the back-to-arcade strip.
 *
 * Built in JS rather than pasted into each game's HTML so there is exactly one
 * copy to change, and inserted as the FIRST child of <body> at DOM-ready so it
 * cannot land inside a game's own layout container and get styled by it.
 *
 * Deliberately does NOT trap focus, register keys, or touch history — several of
 * these games bind the whole keyboard, and a bar that ate a keystroke would be a
 * gameplay bug traceable to arcade chrome. The same restraint governs the
 * auto-hide below: it listens passively and never calls preventDefault.
 *
 * ── AUTO-HIDE ───────────────────────────────────────────────────────────────
 * The bar was parked permanently over the top-left corner of every page, and on
 * Veilfall that corner holds a real control — the bar sat on top of it, so the
 * control could not be clicked at all. A fixed overlay that never moves is a
 * hitbox over someone else's UI, on eight pages at once.
 *
 * It now shows itself on arrival, so the way out is discoverable, then tucks
 * away. Three properties are non-negotiable, and each is asserted in verify.mjs:
 *
 *   1. It stays the FIRST BODY CHILD and the FIRST TAB STOP. Hiding must never
 *      cost keyboard users the exit, so it hides by TRANSFORM — never by
 *      display:none, visibility:hidden or a negative tabindex, each of which
 *      would drop it out of the tab order entirely.
 *   2. Opacity stays 1 at all times. This bar already shipped once at
 *      opacity .35, which made the only way out of a game effectively invisible
 *      and put its text under the contrast floor. Hiding by fading walks
 *      straight back into that. Off-screen or fully legible, nothing between.
 *   3. Collapsed, it has pointer-events:none — so it cannot intercept a click
 *      even mid-transition. That is the actual bug; moving it while leaving it
 *      clickable would fix only the appearance.
 *
 * Coming back: pointer near the corner (passive mousemove, hover devices),
 * keyboard focus (driven by :focus-within in CSS, so the exit survives this
 * script failing outright), or a tap on the thin hot-zone strip on touch
 * devices, which have no hover and so need a target.
 */
(function () {
  'use strict';
  var tag = document.currentScript;
  var name = (tag && tag.dataset && tag.dataset.gameName) || '';

  var REVEAL_MS = 3500;   // long enough to read "← Arcade", short enough to forgive
  var LINGER_MS = 600;    // grace after the pointer leaves, so it cannot flicker
  var ZONE_W    = 240;    // reveal zone — generous, entering it costs nothing
  var ZONE_H    = 72;

  function mount() {
    if (document.getElementById('arcade-bar')) return;
    var bar = document.createElement('nav');
    bar.id = 'arcade-bar';
    bar.setAttribute('aria-label', 'Arcade');
    /* The gate reads this instead of racing the timer. A component's state
     * should be readable from the DOM, not inferred from a stopwatch. */
    bar.dataset.state = 'revealed';

    var home = document.createElement('a');
    home.href = '/';
    home.textContent = '← Arcade';
    bar.appendChild(home);

    if (name) {
      var sep = document.createElement('span');
      sep.className = 'ab-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '/';
      bar.appendChild(sep);
      var who = document.createElement('span');
      who.className = 'ab-name';
      who.textContent = name;   // textContent, never innerHTML
      bar.appendChild(who);
    }

    // Surfaced only when the shim actually failed to reach persistent storage,
    // so a player in a hardened private window is told their run will not save
    // instead of finding out at the end.
    if (window.__ARCADE_STORAGE_DEGRADED__) {
      var warn = document.createElement('span');
      warn.className = 'ab-name';
      warn.textContent = '— saves off (private mode)';
      bar.appendChild(warn);
    }
    /* FIRST child of <body>, not appended last. Appended, this is the final tab
     * stop on the page — a "back" control you can only reach after tabbing
     * through an entire game, which for a canvas game may be never. First child
     * makes it the first thing keyboard and screen-reader users meet. */
    if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);

    /* The touch affordance. Inserted AFTER the bar so the bar keeps its
     * first-child position, and it holds nothing focusable so the tab order is
     * unchanged. 10px tall in the extreme corner: on a hover device CSS leaves
     * it inert and mousemove does the work; only where there is no hover does it
     * become tappable, because a touch user has no other way to ask for it back. */
    var zone = document.createElement('div');
    zone.id = 'arcade-bar-zone';
    zone.setAttribute('aria-hidden', 'true');
    bar.parentNode.insertBefore(zone, bar.nextSibling);

    var timer = null;
    function set(state) { if (bar.dataset.state !== state) bar.dataset.state = state; }

    function collapseSoon(ms) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        // Never collapse out from under a keyboard user who is focused on it.
        if (bar.contains(document.activeElement)) { collapseSoon(LINGER_MS); return; }
        set('collapsed');
      }, ms);
    }
    function reveal() { clearTimeout(timer); set('revealed'); }

    // Passive, no preventDefault, no key handling — a game that binds the whole
    // document keeps every event it had before this file existed.
    document.addEventListener('mousemove', function (e) {
      if (e.clientX <= ZONE_W && e.clientY <= ZONE_H) reveal();
      else if (bar.dataset.state === 'revealed' && !bar.contains(document.activeElement)) {
        collapseSoon(LINGER_MS);
      }
    }, { passive: true });

    zone.addEventListener('touchstart', reveal, { passive: true });
    zone.addEventListener('click', reveal);

    bar.addEventListener('focusin', reveal);
    bar.addEventListener('focusout', function () { collapseSoon(LINGER_MS); });

    /* ── the exit of last resort ────────────────────────────────────────────
     * Measured across all eight entries: on five of them a single Tab from a
     * fresh load lands on this link. On Emberkeep and Emberkeep Mountain, Tab
     * moves focus NOWHERE — body to body — even though this link is the first
     * body child, has tabIndex 0, and focuses correctly when asked
     * programmatically. Those pages simply have no working forward traversal,
     * which means a keyboard visitor cannot leave the game at all.
     *
     * So: if a Tab arrives while NOTHING on the page holds focus, put focus on
     * the exit. Scoped as narrowly as it can be —
     *   - capture phase, so it runs before a game's own handler;
     *   - ONLY when activeElement is <body>, i.e. the page has no focus to
     *     steal. A game that focuses its canvas or a button is never touched,
     *     and no game can lose a Tab it was actually using;
     *   - only for plain Tab, never Shift+Tab, so backward traversal is intact;
     *   - preventDefault only in the branch that acts.
     * This is the one keyboard binding this file takes, and the header's
     * "registers no keys" promise is narrowed rather than quietly broken. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.activeElement && document.activeElement !== document.body) return;
      var link = bar.querySelector('a');
      if (!link) return;
      e.preventDefault();
      reveal();
      link.focus();
    }, true);

    collapseSoon(REVEAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else { mount(); }
})();
