import type { Citation } from "@shared/types";
import { revealSelection } from "@renderer/viewer/selection";

export const CITATION_JUMP_EVENT = "ra:jump-citation";

export interface CitationJumpDetail {
  docId: string;
  docPath: string;
  citation: Citation;
}

/** Any component (e.g. the chat transcript) can request a jump by dispatching this event. */
export function requestCitationJump(detail: CitationJumpDetail): void {
  window.dispatchEvent(new CustomEvent<CitationJumpDetail>(CITATION_JUMP_EVENT, { detail }));
}

/**
 * Reuse 01's selection API to scroll the viewer to a citation's page. The PDF viewer registers a
 * `SelectionTarget` whose `scrollTo(page)` navigates; text/fallback docs simply no-op.
 */
export function jumpToCitation(docId: string, docPath: string, citation: Citation): boolean {
  if (citation.page === undefined) return false;
  return revealSelection({ docId, docPath, kind: "pdf", page: citation.page, rects: [], text: "" });
}

let installed = false;

/** Install the global `ra:jump-citation` listener. Returns an uninstaller for effect cleanup. */
export function installCitationJumpListener(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<CitationJumpDetail>).detail;
    if (!detail?.citation) return;
    jumpToCitation(detail.docId, detail.docPath, detail.citation);
  };
  window.addEventListener(CITATION_JUMP_EVENT, handler);
  return () => {
    window.removeEventListener(CITATION_JUMP_EVENT, handler);
    installed = false;
  };
}
