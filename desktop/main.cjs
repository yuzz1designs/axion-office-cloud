const { app, BrowserWindow, dialog, Menu, shell, utilityProcess, session, systemPreferences } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { trustedOrigin, port, isInternal, isExternal } = require('./security.cjs');
let window, children = [], pairingCode = '', quitting = false;
let microphonePermissionRequest = null;
let microphonePermissionAnswered = false;
app.setName('AXION OFFICE');
app.setAsDefaultProtocolClient('axion-office');
function focusFromProtocol(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'axion-office:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return;
    if (window) { window.show(); window.focus(); }
  } catch {}
}
app.on('open-url', (event, url) => { event.preventDefault(); focusFromProtocol(url); });
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => { argv.find(value => value.startsWith('axion-office://')) && focusFromProtocol(argv.find(value => value.startsWith('axion-office://'))); window?.show(); window?.focus(); });
  app.whenReady().then(start).catch(error => { if (process.env.AXION_DESKTOP_SMOKE === '1') { console.error(error.message); app.exit(1); } else { dialog.showErrorBox('AXION OFFICE', error.message); app.quit(); } });
}
async function available() {
  try { return (await fetch(`${trustedOrigin}/api/aiva/status`, { signal: AbortSignal.timeout(800) })).ok; } catch { return false; }
}
function run(file, env, cwd) {
  const child = utilityProcess.fork(file, [], { env, cwd, stdio: 'pipe', serviceName: 'AXION Runtime' });
  children.push(child);
  child.on('exit', code => { if (!quitting && code !== 0) { if (process.env.AXION_DESKTOP_SMOKE === '1') { console.error('Runtime failed: ' + path.basename(file)); app.quit(); } else dialog.showErrorBox('Runtime interrompido', 'Um processo local terminou. Fecha e volta a abrir o AXION OFFICE.'); } });
  // Do not persist runtime output: it can contain OAuth diagnostics or pairing credentials.
  return child;
}
async function start() {
  if (process.env.AXION_DESKTOP_SMOKE === '1') console.log('Smoke: application ready');
  const root = path.resolve(__dirname, '..');
  const dataDirectory = app.getPath('userData');
  fs.mkdirSync(dataDirectory, { recursive: true });
  const existing = await available();
  if (process.env.AXION_DESKTOP_SMOKE === '1') console.log('Smoke: backend present=' + existing);
  if (!existing) {
    const storedConfig = path.join(dataDirectory, '.env');
    let config = app.isPackaged ? storedConfig : path.join(root, '.env');
    if (!fs.existsSync(config)) {
      const picked = await dialog.showOpenDialog({ title: 'Seleciona a configuração local AXION (.env) — não será incluída na aplicação', properties: ['openFile', 'showHiddenFiles'] });
      if (picked.canceled || !picked.filePaths[0]) return app.quit();
      config = picked.filePaths[0];
      if (app.isPackaged) {
        fs.copyFileSync(config, storedConfig);
        fs.chmodSync(storedConfig, 0o600);
        config = storedConfig;
      }
    }
    const env = { ...process.env, DOTENV_CONFIG_PATH: config, AXION_APP_ROOT: root, AXION_SERVER_HOST: '127.0.0.1', PORT: String(port), AXION_COMPANION_PORT: '4320', AXION_NATIVE_BINARY: path.join(app.isPackaged ? process.resourcesPath : root, app.isPackaged ? 'AXIONControl.app/Contents/MacOS/AXIONControl' : 'companion/bin/AXIONControl.app/Contents/MacOS/AXIONControl') };
    const companion = run(path.join(root, 'desktop-build/companion.mjs'), env, dataDirectory);
    if (process.env.AXION_DESKTOP_SMOKE === '1') console.log('Smoke: companion launched');
    let output = '';
    const codeReady = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('O companion interno não apresentou credenciais de ligação.')), 8000);
      companion.stdout.on('data', chunk => {
        output = (output + chunk.toString()).slice(-4000);
        pairingCode = output.match(/uso único\): ([a-f0-9]{32})/)?.[1] || pairingCode;
        if (pairingCode) { clearTimeout(timeout); resolve(pairingCode); }
      });
    });
    env.AXION_COMPANION_AUTO_PAIR_CODE = await codeReady;
    run(path.join(root, 'desktop-build/server.mjs'), env, app.isPackaged ? dataDirectory : root);
    let ready = false;
    for (let count = 0; count < 60; count++) { if (await available()) { ready = true; break; } await new Promise(resolve => setTimeout(resolve, 250)); }
    if (!ready) throw new Error('O backend local não iniciou. Verifica se a porta 3000 está ocupada e se a configuração é válida.');
  }
  const ownSession = session.fromPartition('persist:axion-office');
  ownSession.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (permission !== 'media' || !contents || !isInternal(contents.getURL())) return false;
    const requestOrigin = details.securityOrigin || details.requestingUrl || origin;
    return isInternal(requestOrigin) && details.mediaType !== 'video';
  });
  ownSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    const requestOrigin = details.securityOrigin || details.requestingUrl || contents.getURL();
    if (permission !== 'media' || !isInternal(contents.getURL()) || !isInternal(requestOrigin) || details.mediaTypes?.includes('video')) return callback(false);
    if (process.platform !== 'darwin') return callback(true);
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') { microphonePermissionAnswered = true; return callback(true); }
    if (status !== 'not-determined') return callback(false);
    if (microphonePermissionAnswered) return callback(false);
    microphonePermissionRequest ||= systemPreferences.askForMediaAccess('microphone').finally(() => { microphonePermissionAnswered = true; });
    callback(await microphonePermissionRequest);
  });
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 960, minHeight: 680, title: 'AXION OFFICE', backgroundColor: '#080a10', show: false, webPreferences: { partition: 'persist:axion-office', nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  const external = async url => { if (!isExternal(url)) return; const answer = await dialog.showMessageBox(window, { message: 'Abrir ligação no browser?', detail: new URL(url).origin, buttons: ['Cancelar', 'Abrir'], defaultId: 0, cancelId: 0 }); if (answer.response === 1) await shell.openExternal(url); };
  window.webContents.setWindowOpenHandler(({ url }) => { void external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (!isInternal(url)) { event.preventDefault(); void external(url); } });
  window.webContents.on('will-redirect', (event, url) => { if (!isInternal(url)) { event.preventDefault(); void external(url); } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'AXION OFFICE', submenu: [{ role: 'about' }, { label: 'Código de associação do Mac', click: () => dialog.showMessageBox(window, { message: pairingCode || 'Companion externo', detail: pairingCode ? 'Introduz este código em AIVA → macOS. Expira dez minutos após o arranque.' : 'O dashboard já estava ligado. Usa o código do Companion existente nesta sessão.' }) }, { type: 'separator' }, { role: 'quit' }] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }
  ]));
  await window.loadURL(`${trustedOrigin}/?axion-desktop=1`);
  window.show();
  console.log('AXION Desktop: interface carregada; renderer isolado; runtime ' + (existing ? 'externo' : 'gerido pela aplicação'));
  if (!app.isPackaged && process.env.AXION_DESKTOP_SMOKE === '1') {
    const preferences = window.webContents.getLastWebPreferences();
    if (!isInternal(window.webContents.getURL()) || !preferences.sandbox || !preferences.contextIsolation || preferences.nodeIntegration) throw new Error('Desktop isolation check failed');
    console.log('PASS desktop smoke: loadURL, sandbox, contextIsolation, no Node integration');
    app.quit();
  }
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; for (const child of children) child.kill(); children = []; });
