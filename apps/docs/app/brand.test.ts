import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const APP_ROOT = join(import.meta.dirname, "..");
const SCANNED_DIRS = ["app", "components", "lib"];
const SOURCE_FILE = /\.(ts|tsx|css)$/;
const TEST_FILE = /\.test\./;

const FORBIDDEN = [
  /gradient/i,
  /\bbg-(linear|radial|conic)\b/,
  /backdrop-blur/,
  /whileInView/,
  /next\/font\/google/,
  /hover:-translate-y/,
  /--font-inter/,
];

function sourceFiles(): string[] {
  return SCANNED_DIRS.flatMap((dir) =>
    readdirSync(join(APP_ROOT, dir), { recursive: true, encoding: "utf8" })
      .filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file))
      .map((file) => join(APP_ROOT, dir, file))
  );
}

test("scans the app's source", () => {
  expect(sourceFiles().length).toBeGreaterThan(0);
});

test("no off-brand patterns", () => {
  const violations = sourceFiles().flatMap((file) => {
    const content = readFileSync(file, "utf8");
    return FORBIDDEN.filter((pattern) => pattern.test(content)).map(
      (pattern) => `${relative(APP_ROOT, file)} matches ${pattern}`
    );
  });
  expect(violations).toEqual([]);
});
