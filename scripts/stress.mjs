/**
 * stress.mjs — test-env [web] stress battery across every arcade entry.
 *
 * SHARDING (sandbox-shard, test-shard mode). Nine targets: the index plus eight
 * entries. Independence test:
 *   1. no two shards write the same file       — read-only, N/A
 *   2. no shard depends on another's output    — PASS
 *   3. each shard is a complete sub-plan       — PASS, same battery per page
 *   4. one shard failing does not invalidate others — PASS
 *   5. host headroom for N concurrent          — FAIL at 9. Every shard drives a
 *      Chromium context; nine at once on this container is the exact contention
 *      that masquerades as a shard bug. CONCURRENCY is capped at 3.
 * The origin's localStorage IS shared state across entries, which would break
 * check 1 — so every shard gets its OWN BROWSER CONTEXT, which is what actually
 * makes them independent rather than the assertion that they are.
 *
 * Served under the PRODUCTION CSP parsed from public/_headers, so a policy that
 * breaks a page fails here rather than after deploy.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'dist');
const CSP = ((await readFile(path.join(OUT, '_headers'), 'utf8'))
  .match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1] || '';
if (!CSP) { console.error('no CSP in dist/_headers'); process.exit(1); }

const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json',
  '.txt':'text/plain', '.xml':'application/xml', '.webmanifest':'application/manifest+json' };

let served = 0;
const srv = http.createServer(async (q, r) => {
  const url = decodeURIComponent(q.url.split('?')[0]);
  try {
    let f = path.join(OUT, url);
    if ((await stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
    const body = await readFile(f);
    served++;
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream',
                       'Content-Security-Policy': CSP });
    r.end(body);
  } catch { r.writeHead(404); r.end('404'); }
}).listen(0);
const PORT = srv.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

const PAGES = [
  ['index', '/'],
  ['prism-cascade', '/games/prism-cascade/'],
  ['lumenreel', '/games/lumenreel/ui/'],
  ['underglory', '/games/underglory/'],
  ['veilfall', '/games/veilfall/'],
  ['emberkeep', '/games/emberkeep/'],
  ['emberkeep-mountain', '/games/emberkeep-mountain/'],
  ['bloom-rush', '/games/bloom-rush/'],
  ['planet-express-lounge', '/games/planet-express-lounge/'],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const findings = [];      // {page, level:'BLOCK'|'WARN'|'PASS', msg}
const add = (page, level, msg) => findings.push({ page, level, msg });

/** One shard. Own context, own storage partition. */
async function shard([id, url]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [], csp = [], ext = [], notFound = [];

  page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  page.on('console', m => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) csp.push(t.slice(0, 160));
    else if (m.type() !== 'error') { /* not an error */ }
    else if (/Failed to load resource/.test(t)) { /* paired with requestfailed */ }
    /* The requestfailed path already routes third-party hosts to `ext` as
       environmental. The CONSOLE path did not, so an external WebSocket failing
       in a sandbox with no egress was reported as a same-origin runtime error —
       intermittently, depending on timing, which is the worst kind of false
       BLOCK. Apply the same rule to both paths. */
    else if (/\b(?:https|wss):\/\/(?!127\.0\.0\.1|localhost)/.test(t)) ext.push(t.slice(0, 120));
    else errs.push(t.slice(0, 160));
  });
  page.on('requestfailed', r => {
    const u = r.url();
    const why = r.failure()?.errorText || '';
    /* ERR_ABORTED on our own origin is almost always the reload storm below
       cancelling an in-flight request — verified by re-running the same pages
       with no reloads, where it never appears. Counting it was a harness bug
       that reported 4 pages as broken. */
    if (u.startsWith(BASE) && /ERR_ABORTED/.test(why)) return;
    (u.startsWith(BASE) ? errs : ext).push(u.replace(BASE, '') + ' ' + why);
  });
  page.on('response', r => { if (r.status() === 404 && r.url().startsWith(BASE)) notFound.push(r.url().replace(BASE, '')); });

  try {
    await page.goto(BASE + url, { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);

    // ── 1. LINK INTEGRITY ────────────────────────────────────────────────────
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({
      href: a.getAttribute('href'), abs: a.href, target: a.target,
      rel: a.rel, text: (a.textContent || '').trim().slice(0, 40),
      name: a.textContent?.trim() || a.getAttribute('aria-label') || '',
    })));
    for (const l of links) {
      if (/^(mailto:|tel:|javascript:|#)/.test(l.href)) continue;
      if (l.abs.startsWith(BASE)) {
        const res = await page.request.get(l.abs).catch(() => null);
        if (!res) add(id, 'BLOCK', `internal link unreachable: ${l.href}`);
        else if (res.status() >= 400) add(id, 'BLOCK', `internal link ${res.status()}: ${l.href}`);
      } else if (l.target === '_blank' && !/noopener/.test(l.rel)) {
        // test-env §Web: target=_blank without noopener hands the opener to a third party
        add(id, 'BLOCK', `target=_blank missing rel=noopener: ${l.href}`);
      }
      if (!l.name) add(id, 'WARN', `link with no accessible name: ${l.href}`);
    }

    // ── 2. test-env §Web static checks ───────────────────────────────────────
    const web = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')];
      const btns = [...document.querySelectorAll('button')];
      const named = (e) => (e.textContent || '').trim() || e.getAttribute('aria-label') ||
        e.getAttribute('title') || e.querySelector('img[alt]')?.alt || '';
      return {
        lang: document.documentElement.lang || '',
        charset: !!document.querySelector('meta[charset]'),
        viewport: !!document.querySelector('meta[name=viewport]'),
        title: (document.title || '').length,
        imgsNoAlt: imgs.filter(i => !i.hasAttribute('alt')).length,
        imgsNoDims: imgs.filter(i => !(i.getAttribute('width') && i.getAttribute('height'))).length,
        btnsNoName: btns.filter(b => !named(b)).length,
        deprecated: ['center','font','marquee','blink','big'].filter(t => document.querySelector(t)).length,
        inlineHandlers: document.querySelectorAll('[onclick],[onload],[onerror]').length,
        h1: document.querySelectorAll('h1').length,
      };
    });
    if (!web.lang) add(id, 'BLOCK', 'no <html lang> — screen readers pick the wrong voice');
    if (!web.charset) add(id, 'BLOCK', 'no <meta charset>');
    if (!web.viewport) add(id, 'WARN', 'no <meta viewport> — mobile renders at desktop width');
    if (!web.title) add(id, 'BLOCK', 'empty <title>');
    if (web.imgsNoAlt) add(id, 'BLOCK', `${web.imgsNoAlt} <img> without alt`);
    if (web.imgsNoDims) add(id, 'WARN', `${web.imgsNoDims} <img> without width/height (CLS)`);
    if (web.btnsNoName) add(id, 'BLOCK', `${web.btnsNoName} button(s) with no accessible name`);
    if (web.deprecated) add(id, 'WARN', `${web.deprecated} deprecated tag type(s)`);
    if (web.inlineHandlers) add(id, 'BLOCK', `${web.inlineHandlers} inline event handler(s) — CSP script-src 'self' forbids these`);
    if (web.h1 === 0) add(id, 'WARN', 'no <h1>');
    if (web.h1 > 1) add(id, 'WARN', `${web.h1} <h1> elements`);

    /* ── 3. KEYBOARD REACHABILITY ─────────────────────────────────────────
     * NO CLICK before this. An earlier version clicked the page first "like a
     * real user" and thereby set the sequential-focus starting point to the
     * clicked element, so Tab traversed FORWARD FROM THERE — past the bar —
     * and Shift+Tab reached it. That made a working page look broken and a
     * broken one look reachable. The starting point is part of the state under
     * test; do not perturb it. */
    const focusOnLoad = await page.evaluate(() => {
      const a = document.activeElement;
      return { isBody: a === document.body, tag: a.tagName, tabIndex: a.tabIndex };
    });
    await page.keyboard.press('Tab');
    const firstStop = await page.evaluate(() => {
      const a = document.activeElement;
      return a === document.body ? 'BODY'
        : (a.textContent || a.getAttribute('aria-label') || a.tagName).trim().slice(0, 30);
    });
    if (id !== 'index' && !/arcade/i.test(firstStop)) {
      /* A game that focuses its OWN control on load (Bloom Rush focuses a
       * canvas with tabindex="0", deliberately, for keyboard play) is a
       * different situation from one where nothing has focus. From the last
       * focusable element, Tab legitimately leaves the document for browser
       * chrome — and Playwright cannot follow it there, so "focus did not move"
       * is the harness's ceiling, not proof the exit is unreachable. Reported as
       * a bounded UNVERIFIED rather than a defect the evidence does not support. */
      if (!focusOnLoad.isBody && focusOnLoad.tabIndex >= 0) {
        add(id, 'WARN', `[UNVERIFIED] page focuses its own ${focusOnLoad.tag.toLowerCase()} (tabindex ${focusOnLoad.tabIndex}) on load; Tab from the last stop exits to browser chrome, which this harness cannot follow — exit reachability needs a human`);
      } else {
        add(id, 'BLOCK', `first Tab does not reach the arcade exit (landed on "${firstStop}") — a keyboard visitor cannot leave this game`);
      }
    } else if (id !== 'index') {
      add(id, 'PASS', 'first Tab reaches the arcade exit');
    }

    // ── 4. STORAGE STRESS ────────────────────────────────────────────────────
    if (id !== 'index') {
      // 4a. corrupt value in this entry's own namespace — must not break boot
      const nsKey = await page.evaluate(() => Object.keys(localStorage)[0] || null);
      if (nsKey) {
        await page.evaluate((k) => localStorage.setItem(k, '{{{not json'), nsKey);
        const reload1 = await page.reload({ waitUntil: 'load' }).then(() => true).catch(() => false);
        await page.waitForTimeout(1200);
        const alive = await page.evaluate(() => document.body.innerText.trim().length > 20 ||
          [...document.querySelectorAll('canvas')].some(c => c.width > 50));
        if (!reload1 || !alive) add(id, 'BLOCK', 'corrupt value in own namespace breaks boot');
        else add(id, 'PASS', 'survives corrupt own-namespace value');
      }

      // 4b. another entry's keys must not affect this one
      await page.evaluate(() => {
        localStorage.setItem('veilfall:save', '{"hp":999}');
        localStorage.setItem('bloom-rush:save', 'garbage');
        localStorage.setItem('unrelated-key', 'x');
      });
      const reload2 = await page.reload({ waitUntil: 'load' }).then(() => true).catch(() => false);
      await page.waitForTimeout(1200);
      const alive2 = await page.evaluate(() => document.body.innerText.trim().length > 20 ||
        [...document.querySelectorAll('canvas')].some(c => c.width > 50));
      if (!reload2 || !alive2) add(id, 'BLOCK', "another entry's localStorage keys break this page");
      else add(id, 'PASS', 'isolated from sibling namespaces');

      // 4c. private-mode: localStorage throws on ACCESS, not just on write
      const priv = await ctx.newPage();
      await priv.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          get() { throw new DOMException('denied', 'SecurityError'); },
        });
      });
      const privErrs = [];
      priv.on('pageerror', e => privErrs.push(e.message.slice(0, 120)));
      const ok = await priv.goto(BASE + url, { waitUntil: 'load', timeout: 20000 }).then(() => true).catch(() => false);
      await priv.waitForTimeout(1500);
      const privAlive = ok && await priv.evaluate(() => document.body.innerText.trim().length > 20 ||
        [...document.querySelectorAll('canvas')].some(c => c.width > 50)).catch(() => false);
      if (!privAlive) add(id, 'BLOCK', `page does not boot when localStorage throws: ${privErrs[0] || 'blank'}`);
      else add(id, 'PASS', 'boots with localStorage denied (private mode)');
      await priv.close();
    }

    // ── 5. RESIZE + RELOAD STORM ─────────────────────────────────────────────
    const stormErrs = [];
    page.on('pageerror', e => stormErrs.push(e.message.slice(0, 120)));
    for (const [w, h] of [[390, 844], [820, 900], [1600, 1000], [1280, 800]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(220);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      if (overflow) add(id, 'WARN', `horizontal overflow at ${w}px`);
    }
    for (let i = 0; i < 3; i++) await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1200);
    if (stormErrs.length) add(id, 'BLOCK', `error during resize/reload storm: ${stormErrs[0]}`);

    // ── 6. PEL-specific: tab-switch storm must hold the single-active invariant
    if (id === 'planet-express-lounge') {
      const inv = await page.evaluate(async () => {
        const tabs = [...document.querySelectorAll('.tab')];
        let worst = 0;
        for (let i = 0; i < 60; i++) {
          tabs[i % tabs.length].click();
          const active = document.querySelectorAll('.panel.active').length;
          if (active !== 1) worst = active;
        }
        await new Promise(r => setTimeout(r, 300));
        return { worst, finalActive: document.querySelectorAll('.panel.active').length,
                 selected: document.querySelectorAll('.tab[aria-selected="true"]').length };
      });
      if (inv.worst) add(id, 'BLOCK', `tab storm broke single-active-panel invariant (saw ${inv.worst} active)`);
      else add(id, 'PASS', '60-click tab storm holds single-active-panel');
      if (inv.selected !== 1) add(id, 'BLOCK', `${inv.selected} tabs aria-selected after storm`);
    }

    // ── 7. collected signals ─────────────────────────────────────────────────
    if (csp.length) add(id, 'BLOCK', `CSP violation: ${csp[0]}`);
    if (notFound.length) add(id, 'BLOCK', `404 on own origin: ${[...new Set(notFound)].slice(0, 3).join(', ')}`);
    const realErrs = errs.filter(e => !/fonts\.g(oogle|static)apis/.test(e));
    if (realErrs.length) add(id, 'BLOCK', `runtime error: ${realErrs[0]}`);
    if (ext.length) add(id, 'WARN', `[environmental] ${new Set(ext.map(e => (e.match(/https?:\/\/[^/]+/) || [''])[0])).size} external host(s) unreachable — sandbox has no egress`);

  } catch (e) {
    add(id, 'BLOCK', `THREW: ${e.message.slice(0, 140)}`);
  }
  await ctx.close();
}

// Concurrency 3 — independence-test check 5.
const CONC = 3;
const queue = [...PAGES];
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) await shard(queue.shift());
}));

await browser.close();
srv.close();

// ── Aggregate (sandbox-shard §Test-Shard Result Aggregator) ─────────────────
const byPage = new Map();
for (const f of findings) {
  if (!byPage.has(f.page)) byPage.set(f.page, []);
  byPage.get(f.page).push(f);
}
const blocks = findings.filter(f => f.level === 'BLOCK');
const warns  = findings.filter(f => f.level === 'WARN');
const overall = blocks.length ? 'BLOCK' : warns.length ? 'WARN' : 'PASS';

console.log(`\n# Stress battery — ${PAGES.length} shards, concurrency ${CONC}, ${served} requests served`);
console.log(`Overall: ${overall}\n`);
if (blocks.length) {
  console.log('## BLOCK');
  for (const f of blocks) console.log(`  [${f.page}] ${f.msg}`);
}
if (warns.length) {
  console.log('\n## WARN');
  const seen = new Set();
  for (const f of warns) {
    const k = f.msg.replace(/\d+/g, 'N');
    if (seen.has(f.page + k)) continue;
    seen.add(f.page + k);
    console.log(`  [${f.page}] ${f.msg}`);
  }
}
console.log('\n## PASS (stress cases survived)');
for (const [p, fs] of byPage) {
  const ok = fs.filter(f => f.level === 'PASS').map(f => f.msg);
  if (ok.length) console.log(`  [${p}] ${ok.join(' · ')}`);
}
console.log(`\n${blocks.length} BLOCK · ${warns.length} WARN`);
process.exit(blocks.length ? 1 : 0);
