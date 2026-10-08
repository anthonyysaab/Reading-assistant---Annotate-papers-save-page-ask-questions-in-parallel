import type { FileRef } from "@shared/types";
import { docxExtractor } from "./docx";
import { pdfExtractor } from "./pdf";
import { sniffText, textExtractor } from "./text";
import type { Extractor, RawExtraction } from "./types";
import { xlsxExtractor } from "./xlsx";

const EXTRACTORS: Extractor[] = [pdfExtractor, docxExtractor, xlsxExtractor, textExtractor];

export function pickExtractor(ref: FileRef, bytes: Uint8Array): Extractor | null {
  return EXTRACTORS.find((extractor) => extractor.match(ref, bytes)) ?? null;
}

/** Route a file to its extractor; fall back to a plain-text sniff, then a graceful empty doc. */
export async function runExtractor(ref: FileRef, bytes: Uint8Array): Promise<RawExtraction> {
  const extractor = pickExtractor(ref, bytes);
  if (extractor) return extractor.extract(ref, bytes);

  const sniffed = sniffText(bytes);
  if (sniffed !== null && sniffed.length > 0) {
    return { text: sniffed, meta: { format: "text-sniff", chars: sniffed.length } };
  }

  return {
    text: "",
    meta: { format: ref.ext || "binary", note: "no extractable text" }
  };
}
