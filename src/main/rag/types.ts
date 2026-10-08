export interface IndexChunk {
  id: string;
  ordinal: number;
  page?: number;
  section?: string;
  text: string;
  vector: number[];
  tokens: number;
}

/** On-disk shape, exactly `docs/interfaces.md` §4. */
export interface VectorIndex {
  version: 1;
  docPath: string;
  contentHash: string;
  embedModel: string;
  dim: number;
  chunks: IndexChunk[];
  createdAt: string;
}

export interface ChunkInput {
  contentHash: string;
  text: string;
  pages?: { index: number; text: string }[];
  outline?: { title: string; page?: number; level: number }[];
}

export interface ChunkOptions {
  chunkTokens: number;
  chunkOverlap: number;
}

export interface TextChunk {
  id: string;
  ordinal: number;
  page?: number;
  section?: string;
  text: string;
  tokens: number;
}

export interface RetrieveOptions {
  topK: number;
  mmrLambda: number;
  selection?: string;
}

export const PROGRESS_PHASES = ["extract", "chunk", "embed", "write", "ready", "error"] as const;
export type ProgressPhase = (typeof PROGRESS_PHASES)[number];
