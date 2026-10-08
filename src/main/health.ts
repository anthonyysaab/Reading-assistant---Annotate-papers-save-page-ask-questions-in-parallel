import type { HealthCheck, HealthReport, Settings } from "@shared/types";
import { getSettings } from "@main/config/settings";
import { listProviders, resolveProviderConfig, testProvider } from "@main/providers";

function unreachableRemediation(
  config: { name: string; kind: "local" | "remote"; needsSecret: boolean; baseUrl: string },
  error: string | undefined
): string {
  if (config.needsSecret && /key|unauthor|401|403/i.test(error ?? "")) {
    return `Add an API key for ${config.name} in Settings → Providers.`;
  }
  if (config.kind === "local") {
    return `Start ${config.name} and confirm it is listening at ${config.baseUrl}.`;
  }
  return `Check the API key and base URL for ${config.name} in Settings → Providers.`;
}

async function checkChat(settings: Settings): Promise<HealthCheck> {
  const id = settings.activeProviderId;
  const label = "Chat provider";
  if (!id) {
    return {
      id: "chat",
      label,
      state: "unconfigured",
      detail: "No chat provider selected.",
      remediation: "Pick a model in Settings → Models."
    };
  }
  const config = await resolveProviderConfig(id);
  if (!config) {
    return {
      id: "chat",
      label,
      state: "down",
      detail: `Unknown provider "${id}".`,
      remediation: "Re-select a provider in Settings → Providers."
    };
  }

  const result = await testProvider(id);
  if (result.ok) {
    return {
      id: "chat",
      label: `Chat · ${config.name}`,
      state: "ok",
      detail: settings.activeChatModel ? `Reachable · ${settings.activeChatModel}` : "Reachable · no model selected"
    };
  }

  const missingKey = config.needsSecret && /key/i.test(result.error ?? "");
  return {
    id: "chat",
    label: `Chat · ${config.name}`,
    state: missingKey ? "unconfigured" : "down",
    detail: result.error ?? "Provider is not reachable.",
    remediation: unreachableRemediation(config, result.error)
  };
}

async function checkEmbedding(settings: Settings): Promise<HealthCheck> {
  const label = "Embeddings";
  const providerId = settings.activeEmbeddingProviderId;
  const model = settings.activeEmbeddingModel;
  if (!providerId || !model) {
    return {
      id: "embedding",
      label,
      state: "unconfigured",
      detail: "No embedding provider/model selected.",
      remediation: "Choose an embedding model in Settings → Models (Ollama `nomic-embed-text` recommended)."
    };
  }
  const config = await resolveProviderConfig(providerId);
  if (!config) {
    return {
      id: "embedding",
      label,
      state: "down",
      detail: `Unknown embedding provider "${providerId}".`,
      remediation: "Re-select an embedding provider in Settings → Models."
    };
  }

  const result = await testProvider(providerId);
  if (!result.ok) {
    const missingKey = config.needsSecret && /key/i.test(result.error ?? "");
    return {
      id: "embedding",
      label: `Embeddings · ${config.name}`,
      state: missingKey ? "unconfigured" : "down",
      detail: result.error ?? "Embedding provider is not reachable.",
      remediation: unreachableRemediation(config, result.error)
    };
  }

  const providers = await listProviders().catch(() => []);
  const info = providers.find((provider) => provider.id === providerId);
  const models = [...(info?.embeddingModels ?? []), ...(info?.chatModels ?? [])];
  const present = models.length === 0 || models.some((entry) => entry.id === model);
  if (!present) {
    return {
      id: "embedding",
      label: `Embeddings · ${config.name}`,
      state: "degraded",
      detail: `Model "${model}" was not found on ${config.name}.`,
      remediation:
        config.kind === "local"
          ? `Pull the model, e.g. \`ollama pull ${model}\`.`
          : `Confirm "${model}" exists for ${config.name}.`
    };
  }

  return {
    id: "embedding",
    label: `Embeddings · ${config.name}`,
    state: "ok",
    detail: `Reachable · ${model}`
  };
}

export async function checkHealth(): Promise<HealthReport> {
  const settings = await getSettings();
  const [chat, embedding] = await Promise.all([checkChat(settings), checkEmbedding(settings)]);
  return { chat, embedding, checkedAt: new Date().toISOString() };
}
