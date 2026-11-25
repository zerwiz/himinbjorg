// main.cjs — the tower's window: one Electron window over the tower's own loopback server.
//
// The window does not hold the server. start.sh raises the server (or the user unit himinbjorg.service does), and
// this window only opens it, so closing the window never stops the watching.
const { app, BrowserWindow, Menu } = require('electron');
const http = require('node:http');

// The window's WM class, named once: Ymir's bin/desktop/app-lib.sh routes every app by `ymir-<slug>`.
app.setName('ymir-himinbjorg');
const PORT = Number(process.env.HIMINBJORG_PORT || 3896);
const URL_ = `http://127.0.0.1:${PORT}/`;
// The DevTools door: a fixed loopback port per app (Ymir's app-lib table); YMIR_DEVTOOLS_PORT wins for a probe.
app.commandLine.appendSwitch('remote-debugging-port', String(process.env.YMIR_DEVTOOLS_PORT || 9417));
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
// A tiling compositor draws no frame; the platform layer says so through YMIR_WINDOW_BUTTONS (Ymir's host sense).
const WINDOW_BUTTONS = String(process.env.YMIR_WINDOW_BUTTONS ?? 'on').toLowerCase() !== 'off';

function answers() {
  return new Promise((resolve) => {
    const req = http.get(`${URL_}api/health`, { timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await answers()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1000, height: 760, title: 'Himinbjörg', backgroundColor: '#16181a', frame: WINDOW_BUTTONS,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (await waitForServer(15000)) {
    await win.loadURL(URL_);
  } else {
    // A failed boot is a sentence in the window, never a crash and never a fake calm.
    const msg = `The tower's server does not answer on 127.0.0.1:${PORT}. Start it with ./start.sh --server, `
      + 'or read: journalctl --user -u himinbjorg.service';
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      `<body style="background:#16181a;color:#e4e0d8;font:15px system-ui;padding:24px"><h2 style="color:#b0894f">Himinbjörg</h2><p>${msg}</p></body>`));
  }
});

app.on('window-all-closed', () => app.quit());
