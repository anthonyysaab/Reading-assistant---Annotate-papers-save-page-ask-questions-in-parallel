import { GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// The worker is bundled locally by Vite (no CDN). `GlobalWorkerOptions.workerSrc` points at the
// emitted asset; pdf.js instantiates it as a module worker.
GlobalWorkerOptions.workerSrc = workerUrl;

// CMaps, standard fonts, and WASM decoders (JBIG2/JPEG2000) are copied into `public/pdfjs/` at
// build time (see electron.vite.config.ts). Resolving them against the document base keeps the
// same code working in the Vite dev server and the packaged `file://` bundle.
function assetBase(name: string): string {
  return new URL(`pdfjs/${name}/`, document.baseURI).href;
}

export const PDF_ASSET_URLS = {
  cMapUrl: assetBase("cmaps"),
  standardFontDataUrl: assetBase("standard_fonts"),
  wasmUrl: assetBase("wasm")
};

export { getDocument, TextLayer } from "pdfjs-dist";
export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
  RenderTask
} from "pdfjs-dist";
