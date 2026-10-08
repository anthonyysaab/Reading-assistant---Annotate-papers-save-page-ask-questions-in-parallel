import { useCallback, useEffect, useState } from "react";
import type { IndexStatus } from "@shared/types";

export interface IndexProgress {
  done: number;
  total: number;
  phase: string;
}

export interface IndexStatusView {
  status: IndexStatus | null;
  progress: IndexProgress | null;
  refresh: () => void;
}

const IDLE: Omit<IndexStatus, "docPath"> = { state: "none", chunks: 0, dim: 0, embedModel: "" };

export function useIndexStatus(docPath: string | null): IndexStatusView {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [progress, setProgress] = useState<IndexProgress | null>(null);

  const refresh = useCallback(() => {
    if (!docPath) {
      setStatus(null);
      setProgress(null);
      return;
    }
    void window.api.rag
      .status(docPath)
      .then((result) => setStatus(result))
      .catch(() => setStatus({ docPath, ...IDLE }));
  }, [docPath]);

  useEffect(() => {
    refresh();
    if (!docPath) return;
    const off = window.api.events.onIndexProgress((event) => {
      if (event.docPath !== docPath) return;
      if (event.phase === "ready" || event.phase === "error") {
        setProgress(null);
        refresh();
        return;
      }
      setProgress({ done: event.done, total: event.total, phase: event.phase });
      setStatus((current) => ({
        docPath: event.docPath,
        state: "indexing",
        chunks: current?.chunks ?? 0,
        dim: current?.dim ?? 0,
        embedModel: current?.embedModel ?? ""
      }));
    });
    return off;
  }, [docPath, refresh]);

  return { status, progress, refresh };
}
