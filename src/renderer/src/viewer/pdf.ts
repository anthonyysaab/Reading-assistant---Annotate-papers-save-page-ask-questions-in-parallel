import { GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// The worker is bundled locally by Vite (no CDN). `GlobalWorkerOptions.workerSrc` points at the
// emitted asset; pdf.js instantiates it as a module worker.
GlobalWorkerOptions.workerSrc = workerUrl;

export { getDocument, TextLayer } from "pdfjs-dist";
export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
  RenderTask
} from "pdfjs-dist";
