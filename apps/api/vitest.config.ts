import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Only alias the app-local "@/*" specifier. Do NOT alias "@repo" to the
    // packages directory: workspace packages map their subpaths through
    // package.json `exports` into a `src/` layout that does not mirror the raw
    // directory tree (`@repo/payment/reconcile` -> `packages/payment/src/
    // reconcile.ts`, not `packages/payment/reconcile.ts`). A blanket prefix
    // alias bypasses that map, and only appeared to work because the three
    // subpaths this app already imported happen to have root-level shim files.
    // Normal workspace node_modules resolution handles "@repo/*" correctly.
    // Same reasoning, and the same fix, as apps/web's config.
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
