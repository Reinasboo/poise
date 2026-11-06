const path = require("node:path");
const { app, BrowserWindow, ipcMain, session } = require("electron");
const { fileURLToPath } = require("node:url");
const { mkdir, readFile, rename, rm, writeFile } = require("node:fs/promises");

const isDevelopment = !app.isPackaged;

if (app.isPackaged) {
  const nativeLibrary = path.join(
    process.resourcesPath,
    "smartspectra",
    "smartspectra_capi.dll",
  );
  process.env.SMARTSPECTRA_CAPI_PATH = nativeLibrary;
}

const { bindSmartSpectraIpc } = require("@smartspectra/node-sdk/main");
const databasePath = path.join(app.getPath("userData"), "session-summaries.sqlite");
const temporaryDatabasePath = `${databasePath}.tmp`;

function assertTrustedSender(event) {
  const senderUrl = event.senderFrame?.url ?? "";
  if (!isAppPage(senderUrl)) {
    throw new Error("Poise storage access was rejected for an untrusted page.");
  }
}

ipcMain.handle("poise:storage:read", async (event) => {
  assertTrustedSender(event);
  try {
    const contents = await readFile(databasePath);
    return new Uint8Array(contents);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
});

ipcMain.handle("poise:storage:write", async (event, data) => {
  assertTrustedSender(event);
  if (!(data instanceof Uint8Array) || data.byteLength > 20 * 1024 * 1024) {
    throw new Error("Poise rejected an invalid or oversized local database.");
  }
  await mkdir(path.dirname(databasePath), { recursive: true });
  await writeFile(temporaryDatabasePath, Buffer.from(data));
  await rename(temporaryDatabasePath, databasePath);
});

ipcMain.handle("poise:storage:delete", async (event) => {
  assertTrustedSender(event);
  await rm(databasePath, { force: true });
  await rm(temporaryDatabasePath, { force: true });
});

function isAppPage(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (isDevelopment) return parsed.origin === "http://127.0.0.1:5173";
  if (parsed.protocol !== "file:") return false;
  const resolved = path.resolve(fileURLToPath(parsed));
  const distDirectory = path.resolve(app.getAppPath(), "dist");
  return resolved === path.join(distDirectory, "index.html") ||
    resolved.startsWith(`${distDirectory}${path.sep}`);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#101016",
    title: "Poise",
    webPreferences: {
      preload: path.join(__dirname, "../dist/preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  bindSmartSpectraIpc(window);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAppPage(url)) event.preventDefault();
  });

  if (isDevelopment) {
    void window.loadURL("http://127.0.0.1:5173");
  } else {
    void window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl =
        details?.requestingUrl || webContents?.getURL() || "";
      const mediaTypes = details?.mediaTypes || [];
      const cameraOnly =
        permission === "media" &&
        mediaTypes.length === 1 &&
        mediaTypes[0] === "video";

      callback(cameraOnly && isAppPage(requestingUrl));
    },
  );

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
