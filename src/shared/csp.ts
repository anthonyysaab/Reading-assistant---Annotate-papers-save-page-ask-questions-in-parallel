/**
 * The Content-Security-Policy shared by the renderer `<meta>` tag (injected at build time by
 * `electron.vite.config.ts`) and the runtime response header (set in the main process). Dev needs
 * `'unsafe-inline'` scripts for the Vite/React refresh preamble and `ws:` for HMR; the packaged app
 * allows neither.
 */
export function buildContentSecurityPolicy(dev: boolean): string {
  const scriptSrc = dev ? "'self' 'unsafe-inline'" : "'self'";
  const connectSrc = dev ? "'self' ws: wss:" : "'self'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join("; ");
}
