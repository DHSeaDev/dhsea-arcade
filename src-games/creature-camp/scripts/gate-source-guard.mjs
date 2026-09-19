#!/usr/bin/env node
// Pre-push source gate for the itch emit target.
//
// This lives in a .mjs file on purpose. The first version of these checks was
// PowerShell embedded in a .cmd, and cmd.exe's DELAYED EXPANSION ate the `!`
// out of the regex `(?<![.\w$])chrome\?\.`, which made PowerShell fail to parse
// a line it had never actually been given. A gate that cannot survive its own
// quoting is not a gate. Node reads the file directly; nothing is quoted.
//
// Exit non-zero on any failure. Run from anywhere.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECT_SHA = 'e43659804b2f1bb4b911c33e344a9c01a8593746dd460fdfc21adb162ac3fc10';

let bad = 0;
const ok = (m) => console.log('ok    ' + m);
const fail = (m) => { console.log('FAIL  ' + m); bad++; };

// --- 1. the guard is on line 37 --------------------------------------------
const appPath = resolve(GAME, 'ui/app.js');
const lines = readFileSync(appPath, 'utf8').split(/\r?\n/);
const l37 = lines[36] ?? '';
if (/globalThis\.chrome\?\.runtime\?\.getManifest/.test(l37)) ok('app.js:37 carries the globalThis guard');
else fail(`app.js:37 does not carry the guard: ${l37.trim() || '(empty)'}`);

// --- 2. no unguarded bare `chrome?.` anywhere in app.js ---------------------
// A bare `chrome?.` throws ReferenceError where nothing declares `chrome`;
// optional chaining only protects a null/undefined VALUE.
let unguarded = 0;
lines.forEach((ln, i) => {
  if (/(?<![.\w$])chrome\?\./.test(ln) && !/globalThis\.chrome/.test(ln)) {
    fail(`unguarded bare chrome?. at app.js:${i + 1} — ${ln.trim()}`);
    unguarded++;
  }
});
if (!unguarded) ok('no unguarded bare chrome?. in app.js');

// --- 2b. CONTROL: prove check 2 can actually fire ---------------------------
// A scan that matched nothing and a broken scan print the same thing.
const probe = "const v = chrome?.runtime?.id;";
if (/(?<![.\w$])chrome\?\./.test(probe) && !/globalThis\.chrome/.test(probe)) ok('CONTROL: the scan fires on a known-bad line');
else fail('CONTROL: the scan is BLIND — it did not fire on a known-bad line, so its pass above is worthless');

// --- 3. the emitted artifact is the one the browser gates passed against ----
try {
  const buf = readFileSync(resolve(GAME, 'dist-itch/index.html'));
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha === EXPECT_SHA) ok(`dist-itch/index.html sha256 ${sha}`);
  else fail(`dist-itch/index.html sha256 ${sha}\n      expected            ${EXPECT_SHA}\n      This is not the file the browser, storage and a11y gates ran against.`);
} catch (e) {
  fail(`dist-itch/index.html unreadable — run scripts/build-itch.mjs first (${e.code})`);
}

console.log(bad ? `\nSOURCE GATE FAILED — ${bad} problem(s)` : '\nSOURCE GATE PASSED');
process.exit(bad ? 1 : 0);
