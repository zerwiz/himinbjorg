#!/usr/bin/env bash
# gates.test.sh — every gate refuses its planted fault, and lets a clean change pass.
#
#   bash tests/gates.test.sh
#
# Each case builds a scratch repository holding this repository's gates, a throwaway home with an invented deny
# list (no real word, host or address), stages ONE fault, and runs the same door the hook runs
# (bin/gates/run-gates.sh staged). The case passes only when the named gate is the one that refused.
# The fakes are assembled at run time from pieces, so this file itself carries none of them.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0
ok()  { pass=$((pass + 1)); printf 'ok   %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/     /'; }

# The invented deny list: a word, a host, a house domain. None of them is anyone's.
FAKE_WORD="Qorvandel"
FAKE_HOST="skarnhold-qx"
fake_home() {
  local h="$1"
  mkdir -p "$h/hodd/security" "$h/hodd/data" "$h/hodd/identity"
  printf '%s\n' "$FAKE_WORD" > "$h/hodd/security/operator-words.txt"
  printf '{"hosts": {"%s": {}}}\n' "$FAKE_HOST" > "$h/hodd/data/fleet.json"
  printf 'example.org\n' > "$h/hodd/identity/house-domains.txt"
}

# A scratch repository with the gates, its own clean first commit, and the fake home.
scratch() {
  local d="$WORK/$1"
  mkdir -p "$d"
  cp -r "$ROOT/bin" "$ROOT/.gitleaks.toml" "$ROOT/.pi" "$ROOT/RULES" "$d/"   # .pi + RULES: the wards' root mark
  git -C "$d" init -q -b main
  git -C "$d" config user.name tester
  git -C "$d" config user.email "1+tester@users.noreply.github.com"
  git -C "$d" add -A && git -C "$d" commit -q -m "gates" --no-verify
  fake_home "$d.home"
  printf '%s' "$d"
}

run_gates() {  # <repo> [env...] -> stdout+stderr, exit code
  local d="$1"; shift
  env -u HIMINBJORG_DENY_LIST -u CI YMIR_HOME="$d.home" YMIR_PUBLIC_GUARD_STRICT=1 \
      YMIR_VAULT_GUARD_SRC="${VAULT_SRC:-}" "$@" bash "$d/bin/gates/run-gates.sh" staged 2>&1
}

# expect_refused <case> <gate> <file> <content> [env...]
expect_refused() {
  local name="$1" gate="$2" file="$3" content="$4"; shift 4
  local d out rc
  d="$(scratch "$name")"
  mkdir -p "$d/$(dirname "$file")"
  printf '%s\n' "$content" > "$d/$file"
  git -C "$d" add -- "$file"
  out="$(cd "$d" && run_gates "$d" "$@")"; rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -Eq "gate ${gate} +REFUSED"; then ok "$name — $gate refuses it"
  else bad "$name — $gate did not refuse it (exit $rc)" "$out"; fi
}

# ── the clean control: an honest change passes every gate ────────────────────────────────
d="$(scratch clean)"
printf 'The tower reads what the hound wrote.\n' > "$d/notes.md"
git -C "$d" add notes.md
out="$(cd "$d" && run_gates "$d")"; rc=$?
[ "$rc" -eq 0 ] && ok "clean change — every gate passes" || bad "clean change was refused (exit $rc)" "$out"

# ── secrets ──────────────────────────────────────────────────────────────────────────────
key="AK""IA""QZ7RWXK4M2NP5TLV"                                    # an access-key shape, invented
expect_refused "fake-key" "secret-guard" "server/config.ts" "export const k = '$key';"
expect_refused "private-env-file" "secret-guard" ".env.local" "TOKEN=x"
shelf="hodd/""secrets"                                            # the home's secrets shelf, named in pieces
expect_refused "plaintext-secrets-shelf" "secrets-plaintext" "$shelf/stray.env" "LOGIN=someone"

# ── personal data ────────────────────────────────────────────────────────────────────────
mail="ragnhild.fake""@""gm""ail.com"                              # a personal mailbox, invented
expect_refused "personal-email" "public-guard" "docs/contact.md" "Write to $mail"
addr="192.168""."'57.23'                                          # a private address, invented
expect_refused "private-address" "public-guard" "server/probe.ts" "const target = '$addr';"
expect_refused "fleet-host" "public-guard" "bin/reach.sh" "ssh $FAKE_HOST uptime"
expect_refused "operator-word" "public-guard" "docs/about.md" "Built for $FAKE_WORD."
expect_refused "home-path" "private-guard" "docs/where.md" "The list lives in ~/""Documents/hodd-notes"

# ── identity ─────────────────────────────────────────────────────────────────────────────
expect_refused "personal-author" "identity-guard" "notes.md" "a line" \
  GIT_AUTHOR_EMAIL="$mail" GIT_COMMITTER_EMAIL="$mail" \
  GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.email GIT_CONFIG_VALUE_0="$mail"   # the guard reads user.email

# ── the vault ────────────────────────────────────────────────────────────────────────────
mkdir -p "$WORK/vault"
printf 'a page held under a promise\n' > "$WORK/vault/held.md"
VAULT_SRC="$WORK/vault" expect_refused "vault-copy" "vault-guard" "docs/held.md" "a page held under a promise"

# ── gitleaks (required in CI; noted on a seat that lacks it) ─────────────────────────────
if command -v "${YMIR_GITLEAKS:-gitleaks}" >/dev/null 2>&1; then
  # a token shape, invented fresh each run (gitleaks ignores a low-entropy fake, so it must look random)
  gh_tok="gh""p_""$(python3 -c 'import secrets,string; print("".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(36)))')"
  expect_refused "gitleaks-token" "gitleaks" "app/token.txt" "token: $gh_tok"
elif [ -n "${CI:-}" ]; then
  bad "gitleaks is not installed in CI"
else
  printf 'note gitleaks is not installed on this seat — CI runs its planted fault\n'
fi

# ── the CI road: no home, the deny list arrives as the HIMINBJORG_DENY_LIST secret ───────
d="$(scratch ci-deny-list)"
printf 'ssh %s uptime\n' "$FAKE_HOST" > "$d/reach.sh"
git -C "$d" add reach.sh
deny="$(python3 -c 'import base64,json,sys; print(base64.b64encode(json.dumps({"words": [sys.argv[1]], "hosts": [sys.argv[2]], "domains": []}).encode()).decode())' "$FAKE_WORD" "$FAKE_HOST")"
out="$(cd "$d" && env CI=1 RUNNER_TEMP="$WORK/runner-ci" HIMINBJORG_DENY_LIST="$deny" YMIR_HOME="$WORK/no-home" \
       bash "$d/bin/gates/run-gates.sh" staged 2>&1)"; rc=$?
mkdir -p "$WORK/runner-ci"
if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -Eq "gate public-guard +REFUSED" && ! printf '%s' "$out" | grep -q "$FAKE_WORD"; then
  ok "ci-deny-list — the secret's host is refused, and the list is never printed"
else bad "ci-deny-list — the CI road did not refuse the host, or printed the list (exit $rc)" "$out"; fi

# ── the pull-request ward (CI posture, through a fake event) ─────────────────────────────
ev="$WORK/event.json"
python3 -c 'import json,sys; json.dump({"pull_request": {"number": 1, "title": "tower: a page", "body": "Reach me at " + sys.argv[1], "user": {"login": "tester"}, "head": {"ref": "feature/x"}}}, open(sys.argv[2], "w"))' "$mail" "$ev"
out="$(env -u HIMINBJORG_DENY_LIST YMIR_HOME="$WORK/clean.home" GITHUB_EVENT_PATH="$ev" bash "$ROOT/bin/gates/guards/pr-identity-guard.sh" --ci 2>&1)"; rc=$?
# Refused FOR THE MAILBOX, not because the ward could not run (a missing helper also exits 1).
[ "$rc" -eq 1 ] && ! printf '%s' "$out" | grep -qiE "no such file|can't open|command not found" && ok "pr-body-email — pr-identity-guard refuses it" || bad "pr-body-email — pr-identity-guard did not refuse (exit $rc)" "$out"

python3 -c 'import json,sys; json.dump({"pull_request": {"number": 2, "title": "tower: a page", "body": "Adds the page.", "user": {"login": "tester"}, "head": {"ref": "feature/x"}}}, open(sys.argv[1], "w"))' "$ev"
out="$(env -u HIMINBJORG_DENY_LIST YMIR_HOME="$WORK/clean.home" GITHUB_EVENT_PATH="$ev" bash "$ROOT/bin/gates/guards/pr-identity-guard.sh" --ci 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && ok "pr-body-clean — pr-identity-guard lets an honest pull request pass" || bad "pr-body-clean — an honest pull request was refused (exit $rc)" "$out"

printf 'gates_test: %s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
