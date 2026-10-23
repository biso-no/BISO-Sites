import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

/**
 * `sanitize-doc.ts` pulls in sanitize-html (and with it htmlparser2 and
 * postcss). A client module importing it would ship all of that to every
 * visitor, so only server code may: route pages (server components), the
 * admin's server actions, and tests.
 */
const REPO_ROOT = join(import.meta.dir, "../../../..");
const SCAN = ["packages/editor/src/**/*.{ts,tsx}", "apps/*/src/**/*.{ts,tsx}"];

const IMPORTS_SANITIZE_DOC =
  /["'](?:@repo\/editor\/sanitize|[^"']*\/sanitize-doc(?:\.ts)?)["']/;
const IMPORTS_SANITIZE_HTML = /["']sanitize-html["']/;
const USE_CLIENT = /^\s*(?:\/\/[^\n]*\n\s*)*["']use client["']/;

const TEST_FILE = /\.(?:test|cases)\.tsx?$/;
const SERVER_CALLERS = [
  /^apps\/[^/]+\/src\/app\/.+\/page\.tsx$/,
  /^apps\/admin\/src\/app\/.+\/_actions\/[^/]+\.ts$/,
];

function sourceFiles(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];
  for (const pattern of SCAN) {
    for (const path of new Glob(pattern).scanSync({ cwd: REPO_ROOT })) {
      files.push({ path, source: readFileSync(join(REPO_ROOT, path), "utf8") });
    }
  }
  return files;
}

describe("the server-only rich-text sanitizer", () => {
  const files = sourceFiles();
  const importers = files.filter(
    ({ path, source }) =>
      !TEST_FILE.test(path) && IMPORTS_SANITIZE_DOC.test(source)
  );

  test("the scan sees the routes and actions that sanitize", () => {
    // Guards the scan itself: a wrong root would find nothing and pass.
    expect(importers.map((f) => f.path).sort()).toEqual(
      expect.arrayContaining([
        "apps/admin/src/app/(portal)/_actions/departments.ts",
        "apps/admin/src/app/(portal)/_actions/pages.ts",
        "apps/web/src/app/(public)/[...slug]/page.tsx",
        "apps/web/src/app/(public)/units/[...segments]/page.tsx",
      ])
    );
  });

  test("is imported only by server pages and server actions", () => {
    const offenders = importers
      .filter(
        ({ path, source }) =>
          USE_CLIENT.test(source) ||
          !SERVER_CALLERS.some((allowed) => allowed.test(path))
      )
      .map((f) => f.path);

    expect(offenders).toEqual([]);
  });

  test("is the only module that imports sanitize-html", () => {
    const direct = files
      .filter(
        ({ path, source }) =>
          !TEST_FILE.test(path) && IMPORTS_SANITIZE_HTML.test(source)
      )
      .map((f) => f.path);

    expect(direct).toEqual(["packages/editor/src/editor/sanitize-doc.ts"]);
  });
});
