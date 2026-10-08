import { describe, expect, it } from "vitest";
import { extname, isTextExt, looksBinary, mimeForExt, viewerKindFor } from "./mime";
import { fromIpcError, NotImplementedError, toIpcError } from "./errors";

describe("mime helpers", () => {
  it("maps known extensions", () => {
    expect(mimeForExt("pdf")).toBe("application/pdf");
    expect(mimeForExt("md")).toBe("text/markdown");
    expect(mimeForExt("nope")).toBe("application/octet-stream");
  });

  it("extracts extension including from windows paths", () => {
    expect(extname("C:\\docs\\Report.PDF")).toBe("pdf");
    expect(extname("/home/user/notes.md")).toBe("md");
    expect(extname("no-extension")).toBe("");
  });

  it("classifies text vs fallback", () => {
    expect(isTextExt("ts")).toBe(true);
    expect(isTextExt("png")).toBe(false);
    expect(viewerKindFor("pdf", mimeForExt("pdf"))).toBe("pdf");
    expect(viewerKindFor("png", mimeForExt("png"))).toBe("image");
    expect(viewerKindFor("ts", mimeForExt("ts"))).toBe("text");
    expect(viewerKindFor("bin", "application/octet-stream")).toBe("fallback");
  });

  it("detects binary content", () => {
    expect(looksBinary(new Uint8Array([0x68, 0x69]))).toBe(false);
    expect(looksBinary(new Uint8Array([0x00, 0x01]))).toBe(true);
  });
});

describe("ipc errors", () => {
  it("round-trips a not-implemented error", () => {
    const serialized = toIpcError(new NotImplementedError("rag.query", "owned by 04-rag-pipeline"));
    expect(serialized.code).toBe("NOT_IMPLEMENTED");
    const restored = fromIpcError(serialized);
    expect(restored).toBeInstanceOf(NotImplementedError);
    expect((restored as NotImplementedError).feature).toBe("rag.query");
  });

  it("serializes unknown failures as internal", () => {
    expect(toIpcError(new Error("boom")).code).toBe("INTERNAL");
    expect(toIpcError("nope").message).toBe("nope");
  });
});
