#!/usr/bin/env bash
# run-gates.sh — the one door to this repository's gates. The hooks and CI both call it, so a commit, a push
# and a pull request meet the same judges.
#
#   bin/gates/run-gates.sh staged               the commit about to be made (pre-commit)
#   bin/gates/run-gates.sh range <base> <head>  what a push or a pull request adds
#   bin/gates/run-gates.sh tree                 every tracked file, and gitleaks over the whole history (CI)
#
# The judges (each is Ymir's own ward, vendored byte for byte — see VENDORED):
#   secret     secret-guard.sh (key shapes, private env files) · gitleaks through secret-scan.sh
#   personal   public-guard.py (names the operator declared, private addresses, personal mailboxes, fleet
#              hosts) · private-guard.py (the home's private paths and protected material)
#   identity   identity-guard.sh (a commit's author and committer mailbox) · pr-identity-guard.sh (CI, on a PR)
#   vault      vault-guard.sh (a file byte-identical to one in the open vault) ·
#              secrets-plaintext-guard.sh (a home secrets shelf committed in the clear)
#
# The deny list is read from the home on a seat, and from the HIMINBJORG_DENY_LIST secret in CI
# (bin/gates/deny-load.sh). It is never in this tree.
#
# Exit: 0 every judge clean · 1 a judge refused · 2 usage.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
G="$ROOT/bin/gates/guards"
cd "$ROOT"

eval "$(bash "$ROOT/bin/gates/deny-load.sh")"
STRICT=()
[ "${YMIR_PUBLIC_GUARD_STRICT:-}" = 1 ] && STRICT=(--strict-names)
# This repository is not a home: the plaintext ward judges THIS tree for a secrets shelf that strayed here.
export YMIR_SECRETS_GUARD_ROOT="$ROOT"

verb="${1:-}"
failed=()

# THE VENDORED WARDS ARE JUDGED IN YMIR, NOT HERE, BY THE PRIVATE GUARD. private-guard.py is Ymir's surface ward:
# it refuses a home path, a vault file name or a secret shape in anything that leaves. The wards that hunt those
# shapes must name them, so it flags them. Ymir does not run it over its own guards either. Here they are proven
# byte-identical to Ymir's by bin/gates/vendor-sync.sh, and every other gate still judges them. Only the files that
# VENDORED lists are skipped, by exact path.
mapfile -t VENDORED_FILES < <(awk '/^files:/ {on=1; next} on && /^  [^ ]/ {print $1}' "$ROOT/VENDORED" 2>/dev/null)
not_vendored() {  # reads paths on stdin, prints those VENDORED does not list
  local f v skip
  while IFS= read -r f; do
    skip=0
    for v in "${VENDORED_FILES[@]}"; do [ "$f" = "$v" ] && { skip=1; break; }; done
    [ "$skip" = 0 ] && printf '%s\n' "$f"
  done
}
judge() {  # <name> <command...>
  local name="$1"; shift
  if "$@"; then printf 'gate %-18s clean\n' "$name"
  else printf 'gate %-18s REFUSED\n' "$name" >&2; failed+=("$name"); fi
}

gitleaks_present() { command -v "${YMIR_GITLEAKS:-gitleaks}" >/dev/null 2>&1; }
gitleaks_judge() {  # <secret-scan verb>
  if gitleaks_present; then
    YMIR_SECRET_SCAN_CONFIG="$ROOT/.gitleaks.toml" bash "$ROOT/bin/gates/secret-scan.sh" "$1"
  elif [ -n "${CI:-}" ]; then
    printf 'gitleaks is not installed in CI — the scan cannot be skipped there\n' >&2; return 1
  else
    printf 'gate gitleaks           not installed here — CI runs it on every pull request\n'
  fi
}

# Files to judge, as a NUL-free newline list (paths with newlines are refused by git for us).
case "$verb" in
  staged)
    mapfile -t files < <(git diff --cached --name-only --diff-filter=ACM)
    mapfile -t own < <([ "${#files[@]}" -gt 0 ] && printf '%s\n' "${files[@]}" | not_vendored)
    judge secret-guard        bash "$G/secret-guard.sh"
    judge public-guard        python3 "$G/public-guard.py" --staged "${STRICT[@]}"
    [ "${#own[@]}" -gt 0 ] && judge private-guard python3 "$G/private-guard.py" check "${own[@]}" --surface public
    judge identity-guard      bash "$G/identity-guard.sh" --staged
    judge vault-guard         bash "$G/vault-guard.sh"
    judge secrets-plaintext   bash "$G/secrets-plaintext-guard.sh"
    gitleaks_present && judge gitleaks gitleaks_judge staged
    ;;
  range)
    base="${2:-}"; head="${3:-}"
    [ -n "$base" ] && [ -n "$head" ] || { printf 'error: range needs <base> <head>\n' >&2; exit 2; }
    mapfile -t files < <(git diff --name-only --diff-filter=ACM "$base" "$head")
    mapfile -t own < <([ "${#files[@]}" -gt 0 ] && printf '%s\n' "${files[@]}" | not_vendored)
    judge secret-guard        bash "$G/secret-guard.sh" --range "$base" "$head"
    if [ "${#files[@]}" -gt 0 ]; then
      judge public-guard      python3 "$G/public-guard.py" --added "$base" "${files[@]}" "${STRICT[@]}"
    fi
    [ "${#own[@]}" -gt 0 ] && judge private-guard python3 "$G/private-guard.py" check "${own[@]}" --surface public
    judge identity-guard      bash "$G/identity-guard.sh" --base "$base"
    judge vault-guard         bash "$G/vault-guard.sh" --all
    judge secrets-plaintext   bash "$G/secrets-plaintext-guard.sh" --all
    gitleaks_present && judge gitleaks gitleaks_judge dir
    ;;
  tree)
    mapfile -t files < <(git ls-files)
    mapfile -t own < <(printf '%s\n' "${files[@]}" | not_vendored)
    judge secret-guard        bash "$G/secret-guard.sh" --all
    judge public-guard        python3 "$G/public-guard.py" --tree "${STRICT[@]}"
    judge private-guard       python3 "$G/private-guard.py" check "${own[@]}" --surface public
    judge vault-guard         bash "$G/vault-guard.sh" --all
    judge secrets-plaintext   bash "$G/secrets-plaintext-guard.sh" --all
    judge gitleaks            gitleaks_judge tree
    ;;
  *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

if [ "${#failed[@]}" -gt 0 ]; then
  printf 'run-gates: refused by %s — read the lines above; the fix is in the change, never in the gate\n' "${failed[*]}" >&2
  exit 1
fi
printf 'run-gates: %s clean\n' "$verb"
