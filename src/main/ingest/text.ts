import type { FileRef } from "@shared/types";
import { isTextExt } from "@shared/mime";
import type { Extractor, RawExtraction } from "./types";

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .split("\u0000")
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * Best-effort plain-text decode used as the router's fallback. Returns `null` when the bytes
 * look binary so callers can emit a graceful "no text" doc instead.
 */
export function sniffText(bytes: Uint8Array): string | null {
  const limit = Math.min(bytes.length, 65536);
  if (limit === 0) return "";
  let control = 0;
  for (let i = 0; i < limit; i += 1) {
    const byte = bytes[i];
    if (byte === undefined) break;
    if (byte === 0) return null;
    if (byte < 9 || (byte > 13 && byte < 32)) control += 1;
  }
  if (control / limit > 0.1) return null;
  const text = decodeUtf8(bytes);
  const replacement = (text.match(/\uFFFD/g) ?? []).length;
  if (text.length > 0 && replacement / text.length > 0.05) return null;
  return normalizeText(text);
}

function canMatch(ref: FileRef): boolean {
  return (
    isTextExt(ref.ext) ||
    ref.mime.startsWith("text/") ||
    ref.mime === "application/json" ||
    ref.mime === "application/xml"
  );
}

export const textExtractor: Extractor = {
  id: "text",
  match: (ref) => canMatch(ref),
  async extract(ref, bytes): Promise<RawExtraction> {
    const text = normalizeText(decodeUtf8(bytes));
    return {
      text,
      meta: { format: ref.ext || "text", chars: text.length }
    };
  }
};
