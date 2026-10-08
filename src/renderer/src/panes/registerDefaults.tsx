import { AnnotationsTab } from "./AnnotationsTab";
import { ChatTab } from "./ChatTab";
import { ContextTab } from "./ContextTab";
import { registerSidePanelTab } from "./sidePanelRegistry";

let registered = false;

export function registerDefaultSidePanelTabs(): void {
  if (registered) return;
  registered = true;
  registerSidePanelTab({ id: "chat", label: "Chat", order: 0, render: () => <ChatTab /> });
  registerSidePanelTab({ id: "annotations", label: "Annotations", order: 1, render: () => <AnnotationsTab /> });
  registerSidePanelTab({ id: "context", label: "Context", order: 2, render: () => <ContextTab /> });
}
