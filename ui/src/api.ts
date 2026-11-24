// api.ts — the tower's page reads only its own server, on the same loopback origin.
async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export type HouseRow = { name: string; class: string; port: string; expect: string; live: string; road: string; edge: string };

export const towerApi = {
  ward: () => get<{
    paused: boolean; heartbeat: string; heartbeatAgeSeconds: number; silent: boolean;
    findings: number; judged: number; bySeverity: Record<string, number>;
    newest: Array<{ ts: string; severity: string; line: string; title: string; comm: string; pid: string; reasoning?: { rung: string; model: string } | null }>;
    door: string;
  }>('/api/ward'),
  house: () => get<{ state: 'read' | 'no-register' | 'failed'; rows: HouseRow[]; findings: string[]; at: string; detail?: string }>('/api/house'),
};
