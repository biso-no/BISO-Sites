import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIVATE_PLACEHOLDER, redactPrivate, selectSources } from "./retrieve";

const PRIVATE_IMPORT = /lib\/private|\.\.\/private|\.\/private/;

const page = (url: string, length: number) => ({
  url,
  title: url,
  text: "x".repeat(length),
});

test("redactPrivate replaces self-closing and paired Private tags, including multi-line", () => {
  const input = [
    'Open <Private name="a" label="Tenant id" /> first.',
    '<Private name="b" label="Key">',
    "secret value",
    "on two lines",
    "</Private>",
    "Then <Private name='c'>inline</Private> done.",
  ].join("\n");
  const out = redactPrivate(input);
  expect(out).toContain(PRIVATE_PLACEHOLDER);
  expect(out).not.toContain("<Private");
  expect(out).not.toContain("secret value");
  expect(out.split(PRIVATE_PLACEHOLDER).length - 1).toBe(3);
});

test("selectSources puts the current page first even when it ranks low", () => {
  const out = selectSources([page("/a", 10), page("/b", 10), page("/c", 10)], {
    currentUrl: "/c",
    maxSources: 6,
    maxChars: 1000,
  });
  expect(out.map((s) => s.url)).toEqual(["/c", "/a", "/b"]);
});

test("selectSources dedupes by url and numbers from 1", () => {
  const out = selectSources([page("/a", 10), page("/a", 10), page("/b", 10)], {
    maxSources: 6,
    maxChars: 1000,
  });
  expect(out.map((s) => [s.n, s.url])).toEqual([
    [1, "/a"],
    [2, "/b"],
  ]);
});

test("selectSources never cuts a page and stops before the char limit", () => {
  const out = selectSources([page("/a", 60), page("/b", 50), page("/c", 30)], {
    maxSources: 6,
    maxChars: 100,
  });
  expect(out.map((s) => s.url)).toEqual(["/a", "/c"]);
  expect(out[0]?.text.length).toBe(60);
});

test("selectSources keeps the current page even when it alone exceeds maxChars", () => {
  const out = selectSources([page("/a", 10), page("/big", 500)], {
    currentUrl: "/big",
    maxSources: 6,
    maxChars: 100,
  });
  expect(out.map((s) => s.url)).toEqual(["/big"]);
});

test("selectSources respects maxSources", () => {
  const out = selectSources(
    [page("/a", 1), page("/b", 1), page("/c", 1), page("/d", 1)],
    { maxSources: 2, maxChars: 1000 }
  );
  expect(out).toHaveLength(2);
});

test("the assistant code and the ask route never import the private source", () => {
  const dirs = [import.meta.dir, join(import.meta.dir, "../../app/api/ask")];
  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) {
        continue;
      }
      const text = readFileSync(join(dir, file), "utf8");
      expect(text, file).not.toMatch(PRIVATE_IMPORT);
    }
  }
});
