export interface FileRef {
  path: string;
  name: string;
  ext: string;
  mime: string;
  size: number;
}

export interface FileApi {
  openDialog(): Promise<FileRef | null>;
  ref(path: string): Promise<FileRef>;
  readBytes(path: string, range?: { start: number; end: number }): Promise<ArrayBuffer>;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  revealInExplorer(path: string): Promise<void>;
  openExternal(path: string): Promise<void>;
  watch(path: string, cb: (e: { type: "change" | "unlink" }) => void): () => void;
}

export interface ExtractedDoc {
  ref: FileRef;
  contentHash: string;
  text: string;
  pages?: { index: number; text: string }[];
  outline?: { title: string; page?: number; level: number }[];
  meta: Record<string, string | number>;
}

export interface DocApi {
  extract(path: string): Promise<ExtractedDoc>;
}

export type AnnotationKind = "highlight" | "note" | "comment";

export interface Anchor {
  page: number;
  rects: { x: number; y: number; w: number; h: number }[];
}

export interface Annotation {
  id: string;
  docPath: string;
  kind: AnnotationKind;
  anchor: Anchor;
  quotedText?: string;
  color?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  stale?: boolean;
}

export interface AnnotationsApi {
  list(docPath: string): Promise<Annotation[]>;
  add(input: Omit<Annotation, "id" | "createdAt" | "updatedAt">): Promise<Annotation>;
  update(id: string, patch: Partial<Pick<Annotation, "note" | "color">>): Promise<Annotation>;
  remove(id: string): Promise<void>;
}

export interface IndexStatus {
  docPath: string;
  state: "none" | "indexing" | "ready" | "error";
  chunks: number;
  dim: number;
  embedModel: string;
  error?: string;
}

export interface Citation {
  chunkId: string;
  page?: number;
  section?: string;
  snippet: string;
}

export interface Retrieved {
  chunkId: string;
  score: number;
  page?: number;
  section?: string;
  text: string;
}

export interface RagApi {
  index(docPath: string, opts?: { force?: boolean }): Promise<IndexStatus>;
  status(docPath: string): Promise<IndexStatus>;
  remove(docPath: string): Promise<void>;
  query(input: {
    docPath: string;
    question: string;
    selection?: string;
    topK?: number;
  }): Promise<{ retrieved: Retrieved[]; promptContext: string }>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  providerId: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  streamId: string;
}

export interface LlmApi {
  chatStream(req: ChatRequest): Promise<void>;
  abort(streamId: string): Promise<void>;
  models(providerId: string): Promise<ModelInfo[]>;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsEmbedding?: boolean;
  supportsChat?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  kind: "local" | "remote";
  configured: boolean;
  running?: boolean;
  chatModels: ModelInfo[];
  embeddingModels: ModelInfo[];
  baseUrl?: string;
  moduleId?: string;
  needsSecret?: boolean;
}

/** Describes an available provider adapter module so settings can build a "new provider" form.
 *  Added by `05-polish-packaging`. */
export interface ProviderModuleDescriptor {
  id: string;
  name: string;
  kind: "local" | "remote";
  needsSecret: boolean;
  defaultBaseUrl: string;
}

export interface ProvidersApi {
  list(): Promise<ProviderInfo[]>;
  detectLocal(): Promise<ProviderInfo[]>;
  test(providerId: string): Promise<{ ok: boolean; error?: string }>;
  modules(): Promise<ProviderModuleDescriptor[]>;
}

/** A user-managed provider entry persisted in settings. Overrides a built-in by `id`, or adds a
 *  custom provider when the `id` is not built in. Added by `05-polish-packaging`. */
export interface StoredProvider {
  id: string;
  name: string;
  moduleId: string;
  kind: "local" | "remote";
  baseUrl: string;
  needsSecret: boolean;
  catalogId?: string;
}

export type PanelTab = "chat" | "annotations" | "context" | "search";

export interface Settings {
  activeProviderId: string;
  activeChatModel: string;
  activeEmbeddingProviderId: string;
  activeEmbeddingModel: string;
  rag: { topK: number; chunkTokens: number; chunkOverlap: number; mmrLambda: number };
  ui: {
    theme: "dark" | "light" | "system";
    sidebarOpen: boolean;
    panelOpen: boolean;
    panelTab: PanelTab;
    sidebarSize?: number;
    panelSize?: number;
  };
  keysConfigured: Record<string, boolean>;
  recentFiles?: string[];
  providers?: StoredProvider[];
  hiddenProviders?: string[];
  onboardingComplete?: boolean;
}

export interface SettingsApi {
  get(): Promise<Settings>;
  set(patch: Partial<Settings>): Promise<Settings>;
  setSecret(providerId: string, secret: string): Promise<void>;
  clearSecret(providerId: string): Promise<void>;
}

export interface EventsApi {
  onChatToken(cb: (e: { streamId: string; delta: string }) => void): () => void;
  onChatDone(cb: (e: { streamId: string; usage?: unknown }) => void): () => void;
  onChatError(cb: (e: { streamId: string; error: string }) => void): () => void;
  onIndexProgress(cb: (e: { docPath: string; done: number; total: number; phase: string }) => void): () => void;
  onFileChanged(cb: (e: { path: string; type: "change" | "unlink" }) => void): () => void;
}

export type HealthState = "ok" | "degraded" | "down" | "unconfigured";

export interface HealthCheck {
  id: string;
  label: string;
  state: HealthState;
  detail: string;
  remediation?: string;
}

export interface HealthReport {
  chat: HealthCheck;
  embedding: HealthCheck;
  checkedAt: string;
}

/** Provider/embedding reachability checks. Added by `05-polish-packaging`. */
export interface HealthApi {
  check(): Promise<HealthReport>;
}

/** Result of checking GitHub Releases for a newer build than the running app. */
export interface UpdateInfo {
  current: string;
  latest: string | null;
  available: boolean;
  releaseUrl: string;
  installerUrl: string | null;
}

export interface UpdateApi {
  check(): Promise<UpdateInfo>;
  /** Download the latest installer asset and launch it. */
  install(): Promise<void>;
}

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrowserState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
}

/** In-app browser embedded in the Search tab via a main-process `WebContentsView`. */
export interface BrowserApi {
  open(url?: string): Promise<BrowserState>;
  navigate(url: string): Promise<void>;
  back(): Promise<void>;
  forward(): Promise<void>;
  reload(): Promise<void>;
  stop(): Promise<void>;
  home(): Promise<void>;
  setBounds(bounds: BrowserBounds): Promise<void>;
  setVisible(visible: boolean): Promise<void>;
  current(): Promise<BrowserState>;
  onState(cb: (state: BrowserState) => void): () => void;
}

export interface OnboardingChoices {
  providerId?: string;
  model?: string;
  embeddingProviderId?: string;
  embeddingModel?: string;
}

export interface OnboardingStatus {
  firstRun: boolean;
  detected: ProviderInfo[];
  suggestedChatProviderId?: string;
  suggestedChatModel?: string;
  suggestedEmbeddingProviderId: string;
  suggestedEmbeddingModel: string;
  embeddingReady: boolean;
}

/** First-run detection and setup guidance. Added by `05-polish-packaging`. */
export interface OnboardingApi {
  status(): Promise<OnboardingStatus>;
  complete(choices: OnboardingChoices): Promise<Settings>;
}

export interface ThreadsApi {
  save(thread: Thread): Promise<void>;
  load(docId: string): Promise<Thread | null>;
  list(): Promise<Thread[]>;
  remove(docId: string): Promise<void>;
  /** Open a native save dialog and write the thread as Markdown; resolves to the path, or null if
   *  cancelled. Added by `05-polish-packaging`. */
  exportMarkdown(thread: Thread): Promise<string | null>;
}

export interface Api {
  file: FileApi;
  doc: DocApi;
  annotations: AnnotationsApi;
  rag: RagApi;
  llm: LlmApi;
  providers: ProvidersApi;
  threads: ThreadsApi;
  settings: SettingsApi;
  events: EventsApi;
  health: HealthApi;
  onboarding: OnboardingApi;
  update: UpdateApi;
  browser: BrowserApi;
}

export interface OpenDoc {
  id: string;
  ref: FileRef;
  kind: "pdf" | "text" | "image" | "fallback";
  dirty: boolean;
}

export interface Thread {
  id: string;
  docId: string;
  title: string;
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: Citation[];
    createdAt: string;
  }[];
}
