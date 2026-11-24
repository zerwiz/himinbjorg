#!/usr/bin/env bash
# start.sh — raise the tower. Ymir's `ymir-app himinbjorg` runs this.
#
#   ./start.sh            the server (if it is not already up), then the window
#   ./start.sh --server   the server only, in the foreground (what himinbjorg.service runs; a heart has no desk)
#   ./start.sh --check    say whether the server answers, change nothing
#   ./start.sh --stop     close the window; the server is the unit's, and keeps watching
set -uo pipefail
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${HIMINBJORG_PORT:-3896}"
answers() { curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; }
bun_bin() { command -v bun 2>/dev/null || { [ -x "$HOME/.bun/bin/bun" ] && printf '%s' "$HOME/.bun/bin/bun"; }; }

case "${1-}" in
  --server)
    b="$(bun_bin)" || { printf 'himinbjorg: bun is not installed (https://bun.sh)\n' >&2; exit 1; }
    exec "$b" "$APP/server/main.ts" ;;
  --check)
    if answers; then printf 'himinbjorg: up on 127.0.0.1:%s\n' "$PORT"; exit 0; fi
    printf 'himinbjorg: down — nothing answers on 127.0.0.1:%s\n' "$PORT"; exit 1 ;;
  --stop)
    pkill -f "$APP/node_modules/electron/dist/electron $APP" 2>/dev/null || true
    printf 'himinbjorg: window closed (the server keeps watching)\n'; exit 0 ;;
  "") ;;
  *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

if ! answers; then
  if systemctl --user cat himinbjorg.service >/dev/null 2>&1; then
    systemctl --user start himinbjorg.service
  else
    b="$(bun_bin)" || { printf 'himinbjorg: bun is not installed (https://bun.sh)\n' >&2; exit 1; }
    nohup "$b" "$APP/server/main.ts" >/dev/null 2>&1 &
  fi
fi
el="$APP/node_modules/electron/dist/electron"
[ -x "$el" ] || { printf 'himinbjorg: no window here (Electron is not installed) — the page is at http://127.0.0.1:%s/\n' "$PORT"; exit 0; }
nohup "$el" "$APP" >/dev/null 2>&1 &
printf 'himinbjorg: window opening on http://127.0.0.1:%s/\n' "$PORT"
