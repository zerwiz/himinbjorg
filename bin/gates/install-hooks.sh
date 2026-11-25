#!/usr/bin/env bash
# install-hooks.sh — seat this repository's hooks (.githooks/) so every commit and push meets the gates.
#   bin/gates/install-hooks.sh          set core.hooksPath to .githooks
#   bin/gates/install-hooks.sh --check  exit 1 when the hooks are not seated
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ "${1:-}" = --check ]; then
  [ "$(git -C "$ROOT" config core.hooksPath || true)" = .githooks ] && { echo "hooks: seated (.githooks)"; exit 0; }
  echo "hooks: NOT seated — run bin/gates/install-hooks.sh" >&2; exit 1
fi
chmod +x "$ROOT"/.githooks/* "$ROOT"/bin/gates/*.sh
git -C "$ROOT" config core.hooksPath .githooks
echo "hooks: seated (.githooks) — pre-commit and pre-push run bin/gates/run-gates.sh"
