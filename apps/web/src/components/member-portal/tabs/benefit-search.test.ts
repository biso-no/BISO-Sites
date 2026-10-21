import type { CampusBenefits } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { matchesBenefitSearch } from "./benefit-search";

/** A migrated member row: titles only, no description, partner or teaser. */
const migrated = {
  $id: "mb-1",
  category: "other",
  description_en: null,
  description_nb: null,
  partner_name: null,
  teaser_en: null,
  teaser_nb: null,
  title_en: "25% off at Peppes Pizza",
  title_nb: "25 % rabatt hos Peppes Pizza",
} as unknown as CampusBenefits;

describe("matchesBenefitSearch", () => {
  it("searches a row with no description or partner without throwing", () => {
    expect(matchesBenefitSearch(migrated, "pizza")).toBe(true);
    expect(matchesBenefitSearch(migrated, "rabatt")).toBe(true);
    expect(matchesBenefitSearch(migrated, "sushi")).toBe(false);
  });

  it("matches every row on an empty query", () => {
    expect(matchesBenefitSearch(migrated, "")).toBe(true);
  });

  it("matches partner and description text, ignoring case", () => {
    const full = {
      ...migrated,
      description_en: "<p>Show your member pass</p>",
      description_nb: "<p>Vis medlemskortet</p>",
      partner_name: "Peppes",
    } as CampusBenefits;

    expect(matchesBenefitSearch(full, "PEPPES")).toBe(true);
    expect(matchesBenefitSearch(full, "member pass")).toBe(true);
    expect(matchesBenefitSearch(full, "medlemskortet")).toBe(true);
  });

  it("survives a row missing its titles", () => {
    const untitled = {
      ...migrated,
      title_en: null,
      title_nb: null,
    } as unknown as CampusBenefits;

    expect(matchesBenefitSearch(untitled, "pizza")).toBe(false);
  });
});
