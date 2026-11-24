# Rule 02 — the tower is a glass

## What the rule says

Himinbjörg reads and shows. It never starts, stops, restarts or closes anything, and it never changes a file it
reads. The hands that act (the hound's pause, the warden's mends, the defender's incidents) live in Ymir and belong to
the operator.

The one thing the tower may send is a notice: when a watched service goes down, one alert through Ymir's alarm road
(`bin/notify/send.sh`). Never from a test.

## It listens on loopback only

The tower's server binds `127.0.0.1`. No tunnel may point at it; the halls are local.

## CHANGE LOG

- **2026-11-25** — written with the gates (Ymir's plan 370).
