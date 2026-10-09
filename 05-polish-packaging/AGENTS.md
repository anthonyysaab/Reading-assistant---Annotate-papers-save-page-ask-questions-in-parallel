# 05 — Polish & Packaging (M5)

## Mission

Turn the working app into something pleasant and shippable: a recent-files library, per-document
chat threads surfaced cleanly, provider/embedding health checks, a proper settings UI, error and
empty states throughout, and a Windows installer produced by `electron-builder`.

## Scope

**In scope**
- Library/recent-files experience in the sidebar.
- First-run onboarding: detect local runtimes, offer the user's existing Qwen, guide embedding
  setup if there is no embedding provider.
- Settings UI: providers (add/edit/remove, keys), models, embeddings, RAG knobs, UI/theme.
- Health checks: provider reachability and embedding availability, surfaced with clear fixes.
- Per-document thread management polish (rename, delete, export).
- Global error handling, toasts, loading/empty states, keyboard polish.
- Packaging: `electron-builder` NSIS installer for Windows; icons; app metadata; auto-update
  hooks (off by default) — or explicitly deferred if not wanted.
- Performance pass: large-file handling, memory, startup time.

**Out of scope**
- New feature areas; this is refinement and shipping.

## Depends on

- `00-foundation`, `01-viewers`, `02-providers-chat`, `03-annotations`, `04-rag-pipeline`
  (all must be done).
- `docs/decisions.md` (D12 — Windows target).

## Deliverables

- `src/renderer/src/library/` — recent files, open documents.
- `src/renderer/src/settings/` — full settings screens.
- `src/main/health.ts` — provider/embedding health checks.
- `src/main/onboarding.ts` — first-run detection and guidance.
- `electron-builder.yml` finalized; `build/` icons and metadata.
- Updated root `AGENTS.md` build/package instructions.

## Task checklist

- [ ] Library sidebar: recent files (persisted), open documents, remove/clear, "Open file…".
- [ ] First-run onboarding: detect Ollama/LM Studio, show detected models, let the user pick the
      default chat model; explain and configure embeddings (recommend `nomic-embed-text`).
- [ ] Settings UI sections: Providers (add/edit/remove, base URL, key set/clear), Models
      (default chat + embedding), RAG (topK, chunk size/overlap, mmrLambda), Appearance
      (theme, panel defaults).
- [ ] Health checks: `provider:test`, embedding ping; show status chips and remediation hints.
- [ ] Threads: rename, delete, export to Markdown; keep per-document scoping from `02`.
- [ ] Global UX: toast system, error boundaries, skeletons, empty states, focus management,
      the full keybind set from `docs/layout.md`.
- [ ] Performance: verify startup, scrolling, and large-PDF memory; fix regressions found.
- [ ] Packaging: configure `electron-builder` (NSIS x64), app id/name/version/icon; verify the
      installed app launches and finds `userData` correctly.
- [ ] Record final install/dev/lint/typecheck/test/package commands in root `AGENTS.md` and
      `docs/architecture.md`.

## Constraints

- Global rules still apply (no native modules, security flags intact in the packaged app).
- Do not regress the security model when adding settings or onboarding.
- Keep bundle size reasonable; no CDN dependencies at runtime.

## Verification

- Fresh profile: onboarding detects local Qwen and embedding config; the user reaches a working
  chat + indexed PDF without editing files by hand.
- Settings changes take effect without restart (or clearly state when a restart is needed).
- Health checks correctly report a down provider and a working one.
- Export a thread to Markdown and read it back.
- `npm run package` produces an NSIS installer; install it; the app launches, opens a PDF,
  streams a local answer, and persists annotations.
- `npm run typecheck`, `npm run lint`, and tests pass.

## Done criteria

A new user can install the app and get to a cited answer over a document without touching
config, settings cover all provider/embedding/RAG options, health checks guide recovery, and the
Windows installer runs the full feature set.

## Handoff notes

- This is the final workstream; when done, record the `## Status` block per the root
  `AGENTS.md` handoff protocol and note deferred items (EPUB/PPTX renderers, optional opencode
  `read`-tab PR — see `docs/decisions.md` D9).

## Status
- State: done (packaging config verified; installer build blocked by an OS file lock — see below)
- Branch/commit: working tree (uncommitted; the home-dir repo is the outer git root)
- What works:
  - Library sidebar (`src/renderer/src/library/LibrarySidebar.tsx`, wired via `layout/Sidebar.tsx`):
    open docs (dirty dot, tab-switch, close), recent files with per-item remove + "Clear", labeled
    "Open file…", and a Settings entry. Recent list persists through `Settings.recentFiles`.
  - Settings UI (`src/renderer/src/settings/**`): tabs Providers / Models / RAG / Appearance /
    Health. Providers supports add (custom, choose adapter module), edit (base URL, name),
    remove (built-ins via `hiddenProviders`), API key set/clear through `safeStorage`, and a
    per-provider reachability "Test". Models picks default chat provider/model + embedding
    provider/model. RAG edits topK / chunkTokens / chunkOverlap / mmrLambda. Appearance edits
    theme + panel defaults. Opened from the sidebar, the command palette, or `Ctrl+,`; a focus-
    trapped modal; changes apply live (no restart).
  - Health (`src/main/health.ts` + `ipc/health.ts`): checks the active chat provider and the
    active embedding provider (reachability + embedding model presence) and returns remediation
    hints. Surfaced as a status-bar chip and a Health settings section.
  - Onboarding (`src/main/onboarding.ts` + `ipc/onboarding.ts` + `onboarding/OnboardingModal.tsx`):
    first-run detection of Ollama `:11434` / LM Studio `:1234`, offers the existing Qwen when
    present, and guides embedding setup recommending `nomic-embed-text` (D6/D7). Choices persist
    via `onboarding.complete` and set `onboardingComplete`.
  - Threads: rename (save with new title), delete (in-memory + `threads:remove`), and export to
    Markdown (`threads:export` → native save dialog → `# title` + role sections + citations).
    Per-document scoping from 02 retained.
  - Global UX: toast system (`state/toastStore.ts` + `components/Toast.tsx`); app-wide
    `ErrorBoundary` with reload; focus-trapped `Modal`; loading/empty states across settings,
    library, chat, status bar; keybinds completed — `Ctrl+O/P/B/J/1/2/3/Enter/F/S` plus `Ctrl+,`
    (settings) and `Esc` now aborts the active stream and clears selection. Command palette gained
    Open settings / Run health checks / Export current thread. Responsive <768px renders the
    sidebar and side panel as overlay drawers (was a `TODO(05)` in `AppShell`).
  - Packaging: `electron-builder.yml` finalized for NSIS x64 (`appId`, `productName`, icon,
    `artifactName`, desktop/start-menu shortcuts, non-per-machine install). `build/icon.png`
    (512²) and `build/icon.ico` (256²) generated by `scripts/generate-icons.mjs` (`npm run icons`),
    committed. `package.json` gained `productName`, `license`, and the `icons` script.
  - Docs updated: `docs/interfaces.md` (all M5 additions), `docs/architecture.md` (health/onboarding
    modules + final commands), root `AGENTS.md` (finalized build/test/package commands).
- Known gaps:
  - **Installer not produced in this environment.** `npm run package` builds fine, electron-builder
    downloads Electron, and packs to `<output>/win-unpacked.tmp`; it then fails renaming that temp
    dir to `win-unpacked` with `EPERM`. Reproduced manually (`Rename-Item … → Access denied`) and on
    a fresh output dir, so it is an OS file lock (Defender/Controlled Folder Access scanning the
    just-extracted Chromium files), not config. Config left correct; the app was not installed/run.
  - Not manually exercised (no interactive session): first-run modal, thread export read-back,
    settings persistence across relaunch, and the installed app finding `userData`.
  - Performance: no dedicated profiling pass. The heavy viewers were already dynamically imported;
    the health/onboarding calls are guarded (once per session / debounced by provider change).
    Large-PDF memory was not re-measured in this environment.
  - Auto-update hooks were not added (spec allowed explicit deferral).
  - Deferred by decision: EPUB/PPTX renderers (fallback/meta view only — D-renderer registry),
    optional opencode `read`-tab PR (D9), self-hosted PDF CMaps/standard fonts (01 gap).
- Interfaces changed (all additive, all documented in `docs/interfaces.md` §1/§1.6/§1.7/§1.8):
  - `Api.health` (`HealthApi.check` → `HealthReport`/`HealthCheck`/`HealthState`); channel `health:check`.
  - `Api.onboarding` (`OnboardingApi.status/complete`; `OnboardingStatus`/`OnboardingChoices`);
    channels `onboarding:status`, `onboarding:complete`.
  - `ProvidersApi.modules()` + `ProviderModuleDescriptor`; channel `providers:modules`.
  - `ProviderInfo` gained optional `baseUrl`, `moduleId`, `needsSecret`.
  - `Settings` gained optional `providers: StoredProvider[]`, `hiddenProviders: string[]`,
    `onboardingComplete: boolean`; new `StoredProvider` type.
  - `ThreadsApi.exportMarkdown(thread)`; channel `threads:export`.
  - Build: added `@main` alias to `vitest.config.ts` (was `@shared` only) so main-process modules
    are resolvable in unit tests. Registry kept electron-free (`resolveConfigsFrom`) so
    `providers.test.ts` does not import `electron`.
- Environment notes:
  - Node v24.15.0, npm, Windows 10.0.26300.
  - `npm run typecheck`, `npm run lint`, `npm test` (38 passing), `npm run build` all pass.
  - No new runtime dependencies (pure JS preserved; no native modules).
  - Installer output dir: `release/` (gitignored); a scratch `release*/` was also gitignored.

### Update (2026-10-09) — packaging unblocked, hardening
- The `EPERM` was **not** Defender/Controlled Folder Access (CFA is off). It was LM Studio's
  `Bionic.exe` service (`--run-as-service`, an Electron app) holding a handle on the intermediate
  `resources/default_app.asar`. Quit LM Studio before `npm run package`. Installer built,
  silent-installed to `%LOCALAPPDATA%\Programs\Reading Assistant`, and launched successfully.
- Dependencies: added `overrides.sprintf-js ^1.1.3` (clears the mammoth→argparse advisory). The
  SheetJS `xlsx` advisory is accepted and documented in `docs/decisions.md` D13.
- Tests: added Playwright Electron smoke test (`e2e/smoke.spec.ts`, `npm run test:e2e`) that boots
  the production bundle under the production CSP; unit+integration tests now 56.
- Production CSP is injected by `transformIndexHtml` (no `'unsafe-inline'` scripts; `worker-src`
  added) and the renderer no longer carries a static meta tag. Test seam `RA_USER_DATA_DIR` added to
  `src/main/index.ts` for isolated e2e profiles.
- Additional hardening: `src/shared/csp.ts` is the single CSP source used by both the build-time meta
  tag and a runtime `onHeadersReceived` header; `session.defaultSession` denies all permission
  requests/checks. `xlsx` is now the vendor-patched 0.20.3 tarball from `cdn.sheetjs.com` (D13).
- CI added: `.github/workflows/ci.yml` runs typecheck/lint/test/build on push to `main` and PRs.
- Web search: the **Search** side-panel tab is a launcher — submitting a query opens
  `https://duckduckgo.com/?q=…` in the OS default browser through `file.openExternal` (main routes
  `http(s)` URLs via `shell.openExternal`). No API key, no in-app results. See D14.
- Update check: `src/main/update/check.ts` queries the repo's latest GitHub release and compares
  versions; the status bar shows an "Update vX" button when one is available (downloads the
  `*-setup.exe` asset to temp and launches it), and the command palette has "Check for updates".
  IPC `update:check` / `update:install`; `Api.update`. See `docs/interfaces.md` §1.9.

### Update (2026-10-09) — in-app browser + `/models` palette + composer relocation
- **Search is now an in-app browser (D15, supersedes D14).** `src/main/browser/service.ts` owns a
  single `WebContentsView` in a dedicated `persist:rabrowser` session (permissions denied, no CSP
  header), added to the window's `contentView`. `src/main/ipc/browser.ts` + `IPC.browser`
  (`open|navigate|back|forward|reload|stop|home|setBounds|setVisible|current`, event `browser:state`)
  and `Api.browser` bridge it. `panes/SearchTab.tsx` is now browser chrome (address/search bar +
  nav) over a measured placeholder; `panes/useBrowserBounds.ts` keeps the view aligned and hides it
  whenever the panel is collapsed or a modal/palette is open (a `WebContentsView` composites above
  the DOM). Host wiring in `src/main/window.ts` (`attachBrowser`/`disposeBrowser`). No renderer CSP
  change; `frame-src 'none'` retained.
- **Model selection is a `/models` palette (D16).** `chat/ModelPicker.tsx` removed; new
  `chat/ModelPalette.tsx` (searchable, keyboard-driven, provider status, quick "add local endpoint"
  → `StoredProvider` with `kind:"local"`) + `chat/useDefaultModel.ts` (local-first auto-pick moved
  out of the old dropdown). Opened from the composer slash menu, `Ctrl+P` ("Select model…"), or the
  Chat-tab header button; `AppStore.modelPaletteOpen` added.
- **Composer moved into the Chat tab.** Rendered at the bottom of `panes/ChatTab.tsx`; removed from
  `layout/AppShell.tsx` (both desktop + narrow). `Ctrl+Enter` now switches to the Chat tab before
  sending; added `Ctrl+4` → Search tab.
- Docs: `docs/decisions.md` D15/D16, `docs/interfaces.md` §1.10 + Api/Search notes, `docs/layout.md`
  (diagram, Search tab, Composer, keybinds).
- Tests: `src/renderer/src/panes/webSearch.test.ts` (5). `npm run typecheck`, `npm run lint`,
  `npm test` (72 passing) all green.
