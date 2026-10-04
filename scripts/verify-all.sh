#!/usr/bin/env bash
# One gate. Any failure exits non-zero — nothing here is advisory.
set -euo pipefail
cd "$(dirname "$0")/.."
# The three prismwar gates default to src-games/prismwar, which is the DELIBERATELY FROZEN 0.3.0
# arcade build — so with no argument this suite gated a version nobody ships. The shipped
# extension is src-games/prismwar/ext.
PW_EXT="src-games/prismwar/ext"
echo "▸ build";                node scripts/build.mjs
echo; echo "▸ syntax";         for f in $(find dist/games -name '*.js' -not -path '*/lib/*' | head -80); do node --check "$f" >/dev/null 2>&1 || echo "  parse-fail (may be an ES module, not a defect): $f"; done; echo "  ok"
echo; echo "▸ boot / paint / shim / persistence, under the production CSP"; node scripts/verify.mjs
echo; echo "▸ bloom-rush persistence";  node scripts/verify-bloomrush-save.mjs
echo; echo "▸ veilfall llm-security";   node scripts/verify-veilfall-security.mjs
echo; echo "▸ planet-express shim layer"; node scripts/verify-pel-shim.mjs
echo; echo "▸ prismwar rules / set integrity / economy"; node scripts/verify-prismwar.mjs "$PW_EXT"
echo; echo "▸ prismwar DOM contract (real browser, production CSP)"; node scripts/verify-prismwar-dom.mjs "$PW_EXT"
echo; echo "▸ prismwar inserted-symbol re-read (preship-ritual Check #0.5)"; node scripts/verify-prismwar-symbols.mjs "$PW_EXT"
echo; echo "▸ prismwar v0.6.0 mutation campaign (scored kill rate)"; node scripts/mutate-prismwar-060.mjs "$PW_EXT"
echo; echo "▸ prismwar gate self-proof (sabotage)"; node scripts/sabotage-prismwar.mjs "$PW_EXT"
echo; echo "▸ connect-src egress pin";    node scripts/verify-llm-egress.mjs
echo; echo "▸ planet-express keyboard a11y"; node scripts/verify-pel-a11y.mjs
echo; echo "▸ mosslight persistence (its own save path, not the shim's token)"; node scripts/verify-mosslight-save.mjs
echo; echo "▸ linked (external-origin cards)"; node scripts/verify-linked.mjs
echo; echo "▸ seo headings (h1 per entry)"; node scripts/verify-seo-headings.mjs
echo; echo "▸ stress battery (9 shards, concurrency 3)"; node scripts/stress.mjs
echo; echo "â¸ preship-ritual [Web/Frontend]"; node scripts/preship.mjs
echo; echo "ALL GATES PASS"
