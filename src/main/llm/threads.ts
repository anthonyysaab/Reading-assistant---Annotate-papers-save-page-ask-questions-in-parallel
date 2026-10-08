import { app, dialog } from "electron";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Thread } from "@shared/types";
import { asArray, asRecord, asString, parseJson } from "@main/providers/json";

const DOC_ID_RE = /^[a-zA-Z0-9._-]+$/;

function threadsDir(): string {
  return join(app.getPath("userData"), "threads");
}

function threadPath(docId: string): string {
  if (!DOC_ID_RE.test(docId)) throw new Error(`Invalid doc id: ${docId}`);
  return join(threadsDir(), `${docId}.json`);
}

function asRole(value: string | undefined): "user" | "assistant" | null {
  return value === "user" || value === "assistant" ? value : null;
}

function parseThread(value: unknown): Thread | null {
  const record = asRecord(value);
  const id = asString(record?.["id"]);
  const docId = asString(record?.["docId"]);
  const title = asString(record?.["title"]);
  if (!id || !docId || title === undefined) return null;
  const messages = asArray(record?.["messages"]).flatMap((entry) => {
    const message = asRecord(entry);
    const messageId = asString(message?.["id"]);
    const role = asRole(asString(message?.["role"]));
    const content = asString(message?.["content"]);
    const createdAt = asString(message?.["createdAt"]);
    if (!messageId || content === undefined || !createdAt || role === null) return [];
    return [{ id: messageId, role, content, createdAt }];
  });
  return { id, docId, title, messages };
}

export async function saveThread(thread: Thread): Promise<void> {
  const path = threadPath(thread.docId);
  await mkdir(threadsDir(), { recursive: true });
  await writeFile(path, `${JSON.stringify(thread, null, 2)}\n`, "utf8");
}

export async function loadThread(docId: string): Promise<Thread | null> {
  try {
    return parseThread(parseJson(await readFile(threadPath(docId), "utf8")));
  } catch {
    return null;
  }
}

export async function listThreads(): Promise<Thread[]> {
  try {
    const files = await readdir(threadsDir());
    const threads: Thread[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const thread = await loadThread(file.slice(0, -5));
      if (thread) threads.push(thread);
    }
    return threads;
  } catch {
    return [];
  }
}

export async function removeThread(docId: string): Promise<void> {
  await rm(threadPath(docId), { force: true });
}

function safeFileName(title: string): string {
  const cleaned = [...title]
    .map((ch) => (ch.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(ch) ? "_" : ch))
    .join("")
    .trim();
  return (cleaned || "thread").slice(0, 80);
}

export function threadToMarkdown(thread: Thread): string {
  const lines: string[] = [`# ${thread.title || "Untitled thread"}`, ""];
  for (const message of thread.messages) {
    lines.push(message.role === "user" ? "## You" : "## Assistant", "", message.content.trim(), "");
    if (message.citations && message.citations.length > 0) {
      lines.push("Citations:", "");
      for (const citation of message.citations) {
        const where = citation.page !== undefined ? `p.${citation.page}` : citation.section ?? "chunk";
        lines.push(`- ${where}: ${citation.snippet.replace(/\s+/g, " ").trim()}`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export async function exportThreadMarkdown(thread: Thread): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export thread",
    defaultPath: `${safeFileName(thread.title)}.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }]
  });
  if (canceled || !filePath) return null;
  await writeFile(filePath, threadToMarkdown(thread), "utf8");
  return filePath;
}
