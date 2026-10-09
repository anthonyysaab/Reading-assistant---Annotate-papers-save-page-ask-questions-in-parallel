import { useState } from "react";
import { BRAVE_SEARCH_SECRET_ID } from "@shared/types";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { toast } from "@renderer/state/toastStore";
import { Button, Section, TextInput } from "./fields";

export function SearchSection() {
  const keysConfigured = useSettingsStore((state) => state.settings?.keysConfigured ?? {});
  const load = useSettingsStore((state) => state.load);
  const [secret, setSecret] = useState("");
  const hasKey = keysConfigured[BRAVE_SEARCH_SECRET_ID] === true;

  const save = async (): Promise<void> => {
    if (!secret.trim()) return;
    try {
      await window.api.settings.setSecret(BRAVE_SEARCH_SECRET_ID, secret.trim());
      setSecret("");
      await load();
      toast.success("Saved Brave Search API key.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const clear = async (): Promise<void> => {
    await window.api.settings.clearSecret(BRAVE_SEARCH_SECRET_ID);
    await load();
    toast.info("Cleared Brave Search API key.");
  };

  return (
    <Section
      title="Web search"
      description="Powers the Search tab using the Brave Search API. The key is stored with OS encryption and used only in the main process."
    >
      <div className="flex items-center gap-2">
        <TextInput
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
          placeholder={hasKey ? "Replace Brave API key…" : "Brave Search API key"}
          className="min-w-0 flex-1"
        />
        <Button variant="primary" onClick={() => void save()} disabled={!secret.trim()}>
          Save
        </Button>
        <Button variant="danger" onClick={() => void clear()} disabled={!hasKey}>
          Clear
        </Button>
      </div>
      <p className="text-[11px] text-text-weak">
        {hasKey ? "A key is configured." : "No key configured."} Create one at api.search.brave.com.
      </p>
    </Section>
  );
}
