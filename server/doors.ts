// doors.ts — what the tower publishes for Valaskjálf, in the hall's own JSON door shape:
//   {"number": 3, "unit": "…", "rows": [{"text": "…", "meta": "…", "tone": "red", "act": {"type": "door", "id": "…"}}]}
// (Gimlé's apps/valaskjalf/doors.py `json_door`). The hall redacts every row again on the way in, so an address
// that reaches it is never drawn; the tower's own page is where a public address is shown.
//
// A reading the tower could not take is never a zero: the door answers 503 with the reason, which the hall draws
// as DOWN with that reason.
import type { Reading } from './watcher';
import type { Gauge } from './host';

type Row = { text: string; meta: string; tone: '' | 'bronze' | 'amber' | 'red'; act?: Record<string, unknown> };
export type Door = { number: number; unit: string; rows: Row[]; counts?: Record<string, number> };
export class NotRead extends Error {}

const gib = (b: number | null) => (b === null ? '' : b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GiB` : `${Math.round(b / (1 << 20))} MiB`);
const gauge = (g: Gauge | null) => (g ? `${g.pct}% · ${gib(g.used)} of ${gib(g.total)}` : 'unread');

export function servicesDoor(r: Reading): Door {
  if (!r.services) throw new NotRead(r.servicesWhy || 'not measured yet');
  const order: Record<string, number> = { failed: 0, down: 1, restarting: 2, unmeasured: 3, up: 4, off: 5 };
  const rows: Row[] = [...r.services].sort((a, b) => order[a.state] - order[b.state] || a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    .map((s) => ({
      text: `${s.name} — ${s.state}`,
      meta: [s.group, s.since && `since ${s.since}`, s.memory !== null && gib(s.memory), s.lastError].filter(Boolean).join(' · '),
      tone: s.state === 'failed' || s.state === 'down' ? 'red' : s.state === 'restarting' ? 'amber' : s.state === 'unmeasured' ? 'amber' : '',
      act: { type: 'door', id: s.name },
    }));
  const counts: Record<string, number> = {};
  for (const s of r.services) counts[s.state] = (counts[s.state] ?? 0) + 1;
  const bad = (counts.down ?? 0) + (counts.failed ?? 0) + (counts.restarting ?? 0);
  const away = r.elsewhere ? ` · ${r.elsewhere} more measured on their own machine` : '';
  return { number: bad, unit: `of ${r.services.length} services not running${away}`, rows, counts };
}

export function tunnelsDoor(r: Reading): Door {
  if (!r.tunnels) throw new NotRead(r.tunnelsWhy || 'not measured yet');
  const rows: Row[] = r.tunnels.map((t) => {
    const dark = t.behind.filter((b) => b.answers === false).map((b) => b.hostname);
    return {
      text: `tunnel ${t.name} — ${t.verdict}`,
      meta: [`${t.connections} connection${t.connections === 1 ? '' : 's'}`, `${t.hostnames.length} hostname${t.hostnames.length === 1 ? '' : 's'}`,
             dark.length ? `nothing behind ${dark.length}` : '', t.configured ? '' : 'no config on this machine'].filter(Boolean).join(' · '),
      // This machine's tunnels are judged; another machine's are shown, quiet when connected, amber when dead.
      tone: t.configured ? (t.verdict === 'live' ? '' : 'red') : (t.connected ? '' : 'amber'),
      act: { type: 'door', id: `tunnel:${t.name}` },
    };
  });
  const mine = r.tunnels.filter((t) => t.configured);
  const bad = mine.filter((t) => t.verdict !== 'live').length;
  const dead = r.tunnels.filter((t) => !t.configured && !t.connected).length;
  rows.sort((a, b) => ({ red: 0, amber: 1, bronze: 2, '': 3 }[a.tone] - { red: 0, amber: 1, bronze: 2, '': 3 }[b.tone]));
  return { number: bad, unit: `of ${mine.length} tunnels on this machine dead or empty · ${dead} with no connection anywhere`, rows };
}

export function hostDoor(r: Reading): Door {
  if (!r.host) throw new NotRead('not measured yet');
  const h = r.host;
  const tone = (g: Gauge | null, at: number): Row['tone'] => (g && g.pct >= at ? 'red' : g && g.pct >= at - 10 ? 'amber' : '');
  const rows: Row[] = [
    { text: `disk ${h.disk ? `${h.disk.pct}%` : 'unread'}`, meta: gauge(h.disk), tone: tone(h.disk, 90) },
    { text: `memory ${h.memory ? `${h.memory.pct}%` : 'unread'}`, meta: gauge(h.memory), tone: tone(h.memory, 95) },
    { text: `swap ${h.swap ? `${h.swap.pct}%` : 'none'}`, meta: gauge(h.swap), tone: tone(h.swap, 95) },
    ...h.gpus.map((g) => ({ text: `GPU ${g.memory.pct}% memory · ${g.util}% busy`, meta: `${g.name} · ${gauge(g.memory)}`, tone: '' as const })),
  ];
  return { number: rows.filter((x) => x.tone === 'red').length, unit: 'host gauges in alarm', rows };
}
