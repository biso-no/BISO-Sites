import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT_ROOT = join(import.meta.dirname, "..", "content", "docs");
const MDX = /\.mdx$/;

function listed(dir: string): Set<string> {
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as {
    pages?: string[];
  };
  return new Set(meta.pages ?? []);
}

function missingIn(dir: string): string[] {
  const pages = listed(dir);
  const missing: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!pages.has(entry.name)) {
        missing.push(`${dir}/${entry.name}`);
      }
      missing.push(...missingIn(join(dir, entry.name)));
    } else if (MDX.test(entry.name)) {
      const name = entry.name.replace(MDX, "");
      if (!pages.has(name)) {
        missing.push(`${dir}/${entry.name}`);
      }
    }
  }
  return missing;
}

test("every page and folder is listed in its folder's meta.json", () => {
  expect(
    missingIn(CONTENT_ROOT).map((p) => p.replace(CONTENT_ROOT, ""))
  ).toEqual([]);
});

const FENCE = /^\s*(```|~~~)/;
const INLINE_CODE = /`[^`]*`/g;
const ESM_LINE = /^(import|export)\s/;
// `{count}` in prose is a JavaScript expression to MDX. It compiles, then
// fails the build at prerender with "count is not defined". Write `\{count}`.
const BARE_PLACEHOLDER = /(?<![\\=])\{[A-Za-z_]\w*\}/;

function barePlaceholdersIn(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...barePlaceholdersIn(path));
      continue;
    }
    if (!MDX.test(entry.name)) {
      continue;
    }
    let inFence = false;
    for (const [index, line] of readFileSync(path, "utf8")
      .split("\n")
      .entries()) {
      if (FENCE.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence || ESM_LINE.test(line)) {
        continue;
      }
      const match = line.replace(INLINE_CODE, "").match(BARE_PLACEHOLDER);
      if (match) {
        found.push(`${path}:${index + 1} ${match[0]}`);
      }
    }
  }
  return found;
}

test("no page has an unescaped {placeholder} outside code", () => {
  expect(
    barePlaceholdersIn(CONTENT_ROOT).map((p) => p.replace(CONTENT_ROOT, ""))
  ).toEqual([]);
});
