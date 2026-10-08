# Decisions (locked)

These are settled. Do not re-litigate without asking the project owner. If a decision must
change, record the change here with a new dated entry and update `docs/interfaces.md` in the
same change.

---

## D1 — Desktop framework: Electron
**Decision:** Build on Electron, not Tauri.
**Why:** This machine has neither Rust/Cargo nor the MSVC build tools Tauri needs. Electron
needs only Node (v24 present) and ships Chromium, which gives consistent PDF and annotation
rendering everywhere.
**Consequence:** Larger binary (~150 MB) and higher RAM; acceptable for a personal desktop app.

## D2 — Renderer: React + TypeScript, mirroring opencode
**Decision:** React + TS. The UI *mirrors opencode's desktop layout* but reuses none of its code.
**Why:** opencode's desktop app is SolidJS in a Bun monorepo with a bespoke UI kit; forking it
would couple us to a fast-moving upstream and a second framework. We copy the *layout and
patterns* (tabbed side panel, command palette, provider registry) only.
**Consequence:** We re-implement the shell. Cheap, because the shell is not the hard part.

## D3 — Pure-JS dependencies only
**Decision:** No native modules. Ever, on this machine.
**Why:** No MSVC toolchain; native builds would fail or require fragile prebuilts.
**Consequence:** Pure-JS vector store (D4); `safeStorage` instead of `keytar`; no
`better-sqlite3`. Anything needing a real vector DB goes behind the `VectorStore` interface.

## D4 — Vector store: pure-JS index
**Decision:** Persist embeddings as normalized `Float32Array` vectors plus metadata in
`userData/index/<fileHash>.json`; brute-force cosine + MMR at query time.
**Why:** Zero native deps; correct and fast enough for a personal library (thousands of chunks).
**Consequence:** Revisit only if a single library exceeds ~10⁵ chunks; the interface hides it.

## D5 — Providers: a plugin registry, not fixed adapters
**Decision:** A provider is a small module implementing `chat()`, `embed()`, `listModels()`.
Built-ins: Ollama, OpenAI-compatible (covers DeepSeek, OpenRouter, Groq, LM Studio, …),
Anthropic, Gemini. Models auto-populate from `https://models.dev/api.json`.
**Why:** "Any API or local LLM" plus easy third-party extension. Mirrors opencode's
catalog-driven provider resolution.
**Consequence:** Provider modules are loadable from an app `providers/` directory and/or npm.

## D6 — Default chat provider: local Qwen
**Decision:** Default to a local Qwen model, auto-detected. On this machine that means LM Studio
(`lmstudio-community/Qwen3.8-27B-GGUF`) or Ollama (`qwen3:8b` as the recommended pull for speed).
**Why:** Local-first, no cost, works offline. The 27B model on a 6 GB Quadro leans on CPU/RAM;
`qwen3:8b` is the snappy daily driver.
**Consequence:** First-run detects running local runtimes (Ollama `:11434`, LM Studio `:1234/v1`)
and offers the user's existing model rather than forcing a download.

## D7 — Embeddings: configurable, default `nomic-embed-text` via Ollama
**Decision:** Embeddings are fully configurable (Ollama / OpenAI-compatible / local
`transformers.js`), but ship pre-selected as Ollama `nomic-embed-text` so RAG works offline on
first launch. Fully editable in settings.
**Why:** RAG needs an embedding model to function; a sensible editable default beats an
empty state, and nomic is tiny and fast.
**Consequence:** If Ollama is absent, settings must prompt for an embedding provider before
indexing runs.

## D8 — Annotations never mutate the original
**Decision:** PDF annotations and comments are stored in a sidecar `<file>.annotations.json`
next to the document. Original files are read-only.
**Why:** Safety and portability; annotations travel with the file.
**Consequence:** Annotation rects are stored **normalized** (0..1) so zoom/rotation are safe.

## D9 — opencode integration is deferred and non-invasive
**Decision:** Do not fork opencode or depend on it. Optionally, later, prepare a separate PR
that adds a `read` tab next to `review`/`context` in opencode's session side panel.
**Why:** opencode's plugin API cannot add UI tabs, and forking its SolidJS/Bun monorepo would
dominate the project. We only borrow its patterns (provider catalog, tabbed panel).
**Consequence:** The reading assistant stands alone; the opencode `read` tab, if built, is a
separate artifact and not on the critical path.

## D10 — Full RAG in v1
**Decision:** Build the whole extraction → chunk → embed → index → retrieve → cite pipeline in
v1, not a later phase.
**Why:** Grounded answers over whole documents are core to the product, not an add-on.
**Consequence:** `04-rag-pipeline` depends on `01-viewers` for extracted text and on
`02-providers-chat` for embedding providers.

## D11 — UI setup mirrors opencode: tabbed side panel
**Decision:** The right panel is tabbed: **Chat**, **Annotations**, **Context** — the analog of
opencode's session side panel with its `review` and `context` tabs.
**Why:** Owner prefers a familiar setup; matches the reference layout.
**Consequence:** See `docs/layout.md` for the exact spec.

## D12 — Windows target
**Decision:** Primary platform is Windows (this machine). Paths, packaging, and file dialogs
target Windows; avoid macOS/Linux-only assumptions.
**Why:** Development and use happen here.
**Consequence:** `electron-builder` produces an NSIS installer (M5).

## D13 — Dependency security: accept `xlsx` advisory, pin `sprintf-js`
**Decision:** Keep SheetJS `xlsx` at 0.18.5 (no patched release is published to npm) and accept its
two advisories (prototype pollution, ReDoS). Pin the transitive `sprintf-js` to `^1.1.3` via npm
`overrides` to clear the `mammoth → argparse → sprintf-js` advisory.
**Why:** The spreadsheet extractor only parses files the user opens locally; there is no untrusted
remote or network input, and the renderer is sandboxed. The `xlsx` surface is confined to
`src/main/ingest/xlsx.ts` (`XLSX.read` + `sheet_to_json`), so swapping it for a maintained
pure-JS reader later is a one-module change behind the ingest seam.
**Consequence:** `npm audit --omit=dev` reports a single high (xlsx). Revisit if a maintained,
patched pure-JS xlsx reader is adopted.
**Date:** 2026-10-09
