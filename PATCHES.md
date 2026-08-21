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
