# The gates come first — before any code lands

**Component:** gates · **Date:** 2026-11-25 · **Plan:** Ymir's plan 370, step 4

## What changed

The repository received its gates before any of the tower's code:

- Ymir's own wards, vendored byte for byte with the three libraries they source. `VENDORED` records the Ymir commit,
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

- `bash tests/gates.test.sh` → `gates_test: 14 passed, 0 failed` (with gitleaks 8.30.1, checksum-verified).
- `bin/gates/vendor-sync.sh --check` → `14 files in step with Ymir 7c27f324fdd5`, by both roads.
