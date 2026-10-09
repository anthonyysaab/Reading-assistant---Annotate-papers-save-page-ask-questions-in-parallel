import { describe, expect, it } from "vitest";
import { toUrlOrSearch } from "./webSearch";

describe("toUrlOrSearch", () => {
  it("keeps explicit http(s) URLs", () => {
    expect(toUrlOrSearch("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(toUrlOrSearch("  http://example.com  ")).toBe("http://example.com");
  });

  it("upgrades bare hosts to https", () => {
    expect(toUrlOrSearch("example.com")).toBe("https://example.com");
    expect(toUrlOrSearch("www.example.co.uk/path")).toBe("https://www.example.co.uk/path");
  });

  it("treats localhost and IP hosts as http", () => {
    expect(toUrlOrSearch("localhost:3000")).toBe("http://localhost:3000");
    expect(toUrlOrSearch("127.0.0.1:1234/v1")).toBe("http://127.0.0.1:1234/v1");
  });

  it("falls back to a DuckDuckGo query", () => {
    expect(toUrlOrSearch("how do pdfs work")).toBe("https://duckduckgo.com/?q=how%20do%20pdfs%20work");
    expect(toUrlOrSearch("qwen 3")).toBe("https://duckduckgo.com/?q=qwen%203");
  });

  it("returns empty for blank input", () => {
    expect(toUrlOrSearch("   ")).toBe("");
  });
});
