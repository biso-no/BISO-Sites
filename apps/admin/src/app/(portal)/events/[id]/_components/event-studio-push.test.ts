import { describe, expect, test } from "bun:test";
import { describePushAudience } from "./event-studio-push";

describe("describePushAudience", () => {
  test("says the count is unavailable rather than guessing", () => {
    expect(describePushAudience(null)).toBe(
      "Notify devices subscribed to events at this campus. Subscriber count unavailable. Sends once when published."
    );
  });

  test("reports genuinely zero subscribers distinctly from unavailable", () => {
    expect(describePushAudience(0)).toBe(
      "No devices are subscribed to event notifications at this campus yet. Sends once when published."
    );
  });

  test("uses the singular for exactly one device", () => {
    expect(describePushAudience(1)).toBe(
      "Notify 1 device subscribed to events at this campus. Sends once when published."
    );
  });

  test("uses the plural, thousands-separated, for more than one device", () => {
    expect(describePushAudience(1234)).toBe(
      "Notify 1,234 devices subscribed to events at this campus. Sends once when published."
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
