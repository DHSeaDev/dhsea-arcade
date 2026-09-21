# DHSeaDev Arcade

Browser games and apps, deployed as static files to Cloudflare Pages at
**play.dhseadev.online**. The list of what ships is `scripts/entries.mjs`, and every count
(index, sitemap, `llms.txt`, JSON-LD) is derived from it, so no number is written here.

Most entries started as Chrome MV3 extensions and were not rewritten. Prismwar and
Mosslight were written for the web. **To add one, follow
[`docs/adding-an-entry.md`](docs/adding-an-entry.md)**, which is the whole process with
the incident behind each rule.

---

## How it works

Extension games need three things a web page does not give them: a `chrome.*`
API, a launcher, and a service worker. This repo supplies the first and deletes
the other two.

**`shared/chrome-shim.js`** makes `chrome.storage.local` exist, backed by
`localStorage` and namespaced per game. That is the entire compatibility layer.

A survey of the eight original sources found every non-storage `chrome.*` call —
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
| keys are namespaced per game | every entry shares one origin |
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
handlers, zero `eval`, zero `new Function`, and zero Workers across the eight
original games — MV3 already forbade them, so the games were written without them. Bloom
Rush's two inline `<script>` blocks were extracted to files so it needs no
carve-out either.

The policy of record is `public/_headers`, and `verify.mjs` parses it from there so the
two cannot drift; it is not copied here for the same reason. `connect-src` names each
third-party host and the entry that needs it (Veilfall's optional Tier 2 and Planet Express
Lounge, both with the **player's own key**), so a future dependency cannot quietly add
one.

An entry may also carry its own meta CSP, and **the browser enforces both**: the
effective policy is the intersection. That can remove everything (an inline-script policy
intersected with `script-src 'self'` allows no script at all) or narrow what the header
allows (Mosslight's meta keeps `connect-src 'none'`). See `docs/adding-an-entry.md` §5. The gate proves the
pin holds by attempting an exfiltration fetch to another host and asserting it
is blocked.

**One posture change worth knowing.** In the extension the Groq key lived in
extension-private storage. Here it lives in `localStorage` on an origin shared
with every other entry, so any page on this site can read it. That is disclosed to
the player in Veilfall's settings rather than left implicit.

---

## Deploying

**Today a push to `main` is the deploy** (Pages is Git-connected, automatic deployments on).
The steps below are how the project was first set up.

1. Push this repo to GitHub.
2. Cloudflare Pages → **Create a project** → **Connect to Git** → pick the repo.
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Pages → **Custom domains** → add `play.dhseadev.online`, and add the CNAME it
   gives you to the DNS for `dhseadev.online` (managed at WordPress.com).

`_headers` and `_redirects` are read from `dist/` automatically — no dashboard
configuration for either.

---

## Adding a game or app

Follow [`docs/adding-an-entry.md`](docs/adding-an-entry.md). In one line: a folder under
`src-games/<id>/` holding only served files, one row in `scripts/entries.mjs`, then
`bash scripts/verify-all.sh`. Every gate derives its list from that table, so a row cannot
be shipped untested, and there are no per-entry exemptions.

## Links back to dhseadev.online (added 2026-09-01)

Every entry row in `scripts/entries.mjs` carries a required `site` — its showcase page on
dhseadev.online. The build refuses a row without one. It is used three ways:

- the game's JSON-LD carries `sameAs: [site]`, tying the arcade node to the write-up;
- the arcade bar gets a second link, **About**, to `site?utm_source=arcade&utm_medium=bar`
  (second link on purpose — the first tab stop is still the exit);
- the index carries a static cross-promo section for the two Chrome extensions
  (Annoying Dino, Dota Companion) with `utm_source=arcade&utm_medium=promo` on the
  About links. Those cards are not entries: not counted, not rated, not shimmed.

## `/embed/annoying-dino/` (added 2026-09-01)

Not an arcade entry. `public/embed/annoying-dino/dino.js` is the unmodified page engine
from the Annoying Dino 2.0.0 store package; dhseadev.online's Dino project page and Dino
devlogs load it (after `/shared/chrome-shim.js` with `data-game-id="annoying-dino"`) so
the real dinosaur runs on those pages. See the README.txt beside it.
