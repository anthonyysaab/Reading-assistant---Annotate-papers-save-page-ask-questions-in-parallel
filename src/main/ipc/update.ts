import { IPC } from "@shared/channels";
import { checkForUpdate, downloadAndInstallUpdate } from "@main/update/check";
import { handle } from "./registry";

export function registerUpdateIpc(): void {
  handle(IPC.update.check, async () => checkForUpdate());
  handle(IPC.update.install, async () => downloadAndInstallUpdate());
}
