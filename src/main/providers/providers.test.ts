import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropic } from "./anthropic";
import { parseCatalogModels } from "./catalogParse";
import { requireBody } from "./http";
import { ollama } from "./ollama";
import { openaiCompatible } from "./openaiCompatible";
import { getModule, getProviderConfig, resolveConfigsFrom } from "./registry";
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

describe("resolveConfigsFrom", () => {
  it("applies a user override to a built-in provider", () => {
    const configs = resolveConfigsFrom(
      [
        {
          id: "ollama",
          name: "My Ollama",
          moduleId: "ollama",
          kind: "local",
          baseUrl: "http://127.0.0.1:9999",
          needsSecret: false
        }
      ],
      []
    );
    const ollama = configs.find((config) => config.id === "ollama");
    expect(ollama?.name).toBe("My Ollama");
    expect(ollama?.baseUrl).toBe("http://127.0.0.1:9999");
  });

  it("omits hidden built-ins but keeps the rest", () => {
    const configs = resolveConfigsFrom([], ["anthropic"]);
    expect(configs.some((config) => config.id === "anthropic")).toBe(false);
    expect(configs.some((config) => config.id === "openai")).toBe(true);
  });

  it("adds a custom provider backed by a known module", () => {
    const configs = resolveConfigsFrom(
      [
        {
          id: "groq-work",
          name: "Groq (work)",
          moduleId: "openai-compatible",
          kind: "remote",
          baseUrl: "https://api.groq.com/openai/v1",
          needsSecret: true
        }
      ],
      []
    );
    expect(configs.find((config) => config.id === "groq-work")).toMatchObject({
      name: "Groq (work)",
      moduleId: "openai-compatible",
      needsSecret: true
    });
  });

  it("ignores a custom provider whose module is unknown", () => {
    const configs = resolveConfigsFrom(
      [{ id: "weird", name: "Weird", moduleId: "nope", kind: "remote", baseUrl: "x", needsSecret: false }],
      []
    );
    expect(configs.some((config) => config.id === "weird")).toBe(false);
  });

  it("treats an id matching a built-in as an override, not a duplicate", () => {
    const configs = resolveConfigsFrom(
      [
        {
          id: "openai",
          name: "OpenAI (custom)",
          moduleId: "openai-compatible",
          kind: "remote",
          baseUrl: "https://example.test/v1",
          needsSecret: true
        }
      ],
      []
    );
    expect(configs.filter((config) => config.id === "openai")).toHaveLength(1);
    expect(configs.find((config) => config.id === "openai")?.baseUrl).toBe("https://example.test/v1");
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
