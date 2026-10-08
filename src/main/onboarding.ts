import type { OnboardingChoices, OnboardingStatus, ProviderInfo, Settings } from "@shared/types";
import { getSettings, updateSettings } from "@main/config/settings";
import { detectLocalProviders, listProviders } from "@main/providers";

const DEFAULT_EMBEDDING_PROVIDER = "ollama";
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";

function pickChatSuggestion(
  detected: ProviderInfo[],
  providers: ProviderInfo[]
): { providerId?: string; model?: string } {
  const candidate =
    detected.find((provider) => provider.chatModels.length > 0) ??
    providers.find((provider) => provider.configured && provider.chatModels.length > 0) ??
    detected[0];
  if (!candidate || candidate.chatModels.length === 0) {
    return candidate ? { providerId: candidate.id } : {};
  }
  const qwen = candidate.chatModels.find((model) => /qwen/i.test(model.id));
  const model = qwen ?? candidate.chatModels[0];
  return { providerId: candidate.id, ...(model ? { model: model.id } : {}) };
}

function embeddingReady(
  providers: ProviderInfo[],
  providerId: string,
  model: string
): boolean {
  const info = providers.find((provider) => provider.id === providerId);
  if (!info) return false;
  const available = info.running !== false || info.configured;
  if (!available) return false;
  const models = [...info.embeddingModels, ...info.chatModels];
  return models.length === 0 || models.some((entry) => entry.id === model);
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const settings = await getSettings();
  const [detected, providers] = await Promise.all([detectLocalProviders(), listProviders()]);

  const chat = pickChatSuggestion(detected, providers);

  const ollama = providers.find((provider) => provider.id === "ollama");
  const embeddingProviderId =
    ollama?.running === true ? "ollama" : settings.activeEmbeddingProviderId || DEFAULT_EMBEDDING_PROVIDER;
  const embeddingModel = settings.activeEmbeddingModel || DEFAULT_EMBEDDING_MODEL;

  return {
    firstRun: settings.onboardingComplete !== true,
    detected,
    ...(chat.providerId ? { suggestedChatProviderId: chat.providerId } : {}),
    ...(chat.model ? { suggestedChatModel: chat.model } : {}),
    suggestedEmbeddingProviderId: embeddingProviderId,
    suggestedEmbeddingModel: embeddingModel,
    embeddingReady: embeddingReady(providers, embeddingProviderId, embeddingModel)
  };
}

export async function completeOnboarding(choices: OnboardingChoices): Promise<Settings> {
  const patch: Partial<Settings> = { onboardingComplete: true };
  if (choices.providerId) patch.activeProviderId = choices.providerId;
  if (choices.model !== undefined) patch.activeChatModel = choices.model;
  if (choices.embeddingProviderId) patch.activeEmbeddingProviderId = choices.embeddingProviderId;
  if (choices.embeddingModel !== undefined) patch.activeEmbeddingModel = choices.embeddingModel;
  return updateSettings(patch);
}
