import { create } from "zustand";
import type { Bookmark } from "@shared/types";

export const NO_BOOKMARKS: Bookmark[] = [];

interface BookmarkState {
  byDoc: Record<string, Bookmark[]>;
  loaded: Record<string, boolean>;
  load: (docPath: string) => Promise<void>;
  add: (input: { docPath: string; page?: number; position?: number; label: string }) => Promise<void>;
  remove: (bookmark: Bookmark) => Promise<void>;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  byDoc: {},
  loaded: {},

  load: async (docPath) => {
    if (get().loaded[docPath]) return;
    const bookmarks = await window.api.workspace.bookmarks.list(docPath);
    set((state) => ({
      byDoc: { ...state.byDoc, [docPath]: bookmarks },
      loaded: { ...state.loaded, [docPath]: true }
    }));
  },

  add: async (input) => {
    const bookmark = await window.api.workspace.bookmarks.add(input);
    set((state) => ({
      byDoc: { ...state.byDoc, [input.docPath]: [...(state.byDoc[input.docPath] ?? []), bookmark] },
      loaded: { ...state.loaded, [input.docPath]: true }
    }));
  },

  remove: async (bookmark) => {
    await window.api.workspace.bookmarks.remove(bookmark.id);
    set((state) => ({
      byDoc: {
        ...state.byDoc,
        [bookmark.docPath]: (state.byDoc[bookmark.docPath] ?? []).filter((entry) => entry.id !== bookmark.id)
      }
    }));
  }
}));
