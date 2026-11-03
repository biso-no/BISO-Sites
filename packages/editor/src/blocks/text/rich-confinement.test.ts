import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(import.meta.dir, "..", "..");
const RICH_ROOT = join(import.meta.dir, "rich");

const STATIC_PLATE =
  /^\s*import\s+(?!type\b)[^;]*?from\s+["'](?:platejs|@platejs\/[^"']+)(?:\/[^"']*)?["']/m;
const STATIC_RICH =
  /^\s*import\s+(?!type\b)[^;]*?from\s+["'](?:\.\/rich\/|@\/blocks\/text\/rich\/)[^"']*["']/m;
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
  ])("the guard catches %s", (source) => {
    expect(isGuarded(source)).toBe(true);
  });

  test.each([
    'import type { V } from "platejs";',
    'const m = await import("./rich/field");',
  ])("the guard lets %s through", (source) => {
    expect(isGuarded(source)).toBe(false);
  });
});
