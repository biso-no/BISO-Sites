import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../../..");
const DIRS = [
  "packages/editor/src",
  "apps/admin/src",
  "apps/web/src",
  "packages/api",
];
const SKIP = new Set(["node_modules", ".next", "dist"]);
const SOURCE = /\.(ts|tsx|css|mdx?)$/;
const BANNED =
  /accentColor|HUE_COLORS|accentForDepartment|DEPARTMENT_ACCENTS|AccentHue|apply_accent|applyAccent/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (SOURCE.test(name)) {
      yield path;
    }
  }
}

test("the five-swatch accent is gone from every source file", () => {
  const offenders: string[] = [];
  for (const dir of DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      if (file === import.meta.path) {
        continue;
      }
      if (BANNED.test(readFileSync(file, "utf8"))) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
  }
  expect(offenders).toEqual([]);
});
