import * as XLSX from "xlsx";
import type { Extractor, RawExtraction } from "./types";
import { normalizeText } from "./text";

function sheetToText(sheet: XLSX.WorkSheet): string {
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  const lines: string[] = [];
  for (const row of rows) {
    const line = row
      .map((cell) => String(cell ?? "").trim())
      .join("\t")
      .replace(/\s+$/g, "");
    if (line.trim().length > 0) lines.push(line);
  }
  return normalizeText(lines.join("\n"));
}

export const xlsxExtractor: Extractor = {
  id: "xlsx",
  match: (ref) =>
    ["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(ref.ext) ||
    ref.mime.includes("spreadsheet") ||
    ref.mime === "application/vnd.ms-excel",
  async extract(_ref, bytes): Promise<RawExtraction> {
    const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    const pages: { index: number; text: string }[] = [];
    const outline: { title: string; page: number; level: number }[] = [];
    workbook.SheetNames.forEach((name, position) => {
      const sheet = workbook.Sheets[name];
      const text = sheet ? sheetToText(sheet) : "";
      const index = position + 1;
      pages.push({ index, text });
      outline.push({ title: name || `Sheet ${index}`, page: index, level: 1 });
    });
    const text = normalizeText(pages.map((page) => page.text).join("\n\n"));
    return {
      text,
      pages,
      outline,
      meta: { format: "xlsx", sheets: workbook.SheetNames.length, chars: text.length }
    };
  }
};
