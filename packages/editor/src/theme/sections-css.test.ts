import { expect, test } from "bun:test";

const sectionsCss = await Bun.file(
  new URL("./sections.css", import.meta.url)
).text();
const blocksCss = await Bun.file(
  new URL("./blocks.css", import.meta.url)
).text();

test("columns are the block container and the page is pg-page", () => {
  expect(sectionsCss).toMatch(
    /\.pg-col\s*{[^}]*container:\s*pg\s*\/\s*inline-size/
  );
  expect(blocksCss).toMatch(/container:\s*pg-page\s*\/\s*inline-size/);
});

test("phones stack and tablets can", () => {
  expect(sectionsCss).toContain("@container pg-page (max-width: 639px)");
  expect(sectionsCss).toContain("@container pg-page (max-width: 1023px)");
  expect(sectionsCss).toContain('[data-tablet="stack"]');
});
