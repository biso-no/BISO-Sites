import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAPER_INK_SHADOW = /rgba\(26, 24, 20/;
const BINDING_SELECTOR = ".biso-surface:is(.pg-page, .pe-frame) {";
const DARK_RAMP_SELECTOR = ".dark .biso-surface {";

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

  test("the render root and the canvas rebind the paper ramp to the site tokens", () => {
    expect(binding).not.toBe("");
    for (const line of [
      "--paper: var(--background);",
      "--paper-2: var(--section);",
      "--ink: var(--foreground);",
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
    expect(ruleBody(blocks, ".pg-contact {")).toContain(
      "background: var(--pg-navy);"
    );
    expect(ruleBody(blocks, ".pg-hero--full {")).toContain("var(--pg-navy)");
  });
});
