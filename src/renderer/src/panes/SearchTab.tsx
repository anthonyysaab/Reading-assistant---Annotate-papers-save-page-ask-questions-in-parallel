import { useState } from "react";
import { BRAVE_SEARCH_SECRET_ID } from "@shared/types";
import { EmptyState } from "@renderer/components/EmptyState";
import { Icon } from "@renderer/components/Icon";
import { switchPanelTab } from "@renderer/lib/commands";
import { selectActiveDoc, useAppStore } from "@renderer/state/appStore";
import { useSearchStore } from "@renderer/state/searchStore";
import { useSettingsStore } from "@renderer/state/settingsStore";

export function SearchTab() {
  const doc = useAppStore(selectActiveDoc);
  const hasKey = useSettingsStore(
    (state) => state.settings?.keysConfigured[BRAVE_SEARCH_SECRET_ID] ?? false
  );
  const query = useSearchStore((state) => state.query);
  const results = useSearchStore((state) => state.results);
  const loading = useSearchStore((state) => state.loading);
  const error = useSearchStore((state) => state.error);
  const run = useSearchStore((state) => state.run);
  const attach = useSearchStore((state) => state.attach);
  const attachedCount = useSearchStore((state) =>
    doc ? (state.attachedByDoc[doc.id]?.length ?? 0) : 0
  );

  const [term, setTerm] = useState("");

  const onAttach = (): void => {
    if (!doc) return;
    attach(doc.id);
    void switchPanelTab("chat");
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(term);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search the web…"
          className="min-w-0 flex-1 rounded border border-border bg-bg-subtle px-2 py-1 text-xs text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !term.trim()}
          className="rounded border border-border px-2 py-1 text-xs text-text hover:bg-bg-subtle disabled:opacity-40"
        >
          {loading ? "…" : "Search"}
        </button>
        <button
          type="button"
          onClick={() => void run(query)}
          disabled={loading || !query}
          className="rounded border border-border p-1.5 text-text-weak hover:text-text disabled:opacity-40"
          title="Refresh results"
          aria-label="Refresh results"
        >
          <Icon name="refresh" />
        </button>
      </form>

      {!hasKey ? (
        <p className="text-xs leading-relaxed text-text-weak">
          Add a Brave Search API key in Settings → Search to enable web search.
        </p>
      ) : null}

      {error ? <p className="text-xs leading-relaxed text-red-300">{error}</p> : null}

      {results.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-text-weak">
              {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
            </p>
            <button
              type="button"
              onClick={onAttach}
              disabled={!doc}
              title={doc ? "Attach these results to the chat" : "Open a document first"}
              className="shrink-0 rounded border border-border px-2 py-1 text-xs text-text hover:bg-bg-subtle disabled:opacity-40"
            >
              Attach to chat
            </button>
          </div>

          {attachedCount > 0 ? (
            <p className="text-[11px] text-text-weak">
              {attachedCount} result(s) attached to this document's chat.
            </p>
          ) : null}

          <ul className="space-y-2">
            {results.map((result) => (
              <li key={result.url} className="rounded border border-border bg-bg-subtle p-2">
                <button
                  type="button"
                  onClick={() => void window.api.file.openExternal(result.url)}
                  className="block w-full text-left"
                  title={result.url}
                >
                  <span className="block truncate text-xs font-medium text-text">{result.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-accent">{result.url}</span>
                </button>
                {result.snippet ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-text-weak">{result.snippet}</p>
                ) : null}
                {result.age ? <p className="mt-0.5 text-[10px] text-text-weak">{result.age}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : !loading && !error && hasKey ? (
        <EmptyState
          title="Search the web"
          hint="Results appear here and can be attached to your chat so the model can use them."
        />
      ) : null}
    </div>
  );
}
