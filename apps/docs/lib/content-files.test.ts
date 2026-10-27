import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AREA_ROOTS, resolveHref } from "./content-files";

test("resolves the landing", () => {
  expect(resolveHref("/")).toEqual({ kind: "landing" });
});

test("resolves an area index", () => {
  expect(resolveHref("/guide")).toEqual({
    kind: "page",
    file: "content/docs/guide/index.mdx",
  });
});

test("ignores hash and query", () => {
  expect(resolveHref("/developers?x=1#top")).toEqual({
    kind: "page",
    file: "content/docs/developers/index.mdx",
  });
});

test("returns null for a missing page", () => {
  expect(resolveHref("/guide/nope")).toBeNull();
});

test("both areas are root folders", () => {
  for (const area of AREA_ROOTS) {
    const meta = JSON.parse(
      readFileSync(
        join(import.meta.dir, `../content/docs/${area}/meta.json`),
        "utf8"
      )
    );
    expect(meta.root).toBe(true);
  }
});
