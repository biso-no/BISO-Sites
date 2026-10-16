import { describe, expect, test } from "bun:test";
import { scanTone } from "./scan-tone";

describe("scanTone", () => {
  test.each([
    [{ result: "valid" }, "green"],
    [{ result: "duplicate" }, "orange"],
    [{ result: "check_id" }, "amber"],
    [{ reason: "stale", result: "denied" }, "red"],
    [{ result: "unavailable" }, "grey"],
  ] as const)("%o → %s", (outcome, tone) => {
    expect(scanTone(outcome)).toBe(tone);
  });
});
