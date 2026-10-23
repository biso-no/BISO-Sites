import { expect, test } from "bun:test";
import { cardGridClass } from "./card-grid";

const VIEWPORT = /(?<![\w@-])(?:sm|md|lg|xl|2xl):/;

test("every column count uses container variants only", () => {
  for (const columns of [2, 3, 4] as const) {
    expect(cardGridClass(columns)).not.toMatch(VIEWPORT);
  }
});

test("columns step up with the container", () => {
  expect(cardGridClass(2)).toBe("grid gap-5 grid-cols-1 @md:grid-cols-2");
  expect(cardGridClass(3)).toContain("@3xl:grid-cols-3");
  expect(cardGridClass(4)).toContain("@3xl:grid-cols-4");
});

test("an unknown count falls back to two columns", () => {
  expect(cardGridClass(9 as unknown as 2)).toBe(cardGridClass(2));
});
