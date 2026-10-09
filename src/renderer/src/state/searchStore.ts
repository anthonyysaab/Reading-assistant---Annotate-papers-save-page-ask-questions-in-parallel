import { create } from "zustand";
import type { WebSearchResult } from "@shared/types";

interface SearchState {
  query: string;
  results: WebSearchResult[];
  loading: boolean;
  error: string | null;
  /** Web results attached to a document's chat, keyed by `OpenDoc.id`. */
  attachedByDoc: Record<string, WebSearchResult[]>;
  run: (query: string) => Promise<void>;
  attach: (docId: string, results?: WebSearchResult[]) => void;
  detach: (docId: string) => void;
  clear: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  results: [],
  loading: false,
  error: null,
  attachedByDoc: {},

  run: async (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    set({ loading: true, error: null, query: trimmed });
    try {
      const results = await window.api.search.query(trimmed);
      set({ results, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        results: [],
        loading: false
      });
    }
  },

  attach: (docId, results) => {
    const next = results ?? get().results;
    if (next.length === 0) return;
    set((state) => ({ attachedByDoc: { ...state.attachedByDoc, [docId]: next } }));
  },

  detach: (docId) =>
    set((state) => {
      const attachedByDoc = { ...state.attachedByDoc };
      delete attachedByDoc[docId];
      return { attachedByDoc };
    }),

  clear: () => set({ results: [], error: null, query: "" })
}));

export function selectAttachedResults(state: SearchState, docId: string | null): WebSearchResult[] {
  return docId ? (state.attachedByDoc[docId] ?? []) : [];
}
