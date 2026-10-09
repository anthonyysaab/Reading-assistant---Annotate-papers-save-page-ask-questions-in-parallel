import { useEffect } from "react";
import { ModelPicker } from "@renderer/chat/ModelPicker";
import { Transcript } from "@renderer/chat/Transcript";
import { EmptyState } from "@renderer/components/EmptyState";
import { Icon } from "@renderer/components/Icon";
import { selectActiveDoc, useAppStore } from "@renderer/state/appStore";
import { useChatStore } from "@renderer/state/chatStore";
import { useSearchStore } from "@renderer/state/searchStore";
import { toast } from "@renderer/state/toastStore";

const EMPTY: string[] = [];

export function ChatTab() {
  const doc = useAppStore(selectActiveDoc);
  const docId = doc?.id;
  const hydrate = useChatStore((state) => state.hydrate);
  const ensureActiveThread = useChatStore((state) => state.ensureActiveThread);
  const newThread = useChatStore((state) => state.newThread);
  const setActiveThread = useChatStore((state) => state.setActiveThread);
  const renameThread = useChatStore((state) => state.renameThread);
  const deleteThread = useChatStore((state) => state.deleteThread);
  const exportThread = useChatStore((state) => state.exportThread);
  const threadIds = useChatStore((state) => (docId ? (state.threadIdsByDoc[docId] ?? EMPTY) : EMPTY));
  const threads = useChatStore((state) => state.threads);
  const activeThreadId = useChatStore((state) => (docId ? state.activeThreadByDoc[docId] : undefined));
  const attachedCount = useSearchStore((state) => (docId ? (state.attachedByDoc[docId]?.length ?? 0) : 0));
  const detachWeb = useSearchStore((state) => state.detach);

  useEffect(() => {
    if (!docId) return;
    void hydrate(docId).then(() => ensureActiveThread(docId));
  }, [docId, hydrate, ensureActiveThread]);

  if (!doc) {
    return <EmptyState title="No document open" hint="Open a file to start a grounded conversation." />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="truncate text-xs font-medium text-text" title={doc.ref.name}>
          {doc.ref.name}
        </span>
        <div className="flex items-center gap-1">
          {threadIds.length > 1 ? (
            <select
              value={activeThreadId ?? ""}
              onChange={(event) => setActiveThread(doc.id, event.target.value)}
              className="max-w-[120px] rounded border border-border bg-panel px-1.5 py-1 text-[11px] text-text-weak"
              title="Switch thread"
            >
              {threadIds.map((id) => (
                <option key={id} value={id}>
                  {threads[id]?.title ?? "Chat"}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            disabled={!activeThreadId}
            onClick={() => {
              if (!activeThreadId) return;
              const current = threads[activeThreadId]?.title ?? "";
              const title = window.prompt("Rename thread", current);
              if (title !== null) renameThread(doc.id, activeThreadId, title);
            }}
            className="rounded border border-border px-1.5 py-1 text-text-weak hover:text-text disabled:opacity-40"
            title="Rename thread"
          >
            <Icon name="annotations" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!activeThreadId}
            onClick={() => {
              if (!activeThreadId) return;
              void exportThread(doc.id, activeThreadId).then((path) => {
                if (path) toast.success(`Exported thread to ${path}`);
              });
            }}
            className="rounded border border-border px-1.5 py-1 text-text-weak hover:text-text disabled:opacity-40"
            title="Export thread to Markdown"
          >
            <Icon name="download" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!activeThreadId}
            onClick={() => {
              if (!activeThreadId) return;
              if (window.confirm("Delete this thread?")) deleteThread(doc.id, activeThreadId);
            }}
            className="rounded border border-border px-1.5 py-1 text-text-weak hover:text-red-300 disabled:opacity-40"
            title="Delete thread"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
          <ModelPicker />
          <button
            type="button"
            onClick={() => newThread(doc.id)}
            className="rounded border border-border px-2 py-1 text-[11px] text-text-weak hover:text-text"
            title="New thread"
          >
            +
          </button>
        </div>
      </div>
      {attachedCount > 0 ? (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-subtle px-3 py-1.5 text-[11px] text-text-weak">
          <span>{attachedCount} web result(s) attached to this chat.</span>
          <button
            type="button"
            onClick={() => detachWeb(doc.id)}
            className="rounded border border-border px-1.5 py-0.5 hover:text-text"
          >
            Detach
          </button>
        </div>
      ) : null}
      <Transcript docId={doc.id} docPath={doc.ref.path} />
    </div>
  );
}
