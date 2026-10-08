import { describe, expect, it } from "vitest";
import { indexMatchesModel } from "./index";
import type { VectorIndex } from "./types";

function indexWithModel(embedModel: string): VectorIndex {
  return {
    version: 1,
    docPath: "C:/docs/example.pdf",
    contentHash: "sha256:deadbeef",
    embedModel,
    dim: 2,
    chunks: [],
    createdAt: new Date(0).toISOString()
  };
}

describe("indexMatchesModel", () => {
  it("accepts an index built with the active embedding model", () => {
    expect(indexMatchesModel(indexWithModel("nomic-embed-text"), "nomic-embed-text")).toBe(true);
  });

  it("rejects an index built with a different embedding model", () => {
    expect(indexMatchesModel(indexWithModel("nomic-embed-text"), "text-embedding-3-small")).toBe(false);
  });
});
