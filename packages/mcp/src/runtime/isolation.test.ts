/**
 * Runtime isolation tests.
 *
 * The package's central structural claim is that it runs standalone: no
 * Next.js, no React, no request-bound API, no browser global. That claim is
 * easy to break by accident — a single value import from `@repo/api/server`
 * would pull `next/headers` in, and a value import from `@repo/editor/blocks`
 * would pull React and `@dnd-kit` in — and the breakage would not show up in a
 * unit test, only when someone tried to run the binary.
 *
 * So it is asserted here, against the real module graph after loading the
 * server factory.
 */

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Glob } from "bun";

const REACT_MODULE_RE = /\/node_modules\/react(-dom)?\//;
const NEXT_IMPORT_RE = /from\s+["']next\//;
const API_SERVER_IMPORT_RE = /from\s+["']@repo\/api\/server["']/;
const EDITOR_BLOCKS_IMPORT_RE = /from\s+["']@repo\/editor\/blocks["']/;
const BROWSER_DOM_RE = /\bdocument\.(?:getElementById|querySelector)\b/;
const BROWSER_GLOBAL_RE = /\bwindow\.(?:location|localStorage)\b/;
const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_RE = /^\s*\/\/.*$/gm;

const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: NEXT_IMPORT_RE, why: "Next.js runtime import" },
  {
    pattern: API_SERVER_IMPORT_RE,
    why: "@repo/api/server imports next/headers at module scope",
  },
  {
    pattern: EDITOR_BLOCKS_IMPORT_RE,
    why: "the block registry holds React component references",
  },
  { pattern: BROWSER_DOM_RE, why: "browser DOM" },
  { pattern: BROWSER_GLOBAL_RE, why: "browser global" },
];

describe("standalone runtime", () => {
  test("loading the server pulls in neither Next.js nor React", async () => {
    await import("../server");

    const loaded = Object.keys(require.cache ?? {});
    const next = loaded.filter((path) => path.includes("/node_modules/next/"));
    const react = loaded.filter((path) => REACT_MODULE_RE.test(path));

    expect(next).toEqual([]);
    expect(react).toEqual([]);
  });

  test("no source file imports a request-bound or browser API", async () => {
    // A grep rather than a runtime check: a conditional import would not show
    // up in the module graph above until the branch ran.
    const glob = new Glob("src/**/*.ts");
    const root = new URL("../..", import.meta.url).pathname;

    const violations: string[] = [];
    for await (const file of glob.scan({ cwd: root })) {
      if (file.endsWith(".test.ts") || file.includes("/testing/")) {
        continue;
      }
      const text = await readFile(`${root}/${file}`, "utf8");
      // Strip comments so a reference in prose does not trip the check.
      const code = text
        .replace(BLOCK_COMMENT_RE, "")
        .replace(LINE_COMMENT_RE, "");
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(code)) {
          violations.push(`${file}: ${why}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("type-only imports from page-builder are erased at runtime", async () => {
    // `services/pages.ts` imports PageDoc's TYPE from `@repo/api/page-builder`,
    // which itself imports `@repo/api/server`. That is safe only because the
    // import is type-only; a value import would drag Next in.
    await import("../services/pages");
    const loaded = Object.keys(require.cache ?? {});
    expect(
      loaded.filter((path) => path.includes("/packages/api/page-builder"))
    ).toEqual([]);
  });
});
