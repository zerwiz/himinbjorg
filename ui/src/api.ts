// api.ts — the tower's page reads only its own server, on the same loopback origin.
async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

type G = { used: number; total: number; pct: number };

export type HouseRow = { name: string; class: string; port: string; expect: string; live: string; road: string; edge: string };

export const towerApi = {
  ward: () => get<{
    paused: boolean; heartbeat: string; heartbeatAgeSeconds: number; silent: boolean;
    findings: number; judged: number; bySeverity: Record<string, number>;
    newest: Array<{ ts: string; severity: string; line: string; title: string; comm: string; pid: string; reasoning?: { rung: string; model: string } | null }>;
    door: string;
  }>('/api/ward'),
  watch: () => get<{
    at: string; self: { host: string; roles: string[] } | null; elsewhere: number;
    host: { disk: G | null; memory: G | null; swap: G | null; gpus: Array<{ name: string; memory: G; util: number }> } | null;
    faults: Array<{ key: string; text: string }>; servicesWhy: string; tunnelsWhy: string;
  }>('/api/watch'),
  house: () => get<{ state: 'read' | 'no-register' | 'failed'; rows: HouseRow[]; findings: string[]; at: string; detail?: string }>('/api/house'),
};
