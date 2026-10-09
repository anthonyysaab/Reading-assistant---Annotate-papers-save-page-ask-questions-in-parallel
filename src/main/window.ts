import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { attachBrowser, disposeBrowser } from "@main/browser/service";
import { bindEventTarget } from "@main/events";

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 768,
    minHeight: 520,
    show: false,
    backgroundColor: "#0e0f11",
    title: "Reading Assistant",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false
    }
  });

  bindEventTarget(window.webContents);
  attachBrowser(window);
  window.on("closed", () => disposeBrowser());

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Dropping a file onto the window must never navigate the app to that file URL.
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (!app.isPackaged && rendererUrl) {
    void window.loadURL(rendererUrl);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}
