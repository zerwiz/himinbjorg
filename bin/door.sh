#!/usr/bin/env bash
# door.sh — one of the tower's doors as a command, for Valaskjálf's `VALASKJALF_DOOR_<ID>` seam.
#
#   bin/door.sh services | tunnels | host     prints the door's JSON; exit 1 with the reason when the tower cannot say
#
# Example, in the hall's environment:  VALASKJALF_DOOR_SERVICES=".../himinbjorg/current/bin/door.sh services"
set -euo pipefail
case "${1-}" in services|tunnels|host) ;; *) printf 'usage: door.sh services|tunnels|host\n' >&2; exit 2 ;; esac
port="${HIMINBJORG_PORT:-3896}"
body="$(curl -sS --max-time 10 -w '\n%{http_code}' "http://127.0.0.1:$port/doors/$1")" || {
  printf 'the watchtower does not answer on loopback port %s\n' "$port" >&2; exit 1; }
code="${body##*$'\n'}"; body="${body%$'\n'*}"
[ "$code" = 200 ] || { printf 'the watchtower cannot say yet: %s\n' "$body" >&2; exit 1; }
printf '%s\n' "$body"
