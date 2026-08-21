/**
 * verify.mjs — the gate that decides whether a game actually works on the web.
 *
 * Serves dist/ over real HTTP (never file://, which has a different origin model
 * and would let a localStorage bug pass) and, for every game:
 *   1. loads it and fails on any console error or page error
 *   2. asserts the shim installed and that the game did NOT get a real chrome API
 *   3. writes through chrome.storage.local, RELOADS, and reads it back — the
 *      round trip is the only thing that proves persistence, since a write that
 *      lands in memory looks identical to one that landed in localStorage
 *   4. asserts the game painted something (a canvas with non-zero size, or
 *      meaningful DOM), so a blank page cannot pass as "no errors"
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'dist');
const PORT = 8099;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

/* Read the real policy out of public/_headers rather than restating it here. */
const headersFile = await readFile(path.resolve(import.meta.dirname, '..', 'public', '_headers'), 'utf8');
const CSP = (headersFile.match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1];
if (!CSP) throw new Error('no Content-Security-Policy found in public/_headers');
console.log('CSP under test:\n  ' + CSP.replace(/; /g, ';\n  ') + '\n');

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(OUT, p);
    if ((await stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
    const body = await readFile(f);
    /* Serve the SAME Content-Security-Policy Cloudflare Pages will serve. A game
     * verified without it is verified against a server that does not exist — a
     * strict CSP that breaks a game is a shipping bug, and this is the only place
     * it can be caught before deploy. Parsed from public/_headers so the two can
     * never drift apart. */
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
    });
    res.end(body);
  } catch { res.writeHead(404); res.end('404'); }
});
await new Promise(r => server.listen(PORT, r));

const GAMES = [
  ['prism-cascade', 'games/prism-cascade/'],
  ['lumenreel', 'games/lumenreel/ui/'],
  ['underglory', 'games/underglory/'],
  ['veilfall', 'games/veilfall/'],
  ['emberkeep', 'games/emberkeep/'],
  ['emberkeep-mountain', 'games/emberkeep-mountain/'],
  ['bloom-rush', 'games/bloom-rush/'],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--disable-dev-shm-usage'] });
const results = [];

for (const [id, url] of [['ARCADE INDEX', ''], ...GAMES]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  /* A request to a third-party host cannot succeed in this sandbox (no egress),
   * so those are recorded separately as environmental rather than counted as
   * defects. Anything served from our own origin failing IS a defect. */
  const external = [];
  page.on('requestfailed', r => {
    const u = r.url();
    const msg = u.replace(`http://localhost:${PORT}`, '') + ' ' + (r.failure()?.errorText || '');
    (u.startsWith(`http://localhost:${PORT}`) ? errors : external).push('requestfailed: ' + msg);
  });
  page.on('console', m => {
    // Chrome logs a generic "Failed to load resource" for the same external
    // fetches; drop only those, and only when an external failure explains them.
    if (/Content Security Policy|Refused to/i.test(m.text())) { errors.push('CSP: ' + m.text()); return; }
    if (m.type() === 'error' && /Failed to load resource/.test(m.text()) && external.length) {
      external.push('console: ' + m.text());
      const i = errors.indexOf('console: ' + m.text());
      if (i >= 0) errors.splice(i, 1);
    }
  });

  const row = { id, url, errors, external, boot: false, painted: false, persisted: null };
  try {
    await page.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2500);   // let a rAF loop actually paint
    row.boot = true;

    row.painted = await page.evaluate(() => {
      const cs = [...document.querySelectorAll('canvas')];
      if (cs.some(c => c.width > 50 && c.height > 50)) return true;
      return document.body.innerText.trim().length > 40;
    });

    if (id !== 'ARCADE INDEX') {
      // Shim present, and NOT a real extension context.
      row.shim = await page.evaluate(() => !!(window.chrome?.storage?.local?.get) && !window.chrome?.runtime?.id);
      row.bar = await page.evaluate(() => !!document.getElementById('arcade-bar'));

      const token = 'verify-' + id + '-' + url.length;
      await page.evaluate(t => chrome.storage.local.set({ __verify__: t }), token);
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(400);
      const back = await page.evaluate(() => chrome.storage.local.get('__verify__').then(o => o.__verify__));
      row.persisted = back === token;

      // Namespacing: the key must be prefixed so two games cannot collide.
      row.namespaced = await page.evaluate(id2 =>
        Object.keys(localStorage).some(k => k.startsWith(id2 + ':')), id);
    }
  } catch (e) {
    row.errors.push('THREW: ' + e.message);
  }
  results.push(row);
  await ctx.close();
}
await browser.close();
server.close();

let fail = 0;
console.log('\n' + '─'.repeat(78));
for (const r of results) {
  const checks = [r.boot && 'boot', r.painted && 'painted', r.shim && 'shim',
    r.bar && 'bar', r.persisted && 'saves', r.namespaced && 'ns'].filter(Boolean);
  const bad = !r.boot || !r.painted || r.errors.length ||
              (r.id !== 'ARCADE INDEX' && (!r.shim || !r.persisted || !r.namespaced || !r.bar));
  if (bad) fail++;
  console.log(`${bad ? 'FAIL' : 'PASS'}  ${r.id.padEnd(20)} ${checks.join(' ')}`);
  for (const e of r.errors.slice(0, 6)) console.log(`        ${e.slice(0, 150)}`);
  if (r.external?.length) console.log(`        [environmental, sandbox has no egress] ${r.external.length} external request(s): ${[...new Set(r.external.map(e => (e.match(/https?:\/\/[^\/]+/) || [''])[0]))].join(', ')}`);
}
console.log('─'.repeat(78));
console.log(`${results.length - fail}/${results.length} pass`);
process.exit(fail ? 1 : 0);
