import { AnnotationsTab } from "./AnnotationsTab";
import { BookmarksTab } from "./BookmarksTab";
import { ChatTab } from "./ChatTab";
import { ContextTab } from "./ContextTab";
import { SearchTab } from "./SearchTab";
import { registerSidePanelTab } from "./sidePanelRegistry";

let registered = false;

export function registerDefaultSidePanelTabs(): void {
  if (registered) return;
  registered = true;
  registerSidePanelTab({ id: "chat", label: "Chat", order: 0, render: () => <ChatTab /> });
  registerSidePanelTab({ id: "annotations", label: "Annotations", order: 1, render: () => <AnnotationsTab /> });
  registerSidePanelTab({ id: "bookmarks", label: "Bookmarks", order: 2, render: () => <BookmarksTab /> });
  registerSidePanelTab({ id: "context", label: "Context", order: 3, render: () => <ContextTab /> });
  registerSidePanelTab({ id: "search", label: "Search", order: 4, render: () => <SearchTab /> });
}
