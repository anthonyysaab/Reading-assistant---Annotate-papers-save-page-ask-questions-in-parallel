import type { Citation } from "@shared/types";

export interface PromptContext {
  promptContext: string;
  citations: Citation[];
}

export async function buildPromptContext(
  docPath: string,
  question: string,
  selection?: string
): Promise<PromptContext | null> {
  try {
    const result = await window.api.rag.query({
      docPath,
      question,
      ...(selection ? { selection } : {})
    });
    const citations: Citation[] = result.retrieved.map((chunk) => ({
      chunkId: chunk.chunkId,
      ...(chunk.page !== undefined ? { page: chunk.page } : {}),
      ...(chunk.section !== undefined ? { section: chunk.section } : {}),
      snippet: chunk.text.slice(0, 240)
    }));
    if (!result.promptContext && citations.length === 0) return null;
    return { promptContext: result.promptContext, citations };
  } catch {
    return null;
  }
}
