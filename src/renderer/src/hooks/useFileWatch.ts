import { useEffect } from "react";
import type { OpenDoc } from "@shared/types";
import { useAppStore } from "@renderer/state/appStore";

export function useFileWatch(doc: OpenDoc | null): void {
  const path = doc?.ref.path ?? null;

  useEffect(() => {
    if (!path) return;
    return window.api.file.watch(path, (event) => {
      useAppStore.getState().setFileEvent({ path, type: event.type });
    });
  }, [path]);
}
