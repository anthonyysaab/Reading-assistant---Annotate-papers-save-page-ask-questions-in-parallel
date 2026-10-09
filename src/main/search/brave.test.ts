import { afterEach, describe, expect, it, vi } from "vitest";

const getSecret = vi.hoisted(() => vi.fn());

vi.mock("@main/config/keyVault", () => ({ getSecret }));

import { searchWeb } from "./brave";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  getSecret.mockReset();
});

describe("searchWeb", () => {
  it("maps Brave results and sends the key + query", async () => {
    getSecret.mockResolvedValue("secret-key");
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: "T1",
                  url: "https://a.test/x",
                  description: "S1",
                  age: "1 day ago",
                  profile: { long_name: "A.test" }
                },
                { url: "https://b.test" }
              ]
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWeb("hello world");

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      title: "T1",
      url: "https://a.test/x",
      snippet: "S1",
      source: "A.test",
      age: "1 day ago"
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("secret-key");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=hello%20world");
  });

  it("throws a helpful error when no key is configured", async () => {
    getSecret.mockResolvedValue(null);
    await expect(searchWeb("hi")).rejects.toThrow(/Brave Search API key/);
  });

  it("surfaces HTTP failures", async () => {
    getSecret.mockResolvedValue("k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(searchWeb("hi")).rejects.toThrow(/401/);
  });

  it("returns nothing for a blank query", async () => {
    expect(await searchWeb("   ")).toEqual([]);
  });
});
