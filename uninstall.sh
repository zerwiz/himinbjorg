#!/usr/bin/env bash
# uninstall.sh — take back what activate.sh seated. The state folder (~/.local/state/himinbjorg) is kept.
set -uo pipefail
data="${XDG_DATA_HOME:-$HOME/.local/share}"; units="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
systemctl --user disable --now himinbjorg.service >/dev/null 2>&1 || true
rm -f "$units/himinbjorg.service" "$data/applications/himinbjorg.desktop" "$data/icons/hicolor/scalable/apps/ymir-himinbjorg.svg"
systemctl --user daemon-reload >/dev/null 2>&1 || true
printf 'himinbjorg: launcher and unit removed; state kept\n'
