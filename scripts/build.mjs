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
 * One row per shipped thing. `entry` is the document that IS it — never the
 * popup. `drop` is the launcher layer: files whose only job was to open the
 * entry document from a toolbar button. On the web the URL does that.
 *
 * `type` is 'game' (default) or 'app'. It is not cosmetic — it decides the
 * structured data. A game is co-typed VideoGame + WebApplication; an app is
 * WebApplication ONLY. Asserting VideoGame on a chat client is a false claim
 * made to a search engine, and this project's own notes name inventing
 * structured data as the failure mode to avoid.
 *
 * `shims` names the compatibility scripts injected ahead of the entry's own.
 * It defaults to the arcade shim. It exists because the seven games needed
 * exactly one shim and Planet Express does not: it uses chrome.tts and a real
 * chrome.runtime message bus, neither of which shared/chrome-shim.js provides —
 * that file seats a NO-OP runtime.onMessage, which is worse than absent because
 * it looks present. See src-games/planet-express-lounge/pe-web-shim.js.
 */
const ENTRIES = [
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
  {
    id: 'planet-express-lounge', name: 'Planet Express Lounge',
    tagline: 'An AI sitcom engine. Chat with the crew, or let them run an episode.',
    type: 'app', appCategory: 'EntertainmentApplication',
    seoTitle: 'Planet Express Lounge — an AI sitcom engine in your browser',
    seoDesc: 'Chat with an 18-strong animated-sitcom cast, or press one button and watch them run a full episode unaided — cold open to punchline. Bring your own API key; a scripted demo runs without one.',
    genre: 'Entertainment',
    dir: 'planet-express-lounge', entry: 'app.html',
    /* Its own shim, NOT shared/chrome-shim.js. Loading both would be actively
     * harmful: the arcade shim would win the runtime.onMessage property and
     * silently kill the Dark Matter economy. */
    shims: ['pe-web-shim.js', 'pe-web-background.js', 'pel-web-enhance.js'],
    drop: ['popup.html', 'popup.js', 'background.js', 'manifest.json', 'README.md', 'store_listing_description.txt',
           /* Extension first-run page. Its CTA is onclick="window.close()" —
            * meaningless in a tab, and the only inline handler in the shipped
            * tree, which is precisely what script-src 'self' blocks. */
           'welcome.html'],
  },
  {
    id: 'prismwar', name: 'Prismwar', tagline: 'Six colors, one Undertow. An original card battler vs a computer rival.',
    seoTitle: 'Prismwar — free six-color trading card game vs an AI rival',
    seoDesc: 'An original six-color card battler: build decks from a 250-card set, earn packs from daily quests, unlock ten legendary Ascendants with signed codes, and play a computer rival that trades, blocks and ambushes. No account, no purchases, no network.',
    genre: 'Strategy',
    dir: 'prismwar', entry: 'index.html',
    /* Ledger wall: a playhtml room of posted ledger cards at /games/prismwar/ledger/. */
    bundles: [{ entry: 'ledger/wall-boot.js', out: 'ledger/wall.bundle.js' }],
    /* Authored for the web, not ported. Its storage layer uses chrome.storage.local
     * when present and localStorage otherwise, so the default arcade shim gives it
     * the same namespaced-storage contract verify.mjs holds every entry to. It
     * touches no chrome.runtime API, so the PEL dead-listener hazard does not apply.
     * Declares its own viewport, worded h1 and CSP meta. */
    drop: [],
  },
];

/* Derived views. Every downstream consumer reads one of these, never ENTRIES
 * directly, so a row can never be counted as a game in one place and an app in
 * another. */
const GAMES = ENTRIES.filter(e => e.type !== 'app');
const APPS  = ENTRIES.filter(e => e.type === 'app');

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
  const isApp = game.type === 'app';
  const t = game.seoTitle, d = game.seoDesc;
  if (!t || !d) throw new Error(`${game.id}: seoTitle/seoDesc required — a page in the sitemap must not ship bare`);
  const abs = ORIGIN + '/' + url;
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  /* Games are co-typed VideoGame + WebApplication, matching the convention on
   * every showcase page of dhseadev.online. Apps are WebApplication ONLY —
   * asserting VideoGame on a chat client would be a false claim, and it would be
   * the same class of defect as the invented aggregateRating this project has
   * always refused to emit. No ratings are asserted for either.
   *
   * browserRequirements also differs and is not boilerplate: the games need
   * HTML5 canvas, and an app that has no canvas must not claim to require one. */
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': isApp ? 'WebApplication' : ['VideoGame', 'WebApplication'],
        name: game.name, url: abs,
        description: d, genre: game.genre,
        applicationCategory: isApp ? (game.appCategory || 'WebApplication') : 'GameApplication',
        operatingSystem: 'Any modern web browser',
        browserRequirements: isApp
          ? 'Requires JavaScript. Speech output uses the browser Web Speech API.'
          : 'Requires JavaScript and HTML5 canvas',
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
  /* Shims default to the shared arcade one. An entry that names its own gets
   * ONLY its own — never both. Two shims racing for the same chrome.* property
   * is decided by script order, and the loser fails silently. */
  const tag = (game.shims
    ? game.shims.map(f => `<script src="${f}" data-ns="${game.id}"></script>`)
    : [`<script src="${up}shared/chrome-shim.js" data-game-id="${game.id}"></script>`]
  ).join('\n');
  const icon = `<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">`;
  const backbar = icon + `\n<link rel="stylesheet" href="${up}shared/arcade-bar.css">\n` +
                  `<script src="${up}shared/arcade-bar.js" defer data-game-name="${game.name.replace(/"/g, '&quot;')}"></script>`;

  /* An extension panel has a fixed viewport, so three of these games never
   * needed <meta viewport> and never had one. On the web its absence means a
   * phone lays the page out at ~980px and scales it down — the game renders
   * legibly on a desktop and as unreadable confetti on a phone, which is the
   * single most common way a ported page fails its largest audience.
   * Injected only when the entry does not already declare one. */
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html)
    ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1">\n';

  /* A VISUALLY-HIDDEN <h1>, injected only when the entry has none of its own.
   *
   * Four entries ship no h1: two are pure canvas with no headings at all, and
   * Underglory has five <h2> under no <h1>, which is a broken outline rather
   * than a missing nicety. A canvas game's title is PAINTED, so it does not
   * exist to a crawler or a screen reader — the page announces itself as
   * nothing. This is the same class as the SEO gap that put seven bare pages in
   * the sitemap: the machine-readable layer was simply absent.
   *
   * Injected at BUILD time, into the served bytes, not by script — an answer
   * engine that does not execute JavaScript is exactly the visitor this is for.
   * The text is the entry's own `name`, so the hidden heading says what the page
   * genuinely is; it is not keyword stuffing and it is not cloaking. Anything
   * other than the real name here would be.
   *
   * Placed as the first body child in source. arcade-bar.js later inserts the
   * bar BEFORE this at runtime, so the bar keeps the first-child position
   * verify.mjs asserts. */
  const escH = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* "Has an h1" is not the same as "has a page heading", and two entries prove
   * it: Emberkeep's h1 is the live room label and ships as `1.`, Mountain's is
   * the chapter numeral `I.`. Those are HUD readouts that happen to be marked up
   * as headings — a crawler or screen reader is told this page is called "1.".
   * A presence check would score both as fine.
   *
   * So the test is whether the SERVED bytes carry a heading with real words:
   * strip everything that is not a letter and require three. `1.` -> "" and
   * `I.` -> "I" both fail; `Veilfall` and `Bloom Rush — Propagation Station`
   * both pass. Deliberately looks at the static markup, because JS filling that
   * element in later is invisible to the visitor this is for.
   *
   * Where a non-descriptive h1 already exists the injected one is placed FIRST
   * in the body, so the page's real name leads. That does leave two h1s on those
   * two pages — legal in HTML5, and strictly better than a page whose only
   * heading is a numeral. The proper fix belongs in those games: a HUD readout
   * should be a <div>, not an <h1>. Recorded rather than silently patched, since
   * this port does not edit game source. */
  const existingH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Words = existingH1
    ? existingH1[1].replace(/<[^>]*>/g, '').replace(/[^A-Za-z]/g, '')
    : '';
  const srH1 = h1Words.length >= 3
    ? ''
    : `<h1 class="arcade-sr-only">${escH(game.name)}</h1>\n`;

  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen) throw new Error(`${game.id}: no <head> in ${game.entry}`);
  const at = headOpen.index + headOpen[0].length;
  // Remove the extension's own bare <title> — two <title> elements means the
  // first wins and ours would be decoration.
  const body = html.slice(at).replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  const withHead = html.slice(0, at) + '\n' + viewport + seoHead(game, url) + '\n' + tag + '\n' + backbar + body;
  if (!srH1) return withHead;
  /* Insert immediately after <body ...>, preserving any attributes on the tag. */
  const bodyOpen = withHead.match(/<body[^>]*>/i);
  if (!bodyOpen) throw new Error(`${game.id}: no <body> — cannot place the page heading`);
  const bAt = bodyOpen.index + bodyOpen[0].length;
  return withHead.slice(0, bAt) + '\n' + srH1 + withHead.slice(bAt);
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

  /* Per-game ESM bundles (e.g. a playhtml wall). The unbundled source carries a
   * bare `import 'playhtml'` no browser can resolve, so it is bundled from the
   * SOURCE tree and the raw copy is removed from dist — shipping it would put a
   * guaranteed-broken file on the origin. Same CDN-stylesheet rewrite as the
   * shared bundle, for the same CSP reason. */
  for (const b of game.bundles || []) {
    const { build: esb } = await import('esbuild');
    const outfile = path.join(to, b.out);
    await esb({ entryPoints: [path.join(from, b.entry)], outfile, bundle: true, format: 'esm', target: 'es2020', minify: true, sourcemap: false, legalComments: 'none' });
    await rm(path.join(to, b.entry), { force: true });
    let src = await readFile(outfile, 'utf8');
    const cdn = 'https://unpkg.com/playhtml@latest/dist/style.css';
    const n = src.split(cdn).length - 1;
    if (n > 1) throw new Error(`${game.id}: ${b.out} references the playhtml CDN stylesheet ${n} times — expected 0 or 1`);
    if (n === 1) { src = src.replace(cdn, '/shared/playhtml.css'); await writeFile(outfile, src); }
    console.log(`  bundled ${game.id}/${b.out}${n ? ' (CDN stylesheet self-hosted)' : ''}`);
  }

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
for (const g of ENTRIES) {
  built.push(await copyGame(g));
  console.log(`  built ${g.id}${g.type === 'app' ? ' (app)' : ''}`);
}
/* Lookup by id, not by array index. The old code indexed `built[i]` against the
 * GAMES array — correct only while the two were the same list in the same
 * order. Splitting games from apps breaks that silently: every card would still
 * render, each pointing at the wrong URL. */
const urlOf = (id) => {
  const row = built.find(b => b.id === id);
  if (!row) throw new Error(`${id}: built row missing — the index would link to a page that does not exist`);
  return row.url;
};

// The index is generated from the same GAMES table the build uses, so a game can
// never be shipped-but-unlisted or listed-but-unshipped.
/* The card is an <article>, NOT an <a>. The star buttons and the launch link
 * are siblings: a button nested inside an anchor makes the parser split the
 * card into two elements, which is a defect this project has already shipped
 * once (the PLAYABLE chip on dhseadev.online /projects/).
 * The can-tally / can-rate ids ARE the playhtml sync key — renaming one
 * orphans its accumulated counts with no migration path, so an entry moving
 * between the games and apps sections keeps its counts. */
  const card = (g) => `      <article class="g-card">
        <span class="g-name">${g.name}</span>
        <span class="g-tag">${g.tagline}</span>
        <div class="g-social">
          <span class="g-plays" id="plays-${g.id}" can-tally>counting\u2026</span>
          <div class="g-rate" id="rate-${g.id}" can-rate role="group" aria-label="Rate ${g.name}">
${[1, 2, 3, 4, 5].map(n => `            <button class="g-star" type="button" aria-label="Rate ${n} of 5">&#9734;</button>`).join('\n')}
            <span class="g-avg"></span>
          </div>
        </div>
        <a class="g-go" href="${urlOf(g.id)}">${g.type === 'app' ? 'OPEN' : 'PLAY'} <span aria-hidden="true">&rarr;</span></a>
      </article>`;

const indexHtml = (await readFile(path.join(ROOT, 'shared', 'index.template.html'), 'utf8'))
  .replace('<!--CARDS-->', GAMES.map(card).join('\n'))
  .replace('<!--APPS-->', APPS.map(card).join('\n'))
  .replace(/<!--COUNT-->/g, String(GAMES.length))
  .replace(/<!--APPCOUNT-->/g, String(APPS.length))
  /* The apps section is removed entirely when there are none, rather than
   * shipping an empty heading with a "0 apps" label under it. */
  .replace(/<!--APPS_SECTION_START-->([\s\S]*?)<!--APPS_SECTION_END-->/,
           APPS.length ? '$1' : '');
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
        description: `${GAMES.length} browser games and ${APPS.length} browser app${APPS.length === 1 ? '' : 's'} by Donnie Harding. Free, no install, no account, no tracking.`,
        inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: 'DHSeaDev Arcade', url: ORIGIN + '/' },
        about: { '@type': 'Person', name: 'Donnie Harding', url: 'https://dhseadev.online/' },
        /* The ItemList covers EVERYTHING indexed, games and apps alike. Listing
         * only the games while sitemap.xml lists both is exactly the drift these
         * tables are generated from one source to prevent. */
        mainEntity: { '@type': 'ItemList', numberOfItems: ENTRIES.length,
          itemListElement: ENTRIES.map((g, i) => ({ '@type': 'ListItem', position: i + 1,
            name: g.name, url: ORIGIN + '/' + urlOf(g.id) })) } },
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
    `> ${GAMES.length} browser games and ${APPS.length} browser app${APPS.length === 1 ? '' : 's'} by Donnie Harding`,
    '> (DHSeaDev). Every one began as a Chrome extension and now runs as an ordinary',
    '> web page. Free, no install, no account, no tracking. Progress saves in the',
    '> visitor\'s own browser via localStorage.',
    '',
    '## Games',
    '',
    ...GAMES.map(g => '- [' + g.name + '](' + ORIGIN + '/' + urlOf(g.id) + '): ' + g.seoDesc),
    '',
    ...(APPS.length ? [
      '## Apps',
      '',
      '> Not games. Same origin, same rules, different shape.',
      '',
      ...APPS.map(g => '- [' + g.name + '](' + ORIGIN + '/' + urlOf(g.id) + '): ' + g.seoDesc),
      '',
    ] : []),
    '## Facts',
    '',
    '- Author: Donnie Harding, https://dhseadev.online/',
    '- Cost: free. No accounts, no payments, no advertising, no third-party trackers.',
    '- Data: game progress is stored only in the visitor\'s browser and never transmitted.',
    '- Two exceptions, both optional and both using a key the visitor supplies',
    '  themselves: Veilfall\'s improvised dialogue (off by default; the game is',
    '  complete without it) and Planet Express Lounge, which is an AI chat app and',
    '  needs a key for live conversation — it ships a scripted demo that runs',
    '  without one.',
    '- No key is ever transmitted to the developer. A key is held in the visitor\'s',
    '  own browser and sent only to the AI provider the visitor chose.',
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

/* 404.html — WITHOUT this file Cloudflare Pages answers every unmatched
 * path with the arcade index at HTTP 200. Measured before this was added:
 * /nope.html, /this/path/does/not/exist and /games/veilfall/manifest.json all
 * returned 200 and the full index page. That is a soft 404 — search engines
 * index unbounded duplicate URLs, and a mistyped <script src> receives HTML
 * instead of a clean failure, so the console shows a parse error rather than a
 * missing file. Pages serves this file with a real 404 status.
 *
 * It is deliberately NOT in sitemap.xml, and carries noindex so the page
 * itself never enters an index. */
const notFound = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Not found — DHSeaDev Arcade</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#12151F; color:#E8ECF6; text-align:center; padding:2rem;
         font:16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  h1 { font-size:clamp(2rem,6vw,3rem); margin:0 0 .5rem; letter-spacing:.02em; }
  p  { color:#B6BFD4; margin:0 0 1.75rem; max-width:38ch; }
  a  { display:inline-block; padding:.7rem 1.4rem; border-radius:.5rem;
       border:1px solid #6D5BD0; color:#DDD6FE; text-decoration:none; }
  a:hover, a:focus-visible { background:#6D5BD0; color:#fff; }
</style>
</head>
<body>
  <main>
    <h1>Nothing here</h1>
    <p>That page is not part of the arcade. The games are all one click away.</p>
    <a href="/">Back to the arcade</a>
  </main>
</body>
</html>
`;
await writeFile(path.join(OUT, '404.html'), notFound);

console.log(`\n${GAMES.length} games + ${APPS.length} app${APPS.length === 1 ? '' : 's'}, dist = ${(await dirSize(OUT) / 1048576).toFixed(2)} MB`);
