import { BrowserWindow, WebContentsView, session, type WebContents } from "electron";
import { IPC } from "@shared/channels";
import type { BrowserBounds, BrowserState } from "@shared/types";
import { emitToRenderer } from "@main/events";

// A dedicated session so the app's strict CSP header (injected on defaultSession in index.ts)
// never applies to arbitrary web pages, and web permissions stay denied.
const PARTITION = "persist:rabrowser";
const HOME_URL = "https://duckduckgo.com";

const EMPTY_BOUNDS: BrowserBounds = { x: 0, y: 0, width: 0, height: 0 };

let hostWindow: BrowserWindow | null = null;
let view: WebContentsView | null = null;
let visible = false;
let bounds: BrowserBounds = EMPTY_BOUNDS;

function readState(contents: WebContents): BrowserState {
  const history = contents.navigationHistory;
  return {
    url: contents.getURL(),
    title: contents.getTitle(),
    canGoBack: history.canGoBack(),
    canGoForward: history.canGoForward(),
    loading: contents.isLoading()
  };
}

function emitState(contents: WebContents): void {
  if (contents.isDestroyed()) return;
  emitToRenderer(IPC.browser.state, readState(contents));
}

function applyBounds(): void {
  if (!view) return;
  const width = Math.max(0, Math.round(bounds.width));
  const height = Math.max(0, Math.round(bounds.height));
  view.setBounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width, height });
}

function ensureView(): WebContentsView | null {
  if (!hostWindow || hostWindow.isDestroyed()) return null;
  if (view && !view.webContents.isDestroyed()) return view;

  const browserSession = session.fromPartition(PARTITION);
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);

  const created = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  view = created;
  const contents = created.webContents;

  hostWindow.contentView.addChildView(created);
  applyBounds();
  created.setVisible(visible);

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void contents.loadURL(url);
    return { action: "deny" };
  });

  const emit = () => emitState(contents);
  contents.on("did-navigate", emit);
  contents.on("did-navigate-in-page", emit);
  contents.on("did-start-loading", emit);
  contents.on("did-stop-loading", emit);
  contents.on("did-fail-load", emit);
  contents.on("page-title-updated", emit);

  void contents.loadURL(HOME_URL).catch(() => undefined);
  return created;
}

function requireView(): WebContentsView {
  const created = ensureView();
  if (!created) throw new Error("Browser window is not ready");
  return created;
}

export function attachBrowser(window: BrowserWindow): void {
  hostWindow = window;
  view = null;
  visible = false;
  bounds = EMPTY_BOUNDS;
}

export function disposeBrowser(): void {
  if (view) {
    if (hostWindow && !hostWindow.isDestroyed()) hostWindow.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }
  view = null;
  hostWindow = null;
}

export function browserOpen(url?: string): BrowserState {
  const created = requireView();
  if (url && url.length > 0) void created.webContents.loadURL(url).catch(() => undefined);
  created.setVisible(true);
  visible = true;
  return readState(created.webContents);
}

export function browserNavigate(url: string): void {
  const created = requireView();
  void created.webContents.loadURL(url).catch(() => undefined);
}

export function browserBack(): void {
  const created = requireView();
  const history = created.webContents.navigationHistory;
  if (history.canGoBack()) history.goBack();
}

export function browserForward(): void {
  const created = requireView();
  const history = created.webContents.navigationHistory;
  if (history.canGoForward()) history.goForward();
}

export function browserReload(): void {
  requireView().webContents.reload();
}

export function browserStop(): void {
  const created = requireView();
  if (created.webContents.isLoading()) created.webContents.stop();
}

export function browserHome(): void {
  browserNavigate(HOME_URL);
}

export function browserSetBounds(next: BrowserBounds): void {
  bounds = {
    x: Number.isFinite(next.x) ? next.x : 0,
    y: Number.isFinite(next.y) ? next.y : 0,
    width: Number.isFinite(next.width) ? next.width : 0,
    height: Number.isFinite(next.height) ? next.height : 0
  };
  applyBounds();
}

export function browserSetVisible(next: boolean): void {
  visible = next;
  if (view && !view.webContents.isDestroyed()) view.setVisible(next);
}

export function browserCurrent(): BrowserState {
  if (view && !view.webContents.isDestroyed()) return readState(view.webContents);
  return { url: "", title: "", canGoBack: false, canGoForward: false, loading: false };
}
