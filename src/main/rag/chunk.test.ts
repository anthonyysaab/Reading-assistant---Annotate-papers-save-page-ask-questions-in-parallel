import { describe, expect, it } from "vitest";
import { approximateTokens, chunkDocument } from "./chunk";

const SENTENCE =
  "The quick brown fox jumps over the lazy dog while the river runs quietly past the old mill.";

function paragraph(sentences: number): string {
  return Array.from({ length: sentences }, (_, index) => `${SENTENCE} ${index}`).join(" ");
}

describe("approximateTokens", () => {
  it("estimates roughly chars/4 and never returns zero", () => {
    expect(approximateTokens("")).toBe(1);
    expect(approximateTokens("abcd")).toBe(1);
    expect(approximateTokens("a".repeat(400))).toBe(100);
  });
});

describe("chunkDocument", () => {
  it("returns nothing for empty or whitespace-only text", () => {
    expect(chunkDocument({ contentHash: "sha256:test", text: "" }, { chunkTokens: 50, chunkOverlap: 10 })).toEqual([]);
    expect(
      chunkDocument({ contentHash: "sha256:test", text: "   \n\n  " }, { chunkTokens: 50, chunkOverlap: 10 })
    ).toEqual([]);
  });

  it("splits long text into multiple deterministic chunks", () => {
    const chunks = chunkDocument(
      { contentHash: "sha256:test", text: paragraph(60) },
      { chunkTokens: 50, chunkOverlap: 10 }
    );
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.ordinal).toBe(index);
      expect(chunk.id).toBe(`sha256:test:${index}`);
      expect(chunk.tokens).toBe(Math.max(1, Math.ceil(chunk.text.length / 4)));
      expect(chunk.text.length).toBeGreaterThan(0);
    });
  });

  it("keeps chunks near the token budget", () => {
    const chunks = chunkDocument(
      { contentHash: "sha256:test", text: paragraph(80) },
      { chunkTokens: 40, chunkOverlap: 0 }
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(40 * 4 + SENTENCE.length + 8);
    }
  });

  it("overlaps neighbouring chunks when configured", () => {
    const input = { contentHash: "sha256:test", text: paragraph(60) };
    const withOverlap = chunkDocument(input, { chunkTokens: 120, chunkOverlap: 30 });
    const withoutOverlap = chunkDocument(input, { chunkTokens: 120, chunkOverlap: 0 });
    const total = (chunks: { text: string }[]): number =>
      chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
    expect(total(withOverlap)).toBeGreaterThan(total(withoutOverlap));
  });

  it("stamps page numbers from paginated input", () => {
    const pages = [
      { index: 1, text: paragraph(20) },
      { index: 2, text: paragraph(20) }
    ];
    const text = pages.map((page) => page.text).join("\n\n");
    const chunks = chunkDocument(
      { contentHash: "sha256:test", text, pages },
      { chunkTokens: 50, chunkOverlap: 0 }
    );
    expect(chunks.some((chunk) => chunk.page === 1)).toBe(true);
    expect(chunks.some((chunk) => chunk.page === 2)).toBe(true);
  });

  it("labels chunks with the nearest outline section", () => {
    const pages = [
      { index: 1, text: paragraph(20) },
      { index: 2, text: paragraph(20) }
    ];
    const text = pages.map((page) => page.text).join("\n\n");
    const outline = [
      { title: "Introduction", page: 1, level: 1 },
      { title: "Methods", page: 2, level: 1 }
    ];
    const chunks = chunkDocument(
      { contentHash: "sha256:test", text, pages, outline },
      { chunkTokens: 50, chunkOverlap: 0 }
    );
    expect(chunks.find((chunk) => chunk.page === 1)?.section).toBe("Introduction");
    expect(chunks.find((chunk) => chunk.page === 2)?.section).toBe("Methods");
  });
});
