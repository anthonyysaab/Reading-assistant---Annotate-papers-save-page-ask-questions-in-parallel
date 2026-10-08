import * as mammoth from "mammoth";
import type { Extractor, RawExtraction } from "./types";
import { normalizeText } from "./text";

export const docxExtractor: Extractor = {
  id: "docx",
  match: (ref) =>
    ref.ext === "docx" ||
    ref.ext === "doc" ||
    ref.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  async extract(_ref, bytes): Promise<RawExtraction> {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = normalizeText(result.value);
    return {
      text,
      meta: {
        format: "docx",
        chars: text.length,
        warnings: result.messages.length
      }
    };
  }
};
