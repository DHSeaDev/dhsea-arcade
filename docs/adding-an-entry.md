# Adding an entry to the arcade

The process a game or app goes through to get onto play.dhseadev.online, written
down after Mosslight went through it on 2026-09-20 (commit `d76f5ff`). Every rule
below is here because something broke without it. The date and the incident are
kept next to each one so it does not get relaxed later for looking arbitrary.

The short version: **an entry is one row in `scripts/entries.mjs` plus a folder
under `src-games/`. Everything else is derived from the row, and every gate runs
on every row with no exemptions.**

---

## 0. What the arcade is

- Static files on Cloudflare Pages, project `dhsea-arcade`, custom domain
  `play.dhseadev.online`. Git-connected: **a push to `main` is the deploy**, and a
  build lands in well under a minute. There is no upload step and no zip.
- One origin shared by every entry. That single fact is behind most of the rules
  below: storage, the security policy and the back control are all shared.
- Two kinds of entry: `type: 'game'` (the default) and `type: 'app'`. The type
  decides the structured data (games are `VideoGame` + `WebApplication`, apps are
  `WebApplication` only) and which section of the index the card sits in.
- Entries arrive two ways: **ported** from a Chrome MV3 extension (most of the
  first eight) or **authored for the web** (Prismwar, Mosslight). The process is
  the same; the survey in step 2 is shorter for an authored entry.

## 1. The row

`scripts/entries.mjs` is the only list. `verify.mjs`, `stress.mjs` and
`verify-seo-headings.mjs` all derive their entry lists from it and assert the
derivation is not lossy. (They each used to carry a hardcoded copy, and Prismwar
was built and deployed without ever being tested because adding a row to the build
did not add it to any gate.)

| Field | Required | Notes |
|---|---|---|
| `id` | yes | also the storage namespace (`<id>:`) and the folder name by convention |
| `name` | yes | the injected `<h1>` uses it, up to the first em dash |
| `tagline` | yes | the index card line |
| `site` | yes | the write-up page on dhseadev.online. The build throws without it. Feeds the bar's About link and JSON-LD `sameAs` |
| `seoTitle`, `seoDesc` | yes | the build throws without them. Keep `seoDesc` at 160 characters or fewer |
| `genre` | yes | |
| `dir`, `entry` | yes | `entry` is the document that IS the entry, never a popup. A nested entry (`ui/app.html`) is served from its subdirectory |
| `drop` | yes, may be `[]` | files the build must not copy. See step 3 |
| `type` | no | `'app'` for a non-game |
| `shims` | no | omit it to get the default storage shim. See step 4 |
| `bundles` | no | per-entry ESM bundles built by `build.mjs` |

The arcade index, `sitemap.xml`, `llms.txt`, the index `ItemList` and every
per-page head block are generated from this table. An entry cannot be listed but
not shipped, or shipped but not listed.

## 2. The survey (before any code)

For a port, find every `chrome.*` call and sort it into launcher layer (popup,
service worker, background: not shipped, the URL replaces them) or game layer
(must work on the web). Across the first eight ports the only game-layer API was
`chrome.storage.local`. Planet Express Lounge broke that pattern with
`chrome.tts` and a real `runtime` message bus, and needed its own shims.

For an authored entry, confirm it calls no `chrome.*` at all:
`grep -c 'chrome\.'` across its source. Mosslight: 0.

## 3. The folder

`scripts/build.mjs` copies the **whole** entry folder into `dist/`. Anything in it
is published.

- Keep build scripts, tests and fixtures out of `src-games/<id>/`. Put them in the
  repo root's `scripts/`. (2026-09-19: Creature Camp's itch build and six gate
  scripts sat inside its game folder, and 44 KB of `.mjs` went out on the CDN.
  `preship.mjs` caught it.)
- Anything that must stay in the folder but not ship goes in `drop`.

## 4. Storage: one namespace per entry, no exemptions

`verify.mjs` asserts, for **every** entry: the shim is installed, a write
through `chrome.storage.local` survives a reload, and some `localStorage` key
starts with `<id>:`. There is no exemption flag, on purpose. The comment above
the check says why: *an entry exempted from the gate is an entry with no gate.*

- A port gets this for free: the shim prefixes every key.
- An authored entry has to use `chrome.storage.local` when it exists and fall back
  to `localStorage` when it does not (itch.io, a local file). `chrome.storage` is
  callback or promise shaped, so read the keys into a cache **before** boot and
  write through on every save. Mosslight's adapter is in `src-games/mosslight/js/ui.js`,
  search for `var kv`.
- Derive the key list from the same constant the UI renders from. (2026-09-20: the
  first Mosslight adapter hydrated slots 0 to 2 while Settings offered 1 to 3. Slot 3
  read as empty after every reload, and the persistence gate passed because it only
  tested slot 1. A three-reviewer panel found it after every gate was green.)
- `verify.mjs` only proves the SHIM round-trips a token it writes itself. If an
  entry has its own storage layer, give it its own gate that exercises the entry's
  own save path (`verify-bloomrush-save.mjs`, `verify-mosslight-save.mjs`).

## 5. The security policy: header AND meta

`public/_headers` sends one CSP for the whole origin (`script-src 'self'`, and a
`connect-src` naming the few hosts Veilfall and Planet Express Lounge need). An
entry may also carry its own `<meta http-equiv="Content-Security-Policy">`.
**Browsers enforce both.** The effective policy is the intersection.

- The intersection can take everything away. Mosslight's itch.io build said
  `script-src 'unsafe-inline'`; the header says `'self'`. Neither an inline nor an
  external script satisfies both, so the page would have loaded as an empty shell.
  The fix was to serve its scripts as files and change its meta to `'self'`.
- The intersection can also narrow what the header allows. Mosslight keeps
  `connect-src 'none'` in its meta, so the game page cannot reach the hosts the
  header permits for other entries. Checked on the live page after deploy: a fetch
  to one of those hosts was refused, citing Mosslight's own `connect-src 'none'`.
- `verify.mjs` serves the CSP parsed from `public/_headers`, so an intersection
  that blocks scripts goes red locally at boot. It cannot see what Cloudflare
  actually sends. That is checked on the live origin (step 9).

## 6. One source tree, several emit targets

An entry that also ships elsewhere (itch.io, a Chrome extension) keeps ONE source
tree here. A second copy drifts.

- Creature Camp: `scripts/build-itch.mjs` emits the itch file from `src-games/creature-camp/`.
- Mosslight: the folder is served as-is; `scripts/build-itch-mosslight.mjs` inverts
  the three arcade-only differences (meta CSP, stylesheet link, script tags) into
  the single itch file. Before the storage change its output was byte-identical to
  the file already on itch, which is the proof the two targets are one source.
- `dist-itch/` is ignored by git and uploaded by hand.

## 7. What the build injects (do not duplicate it)

Ahead of the entry's own markup: the storage shim (unless `shims` says otherwise),
the favicon, the arcade bar CSS and JS, canonical, Open Graph and JSON-LD, a
`<meta viewport>` if the entry has none, and a visually hidden `<h1>` with the
entry's name if the entry has no worded heading of its own. The arcade bar is the
first body child and is the only way out of a canvas game for a keyboard user;
`verify.mjs` asserts it is visible when focused and moves off-screen, never fades,
when hidden.

## 8. Gates, and the rule for new ones

Run from the repo root: `bash scripts/verify-all.sh`. It builds first (a gate run
against a stale build proves nothing) and exits non-zero on any failure.

| Gate | Holds every entry to |
|---|---|
| `verify.mjs` | boot, paint, shim, bar, auto-hide, save across reload, namespace, under the production CSP |
| `verify-seo-headings.mjs` | a worded `<h1>` in the served bytes that names the entry and reaches the accessibility tree |
| `stress.mjs` | link integrity, statics, keyboard reachability, corrupt and sibling storage, storage that throws, resize and reload storms |
| `preship.mjs` | inserted-symbol re-read, CSP pin, published paths, sitemap and `llms.txt` agreement |
| per-entry suites | whatever the entry owns itself (a storage layer, a rules engine, an LLM path) |

**A new gate is not trusted until it has been seen to fail.** Point it at a
build that has the defect and watch it go red on the check that names it, then
green on the fix. `verify-mosslight-save.mjs` takes `MOSSLIGHT_UI=<path>` for
exactly this: the pre-change `ui.js` fails 5 checks, the slots-0-to-2 draft fails
1, a `UI.boot` that throws fails 7 with the error named.

Then look at the page. Rendered, in each theme, at the size it will be played.
Several defects on this site passed every gate and were found only by looking.

## 9. Ship, then check the live origin

1. Commit only named paths. Never `git add -A` here: `Claude outputs/` holds
   signing keys and codes that must not reach a public repo, and working copies
   routinely carry unrelated uncommitted work.
2. Push to `main`. If the push is made from a Claude session, the session may be
   blocked from deploying; the working route is the files written into the local
   clone plus a push script that checks the base commit, stages named paths only,
   asserts the staged count, and fast-forwards.
3. On the **live** origin, logged out and cache-busted: the served CSP header, the
   page's meta CSP, boot, a save that lands under `<id>:` and survives a reload,
   and a fetch the policy should refuse being refused. The local gates cannot see
   the delivery layer.
4. Update dhseadev.online: the entry's project page, `/games/`, `/projects/`,
   `/history/`, and every page that states the arcade's game count. The count
   is written in several places on that site and drifts; sweep them together or
   not at all.

## 10. What is not covered yet

- No gate reads the arcade count on dhseadev.online, so it drifts every time an
  entry is added. On 2026-09-20 the site said eight, nine, and "All nine games"
  beside an "8 GAMES" chip on the same card, while the arcade served ten games.
- Mobile layouts are checked in a headless browser at phone widths, not on
  phones.
