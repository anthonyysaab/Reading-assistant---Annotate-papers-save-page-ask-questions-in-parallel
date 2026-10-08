import { useEffect } from "react";
import { useAppStore } from "@renderer/state/appStore";

export function useFileEvents(): void {
  useEffect(() => {
    return window.api.events.onFileChanged((event) => {
      useAppStore.getState().setFileEvent(event);
    });
  }, []);
}
