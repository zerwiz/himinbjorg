// probe.ts — what this machine actually runs, measured: units, containers and listening ports.
//
// The facts are gathered once per cycle (gatherFacts), and judged by pure functions (judgeServices), so a test can
// hand in invented facts. Nothing here starts, stops or restarts anything: systemctl `show`, docker `ps`,
// journalctl and ss are read-only.
import { spawnSync } from 'node:child_process';
import type { RegisterRow } from './register';

export type Unit = { id: string; scope: 'user' | 'system'; load: string; active: string; sub: string; since: string;
                     memory: number | null; restarts: number; result: string };
export type Container = { name: string; state: string; status: string; image: string; project: string };
export type Facts = { ports: Set<number>; units: Map<string, Unit>; containers: Map<string, Container>;
                      lastError: (u: Unit) => string; at: number };

export type ServiceState = 'up' | 'down' | 'restarting' | 'failed' | 'off' | 'unmeasured';
export type Service = { name: string; group: string; state: ServiceState; since: string; memory: number | null;
                        public: string; lastError: string; port: number | null; road: string; expected: string };

const run = (cmd: string, args: string[], timeout = 15_000) => {
  const out = spawnSync(cmd, args, { encoding: 'utf8', timeout });
  return out.status === 0 ? out.stdout : '';
};

export function listeningPorts(): Set<number> {
  const ports = new Set<number>();
  for (const line of run('ss', ['-tlnH']).split('\n')) {
    const local = line.trim().split(/\s+/)[3] ?? '';
    const m = local.match(/:(\d+)$/);
    if (m) ports.add(Number(m[1]));
  }
  return ports;
}

const PROPS = 'Id,LoadState,ActiveState,SubState,ActiveEnterTimestamp,MemoryCurrent,NRestarts,Result';

export function parseShow(text: string, scope: 'user' | 'system'): Unit[] {
  const units: Unit[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const kv: Record<string, string> = {};
    for (const line of block.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) kv[line.slice(0, i)] = line.slice(i + 1);
    }
    if (!kv.Id) continue;
    const mem = Number(kv.MemoryCurrent);
    units.push({ id: kv.Id, scope, load: kv.LoadState ?? '', active: kv.ActiveState ?? '', sub: kv.SubState ?? '',
                 since: kv.ActiveEnterTimestamp ?? '', memory: Number.isFinite(mem) && mem > 0 && mem < 2 ** 60 ? mem : null,
                 restarts: Number(kv.NRestarts) || 0, result: kv.Result ?? '' });
  }
  return units;
}

export function unitsNamed(names: string[]): Map<string, Unit> {
  const want = [...new Set(names.filter(Boolean).map((n) => (n.endsWith('.service') ? n : `${n}.service`)))];
  const found = new Map<string, Unit>();
  if (!want.length) return found;
  for (const scope of ['user', 'system'] as const) {
    const args = [...(scope === 'user' ? ['--user'] : []), 'show', '-p', PROPS, ...want];
    for (const u of parseShow(run('systemctl', args), scope)) {
      if (u.load === 'loaded' && !found.has(u.id)) found.set(u.id, u);
    }
  }
  return found;
}

export function containers(): Map<string, Container> {
  const out = new Map<string, Container>();
  for (const line of run('docker', ['ps', '-a', '--format', '{{json .}}']).split('\n')) {
    if (!line.trim()) continue;
    try {
      const c = JSON.parse(line);
      const project = /com\.docker\.compose\.project=([^,]+)/.exec(c.Labels ?? '')?.[1] ?? '';
      out.set(c.Names, { name: c.Names, state: c.State ?? '', status: c.Status ?? '', image: c.Image ?? '', project });
    } catch { /* one torn line is one missing container, never a failed panel */ }
  }
  return out;
}

function lastErrorOf(u: Unit): string {
  const args = [...(u.scope === 'user' ? ['--user'] : []), '-u', u.id, '-p', 'err', '-n', '1', '-o', 'cat', '--no-pager'];
  return run('journalctl', args, 8_000).trim().split('\n').pop()?.slice(0, 200) ?? '';
}

export function gatherFacts(rows: RegisterRow[]): Facts {
  return { ports: listeningPorts(), units: unitsNamed(rows.map((r) => r.unit || r.name)), containers: containers(),
           lastError: lastErrorOf, at: Date.now() };
}

const HOUSE_OWNERS = new Set(['ymir', 'marketing', 'unconfirmed', '']);

export function groupOf(r: RegisterRow): string {
  if (r.group) return r.group;
  if (!HOUSE_OWNERS.has(r.owner)) return `other projects · ${r.owner}`;
  return r.class || 'unclassed';
}

/** One row of the register, judged against what the machine runs. */
export function judgeService(r: RegisterRow, f: Facts): Service {
  const unitId = (r.unit || r.name).endsWith('.service') ? (r.unit || r.name) : `${r.unit || r.name}.service`;
  const unit = f.units.get(unitId);
  const box = f.containers.get(r.container || r.name);
  const pub = r.host && r.host.includes('.') && !/^(127\.|localhost)/.test(r.host) ? r.host : '';
  const base = { name: r.name, group: groupOf(r), memory: unit?.memory ?? null, public: pub, port: r.port,
                 expected: r.expect, lastError: '', since: '' };
  let state: ServiceState;
  let road: string;
  if (unit) {
    road = `${unit.scope} unit ${unit.id}`;
    state = unit.active === 'active' ? 'up'
      : unit.active === 'activating' || unit.sub === 'auto-restart' ? 'restarting'
      : unit.active === 'failed' ? 'failed' : 'down';
    base.since = unit.since;
  } else if (box) {
    road = `container ${box.name}`;
    state = box.state === 'running' ? 'up' : box.state === 'restarting' ? 'restarting'
      : box.state === 'dead' ? 'failed' : 'down';
    base.since = box.status;
  } else if (r.port) {
    road = `port ${r.port}`;
    state = f.ports.has(r.port) ? 'up' : 'down';
  } else {
    road = 'nothing to measure (no unit, container or port)';
    state = 'unmeasured';
  }
  // A service stopped on purpose is OFF, not down: the register says so, and the tower believes it.
  if (r.expect === 'off' && state !== 'up') state = 'off';
  if (unit && (state === 'failed' || state === 'restarting' || state === 'down') && r.expect !== 'off') {
    base.lastError = f.lastError(unit);
  }
  return { ...base, state, road };
}

/** Containers the register does not name: shown in their own group, so nothing the box runs is hidden. */
export function unregisteredContainers(rows: RegisterRow[], f: Facts): Service[] {
  const named = new Set(rows.map((r) => r.container || r.name));
  return [...f.containers.values()].filter((c) => !named.has(c.name)).map((c) => ({
    name: c.name, group: c.project ? `containers · ${c.project}` : 'containers', public: '', port: null, memory: null,
    state: c.state === 'running' ? 'up' : c.state === 'restarting' ? 'restarting' : 'off',
    since: c.status, lastError: '', road: `container ${c.name} (not in the register)`, expected: 'unregistered',
  }));
}

export const isFault = (s: Service) => s.state === 'down' || s.state === 'failed' || s.state === 'restarting';
