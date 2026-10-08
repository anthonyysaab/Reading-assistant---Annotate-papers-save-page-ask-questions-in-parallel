import type { IndexStatus, Retrieved } from "@shared/types";
import { IPC } from "@shared/channels";
import { getStatus, indexDocument, queryDocument, removeIndex } from "@main/rag/index";
import { handle } from "./registry";

function parseIndexOptions(value: unknown): { force?: boolean } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const force = (value as { force?: unknown }).force;
  return typeof force === "boolean" ? { force } : undefined;
}

interface QueryInput {
  docPath: string;
  question: string;
  selection?: string;
  topK?: number;
}

function parseQuery(value: unknown): QueryInput {
  if (!value || typeof value !== "object") throw new Error("Invalid rag.query input");
  const record = value as Record<string, unknown>;
  const docPath = record["docPath"];
  const question = record["question"];
  if (typeof docPath !== "string" || docPath.length === 0) throw new Error("rag.query requires docPath");
  if (typeof question !== "string" || question.trim().length === 0) throw new Error("rag.query requires a question");
  const input: QueryInput = { docPath, question };
  if (typeof record["selection"] === "string") input.selection = record["selection"];
  if (typeof record["topK"] === "number" && Number.isFinite(record["topK"])) input.topK = record["topK"];
  return input;
}

export function registerRagIpc(): void {
  handle(
    IPC.rag.index,
    (docPath: unknown, opts: unknown): Promise<IndexStatus> =>
      indexDocument(String(docPath), parseIndexOptions(opts))
  );

  handle(IPC.rag.status, (docPath: unknown): Promise<IndexStatus> => getStatus(String(docPath)));

  handle(IPC.rag.remove, (docPath: unknown): Promise<void> => removeIndex(String(docPath)));

  handle(
    IPC.rag.query,
    (input: unknown): Promise<{ retrieved: Retrieved[]; promptContext: string }> =>
      queryDocument(parseQuery(input))
  );
}
