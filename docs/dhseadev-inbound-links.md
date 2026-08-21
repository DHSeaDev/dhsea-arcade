# dhseadev.online inbound links — DONE 2026-08-21

All four surfaces now link to play.dhseadev.online. Each was written surgically in
an admin-context browser tab and verified on the rendered page while logged OUT.

| Surface | Change | Evidence |
|---|---|---|
| footer template part `assembler//footer` | "Arcade (7 games)" first in the **GAMES** column | 37 -> 38 anchors, exact length, 0 render collisions |
| `/projects/` page 14 | Card "The Arcade" + chips 7 GAMES / BROWSER / FREE | 25 -> 26 cards, 0 nested anchors, 0 nameless links |
| home page 27 | "Play the arcade" button in the closing CTA band | matches sibling buttons exactly |
| `/history/` page 385 | Dated entry, newest first | 89 -> 90 items |

## What the earlier staged script got wrong

`scripts/wp-inbound-links.js` (deleted) was written from NOTES DESCRIBING these
pages rather than from their bytes. A dry run proved **every one of its regexes
matched zero on all four surfaces** — it would have found no clone source
anywhere. Deleted rather than kept: a plausible-looking script with known-wrong
selectors is worse than no script.

Structural facts, measured live, so the next pass does not re-derive them:

- **footer**: 6 columns — APPS / GAMES / IDLE / TOOLS / SITE / MORE. Sibling
  anchors are separated by an identical **32-character delimiter appearing
  exactly 32 times**; harvest it, never author it. Its absence is what produced
  the "AboutWriting" run-together collision previously.
- **page 14**: `<a class="card" href><div class="ct">TITLE</div><p>DESC</p><div class="chips"><span>x3</span></div></a>`
- **page 27**: project links are `.pcard` inside `.g2`. `.cardx` is a CAPABILITY
  card, not a link. The closing `.btn-row` CTA band is the right home for a play
  link — it already held "Play Prism Break" and "Or the shared playground".
- **page 385**: `<li><a href><span class="dt">DATE</span><span class="tt">TITLE</span></a></li>`

## Two traps that cost a cycle each

1. **`<li` matches `<link`.** A substring probe with no word boundary reported 90
   list items when there were 89 plus one stylesheet link — and the first "item"
   extracted was the `<link>` tag. Use `/<li[\s>]/`.
2. **Injecting a second `class` attribute silently drops the first one's styling.**
   `.replace('<a ', '<a class="x" ')` against an anchor that already had
   `class="btn btn-s"` produced two class attributes; HTML honours only the first,
   so the button rendered as a bare underlined link. Merge into the existing
   attribute instead. **No gate caught this** — length, anchor uniqueness, CDATA
   and ampersand all passed. It was found by looking at a screenshot, which is the
   only thing that can see it.

## Label collision, resolved by placement

`play.dhseadev.online` (the arcade) and `dhseadev.online/play/` (the playhtml
playground) are different destinations. In the footer they sit in different
columns — Arcade under GAMES, Play under TOOLS — so they never read as duplicates.
No relabel was needed.

---

# Congruence pass — 2026-08-21 (second session)

`/play/` retired, the arcade promoted, and the footer cut back.

| Surface | Change | Measured |
|---|---|---|
| Primary Nav 60 | "Play" -> **"Arcade"** -> play.dhseadev.online | 9 items preserved |
| footer | **GAMES + IDLE columns deleted**; "Arcade" added to SITE | 38 -> 24 anchors, 6 -> 4 columns, 0 collisions |
| footer | "Play" link removed from TOOLS | delimiter removed with it |
| footer context-toast MAP | `/play/` source row dropped, 2 targets repointed to the arcade | 14 -> 13 rows, valid JSON before and after |
| home 27 | "Or the shared playground" CTA removed | 0 remaining /play/ refs |
| `/play/` 233 | retired: notice + `location.replace` + `jetpack_seo_noindex` | 50,013 -> 984 chars |
| projects 1084/1108/1120/1166 | "PLAY IN YOUR BROWSER" button | renders identical to sibling sc-btn |

## Two judgment calls made during execution

**No "All games" link was added, despite it being the agreed plan.** `/projects/`
has **no ids at all**, so there is no `#games` anchor to point at — and the SITE
column already contains "All Projects" pointing at `/projects/`. A second link to
the same URL in the same footer is precisely the duplication this pass existed to
remove. The 9 non-arcade games remain reachable through "All Projects".

**`/play/` got a soft retire, not a 301.** No redirect plugin is installed and
WP.com Atomic has no per-page redirect, so a true 301 would mean adding a plugin
dependency for one URL. Instead: an on-brand notice, `location.replace` (no
history entry, so the back button still works), and `jetpack_seo_noindex`. Stated
plainly because it is weaker than a 301 for link equity.

## Only 4 of 7 arcade games have project pages

Lumenreel, Underglory, Veilfall and Prism Cascade do. **Emberkeep, Emberkeep
Mountain and Bloom Rush have none** — they were never in the footer either. Not
created here: that is three new showcase pages, a scope decision rather than a
wiring one. They are reachable via the Arcade card on `/projects/` and the arcade
itself.
