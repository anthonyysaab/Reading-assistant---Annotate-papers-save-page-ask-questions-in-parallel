import { useEffect, useState } from "react";
import type { ExtractedDoc } from "@shared/types";

export function useExtractedDoc(docPath: string | null): ExtractedDoc | null {
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);

  useEffect(() => {
    if (!docPath) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    setDoc(null);
    window.api.doc
      .extract(docPath)
      .then((result) => {
        if (!cancelled) setDoc(result);
      })
      .catch(() => {
        if (!cancelled) setDoc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [docPath]);

  return doc;
}
