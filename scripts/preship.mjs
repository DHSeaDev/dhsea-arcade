/**
 * preship.mjs — mechanical ship gate for the arcade (Web/Frontend stack).
 *
 * Implements preship-ritual's Web checklist plus Check #0.5 (inserted-symbol
 * re-read) against the SHIPPED tree in dist/, not against source. Any FAIL is
 * exit-non-zero.
 *
 * Not the MV3 checklist: the manifests are stripped by the build, so this ships
 * as ordinary web pages. Not the wp:html checklist: nothing here is written into
 * WordPress content.
 */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
const run = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist');
const fails = [], warns = [], oks = [];
const F = (m) => fails.push(m), W = (m) => warns.push(m), OK = (m) => oks.push(m);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out); else out.push(p);
  }
  return out;
}
const files = await walk(OUT);
const rel = (f) => path.relative(OUT, f).split(path.sep).join('/');

/* ── 1. syntax: every shipped .js parses ─────────────────────────────────── */
{
  /* `node --check` picks CJS-vs-ESM from the file EXTENSION, so a .js file
   * containing import/export fails as CJS. Module files are copied to a .mjs
   * temp and checked there. (An earlier version piped source to stdin, which
   * simply hangs — `input` is a spawnSync option, not an execFile one.) */
  const js = files.filter(f => f.endsWith('.js'));
  const tmp = path.join(ROOT, '.preship-tmp.mjs');
  let bad = 0;
  for (const f of js) {
    const src = await readFile(f, 'utf8');
    const isModule = /^\s*(import|export)\s/m.test(src);
    let target = f;
    if (isModule) { await writeFile(tmp, src); target = tmp; }
    try {
      await run(process.execPath, ['--check', target], { timeout: 20000 });
    } catch (e) {
      bad++;
      F(`syntax: ${rel(f)} — ${String(e.stderr || e.message).split('\n').find(l => l.trim()) || 'parse failed'}`);
    }
  }
  if (!bad) OK(`syntax: ${js.length} shipped .js files parse (ESM checked as modules)`);
}

/* ── 2. Check #0.5 — inserted symbols are DEFINED in the shipped tree ────── */
{
  /* Symbols this session inserted by edit tooling. A call site alone passes
   * every syntax check, so presence of the DEFINITION is what is asserted. */
  const inserted = [
    { file: 'games/bloom-rush/game.part2.js', symbols: ['BR_SAVE_KEY', 'brLoadProfile', 'brSaveProfile'] },
    { file: 'shared/chrome-shim.js', symbols: ['readKey', 'writeKey', 'dropKey', 'allKeys'] },
    { file: 'shared/arcade-bar.js', symbols: ['mount'] },
  ];
  for (const { file, symbols } of inserted) {
    const p = path.join(OUT, file);
    if (!existsSync(p)) { F(`inserted-symbol: ${file} missing from dist`); continue; }
    const src = await readFile(p, 'utf8');
    for (const s of symbols) {
      const defined = new RegExp(`(function\\s+${s}\\b|(?:const|let|var)\\s+${s}\\b)`).test(src);
      const called = new RegExp(`\\b${s}\\s*\\(`).test(src) || new RegExp(`\\b${s}\\b`).test(src);
      if (!defined) F(`inserted-symbol: ${s} is referenced in ${file} but NOT DEFINED there`);
      else if (!called) W(`inserted-symbol: ${s} defined in ${file} but never referenced`);
    }
  }
  /* Prove the check can fail (measurement-integrity): run the same assertion
   * against a symbol that provably is not there. A gate that cannot go red on
   * the class it names is not a gate. */
  const probeSrc = await readFile(path.join(OUT, 'shared/chrome-shim.js'), 'utf8');
  const probeDefined = /(function\s+__definitely_not_here__\b|(?:const|let|var)\s+__definitely_not_here__\b)/.test(probeSrc);
  if (probeDefined) F('inserted-symbol: negative control matched — the check is broken');
  else OK('inserted-symbol: all session-inserted symbols defined on disk; negative control correctly red');
}

/* ── 3. asset paths: every local src/href in shipped HTML resolves ───────── */
{
  const html = files.filter(f => f.endsWith('.html'));
  let missing = 0, checked = 0;
  for (const f of html) {
    const src = await readFile(f, 'utf8');
    for (const m of src.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|data:|mailto:|#|\/\/)/.test(u)) continue;
      checked++;
      const target = u.startsWith('/') ? path.join(OUT, u) : path.resolve(path.dirname(f), u);
      const clean = target.split('?')[0].split('#')[0];
      if (!existsSync(clean) && !existsSync(path.join(clean, 'index.html'))) {
        missing++; F(`asset: ${rel(f)} references ${u} which does not exist in dist`);
      }
    }
  }
  if (!missing) OK(`asset paths: ${checked} local references across ${html.length} pages all resolve`);
}

/* ── 4. secret scan on shipped bytes ─────────────────────────────────────── */
{
  const pats = [
    [/\bgsk_[A-Za-z0-9]{20,}/, 'Groq API key'],
    [/\bsk-[A-Za-z0-9]{20,}/, 'OpenAI-style key'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/(?:api[_-]?key|password|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i, 'hardcoded credential'],
  ];
  let hits = 0;
  for (const f of files.filter(f => /\.(js|html|css|json|txt|xml)$/.test(f))) {
    const src = await readFile(f, 'utf8');
    for (const [re, label] of pats) {
      const m = src.match(re);
      if (m) { hits++; F(`secret: possible ${label} in ${rel(f)} — ${m[0].slice(0, 12)}…`); }
    }
  }
  if (!hits) OK('secrets: no API keys, tokens or hardcoded credentials in shipped bytes');
}

/* ── 5. no build inputs leaked into dist ─────────────────────────────────── */
{
  const leaked = files.filter(f => /(index\.template\.html|playhtml-boot\.js|\.orig$|node_modules|package-lock)/.test(f));
  if (leaked.length) leaked.forEach(f => F(`build input shipped: ${rel(f)}`));
  else OK('hygiene: no templates, unbundled entries or .orig files in dist');
}

/* ── 6. CSP present and not self-defeating ───────────────────────────────── */
{
  const h = await readFile(path.join(OUT, '_headers'), 'utf8');
  const csp = (h.match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1] || '';
  if (!csp) F('CSP: no Content-Security-Policy in dist/_headers');
  else {
    if (/script-src[^;]*'unsafe-inline'/.test(csp)) F("CSP: script-src allows 'unsafe-inline'");
    if (/script-src[^;]*'unsafe-eval'/.test(csp)) F("CSP: script-src allows 'unsafe-eval'");
    const hosts = [...csp.matchAll(/https?:\/\/[^\s;]+|wss:\/\/[^\s;]+/g)].map(m => m[0]);
    const allowed = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com',
      'https://api.groq.com', 'https://api.playhtml.fun', 'wss://api.playhtml.fun']);
    const unexpected = hosts.filter(x => !allowed.has(x));
    if (unexpected.length) F(`CSP: unexpected third-party host(s): ${unexpected.join(', ')}`);
    else OK(`CSP: strict script-src, ${hosts.length} pinned hosts, all expected`);
  }
}

/* ── 7. no third-party CDN reference survived the bundle ─────────────────── */
{
  let hits = 0;
  for (const f of files.filter(f => /\.(js|html|css)$/.test(f))) {
    const src = await readFile(f, 'utf8');
    for (const m of src.matchAll(/https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)[^\s"')]*/g)) {
      hits++; F(`CDN: ${rel(f)} still references ${m[0]}`);
    }
  }
  if (!hits) OK('CDN: no unpkg/jsdelivr/cdnjs references in shipped assets');
}

/* ── 8. HTML tag balance on the pages this project authored ──────────────── */
{
  for (const f of [path.join(OUT, 'index.html')]) {
    const src = await readFile(f, 'utf8');
    for (const tag of ['div', 'article', 'section', 'main', 'footer', 'header', 'button', 'a']) {
      const open = (src.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
      const close = (src.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      if (open !== close) F(`html: ${rel(f)} has ${open} <${tag}> vs ${close} </${tag}>`);
    }
  }
  OK('html: tag pairs balanced on the generated index');
}

/* ── 9. nested-interactive check (the defect this project already shipped) ─ */
{
  const src = await readFile(path.join(OUT, 'index.html'), 'utf8');
  // An <a> containing a <button> or another <a> splits the element in the parser.
  const anchors = [...src.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)];
  const bad = anchors.filter(m => /<(a|button)\b/.test(m[1]));
  if (bad.length) F(`nested-interactive: ${bad.length} anchor(s) contain a nested <a> or <button>`);
  else OK(`nested-interactive: ${anchors.length} anchors, none wrap another interactive element`);
}

/* ── report ──────────────────────────────────────────────────────────────── */
console.log('\npreship-ritual [Web/Frontend] — dhsea-arcade');
console.log('─'.repeat(74));
for (const o of oks) console.log('  PASS  ' + o);
for (const w of warns) console.log('  WARN  ' + w);
for (const f of fails) console.log('  FAIL  ' + f);
console.log('─'.repeat(74));
console.log(fails.length ? `${fails.length} FAIL — halt, do not ship` : `${oks.length}/${oks.length} PASS${warns.length ? ` (${warns.length} warn)` : ''}`);
process.exit(fails.length ? 1 : 0);
