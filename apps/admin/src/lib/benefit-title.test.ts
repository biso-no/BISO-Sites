import { describe, expect, test } from "bun:test";
import { benefitDisplayTitle } from "./benefit-title";

describe("benefitDisplayTitle", () => {
  test("uses the English title when there is one", () => {
    expect(
      benefitDisplayTitle({ title_en: "Campus café", title_nb: "Kantina" })
    ).toBe("Campus café");
  });

  test("falls back to the Norwegian title so a Norwegian-only benefit is not a blank row", () => {
    expect(benefitDisplayTitle({ title_en: "  ", title_nb: "Kantina" })).toBe(
      "Kantina"
    );
  });
});
