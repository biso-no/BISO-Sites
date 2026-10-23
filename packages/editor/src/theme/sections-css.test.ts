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

// ── v2 surfaces and the page top ────────────────────────────────────────────

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;
const HAIRLINE = /border-top:\s*1px solid var\(--edge\)/;
const NAV_OFFSET_PADDING =
  /padding-top:\s*calc\(\s*var\(--pg-nav-offset(?:,\s*0px)?\)\s*\+\s*var\(--pg-sec-pad-y\)\s*\)/;
const NAV_OFFSET_HEIGHT = /height:\s*var\(--pg-nav-offset(?:,\s*0px)?\)/;
const SITE_SIBLINGS = /^\.pg-sec\b[^,]*\+\s*\.pg-sec\b/;
const CANVAS_ADJACENT =
  /^\.pe-section\b[^+]*\+\s*\.pe-section\s*>\s*\.pg-sec\b/;
const CANVAS_WITH_GAP =
  /^\.pe-section\b[^+]*\+\s*[^+]+\+\s*\.pe-section\s*>\s*\.pg-sec\b/;
const WHITE = /data-background="white"/g;
const TOP_LEVEL_COMMA = /,(?![^(]*\))/;
const WHITESPACE_RUN = /\s+/g;

/** Every rule as `{ selectors, body }`, at-rule blocks flattened. */
const rules = [...sectionsCss.replace(CSS_COMMENT, "").matchAll(CSS_RULE)].map(
  ([, prelude, body]) => ({
    body,
    selectors: prelude
      .trim()
      .split(TOP_LEVEL_COMMA)
      .map((part) => part.trim().replace(WHITESPACE_RUN, " ")),
  })
);
const rulesFor = (selector: string) =>
  rules.filter((rule) => rule.selectors.includes(selector));
const declares = (selector: string, declaration: string | RegExp) =>
  rulesFor(selector).some((rule) =>
    typeof declaration === "string"
      ? rule.body.includes(declaration)
      : declaration.test(rule.body)
  );

test("sections paint the v2 surface and ink", () => {
  expect(declares(".pg-sec", "background: var(--surface);")).toBe(true);
  expect(declares(".pg-sec", "color: var(--ink);")).toBe(true);
  expect(
    declares(
      '.pg-sec:where([data-background="tinted"])',
      "background: var(--surface-sunken);"
    )
  ).toBe(true);
  // No legacy paper or inverted tokens left on the section itself.
  expect(sectionsCss).not.toContain("var(--paper");
  expect(sectionsCss).not.toContain("var(--inverted");
});

test("a photo covers the section behind a flat navy scrim", () => {
  expect(declares(".pg-sec__photo", "object-fit: cover;")).toBe(true);
  expect(declares(".pg-sec__photo", "position: absolute;")).toBe(true);
  expect(
    declares(
      ".pg-sec__scrim",
      "background: color-mix(in srgb, var(--biso-deep) 62%, transparent);"
    )
  ).toBe(true);
});

test("the site clears the fixed nav; the canvas, which has none, does not", () => {
  expect(declares(".pg-page", "--pg-nav-offset: 5rem;")).toBe(true);
  expect(declares(".pe-frame", "--pg-nav-offset: 0px;")).toBe(true);
  // The old reservation on the page itself is gone: the first section owns it.
  expect(blocksCss.replace(CSS_COMMENT, "")).not.toContain("--pg-nav-offset");
});

test("the first section clears the nav and paints a navy strip under it unless it is navy already", () => {
  expect(declares(".pg-sec:where([data-first])", NAV_OFFSET_PADDING)).toBe(
    true
  );
  const strip = rules.find((rule) =>
    rule.selectors.some(
      (part) =>
        part.includes("[data-first]") &&
        part.includes(':not([data-surface="deep"])') &&
        part.endsWith("::before")
    )
  );
  expect(strip?.body).toMatch(NAV_OFFSET_HEIGHT);
  expect(strip?.body).toContain("background: var(--biso-deep);");
});

test("an anchored section scrolls to below the nav", () => {
  expect(
    declares(".pg-sec[id]", "scroll-margin-top: var(--pg-nav-offset, 0px);")
  ).toBe(true);
});

test("two white sections in a row get a hairline, on the site and on the canvas", () => {
  const parts = rules
    .filter((rule) => HAIRLINE.test(rule.body))
    .flatMap((rule) => rule.selectors);
  const site = parts.filter((part) => SITE_SIBLINGS.test(part));
  // Preview: section wrappers are adjacent. Edit: "+ Add section" sits between.
  const adjacent = parts.filter((part) => CANVAS_ADJACENT.test(part));
  const withGap = parts.filter((part) => CANVAS_WITH_GAP.test(part));
  for (const found of [site, adjacent, withGap]) {
    expect(found).toHaveLength(1);
    // Both sections must be white.
    expect(found[0].match(WHITE)).toHaveLength(2);
  }
});

const HEADER_PADDING =
  /padding:\s*calc\(\s*var\(--pg-nav-offset(?:,\s*0px)?\)\s*\+\s*var\(--pg-header-pad-y\)\s*\)\s*clamp\(1rem, 4cqi, 2rem\)\s*var\(--pg-header-pad-y\);/;

test("the page header clears the nav and keeps the sections' container-relative rhythm", () => {
  expect(
    declares(".pg-header", "--pg-header-pad-y: clamp(3rem, 6cqi, 5rem);")
  ).toBe(true);
  expect(declares(".pg-header", HEADER_PADDING)).toBe(true);
  // `--section-y` is vw-based: the canvas's phone frame would follow the
  // admin window instead of its own width.
  for (const rule of rulesFor(".pg-header")) {
    expect(rule.body).not.toContain("--section-y");
  }
});

const V2_PAIR =
  ".pg-col__item:has([data-block]) + .pg-col__item:has([data-block])";

test("v2 blocks stacked in a column are spaced, and an empty one takes no room", () => {
  expect(declares(".pg-col", "--pg-stack: 1.5rem;")).toBe(true);
  expect(declares(V2_PAIR, "margin-top: var(--pg-stack);")).toBe(true);
  expect(
    declares(".pg-col__item:has(> [data-block]:empty)", "display: none;")
  ).toBe(true);
  // The canvas's zipper and drop line sit in the middle of that gap.
  expect(
    declares(
      `${V2_PAIR} > :is(.pe-zipper, .pe-drop-slot)`,
      "top: calc(var(--pg-stack) / -2);"
    )
  ).toBe(true);
});

const FIRST_HIDDEN = ".pg-sec:where([data-first][data-hide-phone])";
const FIRST_SHOWN = ".pg-sec:not([data-hide-phone]) ~ *";

test("on phones, a hidden first section hands the nav clearance to the first one shown", () => {
  const phone = sectionsCss.slice(
    sectionsCss.indexOf("@container pg-page (max-width: 639px)")
  );
  const inPhone = rules.filter((rule) =>
    rule.selectors.some((part) =>
      phone.replace(WHITESPACE_RUN, " ").includes(part)
    )
  );
  const clearance = inPhone.find((rule) =>
    rule.selectors.some(
      (part) =>
        part.startsWith(FIRST_HIDDEN) &&
        part.includes(FIRST_SHOWN) &&
        !part.endsWith("::before")
    )
  );
  expect(clearance?.body).toMatch(NAV_OFFSET_PADDING);
  const strip = inPhone.find((rule) =>
    rule.selectors.some(
      (part) =>
        part.startsWith(FIRST_HIDDEN) &&
        part.includes(':not([data-surface="deep"])') &&
        part.endsWith("::before")
    )
  );
  expect(strip?.body).toMatch(NAV_OFFSET_HEIGHT);
  expect(strip?.body).toContain("background: var(--biso-deep);");
});

test("a full header is tall only when it has media behind it", () => {
  expect(
    declares('.pg-header[data-variant="full"][data-media]', "min-height:")
  ).toBe(true);
  for (const rule of rulesFor('.pg-header[data-variant="full"]')) {
    expect(rule.body).not.toContain("min-height");
  }
});
