import { describe, expect, it } from "vitest";
import {
  BENEFIT_CATEGORIES,
  BENEFIT_CATEGORY_LABELS,
  BENEFIT_SECTION_LABELS,
  BENEFIT_SECTIONS,
  CAMPUS_IDS,
  isBenefitCategory,
  isBenefitSection,
  mapLegacyBenefitCategory,
  NATIONAL_CAMPUS_ID,
} from "./benefit-catalog";
import { resolveBenefitCampusIds } from "./benefit-scope";

describe("benefit catalog", () => {
  it("exposes campus ids", () => {
    expect(NATIONAL_CAMPUS_ID).toBe("5");
    expect([...CAMPUS_IDS]).toEqual(["1", "2", "3", "4"]);
  });

  it("lists sections in website order with labels", () => {
    expect([...BENEFIT_SECTIONS]).toEqual([
      "member",
      "career",
      "social",
      "safety",
      "business",
    ]);
    expect(BENEFIT_SECTION_LABELS.safety).toEqual({
      nb: "Trygghet og støtte",
      en: "Safety & support",
    });
  });

  it("lists categories in order with labels", () => {
    expect([...BENEFIT_CATEGORIES]).toEqual([
      "food_drink",
      "health_fitness",
      "nightlife",
      "shopping",
      "travel",
      "software",
      "events",
      "other",
    ]);
    expect(BENEFIT_CATEGORY_LABELS.nightlife.nb).toBe("Uteliv");
    expect(BENEFIT_CATEGORY_LABELS.food_drink.en).toBe("Food & drink");
  });

  it("guards sections and categories", () => {
    expect(isBenefitSection("career")).toBe(true);
    expect(isBenefitSection("perk")).toBe(false);
    expect(isBenefitSection(null)).toBe(false);
    expect(isBenefitCategory("travel")).toBe(true);
    expect(isBenefitCategory("Health")).toBe(false);
    expect(isBenefitCategory(null)).toBe(false);
  });

  it("maps legacy categories", () => {
    expect(mapLegacyBenefitCategory("Health")).toBe("health_fitness");
    expect(mapLegacyBenefitCategory("Health & Fitness")).toBe("health_fitness");
    expect(mapLegacyBenefitCategory("Food & Drink")).toBe("food_drink");
    expect(mapLegacyBenefitCategory("Entertainment")).toBe("events");
    expect(mapLegacyBenefitCategory("Travel")).toBe("travel");
    expect(mapLegacyBenefitCategory("Software")).toBe("software");
    expect(mapLegacyBenefitCategory("  food & drink ")).toBe("food_drink");
    expect(mapLegacyBenefitCategory("nightlife")).toBe("nightlife");
    for (const value of [
      "Career",
      "Lifestyle",
      "Finance",
      "Education",
      "Other",
      "",
      null,
      undefined,
      "whatever",
    ]) {
      expect(mapLegacyBenefitCategory(value)).toBe("other");
    }
  });

  it("maps inherited object keys to other", () => {
    for (const value of [
      "constructor",
      "__proto__",
      "toString",
      "hasOwnProperty",
    ]) {
      expect(mapLegacyBenefitCategory(value)).toBe("other");
    }
  });

  it("keeps resolveBenefitCampusIds behaviour", () => {
    expect(resolveBenefitCampusIds(null)).toEqual(["5"]);
    expect(resolveBenefitCampusIds("5")).toEqual(["5"]);
    expect(resolveBenefitCampusIds("2")).toEqual(["2", "5"]);
  });
});
