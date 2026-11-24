// main.ts — the tower's server: loopback only, read only.
//
//   bun server/main.ts            serve on 127.0.0.1:${HIMINBJORG_PORT:-3896}
//
//   GET /api/health   {ok, port, home}
//   GET /api/ward     the hound's record (server/ward.ts) — the same answer Hlidskjalf's /api/ward used to give
//   GET /api/house    the door prober's rows (server/house.ts)
//   GET /             the tower's own small page (ui/dist), for when the bigger halls are down
//
// It binds 127.0.0.1 and refuses any other address unless HIMINBJORG_ALLOW_WIDE_BIND=1 is set on purpose: the
// halls are local, and no tunnel may point at a hall (RULES/02).
import { join, normalize } from 'node:path';
import { existsSync } from 'node:fs';
import { resolveHome, APP_ROOT } from './home';
import { wardState } from './ward';
import { houseState } from './house';

const HOST = process.env.HIMINBJORG_HOST || '127.0.0.1';
const PORT = Number(process.env.HIMINBJORG_PORT || 3896);
if (!['127.0.0.1', '::1', 'localhost'].includes(HOST) && process.env.HIMINBJORG_ALLOW_WIDE_BIND !== '1') {
  console.error(`himinbjorg: refusing to bind ${HOST} — the tower listens on loopback only (HIMINBJORG_ALLOW_WIDE_BIND=1 overrides)`);
  process.exit(2);
}

const HOME = resolveHome();
const DIST = join(APP_ROOT, 'ui', 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function serveStatic(path: string): Response {
  const rel = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, rel);
  if (!file.startsWith(DIST) || !existsSync(file)) return new Response('not found', { status: 404 });
  const ext = file.slice(file.lastIndexOf('.'));
  return new Response(Bun.file(file), { headers: { 'content-type': TYPES[ext] || 'application/octet-stream' } });
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (req.method !== 'GET') return json({ error: 'the tower only reads' }, 405);
    try {
      if (url.pathname === '/api/health') return json({ ok: true, port: PORT, home: HOME ? 'found' : 'missing' });
      if (url.pathname === '/api/ward') return json(wardState({ home: HOME }));
      if (url.pathname === '/api/house') return json(houseState(HOME));
      return serveStatic(url.pathname);
    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  },
});

console.log(`[himinbjorg] the tower    http://${HOST}:${server.port}`);
console.log(`[himinbjorg] home         ${HOME ? 'found' : 'MISSING — set YMIR_HOME'}`);
