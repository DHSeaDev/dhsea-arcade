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
