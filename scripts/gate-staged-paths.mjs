#!/usr/bin/env node
// Refuses the commit if anything outside the allowlist is staged.
// Lives at the repo root's scripts/, not inside src-games/creature-camp/.
// scripts/build.mjs copies a game's whole folder into dist/, so gate scripts
// parked beside the game were published to play.dhseadev.online (44 KB of .mjs
// on the CDN) and dist-itch/ landed in the arcade's sitemap. Found by
// scripts/preship.mjs, 2026-09-19, and confirmed by a control: removing
// dist-itch/ took preship from 4 FAIL to 11/11 PASS.
//
// This repo is public and its own .gitignore records that one `git add -A`
// would have published prismwar-owner-keys.zip and every unredeemed code. The
// push script stages named paths only; this asserts that nothing else rode along.
import { execFileSync } from 'node:child_process';

const ALLOW = new Set([
  '.gitignore',
  'src-games/creature-camp/ui/app.js',
  'scripts/build-itch.mjs',
  'scripts/gate-fixtures.mjs',
  'scripts/gate-browser.mjs',
  'scripts/gate-storage.mjs',
  'scripts/gate-a11y.mjs',
  'scripts/gate-source-guard.mjs',
  'scripts/gate-staged-paths.mjs',
]);

const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' })
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);

if (!staged.length) {
  console.log('FAIL  nothing is staged — the change may already be committed.');
  process.exit(1);
}
const bad = staged.filter(p => !ALLOW.has(p));
for (const p of staged) console.log(`      staged: ${p}${ALLOW.has(p) ? '' : '   <-- NOT ALLOWLISTED'}`);
if (bad.length) {
  console.log(`\nSTAGED-PATH GATE FAILED — ${bad.length} path(s) outside the allowlist. Run: git reset`);
  process.exit(1);
}
// CONTROL: the allowlist must be able to reject something.
if (ALLOW.has('definitely/not/a/real/path.txt')) { console.log('\nCONTROL FAILED — the allowlist accepts anything'); process.exit(1); }
console.log(`\nSTAGED-PATH GATE PASSED — ${staged.length} path(s), all allowlisted`);
