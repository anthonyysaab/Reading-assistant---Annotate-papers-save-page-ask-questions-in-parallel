import { useState } from "react";
import { EmptyState } from "@renderer/components/EmptyState";

const SEARCH_URL = "https://duckduckgo.com/?q=";

export function SearchTab() {
  const [term, setTerm] = useState("");
  const trimmed = term.trim();

  const openSearch = (): void => {
    if (!trimmed) return;
    void window.api.file.openExternal(`${SEARCH_URL}${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          openSearch();
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
          disabled={!trimmed}
          className="rounded border border-border px-2 py-1 text-xs text-text hover:bg-bg-subtle disabled:opacity-40"
        >
          Search
        </button>
      </form>

      <EmptyState
        title="Search the web"
        hint="Queries open in your default browser via DuckDuckGo."
      />
    </div>
  );
}
