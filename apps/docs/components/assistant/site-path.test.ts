import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stepSlug } from "lib/step-ids";
import { sitePath } from "./site-path";

const CONTENT = join(import.meta.dirname, "../../content/docs");
const MDX_FILE = /(?:\/?index)?\.mdx$/;
const STEP_TITLE = /<Step\b[^>]*\btitle="([^"]+)"/g;

test("every docs page url is accepted as it is", async () => {
  const { source } = await import("lib/source");
  const urls = source.getPages().map((page) => page.url);
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.filter((url) => sitePath(url) !== url)).toEqual([]);
});

test("every step anchor is accepted as it is", () => {
  const urls = readdirSync(CONTENT, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".mdx"))
    .flatMap((file) =>
      [...readFileSync(join(CONTENT, file), "utf8").matchAll(STEP_TITLE)].map(
        (match) => `/${file.replace(MDX_FILE, "")}#${stepSlug(match[1] ?? "")}`
      )
    );
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.filter((url) => sitePath(url) !== url)).toEqual([]);
});

// Heading ids are made by Fumadocs at build time, so these come from the
// built pages. The first is the only id there with a character outside
// a-z, 0-9 and "-".
test("heading anchors are accepted as they are", () => {
  for (const url of [
    "/developers/reference/payments#credentials-the-payment_settings-table",
    "/guide/recruitment/book-interviews#before-you-start",
    "/guide/recruitment/book-interviews#what-happens-next",
  ]) {
    expect(sitePath(url)).toBe(url);
  }
});
