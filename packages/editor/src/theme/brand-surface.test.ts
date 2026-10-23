import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAPER_INK_SHADOW = /rgba\(26, 24, 20/;
const BINDING_SELECTOR =
  ".biso-surface:is(.pg-page, .pe-frame),\n.pg-section {";
const DARK_RAMP_SELECTOR = ".dark .biso-surface {";
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
// A selector that starts outside the editor's own `.pg-*`/`.pe-*` markup:
// `:root`, `*`, a bare element, or the `.biso-surface` the site's root carries.
const GLOBAL_START = /^(:root|\*|[a-z][a-z0-9]*)(?![\w-])/;
const HOST_ROOT = /^(\.dark)?\s*\.biso-surface$|^\.dark\.biso-surface$/;
const TAILWIND_KEYFRAMES = /@keyframes\s+(spin|ping|pulse|bounce)\b/;
const TAILWIND_ANIMATION = /animation:\s*(spin|ping|pulse|bounce)\b/;
// The exact property `--ink`, not `--ink-2…4` and not `--pg-ink`.
const INK_DECLARATION = /(?<![\w-])--ink\s*:/;
const INK_REFERENCE = /var\(\s*--ink\s*[,)]/;
const PAINTS_BACKGROUND = /(?<![\w-])background(-color)?\s*:/;

const read = (name: string) =>
  readFileSync(join(import.meta.dir, name), "utf8");

/** The body of the first rule that starts with `selector`, up to its `}`. */
const ruleBody = (css: string, selector: string): string => {
  const start = css.indexOf(selector);
  if (start === -1) {
    return "";
  }
  const open = start + selector.length;
  return css.slice(open, css.indexOf("}", open));
};

/**
 * The block styles are written against a paper/ink ramp. What makes a page
 * look like biso.no is the binding of that ramp to the site's tokens inside
 * the render root and the canvas. These assertions keep that binding from
 * quietly disappearing in a refactor.
 */
describe("brand surface binding", () => {
  const tokens = read("tokens.css");
  const binding = ruleBody(tokens, BINDING_SELECTOR);

  test("the render root, the canvas and each section rebind the paper ramp to the site tokens", () => {
    expect(binding).not.toBe("");
    for (const line of [
      "--paper: var(--background);",
      "--paper-2: var(--section);",
      "--pg-ink: var(--foreground);",
      "--rule: var(--border);",
      "--claret: var(--brand-dark);",
      "--serif: var(--font-display, var(--font-biso-display));",
      "--ui: var(--font-sans, var(--font-biso-sans));",
      "--pg-navy: oklch(",
    ]) {
      expect(binding).toContain(line);
    }
  });

  test("the binding outranks the dark ramp on the same element", () => {
    // `.dark .biso-surface` is (0,2,0) and matches the render root itself, so
    // the binding needs two classes AND a later position to win in dark mode.
    expect(tokens.indexOf(DARK_RAMP_SELECTOR)).toBeGreaterThan(-1);
    expect(tokens.indexOf(BINDING_SELECTOR)).toBeGreaterThan(
      tokens.indexOf(DARK_RAMP_SELECTOR)
    );
  });

  test("block styles carry no paper-era colours of their own", () => {
    const blocks = read("blocks.css");
    for (const hue of [
      "#6b1e1e",
      "#b08a3e",
      "#2f5d3a",
      "#2a4a7a",
      "#c05a3f",
      "#1a1814",
    ]) {
      expect(blocks.toLowerCase()).not.toContain(hue);
    }
    expect(blocks).not.toMatch(PAPER_INK_SHADOW);
    expect(blocks).not.toContain("border-radius: 12px;");
  });

  test("buttons use the brand gradient and dark panels a theme-stable navy", () => {
    const blocks = read("blocks.css");
    expect(ruleBody(blocks, ".pg-hero__cta {")).toContain(
      "var(--brand-gradient-from)"
    );
    expect(ruleBody(blocks, ".pg-cta__btn {")).toContain(
      "var(--brand-gradient-from)"
    );
    // Both dark banners keep their navy while the background is Auto.
    expect(ruleBody(blocks, ".pg-section[data-auto] .pg-contact {")).toContain(
      "background: var(--pg-navy);"
    );
    expect(
      ruleBody(
        blocks,
        ":is(.pg-section[data-auto] .pg-hero--full, .pg-hero--full:has(> .pg-hero__bg)) {"
      )
    ).toContain("var(--pg-navy)");
  });
});

/**
 * The site's v2 surface owns `--ink` (navy on paper, paper on navy). The
 * editor's own ramp is `--pg-ink`, so a section's `color: var(--ink)` reads
 * the v2 alias and a `data-surface="deep"` band flips it.
 */
describe("the editor's ink leaves the site's --ink alone", () => {
  test("no editor sheet declares --ink", () => {
    for (const name of [
      "tokens.css",
      "editor.css",
      "blocks.css",
      "sections.css",
    ]) {
      expect(read(name).replace(CSS_COMMENT, ""), name).not.toMatch(
        INK_DECLARATION
      );
    }
    expect(read("tokens.css")).toContain("--pg-ink: #1a1814;");
  });

  test("the legacy sheets read --pg-ink; only sections read the v2 --ink", () => {
    for (const name of ["tokens.css", "editor.css", "blocks.css"]) {
      expect(read(name).replace(CSS_COMMENT, ""), name).not.toMatch(
        INK_REFERENCE
      );
    }
    expect(read("sections.css")).toMatch(INK_REFERENCE);
  });

  test("a dark frame still rebinds the site tokens the legacy blocks read", () => {
    // The section paints the surface now; the frame no longer does, but the
    // legacy blocks' copy follows `--foreground` and must stay light on navy.
    const inverted = ruleBody(
      read("blocks.css"),
      '.pg-section[data-background="inverted"] {'
    );
    expect(inverted).toContain("--foreground: var(--inverted-foreground);");
    expect(inverted).toContain("--background: var(--inverted);");
    expect(inverted).toContain("--muted-foreground: var(--inverted-muted);");
    // Tokens only: the frame itself paints nothing over the section.
    expect(inverted).not.toMatch(PAINTS_BACKGROUND);
  });
});

/** A selector list split at its top-level commas, so `:is(a, b)` stays whole. */
const selectorParts = (prelude: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of prelude) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
};

// `textarea.pg-msform__input` and `.pe-row input` are the editor's own: a
// `.pg-`/`.pe-` class or an attribute anywhere in the selector scopes it.
const EDITOR_SCOPE = /\.(pg|pe)[-_a-z]|\[/;

const isGlobal = (part: string): boolean =>
  !EDITOR_SCOPE.test(part) && (GLOBAL_START.test(part) || HOST_ROOT.test(part));

/** Top-level selectors and at-rules of a stylesheet, outside any block. */
const topLevelPreludes = (css: string): string[] => {
  const preludes: string[] = [];
  let depth = 0;
  let buffer = "";
  for (const char of css.replace(CSS_COMMENT, "")) {
    if (char === "{") {
      if (depth === 0) {
        preludes.push(buffer.trim());
      }
      depth += 1;
      buffer = "";
    } else if (char === "}") {
      depth -= 1;
      buffer = "";
    } else if (char === ";" && depth === 0) {
      buffer = "";
    } else {
      buffer += char;
    }
  }
  return preludes;
};

/**
 * apps/web loads these sheets on every unit and CMS page, and a route's CSS
 * stays in the document after the visitor navigates on. Anything that reaches
 * beyond the editor's own classes therefore restyles the whole site: an
 * unlayered `button { color: inherit }` turned every button in the navy
 * header near-black, `:root { --ink }` replaced the site's text colour, and a
 * global `@keyframes pulse` replaced the one Tailwind's `animate-pulse` runs.
 */
describe("nothing reaches the host page", () => {
  const sheets = ["tokens.css", "editor.css", "blocks.css", "sections.css"].map(
    (name) => ({
      name,
      css: read(name),
    })
  );

  test("every global rule sits in @layer base, below the host's utilities", () => {
    for (const { name, css } of sheets) {
      const unlayeredGlobals = topLevelPreludes(css).filter(
        (prelude) =>
          !prelude.startsWith("@") && selectorParts(prelude).some(isGlobal)
      );
      expect(unlayeredGlobals, name).toEqual([]);
    }
    // Declared in Tailwind's order, so `base` stays below `utilities`
    // whichever stylesheet the browser reads first.
    expect(read("tokens.css")).toContain(
      "@layer theme, base, components, utilities;"
    );
  });

  test("keeps the paper ramp off the site's own --ink", () => {
    const tokens = read("tokens.css");
    const base = tokens.slice(
      tokens.indexOf("@layer base {"),
      tokens.indexOf(BINDING_SELECTOR)
    );
    expect(base).toContain(":root {");
    expect(base).toContain(DARK_RAMP_SELECTOR);
    expect(base).toContain("button,");
  });

  test("names no keyframes Tailwind already defines", () => {
    for (const { name, css } of sheets) {
      expect(css, name).not.toMatch(TAILWIND_KEYFRAMES);
      expect(css, name).not.toMatch(TAILWIND_ANIMATION);
    }
  });
});
