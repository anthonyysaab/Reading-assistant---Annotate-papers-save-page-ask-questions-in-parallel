import { registerAnnotationsIpc } from "./annotations";
import { registerDocIpc } from "./doc";
import { registerFileIpc } from "./file";
import { registerHealthIpc } from "./health";
import { registerLlmIpc } from "./llm";
import { registerOnboardingIpc } from "./onboarding";
import { registerProvidersIpc } from "./providers";
import { registerRagIpc } from "./rag";
import { registerSearchIpc } from "./search";
import { registerSettingsIpc } from "./settings";
import { registerStubIpc } from "./stubs";
import { registerThreadsIpc } from "./threads";
import { registerUpdateIpc } from "./update";

export function registerIpcHandlers(): void {
  registerFileIpc();
  registerSettingsIpc();
  registerProvidersIpc();
  registerLlmIpc();
  registerThreadsIpc();
  registerDocIpc();
  registerAnnotationsIpc();
  registerRagIpc();
  registerHealthIpc();
  registerOnboardingIpc();
  registerSearchIpc();
  registerUpdateIpc();
  registerStubIpc();
}
