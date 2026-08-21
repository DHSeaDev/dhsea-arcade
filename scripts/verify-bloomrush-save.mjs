/**
 * The generic verifier proves the chrome-storage SHIM round-trips. Bloom Rush
 * does not use the shim — it was given its own localStorage layer — so its
 * persistence needs its own proof. Anything less would be citing a green from a
 * test that never touched the code in question.
 */
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, stat } from 'node:fs/promises'; import path from 'node:path';
const OUT = path.resolve(import.meta.dirname, '..', 'dist');
const T = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const s = http.createServer(async (q, r) => { try { let f = path.join(OUT, decodeURIComponent(q.url.split('?')[0]));
  if ((await stat(f).catch(()=>null))?.isDirectory()) f = path.join(f,'index.html');
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'}); r.end(await readFile(f)); } catch { r.writeHead(404); r.end(''); } });
await new Promise(r => s.listen(8096, r));

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
const ctx = await b.newContext(); const p = await ctx.newPage();
const fails = [];
await p.goto('http://localhost:8096/games/bloom-rush/', { waitUntil:'load' });
await p.waitForTimeout(1500);

// 1. A fresh profile must be at defaults.
const fresh = await p.evaluate(() => ({ coins: PROFILE.coins, unlocked: PROFILE.unlockedLevel, served: PROFILE.totalServed }));
if (fresh.coins !== 0 || fresh.unlocked !== 0) fails.push('fresh profile not at defaults: ' + JSON.stringify(fresh));

// 2. Mutate exactly as gameplay would, then let the autosave path run.
await p.evaluate(() => {
  PROFILE.coins = 1234;
  PROFILE.unlockedLevel = 7;
  PROFILE.totalServed = 99;
  PROFILE.levelStars = { 0: 3, 1: 2 };
  PROFILE.achievements = { firstBloom: true };
  brSaveProfile();
});
const stored = await p.evaluate(() => localStorage.getItem('bloomrush.profile.v1'));
if (!stored) fails.push('nothing written to localStorage');

// 3. Reload — the only step that actually proves persistence.
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({
  coins: PROFILE.coins, unlocked: PROFILE.unlockedLevel, served: PROFILE.totalServed,
  stars: PROFILE.levelStars, ach: PROFILE.achievements,
}));
if (after.coins !== 1234) fails.push('coins lost: ' + after.coins);
if (after.unlocked !== 7) fails.push('unlockedLevel lost: ' + after.unlocked);
if (after.served !== 99) fails.push('totalServed lost: ' + after.served);
if (after.stars?.['0'] !== 3) fails.push('levelStars lost: ' + JSON.stringify(after.stars));
if (after.ach?.firstBloom !== true) fails.push('achievements lost: ' + JSON.stringify(after.ach));

// 4. A corrupt save must NOT crash the boot path — it must fall back to defaults.
await p.evaluate(() => localStorage.setItem('bloomrush.profile.v1', '{"coins":"not-a-number","unlockedLevel":null,'));
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
const corrupt = await p.evaluate(() => ({ coins: PROFILE.coins, unlocked: PROFILE.unlockedLevel }));
if (errs.length) fails.push('corrupt save threw: ' + errs[0]);
if (corrupt.coins !== 0) fails.push('corrupt save not rejected, coins=' + JSON.stringify(corrupt.coins));

// 5. A save missing new fields must keep their defaults (forward compatibility).
await p.evaluate(() => localStorage.setItem('bloomrush.profile.v1', JSON.stringify({ coins: 50 })));
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
const partial = await p.evaluate(() => ({ coins: PROFILE.coins, unlocked: PROFILE.unlockedLevel, stars: PROFILE.levelStars }));
if (partial.coins !== 50) fails.push('partial save: coins not restored');
if (partial.unlocked !== 0 || typeof partial.stars !== 'object') fails.push('partial save: defaults not preserved');

await b.close(); s.close();
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS  bloom-rush persistence: round-trip, corrupt-save rejection, forward-compat');
process.exit(fails.length ? 1 : 0);
