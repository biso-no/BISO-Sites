import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const COLUMN_CONTAINER = /\.pg-col\s*{[^}]*container:\s*pg\s*\/\s*inline-size/;
const PAGE_CONTAINER = /container:\s*pg-page\s*\/\s*inline-size/;
const GRID_RULE = /(\.pg-sec[^{,]*> \.pg-sec__grid)\s*{([^}]*)}/g;
const WHERE_CLAUSE = /:where\([^)]*\)/g;
const CLASS_OR_ATTRIBUTE = /\.[\w-]+|\[[^\]]+\]/g;
const PHONE_REVERSE_STRETCH = /column-reverse;\s*align-items:\s*stretch/;

const MARQUEE_TRACK = /\.pg-marquee--live \.pg-marquee__track\s*{([^}]*)}/;
const WHITESPACE = /\s+/g;
const DISPLAY_NONE = /display:\s*none/;

const read = (name: string) =>
  readFileSync(join(import.meta.dir, name), "utf8");

const sectionsCss = read("sections.css");

test("columns are the block container and the page is pg-page", () => {
  expect(sectionsCss).toMatch(COLUMN_CONTAINER);
  expect(sectionsCss).toMatch(PAGE_CONTAINER);
  expect(existsSync(join(import.meta.dir, "blocks.css"))).toBe(false);
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
  expect(existsSync(join(import.meta.dir, "blocks.css"))).toBe(false);
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

// ── Hairlines on Tinted ─────────────────────────────────────────────────────

const TINTED = '.pg-sec:where([data-background="tinted"])';
const EDGE_MIX =
  /--edge:\s*color-mix\(in srgb,\s*var\(--surface-sunken\),\s*var\(--ink\)\s*(\d+)%\);/;
const HEX = /#[0-9a-f]{6}/i;
const surfaceCss = readFileSync(
  join(import.meta.dir, "../../../ui/styles/biso-surface.css"),
  "utf8"
);
const token = (name: string, from = 0): string => {
  const at = surfaceCss.indexOf(`${name}:`, from);
  const hex = surfaceCss.slice(at).match(HEX)?.[0];
  if (at < 0 || !hex) {
    throw new Error(`${name} not found`);
  }
  return hex;
};
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const luminance = (c: number[]) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.040_45 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (a: number[], b: number[], share: number) =>
  a.map((v, i) => v * (1 - share) + b[i] * share);

test("hairlines on a Tinted section are darker, so they show on its fill", () => {
  // The page's --edge (#e8ecf0) on --surface-sunken (#eef1f5) is ~1.05:1.
  const rule = rulesFor(TINTED).find((r) => EDGE_MIX.test(r.body));
  const share = Number(rule?.body.match(EDGE_MIX)?.[1]) / 100;
  expect(share).toBeGreaterThan(0);

  const sunken = rgb(token("--surface-sunken"));
  const ink = rgb(token("--biso-deep"));
  expect(contrast(rgb(token("--biso-line")), sunken)).toBeLessThan(1.1);
  expect(contrast(mix(sunken, ink, share), sunken)).toBeGreaterThanOrEqual(1.3);

  // In the dark theme the same rule mixes toward paper, and stays a line.
  const darkFrom = surfaceCss.indexOf(".dark .biso-surface-v2");
  const darkSunken = rgb(token("--surface-sunken", darkFrom));
  const paper = rgb(token("--biso-paper"));
  expect(
    contrast(mix(darkSunken, paper, share), darkSunken)
  ).toBeGreaterThanOrEqual(1.3);
});

test("a site section with only empty or hidden items is hidden, never on the canvas", () => {
  const rule = [...sectionsCss.matchAll(/([^{}]*:has\([^{}]*)\{([^}]*)\}/g)]
    .map((m) => ({ selector: m[1], body: m[2] }))
    .find(
      (r) =>
        r.selector.includes(".pg-page") &&
        r.selector.includes(".pg-sec") &&
        DISPLAY_NONE.test(r.body) &&
        r.selector.includes(":not(")
    );
  expect(rule).toBeDefined();
  expect(rule?.selector).not.toContain(".pe-frame");
});

// `:has()` cannot nest inside `:has()`: browsers drop the whole rule.
function hasNestedHas(css: string): boolean {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let from = text.indexOf(":has(");
  while (from !== -1) {
    let depth = 1;
    let i = from + ":has(".length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === "(") {
        depth += 1;
      } else if (text[i] === ")") {
        depth -= 1;
      }
      i += 1;
    }
    if (text.slice(start, i - 1).includes(":has(")) {
      return true;
    }
    from = text.indexOf(":has(", from + 1);
  }
  return false;
}

test("no :has() is nested inside another :has()", () => {
  expect(hasNestedHas(sectionsCss)).toBe(false);
  expect(hasNestedHas("a:not(:has(b:not(:has(c))))")).toBe(true);
});

test("the empty-band rules use the flat selectors", () => {
  expect(sectionsCss).toContain(
    ".pg-page .pg-sec:not(:has(.pg-col__item > [data-block]:not(:empty)))"
  );
  expect(sectionsCss.replace(WHITESPACE, "")).toContain(
    ".pg-page .pg-sec:not(:has(.pg-col__item:not([data-hide-phone]) > [data-block]:not(:empty)))".replace(
      WHITESPACE,
      ""
    )
  );
});

test("under reduced motion the marquee track shrinks and wraps", () => {
  const block = sectionsCss.slice(
    sectionsCss.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      sectionsCss.indexOf("pg-marquee-scroll")
    )
  );
  const track = block.match(MARQUEE_TRACK)?.[1];
  const flat = (track ?? "").replace(WHITESPACE, " ");
  for (const decl of [
    "flex-shrink: 1;",
    "min-width: 0;",
    "width: 100%;",
    "flex-wrap: wrap;",
    "white-space: normal;",
  ]) {
    expect(flat).toContain(decl);
  }
});
