import type { ProviderModule } from "@main/providers/types";
import type { ProviderConfig } from "@main/providers/registry";
import { resolveProviderConfig } from "@main/providers";
import { getModule } from "@main/providers/registry";
import { HttpError } from "@main/providers/http";
import { getSecret } from "@main/config/keyVault";
import { getSettings } from "@main/config/settings";

export type EmbedProgress = (done: number, total: number) => void;

export interface Embedder {
  providerId: string;
  providerName: string;
  model: string;
  embed(input: string[], signal: AbortSignal, onProgress?: EmbedProgress): Promise<number[][]>;
}

const BATCH_SIZE = 32;
const MAX_RETRIES = 4;

function abortError(): Error {
  const error = new Error("Indexing cancelled");
  error.name = "AbortError";
  return error;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500;
  const message = error instanceof Error ? error.message : String(error);
  return /429|too many requests|rate limit|\b5\d\d\b|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network|socket hang up/i.test(
    message
  );
}

async function withRetry<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (attempt >= MAX_RETRIES || !isRetryable(error)) throw error;
      const backoff = Math.min(8000, 400 * 2 ** attempt) + Math.floor(Math.random() * 200);
      await delay(backoff, signal);
      attempt += 1;
    }
  }
}

function describeFailure(error: unknown, config: ProviderConfig): Error {
  if (error instanceof Error && error.name === "AbortError") return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/is not configured|is selected|not recognized|could not be loaded|needs an API key/i.test(message)) {
    return error instanceof Error ? error : new Error(message);
  }
  const hint =
    config.kind === "local"
      ? `Make sure ${config.name} is running and the embedding model is available.`
      : "Check the API key and that the embedding model is available.";
  return new Error(`Embedding with "${config.name}" failed: ${message}. ${hint}`);
}

export async function resolveEmbedder(): Promise<Embedder> {
  const settings = await getSettings();
  const providerId = settings.activeEmbeddingProviderId;
  const model = settings.activeEmbeddingModel;

  if (!providerId) {
    throw new Error("No embedding provider is configured. Choose one in Settings, then re-index.");
  }
  if (!model) {
    throw new Error(
      `No embedding model is selected for "${providerId}". Choose an embedding model in Settings, then re-index.`
    );
  }
  const config = await resolveProviderConfig(providerId);
  if (!config) {
    throw new Error(`Embedding provider "${providerId}" is not recognized. Choose a supported provider in Settings.`);
  }
  const module = getModule(config.moduleId);
  if (!module) {
    throw new Error(`Embedding provider "${config.name}" could not be loaded.`);
  }

  let apiKey: string | undefined;
  if (config.needsSecret) {
    const secret = await getSecret(config.secretId ?? config.id);
    if (!secret) {
      throw new Error(`Embedding provider "${config.name}" needs an API key. Add it in Settings, then re-index.`);
    }
    apiKey = secret;
  }

  return createEmbedder(config, module, model, apiKey);
}

function createEmbedder(
  config: ProviderConfig,
  providerModule: ProviderModule,
  model: string,
  apiKey: string | undefined
): Embedder {
  return {
    providerId: config.id,
    providerName: config.name,
    model,
    async embed(input, signal, onProgress) {
      if (input.length === 0) return [];
      const vectors: number[][] = [];
      try {
        for (let start = 0; start < input.length; start += BATCH_SIZE) {
          const batch = input.slice(start, start + BATCH_SIZE);
          const batchVectors = await withRetry(
            () =>
              providerModule.embed({
                baseUrl: config.baseUrl,
                ...(apiKey !== undefined ? { apiKey } : {}),
                model,
                input: batch,
                signal
              }),
            signal
          );
          if (batchVectors.length !== batch.length) {
            throw new Error(
              `Embedding provider "${config.name}" returned ${batchVectors.length} vectors for ${batch.length} inputs.`
            );
          }
          vectors.push(...batchVectors);
          onProgress?.(vectors.length, input.length);
        }
      } catch (error) {
        throw describeFailure(error, config);
      }
      return vectors;
    }
  };
}
