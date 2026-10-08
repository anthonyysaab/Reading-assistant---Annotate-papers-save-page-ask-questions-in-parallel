import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { Anchor, Annotation, AnnotationKind } from "@shared/types";
import { asArray, asRecord, asString } from "./providers/json";

export type AnnotationStorage = "sidecar" | "fallback" | "none";

/**
 * Runtime-only marker attached to returned annotations so the renderer can tell the user the
 * sidecar lives in `userData` because the document's folder is read-only. It is never persisted.
 */
export type TaggedAnnotation = Annotation & { storageFallback?: boolean };

interface SidecarFile {
  version: 1;
  docPath: string;
  fileHash: string;
  items: Annotation[];
}

interface LoadedSidecar {
  items: Annotation[];
  currentHash: string | null;
  storedHash: string | null;
  storage: AnnotationStorage;
}

const KINDS: readonly AnnotationKind[] = ["highlight", "note", "comment"];

function asKind(value: unknown): AnnotationKind | null {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value)
    ? (value as AnnotationKind)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseRect(value: unknown): { x: number; y: number; w: number; h: number } | null {
  const record = asRecord(value);
  if (!record) return null;
  const x = asFiniteNumber(record["x"]);
  const y = asFiniteNumber(record["y"]);
  const w = asFiniteNumber(record["w"]);
  const h = asFiniteNumber(record["h"]);
  if (x === null || y === null || w === null || h === null) return null;
  return { x, y, w, h };
}

function parseAnchor(value: unknown): Anchor | null {
  const record = asRecord(value);
  if (!record) return null;
  const page = asFiniteNumber(record["page"]);
  if (page === null) return null;
  const rects = asArray(record["rects"]).flatMap((entry) => {
    const rect = parseRect(entry);
    return rect ? [rect] : [];
  });
  return { page, rects };
}

function parseAnnotation(value: unknown): Annotation | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asString(record["id"]);
  const docPath = asString(record["docPath"]);
  const kind = asKind(record["kind"]);
  const createdAt = asString(record["createdAt"]);
  const updatedAt = asString(record["updatedAt"]);
  const anchor = parseAnchor(record["anchor"]);
  if (!id || !docPath || !kind || !createdAt || !updatedAt || !anchor) return null;
  const annotation: Annotation = { id, docPath, kind, anchor, createdAt, updatedAt };
  const quotedText = asString(record["quotedText"]);
  const color = asString(record["color"]);
  const note = asString(record["note"]);
  if (quotedText !== undefined) annotation.quotedText = quotedText;
  if (color !== undefined) annotation.color = color;
  if (note !== undefined) annotation.note = note;
  return annotation;
}

/** Persisted form: drop the render-only markers so they never round-trip into the sidecar. */
function toPersisted(item: TaggedAnnotation): Annotation {
  const annotation: Annotation = {
    id: item.id,
    docPath: item.docPath,
    kind: item.kind,
    anchor: item.anchor,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
  if (item.quotedText !== undefined) annotation.quotedText = item.quotedText;
  if (item.color !== undefined) annotation.color = item.color;
  if (item.note !== undefined) annotation.note = item.note;
  return annotation;
}

function sanitizeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

const hashCache = new Map<string, { mtimeMs: number; size: number; hash: string }>();

/** `sha256:<hex>` of the document's current bytes, or null when it cannot be read. */
export async function resolveFileHash(path: string): Promise<string | null> {
  try {
    const stats = await fs.stat(path);
    const cached = hashCache.get(path);
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      return cached.hash;
    }
    const bytes = await fs.readFile(path);
    const hash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    hashCache.set(path, { mtimeMs: stats.mtimeMs, size: stats.size, hash });
    return hash;
  } catch {
    return null;
  }
}

async function readSidecar(path: string): Promise<SidecarFile | null> {
  let text: string;
  try {
    text = await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (!record || !Array.isArray(record["items"])) return null;
  const items = asArray(record["items"]).flatMap((entry) => {
    const annotation = parseAnnotation(entry);
    return annotation ? [annotation] : [];
  });
  return {
    version: 1,
    docPath: asString(record["docPath"]) ?? "",
    fileHash: asString(record["fileHash"]) ?? "sha256:",
    items
  };
}

/** Temp-write then rename so a crash mid-write cannot truncate the existing sidecar. */
async function atomicWrite(target: string, payload: SidecarFile): Promise<void> {
  await fs.mkdir(dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(temp, target);
}

function withFallback(item: Annotation): TaggedAnnotation {
  return { ...item, storageFallback: true };
}

export class SidecarAnnotationStore {
  private readonly docPathById = new Map<string, string>();

  constructor(private readonly fallbackDir: string) {}

  private primaryPath(docPath: string): string {
    return `${docPath}.annotations.json`;
  }

  private fallbackPath(key: string): string {
    return join(this.fallbackDir, `${sanitizeName(key)}.json`);
  }

  private async load(docPath: string): Promise<LoadedSidecar> {
    const currentHash = await resolveFileHash(docPath);
    const primary = await readSidecar(this.primaryPath(docPath));
    let raw = primary;
    let storage: AnnotationStorage = primary ? "sidecar" : "none";
    if (!raw) {
      const fallback = await readSidecar(this.fallbackPath(currentHash ?? docPath));
      if (fallback) {
        raw = fallback;
        storage = "fallback";
      }
    }
    const storedHash = raw?.fileHash ?? null;
    const stale = currentHash !== null && storedHash !== null && storedHash !== currentHash;
    let items = (raw?.items ?? []).map((item) => ({ ...item }));
    if (stale) items = items.map((item) => ({ ...item, stale: true }));
    if (storage === "fallback") items = items.map(withFallback);
    return { items, currentHash, storedHash, storage };
  }

  private async save(docPath: string, items: Annotation[], fileHash: string): Promise<AnnotationStorage> {
    const payload: SidecarFile = {
      version: 1,
      docPath,
      fileHash,
      items: items.map(toPersisted)
    };
    try {
      await atomicWrite(this.primaryPath(docPath), payload);
      return "sidecar";
    } catch {
      await atomicWrite(this.fallbackPath(fileHash), payload);
      return "fallback";
    }
  }

  async list(docPath: string): Promise<Annotation[]> {
    const loaded = await this.load(docPath);
    for (const item of loaded.items) this.docPathById.set(item.id, docPath);
    return loaded.items;
  }

  async add(input: Omit<Annotation, "id" | "createdAt" | "updatedAt">): Promise<Annotation> {
    const { docPath } = input;
    const currentHash = await resolveFileHash(docPath);
    if (currentHash === null) {
      throw new Error(`Cannot annotate a file that cannot be read: ${docPath}`);
    }
    const loaded = await this.load(docPath);
    const now = new Date().toISOString();
    const annotation: Annotation = {
      id: randomUUID(),
      docPath,
      kind: input.kind,
      anchor: input.anchor,
      createdAt: now,
      updatedAt: now
    };
    if (input.quotedText !== undefined) annotation.quotedText = input.quotedText;
    if (input.color !== undefined) annotation.color = input.color;
    if (input.note !== undefined) annotation.note = input.note;

    const next = [...loaded.items.map(toPersisted), annotation];
    const storage = await this.save(docPath, next, currentHash);
    this.docPathById.set(annotation.id, docPath);
    return storage === "fallback" ? withFallback(annotation) : annotation;
  }

  async update(
    id: string,
    patch: Partial<Pick<Annotation, "note" | "color">>
  ): Promise<Annotation> {
    const docPath = this.docPathById.get(id);
    if (!docPath) throw new Error(`Unknown annotation: ${id}`);
    const loaded = await this.load(docPath);
    const existing = loaded.items.find((item) => item.id === id);
    if (!existing) throw new Error(`Unknown annotation: ${id}`);

    const updated: Annotation = { ...toPersisted(existing), updatedAt: new Date().toISOString() };
    if (patch.note !== undefined) updated.note = patch.note;
    if (patch.color !== undefined) updated.color = patch.color;

    const next = loaded.items.map((item) => (item.id === id ? updated : toPersisted(item)));
    const storage = await this.save(docPath, next, loaded.currentHash ?? loaded.storedHash ?? "sha256:");
    return storage === "fallback" ? withFallback(updated) : updated;
  }

  async remove(id: string): Promise<void> {
    const docPath = this.docPathById.get(id);
    if (!docPath) throw new Error(`Unknown annotation: ${id}`);
    const loaded = await this.load(docPath);
    if (!loaded.items.some((item) => item.id === id)) throw new Error(`Unknown annotation: ${id}`);
    const next = loaded.items.filter((item) => item.id !== id).map(toPersisted);
    await this.save(docPath, next, loaded.currentHash ?? loaded.storedHash ?? "sha256:");
    this.docPathById.delete(id);
  }
}
