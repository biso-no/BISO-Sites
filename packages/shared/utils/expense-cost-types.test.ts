import { describe, expect, it } from "vitest";
import {
  defaultCostTypeSlugForCategory,
  resolveReceiptAccount,
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
      { slug: "other", label: "Other", accountNumber: 7790 },
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
      accountNumber: 7315,
      taxCode: 0,
    });
  });

  it("throws on an unknown cost type", () => {
    expect(() => resolveReceiptAccount("bogus")).toThrow(
      "Unknown expense cost"
    );
  });
});
