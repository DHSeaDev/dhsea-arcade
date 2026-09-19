#!/usr/bin/env node
// A gate that has only ever reported CLEAN is a claim, not evidence.
// Every gate in build-itch.mjs is run here against (a) a known-good input it
// must pass and (b) a sabotaged input it must fail. Exit non-zero on any gate
// that cannot tell the two apart.
import { GATES } from './build-itch.mjs';

const CLEAN = {
  html: '<!doctype html><html><head><style>body{color:red}</style></head><body><p id="x">hi</p><a href="#x">j</a><img src="data:image/gif;base64,R0lGOD"><script>console.log(1)<\/script></body></html>',
  js: 'console.log("ok"); const evaluate = 1; obj.eval2 = 3;',
  css: 'body{color:red}/* mentions app.js and sidepanel.css harmlessly */',
};

const CASES = [
  ['scriptClose', 'html', CLEAN.html.replace('<\/script>', '<\/script><script>x()<\/script>')],
  ['evalUse',     'js', CLEAN.js + ' eval("1+1");'],
  ['evalUse',     'js', CLEAN.js + ' new Function("return 1")();'],
  ['externalRef', 'html', CLEAN.html.replace('<style>', '<link rel="stylesheet" href="app.css"><style>')],
  ['externalRef', 'html', CLEAN.html.replace('<script>', '<script src="https://cdn.example/x.js">')],
  ['cssImport',   'css', '@import url("other.css");' + CLEAN.css],
  ['inlineHandler','html', CLEAN.html.replace('<p id="x">', '<p id="x" onclick="boom()">')],
];

let bad = 0;

// 1. every gate must be SILENT on the clean input
for (const [name, fn] of Object.entries(GATES)) {
  const kind = name === 'cssImport' ? 'css'
    : (name === 'externalRef' || name === 'inlineHandler' || name === 'scriptClose') ? 'html' : 'js';
  const r = fn(CLEAN[kind]);
  if (r) { console.log(`FAIL  ${name}: false positive on known-good ${kind} → ${r}`); bad++; }
  else console.log(`ok    ${name}: silent on known-good ${kind}`);
}

// 2. every gate must FIRE on its sabotage
for (const [name, kind, input] of CASES) {
  const r = GATES[name](input);
  if (!r) { console.log(`FAIL  ${name}: BLIND to sabotage (${kind})`); bad++; }
  else console.log(`ok    ${name}: caught → ${r}`);
}

// 3. every gate must be covered by at least one sabotage case
for (const name of Object.keys(GATES)) {
  if (!CASES.some(c => c[0] === name)) { console.log(`FAIL  ${name}: no sabotage fixture`); bad++; }
}

console.log(bad ? `\nGATE PROOF FAILED — ${bad} problem(s)` : '\nGATE PROOF PASSED — every gate proven able to fail');
process.exit(bad ? 1 : 0);
