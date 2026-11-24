#!/usr/bin/env bash
# deny-seed.sh — write the operator's deny list from the home into this repository's Actions secret.
#
#   bin/gates/deny-seed.sh --check     say what would be sent (counts only) and change nothing
#   bin/gates/deny-seed.sh             set HIMINBJORG_DENY_LIST on the GitHub repository (needs `gh` signed in)
#
# The list is read from the operator's home, exactly where the vendored guards read it on a seat:
#   $YMIR_HOME/hodd/security/operator-words.txt   the words he has declared his own
#   $YMIR_HOME/hodd/data/fleet.json (hosts)        the fleet's machine names
#   $YMIR_HOME/hodd/identity/house-domains.txt     the house's mail domains
# It is sent as an encrypted Actions secret, which GitHub never shows again and a fork cannot read. It is never
# written to the tree, a log or stdout. Run it again whenever the home's list changes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
home="${YMIR_HOME:-}"
if [ -z "$home" ] && [ -r "$ROOT/bin/vault/hoard-lib.sh" ]; then
  . "$ROOT/bin/vault/hoard-lib.sh" 2>/dev/null || true
  command -v ymir_home_root >/dev/null 2>&1 && ymir_home_root home || true
fi
[ -n "$home" ] && [ -d "$home" ] || { printf 'error: no home found (set YMIR_HOME)\n' >&2; exit 2; }

payload="$(python3 - "$home" <<'PY'
import base64, json, os, sys
home = sys.argv[1]
def lines(p):
    try:
        return [l.strip() for l in open(p, encoding="utf-8", errors="replace") if l.strip() and not l.strip().startswith("#")]
    except OSError:
        return []
try:
    hosts = sorted((json.load(open(os.path.join(home, "hodd/data/fleet.json"))).get("hosts") or {}).keys())
except Exception:
    hosts = []
d = {"words": lines(os.path.join(home, "hodd/security/operator-words.txt")), "hosts": hosts,
     "domains": lines(os.path.join(home, "hodd/identity/house-domains.txt"))}
print(f"deny-seed: {len(d['words'])} words, {len(d['hosts'])} hosts, {len(d['domains'])} domains", file=sys.stderr)
print(base64.b64encode(json.dumps(d).encode()).decode())
PY
)"
[ "${1:-}" = --check ] && { printf 'deny-seed: --check — nothing sent\n'; exit 0; }
repo="$(git -C "$ROOT" remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
printf '%s' "$payload" | gh secret set HIMINBJORG_DENY_LIST --repo "$repo" >/dev/null
printf 'deny-seed: HIMINBJORG_DENY_LIST set on %s\n' "$repo"
