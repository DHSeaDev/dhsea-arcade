/**
 * pe-web-shim.js — Planet Express Lounge, web port
 *
 * Classic script. MUST load before sidepanel.js / lab.js (which are modules and
 * therefore deferred), so `chrome` exists by the time they evaluate.
 *
 * Ports the MV3 APIs that PEL calls from files which SHIP on the web:
 *
 *   sidepanel.js  runtime.getURL · runtime.sendMessage · storage.local
 *                 storage.session · tabs.create · tts.getVoices
 *   lab.js        runtime.sendMessage · onMessage · lastError · id
 *   tts.js        tts.getVoices · tts.speak · tts.stop
 *
 * background.js / popup.js are launcher files and are NOT shipped. The Dark
 * Matter engine that lived in the service worker is ported separately in
 * pe-web-background.js, which registers onto this shim's message bus.
 *
 * ADDITIVE BY CONSTRUCTION. The arcade origin already ships a global
 * chrome.storage shim for the seven games. This file never clobbers an
 * existing implementation — it fills in only what is missing. Two shims on one
 * origin is the integration hazard here, and "last script wins" is how a
 * working game silently loses its save path.
 */
(function () {
  "use strict";

  /* Key namespace. Taken from the script tag's data-ns, set by the build to the
   * entry id — the same convention shared/chrome-shim.js uses via data-game-id,
   * and the same one verify.mjs asserts against (`localStorage` must hold a key
   * prefixed with the entry id). Hardcoding a short "pel:" would have failed
   * that gate while looking perfectly reasonable in isolation. */
  const _tag = document.currentScript;
  const NS = ((_tag && _tag.dataset && _tag.dataset.ns) || "pel") + ":";
  const g  = globalThis;

  g.chrome = g.chrome || {};
  const chrome = g.chrome;

  // ── collision guard ─────────────────────────────────────────────────────────
  // The arcade already ships shared/chrome-shim.js for the seven games, and that
  // file seats a COMPLETE chrome.runtime whose onMessage is a no-op event and
  // whose sendMessage resolves undefined. A naive `if (!chrome.runtime.onMessage)`
  // guard sees a present property and declines to install the real bus — so the
  // Dark Matter economy would go quiet with no error anywhere. Present-but-dead
  // is not the same as absent, and only the second one is safe to skip.
  //
  // The build does not inject chrome-shim.js for an `app` entry, so this should
  // never fire. It is here because "should never" is not a gate.
  const isNoop = (fn) => typeof fn === "function" && /\{\s*\}$|return Promise\.resolve\(\)\s*;?\s*\}$/.test(
    Function.prototype.toString.call(fn).replace(/\s+/g, " ").trim());

  chrome.runtime = chrome.runtime || {};

  // ── runtime identity ────────────────────────────────────────────────────────
  // lab.js and pe-web-background.js both gate inbound messages on
  // `sender.id !== chrome.runtime.id`. The extension satisfied that because both
  // sides read the same value — the VALUE is irrelevant, the EQUALITY is the
  // contract. So leave it undefined and stamp the sender with the same thing.
  //
  // Leaving it undefined is not incidental. The arcade's verify.mjs asserts
  //   row.shim = !!(chrome?.storage?.local?.get) && !window.chrome?.runtime?.id
  // i.e. a TRUTHY runtime.id means "this is a real extension context" and fails
  // the gate. An earlier draft of this file set id = "pe-web" and would have
  // failed that check on every run. Both properties hold at once only if the id
  // stays undefined, which it now does, deliberately.
  if (!("id" in chrome.runtime)) chrome.runtime.id = undefined;
  if (!chrome.runtime.getURL || isNoop(chrome.runtime.getURL)) {
    chrome.runtime.getURL = (path) => new URL(path, location.href).href;
  }

  // `lastError` is a getter in the real API and is only ever set for the
  // duration of a callback. lab.js reads it three times; emulate the window.
  let _lastError;
  if (!Object.getOwnPropertyDescriptor(chrome.runtime, "lastError")) {
    Object.defineProperty(chrome.runtime, "lastError", { get: () => _lastError });
  }

  // ── storage ─────────────────────────────────────────────────────────────────
  // Backed by localStorage (local) and sessionStorage (session), namespaced.
  // Both are wrapped: a private window, disabled site data, or a quota failure
  // throws on ACCESS, not just on write, so the accessor itself is guarded.
  function makeArea(backing, ns) {
    const store = () => {
      try { return backing(); } catch { return null; }
    };
    const readAll = () => {
      const s = store();
      const out = {};
      if (!s) return out;
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && k.startsWith(ns)) {
          try { out[k.slice(ns.length)] = JSON.parse(s.getItem(k)); } catch { /* skip */ }
        }
      }
      return out;
    };
    return {
      get(keys) {
        const all = readAll();
        let out;
        if (keys == null)                    out = all;
        else if (typeof keys === "string")   out = (keys in all) ? { [keys]: all[keys] } : {};
        else if (Array.isArray(keys)) {
          out = {};
          for (const k of keys) if (k in all) out[k] = all[k];
        } else {
          // Object form supplies defaults for absent keys.
          out = {};
          for (const k of Object.keys(keys)) out[k] = (k in all) ? all[k] : keys[k];
        }
        return Promise.resolve(out);
      },
      set(items) {
        const s = store();
        if (!s) return Promise.resolve();
        try {
          for (const [k, v] of Object.entries(items)) s.setItem(ns + k, JSON.stringify(v));
        } catch (e) {
          return Promise.reject(e);   // quota — surfaced, never swallowed
        }
        return Promise.resolve();
      },
      remove(keys) {
        const s = store();
        if (!s) return Promise.resolve();
        for (const k of (Array.isArray(keys) ? keys : [keys])) {
          try { s.removeItem(ns + k); } catch { /* ignore */ }
        }
        return Promise.resolve();
      },
      clear() {
        const s = store();
        if (!s) return Promise.resolve();
        for (const k of Object.keys(readAll())) {
          try { s.removeItem(ns + k); } catch { /* ignore */ }
        }
        return Promise.resolve();
      },
    };
  }

  chrome.storage = chrome.storage || {};
  // Additive: if the arcade shim already seated `local`, leave it alone.
  if (!chrome.storage.local)   chrome.storage.local   = makeArea(() => g.localStorage,   NS);
  if (!chrome.storage.session) chrome.storage.session = makeArea(() => g.sessionStorage, NS);

  // ── tabs ────────────────────────────────────────────────────────────────────
  // Only ever used as tabs.create({ url: getURL("welcome.html") }).
  chrome.tabs = chrome.tabs || {};
  if (!chrome.tabs.create) {
    chrome.tabs.create = ({ url }) => {
      g.open(url, "_blank", "noopener");
      return Promise.resolve({ id: -1, url });
    };
  }
  if (!chrome.tabs.query) chrome.tabs.query = () => Promise.resolve([]);

  // ── message bus ─────────────────────────────────────────────────────────────
  // Real traffic, not a stub: dm_get / dm_spend / dm_earn / dm_update and the
  // four crew-state signals. Call sites use BOTH styles —
  //   sidepanel.js  sendMessage({...}).catch(() => {})        promise
  //   lab.js        sendMessage({...}, (res) => { ... })      callback + lastError
  // so both are supported off one dispatcher.
  const _listeners = new Set();
  const SENDER = Object.freeze({ id: chrome.runtime.id, url: location.href });

  // `!onMessage.addListener` is NOT the test — the arcade shim supplies one that
  // does nothing. A bus is live only if a listener registered through it can be
  // reached, so probe that directly.
  const busIsLive = (() => {
    const ev = chrome.runtime.onMessage;
    if (!ev || typeof ev.addListener !== "function") return false;
    if (isNoop(ev.addListener)) return false;
    let seen = false;
    const probe = () => { seen = true; };
    try {
      ev.addListener(probe);
      seen = typeof ev.hasListener === "function" ? ev.hasListener(probe) : false;
      ev.removeListener?.(probe);
    } catch { return false; }
    return seen;
  })();

  if (!busIsLive) {
    chrome.runtime.onMessage = {
      addListener:    (fn) => { _listeners.add(fn); },
      removeListener: (fn) => { _listeners.delete(fn); },
      hasListener:    (fn) => _listeners.has(fn),
    };
  }

  function dispatch(msg) {
    // Resolves with the first listener that answers. A listener answers either
    // synchronously via sendResponse, or asynchronously by returning true and
    // calling sendResponse later — the same contract as the real API.
    return new Promise((resolve) => {
      let settled = false;
      let awaiting = 0;
      const answer = (v) => { if (!settled) { settled = true; resolve(v); } };

      for (const fn of Array.from(_listeners)) {
        let responded = false;
        const sendResponse = (v) => { if (!responded) { responded = true; answer(v); } };
        let keepOpen = false;
        try {
          keepOpen = fn(msg, SENDER, sendResponse) === true;
        } catch (e) {
          console.error("[pe-shim] listener threw:", e);
        }
        if (keepOpen && !responded) awaiting++;
      }

      // No listener took ownership → resolve undefined on a microtask, matching
      // "no receiving end" without the real API's thrown error.
      if (!awaiting) queueMicrotask(() => answer(undefined));
    });
  }

  if (!busIsLive || isNoop(chrome.runtime.sendMessage)) {
    chrome.runtime.sendMessage = function (msg, cb) {
      const p = dispatch(msg);
      if (typeof cb === "function") {
        p.then((res) => {
          // lastError is visible only for the duration of the callback.
          _lastError = (res === undefined)
            ? { message: "Could not establish connection. Receiving end does not exist." }
            : undefined;
          try { cb(res); } finally { _lastError = undefined; }
        });
        return;                       // callback form returns nothing, as in MV3
      }
      return p;                       // promise form — sidepanel.js chains .catch()
    };
  }

  // ── TTS ─────────────────────────────────────────────────────────────────────
  // chrome.tts → Web Speech. tts.js has no existing fallback path, so this is
  // the whole voice engine on the web. The OS voices underneath are the SAME
  // ones tts.js already ranks (Microsoft David/Zira, Alex, Samantha…), so the
  // per-character pitch/rate profiles carry over unchanged.
  const synth = g.speechSynthesis;

  let _voices = [];
  let _voicesReady = false;
  const _voiceWaiters = [];

  function refreshVoices() {
    if (!synth) return;
    const list = synth.getVoices() || [];
    if (!list.length) return;               // Chrome returns [] until voiceschanged
    _voices = list;
    _voicesReady = true;
    const shaped = shapeVoices();
    while (_voiceWaiters.length) _voiceWaiters.shift()(shaped);
  }

  function shapeVoices() {
    // chrome.tts shape: { voiceName, lang, remote, eventTypes }
    // Web Speech shape: { name,      lang, localService }
    // `remote` is the field tts.js splits local vs cloud voices on — it is the
    // inverse of localService, not a rename.
    return _voices.map((v) => ({
      voiceName:  v.name,
      lang:       v.lang,
      remote:     v.localService === false,
      eventTypes: ["start", "end", "error", "interrupted", "cancelled"],
    }));
  }

  if (synth) {
    refreshVoices();
    synth.addEventListener?.("voiceschanged", refreshVoices);
    // Slow systems populate late; tts.js already re-probes at 200ms and 1500ms.
    setTimeout(refreshVoices, 250);
    setTimeout(refreshVoices, 1500);
  }

  // Chrome silently cuts synthesis at ~15s. The documented workaround is a
  // pause/resume pump while an utterance is in flight. Without it, every crew
  // line longer than about two sentences truncates mid-word.
  let _pump = null;
  function startPump() {
    if (_pump || !synth) return;
    _pump = setInterval(() => {
      if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
      else if (!synth.speaking) stopPump();
    }, 10000);
  }
  function stopPump() {
    if (_pump) { clearInterval(_pump); _pump = null; }
  }

  chrome.tts = chrome.tts || {};

  if (!chrome.tts.getVoices) {
    chrome.tts.getVoices = function (cb) {
      if (!synth) { cb([]); return; }
      if (_voicesReady) { cb(shapeVoices()); return; }
      _voiceWaiters.push(cb);
      refreshVoices();
    };
  }

  if (!chrome.tts.speak) {
    chrome.tts.speak = function (text, opts = {}) {
      const fire = (type) => { try { opts.onEvent?.({ type, charIndex: 0 }); } catch {} };
      if (!synth) { fire("error"); return; }

      // chrome.tts `enqueue:false` INTERRUPTS whatever is speaking. Web Speech
      // always queues, so the interrupt has to be explicit. tts.js already
      // serialises through _isSpeaking, so this only ever clears a stuck tail.
      if (opts.enqueue !== true) synth.cancel();

      const u = new SpeechSynthesisUtterance(text);
      // Web Speech: rate 0.1–10, pitch 0–2, volume 0–1. tts.js pre-clamps both
      // to its own safe bands; clamp again rather than trust the caller.
      u.rate   = Math.min(Math.max(opts.rate   ?? 1, 0.1), 10);
      u.pitch  = Math.min(Math.max(opts.pitch  ?? 1, 0),   2);
      u.volume = Math.min(Math.max(opts.volume ?? 1, 0),   1);

      if (opts.voiceName) {
        const v = _voices.find((x) => x.name === opts.voiceName);
        if (v) { u.voice = v; u.lang = v.lang; }
      }

      let done = false;
      const settle = (type) => {
        if (done) return;
        done = true;
        stopPump();
        fire(type);
      };

      u.onstart = () => { startPump(); fire("start"); };
      u.onend   = () => settle("end");
      u.onerror = (e) => {
        // Web Speech spells it "canceled"; chrome.tts spells it "cancelled".
        // tts.js's _onTTSEvent matches on the chrome spelling, so a raw
        // pass-through would leave _isSpeaking stuck true and the queue dead.
        const k = e?.error;
        settle(k === "interrupted" ? "interrupted"
             : k === "canceled"    ? "cancelled"
             : "error");
      };

      // A speak() that never fires any event wedges the queue permanently.
      // Autoplay policy is the real cause on the web: the first utterance
      // before any user gesture is dropped silently by the browser.
      setTimeout(() => {
        if (!done && !synth.speaking && !synth.pending) settle("error");
      }, 1200);

      synth.speak(u);
    };
  }

  if (!chrome.tts.stop) {
    chrome.tts.stop = function () {
      stopPump();
      try { synth?.cancel(); } catch {}
    };
  }

  // ── absent surfaces ─────────────────────────────────────────────────────────
  // Never called from shipped files, but a stray reference should no-op rather
  // than throw and take the page down with it.
  chrome.action       = chrome.action       || { setBadgeText(){}, setBadgeBackgroundColor(){}, onClicked:{ addListener(){} } };
  chrome.sidePanel    = chrome.sidePanel    || { open: () => Promise.resolve(), setPanelBehavior: () => Promise.resolve() };
  chrome.contextMenus = chrome.contextMenus || { create(){}, removeAll(cb){ cb?.(); }, onClicked:{ addListener(){} } };
  chrome.commands     = chrome.commands     || { onCommand:{ addListener(){} } };
  chrome.alarms       = chrome.alarms       || { create(){}, get: () => Promise.resolve(null), onAlarm:{ addListener(){} } };
  chrome.runtime.onInstalled = chrome.runtime.onInstalled || { addListener(){} };
  chrome.runtime.onStartup   = chrome.runtime.onStartup   || { addListener(){} };

  // Exposed for the gate suite only.
  g.__PE_SHIM__ = { ns: NS, dispatch, shapeVoices, refreshVoices };
})();
