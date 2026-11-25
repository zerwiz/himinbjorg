// home.ts — where the house's records are: the operator's home, resolved ONCE (Ymir's Rule 07).
//
// Order: HIMINBJORG_HOME (a test or a second seat), YMIR_HOME, then Ymir's own resolver (the vendored
// bin/vault/hoard-lib.sh, the same one every Ymir script uses). No guessed default: a tower that cannot find the
// home says so, rather than reading an empty folder and reporting a calm.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const APP_ROOT = join(import.meta.dir, '..');

export function resolveHome(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.HIMINBJORG_HOME || env.YMIR_HOME;
  if (explicit) return explicit;
  const lib = join(APP_ROOT, 'bin', 'vault', 'hoard-lib.sh');
  if (!existsSync(lib)) return '';
  const out = spawnSync('bash', ['-c', `. "${lib}" >/dev/null 2>&1; h=""; ymir_home_root h; printf %s "$h"`],
    { encoding: 'utf8', timeout: 20_000 });
  return (out.stdout || '').trim();
}
