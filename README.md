# Himinbjörg — the watchtower

Himinbjörg is where the warden looks from. It is a read-only glass over what the house's watchers write: the hound's
judged findings, its heartbeat, the pause marker, and the doors the house hosts. It never starts, stops or closes
anything.

> [!IMPORTANT]
> This repository is public. Its gates (secrets, personal data, identity, the vault) land before any code does, and
> every pull request runs them. Nothing private belongs here.

The app is being seated. The full README arrives with the code.

## The gates

Every commit, push and pull request is judged by `bin/gates/run-gates.sh`, using Ymir's own wards copied byte for
byte (`VENDORED`).

| Gate | Refuses |
|---|---|
| `secret-guard.sh` and gitleaks | a key or token shape, a private env file |
| `public-guard.py` | a personal mailbox, a private address, a fleet host, a word the operator declared his own |
| `private-guard.py` | a path into the operator's home, protected material |
| `identity-guard.sh` and `pr-identity-guard.sh` | a personal mailbox as a commit's author, or in a pull request |
| `vault-guard.sh` and `secrets-plaintext-guard.sh` | a copy of a vault file, a secrets shelf in the clear |

Seat the hooks with `bin/gates/install-hooks.sh`. `bash tests/gates.test.sh` proves each gate refuses a planted fault.
The rules are in `RULES/`, and agents read `AGENTS.md`.
