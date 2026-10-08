import { useEffect, useRef, useState } from "react";
import { Icon } from "@renderer/components/Icon";
import { requestReindex } from "@renderer/lib/commands";
import { selectActiveDoc, useAppStore } from "@renderer/state/appStore";
import { selectIsStreaming, useChatStore } from "@renderer/state/chatStore";
import { useSettingsStore } from "@renderer/state/settingsStore";

const SLASH_COMMANDS = ["/index", "/reindex", "/clear", "/new", "/export", "/settings"];

export function Composer() {
  const doc = useAppStore(selectActiveDoc);
  const selection = useAppStore((state) => state.selection);
  const setSelection = useAppStore((state) => state.setSelection);
  const providerId = useSettingsStore((state) => state.settings?.activeProviderId ?? "unset");
  const model = useSettingsStore((state) => state.settings?.activeChatModel ?? "");
  const send = useChatStore((state) => state.send);
  const abort = useChatStore((state) => state.abort);
  const streaming = useChatStore((state) => (doc ? selectIsStreaming(state, doc.id) : false));
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const disabled = !doc;

  useEffect(() => {
    const onSend = () => {
      const value = textareaRef.current?.value.trim();
      if (!value || disabled || streaming || !doc) return;
      setText("");
      if (value.startsWith("/")) {
        const command = value.slice(1).trim().split(/\s+/)[0] ?? "";
        switch (command) {
          case "clear":
            useChatStore.getState().clearActiveThread(doc.id);
            break;
          case "new":
            useChatStore.getState().newThread(doc.id);
            break;
          case "reindex":
            void requestReindex();
            break;
          case "index":
            void window.api.rag.index(doc.ref.path).catch(() => undefined);
            break;
          default:
            break;
        }
        return;
      }
      void send(doc.id, doc.ref.path, value, selection);
    };
    window.addEventListener("ra:composer-send", onSend);
    return () => window.removeEventListener("ra:composer-send", onSend);
  }, [disabled, streaming, doc, selection, send]);

  return (
    <div className="border-t border-border bg-bg-subtle px-3 py-2">
      {selection ? (
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex max-w-[280px] items-center gap-1 rounded bg-panel px-2 py-0.5 text-[11px] text-text-weak">
            <Icon name="annotations" className="h-3 w-3" />
            <span className="truncate">selection: {selection}</span>
            <button type="button" onClick={() => setSelection(null)} className="hover:text-text">
              <Icon name="close" className="h-3 w-3" />
            </button>
          </span>
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-md border border-border bg-panel px-2 py-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              window.dispatchEvent(new CustomEvent("ra:composer-send"));
            }
          }}
          rows={1}
          placeholder={disabled ? "Open a document to ask questions" : "Ask about this document…  Enter to send, Shift+Enter for newline"}
          className="max-h-40 min-h-[28px] flex-1 resize-none bg-transparent text-sm text-text outline-none placeholder:text-text-weak disabled:cursor-not-allowed"
        />
        {streaming && doc ? (
          <button
            type="button"
            onClick={() => abort(doc.id)}
            className="rounded p-1 text-text-weak hover:text-text"
            title="Stop generating"
          >
            <Icon name="close" />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => window.dispatchEvent(new CustomEvent("ra:composer-send"))}
            className="rounded p-1 text-text-weak hover:text-text disabled:opacity-40"
            title="Send (Ctrl+Enter)"
          >
            <Icon name="send" />
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-weak">
        <span>{SLASH_COMMANDS.join("  ")}</span>
        <span>
          {streaming ? "generating… · " : ""}
          {providerId}
          {model ? ` · ${model}` : ""}
        </span>
      </div>
    </div>
  );
}
