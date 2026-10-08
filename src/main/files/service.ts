import { promises as fs, existsSync, watch as fsWatch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
import { shell } from "electron";
import type { FileRef } from "@shared/types";
import { basename, extname, isTextExt, looksBinary, mimeForExt } from "@shared/mime";
import { IPC } from "@shared/channels";
import { emitToRenderer } from "@main/events";

interface FileChangedEvent {
  id: string;
  path: string;
  type: "change" | "unlink";
}

const watchers = new Map<string, FSWatcher>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export async function getFileRef(inputPath: string): Promise<FileRef> {
  const path = resolve(inputPath);
  const stats = await fs.stat(path);
  if (!stats.isFile()) throw new Error(`Not a file: ${path}`);
  const ext = extname(path);
  return { path, name: basename(path), ext, mime: mimeForExt(ext), size: stats.size };
}

export async function readFileBytes(
  inputPath: string,
  range?: { start: number; end: number }
): Promise<ArrayBuffer> {
  const path = resolve(inputPath);
  if (range) {
    if (range.start < 0 || range.end < range.start) throw new Error("Invalid byte range");
    const handle = await fs.open(path, "r");
    try {
      const length = range.end - range.start;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, range.start);
      return toArrayBuffer(buffer);
    } finally {
      await handle.close();
    }
  }
  return toArrayBuffer(await fs.readFile(path));
}

export async function readFileText(inputPath: string): Promise<string> {
  const path = resolve(inputPath);
  const buffer = await fs.readFile(path);
  if (looksBinary(buffer)) {
    throw new Error(`Refusing to read binary file as text: ${basename(path)}`);
  }
  return buffer.toString("utf8");
}

export async function writeFileText(inputPath: string, text: string): Promise<void> {
  const path = resolve(inputPath);
  if (!isTextExt(extname(path))) {
    throw new Error(`Refusing to write non-text file: ${basename(path)}`);
  }
  await fs.writeFile(path, text, "utf8");
}

export async function revealInExplorer(inputPath: string): Promise<void> {
  shell.showItemInFolder(resolve(inputPath));
}

export async function openExternal(inputPath: string): Promise<void> {
  const error = await shell.openPath(resolve(inputPath));
  if (error) throw new Error(error);
}

export function watchFile(id: string, inputPath: string): void {
  stopWatching(id);
  const path = resolve(inputPath);
  const watcher = fsWatch(path, () => scheduleEvent(id, path));
  watcher.on("error", () => emitChange(id, path));
  watchers.set(id, watcher);
}

export function stopWatching(id: string): void {
  const watcher = watchers.get(id);
  if (watcher) {
    watcher.close();
    watchers.delete(id);
  }
  const timer = debounceTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(id);
  }
}

function scheduleEvent(id: string, path: string): void {
  const existing = debounceTimers.get(id);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    id,
    setTimeout(() => {
      debounceTimers.delete(id);
      emitChange(id, path);
    }, 120)
  );
}

function emitChange(id: string, path: string): void {
  const event: FileChangedEvent = { id, path, type: existsSync(path) ? "change" : "unlink" };
  emitToRenderer(IPC.file.changed, event);
}
