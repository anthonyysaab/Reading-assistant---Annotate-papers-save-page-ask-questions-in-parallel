# Interfaces & Contracts

The single source of truth every workstream codes against. Renderer features and main modules
agree here. If a change is needed, update this file in the same change and note it in the
workstream handoff.

Types are TypeScript, strict, no `any` in exported signatures. Every cross-boundary payload is
JSON-serializable (buffers cross as `ArrayBuffer`/base64 where noted).

---

## 1. Preload bridge (`window.api`)

The renderer sees exactly this object. Nothing else from Node is exposed.

> **Platform shim (added by `00-foundation`).** Electron 32+ removed `File.path`, so resolving a
> dragged file's absolute path requires `webUtils.getPathForFile`, which is only reachable from the
> preload. The preload therefore exposes one additional, non-`api` global:
> `window.desktop.getPathForFile(file: File): string`. It is a plain path lookup, exposes no Node
> capability, and is the sole exception to the "api only" rule.

```ts
interface Api {
  file: FileApi
  doc: DocApi
  annotations: AnnotationsApi
  rag: RagApi
  llm: LlmApi
  providers: ProvidersApi
  threads: ThreadsApi
  settings: SettingsApi
  events: EventsApi
  health: HealthApi          // added by 05-polish-packaging
  onboarding: OnboardingApi  // added by 05-polish-packaging
  search: SearchApi          // web search (Brave)
  update: UpdateApi          // check GitHub Releases for a newer build
}
```

> **M5 additions.** `05-polish-packaging` added `Api.health` and `Api.onboarding`, `ProvidersApi.modules()`,
> `ThreadsApi.exportMarkdown()`, the `StoredProvider`/`ProviderModuleDescriptor` types, three `ProviderInfo`
> fields (`baseUrl?`, `moduleId?`, `needsSecret?`), and three optional `Settings` fields
> (`providers?`, `hiddenProviders?`, `onboardingComplete?`). All are JSON-serializable and additive; no
> existing field changed shape.
>
> **Search addition.** `Api.search` powers the Search tab. All network access happens in the main
> process (the sandboxed renderer keeps `connect-src 'self'`); the Brave API key lives in the
> `safeStorage` vault under the id `brave-search` and never reaches the renderer.

### 1.1 `FileApi`

```ts
interface FileRef {
  path: string          // absolute
  name: string
  ext: string           // lowercase, no dot, "" if none
  mime: string
  size: number
}

interface FileApi {
  openDialog(): Promise<FileRef | null>
  ref(path: string): Promise<FileRef>            // stat + sniff mime
  readBytes(path: string, range?: { start: number; end: number }): Promise<ArrayBuffer>
  readText(path: string): Promise<string>        // UTF-8; rejects binaries
  writeText(path: string, text: string): Promise<void>   // text files only
  revealInExplorer(path: string): Promise<void>
  openExternal(path: string): Promise<void>      // "open in default app"
  watch(path: string, cb: (e: { type: "change" | "unlink" }) => void): () => void
}
```

### 1.2 `DocApi` (extraction)

```ts
interface ExtractedDoc {
  ref: FileRef
  contentHash: string               // sha-256 of bytes; the index/cache key
  text: string                      // full plain text (may be "")
  pages?: { index: number; text: string }[]   // for paginated formats
  outline?: { title: string; page?: number; level: number }[]
  meta: Record<string, string | number>
}

interface DocApi {
  extract(path: string): Promise<ExtractedDoc>   // cached by contentHash
}
```

### 1.3 `AnnotationsApi`

```ts
type AnnotationKind = "highlight" | "note" | "comment"

interface Anchor {
  page: number                      // 1-based; 0 for non-paginated
  rects: { x: number; y: number; w: number; h: number }[]  // NORMALIZED 0..1
}

interface Annotation {
  id: string                        // uuid
  docPath: string
  kind: AnnotationKind
  anchor: Anchor
  quotedText?: string               // the selected text, if any
  color?: string
  note?: string                     // user's comment text
  createdAt: string                 // ISO
  updatedAt: string                 // ISO
  stale?: boolean                   // set by list() when the sidecar fileHash no longer matches the document
}

interface AnnotationsApi {
  list(docPath: string): Promise<Annotation[]>
  add(input: Omit<Annotation, "id" | "createdAt" | "updatedAt">): Promise<Annotation>
  update(id: string, patch: Partial<Pick<Annotation, "note" | "color">>): Promise<Annotation>
  remove(id: string): Promise<void>
}
```

Sidecar file: `<docPath>.annotations.json`, shape:

```json
{ "version": 1, "docPath": "...", "fileHash": "sha256:...", "items": [ /* Annotation[] */ ] }
```

If the file's `fileHash` no longer matches the current document, keep the items but mark them
"stale" in the UI (do not auto-delete).

### 1.4 `RagApi`

```ts
interface IndexStatus {
  docPath: string
  state: "none" | "indexing" | "ready" | "error"
  chunks: number
  dim: number
  embedModel: string
  error?: string
}

interface Citation {
  chunkId: string
  page?: number
  section?: string
  snippet: string
}

interface Retrieved {
  chunkId: string
  score: number
  page?: number
  section?: string
  text: string
}

interface RagApi {
  index(docPath: string, opts?: { force?: boolean }): Promise<IndexStatus>
  status(docPath: string): Promise<IndexStatus>
  remove(docPath: string): Promise<void>
  query(input: {
    docPath: string
    question: string
    selection?: string          // boosts chunks overlapping the selection
    topK?: number               // default from settings
  }): Promise<{ retrieved: Retrieved[]; promptContext: string }>
}
```

Streaming progress for indexing is delivered via `events` (see §1.7).

### 1.5 `LlmApi`

```ts
interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatRequest {
  providerId: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  streamId: string              // caller-generated; correlates events
}

interface LlmApi {
  chatStream(req: ChatRequest): Promise<void>   // tokens arrive via events
  abort(streamId: string): Promise<void>
  models(providerId: string): Promise<ModelInfo[]>
}
```

### 1.6 `ProvidersApi`

```ts
interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
  supportsEmbedding?: boolean
  supportsChat?: boolean
}

interface ProviderInfo {
  id: string                    // "ollama" | "lmstudio" | "deepseek" | "openai" | ...
  name: string
  kind: "local" | "remote"
  configured: boolean           // has enough config (e.g. key present)
  running?: boolean             // local only
  chatModels: ModelInfo[]
  embeddingModels: ModelInfo[]
  baseUrl?: string              // effective base URL (M5); safe to show in settings
  moduleId?: string             // adapter id, e.g. "openai-compatible" (M5)
  needsSecret?: boolean         // requires an API key (M5)
}

interface ProviderModuleDescriptor {   // M5: available adapters for a "new provider" form
  id: string
  name: string
  kind: "local" | "remote"
  needsSecret: boolean
  defaultBaseUrl: string
}

interface ProvidersApi {
  list(): Promise<ProviderInfo[]>
  detectLocal(): Promise<ProviderInfo[]>          // probes Ollama :11434, LM Studio :1234/v1
  test(providerId: string): Promise<{ ok: boolean; error?: string }>
  modules(): Promise<ProviderModuleDescriptor[]>  // M5
}
```

### 1.7 `SettingsApi` and events

```ts
type PanelTab = "chat" | "annotations" | "context" | "search"

interface Settings {
  activeProviderId: string
  activeChatModel: string
  activeEmbeddingProviderId: string
  activeEmbeddingModel: string
  rag: { topK: number; chunkTokens: number; chunkOverlap: number; mmrLambda: number }
  ui: {
    theme: "dark" | "light" | "system"
    sidebarOpen: boolean
    panelOpen: boolean
    panelTab: PanelTab          // active side-panel tab (persisted)
    sidebarSize?: number        // percent, persisted by the layout
    panelSize?: number          // percent, persisted by the layout
  }
  keysConfigured: Record<string, boolean>   // NEVER the key values
  recentFiles?: string[]      // absolute paths, most-recent first
  providers?: StoredProvider[]     // M5: user provider overrides + custom providers
  hiddenProviders?: string[]       // M5: built-in provider ids the user removed
  onboardingComplete?: boolean     // M5: gates the first-run setup modal
}

// M5: a user-managed provider persisted in settings. Matching a built-in `id` overrides it
// (base URL/name/module); an unknown `id` adds a custom provider.
interface StoredProvider {
  id: string
  name: string
  moduleId: string
  kind: "local" | "remote"
  baseUrl: string
  needsSecret: boolean
  catalogId?: string
}

interface SettingsApi {
  get(): Promise<Settings>
  set(patch: Partial<Settings>): Promise<Settings>
  setSecret(providerId: string, secret: string): Promise<void>  // stored via safeStorage
  clearSecret(providerId: string): Promise<void>
}

// M5: provider/embedding reachability, surfaced as status chips with remediation hints.
type HealthState = "ok" | "degraded" | "down" | "unconfigured"

interface HealthCheck {
  id: string
  label: string
  state: HealthState
  detail: string
  remediation?: string
}

interface HealthReport {
  chat: HealthCheck
  embedding: HealthCheck
  checkedAt: string           // ISO
}

interface HealthApi {
  check(): Promise<HealthReport>
}

// M5: first-run detection of local runtimes + embedding guidance.
interface OnboardingChoices {
  providerId?: string
  model?: string
  embeddingProviderId?: string
  embeddingModel?: string
}

interface OnboardingStatus {
  firstRun: boolean
  detected: ProviderInfo[]
  suggestedChatProviderId?: string
  suggestedChatModel?: string
  suggestedEmbeddingProviderId: string
  suggestedEmbeddingModel: string
  embeddingReady: boolean
}

interface OnboardingApi {
  status(): Promise<OnboardingStatus>
  complete(choices: OnboardingChoices): Promise<Settings>
}

interface EventsApi {
  onChatToken(cb: (e: { streamId: string; delta: string }) => void): () => void
  onChatDone(cb: (e: { streamId: string; usage?: unknown }) => void): () => void
  onChatError(cb: (e: { streamId: string; error: string }) => void): () => void
  onIndexProgress(cb: (e: { docPath: string; done: number; total: number; phase: string }) => void): () => void
  onFileChanged(cb: (e: { path: string; type: "change" | "unlink" }) => void): () => void
}
```

### 1.8 `ThreadsApi`

Persists chat threads to `userData/threads/<docId>.json` (§5). Added by `02-providers-chat`.

```ts
interface ThreadsApi {
  save(thread: Thread): Promise<void>
  load(docId: string): Promise<Thread | null>
  list(): Promise<Thread[]>
  remove(docId: string): Promise<void>
  exportMarkdown(thread: Thread): Promise<string | null>   // M5: save dialog → path, or null
}
```

Rename is `save(thread)` with a new `title` (the file is keyed by `docId`); delete is `remove(docId)`.
`exportMarkdown` opens a native save dialog in main and writes a Markdown rendering of the thread.

### 1.9 `SearchApi`

Web search for the Search side-panel tab, backed by the Brave Search API. Channel: `search:query`.

```ts
interface WebSearchResult {
  title: string
  url: string
  snippet: string
  source?: string      // site name, when Brave reports it
  age?: string         // freshness label, e.g. "2 days ago"
}

interface SearchApi {
  query(query: string): Promise<WebSearchResult[]>
}

const BRAVE_SEARCH_SECRET_ID = "brave-search"  // key stored via SettingsApi.setSecret
```

The renderer never calls Brave directly: results are fetched in main, and `Attach to chat` prepends
the results to the model's system context (citable as `[web N]`) for the duration of the chat.

### 1.10 `UpdateApi`

Checks the project's GitHub Releases for a build newer than the running version. Channels:
`update:check`, `update:install`.

```ts
interface UpdateInfo {
  current: string          // app.getVersion()
  latest: string | null    // latest release tag without the leading "v", or null if unknown
  available: boolean
  releaseUrl: string
  installerUrl: string | null   // the *-setup.exe asset, when present
}

interface UpdateApi {
  check(): Promise<UpdateInfo>   // never throws; "no update" on network failure
  install(): Promise<void>       // downloads the installer asset to temp and launches it
}
```

The status bar auto-checks on launch and shows an "Update vX" button when `available`; the command
palette exposes a manual "Check for updates".

---

## 2. Provider module interface (main process)

A provider is discovered from the app `providers/` directory or an npm package and must export
this shape:

```ts
export interface ProviderModule {
  id: string
  name: string
  kind: "local" | "remote"
  needsSecret?: boolean                 // remote APIs
  defaultBaseUrl?: string
  chat(args: {
    baseUrl: string
    apiKey?: string
    model: string
    messages: ChatMessage[]
    temperature?: number
    maxTokens?: number
    signal: AbortSignal
  }): AsyncIterable<{ delta: string }>   // streamed text deltas
  embed(args: {
    baseUrl: string
    apiKey?: string
    model: string
    input: string[]
    signal: AbortSignal
  }): Promise<number[][]>                // one vector per input
  listModels(args: { baseUrl: string; apiKey?: string }): Promise<ModelInfo[]>
}
```

Built-ins to ship: `ollama`, `openai-compatible` (parameterized base URL — powers DeepSeek,
OpenRouter, Groq, LM Studio), `anthropic`, `gemini`. DeepSeek is an `openai-compatible` preset
with `baseUrl=https://api.deepseek.com` and models `deepseek-chat`, `deepseek-reasoner`.

---

## 3. File-renderer registry (renderer)

```ts
export interface RendererViewProps {
  ref: FileRef
  docId: string
}

export interface FileRenderer {
  id: string
  match(ref: FileRef): boolean          // by ext and/or mime
  load(): Promise<React.ComponentType<RendererViewProps>>
}
```

Priority: exact-mime → extension → fallback (`meta-view`). Registered in
`01-viewers`; the fallback always exists so any file opens. Non-renderable types get a
metadata panel plus an "Open in default app" button.

---

## 4. Vector index format (main process)

```ts
interface VectorIndex {
  version: 1
  docPath: string
  contentHash: string          // sha-256 of the source bytes
  embedModel: string
  dim: number
  chunks: {
    id: string                 // stable: `${contentHash}:${ordinal}`
    ordinal: number
    page?: number
    section?: string
    text: string
    vector: number[]           // L2-normalized
    tokens: number
  }[]
  createdAt: string
}
```

Stored at `userData/index/<fileHash>.json`. Query: cosine similarity, then MMR
(`mmrLambda` from settings) with an optional additive boost for chunks overlapping the current
selection. `VectorStore` is an interface so a native backend can replace it later (D3/D4).

---

## 5. Document / session model

```ts
interface OpenDoc {
  id: string                   // uuid, per open tab
  ref: FileRef
  kind: "pdf" | "text" | "image" | "fallback"
  dirty: boolean               // text edits unsaved
}

interface Thread {
  id: string
  docId: string
  title: string
  messages: {
    id: string
    role: "user" | "assistant"
    content: string
    citations?: Citation[]
    createdAt: string
  }[]
}
```

Persisted to `userData/threads/<docId>.json`.

---

## 6. Naming conventions

- IPC channels: `domain:action` (`file:read`, `rag:query`, `llm:chatStream`).
- Events: `domain:event` (`llm:token`, `rag:progress`).
- IDs: `crypto.randomUUID()`.
- Timestamps: ISO-8601 strings.
- All hashes: `sha256:<hex>`.
