# Rule 01 — nothing private here, and the gates come first

## What the rule says

This repository is public. It never carries a secret, a key, a person's name or mailbox, a client, a host name, a
private address or a path into someone's home. Not in a file, a comment, a fixture, a commit message or a commit's
author line.

## How it is kept

- The gates in `bin/gates/` judge every commit (`.githooks/pre-commit`), every push (`.githooks/pre-push`) and every
  pull request (`.github/workflows/gates.yml`). Seat the hooks once with `bin/gates/install-hooks.sh`.
- The gates are Ymir's own wards, copied byte for byte. `bin/gates/vendor-sync.sh --check` proves the copies match.
  A change to a gate is made in Ymir, never here.
- The operator's deny list (his words, his machines, his mail domains) is never in this tree. A seat reads it from
  the operator's home; CI reads it from the `HIMINBJORG_DENY_LIST` secret, written by `bin/gates/deny-seed.sh`.
- `tests/gates.test.sh` plants one fault per gate and proves each gate refuses it.

> [!IMPORTANT]
> A refused commit is fixed in the change, never by weakening a gate or passing `--no-verify`.

## CHANGE LOG

- **2026-11-25** — written with the gates, before any code landed (Ymir's plan 370).
