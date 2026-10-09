import type { WebSearchResult } from "@shared/types";

/** Format attached web results into a system-context block the model can cite as `[web N]`. */
export function buildWebContext(results: WebSearchResult[]): string {
  if (results.length === 0) return "";
  const blocks = results.map((result, index) => {
    const heading = result.source ? `${result.title} — ${result.source}` : result.title;
    return [`[web ${index + 1}] ${heading}`, result.url, result.snippet].filter(Boolean).join("\n");
  });
  return [
    "The user attached web search results. Use them when relevant and cite them as [web N].",
    "",
    ...blocks
  ].join("\n\n");
}
