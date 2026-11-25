// self.ts — which machine the tower stands on, and its roles (heart · forge · dev · hand).
//
// The role is read ONCE, from Ymir's one door (`bin/skuld/role.sh resolve`, Ymir's RULES/25), and only when Ymir is
// absent from the home's fleet registry ($YMIR_HOME/hodd/data/fleet.json: hosts.<name>.roles, and `heart`). With
// neither, the tower says it does not know, and judges as a fleet of one (the default every Ymir install starts as).
import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export type Self = { host: string; roles: string[]; road: 'ymir' | 'fleet' | 'alone' };

export function whoAmI(home: string, ymirRoot = ''): Self {
  const host = (process.env.HIMINBJORG_HOSTNAME || hostname()).split('.')[0];
  if (process.env.HIMINBJORG_ROLES) return { host, roles: process.env.HIMINBJORG_ROLES.split(','), road: 'ymir' };
  const door = ymirRoot ? join(ymirRoot, 'bin/skuld/role.sh') : '';
  if (door && existsSync(door)) {
    const out = spawnSync('bash', [door, 'resolve'], { encoding: 'utf8', timeout: 15_000 });
    const roles = (out.stdout || '').trim().split(/[\s,]+/).filter(Boolean);
    if (out.status === 0 && roles.length) return { host, roles, road: 'ymir' };
  }
  try {
    const fleet = JSON.parse(readFileSync(join(home, 'hodd/data/fleet.json'), 'utf8'));
    const roles: string[] = fleet?.hosts?.[host]?.roles ?? [];
    if (fleet?.heart === host && !roles.includes('heart')) roles.push('heart');
    if (roles.length) return { host, roles, road: 'fleet' };
  } catch { /* no registry: a fleet of one */ }
  return { host, roles: ['heart'], road: 'alone' };
}
