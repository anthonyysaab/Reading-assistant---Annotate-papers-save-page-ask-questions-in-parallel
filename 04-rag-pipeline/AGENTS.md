# 04 — RAG Pipeline (M4)

## Mission

Make the assistant answer questions about an entire document, grounded and cited, using a
fully local pipeline: extract text, chunk it, embed it with a configurable embedding provider,
store vectors in a pure-JS index, retrieve with MMR (plus a boost for the current selection),
and return citations the chat UI can render and the viewer can jump to.

## Scope

**In scope**
- Text extraction per file type: PDF (`pdfjs-dist`), docx (`mammoth`), xlsx (SheetJS), text/
  markdown/code, with graceful "no text" handling for images and binaries.
- Token-aware chunking with overlap, stable chunk ids, and page/section metadata.
- Configurable embeddings via the provider registry's `embed()`.
- Pure-JS vector index + content-hash cache (no re-embedding unchanged files).
- Retrieval: cosine top-k, MMR diversity, optional selection boost.
- Prompt assembly with citation markers; expose `Retrieved[]` + `promptContext`.
- Context tab: document map, index status/progress, token usage; Re-index and change-model.
- Background indexing with progress events; incremental on file change.

**Out of scope**
- Chat UI, streaming, provider adapters (owned by `02`).
- Annotation storage (owned by `03`).

## Depends on

- `01-viewers` (which formats display text; `OpenDoc.kind`).
- `02-providers-chat` (provider registry, embedding models, citation rendering contract).
- `00-foundation` (IPC, settings, side panel tabs).
- `docs/interfaces.md` §1.2, §1.4, §1.7, §4, §5.
- `docs/decisions.md` (D3, D4, D7, D10).

## Deliverables

- `src/main/ingest/` — `extract.ts`, `pdf.ts`, `docx.ts`, `xlsx.ts`, `text.ts`, `router.ts`.
- `src/main/rag/chunk.ts`, `embed.ts`, `vector-store.ts`, `retrieve.ts`, `prompt.ts`, `index.ts`.
- `src/main/ipc/rag.ts`.
- `src/renderer/src/context/` — Context tab: doc map, index status, usage.
- Citation jump plumbing shared with `02`'s chat.

## Task checklist

- [x] Extraction router: choose extractor by ext/mime; fall back to plain-text sniff; return
      `ExtractedDoc` (with `pages` when available). Cache by `contentHash`.
- [x] PDF extraction via `pdfjs-dist` (per-page text + page numbers); docx via `mammoth`;
      xlsx via SheetJS (per-sheet as sections); text/markdown/code direct.
- [x] Chunker: token-aware (respect `chunkTokens`/`chunkOverlap` from settings), never split
      mid-sentence when avoidable, attach `page`/`section` and `ordinal`.
- [x] Embedding provider: call `ProviderModule.embed()` with the configured embedding model;
      batch inputs; handle rate limits/retries with backoff; surface clear errors if no
      embedding provider is configured.
- [x] Vector store: L2-normalize vectors, persist `VectorIndex` JSON at
      `userData/index/<fileHash>.json`, load on demand. Implement behind a `VectorStore`
      interface so a native backend can replace it later.
- [x] Indexing: skip if a ready index exists for the current `contentHash`; otherwise re-embed;
      emit `rag:progress` events (phase + done/total). Delete stale indexes by hash.
- [x] Retrieval: cosine top-k → MMR (`mmrLambda`) → optional additive selection boost.
- [x] Prompt assembly: numbered context chunks with page/section labels; instruct the model to
      cite chunk numbers; return `Retrieved[]` + `promptContext`.
- [x] Wire `rag.query` so `02`'s chat can request retrieval before generating.
- [ ] Citations: map model citations back to `Citation` objects; ensure clicking jumps the viewer.
      (Plumbing done in `src/renderer/src/context/citationJump.ts`; the chip `onClick` in
      `02`'s `chat/Transcript.tsx` still needs to dispatch it — see Status.)
- [x] Context tab: outline from `ExtractedDoc.outline`/pages, live index status, token usage.
- [x] Incremental: on `file:change`, re-hash and re-index if content changed; cancel in-flight.

## Constraints

- Pure JS only. No native vector/DB modules.
- All embedding and indexing work in **main**; renderer only sends requests and shows progress.
- Vectors stored L2-normalized; keep the on-disk format exactly as `docs/interfaces.md` §4.
- Chunk ids are deterministic from `contentHash` + ordinal so re-indexes are stable.
- Never send the whole document to a remote provider for embedding without the user's chosen
  configuration; respect the selected embedding provider.

## Verification

- Index a 300-page PDF with Ollama `nomic-embed-text`; progress runs to ready; chunk count shown.
- Ask a question; the answer includes citations; clicking a citation jumps to the right page.
- Re-open the same document: no re-embedding (cache hit) and status is instantly ready.
- Change one file byte; only that document re-indexes; unrelated indexes untouched.
- Select a passage and ask; retrieval is boosted toward the selection.
- With no embedding provider configured, indexing surfaces a clear, actionable error.
- `npm run typecheck` and `npm run lint` pass.

## Done criteria

Any text-bearing document can be indexed locally, queried with grounded and cited answers,
re-indexed incrementally on change, and inspected (status, doc map, usage) in the Context tab.

## Handoff notes

- `05-polish-packaging` adds health checks (provider/embedding reachability) and may add a
  "re-index all" action; keep index management callable in bulk.
- The `VectorStore` interface is the single swap point for a future native backend; document it
  clearly at the seam.

## Status

- State: done (one renderer wiring gap that belongs to `02`, noted below)
- Branch/commit: working tree (no commit made)
- What works:
  - Extraction (`src/main/ingest/`): `router.ts` picks by ext/mime (pdf → docx → xlsx → text),
    then a plain-text sniff, then a graceful empty doc. `pdf.ts` (`pdfjs-dist`, per-page text +
    1-based page numbers + flattened outline), `docx.ts` (`mammoth`), `xlsx.ts` (SheetJS,
    per-sheet as `pages` + `outline`), `text.ts` (markdown/code/JSON/XML direct). `extract.ts`
    computes `contentHash = "sha256:<hex>"` over raw bytes and caches in memory + `userData/extract/`.
  - Chunking (`rag/chunk.ts`): token-aware (~chars/4), sentence/newline-boundary aware, character
    overlap, stable ids `${contentHash}:${ordinal}`, `page`/`section` derived from `pages`/`outline`.
  - Embeddings (`rag/embed.ts`): resolves `activeEmbeddingProviderId`/`activeEmbeddingModel` via
    the `02` provider registry (`getProviderConfig`/`getModule`) + `keyVault` secret, calls
    `ProviderModule.embed()` in batches of 32 with exponential backoff on 429/5xx/network, and
    emits actionable errors ("No embedding provider is configured…", "…is unreachable").
  - Vector store (`rag/vector-store.ts`): `VectorStore` interface + `FileVectorStore` persisting
    the exact §4 `VectorIndex` JSON at `userData/index/<sanitizedHash>.json`; the colon in
    `contentHash` is replaced for the filename only (`contentHash` field kept verbatim). Vectors
    L2-normalized before save.
  - Indexing (`rag/index.ts`): content-hash + model cache hit skips re-embedding, emits
    `rag:progress` via `emitToRenderer(IPC.rag.progress)` (`extract|chunk|embed|write|ready|error`),
    deletes stale hashes for the doc, tracks an in-memory status map. Errors come back as
    `IndexStatus.state="error"` + `error` (resolved, not rejected) so the UI can render them.
  - Retrieval (`rag/retrieve.ts`): cosine → MMR (`mmrLambda`) → additive selection boost
    (`SELECTION_BOOST_WEIGHT`). `rag/prompt.ts` numbers excerpts, labels page/section, and tells
    the model to cite `[n]`.
  - IPC: `ipc/doc.ts` (`doc:extract`) and `ipc/rag.ts` (`rag:index|status|remove|query`); the
    `doc`/`rag` stubs were removed from `stubs.ts`; handlers registered in `ipc/index.ts`.
  - Preload: `events.onIndexProgress` now subscribes to `rag:progress` for real.
  - Renderer: `context/useIndexStatus.ts` (status + live progress), `context/useExtractedDoc.ts`,
    `context/citationJump.ts` (event bus + `revealSelection` reuse from `01`), and a rebuilt
    `panes/ContextTab.tsx` (index status/progress, embedding model, token usage, doc map, Re-index).
  - Incremental: indexed docs get a debounced `fs.watch`; on change `handleFileChanged` re-hashes
    via `indexDocument` (cache hit if unchanged) and aborts in-flight work via per-doc
    `AbortController`.
  - Tests: `rag/chunk.test.ts` (7) + `rag/retrieve.test.ts` (7) cover chunk determinism/overlap/
    page+section stamping and cosine/normalize/MMR/selection-boost.
- Known gaps:
  - **Citation click wiring (owned by `02`).** `ContextTab` installs the global
    `ra:jump-citation` listener and `jumpToCitation`/`requestCitationJump` exist, but the citation
    chips in `src/renderer/src/chat/Transcript.tsx` do not yet dispatch the event (that file is
    `02`'s and was off-limits). One line in `CitationChips`: `onClick={() =>
    requestCitationJump({ docId, docPath, citation })}` (needs `docId`/`docPath` threaded in).
  - The embedding-model affordance in the Context tab is read-only text; there is still no
    settings UI to change `activeEmbeddingProviderId`/`activeEmbeddingModel` (`02`/`05` gap).
  - `dim` is taken from the first returned vector; a provider returning inconsistent dims is not
    validated beyond count.
  - `pdfjs-dist` is imported dynamically in the main process but `npm run build` was not run (per
    instructions), so ESM-in-CJS resolution under the packaged build is unverified (Node 24's
    `require(esm)` should cover it).
- Interfaces changed: none. `docs/interfaces.md` and `src/shared/**` are untouched.
- Environment notes: Windows; reuse `02` registry + `00` settings/keyVault/events/IPC; no new npm
  packages. Verified: `npm run typecheck` (node+web), `npm run lint`, `npm test` (31 passing).
- Files created: `src/main/ingest/{types,text,pdf,docx,xlsx,router,extract}.ts`;
  `src/main/rag/{types,chunk,embed,vector-store,retrieve,prompt,index}.ts` +
  `chunk.test.ts`, `retrieve.test.ts`; `src/main/ipc/{doc,rag}.ts`;
  `src/renderer/src/context/{useIndexStatus,useExtractedDoc,citationJump}.ts`.
- Files edited: `src/main/ipc/index.ts`, `src/main/ipc/stubs.ts`, `src/preload/index.ts`
  (`onIndexProgress` only), `src/renderer/src/panes/ContextTab.tsx`.
