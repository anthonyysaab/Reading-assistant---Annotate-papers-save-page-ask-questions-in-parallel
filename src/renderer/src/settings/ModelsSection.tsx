import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderInfo } from "@shared/types";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { toast } from "@renderer/state/toastStore";
import { Button, Row, Section, Select, TextInput } from "./fields";

export function ModelsSection() {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await window.api.providers.list());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chatProvider = providers.find((provider) => provider.id === settings?.activeProviderId);
  const chatModels = chatProvider?.chatModels ?? [];
  const embeddingProvider = providers.find((provider) => provider.id === settings?.activeEmbeddingProviderId);
  const embeddingSuggestions = useMemo(() => {
    if (!embeddingProvider) return [];
    const ids = [...embeddingProvider.embeddingModels, ...embeddingProvider.chatModels].map((model) => model.id);
    return [...new Set(ids)];
  }, [embeddingProvider]);

  if (!settings) return null;

  return (
    <Section title="Models" description="Choose the default chat model and the embedding model used for the RAG index.">
      <div className="space-y-3">
        <Row label="Chat provider">
          <Select
            value={settings.activeProviderId}
            onChange={(event) => {
              const providerId = event.target.value;
              const next = providers.find((provider) => provider.id === providerId);
              void patch({
                activeProviderId: providerId,
                activeChatModel: next?.chatModels[0]?.id ?? ""
              });
            }}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
                {provider.kind === "local" ? (provider.running ? " · running" : " · offline") : ""}
              </option>
            ))}
          </Select>
        </Row>

        <Row label="Chat model" hint={chatModels.length === 0 && !loading ? "No models detected; type one manually." : undefined}>
          {chatModels.length > 0 ? (
            <Select
              value={settings.activeChatModel}
              onChange={(event) => void patch({ activeChatModel: event.target.value })}
            >
              <option value="">Select a model</option>
              {chatModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
          ) : (
            <TextInput
              value={settings.activeChatModel}
              onChange={(event) => void patch({ activeChatModel: event.target.value })}
              placeholder="model id"
            />
          )}
        </Row>

        <div className="flex justify-end">
          <Button onClick={() => void refresh()} disabled={loading}>
            Refresh models
          </Button>
        </div>

        <Row label="Embedding provider">
          <Select
            value={settings.activeEmbeddingProviderId}
            onChange={(event) => void patch({ activeEmbeddingProviderId: event.target.value })}
          >
            <option value="">None</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </Row>

        <Row
          label="Embedding model"
          hint="Ollama `nomic-embed-text` is the recommended offline default. Changing this re-indexes documents."
        >
          <TextInput
            value={settings.activeEmbeddingModel}
            onChange={(event) => void patch({ activeEmbeddingModel: event.target.value })}
            placeholder="nomic-embed-text"
            list="embedding-model-suggestions"
          />
        </Row>
        <datalist id="embedding-model-suggestions">
          {embeddingSuggestions.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </div>
    </Section>
  );
}
