// server.test.ts — the tower reads what the hound wrote, says a silent hound is a finding, and binds loopback only.
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { wardState } from '../server/ward';
import { parseHouse } from '../server/house';

function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'tower-home-'));
  const log = mkdtempSync(join(tmpdir(), 'tower-garmr-'));
  mkdirSync(join(home, 'state/garmr'), { recursive: true });
  mkdirSync(join(log, 'state'), { recursive: true });
  return { home, log };
}

describe('wardState — the hound record', () => {
  test('counts the judged ledger, keeps the newest HIGH and CRITICAL, and reports the whole total', () => {
    const { home, log } = fixture();
    const rows = [
      { ts: 't1', severity: 'INFO', line: 'a' },
      { ts: 't2', severity: 'HIGH', line: 'b', reasoning: { rung: 'r1', model: 'm' } },
      { ts: 't3', severity: 'CRITICAL', line: 'c' },
    ];
    writeFileSync(join(home, 'state/garmr/judged.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n{torn');
    const now = Date.parse('2026-11-25T00:10:00Z');
    writeFileSync(join(log, 'state/hound.heartbeat'), '2026-11-25T00:09:00Z');
    writeFileSync(join(log, 'findings.jsonl'), '{}\n{}\n');
    const s = wardState({ home, garmrLog: log, now });
    expect(s.judged).toBe(4);            // the torn line is in the record's count (as Hlidskjalf counted), not in a severity
    expect(s.bySeverity).toEqual({ INFO: 1, MEDIUM: 0, HIGH: 1, CRITICAL: 1 });
    expect(s.newest.map((r) => r.line)).toEqual(['c', 'b']);
    expect(s.heartbeatAgeSeconds).toBe(60);
    expect(s.silent).toBe(false);
    expect(s.findings).toBe(2);
    expect(s.paused).toBe(false);
  });

  test('a hound with no heartbeat is SILENT, and a pause marker is reported', () => {
    const { home, log } = fixture();
    writeFileSync(join(home, 'state/garmr/PAUSED'), '');
    const s = wardState({ home, garmrLog: log });
    expect(s.silent).toBe(true);
    expect(s.heartbeatAgeSeconds).toBe(-1);
    expect(s.paused).toBe(true);
  });

  test('a missing home is said, never read as a calm', () => {
    const s = wardState({ home: '', garmrLog: '/nonexistent' });
    expect(s.home).toBe('missing');
    expect(s.silent).toBe(true);
  });
});

describe('parseHouse — the door prober rows', () => {
  test('reads the rows and the findings, and ignores the deltas', () => {
    const text = [
      'house-status[2]{name,class,port,expect,live,road,edge}:',
      '  "gate","house","3889","on","up","loopback","-"',
      '  "site","web","8080","on","down","tunnel","https://example.org"',
      'house-status findings[1]:',
      '  - site: expected on, nothing answers',
      'house-status deltas[0]: none',
    ].join('\n');
    const h = parseHouse(text);
    expect(h.rows.length).toBe(2);
    expect(h.rows[1]).toEqual({ name: 'site', class: 'web', port: '8080', expect: 'on', live: 'down', road: 'tunnel', edge: 'https://example.org' });
    expect(h.findings).toEqual(['site: expected on, nothing answers']);
  });
});

describe('the server binds loopback only', () => {
  test('a wide address is refused without the explicit override', () => {
    const out = spawnSync(process.execPath, [join(import.meta.dir, '../server/main.ts')], {
      env: { ...process.env, HIMINBJORG_HOST: '0.0.0.0', HIMINBJORG_PORT: '0', HIMINBJORG_HOME: '/nonexistent' },
      encoding: 'utf8', timeout: 20_000,
    });
    expect(out.status).toBe(2);
    expect(out.stderr).toContain('loopback only');
  });
});
