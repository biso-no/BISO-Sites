import { expect, test } from "bun:test";
import { listOf } from "./list";

test("a list keeps its objects", () => {
  const items = [{ text: "a" }, { text: "b" }];
  expect(listOf(items)).toEqual(items);
});

test("anything but a list is empty, and junk inside a list is skipped", () => {
  for (const value of ["oops", undefined, null, 3, { text: "a" }]) {
    expect(listOf(value)).toEqual([]);
  }
  expect(listOf([null, "x", 3, { text: "a" }])).toEqual([{ text: "a" }]);
});
