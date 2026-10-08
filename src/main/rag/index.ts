import { watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
import type { IndexStatus, Retrieved } from "@shared/types";
import { IPC } from "@shared/channels";
import { emitToRenderer } from "@main/events";
import { getSettings } from "@main/config/settings";
import { resolveProviderConfig } from "@main/providers";
import { extractDoc } from "@main/ingest/extract";
import { chunkDocument } from "./chunk";
import { resolveEmbedder } from "./embed";
import { buildPromptContext } from "./prompt";
import { normalizeVector, retrieve } from "./retrieve";
import type { ProgressPhase } from "./types";
import { vectorStore } from "./vector-store";
import type { IndexChunk, VectorIndex } from "./types";

const statuses = new Map<string, IndexStatus>();
const controllers = new Map<string, AbortController>();
const watchers = new Map<string, FSWatcher>();
const watchTimers = new Map<string, NodeJS.Timeout>();

const NONE_STATUS: Omit<IndexStatus, "docPath"> = { state: "none", chunks: 0, dim: 0, embedModel: "" };

function abortError(): Error {
  const error = new Error("Indexing cancelled");
  error.name = "AbortError";
  return error;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function emitProgress(docPath: string, done: number, total: number, phase: ProgressPhase): void {
  emitToRenderer(IPC.rag.progress, { docPath, done, total, phase });
}

function statusFromIndex(index: VectorIndex): IndexStatus {
  return {
    docPath: index.docPath,
    state: "ready",
    chunks: index.chunks.length,
    dim: index.dim,
    embedModel: index.embedModel
  };
}

/** An index is only reusable while it was built with the currently-configured embedding model. */
export function indexMatchesModel(index: VectorIndex, model: string): boolean {
  return index.embedModel === model;
}

async function activeEmbedModel(): Promise<string> {
  const settings = await getSettings().catch(() => null);
  return settings?.activeEmbeddingModel ?? "";
}

async function providerNameFor(providerId: string): Promise<string> {
  return (await resolveProviderConfig(providerId))?.name ?? providerId;
}

function describeFailure(error: unknown, providerName: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Embedding with|No embedding|needs an API key|not recognized|could not be loaded/i.test(message)) {
    return message;
  }
  const source = providerName ? providerName : "the embedding provider";
  return `Indexing failed: ${message}. Check that ${source} is reachable and the embedding model is available.`;
}

function cancelInFlight(path: string): void {
  const controller = controllers.get(path);
  if (controller) {
    controller.abort();
    controllers.delete(path);
  }
}

async function deleteStale(docPath: string, keepHash: string): Promise<void> {
  const all = await vectorStore.list();
  for (const index of all) {
    if (index.docPath === docPath && index.contentHash !== keepHash) {
      await vectorStore.remove(index.contentHash);
    }
  }
}

function stopWatcher(path: string): void {
  const watcher = watchers.get(path);
  if (watcher) {
    watcher.close();
    watchers.delete(path);
  }
  const timer = watchTimers.get(path);
  if (timer) {
    clearTimeout(timer);
    watchTimers.delete(path);
  }
}

function scheduleReindex(path: string): void {
  const existing = watchTimers.get(path);
  if (existing) clearTimeout(existing);
  watchTimers.set(
    path,
    setTimeout(() => {
      watchTimers.delete(path);
      void handleFileChanged(path, "change");
    }, 200)
  );
}

function ensureWatcher(path: string): void {
  if (watchers.has(path)) return;
  try {
    const watcher = watch(path, () => scheduleReindex(path));
    watcher.on("error", () => {
      watchers.delete(path);
    });
    watchers.set(path, watcher);
  } catch {
    // Some paths cannot be watched; incremental indexing simply won't trigger for them.
  }
}

/**
 * Index a document. Returns an `IndexStatus`; configuration/embedding failures come back as
 * `state: "error"` with an actionable `error` string rather than throwing, so the renderer can
 * show them in the Context tab.
 */
export async function indexDocument(docPath: string, opts?: { force?: boolean }): Promise<IndexStatus> {
  const path = resolve(docPath);
  cancelInFlight(path);

  const settings = await getSettings().catch(() => null);
  const embedModel = settings?.activeEmbeddingModel ?? "";
  const providerName = settings ? await providerNameFor(settings.activeEmbeddingProviderId) : "";

  const controller = new AbortController();
  controllers.set(path, controller);
  statuses.set(path, { docPath: path, state: "indexing", chunks: 0, dim: 0, embedModel });
  emitProgress(path, 0, 0, "extract");

  try {
    const extracted = await extractDoc(path);
    if (controller.signal.aborted) throw abortError();

    if (!opts?.force) {
      const existing = await vectorStore.load(extracted.contentHash);
      if (existing && existing.docPath === path && existing.embedModel === embedModel) {
        const status = statusFromIndex(existing);
        statuses.set(path, status);
        ensureWatcher(path);
        emitProgress(path, existing.chunks.length, existing.chunks.length, "ready");
        return status;
      }
    }

    const chunks = chunkDocument(
      {
        contentHash: extracted.contentHash,
        text: extracted.text,
        ...(extracted.pages ? { pages: extracted.pages } : {}),
        ...(extracted.outline ? { outline: extracted.outline } : {})
      },
      {
        chunkTokens: settings?.rag.chunkTokens ?? 700,
        chunkOverlap: settings?.rag.chunkOverlap ?? 120
      }
    );
    emitProgress(path, chunks.length, chunks.length, "chunk");

    if (chunks.length === 0) {
      const empty: VectorIndex = {
        version: 1,
        docPath: path,
        contentHash: extracted.contentHash,
        embedModel,
        dim: 0,
        chunks: [],
        createdAt: new Date().toISOString()
      };
      await vectorStore.save(empty);
      await deleteStale(path, extracted.contentHash);
      const status = statusFromIndex(empty);
      statuses.set(path, status);
      ensureWatcher(path);
      emitProgress(path, 0, 0, "ready");
      return status;
    }

    const embedder = await resolveEmbedder();
    emitProgress(path, 0, chunks.length, "embed");
    const vectors = await embedder.embed(chunks.map((chunk) => chunk.text), controller.signal, (done, total) =>
      emitProgress(path, done, total, "embed")
    );
    if (controller.signal.aborted) throw abortError();

    const dim = vectors[0]?.length ?? 0;
    const indexChunks: IndexChunk[] = chunks.map((chunk, index) => ({
      ...chunk,
      vector: normalizeVector(vectors[index] ?? [])
    }));
    const index: VectorIndex = {
      version: 1,
      docPath: path,
      contentHash: extracted.contentHash,
      embedModel: embedder.model,
      dim,
      chunks: indexChunks,
      createdAt: new Date().toISOString()
    };
    emitProgress(path, chunks.length, chunks.length, "write");
    await vectorStore.save(index);
    await deleteStale(path, extracted.contentHash);

    const status = statusFromIndex(index);
    statuses.set(path, status);
    ensureWatcher(path);
    emitProgress(path, index.chunks.length, index.chunks.length, "ready");
    return status;
  } catch (error) {
    if (isAbort(error) || controller.signal.aborted) {
      return statuses.get(path) ?? { docPath: path, ...NONE_STATUS };
    }
    const status: IndexStatus = {
      docPath: path,
      state: "error",
      chunks: 0,
      dim: 0,
      embedModel,
      error: describeFailure(error, providerName)
    };
    statuses.set(path, status);
    emitProgress(path, 0, 0, "error");
    return status;
  } finally {
    if (controllers.get(path) === controller) controllers.delete(path);
  }
}

export async function getStatus(docPath: string): Promise<IndexStatus> {
  const path = resolve(docPath);
  const model = await activeEmbedModel();
  const inMemory = statuses.get(path);
  if (inMemory && (inMemory.state !== "ready" || inMemory.embedModel === model)) {
    return inMemory;
  }
  const index = await vectorStore.findByDocPath(path);
  if (index && indexMatchesModel(index, model)) {
    const status = statusFromIndex(index);
    statuses.set(path, status);
    ensureWatcher(path);
    return status;
  }
  // The persisted index was built with a different embedding model, so it is stale: report "none"
  // and let the next index/query rebuild it rather than retrieving against the wrong vector space.
  if (index) {
    statuses.delete(path);
    stopWatcher(path);
  }
  return { docPath: path, ...NONE_STATUS };
}

export async function removeIndex(docPath: string): Promise<void> {
  const path = resolve(docPath);
  cancelInFlight(path);
  stopWatcher(path);
  const index = await vectorStore.findByDocPath(path);
  if (index) await vectorStore.remove(index.contentHash);
  statuses.set(path, { docPath: path, ...NONE_STATUS });
}

export async function queryDocument(input: {
  docPath: string;
  question: string;
  selection?: string;
  topK?: number;
}): Promise<{ retrieved: Retrieved[]; promptContext: string }> {
  const path = resolve(input.docPath);
  let index = await vectorStore.findByDocPath(path);
  if (index && !indexMatchesModel(index, await activeEmbedModel())) {
    // The embedding model changed since this index was built; rebuild before it can be used so we
    // never score a fresh query against vectors from a different model.
    await indexDocument(path, { force: true });
    index = await vectorStore.findByDocPath(path);
  }
  if (!index || index.chunks.length === 0) return { retrieved: [], promptContext: "" };

  const settings = await getSettings();
  const embedder = await resolveEmbedder();
  const [queryVector] = await embedder.embed([input.question], new AbortController().signal);
  const retrieved = retrieve(index, queryVector ?? [], {
    topK: input.topK ?? settings.rag.topK,
    mmrLambda: settings.rag.mmrLambda,
    ...(input.selection ? { selection: input.selection } : {})
  });
  return { retrieved, promptContext: buildPromptContext(retrieved) };
}

/** Re-hash and re-index a document when its file changes on disk (incremental). */
export async function handleFileChanged(filePath: string, type: "change" | "unlink"): Promise<void> {
  const path = resolve(filePath);
  const known = statuses.get(path);
  const indexed = known ?? (await vectorStore.findByDocPath(path));
  if (!indexed) return;
  if (type === "unlink") {
    cancelInFlight(path);
    return;
  }
  await indexDocument(path);
}

export function listStatuses(): IndexStatus[] {
  return [...statuses.values()];
}
