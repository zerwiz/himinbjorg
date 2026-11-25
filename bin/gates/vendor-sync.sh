#!/usr/bin/env bash
# vendor-sync.sh — keep the borrowed gates in step with Ymir.
#
#   bin/gates/vendor-sync.sh --check            every file in VENDORED equals Ymir's at the recorded commit
#   bin/gates/vendor-sync.sh --update <commit>  copy the files from a local Ymir checkout at <commit>, record it
#
# Where Ymir is read from, in order: $YMIR_SRC (a checkout), $HOME/ymir, $HOME/ymir-runtime, then the public repository
# over https (raw.githubusercontent.com), which is what CI uses. A copy that differs is a red gate: the fix is in
# Ymir, never in the copy.
#
# Exit: 0 in step · 1 a copy differs or is missing · 2 usage or Ymir cannot be read.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LEDGER="$ROOT/VENDORED"
[ -r "$LEDGER" ] || { printf 'error: %s is missing\n' "$LEDGER" >&2; exit 2; }

ref_of() { awk '/^ymir_ref:/ {print $2; exit}' "$LEDGER"; }
files_of() { awk '/^files:/ {on=1; next} on && /^  [^ ]/ {print $1}' "$LEDGER"; }

ymir_checkout_with() {
  local sha="$1" c
  for c in "${YMIR_SRC:-}" "$HOME/ymir" "$HOME/ymir-runtime"; do
    [ -n "$c" ] && [ -d "$c" ] || continue
    git -C "$c" cat-file -e "$sha^{commit}" 2>/dev/null && { printf '%s' "$c"; return 0; }
  done
  return 1
}

read_ymir_file() {  # <sha> <path> -> stdout
  local sha="$1" path="$2" c
  if c="$(ymir_checkout_with "$sha")"; then
    git -C "$c" show "$sha:$path"
  else
    curl -fsSL --connect-timeout 10 --max-time 30 --retry 2 "https://raw.githubusercontent.com/zerwiz/ymir/$sha/$path"
  fi
}

case "${1:-}" in
  --check)
    sha="$(ref_of)"; [ -n "$sha" ] || { printf 'error: VENDORED names no ymir_ref\n' >&2; exit 2; }
    bad=0; n=0; tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
    printf 'vendor_sync[%s]{file,verdict}:\n' "$(files_of | wc -l | tr -d ' ')"
    while IFS= read -r f; do
      n=$((n + 1))
      if ! read_ymir_file "$sha" "$f" > "$tmp" 2>/dev/null; then
        printf '  "%s","cannot read Ymir at %s"\n' "$f" "${sha:0:12}"; bad=2; continue
      fi
      if [ ! -f "$ROOT/$f" ]; then printf '  "%s","MISSING here"\n' "$f"; [ "$bad" = 0 ] && bad=1; continue; fi
      if cmp -s "$tmp" "$ROOT/$f"; then printf '  "%s","same"\n' "$f"
      else printf '  "%s","DIFFERS from Ymir — change it in Ymir, then --update"\n' "$f"; [ "$bad" = 0 ] && bad=1; fi
    done < <(files_of)
    [ "$bad" = 0 ] && printf 'verdict: %s files in step with Ymir %s\n' "$n" "${sha:0:12}"
    exit "$bad" ;;
  --update)
    sha="${2:-}"; [ -n "$sha" ] || { printf 'error: --update needs a Ymir commit\n' >&2; exit 2; }
    c="$(ymir_checkout_with "$sha")" || { printf 'error: no local Ymir checkout has %s (set YMIR_SRC)\n' "$sha" >&2; exit 2; }
    full="$(git -C "$c" rev-parse "$sha^{commit}")"
    while IFS= read -r f; do
      mkdir -p "$ROOT/$(dirname "$f")"
      git -C "$c" show "$full:$f" > "$ROOT/$f" || exit 2
      case "$f" in *.sh|*.py) chmod +x "$ROOT/$f" ;; esac
    done < <(files_of)
    sed -i "s|^ymir_ref:.*|ymir_ref: $full|" "$LEDGER"
    printf 'vendor-sync: copied from Ymir %s — run the tests, then commit VENDORED with the copies\n' "${full:0:12}"
    exit 0 ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
