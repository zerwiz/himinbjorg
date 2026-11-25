# The watcher, and the doors Valaskjálf reads

**Component:** watcher · **Date:** 2026-11-25 · **Plan:** Ymir's plan 370, its "more UI" and "correction" sections

## What changed

- `server/watcher.ts` measures every minute: the register's services (`server/register.ts`, `server/probe.ts`), the
  Cloudflare tunnels every fifth cycle (`server/tunnels.ts`), and the host (`server/host.ts`). It raises one alert per
  new fault through Ymir's `bin/notify/send.sh` (source `ward`, key `himinbjorg.<fault>`).
- A register row is judged on its own machine (`machine:`, or the heart). The role is read through Ymir's
  `bin/skuld/role.sh resolve` (`server/self.ts`), then the fleet registry.
- `server/doors.ts` publishes `/doors/services`, `/doors/tunnels` and `/doors/host` in Valaskjálf's JSON door shape;
  `bin/door.sh` is the same as a command.
- The page gains a small "This machine" strip: the gauges and the faults. The whole house stays in Valaskjálf.

## Why

The operator asked for every service and container, live, with one alert when one falls. The correction the same
day: Valaskjálf already is the hall. So the tower is the watcher behind it, and publishes doors the hall reads.

## Proof

- `bun test tests` → 18 pass, 0 fail (register, judging, tunnels, host, the alert law, the door shapes).
- On the dev seat, with alerts off: services `0 of 7 not running · 34 more measured on their own machine`; tunnels
  `3 of 4 on this machine dead or empty`; host disk 69 %, memory 30 %, swap 0 %, GPU 3 %. The window showed the strip
  with no console error; the window and the server were closed afterwards.

## Found while measuring

The home's services register has one line (row 7) that no YAML parser accepts: a stray shell quote. This tower reads
the register line by line, so that costs one row. The register itself is the operator's to correct.
