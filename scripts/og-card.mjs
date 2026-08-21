/* Renders the 1200x630 share card from real HTML in the real browser, so the
 * fonts are the browser's own and the bytes shipped are the bytes inspected —
 * the same reasoning behind the canvas-upload technique on dhseadev.online. */
import { chromium } from 'playwright';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'og-card.png');

/* Fonts are EMBEDDED as data URIs, not fetched from Google.
 * The build container has no egress to fonts.googleapis.com, so a remote
 * stylesheet silently renders the system fallback — and `document.fonts.check`
 * returns TRUE anyway, so it does not catch it. Three identical measured widths
 * (Orbitron / a deliberately bogus family / sans-serif) is what caught it.
 * Embedding also makes the card reproducible offline and byte-stable. */
const b64 = async (f) => (await readFile(path.join(ROOT, 'node_modules/@fontsource', f))).toString('base64');
const ORB = await b64('orbitron/files/orbitron-latin-700-normal.woff2');
const INT = await b64('inter/files/inter-latin-400-normal.woff2');
const html = `<!doctype html><meta charset="utf-8">
<style>
 @font-face{font-family:Orbitron;font-weight:700;font-display:block;src:url(data:font/woff2;base64,${ORB}) format('woff2')}
 @font-face{font-family:InterEmbed;font-weight:400;font-display:block;src:url(data:font/woff2;base64,${INT}) format('woff2')}
 *{margin:0;box-sizing:border-box} html,body{width:1200px;height:630px}
 body{background:#0F172A;color:#E2E8F0;font-family:InterEmbed,system-ui,sans-serif;
   display:flex;flex-direction:column;justify-content:center;padding:84px;position:relative;overflow:hidden}
 .eyebrow{font-family:'Share Tech Mono',ui-monospace,monospace;font-size:22px;letter-spacing:.24em;
   text-transform:uppercase;color:#94A3B8;margin-bottom:22px}
 h1{font-family:Orbitron,sans-serif;font-weight:700;font-size:92px;line-height:1.02;letter-spacing:.01em;
   background:linear-gradient(100deg,#C4B5FD 0%,#93C5FD 45%,#F0ABFC 100%);
   -webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
 p{margin-top:26px;font-size:31px;color:#94A3B8;max-width:20ch}
 .rule{position:absolute;left:0;right:0;bottom:0;height:9px;
   background:linear-gradient(100deg,#C4B5FD 0%,#93C5FD 45%,#F0ABFC 100%)}
 .url{position:absolute;right:84px;bottom:64px;font-family:ui-monospace,monospace;font-size:26px;color:#C4B5FD}
</style>
<div class="eyebrow">DHSeaDev</div>
<h1>Play in your<br>browser</h1>
<p>Seven games. No install, no account.</p>
<div class="url">play.dhseadev.online</div><div class="rule"></div>`;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport:{width:1200,height:630}, deviceScaleFactor:1 });
/* A base URL is required or the stylesheet never resolves — the first attempt
 * used @import under setContent with no base and silently rendered the system
 * fallback. Loaded via a real navigation, then the font is ASSERTED rather than
 * eyeballed: a card that quietly falls back is indistinguishable from a good one
 * at a glance, and this is the exact class measurement-integrity exists for. */
/* Serve the card over http so the stylesheet has a real base URL. setContent
 * after a goto races the navigation and destroys the context. */
await p.route('**/og-card-src', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
await p.goto('https://play.dhseadev.online/og-card-src', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
/* Discriminating assertion. `document.fonts.check` is NOT a load check — it
 * returned true for a font that was never fetched. The only reliable test is
 * whether the real family measures DIFFERENTLY from a deliberately bogus one. */
const probe = await p.evaluate(() => {
  const mk = (fam) => { const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:-9999px;font-weight:700;font-size:92px;font-family:' + fam;
    d.textContent = 'Play in your browser'; document.body.appendChild(d);
    const w = d.getBoundingClientRect().width; d.remove(); return Math.round(w); };
  return { orbitron: mk('Orbitron,sans-serif'), bogus: mk('NOPEFONTXYZ,sans-serif') };
});
if (probe.orbitron === probe.bogus) {
  throw new Error(`Orbitron is NOT rendering (${probe.orbitron}px === bogus fallback) — the card would ship in the wrong face`);
}
console.log('font assertion passed: orbitron=%dpx vs bogus-fallback=%dpx', probe.orbitron, probe.bogus);
await p.screenshot({ path: OUT });
await b.close();
console.log('og-card.png written');
