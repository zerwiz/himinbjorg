#!/usr/bin/env bash
# install.sh — build this release in place (the app contract; Ymir's bin/apps/apps.sh runs it).
#
#   ./install.sh          the packages from the lock file, the page built into ui/dist, the hooks seated in a clone
#   ./install.sh --check  change nothing; exit 1 naming what is not right
#
# Works alone too: from a plain clone, `./install.sh` then `./start.sh`.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
case "$HERE" in */ymir-runtime/apps/*|*/ymir/apps/*)
  printf 'error: refusing to build inside a Ymir tree (%s) — an installed app has its own home\n' "$HERE" >&2; exit 1 ;;
esac
bun_bin() { command -v bun 2>/dev/null || { [ -x "$HOME/.bun/bin/bun" ] && printf '%s' "$HOME/.bun/bin/bun"; }; }

if [ "${1-}" = --check ]; then
  bad=0
  b="$(bun_bin)" || { printf 'error: bun is not installed (the tower server runs on bun: https://bun.sh)\n' >&2; bad=1; }
  [ -d node_modules/react ] || { printf 'error: the packages are not installed — run ./install.sh\n' >&2; bad=1; }
  [ -f ui/dist/index.html ] && [ -f ui/dist/main.js ] || { printf 'error: the page is not built (ui/dist) — run ./install.sh\n' >&2; bad=1; }
  [ -x bin/house-status.sh ] || { printf 'error: the door prober bin/house-status.sh is missing\n' >&2; bad=1; }
  grep -q "ymir-himinbjorg" electron/himinbjorg.desktop.in || { printf 'error: the launcher does not declare its class ymir-himinbjorg\n' >&2; bad=1; }
  if [ "$bad" = 0 ]; then
    win="no window (Electron absent: the page still serves)"
    [ -x node_modules/electron/dist/electron ] && win="window ready"
    printf 'himinbjorg: ready (bun %s, page built, %s)\n' "$("$b" --version)" "$win"
  fi
  exit "$bad"
fi

b="$(bun_bin)" || { printf 'error: bun is not installed (https://bun.sh)\n' >&2; exit 1; }
# The window is optional: a heart has no desk. A failed Electron download leaves the server and the page whole.
"$b" install --frozen-lockfile >/dev/null 2>&1 || "$b" install --frozen-lockfile --ignore-scripts >/dev/null
# bun may leave Electron's binary unfetched; its own installer fetches it. Without it the page still serves.
if [ ! -x node_modules/electron/dist/electron ] && [ -f node_modules/electron/install.js ]; then
  "$b" node_modules/electron/install.js >/dev/null 2>&1 || printf 'himinbjorg: no window binary fetched — the page still serves\n' >&2
fi
"$b" run build >/dev/null
mkdir -p "${YMIR_APP_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/himinbjorg}"
# A developer's clone gets the gates on every commit; an installed release is not a place to commit.
if git -C "$HERE" rev-parse --git-dir >/dev/null 2>&1 && [ -z "${YMIR_APP_RELEASE:-}" ]; then
  bash bin/gates/install-hooks.sh >/dev/null 2>&1 || true
fi
printf 'himinbjorg: built — ./activate.sh seats the launcher and the unit; ./start.sh opens the tower\n'
