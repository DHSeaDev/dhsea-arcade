#!/usr/bin/env node
// P4 — the one thing the handoff said to MEASURE rather than assume.
// Lives at the repo root's scripts/, not inside src-games/creature-camp/.
// scripts/build.mjs copies a game's whole folder into dist/, so gate scripts
// parked beside the game were published to play.dhseadev.online (44 KB of .mjs
// on the CDN) and dist-itch/ landed in the arcade's sitemap. Found by
// scripts/preship.mjs, 2026-09-19, and confirmed by a control: removing
// dist-itch/ took preship from 4 FAIL to 11/11 PASS.
//
// vendor/storage.js detect(): chrome.storage.local -> localStorage -> in-memory.
// In-memory means progress dies with the tab. itch.io serves a game in an
// <iframe sandbox="...">, so whether localStorage is reachable there is a
// property of the sandbox token set, not of this code. This harness runs the
// emitted file inside a matrix of sandbox attributes over http (not file://,
// whose opaque origins would make every answer wrong) and asserts a real save
// round-trip across an iframe reload.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src-games', 'creature-camp');
const SAVE_KEY = 'creaturecamp_save_v1';

// itch.io's own embed. Measured from itch's documented/observed iframe
// attributes; the exact live set is [UNVERIFIED] from this container, so the
// matrix brackets it rather than claiming one.
const MATRIX = [
  ['itch-like (allow-same-origin present)',
    'allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-modals allow-downloads', true],
  ['no allow-same-origin (opaque origin)', 'allow-scripts allow-popups allow-modals', false],
  ['no sandbox attribute at all', null, true],
];

const results = [];
const check = (n, ok, d = '') => { results.push({ n, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

const html = (sandbox) => `<!doctype html><title>host</title><style>html,body{margin:0}iframe{width:1280px;height:900px;border:0}</style>
<iframe id="f" src="/index.html"${sandbox === null ? '' : ` sandbox="${sandbox}"`}></iframe>`;

async function main() {
  const file = await readFile(resolve(ROOT, '..', '..', 'dist-itch/index.html'));
  let sandboxNow = MATRIX[0][1];
  const server = createServer((req, res) => {
    if (req.url.startsWith('/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(file); }
    else { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html(sandboxNow)); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;

  const browser = await chromium.launch();
  for (const [label, sandbox, expectStorage] of MATRIX) {
    sandboxNow = sandbox;
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 940 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      setInterval(() => { const m = document.getElementById('arrival'), o = document.getElementById('arrival-ok'); if (m && !m.hidden && o) o.click(); }, 200);
    });
    await page.goto(base);
    const frame = page.frameLocator('#f');
    await page.waitForTimeout(2500);

    // Which backend did detect() actually pick? Ask the page, don't infer.
    const backend = await page.frames()[1].evaluate(() => {
      try { const k = '__probe__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return 'local'; }
      catch (e) { return 'memory (' + (e.name || 'throw') + ')'; }
    }).catch(e => 'unreachable: ' + e.message.slice(0, 60));
    console.log(`\n--- ${label}`);
    console.log(`    backend detect() would pick: ${backend}`);
    check(`${label}: storage availability matches expectation`,
      expectStorage ? backend === 'local' : backend !== 'local', `got ${backend}`);

    if (backend !== 'local') { await ctx.close(); continue; }

    // CONTROL: the probe must be able to see storage FAIL. Prove it by reading a
    // key that cannot exist, and by confirming the counter moves at all.
    const ghost = await page.frames()[1].evaluate((k) => localStorage.getItem(k + '__nope__'), SAVE_KEY);
    check(`${label}: CONTROL — probe reports null for a key that does not exist`, ghost === null, String(ghost));

    // Real progress, made by real interaction, then a real reload.
    await frame.locator('#tab-play').evaluate((el) => { el.hidden = false; });
    await frame.locator('#tab-play').click();
    await page.waitForTimeout(600);
    await frame.locator('[data-tool="pet"]').click();
    await page.waitForTimeout(200);
    for (let i = 0; i < 3; i++) { await frame.locator('#stage .actor').first().click({ force: true }); await page.waitForTimeout(350); }
    await page.waitForTimeout(1200);

    const cares = (s) => (s?.creatures || []).reduce((n, c) => n + (c.cares || 0), 0);
    const read = () => page.frames()[1].evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, SAVE_KEY);
    const pre = cares(await read());
    check(`${label}: progress written before reload`, pre > 0, `cares=${pre}`);

    // Reload the IFRAME, not the host — this is the tab-close case itch cares about.
    await page.evaluate(() => { const f = document.getElementById('f'); f.src = f.src; });
    await page.waitForTimeout(3000);
    const post = cares(await read());
    check(`${label}: SAVE SURVIVES RELOAD`, post >= pre && post > 0, `cares ${pre} → ${post}`);

    // Secondary: does Save picture's download survive the sandbox?
    const dl = await page.frames()[1].evaluate(() => {
      try { const a = document.createElement('a'); a.download = 'x.png'; a.href = URL.createObjectURL(new Blob(['x'])); document.body.appendChild(a); a.click(); a.remove(); return 'click dispatched'; }
      catch (e) { return 'threw: ' + e.message.slice(0, 80); }
    });
    console.log(`    Save picture download path: ${dl} [browser may still block silently — UNVERIFIED against itch]`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  const bad = results.filter(r => !r.ok);
  console.log(bad.length ? `\nSTORAGE GATE FAILED — ${bad.length}/${results.length}` : `\nSTORAGE GATE PASSED — ${results.length}/${results.length}`);
  process.exit(bad.length ? 1 : 0);
}
main().catch(e => { console.error('harness error:', e); process.exit(2); });
