# Source patches

The build does not modify game logic. Two games are exceptions, both declared
here, both applied in `src-games/` so the diff is inspectable rather than hidden
inside a build step.

## bloom-rush — persistence added (requested)
The uploaded build had **no persistence of any kind**: zero `localStorage`,
zero `chrome.storage`, every run started from zero. Verified by grep before any
change, not assumed.

- A save/load block was inserted immediately after the `PROFILE` literal, which
  is the single object holding all career meta. Restore runs before the boot
  call at the end of the file, so the title screen paints restored progress on
  the first frame instead of showing zeros and correcting itself.
- The merge only accepts keys the current `PROFILE` already declares, and only
  when the stored type matches the default's type. An older save is therefore
  forward-compatible, and a corrupt value cannot crash boot. Both behaviours are
  asserted in `scripts/verify-bloomrush-save.mjs`.
- Autosave is a 4-second poll that writes only on an actual change, plus
  `pagehide` and `visibilitychange`. A poll rather than hooks inside
  level-complete and achievement code, because hooks would have meant editing
  game logic in several places to catch every mutation.
- The title-screen line "progress lives for this browser session" was corrected
  to "progress saves in this browser". It became false the moment persistence
  landed. **Found by looking at a screenshot, not by grep** — the string is
  drawn to canvas, so a text search of the HTML missed it.
- Its two inline `<script>` blocks were extracted to `game.part1.js` and
  `game.part2.js` so the whole arcade runs under one strict CSP with no
  per-path carve-out. Order preserved; both parse under `node --check`.

## veilfall — security disclosure corrected
Settings told the player "The key is stored in this browser profile's
**extension storage**". On the web that is false, and it understated who can
read the key: every arcade game is served from one origin, so any page on
play.dhseadev.online can read it. Both facts are now disclosed in the copy.

No change to the key handling itself — it was already a password input with
`autocomplete: 'off'`, explicit activation, a remove-key affordance, and no
logging of the key or of prompts.

---

## Planet Express Lounge (app) — 2026-08-21

The first **app** in the arcade, and the first port where the one-shim method did
not hold. Recorded here because three of these are behaviour changes, not
transparent ports, and a reader comparing the web build to the extension will
otherwise find them and assume a bug.

### 1. Its own shim, and the arcade shim is NOT loaded
`shared/chrome-shim.js` covers `chrome.storage` and stubs everything else. Planet
Express calls `chrome.tts.*` and a **real** `chrome.runtime` message bus from
files that ship (`tts.js`, `lab.js`, `sidepanel.js`), and the arcade shim seats a
**no-op** `runtime.onMessage` — present, so a naive guard skips past it, and dead,
so the Dark Matter economy would go quiet with no error anywhere. The build now
takes a `shims:` list per entry and injects only what that entry names.
`pe-web-shim.js` additionally refuses to trust a present-but-noop stub, and that
refusal is asserted in `scripts/verify-pel-shim.mjs` against the real arcade
bytes rather than a stand-in.

### 2. The Dark Matter engine moved out of the service worker — DECLARED CHANGE
`background.js` is a launcher file and is not shipped, but unlike the seven games
it held real state. Ported to `pe-web-background.js`. Two things could not
survive:

- **`chrome.alarms` → timestamp-delta accrual.** The 60s focus tick fired while
  the user browsed. A page stops existing when its tab closes, so a live
  `setInterval` alone would mean a closed tab accrues nothing. Time away now
  accrues, **capped at 8 hours** (`OFFLINE_CAP_MIN = 480`). This is a real change
  to the economy's shape and it wants `/idle-economy-balance` before anyone
  treats the curve as tuned. The clock advances by ticks PAID, not to `now`, so a
  capped absence does not silently burn the remainder.
- **`chrome.action` badge → `document.title`.** There is no toolbar. Autopilot
  state and the DM total appear in the tab title instead.

### 3. The stylesheet was converted, not overridden — DECLARED CHANGE
`sidepanel.html` carried 2,099 lines of inline `<style>` drawn for a 380px panel,
plus 96 inline `style=` attributes on the body. An override stylesheet cannot
reach the 31 of those that set `font-size` — an inline style beats any selector —
so the page would have rendered as a stretched side panel while looking correct
in source. Instead `scripts/convert-css.mjs` (kept with the port bundle, run
once) converted 606 px values to rem, kept 160 hairline 1–2px borders as px, and
hoisted 148 declarations into 40 generated classes carrying `!important` —
which restores the precedence those declarations already had as inline styles
rather than granting them anything new.

The conversion is proven an **identity**: both pages rendered at 380px with the
root pinned to 16px, every element walked in lockstep, **7,770 computed-style
comparisons, 0 differences**, with a deliberately injected difference as the
comparator's control. That gate is one-way and is not in `verify-all.sh` — it
needs the pre-conversion file, which is not in this repo.

`pel-fullscreen.css` is the only layout layer, and it changes layout only.

### 4. CSP widened by four hosts
`connect-src` gained `openrouter.ai`, `generativelanguage.googleapis.com`,
`api.elevenlabs.io` (and reuses `api.groq.com`). That is the largest single
widening this project has made, on an origin holding visitor-supplied keys.
`scripts/verify-llm-egress.mjs` proves the pin BLOCKS an unlisted host, with an
allowed host as the control — the discriminator is the `securitypolicyviolation`
event, because in a sandbox with no egress every fetch fails either way.
`preship.mjs`'s allowlist was updated deliberately: it caught this widening on
the first run, which is the behaviour it exists for.

### 5. Structured data is type-aware
Games stay co-typed `VideoGame` + `WebApplication`. An app is `WebApplication`
ONLY — asserting `VideoGame` on a chat client is a false claim to a search
engine, the same class as the invented `aggregateRating` this project has always
refused to emit. `browserRequirements` differs too: an app with no canvas does
not claim to need one.
