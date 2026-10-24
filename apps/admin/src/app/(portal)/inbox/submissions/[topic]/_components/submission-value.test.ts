import { describe, expect, test } from "bun:test";
import { formatSubmissionValue } from "./submission-value";

describe("formatSubmissionValue", () => {
  test("joins lists with a comma and a space", () => {
    expect(formatSubmissionValue(["Sport", "Kultur"])).toBe("Sport, Kultur");
    expect(formatSubmissionValue([])).toBe("");
  });

  test("shows booleans as Ja and Nei", () => {
    expect(formatSubmissionValue(true)).toBe("Ja");
    expect(formatSubmissionValue(false)).toBe("Nei");
  });

  test("passes everything else through String", () => {
    expect(formatSubmissionValue("Ada")).toBe("Ada");
    expect(formatSubmissionValue(42)).toBe("42");
    expect(formatSubmissionValue(null)).toBe("");
    expect(formatSubmissionValue(undefined)).toBe("");
  });
});
