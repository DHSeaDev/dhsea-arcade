#!/usr/bin/env node
// Emit target #3: one self-contained index.html for itch.io.
// Lives at the repo root's scripts/, not inside src-games/creature-camp/.
// scripts/build.mjs copies a game's whole folder into dist/, so gate scripts
// parked beside the game were published to play.dhseadev.online (44 KB of .mjs
// on the CDN) and dist-itch/ landed in the arcade's sitemap. Found by
// scripts/preship.mjs, 2026-09-19, and confirmed by a control: removing
// dist-itch/ took preship from 4 FAIL to 11/11 PASS.
//
// Shares the source tree with the extension and the arcade build — nothing is
// forked. scripts/build.mjs (arcade) is not touched by this file.
//
// The itch surface has no server, no module host and (inside the embed iframe)
// no guarantee of localStorage. Everything this file emits must therefore be
// inline: zero external src/href, zero @import, zero network.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src-games', 'creature-camp');
const UI = resolve(ROOT, 'ui');
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist-itch');

// Sabotage switch for scripts/gate-fixtures.mjs: setting this to 0 disables the
// </script escape so the scriptClose gate can be watched going red end-to-end.
const ESCAPE_CLOSERS = process.env.CC_NO_ESCAPE !== '1';

// --- gates -----------------------------------------------------------------
// Each one refuses to emit. Each one is proven able to fail by
// scripts/gate-fixtures.mjs before any of its CLEANs are trusted.
export const GATES = {
  // Exactly ONE </script closer may exist in the emitted document: ours.
  // A literal </script> surviving inside the bundled JS closes the host
  // <script> element early — the classic single-file killer. Gating the RAW
  // bundle is useless (esbuild already escapes string literals, and we escape
  // again), so this gates the FINAL document, where a failed escape shows up.
  scriptClose: (html) => {
    const n = (html.match(/<\/script/gi) || []).length;
    return n === 1 ? null
      : `emitted document has ${n} </script closers, expected exactly 1`;
  },

  evalUse: (js) => {
    const m = js.match(/(?<![.\w$])eval\s*\(|new\s+Function\s*\(/);
    return m ? `bundled JS uses ${m[0].trim()}` : null;
  },

  // Any attribute pulling bytes from outside the file.
  externalRef: (html) => {
    const bad = [];
    const attr = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    for (const m of html.matchAll(attr)) {
      const v = m[1].trim();
      if (v.startsWith('#') || v.startsWith('data:')) continue;
      bad.push(v);
    }
    return bad.length ? `external src/href: ${bad.join(', ')}` : null;
  },

  cssImport: (css) => /@import\b/i.test(css) ? 'CSS contains @import' : null,

  // An inline on*= handler is not a crash on itch, but it is the CSP-hostile
  // shape the source deliberately avoids; catching a regression is free.
  inlineHandler: (html) => /<[^>]+\son[a-z]+\s*=/i.test(html)
    ? 'inline on*= handler in markup' : null,
};

export function runGates({ html, js, css }) {
  const fails = [];
  const push = (name, r) => { if (r) fails.push(`${name}: ${r}`); };
  push('scriptClose', GATES.scriptClose(html));
  push('evalUse', GATES.evalUse(js));
  push('externalRef', GATES.externalRef(html));
  push('cssImport', GATES.cssImport(css));
  push('inlineHandler', GATES.inlineHandler(html));
  return fails;
}

// --- emit ------------------------------------------------------------------
// The repo is checked out with CRLF on Windows and LF on Linux. The CSS and the
// shell are inlined VERBATIM, so without this the emitted file's bytes — and its
// hash — depend on whose machine ran the build. Normalise once, here, so the
// artifact is reproducible across checkouts.
const lf = (s) => s.replace(/\r\n/g, '\n');

export async function emit({ write = true } = {}) {
  const shell = lf(await readFile(resolve(UI, 'sidepanel.html'), 'utf8'));
  const css = [
    lf(await readFile(resolve(UI, 'sidepanel.css'), 'utf8')),
    lf(await readFile(resolve(UI, 'creatures.css'), 'utf8')),
  ].join('\n\n/* --- creatures.css --- */\n\n');

  const bundled = await build({
    entryPoints: [resolve(UI, 'app.js')],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    minify: true,
    legalComments: 'none',
    write: false,
  });
  const js = bundled.outputFiles[0].text;

  // Strip the three external references the shell declares, splice in their
  // contents. Done by targeted replace, never by re-emitting the document.
  let html = shell
    .replace(/[ \t]*<link rel="stylesheet" href="sidepanel\.css">\r?\n/, '')
    // A FUNCTION replacer, never a template string: String.replace expands
    // $&, $`, $' and $1 inside a replacement STRING, so any such sequence in
    // the payload rewrites itself. This bit us for real on the script splice
    // below — `!A||$&$.pointerId` became `!A||</body>&$.pointerId` and the
    // whole bundle failed to parse. Same hazard, same fix, both sites.
    .replace(/[ \t]*<link rel="stylesheet" href="creatures\.css">\r?\n/,
      () => `  <style>\n${css}\n  </style>\n`)
    .replace(/[ \t]*<script type="module" src="app\.js"><\/script>\r?\n/, '');

  // Assert the TAGS are gone, not the strings: sidepanel.css's own header
  // comment mentions app.js, so a substring check fails on spliced-in CSS that
  // is perfectly correct. (Caught by this guard on first run, 2026-09-19.)
  for (const re of [/<link\b[^>]*\bhref=/i, /<script\b[^>]*\bsrc=/i]) {
    if (re.test(html)) throw new Error(`shell splice failed — ${re} still matches`);
  }

  // The bundle goes LAST, after </body>'s content, as a classic script: an IIFE
  // needs no module scope and this keeps the DOM parsed before it runs.
  const guarded = ESCAPE_CLOSERS ? js.replace(/<\/script/gi, '<\\/script') : js;
  html = html.replace(/<\/body>/, () => `  <script>\n${guarded}\n  </script>\n</body>`);

  // Structural invariant: what is between our <script> tags must be byte-identical
  // to what we meant to inline. This is the gate that would have caught the $&
  // expansion above on the first run instead of the browser catching it.
  const open = html.indexOf('<script>') + '<script>'.length;
  const close = html.indexOf('</script>');
  if (html.slice(open, close).trim() !== guarded.trim())
    throw new Error('splice corruption — inlined script body differs from the bundle');

  const fails = runGates({ html, js: guarded, css });
  if (fails.length) {
    throw new Error('REFUSING TO EMIT — gate failures:\n  ' + fails.join('\n  '));
  }

  if (write) {
    await mkdir(OUT, { recursive: true });
    await writeFile(resolve(OUT, 'index.html'), html, 'utf8');
  }
  return { html, js: guarded, css, bytes: Buffer.byteLength(html) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await emit();
  console.log(`dist-itch/index.html  ${r.bytes.toLocaleString()} B  (js ${Buffer.byteLength(r.js).toLocaleString()} B, css ${Buffer.byteLength(r.css).toLocaleString()} B)`);
}
