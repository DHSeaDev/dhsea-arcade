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
