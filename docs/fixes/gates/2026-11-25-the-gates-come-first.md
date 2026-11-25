# The gates come first — before any code lands

**Component:** gates · **Date:** 2026-11-25 · **Plan:** Ymir's plan 370, step 4

## What changed

The repository received its gates before any of the tower's code:

- Ymir's own wards, vendored byte for byte with the libraries and word lists they read. `VENDORED` records the Ymir commit,
  and `bin/gates/vendor-sync.sh --check` proves the copies match it, from a local checkout or over https.
- One door, `bin/gates/run-gates.sh` (`staged`, `range`, `tree`), called by `.githooks/pre-commit`,
  `.githooks/pre-push` and `.github/workflows/gates.yml` alike.
- The deny list stays out of the tree. `bin/gates/deny-load.sh` builds a throwaway home from the
  `HIMINBJORG_DENY_LIST` secret in CI, and `bin/gates/deny-seed.sh` writes that secret from the home.
- `tests/gates.test.sh` plants one fault per gate and proves it is refused. The fakes are a key, a private env file,
  a secrets shelf, a personal mailbox, a private address, a fleet host, an operator word, a home path, a personal
  commit author, a vault copy, a gitleaks token, the CI deny-list road and a pull-request body.

## Why

The operator's word: the personal-data and secret gates belong in this repository. RULES/04 is why they come first: a
public repository must refuse a leak from its very first code commit.

## One thing to know

The vendored wards find their root by a `.pi/` folder beside a `RULES/` folder, as Ymir's tree has. This repository
carries both (see `.pi/README.md`) so the copies stay unedited.

## Proof

- `bash tests/gates.test.sh` → `gates_test: 15 passed, 0 failed` (with gitleaks 8.30.1, checksum-verified).
- `bin/gates/vendor-sync.sh --check` → `17 files in step with Ymir 7c27f324fdd5`, by both roads.

## Repair, the same day: the pull-request ward's helper

The first CI run failed at `pr-identity-guard.sh --ci`: `bin/forge/pr-patterns.sh` calls `bin/forge/maker-names.py`,
which reads `bin/gates/maker-allow.txt` and `maker-words.txt`, and none of the three had been vendored. The local
test had passed anyway, because a ward that cannot run also exits 1. Now the three files are vendored, the test
refuses a pass whose output says a file could not be opened, and a clean pull request is proven to pass.

## Correction, the same day: the deny list stays in the home (Ymir's road)

This corrects the bullet above that sends the deny list to CI as the `HIMINBJORG_DENY_LIST` secret. At the operator's
word (*"we have ways of handling private data in ymir home"*) the list is never sent to GitHub, matching Ymir exactly:

- On a seat, the vendored wards read the home, as in Ymir. `bin/gates/agnostic-audit.sh`, Ymir's one engine for the
  operator's own words, now runs in every gate pass and reads `$YMIR_HOME/hodd/identity/public-deny.txt`. The public
  guard reads the declared words and the fleet's machine names, binding from the first commit.
- The public CI has no home, so it judges shapes only: keys and tokens, private addresses, personal mailboxes, a real
  tailnet host. Each ward says which half it skipped.
- `bin/gates/deny-load.sh` and `bin/gates/deny-seed.sh` are removed; they existed only for the GitHub secret.
  `bin/gates/deny-status.sh` says, by counts alone, whether a seat's hooks have the home's lists.

Proof: `tests/gates.test.sh` → 16 passed, 0 failed. The two new cases: the home's `public-deny.txt` word is refused
and never printed, and with no home a private address is still refused. `run-gates.sh tree` on a seat with the home's
27 entries: every gate clean.
