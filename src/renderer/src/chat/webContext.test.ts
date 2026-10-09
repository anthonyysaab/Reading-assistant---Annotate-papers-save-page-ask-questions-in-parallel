import { describe, expect, it } from "vitest";
import { buildWebContext } from "./webContext";

describe("buildWebContext", () => {
  it("returns an empty string when nothing is attached", () => {
    expect(buildWebContext([])).toBe("");
  });

  it("numbers results, includes urls, and states the citation rule", () => {
    const context = buildWebContext([
      { title: "Alpha", url: "https://a.test", snippet: "sa", source: "A.test" },
      { title: "Beta", url: "https://b.test", snippet: "sb" }
    ]);
    expect(context).toContain("[web 1] Alpha — A.test");
    expect(context).toContain("https://b.test");
    expect(context).toContain("[web N]");
  });
});
