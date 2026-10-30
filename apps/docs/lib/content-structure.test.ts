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
