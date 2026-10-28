import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluate, findLeaks } from "./private-leak-check";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "leak-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("finds a sentinel in a nested text file", () => {
  mkdirSync(join(dir, "a", "b"), { recursive: true });
  writeFileSync(
    join(dir, "a", "b", "page.html"),
    "<p>hello SENTINEL-1 bye</p>"
  );
  writeFileSync(join(dir, "clean.js"), "nothing here");
  expect(findLeaks(dir, ["SENTINEL-1", "SENTINEL-2"])).toEqual([
    { file: join(dir, "a", "b", "page.html"), sentinel: "SENTINEL-1" },
  ]);
});

test("finds a sentinel inside a binary file", () => {
  const bytes = Buffer.concat([
    Buffer.from([0, 255, 1, 2, 0]),
    Buffer.from("SENTINEL-BIN"),
    Buffer.from([0, 9, 200]),
  ]);
  writeFileSync(join(dir, "blob.bin"), bytes);
  expect(findLeaks(dir, ["SENTINEL-BIN"])).toHaveLength(1);
});

test("reports every sentinel per file and none when clean", () => {
  writeFileSync(join(dir, "both.txt"), "AAA and BBB");
  expect(findLeaks(dir, ["AAA", "BBB"])).toHaveLength(2);
  expect(findLeaks(dir, ["CCC"])).toEqual([]);
});

test("returns nothing for a missing directory", () => {
  expect(findLeaks(join(dir, "nope"), ["AAA"])).toEqual([]);
});

test("evaluate passes only with no leaks and the marker present", () => {
  expect(evaluate([], true).ok).toBe(true);
  expect(evaluate([], false).ok).toBe(false);
  expect(evaluate([{ file: "f", sentinel: "s" }], true).ok).toBe(false);
});
