import { IPC } from "@shared/channels";
import { checkHealth } from "@main/health";
import { handle } from "./registry";

export function registerHealthIpc(): void {
  handle(IPC.health.check, async () => checkHealth());
}
