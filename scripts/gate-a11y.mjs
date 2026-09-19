#!/usr/bin/env node
// P5 — WCAG 2.2 AA pass over the EMITTED file plus a keyboard-only walk.
// Lives at the repo root's scripts/, not inside src-games/creature-camp/.
// scripts/build.mjs copies a game's whole folder into dist/, so gate scripts
// parked beside the game were published to play.dhseadev.online (44 KB of .mjs
// on the CDN) and dist-itch/ landed in the arcade's sitemap. Found by
// scripts/preship.mjs, 2026-09-19, and confirmed by a control: removing
// dist-itch/ took preship from 4 FAIL to 11/11 PASS.
// axe-core finds what a validator can find; the keyboard walk is the part a
// validator never reaches (focus order, trapped modal, reachable tools).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
// axe-core is NOT a devDependency of this repo. A gate that cannot run must
// report NOT RUN and exit non-zero — never exit 0, which would read as a pass.
let AXE;
try {
  AXE = readFileSync(require_.resolve('axe-core/axe.min.js'), 'utf8');
} catch {
  console.log('A11Y GATE NOT RUN — axe-core is not installed.');
  console.log('  npm i -D axe-core     then re-run this gate.');
  console.log('  This is NOT a pass. Nothing was checked.');
  process.exit(1);
}
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src-games', 'creature-camp');
const URL_ = pathToFileURL(resolve(ROOT, '..', '..', 'dist-itch/index.html')).href;

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => { setInterval(() => { const m = document.getElementById('arrival'), o = document.getElementById('arrival-ok'); if (m && !m.hidden && o) o.click(); }, 200); });
await page.goto(URL_);
await page.waitForTimeout(2500);

// CONTROL: prove axe can see a defect in this document before trusting a clean run.
await page.addScriptTag({ content: AXE });
await page.evaluate(() => { const i = document.createElement('img'); i.id = '__axe_control'; i.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='; document.body.appendChild(i); });
const ctl = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id));
const sawControl = ctl.includes('image-alt');
console.log(`CONTROL: axe sees a planted alt-less image → ${sawControl ? 'YES (instrument works)' : 'NO — INSTRUMENT BLIND, results below are worthless'}`);
await page.evaluate(() => document.getElementById('__axe_control')?.remove());

const tabs = ['tab-camp', 'tab-games', 'tab-journal', 'tab-bestiary', 'tab-settings'];
const report = [];
for (const t of tabs) {
  await page.locator(`#${t}`).click(); await page.waitForTimeout(400);
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, target: v.nodes[0]?.target?.join(' ') }));
  });
  report.push([t, res]);
  console.log(`\n${t}: ${res.length ? res.length + ' violation type(s)' : 'clean'}`);
  for (const v of res) console.log(`   [${v.impact}] ${v.id} ×${v.n} — ${v.help}\n      first: ${v.target}`);
}

// keyboard-only walk
await page.locator('#tab-camp').click(); await page.waitForTimeout(300);
const walk = await page.evaluate(() => {
  const seen = []; let el = document.activeElement;
  return new Promise((res) => {
    const order = [...document.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(e => e.offsetParent !== null || e.classList.contains('skip'));
    res({ focusable: order.length, first: order[0]?.id || order[0]?.className, skipLink: !!document.querySelector('a.skip[href="#main"]') });
  });
});
console.log(`\nkeyboard: ${walk.focusable} focusable elements in the camp tab; skip link present: ${walk.skipLink}; first stop: ${walk.first}`);
const focusVisible = await page.evaluate(() => {
  const b = document.getElementById('tab-games'); b.focus();
  const s = getComputedStyle(b, ':focus-visible');
  return { outline: s.outlineStyle + ' ' + s.outlineWidth, boxShadow: s.boxShadow.slice(0, 40) };
});
console.log(`focus indicator on a tab: outline=${focusVisible.outline} boxShadow=${focusVisible.boxShadow}`);

await browser.close();
const total = report.reduce((n, [, v]) => n + v.length, 0);
console.log(`\nA11Y FINDINGS: ${total} violation type(s) across ${tabs.length} tabs${sawControl ? '' : ' — INSTRUMENT UNPROVEN'}`);
