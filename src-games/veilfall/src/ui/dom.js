/** Tiny DOM helpers. No framework, no build step, no virtual anything. */

export function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

export const frag = (kids) => {
  const f = document.createDocumentFragment();
  for (const k of [].concat(kids)) if (k) f.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return f;
};

export const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
export const mount = (host, ...kids) => { clear(host); host.append(frag(kids)); return host; };

/** Announce to screen readers without moving focus. */
export function announce(msg) {
  const live = document.getElementById('live');
  if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); }
}

/** A re-entrancy guard for any handler that mutates state or hits the network. */
export function guarded(btn, fn) {
  let busy = false;
  return async (ev) => {
    if (busy) return;
    busy = true;
    if (btn) btn.disabled = true;
    try { await fn(ev); }
    finally { busy = false; if (btn && btn.isConnected) btn.disabled = false; }
  };
}

/** True when the OS or the user has asked for less movement. */
export const reducedMotion = () =>
  document.documentElement.dataset.motion === 'off'
  || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Type text out over time. Returns a promise; skippable via the returned handle. */
export function stream(node, text, speed = 'normal') {
  // Typed-out text is motion. Honouring the OS preference here is the whole
  // point of the preference, and it also stops narration from standing between
  // the player and the game.
  const perChar = reducedMotion() ? 0 : ({ instant: 0, fast: 8, normal: 18 }[speed] ?? 18);
  if (!perChar) { node.textContent = text; return { done: Promise.resolve(), skip() {} }; }
  let i = 0, timer = null, resolve;
  const done = new Promise((r) => { resolve = r; });
  const tick = () => {
    i += 2;
    node.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(timer); resolve(); }
  };
  timer = setInterval(tick, perChar);
  return {
    done,
    skip() { clearInterval(timer); node.textContent = text; resolve(); },
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
