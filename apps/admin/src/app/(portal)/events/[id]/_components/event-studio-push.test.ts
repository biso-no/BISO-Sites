import { describe, expect, test } from "bun:test";
import { describePushAudience } from "./event-studio-push";

describe("describePushAudience", () => {
  test("says the count is unavailable rather than guessing", () => {
    expect(describePushAudience(null)).toBe(
      "Follower count unavailable for this campus."
    );
  });

  test("reports genuinely zero subscribers distinctly from unavailable", () => {
    expect(describePushAudience(0)).toBe(
      "No devices follow events at this campus yet."
    );
  });

  test("uses the singular for exactly one device", () => {
    expect(describePushAudience(1)).toBe(
      "1 device follows events at this campus."
    );
  });

  test("uses the plural, thousands-separated, for more than one device", () => {
    expect(describePushAudience(1234)).toBe(
      "1,234 devices follow events at this campus."
    );
  });

  test(
    "counts devices, not students - the label this replaced overstated the " +
      "audience because one student with two devices is two subscribers",
    () => {
      expect(describePushAudience(2)).not.toContain("student");
      expect(describePushAudience(0)).not.toContain("student");
      expect(describePushAudience(null)).not.toContain("student");
    }
  );
});
