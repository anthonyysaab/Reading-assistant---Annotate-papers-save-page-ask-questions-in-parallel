import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { toIpcError, type IpcResult } from "@shared/errors";

export function handle<A extends unknown[], R>(
  channel: string,
  fn: (...args: A) => Promise<R> | R
): void {
  ipcMain.handle(
    channel,
    async (_event: IpcMainInvokeEvent, ...args: unknown[]): Promise<IpcResult<R>> => {
      try {
        return { ok: true, value: await fn(...(args as A)) };
      } catch (error) {
        return { ok: false, error: toIpcError(error) };
      }
    }
  );
}
