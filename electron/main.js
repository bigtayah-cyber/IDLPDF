/* Ateliers : launcher + les 4 apps de la suite, chacune dans sa fenêtre. Tout est servi en local (app://suite/). */
const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, Menu, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
const WWW = path.join(__dirname, "..", "www");
const MAC = process.platform === "darwin";
const APPS = {
  pdf: { title: "IdontlovePDF Pro", w: 1320, h: 880, bg: "#f2f1ec" },
  mill: { title: "Moulinette", w: 1200, h: 840, bg: "#f2f1ec" },
  lyric: { title: "LyricDrop", w: 1380, h: 880, bg: "#0b0b0d" },
  pixel: { title: "Pixel Crypte Pro", w: 1380, h: 900, bg: "#1b1424" },
};
const wins = {};
let launcher = null;

const webPreferences = () => ({ preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false });
function guard(win){
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("app://suite/")) { const k = Object.keys(APPS).find(k => url.includes(`/${k}/`)); if (k) openApp(k); return { action: "deny" }; }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("app://suite/")) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}
function openLauncher(){
  if (launcher && !launcher.isDestroyed()) { launcher.show(); launcher.focus(); return launcher; }
  launcher = new BrowserWindow({ width: 1180, height: 760, minWidth: 720, minHeight: 520, title: "Ateliers", backgroundColor: "#0b0b0d", show: false,
    ...(MAC ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 14 } } : { autoHideMenuBar: true }), webPreferences: webPreferences() });
  guard(launcher);
  launcher.once("ready-to-show", () => launcher.show());
  launcher.loadURL("app://suite/index.html");
  launcher.on("closed", () => { launcher = null; });
  return launcher;
}
function openApp(k, file){
  const a = APPS[k]; if (!a) return false;
  let w = wins[k];
  if (!w || w.isDestroyed()) {
    w = wins[k] = new BrowserWindow({ width: a.w, height: a.h, minWidth: 380, minHeight: 560, title: a.title, backgroundColor: a.bg, show: false, autoHideMenuBar: !MAC, webPreferences: webPreferences() });
    guard(w);
    w.once("ready-to-show", () => w.show());
    w.loadURL(`app://suite/${k}/index.html`);
    w.on("closed", () => { delete wins[k]; });
  } else { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
  if (file) sendFile(w, file);
  return true;
}
/* Ouvre un fichier dans une app : on le relit sur le disque et on le « dépose » dans la page */
async function sendFile(w, file){
  try {
    const bytes = typeof file === "string" ? await fs.promises.readFile(file) : Buffer.from(file.bytes);
    const payload = { name: typeof file === "string" ? path.basename(file) : file.name, type: file.type || "", bytes };
    const go = () => setTimeout(() => !w.isDestroyed() && w.webContents.send("suite-open-file", payload), 1500);
    if (w.webContents.isLoading()) w.webContents.once("did-finish-load", go); else go();
  } catch (e) { dialog.showErrorBox("Ateliers", "Ce fichier n'a pas pu être ouvert."); }
}

function menu(){
  const appItems = Object.entries(APPS).map(([k, a], i) => ({ label: a.title, accelerator: `CmdOrCtrl+${i + 1}`, click: () => openApp(k) }));
  const tpl = [
    ...(MAC ? [{ role: "appMenu" }] : []),
    { label: "Fichier", submenu: [{ label: "Ateliers (launcher)", accelerator: "CmdOrCtrl+0", click: openLauncher }, { type: "separator" }, ...appItems, { type: "separator" }, MAC ? { role: "close", label: "Fermer la fenêtre" } : { role: "quit", label: "Quitter" }] },
    { role: "editMenu", label: "Édition" },
    { label: "Affichage", submenu: [{ role: "reload", label: "Recharger" }, { role: "togglefullscreen", label: "Plein écran" }, { type: "separator" }, { role: "resetZoom", label: "Taille réelle" }, { role: "zoomIn", label: "Zoom avant" }, { role: "zoomOut", label: "Zoom arrière" }, { type: "separator" }, { role: "toggleDevTools", label: "Outils de développement" }] },
    { role: "windowMenu", label: "Fenêtre" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => openLauncher());
  app.on("open-file", (e, p) => { e.preventDefault(); const ext = path.extname(p).toLowerCase(); app.whenReady().then(() => openApp(ext === ".pdf" ? "pdf" : /\.(lyricdrop|lyricstyle|lrc|srt)$/.test(ext) ? "lyric" : /\.(pixelcrypte|gpl)$/.test(ext) ? "pixel" : "mill", p)); });
  app.whenReady().then(() => {
    protocol.handle("app", req => {
      const u = new URL(req.url), p = decodeURIComponent(u.pathname), file = path.normalize(path.join(WWW, p));
      if (!file.startsWith(WWW)) return new Response("Interdit", { status: 403 });
      return net.fetch(pathToFileURL(fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, "index.html") : file).toString());
    });
    const allow = new Set(["media", "clipboard-sanitized-write", "fullscreen", "pointerLock"]);
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(allow.has(perm)));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => allow.has(perm));
    ipcMain.handle("save-file", async (e, name, bytes) => {
      const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: path.join(app.getPath("downloads"), name) });
      if (r.canceled || !r.filePath) return false;
      await fs.promises.writeFile(r.filePath, Buffer.from(bytes)); return true;
    });
    ipcMain.handle("open-app", (_e, k, file) => openApp(k, file));
    ipcMain.handle("app-version", () => app.getVersion());
    menu(); openLauncher();
    app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) openLauncher(); });
  });
  app.on("window-all-closed", () => { if (!MAC) app.quit(); });
}
