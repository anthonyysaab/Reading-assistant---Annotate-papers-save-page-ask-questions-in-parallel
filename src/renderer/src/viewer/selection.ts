/**
 * Selection API exposed by the viewer workstream for `03-annotations`.
 *
 * A viewer publishes the current document selection as a `DocSelection`: PDF rects are
 * NORMALIZED 0..1 against the rendered page box (zoom/rotation safe, matching
 * `docs/interfaces.md` §1.3 `Anchor`), text selections carry only quoted text. Consumers
 * subscribe with `onSelection`; a viewer registers a `SelectionTarget` so consumers can
 * programmatically scroll a page into view (rectsToClientRects style overlay mapping).
 */

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DocSelection {
  docId: string;
  docPath: string;
  kind: "pdf" | "text";
  /** 1-based page for PDFs, 0 for non-paginated text. */
  page: number;
  /** PDF: rects normalized to the page box. Text: always empty. */
  rects: NormalizedRect[];
  /** The selected text, if the platform exposes it. */
  text: string;
}

export interface SelectionTarget {
  /** Scroll the given page into view and return the client rects of `rects`. */
  scrollTo(page: number, rects: NormalizedRect[]): void;
}

type SelectionListener = (selection: DocSelection | null) => void;

const listeners = new Set<SelectionListener>();
const targets = new Map<string, SelectionTarget>();
let current: DocSelection | null = null;

export function onSelection(listener: SelectionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSelection(): DocSelection | null {
  return current;
}

export function emitSelection(selection: DocSelection | null): void {
  current = selection;
  for (const listener of listeners) listener(selection);
}

export function clearSelectionForDoc(docId: string): void {
  if (current?.docId === docId) emitSelection(null);
}

export function registerSelectionTarget(docId: string, target: SelectionTarget): () => void {
  targets.set(docId, target);
  return () => {
    if (targets.get(docId) === target) targets.delete(docId);
  };
}

export function revealSelection(selection: DocSelection): boolean {
  const target = targets.get(selection.docId);
  if (!target) return false;
  target.scrollTo(selection.page, selection.rects);
  return true;
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Find the rendered PDF page element inside a viewer container (`data-page` is 1-based). */
export function pageElementFor(container: ParentNode, page: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`.ra-pdf-page[data-page="${page}"]`);
}

/** Map normalized page rects back to viewport client rects (for overlay/drawing). */
export function normalizedRectsToClient(pageElement: HTMLElement, rects: NormalizedRect[]): DOMRect[] {
  const pageRect = pageElement.getBoundingClientRect();
  return rects.map(
    (rect) =>
      new DOMRect(
        pageRect.left + rect.x * pageRect.width,
        pageRect.top + rect.y * pageRect.height,
        rect.w * pageRect.width,
        rect.h * pageRect.height
      )
  );
}
