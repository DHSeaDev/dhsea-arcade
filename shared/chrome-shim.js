/**
 * chrome-shim.js — makes an MV3 extension game run as an ordinary web page.
 *
 * WHY A GLOBAL SHIM RATHER THAN PER-GAME EDITS
 * Every game in this arcade already has a tested chrome.storage code path. Three
 * of them also carry a non-chrome fallback, and every one of those fallbacks is
 * WORSE than the chrome path: Veilfall falls back to an in-memory Map (saves die
 * on reload) and Underglory's fallback is a stub that returns false forever. So
 * we do not patch the games. We make `chrome.storage.local` exist, and every game
 * takes the path it was actually shipped and tested on. Game source is unmodified.
 *
 * SCOPE — deliberately small. A survey of all seven sources found the entire
 * non-storage chrome.* surface (tabs.create, runtime.getURL, sidePanel.*,
 * action.onClicked, runtime.onInstalled/onStartup, windows.update, alarms) lives
 * ONLY in launcher files: popup.js, sw.js, background.js. On the web the game page
 * IS the page, so those files are not shipped and their APIs are never called.
 * What remains is chrome.storage.local.{get,set,remove,clear} and a few harmless
 * stubs kept so a stray optional-chained call cannot throw.
 *
 * NAMESPACING. Every game is served from the same origin, so localStorage is
 * shared across all of them. Keys are prefixed per game to stop two games with a
 * key like "save" from eating each other. The prefix comes from the build, not
 * from the game.
 *
 * PRIVATE-MODE SAFETY. localStorage getters can THROW (not merely return null)
 * in hardened privacy modes. Every access is wrapped; on failure the shim
 * degrades to an in-memory store for the session and sets a flag the page can
 * read to warn the player, rather than silently pretending saves worked.
 */

(function () {
  'use strict';

  // Game id comes from the script tag's data-game-id, set by the build. Using a
  // data attribute rather than an inline <script> keeps the page compatible with
  // a strict CSP that forbids inline script — the same posture the extensions had.
  var selfTag = document.currentScript;
  var NS = ((selfTag && selfTag.dataset && selfTag.dataset.gameId) ||
            window.__ARCADE_GAME_ID__ || 'game') + ':';
  window.__ARCADE_GAME_ID__ = NS.slice(0, -1);
  var mem = new Map();
  var usingMemory = false;

  function markDegraded(err) {
    if (!usingMemory) {
      usingMemory = true;
      window.__ARCADE_STORAGE_DEGRADED__ = true;
      try { console.warn('[arcade] persistent storage unavailable, saves are session-only:', err); } catch (_) {}
    }
  }

  // Probe once. A throw here is exactly the private-mode case above.
  var ls = null;
  try {
    var probe = '__arcade_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    ls = window.localStorage;
  } catch (e) {
    markDegraded(e);
  }

  function readKey(k) {
    if (!ls) return mem.has(NS + k) ? mem.get(NS + k) : undefined;
    var raw;
    try { raw = ls.getItem(NS + k); } catch (e) { markDegraded(e); return undefined; }
    if (raw === null) return undefined;
    try { return JSON.parse(raw); } catch (e) {
      // A value written by something other than this shim. Return it raw rather
      // than throwing — a game that stored a plain string still gets its string.
      return raw;
    }
  }

  function writeKey(k, v) {
    if (!ls) { mem.set(NS + k, v); return; }
    try {
      ls.setItem(NS + k, JSON.stringify(v));
    } catch (e) {
      // QuotaExceededError is the realistic case. Fall back for the whole
      // session rather than losing this one write silently.
      markDegraded(e);
      mem.set(NS + k, v);
    }
  }

  function dropKey(k) {
    mem.delete(NS + k);
    if (!ls) return;
    try { ls.removeItem(NS + k); } catch (e) { markDegraded(e); }
  }

  function allKeys() {
    var out = [];
    if (ls) {
      try {
        for (var i = 0; i < ls.length; i++) {
          var full = ls.key(i);
          if (full && full.indexOf(NS) === 0) out.push(full.slice(NS.length));
        }
      } catch (e) { markDegraded(e); }
    }
    mem.forEach(function (_v, full) {
      if (full.indexOf(NS) === 0) {
        var k = full.slice(NS.length);
        if (out.indexOf(k) === -1) out.push(k);
      }
    });
    return out;
  }

  /**
   * chrome.storage.local.get supports four call shapes and the games use more
   * than one of them: a string key, an array of keys, an object of
   * key->default, and null/undefined meaning "everything". Callback and promise
   * forms both exist. All are implemented; getting this partially right is the
   * classic shim bug.
   */
  function get(keys, cb) {
    var out = {};
    if (keys === null || keys === undefined) {
      allKeys().forEach(function (k) {
        var v = readKey(k);
        if (v !== undefined) out[k] = v;
      });
    } else if (typeof keys === 'string') {
      var v1 = readKey(keys);
      if (v1 !== undefined) out[keys] = v1;
    } else if (Array.isArray(keys)) {
      keys.forEach(function (k) {
        var v2 = readKey(k);
        if (v2 !== undefined) out[k] = v2;
      });
    } else if (typeof keys === 'object') {
      Object.keys(keys).forEach(function (k) {
        var v3 = readKey(k);
        out[k] = v3 === undefined ? keys[k] : v3;
      });
    }
    if (typeof cb === 'function') { cb(out); return undefined; }
    return Promise.resolve(out);
  }

  function set(obj, cb) {
    try {
      Object.keys(obj || {}).forEach(function (k) { writeKey(k, obj[k]); });
    } catch (e) { markDegraded(e); }
    if (typeof cb === 'function') { cb(); return undefined; }
    return Promise.resolve();
  }

  function remove(keys, cb) {
    [].concat(keys === null || keys === undefined ? [] : keys).forEach(dropKey);
    if (typeof cb === 'function') { cb(); return undefined; }
    return Promise.resolve();
  }

  function clear(cb) {
    allKeys().forEach(dropKey);
    if (typeof cb === 'function') { cb(); return undefined; }
    return Promise.resolve();
  }

  var area = {
    get: get, set: set, remove: remove, clear: clear,
    // Present so `storage.local.onChanged?.addListener` cannot throw. Same-page
    // writes never fire this event in the extension either, so a no-op here is
    // faithful, not a shortcut.
    onChanged: { addListener: function () {}, removeListener: function () {} },
  };

  var noopEvent = { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false; } };

  var shim = {
    storage: {
      local: area,
      // Games that reach for sync get the same store. On the web there is no
      // account to sync to, and silently losing the write would be worse.
      sync: area,
      onChanged: noopEvent,
    },
    runtime: {
      id: undefined,
      getURL: function (p) { return new URL(p, document.baseURI).href; },
      getManifest: function () { return { name: window.__ARCADE_GAME_NAME__ || 'Arcade', version: '0.0.0' }; },
      onInstalled: noopEvent,
      onStartup: noopEvent,
      onMessage: noopEvent,
      sendMessage: function () { return Promise.resolve(); },
      lastError: undefined,
    },
    // Opening a "tab" on the web is a navigation. Kept faithful so any surviving
    // call does something sensible instead of throwing.
    tabs: {
      create: function (o) { try { window.open((o && o.url) || '#', '_blank', 'noopener'); } catch (_) {} return Promise.resolve({}); },
      query: function () { return Promise.resolve([]); },
      update: function () { return Promise.resolve({}); },
    },
    windows: { update: function () { return Promise.resolve({}); } },
    action: { onClicked: noopEvent, setBadgeText: function () { return Promise.resolve(); } },
    sidePanel: {
      open: function () { return Promise.resolve(); },
      setPanelBehavior: function () { return Promise.resolve(); },
    },
    alarms: {
      create: function () {}, clear: function () { return Promise.resolve(true); },
      onAlarm: noopEvent,
    },
  };

  // Never clobber a real extension context. This file is harmless if a game is
  // ever loaded back into an extension shell for comparison.
  if (typeof window.chrome === 'undefined') {
    window.chrome = shim;
  } else {
    if (!window.chrome.storage) window.chrome.storage = shim.storage;
    if (!window.chrome.runtime) window.chrome.runtime = shim.runtime;
  }
})();
