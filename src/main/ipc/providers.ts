import { IPC } from "@shared/channels";
import { detectLocalProviders, listProviders, testProvider } from "@main/providers";
import { listProviderModules } from "@main/providers/registry";
import { handle } from "./registry";

export function registerProvidersIpc(): void {
  handle(IPC.providers.list, async () => listProviders());
  handle(IPC.providers.detectLocal, async () => detectLocalProviders());
  handle(IPC.providers.test, async (providerId: unknown) => testProvider(String(providerId)));
  handle(IPC.providers.modules, async () => listProviderModules());
}
