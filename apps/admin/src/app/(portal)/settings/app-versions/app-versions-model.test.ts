import { expect, test } from "bun:test";
import { shouldWarnAboveStore } from "./app-versions-model";

test("warns only for a valid minimum above the live version", () => {
  expect(shouldWarnAboveStore("2.4.0", "2.2.4")).toBe(true);
  expect(shouldWarnAboveStore("2.2.4", "2.2.4")).toBe(false);
  expect(shouldWarnAboveStore("2.4", "2.2.4")).toBe(false);
  expect(shouldWarnAboveStore("2.4.0", null)).toBe(false);
});
