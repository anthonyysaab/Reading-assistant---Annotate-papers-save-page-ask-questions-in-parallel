import type { OnboardingChoices } from "@shared/types";
import { IPC } from "@shared/channels";
import { completeOnboarding, getOnboardingStatus } from "@main/onboarding";
import { handle } from "./registry";

function asChoices(value: unknown): OnboardingChoices {
  if (value === null || typeof value !== "object") return {};
  const input = value as Partial<OnboardingChoices>;
  const choices: OnboardingChoices = {};
  if (typeof input.providerId === "string") choices.providerId = input.providerId;
  if (typeof input.model === "string") choices.model = input.model;
  if (typeof input.embeddingProviderId === "string") choices.embeddingProviderId = input.embeddingProviderId;
  if (typeof input.embeddingModel === "string") choices.embeddingModel = input.embeddingModel;
  return choices;
}

export function registerOnboardingIpc(): void {
  handle(IPC.onboarding.status, async () => getOnboardingStatus());
  handle(IPC.onboarding.complete, async (choices: unknown) => completeOnboarding(asChoices(choices)));
}
