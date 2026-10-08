import type { ComponentType } from "react";
import type { FileRef } from "@shared/types";

export interface RendererViewProps {
  ref: FileRef;
  docId: string;
}

export interface FileRenderer {
  id: string;
  match(ref: FileRef): boolean;
  load(): Promise<ComponentType<RendererViewProps>>;
}

const renderers: FileRenderer[] = [];

// A renderer that matches this empty ref matches anything, i.e. it is the fallback.
const ANY_REF: FileRef = { path: "", name: "", ext: "", mime: "", size: 0 };

function isFallback(renderer: FileRenderer): boolean {
  return renderer.match(ANY_REF);
}

// Seam for 01-viewers: register PDF / text / image / fallback renderers here. When several
// renderers match, the last registration wins.
export function registerFileRenderer(renderer: FileRenderer): void {
  renderers.push(renderer);
}

export function listFileRenderers(): readonly FileRenderer[] {
  return renderers;
}

// Priority: exact-mime -> extension -> fallback. We probe each renderer with the mime kept
// (ext blanked) and with the ext kept (mime blanked) so mime matches outrank extension
// matches; the universal fallback is excluded from both specific passes and used last.
export function resolveFileRenderer(ref: FileRef): FileRenderer | null {
  const mimeOnly: FileRef = { ...ref, ext: "" };
  const extOnly: FileRef = { ...ref, mime: "" };

  for (let index = renderers.length - 1; index >= 0; index -= 1) {
    const renderer = renderers[index];
    if (renderer && !isFallback(renderer) && renderer.match(mimeOnly)) return renderer;
  }

  for (let index = renderers.length - 1; index >= 0; index -= 1) {
    const renderer = renderers[index];
    if (renderer && !isFallback(renderer) && renderer.match(extOnly)) return renderer;
  }

  for (let index = renderers.length - 1; index >= 0; index -= 1) {
    const renderer = renderers[index];
    if (renderer && renderer.match(ref)) return renderer;
  }

  return null;
}
