# 00 — Foundation (M0)

## Mission

Stand up the entire application shell so every later workstream has a working, secure place to
add features: an Electron app built with `electron-vite`, a React + TypeScript renderer, a typed
and sandboxed preload IPC bridge, the three-region layout from `docs/layout.md`, a command
palette, theming, file opening (dialog + drag-and-drop), and a settings store with `safeStorage`
for secrets. Also establish and document the build/test commands for the whole repo.

## Scope

**In scope**
- Project scaffold, tooling, scripts, TypeScript strict config.
- Electron main + preload + renderer wiring with the security flags from `docs/architecture.md`.
- The preload bridge skeleton and IPC handler pattern (implement `file.*` fully; stub the rest).
- Layout shell: sidebar / document pane / tabbed side panel / composer / status bar.
- Command palette wiring and default keybinds from `docs/layout.md`.
- Dark theme + tokens; light/system toggle.
- `file.openDialog`, `file.ref`, `file.readBytes`, `file.readText`, `file.writeText`,
  `file.revealInExplorer`, `file.openExternal`, `file.watch`.
- Settings store (`settings.get`/`set`, `setSecret`/`clearSecret` via `safeStorage`).

**Out of scope**
- Any real document rendering beyond a placeholder (that is `01-viewers`).
- Providers, chat, annotations, RAG (later workstreams).

## Depends on

- `docs/interfaces.md` (implement the bridge exactly as specified).
- `docs/architecture.md` (stack, security, storage paths).
- `docs/layout.md` (layout, keybinds, theme).
- `docs/decisions.md` (D1, D2, D3, D12).

## Deliverables

- Working repo: `package.json`, `electron.vite.config.ts`, `tsconfig*.json`,
  `electron-builder.yml`, `.gitignore`, `.editorconfig`.
- `src/main/index.ts` — app lifecycle, window creation with security flags.
- `src/main/ipc/` — one handler module per domain (`file.ts`, `settings.ts`, and stubs).
- `src/preload/index.ts` — builds `window.api` per `docs/interfaces.md` §1.
- `src/renderer/` — React app, layout, palette, theme, placeholder panes.
- `src/shared/types.ts` — types shared by main/preload/renderer (mirror `docs/interfaces.md`).
- Updated command table in root `AGENTS.md` and `docs/architecture.md`.

## Task checklist

- [x] `npm init` + install `electron`, `electron-vite`, `vite`, `react`, `react-dom`,
      `typescript`, `@types/*`, `tailwindcss`, `zustand`, `react-resizable-panels`,
      `electron-builder`. Confirm every dependency is pure-JS.
- [x] Configure `electron-vite` (main / preload / renderer) and TS strict mode with path aliases.
- [x] Create the BrowserWindow with `contextIsolation: true`, `nodeIntegration: false`,
      `sandbox: true`; load the renderer; open DevTools in dev only.
- [x] Implement `src/shared/types.ts` from `docs/interfaces.md`.
- [x] Implement preload `contextBridge.exposeInMainWorld("api", ...)` with the full `Api` shape;
      unimplemented domains throw a typed "not implemented" error (not silently no-op).
- [x] Implement the IPC handler registration pattern and the `file` + `settings` handlers.
- [x] `safeStorage` key vault: `setSecret`, `clearSecret`, `keysConfigured` (never expose values).
- [x] Build the layout with `react-resizable-panels`: sidebar, document pane, side panel,
      composer, status bar. Persist panel sizes and open/closed state to settings.
- [x] Side panel with tabs Chat / Annotations / Context (empty states for now).
- [x] Command palette (`Ctrl+P`) and the keybinds listed in `docs/layout.md`.
- [x] Theme provider with dark default + light/system; wire tokens.
- [x] File open via dialog and via window drag-and-drop; show the file name in the document pane
      placeholder; wire `file.watch` and surface change events.
- [x] `.env`-free secret handling; verify no secret is ever written to renderer state or logs.
- [x] Record the final build/test/lint/typecheck commands in root `AGENTS.md` and
      `docs/architecture.md`.

## Constraints

- Follow all global rules in the root `AGENTS.md`.
- No native modules; no Node APIs in the renderer; all privileged work in main.
- Keep `docs/interfaces.md` authoritative — if the bridge shape changes, update the doc.
- Do not implement later-workstream logic even if it is tempting; leave clean seams.

## Verification

- `npm run dev` opens the app with the three-region layout; panes resize and state persists
  across relaunch.
- Open a text file via dialog and via drag-drop; the name shows in the document pane; editing
  the file on disk fires a watch event visible in the status bar.
- `Ctrl+P` opens the palette; listed keybinds work.
- `settings.setSecret("deepseek", "test")` then relaunch: `keysConfigured.deepseek === true`
  and the raw value appears nowhere in `settings.json` or logs.
- `npm run typecheck` and `npm run lint` pass.

## Done criteria

The app launches, is secure (flags verified in DevTools / `nodeIntegration` false), the full
layout is present and interactive, file open + watch + settings + secrets work end to end, and
the build/test commands are documented in the root `AGENTS.md`.

## Handoff notes

- `01-viewers`, `02-providers-chat`, and `04-rag-pipeline` all mount into the seams created here.
- Expose stable insertion points: a `DocPane` slot for renderers, a `SidePanel` tab registry,
  and a `Composer` that later workstreams extend.
- Document the exact IPC event-emitter utility so events (`llm:token`, `rag:progress`) are
  consistent for downstream workstreams.

## Status
- State: done (vertical slice)
- Branch/commit: branch `main`; no commit (per instructions, not requested)
- What works:
  - electron-vite scaffold (main / preload / renderer), TS strict with `@shared` / `@main` / `@renderer` aliases.
  - BrowserWindow with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; navigation + window-open denied in main.
  - Preload `window.api` matches `docs/interfaces.md` §1. `file.*` and `settings.*` fully implemented; `doc`/`annotations`/`rag`/`llm`/`providers` invoke-stubs throw a typed `NotImplementedError`; `events` chat/index subscriptions throw, `events.onFileChanged` works.
  - IPC pattern: `src/main/ipc/registry.ts` `handle()` wraps handlers in an `IpcResult` envelope; one module per domain.
  - `safeStorage` key vault (`setSecret`/`clearSecret`/`keysConfigured`); secrets never cross to the renderer or into `settings.json`.
  - Three-region layout via `react-resizable-panels` v4 (`Group`/`Panel`/`Separator`): sidebar, document pane + tab strip + composer, tabbed side panel (Chat/Annotations/Context empty states), status bar. Sizes and open/closed state persist to settings.
  - Command palette (`Ctrl+P`) + keybinds `Ctrl+O/P/B/J`, `Ctrl+1/2/3`, `Ctrl+Enter`, `Ctrl+F`, `Ctrl+S`, `Esc`.
  - Theme provider: dark default, light/system; Tailwind tokens from `docs/layout.md`.
  - File open via dialog and drag-and-drop; opened file name shown in the doc-pane fallback; `file.watch` + `events.onFileChanged` surface disk changes in the status bar.
  - Seams for later workstreams: `viewer/registry.ts` (DocPane slot), `panes/sidePanelRegistry.ts` (tab registry), `Composer`, and `main/events.ts` `emitToRenderer` (the shared event emitter).
  - `npm run typecheck`, `npm run lint`, `npm test` (6 tests), `npm run build` all pass.
- Known gaps:
  - No real renderers (01-viewers), providers/chat (02), annotations (03), RAG (04); palette "Re-index" surfaces the typed not-implemented error.
  - Responsive <768px drawers are a `TODO(05-polish-packaging)`; columns are used at all widths.
  - CSP allows `'unsafe-inline'` scripts to keep Vite dev HMR working; tighten for production in M5.
  - `window.desktop.getPathForFile` is an intentional extra preload global (see interfaces.md §1 note) required for drag-drop on Electron 32+.
- Interfaces changed:
  - `docs/interfaces.md` §1: added the `window.desktop.getPathForFile` platform-shim note.
  - `docs/interfaces.md` §1.7: `Settings.ui` gained `panelTab`, `sidebarSize?`, `panelSize?`; `Settings` gained `recentFiles?`.
  - `docs/interfaces.md` §1.1 `FileApi` is unchanged and matches exactly.
- Environment notes:
  - Node v24.15.0, npm 11.12.1, Windows.
  - Electron 44.7.0, electron-vite 5.0.0, Vite 7.3.7, React 19.3.0, TypeScript 5.9.3, Tailwind CSS 3.4.19, zustand 5.0.15, react-resizable-panels 4.14.3, vitest 5.0.3.
  - Tailwind pinned to v3 (v4 pulls the native `@tailwindcss/oxide`) to honor the pure-JS rule.
  - `npm install` ran no native compilation; runtime deps are pure JS.
