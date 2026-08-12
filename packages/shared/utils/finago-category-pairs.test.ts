import { describe, expect, it } from "vitest";
import { buildCustomerCategoryPairs } from "./finago-category-pairs";

describe("buildCustomerCategoryPairs", () => {
  it("sends Key as the category id and Value as the customer id", () => {
    // Pinned deliberately: the 24SO SaveCustomerCategories contract is
    // Key=CategoryId, Value=CompanyId. The repo previously had these inverted,
    // which silently assigned nothing.
    expect(buildCustomerCategoryPairs(1_715_738, [113_176])).toEqual([
      { Key: "113176", Value: "1715738" },
    ]);
  });

  it("builds one pair per category", () => {
    expect(buildCustomerCategoryPairs(42, [1, 2, 3])).toEqual([
      { Key: "1", Value: "42" },
      { Key: "2", Value: "42" },
      { Key: "3", Value: "42" },
    ]);
  });

  it("drops non-finite category ids", () => {
    expect(buildCustomerCategoryPairs(42, [1, Number.NaN])).toEqual([
      { Key: "1", Value: "42" },
    ]);
  });

  it("returns an empty list for no categories", () => {
    expect(buildCustomerCategoryPairs(42, [])).toEqual([]);
  });
});
