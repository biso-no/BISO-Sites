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

// Cascade: all layout rules on the grid must tie on specificity, so source
// order decides (templates, then tablet, then phone).
const gridSelectors = [
  ...sectionsCss.matchAll(/(\.pg-sec[^{,]*> \.pg-sec__grid)\s*{([^}]*)}/g),
]
  .filter((m) => m[2].includes("grid-template-columns"))
  .map((m) => ({ index: m.index ?? 0, selector: m[1].trim() }));

const specificity = (selector: string): number => {
  const bare = selector.replace(/:where\([^)]*\)/g, "");
  return (bare.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length;
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
  expect(sectionsCss).toMatch(/column-reverse;\s*align-items:\s*stretch/);
});
