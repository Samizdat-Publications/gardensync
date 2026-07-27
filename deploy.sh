#!/usr/bin/env bash
# GardenSync — stage a clean copy of the site and publish it to Cloudflare Pages.
#
# The repo root carries plenty that must never ship: the pre-refactor monolith,
# personal garden JSON, node_modules, screenshots, notes. This assembles only
# what the app actually needs, then deploys it.
#
#   ./deploy.sh          # stage into dist/ and deploy
#   ./deploy.sh --stage  # stage only, don't deploy
set -euo pipefail

cd "$(dirname "$0")"
PROJECT="gardensync"
OUT="dist"

rm -rf "$OUT"
mkdir -p "$OUT"

# The original planner
cp index.html styles.css guide.html "$OUT"/
cp -r js "$OUT"/js

# The og:image for link previews, copied in at publish time so the repo root
# stays free of a 600KB screenshot. The meta tag points at an absolute
# production URL, so this only has to exist on the deployed site.
cp docs/screenshots/planner-hero.png "$OUT"/preview.png

# The local Supabase settings file is gitignored and never deployed. Ship an
# empty stand-in so the <script> tag resolves instead of falling through to the
# 404 page, which the browser then rejects as a bad MIME type. supabase-sync.js
# feature-detects the settings and quietly disables cloud sync when absent.
rm -f "$OUT"/js/supabase-config.js
cat > "$OUT"/js/supabase-config.js <<'STUB'
/* Intentionally empty — no cloud sync configured for the public build.
   Local development: copy supabase-config.example.js to supabase-config.js. */
STUB

# A Quiet Almanac lived at /fable/ on this domain until v7.0. Anything already
# linking there — the old README, the changelog, a bookmark — should land on the
# almanac's own site rather than silently falling through to the planner.
# The bare path has to come before the splat, or the splat shadows it.
cat > "$OUT"/_redirects <<'REDIRECTS'
/fable    https://gardensync-almanac.pages.dev/        301
/fable/   https://gardensync-almanac.pages.dev/        301
/fable/*  https://gardensync-almanac.pages.dev/:splat  301
REDIRECTS

cat > "$OUT"/_headers <<'HEADERS'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: geolocation=(), microphone=(), camera=()
HEADERS

echo "Staged $(find "$OUT" -type f | wc -l) files into $OUT/ ($(du -sh "$OUT" | cut -f1))"

if [ "${1:-}" = "--stage" ]; then
  exit 0
fi

npx wrangler pages deploy "$OUT" --project-name="$PROJECT" --branch=master --commit-dirty=true
