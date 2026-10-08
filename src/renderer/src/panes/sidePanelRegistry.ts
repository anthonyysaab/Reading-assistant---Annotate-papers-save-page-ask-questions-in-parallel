import type { ReactNode } from "react";
import type { PanelTab } from "@shared/types";

export interface SidePanelTabDef {
  id: PanelTab;
  label: string;
  order: number;
  render: () => ReactNode;
}

const tabs = new Map<PanelTab, SidePanelTabDef>();

// Seam for 02/03/04: call registerSidePanelTab to replace a placeholder tab body
// (same id overwrites) or add a new one. Tab order is the `order` field.
export function registerSidePanelTab(def: SidePanelTabDef): void {
  tabs.set(def.id, def);
}

export function getSidePanelTab(id: PanelTab): SidePanelTabDef | undefined {
  return tabs.get(id);
}

export function listSidePanelTabs(): SidePanelTabDef[] {
  return [...tabs.values()].sort((a, b) => a.order - b.order);
}
