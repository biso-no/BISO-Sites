import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(import.meta.dir, "..", "..");
const RICH_ROOT = join(import.meta.dir, "rich");

/** `platejs`, `platejs/…` or `@platejs/…`. */
const PLATE_MODULE = String.raw`(?:platejs(?:\/[^"']*)?|@platejs\/[^"']+)`;
/**
 * A relative or `@/` path with `rich` as a whole segment (`./rich`,
 * `../text/rich/html`), so `./enrich` and `../lib/rich-allowlist` are not.
 */
const RICH_MODULE = String.raw`(?:\.{1,2}|@)\/(?:[^"']*\/)?rich(?:\/[^"']*)?`;
/** A default, namespace or named binding list, or `export *`. */
const BINDINGS = String.raw`(?:[\w$]+\s*,\s*)?(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\}|[\w$]+)`;

/**
 * A static, non-type `import … from`, `export … from` or side-effect
 * `import` of `module`, at the start of a line (so not in a line comment).
 */
const staticImportOf = (module: string): RegExp =>
  new RegExp(
    String.raw`^\s*(?:(?:import|export)\s+(?!type\b)${BINDINGS}\s*from|import)\s*["']${module}["']`,
    "m"
  );

const STATIC_PLATE = staticImportOf(PLATE_MODULE);
const STATIC_RICH = staticImportOf(RICH_MODULE);
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const read = (file: string): string => readFileSync(file, "utf8");

/** A static, non-type import of Plate or of the rich editor. */
const isGuarded = (source: string): boolean =>
  STATIC_PLATE.test(source) || STATIC_RICH.test(source);

const isInRich = (file: string): boolean =>
  !relative(RICH_ROOT, file).startsWith("..");

const files = walk(SRC_ROOT).filter(
  (f) => SOURCE_FILE.test(f) && !TEST_FILE.test(f) && !isInRich(f)
);
const richFiles = existsSync(RICH_ROOT)
  ? walk(RICH_ROOT).filter((f) => SOURCE_FILE.test(f) && !TEST_FILE.test(f))
  : [];

describe("Plate confinement", () => {
  test("no file outside blocks/text/rich statically imports Plate or the rich editor", () => {
    const offenders = files.filter((f) => isGuarded(read(f)));
    expect(offenders).toEqual([]);
  });

  test("the guard sees the rich folder's own Plate imports", () => {
    expect(richFiles.some((f) => STATIC_PLATE.test(read(f)))).toBe(true);
  });

  test.each([
    'import { x } from "platejs";',
    'import { y } from "@platejs/list/react";',
    'import Z from "./rich/field";',
    'import Z from "./rich";',
    'import { a } from "../rich/html";',
    'import { a } from "../text/rich/html";',
    'export { b } from "platejs";',
    'export * from "@platejs/table";',
    'import "platejs";',
    'import "@platejs/table/react";',
    'import {\n  a,\n  b,\n} from "platejs";',
  ])("the guard catches %s", (source) => {
    expect(isGuarded(source)).toBe(true);
  });

  test.each([
    'import type { V } from "platejs";',
    'export type { V } from "platejs";',
    'const m = await import("./rich/field");',
    'import { x } from "./enrich";',
    '// import { x } from "platejs";',
    'import { a } from "../lib/rich-allowlist";',
    'import { a } from "./rich-allowlist";',
  ])("the guard lets %s through", (source) => {
    expect(isGuarded(source)).toBe(false);
  });
});
