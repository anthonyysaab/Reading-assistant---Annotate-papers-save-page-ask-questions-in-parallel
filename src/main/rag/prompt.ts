import type { Retrieved } from "@shared/types";

export interface PromptContextOptions {
  docName?: string;
  maxChars?: number;
}

function labelFor(chunk: Retrieved): string {
  if (chunk.page !== undefined) return ` (p.${chunk.page})`;
  if (chunk.section) return ` (${chunk.section})`;
  return "";
}

/** Assemble the grounded system prompt: numbered excerpts labelled with page/section + cite rule. */
export function buildPromptContext(retrieved: Retrieved[], options: PromptContextOptions = {}): string {
  if (retrieved.length === 0) return "";

  const budget = options.maxChars ?? 12000;
  const numbered: string[] = [];
  let used = 0;
  for (let index = 0; index < retrieved.length; index += 1) {
    const chunk = retrieved[index];
    if (!chunk) continue;
    const block = `[${index + 1}]${labelFor(chunk)}\n${chunk.text.trim()}`;
    if (used + block.length > budget && numbered.length > 0) continue;
    numbered.push(block);
    used += block.length;
  }
  if (numbered.length === 0) return "";

  const instructions = [
    "You are a reading assistant. Answer the user's question using ONLY the numbered document excerpts below.",
    "Cite every excerpt you rely on with its bracketed number, e.g. [1] or [2][3].",
    "If the excerpts do not contain the answer, say you could not find it in the document; do not use outside knowledge."
  ];
  if (options.docName) instructions.push(`Document: ${options.docName}`);

  return [instructions.join("\n"), "Document excerpts:", ...numbered].join("\n\n");
}
