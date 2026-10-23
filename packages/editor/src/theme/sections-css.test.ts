import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COLUMN_CONTAINER = /\.pg-col\s*{[^}]*container:\s*pg\s*\/\s*inline-size/;
const PAGE_CONTAINER = /container:\s*pg-page\s*\/\s*inline-size/;
const GRID_RULE = /(\.pg-sec[^{,]*> \.pg-sec__grid)\s*{([^}]*)}/g;
const WHERE_CLAUSE = /:where\([^)]*\)/g;
const CLASS_OR_ATTRIBUTE = /\.[\w-]+|\[[^\]]+\]/g;
const PHONE_REVERSE_STRETCH = /column-reverse;\s*align-items:\s*stretch/;

const read = (name: string) =>
  readFileSync(join(import.meta.dir, name), "utf8");

const sectionsCss = read("sections.css");
const blocksCss = read("blocks.css");

test("columns are the block container and the page is pg-page", () => {
  expect(sectionsCss).toMatch(COLUMN_CONTAINER);
  expect(blocksCss).toMatch(PAGE_CONTAINER);
});

test("phones stack and tablets can", () => {
  expect(sectionsCss).toContain("@container pg-page (max-width: 639px)");
  expect(sectionsCss).toContain("@container pg-page (max-width: 1023px)");
  expect(sectionsCss).toContain('[data-tablet="stack"]');
});

// Cascade: all layout rules on the grid must tie on specificity, so source
// order decides (templates, then tablet, then phone).
const gridSelectors = [...sectionsCss.matchAll(GRID_RULE)]
  .filter((m) => m[2].includes("grid-template-columns"))
  .map((m) => ({ index: m.index ?? 0, selector: m[1].trim() }));

const specificity = (selector: string): number => {
  const bare = selector.replace(WHERE_CLAUSE, "");
  return (bare.match(CLASS_OR_ATTRIBUTE) ?? []).length;
};

test("grid template rules tie on specificity", () => {
  expect(gridSelectors.length).toBeGreaterThanOrEqual(8);
  for (const { selector } of gridSelectors) {
    expect(specificity(selector)).toBe(2);
  }
});

test("templates, then tablet, then phone in source order", () => {
  const template = sectionsCss.indexOf('data-columns="1-1-1"');
  const tablet = sectionsCss.indexOf("@container pg-page (max-width: 1023px)");
  const phone = sectionsCss.indexOf("@container pg-page (max-width: 639px)");
  expect(template).toBeGreaterThan(-1);
  expect(template).toBeLessThan(tablet);
  expect(tablet).toBeLessThan(phone);
});

test("phone reverse resets alignment", () => {
  expect(sectionsCss).toMatch(PHONE_REVERSE_STRETCH);
});
