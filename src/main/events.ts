import type { WebContents } from "electron";

let target: WebContents | null = null;

export function bindEventTarget(webContents: WebContents): void {
  target = webContents;
}

export function emitToRenderer(channel: string, payload: unknown): void {
  if (target && !target.isDestroyed()) target.send(channel, payload);
}
