import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openSearchPanel, search } from "@codemirror/search";
import type { ViewUpdate } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Icon } from "@renderer/components/Icon";
import { formatBytes } from "@renderer/lib/format";
import { useAppStore } from "@renderer/state/appStore";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { languageForExt } from "./languages";
import type { RendererViewProps } from "./registry";
import { clearSelectionForDoc, emitSelection } from "./selection";

type Status = "loading" | "ready" | "error" | "too-large";

const MAX_TEXT_BYTES = 8 * 1024 * 1024;

export function TextViewer({ ref, docId }: RendererViewProps) {
  const editorRef = useRef<ReactCodeMirrorRef | null>(null);
  const savedRef = useRef("");
  const dirtyRef = useRef(false);

  const [value, setValue] = useState<string | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<"changed" | "unlinked" | null>(null);

  const lastFileEvent = useAppStore((state) => state.lastFileEvent);
  const setDocDirty = useAppStore((state) => state.setDocDirty);
  const setSelection = useAppStore((state) => state.setSelection);
  const themePref = useSettingsStore((state) => state.settings?.ui.theme ?? "dark");

  const markDirty = useCallback(
    (next: boolean) => {
      if (dirtyRef.current === next) return;
      dirtyRef.current = next;
      setDirtyState(next);
      setDocDirty(docId, next);
    },
    [docId, setDocDirty]
  );

  const load = useCallback(async () => {
    if (ref.size > MAX_TEXT_BYTES) {
      setStatus("too-large");
      return;
    }
    setStatus("loading");
    try {
      const text = await window.api.file.readText(ref.path);
      savedRef.current = text;
      setValue(text);
      markDirty(false);
      setNotice(null);
      setError(null);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setStatus("error");
    }
  }, [ref.path, ref.size, markDirty]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => clearSelectionForDoc(docId), [docId]);

  useEffect(() => {
    if (!lastFileEvent || lastFileEvent.path !== ref.path) return;
    if (lastFileEvent.type === "unlink") {
      setNotice("unlinked");
      return;
    }
    if (dirtyRef.current) setNotice("changed");
    else void load();
  }, [lastFileEvent, ref.path, load]);

  const save = useCallback(async () => {
    if (value === null) return;
    try {
      await window.api.file.writeText(ref.path, value);
      savedRef.current = value;
      markDirty(false);
      setError(null);
      setNotice(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  }, [value, ref.path, markDirty]);

  useEffect(() => {
    const onSave = () => void save();
    const onFind = () => {
      const view = editorRef.current?.view;
      if (view) openSearchPanel(view);
    };
    window.addEventListener("ra:save", onSave);
    window.addEventListener("ra:find", onFind);
    return () => {
      window.removeEventListener("ra:save", onSave);
      window.removeEventListener("ra:find", onFind);
    };
  }, [save]);

  const language = useMemo(() => languageForExt(ref.ext), [ref.ext]);
  const extensions = useMemo(() => (language ? [language, search({ top: true })] : [search({ top: true })]), [language]);

  const onChange = useCallback(
    (next: string) => {
      setValue(next);
      markDirty(next !== savedRef.current);
    },
    [markDirty]
  );

  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      if (!update.selectionSet && !update.docChanged) return;
      const main = update.state.selection.main;
      const text = main.empty ? "" : update.state.sliceDoc(main.from, main.to);
      if (!text) {
        emitSelection(null);
        setSelection(null);
      } else {
        emitSelection({ docId, docPath: ref.path, kind: "text", page: 0, rects: [], text });
        setSelection(text);
      }
    },
    [docId, ref.path, setSelection]
  );

  if (status === "too-large") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
        <Icon name="file" className="h-8 w-8 text-text-weak" />
        <p className="text-sm text-text">File too large to edit inline</p>
        <p className="max-w-sm text-xs text-text-weak">
          {ref.name} is {formatBytes(ref.size)}. The editor caps inline text at {formatBytes(MAX_TEXT_BYTES)} to stay
          responsive. Open it in your default app instead.
        </p>
        <button
          type="button"
          onClick={() => void window.api.file.openExternal(ref.path)}
          className="rounded border border-border bg-panel px-3 py-1.5 text-xs text-text hover:bg-bg-subtle"
        >
          Open in default app
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
        <Icon name="file" className="h-8 w-8 text-text-weak" />
        <p className="text-sm text-text">Could not read this file as text</p>
        <p className="max-w-sm break-words text-xs text-text-weak">{error}</p>
        <button
          type="button"
          onClick={() => void window.api.file.openExternal(ref.path)}
          className="rounded border border-border bg-panel px-3 py-1.5 text-xs text-text hover:bg-bg-subtle"
        >
          Open in default app
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex items-center gap-2 border-b border-border bg-bg-subtle px-3 py-1 text-xs text-text-weak">
        <span className="truncate" title={ref.path}>
          {ref.name}
        </span>
        {dirty ? <span className="text-accent">• unsaved</span> : null}
        <span className="flex-1" />
        {error ? <span className="text-anno-pink">{error}</span> : null}
        <button
          type="button"
          onClick={() => void save()}
          className="rounded border border-border px-2 py-0.5 hover:bg-panel hover:text-text"
        >
          Save (Ctrl+S)
        </button>
      </div>

      {notice ? (
        <div className="flex items-center gap-2 border-b border-border bg-panel px-3 py-1 text-xs text-text-weak">
          <span>
            {notice === "unlinked"
              ? "This file was deleted on disk."
              : "This file changed on disk while you have unsaved edits."}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-border px-2 py-0.5 hover:bg-bg-subtle hover:text-text"
          >
            Reload from disk
          </button>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded border border-border px-2 py-0.5 hover:bg-bg-subtle hover:text-text"
          >
            Keep edits
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {status === "loading" || value === null ? (
          <div className="flex h-full items-center justify-center text-xs text-text-weak">Loading text…</div>
        ) : (
          <CodeMirror
            ref={editorRef}
            value={value}
            height="100%"
            theme={themePref === "light" ? "light" : "dark"}
            extensions={extensions}
            onChange={onChange}
            onUpdate={onUpdate}
            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, tabSize: 2 }}
          />
        )}
      </div>
    </div>
  );
}
