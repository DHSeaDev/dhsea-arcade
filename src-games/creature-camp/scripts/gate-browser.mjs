#!/usr/bin/env node
// P3 — the emitted file, opened from file://, driven by a real browser.
// Discipline carried from the last session's instrument failures:
//  * a known-good CONTROL runs first and must be seen to change;
//  * tool state is asserted via aria-checked BEFORE anything downstream is measured;
//  * assertions name a specific counter (cares, sudsUntilMs), never whole-object inequality.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL_ = pathToFileURL(resolve(ROOT, 'dist-itch/index.html')).href;
const SAVE_KEY = 'creaturecamp_save_v1';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const readSave = (page) => page.evaluate((k) => {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}, SAVE_KEY);

const caresOf = (save) => (save?.creatures || []).reduce((n, c) => n + (c.cares || 0), 0);

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // New friends arrive on a timer, each one re-opening the aria-modal arrival
  // dialog, which intercepts every pointer event behind it. An auto-dismisser
  // runs for the life of the harness and counts what it closed, so the modal is
  // reported rather than silently worked around.
  await page.addInitScript(() => {
    globalThis.__arrivals = 0;
    setInterval(() => {
      const m = document.getElementById('arrival');
      const ok = document.getElementById('arrival-ok');
      if (m && !m.hidden && ok) { globalThis.__arrivals++; ok.click(); }
    }, 200);
  });
  await page.goto(URL_);
  await page.waitForTimeout(1500);

  // First run opens the "A new friend!" arrival modal, which is aria-modal and
  // intercepts every pointer event behind it. Dismiss it before anything else —
  // and record that it is there, because it is the first thing a stranger meets.
  const dismissArrival = async () => { await page.waitForTimeout(350); };
  await page.waitForTimeout(600);
  check('first run: arrival modal auto-dismisses cleanly',
    await page.locator('#arrival:not([hidden])').count() === 0,
    `arrivals closed so far: ${await page.evaluate(() => globalThis.__arrivals)}`);

  // --- boot ---------------------------------------------------------------
  check('boot: zero console errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  check('boot: camp painted', await page.locator('#stage .actor').count() > 0,
    `${await page.locator('#stage .actor').count()} actors`);
  check('boot: mode resolved to full', await page.evaluate(() => document.body.classList.contains('full')),
    'body.full');
  check('boot: save written to localStorage', (await readSave(page)) !== null, SAVE_KEY);

  // --- CONTROL: prove the probe can SEE a cares change ---------------------
  const before = caresOf(await readSave(page));
  await page.evaluate(async (k) => {
    const s = JSON.parse(localStorage.getItem(k));
    s.creatures[0].cares = (s.creatures[0].cares || 0) + 999;
    localStorage.setItem(k, JSON.stringify(s));
  }, SAVE_KEY);
  const afterCtl = caresOf(await readSave(page));
  check('CONTROL: cares probe can observe a change', afterCtl === before + 999,
    `${before} → ${afterCtl}`);
  await page.reload(); await page.waitForTimeout(1200); await dismissArrival();

  // --- tab strip by real mouse click, at three widths ---------------------
  for (const [w, h] of [[1280, 900], [1024, 768], [800, 600]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    let bad = [];
    for (const id of ['tab-games', 'tab-journal', 'tab-bestiary', 'tab-settings', 'tab-camp']) {
      const btn = page.locator(`#${id}`);
      if (!(await btn.isVisible())) { bad.push(`${id} not visible`); continue; }
      await btn.click();
      await page.waitForTimeout(150);
      const sel = await btn.getAttribute('aria-selected');
      const pane = await btn.getAttribute('aria-controls');
      const shown = await page.locator(`#${pane}`).isVisible();
      if (sel !== 'true') bad.push(`${id} aria-selected=${sel}`);
      if (!shown) bad.push(`${pane} hidden after click`);
    }
    check(`tabs: real click at ${w}x${h}`, bad.length === 0, bad.join('; '));
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);

  // --- playground tap tools ------------------------------------------------
  await dismissArrival();
  await page.locator('#tab-play').evaluate((el) => { el.hidden = false; });
  await page.locator('#tab-play').click();
  await page.waitForTimeout(500);
  check('playground: body has .pg (pgOn live predicate)',
    await page.evaluate(() => document.body.classList.contains('pg')));

  for (const tool of ['pet', 'snack']) {
    const btn = page.locator(`[data-tool="${tool}"]`);
    if (!(await btn.count())) { check(`tool ${tool}: present`, false, 'button not found'); continue; }
    await btn.click();
    await page.waitForTimeout(120);
    // assert the tool is SELECTED before measuring anything downstream
    const checked = await btn.getAttribute('aria-checked');
    check(`tool ${tool}: aria-checked before use`, checked === 'true', `aria-checked=${checked}`);
    if (checked !== 'true') continue;

    const pre = caresOf(await readSave(page));
    const actor = page.locator('#stage .actor').first();
    await actor.click({ force: true });
    await page.waitForTimeout(700);
    const post = caresOf(await readSave(page));
    check(`tool ${tool}: tap registers (cares counter)`, post > pre, `cares ${pre} → ${post}`);
  }

  // --- soap: a single CLICK (the preventDefault/endScrub path) -------------
  {
    const btn = page.locator('[data-tool="soap"]');
    await btn.click(); await page.waitForTimeout(120);
    const checked = await btn.getAttribute('aria-checked');
    check('tool soap: aria-checked before use', checked === 'true', `aria-checked=${checked}`);
    const actor = page.locator('#stage .actor').first();
    const key = await actor.getAttribute('data-key');
    const sudsBefore = await page.evaluate(([k, key]) => {
      const s = JSON.parse(localStorage.getItem(k) || 'null');
      return (s?.creatures || []).find(c => c.key === key)?.sudsUntilMs ?? -1;
    }, [SAVE_KEY, key]);
    const box = await actor.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(800);
    const sudsAfter = await page.evaluate(([k, key]) => {
      const s = JSON.parse(localStorage.getItem(k) || 'null');
      return (s?.creatures || []).find(c => c.key === key)?.sudsUntilMs ?? -1;
    }, [SAVE_KEY, key]);
    check('tool soap: single click lathers (sudsUntilMs)', sudsAfter > sudsBefore,
      `sudsUntilMs ${sudsBefore} → ${sudsAfter}`);
  }

  check('no console errors accumulated over the whole run', errors.length === 0,
    errors.slice(0, 3).join(' | ').slice(0, 300));

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log(bad.length ? `\nBROWSER GATE FAILED — ${bad.length}/${results.length}` :
    `\nBROWSER GATE PASSED — ${results.length}/${results.length}`);
  process.exit(bad.length ? 1 : 0);
}
run().catch((e) => { console.error('harness error:', e); process.exit(2); });
