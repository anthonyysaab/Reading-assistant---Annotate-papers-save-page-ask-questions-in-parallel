import { describe, expect, it } from "vitest";
import type { ProviderInfo } from "@shared/types";
import { embeddingReady, pickChatSuggestion } from "./onboarding";

function provider(overrides: Partial<ProviderInfo> & Pick<ProviderInfo, "id">): ProviderInfo {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    kind: overrides.kind ?? "local",
    configured: overrides.configured ?? false,
    chatModels: overrides.chatModels ?? [],
    embeddingModels: overrides.embeddingModels ?? [],
    ...(overrides.running !== undefined ? { running: overrides.running } : {})
  };
}

describe("pickChatSuggestion", () => {
  it("prefers a local Qwen model from a detected runtime", () => {
    const detected = [
      provider({
        id: "ollama",
        running: true,
        chatModels: [
          { id: "llama3:8b", name: "Llama 3" },
          { id: "qwen3:8b", name: "Qwen 3" }
        ]
      })
    ];
    expect(pickChatSuggestion(detected, [])).toEqual({ providerId: "ollama", model: "qwen3:8b" });
  });

  it("falls back to a configured provider when nothing is detected", () => {
    const providers = [
      provider({
        id: "lmstudio",
        kind: "remote",
        configured: true,
        chatModels: [{ id: "m", name: "M" }]
      })
    ];
    expect(pickChatSuggestion([], providers)).toEqual({ providerId: "lmstudio", model: "m" });
  });

  it("suggests a provider even when it reports no chat models", () => {
    const detected = [provider({ id: "ollama", running: true })];
    expect(pickChatSuggestion(detected, [])).toEqual({ providerId: "ollama" });
  });

  it("returns nothing when no providers exist", () => {
    expect(pickChatSuggestion([], [])).toEqual({});
  });
});

describe("embeddingReady", () => {
  it("is not ready when the provider is unknown", () => {
    expect(embeddingReady([], "ollama", "nomic-embed-text")).toBe(false);
  });

  it("is not ready when the provider is neither running nor configured", () => {
    const providers = [provider({ id: "ollama", running: false, configured: false })];
    expect(embeddingReady(providers, "ollama", "nomic-embed-text")).toBe(false);
  });

  it("is ready when the provider reports no models to check", () => {
    const providers = [provider({ id: "ollama", running: true })];
    expect(embeddingReady(providers, "ollama", "nomic-embed-text")).toBe(true);
  });

  it("is ready when the model is present among embedding models", () => {
    const providers = [
      provider({
        id: "ollama",
        running: true,
        embeddingModels: [{ id: "nomic-embed-text", name: "nomic" }]
      })
    ];
    expect(embeddingReady(providers, "ollama", "nomic-embed-text")).toBe(true);
  });

  it("is not ready when the model is absent from a reporting provider", () => {
    const providers = [
      provider({ id: "ollama", running: true, embeddingModels: [{ id: "other-embed", name: "other" }] })
    ];
    expect(embeddingReady(providers, "ollama", "nomic-embed-text")).toBe(false);
  });
});
