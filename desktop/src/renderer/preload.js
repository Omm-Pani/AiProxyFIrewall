// CommonJS preload — no ESM imports here
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bridge", {
  onLog: (cb) => ipcRenderer.on("log", (_e, msg) => cb(msg)),
  onStatus: (cb) => ipcRenderer.on("status", (_e, status) => cb(status)),
  startShim: () => ipcRenderer.invoke("shim:start"),
  stopShim: () => ipcRenderer.invoke("shim:stop"),
  proxyOn: () => ipcRenderer.invoke("proxy:on"),
  proxyOff: () => ipcRenderer.invoke("proxy:off"),
});
