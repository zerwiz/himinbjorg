// house.ts — the door prober's answer (bin/house-status.sh), parsed for the page.
//
// house-status.sh prints TOON rows: `house-status[N]{name,class,port,expect,live,road,edge}:` then one quoted row
// per service, then its findings and deltas. This turns that into JSON. It runs the prober at most once a minute,
// because the prober opens sockets and asks every public hostname.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { APP_ROOT } from './home';

export type HouseRow = { name: string; class: string; port: string; expect: string; live: string; road: string; edge: string };
export type House = { state: 'read' | 'no-register' | 'failed'; rows: HouseRow[]; findings: string[]; at: string; detail?: string };

const FIELDS = ['name', 'class', 'port', 'expect', 'live', 'road', 'edge'] as const;

export function parseHouse(text: string): Pick<House, 'rows' | 'findings'> {
  const rows: HouseRow[] = [];
  const findings: string[] = [];
  let section: 'rows' | 'findings' | 'other' = 'other';
  for (const line of text.split('\n')) {
    if (line.startsWith('house-status[')) { section = 'rows'; continue; }
    if (line.startsWith('house-status findings')) { section = 'findings'; continue; }
    if (line.startsWith('house-status')) { section = 'other'; continue; }
    if (section === 'rows' && line.startsWith('  "')) {
      const cells = [...line.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      if (cells.length === FIELDS.length) {
        rows.push(Object.fromEntries(FIELDS.map((f, i) => [f, cells[i]])) as HouseRow);
      }
    } else if (section === 'findings' && line.startsWith('  - ')) {
      findings.push(line.slice(4));
    }
  }
  return { rows, findings };
}

let cache: { at: number; value: House } | null = null;

export function houseState(home: string, now = Date.now()): House {
  if (cache && now - cache.at < 60_000) return cache.value;
  const register = home ? join(home, 'config/services.yaml') : '';
  let value: House;
  if (!register || !existsSync(register)) {
    value = { state: 'no-register', rows: [], findings: [], at: new Date(now).toISOString(),
              detail: 'this machine keeps no services register (the heart does)' };
  } else {
    const out = spawnSync('bash', [join(APP_ROOT, 'bin', 'house-status.sh')],
      { encoding: 'utf8', timeout: 90_000, env: { ...process.env, YMIR_HOME: home } });
    value = out.status === 0
      ? { state: 'read', ...parseHouse(out.stdout || ''), at: new Date(now).toISOString() }
      : { state: 'failed', rows: [], findings: [], at: new Date(now).toISOString(),
          detail: (out.stderr || out.stdout || 'the prober did not answer').trim().slice(-300) };
  }
  cache = { at: now, value };
  return value;
}
