// main.tsx — the tower's own page. Small on purpose: Valaskjálf (in Gimlé) is the hall where the house is looked
// at; this page is what stays when Gimlé is down. It shows the hound's record and the doors this machine hosts.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Ward } from './Ward';
import { towerApi, type HouseRow } from './api';

function Doors() {
  const [house, setHouse] = useState<Awaited<ReturnType<typeof towerApi.house>> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const read = () => towerApi.house().then((h) => { setHouse(h); setError(''); }).catch((e) => setError(String(e)));
    read();
    const t = window.setInterval(read, 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (error) return <p className="muted">The tower's server did not answer: {error}</p>;
  if (!house) return <p className="muted">Reading the doors…</p>;
  if (house.state !== 'read') return <p className="muted">{house.detail}</p>;
  const down = (r: HouseRow) => r.expect === 'on' && r.live !== 'up';
  return (
    <>
      <table>
        <thead><tr><th>Door</th><th>Class</th><th>Port</th><th>Expected</th><th>Live</th><th>Public</th></tr></thead>
        <tbody>
          {house.rows.map((r) => (
            <tr key={r.name} className={down(r) ? 'down' : ''}>
              <td>{r.name}</td><td>{r.class}</td><td>{r.port}</td><td>{r.expect}</td><td>{r.live}</td><td>{r.edge}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {house.findings.length > 0 && <ul className="findings">{house.findings.map((f) => <li key={f}>{f}</li>)}</ul>}
      <p className="muted">Read {new Date(house.at).toLocaleTimeString()} · bin/house-status.sh</p>
    </>
  );
}

function Health() {
  const [w, setW] = useState<Awaited<ReturnType<typeof towerApi.watch>> | null>(null);
  useEffect(() => {
    const read = () => towerApi.watch().then(setW).catch(() => setW(null));
    read();
    const t = window.setInterval(read, 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (!w || !w.at) return <p className="muted">The watcher has not finished its first look yet.</p>;
  const g = (label: string, x: { pct: number } | null) => (
    <div className={`gauge${x && x.pct >= 90 ? ' down' : ''}`}><span>{label}</span><b>{x ? `${x.pct}%` : '—'}</b></div>
  );
  return (
    <>
      <div className="gauges">
        {g('disk', w.host?.disk ?? null)}{g('memory', w.host?.memory ?? null)}{g('swap', w.host?.swap ?? null)}
        {(w.host?.gpus ?? []).map((x) => <div key={x.name} className="gauge"><span>GPU</span><b>{x.memory.pct}%</b></div>)}
      </div>
      {w.faults.length === 0
        ? <p>Nothing this machine runs is down.</p>
        : <ul className="findings">{w.faults.map((f) => <li key={f.key}>{f.text}</li>)}</ul>}
      <p className="muted">
        {w.self ? `${w.self.roles.join(', ')} machine` : 'role unknown'} · measured {new Date(w.at).toLocaleTimeString()}
        {w.elsewhere ? ` · ${w.elsewhere} register rows are measured on their own machine` : ''} · the whole house is in Valaskjálf
      </p>
    </>
  );
}

function Tower() {
  return (
    <main>
      <header><h1>ᛉ Himinbjörg</h1><p className="muted">The watchtower. It reads; it never acts.</p></header>
      <section><h2>This machine</h2><Health /></section>
      <section><h2>The hound</h2><Ward page /></section>
      <section><h2>The doors this machine hosts</h2><Doors /></section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Tower />);
