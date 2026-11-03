import { expect, test } from "bun:test";
import { nestsDeeperThan, textLines } from "./nesting-scan";

// The cases the sanitiser tests cannot tell apart by output: sanitize-html
// drops SVG with its content either way, so only the cost would differ.
test.each([
  ["tags in an svg <style>", `<svg><style>${"<b>".repeat(150)}`],
  [
    "tags in a math <title>",
    `<math><mtext><b><math><title>${"<b>".repeat(150)}`,
  ],
  [
    "self-closed tags in svg close",
    `<svg>${"<g/>".repeat(150)}${"<g>".repeat(150)}`,
  ],
])("%s count", (_, html) => {
  expect(nestsDeeperThan(html, 100)).toBe(true);
});

test.each([
  [
    "raw text back in HTML inside svg",
    `<svg><foreignObject><style>${"<b>".repeat(150)}</style></foreignObject></svg>`,
  ],
  [
    "a self-closed svg leaves foreign content",
    `<svg/><style>${"<b>".repeat(150)}</style>`,
  ],
  ["self-closed tags in svg", `<svg>${"<g/>".repeat(150)}</svg>`],
  ["a depth of exactly the limit", `${"<b>".repeat(100)}x`],
])("%s does not count", (_, html) => {
  expect(nestsDeeperThan(html, 100)).toBe(false);
});

test("text lines split at blocks and keep entities as written", () => {
  expect(
    textLines("<h2>T</h2><p>a <b>b</b> &amp; c<br>d</p><ul><li>e</li></ul> f")
  ).toEqual(["T", "a b &amp; c", "d", "e", "f"]);
});
