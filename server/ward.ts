// ward.ts — HIMINBJÖRG, the watchtower: what the hound wrote, read and never acted on.
//
// Moved from Ymir's apps/hlidskjalf/server/index.ts (the function under the `/api/ward` banner, Ymir commit
// 7c27f324f; Ymir's plan 370). The logic is the same. What changed is only where its inputs come from: the home and
// the hound's log folder are parameters, so a test can point the tower at a fixture.
//
// Garmr notices, Vörðr judges, Gná speaks. The tower shows what the hound wrote: the heartbeat (a silent hound is a
// finding), the newest judgements, the pause marker, and the assistant's heartbeat. It reads files only; it never
// starts, stops or closes anything.
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { Database } from 'bun:sqlite';

export type WardInputs = {
  home: string;            // the operator's home ($YMIR_HOME)
  garmrLog?: string;       // the hound's own log folder (Ymir writes /var/log/ymir/garmr)
  now?: number;            // ms since the epoch, for tests
};

const read = (p: string) => readFileSync(p, 'utf8');

export function wardState({ home, garmrLog = process.env.HIMINBJORG_GARMR_LOG || '/var/log/ymir/garmr', now = Date.now() }: WardInputs) {
  const judged = join(home, 'state/garmr/judged.jsonl');
  const pausedMarker = join(home, 'state/garmr/PAUSED');
  const heartbeatFile = join(garmrLog, 'state/hound.heartbeat');
  const findingsFile = join(garmrLog, 'findings.jsonl');

  const counts: Record<string, number> = { INFO: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const newest: Array<Record<string, unknown>> = [];
  let totalJudged = 0;
  if (home && existsSync(judged)) {
    const lines = read(judged).split('\n').filter((l) => l.trim().startsWith('{'));
    totalJudged = lines.length;
    for (const line of lines.slice(-2000)) {
      try {
        const row = JSON.parse(line);
        const sev = String(row.severity ?? 'INFO');
        counts[sev] = (counts[sev] ?? 0) + 1;
        if (sev === 'HIGH' || sev === 'CRITICAL') {
          newest.push({
            ts: row.ts ?? '', severity: sev, line: row.line ?? '', title: row.title ?? '',
            comm: row.comm ?? '', pid: row.pid ?? '',
            reasoning: row.reasoning ? { rung: row.reasoning.rung, model: row.reasoning.model } : null,
          });
        }
      } catch { /* a torn line is not a reason to fail the panel */ }
    }
  }

  const beat = existsSync(heartbeatFile) ? read(heartbeatFile).trim() : '';
  const beatAgeSeconds = beat ? Math.max(0, Math.round((now - Date.parse(beat)) / 1000)) : -1;
  const findingsLines = existsSync(findingsFile)
    ? read(findingsFile).split('\n').filter((l) => l.trim()).length : 0;

  // Skírnir: a bot that stopped answering must be visible, not discovered
  const assistantDir = join(home, 'state/assistant');
  const beatFile = join(assistantDir, 'telegram.heartbeat');
  const assistantBeat = home && existsSync(beatFile) ? read(beatFile).trim() : '';
  const beatAge = assistantBeat ? Math.max(0, Math.round((now - Date.parse(assistantBeat)) / 1000)) : -1;
  let lastAnswer = '';
  let refusalsToday = 0;
  let turnsToday = 0;
  const assistantDb = join(assistantDir, 'assistant.db');
  if (home && existsSync(assistantDb)) {
    try {
      const db = new Database(assistantDb, { readonly: true });
      const today = new Date(now).toISOString().slice(0, 10);
      const last = db.query('select ts from turns order by rowid desc limit 1').get() as { ts?: string } | null;
      lastAnswer = last?.ts ?? '';
      const refused = db.query('select count(*) as n from conversations where ts like ? and refused = 1').get(`${today}%`) as { n: number };
      const all = db.query('select count(*) as n from conversations where ts like ?').get(`${today}%`) as { n: number };
      refusalsToday = refused?.n ?? 0;
      turnsToday = all?.n ?? 0;
      db.close();
    } catch { /* the assistant is new: report zero rather than fail the panel */ }
  }
  const assistant = { heartbeat: assistantBeat, heartbeatAgeSeconds: beatAge,
                      live: beatAge >= 0 && beatAge < 300,
                      lastAnswer, refusalsToday, turnsToday };

  return {
    home: home ? 'found' : 'missing',
    paused: home ? existsSync(pausedMarker) : false,
    heartbeat: beat,
    heartbeatAgeSeconds: beatAgeSeconds,
    silent: beatAgeSeconds === -1 || beatAgeSeconds > 600,
    findings: findingsLines,
    // `judged` is the whole record; bySeverity is the recent window the panel shows.
    // Reporting the window as the total made the tower say "2,000 judged" over a
    // 20,000-line ledger — a small lie in a security surface is still a lie.
    judged: totalJudged,
    bySeverity: counts,
    newest: newest.slice(-25).reverse(),
    assistant,
    door: 'bin/ward/garmr.sh',
  };
}
