// MockView desktop app (Electron). Starts the local API and web servers, then shows MockView in its own window.
// No browser, no address bar: this window, its taskbar icon and its desktop shortcut are MockView's own.
const { app, BrowserWindow, Menu, dialog, shell, session } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const API_PORT = 8000, WEB_PORT = 3000;
const ORIGIN = `http://localhost:${WEB_PORT}`;
const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "desktop", "dist");
const SERVER = process.env.MOCKVIEW_SERVER || path.join(RES, "server", process.platform === "win32" ? "MockView-server.exe" : "MockView-server");
const WEB = process.env.MOCKVIEW_WEB || path.join(RES, "web");
const ICON = path.join(__dirname, "build", "icon.png");

let win = null, splash = null, quitting = false;
const children = [];

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => resolve(false));
    s.setTimeout(500, () => { s.destroy(); resolve(false); });
  });
}
async function waitForPort(port, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function logStream(name) {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return fs.openSync(path.join(dir, name), "a");
}

function startServices() {
  const dataDir = app.getPath("userData");
  const api = spawn(SERVER, [], {
    env: { ...process.env, MOCKVIEW_DATA_DIR: dataDir, MOCKVIEW_WEB_ORIGIN: ORIGIN },
    windowsHide: true, stdio: ["ignore", logStream("server-out.log"), logStream("server-out.log")],
  });
  // The web server runs on Electron's own built-in Node, so no separate Node install is needed.
  const web = spawn(process.execPath, [path.join(WEB, "server.js")], {
    cwd: WEB, windowsHide: true, stdio: ["ignore", logStream("web.log"), logStream("web.log")],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", HOSTNAME: "127.0.0.1", PORT: String(WEB_PORT), NODE_ENV: "production" },
  });
  for (const [name, child] of [["API", api], ["web", web]]) {
    children.push(child);
    child.on("error", (e) => fatal(`The MockView ${name} server could not start: ${e.message}`));
    child.on("exit", (code) => { if (!quitting) fatal(`The MockView ${name} server stopped unexpectedly (code ${code}).\nDetails: ${app.getPath("userData")}`); });
  }
}

function stopServices() {
  quitting = true;
  for (const c of children) {
    try {
      if (process.platform === "win32" && c.pid) spawn("taskkill", ["/pid", String(c.pid), "/f", "/t"], { windowsHide: true });
      else c.kill("SIGTERM");
    } catch { /* already gone */ }
  }
}

function fatal(message) {
  if (quitting) return;
  quitting = true;
  dialog.showErrorBox("MockView", message);
  stopServices();
  app.exit(1);
}

function showSplash() {
  splash = new BrowserWindow({ width: 360, height: 220, frame: false, resizable: false, show: true, icon: ICON, backgroundColor: "#0B1F3B", alwaysOnTop: true });
  const html = `<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0B1F3B;color:#F8F4EC;font-family:Georgia,serif">
    <div style="font-size:30px;font-weight:700">Mock<span style="color:#8FB6D9">View</span></div>
    <div style="margin-top:10px;font:13px Arial,sans-serif;letter-spacing:.5px;color:#8FB6D9">Starting…</div></body>`;
  splash.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 980, minHeight: 640, show: false, title: "MockView", icon: ICON, backgroundColor: "#F8F4EC",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once("ready-to-show", () => { if (splash) { splash.destroy(); splash = null; } win.show(); });
  win.webContents.on("page-title-updated", (e) => e.preventDefault());   // keep the title simply "MockView"
  // Links to other sites (for example Google AI Studio) open in the person's normal browser, never inside this window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGIN)) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); }
  });
  win.on("closed", () => { win = null; });
  win.loadURL(ORIGIN + "/dashboard");
}

async function smokeTest() {  // developer/CI check: MOCKVIEW_SMOKE=1 loads the app, optionally runs a script, saves a screenshot, exits
  await new Promise((r) => win.webContents.once("did-finish-load", r));
  await new Promise((r) => setTimeout(r, Number(process.env.MOCKVIEW_SMOKE_WAIT || 3000)));
  const out = { userAgentHasElectron: /Electron\//.test(await win.webContents.executeJavaScript("navigator.userAgent")), title: win.getTitle() };
  if (process.env.MOCKVIEW_SMOKE_JS) out.script = await win.webContents.executeJavaScript(fs.readFileSync(process.env.MOCKVIEW_SMOKE_JS, "utf8"));
  if (process.env.MOCKVIEW_SMOKE_SHOT) fs.writeFileSync(process.env.MOCKVIEW_SMOKE_SHOT, (await win.webContents.capturePage()).toPNG());
  console.log("SMOKE " + JSON.stringify(out));
  stopServices(); app.exit(0);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    if (process.platform === "darwin") {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]));
    } else Menu.setApplicationMenu(null);

    // The microphone is the only permission MockView asks for, and only for its own pages.
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) =>
      cb(permission === "media" && String(details.requestingUrl || "").startsWith(ORIGIN)));
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => permission === "media" && String(origin).startsWith(ORIGIN));

    for (const p of [API_PORT, WEB_PORT]) {
      if (await portOpen(p)) return fatal(`Port ${p} is already in use by another program (or MockView is already running). Close it and try again.`);
    }
    showSplash();
    startServices();
    if (!(await waitForPort(API_PORT, 60000)) || !(await waitForPort(WEB_PORT, 60000))) {
      return fatal(`MockView did not start in time.\nDetails: ${app.getPath("userData")}`);
    }
    createWindow();
    if (process.env.MOCKVIEW_SMOKE === "1") void smokeTest();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", stopServices);
}
