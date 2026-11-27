/* Asma Island: Electron shell. Built on Electron 22 so it still runs on Windows 8, 8.1, 10 and 11. */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut, dialog, nativeImage, powerSaveBlocker, shell } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { execFile } = require('child_process');

const WIN_SETUP = 'https://github.com/dmaximboi/asmaulhusnal/releases/latest/download/Asma-Island-Setup.exe';

const W = 520, H = 340;
let island = null, appWin = null, tray = null, userHidden = false, quitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => openFullApp());
  app.on('window-all-closed', () => { /* keep running in the tray */ });
  app.on('before-quit', () => { quitting = true; });
  app.on('web-contents-created', (e, wc) => {
    if (!wc) return;
    wc.setWindowOpenHandler(function (details) {
      openExternal(details && details.url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', function (ev, url) {
      if (String(url).indexOf('file:') === 0) return;
      ev.preventDefault();
      openExternal(url);
    });
  });
  app.whenReady().then(start);
}

/* ---------- small config file ---------- */
const cfgPath = () => path.join(app.getPath('userData'), 'island-config.json');
function readCfg() { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch (e) { return {}; } }
function writeCfg(o) { try { fs.writeFileSync(cfgPath(), JSON.stringify(Object.assign(readCfg(), o))); } catch (e) { /* ignore */ } }

/* ---------- windows ---------- */
function iconPath() {
  return path.join(__dirname, 'build', 'icon.png');
}

function placeIsland() {
  if (!island) return;
  const b = screen.getPrimaryDisplay().bounds;
  let shift = +readCfg().shift || 0;
  if (Math.abs(shift) > 1) shift = shift / 100;
  shift = Math.max(-1, Math.min(1, shift));
  const max = Math.max(0, (b.width - W) / 2);
  const x = Math.round(b.x + (b.width - W) / 2 + shift * max);
  island.setBounds({ x: x, y: b.y, width: W, height: H });
}

function createIsland() {
  island = new BrowserWindow({
    width: W, height: H, x: 0, y: 0,
    frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, hasShadow: false, skipTaskbar: true, focusable: false, show: false,
    backgroundColor: '#00000000', title: 'Asma Island',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false,
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', spellcheck: false
    }
  });
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setIgnoreMouseEvents(true, { forward: true });
  placeIsland();
  island.loadFile(path.join(__dirname, 'app', 'island.html'));
  island.once('ready-to-show', () => { if (!userHidden) island.showInactive(); });
  island.on('closed', () => { island = null; });
  screen.on('display-metrics-changed', placeIsland);
  screen.on('display-added', placeIsland);
  screen.on('display-removed', placeIsland);
  /* keep it above other topmost windows */
  setInterval(() => { if (island && island.isVisible()) island.setAlwaysOnTop(true, 'screen-saver'); }, 30000);
}

function openFullApp() {
  if (appWin) { if (appWin.isMinimized()) appWin.restore(); appWin.show(); appWin.focus(); return; }
  appWin = new BrowserWindow({
    width: 440, height: 860, minWidth: 360, minHeight: 560, backgroundColor: '#141414', autoHideMenuBar: true, title: 'Asma Clock',
    icon: iconPath(),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, nativeWindowOpen: true, backgroundThrottling: false }
  });
  appWin.setMenuBarVisibility(false);
  wireExternal(appWin);
  appWin.loadFile(path.join(__dirname, 'app', 'app.html'));
  appWin.on('closed', () => { appWin = null; });
}

function toggleIsland() {
  if (!island) return;
  userHidden = !userHidden;
  if (userHidden) island.hide(); else island.showInactive();
  buildMenu();
}

/* ---------- tray ---------- */
function buildMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Asma Clock', click: openFullApp },
    { label: 'Download update', click: () => openExternal(WIN_SETUP) },
    { label: userHidden ? 'Show island' : 'Hide island', accelerator: 'Ctrl+Alt+I', click: toggleIsland },
    {
      label: 'Island place',
      submenu: [
        { label: 'Top left', click: () => setIslandCfg({ shift: -1 }) },
        { label: 'Top center', click: () => setIslandCfg({ shift: 0 }) },
        { label: 'Top right', click: () => setIslandCfg({ shift: 1 }) }
      ]
    },
    { type: 'separator' },
    {
      label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: 'Quit Asma Island', click: () => { quitting = true; app.quit(); } }
  ]));
}
function createTray() {
  const img = nativeImage.createFromPath(iconPath());
  tray = new Tray(img);
  tray.setToolTip('Asma Island');
  tray.on('double-click', openFullApp);
  buildMenu();
}

/* ---------- IPC ---------- */
ipcMain.handle('cursor', () => {
  const p = screen.getCursorScreenPoint();
  if (!island) return { x: -9999, y: -9999 };
  const b = island.getBounds();
  return { x: p.x - b.x, y: p.y - b.y };
});
function setIslandCfg(o) {
  writeCfg(o);
  placeIsland();
  if (island && !island.isDestroyed()) {
    try { island.webContents.send('islandCfg', readCfg()); } catch (e) { /* ignore */ }
  }
}
ipcMain.on('setIsland', (e, o) => {
  const next = {};
  if (o && o.theme) next.theme = String(o.theme);
  if (o && isFinite(o.shift)) next.shift = Math.max(-1, Math.min(1, +o.shift));
  setIslandCfg(next);
});
ipcMain.handle('getIslandCfg', () => readCfg());
ipcMain.on('ignore', (e, v) => { if (island) island.setIgnoreMouseEvents(!!v, { forward: true }); });
ipcMain.on('show', () => { if (island && !island.isVisible()) island.showInactive(); });
ipcMain.on('openApp', openFullApp);
ipcMain.on('openUrl', (e, url) => openExternal(url));

function openExternal(url) {
  let href = '';
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:') return;
    href = u.toString();
  } catch (err) {
    return;
  }
  const go = shell.openExternal(href);
  if (go && typeof go.then === 'function') {
    go.catch(function () { startBrowser(href); });
  }
}

function startBrowser(href) {
  try {
    execFile('cmd.exe', ['/c', 'start', '', href], { windowsHide: true });
  } catch (err) { /* ignore */ }
}

function wireExternal(win) {
  if (!win || !win.webContents) return;
  win.webContents.setWindowOpenHandler(function (details) {
    openExternal(details.url);
    return { action: 'deny' };
  });
}
let awakeId = 0;
ipcMain.on('holdAwake', (e, on) => {
  if (on) {
    if (!awakeId || !powerSaveBlocker.isStarted(awakeId)) {
      awakeId = powerSaveBlocker.start('prevent-app-suspension');
    }
  } else if (awakeId && powerSaveBlocker.isStarted(awakeId)) {
    powerSaveBlocker.stop(awakeId);
    awakeId = 0;
  }
});

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000, headers: { 'User-Agent': 'AsmaIsland/1.0' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('http ' + res.statusCode)); }
      let d = ''; res.setEncoding('utf8'); res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
/* approximate location from the network address (city level), since Electron has no OS location service */
ipcMain.handle('ipLocation', async () => {
  try { const j = await getJSON('https://ipwho.is/'); if (j && j.success !== false && isFinite(j.latitude) && isFinite(j.longitude)) return { lat: +j.latitude, lng: +j.longitude, city: j.city || '' }; } catch (e) { /* try next */ }
  try { const j = await getJSON('https://ipapi.co/json/'); if (j && isFinite(j.latitude) && isFinite(j.longitude)) return { lat: +j.latitude, lng: +j.longitude, city: j.city || '' }; } catch (e) { /* give up */ }
  return null;
});

/* ---------- start ---------- */
async function start() {
  createIsland();
  createTray();
  globalShortcut.register('CommandOrControl+Alt+I', toggleIsland);

  if (process.env.ASMA_SELFTEST) {
    const wc = island.webContents;
    wc.on('console-message', (e, level, msg) => console.log('[island console]', level, msg));
    wc.on('did-fail-load', (e, code, desc) => console.log('[island] LOAD FAIL', code, desc));
    setTimeout(async () => {
      try {
        console.log('[selftest] bridge:', await wc.executeJavaScript('typeof window.asmaDesktop + "/" + typeof window.__island + "/" + document.getElementById("ct").textContent'));
        console.log('[selftest] cursor:', JSON.stringify(await wc.executeJavaScript('window.asmaDesktop.cursor()')));
        console.log('[selftest] ip:', JSON.stringify(await wc.executeJavaScript('window.asmaDesktop.ipLocation()')));
        await wc.executeJavaScript('window.__island.expand(0)');
        await new Promise(r => setTimeout(r, 900));
        fs.writeFileSync(process.env.ASMA_SELFTEST, (await wc.capturePage()).toPNG());
        console.log('[selftest] bounds:', JSON.stringify(island.getBounds()), 'onTop:', island.isAlwaysOnTop(), 'visible:', island.isVisible());
        openFullApp();
        await new Promise(r => setTimeout(r, 2500));
        console.log('[selftest] fullapp title:', appWin && appWin.getTitle());
        fs.writeFileSync(process.env.ASMA_SELFTEST + '.app.png', (await appWin.webContents.capturePage()).toPNG());
      } catch (err) { console.log('[selftest] ERROR', err.message); }
      quitting = true; app.quit();
    }, 3500);
    return;
  }

  const cfg = readCfg();
  if (!cfg.askedAutostart) {
    writeCfg({ askedAutostart: true });
    const r = await dialog.showMessageBox({
      type: 'question', buttons: ['Yes', 'No'], defaultId: 0, cancelId: 1, title: 'Asma Island',
      message: 'Start Asma Island automatically when Windows starts?',
      detail: 'You can change this any time from the tray icon.'
    });
    app.setLoginItemSettings({ openAtLogin: r.response === 0 });
    buildMenu();
  }
}
app.on('will-quit', () => globalShortcut.unregisterAll());
