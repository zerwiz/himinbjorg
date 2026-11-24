#!/usr/bin/env bash
# deny-load.sh — give the gates the operator's deny list, without it ever touching the tree.
#
#   eval "$(bin/gates/deny-load.sh)"     prints `export YMIR_HOME=…` (and YMIR_PUBLIC_GUARD_STRICT=1) or nothing
#
# On a seat, the home already holds the list ($YMIR_HOME/hodd/security/operator-words.txt, $YMIR_HOME/hodd/data/fleet.json and
# $YMIR_HOME/hodd/identity/house-domains.txt), and the vendored guards read it there: this prints nothing.
#
# In CI there is no home. The list then arrives as the Actions secret HIMINBJORG_DENY_LIST (base64 of a JSON
# object {words: [...], hosts: [...], domains: [...]}, written from the home by bin/gates/deny-seed.sh). This
# builds a throwaway home in $RUNNER_TEMP (or a temp dir) with the same three files, so the same guards read it
# the same way. The list is never printed, and only counts are reported.
#
# Without the secret (a fork's pull request cannot read one), it says so on stderr and prints nothing: the
# shapes (keys, private addresses, personal mailboxes) are still judged; only the operator's own words are not.
set -euo pipefail

if [ -z "${HIMINBJORG_DENY_LIST:-}" ]; then
  if [ -n "${CI:-}" ]; then
    printf 'deny-load: no HIMINBJORG_DENY_LIST secret — judging shapes only (keys, addresses, mailboxes)\n' >&2
  fi
  exit 0
fi

base="${RUNNER_TEMP:-$(mktemp -d)}/deny-home"
mkdir -p "$base/hodd/security" "$base/hodd/data" "$base/hodd/identity"
chmod 700 "$base"
printf '%s' "$HIMINBJORG_DENY_LIST" | base64 -d | python3 -c '
import json, sys
base = sys.argv[1]
d = json.load(sys.stdin)
words = [str(w) for w in d.get("words", []) if str(w).strip()]
hosts = [str(h) for h in d.get("hosts", []) if str(h).strip()]
domains = [str(x) for x in d.get("domains", []) if str(x).strip()]
open(f"{base}/hodd/security/operator-words.txt", "w").write("\n".join(words) + "\n")
json.dump({"hosts": {h: {} for h in hosts}}, open(f"{base}/hodd/data/fleet.json", "w"))
open(f"{base}/hodd/identity/house-domains.txt", "w").write("\n".join(domains) + "\n")
print(f"deny-load: {len(words)} words, {len(hosts)} hosts, {len(domains)} domains loaded (never printed)", file=sys.stderr)
' "$base"
printf 'export YMIR_HOME=%q\nexport YMIR_PUBLIC_GUARD_STRICT=1\n' "$base"
