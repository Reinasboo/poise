require("@smartspectra/node-sdk/preload");

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("poiseStorage", {
  readSessionDatabase: () => ipcRenderer.invoke("poise:storage:read"),
  writeSessionDatabase: (data) => ipcRenderer.invoke("poise:storage:write", data),
  deleteSessionDatabase: () => ipcRenderer.invoke("poise:storage:delete"),
});
