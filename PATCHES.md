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
  accrues, **capped at 8 hours** (`OFFLINE_CAP_MIN = 480`); beyond the cap the
  remainder is **forfeited** and the clock jumps to now. This is a real change to
  the economy's shape and it wants `/idle-economy-balance` before anyone treats
  the curve as tuned.

  **Correction, same day.** The first version advanced the clock only by the
  ticks it PAID, on the reasoning that carrying the remainder forward was more
  honest than burning it — and this file said so. That made the cap a
  per-settlement RATE LIMIT rather than a cap: `settleOfflineAccrual` re-runs on
  every `visibilitychange`, so a 30-day absence could be drained by alt-tabbing
  ~90 times — thousands of DM in a minute, trivially clearing the 150 DM
  Mega-Invention. Found by adversarial review, which also flagged that the
  declaration above was inaccurate about what the code did. Both are fixed;
  `verify-pel-shim.mjs` now settles a 30-day gap 25 times and asserts the total
  stays inside a single capped payout.
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


### 5b. Dark Matter curve, tuned against the sinks — DECLARED CHANGE
`/idle-economy-balance` was run on the relocated economy. The check that matters
most **passes**: no path is DM-positive (generate −25 → scrap +10 = −15; five
inventions −125 → five scraps +50 → one free recycled, scrapping it +5), so cost
dominates benefit and there is no loop. Two web-specific findings were acted on:

- **`OFFLINE_CAP_MIN` 480 → 90.** The 8h cap came from that skill's generic 6–12h
  band without being checked against THIS app's sinks. All the content costs ~400
  DM (ten inventions at 25 plus one Mega at 150); an 8h cap paid ~1920 per return
  — five times everything there is to buy, which makes the Lab's only two
  decisions free forever. 90 minutes pays ~360, about one meaningful purchase.
- **`FIRST_VISIT_SEED = 30`, new.** In the extension the alarm ticked all day in
  the background, so DM existed before the panel was ever opened. On the web a
  first load is 0, the cheapest Lab action costs 25, and the tick pays ~4/min —
  so a new visitor faced an inert "GENERATE INVENTION (25 ⚛)" for six minutes.
  The seed is keyed on the absence of a tick timestamp, NOT on a zero balance, so
  a visitor who has legitimately spent down to zero is never re-seeded.

Both are asserted in `verify-pel-shim.mjs`, and the cap gate now derives its
ceiling from the shipped constant rather than a literal — a cap change must not
be able to silently loosen its own gate.

### 6. Review findings, and the gates that now cover them
An adversarial review panel (three independent reviewers — correctness, security,
first-run/a11y — each given the contract without the author's reasoning) ran after
all four suites were green. It found defects every one of those suites passed.
Each fix below is paired with the gate that would now catch it, because a defect
a review finds and no gate covers means the gate set was incomplete.

- **Both shim files were injected TWICE** — written by hand into `app.html` AND
  injected by `build.mjs`, which inserts after `<head>` without checking for an
  existing tag. Two DM engines double-charged every spend, two tickers ran, and
  `__PE_SHIM__` was rebound to a dispatcher with an empty listener set, so every
  `dm_update` broadcast reached nobody. That is precisely the silent-economy
  failure `pe-web-shim.js`'s own header claims to defend against, arriving by a
  route the header did not consider. Tags removed; both files now carry an
  idempotency guard. → `verify-pel-shim.mjs` §6a.
- **The cap did not cap.** See §2 above. → `verify-pel-shim.mjs` §6b.
- **`settleOfflineAccrual` had no re-entrancy guard** — boot racing a
  `visibilitychange` paid the same gap twice. Busy flag set before the first
  await, cleared in `finally`.
- **The tab strip was not keyboard-operable at all.** Five `<div class="tab">`
  with `tabIndex -1`, no role. On the web that is a dead end rather than an
  annoyance: SETTINGS is the only place to enter an API key, so a keyboard-only
  visitor could never make the app work. Now a roving-tabindex tablist with
  arrows, Home/End and Enter/Space, in `pel-web-enhance.js` — activation
  delegated to `.click()` so `sidepanel.js` stays the single source of truth.
  → NEW gate `verify-pel-a11y.mjs`.
- **Form controls had no accessible name.** Every `.field` carries a bare
  `<label>` with no `for`; the caption was always there and simply never
  associated. Wired with `for`/`id` rather than copied into an `aria-label`.
  → `verify-pel-a11y.mjs`.
- **Connecting a key dropped the visitor into an empty black panel.** The demo
  transcript is cleared and nothing replaced it. Now an empty state — a class
  from `pel-web-enhance.js`, copy in CSS, so nothing is ever inserted into
  `#chatlog`, whose children `sidepanel.js` owns.
- **The chip overlapped the header between 40rem and 52rem.** The indent
  breakpoint had been set narrower than the chip itself. Only the MIDDLE of the
  three tested widths was broken — 1600 had room, 390 pushed the app down, 820
  did neither.
- **The composer floated at ~220px in a 1345px panel** — the 74ch measure was
  capping the row without letting the field fill it.
- **`document.title` clobbered the build's SEO title** with a hardcoded string.
  Now read from the document.
- **`preship.mjs` check 6 was blind to the widest widenings.** Its host regex
  requires `//`, so `https:`, `*` and `data:` were invisible — `connect-src 'self'
  https: * https://api.groq.com` printed "1 pinned hosts, all expected". A
  wildcard/scheme scan now runs first, and was proved to FAIL on that exact
  string before being trusted.
- **`verify-llm-egress.mjs` claimed more than it can prove.** It sets the CSP
  header on its own server, so it cannot see a delivery-layer failure — the very
  case its docblock cited. The limits are now written into the file, along with
  the two residual channels connect-src does not close (laundering through a
  listed host; top-level navigation).

Not fixed, recorded as accepted: the Gemini key travels in a URL query string
(pre-existing, `llm.js`); `escHtml` does not escape quotes (no attribute-context
use today); five BYOK keys share one origin's `localStorage` with seven games,
which is the shape of a static multi-app origin and not something a shim can fix.

**Three of the review's own findings turned out to be defects in its probes, not
in the app** — an "unfocusable API key field" was the probe grabbing a collapsed
spoiler's input three different ways (`offsetParent`, then `getBoundingClientRect`,
then finally `checkVisibility()`). `#groqKey` was correct throughout. The
registry's harness-bug-reads-as-app-bug class, live again.

---

## The arcade back control now auto-hides — all 8 pages, 2026-08-21

Reported against Veilfall: the bar sat on top of a real control in the top-left
corner, so that control could not be clicked at all. A fixed overlay that never
moves is a hitbox over someone else's UI, and it was on every page.

It now reveals for 3.5s on arrival — so the way out stays discoverable — then
slides away. Coming back: pointer within 240x72px of the corner (passive
`mousemove`), keyboard focus, or a tap on a 150x10px strip on touch devices,
which have no hover and would otherwise have no way to ask for it.

**Hidden by TRANSFORM, and the alternatives were rejected for specific reasons:**
- `opacity` would repeat the regression this bar already had to undo once — it
  shipped at `opacity: .35`, which made the only exit effectively invisible and
  put its text under the contrast floor. A faded control is worse than an absent
  one because it still looks available.
- `display:none` / `visibility:hidden` remove it from the TAB ORDER, and this is
  the only exit from a full-viewport canvas game. **The gate catches this** —
  verified by shipping it deliberately: "focus does NOT bring the arcade bar back
  on screen — keyboard users lose the only exit."

The reveal-on-focus rule is plain CSS (`:focus-within`), not JavaScript, so the
exit survives `arcade-bar.js` failing or being blocked entirely.

`verify.mjs` gains an `autohide` check on all 8 pages: it collapses unprompted,
the corner belongs to the page again, and focus brings it back on screen at full
opacity. State is read from `data-state`, not timed, so the gate cannot go flaky
on an animation.

**One honest correction.** The first sabotage run removed `pointer-events:none`
and the gate stayed GREEN — and that was correct, not a hole: once the transform
lands the bar is not under the cursor at all, so an offscreen element intercepts
nothing and the sabotage was never a regression. Removing the TRANSFORM is the
real regression, and that does turn the row red (verified). `pointer-events:none`
stays for the ~220ms slide and for a browser that ignores the transform — belt
and braces, and the gate's comment now says so instead of taking credit for work
it does not do.

Planet Express reclaims its header gutter the same way: the 12rem indent is now
`#arcade-bar[data-state="revealed"] ~ .app .header`, a general-sibling selector
reading the bar's own state, so there is no second timer to drift out of sync.

### Correction, same day: the bar hides by `top`, not `transform`
The first cut hid by `transform: translateY(-110%)`. It passed `verify.mjs` on all
eight pages in headless Chromium — and then did **nothing at all** on the live
Veilfall page.

Diagnosis, on the deployed origin: `getAnimations()` reported a `CSSTransition`
with `playState: "running"` and a **null `currentTime`** — a transition stuck in
its "before" phase forever, pinning the computed value to the from-state. Even an
**inline** `translateY(-200px)` computed to the identity matrix. Setting
`transition: none` made the identical transform apply instantly, which isolates
it to the transition, not the transform.

Movement is now on `top` — a layout property, no compositor involvement, and it
moved the bar correctly on the very page where transform would not.
`will-change: transform` is gone with it. `-200px` rather than `-100%` because a
percentage `top` on a fixed element resolves against the VIEWPORT, not the
element. `!important` because this bar is injected into eight codebases it does
not control.

**The gate could not have caught this, and that is the point worth keeping.**
Headless Chromium ran the transition normally, so the container was green on
genuinely broken code. The runtime of record for a CSS transition is a real
browser on a real page, and the only thing that found it was checking the live
origin after deploying. Post-deploy verification is not a formality here.

### Correction to the correction: the transform diagnosis was wrong
The note above says the transform hide "did nothing at all on the live Veilfall
page" and blames a stuck transition on `transform`. **The observation was real;
the cause was misattributed, and the switch to `top` was made for a reason that
does not hold.**

The tab being inspected was BACKGROUNDED: `document.visibilityState === "hidden"`,
`requestAnimationFrame` never firing, `document.timeline.currentTime` advancing
`0ms` across a 600ms wait. Chrome freezes the animation timeline in a background
tab, so **no** transition of **any** property advances and every transitioned
value reads as its from-state. Switching to `top` produced the identical symptom
— which is what finally exposed it. A screenshot, which forces a real render,
shows the bar correctly hidden and Veilfall's corner control fully exposed.

Both properties work. `top` is kept because it is deployed and correct, not
because it is better — `transform` is the conventional choice and would be fine.

The durable lesson is about the instrument: **a computed style read from a
background tab says nothing about a transition.** Check `document.visibilityState`
before trusting one, exactly as a benchmark is validated before its numbers are.
This is the harness-bug-reads-as-app-bug class again, and this time it survived
two rounds of diagnosis before being caught.

---

## Every entry now announces its own name — 2026-08-21

Four entries shipped **no `<h1>` at all**. Two of those are pure canvas, where the
title is *painted* — so it does not exist to a crawler or a screen reader, and
the page announced itself as nothing. Underglory had five `<h2>` under no `<h1>`,
which is a broken outline rather than a missing nicety.

`scripts/build.mjs` now injects a visually-hidden `<h1>` carrying the entry's own
`name` from the ENTRIES table. **At build time, into the served bytes** — an
answer engine that does not run JavaScript is exactly the visitor this is for.
The text is the real name, so this is a machine-readable label for a page that
already is what it says; anything else there would be cloaking.

**"Has an `<h1>`" is not "has a page heading", and two entries proved it.**
Emberkeep's `<h1>` is the live room label and ships as `1.`; Mountain's is the
chapter numeral `I.`. Those are HUD readouts that happen to be marked up as
headings — a presence check scores both as fine while the page tells Google it is
called "1.". The test is therefore whether the served heading contains real
WORDS: strip non-letters, require three. `1.` → `""` and `I.` → `"I"` both fail;
`Veilfall` passes. Those two pages now lead with a proper name and keep their HUD
heading, which is legal HTML5 and strictly better than a numeral being the only
heading. The correct fix belongs in those games — a HUD readout should be a
`<div>` — and is recorded rather than silently patched, because this port does
not edit game source.

**Hidden by the clip-rect pattern, never `display:none` or `visibility:hidden`.**
Both of those remove the text from the accessibility tree *and* are discounted by
search engines, which would make the heading decorative and pointless — invisible
to people and to machines at once. The gate asserts the distinction rather than
trusting it.

New gate `scripts/verify-seo-headings.mjs` (36 checks), wired into
`verify-all.sh`: served bytes carry a worded `<h1>`, the leading one names the
entry, and the hidden heading has zero visual footprint while still resolving via
`getByRole('heading')` — which reads the accessibility tree, so a heading it finds
is one a screen reader can announce. **Proven to fail** by reverting the build to
a naive presence check: Emberkeep immediately goes red with `first: "1."`.

Underglory's injected `h1` duplicates an existing `h2` of the same name (the gate
reports `2 match`). Harmless, and the outline is now correct; promoting that `h2`
instead would mean editing game source.

## 2026-09-10 — Prismwar seated as entry #9; three gates had hardcoded entry lists

- **New entry `prismwar`** (`src-games/prismwar/`, authored for the web, not ported). Uses the default
  arcade shim for the storage contract only; touches no `chrome.runtime`.
- **`verify.mjs`, `stress.mjs`, `verify-seo-headings.mjs` each carried their own copy of the entry
  list**, so a new ENTRIES row was built, listed in the sitemap and llms.txt, and never tested by
  three of the gates. Prismwar added to all three. The lists should be derived from `build.mjs`'s
  ENTRIES table; left as a follow-up because it changes three files' import shape.
- **`verify.mjs` gate false positive**: an external WebSocket failure (playhtml's party server)
  logs a console error the external-host filter never saw, so ARCADE INDEX went red in a sandbox
  with no egress. Routed to the environmental bucket; a `ws://localhost` failure is still an error.

## 2026-09-18 — Creature Camp seated as entry #10; the four hardcoded entry lists retired

### The follow-up from 2026-09-10, done

`scripts/entries.mjs` is now THE table. `build.mjs` imports `ENTRIES`/`GAMES`/`APPS`
from it, and every consumer derives its own view:

| consumer | was | now |
|---|---|---|
| `verify.mjs` | 9 hardcoded `[id, url]` rows | `ENTRIES.map(e => [e.id, pathOf(e)])` |
| `stress.mjs` | 10 hardcoded `[id, url]` rows | `['index','/']` + derived |
| `verify-seo-headings.mjs` | 9 hardcoded `[id, url, expect]` rows | derived, `expect` from `h1Of(e)` |
| `shots.mjs` | **8** hardcoded rows — already stale | derived |

`shots.mjs` is the proof the class was still live: it had never been updated for
Planet Express Lounge or Prismwar, so two shipped entries were never screenshotted
and nobody noticed, because nothing compares that literal to anything.

`pathOf` derives the served path from the entry document's own directory, so
`lumenreel` (`ui/app.html`) and `creature-camp` (`ui/sidepanel.html`) land at
`games/<id>/ui/` without a second place to type it. `h1Of` defaults to the name up
to its first em-dash; the only row whose assertion changed is Planet Express Lounge,
which tightened from `Planet Express` to the full `Planet Express Lounge` and passes.

**Instrument proof, run before any of this was trusted:**

- Drop the `creature-camp` row → seo-headings 40 → 38, stress 11 → 10 shards. The row
  is genuinely iterated, not merely present.
- Break `pathOf` for one entry → `verify.mjs` reports `FAIL creature-camp boot`,
  `verify-seo-headings.mjs` exits 1 on ENOENT. A wrong derived path fails loudly
  rather than being skipped.
- Empty the table → all three guards exit 1. **`stress.mjs`'s guard did NOT fire on the
  first attempt**: `PAGES.length !== ENTRIES.length + 1` is satisfied when both are
  empty, so the battery ran the index page alone and printed `0 BLOCK`. A gate whose
  emptiness check is two derived numbers compared to each other is a vacuous pass.
  Fixed to `!ENTRIES.length || …` and re-proven.

### Creature Camp source patches (declared)

Two changes to `src-games/creature-camp/ui/app.js`. Both exist because the shipped
tree reached non-storage `chrome.*` APIs — the port's founding finding does not hold
for this entry, and the handoff that said otherwise was wrong on the bytes.

1. **`MODE` falls back to `full` off-extension.** It was `get('mode') || 'panel'`.
   At `/games/creature-camp/ui/` with no query string the app rendered as a *side
   panel*: `#tab-play` stayed `hidden` and the whole Playground was unreachable. The
   test is `globalThis.chrome?.runtime?.id`, the same one `vendor/storage.js` already
   uses to pick its backend.
2. **`openSurface()` no longer assumes `chrome.runtime.getURL`.** It called
   `chrome.runtime.getURL(...)` unguarded and then `chrome.tabs.create`. Neither is
   provided by `shared/chrome-shim.js`, so both buttons would have thrown. It now
   resolves a relative URL against `location.href` and falls back to `window.open`.
   `body.full` already hides both buttons via CSS, so on the web this path is
   currently unreachable — it is fixed anyway, because a shipped call to an API the
   shim does not provide is the present-but-dead class this project has paid for once.

Storage needs no patch: `vendor/storage.js` prefers `chrome.storage.local` when
present, so the default shim gives it the namespaced contract `verify.mjs` enforces.

### Looked at, not just gated

`body.full`, six tabs including Playground, `btn-window` `display:none`, `<h1>`
"Creature Camp", `#arcade-bar` as first body child, zero page errors at 1280x900 and
390x844. The stress battery's `[UNVERIFIED]` exit-reachability WARN was chased down:
on load the first-run arrival card traps focus (correct for a modal), **Escape
dismisses it**, and the first Tab from `<body>` then lands inside `#arcade-bar`. A
first probe reported the exit unreachable — it was matching ids against the substring
`arcade` and the exit link has no id. Harness bug, caught by adding a control that
forces focus onto the link and confirms the probe can see it.

## 2026-09-18 (later) — two layout defects found by stress-testing the LIVE arcade

Both are `body.full` only: the extension's side panel never sets that class, and
`?mode=panel` was re-tested at 360px and 400px with the tab strip hit-testing correctly,
so nothing on the Chrome Web Store is affected. Both arrived with the web port.

### 1. BLOCKER — every tab was dead to mouse and touch below 760px

`@media (max-width: 760px)` set `body.full #pane-camp > .stage { position: static }`.
`.scene-wrap` (and its `svg`) are `position: absolute; inset: 0`, so the stage was their
containing block — until that media query removed it. The scene then resolved against the
initial containing block and painted across the tab strip at y=96, swallowing every click.

Measured on the live arcade before the fix: a real `mouse.down`/`mouse.up` on the centre of
`#tab-play` at 700px left `aria-selected="false"`; the same click at 900px worked.
`document.elementFromPoint` on the tab's centre returned `rect → svg → #scene.scene-wrap →
#stage → #pane-camp → #main`. Keyboard still worked (ArrowRight selected the tab), so this
was pointer-only — which on a phone means the app has no navigation at all.

Fixed by `position: relative`, which un-sticks the stage exactly as `static` did while
keeping it a containing block. **Proven able to fail**: re-injecting `position: static`
into the built page at 700px puts `aria-selected` back to `false`.

### 2. The creature panel dropped below the stage — triggered by a dew drop, not by width

`.stage-hint` is pinned to `grid-column: 1` and is only in the DOM while a dew drop is in
camp. Under sparse auto-placement its arrival opened row 3 in column 1, and the
auto-placed `#care` could no longer be put back in row 2 column 2 — so it landed in row 3
column 2, beneath the stage. Revealing that one hint at 1073px moved `#care` from y=114 to
y=511 and grew the pane from 649px to 1047px; an outline-only control moved nothing.

Two intermediate attempts are recorded because each failed in an instructive way:
`grid-auto-flow: dense` fixed `#care` but scattered the two bottom cards into opposite
columns; pinning only the stage, hint and `#care` then let both cards jump to the empty
row 1 and pushed the whole camp below the fold, because `#care` no longer advanced the
placement cursor. **Every item in this grid is now explicitly placed** — ticker row 1,
stage row 2, hint row 3, `#care` rows 2-3, the two cards row 4 — so no game-state change
can reshuffle it again.

Pane fill at 1073px in the dew state: **50% → 77%**, and the layout is now byte-identical
with the hint shown or hidden (`#care` delta 0 at every width from 820 to 1440).

## 2026-09-18 (third pass) — the Playground tab was not the Playground

### The tap tools did nothing when you clicked a friend

`PLAYGROUND` is `MODE === 'playground'` — the dedicated `?mode=playground` surface, decided
once at load from the URL. In the web build the playground is ALSO a tab over the same stage
(`body.pg`, set in the tab handler), and three runtime guards were written against that
load-time constant:

| line | guard | consequence in the tab |
|---|---|---|
| actor click | `if (PLAYGROUND) pg?.useOn(...)` | clicking a friend called **nothing** |
| `renderAll` | `if (PLAYGROUND) { pg?.render(); return; }` | the playground never took the render path |

So Hand, Snack and Ball were inert in the tab, while the scrub tools (Soap, Cloth) still
worked because they bind to `stage` pointer events in `playground.js`, not to the actor click
in `app.js`. That asymmetry is exactly what it looked like from the outside: "clicking on the
creatures with soap and other tools does not present their animations."

Fixed with `pgOn() = PLAYGROUND || document.body.classList.contains('pg')` on the two RUNTIME
guards. The load-time guards still ask about `MODE`, because they are about which surface
booted, not about what is showing.

Measured on the built page, using the creature's own `cares` counter in the save as the
signal (the first probe counted passive per-tick stat drift as a hit and had to be tightened):
`pet` 0 -> 1 and `snack` 1 -> 2 on a plain mouse click, where both were flat before.

### The empty band under the stage — an empty row sized itself to a spanning item

`#care` was `grid-row: 2 / span 2`. The hint row it spanned into sized itself to the spanning
item whenever the hint was absent: measured at 1232px, **row 3 was 192.75px tall with the hint
hidden and 26.8px with it shown** — dead space that appeared when there was LESS to display,
which is why the first screenshot had a band the second did not. `#care` now occupies row 2
only and the hint keeps row 3 to itself: row 3 is 0px hidden, 27px shown.

### Still open, measured but not fixed
- **Ball** registers no `cares` increment on a click in two runs. Pet and Snack do, so the
  click path reaches the playground; this looks like its own gate (energy or chase state),
  not the guard bug. Not chased.
- **Soap by drag** applied cleanly in one pre-patch run (`clean` 70 -> 100, suds set) and not
  in two later ones. The scrub only counts while `elementFromPoint` stays over the SAME actor,
  and friends wander during the scrub — a likely cause, unproven. **[UNVERIFIED]**
- **Lost progress could not be reproduced.** The save survives a reload and a new page in the
  same profile (`creature-camp:creaturecamp_save_v1`, name and moment count intact). A second
  open surface does open READ-ONLY behind the writer-lock banner, and `apply()` returns early
  on `readOnly`, so playing in the second surface would be silently discarded — the most
  plausible mechanism, but not confirmed as what happened.

## 2026-09-18 (fourth pass) — the ball orbited the stage, and Soap ignored a click

### The ball flew diagonally across the screen, on repeat

`.fx-ball` is POSITIONED by its own `transform: translate(...)` and was ALSO given
`rotate: 360deg` by `ball-roll`. The individual `rotate` property composes with that
translate rather than spinning the ball in place, so the ball swept a circle whose radius is
however far it had been thrown — across the stage and back, every 0.5s, forever.

Measured on the live build with a control, because two earlier theories about this were wrong
on reading (`ball-roll` animates `rotate`, not `transform`; `.pg-cursor` is already
`pointer-events: none`):

| state | x-span | y-span |
|---|---|---|
| `.rolling` on, as shipped | 1023px | 1027px |
| `.rolling` removed | **0px** | **0px** |
| `.rolling` re-added | 1244px | 1239px |

The spin now lives on an inner `.fx-ball-skin`, which carries no positioning of its own, and
the ball's paint moved there so the rotation is still visible as the highlight orbiting.
After: **0px / 0px** position span with the skin still spinning (12 distinct `rotate` values
sampled).

### Soap and Cloth did nothing at all when you clicked a friend

The scrub tools' `pointerdown` handler calls `e.preventDefault()`, which suppresses the
compatibility `click` — so the actor's click listener, and therefore `useOn()`, never ran for
a mouse press with Soap or Cloth. Dragging worked and the keyboard worked; a plain click
produced no lather, no bubbles and no feedback whatsoever.

A press that never travels far enough is now treated as one tap-sized scrub, applied in
`endScrub()` where the pointer actually is. Measured on one mouse click with Soap:
`clean` 70 -> 80, `sudsUntilMs` set, and **4 `fx-bubble` particles** spawned — against
nothing at all before.

Two harness faults were corrected on the way, both of which would have produced a false
result: the first soap probe never actually selected Soap (it measured the previous tool and
saw `fx-spark`), and an earlier "changed" predicate counted passive per-tick stat drift as a
hit. The probe now asserts `aria-checked` on the tool before it measures anything.

### Closed
Progress persistence — Donnie confirms saves are working. The earlier read-only writer-lock
suspicion is withdrawn, not proven.

## 2026-09-20 — Mosslight seated as entry #11 (the 10th game)

Mosslight is authored for the web, not ported from an extension, and until now its only
build was a single self-contained file for itch.io (0.3.0, live at
https://dhseadev.itch.io/mosslight). `src-games/mosslight/` is now its one source tree.

### Why the itch file could not simply be copied in

The itch file carries a meta CSP of `script-src 'unsafe-inline'`. This origin's header is
`script-src 'self'`. A browser enforces **both**, and `'unsafe-inline'` ∩ `'self'` permits
neither an inline script nor an external one: the page would have rendered as an empty shell
with every one of its five scripts blocked. `verify.mjs` would have caught it at boot — it
serves the CSP parsed from `public/_headers` — but the fix had to come first.

The served folder therefore holds the source as separate files (`index.html`, `style.css`,
`js/{data,engine,art,audio,ui}.js`) under a page CSP of `script-src 'self'` that still keeps
`connect-src 'none'`. The header allows five hosts for other entries; intersection takes the
stricter value, so the listing's "no network calls" claim holds on this origin too.

`scripts/build-itch-mosslight.mjs` inverts the three arcade-only differences to emit the itch
file. **Equivalence was proven, not asserted:** before `ui.js` changed, its output was
byte-identical to the shipped 0.3.0 file (sha256 `c73af6eb4c2832c8`), and `--expect=<sha>`
fails on a mismatch (checked with a deliberately wrong sha).

### The one source change: storage

`verify.mjs` holds every entry to the namespaced `chrome.storage.local` contract and there is
no exemption — by design. Mosslight used `localStorage` directly with bare keys
(`mosslight.save.v1`, `…:slot1..3`), which fails `shim`, `saves` and `ns`, and a bare key is
exactly the collision the namespace exists to prevent on a shared origin.

`js/ui.js` now routes its four keys through a small adapter: when `chrome.storage.local`
exists it is read into a cache **before** `UI.boot` and every write goes through; without it
(itch, a local file) the code path is the 0.3.0 one. The key list is derived from a single
`SLOTS` constant that the Settings panel also renders from.

### Found by a three-reviewer panel after every gate was green

- **BLOCKER:** the first draft hydrated slots 0–2; the UI offers 1–3. Slot 3 read as empty
  after every reload on the arcade. The persistence gate tested slot 1 only, so it passed.
  The gate now reads the slot list from the page and asserts every slot survives a reload;
  pointed at the draft it goes red on exactly that one check.
- The hydrate `try` wrapped the boot callback, so any boot-time error was swallowed silently
  (the shim calls back synchronously). Boot now runs outside it.
- A failed read booted a fresh game that would then save over the real one. A failed read now
  refuses writes for the session and shows the cannot-save banner.
- In degraded (session-only) storage a slot write reported failure but the slot rendered as
  filled. The cache is now updated only after a durable write.
- The gate's boot check could never print FAIL — a broken boot crashed the script first.
  It now reports boot as a status and names the page error.

### Gates

New `scripts/verify-mosslight-save.mjs` (15 checks, production CSP): namespaced live save and
every slot, survives reload, sibling namespace untouched, a valid bare itch-era save **not**
adopted, boots and shows the banner with storage denied. Negative controls: the 0.3.0 `ui.js`
fails 5 checks; the slots-0–2 draft fails 1; a throwing `UI.boot` fails 7 with the error
named.

`site` points at the itch page because no dhseadev.online project page exists yet. Repoint it
when one does.
