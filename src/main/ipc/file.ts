import { dialog } from "electron";
import { IPC } from "@shared/channels";
import type { FileRef } from "@shared/types";
import { handle } from "./registry";
import { rememberRecentFile } from "@main/config/settings";
import {
  getFileRef,
  openExternal,
  readFileBytes,
  readFileText,
  revealInExplorer,
  stopWatching,
  watchFile,
  writeFileText
} from "@main/files/service";

function parseRange(value: unknown): { start: number; end: number } | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") throw new Error("Invalid byte range");
  const range = value as { start?: unknown; end?: unknown };
  if (typeof range.start !== "number" || typeof range.end !== "number") {
    throw new Error("Invalid byte range");
  }
  return { start: range.start, end: range.end };
}

export function registerFileIpc(): void {
  handle(IPC.file.openDialog, async (): Promise<FileRef | null> => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"] });
    const first = result.filePaths[0];
    if (result.canceled || !first) return null;
    const ref = await getFileRef(first);
    await rememberRecentFile(ref.path);
    return ref;
  });

  handle(IPC.file.ref, async (path: unknown): Promise<FileRef> => {
    const ref = await getFileRef(String(path));
    await rememberRecentFile(ref.path);
    return ref;
  });

  handle(IPC.file.readBytes, async (path: unknown, range: unknown) =>
    readFileBytes(String(path), parseRange(range))
  );

  handle(IPC.file.readText, async (path: unknown) => readFileText(String(path)));

  handle(IPC.file.writeText, async (path: unknown, text: unknown) =>
    writeFileText(String(path), String(text))
  );

  handle(IPC.file.revealInExplorer, async (path: unknown) => revealInExplorer(String(path)));

  handle(IPC.file.openExternal, async (path: unknown) => openExternal(String(path)));

  handle(IPC.file.watch, async (id: unknown, path: unknown) => watchFile(String(id), String(path)));

  handle(IPC.file.unwatch, async (id: unknown) => stopWatching(String(id)));
}
