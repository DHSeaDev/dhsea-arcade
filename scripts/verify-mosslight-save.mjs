/**
 * verify.mjs proves the chrome.storage SHIM round-trips a token it writes itself.
 * It never touches Mosslight's own save path, so a green there says nothing about
 * whether Mosslight's saves land in its namespace. Same reasoning as
 * verify-bloomrush-save.mjs: a green from a test that never ran the code in
 * question is not evidence.
 *
 * Served under the PRODUCTION CSP parsed from public/_headers, because the whole
 * reason Mosslight needed an arcade emit target is that its itch CSP and this
 * header intersect to "no script runs at all".
 *
 * Proven able to FAIL: MOSSLIGHT_UI=<path> serves a different js/ui.js.
 *   - the 0.3.0 ui.js (direct localStorage, bare keys) goes red on the namespacing
 *     and legacy-adoption checks and stays green on the rest;
 *   - the first draft of the arcade adapter, which hydrated slots 0-2 while the UI
 *     offers 1-3, goes red on "every manual slot survives reload" only. That draft
 *     passed this gate when it tested slot 1 alone; a 3-reviewer panel found it.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist');
const ALT_UI = process.env.MOSSLIGHT_UI || '';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const headers = await readFile(path.join(ROOT, 'public', '_headers'), 'utf8');
const CSP = (headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1];
if (!CSP) { console.error('verify-mosslight-save: no CSP in public/_headers'); process.exit(1); }

const server = http.createServer(async (q, r) => {
  try {
    const u = decodeURIComponent(q.url.split('?')[0]);
    let f = path.join(OUT, u);
    if ((await stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
    let body = await readFile(f);
    if (ALT_UI && u === '/games/mosslight/js/ui.js') body = await readFile(ALT_UI);
    r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Content-Security-Policy': CSP });
    r.end(body);
  } catch { r.writeHead(404); r.end(''); }
});
await new Promise(r => server.listen(8097, r));
const URL = 'http://localhost:8097/games/mosslight/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const R = [];
const check = (name, ok, detail = '') => R.push([ok ? 'PASS' : 'FAIL', name, detail]);

async function open(ctx) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL, { waitUntil: 'load' });
  // A status, never a throw: a boot that fails must print a FAIL line naming the page error,
  // not crash the gate with a TimeoutError before any check is recorded (judge-panel finding).
  const booted = await p.waitForFunction(() => window.ML && ML.G && ML.G.S, null, { timeout: 8000 }).then(() => true, () => false);
  if (booted) await p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const bs = [...m.querySelectorAll('button')]; bs[bs.length - 1].click(); } });
  return { p, errs, booted };
}

/* ---- 1. the game's own save lands in its namespace and survives a reload ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { p, errs, booted } = await open(ctx);
  check('boots under the production CSP', booted, errs.slice(0, 2).join(' | '));
  if (booted) {
  check('arcade path detected (storage goes through chrome.storage.local)', await p.evaluate(() => !!(ML.UI.kv && ML.UI.kv.arcade === true)));

  await p.evaluate(() => { const S = ML.G.S; S.healer.level = 37; S.gold = 4321; ML.UI.save(); });
  const keys = await p.evaluate(() => Object.keys(localStorage).sort());
  check('the live save is namespaced mosslight:', keys.includes('mosslight:mosslight.save.v1'), keys.join(' '));
  check('no bare mosslight.* key leaks onto the shared origin', !keys.some(k => k.startsWith('mosslight.')), keys.join(' '));

  // EVERY slot the Settings panel offers, read from the page rather than typed here: a gate that
  // tested only slot 1 passed a build that hydrated slots 0-2 and lost slot 3 on every reload.
  await p.click('#tab-settings'); await p.waitForTimeout(300);
  const slots = await p.evaluate(() => [...document.querySelectorAll('[data-key^="slotSave:"]')].map(b => +b.dataset.key.split(':')[1]));
  check('settings offers manual slots', slots.length >= 1, 'slots ' + slots.join(','));
  for (const i of slots) { await p.click(`[data-key="slotSave:${i}"]`); await p.waitForTimeout(250); }
  const keys2 = await p.evaluate(() => Object.keys(localStorage).sort());
  check('every manual slot is namespaced', slots.every(i => keys2.includes('mosslight:mosslight.save.v1:slot' + i)), keys2.join(' '));

  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.ML && ML.G && ML.G.S, null, { timeout: 8000 });
  const after = await p.evaluate(ids => ({ lv: ML.G.S.healer.level, gold: Math.floor(ML.G.S.gold), slots: ids.map(i => [i, ML.UI.slotInfo(i)]) }), slots);
  check('level survives reload', after.lv === 37, 'level ' + after.lv);
  check('coin survives reload', after.gold >= 4321, 'gold ' + after.gold);
  const lost = after.slots.filter(([, inf]) => !inf || inf.level !== 37).map(([i]) => i);
  check('every manual slot survives reload', lost.length === 0, lost.length ? 'lost slot ' + lost.join(',') : 'slots ' + slots.join(',') + ' intact');
  }
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ---- 2. a sibling game's keys are untouched, and it does not read them ---- */
{
  // A VALID level-22 save under the bare itch-era key. Garbage would be rejected by
  // loadGame on any build, which makes a check that can never fail; a real save is
  // what a build that ignores the namespace would actually adopt.
  const seedCtx = await browser.newContext();
  const sd = await open(seedCtx);
  const seed = sd.booted ? await sd.p.evaluate(() => { ML.G.S.healer.level = 22; return ML.serialize(ML.G.S); }) : '';
  await seedCtx.close();
  const ctx = await browser.newContext();
  await ctx.addInitScript(raw => { try { if (!localStorage.getItem('bloom-rush:x')) localStorage.setItem('bloom-rush:x', '"sibling"'); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mosslight.save.v1', raw); sessionStorage.setItem('seeded', '1'); } } catch (e) {} }, seed);
  const { p, errs, booted } = await open(ctx);
  const st = booted ? await p.evaluate(() => ({ sib: localStorage.getItem('bloom-rush:x'), lv: ML.G.S.healer.level })) : { sib: null, lv: -1 };
  check('sibling namespace untouched', st.sib === '"sibling"', String(st.sib));
  check('a bare legacy key on the shared origin is NOT adopted as the save', st.lv === 1, 'level ' + st.lv);
  check('no page errors (sibling case)', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ---- 3. storage that throws: the game still boots and says it cannot save ---- */
{
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    const boom = () => { throw new DOMException('denied', 'SecurityError'); };
    Storage.prototype.setItem = boom; Storage.prototype.getItem = boom; Storage.prototype.removeItem = boom;
  });
  const { p, errs, booted } = await open(ctx);
  if (booted) await p.evaluate(() => ML.UI.save());
  const st = booted ? await p.evaluate(() => ({ banner: !document.getElementById('banner').hidden, text: document.getElementById('banner').textContent })) : { banner: false, text: '' };
  check('boots with storage denied', booted && errs.length === 0, errs.slice(0, 2).join(' | '));
  check('the cannot-save banner shows', st.banner && /Export save/.test(st.text), st.text.slice(0, 60));
  await ctx.close();
}

await browser.close(); server.close();
let fail = 0;
for (const [s, n, d] of R) { if (s === 'FAIL') fail++; console.log(`  ${s}  ${n}${d ? '  — ' + d : ''}`); }
console.log(`${R.length - fail}/${R.length} PASS${ALT_UI ? '  (ui.js substituted: ' + path.basename(ALT_UI) + ')' : ''}`);
process.exit(fail ? 1 : 0);
