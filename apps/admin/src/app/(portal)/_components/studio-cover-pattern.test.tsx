import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StudioCoverPattern,
  studioCoverBackground,
  studioCoverPatternIndex,
} from "./studio";

const PATTERNS = [
  { index: 1, stored: "dotted", title: "Dotted cover pattern" },
  { index: 2, stored: "linear", title: "Linear cover pattern" },
  { index: 3, stored: "concentric", title: "Concentric cover pattern" },
  { index: 4, stored: "wave", title: "Wave cover pattern" },
  { index: 5, stored: "grid", title: "Grid cover pattern" },
];

test("each stored cover pattern maps to its artwork and gradient", () => {
  const gradients = new Set<string>();
  for (const { index, stored, title } of PATTERNS) {
    expect(studioCoverPatternIndex(stored)).toBe(index);
    expect(
      renderToStaticMarkup(<StudioCoverPattern which={index} />)
    ).toContain(`<title>${title}</title>`);
    gradients.add(studioCoverBackground(stored));
  }
  expect(gradients.size).toBe(PATTERNS.length);
});

test("an unknown or missing pattern falls back to the dotted artwork", () => {
  for (const stored of ["custom", "", null, undefined]) {
    expect(studioCoverPatternIndex(stored)).toBe(1);
    expect(studioCoverBackground(stored)).toBe(studioCoverBackground("dotted"));
  }
});
