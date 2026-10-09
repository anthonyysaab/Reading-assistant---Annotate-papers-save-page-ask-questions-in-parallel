import { create } from "zustand";
import type { UpdateInfo } from "@shared/types";

interface UpdateState {
  info: UpdateInfo | null;
  checking: boolean;
  installing: boolean;
  error: string | null;
  check: () => Promise<void>;
  install: () => Promise<void>;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  info: null,
  checking: false,
  installing: false,
  error: null,

  check: async () => {
    if (get().checking) return;
    set({ checking: true });
    try {
      const info = await window.api.update.check();
      set({ info, checking: false, error: null });
    } catch (error) {
      set({ checking: false, error: error instanceof Error ? error.message : String(error) });
    }
  },

  install: async () => {
    if (get().installing) return;
    set({ installing: true, error: null });
    try {
      await window.api.update.install();
      set({ installing: false });
    } catch (error) {
      set({ installing: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
}));
