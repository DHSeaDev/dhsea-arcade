/**
 * entries.mjs — THE table. One row per shipped thing, and the single place any
 * consumer learns what the arcade contains.
 *
 * It lives in its own module because three gates (verify.mjs, stress.mjs,
 * verify-seo-headings.mjs) each carried their OWN hardcoded copy of this list.
 * Prismwar was built, listed and deployed against all three without ever being
 * tested, because adding a row to build.mjs did not add it to any gate. A list a
 * gate cannot derive is a list the gate does not cover.
 *
 */
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
export const ENTRIES = [
  {
    id: 'prism-cascade', site: 'https://dhseadev.online/projects/prism-cascade/', name: 'Prism Cascade', tagline: 'Charge, shatter, splash. 100 levels of physics arcade.',
    seoTitle: 'Prism Cascade — free physics arcade game in your browser',
    seoDesc: 'Charge, shatter and splash your way through 100 levels of physics arcade. 6 challenge runs, 83 achievements, generative music. Free, no install, no account.',
    genre: 'Arcade',
    dir: 'prism-cascade', entry: 'game.html',
    drop: ['popup.html', 'popup.js', 'popup.css', 'manifest.json', 'newtab.html', 'store'],
  },
  {
    id: 'lumenreel', site: 'https://dhseadev.online/projects/lumenreel/', name: 'Lumenreel — Prism Crash', tagline: 'A slot machine where time is the only currency. 125 critters.',
    seoTitle: 'Lumenreel — free collect-a-thon slot game, no money ever',
    seoDesc: 'A prism slot machine where time is the only currency. Collect 125 critters across two skins. There is no money in this game and no way to add any.',
    genre: 'Casual',
    dir: 'lumenreel', entry: 'ui/app.html',
    drop: ['sw.js', 'manifest.json', 'Assetts'],
  },
  {
    id: 'underglory', site: 'https://dhseadev.online/projects/underglory/', name: 'Underglory', tagline: 'A hundred hand-drawn mazes. Grow a morning glory to the arch.',
    seoTitle: 'Underglory — 100 hand-drawn maze puzzles, free in browser',
    seoDesc: 'A hundred hand-drawn mazes. Grow a morning glory up trellises and rails to reach the arch. Offline, no account, no tracking.',
    genre: 'Puzzle',
    dir: 'underglory', entry: 'play.html',
    drop: ['popup.html', 'popup.js', 'manifest.json'],
  },
  {
    id: 'veilfall', site: 'https://dhseadev.online/projects/veilfall/', name: 'Veilfall', tagline: 'Nine souls, one hidden traitor. Solo social deduction.',
    seoTitle: 'Veilfall — solo social deduction against AI opponents, free',
    seoDesc: 'Nine souls, one hidden traitor, eight opponents who each know only their own calling. Plays completely offline; add your own Groq key for improvised dialogue.',
    genre: 'Strategy',
    dir: 'veilfall', entry: 'sidepanel.html',
    drop: ['background.js', 'manifest.json', 'README.md'],
  },
  {
    id: 'emberkeep', site: 'https://dhseadev.online/projects/emberkeep/', name: 'Emberkeep', tagline: 'Carry the light through the keep. A puzzle platformer.',
    seoTitle: 'Emberkeep — a puzzle platformer about carrying light, free',
    seoDesc: 'Carry the light through the keep without letting it go out. A hand-built puzzle platformer with generated music and no assets to download.',
    genre: 'Platformer',
    dir: 'emberkeep', entry: 'page.html',
    drop: ['background.js', 'manifest.json'],
  },
  {
    id: 'emberkeep-mountain', site: 'https://dhseadev.online/projects/emberkeep-mountain/', name: 'Emberkeep — Mountain', tagline: 'The isometric ascent. Light the mountain.',
    seoTitle: 'Emberkeep Mountain — isometric light puzzle, free in browser',
    seoDesc: 'The isometric ascent. Route light up the mountain across shifting lattices. A standalone sequel to Emberkeep.',
    genre: 'Puzzle',
    dir: 'emberkeep-mountain', entry: 'page.html',
    drop: ['background.js', 'manifest.json'],
  },
  {
    id: 'bloom-rush', site: 'https://dhseadev.online/projects/bloom-rush/', name: 'Bloom Rush', tagline: 'Propagation Station. Pot, water, ship — before the bell.',
    // Not singleFile any more: its two inline <script> blocks were extracted to
    // files so the whole arcade can run under one strict CSP with no carve-out,
    // and a save/load block was added (it shipped with no persistence at all).
    seoTitle: 'Bloom Rush — a botanical time-management game, free',
    seoDesc: 'Propagation Station. Pot, water, mix the feed and ship every frond before the bell. An original botanical time-management game; progress saves in your browser.',
    genre: 'Simulation',
    dir: 'bloom-rush', entry: 'index.html', drop: ['index.html.orig'],
  },
  {
    id: 'planet-express-lounge', site: 'https://dhseadev.online/projects/planet-express-lounge/', name: 'Planet Express Lounge',
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
    id: 'prismwar', site: 'https://dhseadev.online/projects/prismwar/', name: 'Prismwar', tagline: 'Six colors, one Undertow. An original card battler vs a computer rival.',
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
    /* ext/ is the packaged Chrome extension (same 8 game files + manifest/sw/icons).
     * It lives in the repo so it stops existing only inside a delivered zip, but
     * copyGame copies every entry not named here, so without this drop the whole
     * bundle would be published to /games/prismwar/ext/ on the public arcade. */
    /* package.json is a `{"type":"commonjs"}` marker, not a game file. The repo root declares
       "type":"module", so on Node >=22 require(esm) loads these UMD files as ES modules, the
       `module.exports` branch never runs, and verify-prismwar.mjs dies on `undefined.length` —
       the rules gate could not run at all without it. Dropped so it never reaches the arcade. */
    drop: ['ext', 'package.json', 'Claude outputs'],
  },
  {
    id: 'creature-camp', site: 'https://dhseadev.online/projects/creature-camp/', name: 'Creature Camp',
    tagline: 'Twenty woodland creatures who live together, and tell you about it.',
    seoTitle: 'Creature Camp \u2014 a woodland creature camp in your browser, free',
    seoDesc: 'Look after a camp of hand-drawn woodland creatures who wander, befriend each other and narrate it in an activity feed. Earn the rest of the roster by playing; a playground of tools and minigames sits alongside the camp. Offline, no account, no network.',
    genre: 'Simulation',
    dir: 'creature-camp', entry: 'ui/sidepanel.html',
    /* The launcher layer: sw.js only opens the side panel from the toolbar button,
     * which the URL does on the web. Two source changes are declared in PATCHES.md
     * (MODE falls back to 'full' off-extension; openSurface builds a relative URL)
     * because the shipped tree reached chrome.runtime.getURL and chrome.tabs.create
     * \u2014 neither provided by the storage-only shim, and the side panel's Playground
     * tab was unreachable without them. Its storage goes through vendor/storage.js,
     * which prefers chrome.storage.local when present, so the default shim gives it
     * the namespaced contract verify.mjs holds every entry to. Declares its own
     * viewport and worded <h1>; zero inline handlers. */
    drop: ['sw.js', 'manifest.json'],
  },
  {
    id: 'mosslight', site: 'https://dhseadev.online/projects/mosslight/', name: 'Mosslight',
    tagline: 'An idle healer who cannot attack. Keep the lane alive with six songs.',
    seoTitle: 'Mosslight \u2014 a free idle game where the healer cannot attack',
    seoDesc: 'Keep a line of befriended creatures standing with six songs and one mana pool. 3 regions, 24 roads, 12 friends. Saves in your browser; no account, no network.',
    genre: 'Simulation',
    dir: 'mosslight', entry: 'index.html',
    /* Authored for the web, not ported. `site` is the project page (1648, live
     * 2026-09-20); it feeds the bar's About link and the JSON-LD sameAs.
     *
     * The DEFAULT shim, deliberately. Mosslight calls no chrome.* API, but verify.mjs
     * holds every entry to the namespaced chrome.storage.local contract, so js/ui.js
     * routes its four keys through chrome.storage.local when it exists (hydrated
     * before boot, written through) and through localStorage directly elsewhere.
     *
     * One source tree, two emit targets: this folder is served as-is under
     * script-src 'self'; scripts/build-itch-mosslight.mjs inverts the three
     * arcade-only differences into the single itch file. The folder holds ONLY
     * served files, so there is nothing to drop — keep build and test scripts out
     * of it (build.mjs copies the whole directory to the CDN). */
    drop: [],
  },
];

/* Derived views. Every downstream consumer reads one of these, never ENTRIES
 * directly, so a row can never be counted as a game in one place and an app in
 * another. */
export const GAMES = ENTRIES.filter(e => e.type !== 'app');
export const APPS  = ENTRIES.filter(e => e.type === 'app');

/** Served path of an entry, relative to the site root, with a trailing slash.
 *  The build renames the entry document to index.html in place, so an entry
 *  nested in a subdirectory (lumenreel's ui/app.html, creature camp's
 *  ui/sidepanel.html) is served from that subdirectory. Derived, never typed
 *  twice — the drift this module exists to end. */
export const pathOf = (e) => {
  const sub = e.entry.includes('/') ? e.entry.slice(0, e.entry.lastIndexOf('/')) + '/' : '';
  return `games/${e.dir}/${sub}`;
};

/** The word the served <h1> must contain. Defaults to the name up to its first
 *  em-dash, because several entries carry a subtitle the heading does not repeat.
 *  An entry whose heading genuinely differs sets h1Expect explicitly. */
export const h1Of = (e) => e.h1Expect ?? e.name.split('\u2014')[0].trim();
