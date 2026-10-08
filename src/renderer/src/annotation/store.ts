import { create } from "zustand";
import type { Anchor, Annotation, AnnotationKind } from "@shared/types";

export interface AddAnnotationInput {
  docPath: string;
  kind: AnnotationKind;
  anchor: Anchor;
  quotedText?: string;
  color?: string;
  note?: string;
}

export type StorageMode = "sidecar" | "fallback" | "none";

export const EMPTY_ANNOTATIONS: Annotation[] = [];

function annotatedWithFallback(annotation: Annotation): boolean {
  return (annotation as Annotation & { storageFallback?: boolean }).storageFallback === true;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface AnnotationState {
  itemsByDoc: Record<string, Annotation[]>;
  storageByDoc: Record<string, StorageMode>;
  loadingByDoc: Record<string, boolean>;
  errorByDoc: Record<string, string | null>;
  activeId: string | null;
  popoverId: string | null;
  load: (docPath: string) => Promise<void>;
  add: (input: AddAnnotationInput) => Promise<Annotation | null>;
  update: (docPath: string, id: string, patch: { note?: string; color?: string }) => Promise<void>;
  remove: (docPath: string, id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  setPopover: (id: string | null) => void;
  clearForDoc: (docPath: string | null) => void;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  itemsByDoc: {},
  storageByDoc: {},
  loadingByDoc: {},
  errorByDoc: {},
  activeId: null,
  popoverId: null,

  load: async (docPath) => {
    set((state) => ({ loadingByDoc: { ...state.loadingByDoc, [docPath]: true } }));
    try {
      const items = await window.api.annotations.list(docPath);
      const storage: StorageMode = items.some(annotatedWithFallback)
        ? "fallback"
        : items.length > 0
          ? "sidecar"
          : "none";
      set((state) => ({
        itemsByDoc: { ...state.itemsByDoc, [docPath]: items },
        storageByDoc: { ...state.storageByDoc, [docPath]: storage },
        loadingByDoc: { ...state.loadingByDoc, [docPath]: false },
        errorByDoc: { ...state.errorByDoc, [docPath]: null }
      }));
    } catch (error) {
      set((state) => ({
        loadingByDoc: { ...state.loadingByDoc, [docPath]: false },
        errorByDoc: { ...state.errorByDoc, [docPath]: toMessage(error) }
      }));
    }
  },

  add: async (input) => {
    try {
      const annotation = await window.api.annotations.add(input);
      set((state) => ({
        itemsByDoc: {
          ...state.itemsByDoc,
          [input.docPath]: [...(state.itemsByDoc[input.docPath] ?? []), annotation]
        },
        storageByDoc: {
          ...state.storageByDoc,
          [input.docPath]: annotatedWithFallback(annotation) ? "fallback" : "sidecar"
        },
        activeId: annotation.id,
        errorByDoc: { ...state.errorByDoc, [input.docPath]: null }
      }));
      return annotation;
    } catch (error) {
      set((state) => ({ errorByDoc: { ...state.errorByDoc, [input.docPath]: toMessage(error) } }));
      return null;
    }
  },

  update: async (docPath, id, patch) => {
    try {
      const annotation = await window.api.annotations.update(id, patch);
      set((state) => ({
        itemsByDoc: {
          ...state.itemsByDoc,
          [docPath]: (state.itemsByDoc[docPath] ?? []).map((item) =>
            item.id === id ? annotation : item
          )
        },
        errorByDoc: { ...state.errorByDoc, [docPath]: null }
      }));
    } catch (error) {
      set((state) => ({ errorByDoc: { ...state.errorByDoc, [docPath]: toMessage(error) } }));
    }
  },

  remove: async (docPath, id) => {
    try {
      await window.api.annotations.remove(id);
      set((state) => ({
        itemsByDoc: {
          ...state.itemsByDoc,
          [docPath]: (state.itemsByDoc[docPath] ?? []).filter((item) => item.id !== id)
        },
        activeId: state.activeId === id ? null : state.activeId,
        popoverId: state.popoverId === id ? null : state.popoverId,
        errorByDoc: { ...state.errorByDoc, [docPath]: null }
      }));
    } catch (error) {
      set((state) => ({ errorByDoc: { ...state.errorByDoc, [docPath]: toMessage(error) } }));
    }
  },

  setActive: (id) => set({ activeId: id }),
  setPopover: (id) => set({ popoverId: id }),
  clearForDoc: (_docPath) => set({ activeId: null, popoverId: null })
}));
