import type { ModelInfo } from "@shared/types";
import { asArray, asRecord, asString } from "./json";

export type Catalog = Record<string, ModelInfo[]>;

export function parseCatalogModels(raw: unknown): Catalog {
  const catalog: Catalog = {};
  const providers = asRecord(raw);
  if (!providers) return catalog;

  for (const [providerId, providerValue] of Object.entries(providers)) {
    const provider = asRecord(providerValue);
    const models = asRecord(provider?.["models"]);
    if (!models) continue;

    const list: ModelInfo[] = [];
    for (const [modelId, modelValue] of Object.entries(models)) {
      const model = asRecord(modelValue);
      const id = asString(model?.["id"]) ?? modelId;
      const limit = asRecord(model?.["limit"]);
      const contextWindow = typeof limit?.["context"] === "number" ? limit["context"] : undefined;
      const output = asArray(asRecord(model?.["modalities"])?.["output"]).filter(
        (item): item is string => typeof item === "string"
      );
      const supportsEmbedding = output.includes("embedding");
      const supportsChat = output.includes("text") || (output.length === 0 && !supportsEmbedding);
      list.push({
        id,
        name: asString(model?.["name"]) ?? id,
        ...(contextWindow !== undefined ? { contextWindow } : {}),
        supportsChat,
        supportsEmbedding
      });
    }
    if (list.length > 0) catalog[providerId] = list;
  }
  return catalog;
}

export function catalogModelsFor(catalog: Catalog, catalogId: string | undefined): ModelInfo[] {
  if (!catalogId) return [];
  return catalog[catalogId] ?? [];
}
