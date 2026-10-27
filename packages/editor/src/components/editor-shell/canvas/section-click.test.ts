import { expect, test } from "bun:test";
import { clickSelectsSection } from "./section-click";

// Stand-ins for the DOM: an element answers `closest`, a selection reports
// whether it is collapsed.
const inBlock = {
  closest: (selector: string) => (selector === ".pe-block" ? {} : null),
};
const onPadding = { closest: () => null };
const caret = { isCollapsed: true };
const selectedText = { isCollapsed: false };

test("a click on the section's padding selects it", () => {
  expect(clickSelectsSection(onPadding, caret)).toBe(true);
  expect(clickSelectsSection(onPadding, null)).toBe(true);
});

test("releasing a text selection over the padding does not", () => {
  // Selecting text in a block and letting go outside it fires the click on
  // the section; taking that as "select the section" dropped the block.
  expect(clickSelectsSection(onPadding, selectedText)).toBe(false);
});

test("a press that started inside a block does not", () => {
  expect(clickSelectsSection(inBlock, caret)).toBe(false);
  expect(clickSelectsSection(inBlock, null)).toBe(false);
});

test("a click with no recorded press (keyboard) still selects", () => {
  expect(clickSelectsSection(null, caret)).toBe(true);
});
