import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

/**
 * `sanitize-doc.ts` pulls in sanitize-html (and with it htmlparser2 and
 * postcss). A client module importing it would ship all of that to every
 * visitor, so only server code may: route pages (server components), the
 * admin's server actions, the one server pipeline named below, and tests.
 * Its `import "server-only"` makes a client import fail the build; this test
 * names the offender before that.
 */
const REPO_ROOT = join(import.meta.dir, "../../../..");
const EXTENSIONS = "{ts,tsx,js,jsx,mjs,cjs}";
const SCAN = [`packages/**/*.${EXTENSIONS}`, `apps/*/src/**/*.${EXTENSIONS}`];
const SKIPPED_DIR = /(?:^|\/)(?:node_modules|\.next|dist)\//;
const MODULE = "packages/editor/src/editor/sanitize-doc.ts";

const IMPORTS_SANITIZE_DOC =
  /["'](?:@repo\/editor\/sanitize|[^"']*\/sanitize-doc(?:\.ts)?)["']/;
const IMPORTS_SANITIZE_HTML = /["']sanitize-html["']/;

/** Comments and blank space a file may open with before its directive. */
const PROLOGUE = String.raw`^(?:\s|//[^\n]*|/\*[\s\S]*?\*/)*`;
const USE_CLIENT = new RegExp(`${PROLOGUE}["']use client["']`);
const USE_SERVER = new RegExp(`${PROLOGUE}["']use server["']`);

const TEST_FILE = /\.(?:test|cases)\.[cm]?[jt]sx?$/;
const ROUTE_PAGE = /^apps\/[^/]+\/src\/app\/.+\/page\.[jt]sx?$/;
const SERVER_ACTION = /^apps\/admin\/src\/app\/.+\/_actions\/[^/]+\.[jt]s$/;
/**
 * The one importer that is neither a route page nor a server action: the
 * website's published-page pipeline, which the catch-all, unit and project
 * route pages (all server components) call to normalize, sanitize and render
 * a stored page. Named by exact path, not by pattern, so the guard stays as
 * tight as before for every other module; it still fails as a client module.
 */
const SERVER_PIPELINES = new Set([
  "apps/web/src/lib/published-editor-page.tsx",
]);

function sourceFiles(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];
  for (const pattern of SCAN) {
    for (const path of new Glob(pattern).scanSync({ cwd: REPO_ROOT })) {
      if (!SKIPPED_DIR.test(path)) {
        files.push({
          path,
          source: readFileSync(join(REPO_ROOT, path), "utf8"),
        });
      }
    }
  }
  return files;
}

/** Why a non-test importer may not import the module, or null when it may. */
function offence(path: string, source: string): string | null {
  if (USE_CLIENT.test(source)) {
    return "is a client module";
  }
  if (ROUTE_PAGE.test(path) || SERVER_PIPELINES.has(path)) {
    return null;
  }
  if (SERVER_ACTION.test(path)) {
    return USE_SERVER.test(source) ? null : 'lacks "use server"';
  }
  return "is not a route page or a server action";
}

describe("the directive matchers", () => {
  test("see a directive behind line and block comments", () => {
    expect(USE_CLIENT.test('"use client";')).toBe(true);
    expect(USE_CLIENT.test("// note\n'use client';")).toBe(true);
    expect(USE_CLIENT.test('/**\n * Doc.\n */\n"use client";')).toBe(true);
    expect(USE_SERVER.test('/* a */ // b\n"use server";')).toBe(true);
  });

  test("ignore a directive that is not the file's first statement", () => {
    expect(USE_CLIENT.test('import x from "y";\n"use client";')).toBe(false);
    expect(USE_SERVER.test('const s = "use server";')).toBe(false);
  });
});

describe("the importer rules", () => {
  test("allow the named pipeline, and no other library module", () => {
    expect(offence("apps/web/src/lib/published-editor-page.tsx", "")).toBe(
      null
    );
    expect(offence("apps/web/src/lib/published-editor-page-2.tsx", "")).toBe(
      "is not a route page or a server action"
    );
    expect(offence("apps/web/src/lib/other.tsx", "")).toBe(
      "is not a route page or a server action"
    );
    expect(
      offence("apps/web/src/lib/published-editor-page.tsx", '"use client";')
    ).toBe("is a client module");
  });
});

describe("the server-only rich-text sanitizer", () => {
  const files = sourceFiles();
  const importers = files.filter(
    ({ path, source }) =>
      !TEST_FILE.test(path) && IMPORTS_SANITIZE_DOC.test(source)
  );

  test('opens with import "server-only"', () => {
    const source = readFileSync(join(REPO_ROOT, MODULE), "utf8");
    expect(source).toMatch(new RegExp(`${PROLOGUE}import "server-only";`));
  });

  test("the scan sees the routes and actions that sanitize", () => {
    // Guards the scan itself: a wrong root would find nothing and pass. The
    // public route pages sanitize through the shared pipeline now.
    expect(importers.map((f) => f.path).sort()).toEqual(
      expect.arrayContaining([
        "apps/admin/src/app/(portal)/_actions/departments.ts",
        "apps/admin/src/app/(portal)/_actions/pages.ts",
        ...SERVER_PIPELINES,
      ])
    );
  });

  test("is imported only by server pages and server actions", () => {
    const offenders = importers.flatMap(({ path, source }) => {
      const reason = offence(path, source);
      return reason ? [`${path} ${reason}`] : [];
    });

    expect(offenders).toEqual([]);
  });

  test("is the only module that imports sanitize-html", () => {
    const direct = files
      .filter(
        ({ path, source }) =>
          !TEST_FILE.test(path) && IMPORTS_SANITIZE_HTML.test(source)
      )
      .map((f) => f.path);

    expect(direct).toEqual([MODULE]);
  });
});
