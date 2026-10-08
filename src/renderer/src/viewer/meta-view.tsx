import { useEffect, useState } from "react";
import { Icon } from "@renderer/components/Icon";
import { formatBytes, shortPath } from "@renderer/lib/format";
import type { RendererViewProps } from "./registry";

type HashState = "idle" | "hashing" | "done" | "error" | "skipped";

const HASH_LIMIT_BYTES = 256 * 1024 * 1024;

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export function MetaView({ ref }: RendererViewProps) {
  const [hash, setHash] = useState<string | null>(null);
  const [hashState, setHashState] = useState<HashState>("idle");

  useEffect(() => {
    let active = true;
    setHash(null);
    if (ref.size > HASH_LIMIT_BYTES) {
      setHashState("skipped");
      return;
    }
    setHashState("hashing");
    void (async () => {
      try {
        const bytes = await window.api.file.readBytes(ref.path);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        if (active) {
          setHash(`sha256:${toHex(digest)}`);
          setHashState("done");
        }
      } catch {
        if (active) setHashState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [ref.path, ref.size]);

  const hashText =
    hashState === "hashing"
      ? "computing…"
      : hashState === "skipped"
        ? "skipped (file too large)"
        : hashState === "error"
          ? "unavailable"
          : (hash ?? "…");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 overflow-auto bg-bg px-8">
      <Icon name="file" className="h-10 w-10 text-text-weak" />
      <p className="max-w-full truncate text-lg font-medium text-text" title={ref.name}>
        {ref.name}
      </p>
      <dl className="grid max-w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs text-text-weak">
        <dt>Name</dt>
        <dd className="truncate text-text" title={ref.name}>
          {ref.name}
        </dd>
        <dt>Type</dt>
        <dd className="text-text">{ref.mime}</dd>
        <dt>Size</dt>
        <dd className="text-text">{formatBytes(ref.size)}</dd>
        <dt>Path</dt>
        <dd className="truncate text-text" title={ref.path}>
          {shortPath(ref.path)}
        </dd>
        <dt>SHA-256</dt>
        <dd className="break-all font-mono text-[11px] text-text">{hashText}</dd>
      </dl>
      <p className="mt-2 max-w-sm text-center text-xs text-text-weak">
        No built-in viewer for this type. It is not modified by the app.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void window.api.file.revealInExplorer(ref.path)}
          className="rounded border border-border px-3 py-1.5 text-xs text-text hover:bg-panel"
        >
          Reveal in Explorer
        </button>
        <button
          type="button"
          onClick={() => void window.api.file.openExternal(ref.path)}
          className="rounded border border-border bg-panel px-3 py-1.5 text-xs text-text hover:bg-bg-subtle"
        >
          Open in default app
        </button>
      </div>
    </div>
  );
}
