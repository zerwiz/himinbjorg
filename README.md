# Himinbjörg — the watchtower

Himinbjörg is where the warden looks from. It reads what the house's watchers write and shows it: the hound's judged
findings, its heartbeat, the pause marker, and the doors this machine hosts. It never starts, stops or closes
anything (RULES/02).

> [!IMPORTANT]
> This repository is public. Its gates (secrets, personal data, identity, the vault) landed before any code did, and
> every pull request runs them. Nothing private belongs here (RULES/01).

## Where it fits

The house is looked at in **Valaskjálf**, the command hall in Gimlé. Himinbjörg is the watcher behind it: it measures,
and the hall shows. Its own page is small on purpose. It is what still answers on this machine when Gimlé is down.
Hlidskjalf's hound pill reads the tower and links to it.

## Install

Through Ymir, which gives it its own home under `~/.local/share/ymir-apps/himinbjorg/`:

```bash
bin/apps/apps.sh install himinbjorg      # in Ymir
ymir-app himinbjorg                      # open it
```

From a plain clone, you need [bun](https://bun.sh):

```bash
./install.sh            # packages, the page built into ui/dist, and the hooks seated
./start.sh              # the server (127.0.0.1:3896), then the window
./start.sh --server     # the server only, for a machine with no desk
```

`./activate.sh` seats the launcher entry and the user unit `himinbjorg.service`. The unit is not enabled for you:
`systemctl --user enable --now himinbjorg.service` makes the tower watch from boot.

## What it reads

| Source | What it gives |
|---|---|
| `$YMIR_HOME/state/garmr/judged.jsonl` and `PAUSED` | The hound's judged findings, and whether it is paused |
| `/var/log/ymir/garmr/` (`HIMINBJORG_GARMR_LOG`) | The hound's heartbeat (a silent hound is a finding) and its raw findings |
| `$YMIR_HOME/state/assistant/` | The assistant's heartbeat and today's answers |
| `$YMIR_HOME/config/services.yaml`, through `bin/house-status.sh` | The doors this machine hosts, and whether each answers |

The server answers `GET /api/health`, `/api/ward` and `/api/house` on loopback only. It refuses any other address
unless `HIMINBJORG_ALLOW_WIDE_BIND=1` is set on purpose, and no tunnel may point at it.

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

Seat the hooks with `bin/gates/install-hooks.sh`. `bash tests/gates.test.sh` proves each gate refuses a planted fault,
and `bun test tests` tests the server. Agents read `AGENTS.md`.

## History

The panel and the door prober left Ymir with their history (`ui/src/Ward.tsx`, `bin/house-status.sh`, cut with
`git filter-repo`). The ward reader was a function in Hlidskjalf's server and arrives as `server/ward.ts`.
