import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TEXT_COLOUR_TOKENS } from "@repo/shared/utils/text-colour-tokens";

// A link inside coloured text keeps the link's colour: the save puts the
// colour's span inside the link (`<a><span data-color>`), and the span would
// paint over the link's accent. The panel field reads editor.css; the site
// and the canvas, which wears the public classes, read globals.css.

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;

const read = (path: string): string =>
  readFileSync(join(import.meta.dir, path), "utf8").replace(CSS_COMMENT, "");

/** Every plain rule: its selectors, one per comma, and its body. */
const rulesOf = (css: string) =>
  [...css.matchAll(RULE)].map(([, selectors = "", body = ""]) => ({
    body: body.trim(),
    selectors: selectors.split(",").map((selector) => selector.trim()),
  }));

describe.each([
  ["the panel field", "editor.css", ".pe-rt-field"],
  ["the site and the canvas", "../../../ui/styles/globals.css", ".pg-rich"],
])("in %s, a link keeps its colour inside coloured text", (_, path, scope) => {
  const rules = rulesOf(read(path));

  test("a coloured run inside a link takes the link's colour", () => {
    const linkRule = rules.find((rule) =>
      rule.selectors.includes(`${scope} a [data-color]`)
    );
    expect(linkRule?.body).toBe("color: inherit;");
  });

  test("each colour still paints a run outside a link", () => {
    for (const token of TEXT_COLOUR_TOKENS) {
      const rule = rules.find((r) =>
        r.selectors.includes(`${scope} [data-color="${token}"]`)
      );
      expect(rule?.body, token).toContain("color: var(");
    }
  });

  test("no rule paints a coloured run inside a link", () => {
    const offenders = rules
      .flatMap((rule) => rule.selectors)
      .filter((selector) => selector.startsWith(`${scope} a [data-color=`));
    expect(offenders).toEqual([]);
  });
});
