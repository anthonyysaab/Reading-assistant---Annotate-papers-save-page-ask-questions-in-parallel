import { app, BrowserWindow } from "electron";
import { registerIpcHandlers } from "@main/ipc";
import { createMainWindow } from "@main/window";

// Test seam: lets automated runs use a throwaway profile instead of the real userData directory.
const userDataDir = process.env["RA_USER_DATA_DIR"];
if (userDataDir) app.setPath("userData", userDataDir);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [existing] = BrowserWindow.getAllWindows();
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.readingassistant.app");
    registerIpcHandlers();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
