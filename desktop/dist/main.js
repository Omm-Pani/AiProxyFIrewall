import { app, Tray, Menu, BrowserWindow, dialog, ipcMain, nativeImage, } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import log from "electron-log/main.js";
import { ensurePac } from "./proxy/pac.js";
import { setSystemProxyOn, setSystemProxyOff } from "./proxy/systemProxy.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let tray = null;
let win = null;
let shim = null;
let shimRunning = false;
const SHIM_DIR = process.env.SHIM_DIR || path.resolve(process.cwd(), "..", "shim");
const SHIM_START_CMD = process.env.SHIM_START_CMD || "node";
const SHIM_ARGS = process.env.SHIM_ARGS
    ? process.env.SHIM_ARGS.split(" ")
    : ["dist/index.js"];
const LOCAL_SOCKS = process.env.LOCAL_SOCKS || "127.0.0.1:1080";
function resolveRenderer(file) {
    // Dev: load straight from src/renderer; Packaged: from app resources
    return app.isPackaged
        ? path.join(process.resourcesPath, "renderer", file)
        : path.join(process.cwd(), "src", "renderer", file);
}
function createWindow() {
    const preloadPath = resolveRenderer("preload.js");
    const indexPath = resolveRenderer("index.html");
    win = new BrowserWindow({
        width: 560,
        height: 520,
        webPreferences: {
            contextIsolation: true,
            preload: preloadPath,
        },
    });
    win.loadFile(indexPath).catch((err) => {
        dialog.showErrorBox("Load error", `Failed to load UI: ${err.message}`);
    });
}
function createTray() {
    // Try template icon; if missing, fall back to non-template
    let iconPath = resolveRenderer("trayTemplate.png");
    let img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) {
        iconPath = resolveRenderer("tray.png");
        img = nativeImage.createFromPath(iconPath);
    }
    if (process.platform === "darwin")
        img.setTemplateImage(true);
    if (img.isEmpty()) {
        // Don’t block the app if icons are missing—just make a window
        log.warn("Tray icon not found at", iconPath);
        return;
    }
    tray = new Tray(img);
    tray.setToolTip("VPN-Like Proxy");
    tray.setContextMenu(Menu.buildFromTemplate([
        {
            label: shimRunning ? "Disconnect" : "Connect",
            click: () => toggleShim(),
        },
        { type: "separator" },
        { label: "Enable System PAC", click: () => enablePAC() },
        { label: "Disable System Proxy", click: () => disableProxy() },
        { type: "separator" },
        {
            label: "Open Console",
            click: () => {
                if (!win)
                    createWindow();
                else
                    win.show();
            },
        },
        {
            label: "Quit",
            click: () => {
                stopShim();
                app.quit();
            },
        },
    ]));
}
async function enablePAC() {
    try {
        const pacPath = await ensurePac(LOCAL_SOCKS);
        await setSystemProxyOn(pacPath);
        win?.webContents.send("status", { type: "proxy", value: "on", pacPath });
        log.info("PAC enabled at:", pacPath);
    }
    catch (e) {
        dialog.showErrorBox("PAC Error", e?.message || String(e));
    }
}
async function disableProxy() {
    try {
        await setSystemProxyOff();
        win?.webContents.send("status", { type: "proxy", value: "off" });
        log.info("Proxy disabled");
    }
    catch (e) {
        dialog.showErrorBox("Proxy Error", e?.message || String(e));
    }
}
function startShim() {
    if (shimRunning)
        return;
    // Sanity: check the file exists
    const entry = path.join(SHIM_DIR, SHIM_ARGS[0]);
    log.info("Starting shim:", SHIM_START_CMD, SHIM_ARGS.join(" "), "cwd=", SHIM_DIR);
    shim = spawn(SHIM_START_CMD, SHIM_ARGS, { cwd: SHIM_DIR, env: process.env });
    shim.on("error", (err) => {
        log.error("shim spawn error", err);
        win?.webContents.send("log", "shim spawn error: " + err.message);
    });
    shim.stdout.on("data", (d) => {
        const s = d.toString().trim();
        log.info("[shim]", s);
        win?.webContents.send("log", s);
        if (s.includes("local SOCKS5 listening")) {
            shimRunning = true;
            win?.webContents.send("status", { type: "shim", value: "running" });
            updateTrayConnectLabel();
        }
    });
    shim.stderr.on("data", (d) => {
        const s = d.toString().trim();
        log.error("[shim-err]", s);
        win?.webContents.send("log", s);
    });
    shim.on("exit", (code) => {
        shimRunning = false;
        log.warn("shim exited", code);
        win?.webContents.send("status", { type: "shim", value: "stopped" });
        updateTrayConnectLabel();
    });
}
function stopShim() {
    if (!shim)
        return;
    log.info("Stopping shim");
    try {
        shim.kill("SIGTERM");
    }
    catch { }
}
function toggleShim() {
    if (shimRunning)
        stopShim();
    else
        startShim();
}
function updateTrayConnectLabel() {
    if (!tray)
        return;
    const menu = Menu.buildFromTemplate([
        {
            label: shimRunning ? "Disconnect" : "Connect",
            click: () => toggleShim(),
        },
        { type: "separator" },
        { label: "Enable System PAC", click: () => enablePAC() },
        { label: "Disable System Proxy", click: () => disableProxy() },
        { type: "separator" },
        {
            label: "Open Console",
            click: () => {
                if (!win)
                    createWindow();
                else
                    win.show();
            },
        },
        {
            label: "Quit",
            click: () => {
                stopShim();
                app.quit();
            },
        },
    ]);
    tray.setContextMenu(menu);
}
// IPC to wire window buttons
ipcMain.handle("shim:start", async () => {
    startShim();
    return true;
});
ipcMain.handle("shim:stop", async () => {
    stopShim();
    return true;
});
ipcMain.handle("proxy:on", async () => {
    const p = await ensurePac(LOCAL_SOCKS);
    await setSystemProxyOn(p);
    return p;
});
ipcMain.handle("proxy:off", async () => {
    await setSystemProxyOff();
    return true;
});
app.whenReady().then(() => {
    createWindow();
    createTray();
});
app.on("window-all-closed", () => {
    // Keep the app running as a tray app on macOS
    if (process.platform !== "darwin")
        app.quit();
});
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
