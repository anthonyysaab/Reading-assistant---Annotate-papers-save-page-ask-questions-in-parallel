import { useEffect, useState } from "react";
import type { HealthReport } from "@shared/types";
import { basename } from "@shared/mime";
import { useIndexStatus } from "@renderer/context/useIndexStatus";
import { openSettings } from "@renderer/lib/commands";
import { selectActiveDoc, useAppStore } from "@renderer/state/appStore";
import { useSettingsStore } from "@renderer/state/settingsStore";

const HEALTH_DOT: Record<string, string> = {
  ok: "bg-anno-green",
  degraded: "bg-anno-yellow",
  down: "bg-red-400",
  unconfigured: "bg-text-weak"
};

function indexLabel(state: string | undefined): string {
  switch (state) {
    case "indexing":
      return "Index: indexing…";
    case "ready":
      return "Index: ready";
    case "error":
      return "Index: error";
    default:
      return "Index: not indexed";
  }
}

export function StatusBar() {
  const lastFileEvent = useAppStore((state) => state.lastFileEvent);
  const doc = useAppStore(selectActiveDoc);
  const providerId = useSettingsStore((state) => state.settings?.activeProviderId ?? "unset");
  const model = useSettingsStore((state) => state.settings?.activeChatModel ?? "");
  const embeddingProviderId = useSettingsStore((state) => state.settings?.activeEmbeddingProviderId ?? "");
  const { status } = useIndexStatus(doc?.ref.path ?? null);
  const [health, setHealth] = useState<HealthReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api.health
      .check()
      .then((report) => {
        if (!cancelled) setHealth(report);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [providerId, embeddingProviderId]);

  return (
    <footer className="flex items-center justify-between gap-3 border-t border-border bg-bg-subtle px-3 py-1 text-[11px] text-text-weak">
      <span className="min-w-0 truncate">
        {lastFileEvent
          ? `${basename(lastFileEvent.path)} ${lastFileEvent.type === "unlink" ? "removed" : "changed"} on disk`
          : "Ready"}
      </span>
      <button
        type="button"
        onClick={openSettings}
        className="flex shrink-0 items-center gap-1.5 hover:text-text"
        title="Open health/settings"
      >
        <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[health?.chat.state ?? "unconfigured"]}`} />
        <span>{indexLabel(status?.state)}</span>
      </button>
      <span className="flex shrink-0 items-center gap-1">
        {health && health.embedding.state !== "ok" ? (
          <span className="text-anno-yellow" title={health.embedding.remediation ?? health.embedding.detail}>
            embeddings: {health.embedding.state}
          </span>
        ) : null}
        {providerId}
        {model ? ` · ${model}` : ""}
      </span>
    </footer>
  );
}
