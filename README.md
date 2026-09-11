# DHSeaDev Arcade

Seven browser games and one browser app, deployed as static files to Cloudflare Pages at
**play.dhseadev.online**.

Every game here started as a Chrome MV3 extension. None of them were rewritten.

---

## How it works

Extension games need three things a web page does not give them: a `chrome.*`
API, a launcher, and a service worker. This repo supplies the first and deletes
the other two.

**`shared/chrome-shim.js`** makes `chrome.storage.local` exist, backed by
`localStorage` and namespaced per game. That is the entire compatibility layer.

A survey of all eight sources found every non-storage `chrome.*` call —
`tabs.create`, `runtime.getURL`, `sidePanel.*`, `action.onClicked`,
`runtime.onInstalled`, `windows.update`, `alarms` — lives **only** in launcher
files (`popup.js`, `sw.js`, `background.js`) whose sole job was to open the game
page from a toolbar button. On the web the URL does that, so those files are not
shipped and their APIs are never called.

**Game source is unmodified**, with two declared exceptions in
[`PATCHES.md`](PATCHES.md).

### Why a shim instead of patching each game

Three of the four extensions already had a non-`chrome` fallback, and every one
of them was *worse* than the chrome path: Veilfall fell back to an in-memory Map
(saves die on reload) and Underglory's fallback was a stub returning `false`
forever. Making `chrome.storage.local` exist means each game takes the path it
was actually shipped and tested on.

### No bundler

ES modules and classic scripts both work natively over HTTP. The base64-payload
technique used for the WordPress ports existed only to defeat WordPress's media
content-sniffing. Pages serves the folder.

---

## Layout

```
src-games/          extension sources, as uploaded (plus the two declared patches)
shared/             chrome-shim.js · arcade-bar.{js,css} · index.template.html
public/             _headers · _redirects · robots.txt · favicon.svg
scripts/            build.mjs · verify*.mjs · verify-all.sh
dist/               build output — this is what Pages serves
```

`dist/` is generated. Do not edit it; edit `src-games/` or `shared/` and rebuild.

## Commands

```bash
npm install          # playwright, for the verification gate only
npm run build        # -> dist/
npm run verify       # every gate; non-zero exit on any failure
npm run serve        # local preview on :8099
```

---

## The verification gate

`npm run verify` is not a smoke test. For every game it asserts:

| Check | Why it exists |
|---|---|
| boots with zero console/page errors | — |
| **serves under the production CSP** | a game verified without it is verified against a server that does not exist |
| painted something real | a blank page has no errors either |
| shim installed, and not a real extension context | proves the web path is what ran |
| **write → reload → read back** | a write that lands in memory looks identical to one that lands in localStorage; only the round trip separates them |
| keys are namespaced per game | eight entries share one origin |
| arcade bar present | — |

Plus two targeted suites: Bloom Rush's own persistence layer (round trip,
corrupt-save rejection, forward compatibility) and the `llm-security` gate on
Veilfall's Groq path.

External requests (Google Fonts) are reported as environmental rather than
counted as failures, because the build sandbox has no egress. Anything failing
from our own origin is a defect.

---

## Security posture

Strict CSP, and it is cheap here: a source audit found zero inline event
handlers, zero `eval`, zero `new Function`, and zero Workers across all eight
games — MV3 already forbade them, so the games were written without them. Bloom
Rush's two inline `<script>` blocks were extracted to files so it needs no
carve-out either.

```
script-src 'self'; object-src 'none'; base-uri 'self';
form-action 'none'; frame-ancestors 'none';
connect-src 'self' https://api.groq.com
```

`api.groq.com` is named because Veilfall's optional Tier 2 posts to it with the
**player's own key**. It is the only egress destination any game has, and
pinning it means a future dependency cannot quietly add one. The gate proves the
pin holds by attempting an exfiltration fetch to another host and asserting it
is blocked.

**One posture change worth knowing.** In the extension the Groq key lived in
extension-private storage. Here it lives in `localStorage` on an origin shared
with six other games, so any page on this site can read it. That is disclosed to
the player in Veilfall's settings rather than left implicit.

---

## Deploying

1. Push this repo to GitHub.
2. Cloudflare Pages → **Create a project** → **Connect to Git** → pick the repo.
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Pages → **Custom domains** → add `play.dhseadev.online`, and add the CNAME it
   gives you to the DNS for `dhseadev.online` (managed at WordPress.com).

`_headers` and `_redirects` are read from `dist/` automatically — no dashboard
configuration for either.

---

## Adding a game

Add its source under `src-games/<id>/`, then one row in the `GAMES` table in
`scripts/build.mjs`: `id`, display `name`, `tagline`, `entry` (the document that
*is* the game — never the popup), and `drop` (its launcher layer).

The arcade index and `sitemap.xml` are both generated from that table, so a game
cannot be shipped-but-unlisted or listed-but-shipped-nowhere. Then run
`npm run verify`.
