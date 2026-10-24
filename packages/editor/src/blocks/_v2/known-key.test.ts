import { expect, test } from "bun:test";
import { knownKey } from "./known-key";

const TABLE = { large: "a", medium: "b" } as const;

test("a known key is kept", () => {
  expect(knownKey(TABLE, "large", "medium")).toBe("large");
});

test("an unknown, inherited or non-string value takes the fallback", () => {
  for (const value of ["huge", "constructor", "toString", undefined, 3, null]) {
    expect(knownKey(TABLE, value, "medium")).toBe("medium");
  }
});
