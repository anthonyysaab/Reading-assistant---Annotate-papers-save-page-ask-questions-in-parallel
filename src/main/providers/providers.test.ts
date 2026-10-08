import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropic } from "./anthropic";
import { parseCatalogModels } from "./catalogParse";
import { requireBody } from "./http";
import { ollama } from "./ollama";
import { openaiCompatible } from "./openaiCompatible";
import { getModule, getProviderConfig } from "./registry";
import { parseSse } from "./sse";

function streamResponse(chunks: string[], init?: ResponseInit): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return new Response(body, init);
}

function abortSignal(): AbortSignal {
  return new AbortController().signal;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sse parser", () => {
  it("joins events split across chunk boundaries", async () => {
    const response = streamResponse(["data: hel", "lo\n\ndata: world\n\n"]);
    const events: string[] = [];
    for await (const event of parseSse(requireBody(response), abortSignal())) events.push(event.data);
    expect(events).toEqual(["hello", "world"]);
  });

  it("honours the event name", async () => {
    const response = streamResponse(["event: ping\ndata: {}\n\n"]);
    const events = [];
    for await (const event of parseSse(requireBody(response), abortSignal())) events.push(event);
    expect(events[0]?.event).toBe("ping");
  });
});

describe("openai-compatible provider", () => {
  it("streams chat deltas until [DONE]", async () => {
    const fetchMock = vi.fn(async () =>
      streamResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        "data: [DONE]\n\n"
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    for await (const chunk of openaiCompatible.chat({
      baseUrl: "https://example.test/v1",
      apiKey: "secret",
      model: "gpt-x",
      messages: [{ role: "user", content: "hi" }],
      signal: abortSignal()
    })) {
      deltas.push(chunk.delta);
    }

    expect(deltas.join("")).toBe("Hello");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("parses embeddings into vectors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }, { embedding: [1, 2] }] }), {
            status: 200
          })
      )
    );

    const vectors = await openaiCompatible.embed({
      baseUrl: "https://example.test/v1",
      model: "embed",
      input: ["a", "b"],
      signal: abortSignal()
    });
    expect(vectors).toEqual([
      [0.1, 0.2],
      [1, 2]
    ]);
  });

  it("surfaces HTTP failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(
      openaiCompatible.listModels({ baseUrl: "https://example.test/v1" })
    ).rejects.toThrow(/401/);
  });
});

describe("ollama provider", () => {
  it("parses newline-delimited JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamResponse([
          '{"message":{"content":"Hel"},"done":false}\n',
          '{"message":{"content":"lo"},"done":false}\n',
          '{"message":{"content":""},"done":true}\n'
        ])
      )
    );

    const deltas: string[] = [];
    for await (const chunk of ollama.chat({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:8b",
      messages: [{ role: "user", content: "hi" }],
      signal: abortSignal()
    })) {
      deltas.push(chunk.delta);
    }
    expect(deltas.join("")).toBe("Hello");
  });
});

describe("anthropic provider", () => {
  it("extracts the system prompt and streams content deltas", async () => {
    let captured: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init;
        return streamResponse([
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        ]);
      })
    );

    const deltas: string[] = [];
    for await (const chunk of anthropic.chat({
      baseUrl: "https://api.anthropic.com",
      apiKey: "secret",
      model: "claude",
      messages: [
        { role: "system", content: "be nice" },
        { role: "user", content: "hi" }
      ],
      signal: abortSignal()
    })) {
      deltas.push(chunk.delta);
    }

    expect(deltas.join("")).toBe("Hi");
    const body = JSON.parse(String(captured?.body)) as { system?: string; messages: unknown[] };
    expect(body.system).toBe("be nice");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("rejects embeddings", async () => {
    await expect(
      anthropic.embed({ baseUrl: "https://api.anthropic.com", model: "x", input: ["a"], signal: abortSignal() })
    ).rejects.toThrow(/embedding/i);
  });
});

describe("provider registry", () => {
  it("exposes the four built-in modules", () => {
    expect(getModule("ollama")?.id).toBe("ollama");
    expect(getModule("openai-compatible")?.id).toBe("openai-compatible");
    expect(getModule("anthropic")?.id).toBe("anthropic");
    expect(getModule("gemini")?.id).toBe("gemini");
  });

  it("ships DeepSeek as an openai-compatible preset", () => {
    const deepseek = getProviderConfig("deepseek");
    expect(deepseek?.moduleId).toBe("openai-compatible");
    expect(deepseek?.baseUrl).toBe("https://api.deepseek.com");
    expect(deepseek?.presetModels?.map((model) => model.id)).toEqual([
      "deepseek-chat",
      "deepseek-reasoner"
    ]);
  });
});

describe("model catalog parsing", () => {
  it("maps models.dev entries to ModelInfo", () => {
    const catalog = parseCatalogModels({
      openai: {
        id: "openai",
        models: {
          "gpt-4o": {
            id: "gpt-4o",
            name: "GPT-4o",
            limit: { context: 128000 },
            modalities: { output: ["text"] }
          }
        }
      },
      embeddings: {
        models: { "embed-1": { modalities: { output: ["embedding"] } } }
      }
    });

    expect(catalog["openai"]?.[0]).toMatchObject({
      id: "gpt-4o",
      name: "GPT-4o",
      contextWindow: 128000,
      supportsChat: true,
      supportsEmbedding: false
    });
    expect(catalog["embeddings"]?.[0]).toMatchObject({ id: "embed-1", supportsEmbedding: true });
  });
});
