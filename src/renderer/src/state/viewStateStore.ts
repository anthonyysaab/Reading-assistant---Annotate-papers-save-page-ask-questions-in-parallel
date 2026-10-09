import { create } from "zustand";
import type { SessionPosition } from "@shared/types";

interface ViewStateStore {
  positions: Record<string, SessionPosition>;
  setPosition: (path: string, position: SessionPosition) => void;
}

export const useViewStateStore = create<ViewStateStore>((set, get) => ({
  positions: {},

  setPosition: (path, position) => {
    const current = get().positions[path];
    if (
      current &&
      current.page === position.page &&
      current.position === position.position
    ) {
      return;
    }
    set((state) => ({ positions: { ...state.positions, [path]: position } }));
  }
}));
