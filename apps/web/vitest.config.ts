import path from "node:path";
import { defineConfig } from "vitest/config";

const WEB_SRC = path.resolve(import.meta.dirname, "./src");
const EDITOR_SRC = path.resolve(
  import.meta.dirname,
  "../../packages/editor/src"
);

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  plugins: [
    {
      // "@/*" as tsconfig.json resolves it: this app's src, then the
      // editor's, whose own files use the same alias (tests import editor
      // modules such as SectionView by path). A file inside the editor tries
      // the editor first, so it never picks up a same-named app module. What
      // resolves nowhere maps into this app's src, as the plain alias did.
      //
      // Only "@/*" is handled. Do NOT alias "@repo" to the packages
      // directory: several packages (e.g. @repo/connectors) resolve subpaths
      // via package.json `exports` into a `src/` layout that doesn't mirror
      // the raw directory tree (`@repo/connectors/24sevenoffice` ->
      // `packages/connectors/src/24sevenoffice/index.ts`, not
      // `packages/connectors/24sevenoffice`). A blanket prefix alias would
      // bypass that map and break every test that transitively imports one
      // of those subpaths without mocking it. Normal workspace node_modules
      // resolution already handles "@repo/*" correctly, so leave it alone.
      enforce: "pre",
      name: "web-app-alias",
      async resolveId(source, importer, options) {
        if (!source.startsWith("@/")) {
          return null;
        }
        const rest = source.slice(2);
        const roots = importer?.startsWith(EDITOR_SRC)
          ? [EDITOR_SRC, WEB_SRC]
          : [WEB_SRC, EDITOR_SRC];
        for (const root of roots) {
          const resolved = await this.resolve(path.join(root, rest), importer, {
            ...options,
            skipSelf: true,
          });
          if (resolved) {
            return resolved;
          }
        }
        return path.join(WEB_SRC, rest);
      },
    },
  ],
  test: {
    environment: "node",
  },
});
