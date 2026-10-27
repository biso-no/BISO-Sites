import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The editor chrome inside the canvas frame reads the paper/ink ramp, bound
// to the site's tokens. This is the one rule that remains of the old binding.
const BINDING_SELECTOR = ".biso-surface.pe-frame {";
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
const LEGACY_VARIABLE =
  /--(pg-navy|pg-radius|pg-shadow|pg-gutter|pg-space|pg-column|lift|inverted)/;

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

describe("the legacy block styling is gone", () => {
  test("blocks.css does not exist and nothing imports it", () => {
    expect(existsSync(join(import.meta.dir, "blocks.css"))).toBe(false);
    expect(read("styles.css")).not.toContain("blocks.css");
  });

  test("the legacy frame binding and its variables are gone from every sheet", () => {
    for (const name of ["tokens.css", "editor.css", "sections.css"]) {
      const css = read(name).replace(CSS_COMMENT, "");
      expect(css, name).not.toContain(".pg-section");
      expect(css, name).not.toContain(".pg-block");
      expect(css, name).not.toMatch(LEGACY_VARIABLE);
    }
  });

  test("no sheet styles a block that no longer exists", () => {
    for (const name of ["tokens.css", "editor.css", "sections.css"]) {
      const css = read(name);
      for (const root of [
        ".pg-campusselect",
        ".pg-filterbar",
        ".pg-profileheader",
        ".pg-twocol",
      ]) {
        expect(css, `${name} ${root}`).not.toContain(root);
      }
    }
  });
});

/**
 * The editor chrome inside the canvas frame is written against a paper/ink
 * ramp. The frame binds that ramp to the site's tokens so the chrome looks as
 * it always has; these assertions keep that binding from quietly disappearing.
 */
describe("the canvas frame keeps its paper ramp", () => {
  const tokens = read("tokens.css");
  const binding = ruleBody(tokens, BINDING_SELECTOR);

  test("the frame rebinds the ramp the chrome reads to the site tokens", () => {
    expect(binding).not.toBe("");
    for (const line of [
      "--paper: var(--background);",
      "--paper-2: var(--section);",
      "--pg-ink: var(--foreground);",
      "--rule: var(--border);",
      "--claret: var(--brand-dark);",
      "--serif: var(--font-display, var(--font-biso-display));",
      "--ui: var(--font-sans, var(--font-biso-sans));",
    ]) {
      expect(binding).toContain(line);
    }
  });

  test("the binding outranks the dark ramp on the same element", () => {
    expect(tokens.indexOf(DARK_RAMP_SELECTOR)).toBeGreaterThan(-1);
    expect(tokens.indexOf(BINDING_SELECTOR)).toBeGreaterThan(
      tokens.indexOf(DARK_RAMP_SELECTOR)
    );
  });

  test("the :root ramp the chrome and inspector read is still declared", () => {
    for (const variable of [
      "--paper",
      "--paper-2",
      "--paper-3",
      "--pg-ink",
      "--ink-2",
      "--ink-3",
      "--ink-4",
      "--rule",
      "--rule-2",
      "--claret",
      "--gold",
      "--leaf",
      "--page-accent",
      "--ui",
      "--serif",
      "--mono",
    ]) {
      expect(tokens, variable).toContain(`${variable}:`);
    }
  });
});

/**
 * The site's v2 surface owns `--ink` (navy on paper, paper on navy). The
 * editor's own ramp is `--pg-ink`, so a section's `color: var(--ink)` reads
 * the v2 alias and a `data-surface="deep"` band flips it.
 */
describe("the editor's ink leaves the site's --ink alone", () => {
  test("no editor sheet declares --ink", () => {
    for (const name of ["tokens.css", "editor.css", "sections.css"]) {
      expect(read(name).replace(CSS_COMMENT, ""), name).not.toMatch(
        INK_DECLARATION
      );
    }
    expect(read("tokens.css")).toContain("--pg-ink: #1a1814;");
  });

  test("the chrome sheets read --pg-ink; only sections read the v2 --ink", () => {
    for (const name of ["tokens.css", "editor.css"]) {
      expect(read(name).replace(CSS_COMMENT, ""), name).not.toMatch(
        INK_REFERENCE
      );
    }
    expect(read("sections.css")).toMatch(INK_REFERENCE);
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
  const sheets = ["tokens.css", "editor.css", "sections.css"].map((name) => ({
    name,
    css: read(name),
  }));

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
