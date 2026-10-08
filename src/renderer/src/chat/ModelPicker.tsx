import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelInfo, ProviderInfo } from "@shared/types";
import { Icon } from "@renderer/components/Icon";
import { useSettingsStore } from "@renderer/state/settingsStore";

export function ModelPicker() {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setProviders(await window.api.providers.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings || settings.activeChatModel) return;
    const running = providers.find((provider) => provider.kind === "local" && provider.running && provider.chatModels.length > 0);
    const configured = providers.find((provider) => provider.configured && provider.chatModels.length > 0);
    const choice = running ?? configured;
    const model = choice?.chatModels[0];
    if (choice && model) void patch({ activeProviderId: choice.id, activeChatModel: model.id });
  }, [providers, settings, patch]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const select = (providerId: string, model: ModelInfo) => {
    void patch({ activeProviderId: providerId, activeChatModel: model.id });
    setOpen(false);
  };

  const active = providers.find((provider) => provider.id === settings?.activeProviderId);
  const label = settings?.activeChatModel
    ? `${active?.name ?? settings.activeProviderId} · ${settings.activeChatModel}`
    : "Select model";
  const withModels = providers.filter((provider) => provider.chatModels.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-text-weak hover:text-text"
        title="Choose provider and model"
      >
        <Icon name="context" className="h-3 w-3" />
        <span className="max-w-[160px] truncate">{label}</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-border bg-panel p-1 shadow-lg">
          {error ? <p className="px-2 py-1 text-[11px] text-red-300">{error}</p> : null}
          {!error && withModels.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-text-weak">
              No models available. Start Ollama or LM Studio, or add an API key in settings.
            </p>
          ) : null}
          {withModels.map((provider) => (
            <div key={provider.id} className="mb-1">
              <div className="flex items-center justify-between px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-weak">
                <span>{provider.name}</span>
                <span>
                  {provider.kind === "local"
                    ? provider.running
                      ? "local · running"
                      : "local · offline"
                    : provider.configured
                      ? "cloud"
                      : "no key"}
                </span>
              </div>
              {provider.chatModels.map((model) => {
                const selected =
                  provider.id === settings?.activeProviderId && model.id === settings?.activeChatModel;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => select(provider.id, model)}
                    className={`block w-full truncate rounded px-2 py-1 text-left text-[12px] ${
                      selected ? "bg-bg-subtle text-text" : "text-text-weak hover:bg-bg-subtle hover:text-text"
                    }`}
                  >
                    {model.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
