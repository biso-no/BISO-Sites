import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The canvas bubble sits in the frame, whose paper ramp is bound to the site's
// tokens (`.biso-surface.pe-frame`, tokens.css) and turns dark in dark mode.
// A literal `white` there is white on the dark ramp's light ink.

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const WHITE_BACKGROUND = /background:\s*white\b/;
const WHITE = /(?<![\w-])white(?![\w-])/;
const BUBBLE = ".pe-rt-bubble";

const css = readFileSync(join(import.meta.dir, "editor.css"), "utf8").replace(
  CSS_COMMENT,
  ""
);

/** Every plain rule: its selectors, one per comma, and its body. */
const rules = [...css.matchAll(RULE)].map(([, selectors = "", body = ""]) => ({
  body,
  selectors: selectors.split(",").map((selector) => selector.trim()),
}));

/** The bodies of the rules that list `selector`. */
const bodiesOf = (selector: string): string[] =>
  rules
    .filter((rule) => rule.selectors.includes(selector))
    .map((rule) => rule.body);

describe("the bubble's colour menu reads in light and dark frames", () => {
  test("a pressed or hovered item takes the ramp's paper and ink", () => {
    for (const selector of [
      '.pe-rt-bubble .pe-rt-pop__item[aria-pressed="true"]',
      ".pe-rt-bubble .pe-rt-pop__item:not(:disabled):hover",
    ]) {
      const [body = ""] = bodiesOf(selector);
      expect(body, selector).toContain("background: var(--paper-2);");
      expect(body, selector).toContain("color: var(--pg-ink);");
    }
  });

  test("every white the toolbar paints is repainted in the bubble", () => {
    // The panel field itself never sits in the bubble.
    const painted = rules
      .filter((rule) => WHITE_BACKGROUND.test(rule.body))
      .flatMap((rule) => rule.selectors)
      .filter((s) => s.startsWith(".pe-rt-") && !s.startsWith(".pe-rt-field"));
    expect(painted).toContain('.pe-rt-pop__item[aria-pressed="true"]');
    const unpainted = painted.filter(
      (selector) =>
        !bodiesOf(`${BUBBLE} ${selector}`).some((body) =>
          body.includes("background:")
        )
    );
    expect(unpainted).toEqual([]);
  });

  test("no bubble rule paints white", () => {
    const offenders = rules
      .filter(
        (rule) =>
          rule.selectors.some((selector) => selector.startsWith(BUBBLE)) &&
          WHITE.test(rule.body)
      )
      .map((rule) => rule.selectors.join(", "));
    expect(offenders).toEqual([]);
  });

  test("a colour dot has a ring against what it sits on", () => {
    const [menuDot = ""] = bodiesOf(
      ".pe-rt-bubble .pe-rt-pop .pe-rt-swatch:not(.pe-rt-swatch--none)"
    );
    expect(menuDot).toContain("var(--pg-ink)");
    const [buttonDot = ""] = bodiesOf(
      ".pe-rt-bubble .pe-rt-colour__dot:not(.pe-rt-swatch--none)"
    );
    expect(buttonDot).toContain("var(--paper)");
  });
});
