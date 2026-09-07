import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    // Only alias the app-local "@/*" specifier. Do NOT alias "@repo" to the
    // packages directory: several packages (e.g. @repo/connectors) resolve
    // subpaths via package.json `exports` into a `src/` layout that doesn't
    // mirror the raw directory tree (`@repo/connectors/24sevenoffice` ->
    // `packages/connectors/src/24sevenoffice/index.ts`, not
    // `packages/connectors/24sevenoffice`). A blanket prefix alias would
    // bypass that map and break every test that transitively imports one of
    // those subpaths without mocking it. Normal workspace node_modules
    // resolution already handles "@repo/*" correctly, so leave it alone.
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
