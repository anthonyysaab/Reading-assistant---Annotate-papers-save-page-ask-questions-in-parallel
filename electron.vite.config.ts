import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

// pdf.js fetches CMaps, standard fonts, and WASM decoders (JBIG2/JPEG2000) at runtime. Vite only
// bundles the worker, so those directories are copied from the dependency into the renderer's
// public dir, which Vite serves in dev and emits into `out/renderer` for the packaged app.
const PDFJS_ASSET_DIRS = ["cmaps", "standard_fonts", "wasm"] as const;

function pdfjsAssets(): Plugin {
  const source = resolve("node_modules/pdfjs-dist");
  const target = resolve("src/renderer/public/pdfjs");
  const copy = (): void => {
    mkdirSync(target, { recursive: true });
    for (const name of PDFJS_ASSET_DIRS) {
      const from = resolve(source, name);
      if (!existsSync(from)) continue;
      const to = resolve(target, name);
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
    }
  };
  return {
    name: "pdfjs-assets",
    configureServer() {
      copy();
    },
    buildStart() {
      copy();
    }
  };
}

// The static meta tag cannot differ between dev and production, so it is injected here: dev needs
// `'unsafe-inline'` scripts for the Vite/React refresh preamble, and `ws:`/`wss:` for HMR, while
// the packaged app must not allow inline scripts at all.
function contentSecurityPolicy(): Plugin {
  return {
    name: "csp",
    transformIndexHtml(_html, ctx) {
      const dev = Boolean(ctx.server);
      const scriptSrc = dev ? "'self' 'unsafe-inline'" : "'self'";
      const connectSrc = dev ? "'self' ws: wss:" : "'self'";
      const content = [
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
      return {
        html: _html,
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content },
            injectTo: "head-prepend"
          }
        ]
      };
    }
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@main": resolve("src/main")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    }
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@renderer": resolve("src/renderer/src")
      }
    },
    plugins: [pdfjsAssets(), contentSecurityPolicy(), react()]
  }
});
