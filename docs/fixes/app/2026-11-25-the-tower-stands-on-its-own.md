# The tower stands on its own: its server, its page, its contract

**Component:** app · **Date:** 2026-11-25 · **Plan:** Ymir's plan 370, step 3

## What changed

- `server/ward.ts` carries the ward reader out of Hlidskjalf's server. The logic is unchanged; the home and the hound's
  log folder became parameters so a test can use a fixture.
- `server/main.ts` serves `/api/health`, `/api/ward`, `/api/house` and the page, on `127.0.0.1:3896` only.
- `server/house.ts` runs the moved door prober (`bin/house-status.sh`) at most once a minute and parses its rows.
- `ui/src/Ward.tsx` (moved) reads the tower's own server, and its `page` prop shows the panel open in place.
  `ui/src/main.tsx` is the small page: the hound, and the doors this machine hosts.
- The app contract Ymir installs by: `app.yaml`, `install.sh` (with `--check`), `start.sh`, `activate.sh` (the
  launcher and the unit `himinbjorg.service`), `uninstall.sh`, and an Electron window (`electron/main.cjs`, class
  `ymir-himinbjorg`, DevTools on `9417`).

## Why

The operator's word: Himinbjörg is an app with its own repository, installed by Ymir. The correction the same day
keeps the tower small: Valaskjálf in Gimlé is the hall, and this page is what stays when Gimlé is down.

## Proof

- `bun test tests` → 5 pass, 0 fail.
- On the dev seat, the tower's `/api/ward` and Hlidskjalf's gave the same answer: 19,820 judged, the same severities,
  and the hound listening.
- In the real window, read through DevTools on `9417`: the hound panel and four doors, with no console error. The test
  window and server were closed afterwards, and nothing listens on 3896 or 9417.
