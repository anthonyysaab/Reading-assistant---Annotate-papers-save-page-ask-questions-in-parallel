import type { ExtractedDoc } from "@shared/types";
import { IPC } from "@shared/channels";
import { extractDoc } from "@main/ingest/extract";
import { handle } from "./registry";

export function registerDocIpc(): void {
  handle(IPC.doc.extract, (path: unknown): Promise<ExtractedDoc> => extractDoc(String(path)));
}
