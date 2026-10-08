import { basename } from "@shared/mime";
import { Icon } from "@renderer/components/Icon";
import { openPath, openViaDialog } from "@renderer/lib/openFiles";
import { openSettings } from "@renderer/lib/commands";
import { useAppStore } from "@renderer/state/appStore";
import { useSettingsStore } from "@renderer/state/settingsStore";

export function LibrarySidebar() {
  const docs = useAppStore((state) => state.docs);
  const activeDocId = useAppStore((state) => state.activeDocId);
  const setActiveDoc = useAppStore((state) => state.setActiveDoc);
  const closeDoc = useAppStore((state) => state.closeDoc);
  const recentFiles = useSettingsStore((state) => state.settings?.recentFiles ?? []);
  const patch = useSettingsStore((state) => state.patch);
  const openPaths = new Set(docs.map((doc) => doc.ref.path));
  const visibleRecent = recentFiles.filter((path) => !openPaths.has(path));

  const removeRecent = (path: string): void => {
    void patch({ recentFiles: recentFiles.filter((entry) => entry !== path) });
  };

  const clearRecent = (): void => {
    if (recentFiles.length === 0) return;
    void patch({ recentFiles: [] });
  };

  return (
    <aside className="flex h-full flex-col border-r border-border bg-bg-subtle">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-weak">Library</span>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => void openViaDialog()}
          className="flex w-full items-center gap-2 rounded border border-border px-2 py-1.5 text-xs text-text hover:bg-panel"
          title="Open file (Ctrl+O)"
        >
          <Icon name="folder" />
          Open file…
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        <p className="px-1 py-1 text-[11px] uppercase tracking-wide text-text-weak">Open</p>
        {docs.length === 0 ? (
          <p className="px-1 py-1 text-xs text-text-weak">No open documents</p>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className={`group flex items-center gap-1 rounded px-1 py-1 ${
                doc.id === activeDocId ? "bg-panel text-text" : "text-text-weak hover:bg-panel"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveDoc(doc.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Icon name="file" className="shrink-0 opacity-70" />
                <span className="truncate text-xs">{doc.ref.name}</span>
                {doc.dirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
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
          ))
        )}

        <div className="mt-3 flex items-center justify-between px-1 py-1">
          <span className="text-[11px] uppercase tracking-wide text-text-weak">Recent</span>
          {recentFiles.length > 0 ? (
            <button
              type="button"
              onClick={clearRecent}
              className="text-[10px] text-text-weak hover:text-text"
              title="Clear recent files"
            >
              Clear
            </button>
          ) : null}
        </div>
        {visibleRecent.length === 0 ? (
          <p className="px-1 py-1 text-xs text-text-weak">Nothing yet</p>
        ) : (
          visibleRecent.map((path) => (
            <div
              key={path}
              className="group flex items-center gap-1 rounded px-1 py-1 text-text-weak hover:bg-panel hover:text-text"
            >
              <button
                type="button"
                title={path}
                onClick={() => void openPath(path)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Icon name="file" className="shrink-0 opacity-70" />
                <span className="truncate text-xs">{basename(path)}</span>
              </button>
              <button
                type="button"
                title="Remove from recent"
                onClick={() => removeRecent(path)}
                className="rounded p-0.5 opacity-0 hover:text-text group-hover:opacity-100"
              >
                <Icon name="close" className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={openSettings}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-text-weak hover:bg-panel hover:text-text"
          title="Settings (Ctrl+,)"
        >
          <Icon name="settings" />
          Settings
        </button>
      </div>
    </aside>
  );
}
