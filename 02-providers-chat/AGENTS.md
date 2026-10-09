# AGENTS.md - M2: Provider Registry, Model Catalog, Streaming Chat, and Model Picker

## Mission
Build the provider registry that allows the application to interact with multiple LLM providers (OpenAI, Anthropic, etc.) through a unified interface. Implement a model catalog for managing models across providers and create streaming chat functionality.

## Scope
### In scope:
- Provider registry implementation
- Model catalog with metadata management  
- Streaming chat component with real-time responses
- Model picker UI element

### Out of scope:
- Full LLM integration (will be done in later workstreams)
- Authentication mechanisms for API keys (handled by foundation module)

## Depends on
- 00-foundation: IPC bridge, settings system
- 01-viewers: Document text extraction interface

## Deliverables  
- Provider registry and model catalog modules
- Streaming chat UI component with model selection
- Integration tests for provider interfaces

## Task checklist
1. [ ] Create provider registry module structure
2. [ ] Implement base provider interface
3. [ ] Add concrete provider implementations (OpenAI, Anthropic)
4. [ ] Build model catalog data structures and API  
5. [ ] Develop streaming chat UI component
6. [ ] Implement model picker UI element
7. [ ] Integrate with document text extraction from viewers
8. [ ] Write unit tests for provider interfaces

## Constraints
- Pure JavaScript dependencies only (no native modules)
- All filesystem, network, and key access happens in main process
- Match the contracts defined in docs/interfaces.md
- Security: API keys stored via safeStorage, never logged or serialized into renderer state

## Verification  
- [ ] Run npm run typecheck
- [ ] Run npm run lint
- [ ] Test that all providers can be registered
- [ ] Verify streaming chat UI works with mock responses  

## Done criteria
- All tasks in the checklist completed and verified
- Provider registry successfully registers multiple providers
- Model catalog stores and retrieves model metadata correctly  
- Streaming chat component handles response chunks properly
- Model picker displays available models from all registered providers

## Handoff notes
- Next workstream (03-annotations) will use this provider system to enable document annotation with LLMs
- Will need 01-viewers' document text extraction interface for context when querying models

## Status
- State: done (one contract gap, noted below)
- Branch/commit: `main` @ `03ad693` (the app lives in `Reading assistant/`, untracked inside the home repo)
- What works:
  - Provider registry `src/main/providers/`: `ProviderModule` per `docs/interfaces.md §2`; built-ins `ollama`, `openai-compatible`, `anthropic`, `gemini`; DeepSeek preset (`baseUrl=https://api.deepseek.com`, models `deepseek-chat`/`deepseek-reasoner`).
  - Model catalog: fetches/caches `https://models.dev/api.json` (in-memory + 24h disk cache at `userData/catalog/models.json`) with graceful offline fallback to per-provider `listModels()` / presets.
  - IPC `src/main/ipc/providers.ts` + `llm.ts`: `providers:list|detectLocal|test`, `llm:chatStream|abort|models`; `llm`/`providers` stubs removed from `stubs.ts`; streaming emits `llm:token`/`llm:done`/`llm:error` via `emitToRenderer`.
  - Preload: real `events.onChatToken/onChatDone/onChatError` subscriptions; `onIndexProgress` still throws (owned by 04).
  - Renderer: new `state/chatStore.ts` (threads + stream correlation per doc), `chat/Transcript.tsx`, `chat/ModelPicker.tsx`, `chat/context.ts`; reworked `panes/ChatTab.tsx` and `layout/Composer.tsx` (send builds `ChatRequest` with generated `streamId`, Stop/abort, selection chip, D6 first-run local default).
  - Optional RAG grounding: `window.api.rag.query` is called before send and its `promptContext` injected as a system message; `NotImplementedError` is caught and plain chat proceeds. Citations render as chips when present.
  - Tests: `src/main/providers/providers.test.ts` (11) + foundation (6) pass: `npm test`.
- Known gaps:
  - Thread persistence: `src/main/llm/threads.ts` implements save/load/list/remove to `userData/threads/<docId>.json` per `§5`, but it is NOT reachable from the renderer — no `threads` IPC channel exists. Threads are in-memory for the session.
  - `/export` and `/settings` slash commands are no-ops (no settings UI yet).
  - `assert provider configured` happens at send time; the picker shows unconfigured providers greyed as "no key" but does not block selecting them.
- Interfaces changed: none. Required addition (do not make unasked): a `ThreadsApi` (e.g. `threads:save|load|list|remove`) + `types.ts`/`channels.ts`/preload entry so `Thread` objects persist to `userData/threads/`.
- Environment notes: Node v24.15.0; no new runtime dependencies (global `fetch` + `AbortController` + hand-rolled SSE/NDJSON parsing). Verified clean: `npm run typecheck:node`, `npm run typecheck:web`, scoped ESLint, `npm test`.

### Update (2026-10-09) — `/models` palette; composer in Chat tab (D16)
- `chat/ModelPicker.tsx` removed. Replaced by `chat/ModelPalette.tsx` (a `/models` command /
  command-palette / header-button overlay; provider status + quick add-local-endpoint) and
  `chat/useDefaultModel.ts` (the old dropdown's local-first auto-select). See `docs/decisions.md` D16.
- The ask bubble (`layout/Composer.tsx`) now renders at the bottom of `panes/ChatTab.tsx` instead of
  under the document (`layout/AppShell.tsx`). The composer gained a slash-command autocomplete and
  wires `/export` and `/settings` (previously no-ops) to the thread export and settings modal.
- No provider/LLM protocol change; `Api` provider surface unchanged.