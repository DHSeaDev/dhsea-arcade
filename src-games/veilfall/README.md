# VEILFALL

A solo hidden-role deduction game that lives in your Chrome side panel. Nine souls are
called through the Vellum Gate to hold a ward at Threshold Academy. One of them came
through wrong. You are one of the nine, and the other eight are AI opponents who each
know only what their own calling told them.

## What is ours and what is not

VEILFALL is a **reimplementation of an existing game's ruleset with entirely original
expression**. That is a narrower claim than "original game", and it is the accurate one.

**Derived — this is not an original design.** The rules are modelled closely on *Blood on
the Clocktower* by The Pandemonium Institute, specifically its *Trouble Brewing* script.
The correspondence is deliberate and close: 22 roles in a 13 / 4 / 4 / 1 split that map
one-to-one onto that script, the same player-count composition ladder, the same two-part
night order, the same nomination-and-vote structure (half the living, strictly more than
the leader, a tie clears the block, one execution per day), the same ghost-vote rule, and
the same win conditions. Anyone who knows that game will recognise this one immediately.

That reuse is deliberate and, as far as we understand it, permitted: **game rules,
mechanics and systems are not copyrightable** (17 U.S.C. §102(b); *Baker v. Selden*), which
is why the genre has been reimplemented commercially many times. What is protected is the
*expression* — and none of it was reused.

**Ours — every word, image and line of code.** The setting, the 22 role names, every line
of ability and flavour text, the phase vocabulary, the art, the title, the interface, and
the whole codebase are original to this project. Nothing was copied, paraphrased, or
adapted from the source's text or art. A pre-ship check greps every shipped source file,
the manifest and the HTML for source-game terminology and fails the build on a hit; it has
already caught one leak in a code comment. That check deliberately exempts this README,
because crediting a source is the opposite of concealing it.

**Also ours, and not derived from anything:** the AI opponents. The belief records, the
evidence weighting, the persona system, engine-side voting, the coordinated bluff
assignment, the four-layer prompt-injection defence, the phrasing-budget model, and the
post-game transparency view have no counterpart in the source game, which is played by
humans with a human storyteller. That layer is the actual novel work here.

**Not affiliated with, endorsed by, or connected to The Pandemonium Institute.** If you
enjoy this, buy the real thing and play it with seven friends — it is better, and it is
theirs.

### Where the line was drawn

The source's name appears in this README and nowhere else. It is deliberately absent from
the extension name, description, manifest, store listing, keywords, icon and all in-product
text. Naming another product to describe your own relationship to it accurately is ordinary
and honest; putting it in a product title or marketing copy is trading on someone else's
trademark, and that line is worth keeping bright.

*This is a description of our reasoning, not legal advice. Nobody here is a lawyer.*

---

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the VEILFALL toolbar icon. The side panel opens.

Requires Chrome 116 or newer (`sidePanel.open()` is 116+; the API itself is 114+).

---

## First run

VEILFALL opens on a short intro — the fiction, the shape of a day, and nothing else. It
does not hand you a rulebook. The rules arrive as contextual cards the first time each
mechanic actually appears: what the Circle is for when you first see it, what an Echo can
do the moment you become one, and the vote rule at your first Tally.

That choice is evidence-led. Andersen et al. (CHI 2012, ~45k players) found tutorials pay
off **only** in complex games, that context-sensitive instruction at the moment of need
beat upfront manuals, and that **restricting player freedom until they perform the taught
action bought nothing** — which is an argument against a scripted rail. Nothing in
VEILFALL's tutorial blocks the action behind it, and "Skip all" is one tap away.

## Guidance, in two layers

**Suggested action** — on by default, one line, always procedural. It restates the rule in
force: what you *can* do right now, never who to suspect. Because it never names an
alignment it cannot shrink the deduction space, which is what separates it from a hint.
Dismiss it inline, or turn it off in Settings.

**Ask for a nudge** — never pushed. Pull it and you get a *question*, not an answer:
"Two souls have claimed the same calling. Which one's story is thinner?" Per the
hint-design consensus — restate before revealing, ask the question the player should be
asking, and never narrow the possibilities for them. Nudges are deterministic, so the same
board always raises the same question.

Both are testable claims, not intentions: the suite asserts every suggestion is free of
alignment assertions and that every nudge ends in a question mark.

## Sound, and the thing that is not sound

Two separate features, deliberately named apart after the first version conflated them:

**Read aloud** is actual audio. It speaks the game using your operating system's own
speech voices — free, offline, no key, no rate limit, nothing sent anywhere. Each soul is
assigned a stable voice, pitch and pace derived from the persona the AI layer already
generated, so a paranoid opponent sounds the same every time and you can follow the room
without watching it. Off by default; choose Narration (the Archivist only) or Everyone.
Whatever voices your machine has is what you get, and Settings tells you honestly if it
has none.

**Improvised dialogue** is text. It changes the *words* your opponents write, not whether
you hear them. The first release called this "Voices", which promised sound from a
text feature — a naming defect, reported by the first person to use it.

Groq does offer speech synthesis (`canopylabs/orpheus-v1-english`), and it would sound
better than the browser's. It is still the wrong tool here: every spoken line would cost a
network round-trip against a free tier measured at ~15 requests a minute, add latency to a
panel whose appeal is that it is instant, and make audio depend on a key. `src/ui/speech.js`
is the seam if that trade ever looks different.

## It plays with no API key

The default tier — **Warded** — runs entirely offline. Opponents are driven by a
deterministic belief engine: they hold real hidden knowledge, form real reads with cited
evidence, bluff from a coordinated plan, and vote from their own beliefs rather than from
the room. There is no network call anywhere in this mode.

**Kindled** improvises their dialogue, using a **free Groq key** — Settings links straight to
`console.groq.com/keys`, and no card is required. It changes only how opponents *phrase*
what the engine already decided they would say. It cannot change what they know, claim,
target, or vote for.

Groq was chosen over a direct Anthropic call for a specific, verified reason: a live
preflight against the Groq endpoint returns `access-control-allow-origin: *` with **no
opt-in header**, while the Anthropic browser path depends on an undocumented header that
could change without notice. Groq also has a genuinely free tier, which is what makes
voices reachable at all.

### Living inside a free tier

The free allowance is ~30 requests and 8,000 tokens per minute, and **tokens bind before
requests do** — a measured 703-token call means ~10/min cold, ~15 with the prompt cache
warm, against a Reading that wants ~14 lines. Three consequences, all deliberate:

- **The budget is spent on content, not on filler.** Claims, accusations and defences are
  model-written; hedges and table-talk stay scripted. The Tier 1/Tier 2 seam is therefore
  *consistent* — the eloquent lines are always the ones that matter — rather than random,
  which is what reads as a bug.
- **The bucket declines before dispatch.** It never absorbs a 429 and never queues, so
  latency stays bounded by one call. A decline is not an error; it is the same fallback
  path every other failure takes.
- **Batching was rejected.** One call holding eight agents' knowledge would fit the rate
  limit and would also mean one injection reaches all eight. Isolation won.

The model default is `openai/gpt-oss-20b`. `llama-3.1-8b-instant` and
`llama-3.3-70b-versatile` are scheduled for removal on **2026-08-16**, so shipping either
would fail silently within days — a test asserts no deprecated ID is in the list.

The key is stored in this browser profile's extension storage. Anyone with access to the
profile can read it. If that isn't acceptable, leave it blank — the game is complete
without it.

---

## Architecture

    engine/     deterministic. Owns ALL state: setup, night order, ability resolution,
                misinformation, vote math, deaths, succession, win checks. Never calls a model.
    ai/         belief records, personas, engine-side voting, speech intents, the security
                layer, and the optional model client.
    ui/         renders one BEAT at a time. Owns no state.

The split is not stylistic. Every published LLM social-deduction system converges on it,
and the alternative — letting a model adjudicate rules — produces rule drift that is
invisible until it isn't.

### The model never returns game state

The engine computes a structured **intent**; the model rewrites that intent as a sentence.
This is CICERO's intent-conditioned generation. Because intents are computed identically in
both tiers, the model is a voice and never a decision-maker.

### Security: the player is the adversary

You can type free text at agents that hold the game's secrets. Four layers, all required:

1. **Context isolation.** An agent's prompt contains only that agent's own knowledge. The
   Registry is absent, not redacted. A total compromise of one agent costs one soul's worth
   of information — something you could have learned by talking anyway.
2. **Structured marking.** Player text arrives inside reserved delimiters it cannot forge,
   plus speaker tagging. Marking alone is defeated by character interleaving; tagging alone
   measures ~5% effective. Both together measure far better.
3. **Output legality filter.** Engine-side, non-model. Every generated line is checked
   against that speaker's permitted-facts set before it reaches you. Speculation is free;
   unfounded assertion is dropped, never trimmed and shipped.
4. **Topology.** Agents never message each other, so there is no hop for a self-replicating
   injection to take. The vector is removed rather than mitigated.

---

## Measured behaviour

Numbers below are from instrumented runs, not estimates. All use a **random** human — a
real player should do better than these.

| Measurement | Result |
|---|---|
| Engine unit + property tests | 46/46 |
| AI, security, and full-game tests | 19/19 |
| Rate limit, Groq client, guidance, speech tests | 44/44 |
| Real-browser end-to-end (Chromium @ 380px) | 45/45, zero console errors |
| Seeded auto-play battery | 300 games, all terminal, all four win paths reachable |
| Controller-driven games | 250 games, no crashes |
| Balance at `Adept` (n=400) | Lantern 53.8% |
| Balance at `Novice` / `Veteran` (n=400 each) | 58.0% / 54.3% |
| Utterances rejected by the legality filter, Tier 1 | 0 across 250 games |
| Documented prompt-injection battery | 0 illegitimate disclosures |

A fourth difficulty preset was built and **cut**: it measured within noise of `Veteran`, and
shipping a label that does nothing is worse than shipping three that do.

---

## Quality of life

- **The notebook** — per-soul alignment read, suspected calling, and free text, from any
  screen. Marks render as glyphs on the Circle. This is the single most important feature
  in the build: without it you hold eight claim-histories in your head while eight
  opponents hold theirs perfectly.
- **The Circle** — a ring, not a list, because four callings read adjacency and one reads
  *living* adjacency. A list hides the information the game runs on.
- **Whispers** — private per-soul threads. In the real game this is most of the game.
- **Live Tally** — threshold marker, running fill, and hands revealed one at a time.
- **Contextual codex** — every calling, the public night order, and the exact vote rules.
- **Post-game transparency** — what each opponent actually knew, claimed, and suspected,
  with the evidence they cited. Plus the Mirage reveal: which soul the glass always lied about.
- **Seeded games** — same seed, same fate. Shareable, and the debugging harness.
- **Accessibility** — alignment never encoded by colour alone; full keyboard navigation;
  ARIA live region for narration; `prefers-reduced-motion` honoured for typed narration
  and vote reveals; no tap target under 30px.

---

## Development

    npm test                     # engine suite (46)
    node test/ai.test.js         # AI + security (19)
    node test/enhance.test.js    # rate limit, Groq client, guidance, speech (44)
    node test/browser.test.js    # real Chromium E2E (45)
    node scripts/preship.mjs     # the 11-check ship gate

No build step, no bundler, no runtime dependencies. Plain ES modules with JSDoc types run
unmodified in Node (tests) and in the side panel (runtime).

---

## Known gaps, stated rather than hidden

- **Read-aloud has never been heard.** Headless Chromium has no system speech voices
  installed, so the wiring, the queue, the per-soul profiles and the no-voices fallback are
  all tested, but no audio has actually been produced. The first time you switch it on is
  the first time it makes a sound.
- **Tier 2 has never been exercised against the live Groq API**, because this build was
  produced without a key. The endpoint, auth header, model IDs, body shape, response shape
  and rate limits were all verified against live documentation and a live CORS preflight,
  but no completion has actually been generated. The first real key is the test.
- **Side-panel document lifetime across a tab switch is not documented.** The design assumes
  the context is destroyed: every beat is atomically persisted and startup always resumes
  from storage. Verified in Node, not in a live panel.
- **Chrome Web Store policy on extensions requiring a user-supplied third-party API key is
  unverified.** No policy text was found either way. Tier 1 ships keyless, so the key path
  can be gated if policy requires it.
- **The browser E2E runs against the in-memory storage fallback**, since `chrome.storage`
  does not exist on a plain page. Persistence and resume are covered by the Node suite, not
  by the browser suite.
- The human is always Lantern in this build. Playing the Gloaming is a different game and
  deserves its own design pass.

---

## Credits

Made by [DHSeaDev](https://dhseadev.online).

*Original setting, text, art, code and AI systems. Ruleset modelled on Blood on the
Clocktower (Trouble Brewing) by The Pandemonium Institute — unaffiliated and unendorsed.*
