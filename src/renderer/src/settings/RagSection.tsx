import { useSettingsStore } from "@renderer/state/settingsStore";
import { NumberInput, Row, Section } from "./fields";

export function RagSection() {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  if (!settings) return null;

  const update = (next: Partial<typeof settings.rag>): void => {
    void patch({ rag: { ...settings.rag, ...next } });
  };

  return (
    <Section
      title="Retrieval (RAG)"
      description="Controls how documents are chunked, embedded, and retrieved. Changes apply to the next index/query."
    >
      <div className="space-y-3">
        <Row label="Top K" hint="Number of chunks retrieved per question.">
          <NumberInput value={settings.rag.topK} min={1} max={50} onChange={(value) => update({ topK: value })} />
        </Row>
        <Row label="Chunk size (tokens)">
          <NumberInput
            value={settings.rag.chunkTokens}
            min={100}
            max={4000}
            step={50}
            onChange={(value) => update({ chunkTokens: value })}
          />
        </Row>
        <Row label="Chunk overlap (tokens)">
          <NumberInput
            value={settings.rag.chunkOverlap}
            min={0}
            max={1000}
            step={10}
            onChange={(value) => update({ chunkOverlap: value })}
          />
        </Row>
        <Row label="MMR lambda" hint="0 = max diversity, 1 = max relevance.">
          <NumberInput
            value={settings.rag.mmrLambda}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => update({ mmrLambda: Math.max(0, Math.min(1, value)) })}
          />
        </Row>
      </div>
    </Section>
  );
}
