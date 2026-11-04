import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;

const css = readFileSync(join(import.meta.dir, "editor.css"), "utf8").replace(
  CSS_COMMENT,
  ""
);

/** The bodies of the rules that list `selector`. */
const bodiesOf = (selector: string): string[] =>
  [...css.matchAll(RULE)]
    .filter(([, selectors = ""]) =>
      selectors
        .split(",")
        .map((s) => s.trim())
        .includes(selector)
    )
    .map(([, , body = ""]) => body);

// On a window shorter than the wide writing view, its content stays in
// reach: the panel is held to the window and scrolls.
test("the wide view's panel scrolls on a short window", () => {
  const [panel = ""] = bodiesOf(".pe-rt-expand__panel");
  expect(panel).toContain("max-height: calc(100vh - 64px);");
  expect(panel).toContain("overflow: auto;");
});
