import { describe, expect, test } from "bun:test";
import { CAMPUS_SEGMENTS } from "@repo/shared/utils/unit-urls";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "./campus-constants";
import { assignUnitSlugs, uniqueUnitSlug, unitSlug } from "./departments";

describe("unitSlug", () => {
  test("strips the campus prefix so all campuses share one slug", () => {
    expect(unitSlug("OSL Fadderullan")).toBe("fadderullan");
    expect(unitSlug("BRG Fadderullan")).toBe("fadderullan");
    expect(unitSlug("TRD Fadderullan")).toBe("fadderullan");
    expect(unitSlug("STV Fadderullan")).toBe("fadderullan");
  });

  test("folds Norwegian characters using the existing convention", () => {
    expect(unitSlug("BRG Næringsliv")).toBe("naeringsliv");
    expect(unitSlug("TRD Økonomi")).toBe("okonomi");
    expect(unitSlug("OSL Påvirkning")).toBe("pavirkning");
  });

  test("hyphenates multi-word names and collapses punctuation runs", () => {
    expect(unitSlug("TRD Sosialt Utvalg")).toBe("sosialt-utvalg");
    expect(unitSlug("OSL DIGI-KOMM - Digital")).toBe("digi-komm-digital");
  });

  test("drops the nedlagt suffix carried by closed units", () => {
    expect(unitSlug("OSL DataAnalytisk Utvalg - nedlagt")).toBe(
      "dataanalytisk-utvalg"
    );
  });

  test("leaves unprefixed national names alone", () => {
    expect(unitSlug("Sentralt utvalg")).toBe("sentralt-utvalg");
  });

  test("never returns an empty slug", () => {
    expect(unitSlug("!!!")).toBe("unit");
    expect(unitSlug("")).toBe("unit");
  });
});

describe("uniqueUnitSlug", () => {
  test("returns the base when free", () => {
    expect(uniqueUnitSlug("fadderullan", new Set())).toBe("fadderullan");
  });

  test("suffixes from 2 upward on collision", () => {
    expect(uniqueUnitSlug("fadderullan", new Set(["fadderullan"]))).toBe(
      "fadderullan-2"
    );
    expect(
      uniqueUnitSlug("fadderullan", new Set(["fadderullan", "fadderullan-2"]))
    ).toBe("fadderullan-3");
  });
});

describe("campus table drift guard", () => {
  test("unit-urls campus ids match campus-constants", () => {
    expect(Object.keys(CAMPUS_SEGMENTS).sort()).toEqual(
      Object.values(CAMPUS_NAME_TO_ID).sort()
    );
  });

  test("unit-urls campus labels match campus-constants names", () => {
    for (const [id, entry] of Object.entries(CAMPUS_SEGMENTS)) {
      expect(entry.label).toBe(CAMPUS_ID_TO_NAME[id] as string);
    }
  });
});

describe("assignUnitSlugs", () => {
  test("assigns one slug per active department", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "612", campusId: "3", name: "TRD Sosialt Utvalg", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("612")).toBe("sosialt-utvalg");
  });

  test("the same name in different campuses does NOT collide", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "410", campusId: "2", name: "BRG Fadderullan", active: true },
        { $id: "705", campusId: "3", name: "TRD Fadderullan", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("410")).toBe("fadderullan");
    expect(assigned.get("705")).toBe("fadderullan");
  });

  test("the same name WITHIN one campus is suffixed", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "309", campusId: "1", name: "OSL Fadderullan", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("309")).toBe("fadderullan-2");
  });

  test("never rewrites a slug that is already assigned", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: "fadderullan" }],
      [
        {
          $id: "308",
          campusId: "1",
          name: "OSL Fadderullan 2026",
          active: true,
        },
      ]
    );
    expect(assigned.has("308")).toBe(false);
  });

  test("respects slugs already taken in the same campus", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: "fadderullan" }],
      [{ $id: "309", campusId: "1", name: "OSL Fadderullan", active: true }]
    );
    expect(assigned.get("309")).toBe("fadderullan-2");
  });

  test("skips inactive departments so a closed unit cannot hold the slug", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        {
          $id: "300",
          campusId: "1",
          name: "OSL Fadderullan - nedlagt",
          active: false,
        },
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
      ]
    );
    expect(assigned.has("300")).toBe(false);
    expect(assigned.get("308")).toBe("fadderullan");
  });
});
