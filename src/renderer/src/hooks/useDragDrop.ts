import { useEffect } from "react";
import { openPath } from "@renderer/lib/openFiles";

export function useDragDrop(): void {
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const paths: string[] = [];
      for (const file of Array.from(files)) {
        try {
          paths.push(window.desktop.getPathForFile(file));
        } catch {
          // webUtils throws for non-file drags; ignore those entries.
        }
      }
      for (const path of paths) void openPath(path);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
}
