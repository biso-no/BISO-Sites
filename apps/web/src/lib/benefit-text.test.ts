import { describe, expect, it } from "vitest";
import { benefitCategoryLabel } from "./benefit-text";

describe("benefitCategoryLabel", () => {
  it("labels a studio category in the visitor's language", () => {
    expect(benefitCategoryLabel("food_drink", "no")).toBe("Mat og drikke");
    expect(benefitCategoryLabel("food_drink", "en")).toBe("Food & drink");
    expect(benefitCategoryLabel("other", "no")).toBe("Annet");
  });

  it("shows a legacy category as stored", () => {
    expect(benefitCategoryLabel("Food & Drink", "no")).toBe("Food & Drink");
  });

  it("is empty when the row has no category", () => {
    expect(benefitCategoryLabel(null, "en")).toBe("");
    expect(benefitCategoryLabel(undefined, "no")).toBe("");
  });
});
