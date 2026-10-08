import { useAppStore } from "@renderer/state/appStore";
import { useSettingsStore } from "@renderer/state/settingsStore";

export async function openViaDialog(): Promise<void> {
  const ref = await window.api.file.openDialog();
  if (!ref) return;
  useAppStore.getState().openFile(ref);
  await useSettingsStore.getState().load();
}

export async function openPath(path: string): Promise<void> {
  try {
    const ref = await window.api.file.ref(path);
    useAppStore.getState().openFile(ref);
    await useSettingsStore.getState().load();
  } catch (error) {
    console.error("Failed to open path", path, error);
  }
}
