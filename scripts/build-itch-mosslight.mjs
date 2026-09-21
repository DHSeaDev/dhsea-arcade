#!/usr/bin/env node
// Mosslight's itch.io emit target: one self-contained index.html.
//
// src-games/mosslight/ is the ONE source tree. The arcade serves it as-is
// (index.html + style.css + js/*.js, under script-src 'self'); this file inverts
// the three arcade-only differences to produce the single file itch needs:
//
//   1. the meta CSP        arcade 'self'           -> itch 'unsafe-inline'
//   2. the stylesheet      <link href=style.css>   -> <style>...</style>
//   3. the five scripts    <script src=js/X.js>    -> <script data-part=X>...</script>
//
// It lives at the repo root's scripts/, never inside src-games/mosslight/:
// scripts/build.mjs copies a game's whole folder into dist/, and a build script
// parked beside the game gets published on play.dhseadev.online (the 2026-09-19
// creature-camp incident, caught by preship.mjs).
//
// Why the CSP is NOT simply dropped for itch: connect-src 'none' is the claim
// the store listing makes ("the game cannot phone home"), and the meta tag is
// the only thing enforcing it inside itch's iframe.
//
// Equivalence proof, not a promise: before ui.js gained the storage adapter,
// this script's output was byte-identical to the shipped 0.3.0 single file
// (sha256 c73af6eb4c2832c8...). Re-run with --expect=<sha16> to hold that line.
import { runGates } from './build-itch.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC  = resolve(HERE, '..', 'src-games', 'mosslight');
const OUT  = resolve(HERE, '..', 'dist-itch', 'mosslight');
export const PARTS = ['data', 'engine', 'art', 'audio', 'ui'];

export const ARCADE_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export const ITCH_CSP   = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src 'none'; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'";

const once = (hay, needle, label) => {
  const n = hay.split(needle).length - 1;
  if (n !== 1) throw new Error(`${label}: expected exactly 1 occurrence, found ${n}`);
};

export async function emit({ write = true } = {}) {
  let html = await readFile(resolve(SRC, 'index.html'), 'utf8');
  const css = await readFile(resolve(SRC, 'style.css'), 'utf8');
  // A literal </style in a comment or content: string would close the inlined element early and
  // render the rest of the stylesheet as page text — and every gate below would still pass.
  if (/<\/style/i.test(css)) throw new Error('style.css contains </style');

  once(html, ARCADE_CSP, 'arcade CSP');
  once(html, '<link rel="stylesheet" href="style.css">', 'stylesheet link');
  html = html.replace(ARCADE_CSP, () => ITCH_CSP)
             .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + css + '</style>');

  const blocks = [];
  let js = '';
  for (const p of PARTS) {
    const tag = `<script src="js/${p}.js" data-part="${p}"></script>`;
    once(html, tag, `script tag for ${p}`);
    const code = await readFile(resolve(SRC, 'js', p + '.js'), 'utf8');
    if (/<\/script/i.test(code)) throw new Error(`${p}.js contains a closing script tag`);
    js += code + '\n';
    blocks.push([tag, '<script data-part="' + p + '">\n' + code + '\n</script>']);
  }
  // The five tags are adjacent lines; collapse them into one joined block so the
  // output has exactly the shape the original single-file build produced.
  const run = blocks.map(b => b[0]).join('\n');
  once(html, run, 'contiguous script run');
  html = html.replace(run, () => blocks.map(b => b[1]).join('\n'));

  // Shared gates from the creature-camp itch build, minus scriptClose: that one
  // asserts ONE </script closer, and this document carries one per part.
  const closers = (html.match(/<\/script/gi) || []).length;
  const fails = runGates({ html, js, css }).filter(f => !/<\/script closers/.test(f));
  if (closers !== PARTS.length) fails.push(`emitted document has ${closers} </script closers, expected ${PARTS.length}`);
  if (/\bsrc\s*=\s*["']js\//.test(html)) fails.push('an arcade script reference survived into the itch file');
  if (!html.includes("connect-src 'none'")) fails.push("connect-src 'none' missing — the listing's no-network claim would be unenforced");
  if (fails.length) throw new Error('REFUSING TO EMIT — gate failures:\n  ' + fails.join('\n  '));

  if (write) {
    await mkdir(OUT, { recursive: true });
    await writeFile(resolve(OUT, 'index.html'), html, 'utf8');
  }
  return { html, bytes: Buffer.byteLength(html), sha: createHash('sha256').update(html).digest('hex') };
}

// Compared as paths, not URL strings: a space or any percent-encoded character in the repo path made
// the string form silently skip main, exit 0 and leave a stale dist-itch file looking current.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const r = await emit();
  console.log(`dist-itch/mosslight/index.html  ${r.bytes.toLocaleString()} B  sha256 ${r.sha.slice(0, 16)}`);
  const want = (process.argv.find(a => a.startsWith('--expect=')) || '').slice(9);
  if (want && !r.sha.startsWith(want)) { console.error(`EXPECTED ${want} — output differs`); process.exit(1); }
}
