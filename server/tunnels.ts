// tunnels.ts — the public doors: every Cloudflare tunnel, its hostnames, whether it is connected, and whether
// anything answers behind it.
//
// Two reads, both read-only: `cloudflared tunnel list --output json` (which tunnels exist and how many connections
// each holds) and the local `config-*.yml` files (which hostnames each tunnel carries, and the local port behind
// each). The tower flags a dead tunnel and a door with nothing behind it. It never deletes a tunnel or a DNS record:
// that is the operator's decision.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export type TunnelConfig = { file: string; tunnel: string; ingress: Array<{ hostname: string; port: number | null }> };
export type Listed = { id: string; name: string; connections: number };
export type Tunnel = { name: string; connected: boolean; connections: number; hostnames: string[];
                       behind: Array<{ hostname: string; port: number | null; answers: boolean | null }>;
                       configured: boolean; verdict: 'live' | 'dead' | 'nothing behind' | 'no config' };

export function parseTunnelConfig(text: string, file = ''): TunnelConfig {
  const tunnel = /^tunnel:\s*["']?([^"'\s#]+)/m.exec(text)?.[1] ?? '';
  const ingress: TunnelConfig['ingress'] = [];
  let host = '';
  for (const line of text.split('\n')) {
    const h = /^\s*-?\s*hostname:\s*["']?([^"'\s#]+)/.exec(line);
    if (h) { host = h[1]; continue; }
    const s = /^\s*-?\s*service:\s*["']?([^"'\s#]+)/.exec(line);
    if (s && host) {
      const port = /:(\d+)\/?$/.exec(s[1])?.[1];
      ingress.push({ hostname: host, port: port ? Number(port) : null });
      host = '';
    }
  }
  return { file, tunnel, ingress };
}

export function readConfigs(dir = process.env.HIMINBJORG_CLOUDFLARED_DIR || join(process.env.HOME || '', '.cloudflared')): TunnelConfig[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^config.*\.ya?ml$/.test(f))
    .map((f) => parseTunnelConfig(readFileSync(join(dir, f), 'utf8'), f));
}

export function listTunnels(): { listed: Listed[] | null; why: string } {
  const out = spawnSync('cloudflared', ['tunnel', 'list', '--output', 'json'], { encoding: 'utf8', timeout: 30_000 });
  if (out.error) return { listed: null, why: 'cloudflared is not installed here' };
  if (out.status !== 0) return { listed: null, why: (out.stderr || 'cloudflared tunnel list failed').trim().split('\n').pop()!.slice(0, 160) };
  try {
    const rows = JSON.parse(out.stdout || '[]') as Array<{ id: string; name: string; connections?: unknown[] }>;
    return { listed: rows.map((r) => ({ id: r.id, name: r.name, connections: (r.connections ?? []).length })), why: '' };
  } catch {
    return { listed: null, why: 'cloudflared answered, but not with JSON' };
  }
}

/** Join what Cloudflare lists with what this machine's configs carry, and what answers behind each door. */
export function judgeTunnels(listed: Listed[], configs: TunnelConfig[], ports: Set<number>): Tunnel[] {
  const byKey = new Map<string, TunnelConfig>();
  for (const c of configs) if (c.tunnel) byKey.set(c.tunnel, c);
  return listed.map((t) => {
    const cfg = byKey.get(t.name) ?? byKey.get(t.id);
    const behind = (cfg?.ingress ?? []).map((i) => ({ ...i, answers: i.port === null ? null : ports.has(i.port) }));
    const connected = t.connections > 0;
    const verdict: Tunnel['verdict'] = !connected ? 'dead'
      : !cfg ? 'no config'
      : behind.some((b) => b.answers === false) ? 'nothing behind' : 'live';
    return { name: t.name, connected, connections: t.connections, hostnames: behind.map((b) => b.hostname),
             behind, configured: Boolean(cfg), verdict };
  }).sort((a, b) => Number(a.verdict === 'live') - Number(b.verdict === 'live') || a.name.localeCompare(b.name));
}
