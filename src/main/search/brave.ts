import type { WebSearchResult } from "@shared/types";
import { BRAVE_SEARCH_SECRET_ID } from "@shared/types";
import { getSecret } from "@main/config/keyVault";
import { asArray, asRecord, asString } from "@main/providers/json";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_RESULTS = 10;

function toResult(entry: unknown): WebSearchResult | null {
  const record = asRecord(entry);
  const url = asString(record?.["url"]);
  if (!url) return null;
  const title = asString(record?.["title"]) ?? url;
  const description = asString(record?.["description"]) ?? "";
  const source = asString(asRecord(record?.["profile"])?.["long_name"]);
  const age = asString(record?.["age"]);
  return {
    title,
    url,
    snippet: description,
    ...(source ? { source } : {}),
    ...(age ? { age } : {})
  };
}

/**
 * Query the Brave Search web API. The API key lives in the `safeStorage` vault and never reaches
 * the renderer; all network access happens here in the main process.
 */
export async function searchWeb(query: string, signal?: AbortSignal): Promise<WebSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const key = await getSecret(BRAVE_SEARCH_SECRET_ID);
  if (!key) {
    throw new Error("Web search needs a Brave Search API key. Add it in Settings → Web search.");
  }

  const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(trimmed)}&count=${MAX_RESULTS}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    ...(signal ? { signal } : {})
  });
  if (!response.ok) {
    throw new Error(`Brave Search request failed (${response.status}). Check the API key and quota.`);
  }

  const payload = asRecord((await response.json()) as unknown);
  const results = asArray(asRecord(payload?.["web"])?.["results"]);
  return results.map(toResult).filter((result): result is WebSearchResult => result !== null);
}
