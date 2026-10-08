import type { ExtractedDoc, FileRef } from "@shared/types";

export interface RawExtraction {
  text: string;
  pages?: { index: number; text: string }[];
  outline?: { title: string; page?: number; level: number }[];
  meta: Record<string, string | number>;
}

export interface Extractor {
  id: string;
  match(ref: FileRef, bytes: Uint8Array): boolean;
  extract(ref: FileRef, bytes: Uint8Array): Promise<RawExtraction>;
}

export type { ExtractedDoc };
