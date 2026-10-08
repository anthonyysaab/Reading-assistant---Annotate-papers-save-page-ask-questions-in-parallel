# 01 — Document Viewers (M1)

## Mission

Build the file-renderer registry and the concrete viewers for the four v1 file kinds: PDF
(paginated canvas with a text layer), plain text/markdown/code (editable with CodeMirror 6),
images, and a metadata fallback for anything else. After this workstream, any file the user
opens renders sensibly, and text files can be edited and saved through the bridge.

## Scope

**In scope**
- The `FileRenderer` registry and its `match()`/lazy-`load()` contract (`docs/interfaces.md` §3).
- PDF viewer: page rendering via `pdfjs-dist`, zoom, fit, page navigation, continuous or paged
  mode, text layer enabled (needed later for selection and annotations).
- Text/markdown/code viewer: CodeMirror 6, syntax highlighting by extension, editable with
  dirty tracking and `Ctrl+S` save through `api.file.writeText`.
- Image viewer: pan/zoom/fit for common image types.
- Fallback viewer: file metadata (name, path, size, mime, hash) + "Open in default app".
- Multi-document tabs in the document pane (open, switch, close, reorder).

**Out of scope**
- Annotation overlay and comments (that is `03-annotations`).
- Text extraction for RAG (that is `04-rag-pipeline`; this workstream only *displays*).
- EPUB/PPTX native rendering (fall to the metadata fallback).

## Depends on

- `00-foundation` (pane slot, preload bridge, tabs, theming).
- `docs/interfaces.md` §1.1 (`FileApi`), §3 (renderer registry), §5 (`OpenDoc`).

## Deliverables

- `src/renderer/src/viewer/registry.ts` and `types.ts`.
- `src/renderer/src/viewer/pdf-viewer.tsx`.
- `src/renderer/src/viewer/text-viewer.tsx` (+ CodeMirror setup, language map).
- `src/renderer/src/viewer/image-viewer.tsx`.
- `src/renderer/src/viewer/meta-view.tsx` (fallback).
- Document tab strip + toolbar components.
- Any main-process helpers needed (e.g. returning byte ranges) — implement via existing `FileApi`.

## Task checklist

- [ ] Define the `FileRenderer` interface and a registry with ordered matching
      (exact mime → extension → fallback).
- [ ] PDF: load with `pdfjs-dist` (bundle the worker locally, no CDN). Render pages to canvas;
      keep text-layer divs aligned for selection.
- [ ] PDF toolbar: zoom in/out, fit-width, fit-page, page prev/next, jump-to-page; virtualize or
      lazily render pages for large documents.
- [ ] Text: CodeMirror 6 with a language map (md, json, ts/tsx, js/jsx, py, rust, go, yaml,
      toml, csv, plain). Dirty indicator; `Ctrl+S` saves; re-render on external change.
- [ ] Image: `<img>`-based with pan/zoom/fit; support png, jpg, jpeg, gif, webp, svg, bmp, avif.
- [ ] Fallback: show metadata; wire "Open in default app" to `api.file.openExternal`.
- [ ] Document tabs: open/close/switch/reorder; each holds an `OpenDoc`; unsaved-change guard
      on close.
- [ ] Keyboard: `Ctrl+F` find (PDF text layer and editor), `Ctrl+S` save.
- [ ] Handle large files gracefully (stream PDF rendering; cap text file size with a warning).

## Constraints

- Pure JS only. `pdfjs-dist` worker must be bundled/self-hosted — **no CDN fetches**.
- Renderer stays free of Node APIs; all file access goes through `window.api`.
- Do not mutate originals: the text viewer may save text files (that is explicit user edit), but
  must never touch PDFs/images.
- No annotation drawing here — expose selection events to be consumed by `03-annotations`.

## Verification

- Open a multi-page PDF: pages render, zoom/fit work, text is selectable, page nav works.
- Open a `.md`, `.ts`, `.json`: highlight correctly; edit and `Ctrl+S`; content persists on disk.
- Open a `.png`: pans and zooms.
- Open a `.bin`/unknown: fallback shows metadata; "Open in default app" launches it.
- Open several files: tabs switch, close, reorder; unsaved text edits prompt before closing.
- `npm run typecheck` and `npm run lint` pass.

## Done criteria

Any opened file renders via an appropriate viewer with a working fallback; PDFs are
navigable and selectable; text files are editable and saveable; multiple documents tab
correctly.

## Handoff notes

- `03-annotations` needs: PDF text-layer coordinates and a normalized-rect selection model, plus
  a stable way to map page + rect → DOM overlay. Document the selection API you expose.
- `04-rag-pipeline` needs: the set of displayable text formats (to decide extraction routing)
  and the `OpenDoc.kind` mapping so it knows which files carry selectable text.
- Keep the registry open: adding EPUB/PPTX later should be a single new renderer module.

## Status

- State: done
- Branch/commit: working tree (no commit made)
- What works:
  - `FileRenderer` registry (`viewer/registry.ts`) unchanged in shape; `viewer/builtins.ts`
    registers `meta-view` → `image-viewer` → `text-viewer` → `pdf-viewer`, called once from
    `DocPane.tsx` module scope. Because `resolveFileRenderer` returns the last match, the
    fallback is registered first so specific renderers win (exact-mime/extension before
    fallback).
  - PDF (`viewer/pdf-viewer.tsx`): `pdfjs-dist` worker bundled locally via Vite `?url`
    (no CDN), canvas per page sized to devicePixelRatio, text layer enabled for selection,
    toolbar (zoom, fit-width, fit-page, prev/next, jump-to-page), IntersectionObserver
    virtualization for large docs, load-error UI. Vendored text-layer CSS in
    `viewer/pdf-viewer.css`.
  - Text/code (`viewer/text-viewer.tsx`): CodeMirror 6 via `@uiw/react-codemirror`, language
    map (`viewer/languages.ts`), dirty tracking (`appStore.setDocDirty`), `Ctrl+S` save via
    `window.api.file.writeText`, external-change banner + reload (`file:change`/`unlink`),
    8 MiB inline cap with warning, `Ctrl+F` opens the CM search panel.
  - Image (`viewer/image-viewer.tsx`): `readBytes` → Blob URL (revoked on unmount), pan, wheel
    zoom around cursor, fit / fit-width / 100%.
  - Fallback (`viewer/meta-view.tsx`): name, path, size, mime, `sha256:` via WebCrypto over
    `readBytes` (skipped >256 MiB), Reveal + Open in default app.
  - Tabs (`layout/DocTabs.tsx`, `state/appStore.ts`): per-tab dirty dot, drag-reorder
    (`moveDoc`), close with `window.confirm` guard for unsaved text edits (covers Sidebar
    close too).
- Selection API for `03-annotations` (`viewer/selection.ts`):
  - `DocSelection { docId, docPath, kind: "pdf"|"text", page, rects, text }`; PDF `rects` are
    NORMALIZED 0..1 to the page box, `page` is 1-based (0 for text).
  - `onSelection`, `getSelection`, `emitSelection`, `clearSelectionForDoc`,
    `registerSelectionTarget(docId, { scrollTo })`, `revealSelection`.
  - Overlay mapping: each PDF page renders as `.ra-pdf-page[data-page="N"]`; use
    `pageElementFor(container, page)` + `normalizedRectsToClient(pageElement, rects)` to place
    an overlay. Viewers also mirror the quoted text into `appStore.selection` for the Composer.
- Known gaps:
  - TOML and CSV render as plain text (no language package installed; no new deps added).
  - PDF CMaps/standard fonts/WASM decoders are not self-hosted; exotic CJK or JBIG2/JPEG2000
    PDFs may render with missing glyphs/images. All access is local (no CDN), but wiring
    `cMapUrl`/`standardFontDataUrl`/`wasmUrl` to bundled assets is unfinished.
  - `npm run build` was not run (per instructions), so the worker `?url` asset emission is
    verified only by typecheck, not an actual bundle.
- Interfaces changed: none. `docs/interfaces.md` §1.1/§3/§5 contracts are unchanged; the
  selection API is renderer-internal.
- Environment notes: Windows; Electron 44 / React 19.3 / pdfjs-dist 6.4.299. React 19 treats
  `ref` as a normal prop, so `RendererViewProps.ref` is delivered as-is.
- Files created: `viewer/builtins.ts`, `viewer/selection.ts`, `viewer/languages.ts`,
  `viewer/pdf.ts`, `viewer/pdf-viewer.tsx`, `viewer/pdf-viewer.css`,
  `viewer/pdf-worker.d.ts`, `viewer/text-viewer.tsx`, `viewer/image-viewer.tsx`,
  `viewer/meta-view.tsx`.
- Files edited: `layout/DocPane.tsx`, `layout/DocTabs.tsx`, `state/appStore.ts`.

### Update (2026-10-09) — PDF asset gap closed
- CMaps/standard fonts/WASM are now self-hosted: `electron.vite.config.ts` copies
  `pdfjs-dist/{cmaps,standard_fonts,wasm}` into `src/renderer/public/pdfjs/` (gitignored; emitted to
  `out/renderer/pdfjs/`), `viewer/pdf.ts` exports `PDF_ASSET_URLS` (resolved against
  `document.baseURI`), and `pdf-viewer.tsx` passes `cMapUrl`/`standardFontDataUrl`/`wasmUrl` to
  `getDocument`. Closes the CJK/JBIG2/JPEG2000 rendering gap. Rotate is still not implemented
  (normalized-rect overlays remain rotation-safe by design).
