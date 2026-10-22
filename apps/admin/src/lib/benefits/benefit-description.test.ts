import { describe, expect, test } from "bun:test";
import { isFormattedDescription } from "./benefit-description";

describe("isFormattedDescription", () => {
  test("knows HTML and Plate JSON", () => {
    expect(isFormattedDescription("<p>Hei</p>")).toBe(true);
    expect(
      isFormattedDescription('  [{"type":"p","children":[{"text":"Hei"}]}]')
    ).toBe(true);
  });

  test("treats everything else as plain text", () => {
    expect(isFormattedDescription("Hei\nhallo")).toBe(false);
    expect(isFormattedDescription("[Nyhet] 20 %")).toBe(false);
    expect(isFormattedDescription("[]")).toBe(false);
    expect(isFormattedDescription(null)).toBe(false);
  });
});
