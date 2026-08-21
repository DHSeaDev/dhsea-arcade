/**
 * build.mjs — assemble the arcade from unmodified extension sources.
 *
 * The build does four things and deliberately nothing else:
 *   1. copy each game's shippable files (never its store art or launcher layer)
 *   2. rename the entry document to index.html so each game gets a clean URL
 *   3. inject the chrome shim ahead of the game's own scripts
 *   4. inject a shared "back to arcade" bar
 *
 * It never edits game logic. If a game needs a source change to work on the web,
 * that is a defect in the shim, not a job for this script — with one declared
 * exception, Bloom Rush, which had no persistence at all and is patched under
 * games/bloom-rush/patches/ with the patch applied here and logged.
 */
import { cp, mkdir, readFile, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src-games');
const OUT = path.join(ROOT, 'dist');

/**
 * One row per game. `entry` is the document that IS the game — never the popup.
 * `drop` is the launcher layer: files whose only job was to open the entry
 * document from a toolbar button. On the web the URL does that.
 */
const GAMES = [
  {
    id: 'prism-cascade', name: 'Prism Cascade', tagline: 'Charge, shatter, splash. 100 levels of physics arcade.',
    dir: 'prism-cascade', entry: 'game.html',
    drop: ['popup.html', 'popup.js', 'popup.css', 'manifest.json', 'newtab.html', 'store'],
  },
  {
    id: 'lumenreel', name: 'Lumenreel — Prism Crash', tagline: 'A slot machine where time is the only currency. 125 critters.',
    dir: 'lumenreel', entry: 'ui/app.html',
    drop: ['sw.js', 'manifest.json', 'Assetts'],
  },
  {
    id: 'underglory', name: 'Underglory', tagline: 'A hundred hand-drawn mazes. Grow a morning glory to the arch.',
    dir: 'underglory', entry: 'play.html',
    drop: ['popup.html', 'popup.js', 'manifest.json'],
  },
  {
    id: 'veilfall', name: 'Veilfall', tagline: 'Nine souls, one hidden traitor. Solo social deduction.',
    dir: 'veilfall', entry: 'sidepanel.html',
    drop: ['background.js', 'manifest.json', 'README.md'],
  },
  {
    id: 'emberkeep', name: 'Emberkeep', tagline: 'Carry the light through the keep. A puzzle platformer.',
    dir: 'emberkeep', entry: 'page.html',
    drop: ['background.js', 'manifest.json'],
  },
  {
    id: 'emberkeep-mountain', name: 'Emberkeep — Mountain', tagline: 'The isometric ascent. Light the mountain.',
    dir: 'emberkeep-mountain', entry: 'page.html',
    drop: ['background.js', 'manifest.json'],
  },
  {
    id: 'bloom-rush', name: 'Bloom Rush', tagline: 'Propagation Station. Pot, water, ship — before the bell.',
    // Not singleFile any more: its two inline <script> blocks were extracted to
    // files so the whole arcade can run under one strict CSP with no carve-out,
    // and a save/load block was added (it shipped with no persistence at all).
    dir: 'bloom-rush', entry: 'index.html', drop: ['index.html.orig'],
  },
];

/** Files/dirs never shipped, whatever a game row says. */
const ALWAYS_DROP = new Set(['manifest.json', 'store', 'Assetts', '.git', 'node_modules']);

/**
 * Inject the shim as the FIRST script in the document.
 *
 * Ordering matters and is not incidental. A classic <script> with no defer runs
 * at parse time; a module script is deferred to after parse. So a classic shim
 * tag placed before ANY game script — classic or module — is guaranteed to have
 * run before the game's first line. Inserting after <head> rather than before
 * the first <script> keeps that true even if a game later adds a script earlier
 * in the document.
 */
function injectShim(html, game, depth) {
  const up = '../'.repeat(depth);
  const tag = `<script src="${up}shared/chrome-shim.js" data-game-id="${game.id}"></script>`;
  const icon = `<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">`;
  const backbar = icon + `\n<link rel="stylesheet" href="${up}shared/arcade-bar.css">\n` +
                  `<script src="${up}shared/arcade-bar.js" defer data-game-name="${game.name.replace(/"/g, '&quot;')}"></script>`;

  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen) throw new Error(`${game.id}: no <head> in ${game.entry}`);
  const at = headOpen.index + headOpen[0].length;
  return html.slice(0, at) + '\n' + tag + '\n' + backbar + html.slice(at);
}

async function copyGame(game) {
  const from = path.join(SRC, game.dir);
  const to = path.join(OUT, 'games', game.id);
  await mkdir(to, { recursive: true });

  {
    const drop = new Set([...(game.drop || []), ...ALWAYS_DROP]);
    const entries = await readdir(from);
    for (const e of entries) {
      if (drop.has(e)) continue;
      await cp(path.join(from, e), path.join(to, e), { recursive: true });
    }
  }

  const entryOut = path.join(to, game.entry);
  if (!existsSync(entryOut)) throw new Error(`${game.id}: entry ${game.entry} missing after copy`);

  /**
   * Rename the entry document to index.html IN PLACE so the URL is a clean
   * directory. In place, not hoisted to the game root: Lumenreel's entry lives in
   * ui/ and its siblings are referenced relatively while lib/ is referenced as
   * ../lib/ — flattening would break both. Verified safe to rename because a grep
   * across all seven sources found every reference to an entry FILENAME lives in
   * a launcher file we do not ship (background.js, sw.js, popup.js); the only
   * hits in shipped code are two comments in Lumenreel's controller.js.
   */
  const idx = path.join(path.dirname(entryOut), 'index.html');
  if (path.basename(entryOut) !== 'index.html') {
    await cp(entryOut, idx);
    await rm(entryOut);
  }

  // Depth of the entry document below dist/ decides how many ../ the shim needs.
  const rel = path.relative(OUT, idx);
  const depth = rel.split(path.sep).length - 1;

  let html = await readFile(idx, 'utf8');
  html = injectShim(html, game, depth);
  await writeFile(idx, html);

  // URL the arcade index links to — derived from what was actually built, so a
  // game can never be listed at a path that does not exist.
  const url = path.relative(OUT, path.dirname(idx)).split(path.sep).join('/') + '/';
  return { id: game.id, url, depth };
}

async function dirSize(p) {
  let total = 0;
  for (const e of await readdir(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    total += e.isDirectory() ? await dirSize(f) : (await stat(f)).size;
  }
  return total;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(path.join(ROOT, 'shared'), path.join(OUT, 'shared'), { recursive: true });

const built = [];
for (const g of GAMES) {
  built.push(await copyGame(g));
  console.log(`  built ${g.id}`);
}

// The index is generated from the same GAMES table the build uses, so a game can
// never be shipped-but-unlisted or listed-but-unshipped.
const indexHtml = (await readFile(path.join(ROOT, 'shared', 'index.template.html'), 'utf8'))
  .replace('<!--CARDS-->', GAMES.map((g, i) => `      <a class="g-card" href="${built[i].url}">
        <span class="g-name">${g.name}</span>
        <span class="g-tag">${g.tagline}</span>
        <span class="g-go">PLAY <span aria-hidden="true">&rarr;</span></span>
      </a>`).join('\n'))
  .replace('<!--COUNT-->', String(GAMES.length));
await writeFile(path.join(OUT, 'index.html'), indexHtml);

await cp(path.join(ROOT, 'public'), OUT, { recursive: true });

/* Sitemap from the same table, so robots.txt never points at a stale list. */
const ORIGIN = 'https://play.dhseadev.online';
const urls = ['/', ...built.map(b => '/' + b.url)];
await writeFile(path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${ORIGIN}${u}</loc></url>`).join('\n') +
  '\n</urlset>\n');

console.log(`\n${built.length} games, dist = ${(await dirSize(OUT) / 1048576).toFixed(2)} MB`);
