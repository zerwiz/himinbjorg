// watcher.test.ts — the watcher judges what it is handed, and raises an alert once per new fault.
// Every fact here is invented; nothing is measured from this machine and no alert is sent (bun test: NODE_ENV=test).
import { describe, expect, test } from 'bun:test';
import { parseRegister, parseRegisterLine, rowsForThisMachine } from '../server/register';
import { judgeService, unregisteredContainers, groupOf, parseShow, type Facts, type Unit } from '../server/probe';
import { parseTunnelConfig, judgeTunnels } from '../server/tunnels';
import { parseMeminfo, parseGpus, hostFaults } from '../server/host';
import { faultsOf, newFaults, type Reading } from '../server/watcher';
import { servicesDoor, tunnelsDoor, hostDoor, NotRead } from '../server/doors';

const REGISTER = [
  'services:',
  '  - { name: "site", host: "site.example.org", class: public, owner: ymir, port: 4100 }',
  '  - { name: "desk", host: "127.0.0.1", class: operator, owner: ymir, port: 4200, note: "a \\"quoted\\" note, with commas" }',
  '  - { name: "old", class: public, owner: ymir, port: 4300, expect: off }',
  '  - { name: "shop", host: "shop.example.net", class: public, owner: acme, port: 4400 }',
  '  - { name: "broken", class: public, note: "a stray quote "here" }',
  '  - { name: "room", class: operator, owner: ymir }',
].join('\n');

const unit = (id: string, active: string, sub = 'running', extra: Partial<Unit> = {}): Unit =>
  ({ id, scope: 'user', load: 'loaded', active, sub, since: 'Tue 2026-11-24 10:00:00 CET', memory: 64 << 20, restarts: 0, result: 'success', ...extra });

function facts(): Facts {
  return {
    ports: new Set([4100, 4400]),
    units: new Map([['site.service', unit('site.service', 'active')], ['desk.service', unit('desk.service', 'failed', 'failed')]]),
    containers: new Map([['stray-db', { name: 'stray-db', state: 'restarting', status: 'Restarting (1) 3 seconds ago', image: 'db', project: 'trial' }]]),
    lastError: (u) => `${u.id}: address already in use`,
    at: 0,
  };
}

describe('the register', () => {
  test('reads flow lines with quoted, escaped values, and one broken line costs one row', () => {
    const { rows, skipped } = parseRegister(REGISTER);
    expect(rows.map((r) => r.name)).toEqual(['site', 'desk', 'old', 'shop', 'broken', 'room']);
    expect(rows[1].note).toBe('a "quoted" note, with commas');
    expect(rows[2].expect).toBe('off');
    expect(skipped).toBe(0);
    expect(parseRegisterLine('  - { class: public }')).toBeNull();
  });
  test('a row is judged on its own machine: named, or the heart when it names none', () => {
    const { rows } = parseRegister(REGISTER + '\n  - { name: "lamp", class: operator, owner: ymir, machine: desk-a, port: 4500 }');
    const onHeart = rowsForThisMachine(rows, { host: 'core-a', roles: ['heart'] });
    expect(onHeart.here.map((r) => r.name)).not.toContain('lamp');
    expect(onHeart.elsewhere).toBe(1);
    const onDesk = rowsForThisMachine(rows, { host: 'desk-a', roles: ['dev'] });
    expect(onDesk.here.map((r) => r.name)).toEqual(['lamp']);
    expect(onDesk.elsewhere).toBe(6);
  });
  test('another project on the same box is grouped apart', () => {
    const { rows } = parseRegister(REGISTER);
    expect(groupOf(rows[3])).toBe('other projects · acme');
    expect(groupOf(rows[0])).toBe('public');
  });
});

describe('judging services', () => {
  const { rows } = parseRegister(REGISTER);
  const f = facts();
  const by = Object.fromEntries(rows.map((r) => [r.name, judgeService(r, f)]));
  test('a unit, a failed unit with its last error, a stopped-on-purpose row, a port, and nothing to measure', () => {
    expect(by.site.state).toBe('up');
    expect(by.site.public).toBe('site.example.org');
    expect(by.site.memory).toBe(64 << 20);
    expect(by.desk.state).toBe('failed');
    expect(by.desk.lastError).toContain('address already in use');
    expect(by.desk.public).toBe('');                 // loopback is never a public address
    expect(by.old.state).toBe('off');                // expect: off is believed, never an alarm
    expect(by.shop.state).toBe('up');                // measured by its port
    expect(by.room.state).toBe('unmeasured');
  });
  test('a container the register does not name is shown, in its own group', () => {
    const extra = unregisteredContainers(rows, f);
    expect(extra).toHaveLength(1);
    expect(extra[0]).toMatchObject({ name: 'stray-db', state: 'restarting', group: 'containers · trial' });
  });
  test('systemctl show blocks are read into units', () => {
    const u = parseShow('Id=a.service\nLoadState=loaded\nActiveState=active\nSubState=running\nMemoryCurrent=1048576\nNRestarts=2\n\nId=b.service\nLoadState=not-found\nMemoryCurrent=[not set]\n', 'user');
    expect(u).toHaveLength(2);
    expect(u[0]).toMatchObject({ id: 'a.service', active: 'active', memory: 1048576, restarts: 2 });
    expect(u[1].memory).toBeNull();
  });
});

describe('tunnels', () => {
  const cfg = parseTunnelConfig([
    'tunnel: alpha', 'credentials-file: /x/alpha.json', 'ingress:',
    '  - hostname: a.example.org', '    service: http://localhost:4100',
    '  - hostname: b.example.org', '    service: http://127.0.0.1:4999',
    '  - service: http_status:404',
  ].join('\n'), 'config-alpha.yml');
  test('a config names its tunnel, hostnames and the port behind each', () => {
    expect(cfg.tunnel).toBe('alpha');
    expect(cfg.ingress).toEqual([{ hostname: 'a.example.org', port: 4100 }, { hostname: 'b.example.org', port: 4999 }]);
  });
  test('dead, nothing behind, no config here, and live are told apart', () => {
    const t = judgeTunnels([
      { id: '1', name: 'alpha', connections: 4 }, { id: '2', name: 'beta', connections: 0 }, { id: '3', name: 'gamma', connections: 2 },
    ], [cfg, parseTunnelConfig('tunnel: delta\ningress:\n  - hostname: d.example.org\n    service: http://localhost:4100\n')], new Set([4100]));
    const v = Object.fromEntries(t.map((x) => [x.name, x.verdict]));
    expect(v).toEqual({ alpha: 'nothing behind', beta: 'dead', gamma: 'no config' });
  });
});

describe('the host', () => {
  test('memory, swap and the GPU are read, and a full disk or swap is a fault', () => {
    const m = parseMeminfo('MemTotal: 1000 kB\nMemFree: 100 kB\nMemAvailable: 400 kB\nSwapTotal: 1000 kB\nSwapFree: 10 kB\n');
    expect(m.memory?.pct).toBe(60);
    expect(m.swap?.pct).toBe(99);
    expect(parseGpus('Card A, 1024, 4096, 37\n')[0]).toMatchObject({ name: 'Card A', util: 37 });
    const faults = hostFaults({ disk: { used: 91, total: 100, pct: 91 }, memory: m.memory, swap: m.swap, gpus: [], at: '' });
    expect(faults.map((f) => f.key)).toEqual(['host.disk', 'host.swap']);
  });
});

describe('the alert law', () => {
  const { rows } = parseRegister(REGISTER);
  const services = [...rows.map((r) => judgeService(r, facts())), ...unregisteredContainers(rows, facts())];
  test('only the register’s own services are alarms — a stray container is shown, not rung', () => {
    const keys = faultsOf(services, null, null).map((f) => f.key);
    expect(keys).toEqual(['service.desk']);
  });
  test('a fault rings once, stays quiet while it stands, and rings again only after it cleared', () => {
    const f = [{ key: 'service.desk', text: 'desk is failed' }];
    const first = newFaults(new Set(), f);
    expect(first.fresh).toHaveLength(1);
    const second = newFaults(first.remember, f);
    expect(second.fresh).toHaveLength(0);
    const cleared = newFaults(second.remember, []);
    expect(newFaults(cleared.remember, f).fresh).toHaveLength(1);
  });
});

describe('the doors Valaskjálf reads', () => {
  const { rows } = parseRegister(REGISTER);
  const services = rows.map((r) => judgeService(r, facts()));
  const reading: Reading = { at: '', self: null, services, servicesWhy: '', skipped: 0, elsewhere: 2, tunnels: null, tunnelsWhy: 'cloudflared is not installed here',
                             host: { disk: { used: 5, total: 10, pct: 50 }, memory: null, swap: null, gpus: [], at: '' }, faults: [] };
  test('services: the faults first, red, each row a door act, and the count of what is not running', () => {
    const d = servicesDoor(reading);
    expect(d.number).toBe(1);
    expect(d.rows[0]).toMatchObject({ text: 'desk — failed', tone: 'red', act: { type: 'door', id: 'desk' } });
    expect(d.unit).toBe('of 6 services not running · 2 more measured on their own machine');
  });
  test('a reading the tower could not take is NotRead (the hall draws DOWN), never a zero', () => {
    expect(() => tunnelsDoor(reading)).toThrow(NotRead);
    expect(hostDoor(reading).rows[0].text).toBe('disk 50%');
  });
});
