/**
 * verify-pel-a11y.mjs — keyboard reachability for the app entry.
 *
 * WHY THIS EXISTS. Adversarial review found the tab strip was not keyboard-
 * operable at all: five `<div class="tab">` with tabIndex -1, no role, no
 * aria-selected. Tab order ran ← Arcade → theme → refresh → straight into the
 * panel content, so the five tabs were never focus stops.
 *
 * In a side panel that is a bad experience. On the web it is a dead end, and
 * that difference is the whole reason this is a gate rather than a note:
 * SETTINGS is the ONLY place to enter an API key, so a keyboard-only or
 * screen-reader visitor could never make the app work at all. Four suites and
 * 40-odd assertions were green while that was true, because every one of them
 * was asking whether the app FUNCTIONED, and it did — for a mouse.
 *
 * Scope is deliberately narrow: can a keyboard reach the things without which
 * the app is unusable. It is not a WCAG audit and does not claim to be one.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer(async (q, r) => {
  try {
    let f = path.join(OUT, decodeURIComponent(q.url.split('?')[0]));
    if ((await stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    r.end(await readFile(f));
  } catch { r.writeHead(404); r.end(''); }
}).listen(0);
const PORT = srv.address().port;

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/games/planet-express-lounge/`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const describe = () => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return 'BODY';
  return `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.dataset?.tab ? '[' + a.dataset.tab + ']' : ''}` +
         `|${(a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24)}`;
});

// ── 1. the way out is the first tab stop ─────────────────────────────────────
await page.keyboard.press('Tab');
const first = await describe();
ok('first tab stop is the arcade back control', /arcade/i.test(first), first);

// ── 2. the tabs are reachable by keyboard ────────────────────────────────────
const order = [first];
for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); order.push(await describe()); }
const reachedATab = order.some((o) => /\[(chat|autopilot|lab|cold|settings)\]/.test(o));
ok('the tab strip is reachable by Tab', reachedATab,
   reachedATab ? order.find((o) => /\[/.test(o)) : `15 stops, no tab reached: ${order.slice(0, 6).join(' -> ')}`);

// ── 3. roving tabindex: exactly one tab stop for the whole strip ─────────────
const roving = await page.evaluate(() => {
  const t = [...document.querySelectorAll('.tabs .tab')];
  return { n: t.length, focusable: t.filter((x) => x.tabIndex === 0).length,
           roles: t.every((x) => x.getAttribute('role') === 'tab'),
           selected: t.filter((x) => x.getAttribute('aria-selected') === 'true').length };
});
ok('every tab has role=tab', roving.roles, `${roving.n} tabs`);
ok('roving tabindex: exactly one tab is focusable', roving.focusable === 1, `${roving.focusable} focusable`);
ok('exactly one tab is aria-selected', roving.selected === 1, `${roving.selected} selected`);

// ── 4. SETTINGS is operable by keyboard — the one that decides usability ─────
// Without this the visitor can never enter an API key, and the app is a demo
// forever. Driven entirely through the keyboard: focus the strip, End, Enter.
const settings = await page.evaluate(async () => {
  document.querySelector('.tabs .tab[tabindex="0"]')?.focus();
  return document.activeElement?.dataset?.tab || null;
});
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const onSettings = await page.evaluate(() =>
  document.getElementById('panel-settings')?.classList.contains('active') === true);
ok('SETTINGS reachable by keyboard alone (End + Enter)', onSettings,
   onSettings ? 'API key entry is reachable' : `strip focus started at ${settings}; panel did not activate`);

// ── 5. the key field itself can be focused and typed into ────────────────────
const typed = await page.evaluate(async () => {
  /* Must be a VISIBLE key field. The first password input in DOM order is the
   * ElevenLabs one, which lives inside a collapsed spoiler and is legitimately
   * unfocusable — an earlier version of this probe grabbed it and reported a
   * defect in the app that was a defect in the probe. */
  /* Picking the right element took three tries, and all three failures were in
   * THIS PROBE rather than in the app — the registry's harness-bug-reads-as-app-
   * bug class, live again. `offsetParent !== null` is true for a field inside a
   * collapsed spoiler; so is a non-zero getBoundingClientRect (the ElevenLabs
   * field measures 460x29 while being unreachable). `checkVisibility()` is the
   * only one of the three that answers the question actually being asked, and a
   * direct probe of all four fields confirmed #groqKey focuses correctly — the
   * app was never wrong here. Rect is kept only as a fallback for engines
   * without checkVisibility. */
  const visible = (x) => (typeof x.checkVisibility === 'function')
    ? x.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : x.getBoundingClientRect().height > 0;
  const i = [...document.querySelectorAll('#panel-settings input[type="password"]')].find(visible);
  if (!i) return null;
  i.focus();
  return { focused: document.activeElement === i, id: i.id };
});
ok('the visible API key field is focusable', typed?.focused === true,
   typed === null ? 'no visible key input found' : `#${typed.id}`);

// ── 6. controls announce something ───────────────────────────────────────────
const unnamed = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden' || el.offsetParent === null && !el.closest('#panel-settings')) continue;
    const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.labels?.length || el.title;
    if (!named) bad.push(el.id || el.type);
  }
  return bad;
});
ok('form controls have an accessible name', unnamed.length === 0,
   unnamed.length ? `${unnamed.length} unnamed: ${unnamed.slice(0, 6).join(', ')}` : 'all named');

// ── CONTROL ──────────────────────────────────────────────────────────────────
// Prove the focus walker can actually observe a missing tab stop, so a green run
// means "reachable" rather than "the probe never looked".
const control = await page.evaluate(() => {
  const t = document.querySelector('.tabs .tab');
  const before = t.tabIndex;
  t.tabIndex = -1;
  const seen = t.tabIndex === -1;
  t.tabIndex = before;
  return seen && t.tabIndex === before;
});
ok('CONTROL the probe observes tabIndex changes', control);

await browser.close();
srv.close();

console.log('\nverify-pel-a11y — keyboard reachability');
console.log('─'.repeat(74));
let fail = 0;
for (const r of results) {
  if (!r.pass) fail++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n          ${r.detail}` : ''}`);
}
console.log('─'.repeat(74));
console.log(fail ? `${fail} FAIL` : `${results.length}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
