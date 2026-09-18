// DOM helpers. Player-typed text (creature names, codes) only ever reaches the page
// through textContent. innerHTML is used for ONE thing: SVG strings produced by the
// art modules from authored data, with every attribute value escaped by art/kit.js.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** h('button', {class:'x', onclick}, 'text', child) — strings become TEXT nodes. */
export function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

/** Insert trusted art (an SVG string built by art/*.js). */
export function art(host, svg) {
  if (host._svg === svg) return host;      // signature guard: no rebuild when nothing changed
  host._svg = svg;
  host.innerHTML = svg;
  return host;
}

export function announce(text) {
  const live = $('#live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 30);
}

export function relTime(t, now) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.round(hr / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
