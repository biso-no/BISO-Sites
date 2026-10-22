import { describe, expect, test } from "bun:test";
import {
  benefitDateFromIso,
  benefitEndIso,
  benefitStartIso,
} from "./benefit-dates";

describe("benefit dates", () => {
  test("start of day in Oslo summer time", () => {
    expect(benefitStartIso("2026-08-10")).toBe("2026-08-09T22:00:00.000Z");
  });

  test("end of day on the day daylight saving ends is CET", () => {
    expect(benefitEndIso("2026-10-25")).toBe("2026-10-25T22:59:59.000Z");
  });

  test("end of day before daylight saving ends is CEST", () => {
    expect(benefitEndIso("2026-10-24")).toBe("2026-10-24T21:59:59.000Z");
  });

  test("converts an ISO instant back to the Oslo date", () => {
    expect(benefitDateFromIso("2026-10-25T22:59:59.000Z")).toBe("2026-10-25");
  });

  test("empty and invalid input give null", () => {
    for (const value of [null, undefined, "", "not-a-date"]) {
      expect(benefitStartIso(value)).toBeNull();
      expect(benefitEndIso(value)).toBeNull();
      expect(benefitDateFromIso(value)).toBeNull();
    }
  });
});
