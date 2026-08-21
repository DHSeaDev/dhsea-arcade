/**
 * wp-inbound-links.js — add play.dhseadev.online links to dhseadev.online.
 *
 * RUN IT: paste as ONE javascript_tool call while the tab is on
 *   https://dhseadev.online/wp-admin/edit.php?post_type=page
 * (Law 4: `wpApiSettings` exists only on wp-admin. Law 4a: this asserts its own
 * context and returns a drift flag rather than throwing mid-batch.)
 *
 * WHY A SCRIPT AND NOT A HAND-AUTHORED WRITE. Every surface here is a single
 * large wp:html block, and page-sections.* is broken on this host, so any edit
 * is a full-content rewrite. Re-emitting 14–28KB through model output is the
 * corruption vector Law 12 exists to forbid — and a prior transfer on this very
 * site corrupted at 24,000 chars WITH A MATCHING LENGTH, so a length gate does
 * not catch it. This script never moves the block anywhere: it reads the bytes,
 * mutates them in the page, and writes them back, so the untouched bytes are
 * never transported at all.
 *
 * EVERY ANCHOR IS EXTRACTED, NEVER RETYPED. Each surface finds a real existing
 * sibling in the fetched bytes and clones it, swapping href and label. Retyping
 * markup fails the uniqueness assert the moment the source contains an em-dash,
 * a curly quote or an emoji — which these pages do.
 *
 * GATES PER SURFACE (Law 12), all of which must pass before a POST:
 *   1. anchor appears EXACTLY once
 *   2. idempotency marker absent (re-running after a timeout is safe)
 *   3. length gate: out.length - raw.length === insert.length
 *   4. no new `]]>` and no new ampersand vs the pre-edit count (Laws 13 / 13a)
 *   5. independent re-fetch afterwards, probing for the marker — never the
 *      length echoed by the POST that made the change
 *
 * Returns short scalars only. Returning href strings trips the
 * [BLOCKED: Cookie/query string data] guard and loses the whole result.
 */
(async () => {
  const R = [];
  const nonce = (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) || null;
  if (!nonce) { window.__WPLINK = { drift: true }; return; }

  const ARCADE = 'https://play.dhseadev.online/';
  const MARKER = 'dh-arcade-link';            // idempotency marker, also the CSS hook
  const AMP = String.fromCharCode(38);

  const get = async (url) =>
    (await fetch(url, { credentials: 'same-origin', headers: { 'X-WP-Nonce': nonce } })).json();
  const post = async (url, body) =>
    (await fetch(url, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-WP-Nonce': nonce },
      body: JSON.stringify(body) })).status;

  const count = (h, s) => h.split(s).length - 1;

  /**
   * One surface. `plan(raw)` returns {anchor, insert} built from the real bytes,
   * or null if it cannot find a safe clone source — in which case nothing is
   * written and the surface reports why.
   */
  async function apply(label, readUrl, writeUrl, plan, wrap) {
    try {
      const cur = await get(readUrl + '?context=edit');
      const raw = (cur && cur.content && cur.content.raw) || '';
      if (!raw) return R.push(`${label}: FAIL no raw content`);
      if (raw.includes(MARKER)) return R.push(`${label}: skip already-applied`);

      const p = plan(raw);
      if (!p) return R.push(`${label}: FAIL no clone source found`);
      const { anchor, insert } = p;

      if (count(raw, anchor) !== 1) return R.push(`${label}: FAIL anchor x${count(raw, anchor)} (need 1)`);

      const out = raw.replace(anchor, anchor + insert);
      if (out.length - raw.length !== insert.length) return R.push(`${label}: FAIL length gate`);
      if (count(out, ']]' + '>') > count(raw, ']]' + '>')) return R.push(`${label}: FAIL Law 13 CDATA`);
      if (count(out, AMP) > count(raw, AMP)) return R.push(`${label}: FAIL Law 13a ampersand`);

      const status = await post(writeUrl, { content: wrap ? wrap(out) : out });
      if (status !== 200) return R.push(`${label}: FAIL POST ${status}`);

      // Independent re-fetch — the POST response cannot confirm its own write.
      const re = await get(readUrl + '?context=edit');
      const back = (re && re.content && re.content.raw) || '';
      R.push(`${label}: ${back.includes(MARKER) ? 'OK' : 'FAIL marker absent after write'} len=${back.length}`);
    } catch (e) {
      R.push(`${label}: THREW ${String(e).slice(0, 80)}`);
    }
  }

  /* ── footer template part: clone a Play-column anchor + its delimiter ───── */
  await apply('footer',
    '/wp-json/wp/v2/template-parts/assembler%2F%2Ffooter',
    '/wp-json/wp/v2/template-parts/assembler%2F%2Ffooter',
    (raw) => {
      // Find two adjacent anchors and harvest the EXACT delimiter between them.
      // Never author that delimiter by hand — it is 32 chars of block markup the
      // [BLOCKED] guard will not let us look at, and a hand-written separator is
      // what produced the "AboutWriting" run-together collision before.
      const re = /(<!-- wp:paragraph[\s\S]{0,400}?<a [^>]*href="[^"]*"[^>]*>[^<]*<\/a>[\s\S]{0,200}?<!-- \/wp:paragraph -->)/g;
      const blocks = raw.match(re);
      if (!blocks || blocks.length < 2) return null;
      const template = blocks[blocks.length - 1];
      const insert = template
        .replace(/href="[^"]*"/, `href="${ARCADE}" class="${MARKER}"`)
        .replace(/>([^<]+)<\/a>/, '>Arcade (7 games)</a>');
      return { anchor: template, insert };
    });

  /* ── /projects/ 14, home 27, /history/ 385: clone a list item or card ───── */
  const pages = [
    ['projects-14', 14, /(<li[^>]*>[\s\S]{0,300}?<a [^>]*href="[^"]*"[^>]*>[^<]*<\/a>[\s\S]{0,120}?<\/li>)/g, 'Arcade — play every game in your browser'],
    ['home-27', 27, /(<li class="lu-item"[\s\S]{0,400}?<\/li>)/g, 'The Arcade — seven games, no install'],
    ['history-385', 385, /(<li[^>]*>[\s\S]{0,300}?<a [^>]*href="[^"]*"[^>]*>[^<]*<\/a>[\s\S]{0,120}?<\/li>)/g, 'Arcade (play.dhseadev.online)'],
  ];
  for (const [label, id, re, text] of pages) {
    await apply(label, `/wp-json/wp/v2/pages/${id}`, `/wp-json/wp/v2/pages/${id}`,
      (raw) => {
        const m = raw.match(re);
        if (!m || !m.length) return null;
        const template = m[m.length - 1];
        if (count(raw, template) !== 1) return null;   // clone source must be unique
        const insert = template
          .replace(/href="[^"]*"/, `href="${ARCADE}" class="${MARKER}"`)
          .replace(/>([^<]+)<\/a>/, `>${text}</a>`);
        return { anchor: template, insert };
      },
      // Pages 14/27/385 are single wp:html blocks; re-wrap on write.
      (out) => out.startsWith('<!-- wp:html -->') ? out : '<!-- wp:html -->\n' + out + '\n<!-- /wp:html -->');
  }

  window.__WPLINK = { drift: false, results: R };
})();
'fired — read window.__WPLINK.results next call';
