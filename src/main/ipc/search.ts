import { IPC } from "@shared/channels";
import { searchWeb } from "@main/search/brave";
import { handle } from "./registry";

export function registerSearchIpc(): void {
  handle(IPC.search.query, async (query: unknown) => searchWeb(String(query)));
}
