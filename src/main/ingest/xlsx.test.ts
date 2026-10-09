import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { FileRef } from "@shared/types";
import { xlsxExtractor } from "./xlsx";

function ref(): FileRef {
  return {
    path: "C:/docs/scores.xlsx",
    name: "scores.xlsx",
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 0
  };
}

function workbookBytes(): Uint8Array {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Name", "Score"], ["Alice", 10], ["Bob", 20]]), "Scores");
  const out = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(out);
}

describe("xlsxExtractor", () => {
  it("matches spreadsheet extensions", () => {
    expect(xlsxExtractor.match(ref(), new Uint8Array())).toBe(true);
  });

  it("extracts per-sheet text with an outline", async () => {
    const result = await xlsxExtractor.extract(ref(), workbookBytes());
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("Bob");
    expect(result.pages?.[0]?.text).toContain("Alice");
    expect(result.outline?.[0]?.title).toBe("Scores");
    expect(result.meta["sheets"]).toBe(1);
  });
});
