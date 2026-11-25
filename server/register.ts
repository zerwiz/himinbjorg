// register.ts — the services register, read the way Ymir's own reader falls back to: one flow line per service.
//
// The register is the operator's ($YMIR_HOME/config/services.yaml, never this repo). Each service is one line,
// `  - { name: "x", host: "…", class: team, port: 8484, expect: off, owner: ymir, note: "…" }`. A strict YAML parser
// refuses the whole file when one note carries a stray quote, so this reads line by line, like
// bin/ward/services-register.sh's regex road: one broken line costs one row, never the register.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RegisterRow = {
  name: string; host: string; class: string; port: number | null; expect: string; owner: string;
  unit: string; container: string; group: string; note: string; machine: string;
};

/**
 * Where a row is measured. A row may name its machine (`machine:`); a row that does not is the heart's, because
 * the register is the heart's manifest ("measured on the heart", its own header). Judging the heart's rows on a
 * dev seat would call every one of them down; this keeps each row to the machine that runs it.
 */
export function rowsForThisMachine(rows: RegisterRow[], self: { host: string; roles: string[] }) {
  const here: RegisterRow[] = [];
  let elsewhere = 0;
  for (const r of rows) {
    const mine = r.machine ? r.machine === self.host : self.roles.includes('heart');
    if (mine) here.push(r); else elsewhere++;
  }
  return { here, elsewhere };
}

// key: "quoted, with \" escapes"  |  key: bare-word-up-to-a-comma-or-brace
const PAIR = /([A-Za-z_][\w-]*)\s*:\s*("(?:[^"\\]|\\.)*"|[^,}]*)/g;

export function parseRegisterLine(line: string): Record<string, string> | null {
  const m = line.match(/^\s*-\s*\{(.*)\}\s*$/);
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const p of m[1].matchAll(PAIR)) {
    let v = p[2].trim();
    if (v.startsWith('"')) v = v.slice(1, -1).replace(/\\(.)/g, '$1');
    out[p[1]] = v;
  }
  return out.name ? out : null;
}

export function parseRegister(text: string): { rows: RegisterRow[]; skipped: number } {
  const rows: RegisterRow[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (!/^\s*-\s*\{/.test(line)) continue;
    const r = parseRegisterLine(line);
    if (!r) { skipped++; continue; }
    const port = Number.parseInt(r.port ?? '', 10);
    rows.push({
      name: r.name, host: r.host ?? '', class: r.class ?? '', port: Number.isFinite(port) ? port : null,
      expect: (r.expect ?? 'on').toLowerCase(), owner: r.owner ?? '', unit: r.unit ?? '', container: r.container ?? '',
      group: r.group ?? '', note: r.note ?? '', machine: r.machine ?? '',
    });
  }
  return { rows, skipped };
}

export function readRegister(home: string): { path: string; rows: RegisterRow[]; skipped: number } | null {
  const path = process.env.HIMINBJORG_REGISTER || (home ? join(home, 'config/services.yaml') : '');
  if (!path || !existsSync(path)) return null;
  return { path, ...parseRegister(readFileSync(path, 'utf8')) };
}
