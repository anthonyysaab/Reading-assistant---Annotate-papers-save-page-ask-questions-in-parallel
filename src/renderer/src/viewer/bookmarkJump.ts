import type { Bookmark, OpenDoc } from "@shared/types";
import { revealSelection } from "./selection";

export const BOOKMARK_JUMP_EVENT = "ra:jump-bookmark";

export interface BookmarkJumpDetail {
  docId: string;
  position: number;
}

/** Jump the active viewer to a bookmark: PDF pages reuse the selection target, text scrolls by ratio. */
export function jumpToBookmark(doc: OpenDoc, bookmark: Bookmark): void {
  if (doc.kind === "pdf" && bookmark.page !== undefined) {
    revealSelection({
      docId: doc.id,
      docPath: doc.ref.path,
      kind: "pdf",
      page: bookmark.page,
      rects: [],
      text: ""
    });
    return;
  }
  if (bookmark.position !== undefined) {
    window.dispatchEvent(
      new CustomEvent<BookmarkJumpDetail>(BOOKMARK_JUMP_EVENT, {
        detail: { docId: doc.id, position: bookmark.position }
      })
    );
  }
}
