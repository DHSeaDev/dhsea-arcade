// LINKED rows: card on the index, line in llms.txt, NOT in sitemap/ENTRIES, CSP unchanged.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ENTRIES, LINKED } from './entries.mjs';
const OUT = path.resolve(import.meta.dirname, '..', 'dist');
const fails = [];
const idx = await readFile(path.join(OUT, 'index.html'), 'utf8');
const llms = await readFile(path.join(OUT, 'llms.txt'), 'utf8');
const sm = await readFile(path.join(OUT, 'sitemap.xml'), 'utf8');
const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(idx)[1]);
if (ld['@graph'][0].mainEntity.numberOfItems !== ENTRIES.length) fails.push('ItemList numberOfItems != ENTRIES.length');
const hdr = await readFile(path.resolve(import.meta.dirname, '..', 'public', '_headers'), 'utf8');
if (!LINKED.length) fails.push('LINKED is empty');
for (const g of LINKED) {
  if (!/^https:\/\/[a-z0-9.-]+\/$/.test(g.url)) fails.push(`${g.id}: url not an https origin root`);
  if (ENTRIES.some(e => e.id === g.id)) fails.push(`${g.id}: also in ENTRIES — would be built on the shared origin`);
  if (!idx.includes(`href="${g.url}"`)) fails.push(`${g.id}: no card link to ${g.url}`);
  if (!new RegExp(`<a class="g-go" href="${g.url.replace(/\./g, '\\.')}" rel="noopener" aria-label="Play [^"]*">PLAY`).test(idx)) fails.push(`${g.id}: link lacks rel=noopener / PLAY label`);
  if (idx.includes(`id="plays-${g.id}"`) || idx.includes(`id="rate-${g.id}"`)) fails.push(`${g.id}: has playhtml tally/rate ids (counts belong to built entries only)`);
  if (!llms.includes(`](${g.url})`)) fails.push(`${g.id}: not in llms.txt`);
  if (sm.includes(g.url) || sm.includes(g.id)) fails.push(`${g.id}: leaked into sitemap.xml`);
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`<a class="g-go g-about" href="${esc(g.site)}\\?utm_source=arcade&amp;utm_medium=promo"`).test(idx)) fails.push(`${g.id}: ABOUT link to ${g.site} missing`);
  const hi = llms.indexOf('## Hosted on their own site'), li = llms.indexOf(`](${g.url})`);
  if (hi < 0 || li < hi) fails.push(`${g.id}: llms.txt line is not under the 'Hosted on their own site' section`);
  const before = llms.slice(0, Math.max(hi, 0)).split('\n').filter(l => /^- \[/.test(l) && !l.includes('](https://play.dhseadev.online/'));
  if (before.length) fails.push('off-origin link in the arcade sections of llms.txt: ' + before[0]);
}
if (/spirebound|firebase|identitytoolkit|securetoken|firestore\.googleapis/i.test(hdr)) fails.push('public/_headers mentions a LINKED/Firebase host — the arcade CSP must not be widened');
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : `linked: ${LINKED.length} external card(s) present, llms.txt lists them, sitemap/ENTRIES/CSP untouched`);
process.exit(fails.length ? 1 : 0);
