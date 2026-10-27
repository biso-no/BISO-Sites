import { expect, test } from "bun:test";
import { formatUpdated } from "./format";

test("formats a date", () => {
  expect(formatUpdated(new Date("2026-10-27T10:00:00Z"))).toBe("27 Oct 2026");
});

test("missing date gives null", () => {
  expect(formatUpdated(undefined)).toBeNull();
});

test("invalid date gives null", () => {
  expect(formatUpdated("not a date")).toBeNull();
});
