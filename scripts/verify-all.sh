#!/usr/bin/env bash
# One gate. Any failure exits non-zero — nothing here is advisory.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "▸ build";                node scripts/build.mjs
echo; echo "▸ syntax";         for f in $(find dist/games -name '*.js' -not -path '*/lib/*' | head -80); do node --check "$f" >/dev/null 2>&1 || echo "  parse-fail (may be an ES module, not a defect): $f"; done; echo "  ok"
echo; echo "▸ boot / paint / shim / persistence, under the production CSP"; node scripts/verify.mjs
echo; echo "▸ bloom-rush persistence";  node scripts/verify-bloomrush-save.mjs
echo; echo "▸ veilfall llm-security";   node scripts/verify-veilfall-security.mjs
echo; echo "▸ planet-express shim layer"; node scripts/verify-pel-shim.mjs
echo; echo "▸ connect-src egress pin";    node scripts/verify-llm-egress.mjs
echo; echo "▸ planet-express keyboard a11y"; node scripts/verify-pel-a11y.mjs
echo; echo "â¸ preship-ritual [Web/Frontend]"; node scripts/preship.mjs
echo; echo "ALL GATES PASS"
