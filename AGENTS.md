# AGENTS.md — working on Himinbjörg

Himinbjörg is Ymir's watchtower, installed by Ymir as an app (`bin/apps/apps.sh install himinbjorg`). It watches what
the house runs and raises an alert when a door falls. It publishes what it sees for Gimlé's command hall, Valaskjálf,
to read, and keeps a small page of its own for when Gimlé is down. It reads; it never acts (RULES/02).

## Before you change anything

- **This repository is public** (RULES/01). No secret, person, mailbox, client, host name, private address or home path,
  in any file, comment, fixture, commit message or author line.
- **Seat the hooks once:** `bin/gates/install-hooks.sh`. Every commit and push then meets `bin/gates/run-gates.sh`.
- **Never edit a file listed in `VENDORED`.** Those are Ymir's gates, copied byte for byte. Change them in Ymir, then
  run `bin/gates/vendor-sync.sh --update <ymir-commit>`.
- **The deny list is never committed.** A seat reads it from the operator's home; CI reads the
  `HIMINBJORG_DENY_LIST` secret, which `bin/gates/deny-seed.sh` writes from the home.

## How work leaves

- A branch and a pull request. Never a push to `main`; the pre-push hook refuses it.
- One fix note per change in `docs/fixes/<component>/`, and a test when behaviour changes.
- Stage named files only. No AI attribution anywhere.

## The commands

| Command | Does |
|---|---|
| `bin/gates/run-gates.sh staged` | The gates over what is staged (the pre-commit hook) |
| `bin/gates/run-gates.sh range <base> <head>` | The gates over what a push or pull request adds |
| `bin/gates/run-gates.sh tree` | Every tracked file, and gitleaks over the whole history (CI) |
| `bash tests/gates.test.sh` | Each gate refuses its planted fault, and a clean change passes |
| `bin/gates/vendor-sync.sh --check` | The borrowed gates still match Ymir |

## CHANGE LOG

- **2026-11-25** — written with the gates, before any code landed (Ymir's plan 370).
- **2026-11-25** — corrected: the deny list never leaves the home. The bullet above that names the
  `HIMINBJORG_DENY_LIST` secret and `deny-seed.sh` is withdrawn: both are gone. The local hooks read the home (through
  `bin/gates/agnostic-audit.sh` and the public guard), and CI judges shapes only. `bin/gates/deny-status.sh` checks a
  seat.
