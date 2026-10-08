import { useState } from "react";
import { Icon } from "@renderer/components/Icon";
import { useAppStore } from "@renderer/state/appStore";

export function DocTabs() {
  const docs = useAppStore((state) => state.docs);
  const activeDocId = useAppStore((state) => state.activeDocId);
  const setActiveDoc = useAppStore((state) => state.setActiveDoc);
  const closeDoc = useAppStore((state) => state.closeDoc);
  const moveDoc = useAppStore((state) => state.moveDoc);
  const [dragId, setDragId] = useState<string | null>(null);

  if (docs.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto border-b border-border bg-bg-subtle px-2 py-1"
      onDragOver={(event) => {
        if (dragId) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (dragId) moveDoc(dragId, docs.length);
        setDragId(null);
      }}
    >
      {docs.map((doc, index) => (
        <div
          key={doc.id}
          draggable
          onDragStart={(event) => {
            setDragId(doc.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => setDragId(null)}
          onDragOver={(event) => {
            if (dragId && dragId !== doc.id) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (dragId && dragId !== doc.id) moveDoc(dragId, index);
            setDragId(null);
          }}
          className={`group flex max-w-[200px] shrink-0 items-center gap-1 rounded px-2 py-1 ${
            doc.id === activeDocId ? "bg-panel text-text" : "text-text-weak hover:bg-panel"
          } ${dragId === doc.id ? "opacity-60" : ""}`}
        >
          <button
            type="button"
            onClick={() => setActiveDoc(doc.id)}
            className="flex min-w-0 items-center gap-2"
            title={doc.ref.path}
          >
            <Icon name="file" className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate text-xs">{doc.ref.name}</span>
            {doc.dirty ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Unsaved changes" />
            ) : null}
          </button>
          <button
            type="button"
            title="Close"
            onClick={() => closeDoc(doc.id)}
            className="rounded p-0.5 opacity-0 hover:text-text group-hover:opacity-100"
          >
            <Icon name="close" className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
