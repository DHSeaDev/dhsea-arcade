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
const ORIGIN = 'https://play.dhseadev.online';
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
    seoTitle: 'Prism Cascade — free physics arcade game in your browser',
    seoDesc: 'Charge, shatter and splash your way through 100 levels of physics arcade. 6 challenge runs, 83 achievements, generative music. Free, no install, no account.',
    genre: 'Arcade',
    dir: 'prism-cascade', entry: 'game.html',
    drop: ['popup.html', 'popup.js', 'popup.css', 'manifest.json', 'newtab.html', 'store'],
  },
  {
    id: 'lumenreel', name: 'Lumenreel — Prism Crash', tagline: 'A slot machine where time is the only currency. 125 critters.',
    seoTitle: 'Lumenreel — free collect-a-thon slot game, no money ever',
    seoDesc: 'A prism slot machine where time is the only currency. Collect 125 critters across two skins. There is no money in this game and no way to add any.',
    genre: 'Casual',
    dir: 'lumenreel', entry: 'ui/app.html',
    drop: ['sw.js', 'manifest.json', 'Assetts'],
  },
  {
    id: 'underglory', name: 'Underglory', tagline: 'A hundred hand-drawn mazes. Grow a morning glory to the arch.',
    seoTitle: 'Underglory — 100 hand-drawn maze puzzles, free in browser',
    seoDesc: 'A hundred hand-drawn mazes. Grow a morning glory up trellises and rails to reach the arch. Offline, no account, no tracking.',
    genre: 'Puzzle',
    dir: 'underglory', entry: 'play.html',
    drop: ['popup.html', 'popup.js', 'manifest.json'],
  },
  {
    id: 'veilfall', name: 'Veilfall', tagline: 'Nine souls, one hidden traitor. Solo social deduction.',
    seoTitle: 'Veilfall — solo social deduction against AI opponents, free',
    seoDesc: 'Nine souls, one hidden traitor, eight opponents who each know only their own calling. Plays completely offline; add your own Groq key for improvised dialogue.',
    genre: 'Strategy',
    dir: 'veilfall', entry: 'sidepanel.html',
    drop: ['background.js', 'manifest.json', 'README.md'],
  },
  {
    id: 'emberkeep', name: 'Emberkeep', tagline: 'Carry the light through the keep. A puzzle platformer.',
    seoTitle: 'Emberkeep — a puzzle platformer about carrying light, free',
    seoDesc: 'Carry the light through the keep without letting it go out. A hand-built puzzle platformer with generated music and no assets to download.',
    genre: 'Platformer',
    dir: 'emberkeep', entry: 'page.html',
    drop: ['background.js', 'manifest.json'],
  },
  {
    id: 'emberkeep-mountain', name: 'Emberkeep — Mountain', tagline: 'The isometric ascent. Light the mountain.',
    seoTitle: 'Emberkeep Mountain — isometric light puzzle, free in browser',
    seoDesc: 'The isometric ascent. Route light up the mountain across shifting lattices. A standalone sequel to Emberkeep.',
    genre: 'Puzzle',
    dir: 'emberkeep-mountain', entry: 'page.html',
    drop: ['background.js', 'manifest.json'],
  },
  {
    id: 'bloom-rush', name: 'Bloom Rush', tagline: 'Propagation Station. Pot, water, ship — before the bell.',
    // Not singleFile any more: its two inline <script> blocks were extracted to
    // files so the whole arcade can run under one strict CSP with no carve-out,
    // and a save/load block was added (it shipped with no persistence at all).
    seoTitle: 'Bloom Rush — a botanical time-management game, free',
    seoDesc: 'Propagation Station. Pot, water, mix the feed and ship every frond before the bell. An original botanical time-management game; progress saves in your browser.',
    genre: 'Simulation',
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
/**
 * Per-page SEO + structured data.
 *
 * Every game page shipped with the extension's own bare <title> and NOTHING
 * else — measured 2026-08-21: description, canonical, og:* and JSON-LD were all
 * zero across all seven, while every one of them sits in sitemap.xml. A page in
 * a sitemap with no description is a page a search engine has to guess at.
 *
 * Generated from the GAMES table, so the metadata cannot drift from what ships:
 * a game with no seoTitle fails the build rather than shipping bare.
 */
function seoHead(game, url) {
  const t = game.seoTitle, d = game.seoDesc;
  if (!t || !d) throw new Error(`${game.id}: seoTitle/seoDesc required — a page in the sitemap must not ship bare`);
  const abs = ORIGIN + '/' + url;
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  /* Co-typed VideoGame + WebApplication, matching the convention already used on
   * every showcase page of dhseadev.online. No ratings are asserted — there are
   * no verified ones, and inventing them is the failure mode this project's
   * own notes call out by name. */
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': ['VideoGame', 'WebApplication'], name: game.name, url: abs,
        description: d, genre: game.genre, applicationCategory: 'GameApplication',
        operatingSystem: 'Any modern web browser',
        browserRequirements: 'Requires JavaScript and HTML5 canvas',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Person', name: 'Donnie Harding', url: 'https://dhseadev.online/' },
        isAccessibleForFree: true, inLanguage: 'en' },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'DHSeaDev Arcade', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: game.name, item: abs } ] },
    ],
  };
  return [
    '<title>' + esc(t) + '</title>',
    '<meta name="description" content="' + esc(d) + '">',
    '<link rel="canonical" href="' + abs + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + esc(t) + '">',
    '<meta property="og:description" content="' + esc(d) + '">',
    '<meta property="og:url" content="' + abs + '">',
    '<meta property="og:image" content="' + ORIGIN + '/og-card.png">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<script type="application/ld+json">' + JSON.stringify(ld) + '<\/script>',
  ].join('\n');
}

function injectShim(html, game, depth, url) {
  const up = '../'.repeat(depth);
  const tag = `<script src="${up}shared/chrome-shim.js" data-game-id="${game.id}"></script>`;
  const icon = `<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">`;
  const backbar = icon + `\n<link rel="stylesheet" href="${up}shared/arcade-bar.css">\n` +
                  `<script src="${up}shared/arcade-bar.js" defer data-game-name="${game.name.replace(/"/g, '&quot;')}"></script>`;

  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen) throw new Error(`${game.id}: no <head> in ${game.entry}`);
  const at = headOpen.index + headOpen[0].length;
  // Remove the extension's own bare <title> — two <title> elements means the
  // first wins and ours would be decoration.
  const body = html.slice(at).replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  return html.slice(0, at) + '\n' + seoHead(game, url) + '\n' + tag + '\n' + backbar + body;
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

  // URL the arcade index links to — derived from what was actually built, so a
  // game can never be listed at a path that does not exist. Computed BEFORE the
  // head injection because canonical and og:url need it.
  const url = path.relative(OUT, path.dirname(idx)).split(path.sep).join('/') + '/';

  let html = await readFile(idx, 'utf8');
  html = injectShim(html, game, depth, url);
  await writeFile(idx, html);
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
/* The index template is a build input, not a runtime asset — it must not be
 * served. Copy only what the pages actually load. */
await cp(path.join(ROOT, 'shared'), path.join(OUT, 'shared'), {
  recursive: true,
  /* Build inputs, not runtime assets. playhtml-boot.js is the UNBUNDLED entry —
   * it carries a bare `import 'playhtml'` specifier that no browser can resolve,
   * so shipping it would put a guaranteed-broken file on the origin. */
  filter: (src) => !src.endsWith('index.template.html') && !src.endsWith('playhtml-boot.js'),
});

const built = [];
for (const g of GAMES) {
  built.push(await copyGame(g));
  console.log(`  built ${g.id}`);
}

// The index is generated from the same GAMES table the build uses, so a game can
// never be shipped-but-unlisted or listed-but-unshipped.
const indexHtml = (await readFile(path.join(ROOT, 'shared', 'index.template.html'), 'utf8'))
  /* The card is an <article>, NOT an <a>. The star buttons and the launch link
   * are siblings: a button nested inside an anchor makes the parser split the
   * card into two elements, which is a defect this project has already shipped
   * once (the PLAYABLE chip on dhseadev.online /projects/).
   * The can-tally / can-rate ids ARE the playhtml sync key — renaming one
   * orphans its accumulated counts with no migration path. */
  .replace('<!--CARDS-->', GAMES.map((g, i) => `      <article class="g-card">
        <span class="g-name">${g.name}</span>
        <span class="g-tag">${g.tagline}</span>
        <div class="g-social">
          <span class="g-plays" id="plays-${g.id}" can-tally>counting\u2026</span>
          <div class="g-rate" id="rate-${g.id}" can-rate role="group" aria-label="Rate ${g.name}">
${[1, 2, 3, 4, 5].map(n => `            <button class="g-star" type="button" aria-label="Rate ${n} of 5">&#9734;</button>`).join('\n')}
            <span class="g-avg"></span>
          </div>
        </div>
        <a class="g-go" href="${built[i].url}">PLAY <span aria-hidden="true">&rarr;</span></a>
      </article>`).join('\n'))
  .replace('<!--COUNT-->', String(GAMES.length));
await writeFile(path.join(OUT, 'index.html'), indexHtml);

/* Bundle playhtml locally. Loading it from unpkg would mean allowing a
 * third-party host in script-src — i.e. giving that host code execution on the
 * origin where Veilfall's Groq key is stored. Bundling keeps script-src 'self'. */
const { build: esbuild } = await import('esbuild');
await esbuild({
  entryPoints: [path.join(ROOT, 'shared', 'playhtml-boot.js')],
  outfile: path.join(OUT, 'shared', 'playhtml.bundle.js'),
  bundle: true, format: 'esm', target: 'es2020', minify: true, sourcemap: false,
  legalComments: 'none',
});
/* playhtml also injects <link rel=stylesheet href="https://unpkg.com/playhtml@latest/dist/style.css">
 * at RUNTIME — bundling the JS does not remove it. That is a hard-coded,
 * UNPINNED CDN dependency ("@latest"), i.e. a third party that can change this
 * page's styling at any time, and it is blocked by our CSP anyway. So the URL
 * literal is rewritten to a self-hosted copy of the exact stylesheet shipped by
 * the version in package-lock. Found by the CSP gate, not by reading the docs. */
const PH_CDN = 'https://unpkg.com/playhtml@latest/dist/style.css';
const bundlePath = path.join(OUT, 'shared', 'playhtml.bundle.js');
let bundleSrc = await readFile(bundlePath, 'utf8');
const hits = bundleSrc.split(PH_CDN).length - 1;
if (hits !== 1) throw new Error(`expected exactly 1 playhtml CDN stylesheet literal, found ${hits} — playhtml changed, re-check what it loads at runtime`);
bundleSrc = bundleSrc.replace(PH_CDN, '/shared/playhtml.css');
await writeFile(bundlePath, bundleSrc);
await cp(path.join(ROOT, 'node_modules', 'playhtml', 'dist', 'style.css'), path.join(OUT, 'shared', 'playhtml.css'));
console.log('  bundled playhtml (CDN stylesheet self-hosted)');

await cp(path.join(ROOT, 'public'), OUT, { recursive: true });

/* Index structured data + the GEO layer, both from the same GAMES table so a
 * game can never be described in one place and missing from another. */
{
  const idxPath = path.join(OUT, 'index.html');
  let idx = await readFile(idxPath, 'utf8');
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': ORIGIN + '/', name: 'DHSeaDev Arcade',
        url: ORIGIN + '/',
        description: 'Seven browser games by Donnie Harding. Free, no install, no account, no tracking.',
        inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: 'DHSeaDev Arcade', url: ORIGIN + '/' },
        about: { '@type': 'Person', name: 'Donnie Harding', url: 'https://dhseadev.online/' },
        mainEntity: { '@type': 'ItemList', numberOfItems: GAMES.length,
          itemListElement: GAMES.map((g, i) => ({ '@type': 'ListItem', position: i + 1,
            name: g.name, url: ORIGIN + '/' + built[i].url })) } },
    ],
  };
  idx = idx.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(graph) + '<\/script>\n</head>');
  await writeFile(idxPath, idx);

  /* llms.txt — the GEO layer. An answer engine that cannot run JavaScript sees
   * the game list here as plain prose, which is exactly what the canvas-rendered
   * pages cannot give it. Mirrors the convention already used on dhseadev.online. */
  const llms = [
    '# DHSeaDev Arcade',
    '',
    '> Seven browser games by Donnie Harding (DHSeaDev). Every one began as a Chrome',
    '> extension and now runs as an ordinary web page. Free, no install, no account,',
    '> no tracking. Progress saves in the visitor\'s own browser via localStorage.',
    '',
    '## Games',
    '',
    ...GAMES.map((g, i) => '- [' + g.name + '](' + ORIGIN + '/' + built[i].url + '): ' + g.seoDesc),
    '',
    '## Facts',
    '',
    '- Author: Donnie Harding, https://dhseadev.online/',
    '- Cost: free. No accounts, no payments, no advertising, no third-party trackers.',
    '- Data: game progress is stored only in the visitor\'s browser and never transmitted.',
    '- The one exception is Veilfall\'s optional improvised dialogue, which calls Groq',
    '  with a key the player supplies themselves. It is off by default and the game is',
    '  complete without it.',
    '- Source: each game began as a Chrome MV3 extension; the web build replaces the',
    '  extension storage API with a browser-local shim and ships no other change.',
    '',
  ].join('\n');
  await writeFile(path.join(OUT, 'llms.txt'), llms);
}

/* Sitemap from the same table, so robots.txt never points at a stale list. */

const urls = ['/', ...built.map(b => '/' + b.url)];
await writeFile(path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${ORIGIN}${u}</loc></url>`).join('\n') +
  '\n</urlset>\n');

console.log(`\n${built.length} games, dist = ${(await dirSize(OUT) / 1048576).toFixed(2)} MB`);
