// host.ts — the machine's own health: disk, memory, swap and the GPU (plan 212 found the heart at 80 % disk with
// its swap full). Read-only: statfs, /proc/meminfo and nvidia-smi's query.
import { readFileSync, statfsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export type Gauge = { used: number; total: number; pct: number };
export type Host = { disk: Gauge | null; memory: Gauge | null; swap: Gauge | null;
                     gpus: Array<{ name: string; memory: Gauge; util: number }>; at: string };

const gauge = (used: number, total: number): Gauge => ({ used, total, pct: total > 0 ? Math.round((used / total) * 100) : 0 });

export function parseMeminfo(text: string): { memory: Gauge | null; swap: Gauge | null } {
  const kb: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const m = /^(\w+):\s+(\d+)/.exec(line);
    if (m) kb[m[1]] = Number(m[2]) * 1024;
  }
  const memory = kb.MemTotal ? gauge(kb.MemTotal - (kb.MemAvailable ?? kb.MemFree ?? 0), kb.MemTotal) : null;
  const swap = kb.SwapTotal ? gauge(kb.SwapTotal - (kb.SwapFree ?? 0), kb.SwapTotal) : null;
  return { memory, swap };
}

export function parseGpus(csv: string): Host['gpus'] {
  return csv.split('\n').filter((l) => l.trim()).map((l) => {
    const [name, used, total, util] = l.split(',').map((s) => s.trim());
    return { name, memory: gauge(Number(used) * 1024 * 1024, Number(total) * 1024 * 1024), util: Number(util) || 0 };
  });
}

export function readHost(root = process.env.HIMINBJORG_DISK_PATH || '/'): Host {
  let disk: Gauge | null = null;
  try {
    const s = statfsSync(root);
    disk = gauge((s.blocks - s.bavail) * s.bsize, s.blocks * s.bsize);
  } catch { /* an unreadable disk is said, as null, never as an empty one */ }
  let mem = { memory: null as Gauge | null, swap: null as Gauge | null };
  try { mem = parseMeminfo(readFileSync('/proc/meminfo', 'utf8')); } catch { /* not Linux */ }
  const smi = spawnSync('nvidia-smi', ['--query-gpu=name,memory.used,memory.total,utilization.gpu', '--format=csv,noheader,nounits'],
    { encoding: 'utf8', timeout: 10_000 });
  return { disk, ...mem, gpus: smi.status === 0 ? parseGpus(smi.stdout) : [], at: new Date().toISOString() };
}

/** The host's own faults, worded once: what turns a card red and sends one alert. */
export function hostFaults(h: Host): Array<{ key: string; text: string }> {
  const out: Array<{ key: string; text: string }> = [];
  if (h.disk && h.disk.pct >= Number(process.env.HIMINBJORG_DISK_ALARM_PCT || 90)) out.push({ key: 'host.disk', text: `disk ${h.disk.pct}% full` });
  if (h.memory && h.memory.pct >= 95) out.push({ key: 'host.memory', text: `memory ${h.memory.pct}% used` });
  if (h.swap && h.swap.total > 0 && h.swap.pct >= 95) out.push({ key: 'host.swap', text: `swap ${h.swap.pct}% used` });
  return out;
}
