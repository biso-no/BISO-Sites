import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { describe, expect, it } from "vitest";
import {
  filterBenefits,
  matchesBenefitSearch,
  presentBenefitCategories,
} from "./benefit-search";

const benefit = (overrides: Partial<PublicBenefit>): PublicBenefit => ({
  campusId: "5",
  category: "other",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id: "mb-1",
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "none",
  section: "member",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: {
    en: "25% off at Peppes Pizza",
    nb: "25 % rabatt hos Peppes Pizza",
  },
  ...overrides,
});

describe("matchesBenefitSearch", () => {
  it("searches a row with no description or partner without throwing", () => {
    expect(matchesBenefitSearch(benefit({}), "pizza")).toBe(true);
    expect(matchesBenefitSearch(benefit({}), "rabatt")).toBe(true);
    expect(matchesBenefitSearch(benefit({}), "sushi")).toBe(false);
  });

  it("matches every row on an empty query", () => {
    expect(matchesBenefitSearch(benefit({}), "")).toBe(true);
  });

  it("matches partner and description text, ignoring case", () => {
    const full = benefit({
      description: {
        en: "<p>Show your member pass</p>",
        nb: "<p>Vis medlemskortet</p>",
      },
      partner: { id: "p", logoUrl: null, name: "Peppes", websiteUrl: null },
    });

    expect(matchesBenefitSearch(full, "PEPPES")).toBe(true);
    expect(matchesBenefitSearch(full, "member pass")).toBe(true);
    expect(matchesBenefitSearch(full, "medlemskortet")).toBe(true);
  });
});

describe("category chips", () => {
  const benefits = [
    benefit({ category: "food_drink", id: "a" }),
    benefit({ category: "travel", id: "b" }),
    benefit({ category: "Lifestyle", id: "c" }),
    benefit({ category: null, id: "d" }),
  ];

  it("lists only the studio categories that are present, in catalog order", () => {
    expect(presentBenefitCategories(benefits)).toEqual([
      "food_drink",
      "travel",
    ]);
  });

  it("filters on the category key", () => {
    expect(filterBenefits(benefits, "food_drink", "").map((b) => b.id)).toEqual(
      ["a"]
    );
    expect(filterBenefits(benefits, "all", "").map((b) => b.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});
