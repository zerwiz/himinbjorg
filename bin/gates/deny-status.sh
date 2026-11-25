#!/usr/bin/env bash
# deny-status.sh — do this seat's hooks have the operator's deny list? Counts only, never a word. Local, read-only.
#
#   bin/gates/deny-status.sh
#
# The list stays in the operator's home, as in Ymir. It is never committed and never sent anywhere; the public CI has
# no home and judges shapes only. These are the files the vendored wards read on a seat:
#   $YMIR_HOME/hodd/identity/public-deny.txt      agnostic-audit.sh: name: · host: · domain: entries
#   $YMIR_HOME/hodd/security/operator-words.txt   public-guard.py: the declared words
#   $YMIR_HOME/hodd/data/fleet.json (hosts)        public-guard.py: the fleet's machine names
#   $YMIR_HOME/hodd/identity/house-domains.txt     identity-guard.sh: the house's own mail domains
#
# Exit: 0 the home is found (whatever it holds) · 2 no home on this seat, so only shapes are judged here.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
home="${YMIR_HOME:-}"
if [ -z "$home" ] && [ -r "$ROOT/bin/vault/hoard-lib.sh" ]; then
  . "$ROOT/bin/vault/hoard-lib.sh" 2>/dev/null || true
  command -v ymir_home_root >/dev/null 2>&1 && ymir_home_root home 2>/dev/null || true
fi
if [ -z "$home" ] || [ ! -d "$home" ]; then
  printf 'deny-status: no home on this seat — the gates judge shapes only here (keys, addresses, mailboxes)\n'
  exit 2
fi
count() { [ -r "$1" ] && grep -cvE '^\s*(#|$)' "$1" || printf 0; }
hosts="$(python3 -c 'import json,sys; print(len((json.load(open(sys.argv[1])).get("hosts") or {})))' "$home/hodd/data/fleet.json" 2>/dev/null || printf 0)"
printf 'deny_status[4]{list,entries,read_by}:\n'
printf '  "public-deny.txt","%s","agnostic-audit.sh"\n' "$(count "$home/hodd/identity/public-deny.txt")"
printf '  "operator-words.txt","%s","public-guard.py"\n' "$(count "$home/hodd/security/operator-words.txt")"
printf '  "fleet.json hosts","%s","public-guard.py"\n' "$hosts"
printf '  "house-domains.txt","%s","identity-guard.sh"\n' "$(count "$home/hodd/identity/house-domains.txt")"
