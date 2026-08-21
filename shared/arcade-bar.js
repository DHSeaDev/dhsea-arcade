/**
 * Injects the back-to-arcade strip.
 *
 * Built in JS rather than pasted into each game's HTML so there is exactly one
 * copy to change, and appended to <body> at DOM-ready so it cannot land inside
 * a game's own layout container and get styled by it.
 *
 * Deliberately does NOT trap focus, register keys, or touch history — several of
 * these games bind the whole keyboard, and a bar that ate a keystroke would be a
 * gameplay bug traceable to arcade chrome.
 */
(function () {
  'use strict';
  var tag = document.currentScript;
  var name = (tag && tag.dataset && tag.dataset.gameName) || '';
  function mount() {
    if (document.getElementById('arcade-bar')) return;
    var bar = document.createElement('nav');
    bar.id = 'arcade-bar';
    bar.setAttribute('aria-label', 'Arcade');

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
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else { mount(); }
})();
