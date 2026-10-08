import { useEffect, useState } from "react";
import { onSelection, type DocSelection } from "@renderer/viewer/selection";

/** Subscribe a component to the viewer workstream's live `DocSelection`. */
export function useDocSelection(): DocSelection | null {
  const [selection, setSelection] = useState<DocSelection | null>(null);
  useEffect(() => onSelection(setSelection), []);
  return selection;
}
