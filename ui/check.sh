#!/usr/bin/env bash
# Run this after updating Kamra and before using the result.
#
#   SITE=sr_pr ui/check.sh
#
# 1. every patch still fits Kamra's new source (stops at the first that does not)
# 2. the customised front end builds
# 3. the front-end tests pass
# 4. the backend tests pass, including the ones that watch what we depend on in Kamra
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="$(cd "$here/.." && pwd)"
site="${SITE:?set SITE to your site name, e.g. SITE=sr_pr ui/check.sh}"

echo "== 1/4 patches fit Kamra's source"
node "$here/build.mjs" --check
echo "== 2/4 build"
node "$here/build.mjs"
echo "== 3/4 front-end tests"
( cd "$here" && npx vitest run )
echo "== 4/4 backend tests"
( cd "$app/../.." && bench --site "$site" run-tests --app kamra_custom )
echo
echo "All checks passed."
