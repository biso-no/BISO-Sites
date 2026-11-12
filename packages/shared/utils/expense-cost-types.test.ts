import { describe, expect, it } from "vitest";
import {
  AI_TYPE_CONFIDENCE_THRESHOLD,
  costTypeLabel,
  DEFAULT_EXPENSE_COST_TYPES,
  defaultCostTypeSlugForCategory,
  findCostType,
  resolveReceiptAccount,
  STARTING_EXPENSE_COST_TYPES,
} from "./expense-cost-types";

describe("defaultCostTypeSlugForCategory", () => {
  it("maps OCR categories to their default cost type", () => {
    expect(defaultCostTypeSlugForCategory("travel")).toBe("travel");
    expect(defaultCostTypeSlugForCategory("accommodation")).toBe("travel");
    expect(defaultCostTypeSlugForCategory("meal")).toBe("social");
    expect(defaultCostTypeSlugForCategory("event-materials")).toBe("academic");
    expect(defaultCostTypeSlugForCategory("supplies")).toBe("other");
    expect(defaultCostTypeSlugForCategory("fee")).toBe("other");
  });

  it("falls back to other for null/unknown categories", () => {
    expect(defaultCostTypeSlugForCategory(null)).toBe("other");
    expect(defaultCostTypeSlugForCategory("nonsense")).toBe("other");
  });

  it("only returns slugs present in the provided options", () => {
    const options = [
      { slug: "travel", label: "Travel", accountNumber: 7140 },
      { slug: "other", label: "Other", accountNumber: 6555 },
    ];
    // "meal" maps to "social", which is absent → falls back to "other"
    expect(defaultCostTypeSlugForCategory("meal", options)).toBe("other");
  });
});

describe("resolveReceiptAccount", () => {
  it("resolves the GL account + tax code for a known cost type", () => {
    expect(resolveReceiptAccount("travel")).toEqual({
      accountNumber: 7140,
      taxCode: 0,
    });
    expect(resolveReceiptAccount("academic")).toEqual({
      accountNumber: 7305,
      taxCode: 0,
    });
  });

  it("throws on an unknown cost type", () => {
    expect(() => resolveReceiptAccount("bogus")).toThrow(
      "Unknown expense cost"
    );
  });
});

describe("STARTING_EXPENSE_COST_TYPES", () => {
  it("has 22 unique slugs with sequential sort order", () => {
    const slugs = STARTING_EXPENSE_COST_TYPES.map((type) => type.slug);
    expect(slugs).toHaveLength(22);
    expect(new Set(slugs).size).toBe(22);
    expect(STARTING_EXPENSE_COST_TYPES.map((type) => type.sortOrder)).toEqual(
      slugs.map((_, index) => index)
    );
  });

  it("keeps the accounts for the core four", () => {
    const account = (slug: string) =>
      findCostType(slug, STARTING_EXPENSE_COST_TYPES)?.accountNumber;
    expect(account("travel")).toBe(7140);
    expect(account("social")).toBe(7310);
    expect(account("academic")).toBe(7305);
    expect(account("other")).toBe(6555);
  });

  it("asks for an occasion on the four expected types", () => {
    expect(
      STARTING_EXPENSE_COST_TYPES.filter((type) => type.askOccasion).map(
        (type) => type.slug
      )
    ).toEqual(["meeting-food", "board-event", "social", "gifts-volunteers"]);
  });

  it("uses a threshold of 0.8", () => {
    expect(AI_TYPE_CONFIDENCE_THRESHOLD).toBe(0.8);
  });
});

describe("DEFAULT_EXPENSE_COST_TYPES", () => {
  it("is the travel, social, academic, other subset", () => {
    expect(DEFAULT_EXPENSE_COST_TYPES.map((type) => type.slug)).toEqual([
      "travel",
      "social",
      "academic",
      "other",
    ]);
  });
});

describe("costTypeLabel", () => {
  const meetingFood = findCostType("meeting-food", STARTING_EXPENSE_COST_TYPES);

  it("uses the Norwegian label for no", () => {
    expect(meetingFood && costTypeLabel(meetingFood, "no")).toBe("Møtemat");
  });

  it("uses the English label otherwise", () => {
    expect(meetingFood && costTypeLabel(meetingFood, "en")).toBe(
      "Food during meetings"
    );
  });

  it("falls back to the English label without a Norwegian one", () => {
    expect(costTypeLabel({ label: "X" }, "no")).toBe("X");
  });
});
