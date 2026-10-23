import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SPACING = ["none", "compact", "normal", "spacious"] as const;
const WIDTH = ["prose", "content", "wide", "full"] as const;
const BLOCKS_DIR = join(import.meta.dir, "..", "blocks");
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;
const ROOT_CLASS =
  /className=(?:"pg-([a-z-]+)[^"]*\bpg-block\b|\{`pg-([a-z-]+)[^`]*\bpg-block\b)/g;
const PADDING_DECLARATION = /(?:^|;)\s*padding(?:-[a-z]+)?\s*:[^;]*/g;
const MAX_WIDTH_DECLARATION = /\bmax-width\s*:/;
const BACKGROUND_DECLARATION = /\bbackground\s*:/;
const ROOT_SELECTOR = /^\.pg-([a-z-]+?)(?:--[a-z-]+)?$/;
const TABLET_QUERY = "@container pg (max-width: 900px) {";
const INLINE_COLOUR = /\bcolor:\s*"(#[0-9a-fA-F]{3,8}|rgba?\([^"]*\))"/g;

/**
 * Inline colours that sit on a surface of their own, so they cannot meet the
 * section background: the gallery's remove button is a dark chip, and its
 * upload error only shows in the editor.
 */
const SELF_CONTAINED_INLINE_COLOURS = new Set([
  "gallery/render.tsx #fff",
  "gallery/render.tsx #b42318",
]);

const blocksCss = readFileSync(
  join(import.meta.dir, "blocks.css"),
  "utf8"
).replace(CSS_COMMENT, "");

const renderFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return renderFiles(fullPath);
    }
    return entry === "render.tsx" ? [fullPath] : [];
  });

/** `hero`, `text`, … — the class each blocks.css block puts on its root. */
const rootClasses = new Set(
  renderFiles(BLOCKS_DIR).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(ROOT_CLASS)].map(
      ([, quoted, templated]) => quoted ?? templated
    )
  )
);

/** The body of the at-rule or rule that starts at `opening`, braces matched. */
const blockBody = (css: string, opening: string): string => {
  const start = css.indexOf(opening);
  if (start === -1) {
    return "";
  }
  let depth = 0;
  for (let index = start; index < css.length; index++) {
    if (css[index] === "{") {
      depth++;
    } else if (css[index] === "}") {
      depth--;
      if (depth === 0) {
        return css.slice(css.indexOf("{", start) + 1, index);
      }
    }
  }
  return "";
};

/** True when a selector targets a block root itself, e.g. `.pg-timeline--wide`. */
const targetsRoot = (selector: string) =>
  selector
    .split(",")
    .map((part) => part.trim())
    .some((part) => {
      const match = ROOT_SELECTOR.exec(part);
      return match !== null && rootClasses.has(match[1]);
    });

describe("Design panel rules for blocks styled by blocks.css", () => {
  test("the root scan finds the blocks it guards", () => {
    expect(rootClasses.has("timeline")).toBe(true);
    expect(rootClasses.has("team")).toBe(true);
    expect(rootClasses.size).toBeGreaterThan(22);
  });

  test("every spacing option sets a scale", () => {
    for (const spacing of SPACING) {
      expect(blocksCss).toContain(`.pg-section[data-spacing="${spacing}"]`);
    }
  });

  test("every width option sets a measure", () => {
    for (const width of WIDTH) {
      expect(blocksCss).toContain(`.pg-section[data-width="${width}"]`);
    }
  });

  test("every block root scales its vertical padding by the spacing option", () => {
    const unscaled: string[] = [];
    for (const [, selector, body] of blocksCss.matchAll(CSS_RULE)) {
      if (!targetsRoot(selector.trim())) {
        continue;
      }
      for (const [declaration] of body.matchAll(PADDING_DECLARATION)) {
        if (!declaration.includes("var(--pg-space")) {
          unscaled.push(`${selector.trim()} → ${declaration.trim()}`);
        }
      }
    }
    expect(unscaled).toEqual([]);
  });

  test("no block root caps its own width, which would hide the width option", () => {
    const capped: string[] = [];
    for (const [, selector, body] of blocksCss.matchAll(CSS_RULE)) {
      if (targetsRoot(selector.trim()) && MAX_WIDTH_DECLARATION.test(body)) {
        capped.push(selector.trim());
      }
    }
    expect(capped).toEqual([]);
  });

  test("no block root paints a background over the section's surface", () => {
    const painted: string[] = [];
    for (const [, selector, body] of blocksCss.matchAll(CSS_RULE)) {
      if (targetsRoot(selector.trim()) && BACKGROUND_DECLARATION.test(body)) {
        painted.push(selector.trim());
      }
    }
    expect(painted).toEqual([]);
  });

  test("block roots take the column as their own inline padding", () => {
    // A capped wrapper would box in the panels and rules of every block on a
    // page wider than the column; the padding keeps them running edge to edge.
    for (const [, selector, body] of blocksCss.matchAll(CSS_RULE)) {
      if (selector.trim() === ".pg-section__inner") {
        expect(body).not.toMatch(MAX_WIDTH_DECLARATION);
      }
    }
    const column = [...blocksCss.matchAll(CSS_RULE)].find(
      ([, selector]) => selector.trim() === ".pg-section__inner > .pg-block"
    );
    expect(column?.[2]).toContain("padding-inline:");
    expect(column?.[2]).toContain("var(--pg-column)");
  });

  test("a Narrow column repeats every tablet rule", () => {
    const tablet = blockBody(blocksCss, TABLET_QUERY);
    expect(tablet).not.toBe("");
    const selectors = [...tablet.matchAll(CSS_RULE)].flatMap(([, selector]) =>
      selector.split(",").map((part) => part.trim())
    );
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(blocksCss).toContain(
        `.pg-section[data-width="prose"] ${selector}`
      );
    }
  });
});

describe("block renderers leave colour to the surface", () => {
  test("no renderer hardcodes an inline colour that a surface cannot follow", () => {
    const hardcoded: string[] = [];
    for (const file of renderFiles(BLOCKS_DIR)) {
      const name = file.slice(BLOCKS_DIR.length + 1);
      for (const [, colour] of readFileSync(file, "utf8").matchAll(
        INLINE_COLOUR
      )) {
        if (!SELF_CONTAINED_INLINE_COLOURS.has(`${name} ${colour}`)) {
          hardcoded.push(`${name} ${colour}`);
        }
      }
    }
    expect(hardcoded).toEqual([]);
  });
});
