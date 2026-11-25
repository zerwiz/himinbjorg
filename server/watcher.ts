// watcher.ts — the tower's clock: measure, judge, and raise ONE alert per new fault.
//
// Every cycle (HIMINBJORG_CYCLE_SECONDS, 60) it reads the register, measures what this machine runs, reads its own
// health, and every fifth cycle the Cloudflare tunnels (that read asks Cloudflare's API). It keeps the newest
// reading for the doors and the page.
//
// The alert law: a fault that is NEW sends one line through Ymir's alarm road (bin/notify/send.sh, source `ward`,
// a stable key per fault). It is not sent again while the fault stands; when it clears and returns, it is new again.
// No alert is ever sent from a test (bun test sets NODE_ENV=test), when HIMINBJORG_ALERTS=0, or where Ymir is not
// installed. The tower sends words; it never restarts what it watches.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readRegister, rowsForThisMachine } from './register';
import { whoAmI, type Self } from './self';
import { gatherFacts, judgeService, unregisteredContainers, isFault, type Service } from './probe';
import { listTunnels, readConfigs, judgeTunnels, type Tunnel } from './tunnels';
import { readHost, hostFaults, type Host } from './host';

export type Reading = {
  at: string; self: Self | null; services: Service[] | null; servicesWhy: string; skipped: number; elsewhere: number;
  tunnels: Tunnel[] | null; tunnelsWhy: string; host: Host | null;
  faults: Array<{ key: string; text: string }>;
};

export type Fault = { key: string; text: string };

export function faultsOf(services: Service[] | null, tunnels: Tunnel[] | null, host: Host | null): Fault[] {
  const out: Fault[] = [];
  for (const s of services ?? []) {
    if (isFault(s) && s.expected !== 'unregistered') out.push({ key: `service.${s.name}`, text: `${s.name} is ${s.state}${s.lastError ? ` — ${s.lastError}` : ''}` });
  }
  for (const t of tunnels ?? []) {
    // A tunnel with no config here and no connection is someone else's or long dead: listed, never an alarm.
    if (t.configured && t.verdict !== 'live') out.push({ key: `tunnel.${t.name}`, text: `tunnel ${t.name}: ${t.verdict}` });
  }
  if (host) out.push(...hostFaults(host));
  return out;
}

/** Which faults are new since the last cycle, and the set to remember. Pure, so the law can be tested. */
export function newFaults(prev: Set<string>, now: Fault[]): { fresh: Fault[]; remember: Set<string> } {
  return { fresh: now.filter((f) => !prev.has(f.key)), remember: new Set(now.map((f) => f.key)) };
}

function stateDir() {
  const d = process.env.YMIR_APP_STATE_DIR || join(process.env.XDG_STATE_HOME || join(process.env.HOME || '', '.local/state'), 'himinbjorg');
  mkdirSync(d, { recursive: true });
  return d;
}

function ymirRoot(): string {
  for (const c of [process.env.YMIR_RUNTIME_DIR, join(process.env.HOME || '', 'ymir-runtime')]) {
    if (c && existsSync(join(c, 'bin/notify/send.sh'))) return c;
  }
  return '';
}

function alertsAllowed(): boolean {
  return process.env.NODE_ENV !== 'test' && process.env.HIMINBJORG_ALERTS !== '0' && Boolean(ymirRoot());
}

function sendAlert(f: Fault): void {
  const send = join(ymirRoot(), 'bin/notify/send.sh');
  spawnSync('bash', [send, '--source', 'ward', '--severity', 'HIGH', '--key', `himinbjorg.${f.key}`,
    '--message', `Himinbjörg: ${f.text}`], { encoding: 'utf8', timeout: 30_000 });
}

export class Watcher {
  latest: Reading = { at: '', self: null, services: null, servicesWhy: 'not measured yet', skipped: 0, elsewhere: 0, tunnels: null,
                      tunnelsWhy: 'not measured yet', host: null, faults: [] };
  private cycle = 0;
  private known: Set<string>;
  private memory: string;
  private self: Self;

  constructor(private home: string) {
    this.memory = join(stateDir(), 'faults.json');
    this.self = whoAmI(home, ymirRoot());
    try { this.known = new Set(JSON.parse(readFileSync(this.memory, 'utf8'))); } catch { this.known = new Set(); }
  }

  measure(): Reading {
    const reg = readRegister(this.home);
    let services: Service[] | null = null;
    let servicesWhy = '';
    let ports = new Set<number>();
    let elsewhere = 0;
    if (!reg) {
      servicesWhy = 'this machine keeps no services register ($YMIR_HOME/config/services.yaml)';
    } else {
      const { here, elsewhere: away } = rowsForThisMachine(reg.rows, this.self);
      elsewhere = away;
      const facts = gatherFacts(here);
      ports = facts.ports;
      // A container the register does not name is this machine's own, whichever role it has.
      services = [...here.map((r) => judgeService(r, facts)), ...unregisteredContainers(reg.rows, facts)];
    }
    let tunnels = this.latest.tunnels;
    let tunnelsWhy = this.latest.tunnelsWhy;
    if (this.cycle % 5 === 0) {
      const { listed, why } = listTunnels();
      tunnels = listed ? judgeTunnels(listed, readConfigs(), ports.size ? ports : gatherFacts([]).ports) : null;
      tunnelsWhy = why;
    }
    this.cycle++;
    const host = readHost();
    const faults = faultsOf(services, tunnels, host);
    this.latest = { at: new Date().toISOString(), self: this.self, services, servicesWhy, skipped: reg?.skipped ?? 0, elsewhere,
                    tunnels, tunnelsWhy, host, faults };
    const { fresh, remember } = newFaults(this.known, faults);
    if (alertsAllowed()) for (const f of fresh) sendAlert(f);
    this.known = remember;
    try { writeFileSync(this.memory, JSON.stringify([...remember])); } catch { /* memory is a courtesy */ }
    return this.latest;
  }

  start(seconds = Number(process.env.HIMINBJORG_CYCLE_SECONDS || 60)): void {
    const tick = () => { try { this.measure(); } catch (e) { console.error('[himinbjorg] a cycle failed:', (e as Error).message); } };
    setTimeout(tick, 200);            // after the server has bound its port, so the page answers at once
    setInterval(tick, Math.max(10, seconds) * 1000);
  }
}
