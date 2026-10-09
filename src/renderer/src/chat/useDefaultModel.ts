import { useEffect } from "react";
import { useSettingsStore } from "@renderer/state/settingsStore";

/** Picks a sensible first chat model (a running local runtime, else any configured provider)
 *  when none is set yet. Keeps local-first behavior without the old header dropdown. */
export function useDefaultModel(): void {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);

  useEffect(() => {
    if (!settings || settings.activeChatModel) return;
    let active = true;
    void window.api.providers
      .list()
      .then((providers) => {
        if (!active) return;
        const running = providers.find(
          (provider) => provider.kind === "local" && provider.running && provider.chatModels.length > 0
        );
        const configured = providers.find(
          (provider) => provider.configured && provider.chatModels.length > 0
        );
        const choice = running ?? configured;
        const model = choice?.chatModels[0];
        if (choice && model) void patch({ activeProviderId: choice.id, activeChatModel: model.id });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [settings, patch]);
}
