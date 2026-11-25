#!/usr/bin/env bash
# activate.sh — seat what names the LIVE release; Ymir's apps.sh runs it after every flip and rollback.
#
# The launcher entry (himinbjorg.desktop: Ymir's `ymir-app himinbjorg`) and the user unit himinbjorg.service (the
# server, loopback only), both rendered from this repo's templates with the app folder as the apps home's `current`
# link, which follows every update. The unit is not enabled here: whether the tower watches from boot on a machine
# is the operator's choice (`systemctl --user enable --now himinbjorg.service`).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
link="${YMIR_APPS_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/ymir-apps}/himinbjorg/current"
[ -L "$link" ] && appdir="$link" || appdir="$HERE"
data="${XDG_DATA_HOME:-$HOME/.local/share}"; units="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
bun="$(command -v bun 2>/dev/null || printf '%s' "$HOME/.bun/bin/bun")"
if [ -n "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ] || [ -d "$data/applications" ]; then
  mkdir -p "$data/applications" "$data/icons/hicolor/scalable/apps"
  sed -e "s|__YMIR_APP__|${YMIR_SHORTCUT_BIN:-$HOME/.local/bin}/ymir-app|g" \
    "$HERE/electron/himinbjorg.desktop.in" > "$data/applications/himinbjorg.desktop"
  cp -f "$HERE/electron/icon.svg" "$data/icons/hicolor/scalable/apps/ymir-himinbjorg.svg"
  printf 'himinbjorg: launcher entry seated\n'
fi
mkdir -p "$units"
sed -e "s|__APP_DIR__|$appdir|g" -e "s|__BUN__|$bun|g" "$HERE/electron/himinbjorg.service.in" > "$units/himinbjorg.service"
systemctl --user daemon-reload >/dev/null 2>&1 || true
printf 'himinbjorg: unit himinbjorg.service names %s\n' "$appdir"
