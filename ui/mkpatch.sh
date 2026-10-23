#!/usr/bin/env bash
# Make a patch from edits to Kamra's source.
#
#   node ui/build.mjs --check      prepares ui/.build (Kamra's source + existing patches)
#   ui/mkpatch.sh begin            snapshots it
#   ...edit files under ui/.build/src...
#   ui/mkpatch.sh 20-folio-tax-rows screens/FolioView.tsx
#                                     writes ui/patches/20-folio-tax-rows.patch from just those files
#                                     (paths are relative to src/; one patch per concern)
#
# New files do not belong in a patch: put them in ui/overlay/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" = "begin" ]; then
  rm -rf "$here/.base"
  cp -r "$here/.build/src" "$here/.base"
  echo "snapshot taken; edit files under ui/.build/src"
  exit 0
fi
name="${1:?patch name, e.g. 20-folio-tax-rows}"
shift
[ "$#" -ge 1 ] || { echo "list the files this patch changes"; exit 1; }
out="$here/patches/$name.patch"
cd "$here"
rm -rf .cmp && mkdir -p .cmp
: > "$out"
for f in "$@"; do
  mkdir -p ".cmp/a/src/$(dirname "$f")" ".cmp/b/src/$(dirname "$f")"
  cp ".base/$f" ".cmp/a/src/$f"
  cp ".build/src/$f" ".cmp/b/src/$f"
  ( cd .cmp && diff -uN "a/src/$f" "b/src/$f" || true ) >> "$out"
done
rm -rf .cmp
if [ ! -s "$out" ]; then rm -f "$out"; echo "no changes"; exit 1; fi
echo "wrote $out ($(grep -c '^@@' "$out") hunk(s))"
