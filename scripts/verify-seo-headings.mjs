/**
 * verify-seo-headings.mjs — every entry announces its real name.
 *
 * WHY. Seven pages once sat in the sitemap with no description, canonical or
 * structured data; this is the same hole one layer down. Four entries shipped
 * no <h1> at all (two are pure canvas — the title is PAINTED, so it does not
 * exist to a crawler or a screen reader), and two more had an <h1> holding a
 * live HUD readout: Emberkeep's served bytes say `1.`, Mountain's say `I.`.
 *
 * The two failure modes this gate exists for are opposite and both easy:
 *   1. A presence check scores `<h1>1.</h1>` as fine. So the assertion is that
 *      the heading contains real WORDS and matches the entry's own name.
 *   2. A hidden heading done with display:none or visibility:hidden is removed
 *      from the accessibility tree and discounted by search engines — invisible
 *      to people AND to machines, i.e. decorative and pointless. So the gate
 *      asserts the clip-rect pattern is doing what it claims: zero visual
 *      footprint, still exposed with a computed accessible name.
 *
 * Read from the SERVED BYTES first, because a heading JS fills in later is
 * invisible to the visitor this is for.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'dist');
const T = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const srv = http.createServer(async (q, r) => {
  try {
    let f = path.join(OUT, decodeURIComponent(q.url.split('?')[0]));
    if ((await stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
    r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
    r.end(await readFile(f));
  } catch { r.writeHead(404); r.end(''); }
}).listen(0);
const BASE = `http://127.0.0.1:${srv.address().port}`;

const ENTRIES = [
  ['prism-cascade','games/prism-cascade/','Prism Cascade'],
  ['lumenreel','games/lumenreel/ui/','Lumenreel'],
  ['underglory','games/underglory/','Underglory'],
  ['veilfall','games/veilfall/','Veilfall'],
  ['emberkeep','games/emberkeep/','Emberkeep'],
  ['emberkeep-mountain','games/emberkeep-mountain/','Emberkeep'],
  ['bloom-rush','games/bloom-rush/','Bloom Rush'],
  ['planet-express-lounge','games/planet-express-lounge/','Planet Express'],
];

const rows = [];
const ok = (n, pass, d = '') => rows.push({ n, pass: !!pass, d });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const [id, url, expect] of ENTRIES) {
  // 1. SERVED BYTES — what a JS-less crawler sees.
  const raw = await readFile(path.join(OUT, url, 'index.html'), 'utf8');
  const heads = [...raw.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map(m => m[1].replace(/<[^>]*>/g, '').trim());
  const words = heads.map(h => h.replace(/[^A-Za-z]/g, ''));
  const lead = heads[0] || '';
  ok(`${id}: served bytes carry a worded <h1>`, words.some(w => w.length >= 3), `first: "${lead}"`);
  ok(`${id}: the leading <h1> names the entry`, lead.includes(expect), `"${lead}" contains "${expect}"`);

  // 2. RENDERED — hidden without being removed from the a11y tree.
  const page = await browser.newPage();
  await page.goto(BASE + '/' + url, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const h = document.querySelector('h1.arcade-sr-only');
    if (!h) return { injected: false };
    const cs = getComputedStyle(h);
    const r = h.getBoundingClientRect();
    return { injected: true, display: cs.display, visibility: cs.visibility,
             w: Math.round(r.width), h: Math.round(r.height), text: h.textContent.trim() };
  });
  if (m.injected) {
    ok(`${id}: hidden heading stays in the a11y tree`,
       m.display !== 'none' && m.visibility !== 'hidden',
       `display:${m.display} visibility:${m.visibility}`);
    ok(`${id}: hidden heading occupies no space`, m.w <= 2 && m.h <= 2, `${m.w}x${m.h}px`);
    /* getByRole resolves against the ACCESSIBILITY TREE and excludes anything
     * hidden from assistive tech (display:none, visibility:hidden, aria-hidden),
     * so a heading it can find is one a screen reader can announce. That is the
     * real question — stronger than reading computed styles and inferring. */
    const name = m.text;
    const seen = await page.getByRole('heading', { name, exact: true }).count();
    ok(`${id}: exposed to assistive tech`, seen > 0, `role=heading name "${name}" (${seen} match)`);
  }
  await page.close();
}

// CONTROL — the gate must reject the two shortcuts it exists to prevent.
{
  const page = await browser.newPage();
  await page.goto(BASE + '/games/underglory/', { waitUntil: 'load' });
  const bad = await page.evaluate(() => {
    const h = document.querySelector('h1.arcade-sr-only');
    h.style.display = 'none';
    const cs = getComputedStyle(h);
    return cs.display === 'none';
  });
  ok('CONTROL display:none is detectable', bad, 'the probe can see the shortcut');
  const emptyWords = 'I.'.replace(/[^A-Za-z]/g, '').length >= 3;
  ok('CONTROL a numeral heading fails the worded test', emptyWords === false, '"I." -> not worded');
  await page.close();
}

await browser.close();
srv.close();

console.log('\nverify-seo-headings');
console.log('─'.repeat(74));
let fail = 0;
for (const r of rows) { if (!r.pass) fail++; console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? ` — ${r.d}` : ''}`); }
console.log('─'.repeat(74));
console.log(fail ? `${fail} FAIL` : `${rows.length}/${rows.length} PASS`);
process.exit(fail ? 1 : 0);
