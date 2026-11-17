/**
 * verify-stats.mjs — the visit counter reaches every entry and cannot widen script execution.
 *
 * Static (dist/ + public/_headers), then real: every entry page and the index are loaded
 * under the PRODUCTION Content-Security-Policy with pixel.wp.com stubbed, and must fire exactly
 * one beacon for blog 255484707 / post 233 with no console error. Targets derive from ENTRIES.
 *   node scripts/verify-stats.mjs [--sabotage csp|tag|post|script]   (must exit non-zero)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ENTRIES, pathOf } from './entries.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist');
const sabotage = process.argv.includes('--sabotage') ? process.argv[process.argv.indexOf('--sabotage') + 1] : '';
const fails = [];
const hdrFile = await readFile(path.join(ROOT, 'public', '_headers'), 'utf8');
let CSP = (hdrFile.match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1] || '';
if (sabotage === 'csp') CSP = CSP.replace(' https://pixel.wp.com', '');
if (sabotage === 'script') CSP = CSP.replace("script-src 'self'", "script-src 'self' https://stats.wp.com");

const dir = (CSP.match(/(?:^|;\s*)([a-z-]+-src)\s+([^;]+)/g) || []).reduce((o, m) => { const [k, ...v] = m.replace(/^;\s*/, '').split(/\s+/); o[k] = v; return o; }, {});
if (JSON.stringify(dir['script-src']) !== '["\'self\'"]') fails.push("CSP script-src must stay exactly 'self', got " + JSON.stringify(dir['script-src']));
if (!(dir['img-src'] || []).includes('https://pixel.wp.com')) fails.push('CSP img-src lacks https://pixel.wp.com');
if ((dir['connect-src'] || []).some(h => /wp\.com/.test(h))) fails.push('connect-src must not name wp.com');

const pages = [{ name: 'index', url: '/', file: path.join(OUT, 'index.html') },
  ...ENTRIES.filter(e => !e.url).map(e => { const p = '/' + pathOf(e); return { name: e.id, url: p, file: path.join(OUT, p.replace(/^\//, ''), p.endsWith('.html') ? '' : 'index.html') }; })];
let nLinked = 0;
for (const pg of pages) {
  let html = ''; try { html = await readFile(pg.file.endsWith('.html') ? pg.file : path.join(pg.file, 'index.html'), 'utf8'); } catch { fails.push(`${pg.name}: page not built at ${pg.file}`); continue; }
  if (sabotage === 'tag') html = html.replace(/<script src="[^"]*shared\/stats\.js"[^>]*><\/script>/, '');
  if (!/<script src="[^"]*shared\/stats\.js" defer><\/script>/.test(html)) fails.push(`${pg.name}: stats.js tag missing`);
  if (/stats\.wp\.com/.test(html)) fails.push(`${pg.name}: third-party stats script referenced`);
  pg.html = html; nLinked++;
}
let js = await readFile(path.join(ROOT, 'shared', 'stats.js'), 'utf8');
if (sabotage === 'post') js = js.replace("post: '233'", "post: '1'");
if (!/blog: '255484707'/.test(js) || !/post: '233'/.test(js)) fails.push('stats.js blog/post constants wrong');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
const server = http.createServer(async (q, r) => {
  try {
    let u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(OUT, u);
    if (u.endsWith('/')) f = path.join(f, 'index.html');
    const body = u.endsWith('shared/stats.js') ? js : await readFile(f);
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Content-Security-Policy': CSP });
    r.end(body);
  } catch { r.writeHead(404); r.end(''); }
}).listen(8098);
const br = await chromium.launch(process.env.ARC_CHROME ? { executablePath: process.env.ARC_CHROME } : {});
try {
  for (const pg of pages) {
    const ctx = await br.newContext(); const beacons = []; const errs = [];
    await ctx.route(/^https:\/\/pixel\.wp\.com\/.*/, r => { beacons.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }); });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => /pixel\.wp\.com/.test(r.request().url()) ? r.fallback() : r.abort());
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|violates/.test(m.text())) errs.push(m.text().slice(0, 140)); });
    p.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 100)));
    await p.goto('http://localhost:8098' + pg.url, { waitUntil: 'load' }); await p.waitForTimeout(700);
    const ok = beacons.length === 1 && /[?&]post=233(&|$)/.test(beacons[0]) && /[?&]blog=255484707(&|$)/.test(beacons[0]);
    if (!ok) fails.push(`${pg.name}: expected exactly 1 beacon for blog 255484707 post 233, got ${beacons.length}`);
    if (errs.length) fails.push(`${pg.name}: CSP/page errors: ${errs.join(' | ')}`);
    await ctx.close();
  }
} finally { await br.close(); server.close(); }
console.log(`checked ${pages.length} pages (${ENTRIES.filter(e => !e.url).length} entries + index)`);
if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('CLEAN');
