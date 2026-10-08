/// <reference types="vite/client" />

import type { Api } from "@shared/types";

declare global {
  interface Window {
    api: Api;
    desktop: {
      getPathForFile(file: File): string;
    };
  }
}

export {};
